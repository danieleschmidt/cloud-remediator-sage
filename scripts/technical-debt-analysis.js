#!/usr/bin/env node

/**
 * Advanced Technical Debt Analysis Tool
 * Analyzes codebase for technical debt and provides remediation recommendations
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class TechnicalDebtAnalyzer {
  constructor(options = {}) {
    this.baseDir = options.baseDir || process.cwd();
    this.outputDir = options.outputDir || './reports';
    this.config = this.loadConfig();
    this.results = {
      summary: {},
      categories: {},
      recommendations: [],
      metrics: {}
    };
  }

  loadConfig() {
    const configPath = path.join(this.baseDir, 'tech-debt.config.js');
    if (fs.existsSync(configPath)) {
      return require(configPath);
    }

    return {
      codePatterns: {
        todo: /TODO|FIXME|HACK|XXX|BUG/gi,
        complexity: /for.*for.*for|if.*if.*if.*if/g,
        longLines: /.{120,}/g,
        magicNumbers: /[^a-zA-Z_]\d{2,}/g
      },
      thresholds: {
        fileLength: 500,        // lines
        functionLength: 50,     // lines
        cyclomaticComplexity: 10,
        duplicateLines: 5,      // minimum duplicate block size
        testCoverage: 80        // percentage
      },
      weights: {
        security: 10,
        performance: 8,
        maintainability: 6,
        readability: 4,
        testing: 7
      }
    };
  }

  async analyze() {
    console.log('🔍 Starting Technical Debt Analysis...');
    
    try {
      // Create output directory
      this.ensureOutputDirectory();
      
      // Analyze different aspects of technical debt
      await this.analyzeCodeComplexity();
      await this.analyzeDuplication();
      await this.analyzeTestCoverage();
      await this.analyzeSecurityDebt();
      await this.analyzeDependencyDebt();
      await this.analyzeArchitecturalDebt();
      
      // Generate recommendations
      this.generateRecommendations();
      
      // Create comprehensive report
      await this.generateReport();
      
      console.log('✅ Technical debt analysis completed');
      
    } catch (error) {
      console.error('❌ Technical debt analysis failed:', error.message);
      process.exit(1);
    }
  }

  async analyzeCodeComplexity() {
    console.log('📊 Analyzing code complexity...');
    
    const sourceFiles = this.getSourceFiles();
    const complexityResults = {
      highComplexityFiles: [],
      longFunctions: [],
      deepNesting: [],
      cognitiveComplexity: 0
    };

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      
      // Analyze file length
      if (lines.length > this.config.thresholds.fileLength) {
        complexityResults.highComplexityFiles.push({
          file: path.relative(this.baseDir, file),
          lines: lines.length,
          severity: this.getComplexitySeverity(lines.length, 'file')
        });
      }

      // Analyze function complexity (simplified)
      const functions = this.extractFunctions(content);
      functions.forEach(func => {
        if (func.lines > this.config.thresholds.functionLength) {
          complexityResults.longFunctions.push({
            file: path.relative(this.baseDir, file),
            function: func.name,
            lines: func.lines,
            severity: this.getComplexitySeverity(func.lines, 'function')
          });
        }
      });

      // Calculate cognitive complexity
      complexityResults.cognitiveComplexity += this.calculateCognitiveComplexity(content);
    }

    this.results.categories.complexity = complexityResults;
  }

  async analyzeDuplication() {
    console.log('🔄 Analyzing code duplication...');
    
    try {
      // Use simple pattern matching for duplication detection
      const sourceFiles = this.getSourceFiles();
      const duplicates = [];
      const codeBlocks = new Map();

      for (const file of sourceFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');
        
        // Check for duplicate blocks (simplified algorithm)
        for (let i = 0; i < lines.length - this.config.thresholds.duplicateLines; i++) {
          const block = lines.slice(i, i + this.config.thresholds.duplicateLines).join('\n').trim();
          if (block.length > 50 && !block.startsWith('//') && !block.startsWith('*')) {
            const hash = this.hashCode(block);
            if (codeBlocks.has(hash)) {
              duplicates.push({
                file1: codeBlocks.get(hash).file,
                line1: codeBlocks.get(hash).line,
                file2: path.relative(this.baseDir, file),
                line2: i + 1,
                blockSize: this.config.thresholds.duplicateLines
              });
            } else {
              codeBlocks.set(hash, {
                file: path.relative(this.baseDir, file),
                line: i + 1
              });
            }
          }
        }
      }

      this.results.categories.duplication = {
        duplicateBlocks: duplicates,
        duplicationRatio: duplicates.length / sourceFiles.length
      };

    } catch (error) {
      console.warn('⚠️  Duplication analysis failed:', error.message);
      this.results.categories.duplication = { error: error.message };
    }
  }

  async analyzeTestCoverage() {
    console.log('🧪 Analyzing test coverage...');
    
    try {
      // Read coverage report if available
      const coveragePath = path.join(this.baseDir, 'coverage/coverage-summary.json');
      if (fs.existsSync(coveragePath)) {
        const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
        
        this.results.categories.testing = {
          overallCoverage: coverage.total,
          uncoveredFiles: [],
          testGaps: []
        };

        // Identify files with low coverage
        Object.entries(coverage).forEach(([file, metrics]) => {
          if (file !== 'total' && metrics.lines.pct < this.config.thresholds.testCoverage) {
            this.results.categories.testing.uncoveredFiles.push({
              file: file,
              coverage: metrics.lines.pct,
              uncoveredLines: metrics.lines.total - metrics.lines.covered
            });
          }
        });
      } else {
        this.results.categories.testing = {
          error: 'No coverage report found. Run npm test to generate coverage.'
        };
      }
    } catch (error) {
      this.results.categories.testing = { error: error.message };
    }
  }

  async analyzeSecurityDebt() {
    console.log('🛡️ Analyzing security debt...');
    
    const securityIssues = {
      hardcodedSecrets: [],
      insecurePatterns: [],
      vulnerableDependencies: [],
      missingSecurityHeaders: []
    };

    const sourceFiles = this.getSourceFiles();
    const securityPatterns = {
      secrets: /(password|secret|key|token)\s*[:=]\s*['"][^'"]+['"]/gi,
      sqlInjection: /(query|exec|execute)\s*\(\s*['"][^'"]*\+[^'"]*['"]/gi,
      hardcodedUrls: /https?:\/\/[a-zA-Z0-9.-]+/gi,
      console: /console\.(log|debug|info)/gi
    };

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const relativePath = path.relative(this.baseDir, file);

      Object.entries(securityPatterns).forEach(([type, pattern]) => {
        const matches = [...content.matchAll(pattern)];
        matches.forEach(match => {
          const lineNumber = content.substring(0, match.index).split('\n').length;
          securityIssues.hardcodedSecrets.push({
            file: relativePath,
            line: lineNumber,
            type: type,
            match: match[0].substring(0, 50) + '...',
            severity: this.getSecuritySeverity(type)
          });
        });
      });
    }

    this.results.categories.security = securityIssues;
  }

  async analyzeDependencyDebt() {
    console.log('📦 Analyzing dependency debt...');
    
    try {
      const packageJsonPath = path.join(this.baseDir, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        // Run npm audit for vulnerability check
        let auditResult = {};
        try {
          const auditOutput = execSync('npm audit --json', { cwd: this.baseDir, stdio: 'pipe' });
          auditResult = JSON.parse(auditOutput.toString());
        } catch (error) {
          // npm audit returns non-zero exit code when vulnerabilities found
          if (error.stdout) {
            auditResult = JSON.parse(error.stdout.toString());
          }
        }

        this.results.categories.dependencies = {
          totalDependencies: Object.keys(dependencies).length,
          vulnerabilities: auditResult.vulnerabilities || {},
          outdatedPackages: [],
          unusedDependencies: []
        };
      }
    } catch (error) {
      this.results.categories.dependencies = { error: error.message };
    }
  }

  async analyzeArchitecturalDebt() {
    console.log('🏗️ Analyzing architectural debt...');
    
    const architecturalIssues = {
      circularDependencies: [],
      layerViolations: [],
      missingDocumentation: [],
      inconsistentPatterns: []
    };

    // Check for missing documentation
    const requiredDocs = ['README.md', 'ARCHITECTURE.md', 'CONTRIBUTING.md'];
    requiredDocs.forEach(doc => {
      if (!fs.existsSync(path.join(this.baseDir, doc))) {
        architecturalIssues.missingDocumentation.push({
          file: doc,
          severity: 'medium',
          impact: 'Developer onboarding and maintenance'
        });
      }
    });

    // Analyze module dependencies (simplified)
    const sourceFiles = this.getSourceFiles();
    const moduleGraph = new Map();
    
    sourceFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      const requires = [...content.matchAll(/require\(['"`]([^'"`]+)['"`]\)/g)];
      const imports = [...content.matchAll(/import.*from\s+['"`]([^'"`]+)['"`]/g)];
      
      const dependencies = [...requires, ...imports].map(match => match[1]);
      moduleGraph.set(path.relative(this.baseDir, file), dependencies);
    });

    this.results.categories.architecture = architecturalIssues;
  }

  generateRecommendations() {
    console.log('💡 Generating recommendations...');
    
    const recommendations = [];

    // Complexity recommendations
    if (this.results.categories.complexity?.highComplexityFiles.length > 0) {
      recommendations.push({
        category: 'Complexity',
        priority: 'High',
        title: 'Reduce file complexity',
        description: `${this.results.categories.complexity.highComplexityFiles.length} files exceed recommended length`,
        action: 'Break large files into smaller, focused modules',
        effort: 'Medium',
        impact: 'High'
      });
    }

    // Testing recommendations
    if (this.results.categories.testing?.uncoveredFiles?.length > 0) {
      recommendations.push({
        category: 'Testing',
        priority: 'High',
        title: 'Improve test coverage',
        description: `${this.results.categories.testing.uncoveredFiles.length} files have insufficient test coverage`,
        action: 'Add unit tests for uncovered code paths',
        effort: 'High',
        impact: 'High'
      });
    }

    // Security recommendations
    if (this.results.categories.security?.hardcodedSecrets.length > 0) {
      recommendations.push({
        category: 'Security',
        priority: 'Critical',
        title: 'Remove hardcoded secrets',
        description: `${this.results.categories.security.hardcodedSecrets.length} potential security issues found`,
        action: 'Move secrets to environment variables or secure storage',
        effort: 'Low',
        impact: 'Critical'
      });
    }

    this.results.recommendations = recommendations;
  }

  async generateReport() {
    console.log('📄 Generating technical debt report...');
    
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: this.generateSummary(),
      ...this.results
    };

    // Generate JSON report
    const jsonReport = path.join(this.outputDir, 'technical-debt-report.json');
    fs.writeFileSync(jsonReport, JSON.stringify(reportData, null, 2));

    // Generate HTML report
    const htmlReport = this.generateHtmlReport(reportData);
    const htmlReportPath = path.join(this.outputDir, 'technical-debt-report.html');
    fs.writeFileSync(htmlReportPath, htmlReport);

    console.log(`📊 Reports generated:`);
    console.log(`   JSON: ${jsonReport}`);
    console.log(`   HTML: ${htmlReportPath}`);
  }

  // Helper methods
  getSourceFiles() {
    const sourceDir = path.join(this.baseDir, 'src');
    const scriptsDir = path.join(this.baseDir, 'scripts');
    const files = [];
    
    if (fs.existsSync(sourceDir)) {
      files.push(...this.getJsFiles(sourceDir));
    }
    if (fs.existsSync(scriptsDir)) {
      files.push(...this.getJsFiles(scriptsDir));
    }
    
    return files;
  }

  getJsFiles(dir) {
    const files = [];
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        files.push(...this.getJsFiles(fullPath));
      } else if (item.endsWith('.js') && !item.includes('.test.') && !item.includes('.spec.')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  extractFunctions(content) {
    const functions = [];
    const functionPattern = /(?:function\s+(\w+)|(\w+)\s*[:=]\s*(?:function|\([^)]*\)\s*=>))/g;
    let match;
    
    while ((match = functionPattern.exec(content)) !== null) {
      const name = match[1] || match[2];
      const startIndex = match.index;
      const lines = this.estimateFunctionLength(content, startIndex);
      
      functions.push({ name, lines });
    }
    
    return functions;
  }

  estimateFunctionLength(content, startIndex) {
    // Simplified function length estimation
    const remaining = content.substring(startIndex);
    const lines = remaining.split('\n');
    let braceCount = 0;
    let lineCount = 0;
    
    for (const line of lines) {
      lineCount++;
      braceCount += (line.match(/\{/g) || []).length;
      braceCount -= (line.match(/\}/g) || []).length;
      
      if (braceCount <= 0 && lineCount > 1) {
        break;
      }
    }
    
    return lineCount;
  }

  calculateCognitiveComplexity(content) {
    // Simplified cognitive complexity calculation
    const complexityPatterns = [
      /if\s*\(/g,
      /else\s*if\s*\(/g,
      /else\s*\{/g,
      /for\s*\(/g,
      /while\s*\(/g,
      /switch\s*\(/g,
      /catch\s*\(/g
    ];
    
    let complexity = 0;
    complexityPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      complexity += matches ? matches.length : 0;
    });
    
    return complexity;
  }

  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  getComplexitySeverity(value, type) {
    const thresholds = {
      file: { low: 300, medium: 500, high: 800 },
      function: { low: 20, medium: 50, high: 100 }
    };
    
    const threshold = thresholds[type];
    if (value > threshold.high) return 'high';
    if (value > threshold.medium) return 'medium';
    return 'low';
  }

  getSecuritySeverity(type) {
    const severityMap = {
      secrets: 'critical',
      sqlInjection: 'high',
      hardcodedUrls: 'medium',
      console: 'low'
    };
    return severityMap[type] || 'medium';
  }

  generateSummary() {
    const categories = this.results.categories;
    const total = Object.keys(categories).length;
    const issues = Object.values(categories).reduce((sum, category) => {
      if (category.error) return sum;
      return sum + Object.values(category).filter(Array.isArray).reduce((s, arr) => s + arr.length, 0);
    }, 0);

    return {
      totalCategories: total,
      totalIssues: issues,
      criticalIssues: this.results.recommendations.filter(r => r.priority === 'Critical').length,
      highPriorityIssues: this.results.recommendations.filter(r => r.priority === 'High').length,
      overallRisk: this.calculateOverallRisk()
    };
  }

  calculateOverallRisk() {
    const recommendations = this.results.recommendations;
    const criticalCount = recommendations.filter(r => r.priority === 'Critical').length;
    const highCount = recommendations.filter(r => r.priority === 'High').length;
    
    if (criticalCount > 0) return 'Critical';
    if (highCount > 3) return 'High';
    if (highCount > 0) return 'Medium';
    return 'Low';
  }

  generateHtmlReport(data) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Technical Debt Report - ${new Date().toLocaleDateString()}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: #e9f4ff; padding: 15px; border-radius: 5px; flex: 1; }
        .recommendations { margin: 20px 0; }
        .recommendation { border-left: 4px solid #007acc; padding: 10px; margin: 10px 0; background: #f9f9f9; }
        .critical { border-left-color: #d32f2f; }
        .high { border-left-color: #f57c00; }
        .medium { border-left-color: #fbc02d; }
        .low { border-left-color: #388e3c; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Technical Debt Analysis Report</h1>
        <p>Generated: ${data.timestamp}</p>
        <p>Overall Risk Level: <strong>${data.summary.overallRisk}</strong></p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <h3>Total Issues</h3>
            <p>${data.summary.totalIssues}</p>
        </div>
        <div class="metric">
            <h3>Critical Issues</h3>
            <p>${data.summary.criticalIssues}</p>
        </div>
        <div class="metric">
            <h3>High Priority</h3>
            <p>${data.summary.highPriorityIssues}</p>
        </div>
    </div>
    
    <div class="recommendations">
        <h2>Priority Recommendations</h2>
        ${data.recommendations.map(rec => `
            <div class="recommendation ${rec.priority.toLowerCase()}">
                <h3>${rec.title}</h3>
                <p><strong>Priority:</strong> ${rec.priority}</p>
                <p><strong>Description:</strong> ${rec.description}</p>
                <p><strong>Action:</strong> ${rec.action}</p>
                <p><strong>Effort:</strong> ${rec.effort} | <strong>Impact:</strong> ${rec.impact}</p>
            </div>
        `).join('')}
    </div>
</body>
</html>`;
  }

  ensureOutputDirectory() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }
}

// CLI execution
if (require.main === module) {
  const analyzer = new TechnicalDebtAnalyzer();
  analyzer.analyze().catch(console.error);
}

module.exports = TechnicalDebtAnalyzer;
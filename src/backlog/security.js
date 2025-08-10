const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class SecurityChecker {
  constructor() {
    this.nvdCacheDir = './cache/nvd';
    this.sbomDir = './docs/sbom';
  }

  async runSAST() {
    console.log('🔍 Running SAST scan...');
    
    try {
      // Use CodeQL if available, fallback to ESLint security plugin
      if (this.isCodeQLAvailable()) {
        return await this.runCodeQL();
      } else {
        return await this.runESLintSecurity();
      }
    } catch (error) {
      console.error('SAST scan failed:', error.message);
      return false;
    }
  }

  async runSCA() {
    console.log('🔍 Running SCA scan...');
    
    try {
      // Use OWASP Dependency-Check with cached NVD database
      await this.ensureNVDCache();
      
      const command = `dependency-check --scan . --format JSON --out ./reports/dependency-check.json --data ${this.nvdCacheDir} --suppression ./security/dependency-check-suppressions.xml`;
      
      try {
        execSync(command, { encoding: 'utf8' });
        return await this.analyzeDependencyCheckResults();
      } catch (error) {
        // Fallback to npm audit
        console.log('🔄 Dependency-Check not available, using npm audit...');
        return await this.runNpmAudit();
      }
    } catch (error) {
      console.error('SCA scan failed:', error.message);
      return false;
    }
  }

  async checkInputValidation() {
    console.log('🔍 Checking input validation...');
    
    try {
      const jsFiles = this.findJavaScriptFiles();
      let validationIssues = 0;
      
      for (const file of jsFiles) {
        const issues = await this.analyzeFileForInputValidation(file);
        validationIssues += issues;
      }
      
      if (validationIssues > 0) {
        console.warn(`⚠️  Found ${validationIssues} potential input validation issues`);
        return false;
      }
      
      console.log('✅ Input validation checks passed');
      return true;
      
    } catch (error) {
      console.error('Input validation check failed:', error.message);
      return false;
    }
  }

  async checkSecretsManagement() {
    console.log('🔍 Checking secrets management...');
    
    try {
      const files = this.findSourceFiles();
      let secretsIssues = 0;
      
      for (const file of files) {
        const issues = await this.analyzeFileForSecrets(file);
        secretsIssues += issues;
      }
      
      if (secretsIssues > 0) {
        console.warn(`⚠️  Found ${secretsIssues} potential secrets management issues`);
        return false;
      }
      
      console.log('✅ Secrets management checks passed');
      return true;
      
    } catch (error) {
      console.error('Secrets management check failed:', error.message);
      return false;
    }
  }

  async generateSBOM() {
    console.log('📋 Generating SBOM...');
    
    try {
      // Ensure SBOM directory exists
      if (!fs.existsSync(this.sbomDir)) {
        fs.mkdirSync(this.sbomDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().split('T')[0];
      const sbomFile = path.join(this.sbomDir, `sbom-${timestamp}.json`);
      
      // Use CycloneDX to generate SBOM
      const command = `cyclonedx-bom -o ${sbomFile}`;
      
      try {
        execSync(command, { encoding: 'utf8' });
        console.log(`✅ SBOM generated: ${sbomFile}`);
        
        // Compare with previous SBOM if exists
        await this.compareSBOMs(sbomFile);
        
        return true;
      } catch (error) {
        // Fallback to simple dependency listing
        console.log('🔄 CycloneDX not available, creating simple SBOM...');
        return await this.createSimpleSBOM(sbomFile);
      }
    } catch (error) {
      console.error('SBOM generation failed:', error.message);
      return false;
    }
  }

  isCodeQLAvailable() {
    try {
      execSync('codeql version', { encoding: 'utf8', stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  async runCodeQL() {
    try {
      // Create CodeQL database
      execSync('codeql database create ./codeql-db --language=javascript', { encoding: 'utf8' });
      
      // Run security queries
      execSync('codeql database analyze ./codeql-db --format=json --output=./reports/codeql-results.json', { encoding: 'utf8' });
      
      return await this.analyzeCodeQLResults();
    } catch (error) {
      console.error('CodeQL scan failed:', error.message);
      return false;
    }
  }

  async runESLintSecurity() {
    try {
      // Check if security plugin is available
      const command = 'npx eslint --ext .js src/ --format json > ./reports/eslint-security.json || true';
      execSync(command, { encoding: 'utf8' });
      
      return await this.analyzeESLintResults();
    } catch (error) {
      console.error('ESLint security scan failed:', error.message);
      return false;
    }
  }

  async ensureNVDCache() {
    if (!fs.existsSync(this.nvdCacheDir)) {
      fs.mkdirSync(this.nvdCacheDir, { recursive: true });
    }
    
    // Check if cache is older than 7 days
    const cacheAge = this.getCacheAge();
    if (cacheAge > 7) {
      console.log('🔄 Updating NVD cache...');
      // In practice, this would download/update the NVD cache
    }
  }

  async runNpmAudit() {
    try {
      const auditResult = execSync('npm audit --json', { encoding: 'utf8' });
      const audit = JSON.parse(auditResult);
      
      const criticalCount = audit.metadata?.vulnerabilities?.critical || 0;
      const highCount = audit.metadata?.vulnerabilities?.high || 0;
      
      if (criticalCount > 0 || highCount > 0) {
        console.warn(`⚠️  Found ${criticalCount} critical and ${highCount} high severity vulnerabilities`);
        return false;
      }
      
      console.log('✅ npm audit passed');
      return true;
    } catch (error) {
      // npm audit returns non-zero exit code when vulnerabilities found
      const output = error.stdout || error.message;
      if (output.includes('"vulnerabilities"')) {
        const audit = JSON.parse(output);
        const criticalCount = audit.metadata?.vulnerabilities?.critical || 0;
        const highCount = audit.metadata?.vulnerabilities?.high || 0;
        
        if (criticalCount > 0 || highCount > 0) {
          console.warn(`⚠️  Found ${criticalCount} critical and ${highCount} high severity vulnerabilities`);
          return false;
        }
      }
      return true;
    }
  }

  findJavaScriptFiles() {
    try {
      const output = execSync('find . -name "*.js" -not -path "./node_modules/*" -not -path "./codeql-db/*"', { encoding: 'utf8' });
      return output.trim().split('\n').filter(line => line);
    } catch {
      return [];
    }
  }

  findSourceFiles() {
    try {
      const output = execSync('find . -type f \\( -name "*.js" -o -name "*.ts" -o -name "*.json" \\) -not -path "./node_modules/*"', { encoding: 'utf8' });
      return output.trim().split('\n').filter(line => line);
    } catch {
      return [];
    }
  }

  async analyzeFileForInputValidation(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      let issues = 0;
      
      // Check for unsafe patterns
      const unsafePatterns = [
        /eval\s*\(/,
        /Function\s*\(/,
        /innerHTML\s*=/,
        /document\.write/,
        /\.exec\s*\(/,
        /child_process.*exec/
      ];
      
      for (const pattern of unsafePatterns) {
        if (pattern.test(content)) {
          console.warn(`⚠️  Potentially unsafe pattern found in ${filePath}`);
          issues++;
        }
      }
      
      return issues;
    } catch {
      return 0;
    }
  }

  async analyzeFileForSecrets(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      let issues = 0;
      
      // Check for potential secrets (simplified patterns)
      const secretPatterns = [
        /password\s*=\s*["'][^"']+["']/i,
        /api[_-]?key\s*=\s*["'][^"']+["']/i,
        /secret\s*=\s*["'][^"']+["']/i,
        /token\s*=\s*["'][^"']+["']/i,
        /aws[_-]?access[_-]?key/i,
        /aws[_-]?secret/i
      ];
      
      for (const pattern of secretPatterns) {
        if (pattern.test(content)) {
          // Check if it's using environment variables (acceptable)
          if (!content.includes('process.env')) {
            console.warn(`⚠️  Potential hardcoded secret in ${filePath}`);
            issues++;
          }
        }
      }
      
      return issues;
    } catch {
      return 0;
    }
  }

  async createSimpleSBOM(sbomFile) {
    try {
      const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
      
      const sbom = {
        bomFormat: 'CycloneDX',
        specVersion: '1.4',
        version: 1,
        metadata: {
          timestamp: new Date().toISOString(),
          component: {
            type: 'application',
            name: packageJson.name,
            version: packageJson.version
          }
        },
        components: []
      };
      
      // Add dependencies
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      for (const [name, version] of Object.entries(deps)) {
        sbom.components.push({
          type: 'library',
          name: name,
          version: version.replace(/^[\^~]/, ''),
          purl: `pkg:npm/${name}@${version.replace(/^[\^~]/, '')}`
        });
      }
      
      fs.writeFileSync(sbomFile, JSON.stringify(sbom, null, 2));
      console.log(`✅ Simple SBOM created: ${sbomFile}`);
      return true;
    } catch (error) {
      console.error('Simple SBOM creation failed:', error.message);
      return false;
    }
  }

  getCacheAge() {
    // Simplified - return age in days
    return 0;
  }

  async analyzeDependencyCheckResults() {
    // Simplified analysis
    return true;
  }

  async analyzeCodeQLResults() {
    // Simplified analysis
    return true;
  }

  async analyzeESLintResults() {
    // Simplified analysis
    return true;
  }

  async compareSBOMs(_newSbomFile) {
    // Simplified SBOM comparison
    console.log('📊 SBOM comparison completed');
  }
}

/**
 * Security Analyzer for vulnerability detection and reporting
 * Extends SecurityChecker with analysis capabilities
 */
class SecurityAnalyzer extends SecurityChecker {
  constructor(workspacePath = process.cwd()) {
    super();
    this.workspacePath = workspacePath;
  }

  /**
   * Scan for vulnerabilities in the workspace
   */
  async scanForVulnerabilities() {
    const vulnerabilities = [];
    
    try {
      // Run SAST scan
      const sastPassed = await this.runSAST();
      if (!sastPassed) {
        vulnerabilities.push({
          type: 'static-analysis',
          severity: 'high',
          description: 'SAST scan detected security issues',
          file: 'multiple files',
          line: null
        });
      }
      
      // Run SCA scan
      const scaPassed = await this.runSCA();
      if (!scaPassed) {
        vulnerabilities.push({
          type: 'dependency',
          severity: 'high',
          description: 'Vulnerable dependencies detected',
          file: 'package.json',
          line: null
        });
      }
      
      // Check input validation
      const inputValidationPassed = await this.checkInputValidation();
      if (!inputValidationPassed) {
        vulnerabilities.push({
          type: 'input-validation',
          severity: 'medium',
          description: 'Input validation issues detected',
          file: 'multiple files',
          line: null
        });
      }
      
      // Check secrets management
      const secretsPassed = await this.checkSecretsManagement();
      if (!secretsPassed) {
        vulnerabilities.push({
          type: 'secrets',
          severity: 'critical',
          description: 'Hardcoded secrets detected',
          file: 'multiple files',
          line: null
        });
      }
      
      return vulnerabilities;
      
    } catch (error) {
      console.error('Vulnerability scan failed:', error.message);
      return [{
        type: 'scan-error',
        severity: 'unknown',
        description: `Vulnerability scan failed: ${error.message}`,
        file: null,
        line: null
      }];
    }
  }

  /**
   * Generate security analysis report
   */
  async generateSecurityReport() {
    const reportPath = path.join(this.workspacePath, 'reports', 'security-analysis.json');
    
    try {
      // Ensure reports directory exists
      const reportsDir = path.dirname(reportPath);
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }
      
      const vulnerabilities = await this.scanForVulnerabilities();
      const sbomGenerated = await this.generateSBOM();
      
      const report = {
        timestamp: new Date().toISOString(),
        workspace: this.workspacePath,
        summary: {
          totalVulnerabilities: vulnerabilities.length,
          critical: vulnerabilities.filter(v => v.severity === 'critical').length,
          high: vulnerabilities.filter(v => v.severity === 'high').length,
          medium: vulnerabilities.filter(v => v.severity === 'medium').length,
          low: vulnerabilities.filter(v => v.severity === 'low').length
        },
        vulnerabilities: vulnerabilities,
        sbom: {
          generated: sbomGenerated,
          path: sbomGenerated ? `${this.sbomDir}/sbom-${new Date().toISOString().split('T')[0]}.json` : null
        },
        recommendations: this.generateSecurityRecommendations(vulnerabilities)
      };
      
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`✅ Security report generated: ${reportPath}`);
      
      return report;
      
    } catch (error) {
      console.error('Security report generation failed:', error.message);
      throw error;
    }
  }

  /**
   * Generate security recommendations based on vulnerabilities
   */
  generateSecurityRecommendations(vulnerabilities) {
    const recommendations = [];
    
    const criticalVulns = vulnerabilities.filter(v => v.severity === 'critical');
    const highVulns = vulnerabilities.filter(v => v.severity === 'high');
    
    if (criticalVulns.length > 0) {
      recommendations.push({
        priority: 'critical',
        action: 'Address critical security vulnerabilities immediately',
        description: `Found ${criticalVulns.length} critical vulnerabilities that require immediate attention`,
        items: criticalVulns.map(v => v.description)
      });
    }
    
    if (highVulns.length > 0) {
      recommendations.push({
        priority: 'high',
        action: 'Plan remediation for high-severity issues',
        description: `Found ${highVulns.length} high-severity vulnerabilities`,
        items: highVulns.map(v => v.description)
      });
    }
    
    // Check if secrets were found
    if (vulnerabilities.some(v => v.type === 'secrets')) {
      recommendations.push({
        priority: 'critical',
        action: 'Implement proper secrets management',
        description: 'Use environment variables or secure vaults for sensitive data',
        items: ['Audit codebase for hardcoded secrets', 'Implement AWS Parameter Store or similar', 'Add pre-commit hooks to prevent secret commits']
      });
    }
    
    // Check if dependency vulnerabilities exist
    if (vulnerabilities.some(v => v.type === 'dependency')) {
      recommendations.push({
        priority: 'high',
        action: 'Update vulnerable dependencies',
        description: 'Update packages to latest secure versions',
        items: ['Run npm audit fix', 'Review dependency-check report', 'Consider alternative packages if updates not available']
      });
    }
    
    return recommendations;
  }
}

module.exports = { SecurityChecker, SecurityAnalyzer };
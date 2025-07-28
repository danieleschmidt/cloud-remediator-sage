#!/usr/bin/env node

/**
 * Code Quality Metrics Collection and Analysis
 * Tracks code quality metrics over time and provides insights
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class CodeQualityMetrics {
    constructor(options = {}) {
        this.reportDir = options.reportDir || './quality-reports';
        this.sourceDir = options.sourceDir || './src';
        this.testDir = options.testDir || './tests';
        this.thresholds = {
            coverage: 80,           // Minimum test coverage %
            duplicateCode: 5,       // Maximum duplicate code %
            complexity: 10,         // Maximum cyclomatic complexity
            maintainabilityIndex: 60, // Minimum maintainability index
            linesOfCode: 500        // Maximum lines per file
        };
        
        this.ensureReportDirectory();
    }

    ensureReportDirectory() {
        if (!fs.existsSync(this.reportDir)) {
            fs.mkdirSync(this.reportDir, { recursive: true });
        }
    }

    async collectAllMetrics() {
        console.log('Collecting comprehensive code quality metrics...');

        const metrics = {
            timestamp: new Date().toISOString(),
            project: {
                name: this.getProjectName(),
                version: this.getProjectVersion()
            },
            metrics: {}
        };

        try {
            // Collect different types of metrics
            metrics.metrics.coverage = await this.collectCoverageMetrics();
            metrics.metrics.complexity = await this.collectComplexityMetrics();
            metrics.metrics.duplicates = await this.collectDuplicateCodeMetrics();
            metrics.metrics.linting = await this.collectLintingMetrics();
            metrics.metrics.codeSize = await this.collectCodeSizeMetrics();
            metrics.metrics.documentation = await this.collectDocumentationMetrics();
            metrics.metrics.dependencies = await this.collectDependencyMetrics();
            metrics.metrics.technical_debt = await this.calculateTechnicalDebt(metrics.metrics);

            // Calculate overall quality score
            metrics.overallScore = this.calculateOverallQualityScore(metrics.metrics);

            // Generate trend analysis
            metrics.trends = await this.analyzeTrends(metrics);

            // Generate recommendations
            metrics.recommendations = this.generateQualityRecommendations(metrics.metrics);

            // Save metrics
            await this.saveMetrics(metrics);

            // Generate quality report
            await this.generateQualityReport(metrics);

            console.log(`Code quality analysis completed. Score: ${metrics.overallScore}/100`);
            return metrics;

        } catch (error) {
            console.error('Code quality metrics collection failed:', error);
            throw error;
        }
    }

    getProjectName() {
        try {
            const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
            return packageJson.name || 'unknown';
        } catch (error) {
            return 'unknown';
        }
    }

    getProjectVersion() {
        try {
            const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
            return packageJson.version || '0.0.0';
        } catch (error) {
            return '0.0.0';
        }
    }

    async collectCoverageMetrics() {
        console.log('Collecting test coverage metrics...');

        try {
            // Run Jest with coverage
            const coverageResult = execSync('npm test -- --coverage --silent --passWithNoTests', {
                encoding: 'utf8',
                stdio: 'pipe'
            });

            // Read coverage report
            const coverageReportPath = './coverage/coverage-summary.json';
            if (fs.existsSync(coverageReportPath)) {
                const coverageData = JSON.parse(fs.readFileSync(coverageReportPath, 'utf8'));
                
                return {
                    total: coverageData.total,
                    byFile: coverageData,
                    threshold: this.thresholds.coverage,
                    passing: coverageData.total.lines.pct >= this.thresholds.coverage
                };
            }

            return { error: 'Coverage report not found' };

        } catch (error) {
            return { error: error.message };
        }
    }

    async collectComplexityMetrics() {
        console.log('Collecting complexity metrics...');

        const complexityMetrics = {
            files: [],
            averageComplexity: 0,
            maxComplexity: 0,
            filesOverThreshold: 0
        };

        try {
            const sourceFiles = this.getSourceFiles();
            
            for (const filePath of sourceFiles) {
                const fileMetrics = await this.analyzeFileComplexity(filePath);
                complexityMetrics.files.push(fileMetrics);
                
                if (fileMetrics.complexity > this.thresholds.complexity) {
                    complexityMetrics.filesOverThreshold++;
                }
            }

            // Calculate aggregates
            const complexities = complexityMetrics.files.map(f => f.complexity);
            complexityMetrics.averageComplexity = complexities.reduce((sum, c) => sum + c, 0) / complexities.length;
            complexityMetrics.maxComplexity = Math.max(...complexities);

            return complexityMetrics;

        } catch (error) {
            return { error: error.message };
        }
    }

    async analyzeFileComplexity(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            
            // Simple complexity calculation based on control flow statements
            let complexity = 1; // Base complexity
            
            const complexityPatterns = [
                /\bif\s*\(/g,           // if statements
                /\belse\s+if\b/g,       // else if statements
                /\bfor\s*\(/g,          // for loops
                /\bwhile\s*\(/g,        // while loops
                /\bswitch\s*\(/g,       // switch statements
                /\bcase\s+/g,           // case statements
                /\bcatch\s*\(/g,        // catch blocks
                /\?\s*.*?\s*:/g,        // ternary operators
                /&&|\|\|/g              // logical operators
            ];

            for (const pattern of complexityPatterns) {
                const matches = content.match(pattern);
                if (matches) {
                    complexity += matches.length;
                }
            }

            return {
                filePath,
                complexity,
                linesOfCode: lines.length,
                maintainabilityIndex: this.calculateMaintainabilityIndex(content, complexity)
            };

        } catch (error) {
            return {
                filePath,
                complexity: 0,
                linesOfCode: 0,
                error: error.message
            };
        }
    }

    calculateMaintainabilityIndex(content, complexity) {
        // Simplified maintainability index calculation
        const linesOfCode = content.split('\n').length;
        const commentRatio = this.calculateCommentRatio(content);
        
        // Formula approximation: MI = 171 - 5.2 * ln(V) - 0.23 * CC - 16.2 * ln(LOC) + 50 * sin(sqrt(2.4 * CM))
        // Simplified version
        let mi = 100;
        mi -= complexity * 2;
        mi -= Math.log(linesOfCode) * 5;
        mi += commentRatio * 10;
        
        return Math.max(0, Math.min(100, mi));
    }

    calculateCommentRatio(content) {
        const lines = content.split('\n');
        const commentLines = lines.filter(line => {
            const trimmed = line.trim();
            return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
        }).length;
        
        return lines.length > 0 ? commentLines / lines.length : 0;
    }

    async collectDuplicateCodeMetrics() {
        console.log('Collecting duplicate code metrics...');

        try {
            // Simple duplicate detection based on similar code blocks
            const sourceFiles = this.getSourceFiles();
            const duplicates = [];
            const codeBlocks = new Map();

            for (const filePath of sourceFiles) {
                const content = fs.readFileSync(filePath, 'utf8');
                const functions = this.extractFunctions(content);
                
                for (const func of functions) {
                    const normalized = this.normalizeCode(func.code);
                    const hash = this.hashCode(normalized);
                    
                    if (codeBlocks.has(hash)) {
                        duplicates.push({
                            original: codeBlocks.get(hash),
                            duplicate: { file: filePath, function: func.name, code: func.code }
                        });
                    } else {
                        codeBlocks.set(hash, { file: filePath, function: func.name, code: func.code });
                    }
                }
            }

            const totalLinesOfCode = this.getTotalLinesOfCode();
            const duplicateLines = duplicates.reduce((sum, dup) => sum + dup.duplicate.code.split('\n').length, 0);
            const duplicatePercentage = totalLinesOfCode > 0 ? (duplicateLines / totalLinesOfCode) * 100 : 0;

            return {
                duplicateBlocks: duplicates.length,
                duplicatePercentage,
                duplicates: duplicates.slice(0, 10), // Top 10 duplicates
                threshold: this.thresholds.duplicateCode,
                passing: duplicatePercentage <= this.thresholds.duplicateCode
            };

        } catch (error) {
            return { error: error.message };
        }
    }

    extractFunctions(content) {
        const functions = [];
        const functionRegex = /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|\w+)|\w+\s*:\s*(?:async\s+)?function)/g;
        
        let match;
        while ((match = functionRegex.exec(content)) !== null) {
            const functionName = match[1] || match[2] || 'anonymous';
            const startIndex = match.index;
            
            // Extract function body (simplified)
            let braceCount = 0;
            let endIndex = startIndex;
            let foundStart = false;
            
            for (let i = startIndex; i < content.length; i++) {
                if (content[i] === '{') {
                    foundStart = true;
                    braceCount++;
                } else if (content[i] === '}') {
                    braceCount--;
                    if (foundStart && braceCount === 0) {
                        endIndex = i + 1;
                        break;
                    }
                }
            }
            
            const functionCode = content.substring(startIndex, endIndex);
            if (functionCode.length > 50) { // Only analyze substantial functions
                functions.push({
                    name: functionName,
                    code: functionCode
                });
            }
        }
        
        return functions;
    }

    normalizeCode(code) {
        return code
            .replace(/\s+/g, ' ')                    // Normalize whitespace
            .replace(/\/\*.*?\*\//g, '')             // Remove block comments
            .replace(/\/\/.*$/gm, '')                // Remove line comments
            .replace(/["'].*?["']/g, '""')           // Normalize strings
            .toLowerCase()
            .trim();
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

    async collectLintingMetrics() {
        console.log('Collecting linting metrics...');

        try {
            // Run ESLint with JSON output
            const lintResult = execSync('npx eslint src/ tests/ --format json', {
                encoding: 'utf8',
                stdio: 'pipe'
            });

            const lintData = JSON.parse(lintResult);
            
            const metrics = {
                totalFiles: lintData.length,
                filesWithIssues: lintData.filter(file => file.messages.length > 0).length,
                totalIssues: lintData.reduce((sum, file) => sum + file.messages.length, 0),
                errorCount: 0,
                warningCount: 0,
                ruleViolations: {}
            };

            // Categorize issues
            for (const file of lintData) {
                for (const message of file.messages) {
                    if (message.severity === 2) {
                        metrics.errorCount++;
                    } else {
                        metrics.warningCount++;
                    }
                    
                    if (message.ruleId) {
                        metrics.ruleViolations[message.ruleId] = (metrics.ruleViolations[message.ruleId] || 0) + 1;
                    }
                }
            }

            return metrics;

        } catch (error) {
            // ESLint might exit with non-zero on issues
            if (error.stdout) {
                try {
                    const lintData = JSON.parse(error.stdout);
                    return this.processLintData(lintData);
                } catch (parseError) {
                    return { error: 'Failed to parse ESLint output' };
                }
            }
            return { error: error.message };
        }
    }

    async collectCodeSizeMetrics() {
        console.log('Collecting code size metrics...');

        const metrics = {
            totalFiles: 0,
            totalLines: 0,
            totalCodeLines: 0,
            totalCommentLines: 0,
            totalBlankLines: 0,
            averageFileSize: 0,
            largestFiles: [],
            fileDistribution: {
                small: 0,    // < 100 lines
                medium: 0,   // 100-300 lines
                large: 0,    // 300-500 lines
                xlarge: 0    // > 500 lines
            }
        };

        try {
            const sourceFiles = this.getSourceFiles();
            const fileSizes = [];

            for (const filePath of sourceFiles) {
                const content = fs.readFileSync(filePath, 'utf8');
                const lines = content.split('\n');
                const fileMetrics = this.analyzeFileLines(lines);
                
                fileSizes.push({
                    filePath,
                    ...fileMetrics
                });

                metrics.totalFiles++;
                metrics.totalLines += fileMetrics.totalLines;
                metrics.totalCodeLines += fileMetrics.codeLines;
                metrics.totalCommentLines += fileMetrics.commentLines;
                metrics.totalBlankLines += fileMetrics.blankLines;

                // Categorize file size
                if (fileMetrics.totalLines < 100) {
                    metrics.fileDistribution.small++;
                } else if (fileMetrics.totalLines < 300) {
                    metrics.fileDistribution.medium++;
                } else if (fileMetrics.totalLines < 500) {
                    metrics.fileDistribution.large++;
                } else {
                    metrics.fileDistribution.xlarge++;
                }
            }

            metrics.averageFileSize = metrics.totalFiles > 0 ? metrics.totalLines / metrics.totalFiles : 0;
            metrics.largestFiles = fileSizes
                .sort((a, b) => b.totalLines - a.totalLines)
                .slice(0, 10);

            return metrics;

        } catch (error) {
            return { error: error.message };
        }
    }

    analyzeFileLines(lines) {
        let codeLines = 0;
        let commentLines = 0;
        let blankLines = 0;

        for (const line of lines) {
            const trimmed = line.trim();
            
            if (trimmed === '') {
                blankLines++;
            } else if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
                commentLines++;
            } else {
                codeLines++;
            }
        }

        return {
            totalLines: lines.length,
            codeLines,
            commentLines,
            blankLines
        };
    }

    async collectDocumentationMetrics() {
        console.log('Collecting documentation metrics...');

        const metrics = {
            totalFunctions: 0,
            documentedFunctions: 0,
            documentationCoverage: 0,
            readmeExists: fs.existsSync('./README.md'),
            docsDirectory: fs.existsSync('./docs'),
            apiDocumentation: false
        };

        try {
            const sourceFiles = this.getSourceFiles();
            
            for (const filePath of sourceFiles) {
                const content = fs.readFileSync(filePath, 'utf8');
                const functions = this.extractFunctions(content);
                
                for (const func of functions) {
                    metrics.totalFunctions++;
                    
                    // Check if function has JSDoc comment
                    const funcIndex = content.indexOf(func.code);
                    const beforeFunction = content.substring(0, funcIndex);
                    const lines = beforeFunction.split('\n');
                    
                    // Look for JSDoc in the previous few lines
                    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 5); i--) {
                        if (lines[i].trim().includes('/**') || lines[i].trim().includes('*/')) {
                            metrics.documentedFunctions++;
                            break;
                        }
                    }
                }
            }

            metrics.documentationCoverage = metrics.totalFunctions > 0 
                ? (metrics.documentedFunctions / metrics.totalFunctions) * 100 
                : 0;

            // Check for API documentation
            const apiDocFiles = [
                './docs/api',
                './docs/API.md',
                './api.md'
            ];
            
            metrics.apiDocumentation = apiDocFiles.some(path => fs.existsSync(path));

            return metrics;

        } catch (error) {
            return { error: error.message };
        }
    }

    async collectDependencyMetrics() {
        console.log('Collecting dependency metrics...');

        try {
            const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
            
            const prodDeps = Object.keys(packageJson.dependencies || {});
            const devDeps = Object.keys(packageJson.devDependencies || {});
            
            return {
                productionDependencies: prodDeps.length,
                developmentDependencies: devDeps.length,
                totalDependencies: prodDeps.length + devDeps.length,
                dependencyRatio: devDeps.length > 0 ? prodDeps.length / devDeps.length : prodDeps.length
            };

        } catch (error) {
            return { error: error.message };
        }
    }

    async calculateTechnicalDebt(metrics) {
        console.log('Calculating technical debt...');

        let debtScore = 0;
        const debtFactors = [];

        // Coverage debt
        if (metrics.coverage && metrics.coverage.total) {
            const coverageDeficit = Math.max(0, this.thresholds.coverage - metrics.coverage.total.lines.pct);
            const coverageDebt = coverageDeficit * 2;
            debtScore += coverageDebt;
            
            if (coverageDebt > 0) {
                debtFactors.push({
                    factor: 'test_coverage',
                    debt: coverageDebt,
                    description: `Test coverage is ${coverageDeficit}% below threshold`
                });
            }
        }

        // Complexity debt
        if (metrics.complexity) {
            const complexFiles = metrics.complexity.filesOverThreshold;
            const complexityDebt = complexFiles * 5;
            debtScore += complexityDebt;
            
            if (complexityDebt > 0) {
                debtFactors.push({
                    factor: 'complexity',
                    debt: complexityDebt,
                    description: `${complexFiles} files exceed complexity threshold`
                });
            }
        }

        // Duplicate code debt
        if (metrics.duplicates && metrics.duplicates.duplicatePercentage > this.thresholds.duplicateCode) {
            const duplicateDebt = (metrics.duplicates.duplicatePercentage - this.thresholds.duplicateCode) * 3;
            debtScore += duplicateDebt;
            
            debtFactors.push({
                factor: 'code_duplication',
                debt: duplicateDebt,
                description: `Code duplication is ${(metrics.duplicates.duplicatePercentage - this.thresholds.duplicateCode).toFixed(1)}% above threshold`
            });
        }

        // Linting debt
        if (metrics.linting && metrics.linting.errorCount > 0) {
            const lintingDebt = metrics.linting.errorCount * 2;
            debtScore += lintingDebt;
            
            debtFactors.push({
                factor: 'linting_errors',
                debt: lintingDebt,
                description: `${metrics.linting.errorCount} linting errors need resolution`
            });
        }

        // Documentation debt
        if (metrics.documentation && metrics.documentation.documentationCoverage < 50) {
            const docDebt = (50 - metrics.documentation.documentationCoverage) * 0.5;
            debtScore += docDebt;
            
            debtFactors.push({
                factor: 'documentation',
                debt: docDebt,
                description: `Documentation coverage is ${(50 - metrics.documentation.documentationCoverage).toFixed(1)}% below target`
            });
        }

        return {
            totalDebt: debtScore,
            debtLevel: this.categorizeDebtLevel(debtScore),
            factors: debtFactors.sort((a, b) => b.debt - a.debt)
        };
    }

    categorizeDebtLevel(debtScore) {
        if (debtScore < 20) return 'low';
        if (debtScore < 50) return 'medium';
        if (debtScore < 100) return 'high';
        return 'critical';
    }

    calculateOverallQualityScore(metrics) {
        let score = 100;

        // Coverage impact (25%)
        if (metrics.coverage && metrics.coverage.total) {
            const coverageScore = (metrics.coverage.total.lines.pct / 100) * 25;
            score = score - 25 + coverageScore;
        }

        // Complexity impact (20%)
        if (metrics.complexity) {
            const complexityPenalty = metrics.complexity.filesOverThreshold * 2;
            score -= Math.min(20, complexityPenalty);
        }

        // Linting impact (20%)
        if (metrics.linting) {
            const lintingPenalty = (metrics.linting.errorCount * 2) + (metrics.linting.warningCount * 0.5);
            score -= Math.min(20, lintingPenalty);
        }

        // Duplication impact (15%)
        if (metrics.duplicates) {
            const duplicationPenalty = metrics.duplicates.duplicatePercentage;
            score -= Math.min(15, duplicationPenalty);
        }

        // Documentation impact (10%)
        if (metrics.documentation) {
            const docScore = (metrics.documentation.documentationCoverage / 100) * 10;
            score = score - 10 + docScore;
        }

        // Technical debt impact (10%)
        if (metrics.technical_debt) {
            const debtPenalty = Math.min(10, metrics.technical_debt.totalDebt / 10);
            score -= debtPenalty;
        }

        return Math.max(0, Math.min(100, Math.round(score)));
    }

    async analyzeTrends(currentMetrics) {
        try {
            const previousReportPath = path.join(this.reportDir, 'previous-quality-metrics.json');
            
            if (!fs.existsSync(previousReportPath)) {
                // Save current as previous for next run
                fs.writeFileSync(previousReportPath, JSON.stringify(currentMetrics, null, 2));
                return { message: 'Baseline established', isBaseline: true };
            }

            const previousMetrics = JSON.parse(fs.readFileSync(previousReportPath, 'utf8'));
            
            const trends = {
                scoreChange: currentMetrics.overallScore - previousMetrics.overallScore,
                improvements: [],
                regressions: []
            };

            // Analyze specific metric trends
            if (previousMetrics.metrics.coverage && currentMetrics.metrics.coverage) {
                const coverageChange = currentMetrics.metrics.coverage.total.lines.pct - previousMetrics.metrics.coverage.total.lines.pct;
                if (Math.abs(coverageChange) >= 1) {
                    const trend = coverageChange > 0 ? 'improvements' : 'regressions';
                    trends[trend].push(`Test coverage: ${coverageChange > 0 ? '+' : ''}${coverageChange.toFixed(1)}%`);
                }
            }

            // Save current metrics as previous for next run
            fs.writeFileSync(previousReportPath, JSON.stringify(currentMetrics, null, 2));

            return trends;

        } catch (error) {
            return { error: error.message };
        }
    }

    generateQualityRecommendations(metrics) {
        const recommendations = [];

        // Coverage recommendations
        if (metrics.coverage && metrics.coverage.total.lines.pct < this.thresholds.coverage) {
            recommendations.push({
                category: 'testing',
                priority: 'high',
                title: 'Improve test coverage',
                description: `Test coverage is ${metrics.coverage.total.lines.pct}%, below the ${this.thresholds.coverage}% threshold`,
                action: 'Write additional unit tests for uncovered code paths'
            });
        }

        // Complexity recommendations
        if (metrics.complexity && metrics.complexity.filesOverThreshold > 0) {
            recommendations.push({
                category: 'maintainability',
                priority: 'medium',
                title: 'Reduce code complexity',
                description: `${metrics.complexity.filesOverThreshold} files exceed complexity threshold`,
                action: 'Refactor complex functions into smaller, more focused functions'
            });
        }

        // Duplication recommendations
        if (metrics.duplicates && metrics.duplicates.duplicatePercentage > this.thresholds.duplicateCode) {
            recommendations.push({
                category: 'maintainability',
                priority: 'medium',
                title: 'Reduce code duplication',
                description: `${metrics.duplicates.duplicatePercentage.toFixed(1)}% code duplication detected`,
                action: 'Extract common code into reusable functions or modules'
            });
        }

        // Linting recommendations
        if (metrics.linting && metrics.linting.errorCount > 0) {
            recommendations.push({
                category: 'code_style',
                priority: 'high',
                title: 'Fix linting errors',
                description: `${metrics.linting.errorCount} linting errors found`,
                action: 'Run eslint --fix and address remaining issues manually'
            });
        }

        // Documentation recommendations
        if (metrics.documentation && metrics.documentation.documentationCoverage < 50) {
            recommendations.push({
                category: 'documentation',
                priority: 'low',
                title: 'Improve documentation',
                description: `Only ${metrics.documentation.documentationCoverage.toFixed(1)}% of functions are documented`,
                action: 'Add JSDoc comments to public functions and methods'
            });
        }

        return recommendations.sort((a, b) => {
            const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    async saveMetrics(metrics) {
        const timestamp = new Date().toISOString().split('T')[0];
        const metricsPath = path.join(this.reportDir, `quality-metrics-${timestamp}.json`);
        
        fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));
        
        // Also save as latest
        const latestPath = path.join(this.reportDir, 'latest-quality-metrics.json');
        fs.writeFileSync(latestPath, JSON.stringify(metrics, null, 2));
        
        console.log(`Metrics saved: ${metricsPath}`);
    }

    async generateQualityReport(metrics) {
        const reportPath = path.join(this.reportDir, 'quality-report.md');
        
        let report = `# Code Quality Report\n\n`;
        report += `**Generated:** ${metrics.timestamp}\n`;
        report += `**Project:** ${metrics.project.name} v${metrics.project.version}\n`;
        report += `**Overall Score:** ${metrics.overallScore}/100\n\n`;

        // Executive Summary
        report += `## Executive Summary\n\n`;
        report += `The code quality score is ${metrics.overallScore}/100. `;
        if (metrics.overallScore >= 80) {
            report += `This indicates good code quality with minor areas for improvement.\n\n`;
        } else if (metrics.overallScore >= 60) {
            report += `This indicates acceptable code quality with several areas for improvement.\n\n`;
        } else {
            report += `This indicates poor code quality requiring immediate attention.\n\n`;
        }

        // Metrics Details
        report += `## Detailed Metrics\n\n`;
        
        if (metrics.metrics.coverage) {
            report += `### Test Coverage\n`;
            report += `- **Lines:** ${metrics.metrics.coverage.total.lines.pct}%\n`;
            report += `- **Functions:** ${metrics.metrics.coverage.total.functions.pct}%\n`;
            report += `- **Branches:** ${metrics.metrics.coverage.total.branches.pct}%\n`;
            report += `- **Statements:** ${metrics.metrics.coverage.total.statements.pct}%\n\n`;
        }

        if (metrics.metrics.complexity) {
            report += `### Code Complexity\n`;
            report += `- **Average Complexity:** ${metrics.metrics.complexity.averageComplexity.toFixed(2)}\n`;
            report += `- **Maximum Complexity:** ${metrics.metrics.complexity.maxComplexity}\n`;
            report += `- **Files Over Threshold:** ${metrics.metrics.complexity.filesOverThreshold}\n\n`;
        }

        if (metrics.metrics.linting) {
            report += `### Linting Results\n`;
            report += `- **Total Issues:** ${metrics.metrics.linting.totalIssues}\n`;
            report += `- **Errors:** ${metrics.metrics.linting.errorCount}\n`;
            report += `- **Warnings:** ${metrics.metrics.linting.warningCount}\n\n`;
        }

        // Recommendations
        if (metrics.recommendations && metrics.recommendations.length > 0) {
            report += `## Recommendations\n\n`;
            for (const rec of metrics.recommendations) {
                report += `### ${rec.title} (${rec.priority} priority)\n`;
                report += `**Category:** ${rec.category}\n`;
                report += `**Description:** ${rec.description}\n`;
                report += `**Action:** ${rec.action}\n\n`;
            }
        }

        // Technical Debt
        if (metrics.metrics.technical_debt) {
            report += `## Technical Debt\n\n`;
            report += `**Total Debt Score:** ${metrics.metrics.technical_debt.totalDebt.toFixed(1)}\n`;
            report += `**Debt Level:** ${metrics.metrics.technical_debt.debtLevel}\n\n`;
            
            if (metrics.metrics.technical_debt.factors.length > 0) {
                report += `### Debt Factors\n\n`;
                for (const factor of metrics.metrics.technical_debt.factors) {
                    report += `- **${factor.factor}** (${factor.debt.toFixed(1)} points): ${factor.description}\n`;
                }
                report += `\n`;
            }
        }

        fs.writeFileSync(reportPath, report);
        console.log(`Quality report generated: ${reportPath}`);
    }

    // Helper methods
    getSourceFiles() {
        const files = [];
        const extensions = ['.js', '.ts', '.jsx', '.tsx'];
        const excludeDirs = ['node_modules', 'dist', 'build', 'coverage'];
        
        function walkDirectory(dir) {
            try {
                const items = fs.readdirSync(dir);
                
                for (const item of items) {
                    const itemPath = path.join(dir, item);
                    const stat = fs.statSync(itemPath);
                    
                    if (stat.isDirectory() && !excludeDirs.includes(item)) {
                        walkDirectory(itemPath);
                    } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
                        files.push(itemPath);
                    }
                }
            } catch (error) {
                // Ignore permission errors
            }
        }
        
        walkDirectory(this.sourceDir);
        if (fs.existsSync(this.testDir)) {
            walkDirectory(this.testDir);
        }
        
        return files;
    }

    getTotalLinesOfCode() {
        const sourceFiles = this.getSourceFiles();
        let totalLines = 0;
        
        for (const filePath of sourceFiles) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                totalLines += content.split('\n').length;
            } catch (error) {
                // Ignore errors
            }
        }
        
        return totalLines;
    }
}

// CLI execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {
        reportDir: args.find(arg => arg.startsWith('--report-dir='))?.split('=')[1] || './quality-reports'
    };

    const qualityMetrics = new CodeQualityMetrics(options);
    qualityMetrics.collectAllMetrics()
        .then((metrics) => {
            console.log('\nCode Quality Summary:');
            console.log(`Overall Score: ${metrics.overallScore}/100`);
            console.log(`Test Coverage: ${metrics.metrics.coverage?.total?.lines?.pct || 0}%`);
            console.log(`Technical Debt: ${metrics.metrics.technical_debt?.debtLevel || 'unknown'}`);
            console.log(`Recommendations: ${metrics.recommendations?.length || 0}`);
            
            // Exit with error code if quality is poor
            process.exit(metrics.overallScore < 60 ? 1 : 0);
        })
        .catch((error) => {
            console.error('Code quality metrics collection failed:', error);
            process.exit(1);
        });
}

module.exports = CodeQualityMetrics;
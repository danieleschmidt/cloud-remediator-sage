#!/usr/bin/env node

/**
 * Comprehensive Security Scanning Automation
 * Integrates multiple security scanning tools and generates unified reports
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const crypto = require('crypto');

class SecurityScanner {
    constructor(options = {}) {
        this.scanId = this.generateScanId();
        this.timestamp = new Date().toISOString();
        this.outputDir = options.outputDir || './security-reports';
        this.configFile = options.configFile || './security-scan-config.json';
        this.verbose = options.verbose || false;
        
        this.results = {
            scanId: this.scanId,
            timestamp: this.timestamp,
            project: this.getProjectInfo(),
            scans: {},
            summary: {
                totalFindings: 0,
                criticalFindings: 0,
                highFindings: 0,
                mediumFindings: 0,
                lowFindings: 0
            }
        };
        
        this.ensureOutputDirectory();
    }

    generateScanId() {
        return `scan-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    }

    getProjectInfo() {
        try {
            const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
            return {
                name: packageJson.name,
                version: packageJson.version,
                description: packageJson.description
            };
        } catch (error) {
            return { name: 'unknown', version: 'unknown', description: 'unknown' };
        }
    }

    ensureOutputDirectory() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        
        if (this.verbose || level === 'error') {
            console.log(logMessage);
        }
        
        // Write to scan log file
        const logFile = path.join(this.outputDir, `${this.scanId}.log`);
        fs.appendFileSync(logFile, logMessage + '\n');
    }

    async runAllScans() {
        this.log('Starting comprehensive security scan', 'info');
        
        const scanFunctions = [
            this.runDependencyVulnerabilityScan.bind(this),
            this.runStaticCodeAnalysis.bind(this),
            this.runSecretsDetection.bind(this),
            this.runDockerImageScan.bind(this),
            this.runInfrastructureAnalysis.bind(this),
            this.runLicenseAudit.bind(this),
            this.runSBOMGeneration.bind(this)
        ];

        for (const scanFunction of scanFunctions) {
            try {
                await scanFunction();
            } catch (error) {
                this.log(`Scan failed: ${error.message}`, 'error');
            }
        }

        this.generateConsolidatedReport();
        this.generateSARIF();
        this.generateJUnit();
        
        this.log('Security scan completed', 'info');
        return this.results;
    }

    async runDependencyVulnerabilityScan() {
        this.log('Running dependency vulnerability scan');
        
        try {
            // npm audit
            const npmAuditResult = await this.runCommand('npm audit --json', true);
            const npmAudit = JSON.parse(npmAuditResult);
            
            // Convert npm audit to standard format
            const findings = this.convertNpmAuditFindings(npmAudit);
            
            this.results.scans.dependencyVulnerabilities = {
                tool: 'npm-audit',
                status: 'completed',
                findings,
                summary: this.summarizeFindings(findings)
            };
            
            this.updateGlobalSummary(findings);
            
        } catch (error) {
            this.log(`Dependency scan failed: ${error.message}`, 'error');
            this.results.scans.dependencyVulnerabilities = {
                tool: 'npm-audit',
                status: 'failed',
                error: error.message
            };
        }
    }

    async runStaticCodeAnalysis() {
        this.log('Running static code analysis');
        
        try {
            // ESLint security rules
            const eslintResult = await this.runCommand('npx eslint src/ tests/ --format json --config .eslintrc.security.js', true);
            const eslintFindings = JSON.parse(eslintResult);
            
            // Convert ESLint findings to standard format
            const findings = this.convertESLintFindings(eslintFindings);
            
            this.results.scans.staticCodeAnalysis = {
                tool: 'eslint-security',
                status: 'completed',
                findings,
                summary: this.summarizeFindings(findings)
            };
            
            this.updateGlobalSummary(findings);
            
        } catch (error) {
            this.log(`Static code analysis failed: ${error.message}`, 'error');
            this.results.scans.staticCodeAnalysis = {
                tool: 'eslint-security',
                status: 'failed',
                error: error.message
            };
        }
    }

    async runSecretsDetection() {
        this.log('Running secrets detection');
        
        try {
            // Simple regex-based secrets detection
            const findings = await this.detectSecrets();
            
            this.results.scans.secretsDetection = {
                tool: 'internal-secrets-detector',
                status: 'completed',
                findings,
                summary: this.summarizeFindings(findings)
            };
            
            this.updateGlobalSummary(findings);
            
        } catch (error) {
            this.log(`Secrets detection failed: ${error.message}`, 'error');
            this.results.scans.secretsDetection = {
                tool: 'internal-secrets-detector',
                status: 'failed',
                error: error.message
            };
        }
    }

    async runDockerImageScan() {
        this.log('Running Docker image vulnerability scan');
        
        try {
            if (fs.existsSync('./Dockerfile')) {
                // Simulate Docker image scan (would use actual tool in production)
                const findings = await this.analyzeDockerfile();
                
                this.results.scans.dockerImageScan = {
                    tool: 'dockerfile-analyzer',
                    status: 'completed',
                    findings,
                    summary: this.summarizeFindings(findings)
                };
                
                this.updateGlobalSummary(findings);
            } else {
                this.results.scans.dockerImageScan = {
                    tool: 'dockerfile-analyzer',
                    status: 'skipped',
                    reason: 'No Dockerfile found'
                };
            }
            
        } catch (error) {
            this.log(`Docker image scan failed: ${error.message}`, 'error');
            this.results.scans.dockerImageScan = {
                tool: 'dockerfile-analyzer',
                status: 'failed',
                error: error.message
            };
        }
    }

    async runInfrastructureAnalysis() {
        this.log('Running infrastructure security analysis');
        
        try {
            const findings = await this.analyzeInfrastructure();
            
            this.results.scans.infrastructureAnalysis = {
                tool: 'infrastructure-analyzer',
                status: 'completed',
                findings,
                summary: this.summarizeFindings(findings)
            };
            
            this.updateGlobalSummary(findings);
            
        } catch (error) {
            this.log(`Infrastructure analysis failed: ${error.message}`, 'error');
            this.results.scans.infrastructureAnalysis = {
                tool: 'infrastructure-analyzer',
                status: 'failed',
                error: error.message
            };
        }
    }

    async runLicenseAudit() {
        this.log('Running license audit');
        
        try {
            const findings = await this.auditLicenses();
            
            this.results.scans.licenseAudit = {
                tool: 'license-auditor',
                status: 'completed',
                findings,
                summary: this.summarizeFindings(findings)
            };
            
            this.updateGlobalSummary(findings);
            
        } catch (error) {
            this.log(`License audit failed: ${error.message}`, 'error');
            this.results.scans.licenseAudit = {
                tool: 'license-auditor',
                status: 'failed',
                error: error.message
            };
        }
    }

    async runSBOMGeneration() {
        this.log('Generating Software Bill of Materials (SBOM)');
        
        try {
            // Generate SBOM using our existing script
            await this.runCommand('node scripts/generate-sbom.js ./security-reports/sbom.json');
            
            this.results.scans.sbomGeneration = {
                tool: 'sbom-generator',
                status: 'completed',
                outputFile: './security-reports/sbom.json'
            };
            
        } catch (error) {
            this.log(`SBOM generation failed: ${error.message}`, 'error');
            this.results.scans.sbomGeneration = {
                tool: 'sbom-generator',
                status: 'failed',
                error: error.message
            };
        }
    }

    async runCommand(command, captureOutput = false) {
        return new Promise((resolve, reject) => {
            try {
                if (captureOutput) {
                    const output = execSync(command, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
                    resolve(output);
                } else {
                    execSync(command, { stdio: 'inherit' });
                    resolve('');
                }
            } catch (error) {
                if (captureOutput && error.stdout) {
                    // Some tools exit with non-zero even on success (like npm audit)
                    resolve(error.stdout);
                } else {
                    reject(error);
                }
            }
        });
    }

    convertNpmAuditFindings(npmAudit) {
        const findings = [];
        
        if (npmAudit.vulnerabilities) {
            for (const [packageName, vulnData] of Object.entries(npmAudit.vulnerabilities)) {
                findings.push({
                    id: `npm-${packageName}-${vulnData.via?.[0]?.source || 'unknown'}`,
                    title: `Vulnerability in ${packageName}`,
                    description: vulnData.via?.[0]?.title || 'No description available',
                    severity: this.mapNpmSeverity(vulnData.severity),
                    category: 'dependency-vulnerability',
                    location: {
                        file: 'package.json',
                        package: packageName,
                        version: vulnData.via?.[0]?.range || 'unknown'
                    },
                    remediation: {
                        type: 'update',
                        description: `Update ${packageName} to version ${vulnData.fixAvailable?.version || 'latest'}`
                    },
                    references: vulnData.via?.[0]?.url ? [vulnData.via[0].url] : []
                });
            }
        }
        
        return findings;
    }

    convertESLintFindings(eslintResults) {
        const findings = [];
        
        for (const file of eslintResults) {
            for (const message of file.messages) {
                if (message.ruleId && message.ruleId.includes('security')) {
                    findings.push({
                        id: `eslint-${file.filePath}-${message.line}-${message.ruleId}`,
                        title: message.message,
                        description: `ESLint security rule violation: ${message.ruleId}`,
                        severity: this.mapESLintSeverity(message.severity),
                        category: 'static-analysis',
                        location: {
                            file: file.filePath,
                            line: message.line,
                            column: message.column
                        },
                        remediation: {
                            type: 'code-fix',
                            description: `Fix the security issue identified by rule ${message.ruleId}`
                        }
                    });
                }
            }
        }
        
        return findings;
    }

    async detectSecrets() {
        const findings = [];
        const secretPatterns = [
            { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/, severity: 'critical' },
            { name: 'AWS Secret Key', pattern: /[0-9a-zA-Z/+]{40}/, severity: 'critical' },
            { name: 'Private Key', pattern: /-----BEGIN (RSA )?PRIVATE KEY-----/, severity: 'critical' },
            { name: 'Generic Secret', pattern: /(secret|password|key|token)[\s]*[:=][\s]*['"]\w+['"]/, severity: 'high' },
            { name: 'JWT Token', pattern: /eyJ[0-9A-Za-z_-]+\.eyJ[0-9A-Za-z_-]+\.[0-9A-Za-z_-]+/, severity: 'medium' }
        ];
        
        const filesToScan = await this.getFilesToScan();
        
        for (const filePath of filesToScan) {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            
            for (let lineNum = 0; lineNum < lines.length; lineNum++) {
                const line = lines[lineNum];
                
                for (const pattern of secretPatterns) {
                    if (pattern.pattern.test(line)) {
                        findings.push({
                            id: `secret-${filePath}-${lineNum}-${pattern.name.replace(/\s+/g, '-')}`,
                            title: `Potential ${pattern.name} detected`,
                            description: `Potential hardcoded ${pattern.name.toLowerCase()} found in source code`,
                            severity: pattern.severity,
                            category: 'secrets',
                            location: {
                                file: filePath,
                                line: lineNum + 1
                            },
                            remediation: {
                                type: 'secret-management',
                                description: 'Move secret to environment variables or secure secret management system'
                            }
                        });
                    }
                }
            }
        }
        
        return findings;
    }

    async analyzeDockerfile() {
        const findings = [];
        
        if (!fs.existsSync('./Dockerfile')) {
            return findings;
        }
        
        const content = fs.readFileSync('./Dockerfile', 'utf8');
        const lines = content.split('\n');
        
        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum].trim();
            
            // Check for common Docker security issues
            if (line.startsWith('USER root')) {
                findings.push({
                    id: `docker-root-user-${lineNum}`,
                    title: 'Container running as root user',
                    description: 'Container is configured to run as root user, which poses security risks',
                    severity: 'medium',
                    category: 'docker-security',
                    location: { file: 'Dockerfile', line: lineNum + 1 },
                    remediation: {
                        type: 'configuration',
                        description: 'Create and use a non-root user for the container'
                    }
                });
            }
            
            if (line.includes('ADD http')) {
                findings.push({
                    id: `docker-insecure-add-${lineNum}`,
                    title: 'Insecure ADD instruction with HTTP URL',
                    description: 'Using ADD with HTTP URLs can pose security risks',
                    severity: 'medium',
                    category: 'docker-security',
                    location: { file: 'Dockerfile', line: lineNum + 1 },
                    remediation: {
                        type: 'configuration',
                        description: 'Use HTTPS URLs or COPY instruction instead'
                    }
                });
            }
        }
        
        return findings;
    }

    async analyzeInfrastructure() {
        const findings = [];
        
        // Analyze serverless.yml
        if (fs.existsSync('./serverless.yml')) {
            const content = fs.readFileSync('./serverless.yml', 'utf8');
            
            // Check for security best practices
            if (!content.includes('iamRoleStatements')) {
                findings.push({
                    id: 'serverless-missing-iam',
                    title: 'Missing IAM role statements',
                    description: 'Serverless configuration should include specific IAM permissions',
                    severity: 'medium',
                    category: 'infrastructure',
                    location: { file: 'serverless.yml' },
                    remediation: {
                        type: 'configuration',
                        description: 'Add explicit IAM role statements with least privilege principle'
                    }
                });
            }
            
            if (content.includes('timeout: 900')) {
                findings.push({
                    id: 'serverless-long-timeout',
                    title: 'Long function timeout configured',
                    description: 'Lambda functions with long timeouts may indicate inefficient code',
                    severity: 'low',
                    category: 'infrastructure',
                    location: { file: 'serverless.yml' },
                    remediation: {
                        type: 'optimization',
                        description: 'Review and optimize function performance'
                    }
                });
            }
        }
        
        return findings;
    }

    async auditLicenses() {
        const findings = [];
        
        try {
            const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
            const problematicLicenses = ['GPL-3.0', 'AGPL-3.0', 'LGPL-3.0'];
            
            // Check direct dependencies
            const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
            
            for (const [packageName, version] of Object.entries(deps)) {
                try {
                    const depPackageJson = JSON.parse(
                        fs.readFileSync(`./node_modules/${packageName}/package.json`, 'utf8')
                    );
                    
                    if (problematicLicenses.includes(depPackageJson.license)) {
                        findings.push({
                            id: `license-${packageName}`,
                            title: `Potentially problematic license: ${depPackageJson.license}`,
                            description: `Package ${packageName} uses ${depPackageJson.license} license which may have copyleft requirements`,
                            severity: 'medium',
                            category: 'license',
                            location: { package: packageName },
                            remediation: {
                                type: 'license-review',
                                description: 'Review license compatibility with project requirements'
                            }
                        });
                    }
                } catch (error) {
                    // Package not installed or no package.json
                    continue;
                }
            }
        } catch (error) {
            this.log(`License audit error: ${error.message}`, 'error');
        }
        
        return findings;
    }

    async getFilesToScan() {
        const extensions = ['.js', '.ts', '.json', '.yml', '.yaml', '.env'];
        const excludeDirs = ['node_modules', '.git', 'coverage', 'dist', 'build'];
        
        const files = [];
        
        function scanDirectory(dir) {
            const items = fs.readdirSync(dir);
            
            for (const item of items) {
                const itemPath = path.join(dir, item);
                const stat = fs.statSync(itemPath);
                
                if (stat.isDirectory() && !excludeDirs.includes(item)) {
                    scanDirectory(itemPath);
                } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
                    files.push(itemPath);
                }
            }
        }
        
        scanDirectory('.');
        return files;
    }

    mapNpmSeverity(npmSeverity) {
        const mapping = {
            'info': 'low',
            'low': 'low',
            'moderate': 'medium',
            'high': 'high',
            'critical': 'critical'
        };
        return mapping[npmSeverity] || 'medium';
    }

    mapESLintSeverity(eslintSeverity) {
        return eslintSeverity === 2 ? 'high' : 'medium';
    }

    summarizeFindings(findings) {
        return {
            total: findings.length,
            critical: findings.filter(f => f.severity === 'critical').length,
            high: findings.filter(f => f.severity === 'high').length,
            medium: findings.filter(f => f.severity === 'medium').length,
            low: findings.filter(f => f.severity === 'low').length
        };
    }

    updateGlobalSummary(findings) {
        const summary = this.summarizeFindings(findings);
        this.results.summary.totalFindings += summary.total;
        this.results.summary.criticalFindings += summary.critical;
        this.results.summary.highFindings += summary.high;
        this.results.summary.mediumFindings += summary.medium;
        this.results.summary.lowFindings += summary.low;
    }

    generateConsolidatedReport() {
        const reportPath = path.join(this.outputDir, `${this.scanId}-consolidated-report.json`);
        fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
        
        const htmlReportPath = path.join(this.outputDir, `${this.scanId}-report.html`);
        this.generateHTMLReport(htmlReportPath);
        
        this.log(`Consolidated report generated: ${reportPath}`);
        this.log(`HTML report generated: ${htmlReportPath}`);
    }

    generateHTMLReport(outputPath) {
        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Security Scan Report - ${this.results.project.name}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: #e8f4f8; padding: 15px; border-radius: 5px; text-align: center; }
        .critical { background: #ffebee; }
        .high { background: #fff3e0; }
        .medium { background: #f3e5f5; }
        .low { background: #e8f5e8; }
        .scan-section { margin: 20px 0; border: 1px solid #ddd; border-radius: 5px; }
        .scan-header { background: #f8f9fa; padding: 15px; font-weight: bold; }
        .findings { padding: 15px; }
        .finding { margin: 10px 0; padding: 10px; border-left: 4px solid #ddd; }
        .finding.critical { border-left-color: #f44336; }
        .finding.high { border-left-color: #ff9800; }
        .finding.medium { border-left-color: #9c27b0; }
        .finding.low { border-left-color: #4caf50; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Security Scan Report</h1>
        <p><strong>Project:</strong> ${this.results.project.name} v${this.results.project.version}</p>
        <p><strong>Scan ID:</strong> ${this.results.scanId}</p>
        <p><strong>Timestamp:</strong> ${this.results.timestamp}</p>
    </div>

    <div class="summary">
        <div class="metric critical">
            <h3>${this.results.summary.criticalFindings}</h3>
            <p>Critical</p>
        </div>
        <div class="metric high">
            <h3>${this.results.summary.highFindings}</h3>
            <p>High</p>
        </div>
        <div class="metric medium">
            <h3>${this.results.summary.mediumFindings}</h3>
            <p>Medium</p>
        </div>
        <div class="metric low">
            <h3>${this.results.summary.lowFindings}</h3>
            <p>Low</p>
        </div>
    </div>

    ${Object.entries(this.results.scans).map(([scanType, scanData]) => `
        <div class="scan-section">
            <div class="scan-header">
                ${scanType} (${scanData.tool}) - ${scanData.status}
            </div>
            <div class="findings">
                ${scanData.findings ? scanData.findings.map(finding => `
                    <div class="finding ${finding.severity}">
                        <h4>${finding.title}</h4>
                        <p>${finding.description}</p>
                        <p><strong>Severity:</strong> ${finding.severity}</p>
                        <p><strong>Location:</strong> ${JSON.stringify(finding.location)}</p>
                        ${finding.remediation ? `<p><strong>Remediation:</strong> ${finding.remediation.description}</p>` : ''}
                    </div>
                `).join('') : '<p>No findings</p>'}
            </div>
        </div>
    `).join('')}

</body>
</html>`;
        
        fs.writeFileSync(outputPath, html);
    }

    generateSARIF() {
        // Generate SARIF format for integration with security tools
        const sarif = {
            version: '2.1.0',
            $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
            runs: [{
                tool: {
                    driver: {
                        name: 'Cloud Remediator Security Scanner',
                        version: '1.0.0',
                        organization: 'Terragon Labs'
                    }
                },
                results: []
            }]
        };

        // Convert findings to SARIF format
        for (const [scanType, scanData] of Object.entries(this.results.scans)) {
            if (scanData.findings) {
                for (const finding of scanData.findings) {
                    sarif.runs[0].results.push({
                        ruleId: finding.id,
                        message: { text: finding.description },
                        level: this.mapSeverityToSarif(finding.severity),
                        locations: [{
                            physicalLocation: {
                                artifactLocation: {
                                    uri: finding.location?.file || 'unknown'
                                },
                                region: {
                                    startLine: finding.location?.line || 1
                                }
                            }
                        }]
                    });
                }
            }
        }

        const sarifPath = path.join(this.outputDir, `${this.scanId}-results.sarif`);
        fs.writeFileSync(sarifPath, JSON.stringify(sarif, null, 2));
        this.log(`SARIF report generated: ${sarifPath}`);
    }

    generateJUnit() {
        // Generate JUnit XML for CI/CD integration
        const totalTests = this.results.summary.totalFindings;
        const failures = this.results.summary.criticalFindings + this.results.summary.highFindings;
        
        const junit = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="SecurityScan" tests="${totalTests}" failures="${failures}" time="0">
    ${Object.entries(this.results.scans).map(([scanType, scanData]) => {
        if (!scanData.findings) return '';
        return scanData.findings.map(finding => `
    <testcase name="${finding.title}" classname="${scanType}">
        ${(finding.severity === 'critical' || finding.severity === 'high') ? `
        <failure message="${finding.description}">
            Location: ${JSON.stringify(finding.location)}
            Remediation: ${finding.remediation?.description || 'None provided'}
        </failure>` : ''}
    </testcase>`).join('');
    }).join('')}
</testsuite>`;

        const junitPath = path.join(this.outputDir, `${this.scanId}-junit.xml`);
        fs.writeFileSync(junitPath, junit);
        this.log(`JUnit report generated: ${junitPath}`);
    }

    mapSeverityToSarif(severity) {
        const mapping = {
            'critical': 'error',
            'high': 'error',
            'medium': 'warning',
            'low': 'info'
        };
        return mapping[severity] || 'info';
    }
}

// CLI execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {
        verbose: args.includes('--verbose') || args.includes('-v'),
        outputDir: args.find(arg => arg.startsWith('--output='))?.split('=')[1] || './security-reports'
    };

    const scanner = new SecurityScanner(options);
    scanner.runAllScans()
        .then((results) => {
            console.log('\nSecurity Scan Summary:');
            console.log(`Total Findings: ${results.summary.totalFindings}`);
            console.log(`Critical: ${results.summary.criticalFindings}`);
            console.log(`High: ${results.summary.highFindings}`);
            console.log(`Medium: ${results.summary.mediumFindings}`);
            console.log(`Low: ${results.summary.lowFindings}`);
            
            // Exit with non-zero code if critical or high findings
            const criticalIssues = results.summary.criticalFindings + results.summary.highFindings;
            process.exit(criticalIssues > 0 ? 1 : 0);
        })
        .catch((error) => {
            console.error('Security scan failed:', error);
            process.exit(1);
        });
}

module.exports = SecurityScanner;
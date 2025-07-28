#!/usr/bin/env node

/**
 * Dependency Monitoring and Management System
 * Monitors dependencies for updates, vulnerabilities, and compliance
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

class DependencyMonitor {
    constructor(options = {}) {
        this.packageJson = this.loadPackageJson();
        this.lockFile = this.loadLockFile();
        this.reportDir = options.reportDir || './dependency-reports';
        this.thresholds = {
            critical: 0,      // No critical vulnerabilities allowed
            high: 2,          // Max 2 high vulnerabilities
            medium: 10,       // Max 10 medium vulnerabilities
            outdatedDays: 180 // Alert if package is 6+ months old
        };
        
        this.ensureReportDirectory();
    }

    loadPackageJson() {
        const packagePath = path.join(process.cwd(), 'package.json');
        if (!fs.existsSync(packagePath)) {
            throw new Error('package.json not found');
        }
        return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    }

    loadLockFile() {
        const lockPath = path.join(process.cwd(), 'package-lock.json');
        if (fs.existsSync(lockPath)) {
            return JSON.parse(fs.readFileSync(lockPath, 'utf8'));
        }
        return null;
    }

    ensureReportDirectory() {
        if (!fs.existsSync(this.reportDir)) {
            fs.mkdirSync(this.reportDir, { recursive: true });
        }
    }

    async runFullMonitoring() {
        console.log('Starting comprehensive dependency monitoring...');
        
        const report = {
            timestamp: new Date().toISOString(),
            project: {
                name: this.packageJson.name,
                version: this.packageJson.version
            },
            checks: {}
        };

        try {
            // Run all monitoring checks
            report.checks.vulnerabilities = await this.checkVulnerabilities();
            report.checks.outdated = await this.checkOutdatedPackages();
            report.checks.licenses = await this.checkLicenses();
            report.checks.duplicates = await this.checkDuplicates();
            report.checks.size = await this.analyzeBundleSize();
            report.checks.unused = await this.findUnusedDependencies();
            report.checks.compliance = await this.checkCompliance();

            // Generate recommendations
            report.recommendations = this.generateRecommendations(report.checks);

            // Calculate overall score
            report.score = this.calculateHealthScore(report.checks);

            // Save report
            await this.saveReport(report);

            // Generate alerts if needed
            await this.generateAlerts(report);

            console.log(`Dependency monitoring completed. Score: ${report.score}/100`);
            return report;

        } catch (error) {
            console.error('Dependency monitoring failed:', error);
            throw error;
        }
    }

    async checkVulnerabilities() {
        console.log('Checking for vulnerabilities...');
        
        try {
            // Run npm audit
            const auditResult = execSync('npm audit --json', { encoding: 'utf8' });
            const audit = JSON.parse(auditResult);

            const vulnerabilities = {
                total: audit.metadata?.vulnerabilities?.total || 0,
                info: audit.metadata?.vulnerabilities?.info || 0,
                low: audit.metadata?.vulnerabilities?.low || 0,
                moderate: audit.metadata?.vulnerabilities?.moderate || 0,
                high: audit.metadata?.vulnerabilities?.high || 0,
                critical: audit.metadata?.vulnerabilities?.critical || 0,
                details: []
            };

            // Extract vulnerability details
            if (audit.vulnerabilities) {
                for (const [packageName, vuln] of Object.entries(audit.vulnerabilities)) {
                    vulnerabilities.details.push({
                        package: packageName,
                        severity: vuln.severity,
                        title: vuln.via?.[0]?.title || 'Unknown vulnerability',
                        range: vuln.range,
                        fixAvailable: vuln.fixAvailable,
                        cves: vuln.via?.filter(v => v.source)?.map(v => v.source) || []
                    });
                }
            }

            return vulnerabilities;

        } catch (error) {
            if (error.stdout) {
                // npm audit can exit with non-zero even when it has valid output
                try {
                    return JSON.parse(error.stdout);
                } catch (parseError) {
                    // Fall back to error response
                }
            }
            
            return {
                total: 0,
                error: error.message,
                details: []
            };
        }
    }

    async checkOutdatedPackages() {
        console.log('Checking for outdated packages...');
        
        try {
            const outdatedResult = execSync('npm outdated --json', { encoding: 'utf8' });
            const outdated = JSON.parse(outdatedResult);

            const packages = [];
            const now = new Date();

            for (const [packageName, info] of Object.entries(outdated)) {
                const ageInDays = this.calculatePackageAge(packageName, info.current);
                
                packages.push({
                    name: packageName,
                    current: info.current,
                    wanted: info.wanted,
                    latest: info.latest,
                    type: info.type,
                    ageInDays,
                    updateType: this.determineUpdateType(info.current, info.latest),
                    priority: this.calculateUpdatePriority(info, ageInDays)
                });
            }

            return {
                total: packages.length,
                packages: packages.sort((a, b) => b.priority - a.priority)
            };

        } catch (error) {
            // npm outdated exits with code 1 when there are outdated packages
            if (error.stdout) {
                try {
                    const outdated = JSON.parse(error.stdout);
                    // Process the data as above
                    return { total: Object.keys(outdated).length, packages: [] };
                } catch (parseError) {
                    // Continue to error return
                }
            }
            
            return { total: 0, packages: [], error: error.message };
        }
    }

    async checkLicenses() {
        console.log('Checking package licenses...');
        
        const licenses = {
            compliant: [],
            nonCompliant: [],
            unknown: [],
            summary: {}
        };

        const allowedLicenses = [
            'MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 
            'ISC', 'CC0-1.0', 'Unlicense'
        ];

        const problematicLicenses = [
            'GPL-2.0', 'GPL-3.0', 'AGPL-3.0', 'LGPL-2.1', 'LGPL-3.0'
        ];

        try {
            // Get all installed packages
            const dependencies = {
                ...this.packageJson.dependencies,
                ...this.packageJson.devDependencies
            };

            for (const [packageName, version] of Object.entries(dependencies)) {
                const licenseInfo = this.getPackageLicense(packageName);
                
                const packageLicense = {
                    name: packageName,
                    version: this.getInstalledVersion(packageName),
                    license: licenseInfo.license,
                    licenseFile: licenseInfo.licenseFile
                };

                if (!licenseInfo.license) {
                    licenses.unknown.push(packageLicense);
                } else if (problematicLicenses.includes(licenseInfo.license)) {
                    licenses.nonCompliant.push(packageLicense);
                } else if (allowedLicenses.includes(licenseInfo.license)) {
                    licenses.compliant.push(packageLicense);
                } else {
                    // Review required for other licenses
                    licenses.unknown.push(packageLicense);
                }

                // Count license types
                const license = licenseInfo.license || 'Unknown';
                licenses.summary[license] = (licenses.summary[license] || 0) + 1;
            }

            return licenses;

        } catch (error) {
            return { error: error.message, compliant: [], nonCompliant: [], unknown: [] };
        }
    }

    async checkDuplicates() {
        console.log('Checking for duplicate dependencies...');
        
        const duplicates = [];
        const packageVersions = new Map();

        if (!this.lockFile || !this.lockFile.packages) {
            return { total: 0, duplicates: [] };
        }

        // Analyze package-lock.json for duplicates
        for (const [packagePath, packageInfo] of Object.entries(this.lockFile.packages)) {
            if (packagePath === '' || !packageInfo.version) continue;

            const packageName = this.extractPackageName(packagePath);
            if (!packageName) continue;

            if (!packageVersions.has(packageName)) {
                packageVersions.set(packageName, new Set());
            }
            
            packageVersions.get(packageName).add(packageInfo.version);
        }

        // Find packages with multiple versions
        for (const [packageName, versions] of packageVersions.entries()) {
            if (versions.size > 1) {
                duplicates.push({
                    package: packageName,
                    versions: Array.from(versions),
                    count: versions.size
                });
            }
        }

        return {
            total: duplicates.length,
            duplicates: duplicates.sort((a, b) => b.count - a.count)
        };
    }

    async analyzeBundleSize() {
        console.log('Analyzing bundle size...');
        
        try {
            // Get package sizes from node_modules
            const sizes = [];
            const nodeModulesPath = path.join(process.cwd(), 'node_modules');
            
            if (!fs.existsSync(nodeModulesPath)) {
                return { total: 0, packages: [] };
            }

            const dependencies = Object.keys(this.packageJson.dependencies || {});
            
            for (const packageName of dependencies) {
                const packagePath = path.join(nodeModulesPath, packageName);
                if (fs.existsSync(packagePath)) {
                    const size = this.calculateDirectorySize(packagePath);
                    sizes.push({
                        name: packageName,
                        size: size,
                        sizeHuman: this.formatBytes(size)
                    });
                }
            }

            const totalSize = sizes.reduce((sum, pkg) => sum + pkg.size, 0);
            
            return {
                total: totalSize,
                totalHuman: this.formatBytes(totalSize),
                packages: sizes.sort((a, b) => b.size - a.size).slice(0, 20) // Top 20
            };

        } catch (error) {
            return { error: error.message, total: 0, packages: [] };
        }
    }

    async findUnusedDependencies() {
        console.log('Finding unused dependencies...');
        
        const unused = [];
        const dependencies = Object.keys(this.packageJson.dependencies || {});
        
        try {
            // Simple check - look for require/import statements
            const sourceFiles = this.getSourceFiles();
            const usedPackages = new Set();

            for (const file of sourceFiles) {
                const content = fs.readFileSync(file, 'utf8');
                
                // Find require() and import statements
                const requireMatches = content.match(/require\(['"`]([^'"`]+)['"`]\)/g) || [];
                const importMatches = content.match(/import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g) || [];
                
                [...requireMatches, ...importMatches].forEach(match => {
                    const packageMatch = match.match(/['"`]([^'"`]+)['"`]/);
                    if (packageMatch) {
                        const packageName = packageMatch[1].split('/')[0];
                        if (!packageName.startsWith('.') && !packageName.startsWith('/')) {
                            usedPackages.add(packageName);
                        }
                    }
                });
            }

            // Find dependencies not used
            for (const dependency of dependencies) {
                if (!usedPackages.has(dependency)) {
                    unused.push({
                        name: dependency,
                        version: this.getInstalledVersion(dependency)
                    });
                }
            }

            return {
                total: unused.length,
                packages: unused
            };

        } catch (error) {
            return { error: error.message, total: 0, packages: [] };
        }
    }

    async checkCompliance() {
        console.log('Checking compliance requirements...');
        
        const compliance = {
            securityPolicy: this.checkSecurityPolicyCompliance(),
            licenseCompliance: this.checkLicenseCompliance(),
            updatePolicy: this.checkUpdatePolicyCompliance(),
            auditTrail: this.checkAuditTrailCompliance()
        };

        return compliance;
    }

    checkSecurityPolicyCompliance() {
        // Check if security scanning is configured
        const hasSecurityScript = this.packageJson.scripts?.['security:scan'] !== undefined;
        const hasAuditScript = this.packageJson.scripts?.['security:audit'] !== undefined;
        
        return {
            securityScanning: hasSecurityScript,
            auditProcess: hasAuditScript,
            score: (hasSecurityScript && hasAuditScript) ? 100 : 50
        };
    }

    checkLicenseCompliance() {
        // Check if license checking is in place
        const hasLicenseCheck = fs.existsSync(path.join(process.cwd(), '.licensee.yml')) ||
                               fs.existsSync(path.join(process.cwd(), 'license-checker.json'));
        
        return {
            licenseChecking: hasLicenseCheck,
            score: hasLicenseCheck ? 100 : 0
        };
    }

    checkUpdatePolicyCompliance() {
        // Check if dependency updates are automated
        const hasRenovateConfig = fs.existsSync(path.join(process.cwd(), 'renovate.json')) ||
                                 fs.existsSync(path.join(process.cwd(), '.renovaterc'));
        const hasDependabotConfig = fs.existsSync(path.join(process.cwd(), '.github/dependabot.yml'));
        
        return {
            automatedUpdates: hasRenovateConfig || hasDependabotConfig,
            score: (hasRenovateConfig || hasDependabotConfig) ? 100 : 0
        };
    }

    checkAuditTrailCompliance() {
        // Check if changes are tracked
        const hasChangeLog = fs.existsSync(path.join(process.cwd(), 'CHANGELOG.md'));
        const hasCommitLinting = fs.existsSync(path.join(process.cwd(), '.commitlintrc.js')) ||
                                fs.existsSync(path.join(process.cwd(), 'commitlint.config.js'));
        
        return {
            changeTracking: hasChangeLog,
            commitLinting: hasCommitLinting,
            score: (hasChangeLog && hasCommitLinting) ? 100 : 50
        };
    }

    generateRecommendations(checks) {
        const recommendations = [];

        // Security recommendations
        if (checks.vulnerabilities?.critical > 0) {
            recommendations.push({
                priority: 'critical',
                category: 'security',
                title: 'Critical vulnerabilities found',
                description: `${checks.vulnerabilities.critical} critical vulnerabilities need immediate attention`,
                action: 'Run `npm audit fix` or update vulnerable packages'
            });
        }

        if (checks.vulnerabilities?.high > this.thresholds.high) {
            recommendations.push({
                priority: 'high',
                category: 'security',
                title: 'High severity vulnerabilities',
                description: `${checks.vulnerabilities.high} high severity vulnerabilities exceed threshold`,
                action: 'Review and update vulnerable packages'
            });
        }

        // Update recommendations
        if (checks.outdated?.packages?.length > 0) {
            const criticalUpdates = checks.outdated.packages.filter(p => p.priority > 8);
            if (criticalUpdates.length > 0) {
                recommendations.push({
                    priority: 'medium',
                    category: 'maintenance',
                    title: 'Critical package updates available',
                    description: `${criticalUpdates.length} packages have critical updates available`,
                    action: 'Update packages using `npm update` or review individual packages'
                });
            }
        }

        // License recommendations
        if (checks.licenses?.nonCompliant?.length > 0) {
            recommendations.push({
                priority: 'medium',
                category: 'compliance',
                title: 'Non-compliant licenses detected',
                description: `${checks.licenses.nonCompliant.length} packages have potentially problematic licenses`,
                action: 'Review license compatibility and consider alternatives'
            });
        }

        // Performance recommendations
        if (checks.duplicates?.total > 0) {
            recommendations.push({
                priority: 'low',
                category: 'performance',
                title: 'Duplicate dependencies found',
                description: `${checks.duplicates.total} packages have multiple versions installed`,
                action: 'Consider deduplicating dependencies with `npm dedupe`'
            });
        }

        if (checks.unused?.total > 0) {
            recommendations.push({
                priority: 'low',
                category: 'maintenance',
                title: 'Unused dependencies detected',
                description: `${checks.unused.total} dependencies appear to be unused`,
                action: 'Review and remove unused dependencies to reduce bundle size'
            });
        }

        return recommendations.sort((a, b) => {
            const priorityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    calculateHealthScore(checks) {
        let score = 100;

        // Security score impact
        if (checks.vulnerabilities) {
            score -= checks.vulnerabilities.critical * 20;
            score -= checks.vulnerabilities.high * 10;
            score -= checks.vulnerabilities.moderate * 5;
        }

        // Maintenance score impact
        if (checks.outdated?.packages) {
            const criticalOutdated = checks.outdated.packages.filter(p => p.priority > 8).length;
            score -= criticalOutdated * 5;
        }

        // Compliance score impact
        if (checks.licenses?.nonCompliant?.length > 0) {
            score -= checks.licenses.nonCompliant.length * 10;
        }

        // Performance score impact
        if (checks.duplicates?.total > 5) {
            score -= 5;
        }

        if (checks.unused?.total > 10) {
            score -= 5;
        }

        return Math.max(0, Math.min(100, score));
    }

    async saveReport(report) {
        const timestamp = new Date().toISOString().split('T')[0];
        const reportPath = path.join(this.reportDir, `dependency-report-${timestamp}.json`);
        
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        // Also save as latest
        const latestPath = path.join(this.reportDir, 'latest-dependency-report.json');
        fs.writeFileSync(latestPath, JSON.stringify(report, null, 2));
        
        console.log(`Report saved: ${reportPath}`);
    }

    async generateAlerts(report) {
        const alerts = [];

        // Critical vulnerability alert
        if (report.checks.vulnerabilities?.critical > 0) {
            alerts.push({
                level: 'critical',
                title: 'Critical Security Vulnerabilities',
                message: `${report.checks.vulnerabilities.critical} critical vulnerabilities require immediate attention`,
                action: 'security_patch_required'
            });
        }

        // Low health score alert
        if (report.score < 70) {
            alerts.push({
                level: 'warning',
                title: 'Low Dependency Health Score',
                message: `Dependency health score is ${report.score}/100`,
                action: 'maintenance_required'
            });
        }

        // License compliance alert
        if (report.checks.licenses?.nonCompliant?.length > 0) {
            alerts.push({
                level: 'warning',
                title: 'License Compliance Issues',
                message: `${report.checks.licenses.nonCompliant.length} packages have non-compliant licenses`,
                action: 'license_review_required'
            });
        }

        if (alerts.length > 0) {
            await this.sendAlerts(alerts);
        }
    }

    async sendAlerts(alerts) {
        // In a real implementation, this would send alerts via:
        // - Slack webhook
        // - Email
        // - PagerDuty
        // - GitHub issues
        
        console.log('Alerts generated:');
        alerts.forEach(alert => {
            console.log(`[${alert.level.toUpperCase()}] ${alert.title}: ${alert.message}`);
        });

        // Save alerts to file for CI/CD consumption
        const alertsPath = path.join(this.reportDir, 'alerts.json');
        fs.writeFileSync(alertsPath, JSON.stringify(alerts, null, 2));
    }

    // Helper methods
    calculatePackageAge(packageName, version) {
        // This would ideally fetch from npm registry
        // For now, return a placeholder
        return 30; // days
    }

    determineUpdateType(current, latest) {
        const currentParts = current.split('.');
        const latestParts = latest.split('.');
        
        if (currentParts[0] !== latestParts[0]) return 'major';
        if (currentParts[1] !== latestParts[1]) return 'minor';
        return 'patch';
    }

    calculateUpdatePriority(info, ageInDays) {
        let priority = 0;
        
        // Age factor
        if (ageInDays > this.thresholds.outdatedDays) priority += 5;
        
        // Update type factor
        if (this.determineUpdateType(info.current, info.latest) === 'patch') priority += 3;
        if (this.determineUpdateType(info.current, info.latest) === 'minor') priority += 2;
        
        // Security consideration (if available)
        // This would require integration with vulnerability databases
        
        return priority;
    }

    getPackageLicense(packageName) {
        try {
            const packagePath = path.join(process.cwd(), 'node_modules', packageName, 'package.json');
            if (fs.existsSync(packagePath)) {
                const packageInfo = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
                return {
                    license: packageInfo.license,
                    licenseFile: fs.existsSync(path.join(path.dirname(packagePath), 'LICENSE'))
                };
            }
        } catch (error) {
            // Ignore errors
        }
        
        return { license: null, licenseFile: false };
    }

    getInstalledVersion(packageName) {
        try {
            const packagePath = path.join(process.cwd(), 'node_modules', packageName, 'package.json');
            if (fs.existsSync(packagePath)) {
                const packageInfo = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
                return packageInfo.version;
            }
        } catch (error) {
            // Ignore errors
        }
        
        return 'unknown';
    }

    extractPackageName(packagePath) {
        const parts = packagePath.split('/');
        if (parts[1].startsWith('@')) {
            return `${parts[1]}/${parts[2]}`;
        }
        return parts[1];
    }

    calculateDirectorySize(dirPath) {
        let totalSize = 0;
        
        try {
            const items = fs.readdirSync(dirPath);
            
            for (const item of items) {
                const itemPath = path.join(dirPath, item);
                const stat = fs.statSync(itemPath);
                
                if (stat.isDirectory()) {
                    totalSize += this.calculateDirectorySize(itemPath);
                } else {
                    totalSize += stat.size;
                }
            }
        } catch (error) {
            // Ignore errors (permissions, etc.)
        }
        
        return totalSize;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

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
        
        walkDirectory(process.cwd());
        return files;
    }
}

// CLI execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {
        reportDir: args.find(arg => arg.startsWith('--report-dir='))?.split('=')[1] || './dependency-reports'
    };

    const monitor = new DependencyMonitor(options);
    monitor.runFullMonitoring()
        .then((report) => {
            console.log('\nDependency Monitoring Summary:');
            console.log(`Health Score: ${report.score}/100`);
            console.log(`Vulnerabilities: ${report.checks.vulnerabilities?.total || 0}`);
            console.log(`Outdated Packages: ${report.checks.outdated?.total || 0}`);
            console.log(`Recommendations: ${report.recommendations?.length || 0}`);
            
            // Exit with error code if critical issues found
            const hasCriticalIssues = 
                report.checks.vulnerabilities?.critical > 0 ||
                report.score < 70;
            
            process.exit(hasCriticalIssues ? 1 : 0);
        })
        .catch((error) => {
            console.error('Dependency monitoring failed:', error);
            process.exit(1);
        });
}

module.exports = DependencyMonitor;
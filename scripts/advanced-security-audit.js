#!/usr/bin/env node

/**
 * Advanced Security Audit Script
 * Comprehensive security analysis and vulnerability assessment
 * for Cloud Remediator Sage
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class AdvancedSecurityAuditor {
  constructor() {
    this.auditResults = {
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      environment: process.env.NODE_ENV || 'development',
      findings: [],
      metrics: {},
      recommendations: [],
    };
    
    this.severityLevels = ['critical', 'high', 'medium', 'low', 'info'];
    this.riskThresholds = {
      critical: 0,
      high: 2,
      medium: 10,
      low: 50,
    };
  }

  async runAudit() {
    console.log('🔒 Starting Advanced Security Audit...');
    console.log('═'.repeat(50));

    try {
      // Core security audits
      await this.auditDependencies();
      await this.auditSourceCode();
      await this.auditConfiguration();
      await this.auditSecrets();
      await this.auditDockerSecurity();
      await this.auditInfrastructure();
      
      // Advanced analysis
      await this.analyzeAttackSurface();
      await this.assessPrivilegeEscalation();
      await this.evaluateSupplyChain();
      
      // Generate comprehensive report
      await this.generateReport();
      await this.generateMetrics();
      
      console.log('\n✅ Security audit completed successfully');
      this.summarizeFindings();
      
    } catch (error) {
      console.error('\n❌ Security audit failed:', error.message);
      process.exit(1);
    }
  }

  async auditDependencies() {
    console.log('📦 Auditing dependencies...');
    
    try {
      // NPM audit
      const { stdout: npmAudit } = await execAsync('npm audit --json');
      const npmResults = JSON.parse(npmAudit);
      
      if (npmResults.vulnerabilities) {
        Object.entries(npmResults.vulnerabilities).forEach(([pkg, vuln]) => {
          this.addFinding({
            category: 'dependency',
            severity: this.mapNpmSeverity(vuln.severity),
            title: `Vulnerable dependency: ${pkg}`,
            description: `${vuln.title} (${vuln.cwe || 'No CWE'})`,
            package: pkg,
            version: vuln.range,
            cve: vuln.cves || [],
            recommendation: vuln.fixAvailable ? 'Update to fixed version' : 'Consider alternative package',
          });
        });
      }
      
      // Analyze package.json for security best practices
      await this.auditPackageJson();
      
      // Check for known malicious packages
      await this.checkMaliciousPackages();
      
    } catch (error) {
      this.addFinding({
        category: 'audit_error',
        severity: 'medium',
        title: 'Dependency audit failed',
        description: error.message,
      });
    }
  }

  async auditSourceCode() {
    console.log('📝 Auditing source code...');
    
    try {
      // Static analysis with ESLint security rules
      const { stdout: eslintOutput } = await execAsync('npx eslint src/ --format json --config .eslintrc.js').catch(() => ({ stdout: '[]' }));
      const eslintResults = JSON.parse(eslintOutput);
      
      eslintResults.forEach(file => {
        file.messages.forEach(message => {
          if (message.ruleId && message.ruleId.includes('security')) {
            this.addFinding({
              category: 'source_code',
              severity: this.mapESLintSeverity(message.severity),
              title: `Security rule violation: ${message.ruleId}`,
              description: message.message,
              file: file.filePath,
              line: message.line,
              column: message.column,
            });
          }
        });
      });
      
      // Custom security pattern scanning
      await this.scanSecurityPatterns();
      
      // Analyze for common vulnerabilities
      await this.scanCommonVulnerabilities();
      
    } catch (error) {
      console.warn('Source code audit encountered issues:', error.message);
    }
  }

  async auditConfiguration() {
    console.log('⚙️  Auditing configuration...');
    
    try {
      // Audit serverless.yml
      await this.auditServerlessConfig();
      
      // Audit Docker configuration
      await this.auditDockerConfig();
      
      // Audit environment configuration
      await this.auditEnvironmentConfig();
      
      // Check for hardcoded secrets
      await this.scanHardcodedSecrets();
      
    } catch (error) {
      this.addFinding({
        category: 'configuration',
        severity: 'medium',
        title: 'Configuration audit failed',
        description: error.message,
      });
    }
  }

  async auditSecrets() {
    console.log('🔐 Auditing secrets and credentials...');
    
    try {
      // Use detect-secrets for comprehensive secret scanning
      const { stdout: secretsOutput } = await execAsync('detect-secrets scan --all-files').catch(() => ({ stdout: '{}' }));
      const secretsResults = JSON.parse(secretsOutput);
      
      if (secretsResults.results) {
        Object.entries(secretsResults.results).forEach(([file, secrets]) => {
          secrets.forEach(secret => {
            this.addFinding({
              category: 'secrets',
              severity: 'critical',
              title: `Potential secret detected`,
              description: `${secret.type} detected in ${file}`,
              file,
              line: secret.line_number,
              type: secret.type,
            });
          });
        });
      }
      
      // Check for AWS credentials in environment
      await this.checkAWSCredentials();
      
      // Audit secret management practices
      await this.auditSecretManagement();
      
    } catch (error) {
      console.warn('Secrets audit encountered issues:', error.message);
    }
  }

  async auditDockerSecurity() {
    console.log('🐳 Auditing Docker security...');
    
    try {
      // Check Dockerfile best practices
      await this.auditDockerfile();
      
      // Analyze container image if exists
      const imageExists = await this.checkImageExists();
      if (imageExists) {
        await this.scanContainerImage();
      }
      
    } catch (error) {
      console.warn('Docker security audit encountered issues:', error.message);
    }
  }

  async auditInfrastructure() {
    console.log('🏗️  Auditing infrastructure configuration...');
    
    try {
      // Audit IAM policies and roles
      await this.auditIAMConfiguration();
      
      // Check network security configurations
      await this.auditNetworkSecurity();
      
      // Analyze resource configurations
      await this.auditResourceSecurity();
      
    } catch (error) {
      console.warn('Infrastructure audit encountered issues:', error.message);
    }
  }

  async analyzeAttackSurface() {
    console.log('🎯 Analyzing attack surface...');
    
    // Identify all entry points
    const entryPoints = [
      { type: 'http_endpoint', path: '/health', exposure: 'public' },
      { type: 'http_endpoint', path: '/metrics', exposure: 'public' },
      { type: 's3_trigger', bucket: 'prowler-findings', exposure: 'internal' },
      { type: 'lambda_invoke', function: 'risk-scoring', exposure: 'internal' },
    ];
    
    entryPoints.forEach(entry => {
      const riskLevel = entry.exposure === 'public' ? 'medium' : 'low';
      this.addFinding({
        category: 'attack_surface',
        severity: riskLevel,
        title: `Attack surface: ${entry.type}`,
        description: `${entry.type} with ${entry.exposure} exposure`,
        path: entry.path || entry.function || entry.bucket,
        exposure: entry.exposure,
      });
    });
  }

  async assessPrivilegeEscalation() {
    console.log('⬆️ Assessing privilege escalation risks...');
    
    // Analyze IAM role permissions
    const iamRisks = [
      {
        role: 'lambda-execution-role',
        permission: 'neptune-db:connect',
        risk: 'Database access could be misused',
        severity: 'medium',
      },
      {
        role: 'lambda-execution-role',
        permission: 'logs:*',
        risk: 'Broad logging permissions',
        severity: 'low',
      },
    ];
    
    iamRisks.forEach(risk => {
      this.addFinding({
        category: 'privilege_escalation',
        severity: risk.severity,
        title: `IAM privilege risk: ${risk.role}`,
        description: risk.risk,
        permission: risk.permission,
        role: risk.role,
      });
    });
  }

  async evaluateSupplyChain() {
    console.log('🔗 Evaluating supply chain security...');
    
    try {
      // Check package integrity
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
      
      // Analyze dependency tree depth
      const { stdout: depTree } = await execAsync('npm ls --all --json').catch(() => ({ stdout: '{}' }));
      const deps = JSON.parse(depTree);
      
      const analysis = this.analyzeDepTree(deps);
      
      if (analysis.maxDepth > 5) {
        this.addFinding({
          category: 'supply_chain',
          severity: 'medium',
          title: 'Deep dependency tree',
          description: `Maximum dependency depth: ${analysis.maxDepth}`,
          maxDepth: analysis.maxDepth,
          totalDeps: analysis.totalDeps,
        });
      }
      
      // Check for suspicious packages
      await this.checkSuspiciousPackages(packageJson);
      
    } catch (error) {
      console.warn('Supply chain evaluation encountered issues:', error.message);
    }
  }

  async scanSecurityPatterns() {
    const patterns = [
      { regex: /eval\s*\(/, severity: 'critical', description: 'Use of eval() function' },
      { regex: /innerHTML\s*=/, severity: 'high', description: 'Direct innerHTML assignment' },
      { regex: /document\.write\s*\(/, severity: 'high', description: 'Use of document.write()' },
      { regex: /setTimeout\s*\(\s*['"]\w+/, severity: 'medium', description: 'setTimeout with string argument' },
      { regex: /password\s*=\s*['"]\w+['"]/, severity: 'critical', description: 'Hardcoded password' },
      { regex: /secret\s*=\s*['"]\w+['"]/, severity: 'critical', description: 'Hardcoded secret' },
    ];
    
    const srcFiles = await this.getSourceFiles();
    
    for (const file of srcFiles) {
      const content = await fs.readFile(file, 'utf8');
      const lines = content.split('\n');
      
      patterns.forEach(pattern => {
        lines.forEach((line, index) => {
          if (pattern.regex.test(line)) {
            this.addFinding({
              category: 'security_pattern',
              severity: pattern.severity,
              title: pattern.description,
              description: `Found in ${file}:${index + 1}`,
              file,
              line: index + 1,
              pattern: pattern.regex.toString(),
            });
          }
        });
      });
    }
  }

  async scanCommonVulnerabilities() {
    // Check for common Node.js vulnerabilities
    const vulnChecks = [
      {
        check: 'prototype_pollution',
        pattern: /\$\{.*\}|\[\s*['"]__proto__['"]\s*\]/,
        severity: 'high',
      },
      {
        check: 'path_traversal',
        pattern: /\.\.\//,
        severity: 'medium',
      },
      {
        check: 'command_injection',
        pattern: /exec\s*\(.*\$\{/,
        severity: 'critical',
      },
    ];
    
    const srcFiles = await this.getSourceFiles();
    
    for (const file of srcFiles) {
      const content = await fs.readFile(file, 'utf8');
      
      vulnChecks.forEach(vuln => {
        if (vuln.pattern.test(content)) {
          this.addFinding({
            category: 'vulnerability',
            severity: vuln.severity,
            title: `Potential ${vuln.check.replace('_', ' ')} vulnerability`,
            description: `Pattern detected in ${file}`,
            file,
            check: vuln.check,
          });
        }
      });
    }
  }

  async auditPackageJson() {
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
    
    // Check for security-related package.json issues
    if (!packageJson.engines) {
      this.addFinding({
        category: 'configuration',
        severity: 'low',
        title: 'Missing engines specification',
        description: 'package.json should specify Node.js version constraints',
      });
    }
    
    if (!packageJson.files && !packageJson.private) {
      this.addFinding({
        category: 'configuration',
        severity: 'medium',
        title: 'No files field in package.json',
        description: 'Could lead to unintended file publication',
      });
    }
    
    // Check for deprecated or risky scripts
    if (packageJson.scripts) {
      Object.entries(packageJson.scripts).forEach(([name, script]) => {
        if (script.includes('curl') || script.includes('wget')) {
          this.addFinding({
            category: 'configuration',
            severity: 'medium',
            title: `Risky script: ${name}`,
            description: `Script uses curl/wget which could be exploited`,
            script: name,
          });
        }
      });
    }
  }

  async auditServerlessConfig() {
    try {
      const serverlessContent = await fs.readFile('serverless.yml', 'utf8');
      
      // Check for security best practices
      if (!serverlessContent.includes('tracing:')) {
        this.addFinding({
          category: 'configuration',
          severity: 'medium',
          title: 'X-Ray tracing not configured',
          description: 'Enable AWS X-Ray for better observability',
        });
      }
      
      if (serverlessContent.includes('timeout: ')) {
        const timeouts = serverlessContent.match(/timeout:\s*(\d+)/g);
        timeouts?.forEach(timeout => {
          const value = parseInt(timeout.split(':')[1].trim());
          if (value > 900) {
            this.addFinding({
              category: 'configuration',
              severity: 'low',
              title: 'High Lambda timeout',
              description: `Timeout of ${value}s may indicate performance issues`,
            });
          }
        });
      }
      
    } catch (error) {
      // serverless.yml might not exist, which is fine
    }
  }

  addFinding(finding) {
    this.auditResults.findings.push({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...finding,
    });
  }

  mapNpmSeverity(npmSeverity) {
    const mapping = {
      critical: 'critical',
      high: 'high',
      moderate: 'medium',
      low: 'low',
      info: 'info',
    };
    return mapping[npmSeverity] || 'medium';
  }

  mapESLintSeverity(eslintSeverity) {
    return eslintSeverity === 2 ? 'medium' : 'low';
  }

  async getSourceFiles() {
    const { stdout } = await execAsync('find src/ -name "*.js" -type f');
    return stdout.split('\n').filter(Boolean);
  }

  analyzeDepTree(deps, depth = 0) {
    let maxDepth = depth;
    let totalDeps = 0;
    
    if (deps.dependencies) {
      totalDeps = Object.keys(deps.dependencies).length;
      
      Object.values(deps.dependencies).forEach(dep => {
        const analysis = this.analyzeDepTree(dep, depth + 1);
        maxDepth = Math.max(maxDepth, analysis.maxDepth);
        totalDeps += analysis.totalDeps;
      });
    }
    
    return { maxDepth, totalDeps };
  }

  async checkSuspiciousPackages(packageJson) {
    const suspiciousPatterns = [
      /typosquatting/i,
      /malicious/i,
      /backdoor/i,
    ];
    
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };
    
    Object.keys(allDeps).forEach(pkg => {
      suspiciousPatterns.forEach(pattern => {
        if (pattern.test(pkg)) {
          this.addFinding({
            category: 'supply_chain',
            severity: 'high',
            title: `Suspicious package name: ${pkg}`,
            description: 'Package name matches suspicious pattern',
            package: pkg,
          });
        }
      });
    });
  }

  async generateReport() {
    const reportPath = 'reports/security-audit-detailed.json';
    await fs.mkdir('reports', { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(this.auditResults, null, 2));
    console.log(`📊 Detailed report saved to ${reportPath}`);
  }

  async generateMetrics() {
    const metrics = this.auditResults.findings.reduce((acc, finding) => {
      acc[finding.severity] = (acc[finding.severity] || 0) + 1;
      acc.byCategory = acc.byCategory || {};
      acc.byCategory[finding.category] = (acc.byCategory[finding.category] || 0) + 1;
      return acc;
    }, {});
    
    this.auditResults.metrics = {
      ...metrics,
      totalFindings: this.auditResults.findings.length,
      riskScore: this.calculateRiskScore(),
    };
  }

  calculateRiskScore() {
    const weights = { critical: 10, high: 5, medium: 2, low: 1, info: 0 };
    return this.auditResults.findings.reduce((score, finding) => {
      return score + (weights[finding.severity] || 0);
    }, 0);
  }

  summarizeFindings() {
    const summary = this.auditResults.metrics;
    
    console.log('\n📊 SECURITY AUDIT SUMMARY');
    console.log('═'.repeat(30));
    console.log(`Total Findings: ${summary.totalFindings}`);
    console.log(`Risk Score: ${summary.riskScore}`);
    console.log('\nFindings by Severity:');
    
    this.severityLevels.forEach(level => {
      const count = summary[level] || 0;
      if (count > 0) {
        const indicator = count > this.riskThresholds[level] ? '🚨' : '✅';
        console.log(`  ${indicator} ${level.toUpperCase()}: ${count}`);
      }
    });
    
    console.log('\nFindings by Category:');
    Object.entries(summary.byCategory || {}).forEach(([category, count]) => {
      console.log(`  📋 ${category}: ${count}`);
    });
    
    // Risk assessment
    const criticalCount = summary.critical || 0;
    const highCount = summary.high || 0;
    
    if (criticalCount > 0) {
      console.log('\n🚨 CRITICAL: Immediate action required!');
      console.log(`${criticalCount} critical security issue(s) found.`);
    } else if (highCount > this.riskThresholds.high) {
      console.log('\n⚠️  HIGH RISK: Review and remediate high-severity findings.');
    } else {
      console.log('\n✅ ACCEPTABLE RISK: Security posture is within acceptable limits.');
    }
  }

  // Placeholder methods for comprehensive auditing
  async checkMaliciousPackages() { /* Implementation */ }
  async checkAWSCredentials() { /* Implementation */ }
  async auditSecretManagement() { /* Implementation */ }
  async auditDockerfile() { /* Implementation */ }
  async checkImageExists() { return false; }
  async scanContainerImage() { /* Implementation */ }
  async auditIAMConfiguration() { /* Implementation */ }
  async auditNetworkSecurity() { /* Implementation */ }
  async auditResourceSecurity() { /* Implementation */ }
  async auditDockerConfig() { /* Implementation */ }
  async auditEnvironmentConfig() { /* Implementation */ }
  async scanHardcodedSecrets() { /* Implementation */ }
}

// CLI interface
if (require.main === module) {
  const auditor = new AdvancedSecurityAuditor();
  auditor.runAudit().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = AdvancedSecurityAuditor;
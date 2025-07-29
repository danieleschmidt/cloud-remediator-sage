# Dependency Management and Security

## Overview

This document outlines the comprehensive dependency management strategy for cloud-remediator-sage, focusing on security, vulnerability management, and supply chain integrity.

## Dependency Security Framework

### Supply Chain Security
- **SBOM Generation**: Software Bill of Materials for all dependencies
- **Provenance Tracking**: Origin verification for all packages
- **License Compliance**: Automated license compatibility checking
- **Vulnerability Scanning**: Continuous monitoring for known vulnerabilities

### Risk Assessment Matrix

| Risk Level | Criteria | Action Required |
|------------|----------|-----------------|
| **Critical** | Actively exploited CVE | Immediate update/mitigation |
| **High** | High CVSS score (>7.0) | Update within 24 hours |
| **Medium** | Medium CVSS score (4.0-7.0) | Update within 1 week |
| **Low** | Low CVSS score (<4.0) | Update in next release cycle |

## Dependency Categories

### Production Dependencies
```json
{
  "aws-sdk": {
    "version": "^2.1691.0",
    "purpose": "AWS service integration",
    "security_notes": "Official AWS library, regularly updated",
    "alternatives": ["@aws-sdk/client-*", "aws-sdk-v3"]
  },
  "gremlin": {
    "version": "^3.7.2",
    "purpose": "Neptune graph database client",
    "security_notes": "Apache project, well-maintained",
    "alternatives": ["@aws/neptune-client"]
  },
  "js-yaml": {
    "version": "^4.1.0",
    "purpose": "YAML parsing for configuration",
    "security_notes": "Secure YAML parsing, no eval()",
    "alternatives": ["yaml"]
  }
}
```

### Development Dependencies
```json
{
  "jest": {
    "version": "^29.7.0",
    "purpose": "Testing framework",
    "security_notes": "Well-maintained, isolated test environment"
  },
  "eslint": {
    "version": "^8.57.0",
    "purpose": "Code linting and security analysis",
    "security_notes": "Includes security plugin for vulnerability detection"
  },
  "semantic-release": {
    "version": "^22.0.0",
    "purpose": "Automated release management",
    "security_notes": "Requires secure token management"
  }
}
```

## Vulnerability Management

### Automated Scanning
```javascript
// scripts/dependency-monitor.js (enhanced)
const { execSync } = require('child_process');
const fs = require('fs');

class DependencyMonitor {
  async scanVulnerabilities() {
    const auditResult = JSON.parse(execSync('npm audit --json', { encoding: 'utf8' }));
    const vulnerabilities = this.categorizeVulnerabilities(auditResult);
    
    return {
      timestamp: new Date().toISOString(),
      total_vulnerabilities: auditResult.metadata.vulnerabilities.total,
      critical: vulnerabilities.critical,
      high: vulnerabilities.high,
      medium: vulnerabilities.medium,
      low: vulnerabilities.low,
      recommendations: this.generateRecommendations(vulnerabilities)
    };
  }
  
  categorizeVulnerabilities(auditResult) {
    const vulns = auditResult.vulnerabilities || {};
    return {
      critical: Object.values(vulns).filter(v => v.severity === 'critical'),
      high: Object.values(vulns).filter(v => v.severity === 'high'),
      medium: Object.values(vulns).filter(v => v.severity === 'moderate'),
      low: Object.values(vulns).filter(v => v.severity === 'low')
    };
  }
}
```

### Remediation Strategies

#### Automatic Updates
- **Patch Versions**: Auto-update patch releases via Dependabot
- **Security Updates**: Immediate application of security patches
- **Minor Versions**: Weekly review and update cycle
- **Major Versions**: Quarterly review with breaking change analysis

#### Manual Review Process
1. **Impact Assessment**: Analyze potential breaking changes
2. **Security Review**: Evaluate security implications
3. **Testing**: Run comprehensive test suite
4. **Staging Deployment**: Test in non-production environment
5. **Production Deployment**: Gradual rollout with monitoring

## Package Management Security

### NPM Security Configuration
```json
{
  "audit-level": "moderate",
  "fund": false,
  "save-exact": true,
  "package-lock": true,
  "scripts": {
    "preinstall": "npx npm-force-resolutions"
  },
  "overrides": {
    "lodash": ">=4.17.21",
    "minimist": ">=1.2.6"
  }
}
```

### Lock File Management
- **Integrity Verification**: Validate package-lock.json integrity
- **Reproducible Builds**: Ensure consistent dependency resolution
- **Audit Trail**: Track all dependency changes in version control

### Private Registry Security
```bash
# .npmrc configuration for enhanced security
registry=https://registry.npmjs.org/
audit-level=moderate
fund=false
package-lock=true

# Scoped registry for internal packages (if applicable)
@terragon:registry=https://npm.terragon.internal/
//npm.terragon.internal/:_authToken=${NPM_TOKEN}
```

## SBOM Generation and Management

### CycloneDX SBOM
```javascript
// scripts/generate-sbom.js (enhanced)
const { createBom } = require('@cyclonedx/bom');
const packageJson = require('../package.json');

class SBOMGenerator {
  async generateSBOM() {
    const bom = await createBom({
      projectType: 'application',
      projectName: packageJson.name,
      projectVersion: packageJson.version,
      includeDevDependencies: false,
      includeLicenseText: true,
      outputFormat: 'json'
    });
    
    // Enhance with security metadata
    bom.components = bom.components.map(component => ({
      ...component,
      properties: [
        ...component.properties || [],
        {
          name: 'security:scan:timestamp',
          value: new Date().toISOString()
        },
        {
          name: 'security:risk:level',
          value: this.assessComponentRisk(component)
        }
      ]
    }));
    
    return bom;
  }
}
```

### SBOM Integration
- **CI/CD Integration**: Generate SBOM on every build
- **Registry Publishing**: Upload SBOM to artifact registry
- **Compliance Reporting**: Provide SBOM for security audits
- **Continuous Monitoring**: Track SBOM changes over time

## License Compliance

### Approved Licenses
```yaml
# .license-checker.yml
allowed_licenses:
  - MIT
  - Apache-2.0
  - BSD-2-Clause
  - BSD-3-Clause
  - ISC
  - Unlicense

restricted_licenses:
  - GPL-2.0
  - GPL-3.0
  - AGPL-3.0
  - LGPL-2.1
  - LGPL-3.0

license_exceptions:
  # Specific packages with acceptable copyleft licenses
  - package: "some-gpl-package"
    reason: "Limited scope, no distribution concerns"
    approved_by: "legal-team@terragon.com"
    expiry: "2025-12-31"
```

### License Automation
```javascript
// scripts/license-checker.js
const checker = require('license-checker');

class LicenseChecker {
  async checkCompliance() {
    return new Promise((resolve, reject) => {
      checker.init({
        start: process.cwd(),
        production: true,
        excludePrivatePackages: true
      }, (err, packages) => {
        if (err) return reject(err);
        
        const compliance = this.assessCompliance(packages);
        resolve(compliance);
      });
    });
  }
}
```

## Dependency Pinning and Updates

### Pinning Strategy
- **Direct Dependencies**: Pin to specific versions
- **Transitive Dependencies**: Use lock file for consistency
- **Security Updates**: Allow automatic security patches
- **Development Tools**: Pin to prevent build inconsistencies

### Update Workflows
```yaml
# .github/dependabot.yml (planned configuration)
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "04:00"
    open-pull-requests-limit: 5
    reviewers:
      - "security-team"
    commit-message:
      prefix: "deps"
      include: "scope"
```

## Security Monitoring

### Continuous Monitoring Tools
- **npm audit**: Built-in vulnerability scanning
- **Snyk**: Advanced vulnerability management
- **WhiteSource/Mend**: License and security compliance
- **GitHub Security Advisories**: Platform-native alerts

### Alerting and Response
```javascript
// Webhook handler for security alerts
exports.handleSecurityAlert = async (event) => {
  const alert = JSON.parse(event.body);
  
  if (alert.severity === 'critical' || alert.severity === 'high') {
    await this.notifySecurityTeam(alert);
    await this.createIncident(alert);
  }
  
  await this.logSecurityEvent(alert);
  return { statusCode: 200 };
};
```

## Best Practices

### Development Guidelines
1. **Minimal Dependencies**: Only include necessary packages
2. **Trusted Sources**: Prefer well-maintained, popular packages
3. **Regular Updates**: Keep dependencies current
4. **Security First**: Prioritize security over features
5. **Audit Trail**: Document all dependency decisions

### Operational Procedures
1. **Daily Scans**: Automated vulnerability scanning
2. **Weekly Reviews**: Manual dependency analysis
3. **Monthly Audits**: Comprehensive security assessment
4. **Quarterly Planning**: Dependency upgrade planning

## Incident Response

### Security Incident Workflow
1. **Detection**: Automated or manual vulnerability discovery
2. **Assessment**: Risk evaluation and impact analysis
3. **Response**: Immediate mitigation or remediation
4. **Recovery**: System restoration and validation
5. **Lessons Learned**: Process improvement and documentation

### Communication Plan
- **Internal Alerts**: Immediate team notification
- **Stakeholder Updates**: Regular status communications
- **Public Disclosure**: Coordinated vulnerability disclosure
- **Post-Incident Review**: Comprehensive analysis and improvement

## References

- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [OWASP Dependency Check](https://owasp.org/www-project-dependency-check/)
- [NPM Security Best Practices](https://docs.npmjs.com/security)
- [CycloneDX SBOM Standard](https://cyclonedx.org/)
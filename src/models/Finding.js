/**
 * Security Finding Model
 * Represents a security vulnerability or compliance issue discovered by scanners
 */

class Finding {
  constructor(data) {
    this.id = data.id || this.generateId(data);
    this.source = data.source; // prowler, cloudsploit, steampipe
    this.severity = this.normalizeSeverity(data.severity);
    this.category = data.category; // security, compliance, configuration
    this.subcategory = data.subcategory;
    this.title = data.title;
    this.description = data.description;
    this.recommendation = data.recommendation;
    this.resource = {
      arn: data.resource?.arn,
      type: data.resource?.type,
      region: data.resource?.region,
      accountId: data.resource?.accountId,
      name: data.resource?.name,
      tags: data.resource?.tags || {}
    };
    this.compliance = data.compliance || [];
    this.cvss = data.cvss;
    this.riskScore = data.riskScore || 0;
    this.blastRadius = data.blastRadius || 0;
    this.status = data.status || 'open';
    this.remediationStatus = data.remediationStatus || 'pending';
    this.evidence = data.evidence || {};
    this.metadata = data.metadata || {};
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.lastSeenAt = data.lastSeenAt || new Date();
  }

  generateId(data) {
    const source = data.source || 'unknown';
    const resource = data.resource?.arn || data.resource?.name || 'unknown-resource';
    const category = data.category || 'unknown-category';
    const hash = require('crypto')
      .createHash('sha256')
      .update(`${source}:${resource}:${category}:${data.title || 'unknown'}`)
      .digest('hex')
      .substring(0, 16);
    return `finding-${hash}`;
  }

  normalizeSeverity(severity) {
    if (!severity) return 'low';
    
    const normalized = severity.toLowerCase();
    if (['critical', 'high', 'medium', 'low', 'info'].includes(normalized)) {
      return normalized;
    }
    
    // Convert numeric CVSS to severity
    if (typeof severity === 'number') {
      if (severity >= 9.0) return 'critical';
      if (severity >= 7.0) return 'high';
      if (severity >= 4.0) return 'medium';
      if (severity >= 0.1) return 'low';
      return 'info';
    }
    
    return 'low';
  }

  getSeverityScore() {
    const scores = {
      critical: 10,
      high: 8,
      medium: 5,
      low: 2,
      info: 1
    };
    return scores[this.severity] || 1;
  }

  isCompliant(framework) {
    return this.compliance.some(comp => 
      comp.framework === framework && comp.status === 'compliant'
    );
  }

  calculateAge() {
    return Math.floor((new Date() - this.createdAt) / (1000 * 60 * 60 * 24));
  }

  toNeptuneVertex() {
    return {
      label: 'Finding',
      properties: {
        id: this.id,
        source: this.source,
        severity: this.severity,
        category: this.category,
        title: this.title,
        description: this.description,
        resourceArn: this.resource.arn,
        resourceType: this.resource.type,
        region: this.resource.region,
        accountId: this.resource.accountId,
        riskScore: this.riskScore,
        blastRadius: this.blastRadius,
        status: this.status,
        createdAt: this.createdAt.toISOString(),
        updatedAt: this.updatedAt.toISOString()
      }
    };
  }

  validate() {
    const errors = [];
    
    if (!this.source) errors.push('source is required');
    if (!this.title) errors.push('title is required');
    if (!this.resource?.arn && !this.resource?.name) {
      errors.push('resource arn or name is required');
    }
    if (!['critical', 'high', 'medium', 'low', 'info'].includes(this.severity)) {
      errors.push('invalid severity level');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static fromProwlerFinding(prowlerData) {
    return new Finding({
      source: 'prowler',
      severity: prowlerData.Severity,
      category: 'security',
      subcategory: prowlerData.Service,
      title: prowlerData.CheckTitle,
      description: prowlerData.Description,
      recommendation: prowlerData.Remediation,
      resource: {
        arn: prowlerData.ResourceId,
        type: prowlerData.ResourceType,
        region: prowlerData.Region,
        accountId: prowlerData.AccountId,
        name: prowlerData.ResourceName,
        tags: prowlerData.ResourceTags
      },
      compliance: prowlerData.Compliance?.map(comp => ({
        framework: comp.Framework,
        requirement: comp.Requirement,
        status: prowlerData.Status === 'PASS' ? 'compliant' : 'non-compliant'
      })) || [],
      evidence: {
        checkId: prowlerData.CheckID,
        findingUniqueId: prowlerData.FindingUniqueId,
        rawData: prowlerData
      },
      status: prowlerData.Status === 'PASS' ? 'resolved' : 'open'
    });
  }

  static fromCloudSploitFinding(cloudSploitData) {
    return new Finding({
      source: 'cloudsploit',
      severity: cloudSploitData.status === 'FAIL' ? 'high' : 'info',
      category: 'security',
      title: cloudSploitData.title,
      description: cloudSploitData.description,
      recommendation: cloudSploitData.remediation,
      resource: {
        arn: cloudSploitData.resource,
        region: cloudSploitData.region,
        name: cloudSploitData.resourceName
      },
      evidence: {
        plugin: cloudSploitData.plugin,
        category: cloudSploitData.category,
        rawData: cloudSploitData
      },
      status: cloudSploitData.status === 'PASS' ? 'resolved' : 'open'
    });
  }
}

module.exports = Finding;
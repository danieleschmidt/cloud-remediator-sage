/**
 * Advanced Security Validator
 * Comprehensive validation for security findings, assets, and remediations
 * Features: Multi-layer validation, schema enforcement, and security checks
 */

const Joi = require('joi');
const crypto = require('crypto');

class SecurityValidator {
  constructor() {
    this.validationCache = new Map();
    this.schemaCache = new Map();
    this.securityRules = this.initializeSecurityRules();
    this.complianceFrameworks = this.initializeComplianceFrameworks();
  }

  /**
   * Validate security finding with comprehensive checks
   * @param {Object} finding - Finding object to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result with detailed feedback
   */
  async validateFinding(finding, options = {}) {
    const validationId = this.generateValidationId(finding);
    
    // Check cache if enabled
    if (options.useCache && this.validationCache.has(validationId)) {
      return this.validationCache.get(validationId);
    }

    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      securityIssues: [],
      complianceIssues: [],
      score: 0,
      recommendations: []
    };

    try {
      // Layer 1: Schema Validation
      await this.validateFindingSchema(finding, result);
      
      // Layer 2: Business Logic Validation
      await this.validateFindingBusinessLogic(finding, result);
      
      // Layer 3: Security Validation
      await this.validateFindingSecurity(finding, result);
      
      // Layer 4: Compliance Validation
      await this.validateFindingCompliance(finding, result);
      
      // Layer 5: Cross-Reference Validation
      if (options.crossReference) {
        await this.validateFindingCrossReferences(finding, result);
      }
      
      // Calculate overall validation score
      result.score = this.calculateValidationScore(result);
      result.isValid = result.errors.length === 0 && result.securityIssues.length === 0;
      
      // Generate recommendations
      result.recommendations = this.generateValidationRecommendations(result);
      
      // Cache result if enabled
      if (options.useCache) {
        this.validationCache.set(validationId, result);
      }
      
      return result;
      
    } catch (error) {
      result.isValid = false;
      result.errors.push(`Validation failed: ${error.message}`);
      return result;
    }
  }

  /**
   * Validate asset with security and compliance checks
   * @param {Object} asset - Asset object to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  async validateAsset(asset, options = {}) {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      securityIssues: [],
      configurationIssues: [],
      score: 0,
      recommendations: []
    };

    try {
      // Schema validation
      await this.validateAssetSchema(asset, result);
      
      // Security configuration validation
      await this.validateAssetSecurity(asset, result);
      
      // Compliance validation
      await this.validateAssetCompliance(asset, result);
      
      // Network security validation
      await this.validateAssetNetworkSecurity(asset, result);
      
      // Calculate score and validity
      result.score = this.calculateValidationScore(result);
      result.isValid = result.errors.length === 0 && result.securityIssues.length === 0;
      result.recommendations = this.generateAssetRecommendations(result, asset);
      
      return result;
      
    } catch (error) {
      result.isValid = false;
      result.errors.push(`Asset validation failed: ${error.message}`);
      return result;
    }
  }

  /**
   * Validate remediation with safety and effectiveness checks
   * @param {Object} remediation - Remediation object to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  async validateRemediation(remediation, options = {}) {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      safetyIssues: [],
      effectivenessIssues: [],
      score: 0,
      recommendations: []
    };

    try {
      // Schema validation
      await this.validateRemediationSchema(remediation, result);
      
      // Safety validation
      await this.validateRemediationSafety(remediation, result);
      
      // Effectiveness validation
      await this.validateRemediationEffectiveness(remediation, result);
      
      // Template validation
      await this.validateRemediationTemplate(remediation, result);
      
      // Calculate score and validity
      result.score = this.calculateValidationScore(result);
      result.isValid = result.errors.length === 0 && result.safetyIssues.length === 0;
      result.recommendations = this.generateRemediationRecommendations(result, remediation);
      
      return result;
      
    } catch (error) {
      result.isValid = false;
      result.errors.push(`Remediation validation failed: ${error.message}`);
      return result;
    }
  }

  /**
   * Validate finding schema using Joi
   */
  async validateFindingSchema(finding, result) {
    const schema = this.getFindingSchema();
    
    try {
      await schema.validateAsync(finding, { abortEarly: false });
    } catch (error) {
      error.details.forEach(detail => {
        result.errors.push(`Schema validation: ${detail.message}`);
      });
    }
  }

  /**
   * Validate finding business logic
   */
  async validateFindingBusinessLogic(finding, result) {
    // Validate severity consistency
    if (finding.riskScore && finding.severity) {
      const expectedSeverity = this.inferSeverityFromRiskScore(finding.riskScore);
      if (expectedSeverity !== finding.severity) {
        result.warnings.push(
          `Severity '${finding.severity}' inconsistent with risk score ${finding.riskScore} (expected: ${expectedSeverity})`
        );
      }
    }
    
    // Validate resource ARN format
    if (finding.resource?.arn && !this.isValidArnFormat(finding.resource.arn)) {
      result.errors.push(`Invalid ARN format: ${finding.resource.arn}`);
    }
    
    // Validate compliance mappings
    if (finding.compliance) {
      for (const comp of finding.compliance) {
        if (!this.complianceFrameworks.has(comp.framework)) {
          result.warnings.push(`Unknown compliance framework: ${comp.framework}`);
        }
      }
    }
    
    // Validate finding age
    if (finding.createdAt) {
      const age = (new Date() - new Date(finding.createdAt)) / (1000 * 60 * 60 * 24);
      if (age > 90 && finding.severity === 'critical') {
        result.warnings.push(`Critical finding is ${Math.round(age)} days old`);
      }
    }
  }

  /**
   * Validate finding security aspects
   */
  async validateFindingSecurity(finding, result) {
    // Check for sensitive data exposure
    if (this.containsSensitiveInfo(finding)) {
      result.securityIssues.push('Finding contains potentially sensitive information');
    }
    
    // Validate source integrity
    if (!this.isValidSource(finding.source)) {
      result.securityIssues.push(`Untrusted finding source: ${finding.source}`);
    }
    
    // Check for injection attempts in description
    if (this.containsInjectionAttempts(finding.description || '')) {
      result.securityIssues.push('Finding description contains potential injection attempts');
    }
    
    // Validate evidence integrity
    if (finding.evidence?.rawData) {
      if (!this.isValidEvidenceStructure(finding.evidence.rawData)) {
        result.securityIssues.push('Evidence data structure appears malformed or suspicious');
      }
    }
  }

  /**
   * Validate finding compliance requirements
   */
  async validateFindingCompliance(finding, result) {
    if (!finding.compliance || finding.compliance.length === 0) {
      result.complianceIssues.push('No compliance framework mappings found');
      return;
    }
    
    for (const comp of finding.compliance) {
      const framework = this.complianceFrameworks.get(comp.framework);
      if (!framework) continue;
      
      // Validate requirement mapping
      if (comp.requirement && !framework.requirements.includes(comp.requirement)) {
        result.complianceIssues.push(
          `Invalid requirement '${comp.requirement}' for framework '${comp.framework}'`
        );
      }
      
      // Check mandatory mappings for critical findings
      if (finding.severity === 'critical' && !comp.requirement) {
        result.complianceIssues.push(
          `Critical finding must have specific compliance requirement mapping for ${comp.framework}`
        );
      }
    }
  }

  /**
   * Validate asset schema
   */
  async validateAssetSchema(asset, result) {
    const schema = this.getAssetSchema();
    
    try {
      await schema.validateAsync(asset, { abortEarly: false });
    } catch (error) {
      error.details.forEach(detail => {
        result.errors.push(`Asset schema validation: ${detail.message}`);
      });
    }
  }

  /**
   * Validate asset security configuration
   */
  async validateAssetSecurity(asset, result) {
    // Check for public exposure
    if (asset.isPubliclyAccessible && asset.isPubliclyAccessible()) {
      if (asset.containsSensitiveData && asset.containsSensitiveData()) {
        result.securityIssues.push('Asset with sensitive data is publicly accessible');
      }
      
      if (asset.criticality === 'critical') {
        result.securityIssues.push('Critical asset is publicly accessible');
      }
    }
    
    // Check encryption status
    if (asset.encryption) {
      if (!asset.encryption.atRest && asset.containsSensitiveData?.()) {
        result.securityIssues.push('Sensitive data asset lacks encryption at rest');
      }
      
      if (!asset.encryption.inTransit && asset.isPubliclyAccessible?.()) {
        result.securityIssues.push('Publicly accessible asset lacks encryption in transit');
      }
    }
    
    // Check monitoring and logging
    if (!asset.monitoringEnabled && asset.criticality === 'critical') {
      result.configurationIssues.push('Critical asset should have monitoring enabled');
    }
    
    if (!asset.loggingEnabled && asset.isPubliclyAccessible?.()) {
      result.configurationIssues.push('Publicly accessible asset should have logging enabled');
    }
  }

  /**
   * Validate asset network security
   */
  async validateAssetNetworkSecurity(asset, result) {
    if (!asset.securityGroups || asset.securityGroups.length === 0) {
      result.configurationIssues.push('Asset has no security groups defined');
      return;
    }
    
    for (const sg of asset.securityGroups) {
      if (!sg.rules) continue;
      
      for (const rule of sg.rules) {
        // Check for overly permissive rules
        if (rule.source === '0.0.0.0/0' && rule.ports?.includes('22')) {
          result.securityIssues.push('Security group allows SSH access from anywhere');
        }
        
        if (rule.source === '0.0.0.0/0' && rule.ports?.includes('3389')) {
          result.securityIssues.push('Security group allows RDP access from anywhere');
        }
        
        if (rule.source === '0.0.0.0/0' && rule.ports?.includes('*')) {
          result.securityIssues.push('Security group allows all traffic from anywhere');
        }
      }
    }
  }

  /**
   * Validate remediation safety
   */
  async validateRemediationSafety(remediation, result) {
    // Check for destructive operations
    if (this.isDestructiveOperation(remediation)) {
      if (!remediation.rollbackPlan || Object.keys(remediation.rollbackPlan).length === 0) {
        result.safetyIssues.push('Destructive operation lacks proper rollback plan');
      }
      
      if (!remediation.approvalRequired) {
        result.safetyIssues.push('Destructive operation should require approval');
      }
    }
    
    // Check for production impact
    if (remediation.metadata?.environment === 'production') {
      if (remediation.estimatedDowntime > 0 && !remediation.maintenanceWindow) {
        result.safetyIssues.push('Production remediation with downtime lacks maintenance window');
      }
    }
    
    // Validate automation level
    if (remediation.automationLevel === 'automated' && remediation.riskLevel === 'high') {
      result.safetyIssues.push('High-risk remediation should not be fully automated');
    }
  }

  /**
   * Validate remediation template
   */
  async validateRemediationTemplate(remediation, result) {
    if (!remediation.template) {
      result.errors.push('Remediation template is missing');
      return;
    }
    
    switch (remediation.templateType) {
      case 'terraform':
        this.validateTerraformTemplate(remediation.template, result);
        break;
      case 'cloudformation':
        this.validateCloudFormationTemplate(remediation.template, result);
        break;
      case 'boto3':
        this.validateBoto3Template(remediation.template, result);
        break;
      default:
        result.warnings.push(`Unknown template type: ${remediation.templateType}`);
    }
  }

  /**
   * Get finding validation schema
   */
  getFindingSchema() {
    if (this.schemaCache.has('finding')) {
      return this.schemaCache.get('finding');
    }
    
    const schema = Joi.object({
      id: Joi.string().required(),
      source: Joi.string().valid('prowler', 'cloudsploit', 'steampipe', 'custom').required(),
      severity: Joi.string().valid('critical', 'high', 'medium', 'low', 'info').required(),
      category: Joi.string().required(),
      title: Joi.string().required(),
      description: Joi.string().required(),
      resource: Joi.object({
        arn: Joi.string().required(),
        type: Joi.string().required(),
        region: Joi.string().required(),
        accountId: Joi.string().pattern(/^\d{12}$/).required(),
        name: Joi.string(),
        tags: Joi.object()
      }).required(),
      riskScore: Joi.number().min(0).max(10),
      compliance: Joi.array().items(Joi.object({
        framework: Joi.string().required(),
        requirement: Joi.string(),
        status: Joi.string().valid('compliant', 'non-compliant', 'unknown')
      })),
      createdAt: Joi.date(),
      updatedAt: Joi.date()
    });
    
    this.schemaCache.set('finding', schema);
    return schema;
  }

  /**
   * Get asset validation schema
   */
  getAssetSchema() {
    if (this.schemaCache.has('asset')) {
      return this.schemaCache.get('asset');
    }
    
    const schema = Joi.object({
      arn: Joi.string().required(),
      type: Joi.string().required(),
      accountId: Joi.string().pattern(/^\d{12}$/).required(),
      region: Joi.string().required(),
      criticality: Joi.string().valid('critical', 'high', 'medium', 'low', 'minimal').required(),
      tags: Joi.object(),
      securityGroups: Joi.array().items(Joi.object({
        id: Joi.string(),
        rules: Joi.array().items(Joi.object({
          source: Joi.string(),
          ports: Joi.array().items(Joi.alternatives().try(Joi.string(), Joi.number()))
        }))
      }))
    });
    
    this.schemaCache.set('asset', schema);
    return schema;
  }

  /**
   * Initialize security validation rules
   */
  initializeSecurityRules() {
    return {
      trustedSources: new Set(['prowler', 'cloudsploit', 'steampipe']),
      sensitivePatterns: [
        /password/i, /secret/i, /key/i, /token/i, /credential/i,
        /\b\d{4}-\d{4}-\d{4}-\d{4}\b/, // Credit card pattern
        /\b\d{3}-\d{2}-\d{4}\b/, // SSN pattern
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/ // Email pattern
      ],
      injectionPatterns: [
        /<script/i, /javascript:/i, /on\w+=/i,
        /union\s+select/i, /drop\s+table/i, /exec\s*\(/i
      ]
    };
  }

  /**
   * Initialize compliance frameworks
   */
  initializeComplianceFrameworks() {
    const frameworks = new Map();
    
    frameworks.set('pci-dss', {
      name: 'PCI DSS',
      requirements: ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2']
    });
    
    frameworks.set('hipaa', {
      name: 'HIPAA',
      requirements: ['164.306', '164.308', '164.310', '164.312', '164.314']
    });
    
    frameworks.set('sox', {
      name: 'SOX',
      requirements: ['302', '404', '409', '802', '906']
    });
    
    frameworks.set('nist', {
      name: 'NIST Cybersecurity Framework',
      requirements: ['ID', 'PR', 'DE', 'RS', 'RC']
    });
    
    return frameworks;
  }

  // Utility methods
  generateValidationId(object) {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(object));
    return hash.digest('hex').substring(0, 16);
  }

  inferSeverityFromRiskScore(riskScore) {
    if (riskScore >= 9) return 'critical';
    if (riskScore >= 7) return 'high';
    if (riskScore >= 4) return 'medium';
    if (riskScore >= 1) return 'low';
    return 'info';
  }

  isValidArnFormat(arn) {
    const arnPattern = /^arn:aws:[a-zA-Z0-9-]+:[a-zA-Z0-9-]*:\d{12}:.+$/;
    return arnPattern.test(arn);
  }

  containsSensitiveInfo(finding) {
    const text = `${finding.description || ''} ${finding.title || ''}`.toLowerCase();
    return this.securityRules.sensitivePatterns.some(pattern => pattern.test(text));
  }

  isValidSource(source) {
    return this.securityRules.trustedSources.has(source);
  }

  containsInjectionAttempts(text) {
    return this.securityRules.injectionPatterns.some(pattern => pattern.test(text));
  }

  isValidEvidenceStructure(evidence) {
    // Basic structure validation for evidence data
    try {
      if (typeof evidence === 'string') {
        JSON.parse(evidence);
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  isDestructiveOperation(remediation) {
    const destructiveKeywords = ['delete', 'remove', 'terminate', 'destroy', 'drop'];
    const template = JSON.stringify(remediation.template || {}).toLowerCase();
    return destructiveKeywords.some(keyword => template.includes(keyword));
  }

  calculateValidationScore(result) {
    let score = 100;
    
    // Deduct points for issues
    score -= result.errors.length * 25;
    score -= result.securityIssues.length * 20;
    score -= result.safetyIssues?.length * 15 || 0;
    score -= result.complianceIssues.length * 10;
    score -= result.warnings.length * 5;
    score -= result.configurationIssues?.length * 5 || 0;
    
    return Math.max(0, score);
  }

  generateValidationRecommendations(result) {
    const recommendations = [];
    
    if (result.errors.length > 0) {
      recommendations.push('Fix schema validation errors before proceeding');
    }
    
    if (result.securityIssues.length > 0) {
      recommendations.push('Address security issues immediately');
    }
    
    if (result.complianceIssues.length > 0) {
      recommendations.push('Review and update compliance mappings');
    }
    
    return recommendations;
  }

  generateAssetRecommendations(result, asset) {
    const recommendations = [];
    
    if (result.securityIssues.length > 0) {
      recommendations.push('Review asset security configuration');
    }
    
    if (result.configurationIssues.length > 0) {
      recommendations.push('Update asset configuration according to best practices');
    }
    
    return recommendations;
  }

  generateRemediationRecommendations(result, remediation) {
    const recommendations = [];
    
    if (result.safetyIssues.length > 0) {
      recommendations.push('Address safety concerns before automation');
    }
    
    if (result.effectivenessIssues?.length > 0) {
      recommendations.push('Improve remediation effectiveness');
    }
    
    return recommendations;
  }

  // Template validation methods (simplified implementations)
  validateTerraformTemplate(template, result) {
    if (typeof template !== 'object') {
      result.errors.push('Terraform template must be a valid object');
      return;
    }
    
    if (!template.resource && !template.data) {
      result.warnings.push('Terraform template should contain resources or data sources');
    }
  }

  validateCloudFormationTemplate(template, result) {
    if (typeof template !== 'object') {
      result.errors.push('CloudFormation template must be a valid object');
      return;
    }
    
    if (!template.Resources) {
      result.errors.push('CloudFormation template must contain Resources section');
    }
  }

  validateBoto3Template(template, result) {
    if (typeof template !== 'string' && typeof template !== 'object') {
      result.errors.push('Boto3 template must be a string or object');
      return;
    }
    
    if (typeof template === 'string' && !template.includes('boto3')) {
      result.warnings.push('Boto3 template should import boto3 library');
    }
  }
}

module.exports = SecurityValidator;
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
      console.error('Asset validation error:', error);
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
    if (asset.isPubliclyAccessible && typeof asset.isPubliclyAccessible === 'function' && asset.isPubliclyAccessible()) {
      if (asset.containsSensitiveData && typeof asset.containsSensitiveData === 'function' && asset.containsSensitiveData()) {
        result.securityIssues.push('Asset with sensitive data is publicly accessible');
      }
      
      if (asset.criticality === 'critical') {
        result.securityIssues.push('Critical asset is publicly accessible');
      }
    }
    
    // Check encryption status
    if (asset.encryption) {
      if (!asset.encryption.atRest && asset.containsSensitiveData && typeof asset.containsSensitiveData === 'function' && asset.containsSensitiveData()) {
        result.securityIssues.push('Sensitive data asset lacks encryption at rest');
      }
      
      if (!asset.encryption.inTransit && asset.isPubliclyAccessible && typeof asset.isPubliclyAccessible === 'function' && asset.isPubliclyAccessible()) {
        result.securityIssues.push('Publicly accessible asset lacks encryption in transit');
      }
    }
    
    // Check monitoring and logging
    if (!asset.monitoringEnabled && asset.criticality === 'critical') {
      result.configurationIssues = result.configurationIssues || [];
      result.configurationIssues.push('Critical asset should have monitoring enabled');
    }
    
    if (!asset.loggingEnabled && asset.isPubliclyAccessible && typeof asset.isPubliclyAccessible === 'function' && asset.isPubliclyAccessible()) {
      result.configurationIssues = result.configurationIssues || [];
      result.configurationIssues.push('Publicly accessible asset should have logging enabled');
    }
  }

  /**
   * Validate asset compliance requirements
   */
  async validateAssetCompliance(asset, result) {
    // Initialize arrays if they don't exist
    result.configurationIssues = result.configurationIssues || [];
    
    // Check for compliance requirements based on asset criticality
    if (asset.criticality === 'critical') {
      if (!asset.monitoringEnabled) {
        result.configurationIssues.push('Critical assets must have monitoring enabled for compliance');
      }
      
      if (!asset.loggingEnabled) {
        result.configurationIssues.push('Critical assets must have logging enabled for compliance');
      }
      
      if (!asset.encryption?.atRest) {
        result.configurationIssues.push('Critical assets must have encryption at rest enabled');
      }
    }
    
    // Check environment-specific compliance
    if (asset.environment === 'production') {
      if (!asset.backupEnabled) {
        result.configurationIssues.push('Production assets should have backup enabled');
      }
    }
    
    // Check for required tags for compliance
    if (!asset.tags || Object.keys(asset.tags).length === 0) {
      result.configurationIssues.push('Assets should have compliance tags for governance');
    }
  }

  /**
   * Validate asset network security
   */
  async validateAssetNetworkSecurity(asset, result) {
    // Initialize arrays if they don't exist
    result.configurationIssues = result.configurationIssues || [];
    result.securityIssues = result.securityIssues || [];
    
    if (!asset.securityGroups || asset.securityGroups.length === 0) {
      result.configurationIssues.push('Asset has no security groups defined');
      return;
    }
    
    for (const sg of asset.securityGroups) {
      if (!sg.rules || !Array.isArray(sg.rules)) continue;
      
      for (const rule of sg.rules) {
        if (!rule || !rule.source) continue;
        
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
   * Validate remediation schema
   */
  async validateRemediationSchema(remediation, result) {
    const schema = this.getRemediationSchema();
    
    try {
      await schema.validateAsync(remediation, { abortEarly: false });
    } catch (error) {
      error.details.forEach(detail => {
        result.errors.push(`Remediation schema validation: ${detail.message}`);
      });
    }
  }

  /**
   * Validate remediation safety
   */
  async validateRemediationSafety(remediation, result) {
    // Ensure safetyIssues array exists
    result.safetyIssues = result.safetyIssues || [];
    
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
   * Validate remediation effectiveness
   */
  async validateRemediationEffectiveness(remediation, result) {
    result.effectivenessIssues = result.effectivenessIssues || [];
    
    // Check if remediation has measurable success criteria
    if (!remediation.successCriteria || remediation.successCriteria.length === 0) {
      result.effectivenessIssues.push('Remediation lacks measurable success criteria');
    }
    
    // Check if remediation has validation steps
    if (!remediation.validationSteps || remediation.validationSteps.length === 0) {
      result.effectivenessIssues.push('Remediation lacks validation steps');
    }
    
    // Check if remediation addresses the finding properly
    if (remediation.findingId && !remediation.targetResource && !remediation.assetArn) {
      result.effectivenessIssues.push('Remediation should specify target resource');
    }
    
    // Estimate effectiveness based on remediation type
    if (remediation.estimatedEffectiveness !== undefined && remediation.estimatedEffectiveness < 0.7) {
      result.effectivenessIssues.push('Remediation has low estimated effectiveness (<70%)');
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
    
    // Set default template type if not provided
    const templateType = remediation.templateType || 'terraform';
    
    switch (templateType) {
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
        result.warnings.push(`Unknown template type: ${templateType}`);
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
   * Get remediation validation schema
   */
  getRemediationSchema() {
    if (this.schemaCache.has('remediation')) {
      return this.schemaCache.get('remediation');
    }
    
    const schema = Joi.object({
      id: Joi.string().required(),
      findingId: Joi.string(),
      assetArn: Joi.string(),
      type: Joi.string().required(),
      templateType: Joi.string().valid('terraform', 'cloudformation', 'boto3', 'script'),
      category: Joi.string(),
      title: Joi.string(),
      description: Joi.string(),
      template: Joi.alternatives().try(Joi.object(), Joi.string()),
      rollbackPlan: Joi.object(),
      automationLevel: Joi.string().valid('manual', 'semi-automated', 'automated'),
      riskLevel: Joi.string().valid('low', 'medium', 'high', 'critical'),
      estimatedDowntime: Joi.number().min(0),
      maintenanceWindow: Joi.string(),
      approvalRequired: Joi.boolean(),
      successCriteria: Joi.array(),
      validationSteps: Joi.array(),
      targetResource: Joi.string(),
      estimatedEffectiveness: Joi.number().min(0).max(1),
      metadata: Joi.object()
    });
    
    this.schemaCache.set('remediation', schema);
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
    // More comprehensive ARN pattern that handles various AWS service formats
    const arnPattern = /^arn:aws:[a-zA-Z0-9-]+:[a-zA-Z0-9-]*:\d{12}:.+$/;
    const arnPatternWithoutAccount = /^arn:aws:[a-zA-Z0-9-]+:[a-zA-Z0-9-]*::.+$/; // Some services don't use account ID
    const arnPatternGlobal = /^arn:aws:[a-zA-Z0-9-]+::[a-zA-Z0-9-]*:.+$/; // Global services
    
    return arnPattern.test(arn) || arnPatternWithoutAccount.test(arn) || arnPatternGlobal.test(arn);
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
    
    // Check template content
    const template = JSON.stringify(remediation.template || {}).toLowerCase();
    if (destructiveKeywords.some(keyword => template.includes(keyword))) {
      return true;
    }
    
    // Check remediation type/action
    const action = (remediation.action || remediation.type || '').toLowerCase();
    if (destructiveKeywords.some(keyword => action.includes(keyword))) {
      return true;
    }
    
    // Check title/description for destructive operations
    const description = (remediation.title || remediation.description || '').toLowerCase();
    if (destructiveKeywords.some(keyword => description.includes(keyword))) {
      return true;
    }
    
    return false;
  }

  calculateValidationScore(result) {
    let score = 100;
    
    // Deduct points for issues
    score -= (result.errors?.length || 0) * 25;
    score -= (result.securityIssues?.length || 0) * 20;
    score -= (result.safetyIssues?.length || 0) * 15;
    score -= (result.complianceIssues?.length || 0) * 10;
    score -= (result.warnings?.length || 0) * 5;
    score -= (result.configurationIssues?.length || 0) * 5;
    score -= (result.effectivenessIssues?.length || 0) * 5;
    
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

  /**
   * Validate Lambda event inputs with comprehensive security checks
   * @param {Object} event - Lambda event object
   * @param {string} functionName - Name of the Lambda function
   * @returns {Object} Validation result
   */
  validateLambdaEvent(event, functionName = 'unknown') {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      securityIssues: [],
      sanitizedEvent: null
    };

    try {
      // Deep clone event for sanitization
      const sanitizedEvent = JSON.parse(JSON.stringify(event));

      // Basic structure validation
      if (typeof event !== 'object' || event === null) {
        result.errors.push('Event must be a valid object');
        result.isValid = false;
        return result;
      }

      // Check for injection attempts in string fields
      this.scanForInjectionAttempts(event, result, '');

      // Validate S3 event structure
      if (event.Records && Array.isArray(event.Records)) {
        this.validateS3Records(event.Records, result);
      }

      // Validate API Gateway event
      if (event.httpMethod || event.requestContext) {
        this.validateApiGatewayEvent(event, result);
      }

      // Validate event size
      const eventSize = JSON.stringify(event).length;
      if (eventSize > 256000) { // 256KB limit
        result.warnings.push(`Event size (${eventSize} bytes) exceeds recommended limit`);
      }

      // Sanitize sensitive data
      this.sanitizeEventData(sanitizedEvent);
      result.sanitizedEvent = sanitizedEvent;

      result.isValid = result.errors.length === 0 && result.securityIssues.length === 0;

    } catch (error) {
      result.errors.push(`Event validation failed: ${error.message}`);
      result.isValid = false;
    }

    return result;
  }

  /**
   * Scan for injection attempts in nested objects
   */
  scanForInjectionAttempts(obj, result, path) {
    if (typeof obj === 'string') {
      if (this.containsInjectionAttempts(obj)) {
        result.securityIssues.push(`Potential injection attempt detected at ${path}`);
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        const newPath = path ? `${path}.${key}` : key;
        this.scanForInjectionAttempts(value, result, newPath);
      }
    }
  }

  /**
   * Validate S3 event records
   */
  validateS3Records(records, result) {
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      if (!record.s3) {
        result.errors.push(`Record ${i} missing s3 property`);
        continue;
      }

      if (!record.s3.bucket || !record.s3.bucket.name) {
        result.errors.push(`Record ${i} missing bucket name`);
      }

      if (!record.s3.object || !record.s3.object.key) {
        result.errors.push(`Record ${i} missing object key`);
      }

      // Check for suspicious file patterns
      if (record.s3.object?.key) {
        const key = record.s3.object.key;
        if (key.includes('..') || key.includes('<') || key.includes('>')) {
          result.securityIssues.push(`Suspicious file path detected: ${key}`);
        }
      }

      // Validate source IP if available
      if (record.requestParameters?.sourceIPAddress) {
        this.validateSourceIP(record.requestParameters.sourceIPAddress, result);
      }
    }
  }

  /**
   * Validate API Gateway event
   */
  validateApiGatewayEvent(event, result) {
    // Validate HTTP method
    if (event.httpMethod && !['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(event.httpMethod)) {
      result.warnings.push(`Unusual HTTP method: ${event.httpMethod}`);
    }

    // Validate headers
    if (event.headers) {
      this.validateHeaders(event.headers, result);
    }

    // Validate query parameters
    if (event.queryStringParameters) {
      this.validateQueryParameters(event.queryStringParameters, result);
    }

    // Validate body size
    if (event.body && event.body.length > 10485760) { // 10MB limit
      result.warnings.push('Request body exceeds recommended size limit');
    }

    // Check for request source
    if (event.requestContext?.identity?.sourceIp) {
      this.validateSourceIP(event.requestContext.identity.sourceIp, result);
    }
  }

  /**
   * Validate HTTP headers
   */
  validateHeaders(headers, result) {
    const suspiciousHeaders = ['x-forwarded-for', 'x-real-ip', 'x-originating-ip'];
    const requiredHeaders = ['user-agent'];

    // Check for suspicious headers
    for (const header of suspiciousHeaders) {
      if (headers[header]) {
        result.warnings.push(`Potentially spoofed header detected: ${header}`);
      }
    }

    // Check for required headers
    for (const header of requiredHeaders) {
      if (!headers[header]) {
        result.warnings.push(`Missing recommended header: ${header}`);
      }
    }

    // Check for injection in header values
    for (const [key, value] of Object.entries(headers)) {
      if (typeof value === 'string' && this.containsInjectionAttempts(value)) {
        result.securityIssues.push(`Potential injection in header ${key}`);
      }
    }
  }

  /**
   * Validate query parameters
   */
  validateQueryParameters(params, result) {
    for (const [key, value] of Object.entries(params)) {
      if (value && typeof value === 'string') {
        // Check for injection attempts
        if (this.containsInjectionAttempts(value)) {
          result.securityIssues.push(`Potential injection in query parameter ${key}`);
        }

        // Check for overly long parameters
        if (value.length > 2048) {
          result.warnings.push(`Query parameter ${key} is unusually long`);
        }
      }
    }
  }

  /**
   * Validate source IP address
   */
  validateSourceIP(ip, result) {
    // Check for private IP ranges (may indicate proxy/forwarding)
    const privateRanges = [
      /^10\./,
      /^192\.168\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^127\./
    ];

    if (privateRanges.some(range => range.test(ip))) {
      result.warnings.push(`Request from private IP range: ${ip}`);
    }

    // Basic IP format validation
    const ipPattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipPattern.test(ip)) {
      result.warnings.push(`Invalid IP address format: ${ip}`);
    }
  }

  /**
   * Sanitize sensitive data from event
   */
  sanitizeEventData(event) {
    const sensitiveKeys = ['password', 'secret', 'token', 'key', 'credential', 'authorization'];
    
    const sanitizeObject = (obj, path = '') => {
      if (typeof obj !== 'object' || obj === null) {
        return;
      }

      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        
        if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
          obj[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
          sanitizeObject(value, path ? `${path}.${key}` : key);
        } else if (typeof value === 'string' && this.containsSensitiveInfo({ description: value })) {
          obj[key] = '[POTENTIALLY_SENSITIVE]';
        }
      }
    };

    sanitizeObject(event);
  }

  /**
   * Validate remediation parameters for safety
   */
  validateRemediationParameters(parameters) {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      safetyIssues: []
    };

    if (!parameters || typeof parameters !== 'object') {
      result.errors.push('Parameters must be a valid object');
      result.isValid = false;
      return result;
    }

    // Check for dangerous parameter values
    const dangerousValues = ['*', '0.0.0.0/0', 'public-read-write', 'root'];
    
    for (const [key, value] of Object.entries(parameters)) {
      if (typeof value === 'string' && dangerousValues.includes(value)) {
        result.safetyIssues.push(`Potentially dangerous parameter value: ${key}=${value}`);
      }

      // Check for overly permissive CIDR blocks
      if (typeof value === 'string' && value.includes('/0') && !value.includes('127.0.0.1/')) {
        result.safetyIssues.push(`Overly permissive CIDR block: ${value}`);
      }

      // Check for wildcard permissions
      if (typeof value === 'string' && value.includes('*') && key.toLowerCase().includes('permission')) {
        result.safetyIssues.push(`Wildcard permission detected: ${key}=${value}`);
      }
    }

    result.isValid = result.errors.length === 0 && result.safetyIssues.length === 0;
    return result;
  }
}

module.exports = SecurityValidator;
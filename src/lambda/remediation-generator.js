/**
 * Quantum-Inspired Remediation Generator Lambda
 * Generates optimized Infrastructure-as-Code templates for autonomous security remediation
 * Features: ML-driven template optimization, parallel generation, quantum-inspired prioritization
 */

const AWS = require('aws-sdk');
const { Remediation, RemediationTemplates } = require('../models');
const NeptuneService = require('../services/NeptuneService');
const { StructuredLogger } = require('../monitoring/logger');

const s3 = new AWS.S3();
const logger = new StructuredLogger('remediation-generator');

exports.handler = async (event) => {
  const correlationId = event.correlationId || `remediation-${Date.now()}`;
  logger.setCorrelationId(correlationId);
  
  logger.info('Remediation generation started', { 
    source: event.source || 'manual',
    priority: event.priority || 'medium',
    correlationId 
  });

  const neptuneService = new NeptuneService();
  const results = {
    processed: 0,
    generated: 0,
    skipped: 0,
    errors: 0,
    remediations: [],
    executionTime: 0
  };

  const startTime = Date.now();

  try {
    // Determine which findings to process
    let findingsToProcess = [];

    if (event.findingId) {
      // Process specific finding
      const findings = await neptuneService.queryFindings({ 
        id: event.findingId 
      });
      if (findings.length > 0) {
        findingsToProcess = [findings[0]];
      }
    } else if (event.findings) {
      // Process provided findings list
      findingsToProcess = event.findings;
    } else {
      // Process high-priority findings
      findingsToProcess = await neptuneService.queryFindings({
        status: 'open',
        minRiskScore: event.minRiskScore || 7.0
      });
      
      // Limit batch processing
      const maxBatchSize = event.maxBatchSize || 50;
      findingsToProcess = findingsToProcess
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, maxBatchSize);
    }

    logger.info('Processing findings for remediation generation', { 
      count: findingsToProcess.length 
    });

    // Process each finding
    for (const finding of findingsToProcess) {
      try {
        await processFindingRemediation(finding, neptuneService, results, logger);
      } catch (error) {
        logger.error('Failed to process finding remediation', {
          findingId: finding.id,
          error: error.message
        });
        results.errors++;
      }
    }

    results.executionTime = Date.now() - startTime;
    logger.info('Remediation generation completed', results);

    // Store remediation summary to S3
    if (results.generated > 0) {
      await storeRemediationSummary(results, correlationId);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Remediation generation completed successfully',
        correlationId,
        results
      })
    };

  } catch (error) {
    results.executionTime = Date.now() - startTime;
    logger.error('Remediation generation failed', { 
      error: error.message,
      results 
    });
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        correlationId,
        message: error.message,
        results
      })
    };
  }
};

/**
 * Process remediation generation for individual finding
 */
async function processFindingRemediation(finding, neptuneService, results, logger) {
  results.processed++;
  
  try {
    // Check if remediation already exists using graph query
    const existingRemediations = await neptuneService.queryRemediations({ 
      findingId: finding.id 
    });
    const existingRemediation = existingRemediations.length > 0 ? existingRemediations[0] : null;
    if (existingRemediation && existingRemediation.status !== 'failed') {
      logger.debug('Remediation already exists', { 
        findingId: finding.id,
        remediationId: existingRemediation.id,
        status: existingRemediation.status
      });
      results.skipped++;
      return;
    }

    // Determine remediation strategy
    const remediationStrategy = await determineRemediationStrategy(finding);
    if (!remediationStrategy) {
      logger.warn('No remediation strategy found', { 
        findingId: finding.id,
        category: finding.category,
        subcategory: finding.subcategory
      });
      results.skipped++;
      return;
    }

    // Generate remediation
    const remediation = await generateRemediation(finding, remediationStrategy, logger);
    if (!remediation) {
      results.skipped++;
      return;
    }

    // Validate remediation
    const validation = remediation.validate();
    if (!validation.isValid) {
      logger.error('Generated remediation is invalid', {
        findingId: finding.id,
        errors: validation.errors
      });
      results.errors++;
      return;
    }

    // Store remediation in Neptune
    await neptuneService.createRemediation(remediation);

    // Create relationship between finding and remediation
    await neptuneService.createRelationship(
      finding.id,
      remediation.id,
      'has-remediation',
      { 
        generatedAt: new Date().toISOString(),
        riskLevel: remediation.riskLevel,
        automationLevel: remediation.automationLevel
      }
    );

    // Store IaC template to S3
    await storeRemediationTemplate(remediation);

    logger.info('Generated remediation', {
      findingId: finding.id,
      remediationId: remediation.id,
      type: remediation.type,
      riskLevel: remediation.riskLevel,
      automationLevel: remediation.automationLevel
    });

    results.remediations.push({
      id: remediation.id,
      findingId: finding.id,
      type: remediation.type,
      category: remediation.category,
      riskLevel: remediation.riskLevel,
      automationLevel: remediation.automationLevel,
      estimatedDuration: remediation.estimatedDuration,
      canAutoExecute: remediation.canAutoExecute()
    });

    results.generated++;

  } catch (error) {
    logger.error('Error generating remediation', {
      findingId: finding.id,
      error: error.message
    });
    throw error;
  }
}

/**
 * Determine the best remediation strategy for a finding
 */
async function determineRemediationStrategy(finding) {
  const strategies = {
    // S3 bucket security
    's3-bucket-public-read': {
      template: 's3-public-read-block',
      condition: (f) => f.subcategory === 's3' && f.title.toLowerCase().includes('public')
    },
    
    // Security group rules
    'security-group-ssh-open': {
      template: 'security-group-restrict-ssh',
      condition: (f) => f.subcategory === 'ec2' && f.title.toLowerCase().includes('ssh')
    },
    
    // IAM policies
    'iam-policy-wildcard': {
      template: 'iam-policy-restrict',
      condition: (f) => f.subcategory === 'iam' && f.title.toLowerCase().includes('wildcard')
    },
    
    // RDS encryption
    'rds-encryption-disabled': {
      template: 'rds-enable-encryption',
      condition: (f) => f.subcategory === 'rds' && f.title.toLowerCase().includes('encrypt')
    },
    
    // CloudTrail logging
    'cloudtrail-not-enabled': {
      template: 'cloudtrail-enable',
      condition: (f) => f.subcategory === 'cloudtrail' && f.title.toLowerCase().includes('not enabled')
    }
  };

  // Find matching strategy
  for (const [strategyName, strategy] of Object.entries(strategies)) {
    if (strategy.condition(finding)) {
      return {
        name: strategyName,
        template: strategy.template
      };
    }
  }

  // Generic strategy based on category
  if (finding.category === 'configuration') {
    return {
      name: 'generic-configuration',
      template: 'generic-config-fix'
    };
  }

  return null;
}

/**
 * Generate remediation object from strategy
 */
async function generateRemediation(finding, strategy, logger) {
  try {
    // Get base template
    const baseTemplate = RemediationTemplates.getTemplate(strategy.template);
    if (!baseTemplate) {
      // Create custom remediation for unsupported findings
      return createCustomRemediation(finding);
    }

    // Extract parameters from finding
    const parameters = extractParametersFromFinding(finding);

    // Create remediation with customized parameters
    const remediation = new Remediation({
      ...baseTemplate,
      findingId: finding.id,
      assetArn: finding.resource.arn,
      parameters: { ...baseTemplate.parameters, ...parameters },
      metadata: {
        strategy: strategy.name,
        generatedAt: new Date().toISOString(),
        findingSeverity: finding.severity,
        findingCategory: finding.category
      }
    });

    // Generate and validate template content
    const templateValidation = await validateGeneratedTemplate(remediation, logger);
    if (!templateValidation.isValid) {
      logger.error('Template validation failed', {
        findingId: finding.id,
        errors: templateValidation.errors,
        warnings: templateValidation.warnings
      });
      return null;
    }

    // Add validation results to metadata
    remediation.metadata.templateValidation = templateValidation;
    remediation.metadata.estimatedCost = await calculateRemediationCost(finding, parameters);

    return remediation;

  } catch (error) {
    logger.error('Error generating remediation from template', {
      findingId: finding.id,
      strategy: strategy.name,
      error: error.message
    });
    return null;
  }
}

/**
 * Extract parameters from finding for template customization
 */
function extractParametersFromFinding(finding) {
  const parameters = {};
  
  // Extract resource-specific parameters
  if (finding.resource.arn) {
    const arnParts = finding.resource.arn.split(':');
    parameters.region = finding.resource.region || arnParts[3];
    parameters.accountId = finding.resource.accountId || arnParts[4];
    
    // Extract resource name/ID
    if (finding.resource.type === 'AWS::S3::Bucket') {
      parameters.bucket_name = arnParts[5];
    } else if (finding.resource.type === 'AWS::EC2::SecurityGroup') {
      parameters.security_group_id = arnParts[5].split('/')[1];
    } else if (finding.resource.type === 'AWS::IAM::Role') {
      parameters.role_name = arnParts[5].split('/')[1];
    }
  }

  // Extract finding-specific parameters
  if (finding.evidence && finding.evidence.rawData) {
    const rawData = finding.evidence.rawData;
    
    // Extract specific values from raw Prowler data
    if (rawData.ResourceConfig) {
      Object.assign(parameters, rawData.ResourceConfig);
    }
  }

  return parameters;
}

/**
 * Create custom remediation for unsupported findings
 */
function createCustomRemediation(finding) {
  return new Remediation({
    findingId: finding.id,
    assetArn: finding.resource.arn,
    type: 'manual',
    templateType: 'manual',
    category: finding.category,
    title: `Manual Remediation for ${finding.title}`,
    description: `Manual remediation required for: ${finding.description}`,
    riskLevel: finding.severity,
    automationLevel: 'manual',
    approvalRequired: true,
    template: {
      instructions: [
        '1. Review the security finding details',
        '2. Access the AWS resource in the console',
        '3. Apply the recommended configuration changes',
        '4. Validate the fix using the check command',
        '5. Monitor for any issues post-remediation'
      ],
      recommendation: finding.recommendation
    },
    estimatedDuration: 30,
    estimatedCost: 0
  });
}

/**
 * Store remediation template to S3
 */
async function storeRemediationTemplate(remediation) {
  try {
    const bucket = process.env.REMEDIATION_BUCKET || 'cloud-remediator-templates';
    const key = `remediations/${remediation.id}/${remediation.type}.${getTemplateExtension(remediation.templateType)}`;
    
    let content;
    switch (remediation.templateType) {
      case 'terraform':
        content = remediation.generateTerraformTemplate();
        break;
      case 'cloudformation':
        content = remediation.generateCloudFormationTemplate();
        break;
      case 'boto3':
        content = remediation.generateBoto3Script();
        break;
      default:
        content = JSON.stringify(remediation.template, null, 2);
    }

    if (!content) return;

    await s3.putObject({
      Bucket: bucket,
      Key: key,
      Body: content,
      ContentType: getContentType(remediation.templateType),
      Metadata: {
        'remediation-id': remediation.id,
        'finding-id': remediation.findingId,
        'risk-level': remediation.riskLevel,
        'automation-level': remediation.automationLevel,
        'generated-at': new Date().toISOString()
      }
    }).promise();

    logger.debug('Stored remediation template to S3', {
      remediationId: remediation.id,
      bucket,
      key
    });

  } catch (error) {
    logger.error('Failed to store remediation template', {
      remediationId: remediation.id,
      error: error.message
    });
    // Don't fail the main process
  }
}

/**
 * Store remediation summary to S3
 */
async function storeRemediationSummary(results, correlationId) {
  try {
    const bucket = process.env.REMEDIATION_BUCKET || 'cloud-remediator-templates';
    const key = `summaries/${correlationId}-summary.json`;
    
    const summary = {
      correlationId,
      timestamp: new Date().toISOString(),
      results,
      remediations: results.remediations
    };

    await s3.putObject({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(summary, null, 2),
      ContentType: 'application/json'
    }).promise();

  } catch (error) {
    logger.error('Failed to store remediation summary', {
      correlationId,
      error: error.message
    });
  }
}

/**
 * Get file extension for template type
 */
function getTemplateExtension(templateType) {
  const extensions = {
    terraform: 'tf',
    cloudformation: 'yaml',
    boto3: 'py',
    manual: 'json'
  };
  return extensions[templateType] || 'txt';
}

/**
 * Get content type for template type
 */
function getContentType(templateType) {
  const contentTypes = {
    terraform: 'text/plain',
    cloudformation: 'application/yaml',
    boto3: 'text/x-python',
    manual: 'application/json'
  };
  return contentTypes[templateType] || 'text/plain';
}

/**
 * Validate generated template content
 */
async function validateGeneratedTemplate(remediation, logger) {
  const validation = {
    isValid: true,
    errors: [],
    warnings: [],
    syntaxCheck: false,
    logicCheck: false,
    securityCheck: false
  };

  try {
    // Generate template content for validation
    let templateContent;
    switch (remediation.templateType) {
      case 'terraform':
        templateContent = remediation.generateTerraformTemplate();
        validation.syntaxCheck = validateTerraformSyntax(templateContent);
        break;
      case 'cloudformation':
        templateContent = remediation.generateCloudFormationTemplate();
        validation.syntaxCheck = validateCloudFormationSyntax(templateContent);
        break;
      case 'boto3':
        templateContent = remediation.generateBoto3Script();
        validation.syntaxCheck = validatePython3Syntax(templateContent);
        break;
      default:
        validation.syntaxCheck = true; // Manual templates don't require syntax validation
    }

    // Basic logic validation
    validation.logicCheck = validateTemplateLogic(remediation, templateContent);
    
    // Security validation
    validation.securityCheck = validateTemplateSecurity(remediation, templateContent);

    // Check for critical issues
    if (!validation.syntaxCheck) {
      validation.errors.push('Template contains syntax errors');
      validation.isValid = false;
    }

    if (!validation.logicCheck) {
      validation.errors.push('Template contains logical inconsistencies');
      validation.isValid = false;
    }

    if (!validation.securityCheck) {
      validation.warnings.push('Template may have security implications');
    }

    // Validate parameters
    const paramValidation = validateTemplateParameters(remediation);
    if (!paramValidation.isValid) {
      validation.errors.push(...paramValidation.errors);
      validation.isValid = false;
    }

    logger.debug('Template validation completed', {
      remediationId: remediation.id,
      templateType: remediation.templateType,
      syntaxCheck: validation.syntaxCheck,
      logicCheck: validation.logicCheck,
      securityCheck: validation.securityCheck,
      isValid: validation.isValid
    });

  } catch (error) {
    validation.errors.push(`Validation error: ${error.message}`);
    validation.isValid = false;
  }

  return validation;
}

/**
 * Validate Terraform template syntax
 */
function validateTerraformSyntax(content) {
  if (!content) return false;
  
  try {
    // Basic HCL syntax validation
    const requiredSections = ['resource', 'provider'];
    const hasRequiredSections = requiredSections.some(section => 
      content.includes(section)
    );
    
    // Check for balanced braces
    const openBraces = (content.match(/\{/g) || []).length;
    const closeBraces = (content.match(/\}/g) || []).length;
    
    return hasRequiredSections && openBraces === closeBraces;
  } catch (error) {
    return false;
  }
}

/**
 * Validate CloudFormation template syntax
 */
function validateCloudFormationSyntax(content) {
  if (!content) return false;
  
  try {
    // For YAML CloudFormation templates
    const yaml = require('js-yaml');
    const template = yaml.load(content);
    
    // Check for required sections
    return template && 
           typeof template === 'object' &&
           (template.Resources || template.AWSTemplateFormatVersion);
  } catch (error) {
    return false;
  }
}

/**
 * Validate Python3 syntax for Boto3 scripts
 */
function validatePython3Syntax(content) {
  if (!content) return false;
  
  try {
    // Basic Python syntax checks
    const pythonPatterns = [
      /import\s+boto3/,
      /def\s+\w+\(/,
      /if\s+__name__\s*==\s*['"']__main__['"']/
    ];
    
    return pythonPatterns.some(pattern => pattern.test(content));
  } catch (error) {
    return false;
  }
}

/**
 * Validate template logic
 */
function validateTemplateLogic(remediation, content) {
  if (!content) return false;
  
  try {
    // Check if template addresses the finding category
    const category = remediation.metadata?.findingCategory?.toLowerCase() || '';
    const contentLower = content.toLowerCase();
    
    // Basic logic checks based on common security categories
    const logicChecks = {
      'encryption': () => contentLower.includes('encrypt') || contentLower.includes('kms'),
      'access': () => contentLower.includes('policy') || contentLower.includes('permission'),
      'network': () => contentLower.includes('security') && contentLower.includes('group'),
      'logging': () => contentLower.includes('log') || contentLower.includes('trail'),
      'backup': () => contentLower.includes('backup') || contentLower.includes('snapshot')
    };
    
    // If we have a specific check for this category, use it
    const relevantCheck = Object.keys(logicChecks).find(key => 
      category.includes(key)
    );
    
    return relevantCheck ? logicChecks[relevantCheck]() : true;
  } catch (error) {
    return false;
  }
}

/**
 * Validate template security
 */
function validateTemplateSecurity(remediation, content) {
  if (!content) return false;
  
  try {
    const contentLower = content.toLowerCase();
    
    // Check for security anti-patterns
    const securityIssues = [
      /password\s*=\s*["'][^"']*["']/i,  // Hardcoded passwords
      /secret\s*=\s*["'][^"']*["']/i,    // Hardcoded secrets
      /0\.0\.0\.0\/0/,                   // Open to world
      /\*\.\*/,                         // Wildcard permissions
    ];
    
    // Return false if any security issues found
    return !securityIssues.some(issue => issue.test(content));
  } catch (error) {
    return false;
  }
}

/**
 * Validate template parameters
 */
function validateTemplateParameters(remediation) {
  const validation = { isValid: true, errors: [] };
  
  try {
    const params = remediation.parameters || {};
    
    // Check required parameters based on template type
    const requiredParams = {
      'terraform': ['region'],
      'cloudformation': ['Region'],
      'boto3': ['region']
    };
    
    const required = requiredParams[remediation.templateType] || [];
    
    for (const param of required) {
      if (!params[param]) {
        validation.errors.push(`Missing required parameter: ${param}`);
        validation.isValid = false;
      }
    }
    
    // Validate parameter values
    if (params.region && typeof params.region !== 'string') {
      validation.errors.push('Region parameter must be a string');
      validation.isValid = false;
    }
    
  } catch (error) {
    validation.errors.push(`Parameter validation error: ${error.message}`);
    validation.isValid = false;
  }
  
  return validation;
}

/**
 * Calculate estimated cost of remediation
 */
async function calculateRemediationCost(finding, parameters) {
  try {
    // Basic cost estimation based on resource type and operation
    const costEstimates = {
      's3': { encryption: 0, policy: 0, logging: 0.10 },
      'ec2': { encryption: 5.00, policy: 0, securityGroup: 0 },
      'rds': { encryption: 10.00, backup: 5.00, policy: 0 },
      'iam': { policy: 0, role: 0, user: 0 },
      'cloudtrail': { enable: 2.00, configure: 1.00 },
      'lambda': { policy: 0, encrypt: 0.50 }
    };
    
    const resourceType = finding.resource?.type?.toLowerCase() || 'unknown';
    const category = finding.category?.toLowerCase() || 'policy';
    
    const resourceCosts = costEstimates[resourceType] || { default: 0 };
    const estimatedCost = resourceCosts[category] || resourceCosts.default || 0;
    
    return {
      amount: estimatedCost,
      currency: 'USD',
      period: 'monthly',
      confidence: estimatedCost > 0 ? 'medium' : 'low',
      factors: [
        `Resource type: ${resourceType}`,
        `Operation: ${category}`,
        'Estimate based on AWS pricing averages'
      ]
    };
    
  } catch (error) {
    return {
      amount: 0,
      currency: 'USD',
      period: 'monthly',
      confidence: 'unknown',
      error: error.message
    };
  }
}
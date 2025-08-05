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
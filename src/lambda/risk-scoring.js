/**
 * Risk Scoring Lambda
 * Calculates and updates risk scores for security findings
 */

const SecurityAnalysisService = require('../services/SecurityAnalysisService');
const NeptuneService = require('../services/NeptuneService');
const { StructuredLogger } = require('../monitoring/logger');
const { ErrorHandler } = require('../utils/errorHandler');
const SecurityValidator = require('../validation/SecurityValidator');

const logger = new StructuredLogger('risk-scoring');
const errorHandler = new ErrorHandler('risk-scoring');
const securityValidator = new SecurityValidator();

exports.handler = errorHandler.createLambdaMiddleware()(async (event, context, childLogger) => {
  const correlationId = childLogger?.correlationId || event.correlationId || `risk-${Date.now()}`;
  const log = childLogger || logger.child(correlationId);
  
  // Validate event input
  const eventValidation = securityValidator.validateLambdaEvent(event, 'risk-scoring');
  if (!eventValidation.isValid) {
    log.error('Invalid event received', null, {
      errors: eventValidation.errors,
      securityIssues: eventValidation.securityIssues
    });
    throw new Error(`Invalid event: ${eventValidation.errors.join(', ')}`);
  }
  
  log.info('Risk scoring started', { 
    event: event.source || 'manual',
    correlationId 
  });

  const securityService = new SecurityAnalysisService();
  const neptuneService = new NeptuneService();
  
  const results = {
    processed: 0,
    updated: 0,
    errors: 0,
    riskScores: [],
    executionTime: 0
  };

  const startTime = Date.now();

  try {
    // Determine which findings to process
    let findingsToProcess = [];

    if (event.findingId) {
      // Process specific finding
      const finding = await neptuneService.getFinding(event.findingId);
      if (finding) {
        findingsToProcess = [finding];
      }
    } else if (event.accountId) {
      // Process all findings for specific account
      findingsToProcess = await neptuneService.queryFindings({
        accountId: event.accountId,
        status: 'open'
      });
    } else {
      // Process all open findings (batch mode)
      findingsToProcess = await neptuneService.queryFindings({
        status: 'open'
      });
      
      // Limit batch processing to prevent timeouts
      const maxBatchSize = event.maxBatchSize || 100;
      findingsToProcess = findingsToProcess.slice(0, maxBatchSize);
    }

    logger.info('Processing findings for risk scoring', { 
      count: findingsToProcess.length 
    });

    // Process findings in parallel batches
    const batchSize = event.batchSize || 10; // Configurable batch size
    const maxConcurrency = event.maxConcurrency || 5; // Limit concurrent operations
    
    logger.info('Processing findings in parallel', { 
      batchSize,
      maxConcurrency,
      totalFindings: findingsToProcess.length
    });

    await processFindingsInBatches(
      findingsToProcess, 
      batchSize, 
      maxConcurrency,
      securityService, 
      neptuneService, 
      results, 
      logger
    );

    results.executionTime = Date.now() - startTime;
    logger.info('Risk scoring completed', results);

    // Trigger downstream processes if needed
    if (results.updated > 0 && event.triggerRemediation) {
      await triggerRemediationGeneration(findingsToProcess, logger);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Risk scoring completed successfully',
        correlationId,
        results
      })
    };

  } catch (error) {
    results.executionTime = Date.now() - startTime;
    logger.error('Risk scoring failed', { 
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
      });
    };
  }
};

/**
 * Process findings in parallel batches with concurrency control
 */
async function processFindingsInBatches(
  findings, 
  batchSize, 
  maxConcurrency, 
  securityService, 
  neptuneService, 
  results, 
  logger
) {
  // Split findings into batches
  const batches = [];
  for (let i = 0; i < findings.length; i += batchSize) {
    batches.push(findings.slice(i, i + batchSize));
  }

  logger.info(`Processing ${batches.length} batches`, { 
    totalFindings: findings.length,
    batchSize 
  });

  // Process batches with controlled concurrency
  let activeBatches = [];
  let batchIndex = 0;

  while (batchIndex < batches.length || activeBatches.length > 0) {
    // Start new batches up to concurrency limit
    while (activeBatches.length < maxConcurrency && batchIndex < batches.length) {
      const batch = batches[batchIndex];
      const batchPromise = processBatch(
        batch, 
        batchIndex,
        securityService, 
        neptuneService, 
        results, 
        logger
      );
      
      activeBatches.push(batchPromise);
      batchIndex++;
    }

    // Wait for at least one batch to complete
    if (activeBatches.length > 0) {
      try {
        await Promise.race(activeBatches);
      } catch (error) {
        logger.error('Batch processing error', { error: error.message });
      }

      // Remove completed batches
      const stillActive = [];
      for (const batchPromise of activeBatches) {
        const completed = await Promise.allSettled([batchPromise]);
        if (completed[0].status === 'pending') {
          stillActive.push(batchPromise);
        }
      }
      activeBatches = stillActive;
    }
  }

  logger.info('All batches completed');
}

/**
 * Process a single batch of findings
 */
async function processBatch(batch, batchIndex, securityService, neptuneService, results, logger) {
  const batchStartTime = Date.now();
  const batchResults = { processed: 0, errors: 0 };

  logger.debug(`Starting batch ${batchIndex}`, { findingsCount: batch.length });

  // Process findings in this batch in parallel
  const batchPromises = batch.map(finding => 
    processFindingRiskScore(finding, securityService, neptuneService, batchResults, logger)
      .catch(error => {
        logger.error('Finding processing error in batch', {
          findingId: finding.id,
          batchIndex,
          error: error.message
        });
        batchResults.errors++;
      })
  );

  await Promise.allSettled(batchPromises);

  // Update overall results
  results.processed += batchResults.processed;
  results.errors += batchResults.errors;

  const batchTime = Date.now() - batchStartTime;
  logger.debug(`Completed batch ${batchIndex}`, {
    processed: batchResults.processed,
    errors: batchResults.errors,
    executionTime: batchTime
  });
}

/**
 * Process risk score for individual finding
 */
async function processFindingRiskScore(finding, securityService, neptuneService, results, logger) {
  const startTime = Date.now();
  
  try {
    // Get associated asset
    const asset = await neptuneService.getAsset(finding.resource.arn);
    if (!asset) {
      logger.warn('Asset not found for finding', { 
        findingId: finding.id,
        resourceArn: finding.resource.arn 
      });
      return;
    }

    // Calculate new risk score
    const riskAnalysis = await securityService.calculateRiskScore(finding, asset);
    const oldRiskScore = finding.riskScore || 0;
    const newRiskScore = riskAnalysis.total;

    // Check if score changed significantly (>0.5 points)
    const scoreChange = Math.abs(newRiskScore - oldRiskScore);
    if (scoreChange < 0.5 && !finding.lastRiskCalculation) {
      results.processed++;
      return; // Skip if no significant change
    }

    // Update finding with new risk score
    finding.riskScore = newRiskScore;
    finding.blastRadius = riskAnalysis.blastRadius;
    finding.lastRiskCalculation = new Date();
    finding.riskBreakdown = riskAnalysis.breakdown;

    // Store updated finding in Neptune
    await neptuneService.updateFinding(finding);

    // Log risk score details
    const processingTime = Date.now() - startTime;
    logger.debug('Updated finding risk score', {
      findingId: finding.id,
      oldScore: oldRiskScore,
      newScore: newRiskScore,
      change: scoreChange,
      blastRadius: riskAnalysis.blastRadius,
      processingTimeMs: processingTime
    });

    results.riskScores.push({
      findingId: finding.id,
      severity: finding.severity,
      oldScore: oldRiskScore,
      newScore: newRiskScore,
      change: scoreChange,
      blastRadius: riskAnalysis.blastRadius,
      breakdown: riskAnalysis.breakdown
    });

    results.processed++;
    results.updated++;

  } catch (error) {
    logger.error('Error processing finding risk score', {
      findingId: finding.id,
      error: error.message
    });
    throw error;
  }
}

/**
 * Trigger remediation generation for high-risk findings
 */
async function triggerRemediationGeneration(findings, logger) {
  try {
    const AWS = require('aws-sdk');
    const lambda = new AWS.Lambda();

    // Find high-risk findings that need remediation
    const highRiskFindings = findings.filter(f => 
      f.riskScore >= 7.0 && 
      f.severity !== 'info' &&
      f.status === 'open'
    );

    if (highRiskFindings.length === 0) {
      return;
    }

    logger.info('Triggering remediation generation', { 
      count: highRiskFindings.length 
    });

    // Invoke remediation generator Lambda
    const payload = {
      source: 'risk-scoring',
      findings: highRiskFindings.map(f => ({
        id: f.id,
        riskScore: f.riskScore,
        severity: f.severity,
        category: f.category,
        resource: f.resource
      })),
      priority: 'high'
    };

    await lambda.invoke({
      FunctionName: process.env.REMEDIATION_GENERATOR_FUNCTION || 'remediationGenerator',
      InvocationType: 'Event', // Async invocation
      Payload: JSON.stringify(payload)
    }).promise();

  } catch (error) {
    logger.error('Failed to trigger remediation generation', { 
      error: error.message 
    });
    // Don't fail the main process
  }
}

/**
 * Calculate CVSS score from finding data
 */
function calculateCVSSScore(finding, asset) {
  // Base CVSS metrics
  let baseScore = 0;
  
  // Attack Vector (Network = 0.85, Adjacent = 0.62, Local = 0.55, Physical = 0.2)
  const attackVector = asset.isPubliclyAccessible() ? 0.85 : 0.55;
  
  // Attack Complexity (Low = 0.77, High = 0.44)
  const attackComplexity = finding.category === 'configuration' ? 0.77 : 0.44;
  
  // Privileges Required (None = 0.85, Low = 0.62, High = 0.27)
  const privilegesRequired = finding.category === 'iam' ? 0.27 : 0.62;
  
  // Impact metrics based on severity
  let impact = 0;
  switch (finding.severity) {
    case 'critical': impact = 0.9; break;
    case 'high': impact = 0.7; break;
    case 'medium': impact = 0.5; break;
    case 'low': impact = 0.3; break;
    default: impact = 0.1;
  }
  
  // Calculate base score
  const exploitability = 8.22 * attackVector * attackComplexity * privilegesRequired;
  const impactSubScore = 1 - ((1 - impact) * (1 - impact) * (1 - impact));
  
  if (impactSubScore <= 0) {
    baseScore = 0;
  } else {
    baseScore = Math.min(10, (exploitability + impactSubScore));
  }
  
  return Math.round(baseScore * 10) / 10;
}
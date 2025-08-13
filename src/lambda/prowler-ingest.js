/**
 * Prowler Ingest Lambda
 * Processes security findings from Prowler scanner uploaded to S3
 */

// Mock AWS SDK for test environment
const AWS = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID 
  ? {
      S3: class MockS3 {
        getObject(params) {
          return {
            promise: () => Promise.resolve({ Body: JSON.stringify({ findings: [] }) })
          };
        }
      },
      SQS: class MockSQS {
        sendMessage(params) {
          return {
            promise: () => Promise.resolve({ MessageId: 'mock-message-id' })
          };
        }
      }
    }
  : require('aws-sdk');

const SecurityAnalysisService = require('../services/SecurityAnalysisService');
const NeptuneService = require('../services/NeptuneService');
const { StructuredLogger } = require('../monitoring/logger');
const { ErrorHandler } = require('../utils/errorHandler');
const { CircuitBreaker } = require('../resilience/CircuitBreaker');

const s3 = new AWS.S3();
const sqs = new AWS.SQS();
const logger = new StructuredLogger('prowler-ingest');
const errorHandler = new ErrorHandler('prowler-ingest');

// Circuit breakers for external services
const neptuneCircuitBreaker = new CircuitBreaker({
  serviceName: 'neptune',
  failureThreshold: 5,
  resetTimeout: 30000
});

const s3CircuitBreaker = new CircuitBreaker({
  serviceName: 's3',
  failureThreshold: 3,
  resetTimeout: 15000
});

// Configuration constants
const MAX_RETRIES = 3;
const BASE_DELAY = 1000;
const DLQ_URL = process.env.DLQ_URL;

exports.handler = errorHandler.createLambdaMiddleware()(async (event, context, childLogger) => {
  const correlationId = childLogger?.correlationId || 
                       event.Records?.[0]?.responseElements?.['x-amz-request-id'] || 
                       `prowler-${Date.now()}`;
  
  const log = childLogger || logger.child(correlationId);
  
  log.info('Prowler ingest started', { 
    recordCount: event.Records?.length || 0,
    correlationId 
  });

  const securityService = new SecurityAnalysisService();
  const results = {
    processed: 0,
    errors: 0,
    findings: [],
    skipped: 0
  };

  // Process each S3 event record with enhanced error handling
  const processAllRecords = async () => {
    for (const record of event.Records || []) {
      await errorHandler.executeWithRetry(
        () => processS3RecordWithRetry(record, securityService, results, log),
        {
          operationName: 'process_s3_record',
          correlationId,
          bucket: record.s3?.bucket?.name,
          key: record.s3?.object?.key
        }
      );
    }
  };

  await processAllRecords();

  log.info('Prowler ingest completed', results);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-Correlation-ID': correlationId
    },
    body: JSON.stringify({
      message: 'Prowler findings processed successfully',
      correlationId,
      results,
      timestamp: new Date().toISOString()
    })
  };
});

/**
 * Process S3 record with retry logic and DLQ support
 */
async function processS3RecordWithRetry(record, securityService, results, logger) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await processS3Record(record, securityService, results, logger);
      return; // Success, exit retry loop
    } catch (error) {
      logger.error(`S3 record processing failed (attempt ${attempt}/${MAX_RETRIES})`, { 
        error: error.message,
        bucket: record.s3?.bucket?.name,
        key: record.s3?.object?.key,
        attempt
      });

      if (attempt === MAX_RETRIES) {
        // Final attempt failed, send to DLQ if configured
        if (DLQ_URL) {
          await sendToDLQ(record, error.message);
        }
        results.errors++;
        return;
      }

      // Exponential backoff delay
      const delay = BASE_DELAY * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Send failed record to Dead Letter Queue
 */
async function sendToDLQ(record, errorMessage) {
  try {
    await sqs.sendMessage({
      QueueUrl: DLQ_URL,
      MessageBody: JSON.stringify({
        originalRecord: record,
        error: errorMessage,
        failedAt: new Date().toISOString(),
        source: 'prowler-ingest'
      }),
      MessageAttributes: {
        'ErrorType': {
          DataType: 'String',
          StringValue: 'ProcessingFailure'
        },
        'Source': {
          DataType: 'String',
          StringValue: 'prowler-ingest'
        }
      }
    }).promise();
    
    logger.info('Failed record sent to DLQ', {
      bucket: record.s3?.bucket?.name,
      key: record.s3?.object?.key
    });
  } catch (dlqError) {
    logger.error('Failed to send record to DLQ', { 
      error: dlqError.message 
    });
  }
}

/**
 * Process individual S3 record containing Prowler findings
 */
async function processS3Record(record, securityService, results, logger) {
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
  
  logger.info('Processing S3 object', { bucket, key });

  // Validate file is JSON
  if (!key.endsWith('.json')) {
    logger.warn('Skipping non-JSON file', { key });
    results.skipped++;
    return;
  }

  // Get object from S3 with circuit breaker
  const s3Object = await s3CircuitBreaker.execute(async () => {
    return await s3.getObject({ Bucket: bucket, Key: key }).promise();
  });
  const content = s3Object.Body.toString('utf-8');

  let prowlerData;
  try {
    prowlerData = JSON.parse(content);
  } catch (parseError) {
    logger.error('Failed to parse JSON', { error: parseError.message, key });
    results.errors++;
    return;
  }

  // Validate Prowler data structure
  if (!validateProwlerData(prowlerData)) {
    logger.error('Invalid Prowler data structure', { key });
    results.errors++;
    return;
  }

  // Initialize Neptune service for duplicate detection
  const neptuneService = new NeptuneService();
  
  // Process each finding in the Prowler report
  const findings = Array.isArray(prowlerData) ? prowlerData : [prowlerData];
  
  for (const rawFinding of findings) {
    try {
      // Skip findings that passed (no action needed)
      if (rawFinding.Status === 'PASS') {
        results.skipped++;
        continue;
      }

      // Check for duplicate findings with circuit breaker
      const findingId = generateFindingId(rawFinding);
      const existingFinding = await neptuneCircuitBreaker.execute(async () => {
        return await neptuneService.getFinding(findingId);
      });
      
      if (existingFinding) {
        // Update existing finding's lastSeen timestamp
        existingFinding.lastSeen = new Date().toISOString();
        await neptuneCircuitBreaker.execute(async () => {
          return await neptuneService.updateFinding(existingFinding);
        });
        
        logger.debug('Updated existing finding', {
          findingId: existingFinding.id,
          resource: existingFinding.resource.arn
        });
        
        results.skipped++;
        continue;
      }

      // Process new finding
      const finding = await securityService.processFinding(rawFinding, 'prowler');
      results.findings.push({
        id: finding.id,
        severity: finding.severity,
        riskScore: finding.riskScore,
        resource: finding.resource.arn
      });
      
      results.processed++;
      
      logger.debug('Processed new finding', {
        findingId: finding.id,
        severity: finding.severity,
        riskScore: finding.riskScore,
        resource: finding.resource.arn
      });

    } catch (findingError) {
      logger.error('Failed to process finding', {
        error: findingError.message,
        finding: rawFinding.CheckID || 'unknown'
      });
      results.errors++;
    }
  }

  // Add metadata to S3 object
  await tagS3Object(bucket, key, {
    'processed-at': new Date().toISOString(),
    'findings-count': findings.length.toString(),
    'processed-count': results.processed.toString(),
    'status': 'processed'
  });

  logger.info('S3 object processed', { 
    bucket, 
    key, 
    findingsCount: findings.length,
    processedCount: results.processed 
  });
}

/**
 * Validate Prowler data structure
 */
function validateProwlerData(data) {
  if (!data) return false;
  
  const findings = Array.isArray(data) ? data : [data];
  
  // Check if all findings have required fields
  return findings.every(finding => 
    finding.CheckID &&
    finding.CheckTitle &&
    finding.Status &&
    finding.Severity &&
    (finding.ResourceId || finding.ResourceArn)
  );
}

/**
 * Generate consistent finding ID for duplicate detection
 */
function generateFindingId(rawFinding) {
  const crypto = require('crypto');
  
  // Create unique identifier based on check and resource
  const identifier = [
    rawFinding.CheckID,
    rawFinding.ResourceId || rawFinding.ResourceArn,
    rawFinding.AccountId,
    rawFinding.Region
  ].filter(Boolean).join(':');
  
  return crypto.createHash('sha256').update(identifier).digest('hex').substring(0, 16);
}

/**
 * Add tags to S3 object for tracking
 */
async function tagS3Object(bucket, key, tags) {
  try {
    const tagSet = Object.entries(tags).map(([Key, Value]) => ({ Key, Value }));
    
    await s3.putObjectTagging({
      Bucket: bucket,
      Key: key,
      Tagging: { TagSet: tagSet }
    }).promise();
    
  } catch (error) {
    // Log but don't fail the main process
    console.warn('Failed to tag S3 object:', error.message);
  }
}
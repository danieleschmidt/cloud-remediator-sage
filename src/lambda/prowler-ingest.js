/**
 * Prowler Ingest Lambda
 * Processes security findings from Prowler scanner uploaded to S3
 */

const AWS = require('aws-sdk');
const SecurityAnalysisService = require('../services/SecurityAnalysisService');
const { StructuredLogger } = require('../monitoring/logger');

const s3 = new AWS.S3();
const logger = new StructuredLogger('prowler-ingest');

exports.handler = async (event) => {
  const correlationId = event.Records?.[0]?.responseElements?.['x-amz-request-id'] || 
                       `prowler-${Date.now()}`;
  
  logger.setCorrelationId(correlationId);
  logger.info('Prowler ingest started', { 
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

  try {
    // Process each S3 event record
    for (const record of event.Records || []) {
      try {
        await processS3Record(record, securityService, results, logger);
      } catch (error) {
        logger.error('Failed to process S3 record', { 
          error: error.message,
          bucket: record.s3?.bucket?.name,
          key: record.s3?.object?.key 
        });
        results.errors++;
      }
    }

    logger.info('Prowler ingest completed', results);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Prowler findings processed successfully',
        correlationId,
        results
      })
    };

  } catch (error) {
    logger.error('Prowler ingest failed', { error: error.message });
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        correlationId,
        message: error.message
      })
    };
  }
};

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

  // Get object from S3
  const s3Object = await s3.getObject({ Bucket: bucket, Key: key }).promise();
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

  // Process each finding in the Prowler report
  const findings = Array.isArray(prowlerData) ? prowlerData : [prowlerData];
  
  for (const rawFinding of findings) {
    try {
      // Skip findings that passed (no action needed)
      if (rawFinding.Status === 'PASS') {
        results.skipped++;
        continue;
      }

      // Process the finding
      const finding = await securityService.processFinding(rawFinding, 'prowler');
      results.findings.push({
        id: finding.id,
        severity: finding.severity,
        riskScore: finding.riskScore,
        resource: finding.resource.arn
      });
      
      results.processed++;
      
      logger.debug('Processed finding', {
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
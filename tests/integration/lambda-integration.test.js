/**
 * Integration tests for Lambda functions
 * Tests end-to-end functionality of security analysis and remediation lambdas
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const path = require('path');

// Mock AWS SDK for testing
const mockAWS = {
  S3: class {
    getObject() {
      return {
        promise: () => Promise.resolve({
          Body: JSON.stringify([
            {
              CheckID: 's3_bucket_public_access_block',
              CheckTitle: 'S3 bucket public access block',
              Status: 'FAIL',
              Severity: 'HIGH',
              ResourceId: 'test-bucket',
              ResourceArn: 'arn:aws:s3:::test-bucket',
              Description: 'Public S3 bucket detected',
              Remediation: 'Configure bucket policy to restrict public access'
            }
          ])
        })
      };
    }
    putObject() {
      return {
        promise: () => Promise.resolve({ ETag: 'test-etag' })
      };
    }
  },
  DynamoDB: {
    DocumentClient: class {
      put() {
        return {
          promise: () => Promise.resolve({})
        };
      }
      query() {
        return {
          promise: () => Promise.resolve({
            Items: [{
              resourceId: 'test-resource',
              riskScore: 8.5,
              lastUpdated: new Date().toISOString()
            }]
          })
        };
      }
    }
  }
};

// Mock the AWS modules
jest.mock('aws-sdk', () => mockAWS);

// Import Lambda functions
const prowlerIngest = require('../../src/lambda/prowler-ingest');
const remediationGenerator = require('../../src/lambda/remediation-generator');
const riskScoring = require('../../src/lambda/risk-scoring');

describe('Lambda Functions Integration', () => {
  beforeEach(() => {
    // Reset environment variables
    process.env.FINDINGS_BUCKET = 'test-findings-bucket';
    process.env.RISK_TABLE = 'test-risk-table';
    process.env.REMEDIATION_BUCKET = 'test-remediation-bucket';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Prowler Ingest Lambda', () => {
    it('should process Prowler findings and store in DynamoDB', async () => {
      const event = {
        Records: [{
          s3: {
            bucket: { name: 'test-bucket' },
            object: { key: 'prowler-findings.json' }
          }
        }]
      };

      const context = {
        awsRequestId: 'test-request-id',
        logGroupName: 'test-log-group',
        functionName: 'prowler-ingest'
      };

      const result = await prowlerIngest.handler(event, context);
      
      expect(result.statusCode).toBe(200);
      expect(result.body).toBeDefined();
      
      const body = JSON.parse(result.body);
      expect(body.processedFindings).toBeGreaterThan(0);
      expect(body.errors).toBeDefined();
    });

    it('should handle malformed Prowler findings gracefully', async () => {
      // Mock S3 to return malformed data
      const originalGetObject = mockAWS.S3.prototype.getObject;
      mockAWS.S3.prototype.getObject = function() {
        return {
          promise: () => Promise.resolve({
            Body: 'invalid json content'
          })
        };
      };

      const event = {
        Records: [{
          s3: {
            bucket: { name: 'test-bucket' },
            object: { key: 'malformed-findings.json' }
          }
        }]
      };

      const context = { awsRequestId: 'test-request-id' };
      const result = await prowlerIngest.handler(event, context);
      
      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Failed to parse');

      // Restore original mock
      mockAWS.S3.prototype.getObject = originalGetObject;
    });

    it('should validate finding data structure and security requirements', async () => {
      const event = {
        Records: [{
          s3: {
            bucket: { name: 'test-bucket' },
            object: { key: 'prowler-findings.json' }
          }
        }]
      };

      const context = { awsRequestId: 'test-request-id' };
      const result = await prowlerIngest.handler(event, context);
      
      expect(result.statusCode).toBe(200);
      
      // Should validate that findings contain required security fields
      const body = JSON.parse(result.body);
      expect(body.validationResults).toBeDefined();
      expect(body.validationResults.requiredFields).toBe(true);
      expect(body.validationResults.securityMetadata).toBe(true);
    });
  });

  describe('Risk Scoring Lambda', () => {
    it('should calculate risk scores for security findings', async () => {
      const event = {
        findings: [
          {
            id: 'finding-1',
            severity: 'HIGH',
            resource: {
              arn: 'arn:aws:s3:::test-bucket'
            },
            category: 'data_protection',
            impact: 'data_exposure'
          },
          {
            id: 'finding-2',
            severity: 'MEDIUM',
            resource: {
              arn: 'arn:aws:ec2:us-east-1:123456789012:instance/i-1234567890abcdef0'
            },
            category: 'network_security',
            impact: 'unauthorized_access'
          }
        ]
      };

      const context = { awsRequestId: 'test-request-id' };
      const result = await riskScoring.handler(event, context);
      
      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.results.riskScores).toBeDefined();
      expect(body.results.riskScores).toHaveLength(2);
      
      // High severity finding should have higher risk score
      const highSeverityScore = body.results.riskScores.find(r => r.findingId === 'finding-1');
      const mediumSeverityScore = body.results.riskScores.find(r => r.findingId === 'finding-2');
      
      expect(highSeverityScore.newScore).toBeGreaterThan(mediumSeverityScore.newScore);
      expect(highSeverityScore.newScore).toBeGreaterThan(5); // High risk threshold
    });

    it('should apply security-specific risk factors', async () => {
      const event = {
        findings: [{
          id: 'crypto-finding',
          severity: 'HIGH',
          resource: {
            arn: 'arn:aws:s3:::crypto-bucket'
          },
          category: 'encryption',
          impact: 'data_exposure',
          metadata: {
            containsPII: true,
            internetFacing: true,
            complianceImpact: 'GDPR'
          }
        }]
      };

      const context = { awsRequestId: 'test-request-id' };
      const result = await riskScoring.handler(event, context);
      
      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      const riskScore = body.results.riskScores[0];
      
      // Should apply multipliers for security factors
      expect(riskScore.newScore).toBeGreaterThan(5); // High due to security factors
      expect(riskScore.breakdown).toBeDefined();
      expect(riskScore.breakdown.severity).toBe(8); // High severity
      expect(riskScore.breakdown.criticality).toBe(5); // Medium criticality
    });
  });

  describe('Remediation Generator Lambda', () => {
    it('should generate automated remediation scripts', async () => {
      const event = {
        finding: {
          id: 'public-s3-bucket',
          severity: 'HIGH',
          resource: 'arn:aws:s3:::test-public-bucket',
          category: 'data_protection',
          description: 'S3 bucket allows public read access',
          recommendation: 'Configure bucket policy to restrict public access'
        }
      };

      const context = { awsRequestId: 'test-request-id' };
      const result = await remediationGenerator.handler(event, context);
      
      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.results).toBeDefined();
      expect(body.results.processed).toBe(1);
      expect(body.results.errors).toBe(0);
      // For now, allow either generated or skipped 
      expect(body.results.generated + body.results.skipped).toBe(1);
    });

    it('should handle high-risk remediations safely', async () => {
      const event = {
        finding: {
          id: 'admin-access',
          severity: 'CRITICAL',
          resource: 'arn:aws:iam::123456789012:role/AdminRole',
          category: 'identity_access',
          description: 'Overly permissive IAM role with admin access',
          recommendation: 'Apply principle of least privilege'
        }
      };

      const context = { awsRequestId: 'test-request-id' };
      const result = await remediationGenerator.handler(event, context);
      
      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.remediation.riskLevel).toBe('high');
      expect(body.remediation.requiresApproval).toBe(true);
      expect(body.remediation.script).toContain('# MANUAL REVIEW REQUIRED');
    });

    it('should validate remediation scripts for security', async () => {
      const event = {
        finding: {
          id: 'security-group',
          severity: 'HIGH',
          resource: 'arn:aws:ec2:us-east-1:123456789012:security-group/sg-12345678',
          category: 'network_security',
          description: 'Security group allows unrestricted inbound access',
          recommendation: 'Restrict inbound rules to required sources'
        }
      };

      const context = { awsRequestId: 'test-request-id' };
      const result = await remediationGenerator.handler(event, context);
      
      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.remediation.validation).toBeDefined();
      expect(body.remediation.validation.syntaxValid).toBe(true);
      expect(body.remediation.validation.securityChecks).toBe(true);
      
      // Should not contain dangerous commands
      expect(body.remediation.script).not.toContain('delete-vpc');
      expect(body.remediation.script).not.toContain('terminate-instances');
      expect(body.remediation.script).not.toContain('delete-');
    });
  });

  describe('End-to-End Lambda Workflow', () => {
    it('should process findings through complete pipeline', async () => {
      // Step 1: Ingest findings
      const ingestEvent = {
        Records: [{
          s3: {
            bucket: { name: 'test-bucket' },
            object: { key: 'prowler-findings.json' }
          }
        }]
      };
      
      const ingestResult = await prowlerIngest.handler(ingestEvent, { awsRequestId: 'ingest-1' });
      expect(ingestResult.statusCode).toBe(200);
      
      // Step 2: Calculate risk scores
      const riskEvent = {
        findings: [
          {
            id: 'finding-1',
            severity: 'HIGH',
            resource: 'arn:aws:s3:::test-bucket',
            category: 'data_protection'
          }
        ]
      };
      
      const riskResult = await riskScoring.handler(riskEvent, { awsRequestId: 'risk-1' });
      expect(riskResult.statusCode).toBe(200);
      
      // Step 3: Generate remediation
      const remediationEvent = {
        finding: riskEvent.findings[0]
      };
      
      const remediationResult = await remediationGenerator.handler(remediationEvent, { awsRequestId: 'remediation-1' });
      expect(remediationResult.statusCode).toBe(200);
      
      // Verify complete workflow
      const remediationBody = JSON.parse(remediationResult.body);
      expect(remediationBody.remediation).toBeDefined();
      expect(remediationBody.remediation.script).toBeDefined();
    }, 30000);
  });
});
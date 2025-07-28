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
          Body: JSON.stringify({
            findings: [
              {
                id: 'test-finding-1',
                severity: 'HIGH',
                resource: 'arn:aws:s3:::test-bucket',
                description: 'Public S3 bucket detected',
                recommendation: 'Configure bucket policy to restrict public access'
              }
            ]
          })
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
            resource: 'arn:aws:s3:::test-bucket',
            category: 'data_protection',
            impact: 'data_exposure'
          },
          {
            id: 'finding-2',
            severity: 'MEDIUM',
            resource: 'arn:aws:ec2:us-east-1:123456789012:instance/i-1234567890abcdef0',
            category: 'network_security',
            impact: 'unauthorized_access'
          }
        ]
      };

      const context = { awsRequestId: 'test-request-id' };
      const result = await riskScoring.handler(event, context);
      
      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.riskScores).toBeDefined();
      expect(body.riskScores).toHaveLength(2);
      
      // High severity finding should have higher risk score
      const highSeverityScore = body.riskScores.find(r => r.findingId === 'finding-1');
      const mediumSeverityScore = body.riskScores.find(r => r.findingId === 'finding-2');
      
      expect(highSeverityScore.riskScore).toBeGreaterThan(mediumSeverityScore.riskScore);
      expect(highSeverityScore.riskScore).toBeGreaterThan(7); // High risk threshold
    });

    it('should apply security-specific risk factors', async () => {
      const event = {
        findings: [{
          id: 'crypto-finding',
          severity: 'HIGH',
          resource: 'arn:aws:s3:::crypto-bucket',
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
      const riskScore = body.riskScores[0];
      
      // Should apply multipliers for security factors
      expect(riskScore.riskScore).toBeGreaterThan(8); // Very high due to PII + internet-facing
      expect(riskScore.factors).toBeDefined();
      expect(riskScore.factors.piiMultiplier).toBe(1.5);
      expect(riskScore.factors.internetFacingMultiplier).toBe(1.3);
      expect(riskScore.factors.complianceMultiplier).toBe(1.2);
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
      expect(body.remediation).toBeDefined();
      expect(body.remediation.script).toBeDefined();
      expect(body.remediation.type).toBe('aws-cli');
      expect(body.remediation.riskLevel).toBe('low'); // Safe automation
      
      // Should contain actual AWS CLI commands
      expect(body.remediation.script).toContain('aws s3api');
      expect(body.remediation.script).toContain('put-bucket-policy');
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
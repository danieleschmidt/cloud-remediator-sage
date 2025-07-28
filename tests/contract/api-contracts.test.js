/**
 * Contract tests for API interactions
 * Validates API contracts and integration points for security services
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const { TestDataFactory } = require('../fixtures/test-data');

// Contract testing framework setup
const { Pact, Matchers } = require('@pact-foundation/pact');
const { like, eachLike, term } = Matchers;

describe('Security API Contract Tests', () => {
  let provider;
  
  beforeEach(() => {
    provider = new Pact({
      consumer: 'cloud-remediator-sage',
      provider: 'security-analysis-api',
      port: 1234,
      log: 'tests/contract/logs/pact.log',
      dir: 'tests/contract/pacts',
      logLevel: 'INFO'
    });
    
    return provider.setup();
  });
  
  afterEach(() => provider.finalize());

  describe('Security Findings API', () => {
    it('should return security findings with correct structure', async () => {
      // Define the expected contract
      const expectedResponse = {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          findings: eachLike({
            id: like('finding-123'),
            severity: term({
              matcher: 'CRITICAL|HIGH|MEDIUM|LOW',
              generate: 'HIGH'
            }),
            resource: like('arn:aws:s3:::test-bucket'),
            category: like('data_protection'),
            title: like('Security vulnerability detected'),
            description: like('Detailed description of the security issue'),
            recommendation: like('Steps to remediate the vulnerability'),
            timestamp: term({
              matcher: '\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{3})?Z',
              generate: '2025-07-27T10:30:00.000Z'
            }),
            metadata: like({
              businessCriticality: term({
                matcher: 'low|medium|high|critical',
                generate: 'high'
              }),
              complianceFrameworks: eachLike('SOC2')
            })
          }),
          summary: {
            total: like(5),
            bySeverity: {
              CRITICAL: like(1),
              HIGH: like(2),
              MEDIUM: like(1),
              LOW: like(1)
            }
          }
        }
      };
      
      await provider
        .given('security findings exist')
        .uponReceiving('a request for security findings')
        .withRequest({
          method: 'GET',
          path: '/api/security/findings',
          headers: {
            'Accept': 'application/json',
            'Authorization': like('Bearer token-123')
          }
        })
        .willRespondWith(expectedResponse);
      
      // Execute the contract test
      await provider.verify();
    });
    
    it('should accept security finding submission with validation', async () => {
      const findingSubmission = {
        finding: {
          severity: 'HIGH',
          resource: 'arn:aws:s3:::test-bucket',
          category: 'data_protection',
          title: 'Public S3 bucket detected',
          description: 'S3 bucket allows public read access'
        }
      };
      
      await provider
        .given('security analysis service is available')
        .uponReceiving('a security finding submission')
        .withRequest({
          method: 'POST',
          path: '/api/security/findings',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': like('Bearer token-123')
          },
          body: findingSubmission
        })
        .willRespondWith({
          status: 201,
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            id: like('finding-456'),
            status: 'accepted',
            riskScore: like(7.5),
            processedAt: term({
              matcher: '\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{3})?Z',
              generate: '2025-07-27T10:30:00.000Z'
            })
          }
        });
      
      await provider.verify();
    });
  });

  describe('Risk Scoring API', () => {
    it('should calculate risk scores for security findings', async () => {
      const riskRequest = {
        findings: [{
          id: 'finding-123',
          severity: 'HIGH',
          category: 'data_protection',
          metadata: {
            containsPII: true,
            internetFacing: true
          }
        }]
      };
      
      await provider
        .given('risk scoring service is operational')
        .uponReceiving('a risk scoring request')
        .withRequest({
          method: 'POST',
          path: '/api/risk/calculate',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': like('Bearer token-123')
          },
          body: riskRequest
        })
        .willRespondWith({
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            riskScores: eachLike({
              findingId: like('finding-123'),
              riskScore: like(8.5),
              factors: {
                severityScore: like(7),
                piiMultiplier: like(1.5),
                internetFacingMultiplier: like(1.3),
                businessImpactScore: like(6)
              },
              riskLevel: term({
                matcher: 'low|medium|high|critical',
                generate: 'high'
              })
            }),
            summary: {
              averageRisk: like(8.5),
              highRiskCount: like(1),
              recommendedActions: eachLike('immediate_remediation')
            }
          }
        });
      
      await provider.verify();
    });
  });

  describe('Remediation API', () => {
    it('should generate remediation scripts for security findings', async () => {
      const remediationRequest = {
        finding: {
          id: 'finding-123',
          severity: 'HIGH',
          resource: 'arn:aws:s3:::public-bucket',
          category: 'data_protection',
          description: 'S3 bucket allows public access'
        }
      };
      
      await provider
        .given('remediation service is available')
        .uponReceiving('a remediation generation request')
        .withRequest({
          method: 'POST',
          path: '/api/remediation/generate',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': like('Bearer token-123')
          },
          body: remediationRequest
        })
        .willRespondWith({
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            remediation: {
              id: like('remediation-789'),
              script: like('aws s3api put-public-access-block --bucket public-bucket'),
              riskLevel: term({
                matcher: 'low|medium|high',
                generate: 'low'
              }),
              automated: like(true),
              requiresApproval: like(false),
              estimatedDuration: like(300), // seconds
              rollbackScript: like('aws s3api delete-public-access-block --bucket public-bucket'),
              validation: {
                syntaxValid: like(true),
                securityChecks: like(true),
                testResults: eachLike({
                  test: like('syntax_check'),
                  passed: like(true)
                })
              }
            },
            metadata: {
              generatedAt: term({
                matcher: '\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{3})?Z',
                generate: '2025-07-27T10:30:00.000Z'
              }),
              version: like('1.0.0'),
              framework: like('aws-cli')
            }
          }
        });
      
      await provider.verify();
    });
    
    it('should handle high-risk remediations with approval requirements', async () => {
      const highRiskRequest = {
        finding: {
          id: 'finding-critical',
          severity: 'CRITICAL',
          resource: 'arn:aws:iam::123456789012:role/AdminRole',
          category: 'identity_access',
          description: 'Overly permissive IAM role'
        }
      };
      
      await provider
        .given('high-risk remediation is requested')
        .uponReceiving('a high-risk remediation request')
        .withRequest({
          method: 'POST',
          path: '/api/remediation/generate',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': like('Bearer token-123')
          },
          body: highRiskRequest
        })
        .willRespondWith({
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            remediation: {
              id: like('remediation-critical-123'),
              script: like('# MANUAL REVIEW REQUIRED\n# aws iam detach-role-policy'),
              riskLevel: 'high',
              automated: false,
              requiresApproval: true,
              approvalWorkflow: {
                required: true,
                approvers: eachLike('security-team'),
                escalationPath: eachLike('ciso@company.com')
              }
            }
          }
        });
      
      await provider.verify();
    });
  });

  describe('Backlog Management API', () => {
    it('should create backlog items from security findings', async () => {
      const backlogRequest = {
        findings: [{
          id: 'finding-123',
          severity: 'HIGH',
          category: 'security',
          title: 'Fix S3 bucket permissions',
          businessValue: 8,
          urgency: 7,
          jobSize: 3
        }]
      };
      
      await provider
        .given('backlog management service is available')
        .uponReceiving('a backlog item creation request')
        .withRequest({
          method: 'POST',
          path: '/api/backlog/items',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': like('Bearer token-123')
          },
          body: backlogRequest
        })
        .willRespondWith({
          status: 201,
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            items: eachLike({
              id: like('backlog-item-456'),
              title: like('Fix S3 bucket permissions'),
              priority: term({
                matcher: 'low|medium|high|critical',
                generate: 'high'
              }),
              wsjfScore: like(18.7),
              category: 'security',
              status: 'pending',
              createdAt: term({
                matcher: '\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{3})?Z',
                generate: '2025-07-27T10:30:00.000Z'
              })
            }),
            summary: {
              created: like(1),
              totalScore: like(18.7)
            }
          }
        });
      
      await provider.verify();
    });
  });

  describe('Error Handling Contracts', () => {
    it('should handle authentication errors correctly', async () => {
      await provider
        .given('authentication token is invalid')
        .uponReceiving('a request with invalid token')
        .withRequest({
          method: 'GET',
          path: '/api/security/findings',
          headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer invalid-token'
          }
        })
        .willRespondWith({
          status: 401,
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            error: {
              code: 'UNAUTHORIZED',
              message: like('Invalid or expired authentication token'),
              timestamp: term({
                matcher: '\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{3})?Z',
                generate: '2025-07-27T10:30:00.000Z'
              })
            }
          }
        });
      
      await provider.verify();
    });
    
    it('should handle validation errors for malformed requests', async () => {
      const invalidRequest = {
        finding: {
          // Missing required fields
          description: 'Incomplete finding data'
        }
      };
      
      await provider
        .given('request validation is enabled')
        .uponReceiving('a malformed finding submission')
        .withRequest({
          method: 'POST',
          path: '/api/security/findings',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': like('Bearer token-123')
          },
          body: invalidRequest
        })
        .willRespondWith({
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            error: {
              code: 'VALIDATION_ERROR',
              message: like('Request validation failed'),
              details: eachLike({
                field: like('severity'),
                message: like('Field is required'),
                code: like('REQUIRED')
              })
            }
          }
        });
      
      await provider.verify();
    });
  });
});

// Provider state handlers for contract testing
const providerStates = {
  'security findings exist': async () => {
    // Setup test data for security findings
    console.log('Setting up security findings test data');
  },
  
  'security analysis service is available': async () => {
    // Ensure analysis service is ready
    console.log('Security analysis service ready');
  },
  
  'risk scoring service is operational': async () => {
    // Setup risk scoring service
    console.log('Risk scoring service operational');
  },
  
  'remediation service is available': async () => {
    // Setup remediation service
    console.log('Remediation service available');
  },
  
  'high-risk remediation is requested': async () => {
    // Setup high-risk scenario
    console.log('High-risk remediation scenario setup');
  },
  
  'backlog management service is available': async () => {
    // Setup backlog service
    console.log('Backlog management service ready');
  },
  
  'authentication token is invalid': async () => {
    // Setup invalid auth scenario
    console.log('Invalid authentication scenario setup');
  },
  
  'request validation is enabled': async () => {
    // Setup validation scenario
    console.log('Request validation enabled');
  }
};

module.exports = {
  providerStates
};
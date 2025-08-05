/**
 * Test suite for Security Validator
 * Comprehensive testing for security validation functionality
 */

const SecurityValidator = require('../../src/validation/SecurityValidator');

describe('SecurityValidator', () => {
  let validator;
  
  beforeEach(() => {
    validator = new SecurityValidator();
  });

  describe('Constructor', () => {
    test('should initialize with default settings', () => {
      expect(validator.validationCache).toBeInstanceOf(Map);
      expect(validator.schemaCache).toBeInstanceOf(Map);
      expect(validator.securityRules).toBeDefined();
      expect(validator.complianceFrameworks).toBeInstanceOf(Map);
    });

    test('should initialize security rules', () => {
      expect(validator.securityRules.trustedSources).toContain('prowler');
      expect(validator.securityRules.trustedSources).toContain('cloudsploit');
      expect(validator.securityRules.trustedSources).toContain('steampipe');
      expect(validator.securityRules.sensitivePatterns.length).toBeGreaterThan(0);
      expect(validator.securityRules.injectionPatterns.length).toBeGreaterThan(0);
    });

    test('should initialize compliance frameworks', () => {
      expect(validator.complianceFrameworks.has('pci-dss')).toBe(true);
      expect(validator.complianceFrameworks.has('hipaa')).toBe(true);
      expect(validator.complianceFrameworks.has('sox')).toBe(true);
      expect(validator.complianceFrameworks.has('nist')).toBe(true);
    });
  });

  describe('validateFinding', () => {
    const validFinding = {
      id: 'finding-123',
      source: 'prowler',
      severity: 'high',
      category: 'security',
      title: 'S3 bucket publicly accessible',
      description: 'The S3 bucket allows public read access',
      resource: {
        arn: 'arn:aws:s3:::test-bucket',
        type: 'AWS::S3::Bucket',
        region: 'us-east-1',
        accountId: '123456789012',
        name: 'test-bucket'
      },
      riskScore: 8.5,
      compliance: [
        {
          framework: 'pci-dss',
          requirement: '1.1',
          status: 'non-compliant'
        }
      ],
      createdAt: new Date()
    };

    test('should validate a valid finding', async () => {
      const result = await validator.validateFinding(validFinding);
      
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(result.score).toBeGreaterThan(80);
      expect(result.recommendations).toBeInstanceOf(Array);
    });

    test('should detect schema validation errors', async () => {
      const invalidFinding = {
        // Missing required fields
        id: 'finding-123',
        source: 'prowler'
        // Missing severity, category, title, description, resource
      };
      
      const result = await validator.validateFinding(invalidFinding);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('required'))).toBe(true);
    });

    test('should detect severity inconsistency', async () => {
      const inconsistentFinding = {
        ...validFinding,
        severity: 'low',
        riskScore: 9.5 // High risk score but low severity
      };
      
      const result = await validator.validateFinding(inconsistentFinding);
      
      expect(result.warnings.some(w => w.includes('inconsistent'))).toBe(true);
    });

    test('should validate ARN format', async () => {
      const invalidArnFinding = {
        ...validFinding,
        resource: {
          ...validFinding.resource,
          arn: 'invalid-arn-format'
        }
      };
      
      const result = await validator.validateFinding(invalidArnFinding);
      
      expect(result.errors.some(e => e.includes('Invalid ARN format'))).toBe(true);
    });

    test('should detect sensitive information', async () => {
      const sensitiveFindig = {
        ...validFinding,
        description: 'Database password: mypassword123 exposed'
      };
      
      const result = await validator.validateFinding(sensitiveFindig);
      
      expect(result.securityIssues.some(s => s.includes('sensitive information'))).toBe(true);
    });

    test('should validate compliance frameworks', async () => {
      const unknownFrameworkFinding = {
        ...validFinding,
        compliance: [
          {
            framework: 'unknown-framework',
            requirement: '1.1',
            status: 'non-compliant'
          }
        ]
      };
      
      const result = await validator.validateFinding(unknownFrameworkFinding);
      
      expect(result.warnings.some(w => w.includes('Unknown compliance framework'))).toBe(true);
    });

    test('should detect injection attempts', async () => {
      const injectionFinding = {
        ...validFinding,
        description: '<script>alert("xss")</script>'
      };
      
      const result = await validator.validateFinding(injectionFinding);
      
      expect(result.securityIssues.some(s => s.includes('injection attempts'))).toBe(true);
    });

    test('should validate untrusted sources', async () => {
      const untrustedFinding = {
        ...validFinding,
        source: 'untrusted-scanner'
      };
      
      const result = await validator.validateFinding(untrustedFinding);
      
      expect(result.securityIssues.some(s => s.includes('Untrusted finding source'))).toBe(true);
    });

    test('should use validation cache', async () => {
      const options = { useCache: true };
      
      // First validation
      const result1 = await validator.validateFinding(validFinding, options);
      
      // Second validation should use cache
      const result2 = await validator.validateFinding(validFinding, options);
      
      expect(result1).toEqual(result2);
      expect(validator.validationCache.size).toBe(1);
    });
  });

  describe('validateAsset', () => {
    const validAsset = {
      arn: 'arn:aws:s3:::test-bucket',
      type: 'AWS::S3::Bucket',
      accountId: '123456789012',
      region: 'us-east-1',
      criticality: 'high',
      tags: {
        Environment: 'production',
        DataClassification: 'sensitive'
      },
      securityGroups: [
        {
          id: 'sg-123456',
          rules: [
            {
              source: '10.0.0.0/16',
              ports: ['443']
            }
          ]
        }
      ]
    };

    test('should validate a valid asset', async () => {
      const result = await validator.validateAsset(validAsset);
      
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(result.score).toBeGreaterThan(80);
    });

    test('should detect public exposure with sensitive data', async () => {
      const exposedAsset = {
        ...validAsset,
        securityGroups: [
          {
            id: 'sg-123456',
            rules: [
              {
                source: '0.0.0.0/0',
                ports: ['*']
              }
            ]
          }
        ],
        tags: {
          DataClassification: 'pii'
        }
      };
      
      // Mock the asset methods
      exposedAsset.isPubliclyAccessible = () => true;
      exposedAsset.containsSensitiveData = () => true;
      
      const result = await validator.validateAsset(exposedAsset);
      
      expect(result.securityIssues.some(s => s.includes('publicly accessible'))).toBe(true);
    });

    test('should validate security group rules', async () => {
      const insecureAsset = {
        ...validAsset,
        securityGroups: [
          {
            id: 'sg-123456',
            rules: [
              {
                source: '0.0.0.0/0',
                ports: ['22'] // SSH from anywhere
              }
            ]
          }
        ]
      };
      
      const result = await validator.validateAsset(insecureAsset);
      
      expect(result.securityIssues.some(s => s.includes('SSH access from anywhere'))).toBe(true);
    });

    test('should detect RDP exposure', async () => {
      const rdpAsset = {
        ...validAsset,
        securityGroups: [
          {
            id: 'sg-123456',
            rules: [
              {
                source: '0.0.0.0/0',
                ports: ['3389'] // RDP from anywhere
              }
            ]
          }
        ]
      };
      
      const result = await validator.validateAsset(rdpAsset);
      
      expect(result.securityIssues.some(s => s.includes('RDP access from anywhere'))).toBe(true);
    });

    test('should check monitoring requirements', async () => {
      const unmonitoredAsset = {
        ...validAsset,
        criticality: 'critical',
        monitoringEnabled: false
      };
      
      const result = await validator.validateAsset(unmonitoredAsset);
      
      expect(result.configurationIssues.some(c => c.includes('monitoring enabled'))).toBe(true);
    });
  });

  describe('validateRemediation', () => {
    const validRemediation = {
      id: 'remediation-123',
      findingId: 'finding-123',
      assetArn: 'arn:aws:s3:::test-bucket',
      type: 'automated',
      templateType: 'terraform',
      category: 'security',
      title: 'Block public S3 access',
      description: 'Apply bucket policy to block public access',
      riskLevel: 'medium',
      automationLevel: 'semi-automated',
      approvalRequired: true,
      template: {
        resource: {
          aws_s3_bucket_public_access_block: {
            example: {
              bucket: '${aws_s3_bucket.example.id}',
              block_public_acls: true
            }
          }
        }
      },
      rollbackPlan: {
        steps: ['Remove public access block']
      }
    };

    test('should validate a valid remediation', async () => {
      const result = await validator.validateRemediation(validRemediation);
      
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(result.score).toBeGreaterThan(80);
    });

    test('should detect destructive operations without rollback', async () => {
      const destructiveRemediation = {
        ...validRemediation,
        template: {
          resource: {
            aws_s3_bucket: {
              example: {
                delete: true
              }
            }
          }
        },
        rollbackPlan: {}
      };
      
      const result = await validator.validateRemediation(destructiveRemediation);
      
      expect(result.safetyIssues.some(s => s.includes('rollback plan'))).toBe(true);
    });

    test('should validate high-risk automation', async () => {
      const highRiskRemediation = {
        ...validRemediation,
        automationLevel: 'automated',
        riskLevel: 'high'
      };
      
      const result = await validator.validateRemediation(highRiskRemediation);
      
      expect(result.safetyIssues.some(s => s.includes('should not be fully automated'))).toBe(true);
    });

    test('should validate production operations', async () => {
      const productionRemediation = {
        ...validRemediation,
        metadata: {
          environment: 'production'
        },
        estimatedDowntime: 30,
        maintenanceWindow: null
      };
      
      const result = await validator.validateRemediation(productionRemediation);
      
      expect(result.safetyIssues.some(s => s.includes('maintenance window'))).toBe(true);
    });

    test('should validate missing template', async () => {
      const noTemplateRemediation = {
        ...validRemediation,
        template: null
      };
      
      const result = await validator.validateRemediation(noTemplateRemediation);
      
      expect(result.errors.some(e => e.includes('template is missing'))).toBe(true);
    });
  });

  describe('Template Validation', () => {
    test('should validate Terraform template', () => {
      const result = { errors: [], warnings: [] };
      const template = {
        resource: {
          aws_s3_bucket: {
            example: {
              bucket: 'test-bucket'
            }
          }
        }
      };
      
      validator.validateTerraformTemplate(template, result);
      
      expect(result.errors.length).toBe(0);
    });

    test('should detect invalid Terraform template', () => {
      const result = { errors: [], warnings: [] };
      const template = 'invalid-template';
      
      validator.validateTerraformTemplate(template, result);
      
      expect(result.errors.some(e => e.includes('valid object'))).toBe(true);
    });

    test('should validate CloudFormation template', () => {
      const result = { errors: [], warnings: [] };
      const template = {
        Resources: {
          S3Bucket: {
            Type: 'AWS::S3::Bucket'
          }
        }
      };
      
      validator.validateCloudFormationTemplate(template, result);
      
      expect(result.errors.length).toBe(0);
    });

    test('should detect missing CloudFormation Resources', () => {
      const result = { errors: [], warnings: [] };
      const template = {
        AWSTemplateFormatVersion: '2010-09-09'
      };
      
      validator.validateCloudFormationTemplate(template, result);
      
      expect(result.errors.some(e => e.includes('Resources section'))).toBe(true);
    });

    test('should validate Boto3 template', () => {
      const result = { errors: [], warnings: [] };
      const template = 'import boto3\nclient = boto3.client("s3")';
      
      validator.validateBoto3Template(template, result);
      
      expect(result.warnings.length).toBe(0);
    });
  });

  describe('Utility Methods', () => {
    test('should generate consistent validation IDs', () => {
      const object1 = { id: 'test', value: 'data' };
      const object2 = { id: 'test', value: 'data' };
      const object3 = { id: 'test', value: 'different' };
      
      const id1 = validator.generateValidationId(object1);
      const id2 = validator.generateValidationId(object2);
      const id3 = validator.generateValidationId(object3);
      
      expect(id1).toBe(id2);
      expect(id1).not.toBe(id3);
      expect(id1).toHaveLength(16);
    });

    test('should infer severity from risk score', () => {
      expect(validator.inferSeverityFromRiskScore(9.5)).toBe('critical');
      expect(validator.inferSeverityFromRiskScore(8.0)).toBe('high');
      expect(validator.inferSeverityFromRiskScore(5.5)).toBe('medium');
      expect(validator.inferSeverityFromRiskScore(2.0)).toBe('low');
      expect(validator.inferSeverityFromRiskScore(0.5)).toBe('info');
    });

    test('should validate ARN format', () => {
      const validArn = 'arn:aws:s3:::test-bucket';
      const invalidArn = 'invalid-arn';
      
      expect(validator.isValidArnFormat(validArn)).toBe(true);
      expect(validator.isValidArnFormat(invalidArn)).toBe(false);
    });

    test('should detect sensitive information', () => {
      const finding1 = {
        description: 'Database password exposed',
        title: 'Security issue'
      };
      
      const finding2 = {
        description: 'Normal configuration issue',
        title: 'Config problem'
      };
      
      expect(validator.containsSensitiveInfo(finding1)).toBe(true);
      expect(validator.containsSensitiveInfo(finding2)).toBe(false);
    });

    test('should validate trusted sources', () => {
      expect(validator.isValidSource('prowler')).toBe(true);
      expect(validator.isValidSource('cloudsploit')).toBe(true);
      expect(validator.isValidSource('unknown-scanner')).toBe(false);
    });

    test('should detect injection attempts', () => {
      const maliciousText = '<script>alert("xss")</script>';
      const sqlInjection = 'DROP TABLE users;';
      const normalText = 'S3 bucket configuration issue';
      
      expect(validator.containsInjectionAttempts(maliciousText)).toBe(true);
      expect(validator.containsInjectionAttempts(sqlInjection)).toBe(true);
      expect(validator.containsInjectionAttempts(normalText)).toBe(false);
    });

    test('should calculate validation scores', () => {
      const perfectResult = {
        errors: [],
        securityIssues: [],
        safetyIssues: [],
        complianceIssues: [],
        warnings: [],
        configurationIssues: []
      };
      
      const problematicResult = {
        errors: ['Error 1'],
        securityIssues: ['Security issue 1'],
        safetyIssues: ['Safety issue 1'],
        complianceIssues: ['Compliance issue 1'],
        warnings: ['Warning 1'],
        configurationIssues: ['Config issue 1']
      };
      
      expect(validator.calculateValidationScore(perfectResult)).toBe(100);
      expect(validator.calculateValidationScore(problematicResult)).toBeLessThan(50);
    });
  });

  describe('Cross-Reference Validation', () => {
    test('should handle cross-reference validation when enabled', async () => {
      const finding = {
        id: 'finding-123',
        source: 'prowler',
        severity: 'high',
        category: 'security',
        title: 'Test finding',
        description: 'Test description',
        resource: {
          arn: 'arn:aws:s3:::test-bucket',
          type: 'AWS::S3::Bucket',
          region: 'us-east-1',
          accountId: '123456789012'
        }
      };
      
      const result = await validator.validateFinding(finding, { crossReference: true });
      
      // Should complete without errors even if cross-reference isn't fully implemented
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('score');
    });
  });

  describe('Edge Cases', () => {
    test('should handle null/undefined inputs gracefully', async () => {
      await expect(validator.validateFinding(null)).resolves.toHaveProperty('isValid', false);
      await expect(validator.validateAsset(undefined)).resolves.toHaveProperty('isValid', false);
      await expect(validator.validateRemediation({})).resolves.toHaveProperty('isValid', false);
    });

    test('should handle validation errors gracefully', async () => {
      // Force an error in validation
      const problematicFinding = {
        id: 'test',
        // Invalid structure that might cause processing errors
        resource: 'invalid-resource-type'
      };
      
      const result = await validator.validateFinding(problematicFinding);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should handle large validation objects', async () => {
      const largeFinding = {
        id: 'large-finding',
        source: 'prowler',
        severity: 'medium',
        category: 'security',
        title: 'Large finding',
        description: 'A'.repeat(10000), // Large description
        resource: {
          arn: 'arn:aws:s3:::test-bucket',
          type: 'AWS::S3::Bucket',
          region: 'us-east-1',
          accountId: '123456789012'
        },
        metadata: Object.fromEntries(
          Array.from({ length: 1000 }, (_, i) => [`key${i}`, `value${i}`])
        )
      };
      
      const startTime = Date.now();
      const result = await validator.validateFinding(largeFinding);
      const duration = Date.now() - startTime;
      
      expect(result).toHaveProperty('isValid');
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});
/**
 * Test data fixtures and factory functions
 * Provides realistic test data for security testing scenarios
 */

const crypto = require('crypto');

class TestDataFactory {
  static generateAwsResource(type = 's3', options = {}) {
    const accountId = options.accountId || '123456789012';
    const region = options.region || 'us-east-1';
    const resourceId = options.resourceId || crypto.randomBytes(8).toString('hex');
    
    const resourceTemplates = {
      s3: `arn:aws:s3:::test-bucket-${resourceId}`,
      ec2: `arn:aws:ec2:${region}:${accountId}:instance/i-${resourceId}`,
      rds: `arn:aws:rds:${region}:${accountId}:db:test-db-${resourceId}`,
      lambda: `arn:aws:lambda:${region}:${accountId}:function:test-function-${resourceId}`,
      iam: `arn:aws:iam::${accountId}:user/test-user-${resourceId}`,
      vpc: `arn:aws:ec2:${region}:${accountId}:vpc/vpc-${resourceId}`,
      sg: `arn:aws:ec2:${region}:${accountId}:security-group/sg-${resourceId}`
    };
    
    return resourceTemplates[type] || resourceTemplates.s3;
  }
  
  static generateSecurityFinding(overrides = {}) {
    const id = overrides.id || `test-finding-${crypto.randomBytes(4).toString('hex')}`;
    const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const categories = ['data_protection', 'network_security', 'identity_access', 'encryption', 'monitoring'];
    
    return {
      id,
      severity: overrides.severity || severities[Math.floor(Math.random() * severities.length)],
      resource: overrides.resource || this.generateAwsResource(),
      region: overrides.region || 'us-east-1',
      accountId: overrides.accountId || '123456789012',
      service: overrides.service || 's3',
      category: overrides.category || categories[Math.floor(Math.random() * categories.length)],
      title: overrides.title || `Test security finding ${id}`,
      description: overrides.description || 'This is a test security finding for validation purposes',
      recommendation: overrides.recommendation || 'Follow security best practices',
      timestamp: overrides.timestamp || new Date().toISOString(),
      metadata: {
        businessCriticality: 'medium',
        complianceFrameworks: ['SOC2'],
        ...overrides.metadata
      },
      ...overrides
    };
  }
  
  static generateVulnerableS3Bucket(options = {}) {
    return {
      id: 'vulnerable-s3-bucket',
      severity: 'HIGH',
      resource: this.generateAwsResource('s3', options),
      service: 's3',
      category: 'data_protection',
      title: 'S3 bucket allows public access',
      description: 'S3 bucket is configured to allow public read/write access',
      recommendation: 'Enable S3 Block Public Access and configure appropriate bucket policies',
      remediation: {
        automated: true,
        script: 'aws s3api put-public-access-block --bucket ${bucket_name} --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true',
        riskLevel: 'low'
      },
      metadata: {
        containsPII: options.containsPII || false,
        internetFacing: true,
        businessCriticality: 'high'
      }
    };
  }
  
  static generateInsecureSecurityGroup(options = {}) {
    return {
      id: 'insecure-security-group',
      severity: 'HIGH',
      resource: this.generateAwsResource('sg', options),
      service: 'ec2',
      category: 'network_security',
      title: 'Security group allows unrestricted access',
      description: 'Security group has rules allowing unrestricted inbound access on sensitive ports',
      recommendation: 'Restrict inbound rules to specific IP ranges and required ports only',
      remediation: {
        automated: true,
        script: 'aws ec2 revoke-security-group-ingress --group-id ${sg_id} --protocol tcp --port 22 --cidr 0.0.0.0/0',
        riskLevel: 'medium'
      },
      metadata: {
        exposedPorts: [22, 3389, 1433],
        internetFacing: true,
        businessCriticality: 'medium'
      }
    };
  }
  
  static generatePrivilegedIamUser(options = {}) {
    return {
      id: 'privileged-iam-user',
      severity: 'CRITICAL',
      resource: this.generateAwsResource('iam', options),
      service: 'iam',
      category: 'identity_access',
      title: 'IAM user has excessive permissions',
      description: 'IAM user has administrator access, violating principle of least privilege',
      recommendation: 'Review and reduce user permissions to minimum required',
      remediation: {
        automated: false,
        script: '# MANUAL REVIEW REQUIRED\n# aws iam detach-user-policy --user-name ${user_name} --policy-arn arn:aws:iam::aws:policy/AdministratorAccess',
        riskLevel: 'high',
        requiresApproval: true
      },
      metadata: {
        attachedPolicies: ['AdministratorAccess'],
        lastUsed: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        businessCriticality: 'high'
      }
    };
  }
  
  static generateBacklogItem(options = {}) {
    const priorities = ['low', 'medium', 'high', 'critical'];
    const categories = ['security', 'performance', 'maintainability', 'documentation'];
    
    return {
      id: options.id || `backlog-item-${crypto.randomBytes(4).toString('hex')}`,
      title: options.title || 'Test backlog item',
      description: options.description || 'Test backlog item for validation',
      category: options.category || categories[Math.floor(Math.random() * categories.length)],
      priority: options.priority || priorities[Math.floor(Math.random() * priorities.length)],
      businessValue: options.businessValue || Math.floor(Math.random() * 10) + 1,
      urgency: options.urgency || Math.floor(Math.random() * 10) + 1,
      jobSize: options.jobSize || Math.floor(Math.random() * 8) + 1,
      created: options.created || new Date().toISOString(),
      tags: options.tags || ['test'],
      assignee: options.assignee || 'automated-system',
      ...options
    };
  }
  
  static generateSecurityBacklogItems(count = 5) {
    const items = [];
    const securityTemplates = [
      {
        title: 'Fix SQL injection vulnerability',
        description: 'Address SQL injection vulnerability in user input validation',
        category: 'security',
        priority: 'critical',
        businessValue: 9,
        urgency: 9,
        jobSize: 3
      },
      {
        title: 'Implement input sanitization',
        description: 'Add comprehensive input sanitization for all user inputs',
        category: 'security',
        priority: 'high',
        businessValue: 8,
        urgency: 7,
        jobSize: 5
      },
      {
        title: 'Enable S3 bucket encryption',
        description: 'Configure server-side encryption for all S3 buckets',
        category: 'security',
        priority: 'high',
        businessValue: 7,
        urgency: 6,
        jobSize: 2
      },
      {
        title: 'Update security group rules',
        description: 'Restrict overly permissive security group rules',
        category: 'security',
        priority: 'medium',
        businessValue: 6,
        urgency: 5,
        jobSize: 3
      },
      {
        title: 'Implement multi-factor authentication',
        description: 'Add MFA requirement for all administrative accounts',
        category: 'security',
        priority: 'high',
        businessValue: 8,
        urgency: 8,
        jobSize: 4
      }
    ];
    
    for (let i = 0; i < count; i++) {
      const template = securityTemplates[i % securityTemplates.length];
      items.push(this.generateBacklogItem({
        ...template,
        id: `security-item-${i + 1}`,
        tags: ['security', 'automated']
      }));
    }
    
    return items;
  }
  
  static generateMockAwsResponse(service, operation, data = {}) {
    const responseTemplates = {
      s3: {
        listBuckets: {
          Buckets: [
            { Name: 'test-bucket-1', CreationDate: new Date() },
            { Name: 'test-bucket-2', CreationDate: new Date() }
          ]
        },
        getBucketPolicy: {
          Policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [{
              Effect: 'Allow',
              Principal: '*',
              Action: 's3:GetObject',
              Resource: 'arn:aws:s3:::test-bucket/*'
            }]
          })
        }
      },
      ec2: {
        describeSecurityGroups: {
          SecurityGroups: [{
            GroupId: 'sg-12345678',
            GroupName: 'test-sg',
            IpPermissions: [{
              IpProtocol: 'tcp',
              FromPort: 22,
              ToPort: 22,
              IpRanges: [{ CidrIp: '0.0.0.0/0' }]
            }]
          }]
        }
      },
      iam: {
        listUsers: {
          Users: [{
            UserName: 'test-user',
            UserId: 'AIDACKCEVSQ6C2EXAMPLE',
            Arn: 'arn:aws:iam::123456789012:user/test-user',
            CreateDate: new Date()
          }]
        }
      }
    };
    
    return {
      ...responseTemplates[service]?.[operation],
      ...data,
      $metadata: {
        httpStatusCode: 200,
        requestId: crypto.randomUUID(),
        extendedRequestId: crypto.randomBytes(16).toString('hex'),
        attempts: 1,
        totalRetryDelay: 0
      }
    };
  }
  
  static createSecurityTestEnvironment() {
    return {
      findings: [
        this.generateVulnerableS3Bucket(),
        this.generateInsecureSecurityGroup(),
        this.generatePrivilegedIamUser()
      ],
      backlogItems: this.generateSecurityBacklogItems(10),
      awsResources: {
        buckets: ['test-bucket-1', 'test-bucket-2'],
        instances: ['i-1234567890abcdef0', 'i-0987654321fedcba0'],
        securityGroups: ['sg-12345678', 'sg-87654321']
      },
      configuration: {
        riskThreshold: 7.0,
        autoRemediationEnabled: true,
        requireApprovalForHighRisk: true
      }
    };
  }
}

module.exports = {
  TestDataFactory,
  
  // Pre-built test data sets
  SAMPLE_FINDINGS: require('./security-findings.json'),
  
  // Common test scenarios
  SCENARIOS: {
    CRITICAL_SECURITY_INCIDENT: {
      findings: [
        TestDataFactory.generateSecurityFinding({
          severity: 'CRITICAL',
          category: 'identity_access',
          title: 'Root account compromise detected'
        }),
        TestDataFactory.generateSecurityFinding({
          severity: 'HIGH',
          category: 'data_protection',
          title: 'Data exfiltration attempt'
        })
      ],
      expectedActions: ['immediate_response', 'incident_escalation']
    },
    
    ROUTINE_COMPLIANCE_SCAN: {
      findings: Array.from({ length: 20 }, () => 
        TestDataFactory.generateSecurityFinding({
          severity: 'MEDIUM',
          category: 'compliance'
        })
      ),
      expectedActions: ['prioritize_by_risk', 'batch_remediation']
    },
    
    NEW_DEPLOYMENT_SCAN: {
      findings: [
        TestDataFactory.generateVulnerableS3Bucket(),
        TestDataFactory.generateInsecureSecurityGroup()
      ],
      expectedActions: ['automated_remediation', 'deployment_approval']
    }
  }
};
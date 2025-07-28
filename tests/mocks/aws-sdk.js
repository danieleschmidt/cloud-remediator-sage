/**
 * AWS SDK mocks for testing
 * Provides realistic AWS service responses for security testing
 */

const { TestDataFactory } = require('../fixtures/test-data');

class MockS3 {
  constructor(config = {}) {
    this.config = config;
    this.buckets = new Map();
    this.objects = new Map();
  }
  
  listBuckets() {
    return {
      promise: () => Promise.resolve({
        Buckets: Array.from(this.buckets.keys()).map(name => ({
          Name: name,
          CreationDate: new Date()
        }))
      })
    };
  }
  
  getBucketPolicy(params) {
    const policy = this.buckets.get(params.Bucket)?.policy;
    if (!policy) {
      const error = new Error('NoSuchBucketPolicy');
      error.code = 'NoSuchBucketPolicy';
      return { promise: () => Promise.reject(error) };
    }
    
    return {
      promise: () => Promise.resolve({ Policy: JSON.stringify(policy) })
    };
  }
  
  putBucketPolicy(params) {
    if (!this.buckets.has(params.Bucket)) {
      this.buckets.set(params.Bucket, {});
    }
    this.buckets.get(params.Bucket).policy = JSON.parse(params.Policy);
    
    return {
      promise: () => Promise.resolve({})
    };
  }
  
  getBucketAcl(params) {
    const bucket = this.buckets.get(params.Bucket);
    if (!bucket) {
      const error = new Error('NoSuchBucket');
      error.code = 'NoSuchBucket';
      return { promise: () => Promise.reject(error) };
    }
    
    return {
      promise: () => Promise.resolve({
        Owner: { ID: 'owner-id' },
        Grants: bucket.acl || [
          {
            Grantee: { Type: 'CanonicalUser', ID: 'owner-id' },
            Permission: 'FULL_CONTROL'
          }
        ]
      })
    };
  }
  
  getObject(params) {
    const key = `${params.Bucket}/${params.Key}`;
    const object = this.objects.get(key);
    
    if (!object) {
      const error = new Error('NoSuchKey');
      error.code = 'NoSuchKey';
      return { promise: () => Promise.reject(error) };
    }
    
    return {
      promise: () => Promise.resolve({
        Body: object.body,
        ContentType: object.contentType || 'application/json',
        LastModified: object.lastModified || new Date(),
        ETag: object.etag || '"d41d8cd98f00b204e9800998ecf8427e"'
      })
    };
  }
  
  putObject(params) {
    const key = `${params.Bucket}/${params.Key}`;
    this.objects.set(key, {
      body: params.Body,
      contentType: params.ContentType,
      lastModified: new Date(),
      etag: '"' + Math.random().toString(36).substring(2) + '"'
    });
    
    return {
      promise: () => Promise.resolve({ ETag: this.objects.get(key).etag })
    };
  }
  
  // Helper methods for testing
  _createBucket(name, options = {}) {
    this.buckets.set(name, {
      acl: options.acl,
      policy: options.policy,
      encryption: options.encryption,
      publicAccessBlock: options.publicAccessBlock || {
        BlockPublicAcls: false,
        IgnorePublicAcls: false,
        BlockPublicPolicy: false,
        RestrictPublicBuckets: false
      }
    });
  }
  
  _addVulnerableBucket(name) {
    this._createBucket(name, {
      acl: [
        {
          Grantee: { Type: 'Group', URI: 'http://acs.amazonaws.com/groups/global/AllUsers' },
          Permission: 'READ'
        }
      ],
      policy: {
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Principal: '*',
          Action: 's3:GetObject',
          Resource: `arn:aws:s3:::${name}/*`
        }]
      }
    });
  }
}

class MockEC2 {
  constructor(config = {}) {
    this.config = config;
    this.securityGroups = new Map();
    this.instances = new Map();
  }
  
  describeSecurityGroups(params = {}) {
    const groups = Array.from(this.securityGroups.values());
    let filteredGroups = groups;
    
    if (params.GroupIds) {
      filteredGroups = groups.filter(g => params.GroupIds.includes(g.GroupId));
    }
    
    return {
      promise: () => Promise.resolve({ SecurityGroups: filteredGroups })
    };
  }
  
  authorizeSecurityGroupIngress(params) {
    const group = this.securityGroups.get(params.GroupId);
    if (!group) {
      const error = new Error('InvalidGroupId.NotFound');
      error.code = 'InvalidGroupId.NotFound';
      return { promise: () => Promise.reject(error) };
    }
    
    // Add the new rule
    group.IpPermissions.push({
      IpProtocol: params.IpProtocol,
      FromPort: params.FromPort,
      ToPort: params.ToPort,
      IpRanges: [{ CidrIp: params.CidrIp }]
    });
    
    return { promise: () => Promise.resolve({}) };
  }
  
  revokeSecurityGroupIngress(params) {
    const group = this.securityGroups.get(params.GroupId);
    if (!group) {
      const error = new Error('InvalidGroupId.NotFound');
      error.code = 'InvalidGroupId.NotFound';
      return { promise: () => Promise.reject(error) };
    }
    
    // Remove matching rule
    group.IpPermissions = group.IpPermissions.filter(rule => 
      !(rule.IpProtocol === params.IpProtocol &&
        rule.FromPort === params.FromPort &&
        rule.ToPort === params.ToPort &&
        rule.IpRanges.some(range => range.CidrIp === params.CidrIp))
    );
    
    return { promise: () => Promise.resolve({}) };
  }
  
  // Helper methods for testing
  _createSecurityGroup(id, options = {}) {
    this.securityGroups.set(id, {
      GroupId: id,
      GroupName: options.name || `test-sg-${id}`,
      Description: options.description || 'Test security group',
      VpcId: options.vpcId || 'vpc-12345678',
      IpPermissions: options.rules || [],
      IpPermissionsEgress: options.egressRules || [{
        IpProtocol: '-1',
        IpRanges: [{ CidrIp: '0.0.0.0/0' }]
      }]
    });
  }
  
  _addInsecureSecurityGroup(id) {
    this._createSecurityGroup(id, {
      rules: [
        {
          IpProtocol: 'tcp',
          FromPort: 22,
          ToPort: 22,
          IpRanges: [{ CidrIp: '0.0.0.0/0' }]
        },
        {
          IpProtocol: 'tcp',
          FromPort: 3389,
          ToPort: 3389,
          IpRanges: [{ CidrIp: '0.0.0.0/0' }]
        }
      ]
    });
  }
}

class MockIAM {
  constructor(config = {}) {
    this.config = config;
    this.users = new Map();
    this.policies = new Map();
    this.roles = new Map();
  }
  
  listUsers(params = {}) {
    const users = Array.from(this.users.values());
    return {
      promise: () => Promise.resolve({ Users: users })
    };
  }
  
  getUser(params) {
    const user = this.users.get(params.UserName);
    if (!user) {
      const error = new Error('NoSuchEntity');
      error.code = 'NoSuchEntity';
      return { promise: () => Promise.reject(error) };
    }
    
    return {
      promise: () => Promise.resolve({ User: user })
    };
  }
  
  listAttachedUserPolicies(params) {
    const user = this.users.get(params.UserName);
    if (!user) {
      const error = new Error('NoSuchEntity');
      error.code = 'NoSuchEntity';
      return { promise: () => Promise.reject(error) };
    }
    
    return {
      promise: () => Promise.resolve({
        AttachedPolicies: user.attachedPolicies || []
      })
    };
  }
  
  attachUserPolicy(params) {
    const user = this.users.get(params.UserName);
    if (!user) {
      const error = new Error('NoSuchEntity');
      error.code = 'NoSuchEntity';
      return { promise: () => Promise.reject(error) };
    }
    
    if (!user.attachedPolicies) {
      user.attachedPolicies = [];
    }
    
    user.attachedPolicies.push({
      PolicyName: params.PolicyArn.split('/').pop(),
      PolicyArn: params.PolicyArn
    });
    
    return { promise: () => Promise.resolve({}) };
  }
  
  detachUserPolicy(params) {
    const user = this.users.get(params.UserName);
    if (!user) {
      const error = new Error('NoSuchEntity');
      error.code = 'NoSuchEntity';
      return { promise: () => Promise.reject(error) };
    }
    
    if (user.attachedPolicies) {
      user.attachedPolicies = user.attachedPolicies.filter(
        policy => policy.PolicyArn !== params.PolicyArn
      );
    }
    
    return { promise: () => Promise.resolve({}) };
  }
  
  // Helper methods for testing
  _createUser(username, options = {}) {
    this.users.set(username, {
      UserName: username,
      UserId: options.userId || `AIDA${Math.random().toString(36).substring(2, 18).toUpperCase()}`,
      Arn: `arn:aws:iam::123456789012:user/${username}`,
      Path: options.path || '/',
      CreateDate: options.createDate || new Date(),
      attachedPolicies: options.attachedPolicies || []
    });
  }
  
  _addPrivilegedUser(username) {
    this._createUser(username, {
      attachedPolicies: [
        {
          PolicyName: 'AdministratorAccess',
          PolicyArn: 'arn:aws:iam::aws:policy/AdministratorAccess'
        }
      ]
    });
  }
}

class MockDynamoDB {
  constructor(config = {}) {
    this.config = config;
    this.tables = new Map();
  }
  
  DocumentClient = class {
    constructor(config = {}) {
      this.config = config;
      this.parent = this;
    }
    
    put(params) {
      const tableName = params.TableName;
      if (!this.parent.tables.has(tableName)) {
        this.parent.tables.set(tableName, new Map());
      }
      
      const table = this.parent.tables.get(tableName);
      const key = JSON.stringify(params.Item);
      table.set(key, params.Item);
      
      return {
        promise: () => Promise.resolve({})
      };
    }
    
    get(params) {
      const tableName = params.TableName;
      const table = this.parent.tables.get(tableName);
      
      if (!table) {
        return {
          promise: () => Promise.resolve({})
        };
      }
      
      // Simple key matching for testing
      const items = Array.from(table.values());
      const item = items.find(i => {
        return Object.keys(params.Key).every(k => i[k] === params.Key[k]);
      });
      
      return {
        promise: () => Promise.resolve(item ? { Item: item } : {})
      };
    }
    
    query(params) {
      const tableName = params.TableName;
      const table = this.parent.tables.get(tableName);
      
      if (!table) {
        return {
          promise: () => Promise.resolve({ Items: [] })
        };
      }
      
      // Simple query implementation for testing
      const items = Array.from(table.values());
      
      return {
        promise: () => Promise.resolve({ Items: items.slice(0, params.Limit || 100) })
      };
    }
    
    scan(params) {
      const tableName = params.TableName;
      const table = this.parent.tables.get(tableName);
      
      if (!table) {
        return {
          promise: () => Promise.resolve({ Items: [] })
        };
      }
      
      const items = Array.from(table.values());
      
      return {
        promise: () => Promise.resolve({ Items: items })
      };
    }
  };
}

// Factory function to create complete AWS mock
function createMockAWS(options = {}) {
  const mockAWS = {
    S3: MockS3,
    EC2: MockEC2,
    IAM: MockIAM,
    DynamoDB: MockDynamoDB,
    config: {
      update: jest.fn(),
      region: options.region || 'us-east-1'
    }
  };
  
  // Create instances with test data if requested
  if (options.withTestData) {
    const s3 = new MockS3();
    s3._addVulnerableBucket('vulnerable-test-bucket');
    s3._createBucket('secure-test-bucket', {
      publicAccessBlock: {
        BlockPublicAcls: true,
        IgnorePublicAcls: true,
        BlockPublicPolicy: true,
        RestrictPublicBuckets: true
      }
    });
    
    const ec2 = new MockEC2();
    ec2._addInsecureSecurityGroup('sg-insecure123');
    ec2._createSecurityGroup('sg-secure456', {
      rules: [{
        IpProtocol: 'tcp',
        FromPort: 443,
        ToPort: 443,
        IpRanges: [{ CidrIp: '10.0.0.0/8' }]
      }]
    });
    
    const iam = new MockIAM();
    iam._addPrivilegedUser('admin-user');
    iam._createUser('regular-user', {
      attachedPolicies: [{
        PolicyName: 'ReadOnlyAccess',
        PolicyArn: 'arn:aws:iam::aws:policy/ReadOnlyAccess'
      }]
    });
    
    mockAWS._instances = { s3, ec2, iam };
  }
  
  return mockAWS;
}

module.exports = {
  MockS3,
  MockEC2,
  MockIAM,
  MockDynamoDB,
  createMockAWS,
  
  // Jest setup helper
  setupAWSMocks: () => {
    const mockAWS = createMockAWS({ withTestData: true });
    
    jest.doMock('aws-sdk', () => mockAWS);
    
    return mockAWS;
  }
};
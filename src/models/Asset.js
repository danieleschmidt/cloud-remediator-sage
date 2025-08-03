/**
 * Cloud Asset Model
 * Represents a cloud resource with its metadata, relationships, and criticality
 */

class Asset {
  constructor(data) {
    this.arn = data.arn;
    this.id = data.id || this.extractIdFromArn(data.arn);
    this.type = data.type;
    this.name = data.name || data.id;
    this.accountId = data.accountId;
    this.region = data.region;
    this.service = data.service || this.extractServiceFromArn(data.arn);
    this.criticality = data.criticality || 'medium';
    this.environment = data.environment || 'unknown';
    this.owner = data.owner;
    this.costCenter = data.costCenter;
    this.compliance = data.compliance || [];
    this.tags = data.tags || {};
    this.metadata = data.metadata || {};
    this.dependencies = data.dependencies || [];
    this.dependents = data.dependents || [];
    this.configuration = data.configuration || {};
    this.securityGroups = data.securityGroups || [];
    this.networkInfo = data.networkInfo || {};
    this.encryption = data.encryption || {};
    this.backupInfo = data.backupInfo || {};
    this.monitoringEnabled = data.monitoringEnabled || false;
    this.loggingEnabled = data.loggingEnabled || false;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.lastScannedAt = data.lastScannedAt;
  }

  extractIdFromArn(arn) {
    if (!arn) return null;
    const parts = arn.split(':');
    return parts[parts.length - 1] || parts[parts.length - 2];
  }

  extractServiceFromArn(arn) {
    if (!arn) return 'unknown';
    const parts = arn.split(':');
    return parts[2] || 'unknown';
  }

  getCriticalityScore() {
    const scores = {
      critical: 10,
      high: 8,
      medium: 5,
      low: 2,
      minimal: 1
    };
    return scores[this.criticality] || 5;
  }

  calculateBlastRadius() {
    // Calculate potential impact based on dependencies and asset type
    let radius = this.getCriticalityScore();
    
    // Add impact for number of dependents
    radius += Math.min(this.dependents.length * 0.5, 5);
    
    // Add impact for critical services
    const criticalServices = ['rds', 'ec2', 'lambda', 's3', 'iam'];
    if (criticalServices.includes(this.service.toLowerCase())) {
      radius += 2;
    }
    
    // Add impact for public exposure
    if (this.isPubliclyAccessible()) {
      radius += 3;
    }
    
    // Add impact for sensitive data
    if (this.containsSensitiveData()) {
      radius += 2;
    }
    
    return Math.min(radius, 10);
  }

  isPubliclyAccessible() {
    // Check if asset is publicly accessible based on security groups and network config
    if (this.securityGroups.some(sg => 
      sg.rules?.some(rule => rule.source === '0.0.0.0/0' && rule.ports?.includes('*'))
    )) {
      return true;
    }
    
    // Check for public subnet placement
    if (this.networkInfo.subnetType === 'public') {
      return true;
    }
    
    // Check tags for public exposure
    if (this.tags.Exposure === 'public' || this.tags.Public === 'true') {
      return true;
    }
    
    return false;
  }

  containsSensitiveData() {
    // Check tags and metadata for sensitive data indicators
    const sensitiveIndicators = [
      'pii', 'phi', 'financial', 'confidential', 'secret', 'sensitive',
      'customer-data', 'payment', 'healthcare', 'gdpr'
    ];
    
    const tagValues = Object.values(this.tags).join(' ').toLowerCase();
    const metadataValues = Object.values(this.metadata).join(' ').toLowerCase();
    
    return sensitiveIndicators.some(indicator => 
      tagValues.includes(indicator) || metadataValues.includes(indicator)
    );
  }

  getComplianceFrameworks() {
    return this.compliance.map(comp => comp.framework);
  }

  isCompliantWith(framework) {
    return this.compliance.some(comp => 
      comp.framework === framework && comp.status === 'compliant'
    );
  }

  addDependency(targetArn, relationshipType = 'depends-on') {
    if (!this.dependencies.find(dep => dep.arn === targetArn)) {
      this.dependencies.push({
        arn: targetArn,
        type: relationshipType,
        createdAt: new Date()
      });
    }
  }

  addDependent(sourceArn, relationshipType = 'depends-on') {
    if (!this.dependents.find(dep => dep.arn === sourceArn)) {
      this.dependents.push({
        arn: sourceArn,
        type: relationshipType,
        createdAt: new Date()
      });
    }
  }

  toNeptuneVertex() {
    return {
      label: 'Asset',
      properties: {
        arn: this.arn,
        id: this.id,
        type: this.type,
        name: this.name,
        accountId: this.accountId,
        region: this.region,
        service: this.service,
        criticality: this.criticality,
        environment: this.environment,
        owner: this.owner,
        criticalityScore: this.getCriticalityScore(),
        blastRadius: this.calculateBlastRadius(),
        isPublic: this.isPubliclyAccessible(),
        hasSensitiveData: this.containsSensitiveData(),
        monitoringEnabled: this.monitoringEnabled,
        loggingEnabled: this.loggingEnabled,
        createdAt: this.createdAt.toISOString(),
        updatedAt: this.updatedAt.toISOString()
      }
    };
  }

  validate() {
    const errors = [];
    
    if (!this.arn) errors.push('arn is required');
    if (!this.type) errors.push('type is required');
    if (!this.accountId) errors.push('accountId is required');
    if (!this.region) errors.push('region is required');
    if (!['critical', 'high', 'medium', 'low', 'minimal'].includes(this.criticality)) {
      errors.push('invalid criticality level');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static fromAWSConfig(configItem) {
    return new Asset({
      arn: configItem.resourceId,
      type: configItem.resourceType,
      name: configItem.resourceName,
      accountId: configItem.awsAccountId,
      region: configItem.awsRegion,
      tags: configItem.tags || {},
      configuration: configItem.configuration || {},
      createdAt: new Date(configItem.resourceCreationTime)
    });
  }

  static fromCloudFormation(cfnResource, stackInfo) {
    return new Asset({
      arn: cfnResource.PhysicalResourceId,
      type: cfnResource.ResourceType,
      name: cfnResource.LogicalResourceId,
      accountId: stackInfo.accountId,
      region: stackInfo.region,
      tags: {
        'aws:cloudformation:stack-name': stackInfo.stackName,
        'aws:cloudformation:logical-id': cfnResource.LogicalResourceId,
        ...cfnResource.Tags
      },
      metadata: {
        stackId: stackInfo.stackId,
        stackName: stackInfo.stackName,
        resourceStatus: cfnResource.ResourceStatus
      }
    });
  }

  static inferCriticality(asset) {
    // Auto-assign criticality based on service type and configuration
    const criticalServices = ['rds', 'dynamodb', 'iam', 'kms'];
    const highServices = ['ec2', 'lambda', 's3', 'elb', 'cloudfront'];
    
    if (criticalServices.includes(asset.service.toLowerCase())) {
      return 'critical';
    }
    
    if (highServices.includes(asset.service.toLowerCase())) {
      if (asset.isPubliclyAccessible() || asset.containsSensitiveData()) {
        return 'critical';
      }
      return 'high';
    }
    
    if (asset.environment === 'production') {
      return 'high';
    }
    
    return 'medium';
  }
}

module.exports = Asset;
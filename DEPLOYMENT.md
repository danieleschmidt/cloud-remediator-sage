# Deployment Guide

## Overview

This guide covers the deployment of the Quantum-Enhanced Cloud Security Posture Management (CSPM) platform with autonomous execution capabilities.

## Prerequisites

### Infrastructure Requirements
- **AWS Account** with appropriate permissions
- **Amazon Neptune** cluster (db.r5.large or higher recommended)
- **AWS Lambda** execution environment
- **Amazon S3** buckets for artifacts and logs
- **Amazon CloudWatch** for monitoring
- **AWS IAM** roles and policies configured

### Software Requirements
- **Node.js** 18.x or higher
- **npm** 8.x or higher
- **AWS CLI** v2.x configured
- **Serverless Framework** 3.x (optional, for deployment automation)
- **Docker** (for containerized deployments)

## Environment Configuration

### 1. Environment Variables

Create environment-specific configuration files:

#### Production (.env.production)
```bash
# Neptune Configuration
NEPTUNE_ENDPOINT=your-neptune-cluster.cluster-xxx.us-east-1.neptune.amazonaws.com
NEPTUNE_PORT=8182
NEPTUNE_IAM_AUTH_ENABLED=true

# Lambda Configuration
REMEDIATION_GENERATOR_FUNCTION=prod-remediationGenerator
RISK_SCORING_FUNCTION=prod-riskScoring
PROWLER_INGEST_FUNCTION=prod-prowlerIngest

# Monitoring
CLOUDWATCH_LOG_GROUP=/aws/lambda/cspm-production
METRICS_NAMESPACE=CSPM/Production
STRUCTURED_LOGGING=true

# Security
ENCRYPTION_AT_REST=true
ENCRYPTION_IN_TRANSIT=true
KMS_KEY_ID=arn:aws:kms:us-east-1:123456789012:key/your-key-id

# Compliance
COMPLIANCE_ENABLED=true
AUDIT_MODE=true
GDPR_ENABLED=true
CCPA_ENABLED=true
SOX_ENABLED=true
HIPAA_ENABLED=false

# Performance
QUANTUM_MAX_CONCURRENT_TASKS=10
CACHE_TTL_SECONDS=3600
CIRCUIT_BREAKER_ENABLED=true

# Localization
DEFAULT_LOCALE=en
SUPPORTED_LOCALES=en,es,fr,de,ja,zh
```

#### Staging (.env.staging)
```bash
# Similar to production but with staging-specific values
NEPTUNE_ENDPOINT=your-neptune-staging.cluster-xxx.us-east-1.neptune.amazonaws.com
REMEDIATION_GENERATOR_FUNCTION=staging-remediationGenerator
CLOUDWATCH_LOG_GROUP=/aws/lambda/cspm-staging
METRICS_NAMESPACE=CSPM/Staging
QUANTUM_MAX_CONCURRENT_TASKS=5
```

### 2. IAM Roles and Policies

#### Lambda Execution Role
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "neptune-db:connect",
        "neptune-db:ReadDataViaQuery",
        "neptune-db:WriteDataViaQuery"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::your-cspm-bucket/*"
    }
  ]
}
```

## Deployment Methods

### Method 1: AWS CDK Deployment (Recommended)

#### 1. Install Dependencies
```bash
npm install -g aws-cdk
npm install
```

#### 2. CDK Bootstrap (First time only)
```bash
cdk bootstrap aws://ACCOUNT-NUMBER/REGION
```

#### 3. Deploy Infrastructure
```bash
# Deploy to staging
cdk deploy CSPMStack --context env=staging

# Deploy to production
cdk deploy CSPMStack --context env=production
```

### Method 2: Serverless Framework Deployment

#### 1. Install Serverless
```bash
npm install -g serverless
npm install
```

#### 2. Deploy Functions
```bash
# Deploy to staging
serverless deploy --stage staging

# Deploy to production
serverless deploy --stage production
```

### Method 3: Manual AWS Console Deployment

#### 1. Create Neptune Cluster
- Navigate to Amazon Neptune in AWS Console
- Create cluster with appropriate instance size
- Configure security groups and subnet groups
- Enable IAM authentication

#### 2. Deploy Lambda Functions
```bash
# Package functions
npm run build
zip -r remediation-generator.zip src/lambda/remediation-generator.js src/services/ src/models/

# Upload via AWS Console or CLI
aws lambda create-function \
  --function-name remediationGenerator \
  --runtime nodejs18.x \
  --role arn:aws:iam::123456789012:role/lambda-execution-role \
  --handler src/lambda/remediation-generator.handler \
  --zip-file fileb://remediation-generator.zip
```

## Database Setup

### 1. Neptune Initialization

#### Create Graph Schema
```javascript
// Run this script to initialize Neptune graph structure
const NeptuneService = require('./src/services/NeptuneService');

async function initializeSchema() {
  const neptune = new NeptuneService();
  
  // Create vertex labels
  await neptune.execute(`
    graph.tx().rollback();
    
    // Create indexes for performance
    mgmt = graph.openManagement();
    
    // Vertex labels
    finding = mgmt.makeVertexLabel('Finding').make();
    asset = mgmt.makeVertexLabel('Asset').make();
    remediation = mgmt.makeVertexLabel('Remediation').make();
    
    // Properties
    id = mgmt.makePropertyKey('id').dataType(String.class).cardinality(Cardinality.SINGLE).make();
    severity = mgmt.makePropertyKey('severity').dataType(String.class).cardinality(Cardinality.SINGLE).make();
    status = mgmt.makePropertyKey('status').dataType(String.class).cardinality(Cardinality.SINGLE).make();
    
    // Indexes
    mgmt.buildIndex('findingById', Vertex.class).addKey(id).indexOnly(finding).buildCompositeIndex();
    mgmt.buildIndex('assetById', Vertex.class).addKey(id).indexOnly(asset).buildCompositeIndex();
    
    mgmt.commit();
  `);
}
```

### 2. Load Sample Data (Development)
```bash
# Load sample findings and assets
npm run load-sample-data
```

## Configuration

### 1. Application Configuration

#### config/production.json
```json
{
  "database": {
    "neptune": {
      "endpoint": "${NEPTUNE_ENDPOINT}",
      "port": "${NEPTUNE_PORT}",
      "iamAuth": true,
      "region": "us-east-1"
    }
  },
  "quantum": {
    "maxConcurrentTasks": 10,
    "superpositionStates": 8,
    "entanglementThreshold": 0.75,
    "coherenceThreshold": 0.9
  },
  "compliance": {
    "enabled": true,
    "frameworks": ["gdpr", "ccpa", "sox", "hipaa", "iso27001"],
    "auditRetentionDays": 2555,
    "strictMode": true
  },
  "monitoring": {
    "metricsNamespace": "CSPM/Production",
    "logLevel": "info",
    "enableTracing": true
  },
  "security": {
    "encryptionAtRest": true,
    "encryptionInTransit": true,
    "auditAllAccess": true
  }
}
```

### 2. Lambda Function Configuration

#### Timeout Settings
- **Remediation Generator**: 15 minutes
- **Risk Scoring**: 5 minutes
- **Prowler Ingest**: 10 minutes

#### Memory Settings
- **Remediation Generator**: 1024 MB
- **Risk Scoring**: 512 MB
- **Prowler Ingest**: 2048 MB

## Monitoring and Observability

### 1. CloudWatch Dashboards

Create dashboards for:
- **Security Metrics**: Findings by severity, remediation success rate
- **Performance Metrics**: Quantum coherence, execution times
- **Compliance Metrics**: Framework compliance scores
- **System Health**: Lambda invocations, errors, duration

### 2. Alarms and Notifications

#### Critical Alarms
```bash
# High error rate
aws cloudwatch put-metric-alarm \
  --alarm-name "CSPM-HighErrorRate" \
  --alarm-description "High error rate in CSPM functions" \
  --metric-name "Errors" \
  --namespace "AWS/Lambda" \
  --statistic "Sum" \
  --period 300 \
  --threshold 10 \
  --comparison-operator "GreaterThanThreshold"

# Quantum coherence degradation
aws cloudwatch put-metric-alarm \
  --alarm-name "CSPM-LowQuantumCoherence" \
  --alarm-description "Quantum coherence below acceptable threshold" \
  --metric-name "QuantumCoherence" \
  --namespace "CSPM/Production" \
  --statistic "Average" \
  --period 300 \
  --threshold 0.7 \
  --comparison-operator "LessThanThreshold"
```

### 3. Distributed Tracing

Enable X-Ray tracing for all Lambda functions:
```javascript
const AWSXRay = require('aws-xray-sdk-core');
const AWS = AWSXRay.captureAWS(require('aws-sdk'));
```

## Security Hardening

### 1. Network Security
- Deploy Lambda functions in VPC
- Use private subnets for Neptune access
- Configure security groups with least privilege
- Enable VPC Flow logs

### 2. Encryption
- Enable encryption at rest for Neptune
- Use AWS KMS for key management
- Encrypt Lambda environment variables
- Enable S3 bucket encryption

### 3. Access Control
- Implement least privilege IAM policies
- Use resource-based policies where appropriate
- Enable CloudTrail for audit logging
- Configure AWS Config for compliance monitoring

## Performance Optimization

### 1. Lambda Optimization
```javascript
// Use Lambda layers for shared dependencies
// Enable provisioned concurrency for critical functions
// Optimize cold start times with smaller deployment packages
```

### 2. Neptune Optimization
```bash
# Configure appropriate instance types
# Enable read replicas for read-heavy workloads
# Optimize Gremlin queries with proper indexing
# Use connection pooling
```

### 3. Caching Strategy
- Implement Redis/ElastiCache for frequent queries
- Use Lambda function caching for static data
- Configure appropriate TTL values

## Testing in Production

### 1. Smoke Tests
```bash
# Run basic functionality tests
npm run test:smoke:production

# Test quantum execution
npm run test:quantum:production

# Test compliance frameworks
npm run test:compliance:production
```

### 2. Load Testing
```bash
# Simulate high-volume finding ingestion
npm run test:load:ingest

# Test concurrent remediation execution
npm run test:load:remediation
```

## Rollback Procedures

### 1. Lambda Rollback
```bash
# Rollback to previous version
aws lambda update-function-code \
  --function-name remediationGenerator \
  --s3-bucket your-deployment-bucket \
  --s3-key previous-version.zip
```

### 2. Configuration Rollback
```bash
# Revert environment variables
aws lambda update-function-configuration \
  --function-name remediationGenerator \
  --environment Variables='{...previous-config...}'
```

## Troubleshooting

### Common Issues

#### 1. Neptune Connection Issues
```bash
# Check security groups
# Verify IAM authentication
# Test network connectivity from Lambda subnet
```

#### 2. Quantum Coherence Issues
```bash
# Monitor CloudWatch metrics
# Check for resource contention
# Verify circuit breaker functionality
```

#### 3. Compliance Violations
```bash
# Review audit logs
# Check framework configurations
# Validate data classification
```

### Debug Commands
```bash
# View Lambda logs
aws logs tail /aws/lambda/remediationGenerator --follow

# Query Neptune directly
curl -X POST https://your-neptune-endpoint:8182/gremlin \
  -d '{"gremlin":"g.V().count()"}'

# Check system health
npm run health-check:production
```

## Maintenance

### 1. Regular Tasks
- Monitor Neptune cluster performance
- Review and rotate IAM credentials
- Update Lambda function dependencies
- Analyze compliance reports
- Optimize quantum algorithms based on metrics

### 2. Quarterly Reviews
- Security assessment
- Performance benchmarking
- Compliance audit
- Cost optimization review
- Disaster recovery testing

## Support and Monitoring

### 1. Operational Metrics
- **Availability**: 99.9% uptime target
- **Performance**: < 5 second average response time
- **Accuracy**: > 95% remediation success rate
- **Compliance**: 100% regulatory adherence

### 2. Contact Information
- **Operations Team**: ops-team@company.com
- **Security Team**: security-team@company.com
- **Compliance Team**: compliance-team@company.com

---

*This deployment guide is maintained by the Terragon SDLC team. Last updated: $(date)*
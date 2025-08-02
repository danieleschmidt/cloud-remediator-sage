# Deployment Guide - Cloud Remediator Sage

## Overview

This guide covers deployment strategies, configurations, and best practices for Cloud Remediator Sage across different environments.

## 🎯 Deployment Environments

### Development Environment
- **Purpose**: Local development and testing
- **Infrastructure**: Docker Compose with full stack
- **Database**: PostgreSQL + Redis (containerized)
- **Monitoring**: Prometheus + Grafana + Jaeger
- **Security**: Basic authentication, non-persistent volumes

### Staging Environment  
- **Purpose**: Pre-production testing and validation
- **Infrastructure**: AWS Lambda + Neptune + ECS
- **Database**: Amazon Neptune (dedicated cluster)
- **Monitoring**: CloudWatch + AWS X-Ray
- **Security**: IAM roles, encrypted storage, VPC isolation

### Production Environment
- **Purpose**: Live workload processing
- **Infrastructure**: Multi-AZ AWS Lambda + Neptune
- **Database**: Neptune Multi-AZ with backup
- **Monitoring**: Full observability stack
- **Security**: End-to-end encryption, audit logging

## 🚀 Quick Start Deployment

### Prerequisites

```bash
# Install required tools
npm install -g @aws-cdk/cli
pip install awscli terraform

# Configure AWS credentials
aws configure

# Verify Docker installation
docker --version
docker-compose --version
```

### Local Development Deployment

```bash
# Clone repository
git clone https://github.com/danieleschmidt/cloud-remediator-sage.git
cd cloud-remediator-sage

# Start full development stack
make quick-start

# Verify deployment
make status
```

**Services Available:**
- Application: http://localhost:3000
- Grafana: http://localhost:3001 (admin/admin_secure_123)
- Prometheus: http://localhost:9090
- Jaeger: http://localhost:16686
- Pact Broker: http://localhost:9292 (pact/pact_secure_123)

## 🏗️ Docker Deployment

### Build & Security Scanning

```bash
# Build with integrated security scanning
make docker-build-security

# Scan existing image for vulnerabilities
make docker-scan

# Generate Software Bill of Materials
make security-sbom
```

### Docker Compose Profiles

```yaml
# Development profile (default)
docker-compose up -d

# Security testing profile
docker-compose --profile security-testing up -d

# Performance testing profile  
docker-compose --profile performance-testing up -d

# Full monitoring stack
docker-compose --profile monitoring up -d
```

## ☁️ AWS Serverless Deployment

### Serverless Framework Deployment

```bash
# Install Serverless Framework
npm install -g serverless

# Configure AWS credentials for Serverless
serverless config credentials --provider aws --key YOUR_KEY --secret YOUR_SECRET

# Deploy to development
serverless deploy --stage dev

# Deploy to staging
serverless deploy --stage staging

# Deploy to production (requires approval)
serverless deploy --stage prod
```

### Environment-Specific Configuration

**Development (`serverless.dev.yml`):**
```yaml
service: cloud-remediator-sage-dev
provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1
  stage: dev
  memorySize: 512
  timeout: 30
  environment:
    NODE_ENV: development
    LOG_LEVEL: debug
    NEPTUNE_ENDPOINT: ${env:NEPTUNE_DEV_ENDPOINT}
```

**Production (`serverless.prod.yml`):**
```yaml
service: cloud-remediator-sage
provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1
  stage: prod
  memorySize: 1024
  timeout: 300
  environment:
    NODE_ENV: production
    LOG_LEVEL: info
    NEPTUNE_ENDPOINT: ${env:NEPTUNE_PROD_ENDPOINT}
  vpc:
    securityGroupIds:
      - ${env:SECURITY_GROUP_ID}
    subnetIds:
      - ${env:PRIVATE_SUBNET_1}
      - ${env:PRIVATE_SUBNET_2}
```

## 🏗️ Infrastructure as Code

### Terraform Deployment

```hcl
# terraform/main.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket = "terragon-terraform-state"
    key    = "cloud-remediator-sage/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region
}

# Neptune cluster for risk graph
resource "aws_neptune_cluster" "risk_graph" {
  cluster_identifier      = "cloud-remediator-neptune-${var.environment}"
  engine                 = "neptune"
  backup_retention_period = 5
  preferred_backup_window = "07:00-09:00"
  skip_final_snapshot    = var.environment == "dev"
  
  vpc_security_group_ids = [aws_security_group.neptune.id]
  neptune_subnet_group_name = aws_neptune_subnet_group.main.name
  
  enable_cloudwatch_logs_exports = ["audit"]
  
  tags = {
    Name        = "CloudRemediatorSage-${var.environment}"
    Environment = var.environment
  }
}
```

### AWS CDK Deployment

```typescript
// cdk/app.ts
import * as cdk from 'aws-cdk-lib';
import { CloudRemediatorStack } from './cloud-remediator-stack';

const app = new cdk.App();

new CloudRemediatorStack(app, 'CloudRemediatorSageDev', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1',
  },
  stage: 'dev',
});

new CloudRemediatorStack(app, 'CloudRemediatorSageProd', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1',
  },
  stage: 'prod',
});
```

## 🔧 Configuration Management

### Environment Variables

**Required Environment Variables:**
```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Neptune Configuration
NEPTUNE_ENDPOINT=wss://your-neptune-cluster.amazonaws.com:8182/gremlin
NEPTUNE_IAM_AUTH=true

# Application Configuration
NODE_ENV=production
LOG_LEVEL=info
MAX_PRS_PER_DAY=5

# GitHub Integration
GITHUB_TOKEN=your-github-token

# S3 Buckets
FINDINGS_BUCKET=cloud-remediator-findings
REMEDIATION_BUCKET=cloud-remediator-remediation

# DynamoDB Tables
RISK_TABLE=cloud-remediator-risks
```

### Configuration Templates

**Development (`.env.dev`):**
```bash
NODE_ENV=development
LOG_LEVEL=debug
NEPTUNE_ENDPOINT=ws://localhost:8182/gremlin
REDIS_URL=redis://localhost:6379
POSTGRES_URL=postgresql://security_user:secure_password_123@localhost:5432/cloud_security
```

**Production (`.env.prod`):**
```bash
NODE_ENV=production
LOG_LEVEL=info
NEPTUNE_ENDPOINT=${NEPTUNE_ENDPOINT}
ENABLE_AUDIT_LOGGING=true
ENCRYPTION_AT_REST=true
```

## 🔒 Security Configuration

### IAM Roles and Policies

**Lambda Execution Role:**
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
        "neptune-db:connect"
      ],
      "Resource": "arn:aws:neptune-db:us-east-1:*:cluster/cloud-remediator-neptune-*/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": [
        "arn:aws:s3:::cloud-remediator-findings/*",
        "arn:aws:s3:::cloud-remediator-remediation/*"
      ]
    }
  ]
}
```

### Network Security

**VPC Configuration:**
```yaml
# Security Groups
NeptuneSecurityGroup:
  Type: AWS::EC2::SecurityGroup
  Properties:
    GroupDescription: Security group for Neptune cluster
    VpcId: !Ref VPC
    SecurityGroupIngress:
      - IpProtocol: tcp
        FromPort: 8182
        ToPort: 8182
        SourceSecurityGroupId: !Ref LambdaSecurityGroup

LambdaSecurityGroup:
  Type: AWS::EC2::SecurityGroup
  Properties:
    GroupDescription: Security group for Lambda functions
    VpcId: !Ref VPC
    SecurityGroupEgress:
      - IpProtocol: tcp
        FromPort: 8182
        ToPort: 8182
        DestinationSecurityGroupId: !Ref NeptuneSecurityGroup
```

## 📊 Monitoring & Observability

### CloudWatch Configuration

```yaml
# CloudWatch Log Groups
LogGroups:
  - /aws/lambda/cloud-remediator-prowler-ingest
  - /aws/lambda/cloud-remediator-risk-scoring
  - /aws/lambda/cloud-remediator-remediation-generator

# CloudWatch Alarms
Alarms:
  - Name: HighErrorRate
    MetricName: Errors
    Threshold: 10
    ComparisonOperator: GreaterThanThreshold
  - Name: HighLatency
    MetricName: Duration
    Threshold: 30000
    ComparisonOperator: GreaterThanThreshold
```

### Custom Metrics

```javascript
// src/monitoring/metrics.js
const { CloudWatch } = require('aws-sdk');
const cloudwatch = new CloudWatch();

async function putMetric(metricName, value, unit = 'Count') {
  await cloudwatch.putMetricData({
    Namespace: 'CloudRemediatorSage',
    MetricData: [{
      MetricName: metricName,
      Value: value,
      Unit: unit,
      Timestamp: new Date()
    }]
  }).promise();
}
```

## 🔄 CI/CD Pipeline Integration

### GitHub Actions Deployment

```yaml
# .github/workflows/deploy.yml
name: Deploy Cloud Remediator Sage

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: make ci-test
      
      - name: Build and scan
        run: make ci-build
      
      - name: Deploy to staging
        if: github.ref == 'refs/heads/main'
        run: serverless deploy --stage staging
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Deploy to production
        if: github.ref == 'refs/heads/main'
        run: serverless deploy --stage prod
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_PROD_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_PROD_SECRET_ACCESS_KEY }}
```

## 🎛️ Deployment Commands Reference

### Development Deployment

```bash
# Quick development setup
make quick-start

# Manual step-by-step
make install
make dev-full
make status
```

### Production Deployment

```bash
# Full CI/CD pipeline
make ci-deploy

# Manual production deployment
make docker-build-security
make security-scan
make deploy-prod-confirmed
```

### Deployment Verification

```bash
# Check service health
curl https://api.cloudremediatorsage.com/health

# Check metrics endpoint
curl https://api.cloudremediatorsage.com/metrics

# View logs
aws logs tail /aws/lambda/cloud-remediator-prowler-ingest

# Check Neptune connectivity
aws neptune describe-db-clusters --db-cluster-identifier cloud-remediator-neptune-prod
```

## 🚨 Troubleshooting

### Common Deployment Issues

**1. Neptune Connection Timeouts**
```bash
# Check VPC configuration
aws ec2 describe-security-groups --group-ids sg-neptune

# Test connectivity from Lambda
aws lambda invoke --function-name test-neptune-connection output.json
```

**2. Permission Denied Errors**
```bash
# Verify IAM roles
aws iam get-role --role-name cloud-remediator-lambda-role

# Check policy attachments
aws iam list-attached-role-policies --role-name cloud-remediator-lambda-role
```

**3. Docker Build Failures**
```bash
# Clear Docker cache
docker system prune -a

# Build with verbose output
docker build --no-cache --progress=plain -t cloud-remediator-sage .
```

### Rollback Procedures

**Serverless Rollback:**
```bash
# List deployments
serverless deploy list --stage prod

# Rollback to previous version
serverless rollback --timestamp 2025-08-02T12:00:00.000Z --stage prod
```

**Database Rollback:**
```bash
# Create snapshot before deployment
aws neptune create-db-cluster-snapshot \
  --db-cluster-identifier cloud-remediator-neptune-prod \
  --db-cluster-snapshot-identifier pre-deployment-$(date +%Y%m%d)

# Restore from snapshot if needed
aws neptune restore-db-cluster-from-snapshot \
  --db-cluster-identifier cloud-remediator-neptune-rollback \
  --snapshot-identifier pre-deployment-20250802
```

## 📋 Post-Deployment Checklist

### Verification Steps

- [ ] Application health checks pass
- [ ] Neptune cluster is accessible
- [ ] S3 buckets are configured correctly
- [ ] IAM roles have required permissions
- [ ] CloudWatch logs are being generated
- [ ] Metrics are flowing to monitoring systems
- [ ] Security scans show no critical vulnerabilities
- [ ] Integration tests pass against deployed environment

### Performance Validation

- [ ] Response times meet SLA requirements (<500ms for 95th percentile)
- [ ] Memory usage is within expected bounds
- [ ] CPU utilization is reasonable under load
- [ ] Error rates are below 1%
- [ ] Throughput meets capacity requirements

### Security Validation

- [ ] All communications are encrypted in transit
- [ ] Data at rest encryption is enabled
- [ ] Access logs are being captured
- [ ] No hardcoded credentials in deployment
- [ ] Network access is restricted to required ports/IPs
- [ ] WAF rules are active (if applicable)

## 📞 Support and Escalation

### Monitoring Dashboards
- **Grafana**: Application metrics and performance
- **CloudWatch**: AWS service metrics and logs
- **Jaeger**: Distributed tracing and request flow

### Emergency Contacts
- **On-call Engineer**: alerts@terragon.ai
- **DevOps Team**: devops@terragon.ai
- **Security Team**: security@terragon.ai

### Escalation Procedures
1. **P1 (Critical)**: Immediate notification + auto-rollback
2. **P2 (High)**: 15-minute response time
3. **P3 (Medium)**: 1-hour response time
4. **P4 (Low)**: Next business day

---

**Last Updated**: 2025-08-02  
**Maintained By**: Cloud Remediator Sage DevOps Team
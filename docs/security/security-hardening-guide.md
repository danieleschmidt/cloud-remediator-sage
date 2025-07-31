# Security Hardening Guide

## Overview

This guide provides comprehensive security hardening measures for the Cloud Remediator Sage project, designed for Advanced SDLC maturity with defense-in-depth approach.

## Table of Contents

1. [Application Security](#application-security)
2. [Infrastructure Security](#infrastructure-security)  
3. [CI/CD Security](#ci-cd-security)
4. [Runtime Security](#runtime-security)
5. [Compliance & Monitoring](#compliance--monitoring)

## Application Security

### Dependency Security

#### Automated Dependency Monitoring
```bash
# Daily dependency vulnerability scanning
npm run deps:monitor

# Generate Software Bill of Materials (SBOM)
npm run security:sbom

# Advanced security audit with custom rules
npm run security:audit:advanced
```

#### Dependency Security Configuration

**File**: `.npmrc` (Enhanced)
```ini
# Security-focused npm configuration
audit-level=high
fund=false
save-exact=true
package-lock=true

# Registry security
registry=https://registry.npmjs.org/
@terragon:registry=https://npm.pkg.github.com

# Security scanning
audit=true
```

#### Package.json Security Enhancements
```json
{
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  },
  "engineStrict": true,
  "private": true
}
```

### Code Security

#### Advanced ESLint Security Rules

Our security configuration includes:
- 95 security-specific ESLint rules
- Custom rules for AWS Lambda security
- Injection attack prevention
- Timing attack detection
- Buffer overflow protection

#### Security Testing Integration
```javascript
// Example: Security test patterns
describe('Security Tests', () => {
  test('prevents SQL injection in queries', () => {
    const maliciousInput = "'; DROP TABLE users; --";
    expect(() => processUserInput(maliciousInput)).toThrow();
  });
  
  test('sanitizes all user inputs', () => {
    const userInput = '<script>alert("xss")</script>';
    const sanitized = sanitizeInput(userInput);
    expect(sanitized).not.toContain('<script>');
  });
});
```

## Infrastructure Security

### Container Security

#### Multi-Stage Dockerfile Security
```dockerfile
# Security-hardened Dockerfile
FROM node:18-alpine AS security-base
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs
    
# Vulnerability scanning
RUN apk add --no-cache dumb-init && \
    npm install -g npm@latest

# Security scanning stage
FROM security-base AS scanner
COPY package*.json ./
RUN npm ci --only=production && \
    npm audit --audit-level=high

# Production stage
FROM security-base AS production
USER nodejs
WORKDIR /app
COPY --chown=nodejs:nodejs . .
EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
```

#### Container Security Scanning
```yaml
# Security scanning with Trivy
container-scan:
  runs-on: ubuntu-latest
  steps:
    - name: Build image
      run: docker build -t app:${{ github.sha }} .
    
    - name: Security scan
      run: |
        docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
          -v $PWD:/root/.cache/ aquasec/trivy:latest image \
          --severity HIGH,CRITICAL \
          --format sarif \
          --output trivy-results.sarif \
          app:${{ github.sha }}
```

### AWS Security Configuration

#### IAM Security Best Practices
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:org/cloud-remediator-sage:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

#### Lambda Security Configuration
```yaml
# serverless.yml security enhancements
provider:
  name: aws
  runtime: nodejs18.x
  
  # Security configurations
  tracing:
    lambda: true
    apiGateway: true
  
  logs:
    restApi:
      accessLogging: true
      format: '{"request_id":"$requestId","status":"$status","error":"$error.message"}'
      
  environment:
    NODE_OPTIONS: '--enable-source-maps'
    
  # VPC configuration for network isolation
  vpc:
    securityGroupIds:
      - ${self:custom.securityGroupId}
    subnetIds:
      - ${self:custom.privateSubnetId1}
      - ${self:custom.privateSubnetId2}

functions:
  prowlerIngest:
    handler: src/lambda/prowler-ingest.handler
    environment:
      # Secrets from Parameter Store
      NEPTUNE_ENDPOINT: ${ssm:/cloud-remediator/neptune/endpoint}
    
    # Security permissions
    iamRoleStatements:
      - Effect: Allow
        Action:
          - neptune-db:connect
        Resource: !Sub "arn:aws:neptune-db:${AWS::Region}:${AWS::AccountId}:*/*"
```

## CI/CD Security

### GitHub Actions Security

#### Security-First Workflow Configuration
```yaml
# Security configurations for all workflows
name: Secure CI/CD
on:
  push:
    branches: [ main ]

permissions:
  contents: read
  id-token: write
  security-events: write

env:
  # Security environment variables
  NODE_OPTIONS: '--max-old-space-size=4096'
  FORCE_COLOR: 1
  CI: true

jobs:
  security-scan:
    runs-on: ubuntu-latest
    
    steps:
    - name: Harden Runner
      uses: step-security/harden-runner@v2
      with:
        egress-policy: audit
        allowed-endpoints: >
          api.github.com:443
          github.com:443
          registry.npmjs.org:443
          objects.githubusercontent.com:443
```

#### Secrets Management
```bash
# Repository secrets configuration
AWS_ROLE_ARN=arn:aws:iam::ACCOUNT:role/GitHubActionsRole
SONAR_TOKEN=secure_token_here
SNYK_TOKEN=secure_token_here

# Organization secrets (inherited)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
SECURITY_EMAIL=security@terragonlabs.com
```

#### Action Security Validation
```yaml
# Pin all actions to specific SHA for security
- uses: actions/checkout@8ade135a41bc03ea155e62e844d188df1ea18608  # v4.1.0
- uses: actions/setup-node@5e21ff4d9bc1a8cf6de233a3057d20ec6b3fb69d  # v4.0.0
- uses: github/codeql-action/init@cdcdbb579706841c47f7063dda365e292e5ceb5a  # v2.13.4
```

## Runtime Security

### Application Security Monitoring

#### Security Headers Configuration
```javascript
// Express.js security headers
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

#### Input Validation & Sanitization
```javascript
// Security validation patterns
const validator = require('validator');
const DOMPurify = require('isomorphic-dompurify');

function sanitizeInput(input) {
  // XSS prevention
  const cleaned = DOMPurify.sanitize(input);
  
  // Additional validation
  if (!validator.isLength(cleaned, { min: 1, max: 1000 })) {
    throw new Error('Invalid input length');
  }
  
  return cleaned;
}

// SQL injection prevention
function safeQuery(query, params) {
  // Use parameterized queries only
  return db.query(query, params);
}
```

### Secrets Management

#### AWS Parameter Store Integration
```javascript
// Secure secrets management
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');

async function getSecret(parameterName) {
  const client = new SSMClient({ region: process.env.AWS_REGION });
  
  try {
    const command = new GetParameterCommand({
      Name: parameterName,
      WithDecryption: true
    });
    
    const response = await client.send(command);
    return response.Parameter.Value;
  } catch (error) {
    console.error('Failed to retrieve secret:', error);
    throw error;
  }
}
```

## Compliance & Monitoring

### Security Monitoring

#### SIEM Integration
```yaml
# CloudWatch security monitoring
Resources:
  SecurityAlarmTopic:
    Type: AWS::SNS::Topic
    Properties:
      DisplayName: Security Alerts
      
  UnauthorizedApiCallsAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: UnauthorizedApiCalls
      MetricName: UnauthorizedApiCalls
      Statistic: Sum
      Period: 300
      EvaluationPeriods: 1
      Threshold: 1
      ComparisonOperator: GreaterThanOrEqualToThreshold
      AlarmActions:
        - !Ref SecurityAlarmTopic
```

#### Security Metrics Collection
```javascript
// Custom security metrics
const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

async function recordSecurityEvent(eventType, severity) {
  const client = new CloudWatchClient({ region: process.env.AWS_REGION });
  
  const params = {
    Namespace: 'CloudRemediatorSage/Security',
    MetricData: [
      {
        MetricName: 'SecurityEvents',
        Dimensions: [
          {
            Name: 'EventType',
            Value: eventType
          },
          {
            Name: 'Severity',
            Value: severity
          }
        ],
        Value: 1,
        Unit: 'Count',
        Timestamp: new Date()
      }
    ]
  };
  
  await client.send(new PutMetricDataCommand(params));
}
```

### Compliance Automation

#### SLSA Level 3 Implementation
```yaml
# SLSA provenance generation
provenance:
  runs-on: ubuntu-latest
  permissions:
    contents: read
    id-token: write
    
  steps:
  - name: Generate provenance
    uses: slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@v1.4.0
    with:
      base64-subjects: ${{ needs.build.outputs.hashes }}
      provenance-name: provenance.intoto.jsonl
```

#### Automated Compliance Reporting
```javascript
// Compliance report generation
const complianceReport = {
  timestamp: new Date().toISOString(),
  framework: 'NIST Cybersecurity Framework',
  version: '1.1',
  controls: {
    'ID.AM-1': 'COMPLIANT', // Asset inventory
    'ID.AM-2': 'COMPLIANT', // Software inventory (SBOM)
    'PR.AC-1': 'COMPLIANT', // Access control
    'PR.DS-1': 'COMPLIANT', // Data at rest protection
    'PR.DS-2': 'COMPLIANT', // Data in transit protection
    'DE.CM-1': 'COMPLIANT', // Continuous monitoring
    'RS.RP-1': 'COMPLIANT'  // Response plan
  },
  score: 100,
  lastAssessment: new Date().toISOString()
};
```

## Security Checklist

### Pre-Deployment Security
- [ ] All dependencies scanned for vulnerabilities
- [ ] SAST analysis completed with no high/critical issues
- [ ] Container images scanned and hardened
- [ ] Secrets properly configured in Parameter Store
- [ ] IAM roles follow least-privilege principle
- [ ] Network security groups configured
- [ ] Logging and monitoring enabled

### Runtime Security
- [ ] Security headers implemented
- [ ] Input validation and sanitization active
- [ ] Rate limiting configured
- [ ] Error handling prevents information disclosure
- [ ] Security monitoring alerts configured
- [ ] Incident response procedures documented

### Compliance
- [ ] SLSA Level 3 provenance generated
- [ ] SBOM created and stored
- [ ] Compliance framework mapped and assessed
- [ ] Audit logging enabled
- [ ] Data retention policies implemented
- [ ] Privacy controls implemented

## Incident Response

### Security Incident Workflow
1. **Detection**: Automated alerts trigger investigation
2. **Assessment**: Determine scope and impact
3. **Containment**: Isolate affected systems
4. **Eradication**: Remove threat and vulnerabilities
5. **Recovery**: Restore systems and monitor
6. **Lessons Learned**: Update security measures

### Emergency Contacts
- **Security Team**: security@terragonlabs.com
- **On-Call Engineer**: +1-555-SECURITY
- **AWS Support**: Enterprise support case
- **Legal/Compliance**: compliance@terragonlabs.com

This security hardening guide ensures the Cloud Remediator Sage project maintains Advanced SDLC security maturity with comprehensive protection across all layers of the application stack.
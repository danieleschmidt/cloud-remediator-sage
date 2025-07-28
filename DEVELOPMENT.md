# Developer Guide

## Overview

This guide provides comprehensive instructions for setting up, developing, and contributing to the Cloud Remediator Sage project. This is a serverless security automation platform built to enhance cloud security posture management (CSPM).

## Table of Contents

- [Quick Start](#quick-start)
- [Development Environment Setup](#development-environment-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing Strategy](#testing-strategy)
- [Security Guidelines](#security-guidelines)
- [Performance Considerations](#performance-considerations)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Prerequisites

- **Node.js**: Version 18.x or higher
- **npm**: Version 8.x or higher
- **AWS CLI**: Configured with appropriate credentials
- **Docker**: For local testing and containerization
- **Git**: For version control

### Installation

```bash
# Clone the repository
git clone https://github.com/terragonlabs/cloud-remediator-sage.git
cd cloud-remediator-sage

# Install dependencies
npm install

# Install development tools
npm run prepare

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
```

### Environment Configuration

Create a `.env` file with the following variables:

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_PROFILE=default

# Neptune Database
NEPTUNE_ENDPOINT=your-neptune-cluster.cluster-xxx.us-east-1.neptune.amazonaws.com

# S3 Configuration
PROWLER_BUCKET=your-prowler-results-bucket

# Environment
STAGE=development
DEBUG=true

# Security
LOG_SIGNING_KEY=your-log-signing-key
ENCRYPTION_KEY=your-encryption-key

# Monitoring
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
PAGERDUTY_SERVICE_KEY=your-pagerduty-service-key
```

### First Run

```bash
# Run tests to verify setup
npm test

# Run security scan
npm run security:scan

# Start local development
npm run dev

# Generate SBOM
npm run security:sbom
```

## Development Environment Setup

### IDE Configuration

#### Visual Studio Code

Recommended extensions:
- ESLint
- Prettier
- Jest
- AWS Toolkit
- GitLens
- SonarLint

Configuration (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "eslint.autoFixOnSave": true,
  "files.associations": {
    "*.yml": "yaml",
    "*.yaml": "yaml"
  },
  "aws.telemetry": false,
  "jest.autoRun": "watch"
}
```

#### IntelliJ IDEA / WebStorm

- Enable ESLint integration
- Configure Jest test runner
- Install AWS CloudFormation plugin
- Set up Prettier as code formatter

### Local Development Tools

#### AWS LocalStack (Optional)

For local AWS service emulation:

```bash
# Install LocalStack
pip install localstack

# Start LocalStack
localstack start

# Configure AWS CLI for LocalStack
aws configure set endpoint-url http://localhost:4566 --profile localstack
```

#### Docker Development

```bash
# Build development image
docker build -f Dockerfile.dev -t cloud-remediator-sage:dev .

# Run development container
docker run -it --rm -v $(pwd):/app cloud-remediator-sage:dev bash

# Run tests in container
docker run --rm -v $(pwd):/app cloud-remediator-sage:dev npm test
```

## Project Structure

```
cloud-remediator-sage/
├── src/                          # Source code
│   ├── lambda/                   # Lambda function handlers
│   │   ├── prowler-ingest.js     # Security findings ingestion
│   │   ├── risk-scoring.js       # Risk calculation engine
│   │   └── remediation-generator.js # Remediation script generator
│   ├── backlog/                  # Autonomous backlog management
│   │   ├── discovery.js          # Feature discovery
│   │   ├── executor.js           # Task execution
│   │   ├── metrics.js            # Metrics collection
│   │   ├── security.js           # Security requirements
│   │   └── wsjf.js               # WSJF prioritization
│   └── monitoring/               # Observability components
│       ├── health.js             # Health check endpoints
│       ├── logger.js             # Structured logging
│       └── metrics.js            # Prometheus metrics
├── tests/                        # Test suites
│   ├── unit/                     # Unit tests
│   ├── integration/              # Integration tests
│   ├── contract/                 # Contract tests
│   ├── performance/              # Performance tests
│   ├── security/                 # Security tests
│   └── fixtures/                 # Test data
├── docs/                         # Documentation
│   ├── api/                      # API documentation
│   ├── guides/                   # User guides
│   ├── runbooks/                 # Operational procedures
│   ├── adr/                      # Architecture decision records
│   └── compliance/               # Compliance documentation
├── scripts/                      # Utility scripts
│   ├── generate-sbom.js          # SBOM generation
│   ├── security-scan.js          # Security scanning
│   └── deploy.sh                 # Deployment scripts
├── monitoring/                   # Monitoring configuration
│   └── alerting-config.yml       # Alert rules and thresholds
├── .github/                      # GitHub workflows
│   ├── workflows/                # CI/CD pipelines
│   └── templates/                # Issue/PR templates
└── infrastructure/               # Infrastructure as Code
    ├── cloudformation/           # CloudFormation templates
    └── terraform/                # Terraform modules
```

### Core Components

#### Lambda Functions

1. **Prowler Ingest** (`src/lambda/prowler-ingest.js`)
   - Processes security findings from S3
   - Validates and normalizes finding data
   - Stores findings in Neptune graph database

2. **Risk Scoring** (`src/lambda/risk-scoring.js`)
   - Calculates risk scores for security findings
   - Applies business logic and compliance requirements
   - Updates risk assessments in real-time

3. **Remediation Generator** (`src/lambda/remediation-generator.js`)
   - Generates Infrastructure as Code remediation scripts
   - Supports multiple IaC formats (CloudFormation, Terraform)
   - Provides automated fix suggestions

#### Monitoring System

1. **Health Checks** (`src/monitoring/health.js`)
   - Comprehensive system health monitoring
   - Component-specific health checks
   - Correlation ID tracking

2. **Structured Logging** (`src/monitoring/logger.js`)
   - Centralized logging with correlation IDs
   - Security event logging
   - Audit trail generation

3. **Metrics Collection** (`src/monitoring/metrics.js`)
   - Prometheus metrics export
   - Custom business metrics
   - Performance monitoring

#### Autonomous Backlog

1. **Discovery Engine** (`src/backlog/discovery.js`)
   - Automated feature discovery
   - Security requirement analysis
   - Technical debt identification

2. **WSJF Prioritization** (`src/backlog/wsjf.js`)
   - Weighted Shortest Job First algorithm
   - Business value calculation
   - Risk-based prioritization

## Development Workflow

### Git Workflow

We follow the **Gitflow** branching model:

```bash
# Main branches
main                  # Production-ready code
develop              # Integration branch for features

# Supporting branches
feature/feature-name # Feature development
release/version      # Release preparation
hotfix/fix-name     # Production hotfixes
```

### Feature Development Process

1. **Create Feature Branch**
```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
```

2. **Development Loop**
```bash
# Make changes
# Write tests
npm test

# Run security checks
npm run security:scan

# Commit changes (triggers pre-commit hooks)
git add .
git commit -m "feat: add new feature description"
```

3. **Pre-Merge Checklist**
- [ ] All tests pass
- [ ] Security scan passes
- [ ] Code coverage maintained
- [ ] Documentation updated
- [ ] ADR created (if architectural changes)

4. **Create Pull Request**
```bash
git push origin feature/your-feature-name
# Create PR through GitHub interface
```

### Code Style and Standards

#### ESLint Configuration

```javascript
// .eslintrc.js
module.exports = {
  env: {
    node: true,
    es2022: true,
    jest: true
  },
  extends: [
    'eslint:recommended',
    '@eslint/js/recommended'
  ],
  rules: {
    'no-console': 'warn',
    'no-unused-vars': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-arrow-callback': 'error'
  }
};
```

#### Security-Specific ESLint Rules

```javascript
// .eslintrc.security.js
module.exports = {
  extends: ['.eslintrc.js'],
  plugins: ['security'],
  rules: {
    'security/detect-object-injection': 'error',
    'security/detect-non-literal-regexp': 'error',
    'security/detect-unsafe-regex': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-no-csrf-before-method-override': 'error'
  }
};
```

#### Naming Conventions

- **Files**: kebab-case (`risk-scoring.js`)
- **Variables**: camelCase (`securityFinding`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRY_ATTEMPTS`)
- **Classes**: PascalCase (`SecurityAnalyzer`)
- **Functions**: camelCase (`calculateRiskScore`)

### Commit Message Convention

We follow [Conventional Commits](https://conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions or modifications
- `chore`: Maintenance tasks
- `security`: Security-related changes

Examples:
```
feat(security): add vulnerability severity scoring
fix(lambda): resolve timeout issue in remediation generator
docs(api): update endpoint documentation
security(deps): update vulnerable dependencies
```

## Testing Strategy

### Test Types and Coverage

1. **Unit Tests** (>90% coverage target)
   - Individual function testing
   - Mock external dependencies
   - Fast execution (<1s per test)

2. **Integration Tests**
   - Component interaction testing
   - Database integration
   - AWS service integration (with LocalStack)

3. **Contract Tests**
   - API contract verification
   - Schema validation
   - Backward compatibility

4. **Performance Tests**
   - Load testing with k6
   - Memory usage monitoring
   - Lambda cold start optimization

5. **Security Tests**
   - Vulnerability scanning
   - Penetration testing scenarios
   - Input validation testing

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# Contract tests
npm run test:contract

# Performance tests
cd tests/performance && npm run load-test

# Security tests
npm run security:scan

# Coverage report
npm test -- --coverage
```

### Writing Tests

#### Unit Test Example

```javascript
// tests/unit/risk-scoring.test.js
const { calculateRiskScore } = require('../../src/lambda/risk-scoring');

describe('Risk Scoring', () => {
  describe('calculateRiskScore', () => {
    it('should calculate high risk score for critical vulnerabilities', () => {
      const finding = {
        severity: 'critical',
        cvssScore: 9.8,
        exploitability: 'high',
        asset: { criticality: 'high' }
      };

      const score = calculateRiskScore(finding);
      
      expect(score).toBeGreaterThan(8.0);
      expect(score).toBeLessThanOrEqual(10.0);
    });

    it('should handle missing CVSS score gracefully', () => {
      const finding = {
        severity: 'medium',
        exploitability: 'medium',
        asset: { criticality: 'medium' }
      };

      expect(() => calculateRiskScore(finding)).not.toThrow();
    });
  });
});
```

#### Integration Test Example

```javascript
// tests/integration/lambda-integration.test.js
const AWS = require('aws-sdk');
const { handler } = require('../../src/lambda/prowler-ingest');

// Mock AWS services
jest.mock('aws-sdk');

describe('Prowler Ingest Integration', () => {
  beforeEach(() => {
    // Set up mocks
    AWS.S3.mockImplementation(() => ({
      getObject: jest.fn().mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Body: JSON.stringify({ findings: [] })
        })
      })
    }));
  });

  it('should process S3 event successfully', async () => {
    const event = {
      Records: [{
        s3: {
          bucket: { name: 'test-bucket' },
          object: { key: 'findings.json' }
        }
      }]
    };

    const result = await handler(event);
    
    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('processed');
  });
});
```

### Test Data Management

#### Fixtures

```javascript
// tests/fixtures/security-findings.js
module.exports = {
  criticalFinding: {
    id: 'finding-001',
    severity: 'critical',
    title: 'S3 Bucket Publicly Accessible',
    description: 'S3 bucket allows public read access',
    resource: {
      type: 'AWS::S3::Bucket',
      id: 'arn:aws:s3:::my-bucket',
      region: 'us-east-1'
    },
    compliance: ['CIS-AWS-1.3.0'],
    cvssScore: 7.5
  },
  
  mediumFinding: {
    id: 'finding-002',
    severity: 'medium',
    title: 'Security Group Too Permissive',
    description: 'Security group allows 0.0.0.0/0 on port 22',
    resource: {
      type: 'AWS::EC2::SecurityGroup',
      id: 'sg-12345678',
      region: 'us-east-1'
    },
    compliance: ['CIS-AWS-2.1.0'],
    cvssScore: 5.3
  }
};
```

### Mocking Strategies

#### AWS SDK Mocking

```javascript
// tests/mocks/aws-sdk.js
const mockS3 = {
  getObject: jest.fn(),
  putObject: jest.fn(),
  listObjects: jest.fn()
};

const mockNeptune = {
  describeDBClusters: jest.fn()
};

const mockLambda = {
  invoke: jest.fn()
};

module.exports = {
  S3: jest.fn(() => mockS3),
  Neptune: jest.fn(() => mockNeptune),
  Lambda: jest.fn(() => mockLambda),
  mockS3,
  mockNeptune,
  mockLambda
};
```

## Security Guidelines

### Security Best Practices

1. **Input Validation**
   - Validate all external inputs
   - Use schema validation (Joi, Ajv)
   - Sanitize user data

2. **Secret Management**
   - Never commit secrets to version control
   - Use AWS Secrets Manager or Parameter Store
   - Rotate credentials regularly

3. **Error Handling**
   - Don't expose internal errors to users
   - Log security events appropriately
   - Use correlation IDs for tracing

4. **Dependency Management**
   - Regular dependency updates
   - Vulnerability scanning
   - License compliance checking

### Security Testing

#### Vulnerability Scanning

```bash
# Run comprehensive security scan
npm run security:scan

# Check for outdated packages
npm outdated

# Audit dependencies
npm audit

# Generate SBOM
npm run security:sbom
```

#### Static Analysis

```bash
# ESLint security rules
npm run lint:security

# Additional SAST tools (if configured)
# CodeQL, SonarQube, etc.
```

### Secure Coding Examples

#### Input Validation

```javascript
const Joi = require('joi');

const findingSchema = Joi.object({
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').required(),
  title: Joi.string().max(200).required(),
  description: Joi.string().max(1000).required()
});

function validateFinding(data) {
  const { error, value } = findingSchema.validate(data);
  if (error) {
    throw new ValidationError(error.message);
  }
  return value;
}
```

#### Secret Handling

```javascript
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();

async function getSecret(secretName) {
  try {
    const result = await secretsManager.getSecretValue({
      SecretId: secretName
    }).promise();
    
    return JSON.parse(result.SecretString);
  } catch (error) {
    logger.error('Failed to retrieve secret', error);
    throw new Error('Secret retrieval failed');
  }
}

// Usage
const dbCredentials = await getSecret('prod/neptune/credentials');
```

#### Error Handling

```javascript
class SecurityError extends Error {
  constructor(message, code = 'SECURITY_ERROR') {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
    this.timestamp = new Date().toISOString();
  }
}

function handleSecurityError(error, correlationId) {
  // Log security event
  logger.security('security_error', correlationId, {
    errorType: error.constructor.name,
    errorCode: error.code,
    message: error.message
  });

  // Return sanitized error to user
  return {
    error: 'Security validation failed',
    correlationId,
    timestamp: new Date().toISOString()
  };
}
```

## Performance Considerations

### Lambda Optimization

#### Cold Start Reduction

```javascript
// Connection pooling
let neptuneClient = null;

function getNeptuneClient() {
  if (!neptuneClient) {
    neptuneClient = new gremlin.driver.Client(
      process.env.NEPTUNE_ENDPOINT,
      { 
        traversalSource: 'g',
        pool: { maxSize: 10 }
      }
    );
  }
  return neptuneClient;
}

// Lazy loading
const config = {
  get awsRegion() {
    return process.env.AWS_REGION || 'us-east-1';
  }
};
```

#### Memory Optimization

```javascript
// Streaming for large datasets
const stream = require('stream');
const { Transform } = stream;

class FindingProcessor extends Transform {
  constructor(options) {
    super({ objectMode: true, ...options });
    this.processedCount = 0;
  }

  _transform(finding, encoding, callback) {
    try {
      const processed = this.processFinding(finding);
      this.processedCount++;
      
      // Emit processed finding
      this.push(processed);
      callback();
    } catch (error) {
      callback(error);
    }
  }

  processFinding(finding) {
    // Process individual finding
    return {
      ...finding,
      processed: true,
      timestamp: new Date().toISOString()
    };
  }
}
```

### Database Optimization

#### Neptune Query Optimization

```javascript
// Efficient graph traversals
async function findRelatedResources(resourceId, maxDepth = 3) {
  const query = g
    .V()
    .has('resourceId', resourceId)
    .repeat(out().simplePath())
    .times(maxDepth)
    .dedup()
    .limit(100)
    .valueMap(true);

  return await client.submit(query);
}

// Batch operations
async function batchInsertFindings(findings) {
  const batchSize = 25;
  const batches = [];
  
  for (let i = 0; i < findings.length; i += batchSize) {
    batches.push(findings.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    await insertFindingsBatch(batch);
  }
}
```

### Monitoring Performance

```javascript
// Performance metrics
const { metrics } = require('./monitoring/metrics');

function withPerformanceMonitoring(fn) {
  return async (...args) => {
    const timer = metrics.createTimer();
    const startMemory = process.memoryUsage();
    
    try {
      const result = await fn(...args);
      const duration = timer.end();
      const endMemory = process.memoryUsage();
      
      metrics.observeHistogram('function_duration', duration, {
        function: fn.name
      });
      
      metrics.setGauge('memory_delta', 
        endMemory.heapUsed - startMemory.heapUsed, {
        function: fn.name
      });
      
      return result;
    } catch (error) {
      timer.end();
      throw error;
    }
  };
}
```

## Deployment

### Environment Management

#### Development
```bash
# Deploy to development
npm run deploy:dev

# Or with Serverless Framework
serverless deploy --stage dev
```

#### Staging
```bash
# Deploy to staging
npm run deploy:staging

# Run integration tests
npm run test:integration:staging
```

#### Production
```bash
# Deploy to production (requires approval)
npm run deploy:prod

# Monitor deployment
npm run monitor:deployment
```

### Infrastructure as Code

#### Serverless Framework Configuration

```yaml
# serverless.yml
service: cloud-remediator-sage

provider:
  name: aws
  runtime: nodejs18.x
  region: ${opt:region, 'us-east-1'}
  stage: ${opt:stage, 'dev'}
  
  environment:
    STAGE: ${self:provider.stage}
    LOG_LEVEL: ${env:LOG_LEVEL, 'info'}
  
  iamRoleStatements:
    - Effect: Allow
      Action:
        - neptune-db:connect
      Resource: "*"

functions:
  prowlerIngest:
    handler: src/lambda/prowler-ingest.handler
    timeout: 300
    memorySize: 512
    events:
      - s3:
          bucket: ${env:PROWLER_BUCKET}
          event: s3:ObjectCreated:*
```

#### Environment-Specific Configurations

```bash
# config/dev.yml
region: us-east-1
memorySize: 256
timeout: 30
logLevel: debug

# config/prod.yml
region: us-east-1
memorySize: 512
timeout: 60
logLevel: info
```

### CI/CD Pipeline

#### GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Security scan
        run: npm run security:scan
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to production
        run: npm run deploy:prod
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

## Contributing

### Getting Started

1. **Fork the Repository**
2. **Create a Feature Branch**
3. **Make Your Changes**
4. **Write Tests**
5. **Update Documentation**
6. **Submit a Pull Request**

### Pull Request Process

1. **Pre-submission Checklist**
   - [ ] Tests pass
   - [ ] Security scan passes
   - [ ] Documentation updated
   - [ ] Changelog entry added

2. **PR Description Template**
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing completed

## Security Considerations
- [ ] Security impact assessed
- [ ] No sensitive data exposed
- [ ] Authentication/authorization considered
```

3. **Review Process**
   - Code review by at least 2 team members
   - Security review for security-related changes
   - Architecture review for significant changes

### Development Best Practices

1. **Small, Focused Changes**
   - One logical change per PR
   - Easy to review and understand
   - Reduces merge conflicts

2. **Test-Driven Development**
   - Write tests before implementation
   - Maintain high test coverage
   - Include both positive and negative tests

3. **Documentation**
   - Update relevant documentation
   - Include code comments for complex logic
   - Update API documentation

4. **Performance Awareness**
   - Consider performance implications
   - Profile critical paths
   - Monitor resource usage

## Troubleshooting

### Common Issues

#### Lambda Function Timeouts

**Symptoms:**
- Functions timing out after 30 seconds
- Incomplete processing of large datasets

**Solutions:**
1. Increase timeout in `serverless.yml`
2. Optimize database queries
3. Implement pagination for large datasets
4. Use asynchronous processing patterns

```javascript
// Pagination example
async function processLargeDataset(data, batchSize = 100) {
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    await processBatch(batch);
    
    // Prevent timeout
    if (context.getRemainingTimeInMillis() < 30000) {
      // Schedule continuation
      await scheduleNextBatch(i + batchSize);
      break;
    }
  }
}
```

#### Neptune Connection Issues

**Symptoms:**
- Connection timeout errors
- Authentication failures

**Solutions:**
1. Check VPC and security group configuration
2. Verify IAM permissions
3. Implement connection retry logic
4. Use connection pooling

```javascript
// Connection retry logic
async function connectWithRetry(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = new gremlin.driver.Client(endpoint);
      await client.submit('g.V().limit(1)'); // Test connection
      return client;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```

#### Memory Issues

**Symptoms:**
- Out of memory errors
- Poor performance with large datasets

**Solutions:**
1. Increase Lambda memory allocation
2. Implement streaming processing
3. Optimize data structures
4. Use garbage collection optimization

```javascript
// Memory optimization
function processLargeFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = fs.createReadStream(filePath)
      .pipe(JSONStream.parse('*'))
      .on('data', (data) => {
        const processed = processItem(data);
        results.push(processed);
        
        // Periodic cleanup
        if (results.length % 1000 === 0) {
          global.gc && global.gc();
        }
      })
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}
```

### Debug Mode

Enable verbose logging for troubleshooting:

```bash
# Set debug environment
export DEBUG=true
export LOG_LEVEL=debug

# Run with debug logging
npm run dev
```

### Performance Profiling

```bash
# Profile memory usage
node --inspect src/lambda/prowler-ingest.js

# Profile CPU usage
node --prof src/lambda/prowler-ingest.js

# Analyze profile
node --prof-process isolate-*.log > profile.txt
```

### Health Check Debugging

```bash
# Check individual components
curl https://api.yourdomain.com/health/neptune
curl https://api.yourdomain.com/health/s3

# Check metrics
curl https://api.yourdomain.com/metrics
```

## Resources

### Documentation
- [AWS Lambda Developer Guide](https://docs.aws.amazon.com/lambda/latest/dg/)
- [AWS Neptune User Guide](https://docs.aws.amazon.com/neptune/latest/userguide/)
- [Serverless Framework Documentation](https://www.serverless.com/framework/docs/)

### Tools
- [AWS CLI](https://aws.amazon.com/cli/)
- [Serverless Framework](https://www.serverless.com/)
- [Jest Testing Framework](https://jestjs.io/)
- [ESLint](https://eslint.org/)

### Community
- [GitHub Discussions](https://github.com/terragonlabs/cloud-remediator-sage/discussions)
- [Slack Workspace](https://terragonlabs.slack.com)
- [Security Mailing List](mailto:security@terragonlabs.com)

---

**Document Version**: 1.0  
**Last Updated**: July 27, 2025  
**Next Review**: October 27, 2025  
**Maintainer**: Development Team
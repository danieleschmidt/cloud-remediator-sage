# Testing Guide - Cloud Remediator Sage

## Overview

Cloud Remediator Sage uses a comprehensive testing strategy with multiple types of tests to ensure code quality, security, and performance. This guide covers our testing framework, patterns, and best practices.

## 🧪 Testing Framework

### Core Technology Stack
- **Test Runner**: Jest with multi-project configuration
- **Contract Testing**: Pact for API contract verification
- **Performance Testing**: k6 for load and performance testing
- **Security Testing**: Custom security test processor
- **Mock Management**: Jest mocking with AWS SDK mocks

### Test Types

#### 1. Unit Tests (`tests/*.test.js`)
- **Purpose**: Test individual functions and modules in isolation
- **Coverage Target**: 80% minimum (85% for critical modules)
- **Location**: `tests/` directory (excluding subdirectories)
- **Command**: `npm run test:unit`

#### 2. Integration Tests (`tests/integration/`)
- **Purpose**: Test component interactions and external service integrations
- **Coverage**: AWS Lambda functions, database interactions, API endpoints
- **Location**: `tests/integration/`
- **Command**: `npm run test:integration`
- **Timeout**: 60 seconds

#### 3. Contract Tests (`tests/contract/`)
- **Purpose**: Verify API contracts between services using Pact
- **Coverage**: Lambda function APIs, external service contracts
- **Location**: `tests/contract/`
- **Command**: `npm run test:contract`
- **Timeout**: 45 seconds

#### 4. Performance Tests (`tests/performance/`)
- **Purpose**: Load testing, stress testing, and performance validation
- **Technology**: k6 performance testing framework
- **Location**: `tests/performance/`
- **Execution**: Manual or CI/CD pipeline triggered

## 📁 Directory Structure

```
tests/
├── *.test.js                 # Unit tests
├── setup.js                  # Global test setup
├── security-test-processor.js # Security-focused test processor
├── fixtures/                 # Test data and fixtures
│   ├── security-findings.json
│   └── test-data.js
├── mocks/                    # Mock implementations
│   └── aws-sdk.js
├── integration/              # Integration tests
│   ├── backlog-integration.test.js
│   └── lambda-integration.test.js
├── contract/                 # Contract tests (Pact)
│   ├── api-contracts.test.js
│   └── pact.config.js
└── performance/              # Performance tests
    ├── k6-config.js
    ├── load-test.js
    └── package.json
```

## 🎯 Writing Tests

### Unit Test Example

```javascript
// tests/risk-scoring.test.js
const { calculateRiskScore } = require('../src/lambda/risk-scoring');

describe('Risk Scoring', () => {
  describe('calculateRiskScore', () => {
    it('should calculate high risk for critical vulnerabilities', () => {
      const finding = {
        severity: 'CRITICAL',
        cvssScore: 9.8,
        assetExposure: 0.9,
        blastRadius: 'HIGH'
      };
      
      const score = calculateRiskScore(finding);
      
      expect(score).toBeGreaterThan(8.5);
      expect(score).toBeLessThanOrEqual(10);
    });

    it('should handle missing CVSS scores gracefully', () => {
      const finding = {
        severity: 'MEDIUM',
        assetExposure: 0.5
      };
      
      expect(() => calculateRiskScore(finding)).not.toThrow();
    });
  });
});
```

### Integration Test Example

```javascript
// tests/integration/lambda-integration.test.js
const { handler } = require('../../src/lambda/prowler-ingest');

describe('Prowler Ingest Lambda Integration', () => {
  beforeEach(async () => {
    // Setup test environment
    process.env.NEPTUNE_ENDPOINT = 'wss://test-neptune.amazonaws.com:8182/gremlin';
  });

  it('should process prowler findings successfully', async () => {
    const event = {
      Records: [{
        s3: {
          bucket: { name: 'test-bucket' },
          object: { key: 'prowler-findings.json' }
        }
      }]
    };

    const result = await handler(event);
    
    expect(result.statusCode).toBe(200);
    expect(result.processedFindings).toBeGreaterThan(0);
  });
});
```

### Contract Test Example

```javascript
// tests/contract/api-contracts.test.js
const { Pact } = require('@pact-foundation/pact');
const { getRiskAssessment } = require('../../src/lambda/risk-scoring');

describe('Risk Scoring API Contract', () => {
  let provider;

  beforeAll(async () => {
    provider = new Pact({
      consumer: 'RiskScoringClient',
      provider: 'RiskScoringAPI',
      port: 1234,
      log: path.resolve(process.cwd(), 'logs', 'pact.log'),
      dir: path.resolve(process.cwd(), 'pacts'),
      logLevel: 'INFO'
    });

    await provider.setup();
  });

  afterAll(async () => {
    await provider.finalize();
  });

  it('should return risk assessment for valid finding', async () => {
    await provider.addInteraction({
      state: 'finding exists',
      uponReceiving: 'a request for risk assessment',
      withRequest: {
        method: 'POST',
        path: '/assess-risk',
        headers: { 'Content-Type': 'application/json' },
        body: {
          findingId: 'test-finding-123',
          severity: 'HIGH'
        }
      },
      willRespondWith: {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          riskScore: like(8.5),
          priority: 'HIGH',
          remediationComplexity: 'MEDIUM'
        }
      }
    });

    const response = await getRiskAssessment('test-finding-123');
    expect(response.riskScore).toBeGreaterThan(0);
  });
});
```

## 🔧 Configuration

### Jest Configuration (`jest.config.js`)

Key configuration features:
- **Multi-project setup** for different test types
- **Coverage thresholds** with different targets per module
- **Security test processor** for additional security validation
- **Comprehensive coverage reporting** (text, lcov, html, json, cobertura)

### Coverage Targets

| Module | Branches | Functions | Lines | Statements |
|--------|----------|-----------|-------|------------|
| Global | 80% | 80% | 80% | 80% |
| Backlog | 85% | 85% | 85% | 85% |
| Lambda | 75% | 75% | 75% | 75% |

### Performance Testing with k6

```javascript
// tests/performance/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'],    // Error rate under 10%
  },
};

export default function () {
  let response = http.post('https://api.example.com/assess-risk', {
    findingId: 'perf-test-finding',
    severity: 'HIGH'
  });
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  sleep(1);
}
```

## 🛡️ Security Testing

### Security Test Processor

The custom security test processor (`tests/security-test-processor.js`) provides:
- **Credential scanning** in test output
- **Sensitive data detection** in test results  
- **Security assertion validation**
- **Compliance checking** for security requirements

### Security Test Patterns

```javascript
describe('Security Validation', () => {
  it('should not expose sensitive information in logs', () => {
    const logOutput = captureLogOutput(() => {
      processSecurityFinding(testFinding);
    });
    
    expect(logOutput).not.toContain('aws_secret_access_key');
    expect(logOutput).not.toContain('password');
    expect(logOutput).not.toMatch(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  });

  it('should validate input sanitization', () => {
    const maliciousInput = {
      findingId: '<script>alert("xss")</script>',
      description: '"; DROP TABLE findings; --'
    };
    
    expect(() => processSecurityFinding(maliciousInput)).not.toThrow();
    // Add assertions for sanitized output
  });
});
```

## 📊 Test Execution

### Local Development

```bash
# Run all tests
npm test

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:contract

# Run tests in watch mode
npm run dev

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- backlog.test.js

# Run tests matching pattern
npm test -- --testNamePattern="risk scoring"
```

### CI/CD Pipeline

Tests are automatically executed in the following order:
1. **Unit tests** - Fast feedback for code changes
2. **Security scanning** - Vulnerability and secret detection
3. **Integration tests** - Component interaction validation
4. **Contract tests** - API contract verification
5. **Performance tests** - Load and stress testing (on main branch)

### Coverage Reporting

Coverage reports are generated in multiple formats:
- **Terminal**: Immediate feedback during development
- **HTML**: `coverage/lcov-report/index.html` for detailed analysis
- **LCOV**: `coverage/lcov.info` for CI/CD integration
- **JSON**: `coverage/coverage-final.json` for programmatic access

## 🏗️ Test Data Management

### Fixtures and Test Data

- **Location**: `tests/fixtures/`
- **Purpose**: Consistent test data across test suites
- **Files**:
  - `security-findings.json`: Sample security findings for testing
  - `test-data.js`: Programmatic test data generation

### Mock Management

- **AWS SDK Mocks**: `tests/mocks/aws-sdk.js`
- **Automatic mocking**: Jest automatically mocks external dependencies
- **Custom mocks**: Override default behavior for specific test scenarios

## 🚀 Best Practices

### Test Writing Guidelines

1. **Descriptive Test Names**: Use clear, behavior-driven descriptions
2. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and verification
3. **Test Independence**: Each test should be independent and not rely on others
4. **Mock External Dependencies**: Use mocks for AWS services, databases, and APIs
5. **Security Focus**: Always test for security vulnerabilities and data exposure

### Performance Considerations

1. **Parallel Execution**: Tests run in parallel using Jest workers (50% of CPU cores)
2. **Test Timeouts**: Appropriate timeouts for different test types
3. **Resource Cleanup**: Proper cleanup in `afterEach` and `afterAll` hooks
4. **Memory Management**: Avoid memory leaks in long-running test suites

### Common Patterns

```javascript
// Setup and teardown
describe('Lambda Function Tests', () => {
  beforeEach(() => {
    // Setup for each test
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    // Cleanup after each test
    delete process.env.TEST_VAR;
  });
});

// Async testing
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});

// Error testing
it('should handle errors gracefully', async () => {
  await expect(functionThatShouldFail()).rejects.toThrow('Expected error message');
});
```

## 🔍 Debugging Tests

### Debug Configuration

```json
// .vscode/launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Jest Tests",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Debugging Commands

```bash
# Debug specific test
node --inspect-brk node_modules/.bin/jest --runInBand specific-test.test.js

# Debug with VS Code
# Set breakpoints and use F5 with the debug configuration above
```

## 📝 Contributing to Tests

When contributing new features or fixing bugs:

1. **Write tests first** (TDD approach when possible)
2. **Maintain coverage thresholds** - ensure new code meets coverage requirements
3. **Add integration tests** for new Lambda functions or external integrations
4. **Update contract tests** when API contracts change
5. **Include security tests** for security-related functionality
6. **Document test scenarios** in code comments

## 🔄 Continuous Improvement

### Metrics and Monitoring

- **Test execution time** tracking
- **Coverage trend** analysis
- **Flaky test** identification and resolution
- **Performance regression** detection

### Regular Maintenance

- **Dependency updates** for testing frameworks
- **Test data refresh** to reflect current threat landscape
- **Performance baseline** updates
- **Security test enhancement** based on new vulnerabilities

---

**Last Updated**: 2025-08-02  
**Maintained By**: Cloud Remediator Sage Development Team
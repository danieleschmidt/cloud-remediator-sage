/**
 * Pact configuration for contract testing
 * Defines how contract tests are executed and verified
 */

const { Verifier } = require('@pact-foundation/pact');
const path = require('path');

// Pact broker configuration
const pactBrokerConfig = {
  pactBrokerUrl: process.env.PACT_BROKER_URL || 'http://localhost:9292',
  pactBrokerUsername: process.env.PACT_BROKER_USERNAME,
  pactBrokerPassword: process.env.PACT_BROKER_PASSWORD,
  publishVerificationResult: process.env.CI === 'true',
  providerVersion: process.env.GIT_COMMIT || '1.0.0'
};

// Provider verification options
const verificationOptions = {
  provider: 'security-analysis-api',
  providerBaseUrl: process.env.PROVIDER_BASE_URL || 'http://localhost:3000',
  
  // Local pact files for development
  pactUrls: [
    path.resolve(__dirname, 'pacts', 'cloud-remediator-sage-security-analysis-api.json')
  ],
  
  // Pact broker configuration for CI/CD
  ...(process.env.PACT_BROKER_URL && {
    pactBrokerUrl: pactBrokerConfig.pactBrokerUrl,
    pactBrokerUsername: pactBrokerConfig.pactBrokerUsername,
    pactBrokerPassword: pactBrokerConfig.pactBrokerPassword,
    publishVerificationResult: pactBrokerConfig.publishVerificationResult,
    providerVersion: pactBrokerConfig.providerVersion
  }),
  
  // State handlers
  stateHandlers: {
    'security findings exist': async () => {
      console.log('Setting up security findings test data');
      // In a real scenario, this would setup test data in the provider
      return Promise.resolve('Security findings setup complete');
    },
    
    'security analysis service is available': async () => {
      console.log('Ensuring security analysis service is ready');
      // Health check or service initialization
      return Promise.resolve('Service ready');
    },
    
    'risk scoring service is operational': async () => {
      console.log('Setting up risk scoring service');
      // Initialize risk scoring components
      return Promise.resolve('Risk scoring ready');
    },
    
    'remediation service is available': async () => {
      console.log('Setting up remediation service');
      // Initialize remediation generation
      return Promise.resolve('Remediation service ready');
    },
    
    'high-risk remediation is requested': async () => {
      console.log('Setting up high-risk remediation scenario');
      // Setup approval workflow mock
      return Promise.resolve('High-risk scenario ready');
    },
    
    'backlog management service is available': async () => {
      console.log('Setting up backlog management service');
      // Initialize backlog service
      return Promise.resolve('Backlog service ready');
    },
    
    'authentication token is invalid': async () => {
      console.log('Setting up invalid authentication scenario');
      // Configure auth service to reject tokens
      return Promise.resolve('Invalid auth scenario ready');
    },
    
    'request validation is enabled': async () => {
      console.log('Enabling request validation');
      // Enable strict validation mode
      return Promise.resolve('Validation enabled');
    }
  },
  
  // Custom headers for authentication
  customProviderHeaders: [
    'X-Pact-Test: true',
    `Authorization: Bearer ${process.env.PROVIDER_AUTH_TOKEN || 'test-token'}`
  ],
  
  // Request filters for security
  requestFilter: (req, res, next) => {
    // Add security headers for contract testing
    req.headers['x-contract-test'] = 'true';
    req.headers['x-test-environment'] = 'contract';
    next();
  },
  
  // Timeout configuration
  timeout: 30000,
  
  // Logging configuration
  logLevel: process.env.PACT_LOG_LEVEL || 'INFO',
  logDir: path.resolve(__dirname, 'logs'),
  
  // Security-specific configuration
  beforeEach: async () => {
    console.log('Preparing contract test environment');
    // Reset any security state between tests
  },
  
  afterEach: async () => {
    console.log('Cleaning up contract test environment');
    // Clean up test data and reset state
  }
};

// Provider verification function
async function verifyProvider() {
  const verifier = new Verifier(verificationOptions);
  
  try {
    const output = await verifier.verifyProvider();
    console.log('Provider verification successful');
    console.log(output);
    process.exit(0);
  } catch (error) {
    console.error('Provider verification failed:', error);
    process.exit(1);
  }
}

// Consumer contract generation configuration
const consumerConfig = {
  consumer: 'cloud-remediator-sage',
  provider: 'security-analysis-api',
  port: 1234,
  log: path.resolve(__dirname, 'logs', 'pact.log'),
  dir: path.resolve(__dirname, 'pacts'),
  spec: 2,
  logLevel: 'INFO',
  
  // Security-focused contract testing
  cors: true,
  host: '127.0.0.1',
  
  // SSL configuration for secure testing
  ssl: process.env.PACT_SSL === 'true',
  sslcert: process.env.PACT_SSL_CERT,
  sslkey: process.env.PACT_SSL_KEY,
  
  // Pact broker publishing
  pactfileWriteMode: 'update',
  
  // Contract validation rules
  contractValidation: {
    // Ensure all security endpoints are covered
    requiredEndpoints: [
      '/api/security/findings',
      '/api/risk/calculate',
      '/api/remediation/generate',
      '/api/backlog/items'
    ],
    
    // Security-specific validation rules
    securityRules: {
      requiresAuthentication: true,
      requiresAuthorization: true,
      validateInputSanitization: true,
      checkRateLimiting: true
    }
  }
};

// Utility functions for contract testing
const contractTestUtils = {
  /**
   * Generate security test scenarios
   */
  generateSecurityScenarios: () => {
    return [
      {
        name: 'critical_security_incident',
        description: 'Test critical security incident handling',
        findings: [
          {
            severity: 'CRITICAL',
            category: 'identity_access',
            title: 'Root account compromise'
          }
        ],
        expectedResponse: {
          priority: 'immediate',
          escalation: true
        }
      },
      {
        name: 'bulk_vulnerability_scan',
        description: 'Test bulk vulnerability processing',
        findings: Array.from({ length: 100 }, (_, i) => ({
          id: `vuln-${i}`,
          severity: 'MEDIUM',
          category: 'security'
        })),
        expectedResponse: {
          batchProcessing: true,
          queuePosition: 'number'
        }
      }
    ];
  },
  
  /**
   * Validate contract compliance
   */
  validateContractCompliance: (contract) => {
    const requiredFields = ['id', 'severity', 'resource', 'category'];
    const securityCategories = ['data_protection', 'network_security', 'identity_access'];
    
    return {
      hasRequiredFields: requiredFields.every(field => 
        Object.prototype.hasOwnProperty.call(contract.body.findings[0], field)
      ),
      hasValidSeverity: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(
        contract.body.findings[0].severity
      ),
      hasSecurityCategory: securityCategories.includes(
        contract.body.findings[0].category
      )
    };
  },
  
  /**
   * Setup contract test environment
   */
  setupTestEnvironment: async () => {
    console.log('Setting up contract test environment...');
    
    // Initialize test database
    // Setup mock services
    // Configure security settings
    
    return {
      status: 'ready',
      services: ['security-api', 'risk-scoring', 'remediation'],
      timestamp: new Date().toISOString()
    };
  }
};

module.exports = {
  verificationOptions,
  consumerConfig,
  pactBrokerConfig,
  contractTestUtils,
  verifyProvider
};

// Export CLI command for provider verification
if (require.main === module) {
  verifyProvider();
}
/**
 * Input Validation Utilities
 * Provides validation functions for security findings and cloud resources
 */

/**
 * Validate AWS ARN format
 * @param {string} arn - AWS ARN to validate
 * @returns {Object} Validation result
 */
function validateARN(arn) {
  if (!arn || typeof arn !== 'string') {
    return { isValid: false, error: 'ARN must be a non-empty string' };
  }

  const arnPattern = /^arn:aws:([^:]+):([^:]*):([^:]+):(.+)$/;
  const match = arn.match(arnPattern);

  if (!match) {
    return { isValid: false, error: 'Invalid ARN format' };
  }

  const [, service, region, accountId, resource] = match;

  // Validate service
  if (!service) {
    return { isValid: false, error: 'ARN must specify a service' };
  }

  // Validate account ID (if present)
  if (accountId && !/^\d{12}$/.test(accountId)) {
    return { isValid: false, error: 'Invalid AWS account ID format' };
  }

  // Validate resource
  if (!resource) {
    return { isValid: false, error: 'ARN must specify a resource' };
  }

  return {
    isValid: true,
    parsed: {
      service,
      region: region || null,
      accountId: accountId || null,
      resource
    }
  };
}

/**
 * Validate security finding severity level
 * @param {string} severity - Severity level to validate
 * @returns {Object} Validation result
 */
function validateSeverity(severity) {
  const validSeverities = ['critical', 'high', 'medium', 'low', 'info'];
  
  if (!severity || typeof severity !== 'string') {
    return { isValid: false, error: 'Severity must be a non-empty string' };
  }

  const normalizedSeverity = severity.toLowerCase();
  
  if (!validSeverities.includes(normalizedSeverity)) {
    return { 
      isValid: false, 
      error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` 
    };
  }

  return { 
    isValid: true, 
    normalized: normalizedSeverity 
  };
}

/**
 * Validate risk score range
 * @param {number} riskScore - Risk score to validate
 * @returns {Object} Validation result
 */
function validateRiskScore(riskScore) {
  if (typeof riskScore !== 'number') {
    return { isValid: false, error: 'Risk score must be a number' };
  }

  if (isNaN(riskScore)) {
    return { isValid: false, error: 'Risk score cannot be NaN' };
  }

  if (riskScore < 0 || riskScore > 10) {
    return { isValid: false, error: 'Risk score must be between 0 and 10' };
  }

  return { isValid: true };
}

/**
 * Validate compliance framework name
 * @param {string} framework - Framework name to validate
 * @returns {Object} Validation result
 */
function validateComplianceFramework(framework) {
  const validFrameworks = [
    'pci-dss', 'hipaa', 'sox', 'gdpr', 'iso27001', 'nist', 'cis', 
    'aws-foundational', 'aws-security-best-practices', 'cisa'
  ];
  
  if (!framework || typeof framework !== 'string') {
    return { isValid: false, error: 'Framework must be a non-empty string' };
  }

  const normalizedFramework = framework.toLowerCase();
  
  if (!validFrameworks.includes(normalizedFramework)) {
    return { 
      isValid: false, 
      error: `Unknown compliance framework: ${framework}` 
    };
  }

  return { 
    isValid: true, 
    normalized: normalizedFramework 
  };
}

/**
 * Validate AWS region format
 * @param {string} region - AWS region to validate
 * @returns {Object} Validation result
 */
function validateAWSRegion(region) {
  if (!region || typeof region !== 'string') {
    return { isValid: false, error: 'Region must be a non-empty string' };
  }

  // AWS region pattern: us-east-1, eu-west-2, ap-southeast-1, etc.
  const regionPattern = /^[a-z]{2}-[a-z]+-\d+$/;
  
  if (!regionPattern.test(region)) {
    return { isValid: false, error: 'Invalid AWS region format' };
  }

  return { isValid: true };
}

/**
 * Validate AWS account ID
 * @param {string} accountId - AWS account ID to validate
 * @returns {Object} Validation result
 */
function validateAWSAccountId(accountId) {
  if (!accountId || typeof accountId !== 'string') {
    return { isValid: false, error: 'Account ID must be a non-empty string' };
  }

  if (!/^\d{12}$/.test(accountId)) {
    return { isValid: false, error: 'AWS account ID must be exactly 12 digits' };
  }

  return { isValid: true };
}

/**
 * Validate email address format
 * @param {string} email - Email address to validate
 * @returns {Object} Validation result
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Email must be a non-empty string' };
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailPattern.test(email)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  return { isValid: true };
}

/**
 * Validate JSON structure
 * @param {string} jsonString - JSON string to validate
 * @returns {Object} Validation result
 */
function validateJSON(jsonString) {
  if (!jsonString || typeof jsonString !== 'string') {
    return { isValid: false, error: 'JSON must be a non-empty string' };
  }

  try {
    const parsed = JSON.parse(jsonString);
    return { 
      isValid: true, 
      parsed 
    };
  } catch (error) {
    return { 
      isValid: false, 
      error: `Invalid JSON: ${error.message}` 
    };
  }
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {Object} Validation result
 */
function validateURL(url) {
  if (!url || typeof url !== 'string') {
    return { isValid: false, error: 'URL must be a non-empty string' };
  }

  try {
    const urlObj = new URL(url);
    return { 
      isValid: true, 
      parsed: {
        protocol: urlObj.protocol,
        hostname: urlObj.hostname,
        pathname: urlObj.pathname,
        search: urlObj.search
      }
    };
  } catch (error) {
    return { 
      isValid: false, 
      error: `Invalid URL: ${error.message}` 
    };
  }
}

/**
 * Sanitize input to prevent injection attacks
 * @param {string} input - Input string to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/[<>'"&]/g, '') // Remove HTML/XML special characters
    .replace(/[\x00-\x1F\x7F]/g, '') // eslint-disable-line no-control-regex
    .trim()
    .substring(0, 1000); // Limit length
}

/**
 * Validate batch size for processing
 * @param {number} batchSize - Batch size to validate
 * @param {number} maxSize - Maximum allowed batch size
 * @returns {Object} Validation result
 */
function validateBatchSize(batchSize, maxSize = 1000) {
  if (typeof batchSize !== 'number') {
    return { isValid: false, error: 'Batch size must be a number' };
  }

  if (batchSize < 1) {
    return { isValid: false, error: 'Batch size must be at least 1' };
  }

  if (batchSize > maxSize) {
    return { 
      isValid: false, 
      error: `Batch size cannot exceed ${maxSize}` 
    };
  }

  return { isValid: true };
}

module.exports = {
  validateARN,
  validateSeverity,
  validateRiskScore,
  validateComplianceFramework,
  validateAWSRegion,
  validateAWSAccountId,
  validateEmail,
  validateJSON,
  validateURL,
  sanitizeInput,
  validateBatchSize
};
/**
 * Helper Utilities
 * Common utility functions for the Cloud Remediator Sage
 */

const crypto = require('crypto');

/**
 * Generate a unique correlation ID
 * @param {string} prefix - Optional prefix for the ID
 * @returns {string} Unique correlation ID
 */
function generateCorrelationId(prefix = 'cr') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Calculate retry delay with exponential backoff
 * @param {number} attempt - Current attempt number (starting from 1)
 * @param {number} baseDelay - Base delay in milliseconds
 * @param {number} maxDelay - Maximum delay in milliseconds
 * @returns {number} Delay in milliseconds
 */
function calculateRetryDelay(attempt, baseDelay = 1000, maxDelay = 30000) {
  const delay = baseDelay * Math.pow(2, attempt - 1);
  const jitter = delay * 0.1 * Math.random(); // Add 10% jitter
  return Math.min(delay + jitter, maxDelay);
}

/**
 * Sleep for specified duration
 * @param {number} ms - Duration in milliseconds
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Chunk array into smaller arrays
 * @param {Array} array - Array to chunk
 * @param {number} size - Chunk size
 * @returns {Array} Array of chunks
 */
function chunkArray(array, size) {
  if (!Array.isArray(array) || size <= 0) {
    return [];
  }

  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Deep merge two objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
  const result = { ...target };

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (isObject(source[key]) && isObject(target[key])) {
        result[key] = deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }

  return result;
}

/**
 * Check if value is an object
 * @param {*} value - Value to check
 * @returns {boolean} True if value is an object
 */
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Generate hash for a string
 * @param {string} input - Input string
 * @param {string} algorithm - Hash algorithm (default: sha256)
 * @returns {string} Hash value
 */
function generateHash(input, algorithm = 'sha256') {
  return crypto.createHash(algorithm).update(input).digest('hex');
}

/**
 * Generate secure random string
 * @param {number} length - Length of the string
 * @returns {string} Random string
 */
function generateRandomString(length = 32) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

/**
 * Format bytes to human readable format
 * @param {number} bytes - Number of bytes
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted string
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format duration in milliseconds to human readable format
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
function formatDuration(ms) {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Parse AWS ARN into components
 * @param {string} arn - AWS ARN
 * @returns {Object} Parsed ARN components
 */
function parseARN(arn) {
  if (!arn || typeof arn !== 'string') {
    return null;
  }

  const parts = arn.split(':');
  if (parts.length < 6 || parts[0] !== 'arn' || parts[1] !== 'aws') {
    return null;
  }

  return {
    partition: parts[1],
    service: parts[2],
    region: parts[3] || null,
    accountId: parts[4] || null,
    resourceType: parts[5].split('/')[0] || null,
    resource: parts[5],
    resourceName: parts[5].split('/').slice(1).join('/') || parts[5]
  };
}

/**
 * Extract resource type from AWS ARN
 * @param {string} arn - AWS ARN
 * @returns {string} Resource type
 */
function getResourceTypeFromARN(arn) {
  const parsed = parseARN(arn);
  return parsed ? parsed.resourceType : 'unknown';
}

/**
 * Extract service from AWS ARN
 * @param {string} arn - AWS ARN
 * @returns {string} AWS service name
 */
function getServiceFromARN(arn) {
  const parsed = parseARN(arn);
  return parsed ? parsed.service : 'unknown';
}

/**
 * Calculate age in days from date
 * @param {Date|string} date - Date to calculate age from
 * @returns {number} Age in days
 */
function calculateAgeDays(date) {
  const targetDate = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diffTime = Math.abs(now - targetDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Mask sensitive data in strings
 * @param {string} input - Input string
 * @param {number} visibleChars - Number of visible characters at start/end
 * @returns {string} Masked string
 */
function maskSensitiveData(input, visibleChars = 4) {
  if (!input || typeof input !== 'string') {
    return input;
  }

  if (input.length <= visibleChars * 2) {
    return '*'.repeat(input.length);
  }

  const start = input.substring(0, visibleChars);
  const end = input.substring(input.length - visibleChars);
  const middle = '*'.repeat(input.length - visibleChars * 2);

  return start + middle + end;
}

/**
 * Throttle function execution
 * @param {Function} func - Function to throttle
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Throttled function
 */
function throttle(func, delay) {
  let lastExecution = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastExecution >= delay) {
      lastExecution = now;
      return func.apply(this, args);
    }
  };
}

/**
 * Debounce function execution
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * Retry function with exponential backoff
 * @param {Function} func - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} Promise that resolves with function result
 */
async function retryWithBackoff(func, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await func();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw error;
      }

      const delay = calculateRetryDelay(attempt, baseDelay);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Create a timeout promise
 * @param {number} ms - Timeout in milliseconds
 * @param {string} message - Timeout error message
 * @returns {Promise} Promise that rejects after timeout
 */
function timeout(ms, message = 'Operation timed out') {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

/**
 * Race a promise against a timeout
 * @param {Promise} promise - Promise to race
 * @param {number} ms - Timeout in milliseconds
 * @param {string} message - Timeout error message
 * @returns {Promise} Promise that resolves/rejects first
 */
async function promiseWithTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    timeout(ms, message)
  ]);
}

module.exports = {
  generateCorrelationId,
  calculateRetryDelay,
  sleep,
  chunkArray,
  deepMerge,
  isObject,
  generateHash,
  generateRandomString,
  formatBytes,
  formatDuration,
  parseARN,
  getResourceTypeFromARN,
  getServiceFromARN,
  calculateAgeDays,
  maskSensitiveData,
  throttle,
  debounce,
  retryWithBackoff,
  timeout,
  promiseWithTimeout
};
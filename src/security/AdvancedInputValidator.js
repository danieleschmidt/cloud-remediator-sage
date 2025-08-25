/**
 * Advanced Input Validator and Sanitizer
 * Provides comprehensive input validation, sanitization, and security filtering
 */

const { StructuredLogger } = require('../monitoring/logger');

class AdvancedInputValidator {
  constructor(options = {}) {
    this.logger = new StructuredLogger('input-validator');
    this.options = {
      strictMode: options.strictMode !== false,
      maxStringLength: options.maxStringLength || 10000,
      maxArrayLength: options.maxArrayLength || 1000,
      maxObjectDepth: options.maxObjectDepth || 10,
      allowedTags: options.allowedTags || [],
      blockedPatterns: options.blockedPatterns || this.getDefaultBlockedPatterns(),
      logSuspiciousInput: options.logSuspiciousInput !== false,
      ...options
    };
    
    this.validationCache = new Map();
    this.suspiciousPatterns = [];
    this.validationMetrics = {
      totalValidations: 0,
      validInputs: 0,
      sanitizedInputs: 0,
      rejectedInputs: 0,
      suspiciousInputs: 0
    };
  }

  /**
   * Get default blocked patterns for security
   */
  getDefaultBlockedPatterns() {
    return [
      // Script injection patterns
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>/gi,
      /<object[^>]*>/gi,
      /<embed[^>]*>/gi,
      
      // SQL injection patterns
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|DECLARE|TRUNCATE|GRANT|REVOKE)\b)/gi,
      /'(\s)*(OR|AND)\s*'.*?'/gi,
      /--(\s|$)/g,
      /\/\*.*?\*\//g,
      /(\bOR\b|\bAND\b)\s*\d+\s*=\s*\d+/gi,
      /\b(WAITFOR|DELAY)\b/gi,
      
      // Command injection patterns
      /(\||&|;|`|\$\(|\${|%%)/g,
      /(cat|ls|ps|netstat|whoami|id|pwd|curl|wget|nc|nslookup|dig)\s/gi,
      /(rm|mv|cp|chmod|chown|kill|killall)\s/gi,
      /(sudo|su|passwd|crontab)\s/gi,
      
      // Path traversal and directory traversal
      /\.\.\/|\.\.\\|\.\.%252f|\.\.%255c|%2e%2e%2f|%2e%2e%5c/gi,
      /(\/etc\/passwd|\/etc\/shadow|\/proc\/|\/sys\/|\/dev\/)/gi,
      /(\\windows\\|\\system32\\|\\boot\\.ini)/gi,
      
      // LDAP injection
      /(\)|\(|&|\||!|\*|\+|=|<|>|~|%|\^)/g,
      
      // XPath injection
      /\/\/|\[|\]|@|\bor\b|\band\b/gi,
      
      // Template injection (Server-Side Template Injection)
      /\{\{.*?\}\}|\$\{.*?\}|<%.*?%>|\{%.*?%\}/g,
      /\{\{.*?(config|self|request|session|g|url_for|get_flashed_messages).*?\}\}/gi,
      
      // NoSQL injection patterns
      /\$where|\$ne|\$gt|\$lt|\$regex|\$or|\$and|\$not/gi,
      
      // XML injection and XXE patterns
      /<!DOCTYPE[^>]*>/gi,
      /<!ENTITY[^>]*>/gi,
      /<!ELEMENT[^>]*>/gi,
      /<!\[CDATA\[/gi,
      
      // Protocol smuggling and SSRF
      /(ftp|file|gopher|dict|ldap|sftp|smb|telnet|tftp):/gi,
      /(http|https):\/\/localhost|127\.0\.0\.1|0\.0\.0\.0|10\.|172\.|192\.168\./gi,
      
      // Log injection patterns
      /\r|\n|%0d|%0a/gi,
      
      // Code execution patterns
      /eval\s*\(|Function\s*\(|setTimeout\s*\(|setInterval\s*\(/gi,
      /require\s*\(|import\s*\(|exec\s*\(/gi,
      
      // AWS/Cloud metadata patterns
      /(169\.254\.169\.254|metadata\.google\.internal|100\.100\.100\.200)/gi,
      
      // Deserialization patterns
      /rO0AB|aced00|java\.lang\.Runtime|ProcessBuilder/gi,
      /__reduce__|pickle\.loads|yaml\.load|marshal\.loads/gi
    ];
  }

  /**
   * Validate and sanitize input comprehensively
   */
  async validateInput(input, schema = {}) {
    this.validationMetrics.totalValidations++;
    
    try {
      // Check cache for repeated validations
      const cacheKey = this.createCacheKey(input, schema);
      if (this.validationCache.has(cacheKey)) {
        return this.validationCache.get(cacheKey);
      }
      
      // Perform comprehensive validation
      const result = await this.performValidation(input, schema);
      
      // Cache result
      this.validationCache.set(cacheKey, result);
      
      // Limit cache size
      if (this.validationCache.size > 1000) {
        const firstKey = this.validationCache.keys().next().value;
        this.validationCache.delete(firstKey);
      }
      
      // Update metrics
      if (result.isValid) {
        if (result.wasSanitized) {
          this.validationMetrics.sanitizedInputs++;
        } else {
          this.validationMetrics.validInputs++;
        }
      } else {
        this.validationMetrics.rejectedInputs++;
      }
      
      if (result.isSuspicious) {
        this.validationMetrics.suspiciousInputs++;
      }
      
      return result;
      
    } catch (error) {
      this.logger.error('Validation error', { error: error.message });
      return {
        isValid: false,
        sanitizedInput: null,
        violations: ['validation-error'],
        error: error.message
      };
    }
  }

  /**
   * Perform comprehensive input validation
   */
  async performValidation(input, schema) {
    const violations = [];
    let sanitizedInput = input;
    let wasSanitized = false;
    let isSuspicious = false;
    
    // Type validation
    if (schema.type && typeof input !== schema.type) {
      violations.push(`invalid-type-expected-${schema.type}-got-${typeof input}`);
    }
    
    // Null/undefined validation
    if (schema.required && (input === null || input === undefined)) {
      violations.push('required-field-missing');
    }
    
    if (input === null || input === undefined) {
      return {
        isValid: violations.length === 0,
        sanitizedInput: input,
        violations,
        wasSanitized: false,
        isSuspicious: false
      };
    }
    
    // String validation
    if (typeof input === 'string') {
      const stringResult = await this.validateString(input, schema);
      sanitizedInput = stringResult.sanitized;
      wasSanitized = stringResult.wasSanitized;
      isSuspicious = stringResult.isSuspicious;
      violations.push(...stringResult.violations);
    }
    
    // Number validation
    if (typeof input === 'number') {
      const numberResult = this.validateNumber(input, schema);
      violations.push(...numberResult.violations);
    }
    
    // Array validation
    if (Array.isArray(input)) {
      const arrayResult = await this.validateArray(input, schema);
      sanitizedInput = arrayResult.sanitized;
      wasSanitized = arrayResult.wasSanitized;
      isSuspicious = arrayResult.isSuspicious;
      violations.push(...arrayResult.violations);
    }
    
    // Object validation
    if (typeof input === 'object' && !Array.isArray(input)) {
      const objectResult = await this.validateObject(input, schema);
      sanitizedInput = objectResult.sanitized;
      wasSanitized = objectResult.wasSanitized;
      isSuspicious = objectResult.isSuspicious;
      violations.push(...objectResult.violations);
    }
    
    // Log suspicious input
    if (isSuspicious && this.options.logSuspiciousInput) {
      this.logger.warn('Suspicious input detected', {
        inputType: typeof input,
        violations,
        input: typeof input === 'string' ? input.substring(0, 100) : '[object]'
      });
    }
    
    return {
      isValid: violations.length === 0 || !this.options.strictMode,
      sanitizedInput,
      violations,
      wasSanitized,
      isSuspicious
    };
  }

  /**
   * Validate and sanitize string input
   */
  async validateString(input, schema) {
    const violations = [];
    let sanitized = input;
    let wasSanitized = false;
    let isSuspicious = false;
    
    // Length validation
    if (schema.maxLength && input.length > schema.maxLength) {
      violations.push(`string-too-long-${input.length}-max-${schema.maxLength}`);
      sanitized = input.substring(0, schema.maxLength);
      wasSanitized = true;
    } else if (input.length > this.options.maxStringLength) {
      violations.push(`string-exceeds-global-limit-${input.length}`);
      sanitized = input.substring(0, this.options.maxStringLength);
      wasSanitized = true;
    }
    
    if (schema.minLength && input.length < schema.minLength) {
      violations.push(`string-too-short-${input.length}-min-${schema.minLength}`);
    }
    
    // Pattern validation
    if (schema.pattern && !schema.pattern.test(input)) {
      violations.push('string-pattern-mismatch');
    }
    
    // Security pattern detection
    for (const pattern of this.options.blockedPatterns) {
      if (pattern.test(input)) {
        violations.push('blocked-pattern-detected');
        isSuspicious = true;
        
        // Sanitize by removing the pattern
        sanitized = sanitized.replace(pattern, '');
        wasSanitized = true;
      }
    }
    
    // Encoding validation
    try {
      const decoded = decodeURIComponent(input);
      if (decoded !== input) {
        // Check if decoded version contains suspicious patterns
        for (const pattern of this.options.blockedPatterns) {
          if (pattern.test(decoded)) {
            violations.push('encoded-malicious-content');
            isSuspicious = true;
          }
        }
      }
    } catch (e) {
      // Invalid encoding
      violations.push('invalid-encoding');
    }
    
    // Character set validation
    if (schema.allowedChars) {
      const disallowedChars = sanitized.split('').filter(char => 
        !schema.allowedChars.includes(char)
      );
      if (disallowedChars.length > 0) {
        violations.push(`disallowed-characters-${disallowedChars.slice(0, 5).join('')}`);
        sanitized = sanitized.replace(new RegExp(`[^${schema.allowedChars}]`, 'g'), '');
        wasSanitized = true;
      }
    }
    
    return { sanitized, violations, wasSanitized, isSuspicious };
  }

  /**
   * Validate number input
   */
  validateNumber(input, schema) {
    const violations = [];
    
    if (!Number.isFinite(input)) {
      violations.push('invalid-number');
    }
    
    if (schema.min !== undefined && input < schema.min) {
      violations.push(`number-below-minimum-${input}-min-${schema.min}`);
    }
    
    if (schema.max !== undefined && input > schema.max) {
      violations.push(`number-above-maximum-${input}-max-${schema.max}`);
    }
    
    if (schema.integer && !Number.isInteger(input)) {
      violations.push('number-not-integer');
    }
    
    return { violations };
  }

  /**
   * Validate and sanitize array input
   */
  async validateArray(input, schema) {
    const violations = [];
    let sanitized = [...input];
    let wasSanitized = false;
    let isSuspicious = false;
    
    // Length validation
    if (schema.maxItems && input.length > schema.maxItems) {
      violations.push(`array-too-long-${input.length}-max-${schema.maxItems}`);
      sanitized = input.slice(0, schema.maxItems);
      wasSanitized = true;
    } else if (input.length > this.options.maxArrayLength) {
      violations.push(`array-exceeds-global-limit-${input.length}`);
      sanitized = input.slice(0, this.options.maxArrayLength);
      wasSanitized = true;
    }
    
    if (schema.minItems && input.length < schema.minItems) {
      violations.push(`array-too-short-${input.length}-min-${schema.minItems}`);
    }
    
    // Validate array items
    if (schema.items) {
      for (let i = 0; i < sanitized.length; i++) {
        const itemResult = await this.performValidation(sanitized[i], schema.items);
        if (!itemResult.isValid && this.options.strictMode) {
          violations.push(`array-item-${i}-invalid`);
        }
        if (itemResult.wasSanitized) {
          sanitized[i] = itemResult.sanitizedInput;
          wasSanitized = true;
        }
        if (itemResult.isSuspicious) {
          isSuspicious = true;
        }
      }
    }
    
    return { sanitized, violations, wasSanitized, isSuspicious };
  }

  /**
   * Validate and sanitize object input
   */
  async validateObject(input, schema, depth = 0) {
    const violations = [];
    let sanitized = { ...input };
    let wasSanitized = false;
    let isSuspicious = false;
    
    // Depth validation
    if (depth > this.options.maxObjectDepth) {
      violations.push(`object-depth-exceeded-${depth}-max-${this.options.maxObjectDepth}`);
      return { sanitized: {}, violations, wasSanitized: true, isSuspicious: true };
    }
    
    // Properties validation
    if (schema.properties) {
      for (const [key, propertySchema] of Object.entries(schema.properties)) {
        if (key in input) {
          const propertyResult = await this.performValidation(input[key], propertySchema);
          if (!propertyResult.isValid && this.options.strictMode) {
            violations.push(`object-property-${key}-invalid`);
          }
          if (propertyResult.wasSanitized) {
            sanitized[key] = propertyResult.sanitizedInput;
            wasSanitized = true;
          }
          if (propertyResult.isSuspicious) {
            isSuspicious = true;
          }
        }
      }
    }
    
    // Additional properties validation
    if (schema.additionalProperties === false) {
      const allowedKeys = schema.properties ? Object.keys(schema.properties) : [];
      for (const key of Object.keys(input)) {
        if (!allowedKeys.includes(key)) {
          violations.push(`object-additional-property-${key}`);
          delete sanitized[key];
          wasSanitized = true;
        }
      }
    }
    
    return { sanitized, violations, wasSanitized, isSuspicious };
  }

  /**
   * Create cache key for validation results
   */
  createCacheKey(input, schema) {
    return JSON.stringify({ input, schema }).substring(0, 100);
  }

  /**
   * Get validation metrics
   */
  getValidationMetrics() {
    return {
      ...this.validationMetrics,
      cacheSize: this.validationCache.size,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Reset validation metrics and cache
   */
  reset() {
    this.validationCache.clear();
    this.validationMetrics = {
      totalValidations: 0,
      validInputs: 0,
      sanitizedInputs: 0,
      rejectedInputs: 0,
      suspiciousInputs: 0
    };
  }
}

module.exports = AdvancedInputValidator;
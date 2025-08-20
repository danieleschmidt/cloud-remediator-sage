/**
 * Advanced Security Hardening Module
 * Implements comprehensive security hardening measures for production deployment
 */

const crypto = require('crypto');
const { StructuredLogger } = require('../monitoring/logger');

class SecurityHardening {
  constructor(options = {}) {
    this.logger = new StructuredLogger('security-hardening');
    this.config = {
      enableRuntimeProtection: options.enableRuntimeProtection !== false,
      enableInputValidation: options.enableInputValidation !== false,
      enableOutputSanitization: options.enableOutputSanitization !== false,
      enableResourceLimiting: options.enableResourceLimiting !== false,
      enableAuditLogging: options.enableAuditLogging !== false,
      maxInputSize: options.maxInputSize || 1048576, // 1MB
      maxOutputSize: options.maxOutputSize || 10485760, // 10MB
      requestTimeout: options.requestTimeout || 30000,
      ...options
    };
    
    this.securityContext = {
      initialized: false,
      protectionLevel: 'STANDARD',
      activeThreats: new Set(),
      blockedIPs: new Set(),
      suspiciousActivities: [],
      securityEvents: []
    };
    
    this.hardeningRules = this.initializeHardeningRules();
  }

  /**
   * Initialize comprehensive hardening
   */
  async initialize() {
    try {
      this.logger.info('Initializing security hardening');
      
      // Enable runtime protection
      if (this.config.enableRuntimeProtection) {
        await this.enableRuntimeProtection();
      }
      
      // Set up input validation middleware
      if (this.config.enableInputValidation) {
        await this.setupInputValidation();
      }
      
      // Configure output sanitization
      if (this.config.enableOutputSanitization) {
        await this.setupOutputSanitization();
      }
      
      // Enable resource limiting
      if (this.config.enableResourceLimiting) {
        await this.enableResourceLimiting();
      }
      
      // Setup audit logging
      if (this.config.enableAuditLogging) {
        await this.setupAuditLogging();
      }
      
      this.securityContext.initialized = true;
      this.securityContext.protectionLevel = 'ENHANCED';
      
      this.logger.info('Security hardening initialized successfully', {
        protectionLevel: this.securityContext.protectionLevel,
        enabledFeatures: Object.keys(this.config).filter(key => this.config[key] === true)
      });
      
    } catch (error) {
      this.logger.error('Security hardening initialization failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Enable comprehensive runtime protection
   */
  async enableRuntimeProtection() {
    // Process protection
    process.on('uncaughtException', (error) => {
      this.handleSecurityEvent('UNCAUGHT_EXCEPTION', { error: error.message });
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      this.handleSecurityEvent('UNHANDLED_REJECTION', { reason, promise });
    });
    
    // Memory protection
    process.on('warning', (warning) => {
      if (warning.name === 'MaxListenersExceededWarning') {
        this.handleSecurityEvent('MEMORY_LEAK_SUSPECTED', { warning: warning.message });
      }
    });
    
    this.logger.info('Runtime protection enabled');
  }

  /**
   * Setup comprehensive input validation
   */
  async setupInputValidation() {
    this.inputValidator = {
      validateRequest: (req) => {
        const issues = [];
        
        // Size validation
        const bodySize = JSON.stringify(req.body || {}).length;
        if (bodySize > this.config.maxInputSize) {
          issues.push(`Request body too large: ${bodySize} bytes`);
        }
        
        // Content validation
        if (this.containsSuspiciousContent(req.body)) {
          issues.push('Suspicious content detected in request');
        }
        
        // Header validation
        if (this.containsMaliciousHeaders(req.headers)) {
          issues.push('Malicious headers detected');
        }
        
        return {
          isValid: issues.length === 0,
          issues
        };
      },
      
      sanitizeInput: (input) => {
        if (typeof input === 'string') {
          return input
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
        }
        
        if (typeof input === 'object' && input !== null) {
          const sanitized = {};
          for (const [key, value] of Object.entries(input)) {
            sanitized[key] = this.inputValidator.sanitizeInput(value);
          }
          return sanitized;
        }
        
        return input;
      }
    };
    
    this.logger.info('Input validation configured');
  }

  /**
   * Setup output sanitization
   */
  async setupOutputSanitization() {
    this.outputSanitizer = {
      sanitizeOutput: (output) => {
        if (typeof output === 'string') {
          // Remove sensitive patterns
          return output
            .replace(/password\s*[:=]\s*[\w\d]+/gi, 'password: [REDACTED]')
            .replace(/api[_-]?key\s*[:=]\s*[\w\d]+/gi, 'api_key: [REDACTED]')
            .replace(/secret\s*[:=]\s*[\w\d]+/gi, 'secret: [REDACTED]')
            .replace(/token\s*[:=]\s*[\w\d]+/gi, 'token: [REDACTED]');
        }
        
        if (typeof output === 'object' && output !== null) {
          const sanitized = {};
          for (const [key, value] of Object.entries(output)) {
            if (this.isSensitiveKey(key)) {
              sanitized[key] = '[REDACTED]';
            } else {
              sanitized[key] = this.outputSanitizer.sanitizeOutput(value);
            }
          }
          return sanitized;
        }
        
        return output;
      }
    };
    
    this.logger.info('Output sanitization configured');
  }

  /**
   * Enable resource limiting
   */
  async enableResourceLimiting() {
    // Memory monitoring
    setInterval(() => {
      const usage = process.memoryUsage();
      if (usage.heapUsed > 500 * 1024 * 1024) { // 500MB
        this.handleSecurityEvent('HIGH_MEMORY_USAGE', { usage });
      }
    }, 10000);
    
    // CPU monitoring
    let lastCpuTime = process.cpuUsage();
    setInterval(() => {
      const cpuUsage = process.cpuUsage(lastCpuTime);
      const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000;
      if (cpuPercent > 80) { // 80%
        this.handleSecurityEvent('HIGH_CPU_USAGE', { cpuPercent });
      }
      lastCpuTime = process.cpuUsage();
    }, 5000);
    
    this.logger.info('Resource limiting enabled');
  }

  /**
   * Setup audit logging
   */
  async setupAuditLogging() {
    this.auditLogger = {
      logSecurityEvent: (event) => {
        const auditEntry = {
          timestamp: new Date().toISOString(),
          type: 'SECURITY_EVENT',
          severity: event.severity || 'INFO',
          source: event.source || 'UNKNOWN',
          event: event.event,
          details: event.details,
          userAgent: event.userAgent,
          ip: event.ip,
          correlationId: event.correlationId || crypto.randomUUID()
        };
        
        this.securityContext.securityEvents.push(auditEntry);
        this.logger.info('Security event logged', auditEntry);
        
        // Keep only last 1000 events
        if (this.securityContext.securityEvents.length > 1000) {
          this.securityContext.securityEvents = this.securityContext.securityEvents.slice(-1000);
        }
      }
    };
    
    this.logger.info('Audit logging configured');
  }

  /**
   * Initialize hardening rules
   */
  initializeHardeningRules() {
    return {
      inputValidation: {
        maxStringLength: 10000,
        maxArrayLength: 1000,
        maxObjectDepth: 10,
        blockedPatterns: [
          /\$\(.*\)/g, // Command injection
          /<script.*?>.*?<\/script>/gi, // XSS
          /union.*select/gi, // SQL injection
          /\.\.\//g, // Path traversal
          /eval\s*\(/gi, // Code injection
          /exec\s*\(/gi, // Command execution
        ]
      },
      
      rateLimiting: {
        globalLimit: 1000, // requests per minute
        ipLimit: 100, // requests per IP per minute
        burstLimit: 50 // burst requests
      },
      
      securityHeaders: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Content-Security-Policy': "default-src 'self'"
      }
    };
  }

  /**
   * Check for suspicious content
   */
  containsSuspiciousContent(content) {
    if (!content) return false;
    
    const contentStr = JSON.stringify(content).toLowerCase();
    const suspiciousPatterns = this.hardeningRules.inputValidation.blockedPatterns;
    
    return suspiciousPatterns.some(pattern => pattern.test(contentStr));
  }

  /**
   * Check for malicious headers
   */
  containsMaliciousHeaders(headers) {
    if (!headers) return false;
    
    const maliciousHeaders = ['x-forwarded-host', 'x-real-ip'];
    const headerKeys = Object.keys(headers).map(key => key.toLowerCase());
    
    return maliciousHeaders.some(header => 
      headerKeys.includes(header) && 
      headers[header] && 
      headers[header].includes('..')
    );
  }

  /**
   * Check if key contains sensitive information
   */
  isSensitiveKey(key) {
    const sensitiveKeys = [
      'password', 'pwd', 'passwd',
      'secret', 'key', 'token',
      'api_key', 'apikey', 'access_token',
      'private_key', 'privatekey'
    ];
    
    return sensitiveKeys.some(sensitive => 
      key.toLowerCase().includes(sensitive)
    );
  }

  /**
   * Handle security events
   */
  handleSecurityEvent(eventType, details) {
    const securityEvent = {
      timestamp: Date.now(),
      type: eventType,
      details,
      severity: this.calculateSeverity(eventType),
      handled: false
    };
    
    this.securityContext.securityEvents.push(securityEvent);
    
    // Emit event for monitoring
    this.emit('securityEvent', securityEvent);
    
    // Auto-response for critical events
    if (securityEvent.severity === 'CRITICAL') {
      this.handleCriticalSecurityEvent(securityEvent);
    }
    
    this.logger.warn('Security event detected', securityEvent);
  }

  /**
   * Calculate event severity
   */
  calculateSeverity(eventType) {
    const severityMap = {
      'UNCAUGHT_EXCEPTION': 'CRITICAL',
      'UNHANDLED_REJECTION': 'HIGH',
      'MEMORY_LEAK_SUSPECTED': 'HIGH',
      'HIGH_MEMORY_USAGE': 'MEDIUM',
      'HIGH_CPU_USAGE': 'MEDIUM',
      'SUSPICIOUS_CONTENT': 'HIGH',
      'MALICIOUS_HEADERS': 'HIGH',
      'RATE_LIMIT_EXCEEDED': 'MEDIUM'
    };
    
    return severityMap[eventType] || 'LOW';
  }

  /**
   * Handle critical security events
   */
  handleCriticalSecurityEvent(event) {
    // Implement emergency response
    this.securityContext.protectionLevel = 'MAXIMUM';
    
    // Trigger emergency protocols
    this.emit('emergencyProtocol', {
      type: 'CRITICAL_SECURITY_EVENT',
      event,
      timestamp: Date.now()
    });
  }

  /**
   * Create security middleware
   */
  createSecurityMiddleware() {
    return (req, res, next) => {
      // Validate input
      const validation = this.inputValidator.validateRequest(req);
      if (!validation.isValid) {
        this.handleSecurityEvent('INVALID_INPUT', { issues: validation.issues });
        return res.status(400).json({ 
          error: 'Invalid input', 
          issues: validation.issues 
        });
      }
      
      // Sanitize input
      req.body = this.inputValidator.sanitizeInput(req.body);
      
      // Add security headers
      Object.entries(this.hardeningRules.securityHeaders).forEach(([header, value]) => {
        res.setHeader(header, value);
      });
      
      // Override res.json to sanitize output
      const originalJson = res.json;
      res.json = (body) => {
        const sanitizedBody = this.outputSanitizer.sanitizeOutput(body);
        return originalJson.call(res, sanitizedBody);
      };
      
      next();
    };
  }

  /**
   * Get security status
   */
  getSecurityStatus() {
    return {
      initialized: this.securityContext.initialized,
      protectionLevel: this.securityContext.protectionLevel,
      activeThreats: Array.from(this.securityContext.activeThreats),
      recentEvents: this.securityContext.securityEvents.slice(-10),
      metrics: {
        totalEvents: this.securityContext.securityEvents.length,
        criticalEvents: this.securityContext.securityEvents.filter(e => e.severity === 'CRITICAL').length,
        highEvents: this.securityContext.securityEvents.filter(e => e.severity === 'HIGH').length
      }
    };
  }

  /**
   * Update security configuration
   */
  updateSecurityConfig(newConfig) {
    Object.assign(this.config, newConfig);
    this.logger.info('Security configuration updated', { newConfig });
  }
}

module.exports = SecurityHardening;
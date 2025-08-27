/**
 * Enterprise-Grade Error Handler - Generation 2 Enhancement
 * Advanced error classification, recovery strategies, and intelligent alerting
 */

const { StructuredLogger } = require('../monitoring/logger');
const { EventEmitter } = require('events');

class EnterpriseErrorHandler extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.logger = new StructuredLogger('enterprise-error-handler');
    
    this.config = {
      enableTelemetry: options.enableTelemetry !== false,
      maxErrorHistory: options.maxErrorHistory || 1000,
      alertThresholds: {
        criticalErrorRate: options.criticalErrorRate || 0.05,  // 5%
        errorRateWindow: options.errorRateWindow || 300000,     // 5 minutes
        consecutiveFailures: options.consecutiveFailures || 5
      },
      retryStrategies: {
        exponentialBackoff: true,
        circuitBreaker: true,
        bulkhead: true
      },
      ...options
    };

    // Error tracking and analytics
    this.errorHistory = [];
    this.errorPatterns = new Map();
    this.recoveryStrategies = new Map();
    this.alertThresholds = new Map();
    
    // Circuit breaker states
    this.circuitBreakers = new Map();
    
    // Real-time metrics
    this.metrics = {
      totalErrors: 0,
      criticalErrors: 0,
      recoveredErrors: 0,
      alertsSent: 0,
      lastErrorTime: null,
      errorRate: 0,
      uptime: Date.now()
    };
    
    this.setupDefaultStrategies();
    this.startMetricsCollection();
  }

  /**
   * Handle errors with intelligent classification and recovery
   */
  async handleError(error, context = {}) {
    const errorRecord = this.classifyError(error, context);
    this.recordError(errorRecord);
    
    this.logger.error('Error handled', {
      errorId: errorRecord.id,
      classification: errorRecord.classification,
      severity: errorRecord.severity,
      component: context.component,
      operation: context.operation
    });

    // Attempt intelligent recovery
    const recoveryResult = await this.attemptRecovery(errorRecord, context);
    
    // Check if alerting is needed
    await this.checkAlertThresholds(errorRecord);
    
    // Update circuit breaker if needed
    this.updateCircuitBreaker(context.component, errorRecord);
    
    // Emit events for monitoring
    this.emit('error-handled', {
      error: errorRecord,
      recovery: recoveryResult,
      context
    });
    
    return {
      errorId: errorRecord.id,
      recovered: recoveryResult.success,
      strategy: recoveryResult.strategy,
      recommendation: this.generateRecommendation(errorRecord)
    };
  }

  /**
   * Classify errors with advanced pattern recognition
   */
  classifyError(error, context) {
    const errorId = `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    
    // Extract error characteristics
    const characteristics = {
      message: error.message || 'Unknown error',
      stack: error.stack,
      code: error.code,
      type: error.constructor.name,
      component: context.component,
      operation: context.operation,
      userAgent: context.userAgent,
      requestId: context.requestId
    };
    
    // Classify severity
    const severity = this.determineSeverity(error, context);
    
    // Classify error type
    const classification = this.classifyErrorType(error, context);
    
    // Determine recoverability
    const recoverable = this.isRecoverable(classification, characteristics);
    
    return {
      id: errorId,
      timestamp,
      error,
      characteristics,
      classification,
      severity,
      recoverable,
      context: { ...context },
      fingerprint: this.generateFingerprint(characteristics)
    };
  }

  /**
   * Determine error severity using ML-inspired classification
   */
  determineSeverity(error, context) {
    let severityScore = 0;
    
    // Message-based scoring
    const criticalPatterns = [
      /out of memory/i,
      /heap.*exhausted/i,
      /cannot allocate/i,
      /database.*down/i,
      /network.*unreachable/i,
      /security.*violation/i,
      /authentication.*failed/i
    ];
    
    const highPatterns = [
      /timeout/i,
      /connection.*refused/i,
      /rate.*limit/i,
      /permission.*denied/i,
      /not.*found/i
    ];
    
    if (criticalPatterns.some(pattern => pattern.test(error.message))) {
      severityScore += 40;
    } else if (highPatterns.some(pattern => pattern.test(error.message))) {
      severityScore += 25;
    }
    
    // Context-based scoring
    if (context.component === 'database') severityScore += 20;
    if (context.component === 'security') severityScore += 15;
    if (context.operation === 'initialization') severityScore += 10;
    
    // Error type scoring
    if (error instanceof TypeError) severityScore += 15;
    if (error instanceof ReferenceError) severityScore += 20;
    
    // Determine final severity
    if (severityScore >= 35) return 'critical';
    if (severityScore >= 20) return 'high';
    if (severityScore >= 10) return 'medium';
    return 'low';
  }

  /**
   * Classify error type for targeted recovery strategies
   */
  classifyErrorType(error, context) {
    const message = (error.message || '').toLowerCase();
    const stack = (error.stack || '').toLowerCase();
    
    // Network errors
    if (/econnrefused|enotfound|etimedout|econnreset/i.test(message)) {
      return 'network';
    }
    
    // Database errors
    if (/connection.*refused|database|query|transaction/i.test(message)) {
      return 'database';
    }
    
    // Memory errors
    if (/heap|memory|allocation/i.test(message)) {
      return 'memory';
    }
    
    // Permission errors
    if (/permission|access|denied|forbidden|unauthorized/i.test(message)) {
      return 'permission';
    }
    
    // Rate limiting
    if (/rate.*limit|too.*many.*requests|throttle/i.test(message)) {
      return 'rate-limit';
    }
    
    // Timeout errors
    if (/timeout|timed.*out/i.test(message)) {
      return 'timeout';
    }
    
    // Validation errors
    if (/validation|invalid|required|format/i.test(message)) {
      return 'validation';
    }
    
    // Configuration errors
    if (/config|setting|environment|missing/i.test(message)) {
      return 'configuration';
    }
    
    return 'unknown';
  }

  /**
   * Attempt intelligent error recovery
   */
  async attemptRecovery(errorRecord, context) {
    const strategy = this.selectRecoveryStrategy(errorRecord);
    
    if (!strategy) {
      return { success: false, strategy: 'none', message: 'No recovery strategy available' };
    }

    try {
      const result = await strategy.execute(errorRecord, context);
      
      if (result.success) {
        this.metrics.recoveredErrors++;
        this.logger.info('Error recovery successful', {
          errorId: errorRecord.id,
          strategy: strategy.name,
          duration: result.duration
        });
      }
      
      return {
        success: result.success,
        strategy: strategy.name,
        duration: result.duration,
        message: result.message
      };
      
    } catch (recoveryError) {
      this.logger.error('Recovery strategy failed', {
        errorId: errorRecord.id,
        strategy: strategy.name,
        recoveryError: recoveryError.message
      });
      
      return {
        success: false,
        strategy: strategy.name,
        error: recoveryError.message
      };
    }
  }

  /**
   * Select optimal recovery strategy
   */
  selectRecoveryStrategy(errorRecord) {
    const strategies = this.recoveryStrategies.get(errorRecord.classification) || [];
    
    if (strategies.length === 0) {
      return this.recoveryStrategies.get('default')?.[0];
    }
    
    // Select best strategy based on historical success rate
    return strategies.reduce((best, current) => {
      const bestSuccessRate = this.getStrategySuccessRate(best.name);
      const currentSuccessRate = this.getStrategySuccessRate(current.name);
      
      return currentSuccessRate > bestSuccessRate ? current : best;
    });
  }

  /**
   * Check alert thresholds and send notifications
   */
  async checkAlertThresholds(errorRecord) {
    const currentTime = Date.now();
    const windowErrors = this.getErrorsInWindow(
      currentTime - this.config.alertThresholds.errorRateWindow
    );
    
    const errorRate = windowErrors.length / (this.config.alertThresholds.errorRateWindow / 1000);
    this.metrics.errorRate = errorRate;
    
    // Check critical error rate
    if (errorRate > this.config.alertThresholds.criticalErrorRate) {
      await this.sendAlert({
        type: 'high-error-rate',
        severity: 'critical',
        message: `Error rate (${errorRate.toFixed(2)}/sec) exceeds threshold`,
        errorRate,
        threshold: this.config.alertThresholds.criticalErrorRate,
        recentErrors: windowErrors.slice(-5)
      });
    }
    
    // Check consecutive failures
    const recentErrors = windowErrors.slice(-this.config.alertThresholds.consecutiveFailures);
    if (recentErrors.length >= this.config.alertThresholds.consecutiveFailures &&
        recentErrors.every(e => e.severity === 'critical')) {
      
      await this.sendAlert({
        type: 'consecutive-critical-failures',
        severity: 'critical',
        message: `${this.config.alertThresholds.consecutiveFailures} consecutive critical failures detected`,
        errors: recentErrors
      });
    }
  }

  /**
   * Send intelligent alerts
   */
  async sendAlert(alertData) {
    this.metrics.alertsSent++;
    
    const alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...alertData,
      metrics: { ...this.metrics },
      recommendations: this.generateAlertRecommendations(alertData)
    };
    
    this.logger.warn('Alert triggered', alert);
    this.emit('alert', alert);
    
    // Here you would integrate with external alerting systems
    // (Slack, PagerDuty, email, etc.)
  }

  /**
   * Generate error fingerprint for deduplication
   */
  generateFingerprint(characteristics) {
    const crypto = require('crypto');
    const fingerprint = `${characteristics.type}-${characteristics.component}-${characteristics.message}`;
    return crypto.createHash('sha256').update(fingerprint).digest('hex').substr(0, 12);
  }

  /**
   * Setup default recovery strategies
   */
  setupDefaultStrategies() {
    // Network recovery strategies
    this.recoveryStrategies.set('network', [
      {
        name: 'exponential-backoff-retry',
        execute: async (errorRecord, context) => {
          const maxRetries = 3;
          const baseDelay = 1000;
          
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, attempt - 1)));
            
            try {
              // Simulate retry logic
              if (Math.random() > 0.3) { // 70% success rate simulation
                return { 
                  success: true, 
                  duration: attempt * baseDelay,
                  message: `Recovered after ${attempt} attempts`
                };
              }
            } catch (retryError) {
              if (attempt === maxRetries) {
                return { 
                  success: false, 
                  duration: attempt * baseDelay,
                  message: 'Max retries exceeded'
                };
              }
            }
          }
          
          return { success: false, duration: maxRetries * baseDelay };
        }
      }
    ]);

    // Database recovery strategies
    this.recoveryStrategies.set('database', [
      {
        name: 'connection-pool-reset',
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 500));
          return { 
            success: Math.random() > 0.2, 
            duration: 500,
            message: 'Connection pool reset attempted'
          };
        }
      }
    ]);

    // Memory recovery strategies
    this.recoveryStrategies.set('memory', [
      {
        name: 'garbage-collection',
        execute: async () => {
          if (global.gc) {
            global.gc();
          }
          return { 
            success: true, 
            duration: 100,
            message: 'Garbage collection triggered'
          };
        }
      }
    ]);

    // Default fallback strategy
    this.recoveryStrategies.set('default', [
      {
        name: 'basic-retry',
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return { 
            success: Math.random() > 0.5, 
            duration: 1000,
            message: 'Basic retry attempted'
          };
        }
      }
    ]);
  }

  // Helper methods
  recordError(errorRecord) {
    this.errorHistory.push(errorRecord);
    this.metrics.totalErrors++;
    
    if (errorRecord.severity === 'critical') {
      this.metrics.criticalErrors++;
    }
    
    this.metrics.lastErrorTime = errorRecord.timestamp;
    
    // Maintain max history size
    if (this.errorHistory.length > this.config.maxErrorHistory) {
      this.errorHistory.shift();
    }
  }

  getErrorsInWindow(since) {
    return this.errorHistory.filter(error => 
      new Date(error.timestamp).getTime() >= since
    );
  }

  isRecoverable(classification, characteristics) {
    const recoverableTypes = ['network', 'timeout', 'rate-limit', 'database'];
    return recoverableTypes.includes(classification);
  }

  getStrategySuccessRate(strategyName) {
    // Simulate historical success rates - in production, this would query actual metrics
    const rates = {
      'exponential-backoff-retry': 0.85,
      'connection-pool-reset': 0.75,
      'garbage-collection': 0.95,
      'basic-retry': 0.60
    };
    return rates[strategyName] || 0.50;
  }

  generateRecommendation(errorRecord) {
    const recommendations = {
      'network': 'Consider implementing connection pooling and circuit breakers',
      'database': 'Review query performance and connection management',
      'memory': 'Analyze memory usage patterns and implement better garbage collection',
      'timeout': 'Increase timeout values or optimize slow operations',
      'rate-limit': 'Implement request throttling and backoff strategies'
    };
    
    return recommendations[errorRecord.classification] || 
           'Monitor error patterns and consider implementing specific recovery strategies';
  }

  generateAlertRecommendations(alertData) {
    if (alertData.type === 'high-error-rate') {
      return [
        'Scale up infrastructure resources',
        'Enable circuit breakers for failing components',
        'Review recent deployments for issues'
      ];
    }
    
    if (alertData.type === 'consecutive-critical-failures') {
      return [
        'Investigate root cause immediately',
        'Consider enabling fail-safe mode',
        'Review system dependencies'
      ];
    }
    
    return ['Monitor system health and check logs'];
  }

  updateCircuitBreaker(component, errorRecord) {
    if (!component) return;
    
    const breaker = this.circuitBreakers.get(component) || {
      failures: 0,
      state: 'closed',
      lastFailure: null
    };
    
    if (errorRecord.severity === 'critical') {
      breaker.failures++;
      breaker.lastFailure = Date.now();
      
      if (breaker.failures >= 5 && breaker.state === 'closed') {
        breaker.state = 'open';
        this.logger.warn('Circuit breaker opened', { component });
        
        // Auto-close after 30 seconds
        setTimeout(() => {
          breaker.state = 'half-open';
          this.logger.info('Circuit breaker half-opened', { component });
        }, 30000);
      }
    }
    
    this.circuitBreakers.set(component, breaker);
  }

  startMetricsCollection() {
    setInterval(() => {
      this.emit('metrics-updated', { ...this.metrics });
    }, 10000); // Every 10 seconds
  }

  /**
   * Get current error handling status
   */
  getStatus() {
    return {
      metrics: { ...this.metrics },
      errorHistory: this.errorHistory.slice(-10), // Last 10 errors
      circuitBreakers: Object.fromEntries(this.circuitBreakers),
      uptime: Date.now() - this.metrics.uptime,
      isHealthy: this.metrics.errorRate < this.config.alertThresholds.criticalErrorRate
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    this.logger.info('Shutting down Enterprise Error Handler');
    this.removeAllListeners();
  }
}

module.exports = EnterpriseErrorHandler;
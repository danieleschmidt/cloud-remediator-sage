/**
 * Advanced Error Recovery System
 * Provides intelligent error analysis, recovery strategies, and self-healing capabilities
 */

const { EventEmitter } = require('events');
const { StructuredLogger } = require('../monitoring/logger');

class AdvancedErrorRecovery extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.logger = new StructuredLogger('error-recovery');
    this.options = {
      autoRecoveryEnabled: options.autoRecoveryEnabled !== false,
      maxRecoveryAttempts: options.maxRecoveryAttempts || 3,
      recoveryTimeout: options.recoveryTimeout || 30000,
      learningEnabled: options.learningEnabled !== false,
      ...options
    };
    
    // Error patterns and recovery strategies
    this.errorPatterns = new Map();
    this.recoveryStrategies = new Map();
    this.errorHistory = [];
    this.recoveryMetrics = {
      totalErrors: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      recoveryRate: 0
    };
    
    this.setupRecoveryStrategies();
  }

  /**
   * Initialize recovery strategies
   */
  setupRecoveryStrategies() {
    // Network-related errors
    this.addRecoveryStrategy('NETWORK_ERROR', {
      pattern: /(ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ECONNRESET)/i,
      strategy: async (error, context) => {
        this.logger.info('Applying network error recovery', { error: error.message, context });
        
        // Wait and retry with exponential backoff
        const attempt = context.attempt || 1;
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return { recovered: true, strategy: 'network-retry', delay };
      }
    });

    // Database connection errors
    this.addRecoveryStrategy('DATABASE_ERROR', {
      pattern: /(Connection refused|Connection timeout|Unable to connect)/i,
      strategy: async (error, context) => {
        this.logger.info('Applying database error recovery', { error: error.message, context });
        
        // Reset connection pool and retry
        if (context.service && context.service.reconnect) {
          await context.service.reconnect();
        }
        
        return { recovered: true, strategy: 'database-reconnect' };
      }
    });

    // Memory-related errors
    this.addRecoveryStrategy('MEMORY_ERROR', {
      pattern: /(out of memory|Maximum call stack|heap out of memory)/i,
      strategy: async (error, context) => {
        this.logger.warn('Applying memory error recovery', { error: error.message, context });
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        // Reduce batch sizes or processing load
        if (context.batchSize) {
          context.batchSize = Math.max(1, Math.floor(context.batchSize / 2));
        }
        
        return { recovered: true, strategy: 'memory-optimization', newBatchSize: context.batchSize };
      }
    });

    // Rate limiting errors
    this.addRecoveryStrategy('RATE_LIMIT_ERROR', {
      pattern: /(rate limit|too many requests|throttled)/i,
      strategy: async (error, context) => {
        this.logger.info('Applying rate limit recovery', { error: error.message, context });
        
        // Extract retry-after from headers or use default
        const retryAfter = context.retryAfter || 5000;
        await new Promise(resolve => setTimeout(resolve, retryAfter));
        
        return { recovered: true, strategy: 'rate-limit-backoff', retryAfter };
      }
    });

    // Permission/authentication errors
    this.addRecoveryStrategy('AUTH_ERROR', {
      pattern: /(unauthorized|forbidden|access denied|invalid token)/i,
      strategy: async (error, context) => {
        this.logger.warn('Applying authentication error recovery', { error: error.message, context });
        
        // Attempt to refresh tokens or re-authenticate
        if (context.authService && context.authService.refreshToken) {
          try {
            await context.authService.refreshToken();
            return { recovered: true, strategy: 'token-refresh' };
          } catch (refreshError) {
            return { recovered: false, strategy: 'token-refresh-failed', refreshError: refreshError.message };
          }
        }
        
        return { recovered: false, strategy: 'auth-recovery-unavailable' };
      }
    });
  }

  /**
   * Add a recovery strategy for specific error patterns
   */
  addRecoveryStrategy(name, config) {
    this.recoveryStrategies.set(name, config);
    this.logger.debug('Recovery strategy added', { name, pattern: config.pattern.toString() });
  }

  /**
   * Attempt to recover from an error
   */
  async attemptRecovery(error, context = {}) {
    this.recoveryMetrics.totalErrors++;
    
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      context,
      attempt: context.attempt || 1
    };
    
    this.errorHistory.push(errorInfo);
    this.emit('errorOccurred', errorInfo);
    
    // Limit error history size
    if (this.errorHistory.length > 1000) {
      this.errorHistory = this.errorHistory.slice(-500);
    }
    
    // Check if recovery is enabled and within attempt limits
    if (!this.options.autoRecoveryEnabled || errorInfo.attempt > this.options.maxRecoveryAttempts) {
      this.recoveryMetrics.failedRecoveries++;
      return { recovered: false, reason: 'recovery-disabled-or-max-attempts' };
    }
    
    // Find matching recovery strategy
    const strategy = this.findRecoveryStrategy(error);
    if (!strategy) {
      this.recoveryMetrics.failedRecoveries++;
      return { recovered: false, reason: 'no-matching-strategy' };
    }
    
    try {
      this.logger.info('Attempting error recovery', { 
        strategy: strategy.name, 
        error: error.message,
        attempt: errorInfo.attempt 
      });
      
      const recoveryResult = await Promise.race([
        strategy.config.strategy(error, context),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Recovery timeout')), this.options.recoveryTimeout)
        )
      ]);
      
      if (recoveryResult.recovered) {
        this.recoveryMetrics.successfulRecoveries++;
        this.updateRecoveryRate();
        
        this.emit('recoverySuccessful', {
          strategy: strategy.name,
          error: error.message,
          recoveryResult,
          attempt: errorInfo.attempt
        });
        
        // Learn from successful recovery
        if (this.options.learningEnabled) {
          this.learnFromRecovery(error, strategy.name, true);
        }
        
        return { 
          recovered: true, 
          strategy: strategy.name, 
          ...recoveryResult 
        };
      } else {
        this.recoveryMetrics.failedRecoveries++;
        this.updateRecoveryRate();
        return { recovered: false, reason: 'strategy-failed', ...recoveryResult };
      }
      
    } catch (recoveryError) {
      this.recoveryMetrics.failedRecoveries++;
      this.updateRecoveryRate();
      
      this.logger.error('Recovery strategy failed', {
        strategy: strategy.name,
        error: error.message,
        recoveryError: recoveryError.message
      });
      
      return { 
        recovered: false, 
        reason: 'strategy-exception', 
        recoveryError: recoveryError.message 
      };
    }
  }

  /**
   * Find the best recovery strategy for an error
   */
  findRecoveryStrategy(error) {
    for (const [name, config] of this.recoveryStrategies) {
      if (config.pattern.test(error.message)) {
        return { name, config };
      }
    }
    return null;
  }

  /**
   * Learn from recovery attempts to improve future strategies
   */
  learnFromRecovery(error, strategyName, success) {
    const errorSignature = this.createErrorSignature(error);
    
    if (!this.errorPatterns.has(errorSignature)) {
      this.errorPatterns.set(errorSignature, {
        count: 0,
        successfulStrategies: new Map(),
        failedStrategies: new Map()
      });
    }
    
    const pattern = this.errorPatterns.get(errorSignature);
    pattern.count++;
    
    if (success) {
      const strategyCount = pattern.successfulStrategies.get(strategyName) || 0;
      pattern.successfulStrategies.set(strategyName, strategyCount + 1);
    } else {
      const strategyCount = pattern.failedStrategies.get(strategyName) || 0;
      pattern.failedStrategies.set(strategyName, strategyCount + 1);
    }
  }

  /**
   * Create a signature for error pattern matching
   */
  createErrorSignature(error) {
    // Create a normalized signature from error message
    return error.message
      .toLowerCase()
      .replace(/\d+/g, '#')  // Replace numbers with #
      .replace(/['"]/g, '')  // Remove quotes
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .trim()
      .substring(0, 100);    // Limit length
  }

  /**
   * Update recovery rate metrics
   */
  updateRecoveryRate() {
    const total = this.recoveryMetrics.successfulRecoveries + this.recoveryMetrics.failedRecoveries;
    this.recoveryMetrics.recoveryRate = total > 0 ? 
      this.recoveryMetrics.successfulRecoveries / total : 0;
  }

  /**
   * Get recovery system status and metrics
   */
  getRecoveryStatus() {
    return {
      status: 'healthy',
      metrics: { ...this.recoveryMetrics },
      strategies: Array.from(this.recoveryStrategies.keys()),
      errorPatterns: this.errorPatterns.size,
      recentErrors: this.errorHistory.slice(-10),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get recovery recommendations based on learned patterns
   */
  getRecoveryRecommendations() {
    const recommendations = [];
    
    for (const [signature, pattern] of this.errorPatterns) {
      if (pattern.count > 5) { // Only consider frequent errors
        const totalAttempts = Array.from(pattern.successfulStrategies.values()).reduce((a, b) => a + b, 0) +
                             Array.from(pattern.failedStrategies.values()).reduce((a, b) => a + b, 0);
        
        if (totalAttempts > 0) {
          const successRate = Array.from(pattern.successfulStrategies.values()).reduce((a, b) => a + b, 0) / totalAttempts;
          
          if (successRate < 0.5) {
            recommendations.push({
              errorSignature: signature,
              frequency: pattern.count,
              successRate: successRate,
              recommendation: 'Consider implementing custom recovery strategy',
              topFailedStrategies: Array.from(pattern.failedStrategies.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
            });
          }
        }
      }
    }
    
    return recommendations;
  }

  /**
   * Reset recovery metrics and patterns
   */
  reset() {
    this.errorPatterns.clear();
    this.errorHistory = [];
    this.recoveryMetrics = {
      totalErrors: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      recoveryRate: 0
    };
    
    this.logger.info('Error recovery system reset');
  }
}

module.exports = AdvancedErrorRecovery;
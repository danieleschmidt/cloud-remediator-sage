/**
 * Enhanced Error Handling Module
 * Provides comprehensive error handling, classification, and recovery strategies
 */

const { StructuredLogger } = require('../monitoring/logger');

class ErrorHandler {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this.logger = new StructuredLogger({ serviceName });
    this.errorCounts = new Map();
    this.maxRetries = 3;
    this.baseDelay = 1000;
  }

  /**
   * Classify error type for appropriate handling
   */
  classifyError(error) {
    // AWS Service Errors
    if (error.code) {
      if (error.code.includes('Throttling') || error.code === 'TooManyRequestsException') {
        return {
          type: 'THROTTLING',
          severity: 'HIGH',
          recoverable: true,
          retryable: true,
          backoffMultiplier: 2
        };
      }

      if (error.code === 'InvalidParameterException' || error.code === 'ValidationException') {
        return {
          type: 'VALIDATION',
          severity: 'LOW',
          recoverable: false,
          retryable: false,
          requiresUserAction: true
        };
      }

      if (error.code === 'AccessDeniedException' || error.code === 'UnauthorizedException') {
        return {
          type: 'AUTHORIZATION',
          severity: 'HIGH',
          recoverable: false,
          retryable: false,
          requiresUserAction: true
        };
      }

      if (error.code === 'ResourceNotFoundException' || error.code === 'NoSuchBucket') {
        return {
          type: 'RESOURCE_NOT_FOUND',
          severity: 'MEDIUM',
          recoverable: false,
          retryable: false,
          requiresUserAction: true
        };
      }

      if (error.code === 'ServiceUnavailableException' || error.code === 'InternalServerError') {
        return {
          type: 'SERVICE_UNAVAILABLE',
          severity: 'HIGH',
          recoverable: true,
          retryable: true,
          backoffMultiplier: 3
        };
      }
    }

    // Network Errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return {
        type: 'NETWORK',
        severity: 'HIGH',
        recoverable: true,
        retryable: true,
        backoffMultiplier: 2
      };
    }

    // Memory/Resource Errors
    if (error.message && error.message.includes('out of memory')) {
      return {
        type: 'RESOURCE',
        severity: 'CRITICAL',
        recoverable: false,
        retryable: false,
        requiresScaling: true
      };
    }

    // Timeout Errors
    if (error.message && (error.message.includes('timeout') || error.message.includes('timed out'))) {
      return {
        type: 'TIMEOUT',
        severity: 'MEDIUM',
        recoverable: true,
        retryable: true,
        backoffMultiplier: 1.5
      };
    }

    // Database/Neptune Errors
    if (error.message && error.message.includes('Neptune')) {
      return {
        type: 'DATABASE',
        severity: 'HIGH',
        recoverable: true,
        retryable: true,
        backoffMultiplier: 2
      };
    }

    // Default classification
    return {
      type: 'UNKNOWN',
      severity: 'MEDIUM',
      recoverable: true,
      retryable: true,
      backoffMultiplier: 2
    };
  }

  /**
   * Execute function with retry logic and error handling
   */
  async executeWithRetry(fn, context = {}, maxRetries = null) {
    const retries = maxRetries || this.maxRetries;
    const correlationId = context.correlationId || this.logger.createCorrelationId();
    let lastError;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await fn();
        
        // Reset error count on success
        this.errorCounts.delete(context.operationName);
        
        if (attempt > 1) {
          this.logger.info(`Operation succeeded on attempt ${attempt}`, correlationId, {
            operationName: context.operationName,
            attempt,
            previousErrors: lastError?.message
          });
        }

        return result;
      } catch (error) {
        lastError = error;
        const errorClass = this.classifyError(error);
        
        // Track error counts
        const errorKey = `${context.operationName}:${errorClass.type}`;
        const currentCount = this.errorCounts.get(errorKey) || 0;
        this.errorCounts.set(errorKey, currentCount + 1);

        this.logger.error(
          `Operation failed on attempt ${attempt}/${retries}`, 
          correlationId,
          error,
          {
            operationName: context.operationName,
            attempt,
            errorType: errorClass.type,
            errorSeverity: errorClass.severity,
            recoverable: errorClass.recoverable,
            retryable: errorClass.retryable
          }
        );

        // Don't retry if error is not retryable
        if (!errorClass.retryable || attempt === retries) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = this.baseDelay * Math.pow(errorClass.backoffMultiplier, attempt - 1);
        const jitter = Math.random() * 0.1 * delay; // Add jitter
        const totalDelay = delay + jitter;

        this.logger.debug(`Retrying in ${totalDelay}ms`, correlationId, {
          operationName: context.operationName,
          attempt,
          delay: totalDelay,
          errorType: errorClass.type
        });

        await this.delay(totalDelay);
      }
    }

    // All retries exhausted
    const errorClass = this.classifyError(lastError);
    const enhancedError = this.createEnhancedError(lastError, errorClass, context);
    
    this.logger.error('All retry attempts exhausted', correlationId, enhancedError, {
      operationName: context.operationName,
      maxRetries: retries,
      errorType: errorClass.type,
      severity: errorClass.severity
    });

    throw enhancedError;
  }

  /**
   * Create enhanced error with additional context
   */
  createEnhancedError(originalError, classification, context) {
    const enhancedError = new Error(originalError.message);
    enhancedError.name = 'EnhancedError';
    enhancedError.original = originalError;
    enhancedError.classification = classification;
    enhancedError.context = context;
    enhancedError.timestamp = new Date().toISOString();
    enhancedError.serviceName = this.serviceName;

    // Add recovery suggestions
    enhancedError.recoverySuggestions = this.getRecoverySuggestions(classification);

    return enhancedError;
  }

  /**
   * Get recovery suggestions based on error classification
   */
  getRecoverySuggestions(classification) {
    const suggestions = [];

    switch (classification.type) {
      case 'THROTTLING':
        suggestions.push('Implement exponential backoff');
        suggestions.push('Reduce request rate');
        suggestions.push('Consider request batching');
        break;
      case 'AUTHORIZATION':
        suggestions.push('Check IAM permissions');
        suggestions.push('Verify AWS credentials');
        suggestions.push('Review resource policies');
        break;
      case 'NETWORK':
        suggestions.push('Check network connectivity');
        suggestions.push('Verify DNS resolution');
        suggestions.push('Review security group rules');
        break;
      case 'RESOURCE_NOT_FOUND':
        suggestions.push('Verify resource exists');
        suggestions.push('Check resource ARN/identifier');
        suggestions.push('Review resource region');
        break;
      case 'TIMEOUT':
        suggestions.push('Increase timeout values');
        suggestions.push('Optimize query performance');
        suggestions.push('Consider async processing');
        break;
      case 'DATABASE':
        suggestions.push('Check database connectivity');
        suggestions.push('Review database configuration');
        suggestions.push('Monitor database performance');
        break;
      case 'RESOURCE':
        suggestions.push('Scale up resources');
        suggestions.push('Optimize memory usage');
        suggestions.push('Review resource allocation');
        break;
      default:
        suggestions.push('Review error details');
        suggestions.push('Check service status');
        suggestions.push('Contact support if needed');
    }

    return suggestions;
  }

  /**
   * Handle critical errors that require immediate attention
   */
  handleCriticalError(error, context) {
    const correlationId = context.correlationId || this.logger.createCorrelationId();
    const classification = this.classifyError(error);

    if (classification.severity === 'CRITICAL') {
      // Send alerts, trigger notifications, etc.
      this.logger.security('Critical error detected', correlationId, {
        error: error.message,
        classification,
        context,
        requiresImmediateAction: true
      });

      // Could integrate with SNS, PagerDuty, etc.
      this.notifyCriticalError(error, classification, context);
    }
  }

  /**
   * Notify about critical errors (placeholder for real implementation)
   */
  async notifyCriticalError(error, classification, context) {
    // In real implementation, this would send notifications
    console.error('CRITICAL ERROR NOTIFICATION:', {
      error: error.message,
      classification,
      context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Create error handling middleware for Lambda functions
   */
  createLambdaMiddleware() {
    return (handler) => {
      return async (event, context, logger) => {
        const correlationId = logger?.correlationId || this.logger.createCorrelationId();
        
        try {
          return await handler(event, context, logger);
        } catch (error) {
          const classification = this.classifyError(error);
          const enhancedError = this.createEnhancedError(error, classification, {
            functionName: context.functionName,
            requestId: context.awsRequestId,
            correlationId
          });

          // Handle critical errors
          if (classification.severity === 'CRITICAL') {
            this.handleCriticalError(error, {
              functionName: context.functionName,
              requestId: context.awsRequestId,
              correlationId
            });
          }

          // Return appropriate HTTP response based on error type
          return this.createErrorResponse(enhancedError, classification);
        }
      };
    };
  }

  /**
   * Create HTTP error response
   */
  createErrorResponse(error, classification) {
    const statusCodeMap = {
      'VALIDATION': 400,
      'AUTHORIZATION': 401,
      'RESOURCE_NOT_FOUND': 404,
      'THROTTLING': 429,
      'SERVICE_UNAVAILABLE': 503,
      'TIMEOUT': 504,
      'RESOURCE': 507,
      'NETWORK': 502,
      'DATABASE': 503,
      'UNKNOWN': 500
    };

    const statusCode = statusCodeMap[classification.type] || 500;

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': error.context?.correlationId,
        'X-Error-Type': classification.type,
        'X-Retryable': classification.retryable ? 'true' : 'false'
      },
      body: JSON.stringify({
        error: true,
        type: classification.type,
        message: error.message,
        correlationId: error.context?.correlationId,
        timestamp: error.timestamp,
        retryable: classification.retryable,
        recoverySuggestions: classification.requiresUserAction ? error.recoverySuggestions : undefined
      })
    };
  }

  /**
   * Delay helper function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get error statistics
   */
  getErrorStatistics() {
    const stats = {};
    for (const [key, count] of this.errorCounts.entries()) {
      stats[key] = count;
    }
    return stats;
  }

  /**
   * Reset error statistics
   */
  resetErrorStatistics() {
    this.errorCounts.clear();
  }
}

module.exports = { ErrorHandler };
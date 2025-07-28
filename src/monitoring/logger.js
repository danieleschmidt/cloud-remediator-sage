/**
 * Structured Logging Module for Cloud Remediator Sage
 * Provides correlation IDs, structured output, and security-focused logging
 */

const { v4: uuidv4 } = require('crypto');

class StructuredLogger {
    constructor(options = {}) {
        this.serviceName = options.serviceName || 'cloud-remediator-sage';
        this.environment = process.env.STAGE || 'development';
        this.version = require('../../package.json').version;
        this.correlationContext = new Map();
    }

    /**
     * Create a correlation ID for request tracking
     */
    createCorrelationId() {
        return uuidv4();
    }

    /**
     * Set correlation context for current execution
     */
    setCorrelationContext(correlationId, context = {}) {
        this.correlationContext.set(correlationId, {
            ...context,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Get correlation context
     */
    getCorrelationContext(correlationId) {
        return this.correlationContext.get(correlationId) || {};
    }

    /**
     * Clean up old correlation contexts (prevent memory leaks)
     */
    cleanupCorrelationContexts(maxAge = 3600000) { // 1 hour default
        const now = Date.now();
        for (const [id, context] of this.correlationContext.entries()) {
            const contextAge = now - new Date(context.timestamp).getTime();
            if (contextAge > maxAge) {
                this.correlationContext.delete(id);
            }
        }
    }

    /**
     * Create base log structure
     */
    createLogEntry(level, message, correlationId, metadata = {}) {
        const timestamp = new Date().toISOString();
        const context = this.getCorrelationContext(correlationId);
        
        return {
            timestamp,
            level: level.toUpperCase(),
            service: this.serviceName,
            version: this.version,
            environment: this.environment,
            correlationId,
            message,
            context,
            metadata: this.sanitizeMetadata(metadata),
            ...(process.env.AWS_LAMBDA_FUNCTION_NAME && {
                lambda: {
                    functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
                    functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION,
                    requestId: process.env.AWS_REQUEST_ID
                }
            })
        };
    }

    /**
     * Sanitize metadata to remove sensitive information
     */
    sanitizeMetadata(metadata) {
        const sensitiveKeys = [
            'password', 'secret', 'key', 'token', 'credential',
            'authorization', 'auth', 'apikey', 'api_key'
        ];
        
        const sanitized = JSON.parse(JSON.stringify(metadata));
        
        const sanitizeObject = (obj) => {
            if (typeof obj !== 'object' || obj === null) return obj;
            
            for (const [key, value] of Object.entries(obj)) {
                const lowerKey = key.toLowerCase();
                if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
                    obj[key] = '[REDACTED]';
                } else if (typeof value === 'object') {
                    sanitizeObject(value);
                }
            }
            return obj;
        };
        
        return sanitizeObject(sanitized);
    }

    /**
     * Output log entry
     */
    output(logEntry) {
        console.log(JSON.stringify(logEntry));
    }

    /**
     * Info level logging
     */
    info(message, correlationId, metadata = {}) {
        const logEntry = this.createLogEntry('info', message, correlationId, metadata);
        this.output(logEntry);
        return logEntry;
    }

    /**
     * Warning level logging
     */
    warn(message, correlationId, metadata = {}) {
        const logEntry = this.createLogEntry('warn', message, correlationId, metadata);
        this.output(logEntry);
        return logEntry;
    }

    /**
     * Error level logging
     */
    error(message, correlationId, error, metadata = {}) {
        const errorMetadata = {
            ...metadata,
            error: {
                name: error?.name,
                message: error?.message,
                stack: error?.stack,
                ...(error?.code && { code: error.code })
            }
        };
        
        const logEntry = this.createLogEntry('error', message, correlationId, errorMetadata);
        this.output(logEntry);
        return logEntry;
    }

    /**
     * Debug level logging (only in development)
     */
    debug(message, correlationId, metadata = {}) {
        if (this.environment === 'development' || process.env.DEBUG === 'true') {
            const logEntry = this.createLogEntry('debug', message, correlationId, metadata);
            this.output(logEntry);
            return logEntry;
        }
    }

    /**
     * Security event logging
     */
    security(event, correlationId, metadata = {}) {
        const securityMetadata = {
            ...metadata,
            security: true,
            severity: metadata.severity || 'medium'
        };
        
        const logEntry = this.createLogEntry('security', `Security Event: ${event}`, correlationId, securityMetadata);
        this.output(logEntry);
        return logEntry;
    }

    /**
     * Performance logging
     */
    performance(operation, duration, correlationId, metadata = {}) {
        const perfMetadata = {
            ...metadata,
            performance: {
                operation,
                duration,
                unit: 'milliseconds'
            }
        };
        
        const logEntry = this.createLogEntry('info', `Performance: ${operation}`, correlationId, perfMetadata);
        this.output(logEntry);
        return logEntry;
    }

    /**
     * Audit logging for compliance
     */
    audit(action, actor, resource, correlationId, metadata = {}) {
        const auditMetadata = {
            ...metadata,
            audit: {
                action,
                actor,
                resource,
                timestamp: new Date().toISOString()
            }
        };
        
        const logEntry = this.createLogEntry('audit', `Audit: ${action}`, correlationId, auditMetadata);
        this.output(logEntry);
        return logEntry;
    }

    /**
     * Create a timer for performance measurement
     */
    createTimer(operation, correlationId) {
        const startTime = Date.now();
        
        return {
            end: (metadata = {}) => {
                const duration = Date.now() - startTime;
                this.performance(operation, duration, correlationId, metadata);
                return duration;
            }
        };
    }

    /**
     * Create a child logger with preset correlation ID
     */
    child(correlationId, context = {}) {
        this.setCorrelationContext(correlationId, context);
        
        return {
            correlationId,
            info: (message, metadata) => this.info(message, correlationId, metadata),
            warn: (message, metadata) => this.warn(message, correlationId, metadata),
            error: (message, error, metadata) => this.error(message, correlationId, error, metadata),
            debug: (message, metadata) => this.debug(message, correlationId, metadata),
            security: (event, metadata) => this.security(event, correlationId, metadata),
            audit: (action, actor, resource, metadata) => this.audit(action, actor, resource, correlationId, metadata),
            timer: (operation) => this.createTimer(operation, correlationId)
        };
    }
}

// Singleton instance
const logger = new StructuredLogger();

// Middleware for Lambda functions
const withLogging = (handler) => {
    return async (event, context) => {
        const correlationId = logger.createCorrelationId();
        const childLogger = logger.child(correlationId, {
            functionName: context.functionName,
            requestId: context.awsRequestId,
            userAgent: event.headers?.['User-Agent'],
            sourceIp: event.requestContext?.identity?.sourceIp
        });

        childLogger.info('Lambda function invoked', {
            event: logger.sanitizeMetadata(event)
        });

        const timer = childLogger.timer('lambda_execution');

        try {
            const result = await handler(event, context, childLogger);
            timer.end({ status: 'success' });
            
            childLogger.info('Lambda function completed successfully');
            return result;
        } catch (error) {
            timer.end({ status: 'error' });
            childLogger.error('Lambda function failed', error);
            throw error;
        }
    };
};

module.exports = {
    logger,
    StructuredLogger,
    withLogging
};
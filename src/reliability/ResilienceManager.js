/**
 * Resilience Manager for Cloud Remediator Sage
 * Coordinates circuit breakers, health monitoring, and error recovery
 */

const { EventEmitter } = require('events');
const { StructuredLogger } = require('../monitoring/logger');
const HealthMonitor = require('./HealthMonitor');
const { CircuitBreaker } = require('../resilience/CircuitBreaker');
const { ErrorHandler } = require('../utils/errorHandler');

class ResilienceManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.logger = new StructuredLogger('resilience-manager');
    this.options = {
      healthCheckInterval: options.healthCheckInterval || 30000,
      circuitBreakerDefaults: {
        failureThreshold: 5,
        resetTimeout: 60000,
        monitoringPeriod: 10000
      },
      alertThresholds: {
        errorRate: 0.05,        // 5% error rate
        responseTime: 5000,     // 5 second response time
        memoryUsage: 0.85,      // 85% memory usage
        consecutiveFailures: 3   // 3 consecutive failures
      },
      ...options
    };

    // Initialize components
    this.healthMonitor = new HealthMonitor({
      checkInterval: this.options.healthCheckInterval
    });
    
    this.circuitBreakers = new Map();
    this.errorHandlers = new Map();
    this.systemMetrics = new Map();
    
    // State tracking
    this.isInitialized = false;
    this.systemHealth = 'unknown';
    this.alerts = new Set();
    
    this.setupEventHandlers();
  }

  /**
   * Initialize resilience manager
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    this.logger.info('Initializing Resilience Manager');

    // Register core health checks
    await this.registerCoreHealthChecks();

    // Start health monitoring
    this.healthMonitor.start();

    // Setup system metrics collection
    this.startSystemMetricsCollection();

    this.isInitialized = true;
    this.logger.info('Resilience Manager initialized successfully');

    this.emit('initialized');
  }

  /**
   * Setup event handlers for component coordination
   */
  setupEventHandlers() {
    // Health monitor events
    this.healthMonitor.on('healthCheck', (status) => {
      this.handleHealthCheckResult(status);
    });

    this.healthMonitor.on('alert', (alert) => {
      this.handleAlert(alert);
    });

    this.healthMonitor.on('alertResolved', (alert) => {
      this.handleAlertResolved(alert);
    });
  }

  /**
   * Register core health checks
   */
  async registerCoreHealthChecks() {
    // System memory check
    this.healthMonitor.registerCheck('system_memory', async () => {
      const usage = process.memoryUsage();
      const utilization = usage.heapUsed / usage.heapTotal;
      
      return {
        status: utilization > this.options.alertThresholds.memoryUsage ? 'unhealthy' : 'healthy',
        details: {
          heapUsed: usage.heapUsed,
          heapTotal: usage.heapTotal,
          utilization: Math.round(utilization * 100) / 100,
          external: usage.external,
          rss: usage.rss
        }
      };
    }, { critical: true });

    // Event loop lag check
    this.healthMonitor.registerCheck('event_loop_lag', async () => {
      const start = process.hrtime.bigint();
      await new Promise(resolve => setImmediate(resolve));
      const lag = Number(process.hrtime.bigint() - start) / 1e6; // Convert to milliseconds

      return {
        status: lag > 100 ? 'unhealthy' : (lag > 50 ? 'degraded' : 'healthy'),
        details: {
          lagMs: Math.round(lag * 100) / 100
        }
      };
    });

    // Error rate check
    this.healthMonitor.registerCheck('error_rate', async () => {
      const stats = this.getAggregatedErrorStats();
      const errorRate = stats.recentErrorRate || 0;
      
      return {
        status: errorRate > this.options.alertThresholds.errorRate ? 'unhealthy' : 'healthy',
        details: {
          errorRate: Math.round(errorRate * 1000) / 1000,
          recentErrors: stats.recentErrors,
          totalErrors: stats.totalErrors
        }
      };
    });

    // Circuit breaker status check
    this.healthMonitor.registerCheck('circuit_breakers', async () => {
      const openBreakers = this.getOpenCircuitBreakers();
      
      return {
        status: openBreakers.length > 0 ? 'degraded' : 'healthy',
        details: {
          totalBreakers: this.circuitBreakers.size,
          openBreakers: openBreakers.length,
          openBreakerNames: openBreakers
        }
      };
    });
  }

  /**
   * Create or get circuit breaker for a service
   */
  getCircuitBreaker(serviceName, options = {}) {
    if (!this.circuitBreakers.has(serviceName)) {
      const circuitBreakerOptions = {
        ...this.options.circuitBreakerDefaults,
        ...options,
        serviceName
      };

      const circuitBreaker = new CircuitBreaker(circuitBreakerOptions);
      
      // Setup circuit breaker event handlers
      circuitBreaker.on('open', () => {
        this.logger.warn('Circuit breaker opened', { serviceName });
        this.emit('circuitBreakerOpen', { serviceName });
      });

      circuitBreaker.on('halfOpen', () => {
        this.logger.info('Circuit breaker half-open', { serviceName });
        this.emit('circuitBreakerHalfOpen', { serviceName });
      });

      circuitBreaker.on('closed', () => {
        this.logger.info('Circuit breaker closed', { serviceName });
        this.emit('circuitBreakerClosed', { serviceName });
      });

      this.circuitBreakers.set(serviceName, circuitBreaker);
    }

    return this.circuitBreakers.get(serviceName);
  }

  /**
   * Create or get error handler for a service
   */
  getErrorHandler(serviceName) {
    if (!this.errorHandlers.has(serviceName)) {
      const errorHandler = new ErrorHandler(serviceName);
      this.errorHandlers.set(serviceName, errorHandler);
    }

    return this.errorHandlers.get(serviceName);
  }

  /**
   * Execute operation with resilience patterns
   */
  async executeWithResilience(operation, options = {}) {
    const {
      serviceName = 'unknown-service',
      useCircuitBreaker = true,
      useRetry = true,
      timeout = 30000,
      ...operationOptions
    } = options;

    const startTime = Date.now();
    let result;
    let error;

    try {
      if (useCircuitBreaker) {
        const circuitBreaker = this.getCircuitBreaker(serviceName, operationOptions);
        
        if (useRetry) {
          const errorHandler = this.getErrorHandler(serviceName);
          result = await errorHandler.executeWithRetry(
            () => circuitBreaker.execute(operation),
            operationOptions
          );
        } else {
          result = await circuitBreaker.execute(operation);
        }
      } else if (useRetry) {
        const errorHandler = this.getErrorHandler(serviceName);
        result = await errorHandler.executeWithRetry(operation, operationOptions);
      } else {
        // Execute with just timeout
        result = await Promise.race([
          operation(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Operation timeout')), timeout)
          )
        ]);
      }

      // Record successful execution
      this.recordMetric(serviceName, {
        type: 'success',
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      return result;

    } catch (err) {
      error = err;
      
      // Record failed execution
      this.recordMetric(serviceName, {
        type: 'failure',
        error: err.message,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      throw err;
    }
  }

  /**
   * Handle health check results
   */
  handleHealthCheckResult(status) {
    const previousHealth = this.systemHealth;
    this.systemHealth = status.status;

    if (previousHealth !== status.status) {
      this.logger.info('System health status changed', {
        from: previousHealth,
        to: status.status,
        totalChecks: status.totalChecks,
        healthyChecks: status.healthyChecks,
        unhealthyChecks: status.unhealthyChecks
      });

      this.emit('healthStatusChanged', {
        previous: previousHealth,
        current: status.status,
        details: status
      });
    }

    // Store health metrics
    this.recordMetric('system_health', {
      status: status.status,
      checks: status.totalChecks,
      healthy: status.healthyChecks,
      unhealthy: status.unhealthyChecks,
      timestamp: status.timestamp
    });
  }

  /**
   * Handle alerts from health monitoring
   */
  handleAlert(alert) {
    const alertKey = `${alert.type}_${alert.checkName || 'system'}`;
    
    if (!this.alerts.has(alertKey)) {
      this.alerts.add(alertKey);
      
      this.logger.error('Alert triggered', alert);
      this.emit('alert', alert);

      // Trigger automatic recovery if applicable
      this.triggerAutomaticRecovery(alert);
    }
  }

  /**
   * Handle alert resolution
   */
  handleAlertResolved(alert) {
    const alertKey = `${alert.type}_${alert.checkName || 'system'}`;
    
    if (this.alerts.has(alertKey)) {
      this.alerts.delete(alertKey);
      
      this.logger.info('Alert resolved', alert);
      this.emit('alertResolved', alert);
    }
  }

  /**
   * Trigger automatic recovery actions
   */
  async triggerAutomaticRecovery(alert) {
    this.logger.info('Triggering automatic recovery', { alert: alert.type });

    switch (alert.type) {
      case 'high_memory_usage':
        await this.performMemoryCleanup();
        break;
        
      case 'critical_health_check_failure':
        await this.performServiceRestart(alert.checkName);
        break;
        
      case 'high_error_rate':
        await this.performErrorRateRecovery();
        break;
        
      default:
        this.logger.warn('No automatic recovery action available', { alertType: alert.type });
    }
  }

  /**
   * Perform memory cleanup
   */
  async performMemoryCleanup() {
    this.logger.info('Performing memory cleanup');

    try {
      // Clear caches
      for (const errorHandler of this.errorHandlers.values()) {
        if (errorHandler.clearCache) {
          errorHandler.clearCache();
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Clear old metrics
      this.cleanupOldMetrics();

      this.logger.info('Memory cleanup completed');
      
    } catch (error) {
      this.logger.error('Memory cleanup failed', { error: error.message });
    }
  }

  /**
   * Perform service restart (reset circuit breakers)
   */
  async performServiceRestart(serviceName) {
    this.logger.info('Performing service restart', { serviceName });

    try {
      // Reset circuit breaker for the service
      if (this.circuitBreakers.has(serviceName)) {
        const circuitBreaker = this.circuitBreakers.get(serviceName);
        circuitBreaker.reset();
      }

      // Clear error handler cache
      if (this.errorHandlers.has(serviceName)) {
        const errorHandler = this.errorHandlers.get(serviceName);
        if (errorHandler.clearCache) {
          errorHandler.clearCache();
        }
      }

      this.logger.info('Service restart completed', { serviceName });
      
    } catch (error) {
      this.logger.error('Service restart failed', { 
        serviceName, 
        error: error.message 
      });
    }
  }

  /**
   * Perform error rate recovery
   */
  async performErrorRateRecovery() {
    this.logger.info('Performing error rate recovery');

    try {
      // Open circuit breakers for failing services
      const stats = this.getAggregatedErrorStats();
      
      for (const errorData of stats.topErrors.slice(0, 3)) {
        const serviceName = this.extractServiceFromError(errorData.error);
        if (serviceName && this.circuitBreakers.has(serviceName)) {
          const circuitBreaker = this.circuitBreakers.get(serviceName);
          if (circuitBreaker.state === 'closed') {
            this.logger.info('Opening circuit breaker for high error rate', { serviceName });
            // Force circuit breaker to half-open state for testing
            circuitBreaker.forceHalfOpen();
          }
        }
      }

      this.logger.info('Error rate recovery completed');
      
    } catch (error) {
      this.logger.error('Error rate recovery failed', { error: error.message });
    }
  }

  /**
   * Start system metrics collection
   */
  startSystemMetricsCollection() {
    setInterval(() => {
      this.collectSystemMetrics();
    }, 60000); // Collect every minute

    // Initial collection
    this.collectSystemMetrics();
  }

  /**
   * Collect system metrics
   */
  collectSystemMetrics() {
    const metrics = {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      cpu: process.cpuUsage(),
      timestamp: new Date().toISOString()
    };

    this.recordMetric('system_metrics', metrics);
  }

  /**
   * Record metric for service
   */
  recordMetric(serviceName, metric) {
    if (!this.systemMetrics.has(serviceName)) {
      this.systemMetrics.set(serviceName, []);
    }

    const metrics = this.systemMetrics.get(serviceName);
    metrics.push(metric);

    // Keep only last 1000 metrics per service
    if (metrics.length > 1000) {
      metrics.shift();
    }
  }

  /**
   * Get aggregated error statistics from all error handlers
   */
  getAggregatedErrorStats() {
    const aggregatedStats = {
      totalErrors: 0,
      recentErrors: 0,
      recentErrorRate: 0,
      topErrors: [],
      errorTypes: {}
    };

    for (const errorHandler of this.errorHandlers.values()) {
      const stats = errorHandler.getErrorStats();
      
      aggregatedStats.totalErrors += stats.totalErrors;
      aggregatedStats.recentErrors += stats.recentErrors;
      
      // Merge error types
      for (const [type, count] of Object.entries(stats.errorTypes)) {
        aggregatedStats.errorTypes[type] = (aggregatedStats.errorTypes[type] || 0) + count;
      }
      
      // Merge top errors
      aggregatedStats.topErrors.push(...stats.topErrors);
    }

    // Calculate overall error rate
    const totalOperations = aggregatedStats.totalErrors + this.getTotalSuccessfulOperations();
    aggregatedStats.recentErrorRate = totalOperations > 0 ? 
      aggregatedStats.recentErrors / totalOperations : 0;

    // Sort and limit top errors
    aggregatedStats.topErrors = aggregatedStats.topErrors
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return aggregatedStats;
  }

  /**
   * Get total successful operations count
   */
  getTotalSuccessfulOperations() {
    let total = 0;
    
    for (const metrics of this.systemMetrics.values()) {
      total += metrics.filter(m => m.type === 'success').length;
    }
    
    return total;
  }

  /**
   * Get open circuit breakers
   */
  getOpenCircuitBreakers() {
    const openBreakers = [];
    
    for (const [serviceName, circuitBreaker] of this.circuitBreakers.entries()) {
      if (circuitBreaker.state === 'open') {
        openBreakers.push(serviceName);
      }
    }
    
    return openBreakers;
  }

  /**
   * Extract service name from error message
   */
  extractServiceFromError(error) {
    // Simple extraction - in practice this might be more sophisticated
    const patterns = [
      /service[:\s]+([a-zA-Z-_]+)/i,
      /([a-zA-Z-_]+)[:\s]+service/i
    ];

    for (const pattern of patterns) {
      const match = error.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Cleanup old metrics to prevent memory leaks
   */
  cleanupOldMetrics() {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    for (const [serviceName, metrics] of this.systemMetrics.entries()) {
      const recentMetrics = metrics.filter(metric => {
        const timestamp = new Date(metric.timestamp).getTime();
        return timestamp > oneDayAgo;
      });
      
      this.systemMetrics.set(serviceName, recentMetrics);
    }
  }

  /**
   * Get comprehensive system status
   */
  getSystemStatus() {
    return {
      health: this.systemHealth,
      alerts: Array.from(this.alerts),
      circuitBreakers: this.getCircuitBreakerStatus(),
      errorStats: this.getAggregatedErrorStats(),
      systemMetrics: this.getRecentSystemMetrics(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus() {
    const status = {};
    
    for (const [serviceName, circuitBreaker] of this.circuitBreakers.entries()) {
      status[serviceName] = {
        state: circuitBreaker.state,
        failureCount: circuitBreaker.failureCount,
        lastFailureTime: circuitBreaker.lastFailureTime,
        nextAttempt: circuitBreaker.nextAttempt
      };
    }
    
    return status;
  }

  /**
   * Get recent system metrics
   */
  getRecentSystemMetrics() {
    const recentMetrics = {};
    const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
    
    for (const [serviceName, metrics] of this.systemMetrics.entries()) {
      recentMetrics[serviceName] = metrics.filter(metric => {
        const timestamp = new Date(metric.timestamp).getTime();
        return timestamp > fifteenMinutesAgo;
      }).slice(-50); // Last 50 metrics
    }
    
    return recentMetrics;
  }

  /**
   * Shutdown resilience manager
   */
  async shutdown() {
    this.logger.info('Shutting down Resilience Manager');
    
    this.healthMonitor.stop();
    this.cleanupOldMetrics();
    
    this.logger.info('Resilience Manager shutdown complete');
  }
}

module.exports = ResilienceManager;
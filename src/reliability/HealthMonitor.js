/**
 * Health Monitor for Cloud Remediator Sage
 * Provides comprehensive health checking and system monitoring
 */

const { EventEmitter } = require('events');
const { StructuredLogger } = require('../monitoring/logger');

class HealthMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.logger = new StructuredLogger('health-monitor');
    this.checkInterval = options.checkInterval || 30000; // 30 seconds
    this.healthChecks = new Map();
    this.lastHealthStatus = new Map();
    this.alerts = new Map();
    this.isRunning = false;
    this.intervalId = null;
    
    // Health thresholds
    this.thresholds = {
      memory: 0.85,    // 85% memory usage
      cpu: 0.80,       // 80% CPU usage
      disk: 0.90,      // 90% disk usage
      responseTime: 5000, // 5 seconds
      errorRate: 0.05  // 5% error rate
    };
  }

  /**
   * Start health monitoring
   */
  start() {
    if (this.isRunning) {
      this.logger.warn('Health monitor already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Starting health monitor', {
      checkInterval: this.checkInterval,
      registeredChecks: this.healthChecks.size
    });

    this.intervalId = setInterval(() => {
      this.runHealthChecks();
    }, this.checkInterval);

    // Run initial check
    this.runHealthChecks();
  }

  /**
   * Stop health monitoring
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.logger.info('Health monitor stopped');
  }

  /**
   * Register a health check
   */
  registerCheck(name, checkFn, options = {}) {
    const check = {
      name,
      checkFn,
      timeout: options.timeout || 10000,
      critical: options.critical !== false,
      enabled: options.enabled !== false,
      tags: options.tags || [],
      lastRun: null,
      lastResult: null,
      consecutiveFailures: 0,
      totalRuns: 0,
      totalFailures: 0
    };

    this.healthChecks.set(name, check);
    this.logger.info('Health check registered', { 
      name, 
      critical: check.critical,
      timeout: check.timeout 
    });
  }

  /**
   * Unregister a health check
   */
  unregisterCheck(name) {
    if (this.healthChecks.delete(name)) {
      this.logger.info('Health check unregistered', { name });
    }
  }

  /**
   * Run all health checks
   */
  async runHealthChecks() {
    const startTime = Date.now();
    const results = new Map();
    const promises = [];

    for (const [name, check] of this.healthChecks.entries()) {
      if (!check.enabled) {
        continue;
      }

      const promise = this.runSingleCheck(check)
        .then(result => results.set(name, result))
        .catch(error => {
          results.set(name, {
            name,
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
          });
        });

      promises.push(promise);
    }

    await Promise.allSettled(promises);

    const healthStatus = this.aggregateHealthResults(results);
    healthStatus.checkDuration = Date.now() - startTime;

    // Emit health status
    this.emit('healthCheck', healthStatus);

    // Check for alerts
    this.checkAlerts(results);

    return healthStatus;
  }

  /**
   * Run a single health check with timeout
   */
  async runSingleCheck(check) {
    const startTime = Date.now();
    check.totalRuns++;

    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), check.timeout);
      });

      const result = await Promise.race([
        check.checkFn(),
        timeoutPromise
      ]);

      const duration = Date.now() - startTime;
      check.lastRun = new Date().toISOString();
      check.consecutiveFailures = 0;

      const healthResult = {
        name: check.name,
        status: result?.status || 'healthy',
        duration,
        timestamp: check.lastRun,
        details: result?.details || {},
        metadata: result?.metadata || {}
      };

      check.lastResult = healthResult;
      return healthResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      check.lastRun = new Date().toISOString();
      check.consecutiveFailures++;
      check.totalFailures++;

      const healthResult = {
        name: check.name,
        status: 'unhealthy',
        error: error.message,
        duration,
        timestamp: check.lastRun,
        consecutiveFailures: check.consecutiveFailures
      };

      check.lastResult = healthResult;
      this.logger.error('Health check failed', {
        checkName: check.name,
        error: error.message,
        consecutiveFailures: check.consecutiveFailures,
        duration
      });

      return healthResult;
    }
  }

  /**
   * Aggregate individual health results into overall status
   */
  aggregateHealthResults(results) {
    let overallStatus = 'healthy';
    const criticalFailures = [];
    const warnings = [];
    
    for (const [name, result] of results.entries()) {
      const check = this.healthChecks.get(name);
      
      if (result.status === 'unhealthy') {
        if (check.critical) {
          criticalFailures.push(result);
          overallStatus = 'unhealthy';
        } else {
          warnings.push(result);
          if (overallStatus === 'healthy') {
            overallStatus = 'degraded';
          }
        }
      }
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      totalChecks: results.size,
      healthyChecks: Array.from(results.values()).filter(r => r.status === 'healthy').length,
      unhealthyChecks: criticalFailures.length + warnings.length,
      criticalFailures,
      warnings,
      checks: Object.fromEntries(results),
      systemMetrics: this.getSystemMetrics()
    };
  }

  /**
   * Get system metrics
   */
  getSystemMetrics() {
    const usage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      memory: {
        used: usage.heapUsed,
        total: usage.heapTotal,
        external: usage.external,
        utilization: usage.heapUsed / usage.heapTotal
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    };
  }

  /**
   * Check for alert conditions
   */
  checkAlerts(results) {
    for (const [name, result] of results.entries()) {
      const check = this.healthChecks.get(name);
      const alertKey = `${name}_failure`;

      if (result.status === 'unhealthy' && check.critical) {
        if (check.consecutiveFailures >= 3 && !this.alerts.has(alertKey)) {
          // Fire alert for consecutive failures
          const alert = {
            type: 'critical_health_check_failure',
            checkName: name,
            consecutiveFailures: check.consecutiveFailures,
            lastError: result.error,
            timestamp: new Date().toISOString()
          };

          this.alerts.set(alertKey, alert);
          this.emit('alert', alert);

          this.logger.error('Critical health check alert fired', alert);
        }
      } else if (result.status === 'healthy' && this.alerts.has(alertKey)) {
        // Clear alert when check recovers
        const alert = this.alerts.get(alertKey);
        this.alerts.delete(alertKey);
        
        this.emit('alertResolved', {
          ...alert,
          resolvedAt: new Date().toISOString()
        });

        this.logger.info('Health check alert resolved', { checkName: name });
      }
    }

    // System resource alerts
    const metrics = this.getSystemMetrics();
    
    if (metrics.memory.utilization > this.thresholds.memory) {
      this.fireResourceAlert('high_memory_usage', {
        utilization: metrics.memory.utilization,
        threshold: this.thresholds.memory
      });
    }
  }

  /**
   * Fire resource alert
   */
  fireResourceAlert(type, data) {
    const alertKey = `resource_${type}`;
    
    if (!this.alerts.has(alertKey)) {
      const alert = {
        type,
        ...data,
        timestamp: new Date().toISOString()
      };

      this.alerts.set(alertKey, alert);
      this.emit('alert', alert);
      
      this.logger.warn('Resource alert fired', alert);
    }
  }

  /**
   * Get current health status
   */
  async getCurrentHealth() {
    if (!this.isRunning) {
      await this.runHealthChecks();
    }

    const results = new Map();
    for (const [name, check] of this.healthChecks.entries()) {
      if (check.lastResult) {
        results.set(name, check.lastResult);
      }
    }

    return this.aggregateHealthResults(results);
  }

  /**
   * Get health check statistics
   */
  getStatistics() {
    const stats = {
      totalChecks: this.healthChecks.size,
      enabledChecks: 0,
      criticalChecks: 0,
      checkStats: {}
    };

    for (const [name, check] of this.healthChecks.entries()) {
      if (check.enabled) {
        stats.enabledChecks++;
      }
      if (check.critical) {
        stats.criticalChecks++;
      }

      stats.checkStats[name] = {
        totalRuns: check.totalRuns,
        totalFailures: check.totalFailures,
        successRate: check.totalRuns > 0 ? 
          ((check.totalRuns - check.totalFailures) / check.totalRuns) : 0,
        consecutiveFailures: check.consecutiveFailures,
        lastRun: check.lastRun,
        enabled: check.enabled,
        critical: check.critical
      };
    }

    return stats;
  }
}

module.exports = HealthMonitor;
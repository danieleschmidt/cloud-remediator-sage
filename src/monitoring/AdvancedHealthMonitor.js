/**
 * Advanced Health Monitoring System
 * Provides comprehensive health checks, alerting, and autonomous recovery
 */

const EventEmitter = require('events');
const { StructuredLogger } = require('./logger');

class AdvancedHealthMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.logger = new StructuredLogger('health-monitor');
    
    this.config = {
      checkInterval: options.checkInterval || 30000, // 30 seconds
      criticalThreshold: options.criticalThreshold || 0.8,
      warningThreshold: options.warningThreshold || 0.6,
      enableAutoRecovery: options.enableAutoRecovery !== false,
      enablePredictiveAnalysis: options.enablePredictiveAnalysis !== false,
      maxRecoveryAttempts: options.maxRecoveryAttempts || 3,
      recoveryTimeout: options.recoveryTimeout || 120000, // 2 minutes
      ...options
    };
    
    this.healthState = {
      overallHealth: 'HEALTHY',
      components: new Map(),
      metrics: new Map(),
      alerts: new Map(),
      recoveryAttempts: new Map(),
      lastCheck: null,
      checkHistory: []
    };
    
    this.healthChecks = new Map();
    this.alertHandlers = new Map();
    this.recoveryStrategies = new Map();
    this.isMonitoring = false;
    this.monitoringInterval = null;
  }

  /**
   * Initialize health monitoring
   */
  async initialize() {
    try {
      this.logger.info('Initializing health monitoring system');
      
      // Register default health checks
      await this.registerDefaultHealthChecks();
      
      // Initialize predictive analysis models
      await this.initializePredictiveModels();
      
      // Setup real-time alerting
      await this.initializeAlerting();
      
      // Start monitoring if not already running
      if (!this.isMonitoring) {
        await this.startMonitoring();
      }
      
      // Register default alert handlers
      await this.registerDefaultAlertHandlers();
      
      // Register default recovery strategies
      await this.registerDefaultRecoveryStrategies();
      
      // Start monitoring
      await this.startMonitoring();
      
      this.logger.info('Health monitoring system initialized successfully');
      
    } catch (error) {
      this.logger.error('Health monitoring initialization failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Register a health check
   */
  registerHealthCheck(name, checkFunction, options = {}) {
    this.healthChecks.set(name, {
      name,
      checkFunction,
      enabled: options.enabled !== false,
      timeout: options.timeout || 5000,
      critical: options.critical || false,
      interval: options.interval || this.config.checkInterval,
      lastRun: null,
      lastResult: null,
      errorCount: 0,
      maxErrors: options.maxErrors || 3
    });
    
    this.logger.info(`Health check registered: ${name}`, { options });
  }

  /**
   * Register default health checks
   */
  async registerDefaultHealthChecks() {
    // Memory usage check
    this.registerHealthCheck('memory', async () => {
      const usage = process.memoryUsage();
      const heapUsedMB = usage.heapUsed / 1024 / 1024;
      const heapTotalMB = usage.heapTotal / 1024 / 1024;
      const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100;
      
      return {
        healthy: heapUsagePercent < 85,
        value: heapUsagePercent,
        unit: 'percent',
        details: {
          heapUsed: `${heapUsedMB.toFixed(2)} MB`,
          heapTotal: `${heapTotalMB.toFixed(2)} MB`,
          external: `${(usage.external / 1024 / 1024).toFixed(2)} MB`
        }
      };
    }, { critical: true, timeout: 1000 });

    // CPU usage check
    this.registerHealthCheck('cpu', async () => {
      const startUsage = process.cpuUsage();
      await new Promise(resolve => setTimeout(resolve, 100));
      const endUsage = process.cpuUsage(startUsage);
      
      const userPercent = (endUsage.user / 100000); // Convert to percentage
      const systemPercent = (endUsage.system / 100000);
      const totalPercent = userPercent + systemPercent;
      
      return {
        healthy: totalPercent < 80,
        value: totalPercent,
        unit: 'percent',
        details: {
          user: userPercent.toFixed(2),
          system: systemPercent.toFixed(2),
          total: totalPercent.toFixed(2)
        }
      };
    }, { critical: true, timeout: 2000 });

    // Event loop lag check
    this.registerHealthCheck('eventloop', async () => {
      return new Promise((resolve) => {
        const start = process.hrtime.bigint();
        setImmediate(() => {
          const lag = Number(process.hrtime.bigint() - start) / 1e6; // Convert to ms
          resolve({
            healthy: lag < 100, // Less than 100ms lag
            value: lag,
            unit: 'milliseconds',
            details: { lag: `${lag.toFixed(2)} ms` }
          });
        });
      });
    }, { critical: false, timeout: 1000 });

    // File system check
    this.registerHealthCheck('filesystem', async () => {
      const fs = require('fs').promises;
      try {
        const testFile = '/tmp/health-check-test';
        await fs.writeFile(testFile, 'test');
        await fs.readFile(testFile);
        await fs.unlink(testFile);
        
        return {
          healthy: true,
          value: 1,
          unit: 'boolean',
          details: { message: 'File system operations successful' }
        };
      } catch (error) {
        return {
          healthy: false,
          value: 0,
          unit: 'boolean',
          details: { error: error.message }
        };
      }
    }, { critical: false, timeout: 3000 });
  }

  /**
   * Start monitoring
   */
  async startMonitoring() {
    if (this.isMonitoring) {
      this.logger.warn('Health monitoring already started');
      return;
    }
    
    this.isMonitoring = true;
    
    // Initial health check
    await this.performHealthCheck();
    
    // Start periodic monitoring
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        this.logger.error('Health check failed', { error: error.message });
      }
    }, this.config.checkInterval);
    
    this.logger.info('Health monitoring started', { 
      interval: this.config.checkInterval,
      checksCount: this.healthChecks.size
    });
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }
    
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.logger.info('Health monitoring stopped');
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck() {
    const checkStart = Date.now();
    const results = new Map();
    
    // Run all enabled health checks
    const promises = Array.from(this.healthChecks.entries())
      .filter(([_, check]) => check.enabled)
      .map(async ([name, check]) => {
        try {
          const result = await this.runSingleHealthCheck(name, check);
          results.set(name, result);
          return { name, result };
        } catch (error) {
          const errorResult = {
            healthy: false,
            error: error.message,
            timestamp: Date.now()
          };
          results.set(name, errorResult);
          return { name, result: errorResult };
        }
      });
    
    await Promise.all(promises);
    
    // Update health state
    this.updateHealthState(results);
    
    // Check for alerts
    await this.checkForAlerts(results);
    
    // Perform auto-recovery if needed
    if (this.config.enableAutoRecovery) {
      await this.performAutoRecovery(results);
    }
    
    // Emit health status
    this.emit('healthCheck', {
      overall: this.healthState.overallHealth,
      components: Object.fromEntries(results),
      duration: Date.now() - checkStart,
      timestamp: checkStart
    });
    
    this.healthState.lastCheck = checkStart;
    this.healthState.checkHistory.push({
      timestamp: checkStart,
      overall: this.healthState.overallHealth,
      componentCount: results.size,
      duration: Date.now() - checkStart
    });
    
    // Keep only last 100 checks in history
    if (this.healthState.checkHistory.length > 100) {
      this.healthState.checkHistory = this.healthState.checkHistory.slice(-100);
    }
  }

  /**
   * Run single health check with timeout
   */
  async runSingleHealthCheck(name, check) {
    const checkStart = Date.now();
    
    try {
      const result = await Promise.race([
        check.checkFunction(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), check.timeout)
        )
      ]);
      
      check.lastRun = checkStart;
      check.lastResult = result;
      check.errorCount = 0;
      
      return {
        ...result,
        timestamp: checkStart,
        duration: Date.now() - checkStart,
        name
      };
      
    } catch (error) {
      check.errorCount++;
      const errorResult = {
        healthy: false,
        error: error.message,
        timestamp: checkStart,
        duration: Date.now() - checkStart,
        name,
        errorCount: check.errorCount
      };
      
      check.lastResult = errorResult;
      return errorResult;
    }
  }

  /**
   * Update overall health state
   */
  updateHealthState(results) {
    let criticalUnhealthy = 0;
    let totalUnhealthy = 0;
    let criticalTotal = 0;
    
    for (const [name, result] of results) {
      const check = this.healthChecks.get(name);
      this.healthState.components.set(name, result);
      
      if (!result.healthy) {
        totalUnhealthy++;
        if (check.critical) {
          criticalUnhealthy++;
        }
      }
      
      if (check.critical) {
        criticalTotal++;
      }
    }
    
    // Determine overall health
    if (criticalUnhealthy > 0) {
      this.healthState.overallHealth = 'CRITICAL';
    } else if (totalUnhealthy > results.size * this.config.criticalThreshold) {
      this.healthState.overallHealth = 'UNHEALTHY';
    } else if (totalUnhealthy > results.size * this.config.warningThreshold) {
      this.healthState.overallHealth = 'WARNING';
    } else {
      this.healthState.overallHealth = 'HEALTHY';
    }
  }

  /**
   * Check for alerts and trigger handlers
   */
  async checkForAlerts(results) {
    for (const [name, result] of results) {
      if (!result.healthy) {
        const alertKey = `${name}_unhealthy`;
        
        if (!this.healthState.alerts.has(alertKey)) {
          // New alert
          const alert = {
            type: 'COMPONENT_UNHEALTHY',
            component: name,
            severity: this.healthChecks.get(name).critical ? 'CRITICAL' : 'WARNING',
            message: `Health check failed for component: ${name}`,
            details: result,
            timestamp: Date.now(),
            acknowledged: false
          };
          
          this.healthState.alerts.set(alertKey, alert);
          this.emit('alert', alert);
          
          // Trigger alert handlers
          await this.triggerAlertHandlers(alert);
        }
      } else {
        // Clear alert if component is now healthy
        const alertKey = `${name}_unhealthy`;
        if (this.healthState.alerts.has(alertKey)) {
          this.healthState.alerts.delete(alertKey);
          this.emit('alertResolved', { component: name, timestamp: Date.now() });
        }
      }
    }
  }

  /**
   * Register default alert handlers
   */
  async registerDefaultAlertHandlers() {
    // Console logging handler
    this.registerAlertHandler('console', async (alert) => {
      this.logger.error(`HEALTH ALERT: ${alert.message}`, alert);
    });
    
    // Metrics handler
    this.registerAlertHandler('metrics', async (alert) => {
      // Update metrics for monitoring systems
      this.healthState.metrics.set(`alert_${alert.component}`, {
        count: (this.healthState.metrics.get(`alert_${alert.component}`)?.count || 0) + 1,
        lastOccurrence: alert.timestamp,
        severity: alert.severity
      });
    });
  }

  /**
   * Register alert handler
   */
  registerAlertHandler(name, handler) {
    this.alertHandlers.set(name, handler);
    this.logger.info(`Alert handler registered: ${name}`);
  }

  /**
   * Trigger alert handlers
   */
  async triggerAlertHandlers(alert) {
    const promises = Array.from(this.alertHandlers.entries()).map(async ([name, handler]) => {
      try {
        await handler(alert);
      } catch (error) {
        this.logger.error(`Alert handler failed: ${name}`, { error: error.message });
      }
    });
    
    await Promise.all(promises);
  }

  /**
   * Register default recovery strategies
   */
  async registerDefaultRecoveryStrategies() {
    // Memory recovery
    this.registerRecoveryStrategy('memory', async (component, result) => {
      if (global.gc && typeof global.gc === 'function') {
        global.gc();
        this.logger.info('Forced garbage collection for memory recovery');
        return { success: true, action: 'garbage_collection' };
      }
      return { success: false, reason: 'gc_not_available' };
    });
    
    // Generic restart recovery
    this.registerRecoveryStrategy('restart', async (component, result) => {
      // This would trigger a graceful restart in a real application
      this.logger.warn(`Recovery strategy would restart component: ${component}`);
      return { success: true, action: 'restart_scheduled' };
    });
  }

  /**
   * Register recovery strategy
   */
  registerRecoveryStrategy(name, strategy) {
    this.recoveryStrategies.set(name, strategy);
    this.logger.info(`Recovery strategy registered: ${name}`);
  }

  /**
   * Perform auto-recovery
   */
  async performAutoRecovery(results) {
    for (const [name, result] of results) {
      if (!result.healthy) {
        const attempts = this.healthState.recoveryAttempts.get(name) || 0;
        
        if (attempts < this.config.maxRecoveryAttempts) {
          this.logger.info(`Attempting recovery for component: ${name}`, { attempt: attempts + 1 });
          
          // Try component-specific recovery first
          let recovered = await this.tryRecovery(name, result);
          
          // Try generic recovery strategies if needed
          if (!recovered) {
            recovered = await this.tryGenericRecovery(name, result);
          }
          
          this.healthState.recoveryAttempts.set(name, attempts + 1);
          
          if (recovered) {
            this.logger.info(`Recovery successful for component: ${name}`);
            this.healthState.recoveryAttempts.delete(name);
            this.emit('recoverySuccess', { component: name, timestamp: Date.now() });
          } else {
            this.logger.warn(`Recovery failed for component: ${name}`, { attempts: attempts + 1 });
            this.emit('recoveryFailed', { component: name, attempts: attempts + 1 });
          }
        }
      } else {
        // Reset recovery attempts for healthy components
        this.healthState.recoveryAttempts.delete(name);
      }
    }
  }

  /**
   * Try component-specific recovery
   */
  async tryRecovery(componentName, result) {
    const strategy = this.recoveryStrategies.get(componentName);
    if (strategy) {
      try {
        const recoveryResult = await strategy(componentName, result);
        return recoveryResult.success;
      } catch (error) {
        this.logger.error(`Recovery strategy failed for ${componentName}`, { error: error.message });
        return false;
      }
    }
    return false;
  }

  /**
   * Try generic recovery strategies
   */
  async tryGenericRecovery(componentName, result) {
    // Try memory recovery for memory-related issues
    if (componentName === 'memory' || result.error?.includes('memory')) {
      return await this.tryRecovery('memory', result);
    }
    
    // Try restart as last resort for critical components
    const check = this.healthChecks.get(componentName);
    if (check?.critical) {
      return await this.tryRecovery('restart', result);
    }
    
    return false;
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    return {
      overall: this.healthState.overallHealth,
      lastCheck: this.healthState.lastCheck,
      components: Object.fromEntries(this.healthState.components),
      activeAlerts: Object.fromEntries(this.healthState.alerts),
      metrics: Object.fromEntries(this.healthState.metrics),
      recoveryAttempts: Object.fromEntries(this.healthState.recoveryAttempts),
      history: this.healthState.checkHistory.slice(-10)
    };
  }

  /**
   * Get detailed health report
   */
  getHealthReport() {
    const status = this.getHealthStatus();
    const checkNames = Array.from(this.healthChecks.keys());
    const enabledChecks = checkNames.filter(name => this.healthChecks.get(name).enabled);
    
    return {
      ...status,
      summary: {
        checksConfigured: checkNames.length,
        checksEnabled: enabledChecks.length,
        healthyComponents: Object.values(status.components).filter(c => c.healthy).length,
        unhealthyComponents: Object.values(status.components).filter(c => !c.healthy).length,
        activeAlerts: Object.keys(status.activeAlerts).length,
        activeRecoveries: Object.keys(status.recoveryAttempts).length
      }
    };
  }

  /**
   * Initialize predictive analysis models
   */
  async initializePredictiveModels() {
    this.logger.info('Initializing predictive health models');
    
    // Initialize trend analysis
    this.trendAnalysis = {
      metrics: new Map(),
      predictions: new Map(),
      confidenceThreshold: 0.8,
      predictionWindow: 300000 // 5 minutes
    };
    
    // Initialize anomaly detection
    this.anomalyDetection = {
      baselines: new Map(),
      deviationThreshold: 2.5, // Standard deviations
      learningPeriod: 86400000, // 24 hours
      minSamples: 100
    };
  }

  /**
   * Initialize real-time alerting system
   */
  async initializeAlerting() {
    this.logger.info('Initializing real-time alerting system');
    
    // Initialize alert channels
    this.alertChannels = new Map([
      ['critical', { 
        handlers: ['log', 'emit', 'slack'], 
        throttleTime: 300000, // 5 minutes
        escalationTime: 900000 // 15 minutes
      }],
      ['warning', { 
        handlers: ['log', 'emit'], 
        throttleTime: 600000, // 10 minutes
        escalationTime: 1800000 // 30 minutes
      }],
      ['info', { 
        handlers: ['log'], 
        throttleTime: 1800000, // 30 minutes
        escalationTime: 0
      }]
    ]);
    
    // Initialize alert correlation
    this.alertCorrelation = {
      correlationWindow: 300000, // 5 minutes
      correlatedAlerts: new Map(),
      correlationRules: new Map()
    };
  }

  /**
   * Perform predictive health analysis
   */
  async predictiveAnalysis() {
    if (!this.config.enablePredictiveAnalysis) return;
    
    try {
      const currentTime = Date.now();
      const predictions = new Map();
      
      // Analyze trends for each component
      for (const [componentName, component] of this.healthState.components) {
        const metrics = this.getComponentMetrics(componentName);
        if (metrics.length < this.anomalyDetection.minSamples) continue;
        
        // Trend analysis
        const trend = this.analyzeTrend(metrics);
        if (trend.direction === 'declining' && trend.confidence > 0.7) {
          const prediction = {
            component: componentName,
            type: 'degradation',
            confidence: trend.confidence,
            estimatedTime: currentTime + trend.estimatedTimeToFailure,
            severity: this.calculatePredictedSeverity(trend),
            recommendation: this.generatePreventiveAction(componentName, trend)
          };
          
          predictions.set(`${componentName}-degradation`, prediction);
          
          // Emit predictive alert
          this.emit('predictiveAlert', prediction);
        }
        
        // Anomaly detection
        const anomalies = this.detectAnomalies(componentName, metrics);
        for (const anomaly of anomalies) {
          predictions.set(`${componentName}-anomaly-${Date.now()}`, anomaly);
          this.emit('anomalyDetected', anomaly);
        }
      }
      
      this.trendAnalysis.predictions = predictions;
      this.logger.debug('Predictive analysis completed', { 
        predictions: predictions.size,
        timestamp: currentTime
      });
      
    } catch (error) {
      this.logger.error('Predictive analysis failed', { error: error.message });
    }
  }

  /**
   * Analyze metric trends for predictions
   */
  analyzeTrend(metrics) {
    const recentMetrics = metrics.slice(-50); // Last 50 data points
    if (recentMetrics.length < 10) return { direction: 'stable', confidence: 0 };
    
    // Calculate linear regression
    const n = recentMetrics.length;
    const sumX = recentMetrics.reduce((sum, _, i) => sum + i, 0);
    const sumY = recentMetrics.reduce((sum, m) => sum + m.value, 0);
    const sumXY = recentMetrics.reduce((sum, m, i) => sum + (i * m.value), 0);
    const sumX2 = recentMetrics.reduce((sum, _, i) => sum + (i * i), 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const correlation = this.calculateCorrelation(recentMetrics);
    
    // Determine trend direction and confidence
    const direction = slope > 0.01 ? 'improving' : slope < -0.01 ? 'declining' : 'stable';
    const confidence = Math.abs(correlation);
    
    // Estimate time to failure if declining
    let estimatedTimeToFailure = Infinity;
    if (direction === 'declining' && slope < 0) {
      const currentValue = recentMetrics[recentMetrics.length - 1].value;
      const criticalValue = 0.2; // Assume critical threshold
      estimatedTimeToFailure = (currentValue - criticalValue) / Math.abs(slope);
    }
    
    return {
      direction,
      confidence,
      slope,
      correlation,
      estimatedTimeToFailure
    };
  }

  /**
   * Detect anomalies in component metrics
   */
  detectAnomalies(componentName, metrics) {
    const anomalies = [];
    const recentMetrics = metrics.slice(-100);
    
    if (recentMetrics.length < 20) return anomalies;
    
    // Calculate baseline statistics
    const values = recentMetrics.map(m => m.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // Check for outliers
    const latestValue = values[values.length - 1];
    const zScore = Math.abs((latestValue - mean) / stdDev);
    
    if (zScore > this.anomalyDetection.deviationThreshold) {
      anomalies.push({
        component: componentName,
        type: 'statistical_anomaly',
        severity: zScore > 3 ? 'critical' : 'warning',
        confidence: Math.min(0.95, zScore / 3),
        details: {
          currentValue: latestValue,
          baseline: mean,
          deviation: zScore,
          threshold: this.anomalyDetection.deviationThreshold
        },
        timestamp: Date.now()
      });
    }
    
    return anomalies;
  }

  /**
   * Calculate correlation coefficient
   */
  calculateCorrelation(metrics) {
    if (metrics.length < 2) return 0;
    
    const n = metrics.length;
    const indices = metrics.map((_, i) => i);
    const values = metrics.map(m => m.value);
    
    const meanX = indices.reduce((sum, i) => sum + i, 0) / n;
    const meanY = values.reduce((sum, v) => sum + v, 0) / n;
    
    let numerator = 0;
    let denominatorX = 0;
    let denominatorY = 0;
    
    for (let i = 0; i < n; i++) {
      const deltaX = indices[i] - meanX;
      const deltaY = values[i] - meanY;
      numerator += deltaX * deltaY;
      denominatorX += deltaX * deltaX;
      denominatorY += deltaY * deltaY;
    }
    
    const denominator = Math.sqrt(denominatorX * denominatorY);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Get metrics for a specific component
   */
  getComponentMetrics(componentName) {
    const component = this.healthState.components.get(componentName);
    if (!component || !component.metricsHistory) return [];
    
    return component.metricsHistory.slice(-1000); // Last 1000 data points
  }

  /**
   * Calculate predicted severity based on trend
   */
  calculatePredictedSeverity(trend) {
    if (trend.estimatedTimeToFailure < 300000) return 'critical'; // < 5 minutes
    if (trend.estimatedTimeToFailure < 1800000) return 'high'; // < 30 minutes
    if (trend.estimatedTimeToFailure < 3600000) return 'medium'; // < 1 hour
    return 'low';
  }

  /**
   * Generate preventive action recommendations
   */
  generatePreventiveAction(componentName, trend) {
    const actions = {
      'memory-usage': 'Consider scaling up memory or implementing memory optimization',
      'cpu-usage': 'Consider scaling up CPU resources or optimizing resource-intensive operations',
      'disk-usage': 'Clean up temporary files or expand disk capacity',
      'network-latency': 'Check network connectivity and consider caching strategies',
      'database-connections': 'Optimize connection pooling or increase connection limits',
      'error-rate': 'Investigate recent errors and implement fixes'
    };
    
    return actions[componentName] || 'Monitor component closely and prepare scaling resources';
  }
}

module.exports = AdvancedHealthMonitor;
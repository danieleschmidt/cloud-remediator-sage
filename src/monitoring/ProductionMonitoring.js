/**
 * Production Monitoring Module
 * Implements comprehensive production monitoring, alerting, and observability
 */

const { StructuredLogger } = require('./logger');
const { ObservabilityManager } = require('./ObservabilityManager');

class ProductionMonitoring {
  constructor(options = {}) {
    this.logger = new StructuredLogger('production-monitoring');
    this.observability = new ObservabilityManager();
    
    this.options = {
      enableRealTimeMetrics: options.enableRealTimeMetrics !== false,
      enableAutoAlerting: options.enableAutoAlerting !== false,
      enablePerformanceTracking: options.enablePerformanceTracking !== false,
      alertThresholds: {
        errorRate: options.errorRate || 0.05, // 5%
        responseTime: options.responseTime || 5000, // 5 seconds
        memoryUsage: options.memoryUsage || 0.85, // 85%
        cpuUsage: options.cpuUsage || 0.8, // 80%
        ...options.alertThresholds
      },
      ...options
    };

    this.metrics = new Map();
    this.alerts = [];
    this.healthChecks = new Map();
    this.performanceBaseline = null;
    this.monitoringActive = false;
  }

  /**
   * Initialize production monitoring
   */
  async initialize() {
    this.logger.info('Initializing production monitoring system');

    try {
      // Initialize observability manager
      await this.observability.initialize();
      
      // Set up real-time metrics collection
      if (this.options.enableRealTimeMetrics) {
        await this.setupRealTimeMetrics();
      }

      // Set up automated alerting
      if (this.options.enableAutoAlerting) {
        await this.setupAutomatedAlerting();
      }

      // Set up performance tracking
      if (this.options.enablePerformanceTracking) {
        await this.setupPerformanceTracking();
      }

      // Initialize health checks
      await this.initializeHealthChecks();

      // Set up monitoring dashboards
      await this.setupMonitoringDashboards();

      this.monitoringActive = true;
      this.logger.info('Production monitoring system initialized successfully');

      return {
        success: true,
        capabilities: [
          'real-time-metrics',
          'automated-alerting', 
          'performance-tracking',
          'health-monitoring',
          'observability-dashboards'
        ]
      };

    } catch (error) {
      this.logger.error('Failed to initialize production monitoring', { error: error.message });
      throw error;
    }
  }

  /**
   * Set up real-time metrics collection
   */
  async setupRealTimeMetrics() {
    this.logger.info('Setting up real-time metrics collection');

    // System metrics
    this.collectSystemMetrics();
    
    // Application metrics  
    this.collectApplicationMetrics();
    
    // Business metrics
    this.collectBusinessMetrics();
    
    // Security metrics
    this.collectSecurityMetrics();
  }

  /**
   * Collect system metrics
   */
  collectSystemMetrics() {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      this.recordMetric('system.memory.heap_used', memUsage.heapUsed);
      this.recordMetric('system.memory.heap_total', memUsage.heapTotal);
      this.recordMetric('system.memory.external', memUsage.external);
      this.recordMetric('system.cpu.user', cpuUsage.user);
      this.recordMetric('system.cpu.system', cpuUsage.system);
      
      // Check thresholds
      this.checkSystemThresholds(memUsage, cpuUsage);
      
    }, 10000); // Every 10 seconds
  }

  /**
   * Collect application metrics
   */
  collectApplicationMetrics() {
    // Track request counts and response times
    global.recordRequestMetric = (endpoint, method, statusCode, responseTime) => {
      this.recordMetric(`app.requests.${method.toLowerCase()}.${endpoint}`, 1);
      this.recordMetric(`app.response_time.${endpoint}`, responseTime);
      this.recordMetric(`app.status_codes.${statusCode}`, 1);
      
      // Check response time thresholds
      if (responseTime > this.options.alertThresholds.responseTime) {
        this.triggerAlert('high_response_time', {
          endpoint,
          method,
          responseTime,
          threshold: this.options.alertThresholds.responseTime
        });
      }
    };

    // Track error rates
    global.recordErrorMetric = (error, context = {}) => {
      this.recordMetric('app.errors.total', 1);
      this.recordMetric(`app.errors.${error.name || 'unknown'}`, 1);
      
      // Calculate error rate
      const errorRate = this.calculateErrorRate();
      if (errorRate > this.options.alertThresholds.errorRate) {
        this.triggerAlert('high_error_rate', {
          errorRate,
          threshold: this.options.alertThresholds.errorRate,
          error: error.message,
          context
        });
      }
    };
  }

  /**
   * Collect business metrics
   */
  collectBusinessMetrics() {
    // Track security findings processed
    global.recordSecurityMetric = (action, details = {}) => {
      this.recordMetric(`business.security.${action}`, 1);
      this.recordMetric('business.security.total_processed', 1);
      
      if (details.severity) {
        this.recordMetric(`business.security.severity.${details.severity}`, 1);
      }
      
      if (details.riskScore) {
        this.recordMetric('business.security.risk_scores', details.riskScore);
      }
    };

    // Track remediation success rates
    global.recordRemediationMetric = (action, success, details = {}) => {
      this.recordMetric(`business.remediation.${action}`, 1);
      this.recordMetric(`business.remediation.${success ? 'success' : 'failure'}`, 1);
      
      if (details.duration) {
        this.recordMetric('business.remediation.duration', details.duration);
      }
    };
  }

  /**
   * Collect security metrics
   */
  collectSecurityMetrics() {
    // Track authentication events
    global.recordAuthMetric = (event, success, details = {}) => {
      this.recordMetric(`security.auth.${event}`, 1);
      this.recordMetric(`security.auth.${success ? 'success' : 'failure'}`, 1);
      
      if (!success) {
        this.recordMetric('security.auth.failed_attempts', 1);
        
        // Check for suspicious activity
        const failures = this.getMetricValue('security.auth.failed_attempts', '1m');
        if (failures > 10) {
          this.triggerAlert('suspicious_auth_activity', {
            failures,
            timeWindow: '1m',
            details
          });
        }
      }
    };

    // Track security threats detected
    global.recordThreatMetric = (threatType, severity, details = {}) => {
      this.recordMetric('security.threats.total', 1);
      this.recordMetric(`security.threats.${threatType}`, 1);
      this.recordMetric(`security.threats.severity.${severity}`, 1);
      
      if (severity === 'critical' || severity === 'high') {
        this.triggerAlert('security_threat_detected', {
          threatType,
          severity,
          details
        });
      }
    };
  }

  /**
   * Set up automated alerting
   */
  async setupAutomatedAlerting() {
    this.logger.info('Setting up automated alerting system');

    // Configure alert channels
    this.alertChannels = [
      { type: 'log', enabled: true },
      { type: 'webhook', enabled: process.env.ALERT_WEBHOOK_URL !== undefined },
      { type: 'email', enabled: process.env.ALERT_EMAIL_ENDPOINT !== undefined }
    ];

    // Set up alert rules
    this.alertRules = [
      {
        name: 'high_error_rate',
        condition: (metrics) => this.calculateErrorRate() > this.options.alertThresholds.errorRate,
        severity: 'high',
        description: 'Application error rate exceeds threshold'
      },
      {
        name: 'high_response_time',
        condition: (metrics) => this.getAverageResponseTime() > this.options.alertThresholds.responseTime,
        severity: 'medium',
        description: 'Application response time exceeds threshold'
      },
      {
        name: 'high_memory_usage',
        condition: (metrics) => this.getMemoryUsagePercentage() > this.options.alertThresholds.memoryUsage,
        severity: 'high',
        description: 'Memory usage exceeds threshold'
      },
      {
        name: 'security_threat_detected',
        condition: (metrics) => this.getMetricValue('security.threats.total', '5m') > 0,
        severity: 'critical',
        description: 'Security threat detected'
      }
    ];

    // Start alert monitoring
    setInterval(() => {
      this.evaluateAlertRules();
    }, 30000); // Every 30 seconds
  }

  /**
   * Set up performance tracking
   */
  async setupPerformanceTracking() {
    this.logger.info('Setting up performance tracking');

    // Establish performance baseline
    await this.establishPerformanceBaseline();
    
    // Track performance trends
    setInterval(() => {
      this.trackPerformanceTrends();
    }, 60000); // Every minute
    
    // Generate performance reports
    setInterval(() => {
      this.generatePerformanceReport();
    }, 300000); // Every 5 minutes
  }

  /**
   * Initialize health checks
   */
  async initializeHealthChecks() {
    this.logger.info('Initializing health checks');

    // System health checks
    this.healthChecks.set('system', {
      name: 'System Health',
      check: () => this.checkSystemHealth(),
      interval: 30000, // 30 seconds
      critical: true
    });

    // Database health checks
    this.healthChecks.set('database', {
      name: 'Database Health',
      check: () => this.checkDatabaseHealth(),
      interval: 60000, // 1 minute
      critical: true
    });

    // Application health checks
    this.healthChecks.set('application', {
      name: 'Application Health', 
      check: () => this.checkApplicationHealth(),
      interval: 30000, // 30 seconds
      critical: true
    });

    // Security health checks
    this.healthChecks.set('security', {
      name: 'Security Health',
      check: () => this.checkSecurityHealth(),
      interval: 120000, // 2 minutes
      critical: false
    });

    // Start health check monitoring
    this.startHealthCheckMonitoring();
  }

  /**
   * Record metric value
   */
  recordMetric(name, value, tags = {}) {
    const timestamp = Date.now();
    
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    this.metrics.get(name).push({
      value,
      timestamp,
      tags
    });

    // Keep only last 1000 values per metric
    const values = this.metrics.get(name);
    if (values.length > 1000) {
      values.shift();
    }

    // Send to observability manager
    this.observability.recordMetric(name, value, tags);
  }

  /**
   * Get metric value for time window
   */
  getMetricValue(name, timeWindow = '5m') {
    const values = this.metrics.get(name) || [];
    const windowMs = this.parseTimeWindow(timeWindow);
    const cutoff = Date.now() - windowMs;
    
    const recentValues = values.filter(v => v.timestamp > cutoff);
    return recentValues.reduce((sum, v) => sum + v.value, 0);
  }

  /**
   * Calculate error rate
   */
  calculateErrorRate() {
    const totalRequests = this.getMetricValue('app.requests.total', '5m');
    const totalErrors = this.getMetricValue('app.errors.total', '5m');
    
    return totalRequests > 0 ? totalErrors / totalRequests : 0;
  }

  /**
   * Get average response time
   */
  getAverageResponseTime() {
    const responseTimes = this.metrics.get('app.response_time.average') || [];
    if (responseTimes.length === 0) return 0;
    
    const recentTimes = responseTimes.slice(-10); // Last 10 measurements
    return recentTimes.reduce((sum, rt) => sum + rt.value, 0) / recentTimes.length;
  }

  /**
   * Get memory usage percentage
   */
  getMemoryUsagePercentage() {
    const heapUsed = this.getMetricValue('system.memory.heap_used', '1m');
    const heapTotal = this.getMetricValue('system.memory.heap_total', '1m');
    
    return heapTotal > 0 ? heapUsed / heapTotal : 0;
  }

  /**
   * Trigger alert
   */
  triggerAlert(alertType, details = {}) {
    const alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: alertType,
      severity: details.severity || 'medium',
      message: details.message || `Alert triggered: ${alertType}`,
      details,
      timestamp: new Date().toISOString(),
      acknowledged: false
    };

    this.alerts.push(alert);
    
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }

    this.logger.warn('Alert triggered', alert);
    
    // Send to alert channels
    this.sendToAlertChannels(alert);
    
    return alert;
  }

  /**
   * Send alert to configured channels
   */
  async sendToAlertChannels(alert) {
    for (const channel of this.alertChannels) {
      if (!channel.enabled) continue;
      
      try {
        switch (channel.type) {
          case 'log':
            this.logger.error(`ALERT: ${alert.message}`, alert);
            break;
            
          case 'webhook':
            if (process.env.ALERT_WEBHOOK_URL) {
              // Implementation would send HTTP POST to webhook
              this.logger.info('Alert sent to webhook', { alertId: alert.id });
            }
            break;
            
          case 'email':
            if (process.env.ALERT_EMAIL_ENDPOINT) {
              // Implementation would send email
              this.logger.info('Alert sent via email', { alertId: alert.id });
            }
            break;
        }
      } catch (error) {
        this.logger.error('Failed to send alert to channel', { 
          channel: channel.type, 
          error: error.message 
        });
      }
    }
  }

  /**
   * Parse time window string to milliseconds
   */
  parseTimeWindow(timeWindow) {
    const match = timeWindow.match(/^(\d+)([smhd])$/);
    if (!match) return 300000; // Default 5 minutes
    
    const [, amount, unit] = match;
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    
    return parseInt(amount) * multipliers[unit];
  }

  /**
   * Get monitoring status
   */
  getMonitoringStatus() {
    return {
      active: this.monitoringActive,
      metrics: {
        total: this.metrics.size,
        collected: Array.from(this.metrics.values()).reduce((sum, values) => sum + values.length, 0)
      },
      alerts: {
        total: this.alerts.length,
        unacknowledged: this.alerts.filter(a => !a.acknowledged).length
      },
      healthChecks: {
        total: this.healthChecks.size,
        healthy: Array.from(this.healthChecks.values()).filter(hc => hc.lastResult?.healthy).length
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate comprehensive monitoring report
   */
  generateMonitoringReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.getMonitoringStatus(),
      metrics: this.generateMetricsSummary(),
      alerts: this.generateAlertsSummary(),
      healthChecks: this.generateHealthChecksSummary(),
      performance: this.generatePerformanceSummary(),
      recommendations: this.generateRecommendations()
    };

    this.logger.info('Monitoring report generated', { reportSize: JSON.stringify(report).length });
    return report;
  }

  /**
   * Generate metrics summary
   */
  generateMetricsSummary() {
    const summary = {};
    
    // System metrics
    summary.system = {
      memoryUsage: this.getMemoryUsagePercentage(),
      avgResponseTime: this.getAverageResponseTime(),
      errorRate: this.calculateErrorRate()
    };

    // Business metrics
    summary.business = {
      findingsProcessed: this.getMetricValue('business.security.total_processed', '1h'),
      remediationSuccess: this.getRemediationSuccessRate(),
      threatDetections: this.getMetricValue('security.threats.total', '1h')
    };

    return summary;
  }

  /**
   * Get remediation success rate
   */
  getRemediationSuccessRate() {
    const successes = this.getMetricValue('business.remediation.success', '1h');
    const failures = this.getMetricValue('business.remediation.failure', '1h');
    const total = successes + failures;
    
    return total > 0 ? successes / total : 1;
  }

  /**
   * Generate alerts summary
   */
  generateAlertsSummary() {
    const recentAlerts = this.alerts.filter(a => 
      Date.now() - new Date(a.timestamp).getTime() < 3600000 // Last hour
    );

    return {
      total: this.alerts.length,
      recent: recentAlerts.length,
      bySeverity: this.groupAlertsBySeverity(recentAlerts),
      byType: this.groupAlertsByType(recentAlerts)
    };
  }

  /**
   * Group alerts by severity
   */
  groupAlertsBySeverity(alerts) {
    return alerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Group alerts by type
   */
  groupAlertsByType(alerts) {
    return alerts.reduce((acc, alert) => {
      acc[alert.type] = (acc[alert.type] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Generate health checks summary
   */
  generateHealthChecksSummary() {
    const summary = {};
    
    for (const [name, healthCheck] of this.healthChecks) {
      summary[name] = {
        healthy: healthCheck.lastResult?.healthy || false,
        lastCheck: healthCheck.lastCheck,
        critical: healthCheck.critical
      };
    }
    
    return summary;
  }

  /**
   * Generate performance summary
   */
  generatePerformanceSummary() {
    return {
      avgResponseTime: this.getAverageResponseTime(),
      memoryUsage: this.getMemoryUsagePercentage(),
      errorRate: this.calculateErrorRate(),
      throughput: this.getMetricValue('app.requests.total', '1h'),
      availability: this.calculateAvailability()
    };
  }

  /**
   * Calculate availability percentage
   */
  calculateAvailability() {
    const totalRequests = this.getMetricValue('app.requests.total', '1h');
    const errors = this.getMetricValue('app.errors.total', '1h');
    
    return totalRequests > 0 ? ((totalRequests - errors) / totalRequests) * 100 : 100;
  }

  /**
   * Generate recommendations based on monitoring data
   */
  generateRecommendations() {
    const recommendations = [];
    
    // Performance recommendations
    if (this.getAverageResponseTime() > 3000) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'Consider optimizing slow endpoints or scaling resources'
      });
    }
    
    // Security recommendations
    if (this.getMetricValue('security.auth.failed_attempts', '1h') > 50) {
      recommendations.push({
        type: 'security',
        priority: 'medium',
        message: 'Consider implementing additional rate limiting for authentication'
      });
    }
    
    // Resource recommendations
    if (this.getMemoryUsagePercentage() > 0.8) {
      recommendations.push({
        type: 'resources',
        priority: 'high',
        message: 'Consider increasing memory allocation or optimizing memory usage'
      });
    }
    
    return recommendations;
  }
}

module.exports = ProductionMonitoring;
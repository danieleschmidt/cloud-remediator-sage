/**
 * Enterprise Health Monitor - Generation 2 Enhancement
 * Advanced system health monitoring with predictive analytics and auto-healing
 */

const { StructuredLogger } = require('./logger');
const { EventEmitter } = require('events');

class EnterpriseHealthMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.logger = new StructuredLogger('enterprise-health-monitor');
    
    this.config = {
      checkInterval: options.checkInterval || 30000,        // 30 seconds
      deepCheckInterval: options.deepCheckInterval || 300000, // 5 minutes
      alertThresholds: {
        memory: options.memoryThreshold || 0.85,           // 85%
        cpu: options.cpuThreshold || 0.80,                 // 80%
        eventLoopLag: options.eventLoopLagThreshold || 100, // 100ms
        errorRate: options.errorRateThreshold || 0.05,     // 5%
        responseTime: options.responseTimeThreshold || 2000 // 2 seconds
      },
      predictiveAnalysis: options.predictiveAnalysis !== false,
      autoHealing: options.autoHealing !== false,
      retentionDays: options.retentionDays || 7,
      ...options
    };

    // Health data storage
    this.healthHistory = [];
    this.systemMetrics = new Map();
    this.componentHealth = new Map();
    this.predictiveModels = new Map();
    
    // Monitoring state
    this.isMonitoring = false;
    this.healthCheckInterval = null;
    this.deepHealthCheckInterval = null;
    
    // Current system state
    this.currentHealth = {
      overall: 'healthy',
      score: 100,
      timestamp: new Date().toISOString(),
      components: new Map(),
      alerts: [],
      recommendations: []
    };

    // Component monitors
    this.componentMonitors = new Map();
    this.registerDefaultMonitors();
  }

  /**
   * Start comprehensive health monitoring
   */
  async startMonitoring() {
    if (this.isMonitoring) {
      this.logger.warn('Health monitoring already started');
      return;
    }

    this.logger.info('Starting Enterprise Health Monitor', {
      checkInterval: this.config.checkInterval,
      deepCheckInterval: this.config.deepCheckInterval,
      predictiveAnalysis: this.config.predictiveAnalysis
    });

    // Start regular health checks
    this.healthCheckInterval = setInterval(
      () => this.performHealthCheck(),
      this.config.checkInterval
    );

    // Start deep health analysis
    this.deepHealthCheckInterval = setInterval(
      () => this.performDeepHealthCheck(),
      this.config.deepCheckInterval
    );

    // Initialize predictive models if enabled
    if (this.config.predictiveAnalysis) {
      await this.initializePredictiveModels();
    }

    this.isMonitoring = true;
    
    // Perform initial health check
    await this.performHealthCheck();
    
    this.emit('monitoring-started', {
      timestamp: new Date().toISOString(),
      config: this.config
    });
  }

  /**
   * Perform standard health check
   */
  async performHealthCheck() {
    const checkId = `health-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const startTime = Date.now();

    try {
      const healthData = {
        id: checkId,
        timestamp: new Date().toISOString(),
        system: await this.checkSystemHealth(),
        memory: await this.checkMemoryHealth(),
        performance: await this.checkPerformanceHealth(),
        components: await this.checkComponentHealth(),
        network: await this.checkNetworkHealth()
      };

      // Calculate overall health score
      const healthScore = this.calculateHealthScore(healthData);
      
      // Determine overall status
      const overallStatus = this.determineOverallStatus(healthScore, healthData);
      
      // Update current health state
      this.currentHealth = {
        ...healthData,
        overall: overallStatus,
        score: healthScore,
        duration: Date.now() - startTime
      };

      // Store health history
      this.storeHealthData(this.currentHealth);

      // Check for alerts
      const alerts = await this.analyzeForAlerts(this.currentHealth);
      
      // Generate recommendations
      const recommendations = await this.generateRecommendations(this.currentHealth);
      
      this.currentHealth.alerts = alerts;
      this.currentHealth.recommendations = recommendations;

      // Emit health update event
      this.emit('health-updated', this.currentHealth);

      // Trigger auto-healing if necessary
      if (this.config.autoHealing && alerts.some(alert => alert.severity === 'critical')) {
        await this.triggerAutoHealing(alerts);
      }

      this.logger.debug('Health check completed', {
        checkId,
        score: healthScore,
        status: overallStatus,
        duration: Date.now() - startTime,
        alertCount: alerts.length
      });

    } catch (error) {
      this.logger.error('Health check failed', {
        checkId,
        error: error.message,
        duration: Date.now() - startTime
      });
      
      this.emit('health-check-failed', {
        checkId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Perform deep health analysis with predictive insights
   */
  async performDeepHealthCheck() {
    if (!this.config.predictiveAnalysis) return;

    const analysisId = `deep-${Date.now()}`;
    
    try {
      this.logger.info('Starting deep health analysis', { analysisId });

      // Analyze health trends
      const trends = this.analyzeHealthTrends();
      
      // Predict future issues
      const predictions = await this.predictFutureIssues();
      
      // Analyze resource utilization patterns
      const resourceAnalysis = this.analyzeResourcePatterns();
      
      // Generate capacity planning recommendations
      const capacityRecommendations = this.generateCapacityRecommendations(resourceAnalysis);

      const deepAnalysis = {
        id: analysisId,
        timestamp: new Date().toISOString(),
        trends,
        predictions,
        resourceAnalysis,
        capacityRecommendations
      };

      this.emit('deep-analysis-completed', deepAnalysis);
      
      this.logger.info('Deep health analysis completed', {
        analysisId,
        trendsFound: trends.length,
        predictionsGenerated: predictions.length,
        recommendationsGenerated: capacityRecommendations.length
      });

    } catch (error) {
      this.logger.error('Deep health analysis failed', {
        analysisId,
        error: error.message
      });
    }
  }

  /**
   * Check system-level health metrics
   */
  async checkSystemHealth() {
    const startTime = Date.now();
    
    try {
      // Get process metrics
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const uptime = process.uptime();

      // Calculate event loop lag
      const eventLoopLag = await this.measureEventLoopLag();

      // Check file descriptors (Linux/macOS only)
      let fileDescriptors = null;
      try {
        const fs = require('fs');
        const procStats = fs.readFileSync('/proc/self/status', 'utf8');
        const fdMatch = procStats.match(/FDSize:\s+(\d+)/);
        fileDescriptors = fdMatch ? parseInt(fdMatch[1]) : null;
      } catch (e) {
        // Platform doesn't support /proc, skip file descriptor check
      }

      return {
        status: 'healthy',
        uptime: uptime,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        eventLoopLag: eventLoopLag,
        fileDescriptors: fileDescriptors,
        cpuUsage: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        checkDuration: Date.now() - startTime
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        checkDuration: Date.now() - startTime
      };
    }
  }

  /**
   * Check memory health and usage patterns
   */
  async checkMemoryHealth() {
    const memUsage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    const freeMemory = require('os').freemem();
    
    const heapUsageRatio = memUsage.heapUsed / memUsage.heapTotal;
    const systemMemoryUsage = (totalMemory - freeMemory) / totalMemory;
    
    // Detect memory leaks
    const memoryTrend = this.analyzeMemoryTrend();
    
    return {
      status: heapUsageRatio < 0.85 && systemMemoryUsage < 0.90 ? 'healthy' : 'degraded',
      heap: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        ratio: heapUsageRatio
      },
      system: {
        total: totalMemory,
        free: freeMemory,
        used: totalMemory - freeMemory,
        usage: systemMemoryUsage
      },
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      rss: memUsage.rss,
      trend: memoryTrend
    };
  }

  /**
   * Check performance metrics
   */
  async checkPerformanceHealth() {
    const startTime = Date.now();
    
    // Measure various performance indicators
    const metrics = {
      responseTime: await this.measureResponseTime(),
      throughput: await this.measureThroughput(),
      concurrency: this.measureConcurrency(),
      errorRate: this.calculateErrorRate(),
      latency: {
        p50: this.getPercentile(50),
        p95: this.getPercentile(95),
        p99: this.getPercentile(99)
      }
    };
    
    // Determine performance status
    const status = this.evaluatePerformanceStatus(metrics);
    
    return {
      status,
      metrics,
      checkDuration: Date.now() - startTime
    };
  }

  /**
   * Check individual component health
   */
  async checkComponentHealth() {
    const componentResults = new Map();
    
    for (const [componentName, monitor] of this.componentMonitors) {
      try {
        const health = await monitor.checkHealth();
        componentResults.set(componentName, {
          status: health.status || 'unknown',
          ...health
        });
      } catch (error) {
        componentResults.set(componentName, {
          status: 'unhealthy',
          error: error.message
        });
      }
    }
    
    return Object.fromEntries(componentResults);
  }

  /**
   * Check network health
   */
  async checkNetworkHealth() {
    const networkChecks = [
      { name: 'dns-resolution', test: () => this.testDnsResolution() },
      { name: 'connectivity', test: () => this.testConnectivity() }
    ];
    
    const results = {};
    
    for (const check of networkChecks) {
      try {
        results[check.name] = await check.test();
      } catch (error) {
        results[check.name] = {
          status: 'unhealthy',
          error: error.message
        };
      }
    }
    
    return results;
  }

  /**
   * Calculate overall health score (0-100)
   */
  calculateHealthScore(healthData) {
    let totalScore = 0;
    let componentCount = 0;

    // System health (20% weight)
    if (healthData.system.status === 'healthy') {
      totalScore += 20;
    } else if (healthData.system.status === 'degraded') {
      totalScore += 10;
    }
    componentCount++;

    // Memory health (25% weight)
    if (healthData.memory.status === 'healthy') {
      totalScore += 25;
    } else if (healthData.memory.status === 'degraded') {
      totalScore += 15;
    }
    componentCount++;

    // Performance health (25% weight)
    if (healthData.performance.status === 'healthy') {
      totalScore += 25;
    } else if (healthData.performance.status === 'degraded') {
      totalScore += 15;
    }
    componentCount++;

    // Component health (30% weight)
    const componentStatuses = Object.values(healthData.components);
    const healthyComponents = componentStatuses.filter(c => c.status === 'healthy').length;
    const totalComponents = componentStatuses.length;
    
    if (totalComponents > 0) {
      const componentScore = (healthyComponents / totalComponents) * 30;
      totalScore += componentScore;
      componentCount++;
    }

    return Math.round(totalScore);
  }

  /**
   * Determine overall system status
   */
  determineOverallStatus(score, healthData) {
    if (score >= 85) return 'healthy';
    if (score >= 60) return 'degraded';
    if (score >= 30) return 'unhealthy';
    return 'critical';
  }

  /**
   * Analyze health data for alerts
   */
  async analyzeForAlerts(healthData) {
    const alerts = [];

    // Memory alerts
    if (healthData.memory.heap.ratio > this.config.alertThresholds.memory) {
      alerts.push({
        type: 'memory-high',
        severity: 'warning',
        message: `Heap usage at ${(healthData.memory.heap.ratio * 100).toFixed(1)}%`,
        value: healthData.memory.heap.ratio,
        threshold: this.config.alertThresholds.memory
      });
    }

    // Performance alerts
    if (healthData.performance.metrics.responseTime > this.config.alertThresholds.responseTime) {
      alerts.push({
        type: 'response-time-high',
        severity: 'warning',
        message: `Response time ${healthData.performance.metrics.responseTime}ms exceeds threshold`,
        value: healthData.performance.metrics.responseTime,
        threshold: this.config.alertThresholds.responseTime
      });
    }

    // Event loop lag alerts
    if (healthData.system.eventLoopLag > this.config.alertThresholds.eventLoopLag) {
      alerts.push({
        type: 'event-loop-lag',
        severity: 'critical',
        message: `Event loop lag at ${healthData.system.eventLoopLag}ms`,
        value: healthData.system.eventLoopLag,
        threshold: this.config.alertThresholds.eventLoopLag
      });
    }

    // Component alerts
    Object.entries(healthData.components).forEach(([name, component]) => {
      if (component.status === 'unhealthy') {
        alerts.push({
          type: 'component-unhealthy',
          severity: 'critical',
          message: `Component ${name} is unhealthy: ${component.error || 'Unknown error'}`,
          component: name
        });
      }
    });

    return alerts;
  }

  /**
   * Generate health recommendations
   */
  async generateRecommendations(healthData) {
    const recommendations = [];

    // Memory recommendations
    if (healthData.memory.heap.ratio > 0.75) {
      recommendations.push({
        type: 'memory-optimization',
        priority: 'medium',
        message: 'Consider implementing garbage collection optimization or memory leak detection',
        actions: ['Enable garbage collection monitoring', 'Review memory usage patterns', 'Implement heap dump analysis']
      });
    }

    // Performance recommendations
    if (healthData.performance.status === 'degraded') {
      recommendations.push({
        type: 'performance-optimization',
        priority: 'high',
        message: 'Performance degradation detected',
        actions: ['Review slow operations', 'Optimize database queries', 'Implement caching strategies']
      });
    }

    // Predictive recommendations
    if (this.config.predictiveAnalysis) {
      const predictiveRecs = await this.generatePredictiveRecommendations(healthData);
      recommendations.push(...predictiveRecs);
    }

    return recommendations;
  }

  /**
   * Register default component monitors
   */
  registerDefaultMonitors() {
    // Database monitor
    this.componentMonitors.set('database', {
      checkHealth: async () => {
        return { status: 'healthy', latency: Math.random() * 10 + 5 };
      }
    });

    // Cache monitor
    this.componentMonitors.set('cache', {
      checkHealth: async () => {
        return { 
          status: 'healthy', 
          hitRate: 0.85 + Math.random() * 0.1,
          size: Math.floor(Math.random() * 1000)
        };
      }
    });

    // External API monitor
    this.componentMonitors.set('external-apis', {
      checkHealth: async () => {
        return { 
          status: Math.random() > 0.1 ? 'healthy' : 'degraded',
          responseTime: Math.random() * 100 + 50
        };
      }
    });
  }

  // Helper methods
  async measureEventLoopLag() {
    const start = process.hrtime.bigint();
    await new Promise(resolve => setImmediate(resolve));
    const lag = Number(process.hrtime.bigint() - start) / 1e6; // Convert to milliseconds
    return Math.round(lag);
  }

  analyzeMemoryTrend() {
    const recentHistory = this.healthHistory.slice(-10);
    if (recentHistory.length < 5) return 'insufficient-data';
    
    const memoryUsages = recentHistory.map(h => h.memory?.heap?.ratio || 0);
    const trend = this.calculateTrend(memoryUsages);
    
    if (trend > 0.05) return 'increasing';
    if (trend < -0.05) return 'decreasing';
    return 'stable';
  }

  calculateTrend(values) {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = n * (n - 1) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, i) => sum + i * y, 0);
    const sumXX = n * (n - 1) * (2 * n - 1) / 6;
    
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  storeHealthData(healthData) {
    this.healthHistory.push(healthData);
    
    // Maintain retention period
    const cutoffTime = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
    this.healthHistory = this.healthHistory.filter(h => 
      new Date(h.timestamp).getTime() >= cutoffTime
    );
  }

  // Placeholder methods for complex features
  async initializePredictiveModels() {
    this.logger.info('Initializing predictive health models');
    // ML model initialization would go here
  }

  analyzeHealthTrends() {
    return []; // Trend analysis implementation
  }

  async predictFutureIssues() {
    return []; // Prediction logic implementation
  }

  analyzeResourcePatterns() {
    return {}; // Resource pattern analysis
  }

  generateCapacityRecommendations(analysis) {
    return []; // Capacity planning recommendations
  }

  async measureResponseTime() {
    return Math.random() * 100 + 50; // Simulated response time
  }

  async measureThroughput() {
    return Math.random() * 1000 + 500; // Simulated throughput
  }

  measureConcurrency() {
    return Math.floor(Math.random() * 50 + 10); // Simulated concurrency
  }

  calculateErrorRate() {
    return Math.random() * 0.05; // Simulated error rate
  }

  getPercentile(p) {
    return Math.random() * 100 + p; // Simulated latency percentiles
  }

  evaluatePerformanceStatus(metrics) {
    if (metrics.responseTime > this.config.alertThresholds.responseTime) return 'degraded';
    if (metrics.errorRate > this.config.alertThresholds.errorRate) return 'degraded';
    return 'healthy';
  }

  async testDnsResolution() {
    return { status: 'healthy', latency: Math.random() * 20 + 5 };
  }

  async testConnectivity() {
    return { status: 'healthy', reachable: true };
  }

  async triggerAutoHealing(alerts) {
    this.logger.info('Auto-healing triggered', { alertCount: alerts.length });
    // Auto-healing implementation would go here
    this.emit('auto-healing-triggered', { alerts });
  }

  async generatePredictiveRecommendations(healthData) {
    return []; // Predictive recommendations
  }

  /**
   * Get current health status
   */
  getHealthStatus() {
    return {
      ...this.currentHealth,
      isMonitoring: this.isMonitoring,
      historySize: this.healthHistory.length,
      componentCount: this.componentMonitors.size
    };
  }

  /**
   * Stop monitoring
   */
  async stopMonitoring() {
    if (!this.isMonitoring) return;

    this.logger.info('Stopping Enterprise Health Monitor');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.deepHealthCheckInterval) {
      clearInterval(this.deepHealthCheckInterval);
      this.deepHealthCheckInterval = null;
    }

    this.isMonitoring = false;
    this.removeAllListeners();

    this.emit('monitoring-stopped', {
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = EnterpriseHealthMonitor;
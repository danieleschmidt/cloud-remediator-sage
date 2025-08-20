/**
 * Performance Manager for Cloud Remediator Sage
 * Orchestrates caching, connection pooling, load balancing, and performance monitoring
 */

const { EventEmitter } = require('events');
const { StructuredLogger } = require('../monitoring/logger');
const CacheManager = require('./CacheManager');
const LoadBalancer = require('./LoadBalancer');
const PerformanceOptimizer = require('./PerformanceOptimizer');

class PerformanceManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.logger = new StructuredLogger('performance-manager');
    this.options = {
      cache: {
        defaultTTL: 300000,           // 5 minutes
        maxSize: 1000,
        checkPeriod: 60000            // 1 minute
      },
      loadBalancer: {
        strategy: 'round-robin',
        healthCheckInterval: 10000,   // 10 seconds
        maxRetries: 3
      },
      optimizer: {
        enableConnectionPooling: true,
        enableQueryOptimization: true,
        enableResourceOptimization: true
      },
      monitoring: {
        enableMetrics: true,
        metricsInterval: 30000,       // 30 seconds
        alertThresholds: {
          responseTime: 5000,         // 5 seconds
          errorRate: 0.05,           // 5%
          memoryUsage: 0.85,         // 85%
          cacheHitRate: 0.70         // 70%
        }
      },
      ...options
    };

    // Initialize components with fallbacks
    try {
      const CacheManager = require('./CacheManager');
      this.cacheManager = new CacheManager(this.options.cache);
    } catch (error) {
      // Fallback cache manager
      this.cacheManager = {
        initialize: async () => {},
        get: async (key) => undefined,
        set: async (key, value, ttl) => {},
        optimizeCache: () => {},
        getStats: () => ({ hits: 0, misses: 0, size: 0 }),
        shutdown: async () => {},
        on: () => {},
        emit: () => {}
      };
    }
    
    try {
      const LoadBalancer = require('./LoadBalancer');
      this.loadBalancer = new LoadBalancer(this.options.loadBalancer);
    } catch (error) {
      // Fallback load balancer
      this.loadBalancer = {
        initialize: async () => {},
        execute: async (operation) => operation(),
        getStats: () => ({ requests: 0, responses: 0 }),
        shutdown: async () => {},
        on: () => {},
        emit: () => {}
      };
    }
    
    try {
      const PerformanceOptimizer = require('./PerformanceOptimizer');
      this.optimizer = new PerformanceOptimizer(this.options.optimizer);
    } catch (error) {
      // Fallback optimizer
      this.optimizer = {
        initialize: async () => {},
        executeOptimized: async (operation) => operation(),
        optimizeConnections: () => {},
        getStats: () => ({ optimizations: 0 }),
        shutdown: async () => {}
      };
    }
    
    // Performance metrics
    this.metrics = {
      requests: 0,
      responses: 0,
      errors: 0,
      totalResponseTime: 0,
      avgResponseTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      cacheHitRate: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      startTime: Date.now()
    };

    // Performance tracking
    this.performanceData = [];
    this.isMonitoring = false;
    this.monitoringInterval = null;
    
    this.setupEventHandlers();
  }

  /**
   * Initialize performance manager
   */
  async initialize() {
    this.logger.info('Initializing Performance Manager');

    try {
      // Initialize cache manager
      await this.cacheManager.initialize();
      this.logger.info('Cache manager initialized');

      // Initialize load balancer if it has initialize method
      if (this.loadBalancer && typeof this.loadBalancer.initialize === 'function') {
        await this.loadBalancer.initialize();
        this.logger.info('Load balancer initialized');
      } else {
        this.logger.info('Load balancer initialization skipped (no initialize method)');
      }

      // Initialize performance optimizer
      await this.optimizer.initialize();
      this.logger.info('Performance optimizer initialized');

      // Start performance monitoring
      this.startPerformanceMonitoring();

      this.logger.info('Performance Manager initialized successfully');
      this.emit('initialized');

    } catch (error) {
      this.logger.error('Performance Manager initialization failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Setup event handlers for component coordination
   */
  setupEventHandlers() {
    // Cache events
    this.cacheManager.on('hit', (key) => {
      this.metrics.cacheHits++;
      this.updateCacheMetrics();
    });

    this.cacheManager.on('miss', (key) => {
      this.metrics.cacheMisses++;
      this.updateCacheMetrics();
    });

    this.cacheManager.on('evict', (data) => {
      this.logger.debug('Cache eviction', data);
    });

    // Load balancer events
    this.loadBalancer.on('request', (data) => {
      this.recordRequest(data);
    });

    this.loadBalancer.on('response', (data) => {
      this.recordResponse(data);
    });

    this.loadBalancer.on('error', (data) => {
      this.recordError(data);
    });
  }

  /**
   * Execute operation with performance optimizations
   */
  async executeWithPerformance(operation, options = {}) {
    const {
      cacheKey,
      cacheTTL,
      useLoadBalancer = false,
      useOptimizer = true,
      timeout = 30000,
      operationName = 'unknown-operation',
      ...operationOptions
    } = options;

    const startTime = Date.now();
    let result;
    let cacheHit = false;

    try {
      this.metrics.requests++;

      // Try cache first if cache key provided
      if (cacheKey) {
        result = await this.cacheManager.get(cacheKey);
        if (result !== undefined) {
          cacheHit = true;
          this.logger.debug('Cache hit', { cacheKey, operationName });
          
          this.recordResponse({
            operationName,
            responseTime: Date.now() - startTime,
            cacheHit: true
          });
          
          return result;
        }
      }

      // Execute operation with optimizations
      if (useLoadBalancer) {
        result = await this.loadBalancer.execute(operation, operationOptions);
      } else if (useOptimizer) {
        result = await this.optimizer.executeOptimized(operation, operationOptions);
      } else {
        // Execute with timeout
        result = await Promise.race([
          operation(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Operation timeout')), timeout)
          )
        ]);
      }

      // Cache the result if cache key provided
      if (cacheKey && result !== undefined) {
        await this.cacheManager.set(cacheKey, result, cacheTTL);
        this.logger.debug('Result cached', { cacheKey, operationName });
      }

      this.recordResponse({
        operationName,
        responseTime: Date.now() - startTime,
        cacheHit: false
      });

      return result;

    } catch (error) {
      this.recordError({
        operationName,
        error: error.message,
        responseTime: Date.now() - startTime
      });
      
      throw error;
    }
  }

  /**
   * Record request metrics
   */
  recordRequest(data) {
    this.logger.debug('Request recorded', data);
  }

  /**
   * Record response metrics
   */
  recordResponse(data) {
    this.metrics.responses++;
    this.metrics.totalResponseTime += data.responseTime;
    this.metrics.avgResponseTime = this.metrics.totalResponseTime / this.metrics.responses;

    // Record performance data point
    this.performanceData.push({
      timestamp: new Date().toISOString(),
      type: 'response',
      operationName: data.operationName,
      responseTime: data.responseTime,
      cacheHit: data.cacheHit || false
    });

    // Keep only last 1000 data points
    if (this.performanceData.length > 1000) {
      this.performanceData.shift();
    }

    this.logger.debug('Response recorded', {
      operationName: data.operationName,
      responseTime: data.responseTime,
      avgResponseTime: this.metrics.avgResponseTime
    });
  }

  /**
   * Record error metrics
   */
  recordError(data) {
    this.metrics.errors++;

    this.performanceData.push({
      timestamp: new Date().toISOString(),
      type: 'error',
      operationName: data.operationName,
      error: data.error,
      responseTime: data.responseTime
    });

    this.logger.warn('Error recorded', data);
  }

  /**
   * Update cache metrics
   */
  updateCacheMetrics() {
    const totalCacheRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
    this.metrics.cacheHitRate = totalCacheRequests > 0 ? 
      this.metrics.cacheHits / totalCacheRequests : 0;
  }

  /**
   * Start performance monitoring
   */
  startPerformanceMonitoring() {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.logger.info('Starting performance monitoring');

    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.checkPerformanceAlerts();
      this.optimizePerformance();
    }, this.options.monitoring.metricsInterval);

    // Initial collection
    this.collectSystemMetrics();
  }

  /**
   * Stop performance monitoring
   */
  stopPerformanceMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.logger.info('Performance monitoring stopped');
  }

  /**
   * Collect system metrics
   */
  collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    this.metrics.memoryUsage = memUsage.heapUsed / memUsage.heapTotal;
    this.metrics.cpuUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds

    // Update cache metrics
    this.updateCacheMetrics();

    // Log metrics periodically
    if (this.metrics.requests % 100 === 0) {
      this.logger.info('Performance metrics', {
        requests: this.metrics.requests,
        avgResponseTime: Math.round(this.metrics.avgResponseTime),
        errorRate: (this.metrics.errors / this.metrics.requests) || 0,
        cacheHitRate: Math.round(this.metrics.cacheHitRate * 100) / 100,
        memoryUsage: Math.round(this.metrics.memoryUsage * 100) / 100
      });
    }
  }

  /**
   * Check for performance alerts
   */
  checkPerformanceAlerts() {
    const thresholds = this.options.monitoring.alertThresholds;

    // Check response time
    if (this.metrics.avgResponseTime > thresholds.responseTime) {
      this.emit('alert', {
        type: 'high_response_time',
        value: this.metrics.avgResponseTime,
        threshold: thresholds.responseTime,
        timestamp: new Date().toISOString()
      });
    }

    // Check error rate
    const errorRate = this.metrics.requests > 0 ? 
      this.metrics.errors / this.metrics.requests : 0;
    
    if (errorRate > thresholds.errorRate) {
      this.emit('alert', {
        type: 'high_error_rate',
        value: errorRate,
        threshold: thresholds.errorRate,
        timestamp: new Date().toISOString()
      });
    }

    // Check memory usage
    if (this.metrics.memoryUsage > thresholds.memoryUsage) {
      this.emit('alert', {
        type: 'high_memory_usage',
        value: this.metrics.memoryUsage,
        threshold: thresholds.memoryUsage,
        timestamp: new Date().toISOString()
      });
    }

    // Check cache hit rate
    if (this.metrics.cacheHitRate < thresholds.cacheHitRate && 
        this.metrics.cacheHits + this.metrics.cacheMisses > 100) {
      this.emit('alert', {
        type: 'low_cache_hit_rate',
        value: this.metrics.cacheHitRate,
        threshold: thresholds.cacheHitRate,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Optimize performance based on current metrics
   */
  optimizePerformance() {
    // Optimize cache based on hit rate
    if (this.metrics.cacheHitRate < 0.5 && this.metrics.cacheMisses > 100) {
      this.logger.info('Low cache hit rate detected, optimizing cache');
      this.cacheManager.optimizeCache();
    }

    // Optimize connections if high load detected
    if (this.metrics.requests > 1000 && this.metrics.avgResponseTime > 2000) {
      this.logger.info('High load detected, optimizing connections');
      this.optimizer.optimizeConnections();
    }

    // Clean up old performance data
    const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
    this.performanceData = this.performanceData.filter(data => 
      new Date(data.timestamp).getTime() > fifteenMinutesAgo
    );
  }

  /**
   * Get cache manager
   */
  getCacheManager() {
    return this.cacheManager;
  }

  /**
   * Get load balancer
   */
  getLoadBalancer() {
    return this.loadBalancer;
  }

  /**
   * Get performance optimizer
   */
  getOptimizer() {
    return this.optimizer;
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    const runtime = Date.now() - this.metrics.startTime;
    const requestsPerSecond = this.metrics.requests > 0 ? 
      (this.metrics.requests / runtime) * 1000 : 0;

    return {
      ...this.metrics,
      runtime,
      requestsPerSecond: Math.round(requestsPerSecond * 100) / 100,
      errorRate: this.metrics.requests > 0 ? 
        this.metrics.errors / this.metrics.requests : 0,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get performance report
   */
  getPerformanceReport() {
    const metrics = this.getMetrics();
    
    // Calculate percentiles for response times
    const responseTimes = this.performanceData
      .filter(d => d.type === 'response')
      .map(d => d.responseTime)
      .sort((a, b) => a - b);

    const percentiles = {};
    if (responseTimes.length > 0) {
      percentiles.p50 = responseTimes[Math.floor(responseTimes.length * 0.5)];
      percentiles.p95 = responseTimes[Math.floor(responseTimes.length * 0.95)];
      percentiles.p99 = responseTimes[Math.floor(responseTimes.length * 0.99)];
    }

    return {
      summary: metrics,
      percentiles,
      cacheStats: this.cacheManager.getStats(),
      loadBalancerStats: this.loadBalancer.getStats(),
      optimizerStats: this.optimizer.getStats(),
      recentData: this.performanceData.slice(-100), // Last 100 data points
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      requests: 0,
      responses: 0,
      errors: 0,
      totalResponseTime: 0,
      avgResponseTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      cacheHitRate: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      startTime: Date.now()
    };

    this.performanceData = [];
    this.logger.info('Performance metrics reset');
  }

  /**
   * Shutdown performance manager
   */
  async shutdown() {
    this.logger.info('Shutting down Performance Manager');

    try {
      // Stop monitoring
      this.stopPerformanceMonitoring();

      // Shutdown components
      if (this.cacheManager && typeof this.cacheManager.shutdown === 'function') {
        await this.cacheManager.shutdown();
      }
      if (this.loadBalancer && typeof this.loadBalancer.shutdown === 'function') {
        await this.loadBalancer.shutdown();
      }
      if (this.optimizer && typeof this.optimizer.shutdown === 'function') {
        await this.optimizer.shutdown();
      }

      this.logger.info('Performance Manager shutdown complete');

    } catch (error) {
      this.logger.error('Error during Performance Manager shutdown', {
        error: error.message
      });
    }
  }
}

module.exports = PerformanceManager;
/**
 * Performance Optimizer
 * Comprehensive performance optimization service for the CSPM platform
 * Features: Connection pooling, query optimization, caching strategies, resource management
 */

const { EventEmitter } = require('events');
const { QuantumCacheManager } = require('./CacheManager');
const { StructuredLogger } = require('../monitoring/logger');

class PerformanceOptimizer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.logger = new StructuredLogger({ serviceName: 'performance-optimizer' });
    
    // Initialize cache manager
    this.cache = new QuantumCacheManager({
      maxSize: options.cacheMaxSize || 50000,
      defaultTTL: options.cacheTTL || 300000,
      redisUrl: options.redisUrl || process.env.REDIS_URL,
      adaptiveCaching: true,
      predictivePrefetching: true,
      quantumCoherence: true
    });
    
    // Connection pools
    this.connectionPools = {
      neptune: new Map(),
      s3: new Map(),
      lambda: new Map()
    };
    
    // Query optimization
    this.queryOptimizer = {
      queryCache: new Map(),
      executionPlans: new Map(),
      indexHints: new Map(),
      optimizedQueries: new Map()
    };
    
    // Performance metrics
    this.metrics = {
      queryExecutionTimes: new Map(),
      cacheHitRates: new Map(),
      connectionPoolStats: new Map(),
      resourceUtilization: {
        memory: [],
        cpu: [],
        network: []
      },
      throughputMetrics: {
        requestsPerSecond: 0,
        averageResponseTime: 0,
        maxResponseTime: 0,
        minResponseTime: Infinity
      }
    };
    
    // Configuration
    this.config = {
      maxConnectionsPerPool: options.maxConnectionsPerPool || 10,
      connectionTimeout: options.connectionTimeout || 30000,
      queryTimeout: options.queryTimeout || 60000,
      batchSize: options.batchSize || 100,
      parallelism: options.parallelism || 5,
      resourceMonitoringInterval: options.resourceMonitoringInterval || 30000
    };
    
    // Start monitoring
    this.startPerformanceMonitoring();
  }

  /**
   * Optimize database queries with caching and connection pooling
   */
  async optimizeQuery(queryFn, queryKey, options = {}) {
    const startTime = Date.now();
    const correlationId = options.correlationId || this.generateCorrelationId();
    
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey('query', queryKey);
      let result = await this.cache.get(cacheKey);
      
      if (result) {
        this.metrics.queryExecutionTimes.set(queryKey, Date.now() - startTime);
        this.updateCacheHitRate(queryKey, true);
        return result;
      }
      
      // Optimize query if not cached
      const optimizedQuery = await this.getOptimizedQuery(queryFn, queryKey);
      
      // Execute with connection pooling
      result = await this.executeWithConnectionPool(optimizedQuery, options);
      
      // Cache result
      const ttl = this.calculateOptimalTTL(queryKey, result);
      await this.cache.set(cacheKey, result, ttl);
      
      // Update metrics
      const executionTime = Date.now() - startTime;
      this.metrics.queryExecutionTimes.set(queryKey, executionTime);
      this.updateCacheHitRate(queryKey, false);
      this.updateThroughputMetrics(executionTime);
      
      return result;
      
    } catch (error) {
      this.logger.error('Query optimization failed', error, {
        queryKey,
        correlationId,
        executionTime: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Batch process operations for better performance
   */
  async optimizeBatchProcessing(items, processFn, options = {}) {
    const batchSize = options.batchSize || this.config.batchSize;
    const maxParallelism = options.parallelism || this.config.parallelism;
    
    const batches = this.createBatches(items, batchSize);
    const results = [];
    
    // Process batches with controlled parallelism
    for (let i = 0; i < batches.length; i += maxParallelism) {
      const batchPromises = batches
        .slice(i, i + maxParallelism)
        .map(batch => this.processBatchWithOptimization(batch, processFn, options));
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Collect results and handle errors
      for (const batchResult of batchResults) {
        if (batchResult.status === 'fulfilled') {
          results.push(...batchResult.value);
        } else {
          this.logger.error('Batch processing failed', batchResult.reason, {
            batchIndex: results.length / batchSize
          });
        }
      }
    }
    
    return results;
  }

  /**
   * Process batch with optimization techniques
   */
  async processBatchWithOptimization(batch, processFn, options) {
    const startTime = Date.now();
    
    try {
      // Pre-warm cache if enabled
      if (options.preWarmCache) {
        await this.preWarmCacheForBatch(batch, options);
      }
      
      // Execute batch processing
      const results = await processFn(batch);
      
      // Post-process optimizations
      if (options.postProcessCache) {
        await this.postProcessCacheUpdates(batch, results, options);
      }
      
      // Update performance metrics
      const processingTime = Date.now() - startTime;
      this.updateBatchMetrics(batch.length, processingTime);
      
      return results;
      
    } catch (error) {
      this.logger.error('Batch optimization failed', error, {
        batchSize: batch.length,
        processingTime: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Optimize connection management
   */
  async getOptimizedConnection(service, options = {}) {
    const poolKey = `${service}-${options.region || 'default'}`;
    
    if (!this.connectionPools[service]) {
      this.connectionPools[service] = new Map();
    }
    
    let pool = this.connectionPools[service].get(poolKey);
    
    if (!pool) {
      pool = await this.createConnectionPool(service, options);
      this.connectionPools[service].set(poolKey, pool);
    }
    
    return await this.getConnectionFromPool(pool);
  }

  /**
   * Create optimized connection pool
   */
  async createConnectionPool(service, options) {
    const poolConfig = {
      service,
      maxConnections: options.maxConnections || this.config.maxConnectionsPerPool,
      timeout: options.timeout || this.config.connectionTimeout,
      region: options.region,
      credentials: options.credentials
    };
    
    const pool = {
      config: poolConfig,
      connections: [],
      activeConnections: 0,
      waitingQueue: [],
      metrics: {
        created: 0,
        destroyed: 0,
        acquired: 0,
        released: 0,
        timeouts: 0
      }
    };
    
    // Pre-create some connections
    const initialConnections = Math.min(2, poolConfig.maxConnections);
    for (let i = 0; i < initialConnections; i++) {
      const connection = await this.createConnection(service, options);
      pool.connections.push(connection);
      pool.metrics.created++;
    }
    
    return pool;
  }

  /**
   * Get connection from pool with optimization
   */
  async getConnectionFromPool(pool) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pool.metrics.timeouts++;
        reject(new Error('Connection pool timeout'));
      }, pool.config.timeout);
      
      // Try to get available connection
      const availableConnection = pool.connections.find(conn => !conn.busy);
      
      if (availableConnection) {
        clearTimeout(timeout);
        availableConnection.busy = true;
        pool.activeConnections++;
        pool.metrics.acquired++;
        resolve(availableConnection);
        return;
      }
      
      // Create new connection if under limit
      if (pool.connections.length < pool.config.maxConnections) {
        this.createConnection(pool.config.service, pool.config)
          .then(connection => {
            clearTimeout(timeout);
            connection.busy = true;
            pool.connections.push(connection);
            pool.activeConnections++;
            pool.metrics.created++;
            pool.metrics.acquired++;
            resolve(connection);
          })
          .catch(error => {
            clearTimeout(timeout);
            reject(error);
          });
        return;
      }
      
      // Add to waiting queue
      pool.waitingQueue.push({ resolve, reject, timeout });
    });
  }

  /**
   * Release connection back to pool
   */
  releaseConnection(pool, connection) {
    connection.busy = false;
    pool.activeConnections--;
    pool.metrics.released++;
    
    // Process waiting queue
    if (pool.waitingQueue.length > 0) {
      const { resolve, timeout } = pool.waitingQueue.shift();
      clearTimeout(timeout);
      connection.busy = true;
      pool.activeConnections++;
      pool.metrics.acquired++;
      resolve(connection);
    }
  }

  /**
   * Create service-specific connection
   */
  async createConnection(service, options) {
    switch (service) {
      case 'neptune':
        return this.createNeptuneConnection(options);
      case 's3':
        return this.createS3Connection(options);
      case 'lambda':
        return this.createLambdaConnection(options);
      default:
        throw new Error(`Unknown service: ${service}`);
    }
  }

  /**
   * Create optimized Neptune connection
   */
  async createNeptuneConnection(options) {
    const gremlin = require('gremlin');
    const { DriverRemoteConnection } = gremlin.driver;
    const { Graph } = gremlin.structure;
    
    const url = `wss://${options.endpoint}:${options.port || 8182}/gremlin`;
    const connection = new DriverRemoteConnection(url, {
      mimeType: 'application/vnd.gremlin-v2.0+json',
      pingEnabled: true,
      pingInterval: 30000,
      maxContentLength: 65536000, // 64MB
      traversalSource: 'g',
      ...options
    });
    
    const graph = new Graph();
    const g = graph.traversal().withRemote(connection);
    
    return {
      type: 'neptune',
      connection,
      graph,
      g,
      busy: false,
      created: Date.now(),
      lastUsed: Date.now()
    };
  }

  /**
   * Create optimized S3 connection
   */
  createS3Connection(options) {
    const AWS = require('aws-sdk');
    
    const s3 = new AWS.S3({
      maxRetries: 3,
      retryDelayOptions: { customBackoff: (retryCount) => Math.pow(2, retryCount) * 100 },
      httpOptions: {
        timeout: 120000,
        agent: new require('https').Agent({
          keepAlive: true,
          maxSockets: 50
        })
      },
      ...options
    });
    
    return {
      type: 's3',
      client: s3,
      busy: false,
      created: Date.now(),
      lastUsed: Date.now()
    };
  }

  /**
   * Create optimized Lambda connection
   */
  createLambdaConnection(options) {
    const AWS = require('aws-sdk');
    
    const lambda = new AWS.Lambda({
      maxRetries: 3,
      retryDelayOptions: { customBackoff: (retryCount) => Math.pow(2, retryCount) * 100 },
      httpOptions: {
        timeout: 300000, // 5 minutes
        agent: new require('https').Agent({
          keepAlive: true,
          maxSockets: 25
        })
      },
      ...options
    });
    
    return {
      type: 'lambda',
      client: lambda,
      busy: false,
      created: Date.now(),
      lastUsed: Date.now()
    };
  }

  /**
   * Execute query with connection pool
   */
  async executeWithConnectionPool(queryFn, options) {
    const service = options.service || 'neptune';
    const connection = await this.getOptimizedConnection(service, options);
    const pool = this.findPoolForConnection(service, connection);
    
    try {
      connection.lastUsed = Date.now();
      const result = await queryFn(connection);
      return result;
    } finally {
      this.releaseConnection(pool, connection);
    }
  }

  /**
   * Find pool for connection
   */
  findPoolForConnection(service, connection) {
    const servicePools = this.connectionPools[service];
    if (!servicePools) return null;
    
    for (const [poolKey, pool] of servicePools.entries()) {
      if (pool.connections.includes(connection)) {
        return pool;
      }
    }
    return null;
  }

  /**
   * Get optimized query execution plan
   */
  async getOptimizedQuery(queryFn, queryKey) {
    // Check if we have an optimized version
    if (this.queryOptimizer.optimizedQueries.has(queryKey)) {
      return this.queryOptimizer.optimizedQueries.get(queryKey);
    }
    
    // Analyze query and create optimization
    const optimizedQuery = await this.analyzeAndOptimizeQuery(queryFn, queryKey);
    this.queryOptimizer.optimizedQueries.set(queryKey, optimizedQuery);
    
    return optimizedQuery;
  }

  /**
   * Analyze and optimize query
   */
  async analyzeAndOptimizeQuery(queryFn, queryKey) {
    // This is a simplified optimization - in practice, this would be much more complex
    return async (connection) => {
      // Add query timeout
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), this.config.queryTimeout)
      );
      
      // Execute with timeout
      return Promise.race([queryFn(connection), timeout]);
    };
  }

  /**
   * Calculate optimal TTL for cached results
   */
  calculateOptimalTTL(queryKey, result) {
    const baseTTL = 300000; // 5 minutes
    
    // Adjust TTL based on result size and access patterns
    const resultSize = JSON.stringify(result).length;
    const sizeMultiplier = resultSize > 10000 ? 1.5 : 1.0;
    
    // Check access frequency
    const accessCount = this.metrics.queryExecutionTimes.get(queryKey) || 0;
    const frequencyMultiplier = accessCount > 10 ? 2.0 : 1.0;
    
    return Math.floor(baseTTL * sizeMultiplier * frequencyMultiplier);
  }

  /**
   * Create batches from items
   */
  createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Pre-warm cache for batch processing
   */
  async preWarmCacheForBatch(batch, options) {
    const cacheKeys = batch.map(item => this.generateCacheKey('batch-item', item.id || item));
    
    // Check which items are already cached
    const cachedItems = await Promise.allSettled(
      cacheKeys.map(key => this.cache.get(key))
    );
    
    // Log cache warm-up statistics
    const hitCount = cachedItems.filter(result => result.status === 'fulfilled' && result.value).length;
    this.logger.debug('Cache pre-warm completed', {
      batchSize: batch.length,
      cacheHits: hitCount,
      hitRatio: (hitCount / batch.length * 100).toFixed(2) + '%'
    });
  }

  /**
   * Post-process cache updates after batch processing
   */
  async postProcessCacheUpdates(batch, results, options) {
    if (!results || results.length !== batch.length) return;
    
    const cachePromises = results.map((result, index) => {
      const item = batch[index];
      const cacheKey = this.generateCacheKey('batch-result', item.id || item);
      const ttl = this.calculateOptimalTTL(cacheKey, result);
      return this.cache.set(cacheKey, result, ttl);
    });
    
    await Promise.allSettled(cachePromises);
  }

  /**
   * Update performance metrics
   */
  updateThroughputMetrics(responseTime) {
    const metrics = this.metrics.throughputMetrics;
    
    metrics.requestsPerSecond = this.calculateRequestsPerSecond();
    metrics.averageResponseTime = this.calculateAverageResponseTime(responseTime);
    metrics.maxResponseTime = Math.max(metrics.maxResponseTime, responseTime);
    metrics.minResponseTime = Math.min(metrics.minResponseTime, responseTime);
  }

  /**
   * Update cache hit rate
   */
  updateCacheHitRate(queryKey, isHit) {
    if (!this.metrics.cacheHitRates.has(queryKey)) {
      this.metrics.cacheHitRates.set(queryKey, { hits: 0, misses: 0 });
    }
    
    const stats = this.metrics.cacheHitRates.get(queryKey);
    if (isHit) {
      stats.hits++;
    } else {
      stats.misses++;
    }
  }

  /**
   * Update batch processing metrics
   */
  updateBatchMetrics(batchSize, processingTime) {
    const throughput = batchSize / (processingTime / 1000); // items per second
    
    this.logger.debug('Batch processing metrics', {
      batchSize,
      processingTime,
      throughput: throughput.toFixed(2) + ' items/sec'
    });
  }

  /**
   * Start performance monitoring
   */
  startPerformanceMonitoring() {
    setInterval(() => {
      this.collectResourceMetrics();
      this.cleanupStaleConnections();
      this.optimizeCachePolicies();
    }, this.config.resourceMonitoringInterval);
  }

  /**
   * Collect resource utilization metrics
   */
  collectResourceMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    this.metrics.resourceUtilization.memory.push({
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external
    });
    
    this.metrics.resourceUtilization.cpu.push({
      timestamp: Date.now(),
      user: cpuUsage.user,
      system: cpuUsage.system
    });
    
    // Keep only last 100 measurements
    ['memory', 'cpu'].forEach(metric => {
      if (this.metrics.resourceUtilization[metric].length > 100) {
        this.metrics.resourceUtilization[metric].shift();
      }
    });
  }

  /**
   * Cleanup stale connections
   */
  cleanupStaleConnections() {
    const maxIdleTime = 300000; // 5 minutes
    const now = Date.now();
    
    for (const [service, servicePools] of Object.entries(this.connectionPools)) {
      for (const [poolKey, pool] of servicePools.entries()) {
        pool.connections = pool.connections.filter(conn => {
          const isStale = !conn.busy && (now - conn.lastUsed) > maxIdleTime;
          if (isStale) {
            this.destroyConnection(conn);
            pool.metrics.destroyed++;
          }
          return !isStale;
        });
      }
    }
  }

  /**
   * Optimize cache policies based on usage patterns
   */
  optimizeCachePolicies() {
    // Analyze cache hit rates and adjust policies
    for (const [queryKey, stats] of this.metrics.cacheHitRates.entries()) {
      const total = stats.hits + stats.misses;
      const hitRate = total > 0 ? stats.hits / total : 0;
      
      if (hitRate < 0.3 && total > 10) {
        // Low hit rate - consider shorter TTL or different caching strategy
        this.logger.debug('Low cache hit rate detected', {
          queryKey,
          hitRate: (hitRate * 100).toFixed(2) + '%',
          recommendation: 'Consider shorter TTL or query optimization'
        });
      }
    }
  }

  /**
   * Destroy connection
   */
  destroyConnection(connection) {
    try {
      if (connection.type === 'neptune' && connection.connection) {
        connection.connection.close();
      }
      // Other connection types don't need explicit cleanup
    } catch (error) {
      this.logger.warn('Error destroying connection', { error: error.message });
    }
  }

  /**
   * Generate cache key
   */
  generateCacheKey(prefix, identifier) {
    return `${prefix}:${typeof identifier === 'object' ? JSON.stringify(identifier) : identifier}`;
  }

  /**
   * Generate correlation ID
   */
  generateCorrelationId() {
    return `perf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate requests per second
   */
  calculateRequestsPerSecond() {
    // Simplified calculation - would be more sophisticated in practice
    return 0; // Placeholder
  }

  /**
   * Calculate average response time
   */
  calculateAverageResponseTime(newTime) {
    // Simplified calculation - would use moving average in practice
    return newTime; // Placeholder
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    const stats = {
      cache: this.cache.getStats ? this.cache.getStats() : {},
      queries: Object.fromEntries(this.metrics.queryExecutionTimes),
      cacheHitRates: {},
      connectionPools: {},
      throughput: this.metrics.throughputMetrics,
      resourceUtilization: this.metrics.resourceUtilization
    };
    
    // Process cache hit rates
    for (const [key, rates] of this.metrics.cacheHitRates.entries()) {
      const total = rates.hits + rates.misses;
      stats.cacheHitRates[key] = {
        ...rates,
        hitRate: total > 0 ? (rates.hits / total * 100).toFixed(2) + '%' : '0%'
      };
    }
    
    // Process connection pool stats
    for (const [service, servicePools] of Object.entries(this.connectionPools)) {
      stats.connectionPools[service] = {};
      for (const [poolKey, pool] of servicePools.entries()) {
        stats.connectionPools[service][poolKey] = {
          totalConnections: pool.connections.length,
          activeConnections: pool.activeConnections,
          waitingQueue: pool.waitingQueue.length,
          metrics: pool.metrics
        };
      }
    }
    
    return stats;
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown() {
    // Close all connections
    for (const [service, servicePools] of Object.entries(this.connectionPools)) {
      for (const [poolKey, pool] of servicePools.entries()) {
        for (const connection of pool.connections) {
          this.destroyConnection(connection);
        }
      }
    }
    
    // Close Redis connection
    if (this.cache.redisClient) {
      await this.cache.redisClient.quit();
    }
    
    this.emit('shutdown');
  }
}

module.exports = { PerformanceOptimizer };
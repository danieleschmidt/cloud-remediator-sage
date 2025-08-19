/**
 * Advanced Cache Manager - Generation 3 Enhancement
 * Implements intelligent multi-tier caching with adaptive algorithms
 */

const { StructuredLogger } = require('../monitoring/logger');
const CacheManager = require('./CacheManager');

class AdvancedCacheManager extends CacheManager {
  constructor(options = {}) {
    super(options);
    
    this.logger = new StructuredLogger('advanced-cache-manager');
    
    this.advancedOptions = {
      enablePredictivePreloading: options.enablePredictivePreloading !== false,
      enableAdaptiveExpiration: options.enableAdaptiveExpiration !== false,
      enableIntelligentEviction: options.enableIntelligentEviction !== false,
      enableCacheWarming: options.enableCacheWarming !== false,
      mlModelEndpoint: options.mlModelEndpoint,
      predictionThreshold: options.predictionThreshold || 0.7,
      warmupBatchSize: options.warmupBatchSize || 50,
      ...options
    };

    // Advanced cache analytics
    this.accessPatterns = new Map();
    this.predictionCache = new Map();
    this.warmupQueue = [];
    this.adaptiveMetrics = {
      hitRateTrend: [],
      accessFrequency: new Map(),
      temporalPatterns: new Map(),
      evictionEfficiency: 0
    };

    this.initialize();
  }

  /**
   * Initialize advanced caching features
   */
  initialize() {
    this.logger.info('Initializing advanced cache manager');

    if (this.advancedOptions.enablePredictivePreloading) {
      this.setupPredictivePreloading();
    }

    if (this.advancedOptions.enableAdaptiveExpiration) {
      this.setupAdaptiveExpiration();
    }

    if (this.advancedOptions.enableIntelligentEviction) {
      this.setupIntelligentEviction();
    }

    if (this.advancedOptions.enableCacheWarming) {
      this.setupCacheWarming();
    }

    // Start analytics collection
    this.startAnalyticsCollection();
  }

  /**
   * Enhanced get with predictive preloading
   */
  async get(key, options = {}) {
    const startTime = Date.now();
    
    // Record access pattern
    this.recordAccessPattern(key);
    
    // Try to get from cache
    let result = await super.get(key, options);
    
    if (result !== null) {
      // Cache hit - trigger predictive preloading
      if (this.advancedOptions.enablePredictivePreloading) {
        await this.triggerPredictivePreloading(key);
      }
      
      this.updateAdaptiveMetrics('hit', key, Date.now() - startTime);
      return result;
    }
    
    // Cache miss
    this.updateAdaptiveMetrics('miss', key, Date.now() - startTime);
    
    // If we have a generator function, use it
    if (options.generator && typeof options.generator === 'function') {
      result = await options.generator();
      
      // Store with adaptive TTL
      const adaptiveTTL = this.calculateAdaptiveTTL(key);
      await this.set(key, result, { ttl: adaptiveTTL });
      
      return result;
    }
    
    return null;
  }

  /**
   * Enhanced set with intelligent optimization
   */
  async set(key, value, options = {}) {
    // Apply adaptive expiration if enabled
    if (this.advancedOptions.enableAdaptiveExpiration && !options.ttl) {
      options.ttl = this.calculateAdaptiveTTL(key);
    }

    // Apply intelligent compression for large values
    if (this.shouldCompress(value)) {
      value = await this.compressValue(value);
      options.compressed = true;
    }

    // Store with enhanced metadata
    const enhancedOptions = {
      ...options,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccess: Date.now(),
      priority: this.calculatePriority(key, value)
    };

    const result = await super.set(key, value, enhancedOptions);
    
    // Update access patterns
    this.updateAccessFrequency(key);
    
    return result;
  }

  /**
   * Setup predictive preloading
   */
  setupPredictivePreloading() {
    this.logger.info('Setting up predictive preloading');

    // Analyze access patterns every 5 minutes
    setInterval(() => {
      this.analyzeAccessPatterns();
    }, 300000);

    // Execute predictions every 2 minutes
    setInterval(() => {
      this.executePredictivePreloading();
    }, 120000);
  }

  /**
   * Trigger predictive preloading for related keys
   */
  async triggerPredictivePreloading(accessedKey) {
    try {
      const predictions = await this.generatePredictions(accessedKey);
      
      for (const prediction of predictions) {
        if (prediction.confidence > this.advancedOptions.predictionThreshold) {
          // Check if key is not already cached
          const exists = await this.has(prediction.key);
          if (!exists) {
            this.warmupQueue.push({
              key: prediction.key,
              confidence: prediction.confidence,
              reason: 'predictive_preloading',
              timestamp: Date.now()
            });
          }
        }
      }
    } catch (error) {
      this.logger.error('Predictive preloading failed', { error: error.message });
    }
  }

  /**
   * Generate predictions based on access patterns
   */
  async generatePredictions(accessedKey) {
    const predictions = [];
    
    // Pattern-based predictions
    const patterns = this.accessPatterns.get(accessedKey) || [];
    for (const pattern of patterns) {
      if (pattern.relatedKeys) {
        for (const relatedKey of pattern.relatedKeys) {
          predictions.push({
            key: relatedKey,
            confidence: pattern.confidence || 0.6,
            method: 'pattern_based'
          });
        }
      }
    }

    // Temporal predictions
    const temporalPredictions = this.generateTemporalPredictions(accessedKey);
    predictions.push(...temporalPredictions);

    // ML-based predictions (if endpoint available)
    if (this.advancedOptions.mlModelEndpoint) {
      const mlPredictions = await this.generateMLPredictions(accessedKey);
      predictions.push(...mlPredictions);
    }

    return predictions.filter(p => p.confidence > 0.5);
  }

  /**
   * Generate temporal-based predictions
   */
  generateTemporalPredictions(accessedKey) {
    const predictions = [];
    const now = Date.now();
    const hour = new Date(now).getHours();
    const dayOfWeek = new Date(now).getDay();
    
    // Check historical patterns for this time
    const temporalKey = `${hour}-${dayOfWeek}`;
    const temporalPattern = this.adaptiveMetrics.temporalPatterns.get(temporalKey);
    
    if (temporalPattern && temporalPattern.frequentKeys) {
      for (const [key, frequency] of temporalPattern.frequentKeys) {
        if (key !== accessedKey && frequency > 0.3) {
          predictions.push({
            key,
            confidence: frequency,
            method: 'temporal_based'
          });
        }
      }
    }

    return predictions;
  }

  /**
   * Generate ML-based predictions
   */
  async generateMLPredictions(accessedKey) {
    try {
      // Prepare features for ML model
      const features = {
        accessedKey,
        currentHour: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
        recentAccessPattern: Array.from(this.accessPatterns.keys()).slice(-10),
        cacheHitRate: this.calculateCurrentHitRate(),
        systemLoad: this.getSystemLoadMetrics()
      };

      // Call ML prediction endpoint
      const response = await fetch(this.advancedOptions.mlModelEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features })
      });

      if (response.ok) {
        const predictions = await response.json();
        return predictions.map(p => ({
          key: p.key,
          confidence: p.confidence,
          method: 'ml_based'
        }));
      }
    } catch (error) {
      this.logger.warn('ML prediction failed', { error: error.message });
    }

    return [];
  }

  /**
   * Setup adaptive expiration
   */
  setupAdaptiveExpiration() {
    this.logger.info('Setting up adaptive expiration');

    // Recalculate TTLs every 10 minutes
    setInterval(() => {
      this.recalculateAdaptiveTTLs();
    }, 600000);
  }

  /**
   * Calculate adaptive TTL based on access patterns
   */
  calculateAdaptiveTTL(key) {
    const baselineTTL = this.defaultTTL || 300000; // 5 minutes
    
    // Get access frequency
    const frequency = this.adaptiveMetrics.accessFrequency.get(key) || 0;
    
    // Get temporal stability
    const stability = this.calculateTemporalStability(key);
    
    // Calculate adaptive multiplier
    let multiplier = 1;
    
    // High frequency items get longer TTL
    if (frequency > 10) multiplier *= 2;
    else if (frequency > 5) multiplier *= 1.5;
    
    // Stable items get longer TTL
    if (stability > 0.8) multiplier *= 1.8;
    else if (stability > 0.6) multiplier *= 1.3;
    
    // Apply system load factor
    const systemLoad = this.getSystemLoadMetrics();
    if (systemLoad.memoryUsage > 0.8) multiplier *= 0.7; // Shorter TTL under memory pressure
    if (systemLoad.cpuUsage > 0.8) multiplier *= 0.8; // Shorter TTL under CPU pressure
    
    return Math.max(baselineTTL * multiplier, 60000); // Minimum 1 minute
  }

  /**
   * Calculate temporal stability of a key
   */
  calculateTemporalStability(key) {
    const patterns = this.accessPatterns.get(key) || [];
    if (patterns.length < 5) return 0.5; // Not enough data
    
    // Calculate variance in access intervals
    const intervals = [];
    for (let i = 1; i < patterns.length; i++) {
      intervals.push(patterns[i].timestamp - patterns[i-1].timestamp);
    }
    
    if (intervals.length === 0) return 0.5;
    
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => {
      return sum + Math.pow(interval - mean, 2);
    }, 0) / intervals.length;
    
    const coefficient = Math.sqrt(variance) / mean;
    
    // Lower coefficient of variation = higher stability
    return Math.max(0, 1 - coefficient);
  }

  /**
   * Setup intelligent eviction
   */
  setupIntelligentEviction() {
    this.logger.info('Setting up intelligent eviction');

    // Override default eviction with intelligent algorithm
    this.originalEvict = this.evict.bind(this);
    this.evict = this.intelligentEvict.bind(this);
  }

  /**
   * Intelligent eviction based on multiple factors
   */
  async intelligentEvict(targetSize = null) {
    const candidates = await this.getEvictionCandidates();
    
    // Score each candidate
    const scoredCandidates = candidates.map(candidate => ({
      ...candidate,
      score: this.calculateEvictionScore(candidate)
    }));

    // Sort by score (lower score = better candidate for eviction)
    scoredCandidates.sort((a, b) => a.score - b.score);

    // Evict candidates until we reach target size
    let evicted = 0;
    const targetCount = targetSize || Math.floor(candidates.length * 0.1); // Evict 10% by default

    for (const candidate of scoredCandidates) {
      if (evicted >= targetCount) break;
      
      await super.delete(candidate.key);
      evicted++;
      
      this.logger.debug('Intelligent eviction', {
        key: candidate.key,
        score: candidate.score,
        reason: this.getEvictionReason(candidate)
      });
    }

    this.adaptiveMetrics.evictionEfficiency = this.calculateEvictionEfficiency(scoredCandidates.slice(0, evicted));
    
    return evicted;
  }

  /**
   * Calculate eviction score (lower = more likely to evict)
   */
  calculateEvictionScore(candidate) {
    let score = 100; // Base score
    
    // Factor 1: Access frequency (lower frequency = lower score)
    const frequency = this.adaptiveMetrics.accessFrequency.get(candidate.key) || 0;
    score += frequency * 10;
    
    // Factor 2: Recency (older = lower score)
    const timeSinceAccess = Date.now() - (candidate.lastAccess || 0);
    score -= timeSinceAccess / 1000; // Subtract seconds since last access
    
    // Factor 3: Size (larger items preferred for eviction)
    const size = candidate.size || 0;
    score -= size / 1000; // Subtract KB
    
    // Factor 4: TTL remaining (items about to expire = lower score)
    const ttlRemaining = (candidate.expiry || Date.now()) - Date.now();
    score += ttlRemaining / 1000;
    
    // Factor 5: Priority (higher priority = higher score)
    score += (candidate.priority || 0) * 20;
    
    return Math.max(0, score);
  }

  /**
   * Setup cache warming
   */
  setupCacheWarming() {
    this.logger.info('Setting up cache warming');

    // Process warmup queue every 30 seconds
    setInterval(() => {
      this.processWarmupQueue();
    }, 30000);

    // Schedule periodic cache warming
    setInterval(() => {
      this.schedulePeriodicWarming();
    }, 1800000); // Every 30 minutes
  }

  /**
   * Process warmup queue
   */
  async processWarmupQueue() {
    if (this.warmupQueue.length === 0) return;

    const batch = this.warmupQueue.splice(0, this.advancedOptions.warmupBatchSize);
    
    this.logger.info('Processing cache warmup batch', { 
      batchSize: batch.length,
      queueRemaining: this.warmupQueue.length 
    });

    for (const item of batch) {
      try {
        await this.warmupCacheItem(item);
      } catch (error) {
        this.logger.error('Cache warmup failed for item', { 
          key: item.key, 
          error: error.message 
        });
      }
    }
  }

  /**
   * Warmup individual cache item
   */
  async warmupCacheItem(item) {
    // Check if item is still needed
    if (Date.now() - item.timestamp > 300000) { // 5 minutes old
      return; // Skip old warmup requests
    }

    // Try to generate the value
    if (item.generator && typeof item.generator === 'function') {
      const value = await item.generator();
      const ttl = this.calculateAdaptiveTTL(item.key);
      await this.set(item.key, value, { ttl, warmed: true });
      
      this.logger.debug('Cache item warmed', { 
        key: item.key,
        confidence: item.confidence,
        reason: item.reason 
      });
    }
  }

  /**
   * Record access pattern for analytics
   */
  recordAccessPattern(key) {
    if (!this.accessPatterns.has(key)) {
      this.accessPatterns.set(key, []);
    }
    
    const patterns = this.accessPatterns.get(key);
    patterns.push({
      timestamp: Date.now(),
      hour: new Date().getHours(),
      dayOfWeek: new Date().getDay()
    });

    // Keep only last 100 access records per key
    if (patterns.length > 100) {
      patterns.shift();
    }

    // Update temporal patterns
    this.updateTemporalPatterns(key);
  }

  /**
   * Update temporal patterns
   */
  updateTemporalPatterns(key) {
    const now = new Date();
    const temporalKey = `${now.getHours()}-${now.getDay()}`;
    
    if (!this.adaptiveMetrics.temporalPatterns.has(temporalKey)) {
      this.adaptiveMetrics.temporalPatterns.set(temporalKey, {
        frequentKeys: new Map(),
        totalAccesses: 0
      });
    }
    
    const pattern = this.adaptiveMetrics.temporalPatterns.get(temporalKey);
    pattern.frequentKeys.set(key, (pattern.frequentKeys.get(key) || 0) + 1);
    pattern.totalAccesses++;
  }

  /**
   * Update adaptive metrics
   */
  updateAdaptiveMetrics(type, key, responseTime) {
    // Update hit rate trend
    const isHit = type === 'hit';
    this.adaptiveMetrics.hitRateTrend.push({
      timestamp: Date.now(),
      hit: isHit,
      responseTime
    });

    // Keep only last 1000 entries
    if (this.adaptiveMetrics.hitRateTrend.length > 1000) {
      this.adaptiveMetrics.hitRateTrend.shift();
    }

    // Update access frequency
    if (isHit) {
      this.updateAccessFrequency(key);
    }
  }

  /**
   * Update access frequency
   */
  updateAccessFrequency(key) {
    const current = this.adaptiveMetrics.accessFrequency.get(key) || 0;
    this.adaptiveMetrics.accessFrequency.set(key, current + 1);
  }

  /**
   * Calculate current hit rate
   */
  calculateCurrentHitRate() {
    const recentTrend = this.adaptiveMetrics.hitRateTrend.slice(-100); // Last 100 operations
    if (recentTrend.length === 0) return 0;
    
    const hits = recentTrend.filter(entry => entry.hit).length;
    return hits / recentTrend.length;
  }

  /**
   * Get system load metrics
   */
  getSystemLoadMetrics() {
    const memUsage = process.memoryUsage();
    const totalMem = require('os').totalmem();
    
    return {
      memoryUsage: memUsage.heapUsed / totalMem,
      cpuUsage: process.cpuUsage().user / 1000000, // Convert to percentage approximation
      heapUsage: memUsage.heapUsed / memUsage.heapTotal
    };
  }

  /**
   * Start analytics collection
   */
  startAnalyticsCollection() {
    setInterval(() => {
      this.collectAnalytics();
    }, 60000); // Every minute
  }

  /**
   * Collect and analyze cache analytics
   */
  collectAnalytics() {
    const analytics = {
      timestamp: Date.now(),
      hitRate: this.calculateCurrentHitRate(),
      totalKeys: this.size(),
      avgResponseTime: this.calculateAverageResponseTime(),
      systemLoad: this.getSystemLoadMetrics(),
      topAccessedKeys: this.getTopAccessedKeys(10),
      temporalDistribution: this.getTemporalDistribution(),
      evictionEfficiency: this.adaptiveMetrics.evictionEfficiency
    };

    this.logger.debug('Cache analytics collected', analytics);
    
    // Store analytics for trend analysis
    this.storeAnalytics(analytics);
  }

  /**
   * Calculate average response time
   */
  calculateAverageResponseTime() {
    const recentTrend = this.adaptiveMetrics.hitRateTrend.slice(-100);
    if (recentTrend.length === 0) return 0;
    
    const totalTime = recentTrend.reduce((sum, entry) => sum + entry.responseTime, 0);
    return totalTime / recentTrend.length;
  }

  /**
   * Get top accessed keys
   */
  getTopAccessedKeys(limit = 10) {
    const sortedKeys = Array.from(this.adaptiveMetrics.accessFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
    
    return sortedKeys.map(([key, frequency]) => ({ key, frequency }));
  }

  /**
   * Get temporal distribution of accesses
   */
  getTemporalDistribution() {
    const distribution = {};
    
    for (const [temporalKey, pattern] of this.adaptiveMetrics.temporalPatterns) {
      distribution[temporalKey] = pattern.totalAccesses;
    }
    
    return distribution;
  }

  /**
   * Get comprehensive cache performance report
   */
  getPerformanceReport() {
    return {
      basicMetrics: super.getMetrics(),
      advancedMetrics: {
        hitRateTrend: this.adaptiveMetrics.hitRateTrend.slice(-50), // Last 50 operations
        accessFrequency: this.getTopAccessedKeys(20),
        temporalPatterns: this.getTemporalDistribution(),
        evictionEfficiency: this.adaptiveMetrics.evictionEfficiency,
        systemLoad: this.getSystemLoadMetrics(),
        predictiveStats: {
          warmupQueueSize: this.warmupQueue.length,
          predictionCacheSize: this.predictionCache.size
        }
      },
      recommendations: this.generateOptimizationRecommendations(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate optimization recommendations
   */
  generateOptimizationRecommendations() {
    const recommendations = [];
    const hitRate = this.calculateCurrentHitRate();
    const avgResponseTime = this.calculateAverageResponseTime();
    const systemLoad = this.getSystemLoadMetrics();

    // Hit rate recommendations
    if (hitRate < 0.7) {
      recommendations.push({
        type: 'hit_rate',
        priority: 'high',
        message: 'Consider increasing cache size or improving cache key strategies',
        metric: hitRate
      });
    }

    // Response time recommendations
    if (avgResponseTime > 50) {
      recommendations.push({
        type: 'response_time',
        priority: 'medium',
        message: 'Consider optimizing cache storage or using faster storage tiers',
        metric: avgResponseTime
      });
    }

    // Memory recommendations
    if (systemLoad.memoryUsage > 0.85) {
      recommendations.push({
        type: 'memory',
        priority: 'high',
        message: 'Consider more aggressive eviction or compression strategies',
        metric: systemLoad.memoryUsage
      });
    }

    // Predictive recommendations
    if (this.warmupQueue.length > 100) {
      recommendations.push({
        type: 'predictive',
        priority: 'medium',
        message: 'Consider increasing warmup batch size or processing frequency',
        metric: this.warmupQueue.length
      });
    }

    return recommendations;
  }
}

module.exports = AdvancedCacheManager;
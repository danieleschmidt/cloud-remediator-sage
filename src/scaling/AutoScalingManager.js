/**
 * Auto-Scaling Manager for Cloud Remediator Sage
 * Implements intelligent scaling decisions based on performance metrics and predictive analytics
 */

const { EventEmitter } = require('events');
const { StructuredLogger } = require('../monitoring/logger');

class AutoScalingManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.logger = new StructuredLogger('autoscaling-manager');
    this.options = {
      // Scaling thresholds
      scaleUpThresholds: {
        cpuUtilization: 70,          // Scale up when CPU > 70%
        memoryUtilization: 80,       // Scale up when memory > 80%
        responseTime: 5000,          // Scale up when response time > 5s
        errorRate: 0.05,             // Scale up when error rate > 5%
        queueDepth: 100,             // Scale up when queue > 100 items
        throughput: 1000             // Scale up when throughput > 1000 req/min
      },
      scaleDownThresholds: {
        cpuUtilization: 30,          // Scale down when CPU < 30%
        memoryUtilization: 40,       // Scale down when memory < 40%
        responseTime: 1000,          // Scale down when response time < 1s
        errorRate: 0.01,             // Scale down when error rate < 1%
        queueDepth: 10,              // Scale down when queue < 10 items
        throughput: 100              // Scale down when throughput < 100 req/min
      },
      // Scaling policies
      minInstances: options.minInstances || 1,
      maxInstances: options.maxInstances || 10,
      scaleUpCooldown: options.scaleUpCooldown || 300000,   // 5 minutes
      scaleDownCooldown: options.scaleDownCooldown || 600000, // 10 minutes
      evaluationPeriods: options.evaluationPeriods || 3,
      dataPointsToEvaluate: options.dataPointsToEvaluate || 5,
      // Predictive scaling
      enablePredictiveScaling: options.enablePredictiveScaling !== false,
      predictionHorizon: options.predictionHorizon || 1800000, // 30 minutes
      confidenceThreshold: options.confidenceThreshold || 0.8,
      ...options
    };

    // Internal state
    this.currentInstances = this.options.minInstances;
    this.lastScaleUpTime = 0;
    this.lastScaleDownTime = 0;
    this.metrics = new Map();
    this.scalingHistory = [];
    this.predictiveModel = new Map();
    this.isScaling = false;
    
    // Performance tracking
    this.performanceBuffer = [];
    this.bufferSize = 100;
    
    this.initialize();
  }

  /**
   * Initialize auto-scaling manager
   */
  async initialize() {
    this.logger.info('Initializing Auto-Scaling Manager');

    // Load historical scaling data
    await this.loadHistoricalData();

    // Start performance monitoring
    this.startPerformanceMonitoring();

    // Start predictive analysis
    if (this.options.enablePredictiveScaling) {
      this.startPredictiveAnalysis();
    }

    // Start scaling evaluation
    this.startScalingEvaluation();

    this.logger.info('Auto-Scaling Manager initialized successfully', {
      minInstances: this.options.minInstances,
      maxInstances: this.options.maxInstances,
      currentInstances: this.currentInstances
    });
  }

  /**
   * Evaluate scaling decision based on current metrics
   */
  async evaluateScaling(metrics = {}) {
    if (this.isScaling) {
      this.logger.debug('Scaling operation in progress, skipping evaluation');
      return;
    }

    try {
      const scalingDecision = await this.makeScalingDecision(metrics);
      
      if (scalingDecision.action !== 'none') {
        this.logger.info('Scaling decision made', scalingDecision);
        await this.executeScaling(scalingDecision);
      }

    } catch (error) {
      this.logger.error('Scaling evaluation failed', { error: error.message });
    }
  }

  /**
   * Make intelligent scaling decision based on multiple factors
   */
  async makeScalingDecision(metrics) {
    const decision = {
      action: 'none',
      targetInstances: this.currentInstances,
      reason: 'No scaling needed',
      confidence: 0,
      predictive: false,
      metrics: metrics
    };

    // Evaluate current performance metrics
    const currentEvaluation = this.evaluateCurrentMetrics(metrics);
    
    // Evaluate predictive metrics if enabled
    let predictiveEvaluation = null;
    if (this.options.enablePredictiveScaling) {
      predictiveEvaluation = await this.evaluatePredictiveMetrics();
    }

    // Combine evaluations to make final decision
    const finalDecision = this.combineEvaluations(currentEvaluation, predictiveEvaluation);

    // Apply cooldown and boundary checks
    const validatedDecision = this.validateScalingDecision(finalDecision);

    return validatedDecision;
  }

  /**
   * Evaluate current performance metrics
   */
  evaluateCurrentMetrics(metrics) {
    const evaluation = {
      scaleUp: { score: 0, reasons: [] },
      scaleDown: { score: 0, reasons: [] }
    };

    // CPU utilization evaluation
    if (metrics.cpuUtilization !== undefined) {
      if (metrics.cpuUtilization > this.options.scaleUpThresholds.cpuUtilization) {
        evaluation.scaleUp.score += 25;
        evaluation.scaleUp.reasons.push(`High CPU utilization: ${metrics.cpuUtilization}%`);
      } else if (metrics.cpuUtilization < this.options.scaleDownThresholds.cpuUtilization) {
        evaluation.scaleDown.score += 20;
        evaluation.scaleDown.reasons.push(`Low CPU utilization: ${metrics.cpuUtilization}%`);
      }
    }

    // Memory utilization evaluation
    if (metrics.memoryUtilization !== undefined) {
      if (metrics.memoryUtilization > this.options.scaleUpThresholds.memoryUtilization) {
        evaluation.scaleUp.score += 30;
        evaluation.scaleUp.reasons.push(`High memory utilization: ${metrics.memoryUtilization}%`);
      } else if (metrics.memoryUtilization < this.options.scaleDownThresholds.memoryUtilization) {
        evaluation.scaleDown.score += 25;
        evaluation.scaleDown.reasons.push(`Low memory utilization: ${metrics.memoryUtilization}%`);
      }
    }

    // Response time evaluation
    if (metrics.responseTime !== undefined) {
      if (metrics.responseTime > this.options.scaleUpThresholds.responseTime) {
        evaluation.scaleUp.score += 35;
        evaluation.scaleUp.reasons.push(`High response time: ${metrics.responseTime}ms`);
      } else if (metrics.responseTime < this.options.scaleDownThresholds.responseTime) {
        evaluation.scaleDown.score += 15;
        evaluation.scaleDown.reasons.push(`Low response time: ${metrics.responseTime}ms`);
      }
    }

    // Error rate evaluation
    if (metrics.errorRate !== undefined) {
      if (metrics.errorRate > this.options.scaleUpThresholds.errorRate) {
        evaluation.scaleUp.score += 40;
        evaluation.scaleUp.reasons.push(`High error rate: ${(metrics.errorRate * 100).toFixed(2)}%`);
      } else if (metrics.errorRate < this.options.scaleDownThresholds.errorRate) {
        evaluation.scaleDown.score += 10;
        evaluation.scaleDown.reasons.push(`Low error rate: ${(metrics.errorRate * 100).toFixed(2)}%`);
      }
    }

    // Queue depth evaluation
    if (metrics.queueDepth !== undefined) {
      if (metrics.queueDepth > this.options.scaleUpThresholds.queueDepth) {
        evaluation.scaleUp.score += 30;
        evaluation.scaleUp.reasons.push(`High queue depth: ${metrics.queueDepth}`);
      } else if (metrics.queueDepth < this.options.scaleDownThresholds.queueDepth) {
        evaluation.scaleDown.score += 15;
        evaluation.scaleDown.reasons.push(`Low queue depth: ${metrics.queueDepth}`);
      }
    }

    // Throughput evaluation
    if (metrics.throughput !== undefined) {
      if (metrics.throughput > this.options.scaleUpThresholds.throughput) {
        evaluation.scaleUp.score += 20;
        evaluation.scaleUp.reasons.push(`High throughput: ${metrics.throughput} req/min`);
      } else if (metrics.throughput < this.options.scaleDownThresholds.throughput) {
        evaluation.scaleDown.score += 20;
        evaluation.scaleDown.reasons.push(`Low throughput: ${metrics.throughput} req/min`);
      }
    }

    return evaluation;
  }

  /**
   * Evaluate predictive metrics for proactive scaling
   */
  async evaluatePredictiveMetrics() {
    if (!this.options.enablePredictiveScaling) {
      return null;
    }

    const prediction = await this.generateLoadPrediction();
    
    if (prediction.confidence < this.options.confidenceThreshold) {
      return null;
    }

    const evaluation = {
      scaleUp: { score: 0, reasons: [] },
      scaleDown: { score: 0, reasons: [] },
      predictive: true,
      confidence: prediction.confidence
    };

    // Evaluate predicted load increase
    if (prediction.expectedLoadIncrease > 0.3) { // 30% increase
      evaluation.scaleUp.score += Math.round(prediction.expectedLoadIncrease * 50);
      evaluation.scaleUp.reasons.push(`Predicted load increase: ${(prediction.expectedLoadIncrease * 100).toFixed(1)}%`);
    }

    // Evaluate predicted load decrease
    if (prediction.expectedLoadDecrease > 0.3) { // 30% decrease
      evaluation.scaleDown.score += Math.round(prediction.expectedLoadDecrease * 30);
      evaluation.scaleDown.reasons.push(`Predicted load decrease: ${(prediction.expectedLoadDecrease * 100).toFixed(1)}%`);
    }

    // Time-based predictions (e.g., known traffic patterns)
    const timeBased = this.evaluateTimeBasedPatterns();
    if (timeBased) {
      evaluation.scaleUp.score += timeBased.scaleUp;
      evaluation.scaleDown.score += timeBased.scaleDown;
      if (timeBased.reason) {
        evaluation.scaleUp.reasons.push(timeBased.reason);
        evaluation.scaleDown.reasons.push(timeBased.reason);
      }
    }

    return evaluation;
  }

  /**
   * Generate load prediction based on historical data
   */
  async generateLoadPrediction() {
    const historicalData = this.getHistoricalMetrics();
    
    if (historicalData.length < 10) {
      return { confidence: 0, expectedLoadIncrease: 0, expectedLoadDecrease: 0 };
    }

    // Simple trend analysis (in production, would use more sophisticated ML)
    const recentTrend = this.calculateTrend(historicalData.slice(-10));
    const seasonalPattern = this.detectSeasonalPattern(historicalData);
    
    let expectedChange = recentTrend.slope * 0.1; // Predict 10% of current trend
    
    // Apply seasonal adjustments
    if (seasonalPattern.confidence > 0.7) {
      expectedChange += seasonalPattern.expectedChange;
    }

    const prediction = {
      confidence: Math.min(recentTrend.correlation + seasonalPattern.confidence, 1.0),
      expectedLoadIncrease: Math.max(expectedChange, 0),
      expectedLoadDecrease: Math.max(-expectedChange, 0),
      factors: {
        trend: recentTrend,
        seasonal: seasonalPattern
      }
    };

    return prediction;
  }

  /**
   * Combine current and predictive evaluations
   */
  combineEvaluations(current, predictive) {
    let finalEvaluation = current;

    if (predictive && predictive.confidence >= this.options.confidenceThreshold) {
      // Weight predictive evaluation based on confidence
      const weight = predictive.confidence * 0.5; // Max 50% weight for predictive
      
      finalEvaluation.scaleUp.score += predictive.scaleUp.score * weight;
      finalEvaluation.scaleDown.score += predictive.scaleDown.score * weight;
      
      finalEvaluation.scaleUp.reasons.push(...predictive.scaleUp.reasons);
      finalEvaluation.scaleDown.reasons.push(...predictive.scaleDown.reasons);
      
      finalEvaluation.predictive = true;
      finalEvaluation.confidence = predictive.confidence;
    }

    // Make final decision
    const decision = {
      action: 'none',
      targetInstances: this.currentInstances,
      reason: 'No scaling needed',
      confidence: finalEvaluation.confidence || 0,
      predictive: finalEvaluation.predictive || false
    };

    if (finalEvaluation.scaleUp.score > finalEvaluation.scaleDown.score && finalEvaluation.scaleUp.score > 50) {
      // Calculate scale-up amount based on score
      const scaleUpAmount = Math.ceil(finalEvaluation.scaleUp.score / 50);
      decision.action = 'scale-up';
      decision.targetInstances = Math.min(this.currentInstances + scaleUpAmount, this.options.maxInstances);
      decision.reason = finalEvaluation.scaleUp.reasons.join('; ');
      decision.confidence = finalEvaluation.scaleUp.score / 100;
    } else if (finalEvaluation.scaleDown.score > 40) {
      // Calculate scale-down amount based on score
      const scaleDownAmount = Math.ceil(finalEvaluation.scaleDown.score / 60);
      decision.action = 'scale-down';
      decision.targetInstances = Math.max(this.currentInstances - scaleDownAmount, this.options.minInstances);
      decision.reason = finalEvaluation.scaleDown.reasons.join('; ');
      decision.confidence = finalEvaluation.scaleDown.score / 100;
    }

    return decision;
  }

  /**
   * Validate scaling decision against cooldowns and constraints
   */
  validateScalingDecision(decision) {
    const now = Date.now();
    
    // Check cooldown periods
    if (decision.action === 'scale-up') {
      if (now - this.lastScaleUpTime < this.options.scaleUpCooldown) {
        decision.action = 'none';
        decision.reason = 'Scale-up cooldown period active';
        return decision;
      }
    } else if (decision.action === 'scale-down') {
      if (now - this.lastScaleDownTime < this.options.scaleDownCooldown) {
        decision.action = 'none';
        decision.reason = 'Scale-down cooldown period active';
        return decision;
      }
    }

    // Check instance boundaries
    if (decision.targetInstances < this.options.minInstances) {
      decision.targetInstances = this.options.minInstances;
    } else if (decision.targetInstances > this.options.maxInstances) {
      decision.targetInstances = this.options.maxInstances;
    }

    // No change needed if target equals current
    if (decision.targetInstances === this.currentInstances) {
      decision.action = 'none';
      decision.reason = 'Already at optimal instance count';
    }

    return decision;
  }

  /**
   * Execute scaling operation
   */
  async executeScaling(decision) {
    if (decision.action === 'none') {
      return;
    }

    this.isScaling = true;
    const scalingStartTime = Date.now();

    try {
      this.logger.info('Executing scaling operation', {
        action: decision.action,
        currentInstances: this.currentInstances,
        targetInstances: decision.targetInstances,
        reason: decision.reason,
        predictive: decision.predictive,
        confidence: decision.confidence
      });

      // Emit scaling event
      this.emit('scalingStarted', {
        action: decision.action,
        currentInstances: this.currentInstances,
        targetInstances: decision.targetInstances
      });

      // Simulate scaling operation (in production, would call AWS Auto Scaling API)
      await this.performScalingOperation(decision);

      // Update internal state
      const previousInstances = this.currentInstances;
      this.currentInstances = decision.targetInstances;

      // Update cooldown timers
      if (decision.action === 'scale-up') {
        this.lastScaleUpTime = Date.now();
      } else if (decision.action === 'scale-down') {
        this.lastScaleDownTime = Date.now();
      }

      // Record scaling history
      this.recordScalingEvent({
        timestamp: new Date().toISOString(),
        action: decision.action,
        fromInstances: previousInstances,
        toInstances: this.currentInstances,
        reason: decision.reason,
        predictive: decision.predictive,
        confidence: decision.confidence,
        duration: Date.now() - scalingStartTime
      });

      // Emit scaling completed event
      this.emit('scalingCompleted', {
        action: decision.action,
        previousInstances: previousInstances,
        currentInstances: this.currentInstances,
        duration: Date.now() - scalingStartTime
      });

      this.logger.info('Scaling operation completed successfully', {
        action: decision.action,
        previousInstances: previousInstances,
        currentInstances: this.currentInstances,
        duration: Date.now() - scalingStartTime
      });

    } catch (error) {
      this.logger.error('Scaling operation failed', {
        error: error.message,
        action: decision.action,
        targetInstances: decision.targetInstances
      });

      this.emit('scalingFailed', {
        action: decision.action,
        error: error.message,
        targetInstances: decision.targetInstances
      });

    } finally {
      this.isScaling = false;
    }
  }

  /**
   * Perform actual scaling operation
   */
  async performScalingOperation(decision) {
    // Simulate AWS Auto Scaling API call
    const delay = Math.random() * 2000 + 1000; // 1-3 second delay
    await new Promise(resolve => setTimeout(resolve, delay));

    // In production, this would make actual AWS API calls:
    // - Update Auto Scaling Group desired capacity
    // - Wait for instances to launch/terminate
    // - Verify scaling operation success
    
    return {
      success: true,
      instances: decision.targetInstances,
      operation: decision.action
    };
  }

  /**
   * Monitor performance and trigger scaling evaluations
   */
  startPerformanceMonitoring() {
    setInterval(async () => {
      try {
        const metrics = await this.collectPerformanceMetrics();
        this.updatePerformanceBuffer(metrics);
        
        // Trigger scaling evaluation
        await this.evaluateScaling(metrics);
        
      } catch (error) {
        this.logger.error('Performance monitoring failed', { error: error.message });
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Collect current performance metrics
   */
  async collectPerformanceMetrics() {
    // In production, would collect from CloudWatch, custom metrics, etc.
    const metrics = {
      timestamp: Date.now(),
      cpuUtilization: Math.random() * 100,
      memoryUtilization: Math.random() * 100,
      responseTime: Math.random() * 10000,
      errorRate: Math.random() * 0.1,
      queueDepth: Math.floor(Math.random() * 200),
      throughput: Math.floor(Math.random() * 2000),
      activeConnections: Math.floor(Math.random() * 500)
    };

    return metrics;
  }

  /**
   * Update performance buffer for analysis
   */
  updatePerformanceBuffer(metrics) {
    this.performanceBuffer.push(metrics);
    
    if (this.performanceBuffer.length > this.bufferSize) {
      this.performanceBuffer.shift();
    }
  }

  /**
   * Start predictive analysis
   */
  startPredictiveAnalysis() {
    if (!this.options.enablePredictiveScaling) {
      return;
    }

    // Run predictive analysis every 5 minutes
    setInterval(async () => {
      try {
        await this.updatePredictiveModel();
      } catch (error) {
        this.logger.error('Predictive analysis failed', { error: error.message });
      }
    }, 300000); // Every 5 minutes
  }

  /**
   * Update predictive model with new data
   */
  async updatePredictiveModel() {
    const historicalData = this.getHistoricalMetrics();
    
    if (historicalData.length < 20) {
      return; // Need more data for meaningful predictions
    }

    // Analyze patterns and update model
    const patterns = this.analyzePatterns(historicalData);
    this.predictiveModel.set('patterns', patterns);
    
    this.logger.debug('Predictive model updated', {
      dataPoints: historicalData.length,
      patterns: patterns.length
    });
  }

  /**
   * Start scaling evaluation process
   */
  startScalingEvaluation() {
    // Evaluate scaling decisions every minute
    setInterval(async () => {
      if (this.performanceBuffer.length === 0) {
        return;
      }

      const recentMetrics = this.performanceBuffer.slice(-this.options.dataPointsToEvaluate);
      const avgMetrics = this.calculateAverageMetrics(recentMetrics);
      
      await this.evaluateScaling(avgMetrics);
    }, 60000); // Every minute
  }

  // Utility methods
  getHistoricalMetrics() {
    return this.performanceBuffer.slice();
  }

  calculateTrend(data) {
    if (data.length < 2) return { slope: 0, correlation: 0 };
    
    // Simple linear regression
    const n = data.length;
    const x = data.map((_, i) => i);
    const y = data.map(d => d.cpuUtilization || 0);
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const correlation = Math.abs(slope) / 10; // Simplified correlation
    
    return { slope, correlation: Math.min(correlation, 1) };
  }

  detectSeasonalPattern(data) {
    // Simplified seasonal pattern detection
    return {
      confidence: 0.5,
      expectedChange: 0,
      pattern: 'none'
    };
  }

  evaluateTimeBasedPatterns() {
    const hour = new Date().getHours();
    
    // Business hours pattern
    if (hour >= 9 && hour <= 17) {
      return {
        scaleUp: 10,
        scaleDown: 0,
        reason: 'Business hours traffic pattern'
      };
    } else if (hour >= 22 || hour <= 6) {
      return {
        scaleUp: 0,
        scaleDown: 15,
        reason: 'Low traffic hours pattern'
      };
    }
    
    return null;
  }

  calculateAverageMetrics(metrics) {
    if (metrics.length === 0) return {};
    
    const avg = {};
    const keys = Object.keys(metrics[0]).filter(k => k !== 'timestamp');
    
    for (const key of keys) {
      avg[key] = metrics.reduce((sum, m) => sum + (m[key] || 0), 0) / metrics.length;
    }
    
    return avg;
  }

  analyzePatterns(data) {
    // Simplified pattern analysis
    return ['hourly_pattern', 'daily_pattern'];
  }

  recordScalingEvent(event) {
    this.scalingHistory.push(event);
    
    // Keep only last 100 scaling events
    if (this.scalingHistory.length > 100) {
      this.scalingHistory.shift();
    }
    
    this.emit('scalingEventRecorded', event);
  }

  async loadHistoricalData() {
    // In production, would load from persistent storage
    this.logger.debug('Loading historical scaling data');
  }

  /**
   * Get comprehensive auto-scaling status
   */
  getScalingStatus() {
    return {
      currentInstances: this.currentInstances,
      minInstances: this.options.minInstances,
      maxInstances: this.options.maxInstances,
      isScaling: this.isScaling,
      lastScaleUpTime: this.lastScaleUpTime,
      lastScaleDownTime: this.lastScaleDownTime,
      recentMetrics: this.performanceBuffer.slice(-5),
      scalingHistory: this.scalingHistory.slice(-10),
      predictiveEnabled: this.options.enablePredictiveScaling,
      nextEvaluationIn: 60000 - (Date.now() % 60000) // Time until next evaluation
    };
  }

  /**
   * Force scaling evaluation with custom metrics
   */
  async forceScalingEvaluation(customMetrics = {}) {
    this.logger.info('Forcing scaling evaluation', { customMetrics });
    await this.evaluateScaling(customMetrics);
  }

  /**
   * Shutdown auto-scaling manager
   */
  async shutdown() {
    this.logger.info('Shutting down Auto-Scaling Manager');
    // Clean up intervals, save state, etc.
    this.emit('shutdown');
  }
}

module.exports = AutoScalingManager;
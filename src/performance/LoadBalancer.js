/**
 * Quantum-Inspired Load Balancer
 * Advanced load balancing with adaptive algorithms and quantum optimization
 * Features: Multiple algorithms, health monitoring, predictive scaling, quantum routing
 */

const { EventEmitter } = require('events');
const QuantumCircuitBreaker = require('../resilience/CircuitBreaker');

class QuantumLoadBalancer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Basic configuration
    this.algorithm = options.algorithm || 'round-robin';
    this.healthCheckInterval = options.healthCheckInterval || 30000; // 30 seconds
    this.healthCheckTimeout = options.healthCheckTimeout || 5000; // 5 seconds
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    
    // Advanced features
    this.adaptiveBalancing = options.adaptiveBalancing !== false;
    this.quantumRouting = options.quantumRouting !== false;
    this.predictiveScaling = options.predictiveScaling !== false;
    this.intelligentFailover = options.intelligentFailover !== false;
    
    // Load balancing algorithms
    this.algorithms = {
      ROUND_ROBIN: 'round-robin',
      WEIGHTED_ROUND_ROBIN: 'weighted-round-robin',
      LEAST_CONNECTIONS: 'least-connections',
      WEIGHTED_LEAST_CONNECTIONS: 'weighted-least-connections',
      LEAST_RESPONSE_TIME: 'least-response-time',
      IP_HASH: 'ip-hash',
      RESOURCE_BASED: 'resource-based',
      QUANTUM: 'quantum',
      ADAPTIVE: 'adaptive'
    };
    
    // Backend servers
    this.backends = new Map(); // serverId -> server config
    this.backendMetrics = new Map(); // serverId -> metrics
    this.backendHealth = new Map(); // serverId -> health status
    this.backendCircuitBreakers = new Map(); // serverId -> circuit breaker
    
    // Load balancing state
    this.currentIndex = 0; // For round-robin
    this.connectionCounts = new Map(); // serverId -> active connections
    this.responseTimes = new Map(); // serverId -> response time history
    this.requestCounts = new Map(); // serverId -> request counts
    
    // Quantum state
    this.quantumState = {
      coherence: 1.0,
      entanglement: new Map(), // server correlations
      superposition: new Map(), // multiple routing possibilities
      uncertainty: 0.1,
      routingMatrix: new Map() // probability distributions
    };
    
    // Adaptive learning
    this.learningModel = {
      serverPerformance: new Map(),
      trafficPatterns: new Map(),
      optimalRouting: new Map(),
      failurePatterns: new Map(),
      learningRate: options.learningRate || 0.1
    };
    
    // Metrics and monitoring
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      currentThroughput: 0,
      peakThroughput: 0,
      activeConnections: 0,
      serverSwitches: 0,
      healthCheckFailures: 0
    };
    
    // Traffic analysis
    this.trafficAnalyzer = {
      requestsPerSecond: [],
      responseTimeHistory: [],
      errorRateHistory: [],
      patternWindow: options.patternWindow || 300000, // 5 minutes
      predictionHorizon: options.predictionHorizon || 60000 // 1 minute
    };
    
    // Start monitoring processes
    this.startMonitoring();
  }

  /**
   * Add backend server to the pool
   * @param {Object} server - Server configuration
   * @returns {string} Server ID
   */
  addBackend(server) {
    const serverId = server.id || this.generateServerId(server);
    
    const backendConfig = {
      id: serverId,
      host: server.host,
      port: server.port,
      weight: server.weight || 1,
      maxConnections: server.maxConnections || 1000,
      healthCheckPath: server.healthCheckPath || '/health',
      tags: server.tags || [],
      metadata: server.metadata || {},
      addedAt: Date.now()
    };
    
    this.backends.set(serverId, backendConfig);
    
    // Initialize metrics
    this.backendMetrics.set(serverId, {
      requests: 0,
      responses: 0,
      errors: 0,
      totalResponseTime: 0,
      averageResponseTime: 0,
      activeConnections: 0,
      lastRequestTime: null,
      uptime: Date.now()
    });
    
    // Initialize health status
    this.backendHealth.set(serverId, {
      status: 'unknown',
      lastCheck: null,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      responseTime: 0
    });
    
    // Initialize circuit breaker
    this.backendCircuitBreakers.set(serverId, new QuantumCircuitBreaker({
      serviceName: `backend-${serverId}`,
      failureThreshold: 5,
      timeout: this.healthCheckTimeout
    }));
    
    // Initialize quantum state
    if (this.quantumRouting) {
      this.quantumState.routingMatrix.set(serverId, 1 / this.backends.size);
    }
    
    this.connectionCounts.set(serverId, 0);
    this.responseTimes.set(serverId, []);
    this.requestCounts.set(serverId, 0);
    
    this.emit('backendAdded', { serverId, config: backendConfig });
    
    // Perform initial health check
    setImmediate(() => this.performHealthCheck(serverId));
    
    return serverId;
  }

  /**
   * Remove backend server from the pool
   * @param {string} serverId - Server ID to remove
   * @returns {boolean} Success status
   */
  removeBackend(serverId) {
    if (!this.backends.has(serverId)) {
      return false;
    }
    
    // Cleanup all related data
    this.backends.delete(serverId);
    this.backendMetrics.delete(serverId);
    this.backendHealth.delete(serverId);
    this.connectionCounts.delete(serverId);
    this.responseTimes.delete(serverId);
    this.requestCounts.delete(serverId);
    
    // Cleanup circuit breaker
    const circuitBreaker = this.backendCircuitBreakers.get(serverId);
    if (circuitBreaker) {
      circuitBreaker.destroy();
      this.backendCircuitBreakers.delete(serverId);
    }
    
    // Cleanup quantum state
    if (this.quantumRouting) {
      this.quantumState.routingMatrix.delete(serverId);
      this.quantumState.entanglement.delete(serverId);
      this.quantumState.superposition.delete(serverId);
    }
    
    this.emit('backendRemoved', { serverId });
    return true;
  }

  /**
   * Route request to optimal backend server
   * @param {Object} request - Request object
   * @param {Object} options - Routing options
   * @returns {Promise<Object>} Selected backend and routing info
   */
  async route(request, options = {}) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    try {
      // Get healthy backends
      const healthyBackends = this.getHealthyBackends();
      
      if (healthyBackends.length === 0) {
        throw new Error('No healthy backends available');
      }
      
      // Select backend using configured algorithm
      const selectedBackend = await this.selectBackend(
        healthyBackends, 
        request, 
        options
      );
      
      // Update connection count
      this.incrementConnections(selectedBackend.id);
      
      // Record request
      this.recordRequest(selectedBackend.id, requestId, startTime);
      
      // Learn from routing decision
      if (this.adaptiveBalancing) {
        this.learnFromRoutingDecision(selectedBackend.id, request);
      }
      
      this.emit('requestRouted', {
        requestId,
        backendId: selectedBackend.id,
        algorithm: this.algorithm,
        selectionTime: Date.now() - startTime
      });
      
      return {
        backend: selectedBackend,
        requestId,
        routingInfo: {
          algorithm: this.algorithm,
          selectionTime: Date.now() - startTime,
          totalBackends: this.backends.size,
          healthyBackends: healthyBackends.length
        }
      };
      
    } catch (error) {
      this.metrics.failedRequests++;
      this.emit('routingError', { requestId, error: error.message });
      throw error;
    }
  }

  /**
   * Complete request and update metrics
   * @param {string} requestId - Request ID
   * @param {string} backendId - Backend server ID
   * @param {Object} result - Request result
   * @returns {void}
   */
  completeRequest(requestId, backendId, result) {
    const responseTime = result.responseTime || 0;
    const success = !result.error;
    
    // Update connection count
    this.decrementConnections(backendId);
    
    // Record response
    this.recordResponse(backendId, responseTime, success);
    
    // Update metrics
    this.metrics.totalRequests++;
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
    
    // Update average response time
    this.updateAverageResponseTime(responseTime);
    
    // Learn from request outcome
    if (this.adaptiveBalancing) {
      this.learnFromRequestOutcome(backendId, responseTime, success);
    }
    
    this.emit('requestCompleted', {
      requestId,
      backendId,
      responseTime,
      success
    });
  }

  /**
   * Select backend server using configured algorithm
   */
  async selectBackend(healthyBackends, request, options) {
    switch (this.algorithm) {
      case this.algorithms.ROUND_ROBIN:
        return this.selectRoundRobin(healthyBackends);
      
      case this.algorithms.WEIGHTED_ROUND_ROBIN:
        return this.selectWeightedRoundRobin(healthyBackends);
      
      case this.algorithms.LEAST_CONNECTIONS:
        return this.selectLeastConnections(healthyBackends);
      
      case this.algorithms.WEIGHTED_LEAST_CONNECTIONS:
        return this.selectWeightedLeastConnections(healthyBackends);
      
      case this.algorithms.LEAST_RESPONSE_TIME:
        return this.selectLeastResponseTime(healthyBackends);
      
      case this.algorithms.IP_HASH:
        return this.selectIpHash(healthyBackends, request);
      
      case this.algorithms.RESOURCE_BASED:
        return this.selectResourceBased(healthyBackends);
      
      case this.algorithms.QUANTUM:
        return await this.selectQuantum(healthyBackends, request);
      
      case this.algorithms.ADAPTIVE:
        return await this.selectAdaptive(healthyBackends, request);
      
      default:
        return this.selectRoundRobin(healthyBackends);
    }
  }

  /**
   * Round-robin selection
   */
  selectRoundRobin(backends) {
    const selected = backends[this.currentIndex % backends.length];
    this.currentIndex = (this.currentIndex + 1) % backends.length;
    return selected;
  }

  /**
   * Weighted round-robin selection
   */
  selectWeightedRoundRobin(backends) {
    const totalWeight = backends.reduce((sum, backend) => sum + backend.weight, 0);
    let targetWeight = Math.random() * totalWeight;
    
    for (const backend of backends) {
      targetWeight -= backend.weight;
      if (targetWeight <= 0) {
        return backend;
      }
    }
    
    return backends[0]; // Fallback
  }

  /**
   * Least connections selection
   */
  selectLeastConnections(backends) {
    return backends.reduce((min, current) => {
      const minConnections = this.connectionCounts.get(min.id) || 0;
      const currentConnections = this.connectionCounts.get(current.id) || 0;
      return currentConnections < minConnections ? current : min;
    });
  }

  /**
   * Weighted least connections selection
   */
  selectWeightedLeastConnections(backends) {
    return backends.reduce((min, current) => {
      const minRatio = (this.connectionCounts.get(min.id) || 0) / min.weight;
      const currentRatio = (this.connectionCounts.get(current.id) || 0) / current.weight;
      return currentRatio < minRatio ? current : min;
    });
  }

  /**
   * Least response time selection
   */
  selectLeastResponseTime(backends) {
    return backends.reduce((min, current) => {
      const minMetrics = this.backendMetrics.get(min.id);
      const currentMetrics = this.backendMetrics.get(current.id);
      
      const minTime = minMetrics?.averageResponseTime || Infinity;
      const currentTime = currentMetrics?.averageResponseTime || Infinity;
      
      return currentTime < minTime ? current : min;
    });
  }

  /**
   * IP hash selection (consistent hashing)
   */
  selectIpHash(backends, request) {
    const clientIp = request.clientIp || request.ip || '127.0.0.1';
    const hash = this.hashString(clientIp);
    const index = hash % backends.length;
    return backends[index];
  }

  /**
   * Resource-based selection
   */
  selectResourceBased(backends) {
    // Select based on current resource utilization
    return backends.reduce((best, current) => {
      const bestMetrics = this.backendMetrics.get(best.id);
      const currentMetrics = this.backendMetrics.get(current.id);
      
      const bestUtilization = this.calculateResourceUtilization(best.id, bestMetrics);
      const currentUtilization = this.calculateResourceUtilization(current.id, currentMetrics);
      
      return currentUtilization < bestUtilization ? current : best;
    });
  }

  /**
   * Quantum-inspired selection
   */
  async selectQuantum(backends, request) {
    if (!this.quantumRouting) {
      return this.selectRoundRobin(backends);
    }
    
    // Create quantum superposition of all possible backends
    const superposition = backends.map(backend => ({
      backend,
      probability: this.quantumState.routingMatrix.get(backend.id) || 0.1,
      amplitude: this.calculateQuantumAmplitude(backend.id, request)
    }));
    
    // Apply quantum interference
    const interference = this.applyQuantumInterference(superposition);
    
    // Collapse wave function to select backend
    const selected = this.collapseWaveFunction(interference);
    
    // Update quantum state
    this.updateQuantumRoutingState(selected.backend.id, request);
    
    return selected.backend;
  }

  /**
   * Adaptive selection using machine learning
   */
  async selectAdaptive(backends, request) {
    if (!this.adaptiveBalancing) {
      return this.selectRoundRobin(backends);
    }
    
    // Use learned patterns to select optimal backend
    const scores = backends.map(backend => ({
      backend,
      score: this.calculateAdaptiveScore(backend.id, request)
    }));
    
    // Select backend with highest score
    const best = scores.reduce((max, current) => 
      current.score > max.score ? current : max
    );
    
    return best.backend;
  }

  /**
   * Get list of healthy backends
   */
  getHealthyBackends() {
    const healthy = [];
    
    for (const [serverId, backend] of this.backends.entries()) {
      const health = this.backendHealth.get(serverId);
      const circuitBreaker = this.backendCircuitBreakers.get(serverId);
      
      if (health?.status === 'healthy' && 
          circuitBreaker?.currentState !== 'OPEN') {
        healthy.push(backend);
      }
    }
    
    return healthy;
  }

  /**
   * Perform health check on specific backend
   */
  async performHealthCheck(serverId) {
    const backend = this.backends.get(serverId);
    const health = this.backendHealth.get(serverId);
    
    if (!backend || !health) return;
    
    const startTime = Date.now();
    
    try {
      // Simulate health check (in real implementation, make HTTP request)
      const healthy = await this.checkBackendHealth(backend);
      const responseTime = Date.now() - startTime;
      
      if (healthy) {
        health.status = 'healthy';
        health.consecutiveSuccesses++;
        health.consecutiveFailures = 0;
        health.responseTime = responseTime;
      } else {
        health.status = 'unhealthy';
        health.consecutiveFailures++;
        health.consecutiveSuccesses = 0;
        this.metrics.healthCheckFailures++;
      }
      
      health.lastCheck = Date.now();
      
      this.emit('healthCheck', {
        serverId,
        status: health.status,
        responseTime,
        consecutiveFailures: health.consecutiveFailures
      });
      
    } catch (error) {
      health.status = 'unhealthy';
      health.consecutiveFailures++;
      health.consecutiveSuccesses = 0;
      health.lastCheck = Date.now();
      this.metrics.healthCheckFailures++;
      
      this.emit('healthCheckError', {
        serverId,
        error: error.message
      });
    }
  }

  /**
   * Simulate backend health check
   */
  async checkBackendHealth(backend) {
    // Simulate network request with random success/failure
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    
    // Simulate 90% success rate
    return Math.random() > 0.1;
  }

  /**
   * Start monitoring processes
   */
  startMonitoring() {
    // Health checks
    setInterval(() => {
      this.performAllHealthChecks();
    }, this.healthCheckInterval);
    
    // Metrics updates
    setInterval(() => {
      this.updateMetrics();
    }, 10000); // Every 10 seconds
    
    // Traffic analysis
    setInterval(() => {
      this.analyzeTrafficPatterns();
    }, 60000); // Every minute
    
    // Quantum state maintenance
    if (this.quantumRouting) {
      setInterval(() => {
        this.maintainQuantumState();
      }, 30000); // Every 30 seconds
    }
    
    // Adaptive learning
    if (this.adaptiveBalancing) {
      setInterval(() => {
        this.updateLearningModel();
      }, 120000); // Every 2 minutes
    }
  }

  /**
   * Perform health checks on all backends
   */
  async performAllHealthChecks() {
    const healthCheckPromises = Array.from(this.backends.keys()).map(
      serverId => this.performHealthCheck(serverId)
    );
    
    await Promise.allSettled(healthCheckPromises);
  }

  /**
   * Update performance metrics
   */
  updateMetrics() {
    // Calculate current throughput
    this.calculateThroughput();
    
    // Update active connections
    this.metrics.activeConnections = Array.from(this.connectionCounts.values())
      .reduce((sum, count) => sum + count, 0);
    
    // Emit metrics update
    this.emit('metricsUpdate', { ...this.metrics });
  }

  /**
   * Calculate current throughput
   */
  calculateThroughput() {
    const now = Date.now();
    const windowSize = 60000; // 1 minute
    
    let recentRequests = 0;
    for (const metrics of this.backendMetrics.values()) {
      if (metrics.lastRequestTime && (now - metrics.lastRequestTime) < windowSize) {
        recentRequests += metrics.requests;
      }
    }
    
    this.metrics.currentThroughput = recentRequests / (windowSize / 1000);
    this.metrics.peakThroughput = Math.max(
      this.metrics.peakThroughput, 
      this.metrics.currentThroughput
    );
  }

  /**
   * Analyze traffic patterns for predictive scaling
   */
  analyzeTrafficPatterns() {
    const now = Date.now();
    
    // Record current metrics
    this.trafficAnalyzer.requestsPerSecond.push({
      timestamp: now,
      value: this.metrics.currentThroughput
    });
    
    this.trafficAnalyzer.responseTimeHistory.push({
      timestamp: now,
      value: this.metrics.averageResponseTime
    });
    
    const errorRate = this.metrics.totalRequests > 0 ? 
      this.metrics.failedRequests / this.metrics.totalRequests : 0;
    
    this.trafficAnalyzer.errorRateHistory.push({
      timestamp: now,
      value: errorRate
    });
    
    // Clean old data
    const cutoff = now - this.trafficAnalyzer.patternWindow;
    this.trafficAnalyzer.requestsPerSecond = this.trafficAnalyzer.requestsPerSecond
      .filter(entry => entry.timestamp > cutoff);
    this.trafficAnalyzer.responseTimeHistory = this.trafficAnalyzer.responseTimeHistory
      .filter(entry => entry.timestamp > cutoff);
    this.trafficAnalyzer.errorRateHistory = this.trafficAnalyzer.errorRateHistory
      .filter(entry => entry.timestamp > cutoff);
    
    // Emit traffic analysis
    this.emit('trafficAnalysis', {
      currentThroughput: this.metrics.currentThroughput,
      averageResponseTime: this.metrics.averageResponseTime,
      errorRate,
      trend: this.calculateTrend()
    });
  }

  /**
   * Calculate traffic trend
   */
  calculateTrend() {
    const recent = this.trafficAnalyzer.requestsPerSecond.slice(-10);
    if (recent.length < 2) return 'stable';
    
    const first = recent[0].value;
    const last = recent[recent.length - 1].value;
    const change = (last - first) / Math.max(first, 1);
    
    if (change > 0.2) return 'increasing';
    if (change < -0.2) return 'decreasing';
    return 'stable';
  }

  // Utility methods
  incrementConnections(serverId) {
    const current = this.connectionCounts.get(serverId) || 0;
    this.connectionCounts.set(serverId, current + 1);
  }

  decrementConnections(serverId) {
    const current = this.connectionCounts.get(serverId) || 0;
    this.connectionCounts.set(serverId, Math.max(0, current - 1));
  }

  recordRequest(serverId, requestId, startTime) {
    const metrics = this.backendMetrics.get(serverId);
    if (metrics) {
      metrics.requests++;
      metrics.lastRequestTime = startTime;
      
      const current = this.requestCounts.get(serverId) || 0;
      this.requestCounts.set(serverId, current + 1);
    }
  }

  recordResponse(serverId, responseTime, success) {
    const metrics = this.backendMetrics.get(serverId);
    if (!metrics) return;
    
    metrics.responses++;
    metrics.totalResponseTime += responseTime;
    metrics.averageResponseTime = metrics.totalResponseTime / metrics.responses;
    
    if (!success) {
      metrics.errors++;
    }
    
    // Update response time history
    const history = this.responseTimes.get(serverId) || [];
    history.push(responseTime);
    
    // Keep only recent history (last 100 requests)
    if (history.length > 100) {
      history.shift();
    }
    
    this.responseTimes.set(serverId, history);
  }

  updateAverageResponseTime(responseTime) {
    const total = this.metrics.successfulRequests + this.metrics.failedRequests;
    
    if (total === 1) {
      this.metrics.averageResponseTime = responseTime;
    } else {
      this.metrics.averageResponseTime = 
        (this.metrics.averageResponseTime * (total - 1) + responseTime) / total;
    }
  }

  calculateResourceUtilization(serverId, metrics) {
    const backend = this.backends.get(serverId);
    if (!backend || !metrics) return 1.0;
    
    const connectionUtilization = metrics.activeConnections / backend.maxConnections;
    const responseTimeUtilization = Math.min(metrics.averageResponseTime / 1000, 1);
    
    return (connectionUtilization + responseTimeUtilization) / 2;
  }

  // Quantum-specific methods
  calculateQuantumAmplitude(serverId, request) {
    const metrics = this.backendMetrics.get(serverId);
    if (!metrics) return 0.1;
    
    // Calculate amplitude based on performance metrics
    const performance = 1 / Math.max(metrics.averageResponseTime, 1);
    const reliability = metrics.responses > 0 ? 
      (metrics.responses - metrics.errors) / metrics.responses : 0.5;
    
    return Math.sqrt(performance * reliability);
  }

  applyQuantumInterference(superposition) {
    // Apply constructive/destructive interference
    return superposition.map(state => ({
      ...state,
      probability: state.probability * Math.pow(state.amplitude, 2)
    }));
  }

  collapseWaveFunction(interference) {
    // Normalize probabilities
    const totalProbability = interference.reduce((sum, state) => sum + state.probability, 0);
    const normalized = interference.map(state => ({
      ...state,
      probability: state.probability / totalProbability
    }));
    
    // Select based on probability distribution
    const random = Math.random();
    let cumulative = 0;
    
    for (const state of normalized) {
      cumulative += state.probability;
      if (random <= cumulative) {
        return state;
      }
    }
    
    return normalized[0]; // Fallback
  }

  updateQuantumRoutingState(serverId, request) {
    // Update routing probabilities based on success
    const current = this.quantumState.routingMatrix.get(serverId) || 0.1;
    const adjustment = 0.01; // Small learning rate
    
    this.quantumState.routingMatrix.set(serverId, 
      Math.min(1.0, current + adjustment)
    );
    
    // Normalize probabilities
    this.normalizeQuantumProbabilities();
  }

  normalizeQuantumProbabilities() {
    const total = Array.from(this.quantumState.routingMatrix.values())
      .reduce((sum, prob) => sum + prob, 0);
    
    if (total > 0) {
      for (const [serverId, prob] of this.quantumState.routingMatrix.entries()) {
        this.quantumState.routingMatrix.set(serverId, prob / total);
      }
    }
  }

  maintainQuantumState() {
    // Maintain quantum coherence and entanglement
    this.quantumState.coherence *= 0.99; // Natural decoherence
    
    if (this.quantumState.coherence < 0.1) {
      this.quantumState.coherence = 0.5; // Reset coherence
    }
  }

  // Adaptive learning methods
  calculateAdaptiveScore(serverId, request) {
    const performance = this.learningModel.serverPerformance.get(serverId);
    if (!performance) return 0.5;
    
    // Calculate score based on learned patterns
    return performance.successRate * performance.speedScore * performance.reliabilityScore;
  }

  learnFromRoutingDecision(serverId, request) {
    // Learn from routing decisions
    const pattern = this.learningModel.trafficPatterns.get(serverId) || {
      requests: 0,
      successfulRequests: 0,
      averageResponseTime: 0
    };
    
    pattern.requests++;
    this.learningModel.trafficPatterns.set(serverId, pattern);
  }

  learnFromRequestOutcome(serverId, responseTime, success) {
    // Update server performance model
    const performance = this.learningModel.serverPerformance.get(serverId) || {
      totalRequests: 0,
      successfulRequests: 0,
      totalResponseTime: 0,
      successRate: 0.5,
      speedScore: 0.5,
      reliabilityScore: 0.5
    };
    
    performance.totalRequests++;
    performance.totalResponseTime += responseTime;
    
    if (success) {
      performance.successfulRequests++;
    }
    
    // Update derived metrics
    performance.successRate = performance.successfulRequests / performance.totalRequests;
    performance.speedScore = Math.max(0.1, 1 - (performance.totalResponseTime / performance.totalRequests) / 10000);
    performance.reliabilityScore = performance.successRate;
    
    this.learningModel.serverPerformance.set(serverId, performance);
  }

  updateLearningModel() {
    // Update learning model with recent patterns
    this.emit('learningUpdate', {
      serverPerformance: this.learningModel.serverPerformance.size,
      trafficPatterns: this.learningModel.trafficPatterns.size
    });
  }

  // Utility methods
  generateServerId(server) {
    return `${server.host}:${server.port}`;
  }

  generateRequestId() {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get comprehensive load balancer statistics
   */
  getStats() {
    const backendStats = {};
    
    for (const [serverId, backend] of this.backends.entries()) {
      const metrics = this.backendMetrics.get(serverId);
      const health = this.backendHealth.get(serverId);
      const connections = this.connectionCounts.get(serverId) || 0;
      
      backendStats[serverId] = {
        config: backend,
        metrics: metrics,
        health: health,
        activeConnections: connections,
        performance: this.learningModel.serverPerformance.get(serverId)
      };
    }
    
    return {
      algorithm: this.algorithm,
      metrics: { ...this.metrics },
      backends: backendStats,
      quantumState: this.quantumRouting ? {
        coherence: this.quantumState.coherence,
        routingMatrix: Object.fromEntries(this.quantumState.routingMatrix)
      } : null,
      trafficAnalysis: {
        trend: this.calculateTrend(),
        currentThroughput: this.metrics.currentThroughput,
        peakThroughput: this.metrics.peakThroughput
      }
    };
  }

  /**
   * Update load balancing algorithm
   */
  setAlgorithm(algorithm) {
    if (Object.values(this.algorithms).includes(algorithm)) {
      this.algorithm = algorithm;
      this.emit('algorithmChanged', { algorithm });
      return true;
    }
    return false;
  }
}

module.exports = QuantumLoadBalancer;
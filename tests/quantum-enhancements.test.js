/**
 * Tests for Enhanced Quantum Features
 * Tests the new quantum self-healing and AI optimization capabilities
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const CloudRemediatorSage = require('../src/index');
const QuantumSelfHealer = require('../src/quantum/QuantumSelfHealer');
const AIExecutionOptimizer = require('../src/quantum/AIExecutionOptimizer');

describe('Enhanced Quantum Features', () => {
  let platform;
  let selfHealer;
  let aiOptimizer;

  beforeEach(async () => {
    // Initialize platform in test mode
    platform = new CloudRemediatorSage.CloudRemediatorSage({
      stage: 'test',
      logLevel: 'error' // Reduce noise in tests
    });
    
    selfHealer = new QuantumSelfHealer({
      maxHealingAttempts: 2,
      learningRate: 0.1
    });
    
    aiOptimizer = new AIExecutionOptimizer({
      learningRate: 0.01,
      optimizationInterval: 1000 // 1 second for tests
    });
  });

  afterEach(async () => {
    if (platform) {
      await platform.shutdown();
    }
    if (selfHealer) {
      await selfHealer.shutdown();
    }
  });

  describe('Quantum Self-Healing System', () => {
    test('should initialize successfully', async () => {
      await selfHealer.initialize();
      
      const health = selfHealer.getHealthStatus();
      expect(health.isActive).toBe(true);
      expect(health.quantumState).toBeDefined();
      expect(health.quantumState.coherence).toBeGreaterThan(0);
    });

    test('should recognize failure patterns', async () => {
      await selfHealer.initialize();
      
      const mockFailure = {
        type: 'connection-timeout',
        component: 'neptune-service',
        severity: 'high',
        stack: 'Error: Connection timeout at line 123'
      };
      
      const pattern = selfHealer.recognizeFailurePattern(mockFailure, {});
      
      expect(pattern.signature).toBeDefined();
      expect(pattern.signature).toContain('connection-timeout');
      expect(pattern.quantumFingerprint).toBeGreaterThan(0);
    });

    test('should heal quantum failures', async () => {
      await selfHealer.initialize();
      
      const mockFailure = {
        type: 'execution-error',
        component: 'task-executor',
        severity: 'medium'
      };
      
      const healingResult = await selfHealer.healQuantumFailure(mockFailure);
      
      expect(healingResult).toBeDefined();
      expect(healingResult.success).toBeDefined();
      expect(healingResult.duration).toBeGreaterThan(0);
    });

    test('should update quantum coherence based on healing success', async () => {
      await selfHealer.initialize();
      
      const initialCoherence = selfHealer.quantumState.coherence;
      
      selfHealer.updateQuantumCoherence(true); // Successful healing
      expect(selfHealer.quantumState.coherence).toBeGreaterThanOrEqual(initialCoherence);
      
      selfHealer.updateQuantumCoherence(false); // Failed healing
      expect(selfHealer.quantumState.coherence).toBeLessThan(1.0);
    });

    test('should handle emergency adaptation', async () => {
      await selfHealer.initialize();
      
      const emergencyError = new Error('Critical system failure');
      await selfHealer.emergencyAdaptation(emergencyError);
      
      const health = selfHealer.getHealthStatus();
      expect(health.quantumState.coherence).toBe(0.5); // Reset to safe state
      expect(health.quantumState.entanglement).toBe(0.0);
    });
  });

  describe('AI Execution Optimizer', () => {
    test('should initialize successfully', async () => {
      await aiOptimizer.initialize();
      
      const health = aiOptimizer.getHealthStatus();
      expect(health.neuralNetworkAccuracy).toBeGreaterThan(0);
      expect(health.quantumState).toBeDefined();
    });

    test('should analyze execution context', async () => {
      await aiOptimizer.initialize();
      
      const mockContext = {
        type: 'security-scan',
        priority: 8,
        taskCount: 5,
        dataSize: 1000
      };
      
      const analysis = await aiOptimizer.analyzeExecutionContext(mockContext);
      
      expect(analysis.raw).toBeDefined();
      expect(analysis.processed).toBeDefined();
      expect(analysis.fingerprint).toBeDefined();
      expect(analysis.confidence).toBeGreaterThan(0);
    });

    test('should optimize execution strategy', async () => {
      await aiOptimizer.initialize();
      
      const mockContext = {
        type: 'remediation',
        priority: 7,
        complexity: 'medium'
      };
      
      const optimizedStrategy = await aiOptimizer.optimizeExecution(mockContext);
      
      expect(optimizedStrategy).toBeDefined();
      expect(optimizedStrategy.parallelization).toBeDefined();
      expect(optimizedStrategy.resourceAllocation).toBeDefined();
      expect(optimizedStrategy.confidence).toBeDefined();
    });

    test('should learn from execution results', async () => {
      await aiOptimizer.initialize();
      
      const optimizationId = 'test-opt-123';
      const mockResult = {
        duration: 1500,
        success: true,
        resourceUsage: 0.6,
        efficiency: 0.8
      };
      
      // First, we need to track an optimization
      aiOptimizer.trackOptimization(optimizationId, {
        input: { processed: { complexity: 0.5 } },
        predicted: { parallelization: 0.7 },
        final: { predictionVector: [0.7, 0.5, 0.3] }
      });
      
      await aiOptimizer.learnFromExecution(optimizationId, mockResult);
      
      const health = aiOptimizer.getHealthStatus();
      expect(health.memoryUsage).toBeGreaterThan(0);
    });

    test('should generate performance predictions', async () => {
      await aiOptimizer.initialize();
      
      const predictions = await aiOptimizer.generatePerformancePredictions(60); // 60 seconds
      
      expect(predictions).toBeDefined();
      expect(Array.isArray(predictions)).toBe(true);
      expect(predictions.length).toBeGreaterThan(0);
      
      predictions.forEach(prediction => {
        expect(prediction.timestamp).toBeDefined();
        expect(prediction.expectedLoad).toBeDefined();
        expect(prediction.confidence).toBeDefined();
      });
    });
  });

  describe('Enhanced Platform Integration', () => {
    test('should initialize with quantum enhancements', async () => {
      await platform.initialize();
      
      expect(platform.selfHealer).toBeDefined();
      expect(platform.aiOptimizer).toBeDefined();
      
      const health = await platform.getHealthStatus();
      expect(health.services.selfHealer).toBeDefined();
      expect(health.services.aiOptimizer).toBeDefined();
    });

    test('should handle quantum-enhanced remediation planning', async () => {
      await platform.initialize();
      
      const plan = await platform.planRemediation(['finding-1', 'finding-2'], {
        maxParallelTasks: 2,
        priorityThreshold: 5.0
      });
      
      expect(plan).toBeDefined();
      expect(plan.tasks).toBeDefined();
    });

    test('should provide comprehensive health status', async () => {
      await platform.initialize();
      
      const health = await platform.getHealthStatus();
      
      expect(health.platform).toBeDefined();
      expect(health.performance).toBeDefined();
      expect(health.services).toBeDefined();
      expect(health.services.selfHealer).toBeDefined();
      expect(health.services.aiOptimizer).toBeDefined();
    });
  });

  describe('Quantum State Management', () => {
    test('should maintain quantum coherence across components', async () => {
      await platform.initialize();
      
      const healerHealth = platform.selfHealer.getHealthStatus();
      const optimizerHealth = platform.aiOptimizer.getHealthStatus();
      
      expect(healerHealth.quantumState.coherence).toBeGreaterThan(0);
      expect(optimizerHealth.quantumState).toBeDefined();
      
      // Quantum states should be related but independent
      expect(healerHealth.quantumState.coherence).toBeGreaterThan(0);
      expect(optimizerHealth.quantumState.quantumCoherence).toBeGreaterThan(0);
    });

    test('should handle quantum entanglement between systems', async () => {
      await selfHealer.initialize();
      await aiOptimizer.initialize();
      
      // Simulate entangled quantum operations
      const mockFailure = { type: 'performance-degradation', severity: 'medium' };
      const mockContext = { type: 'optimization', performance: 'degraded' };
      
      const healingPromise = selfHealer.healQuantumFailure(mockFailure);
      const optimizationPromise = aiOptimizer.optimizeExecution(mockContext);
      
      const [healingResult, optimizationResult] = await Promise.all([
        healingPromise,
        optimizationPromise
      ]);
      
      expect(healingResult).toBeDefined();
      expect(optimizationResult).toBeDefined();
    });
  });
});
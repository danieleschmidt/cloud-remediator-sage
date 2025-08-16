/**
 * Tests for Quantum Execution Engine
 * Comprehensive test suite for quantum-inspired autonomous execution
 */

// Jest globals are available by default in Jest environment
const QuantumExecutionEngine = require('../../src/quantum/QuantumExecutionEngine');
const { EventEmitter } = require('events');

// Mock dependencies
jest.mock('../../src/monitoring/logger');
jest.mock('../../src/performance/PerformanceManager');
jest.mock('../../src/reliability/ResilienceManager');
jest.mock('../../src/quantum/TaskPlanner');
jest.mock('../../src/quantum/AutoExecutor');

describe('QuantumExecutionEngine', () => {
  let engine;
  let mockPerformanceManager;
  let mockResilienceManager;
  let mockTaskPlanner;
  let mockAutoExecutor;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock implementations
    mockPerformanceManager = {
      initialize: jest.fn().mockResolvedValue(),
      executeWithPerformance: jest.fn().mockImplementation((fn) => fn()),
      getMetrics: jest.fn().mockReturnValue({
        avgResponseTime: 1000,
        successRate: 0.95,
        errorRate: 0.05
      }),
      getPerformanceReport: jest.fn().mockReturnValue({
        summary: { avgResponseTime: 1000 },
        percentiles: {},
        cacheStats: {}
      }),
      shutdown: jest.fn().mockResolvedValue()
    };

    mockResilienceManager = {
      initialize: jest.fn().mockResolvedValue(),
      executeWithResilience: jest.fn().mockImplementation((fn) => fn()),
      getSystemStatus: jest.fn().mockReturnValue({
        status: 'healthy',
        uptime: 1000,
        services: {}
      }),
      shutdown: jest.fn().mockResolvedValue()
    };

    mockTaskPlanner = {
      initialize: jest.fn().mockResolvedValue(),
      generateOptimalPlan: jest.fn().mockResolvedValue({
        id: 'test-plan-123',
        tasks: [
          {
            id: 'task-1',
            parallelizable: true,
            estimatedDuration: 300,
            priority: 8,
            riskReduction: 7
          },
          {
            id: 'task-2', 
            parallelizable: false,
            estimatedDuration: 600,
            priority: 9,
            riskReduction: 9
          }
        ],
        estimatedDuration: 900,
        estimatedRiskReduction: 16
      })
    };

    mockAutoExecutor = {
      initialize: jest.fn().mockResolvedValue(),
      enableAdaptiveMode: jest.fn(),
      executeAutonomousRemediation: jest.fn().mockResolvedValue({
        success: true,
        tasksExecuted: 2,
        tasksSucceeded: 2,
        tasksFailed: 0,
        totalRiskReduction: 16,
        resourceUsage: 0.6,
        parallelTasksExecuted: 1
      })
    };

    // Mock the require calls
    const PerformanceManager = require('../../src/performance/PerformanceManager');
    const ResilienceManager = require('../../src/reliability/ResilienceManager');
    const QuantumTaskPlanner = require('../../src/quantum/TaskPlanner');
    const QuantumAutoExecutor = require('../../src/quantum/AutoExecutor');

    PerformanceManager.mockImplementation(() => mockPerformanceManager);
    ResilienceManager.mockImplementation(() => mockResilienceManager);
    QuantumTaskPlanner.mockImplementation(() => mockTaskPlanner);
    QuantumAutoExecutor.mockImplementation(() => mockAutoExecutor);

    engine = new QuantumExecutionEngine({
      maxQuantumStates: 4,
      adaptiveOptimization: true,
      selfHealingEnabled: true
    });
  });

  afterEach(async () => {
    if (engine && engine.isInitialized) {
      await engine.shutdown();
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      await engine.initialize();

      expect(engine.isInitialized).toBe(true);
      expect(mockPerformanceManager.initialize).toHaveBeenCalled();
      expect(mockResilienceManager.initialize).toHaveBeenCalled();
      expect(mockTaskPlanner.initialize).toHaveBeenCalled();
      expect(mockAutoExecutor.initialize).toHaveBeenCalled();
    });

    test('should not reinitialize if already initialized', async () => {
      await engine.initialize();
      await engine.initialize();

      expect(mockPerformanceManager.initialize).toHaveBeenCalledTimes(1);
    });

    test('should emit initialized event', async () => {
      const eventSpy = jest.fn();
      engine.on('initialized', eventSpy);

      await engine.initialize();

      expect(eventSpy).toHaveBeenCalledWith({
        timestamp: expect.any(String)
      });
    });

    test('should handle initialization failure', async () => {
      mockPerformanceManager.initialize.mockRejectedValue(new Error('Init failed'));

      await expect(engine.initialize()).rejects.toThrow('Init failed');
      expect(engine.isInitialized).toBe(false);
    });
  });

  describe('Quantum Execution', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should execute quantum remediation successfully', async () => {
      const context = {
        accountId: '123456789012',
        region: 'us-east-1',
        minRiskScore: 7
      };

      const result = await engine.executeQuantumRemediation(context);

      expect(result.success).toBe(true);
      expect(result.executionId).toMatch(/^qe-/);
      expect(result.quantumEfficiency).toBeGreaterThan(0);
      expect(result.quantumMetrics).toBeDefined();
      expect(result.quantumMetrics.quantumAdvantage).toBeDefined();
      
      expect(mockTaskPlanner.generateOptimalPlan).toHaveBeenCalledWith({
        ...context,
        quantumOptimized: true,
        adaptiveExecution: true
      });
      
      expect(mockAutoExecutor.enableAdaptiveMode).toHaveBeenCalled();
      expect(mockAutoExecutor.executeAutonomousRemediation).toHaveBeenCalled();
    });

    test('should handle execution failure gracefully', async () => {
      mockAutoExecutor.executeAutonomousRemediation.mockRejectedValue(
        new Error('Execution failed')
      );

      await expect(engine.executeQuantumRemediation()).rejects.toThrow('Execution failed');
      expect(engine.globalMetrics.failedExecutions).toBe(1);
    });

    test('should track active executions', async () => {
      const executionPromise = engine.executeQuantumRemediation();
      
      expect(engine.activeExecusions.size).toBe(1);
      
      await executionPromise;
      
      expect(engine.activeExecusions.size).toBe(0);
    });

    test('should update global metrics', async () => {
      const initialTotal = engine.globalMetrics.totalExecutions;
      const initialSuccessful = engine.globalMetrics.successfulExecutions;

      await engine.executeQuantumRemediation();

      expect(engine.globalMetrics.totalExecutions).toBe(initialTotal + 1);
      expect(engine.globalMetrics.successfulExecutions).toBe(initialSuccessful + 1);
      expect(engine.globalMetrics.avgExecutionTime).toBeGreaterThan(0);
      expect(engine.globalMetrics.quantumEfficiency).toBeGreaterThan(0);
    });
  });

  describe('Quantum State Management', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should create quantum superposition states', async () => {
      const plan = {
        id: 'test-plan',
        tasks: [
          { id: 'task-1', parallelizable: true },
          { id: 'task-2', parallelizable: false }
        ],
        estimatedDuration: 1000
      };

      const states = await engine.createQuantumSuperposition(plan, {});

      expect(states).toHaveLength(3);
      expect(states[0].id).toBe('sequential-quantum');
      expect(states[1].id).toBe('parallel-quantum');
      expect(states[2].id).toBe('adaptive-quantum');
      
      states.forEach(state => {
        expect(state.quantumProperties).toBeDefined();
        expect(state.performance).toBeDefined();
        expect(state.probability).toBeGreaterThan(0);
      });
    });

    test('should optimize quantum entanglements', async () => {
      const states = [
        {
          id: 'test-state',
          plan: { tasks: [] },
          quantumProperties: { coherence: 0.8 },
          performance: { successProbability: 0.9 }
        }
      ];

      const optimized = await engine.optimizeQuantumEntanglements(states);

      expect(optimized).toHaveLength(1);
      expect(optimized[0].fitness).toBeDefined();
      expect(optimized[0].optimization).toBeDefined();
    });

    test('should calculate quantum fitness correctly', () => {
      const state = {
        performance: {
          successProbability: 0.9,
          resourceUsage: 0.6
        },
        quantumProperties: {
          coherence: 0.8,
          superposition: 0.7
        }
      };

      const fitness = engine.calculateQuantumFitness(state);

      expect(fitness).toBeGreaterThan(0);
      expect(fitness).toBeLessThanOrEqual(1);
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should set up performance monitoring', () => {
      const monitor = engine.setupPerformanceMonitoring('test-exec-123');

      expect(typeof monitor.stop).toBe('function');
      expect(typeof monitor.getMetrics).toBe('function');
      expect(typeof monitor.getOptimizations).toBe('function');

      const metrics = monitor.getMetrics();
      expect(metrics.memoryUsage).toBeInstanceOf(Array);
      expect(metrics.optimizations).toBeInstanceOf(Array);

      monitor.stop();
    });

    test('should emit performance alerts', (done) => {
      engine.on('performance-alert', (alert) => {
        expect(alert.type).toBe('memory');
        expect(alert.executionId).toBe('test-exec-123');
        done();
      });

      // Simulate high memory usage
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 900 * 1024 * 1024, // 900MB
        heapTotal: 1000 * 1024 * 1024 // 1GB
      });

      const monitor = engine.setupPerformanceMonitoring('test-exec-123');
      
      setTimeout(() => {
        monitor.stop();
      }, 1100);
    });

    test('should handle performance alerts', () => {
      const alert = {
        type: 'memory',
        value: 0.9,
        threshold: 0.8
      };

      const performanceOptimizationSpy = jest.fn();
      engine.on('performance-optimization', performanceOptimizationSpy);

      engine.handlePerformanceAlert(alert, 'test-exec-123');

      expect(performanceOptimizationSpy).toHaveBeenCalledWith({
        alert,
        executionId: 'test-exec-123'
      });
    });
  });

  describe('Self-Healing', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should set up self-healing mechanisms', () => {
      const healer = engine.setupSelfHealing('test-exec-123', {});

      expect(typeof healer.stop).toBe('function');
      expect(typeof healer.getActions).toBe('function');
      expect(typeof healer.forceHeal).toBe('function');

      const actions = healer.getActions();
      expect(actions).toBeInstanceOf(Array);

      healer.stop();
    });

    test('should detect error types correctly', () => {
      expect(engine.detectErrorType(new Error('Out of memory'))).toBe('memory');
      expect(engine.detectErrorType(new Error('Request timeout'))).toBe('timeout');
      expect(engine.detectErrorType(new Error('Rate limit exceeded'))).toBe('rate-limit');
      expect(engine.detectErrorType(new Error('Unknown error'))).toBe('unknown');
    });

    test('should apply self-healing for memory errors', async () => {
      const mockGC = jest.fn();
      global.gc = mockGC;

      const result = await engine.applySelfHealing(
        new Error('Out of memory'),
        { id: 'test-state' },
        'test-exec-123'
      );

      expect(result.healed).toBe(true);
      expect(result.newState).toBeDefined();
      expect(mockGC).toHaveBeenCalled();

      delete global.gc;
    });

    test('should apply self-healing for timeout errors', async () => {
      const originalState = {
        id: 'test-state',
        performance: { expectedTime: 1000 }
      };

      const result = await engine.applySelfHealing(
        new Error('Request timeout'),
        originalState,
        'test-exec-123'
      );

      expect(result.healed).toBe(true);
      expect(result.newState.performance.expectedTime).toBe(800); // 80% of original
    });

    test('should handle rate limit errors with delay', async () => {
      const startTime = Date.now();

      const result = await engine.applySelfHealing(
        new Error('Rate limit exceeded'),
        { id: 'test-state' },
        'test-exec-123'
      );

      const endTime = Date.now();

      expect(result.healed).toBe(true);
      expect(endTime - startTime).toBeGreaterThanOrEqual(1900); // At least 2 seconds minus test tolerance
    });

    test('should handle unknown errors gracefully', async () => {
      const result = await engine.applySelfHealing(
        new Error('Unknown error'),
        { id: 'test-state' },
        'test-exec-123'
      );

      expect(result.healed).toBe(false);
    });
  });

  describe('Quantum Efficiency Calculations', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should calculate quantum efficiency', () => {
      const result = {
        success: true,
        resourceUsage: 0.6,
        executionTime: 800,
        expectedTime: 1000
      };

      const efficiency = engine.calculateQuantumEfficiency(result);

      expect(efficiency).toBeGreaterThan(0);
      expect(efficiency).toBeLessThanOrEqual(1);
    });

    test('should calculate quantum advantage', () => {
      const result = {
        plan: { estimatedDuration: 1500 },
        resourceUsage: 0.5,
        parallelTasksExecuted: 3
      };
      const executionTime = 1000;

      const advantage = engine.calculateQuantumAdvantage(result, executionTime);

      expect(advantage.speedup).toBe(1.5);
      expect(advantage.resourceSavings).toBe(0.5);
      expect(advantage.parallelizationBonus).toBe(3);
      expect(advantage.overallAdvantage).toBeGreaterThan(0);
    });

    test('should measure quantum execution correctly', () => {
      const result = {
        success: true,
        quantumState: {
          quantumProperties: {
            coherence: 0.8,
            entanglement: 0.6,
            superposition: 0.7
          }
        },
        resourceUsage: 0.4,
        plan: { estimatedDuration: 1200 }
      };
      const startTime = Date.now() - 1000;

      const measurement = engine.measureQuantumExecution(result, startTime);

      expect(measurement.executionTime).toBeGreaterThan(990);
      expect(measurement.quantumEfficiency).toBeGreaterThan(0);
      expect(measurement.quantumMetrics).toBeDefined();
      expect(measurement.quantumMetrics.coherencePreserved).toBe(0.8);
      expect(measurement.quantumMetrics.entanglementUtilization).toBe(0.6);
      expect(measurement.quantumMetrics.superpositionCollapse).toBe(0.7);
      expect(measurement.quantumMetrics.quantumAdvantage).toBeDefined();
      expect(measurement.timestamp).toBeDefined();
    });
  });

  describe('Engine Status and Management', () => {
    test('should get engine status', () => {
      const status = engine.getEngineStatus();

      expect(status.isInitialized).toBe(false);
      expect(status.activeExecutions).toBe(0);
      expect(status.quantumStates).toBe(0);
      expect(status.globalMetrics).toBeDefined();
      expect(status.performanceMetrics).toBeDefined();
      expect(status.systemHealth).toBeDefined();
    });

    test('should shutdown gracefully', async () => {
      await engine.initialize();

      const shutdownSpy = jest.fn();
      engine.on('shutdown', shutdownSpy);

      await engine.shutdown();

      expect(engine.isInitialized).toBe(false);
      expect(mockPerformanceManager.shutdown).toHaveBeenCalled();
      expect(mockResilienceManager.shutdown).toHaveBeenCalled();
      expect(shutdownSpy).toHaveBeenCalledWith({
        timestamp: expect.any(String)
      });
    });

    test('should wait for active executions during shutdown', async () => {
      await engine.initialize();

      // Simulate active execution
      engine.activeExecusions.add('test-exec-1');

      const shutdownPromise = engine.shutdown();

      // Remove active execution after 500ms
      setTimeout(() => {
        engine.activeExecusions.delete('test-exec-1');
      }, 500);

      const startTime = Date.now();
      await shutdownPromise;
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Adaptive Optimization', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should perform adaptive optimization', async () => {
      const adaptiveOptimizationSpy = jest.fn();
      engine.on('adaptive-optimization', adaptiveOptimizationSpy);

      // Mock performance degradation
      mockPerformanceManager.getPerformanceReport.mockReturnValue({
        summary: { avgResponseTime: 3200000 } // 3.2 seconds (80% of 4 second limit)
      });

      await engine.performAdaptiveOptimization();

      expect(adaptiveOptimizationSpy).toHaveBeenCalledWith({
        type: 'performance-degradation',
        action: 'reduce-parallelism',
        timestamp: expect.any(Number)
      });

      expect(engine.globalMetrics.lastOptimization).toBeDefined();
    });

    test('should not optimize when performance is good', async () => {
      const adaptiveOptimizationSpy = jest.fn();
      engine.on('adaptive-optimization', adaptiveOptimizationSpy);

      // Mock good performance
      mockPerformanceManager.getPerformanceReport.mockReturnValue({
        summary: { avgResponseTime: 1000 } // Good performance
      });

      await engine.performAdaptiveOptimization();

      expect(adaptiveOptimizationSpy).not.toHaveBeenCalled();
      expect(engine.globalMetrics.lastOptimization).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should handle task planner failures', async () => {
      mockTaskPlanner.generateOptimalPlan.mockRejectedValue(new Error('Planning failed'));

      await expect(engine.executeQuantumRemediation()).rejects.toThrow('Planning failed');
    });

    test('should handle executor failures with self-healing', async () => {
      // First call fails, second succeeds after healing
      mockAutoExecutor.executeAutonomousRemediation
        .mockRejectedValueOnce(new Error('Out of memory'))
        .mockResolvedValueOnce({
          success: true,
          tasksExecuted: 1,
          tasksSucceeded: 1,
          tasksFailed: 0
        });

      const mockGC = jest.fn();
      global.gc = mockGC;

      const result = await engine.executeQuantumRemediation();

      expect(result.success).toBe(true);
      expect(mockGC).toHaveBeenCalled();

      delete global.gc;
    });

    test('should handle failures when self-healing is disabled', async () => {
      engine.options.selfHealingEnabled = false;
      mockAutoExecutor.executeAutonomousRemediation.mockRejectedValue(
        new Error('Execution failed')
      );

      await expect(engine.executeQuantumRemediation()).rejects.toThrow('Execution failed');
    });
  });

  describe('Integration with Performance and Resilience Managers', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should use performance manager for execution', async () => {
      await engine.executeQuantumRemediation();

      expect(mockPerformanceManager.executeWithPerformance).toHaveBeenCalledTimes(3);
      // Once for planning, once for execution
    });

    test('should use resilience manager for execution', async () => {
      await engine.executeQuantumRemediation();

      expect(mockResilienceManager.executeWithResilience).toHaveBeenCalledTimes(2);
      // Once for planning, once for execution
    });

    test('should handle performance manager failures', async () => {
      mockPerformanceManager.executeWithPerformance.mockRejectedValue(
        new Error('Performance manager failed')
      );

      await expect(engine.executeQuantumRemediation()).rejects.toThrow('Performance manager failed');
    });

    test('should handle resilience manager failures', async () => {
      mockResilienceManager.executeWithResilience.mockRejectedValue(
        new Error('Resilience manager failed')
      );

      await expect(engine.executeQuantumRemediation()).rejects.toThrow('Resilience manager failed');
    });
  });
});
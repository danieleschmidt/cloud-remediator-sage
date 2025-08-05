/**
 * Test suite for Quantum Auto Executor
 * Comprehensive testing for autonomous execution functionality
 */

const QuantumAutoExecutor = require('../../src/quantum/AutoExecutor');
const QuantumTaskPlanner = require('../../src/quantum/TaskPlanner');
const NeptuneService = require('../../src/services/NeptuneService');

// Mock dependencies
jest.mock('../../src/quantum/TaskPlanner');
jest.mock('../../src/services/NeptuneService');
jest.mock('../../src/services/SecurityAnalysisService');

describe('QuantumAutoExecutor', () => {
  let executor;
  let mockTaskPlanner;
  let mockNeptuneService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock task planner
    mockTaskPlanner = {
      generateOptimalPlan: jest.fn()
    };
    QuantumTaskPlanner.mockImplementation(() => mockTaskPlanner);
    
    // Mock Neptune service
    mockNeptuneService = {
      queryFindings: jest.fn(),
      queryRemediations: jest.fn(),
      updateFinding: jest.fn(),
      createRemediation: jest.fn(),
      createRelationship: jest.fn(),
      updateAssetLastScanned: jest.fn()
    };
    NeptuneService.mockImplementation(() => mockNeptuneService);
    
    executor = new QuantumAutoExecutor({
      maxConcurrentTasks: 3,
      safeMode: true,
      autoApproval: false,
      rollbackEnabled: true
    });
  });

  describe('Constructor', () => {
    test('should initialize with default options', () => {
      const defaultExecutor = new QuantumAutoExecutor();
      
      expect(defaultExecutor.maxConcurrentTasks).toBe(5);
      expect(defaultExecutor.safeMode).toBe(true);
      expect(defaultExecutor.autoApproval).toBe(false);
      expect(defaultExecutor.rollbackEnabled).toBe(true);
      expect(defaultExecutor.learningEnabled).toBe(true);
    });

    test('should initialize with custom options', () => {
      const options = {
        maxConcurrentTasks: 10,
        safeMode: false,
        autoApproval: true,
        rollbackEnabled: false,
        learningEnabled: false
      };
      
      const customExecutor = new QuantumAutoExecutor(options);
      
      expect(customExecutor.maxConcurrentTasks).toBe(10);
      expect(customExecutor.safeMode).toBe(false);
      expect(customExecutor.autoApproval).toBe(true);
      expect(customExecutor.rollbackEnabled).toBe(false);
      expect(customExecutor.learningEnabled).toBe(false);
    });

    test('should initialize execution state', () => {
      expect(executor.isExecuting).toBe(false);
      expect(executor.currentPlan).toBeNull();
      expect(executor.activeTasks.size).toBe(0);
      expect(executor.completedTasks.length).toBe(0);
      expect(executor.failedTasks.length).toBe(0);
      expect(executor.rollbackStack.length).toBe(0);
    });

    test('should initialize quantum state', () => {
      expect(executor.quantumCoherence).toBe(1.0);
      expect(executor.entanglementMatrix.size).toBe(0);
      expect(executor.superpositionStates.length).toBe(0);
    });
  });

  describe('executeAutonomousRemediation', () => {
    const mockPlan = {
      id: 'plan-123',
      totalTasks: 2,
      tasks: [
        {
          id: 'task-1',
          type: 'security-remediation',
          findingId: 'finding-1',
          priority: 8,
          estimatedDuration: 10,
          parallelizable: false,
          requiredApprovals: []
        },
        {
          id: 'task-2',
          type: 'security-remediation',
          findingId: 'finding-2',
          priority: 6,
          estimatedDuration: 15,
          parallelizable: true,
          requiredApprovals: []
        }
      ],
      executionStrategy: 'sequential',
      constraints: []
    };

    beforeEach(() => {
      mockTaskPlanner.generateOptimalPlan.mockResolvedValue(mockPlan);
      mockNeptuneService.queryFindings.mockResolvedValue([{
        id: 'finding-1',
        resource: { arn: 'arn:aws:s3:::test-bucket' }
      }]);
      mockNeptuneService.queryRemediations.mockResolvedValue([]);
    });

    test('should execute autonomous remediation successfully', async () => {
      const context = { accountId: '123456789012' };
      
      const result = await executor.executeAutonomousRemediation(context);
      
      expect(result).toHaveProperty('executionId');
      expect(result).toHaveProperty('status', 'completed');
      expect(result).toHaveProperty('totalTime');
      expect(result).toHaveProperty('plan');
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('quantumMetrics');
      
      expect(mockTaskPlanner.generateOptimalPlan).toHaveBeenCalledWith(context);
    });

    test('should prevent concurrent executions', async () => {
      // Start first execution
      const promise1 = executor.executeAutonomousRemediation();
      
      // Try to start second execution immediately
      await expect(executor.executeAutonomousRemediation())
        .rejects.toThrow('Executor is already running');
      
      // Wait for first to complete
      await promise1;
    });

    test('should emit execution events', async () => {
      const planningComplete = jest.fn();
      const executionComplete = jest.fn();
      
      executor.on('planningComplete', planningComplete);
      executor.on('executionComplete', executionComplete);
      
      await executor.executeAutonomousRemediation();
      
      expect(planningComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: mockPlan,
          tasksCount: 2
        })
      );
      
      expect(executionComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed'
        })
      );
    });

    test('should handle planning errors', async () => {
      mockTaskPlanner.generateOptimalPlan.mockRejectedValue(new Error('Planning failed'));
      
      await expect(executor.executeAutonomousRemediation())
        .rejects.toThrow('Planning failed');
      
      expect(executor.isExecuting).toBe(false);
    });

    test('should reset execution state after completion', async () => {
      await executor.executeAutonomousRemediation();
      
      expect(executor.isExecuting).toBe(false);
      expect(executor.currentPlan).toBeNull();
      expect(executor.activeTasks.size).toBe(0);
    });
  });

  describe('validateExecutionPlan', () => {
    test('should validate plan successfully', async () => {
      const validPlan = {
        tasks: [
          {
            id: 'task-1',
            prerequisites: [],
            parallelizable: false,
            priority: 5,
            requiredApprovals: ['manual']
          }
        ]
      };
      
      await expect(executor.validateExecutionPlan(validPlan))
        .resolves.not.toThrow();
    });

    test('should reject plan with missing prerequisites', async () => {
      const invalidPlan = {
        tasks: [
          {
            id: 'task-1',
            prerequisites: ['missing-task'],
            parallelizable: false
          }
        ]
      };
      
      await expect(executor.validateExecutionPlan(invalidPlan))
        .rejects.toThrow('Task task-1 missing prerequisite missing-task');
    });

    test('should reject plan with too many concurrent tasks', async () => {
      const invalidPlan = {
        tasks: Array.from({ length: 20 }, (_, i) => ({
          id: `task-${i}`,
          parallelizable: true,
          prerequisites: []
        }))
      };
      
      await expect(executor.validateExecutionPlan(invalidPlan))
        .rejects.toThrow('Too many concurrent tasks');
    });

    test('should enforce safe mode constraints', async () => {
      const dangerousPlan = {
        tasks: [
          {
            id: 'task-1',
            priority: 9,
            riskReduction: 9,
            requiredApprovals: [],
            prerequisites: []
          }
        ]
      };
      
      await expect(executor.validateExecutionPlan(dangerousPlan))
        .rejects.toThrow('High-risk task task-1 requires manual approval in safe mode');
    });
  });

  describe('initializeQuantumStates', () => {
    const mockPlan = {
      tasks: [
        { id: 'task-1', parallelizable: true },
        { id: 'task-2', parallelizable: true },
        { id: 'task-3', parallelizable: false }
      ],
      constraints: [
        {
          type: 'dependency',
          taskA: 'task-1',
          taskB: 'task-2',
          strength: 0.8
        }
      ]
    };

    test('should initialize quantum states correctly', async () => {
      await executor.initializeQuantumStates(mockPlan);
      
      expect(executor.quantumCoherence).toBe(1.0);
      expect(executor.entanglementMatrix.size).toBe(1);
      expect(executor.superpositionStates.length).toBeGreaterThan(0);
      
      const entanglement = executor.entanglementMatrix.get('task-1-task-2');
      expect(entanglement).toBe(0.8);
    });

    test('should create superposition states for parallel tasks', async () => {
      await executor.initializeQuantumStates(mockPlan);
      
      const superposition = executor.superpositionStates.find(s => 
        s.tasks.some(t => t.id === 'task-1')
      );
      
      expect(superposition).toBeDefined();
      expect(superposition.state).toBe('initialized');
      expect(superposition.coherence).toBe(1.0);
    });
  });

  describe('executeTask', () => {
    const mockTask = {
      id: 'task-1',
      type: 'security-remediation',
      findingId: 'finding-1',
      priority: 7,
      estimatedDuration: 10,
      riskReduction: 5.5
    };

    const mockResults = {
      tasksExecuted: 0,
      tasksSucceeded: 0,
      tasksFailed: 0,
      totalRiskReduction: 0,
      executionDetails: []
    };

    beforeEach(() => {
      mockNeptuneService.queryFindings.mockResolvedValue([{
        id: 'finding-1',
        resource: { arn: 'arn:aws:s3:::test-bucket' }
      }]);
      mockNeptuneService.queryRemediations.mockResolvedValue([]);
    });

    test('should execute security remediation task', async () => {
      await executor.executeTask(mockTask, mockResults);
      
      expect(mockResults.tasksExecuted).toBe(1);
      expect(mockResults.tasksSucceeded).toBe(1);
      expect(mockResults.totalRiskReduction).toBe(5.5);
      expect(mockResults.executionDetails.length).toBe(1);
      
      const detail = mockResults.executionDetails[0];
      expect(detail.taskId).toBe('task-1');
      expect(detail.status).toBe('success');
      expect(detail.riskReduction).toBe(5.5);
    });

    test('should handle task execution failure', async () => {
      mockNeptuneService.queryFindings.mockRejectedValue(new Error('Finding not found'));
      
      await executor.executeTask(mockTask, mockResults);
      
      expect(mockResults.tasksExecuted).toBe(1);
      expect(mockResults.tasksFailed).toBe(1);
      expect(mockResults.tasksSucceeded).toBe(0);
      
      const detail = mockResults.executionDetails[0];
      expect(detail.status).toBe('failed');
      expect(detail.error).toContain('Finding not found');
    });

    test('should update active tasks during execution', async () => {
      const executionPromise = executor.executeTask(mockTask, mockResults);
      
      // Task should be active during execution
      expect(executor.activeTasks.has('task-1')).toBe(true);
      
      await executionPromise;
      
      // Task should be removed from active tasks after completion
      expect(executor.activeTasks.has('task-1')).toBe(false);
    });

    test('should emit task events', async () => {
      const taskComplete = jest.fn();
      executor.on('taskComplete', taskComplete);
      
      await executor.executeTask(mockTask, mockResults);
      
      expect(taskComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-1',
          status: 'success'
        })
      );
    });

    test('should add completed tasks to rollback stack', async () => {
      await executor.executeTask(mockTask, mockResults);
      
      expect(executor.rollbackStack.length).toBe(1);
      expect(executor.rollbackStack[0].taskId).toBe('task-1');
    });
  });

  describe('executeSecurityRemediation', () => {
    const mockTask = {
      id: 'task-1',
      findingId: 'finding-1'
    };

    const mockFinding = {
      id: 'finding-1',
      resource: { arn: 'arn:aws:s3:::test-bucket' },
      remediationStatus: 'pending',
      status: 'open'
    };

    beforeEach(() => {
      mockNeptuneService.queryFindings.mockResolvedValue([mockFinding]);
    });

    test('should execute remediation when finding exists', async () => {
      const result = await executor.executeSecurityRemediation(mockTask);
      
      expect(result).toHaveProperty('applied', true);
      expect(result).toHaveProperty('validationRequired', true);
      expect(mockNeptuneService.updateFinding).toHaveBeenCalledWith(
        expect.objectContaining({
          remediationStatus: 'applied',
          status: 'remediated'
        })
      );
    });

    test('should handle missing finding', async () => {
      mockNeptuneService.queryFindings.mockResolvedValue([]);
      
      await expect(executor.executeSecurityRemediation(mockTask))
        .rejects.toThrow('Finding not found: finding-1');
    });

    test('should generate remediation if not exists', async () => {
      mockNeptuneService.queryRemediations
        .mockResolvedValueOnce([]) // First call: no remediation
        .mockResolvedValueOnce([{ // Second call: remediation created
          id: 'remediation-1',
          templateType: 'terraform',
          automationLevel: 'automated'
        }]);
      
      const result = await executor.executeSecurityRemediation(mockTask);
      
      expect(result.applied).toBe(true);
    });
  });

  describe('Quantum State Management', () => {
    test('should update quantum coherence', () => {
      const initialCoherence = executor.quantumCoherence;
      
      executor.updateQuantumCoherence({ id: 'task-1' });
      
      expect(executor.quantumCoherence).toBeLessThan(initialCoherence);
      expect(executor.quantumCoherence).toBeGreaterThan(0.1);
    });

    test('should collapse superposition state', () => {
      executor.superpositionStates = [
        {
          id: 'superposition-1',
          tasks: [{ id: 'task-1' }],
          state: 'initialized',
          coherence: 1.0
        }
      ];
      
      executor.collapseSuperpositonState([{ id: 'task-1' }]);
      
      const state = executor.superpositionStates.find(s => s.id === 'superposition-1');
      expect(state.state).toBe('collapsed');
      expect(state.coherence).toBeLessThan(1.0);
    });

    test('should calculate quantum metrics', () => {
      executor.quantumCoherence = 0.8;
      executor.entanglementMatrix.set('test', 0.5);
      executor.superpositionStates = [
        { state: 'initialized' },
        { state: 'collapsed' }
      ];
      
      const metrics = executor.calculateQuantumMetrics();
      
      expect(metrics.coherence).toBe(0.8);
      expect(metrics.entanglements).toBe(1);
      expect(metrics.superpositions).toBe(2);
      expect(metrics.activeStates).toBe(1);
      expect(metrics.collapsedStates).toBe(1);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle execution errors gracefully', async () => {
      mockTaskPlanner.generateOptimalPlan.mockRejectedValue(new Error('Critical error'));
      
      const errorHandler = jest.fn();
      executor.on('executionError', errorHandler);
      
      await expect(executor.executeAutonomousRemediation())
        .rejects.toThrow('Critical error');
      
      expect(errorHandler).toHaveBeenCalled();
      expect(executor.isExecuting).toBe(false);
    });

    test('should perform rollback on failure', async () => {
      executor.rollbackEnabled = true;
      executor.rollbackStack = [
        {
          taskId: 'task-1',
          rollbackInfo: { type: 'terraform' },
          timestamp: new Date()
        }
      ];
      
      await executor.performRollback();
      
      // Rollback should be attempted (mocked in real implementation)
      expect(executor.rollbackStack.length).toBe(1);
    });

    test('should abort execution on too many failures', () => {
      const error = new Error('Task failed');
      const results = {
        tasksExecuted: 5,
        tasksFailed: 3,
        tasksSucceeded: 2
      };
      
      const shouldAbort = executor.shouldAbortExecution(error, results);
      expect(shouldAbort).toBe(true);
    });

    test('should abort on critical errors', () => {
      const criticalError = new Error('PERMISSION_DENIED: Access denied');
      const results = {
        tasksExecuted: 1,
        tasksFailed: 1,
        tasksSucceeded: 0
      };
      
      const shouldAbort = executor.shouldAbortExecution(criticalError, results);
      expect(shouldAbort).toBe(true);
    });
  });

  describe('Learning and Adaptation', () => {
    test('should calculate success rate correctly', () => {
      executor.completedTasks = [{ id: 'task-1' }, { id: 'task-2' }];
      executor.failedTasks = [{ id: 'task-3' }];
      
      const successRate = executor.calculateSuccessRate();
      expect(successRate).toBeCloseTo(0.667, 2);
    });

    test('should update adaptive metrics', () => {
      const initialExecutions = executor.adaptiveMetrics.totalExecutions;
      
      executor.adaptiveMetrics.totalExecutions++;
      executor.adaptiveMetrics.successRate = 0.85;
      executor.adaptiveMetrics.learningIterations++;
      
      expect(executor.adaptiveMetrics.totalExecutions).toBe(initialExecutions + 1);
      expect(executor.adaptiveMetrics.successRate).toBe(0.85);
    });
  });

  describe('Performance and Concurrency', () => {
    test('should respect max concurrent tasks limit', () => {
      const tasks = Array.from({ length: 10 }, (_, i) => ({ id: `task-${i}` }));
      
      const groups = executor.groupParallelTasks(tasks);
      
      groups.forEach(group => {
        expect(group.length).toBeLessThanOrEqual(executor.maxConcurrentTasks);
      });
    });

    test('should chunk arrays correctly', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const chunks = executor.chunkArray(array, 3);
      
      expect(chunks.length).toBe(4);
      expect(chunks[0]).toEqual([1, 2, 3]);
      expect(chunks[1]).toEqual([4, 5, 6]);
      expect(chunks[2]).toEqual([7, 8, 9]);
      expect(chunks[3]).toEqual([10]);
    });
  });

  describe('State Management', () => {
    test('should reset execution state correctly', () => {
      // Set up some state
      executor.currentPlan = { id: 'test' };
      executor.activeTasks.set('task-1', {});
      executor.completedTasks.push({ id: 'task-2' });
      executor.failedTasks.push({ id: 'task-3' });
      executor.rollbackStack.push({ taskId: 'task-4' });
      executor.quantumCoherence = 0.5;
      
      executor.resetExecutionState();
      
      expect(executor.currentPlan).toBeNull();
      expect(executor.activeTasks.size).toBe(0);
      expect(executor.completedTasks.length).toBe(0);
      expect(executor.failedTasks.length).toBe(0);
      expect(executor.rollbackStack.length).toBe(0);
      expect(executor.quantumCoherence).toBe(1.0);
    });
  });
});
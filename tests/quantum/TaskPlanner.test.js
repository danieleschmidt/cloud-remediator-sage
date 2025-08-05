/**
 * Test suite for Quantum Task Planner
 * Comprehensive testing for quantum-inspired task planning functionality
 */

const QuantumTaskPlanner = require('../../src/quantum/TaskPlanner');
const NeptuneService = require('../../src/services/NeptuneService');
const { Finding, Asset } = require('../../src/models');

// Mock Neptune service
jest.mock('../../src/services/NeptuneService');
jest.mock('../../src/services/SecurityAnalysisService');

describe('QuantumTaskPlanner', () => {
  let taskPlanner;
  let mockNeptuneService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock Neptune service
    mockNeptuneService = {
      queryFindings: jest.fn(),
      getAsset: jest.fn(),
      getAssetDependencies: jest.fn(),
      getAssetDependents: jest.fn()
    };
    
    NeptuneService.mockImplementation(() => mockNeptuneService);
    
    taskPlanner = new QuantumTaskPlanner({
      maxParallelTasks: 5,
      superpositionStates: 4,
      entanglementThreshold: 0.8
    });
  });

  describe('Constructor', () => {
    test('should initialize with default options', () => {
      const planner = new QuantumTaskPlanner();
      
      expect(planner.maxParallelTasks).toBe(10);
      expect(planner.quantumSuperpositionStates).toBe(8);
      expect(planner.entanglementThreshold).toBe(0.75);
      expect(planner.planningHorizon).toBe(30);
    });

    test('should initialize with custom options', () => {
      const options = {
        maxParallelTasks: 15,
        superpositionStates: 6,
        entanglementThreshold: 0.9,
        planningHorizon: 60
      };
      
      const planner = new QuantumTaskPlanner(options);
      
      expect(planner.maxParallelTasks).toBe(15);
      expect(planner.quantumSuperpositionStates).toBe(6);
      expect(planner.entanglementThreshold).toBe(0.9);
      expect(planner.planningHorizon).toBe(60);
    });

    test('should initialize metrics', () => {
      expect(taskPlanner.metrics).toEqual({
        tasksPlanned: 0,
        superpositionStates: 0,
        entanglements: 0,
        optimizationCycles: 0,
        executionTime: 0
      });
    });
  });

  describe('generateOptimalPlan', () => {
    const mockFindings = [
      {
        id: 'finding-1',
        severity: 'critical',
        category: 'security',
        riskScore: 9.5,
        resource: { arn: 'arn:aws:s3:::test-bucket' },
        createdAt: new Date()
      },
      {
        id: 'finding-2',
        severity: 'high',
        category: 'configuration',
        riskScore: 7.8,
        resource: { arn: 'arn:aws:ec2:us-east-1:123456789012:instance/i-1234567890abcdef0' },
        createdAt: new Date()
      }
    ];

    const mockAsset = {
      arn: 'arn:aws:s3:::test-bucket',
      service: 's3',
      region: 'us-east-1',
      criticality: 'high',
      getCriticalityScore: () => 8,
      isPubliclyAccessible: () => false,
      containsSensitiveData: () => true
    };

    beforeEach(() => {
      mockNeptuneService.queryFindings.mockResolvedValue(mockFindings);
      mockNeptuneService.getAsset.mockResolvedValue(mockAsset);
      mockNeptuneService.getAssetDependencies.mockResolvedValue([]);
      mockNeptuneService.getAssetDependents.mockResolvedValue([]);
    });

    test('should generate optimal plan with quantum optimization', async () => {
      const context = { accountId: '123456789012' };
      
      const plan = await taskPlanner.generateOptimalPlan(context);
      
      expect(plan).toHaveProperty('id');
      expect(plan).toHaveProperty('selectedState');
      expect(plan).toHaveProperty('totalTasks');
      expect(plan).toHaveProperty('estimatedDuration');
      expect(plan).toHaveProperty('tasks');
      expect(plan).toHaveProperty('metrics');
      expect(plan).toHaveProperty('quantumProperties');
      
      expect(plan.totalTasks).toBeGreaterThan(0);
      expect(plan.tasks).toBeInstanceOf(Array);
      expect(plan.metrics).toHaveProperty('totalRiskReduction');
    });

    test('should create quantum tasks from findings', async () => {
      const context = {};
      
      const plan = await taskPlanner.generateOptimalPlan(context);
      
      expect(plan.tasks.length).toBeGreaterThan(0);
      
      const task = plan.tasks[0];
      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('type', 'security-remediation');
      expect(task).toHaveProperty('priority');
      expect(task).toHaveProperty('quantumWeight');
      expect(task).toHaveProperty('quantumProperties');
      
      expect(task.quantumProperties).toHaveProperty('coherence');
      expect(task.quantumProperties).toHaveProperty('entanglement');
      expect(task.quantumProperties).toHaveProperty('superposition');
    });

    test('should calculate quantum metrics correctly', async () => {
      const plan = await taskPlanner.generateOptimalPlan();
      
      expect(plan.quantumProperties).toHaveProperty('coherence');
      expect(plan.quantumProperties).toHaveProperty('entanglement');
      expect(plan.quantumProperties).toHaveProperty('superposition');
      expect(plan.quantumProperties).toHaveProperty('quantumAdvantage');
      expect(plan.quantumProperties).toHaveProperty('uncertaintyPrinciple');
      
      expect(plan.quantumProperties.coherence).toBeGreaterThanOrEqual(0);
      expect(plan.quantumProperties.coherence).toBeLessThanOrEqual(1);
    });

    test('should handle empty findings gracefully', async () => {
      mockNeptuneService.queryFindings.mockResolvedValue([]);
      
      const plan = await taskPlanner.generateOptimalPlan();
      
      expect(plan.totalTasks).toBeGreaterThanOrEqual(0);
      expect(plan.tasks).toBeInstanceOf(Array);
    });

    test('should filter by context parameters', async () => {
      const context = {
        accountId: '123456789012',
        region: 'us-west-2',
        minRiskScore: 8.0
      };
      
      await taskPlanner.generateOptimalPlan(context);
      
      expect(mockNeptuneService.queryFindings).toHaveBeenCalledWith({
        status: 'open',
        accountId: '123456789012',
        region: 'us-west-2',
        minRiskScore: 8.0
      });
    });
  });

  describe('createQuantumTask', () => {
    const mockFinding = {
      id: 'finding-test',
      severity: 'high',
      category: 'security',
      riskScore: 8.5,
      resource: { arn: 'arn:aws:s3:::test-bucket' },
      createdAt: new Date()
    };

    const mockAsset = {
      arn: 'arn:aws:s3:::test-bucket',
      service: 's3',
      region: 'us-east-1',
      getCriticalityScore: () => 7,
      isPubliclyAccessible: () => true,
      containsSensitiveData: () => false
    };

    beforeEach(() => {
      mockNeptuneService.getAsset.mockResolvedValue(mockAsset);
    });

    test('should create quantum task from finding', async () => {
      const task = await taskPlanner.createQuantumTask(mockFinding);
      
      expect(task).toHaveProperty('id', 'task-finding-test');
      expect(task).toHaveProperty('type', 'security-remediation');
      expect(task).toHaveProperty('findingId', 'finding-test');
      expect(task).toHaveProperty('assetArn', 'arn:aws:s3:::test-bucket');
      expect(task).toHaveProperty('priority');
      expect(task).toHaveProperty('quantumWeight');
      expect(task).toHaveProperty('estimatedDuration');
      expect(task).toHaveProperty('riskReduction', 8.5);
      expect(task).toHaveProperty('quantumProperties');
    });

    test('should calculate quantum properties correctly', async () => {
      const task = await taskPlanner.createQuantumTask(mockFinding);
      
      expect(task.quantumProperties.coherence).toBeGreaterThanOrEqual(0);
      expect(task.quantumProperties.coherence).toBeLessThanOrEqual(1);
      expect(task.quantumProperties.entanglement).toBe(0);
      expect(task.quantumProperties.superposition).toBeGreaterThanOrEqual(0);
      expect(task.quantumProperties.superposition).toBeLessThanOrEqual(1);
    });

    test('should handle missing asset gracefully', async () => {
      mockNeptuneService.getAsset.mockResolvedValue(null);
      
      const task = await taskPlanner.createQuantumTask(mockFinding);
      
      expect(task).toBeNull();
    });

    test('should set parallelizable flag correctly', async () => {
      const configurationFinding = {
        ...mockFinding,
        category: 'configuration'
      };
      
      const task = await taskPlanner.createQuantumTask(configurationFinding);
      
      expect(task.parallelizable).toBe(true);
    });
  });

  describe('createSuperpositionStates', () => {
    const mockTasks = [
      {
        id: 'task-1',
        priority: 9,
        estimatedDuration: 10,
        parallelizable: true
      },
      {
        id: 'task-2',
        priority: 7,
        estimatedDuration: 15,
        parallelizable: true
      },
      {
        id: 'task-3',
        priority: 5,
        estimatedDuration: 20,
        parallelizable: false
      }
    ];

    test('should create superposition states', async () => {
      const states = await taskPlanner.createSuperpositionStates(mockTasks);
      
      expect(states).toBeInstanceOf(Array);
      expect(states.length).toBeGreaterThan(0);
      
      // Should include sequential state
      const sequentialState = states.find(s => s.type === 'sequential');
      expect(sequentialState).toBeDefined();
      expect(sequentialState.probability).toBeCloseTo(0.3);
      
      // Should include parallel states
      const parallelStates = states.filter(s => s.type === 'parallel');
      expect(parallelStates.length).toBeGreaterThan(0);
    });

    test('should calculate execution times correctly', async () => {
      const states = await taskPlanner.createSuperpositionStates(mockTasks);
      
      const sequentialState = states.find(s => s.type === 'sequential');
      expect(sequentialState.estimatedTime).toBe(45); // Sum of all durations

      const parallelStates = states.filter(s => s.type === 'parallel');
      parallelStates.forEach(state => {
        expect(state.estimatedTime).toBeLessThanOrEqual(45);
      });
    });

    test('should create hybrid states for large task sets', async () => {
      const largeTasks = Array.from({ length: 10 }, (_, i) => ({
        id: `task-${i}`,
        priority: i > 5 ? 9 : 5,
        estimatedDuration: 10,
        parallelizable: true
      }));
      
      const states = await taskPlanner.createSuperpositionStates(largeTasks);
      
      const hybridState = states.find(s => s.type === 'hybrid');
      expect(hybridState).toBeDefined();
      expect(hybridState.phases).toBeDefined();
      expect(hybridState.phases.length).toBe(2);
    });
  });

  describe('detectTaskEntanglements', () => {
    const mockTasks = [
      {
        id: 'task-1',
        assetArn: 'arn:aws:s3:::bucket1',
        metadata: { service: 's3', region: 'us-east-1', category: 'security' },
        quantumProperties: { entanglement: 0 }
      },
      {
        id: 'task-2',
        assetArn: 'arn:aws:s3:::bucket2',
        metadata: { service: 's3', region: 'us-east-1', category: 'security' },
        quantumProperties: { entanglement: 0 }
      },
      {
        id: 'task-3',
        assetArn: 'arn:aws:ec2:us-west-2:123456789012:instance/i-1234567890abcdef0',
        metadata: { service: 'ec2', region: 'us-west-2', category: 'configuration' },
        quantumProperties: { entanglement: 0 }
      }
    ];

    beforeEach(() => {
      mockNeptuneService.getAsset.mockResolvedValue({});
      mockNeptuneService.getAssetDependencies.mockResolvedValue([]);
      mockNeptuneService.getAssetDependents.mockResolvedValue([]);
    });

    test('should detect task entanglements', async () => {
      const entanglements = await taskPlanner.detectTaskEntanglements(mockTasks);
      
      expect(entanglements).toBeInstanceOf(Array);
      
      // Should find entanglements between similar tasks
      const s3Entanglement = entanglements.find(e => 
        (e.taskA === 'task-1' && e.taskB === 'task-2') ||
        (e.taskA === 'task-2' && e.taskB === 'task-1')
      );
      
      if (s3Entanglement) {
        expect(s3Entanglement.strength).toBeGreaterThan(0);
        expect(s3Entanglement.type).toBeDefined();
        expect(s3Entanglement.constraint).toBeDefined();
      }
    });

    test('should update task quantum properties', async () => {
      await taskPlanner.detectTaskEntanglements(mockTasks);
      
      mockTasks.forEach(task => {
        expect(task.quantumProperties.entanglement).toBeGreaterThanOrEqual(0);
        expect(task.quantumProperties.entanglement).toBeLessThanOrEqual(1);
      });
    });

    test('should handle asset dependencies', async () => {
      const mockDependents = [
        { arn: 'arn:aws:s3:::bucket2' }
      ];
      
      mockNeptuneService.getAssetDependents.mockResolvedValue(mockDependents);
      
      const entanglements = await taskPlanner.detectTaskEntanglements(mockTasks);
      
      // Should create stronger entanglements for dependent assets
      const dependentEntanglement = entanglements.find(e => e.strength > 0.5);
      expect(dependentEntanglement).toBeDefined();
    });
  });

  describe('calculateQuantumWeight', () => {
    const mockFinding = {
      riskScore: 8.5,
      severity: 'high',
      calculateAge: () => 5
    };

    const mockAsset = {
      getCriticalityScore: () => 7,
      criticality: 'high',
      isPubliclyAccessible: () => true,
      containsSensitiveData: () => false
    };

    test('should calculate quantum weight correctly', () => {
      const weight = taskPlanner.calculateQuantumWeight(mockFinding, mockAsset);
      
      expect(weight).toBeGreaterThan(0);
      expect(weight).toBeLessThanOrEqual(20); // Reasonable upper bound
    });

    test('should weight risk score heavily', () => {
      const highRiskFinding = { ...mockFinding, riskScore: 9.8 };
      const lowRiskFinding = { ...mockFinding, riskScore: 2.1 };
      
      const highWeight = taskPlanner.calculateQuantumWeight(highRiskFinding, mockAsset);
      const lowWeight = taskPlanner.calculateQuantumWeight(lowRiskFinding, mockAsset);
      
      expect(highWeight).toBeGreaterThan(lowWeight);
    });

    test('should consider asset criticality', () => {
      const criticalAsset = { ...mockAsset, getCriticalityScore: () => 10 };
      const normalAsset = { ...mockAsset, getCriticalityScore: () => 3 };
      
      const criticalWeight = taskPlanner.calculateQuantumWeight(mockFinding, criticalAsset);
      const normalWeight = taskPlanner.calculateQuantumWeight(mockFinding, normalAsset);
      
      expect(criticalWeight).toBeGreaterThan(normalWeight);
    });
  });

  describe('calculateQuantumPriority', () => {
    const mockFinding = {
      riskScore: 8.0,
      severity: 'high',
      compliance: [{ framework: 'pci-dss' }],
      calculateAge: () => 3
    };

    const mockAsset = {
      getCriticalityScore: () => 6
    };

    test('should calculate WSJF priority correctly', () => {
      const priority = taskPlanner.calculateQuantumPriority(mockFinding, mockAsset);
      
      expect(priority).toBeGreaterThan(0);
      expect(typeof priority).toBe('number');
    });

    test('should return 0 for zero effort', () => {
      // Mock finding that would result in zero effort
      const zeroEffortFinding = { ...mockFinding, subcategory: 'unknown' };
      
      // The calculateQuantumPriority method should handle division by zero
      const priority = taskPlanner.calculateQuantumPriority(zeroEffortFinding, mockAsset);
      
      expect(priority).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Utility Methods', () => {
    test('calculateUrgencyScore should work correctly', () => {
      const criticalFinding = { severity: 'critical', calculateAge: () => 10 };
      const infoFinding = { severity: 'info', calculateAge: () => 1 };
      
      const criticalUrgency = taskPlanner.calculateUrgencyScore(criticalFinding);
      const infoUrgency = taskPlanner.calculateUrgencyScore(infoFinding);
      
      expect(criticalUrgency).toBeGreaterThan(infoUrgency);
      expect(criticalUrgency).toBeGreaterThan(0);
    });

    test('calculateBusinessImpact should consider asset properties', () => {
      const criticalAsset = {
        criticality: 'critical',
        environment: 'production',
        isPubliclyAccessible: () => true,
        containsSensitiveData: () => true
      };
      
      const normalAsset = {
        criticality: 'low',
        environment: 'development',
        isPubliclyAccessible: () => false,
        containsSensitiveData: () => false
      };
      
      const criticalImpact = taskPlanner.calculateBusinessImpact({}, criticalAsset);
      const normalImpact = taskPlanner.calculateBusinessImpact({}, normalAsset);
      
      expect(criticalImpact).toBeGreaterThan(normalImpact);
    });

    test('isParallelizable should identify parallelizable tasks', () => {
      const configFinding = { category: 'configuration' };
      const s3Finding = { subcategory: 's3' };
      const complexFinding = { subcategory: 'iam' };
      
      expect(taskPlanner.isParallelizable(configFinding)).toBe(true);
      expect(taskPlanner.isParallelizable(s3Finding)).toBe(true);
      expect(taskPlanner.isParallelizable(complexFinding)).toBe(false);
    });

    test('estimateTaskDuration should return reasonable durations', () => {
      const s3Finding = { subcategory: 's3' };
      const rdsBinding = { subcategory: 'rds' };
      const unknownFinding = { subcategory: 'unknown' };
      
      expect(taskPlanner.estimateTaskDuration(s3Finding)).toBe(5);
      expect(taskPlanner.estimateTaskDuration(rdsBinding)).toBe(30);
      expect(taskPlanner.estimateTaskDuration(unknownFinding)).toBe(20);
    });
  });

  describe('Error Handling', () => {
    test('should handle Neptune service errors gracefully', async () => {
      mockNeptuneService.queryFindings.mockRejectedValue(new Error('Neptune error'));
      
      const plan = await taskPlanner.generateOptimalPlan();
      
      // Should return a plan even if some operations fail
      expect(plan).toHaveProperty('tasks');
      expect(plan.tasks).toBeInstanceOf(Array);
    });

    test('should handle asset loading errors', async () => {
      mockNeptuneService.queryFindings.mockResolvedValue([{
        id: 'finding-1',
        resource: { arn: 'arn:aws:s3:::test' }
      }]);
      mockNeptuneService.getAsset.mockRejectedValue(new Error('Asset not found'));
      
      const plan = await taskPlanner.generateOptimalPlan();
      
      // Should handle missing assets gracefully
      expect(plan).toHaveProperty('tasks');
    });
  });

  describe('Performance', () => {
    test('should complete planning within reasonable time', async () => {
      const startTime = Date.now();
      
      await taskPlanner.generateOptimalPlan();
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // 5 seconds max
    });

    test('should handle large task sets efficiently', async () => {
      const largeFindingSet = Array.from({ length: 100 }, (_, i) => ({
        id: `finding-${i}`,
        resource: { arn: `arn:aws:s3:::bucket-${i}` },
        severity: 'medium',
        riskScore: 5.0
      }));
      
      mockNeptuneService.queryFindings.mockResolvedValue(largeFindingSet);
      
      const startTime = Date.now();
      const plan = await taskPlanner.generateOptimalPlan();
      const duration = Date.now() - startTime;
      
      expect(plan.totalTasks).toBeGreaterThan(0);
      expect(duration).toBeLessThan(10000); // 10 seconds max for large sets
    });
  });
});
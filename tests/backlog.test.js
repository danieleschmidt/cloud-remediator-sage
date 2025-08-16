const { describe, test, expect, beforeEach } = require('@jest/globals');
const fs = require('fs');
const BacklogDiscovery = require('../src/backlog/discovery');
const WSJFScoring = require('../src/backlog/wsjf');
const BacklogExecutor = require('../src/backlog/executor');
const MetricsReporter = require('../src/backlog/metrics');

// Mock file system and child_process
jest.mock('fs');
jest.mock('child_process');

describe('Autonomous Backlog Management System', () => {
  describe('BacklogDiscovery', () => {
    let discovery;

    beforeEach(() => {
      discovery = new BacklogDiscovery();
      jest.clearAllMocks();
    });

    test('should load YAML backlog correctly', () => {
      const mockYaml = `backlog:
  - id: "TEST-001"
    title: "Test item"
    type: "feature"
    effort: 3
    value: 5
    time_criticality: 3
    risk_reduction: 2
    status: "NEW"`;

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(mockYaml);

      const items = discovery.loadYamlBacklog();
      
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('TEST-001');
      expect(items[0].title).toBe('Test item');
    });

    test('should handle missing backlog file gracefully', () => {
      fs.existsSync.mockReturnValue(false);
      
      const items = discovery.loadYamlBacklog();
      
      expect(items).toEqual([]);
    });

    test('should categorize GitHub issues correctly', () => {
      const bugIssue = {
        title: 'Fix critical bug in authentication',
        labels: [{ name: 'bug' }],
        body: 'This is a critical bug'
      };

      const featureIssue = {
        title: 'Add new dashboard feature',
        labels: [{ name: 'enhancement' }],
        body: 'Add a new dashboard'
      };

      expect(discovery.categorizeIssue(bugIssue)).toBe('bug');
      expect(discovery.categorizeIssue(featureIssue)).toBe('feature');
    });

    test('should estimate effort based on content length', () => {
      const shortIssue = {
        title: 'Fix',
        body: 'Quick fix',
        labels: []
      };

      const longIssue = {
        title: 'Implement complex feature with multiple components and integration tests',
        body: 'This is a very detailed description that explains all the requirements and acceptance criteria for this complex feature that will take significant effort to implement properly with all the necessary components, tests, documentation, and integration work required.',
        labels: []
      };

      expect(discovery.estimateEffort(shortIssue)).toBeLessThan(discovery.estimateEffort(longIssue));
    });

    test('should deduplicate items correctly', () => {
      const items = [
        { title: 'Fix bug', type: 'bug' },
        { title: 'Fix bug', type: 'bug' },
        { title: 'Add feature', type: 'feature' }
      ];

      const deduplicated = discovery.deduplicateItems(items);
      
      expect(deduplicated).toHaveLength(2);
    });
  });

  describe('WSJFScoring', () => {
    let scoring;

    beforeEach(() => {
      scoring = new WSJFScoring();
    });

    test('should calculate WSJF correctly', () => {
      const item = {
        value: 8,
        time_criticality: 5,
        risk_reduction: 3,
        effort: 2,
        created_at: '2025-07-20'
      };

      const result = scoring.calculateWSJF(item);
      
      expect(result.cost_of_delay).toBe(16); // 8 + 5 + 3
      expect(result.base_wsjf).toBe(8); // 16 / 2
      expect(result.final_wsjf).toBeGreaterThan(result.base_wsjf); // Should include aging
    });

    test('should validate fibonacci numbers', () => {
      expect(scoring.validateFibonacci(7, 'test')).toBe(8); // Closest fibonacci
      expect(scoring.validateFibonacci(3, 'test')).toBe(3); // Exact match
      expect(scoring.validateFibonacci(-1, 'test')).toBe(3); // Invalid, default to 3
    });

    test('should handle zero effort by throwing error', () => {
      const item = {
        value: 5,
        time_criticality: 3,
        risk_reduction: 2,
        effort: 0,
        created_at: '2025-07-20'
      };

      expect(() => scoring.calculateWSJF(item)).toThrow('Effort cannot be zero');
    });

    test('should apply aging multiplier correctly', () => {
      const oldDate = '2025-06-01'; // ~55 days ago
      const newDate = '2025-07-25'; // ~1 day ago

      const oldMultiplier = scoring.calculateAgingMultiplier(oldDate);
      const newMultiplier = scoring.calculateAgingMultiplier(newDate);

      expect(oldMultiplier).toBeGreaterThan(newMultiplier);
      expect(oldMultiplier).toBeLessThanOrEqual(2.0);
    });

    test('should sort backlog by WSJF correctly', () => {
      const items = [
        {
          id: 'LOW',
          value: 2,
          time_criticality: 2,
          risk_reduction: 2,
          effort: 3,
          created_at: '2025-07-25'
        },
        {
          id: 'HIGH',
          value: 13,
          time_criticality: 8,
          risk_reduction: 8,
          effort: 2,
          created_at: '2025-07-25'
        }
      ];

      const sorted = scoring.scoreAndSortBacklog(items);
      
      expect(sorted[0].id).toBe('HIGH');
      expect(sorted[1].id).toBe('LOW');
    });

    test('should get next ready item correctly', () => {
      const items = [
        { id: 'NEW-1', status: 'NEW', wsjf: { final_wsjf: 5 } },
        { id: 'READY-1', status: 'READY', wsjf: { final_wsjf: 3 } },
        { id: 'DONE-1', status: 'DONE', wsjf: { final_wsjf: 10 } }
      ];

      const nextItem = scoring.getNextReadyItem(items);
      
      expect(nextItem.id).toBe('READY-1'); // READY status has priority
    });

    test('should calculate backlog metrics correctly', () => {
      const items = [
        { status: 'NEW' },
        { status: 'NEW' },
        { status: 'READY' },
        { status: 'DONE', created_at: '2025-07-20', completed_at: '2025-07-25' },
        { status: 'DONE', created_at: '2025-07-21', completed_at: '2025-07-25' }
      ];

      const metrics = scoring.getBacklogMetrics(items);
      
      expect(metrics.backlog_size_by_status.NEW).toBe(2);
      expect(metrics.backlog_size_by_status.READY).toBe(1);
      expect(metrics.backlog_size_by_status.DONE).toBe(2);
      expect(metrics.total_items).toBe(5);
    });
  });

  describe('BacklogExecutor', () => {
    let executor;

    beforeEach(() => {
      executor = new BacklogExecutor({ maxPRsPerDay: 3 });
      jest.clearAllMocks();
    });

    test('should initialize with correct options', () => {
      expect(executor.maxPRsPerDay).toBe(3);
      expect(executor.currentPRCount).toBe(0);
    });

    test('should throttle PRs when limit reached', () => {
      executor.currentPRCount = 3;
      
      expect(executor.shouldThrottlePRs()).toBe(true);
    });

    test('should generate appropriate commit messages', () => {
      const featureTask = { type: 'feature', title: 'Add new API endpoint' };
      const bugTask = { type: 'bug', title: 'Fix authentication issue' };

      const featureCommit = executor.generateCommitMessage(featureTask);
      const bugCommit = executor.generateCommitMessage(bugTask);

      expect(featureCommit).toMatch(/^feat:/);
      expect(bugCommit).toMatch(/^fix:/);
      expect(featureCommit).toContain('Claude Code');
      expect(bugCommit).toContain('Claude Code');
    });

    test('should generate acceptance criteria when missing', () => {
      const task = { title: 'Test task', type: 'feature' };
      
      const criteria = executor.generateAcceptanceCriteria(task);
      
      expect(criteria).toBeInstanceOf(Array);
      expect(criteria.length).toBeGreaterThan(0);
      expect(criteria[0]).toContain('Implementation follows');
    });

    test('should generate test templates correctly', () => {
      const task = { id: 'TEST-001', title: 'Test feature', type: 'feature' };
      
      const template = executor.generateTestTemplate(task);
      
      expect(template).toContain('TEST-001');
      expect(template).toContain('Test feature');
      expect(template).toContain("describe('Test feature'");
    });
  });

  describe('MetricsReporter', () => {
    let reporter;

    beforeEach(() => {
      reporter = new MetricsReporter();
      jest.clearAllMocks();
    });

    test('should calculate backlog metrics correctly', async () => {
      const backlog = [
        { status: 'NEW' },
        { status: 'READY' },
        { status: 'DONE' },
        { status: 'DONE' }
      ];

      const metrics = await reporter.calculateMetrics(backlog, []);
      
      expect(metrics.total_items).toBe(4);
      expect(metrics.completed_count).toBe(2);
      expect(metrics.completion_rate).toBe('50.0');
    });

    test('should identify stale items correctly', () => {
      const oldDate = '2025-06-01';
      const newDate = new Date().toISOString().split('T')[0]; // Today's date

      expect(reporter.isStale(oldDate, 7)).toBe(true);
      expect(reporter.isStale(newDate, 7)).toBe(false);
      expect(reporter.isStale(null, 7)).toBe(false);
    });

    test('should calculate average cycle time correctly', () => {
      const completedTasks = [
        {
          created_at: '2025-07-20',
          completed_at: '2025-07-22' // 48 hours
        },
        {
          created_at: '2025-07-21', 
          completed_at: '2025-07-22' // 24 hours
        }
      ];

      const avgTime = reporter.calculateAverageCycleTime(completedTasks);
      
      expect(avgTime).toBe(36); // (48 + 24) / 2
    });

    test('should handle empty completed tasks', () => {
      const avgTime = reporter.calculateAverageCycleTime([]);
      
      expect(avgTime).toBe(0);
    });

    test('should get top WSJF items correctly', () => {
      const backlog = [
        { id: 'HIGH', status: 'NEW', wsjf: { final_wsjf: 10 }, title: 'High priority' },
        { id: 'MED', status: 'READY', wsjf: { final_wsjf: 5 }, title: 'Medium priority' },
        { id: 'DONE', status: 'DONE', wsjf: { final_wsjf: 15 }, title: 'Completed' }
      ];

      const topItems = reporter.getTopWSJFItems(backlog);
      
      expect(topItems).toHaveLength(2); // Only NEW, REFINED, READY items
      expect(topItems[0].id).toBe('HIGH');
      expect(topItems[1].id).toBe('MED');
    });

    test('should generate markdown report with correct structure', () => {
      const mockReport = {
        timestamp: '2025-07-26T12:00:00.000Z',
        completed_ids: ['TASK-001'],
        coverage_delta: '+2.5',
        ci_summary: 'passing',
        open_prs: 3,
        backlog_size_by_status: { NEW: 5, READY: 2, DONE: 10 },
        dora: {
          deploy_freq: '2',
          lead_time: '4',
          change_fail_rate: '5.0',
          mttr: '2'
        },
        wsjf_snapshot: [
          { id: 'TOP-1', title: 'Top priority task', wsjf: 15 }
        ],
        risks_or_blocks: ['1 critical vulnerability'],
        rerere_auto_resolved_total: 5,
        merge_driver_hits_total: 3,
        ci_failure_rate: '10.0',
        pr_backoff_state: 'inactive'
      };

      const markdown = reporter.generateMarkdownReport(mockReport);
      
      expect(markdown).toContain('# Autonomous Backlog Management Report');
      expect(markdown).toContain('**Completed Tasks:** 1');
      expect(markdown).toContain('**NEW:** 5');
      expect(markdown).toContain('**Deployment Frequency:** 2 per day');
      expect(markdown).toContain('1. **Top priority task**');
      expect(markdown).toContain('⚠️  1 critical vulnerability');
    });
  });

  describe('Integration Tests', () => {
    test('should complete full discovery and scoring workflow', async () => {
      const discovery = new BacklogDiscovery();
      const scoring = new WSJFScoring();

      // Mock YAML backlog
      const mockYaml = `backlog:
  - id: "INT-001"
    title: "Integration test item"
    type: "feature"
    effort: 3
    value: 8
    time_criticality: 5
    risk_reduction: 3
    status: "NEW"
    created_at: "2025-07-25"`;

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(mockYaml);

      // Mock GitHub issues (empty)
      const { execSync } = require('child_process');
      execSync.mockReturnValue('[]');

      const items = await discovery.discoverAll();
      const scoredItems = scoring.scoreAndSortBacklog(items);

      expect(scoredItems).toHaveLength(1);
      expect(scoredItems[0].wsjf).toBeDefined();
      expect(scoredItems[0].wsjf.final_wsjf).toBeGreaterThan(0);
    });

    test('should handle errors gracefully in discovery', async () => {
      const discovery = new BacklogDiscovery();

      // Mock file system errors
      fs.existsSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      const items = await discovery.discoverAll();
      
      expect(items).toEqual([]); // Should return empty array on error
    });
  });
});
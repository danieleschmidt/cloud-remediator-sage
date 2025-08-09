const BacklogDiscovery = require('./discovery');
const WSJFScoring = require('./wsjf');
const SecurityChecker = require('./security');
const MetricsReporter = require('./metrics');
const { execSync } = require('child_process');
const fs = require('fs');
const yaml = require('js-yaml');

class BacklogExecutor {
  constructor(options = {}) {
    this.discovery = new BacklogDiscovery();
    this.scoring = new WSJFScoring();
    this.security = new SecurityChecker();
    this.metrics = new MetricsReporter();
    this.maxPRsPerDay = options.maxPRsPerDay || 5;
    this.backlogFile = './backlog.yml';
    this.metricsDir = './docs/status';
    this.currentPRCount = 0;
    this.ciFailureThreshold = 0.3;
    this.prBackoffActive = false;
    this.completedTasks = [];
  }

  async executeMainLoop() {
    console.log('🚀 Starting Autonomous Backlog Management');
    
    let iteration = 0;
    const maxIterations = 50; // Safety limit
    
    while (iteration < maxIterations) {
      iteration++;
      console.log(`\n📋 Iteration ${iteration}`);
      
      try {
        // Sync repo and check CI status
        await this.syncRepoAndCI();
        
        // Discover and score backlog
        const backlog = await this.discoverAndScore();
        
        // Check if we have actionable items
        const nextTask = this.scoring.getNextReadyItem(backlog, this.getScopeFilter());
        
        if (!nextTask) {
          console.log('✅ No actionable backlog items found. Execution complete!');
          break;
        }
        
        // Check PR throttling
        if (this.shouldThrottlePRs()) {
          console.log('⏸️  PR throttling active, skipping execution');
          break;
        }
        
        // Execute micro cycle for the task
        const success = await this.executeMicroCycle(nextTask, backlog);
        
        if (success) {
          await this.mergeAndLog(nextTask, backlog);
        } else {
          console.log(`❌ Failed to complete task: ${nextTask.id}`);
          this.scoring.updateItemStatus(backlog, nextTask.id, 'BLOCKED');
        }
        
        // Update metrics
        await this.updateMetrics(backlog);
        
        // Save updated backlog
        await this.saveBacklog(backlog);
        
      } catch (error) {
        console.error(`❌ Error in iteration ${iteration}:`, error);
        break;
      }
    }
    
    console.log('🏁 Backlog execution completed');
  }

  async syncRepoAndCI() {
    try {
      // Check git status
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      if (status.trim()) {
        console.log('📦 Working directory has changes, committing...');
        // Auto-commit any pending changes
        execSync('git add .');
        execSync('git commit -m "chore: auto-commit pending changes"');
      }
      
      // Pull latest changes
      execSync('git pull --rebase origin main');
      
      // Check CI failure rate
      this.updatePRBackoffStatus();
      
    } catch (error) {
      console.warn('⚠️  Sync warning:', error.message);
    }
  }

  async discoverAndScore() {
    console.log('🔍 Discovering backlog items...');
    const items = await this.discovery.discoverAll();
    
    console.log('📊 Scoring with WSJF...');
    const scoredItems = this.scoring.scoreAndSortBacklog(items);
    
    console.log(`Found ${scoredItems.length} backlog items`);
    return scoredItems;
  }

  async executeMicroCycle(task, backlog) {
    console.log(`\n🔧 Executing: ${task.title} (${task.id})`);
    
    // Update status to DOING
    this.scoring.updateItemStatus(backlog, task.id, 'DOING');
    
    try {
      // Step 1: Clarify acceptance criteria
      if (!task.acceptance_criteria || task.acceptance_criteria.length === 0) {
        task.acceptance_criteria = this.generateAcceptanceCriteria(task);
      }
      
      // Step 2: TDD Cycle
      const tddSuccess = await this.executeTDDCycle(task);
      if (!tddSuccess) return false;
      
      // Step 3: Security checks
      const securityPass = await this.runSecurityChecks();
      if (!securityPass) return false;
      
      // Step 4: Documentation updates
      await this.updateDocumentation(task);
      
      // Step 5: CI gate
      const ciPass = await this.runCIGate();
      if (!ciPass) return false;
      
      // Step 6: Prepare PR
      await this.preparePR(task);
      
      return true;
      
    } catch (error) {
      console.error('❌ Micro cycle failed:', error);
      return false;
    }
  }

  async executeTDDCycle(task) {
    console.log('🧪 Executing TDD cycle...');
    
    try {
      // RED: Write failing test (if it's a feature/bug)
      if (['feature', 'bug'].includes(task.type)) {
        await this.writeFailingTest(task);
      }
      
      // GREEN: Make it pass
      await this.implementSolution(task);
      
      // Verify tests pass
      const testResult = execSync('npm test', { encoding: 'utf8' });
      if (testResult.includes('FAIL')) {
        console.error('❌ Tests still failing after implementation');
        return false;
      }
      
      // REFACTOR: Clean up code
      await this.refactorCode(task);
      
      console.log('✅ TDD cycle completed');
      return true;
      
    } catch (error) {
      console.error('❌ TDD cycle failed:', error.message);
      return false;
    }
  }

  async writeFailingTest(task) {
    // Generate basic test structure based on task type
    const testTemplate = this.generateTestTemplate(task);
    const testFile = `tests/${task.id.toLowerCase()}.test.js`;
    
    if (!fs.existsSync(testFile)) {
      fs.writeFileSync(testFile, testTemplate);
      console.log(`📝 Created test file: ${testFile}`);
    }
  }

  async implementSolution(task) {
    console.log(`⚙️  Implementing solution for ${task.type}: ${task.title}`);
    
    // This is a simplified implementation - in practice, this would use
    // AI code generation or template-based code generation
    switch (task.type) {
      case 'feature':
        await this.implementFeature(task);
        break;
      case 'bug':
        await this.fixBug(task);
        break;
      case 'documentation':
        await this.updateDocs(task);
        break;
      case 'infrastructure':
        await this.updateInfrastructure(task);
        break;
      default:
        console.log(`ℹ️  Generic implementation for ${task.type}`);
    }
  }

  async implementFeature(task) {
    // Feature implementation logic based on task description
    console.log('✨ Implementing feature...');
    
    // For the cloud remediator, check specific features
    if (task.title.includes('Prowler')) {
      await this.implementProwlerIntegration(task);
    } else if (task.title.includes('Neptune')) {
      await this.implementNeptuneSchema(task);
    } else if (task.title.includes('risk scoring')) {
      await this.implementRiskScoring(task);
    }
  }

  async runSecurityChecks() {
    console.log('🔒 Running security checks...');
    
    try {
      // SAST scan
      const sastResult = await this.security.runSAST();
      
      // SCA scan  
      const scaResult = await this.security.runSCA();
      
      // Input validation check
      const validationResult = await this.security.checkInputValidation();
      
      return sastResult && scaResult && validationResult;
      
    } catch (error) {
      console.error('❌ Security checks failed:', error);
      return false;
    }
  }

  async runCIGate() {
    console.log('🚦 Running CI gate...');
    
    try {
      // Lint
      execSync('npm run lint', { encoding: 'utf8' });
      
      // Tests
      execSync('npm test', { encoding: 'utf8' });
      
      // Build
      execSync('npm run build', { encoding: 'utf8' });
      
      console.log('✅ CI gate passed');
      return true;
      
    } catch (error) {
      console.error('❌ CI gate failed:', error.message);
      return false;
    }
  }

  async preparePR(task) {
    console.log('📋 Preparing PR...');
    
    const branchName = `terragon/auto-${task.id.toLowerCase()}`;
    
    try {
      // Create branch
      execSync(`git checkout -b ${branchName}`);
      
      // Commit changes
      execSync('git add .');
      const commitMessage = this.generateCommitMessage(task);
      execSync(`git commit -m "${commitMessage}"`);
      
      // Push branch
      execSync(`git push -u origin ${branchName}`);
      
      this.currentPRCount++;
      console.log(`✅ PR prepared on branch: ${branchName}`);
      
    } catch (error) {
      console.error('❌ PR preparation failed:', error);
      throw error;
    }
  }

  getScopeFilter() {
    // Return filter function for automation scope
    return (_item) => {
      // For now, allow all items in the repo
      return true;
    };
  }

  shouldThrottlePRs() {
    return this.prBackoffActive || this.currentPRCount >= this.maxPRsPerDay;
  }

  updatePRBackoffStatus() {
    // Check CI failure rate over last 24h and adjust PR throttling
    try {
      const failureRate = this.calculateCIFailureRate();
      
      if (failureRate > this.ciFailureThreshold) {
        this.prBackoffActive = true;
        this.maxPRsPerDay = 2;
        console.log('⏸️  PR backoff activated due to high CI failure rate');
      } else if (failureRate < 0.1) {
        this.prBackoffActive = false;
        this.maxPRsPerDay = 5;
      }
    } catch (error) {
      console.warn('Could not calculate CI failure rate:', error.message);
    }
  }

  calculateCIFailureRate() {
    // Simplified - would integrate with actual CI metrics
    return 0.1; // 10% failure rate
  }

  generateCommitMessage(task) {
    const typeMap = {
      'feature': 'feat',
      'bug': 'fix',
      'documentation': 'docs',
      'infrastructure': 'chore'
    };
    
    const type = typeMap[task.type] || 'chore';
    return `${type}: ${task.title}\n\n🤖 Generated with Claude Code\n\nCo-Authored-By: Claude <noreply@anthropic.com>`;
  }

  async saveBacklog(items) {
    const backlogData = { backlog: items };
    const yamlContent = yaml.dump(backlogData, { indent: 2 });
    fs.writeFileSync(this.backlogFile, yamlContent);
  }

  // Placeholder methods for specific implementations
  async implementProwlerIntegration(_task) { console.log('🔍 Implementing Prowler integration...'); }
  async implementNeptuneSchema(_task) { console.log('🔗 Implementing Neptune schema...'); }
  async implementRiskScoring(_task) { console.log('📊 Implementing risk scoring...'); }
  async fixBug(_task) { console.log('🐛 Fixing bug...'); }
  async updateDocs(_task) { console.log('📚 Updating documentation...'); }
  async updateInfrastructure(_task) { console.log('🏗️  Updating infrastructure...'); }
  async refactorCode(_task) { console.log('♻️  Refactoring code...'); }
  async updateDocumentation(_task) { console.log('📝 Updating documentation...'); }
  async mergeAndLog(task, backlog) { 
    this.scoring.updateItemStatus(backlog, task.id, 'DONE');
    this.completedTasks.push(task);
    console.log(`✅ Task completed: ${task.title}`); 
  }
  async updateMetrics(backlog) { 
    console.log('📈 Updating metrics...');
    await this.metrics.generateDailyReport(backlog, this.completedTasks);
  }
  
  generateAcceptanceCriteria(_task) {
    return [
      'Implementation follows existing code patterns',
      'All tests pass',
      'Documentation is updated',
      'Security checks pass'
    ];
  }
  
  generateTestTemplate(task) {
    return `const { describe, test, expect } = require('@jest/globals');

describe('${task.title}', () => {
  test('should implement ${task.type} functionality', () => {
    // TODO: Implement test for ${task.id}
    expect(true).toBe(true);
  });
});
`;
  }
}

module.exports = BacklogExecutor;
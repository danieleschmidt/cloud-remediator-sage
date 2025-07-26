#!/usr/bin/env node

const BacklogExecutor = require('./executor');
const fs = require('fs');

class AutonomousBacklogManager {
  constructor() {
    this.executor = new BacklogExecutor({
      maxPRsPerDay: process.env.MAX_PRS_PER_DAY || 5
    });
  }

  async run() {
    console.log('🤖 AUTONOMOUS SENIOR CODING ASSISTANT');
    console.log('📋 DISCOVER, PRIORITIZE, EXECUTE ALL BACKLOG');
    console.log('═'.repeat(50));
    
    try {
      // Check automation scope
      this.checkAutomationScope();
      
      // Initialize required directories
      this.initializeDirectories();
      
      // Run the main execution loop
      await this.executor.executeMainLoop();
      
      console.log('\n✅ Autonomous backlog management completed successfully');
      
    } catch (error) {
      console.error('\n❌ Autonomous backlog management failed:', error);
      process.exit(1);
    }
  }

  checkAutomationScope() {
    const scopeFile = './.automation-scope.yaml';
    
    if (fs.existsSync(scopeFile)) {
      console.log('📋 Found automation scope configuration');
      // In practice, this would parse and validate the scope file
    } else {
      console.log('📋 Using default scope: current repository only');
    }
  }

  initializeDirectories() {
    const dirs = [
      './docs/status',
      './docs/sbom',
      './reports',
      './cache/nvd',
      './security'
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      }
    });
  }
}

// CLI interface
if (require.main === module) {
  const manager = new AutonomousBacklogManager();
  manager.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = AutonomousBacklogManager;
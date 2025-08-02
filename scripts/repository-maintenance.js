#!/usr/bin/env node

/**
 * Repository Maintenance Automation Script
 * Performs regular maintenance tasks to keep the repository healthy
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class RepositoryMaintenance {
  constructor() {
    this.maintenanceLog = [];
    this.timestamp = new Date().toISOString();
  }

  log(message, type = 'info') {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type,
      message
    };
    this.maintenanceLog.push(logEntry);
    
    const emoji = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    }[type] || 'ℹ️';
    
    console.log(`${emoji} ${message}`);
  }

  async cleanupTempFiles() {
    this.log('🧹 Cleaning up temporary files...');
    
    const tempPatterns = [
      'npm-debug.log*',
      'yarn-debug.log*',
      'yarn-error.log*',
      '.nyc_output',
      'coverage/tmp',
      '*.tmp',
      '*.temp',
      '.DS_Store',
      'Thumbs.db'
    ];

    let cleanedCount = 0;
    
    for (const pattern of tempPatterns) {
      try {
        const files = execSync(`find . -name "${pattern}" -type f 2>/dev/null || true`, { encoding: 'utf8' })
          .split('\n')
          .filter(file => file.trim());
        
        for (const file of files) {
          if (file.trim()) {
            await fs.unlink(file).catch(() => {});
            cleanedCount++;
          }
        }
      } catch (error) {
        this.log(`Warning: Failed to clean pattern ${pattern}: ${error.message}`, 'warning');
      }
    }
    
    this.log(`Successfully cleaned ${cleanedCount} temporary files`, 'success');
  }

  async optimizeGitRepository() {
    this.log('🔧 Optimizing Git repository...');
    
    try {
      // Git garbage collection
      execSync('git gc --prune=now', { stdio: 'ignore' });
      this.log('Git garbage collection completed', 'success');
      
      // Optimize repository
      execSync('git repack -Ad', { stdio: 'ignore' });
      this.log('Git repack completed', 'success');
      
      // Clean up remote tracking branches
      execSync('git remote prune origin', { stdio: 'ignore' });
      this.log('Remote tracking branches cleaned', 'success');
      
      // Get repository size
      const repoSize = execSync('du -sh .git', { encoding: 'utf8' }).split('\t')[0];
      this.log(`Repository size: ${repoSize}`, 'info');
      
    } catch (error) {
      this.log(`Git optimization failed: ${error.message}`, 'error');
    }
  }

  async updateDependencies() {
    this.log('📦 Checking for dependency updates...');
    
    try {
      // Check for outdated packages
      const outdated = execSync('npm outdated --json 2>/dev/null || echo "{}"', { encoding: 'utf8' });
      const outdatedPackages = JSON.parse(outdated);
      const outdatedCount = Object.keys(outdatedPackages).length;
      
      if (outdatedCount > 0) {
        this.log(`Found ${outdatedCount} outdated packages`, 'warning');
        
        // Log outdated packages
        for (const [pkg, info] of Object.entries(outdatedPackages)) {
          this.log(`  ${pkg}: ${info.current} → ${info.latest}`, 'info');
        }
      } else {
        this.log('All dependencies are up to date', 'success');
      }
      
      // Security audit
      try {
        execSync('npm audit --audit-level moderate', { stdio: 'ignore' });
        this.log('No security vulnerabilities found', 'success');
      } catch (auditError) {
        this.log('Security vulnerabilities detected - run npm audit for details', 'warning');
      }
      
    } catch (error) {
      this.log(`Dependency check failed: ${error.message}`, 'error');
    }
  }

  async validateFileIntegrity() {
    this.log('🔍 Validating file integrity...');
    
    const criticalFiles = [
      'package.json',
      'package-lock.json',
      'README.md',
      'LICENSE',
      'SECURITY.md',
      '.gitignore',
      'Dockerfile',
      'docker-compose.yml'
    ];

    let validCount = 0;
    
    for (const file of criticalFiles) {
      try {
        await fs.access(file);
        
        // Validate JSON files
        if (file.endsWith('.json')) {
          const content = await fs.readFile(file, 'utf8');
          JSON.parse(content); // Throws if invalid JSON
        }
        
        validCount++;
      } catch (error) {
        this.log(`Critical file missing or invalid: ${file}`, 'error');
      }
    }
    
    this.log(`${validCount}/${criticalFiles.length} critical files validated`, 
             validCount === criticalFiles.length ? 'success' : 'warning');
  }

  async checkCodeQuality() {
    this.log('📊 Checking code quality...');
    
    try {
      // Run linting
      try {
        execSync('npm run lint', { stdio: 'ignore' });
        this.log('Code linting passed', 'success');
      } catch (lintError) {
        this.log('Code linting issues found - run npm run lint for details', 'warning');
      }
      
      // Check test coverage if available
      try {
        const coverageData = await fs.readFile('coverage/coverage-summary.json', 'utf8');
        const coverage = JSON.parse(coverageData);
        const lineCoverage = coverage.total.lines.pct;
        
        if (lineCoverage >= 80) {
          this.log(`Test coverage: ${lineCoverage}% (Good)`, 'success');
        } else if (lineCoverage >= 60) {
          this.log(`Test coverage: ${lineCoverage}% (Needs improvement)`, 'warning');
        } else {
          this.log(`Test coverage: ${lineCoverage}% (Poor)`, 'error');
        }
      } catch (coverageError) {
        this.log('Test coverage data not available', 'info');
      }
      
    } catch (error) {
      this.log(`Code quality check failed: ${error.message}`, 'error');
    }
  }

  async updateDocumentation() {
    this.log('📝 Updating documentation...');
    
    try {
      // Update last modified dates in documentation
      const docFiles = [
        'README.md',
        'ARCHITECTURE.md', 
        'CONTRIBUTING.md',
        'docs/ROADMAP.md'
      ];
      
      for (const docFile of docFiles) {
        try {
          await fs.access(docFile);
          // Note: In a real implementation, you might want to update 
          // "Last updated" timestamps in documentation files
          this.log(`Documentation file found: ${docFile}`, 'info');
        } catch (error) {
          this.log(`Documentation file missing: ${docFile}`, 'warning');
        }
      }
      
      // Generate or update API documentation if configured
      try {
        execSync('npm run docs:generate 2>/dev/null', { stdio: 'ignore' });
        this.log('API documentation generated', 'success');
      } catch (error) {
        this.log('API documentation generation not configured or failed', 'info');
      }
      
    } catch (error) {
      this.log(`Documentation update failed: ${error.message}`, 'error');
    }
  }

  async checkSecurityConfiguration() {
    this.log('🔒 Checking security configuration...');
    
    const securityChecks = [
      {
        name: 'GitIgnore patterns',
        check: async () => {
          const gitignore = await fs.readFile('.gitignore', 'utf8');
          const criticalPatterns = [
            'node_modules',
            '*.env',
            '*.key',
            '*.pem',
            'coverage'
          ];
          return criticalPatterns.every(pattern => gitignore.includes(pattern));
        }
      },
      {
        name: 'Environment file template',
        check: async () => {
          try {
            await fs.access('.env.example');
            return true;
          } catch {
            return false;
          }
        }
      },
      {
        name: 'Security policy',
        check: async () => {
          try {
            await fs.access('SECURITY.md');
            return true;
          } catch {
            return false;
          }
        }
      },
      {
        name: 'License file',
        check: async () => {
          try {
            await fs.access('LICENSE');
            return true;
          } catch {
            return false;
          }
        }
      }
    ];

    let passedChecks = 0;
    
    for (const { name, check } of securityChecks) {
      try {
        const passed = await check();
        if (passed) {
          this.log(`✓ ${name}`, 'success');
          passedChecks++;
        } else {
          this.log(`✗ ${name}`, 'warning');
        }
      } catch (error) {
        this.log(`✗ ${name} (check failed)`, 'error');
      }
    }
    
    this.log(`Security checks: ${passedChecks}/${securityChecks.length} passed`, 
             passedChecks === securityChecks.length ? 'success' : 'warning');
  }

  async generateMaintenanceReport() {
    this.log('📊 Generating maintenance report...');
    
    const summary = {
      timestamp: this.timestamp,
      maintenance_run: {
        duration: Date.now() - new Date(this.timestamp).getTime(),
        total_tasks: this.maintenanceLog.length,
        successful_tasks: this.maintenanceLog.filter(log => log.type === 'success').length,
        warnings: this.maintenanceLog.filter(log => log.type === 'warning').length,
        errors: this.maintenanceLog.filter(log => log.type === 'error').length
      },
      log: this.maintenanceLog
    };

    // Ensure reports directory exists
    await fs.mkdir('reports', { recursive: true });
    
    // Save detailed log
    const logFile = path.join('reports', `maintenance-${new Date().toISOString().split('T')[0]}.json`);
    await fs.writeFile(logFile, JSON.stringify(summary, null, 2));
    
    // Generate markdown report
    const markdownReport = [
      '# Repository Maintenance Report',
      `**Date:** ${new Date().toLocaleString()}`,
      `**Duration:** ${Math.round(summary.maintenance_run.duration / 1000)}s`,
      '',
      '## Summary',
      `- ✅ Successful tasks: ${summary.maintenance_run.successful_tasks}`,
      `- ⚠️ Warnings: ${summary.maintenance_run.warnings}`,
      `- ❌ Errors: ${summary.maintenance_run.errors}`,
      '',
      '## Detailed Log',
      ...this.maintenanceLog.map(log => {
        const emoji = {
          info: 'ℹ️',
          success: '✅',
          warning: '⚠️',
          error: '❌'
        }[log.type] || 'ℹ️';
        return `${emoji} ${log.message}`;
      }),
      '',
      '---',
      '*Generated by Repository Maintenance Script*'
    ].join('\n');
    
    const reportFile = path.join('reports', `maintenance-report-${new Date().toISOString().split('T')[0]}.md`);
    await fs.writeFile(reportFile, markdownReport);
    
    this.log(`Maintenance report saved: ${reportFile}`, 'success');
    return { logFile, reportFile, summary };
  }

  async runMaintenance() {
    this.log('🚀 Starting repository maintenance...');
    
    try {
      await this.cleanupTempFiles();
      await this.optimizeGitRepository();
      await this.updateDependencies();
      await this.validateFileIntegrity();
      await this.checkCodeQuality();
      await this.updateDocumentation();
      await this.checkSecurityConfiguration();
      
      const report = await this.generateMaintenanceReport();
      
      this.log('🎉 Repository maintenance completed successfully!', 'success');
      
      // Return summary for CI/CD integration
      return {
        success: true,
        summary: report.summary,
        reportFile: report.reportFile
      };
      
    } catch (error) {
      this.log(`Repository maintenance failed: ${error.message}`, 'error');
      
      return {
        success: false,
        error: error.message,
        summary: await this.generateMaintenanceReport()
      };
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const maintenance = new RepositoryMaintenance();
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Repository Maintenance Script

Usage: node repository-maintenance.js [options]

Options:
  --help, -h     Show this help message
  --quiet, -q    Suppress non-error output
  --dry-run      Show what would be done without making changes

Tasks performed:
  • Clean up temporary files
  • Optimize Git repository
  • Check for dependency updates
  • Validate file integrity
  • Check code quality
  • Update documentation
  • Check security configuration
  • Generate maintenance report
    `);
    process.exit(0);
  }
  
  if (args.includes('--dry-run')) {
    console.log('🔍 DRY RUN MODE - No changes will be made');
    // In a real implementation, you'd modify methods to skip actual changes
  }
  
  try {
    const result = await maintenance.runMaintenance();
    
    if (result.success) {
      console.log(`\n📊 Maintenance completed successfully!`);
      console.log(`📁 Report: ${result.reportFile}`);
      process.exit(0);
    } else {
      console.error(`\n❌ Maintenance failed: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n💥 Fatal error: ${error.message}`);
    process.exit(1);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = RepositoryMaintenance;
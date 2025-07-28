/**
 * Integration tests for autonomous backlog management system
 * Tests end-to-end functionality including discovery, analysis, and execution
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Import modules under test
const BacklogDiscovery = require('../../src/backlog/discovery');
const BacklogExecutor = require('../../src/backlog/executor');
const SecurityAnalyzer = require('../../src/backlog/security');
const WSJFCalculator = require('../../src/backlog/wsjf');

describe('Autonomous Backlog Management Integration', () => {
  const testWorkspace = path.join(__dirname, '../fixtures/test-workspace');
  const originalCwd = process.cwd();

  beforeEach(() => {
    // Create test workspace
    if (fs.existsSync(testWorkspace)) {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    }
    fs.mkdirSync(testWorkspace, { recursive: true });
    
    // Initialize git repo in test workspace
    process.chdir(testWorkspace);
    execSync('git init');
    execSync('git config user.email "test@example.com"');
    execSync('git config user.name "Test User"');
    
    // Create sample project structure
    fs.mkdirSync('src', { recursive: true });
    fs.mkdirSync('tests', { recursive: true });
    fs.mkdirSync('docs', { recursive: true });
    
    // Create package.json
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        'express': '^4.18.0',
        'lodash': '^4.17.21'
      },
      devDependencies: {
        'jest': '^29.0.0'
      }
    };
    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
    
    // Create sample source files with security issues
    fs.writeFileSync('src/app.js', `
const express = require('express');
const app = express();

// Security issue: Missing input validation
app.get('/user/:id', (req, res) => {
  const userId = req.params.id; // No validation
  // Potential SQL injection vulnerability
  const query = \`SELECT * FROM users WHERE id = '\${userId}'\`;
  res.json({ query });
});

module.exports = app;
    `);
    
    // Create sample test file
    fs.writeFileSync('tests/app.test.js', `
const app = require('../src/app');

describe('App', () => {
  it('should handle user requests', () => {
    expect(app).toBeDefined();
  });
});
    `);
    
    // Initial commit
    execSync('git add .');
    execSync('git commit -m "Initial commit"');
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(testWorkspace)) {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    }
  });

  describe('End-to-End Backlog Processing', () => {
    it('should discover, analyze, prioritize, and execute security improvements', async () => {
      // Phase 1: Discovery
      const discovery = new BacklogDiscovery(testWorkspace);
      const discoveredItems = await discovery.scanForImprovements();
      
      expect(discoveredItems).toBeDefined();
      expect(discoveredItems.length).toBeGreaterThan(0);
      
      // Should discover security issues
      const securityItems = discoveredItems.filter(item => 
        item.category === 'security' || item.tags?.includes('security')
      );
      expect(securityItems.length).toBeGreaterThan(0);

      // Phase 2: Security Analysis
      const securityAnalyzer = new SecurityAnalyzer(testWorkspace);
      const securityAnalysis = await securityAnalyzer.analyzeVulnerabilities();
      
      expect(securityAnalysis).toBeDefined();
      expect(securityAnalysis.vulnerabilities).toBeDefined();
      expect(securityAnalysis.riskScore).toBeGreaterThan(0);

      // Phase 3: Prioritization using WSJF
      const wsjfCalculator = new WSJFCalculator();
      const prioritizedItems = discoveredItems.map(item => {
        const wsjfScore = wsjfCalculator.calculateScore({
          businessValue: item.businessValue || 5,
          urgency: item.urgency || 3,
          jobSize: item.jobSize || 2
        });
        return { ...item, wsjfScore };
      }).sort((a, b) => b.wsjfScore - a.wsjfScore);

      expect(prioritizedItems[0].wsjfScore).toBeGreaterThanOrEqual(prioritizedItems[1]?.wsjfScore || 0);

      // Phase 4: Execution
      const executor = new BacklogExecutor(testWorkspace);
      const executionResult = await executor.executeItem(prioritizedItems[0]);
      
      expect(executionResult).toBeDefined();
      expect(executionResult.success).toBe(true);
      expect(executionResult.changes).toBeDefined();
    }, 60000);

    it('should handle security vulnerability detection and remediation', async () => {
      // Test specific security vulnerability detection
      const securityAnalyzer = new SecurityAnalyzer(testWorkspace);
      const vulnerabilities = await securityAnalyzer.scanForVulnerabilities();
      
      expect(vulnerabilities).toBeDefined();
      expect(Array.isArray(vulnerabilities)).toBe(true);
      
      // Should detect SQL injection vulnerability
      const sqlInjectionVuln = vulnerabilities.find(v => 
        v.type === 'sql_injection' || v.description?.includes('injection')
      );
      expect(sqlInjectionVuln).toBeDefined();
      
      // Should detect missing input validation
      const validationVuln = vulnerabilities.find(v => 
        v.type === 'input_validation' || v.description?.includes('validation')
      );
      expect(validationVuln).toBeDefined();
    });

    it('should maintain git history during automated changes', async () => {
      const executor = new BacklogExecutor(testWorkspace);
      const initialCommitCount = execSync('git rev-list --count HEAD').toString().trim();
      
      // Execute a backlog item that makes changes
      const testItem = {
        id: 'test-security-fix',
        title: 'Add input validation',
        description: 'Add input validation to user endpoint',
        category: 'security',
        priority: 'high',
        implementation: {
          type: 'code_fix',
          files: ['src/app.js'],
          changes: [{
            file: 'src/app.js',
            action: 'add_validation',
            location: 'user_endpoint'
          }]
        }
      };
      
      const result = await executor.executeItem(testItem);
      expect(result.success).toBe(true);
      
      // Check that git history was updated
      const finalCommitCount = execSync('git rev-list --count HEAD').toString().trim();
      expect(parseInt(finalCommitCount)).toBeGreaterThan(parseInt(initialCommitCount));
      
      // Check commit message includes automation info
      const lastCommitMessage = execSync('git log -1 --pretty=%B').toString();
      expect(lastCommitMessage).toContain('🤖');
    });
  });

  describe('Security-Focused Integration Tests', () => {
    it('should prioritize security vulnerabilities over other improvements', async () => {
      const discovery = new BacklogDiscovery(testWorkspace);
      const items = await discovery.scanForImprovements();
      
      const wsjfCalculator = new WSJFCalculator();
      const prioritizedItems = items.map(item => {
        // Security items should get bonus scoring
        const securityBonus = item.category === 'security' ? 2 : 0;
        const wsjfScore = wsjfCalculator.calculateScore({
          businessValue: (item.businessValue || 5) + securityBonus,
          urgency: item.urgency || 3,
          jobSize: item.jobSize || 2
        });
        return { ...item, wsjfScore };
      }).sort((a, b) => b.wsjfScore - a.wsjfScore);

      // Top priority items should include security fixes
      const topItems = prioritizedItems.slice(0, 3);
      const hasSecurityItem = topItems.some(item => item.category === 'security');
      expect(hasSecurityItem).toBe(true);
    });

    it('should generate security reports during analysis', async () => {
      const securityAnalyzer = new SecurityAnalyzer(testWorkspace);
      await securityAnalyzer.generateSecurityReport();
      
      // Check that security report was generated
      const reportPath = path.join(testWorkspace, 'reports', 'security-analysis.json');
      expect(fs.existsSync(reportPath)).toBe(true);
      
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      expect(report.timestamp).toBeDefined();
      expect(report.vulnerabilities).toBeDefined();
      expect(report.riskScore).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });

    it('should validate all changes before committing', async () => {
      const executor = new BacklogExecutor(testWorkspace);
      
      // Mock item that would introduce a syntax error
      const badItem = {
        id: 'bad-change',
        title: 'Bad syntax change',
        implementation: {
          type: 'code_fix',
          files: ['src/app.js'],
          changes: [{
            file: 'src/app.js',
            content: 'invalid javascript syntax here'
          }]
        }
      };
      
      const result = await executor.executeItem(badItem);
      
      // Should fail validation and not commit
      expect(result.success).toBe(false);
      expect(result.error).toContain('validation');
      
      // Git history should be unchanged
      const commitMessage = execSync('git log -1 --pretty=%B').toString();
      expect(commitMessage).not.toContain(badItem.title);
    });
  });
});
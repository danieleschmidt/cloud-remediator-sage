const fs = require('fs');
const yaml = require('js-yaml');
const { execSync } = require('child_process');

class BacklogDiscovery {
  constructor() {
    this.backlogFile = './backlog.yml';
    this.sources = ['yaml', 'github', 'codebase'];
  }

  async discoverAll() {
    const items = [];
    
    // Load existing backlog
    items.push(...this.loadYamlBacklog());
    
    // Discover from GitHub issues
    items.push(...await this.discoverGitHubIssues());
    
    // Discover from codebase TODOs
    items.push(...this.discoverCodebaseTodos());
    
    // Discover from failing tests
    items.push(...this.discoverFailingTests());
    
    // Deduplicate and normalize
    return this.deduplicateItems(items);
  }

  /**
   * Scan for security and operational improvements
   * Alias for discoverAll() for backward compatibility
   */
  async scanForImprovements() {
    return await this.discoverAll();
  }

  loadYamlBacklog() {
    try {
      if (!fs.existsSync(this.backlogFile)) return [];
      
      const content = fs.readFileSync(this.backlogFile, 'utf8');
      const data = yaml.load(content);
      
      return data.backlog || [];
    } catch (error) {
      console.error('Error loading YAML backlog:', error);
      return [];
    }
  }

  async discoverGitHubIssues() {
    try {
      const issuesJson = execSync('gh issue list --json number,title,body,state,labels', { encoding: 'utf8' });
      const issues = JSON.parse(issuesJson);
      
      return issues.map(issue => ({
        id: `GH-${issue.number}`,
        title: issue.title,
        type: this.categorizeIssue(issue),
        description: issue.body || '',
        acceptance_criteria: this.extractAcceptanceCriteria(issue.body),
        effort: this.estimateEffort(issue),
        value: this.estimateValue(issue),
        time_criticality: this.assessTimeCriticality(issue),
        risk_reduction: this.assessRiskReduction(issue),
        status: issue.state === 'open' ? 'NEW' : 'DONE',
        risk_tier: this.assessRiskTier(issue),
        created_at: new Date().toISOString().split('T')[0],
        links: [`https://github.com/owner/repo/issues/${issue.number}`]
      }));
    } catch (error) {
      console.warn('GitHub CLI not available or no issues found');
      return [];
    }
  }

  discoverCodebaseTodos() {
    try {
      const todoPattern = /(?:TODO|FIXME|XXX|HACK)(?:\([^)]+\))?\s*:?\s*(.+)/gi;
      const items = [];
      
      const findCommand = 'find . -type f \\( -name "*.js" -o -name "*.ts" -o -name "*.py" \\) -exec grep -Hn "TODO\\|FIXME\\|XXX\\|HACK" {} \\;';
      const output = execSync(findCommand, { encoding: 'utf8', cwd: process.cwd() });
      
      const lines = output.trim().split('\n').filter(line => line);
      
      lines.forEach((line, index) => {
        const [file, lineNum, content] = line.split(':', 3);
        const match = content.match(todoPattern);
        
        if (match) {
          items.push({
            id: `TODO-${index + 1}`,
            title: `Fix TODO: ${match[1] || content}`.slice(0, 80),
            type: 'technical_debt',
            description: `TODO found in ${file}:${lineNum} - ${content}`,
            acceptance_criteria: [`Remove TODO comment in ${file}:${lineNum}`, 'Implement proper solution'],
            effort: 2,
            value: 3,
            time_criticality: 2,
            risk_reduction: 3,
            status: 'NEW',
            risk_tier: 'low',
            created_at: new Date().toISOString().split('T')[0],
            links: []
          });
        }
      });
      
      return items;
    } catch (error) {
      console.warn('Error discovering codebase TODOs:', error.message);
      return [];
    }
  }

  discoverFailingTests() {
    try {
      const testOutput = execSync('npm test 2>&1 || true', { encoding: 'utf8' });
      const items = [];
      
      // Look for test failures
      if (testOutput.includes('FAIL') || testOutput.includes('failing')) {
        items.push({
          id: 'TEST-FAILURES',
          title: 'Fix failing tests',
          type: 'bug',
          description: 'Some tests are currently failing and need to be fixed',
          acceptance_criteria: ['All tests pass', 'Test coverage maintained'],
          effort: 5,
          value: 8,
          time_criticality: 8,
          risk_reduction: 8,
          status: 'NEW',
          risk_tier: 'high',
          created_at: new Date().toISOString().split('T')[0],
          links: []
        });
      }
      
      return items;
    } catch (error) {
      console.warn('Error checking test status:', error.message);
      return [];
    }
  }

  deduplicateItems(items) {
    const seen = new Set();
    return items.filter(item => {
      const key = `${item.title}-${item.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  categorizeIssue(issue) {
    const labels = issue.labels?.map(l => l.name.toLowerCase()) || [];
    const title = issue.title.toLowerCase();
    
    if (labels.includes('bug') || title.includes('bug') || title.includes('fix')) return 'bug';
    if (labels.includes('enhancement') || title.includes('feature')) return 'feature';
    if (labels.includes('documentation') || title.includes('doc')) return 'documentation';
    if (labels.includes('security')) return 'security';
    
    return 'feature';
  }

  estimateEffort(issue) {
    const labels = issue.labels?.map(l => l.name.toLowerCase()) || [];
    
    if (labels.includes('size/xs')) return 1;
    if (labels.includes('size/s')) return 2;
    if (labels.includes('size/m')) return 3;
    if (labels.includes('size/l')) return 5;
    if (labels.includes('size/xl')) return 8;
    
    // Default estimation based on title/description length
    const textLength = (issue.title + (issue.body || '')).length;
    if (textLength < 100) return 2;
    if (textLength < 300) return 3;
    if (textLength < 600) return 5;
    return 8;
  }

  estimateValue(issue) {
    const labels = issue.labels?.map(l => l.name.toLowerCase()) || [];
    const title = issue.title.toLowerCase();
    
    if (labels.includes('critical') || labels.includes('security')) return 13;
    if (labels.includes('high') || title.includes('security') || title.includes('critical')) return 8;
    if (labels.includes('medium') || title.includes('important')) return 5;
    if (labels.includes('low') || title.includes('nice to have')) return 3;
    
    return 5; // Default
  }

  assessTimeCriticality(issue) {
    const labels = issue.labels?.map(l => l.name.toLowerCase()) || [];
    const title = issue.title.toLowerCase();
    
    if (labels.includes('urgent') || title.includes('urgent') || title.includes('asap')) return 13;
    if (labels.includes('security') || title.includes('security')) return 8;
    if (labels.includes('bug') || title.includes('bug')) return 5;
    
    return 3; // Default
  }

  assessRiskReduction(issue) {
    const labels = issue.labels?.map(l => l.name.toLowerCase()) || [];
    const title = issue.title.toLowerCase();
    
    if (labels.includes('security') || title.includes('security') || title.includes('vulnerability')) return 13;
    if (labels.includes('bug') || title.includes('bug') || title.includes('fix')) return 8;
    if (title.includes('test') || title.includes('coverage')) return 5;
    
    return 3; // Default
  }

  assessRiskTier(issue) {
    const labels = issue.labels?.map(l => l.name.toLowerCase()) || [];
    const title = issue.title.toLowerCase();
    
    if (labels.includes('critical') || labels.includes('security') || title.includes('security')) return 'high';
    if (labels.includes('bug') || title.includes('bug')) return 'medium';
    
    return 'low';
  }

  extractAcceptanceCriteria(body) {
    if (!body) return [];
    
    // Look for acceptance criteria patterns
    const patterns = [
      /(?:acceptance criteria|ac):\s*\n((?:\s*[-*]\s*.+\n?)+)/gi,
      /(?:checklist|todo):\s*\n((?:\s*[-*]\s*.+\n?)+)/gi
    ];
    
    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match) {
        return match[1].split('\n')
          .map(line => line.replace(/^\s*[-*]\s*/, '').trim())
          .filter(line => line.length > 0);
      }
    }
    
    return [];
  }
}

module.exports = BacklogDiscovery;
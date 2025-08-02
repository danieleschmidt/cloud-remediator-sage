#!/usr/bin/env node

/**
 * Comprehensive Metrics Collection Script for Cloud Remediator Sage
 * Collects, aggregates, and reports project health metrics
 */

const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

class MetricsCollector {
  constructor() {
    this.config = null;
    this.metrics = {};
    this.timestamp = new Date().toISOString();
  }

  async initialize() {
    try {
      const configPath = path.join(process.cwd(), '.github', 'project-metrics.json');
      const configData = await fs.readFile(configPath, 'utf8');
      this.config = JSON.parse(configData);
      console.log('✅ Metrics collector initialized');
    } catch (error) {
      console.error('❌ Failed to initialize metrics collector:', error.message);
      process.exit(1);
    }
  }

  async collectGitMetrics() {
    console.log('📊 Collecting Git metrics...');
    
    try {
      // Commit metrics
      const commitCount = execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim();
      const lastCommitDate = execSync('git log -1 --format=%ci', { encoding: 'utf8' }).trim();
      const contributors = execSync('git shortlog -sn --all | wc -l', { encoding: 'utf8' }).trim();
      
      // Branch metrics
      const branches = execSync('git branch -r | wc -l', { encoding: 'utf8' }).trim();
      const activeBranches = execSync('git for-each-ref --format="%(committerdate)" refs/remotes | sort | tail -10 | wc -l', { encoding: 'utf8' }).trim();
      
      // Recent activity (last 30 days)
      const recentCommits = execSync('git rev-list --count --since="30 days ago" HEAD', { encoding: 'utf8' }).trim();
      const recentContributors = execSync('git shortlog -sn --since="30 days ago" | wc -l', { encoding: 'utf8' }).trim();

      this.metrics.git = {
        total_commits: parseInt(commitCount),
        last_commit_date: lastCommitDate,
        total_contributors: parseInt(contributors),
        total_branches: parseInt(branches),
        active_branches: parseInt(activeBranches),
        recent_commits_30d: parseInt(recentCommits),
        recent_contributors_30d: parseInt(recentContributors),
        repository_age_days: this.calculateRepositoryAge()
      };

      console.log(`✅ Git metrics collected: ${commitCount} commits, ${contributors} contributors`);
    } catch (error) {
      console.error('❌ Failed to collect Git metrics:', error.message);
      this.metrics.git = { error: error.message };
    }
  }

  async collectCodeQualityMetrics() {
    console.log('🔍 Collecting code quality metrics...');
    
    try {
      // Lines of code
      const jsLines = execSync('find src -name "*.js" | xargs wc -l | tail -1 | awk \'{print $1}\'', { encoding: 'utf8' }).trim();
      const testLines = execSync('find tests -name "*.js" | xargs wc -l | tail -1 | awk \'{print $1}\'', { encoding: 'utf8' }).trim();
      
      // File counts
      const jsFiles = execSync('find src -name "*.js" | wc -l', { encoding: 'utf8' }).trim();
      const testFiles = execSync('find tests -name "*.js" | wc -l', { encoding: 'utf8' }).trim();
      
      // Test coverage (if available)
      let coverage = null;
      try {
        const coverageData = await fs.readFile('coverage/coverage-summary.json', 'utf8');
        const coverageJson = JSON.parse(coverageData);
        coverage = {
          lines: coverageJson.total.lines.pct,
          functions: coverageJson.total.functions.pct,
          branches: coverageJson.total.branches.pct,
          statements: coverageJson.total.statements.pct
        };
      } catch (e) {
        console.warn('⚠️ Coverage data not available');
      }

      // ESLint results (if available)
      let lintResults = null;
      try {
        execSync('npm run lint -- --format json --output-file lint-results.json', { stdio: 'ignore' });
        const lintData = await fs.readFile('lint-results.json', 'utf8');
        const lintJson = JSON.parse(lintData);
        const totalErrors = lintJson.reduce((sum, file) => sum + file.errorCount, 0);
        const totalWarnings = lintJson.reduce((sum, file) => sum + file.warningCount, 0);
        
        lintResults = {
          total_errors: totalErrors,
          total_warnings: totalWarnings,
          files_with_issues: lintJson.filter(file => file.errorCount > 0 || file.warningCount > 0).length
        };
        
        // Clean up temp file
        await fs.unlink('lint-results.json').catch(() => {});
      } catch (e) {
        console.warn('⚠️ Lint results not available');
      }

      this.metrics.code_quality = {
        source_lines: parseInt(jsLines) || 0,
        test_lines: parseInt(testLines) || 0,
        source_files: parseInt(jsFiles) || 0,
        test_files: parseInt(testFiles) || 0,
        test_to_code_ratio: testFiles > 0 ? (parseInt(testLines) / parseInt(jsLines)).toFixed(2) : 0,
        coverage,
        lint_results: lintResults,
        last_updated: this.timestamp
      };

      console.log(`✅ Code quality metrics collected: ${jsFiles} source files, ${testFiles} test files`);
    } catch (error) {
      console.error('❌ Failed to collect code quality metrics:', error.message);
      this.metrics.code_quality = { error: error.message };
    }
  }

  async collectSecurityMetrics() {
    console.log('🔒 Collecting security metrics...');
    
    try {
      // npm audit results
      let auditResults = null;
      try {
        const auditOutput = execSync('npm audit --json', { encoding: 'utf8' });
        const auditData = JSON.parse(auditOutput);
        auditResults = {
          total_vulnerabilities: auditData.metadata.vulnerabilities.total || 0,
          critical: auditData.metadata.vulnerabilities.critical || 0,
          high: auditData.metadata.vulnerabilities.high || 0,
          moderate: auditData.metadata.vulnerabilities.moderate || 0,
          low: auditData.metadata.vulnerabilities.low || 0,
          info: auditData.metadata.vulnerabilities.info || 0
        };
      } catch (e) {
        // npm audit returns non-zero exit code when vulnerabilities found
        try {
          const auditOutput = e.stdout || execSync('npm audit --json 2>/dev/null || true', { encoding: 'utf8' });
          if (auditOutput) {
            const auditData = JSON.parse(auditOutput);
            auditResults = {
              total_vulnerabilities: auditData.metadata.vulnerabilities.total || 0,
              critical: auditData.metadata.vulnerabilities.critical || 0,
              high: auditData.metadata.vulnerabilities.high || 0,
              moderate: auditData.metadata.vulnerabilities.moderate || 0,
              low: auditData.metadata.vulnerabilities.low || 0,
              info: auditData.metadata.vulnerabilities.info || 0
            };
          }
        } catch (auditError) {
          console.warn('⚠️ npm audit failed:', auditError.message);
        }
      }

      // Dependency analysis
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
      const dependencies = Object.keys(packageJson.dependencies || {});
      const devDependencies = Object.keys(packageJson.devDependencies || {});

      // Security scan results (if available)
      let securityScanResults = null;
      try {
        const scanFiles = await fs.readdir('security').catch(() => []);
        const recentScans = scanFiles.filter(file => file.includes('scan') || file.includes('security'));
        securityScanResults = {
          recent_scans: recentScans.length,
          last_scan_files: recentScans.slice(0, 5)
        };
      } catch (e) {
        console.warn('⚠️ Security scan results not available');
      }

      this.metrics.security = {
        vulnerability_scan: auditResults,
        dependencies: {
          production: dependencies.length,
          development: devDependencies.length,
          total: dependencies.length + devDependencies.length
        },
        security_scans: securityScanResults,
        last_updated: this.timestamp
      };

      console.log(`✅ Security metrics collected: ${auditResults?.total_vulnerabilities || 'unknown'} vulnerabilities`);
    } catch (error) {
      console.error('❌ Failed to collect security metrics:', error.message);
      this.metrics.security = { error: error.message };
    }
  }

  async collectPerformanceMetrics() {
    console.log('⚡ Collecting performance metrics...');
    
    try {
      // Package.json size and build metrics
      const packageSize = await this.getFileSize('package.json');
      const packageLockSize = await this.getFileSize('package-lock.json');
      
      // Build performance (simulate build time tracking)
      let buildMetrics = null;
      try {
        const startTime = Date.now();
        execSync('npm run build 2>/dev/null', { stdio: 'ignore', timeout: 300000 }); // 5 min timeout
        const buildTime = Date.now() - startTime;
        buildMetrics = {
          last_build_time_ms: buildTime,
          last_build_time_readable: `${(buildTime / 1000).toFixed(2)}s`
        };
      } catch (e) {
        console.warn('⚠️ Build performance test failed');
      }

      // Test performance
      let testMetrics = null;
      try {
        const startTime = Date.now();
        execSync('npm run test:unit 2>/dev/null', { stdio: 'ignore', timeout: 600000 }); // 10 min timeout
        const testTime = Date.now() - startTime;
        testMetrics = {
          last_test_time_ms: testTime,
          last_test_time_readable: `${(testTime / 1000).toFixed(2)}s`
        };
      } catch (e) {
        console.warn('⚠️ Test performance measurement failed');
      }

      // Bundle size analysis (if dist exists)
      let bundleMetrics = null;
      try {
        const distFiles = await fs.readdir('dist').catch(() => []);
        if (distFiles.length > 0) {
          const bundleSizes = await Promise.all(
            distFiles.map(async file => ({
              file,
              size: await this.getFileSize(path.join('dist', file))
            }))
          );
          bundleMetrics = {
            total_files: bundleSizes.length,
            total_size_bytes: bundleSizes.reduce((sum, file) => sum + file.size, 0),
            largest_file: bundleSizes.sort((a, b) => b.size - a.size)[0]
          };
        }
      } catch (e) {
        console.warn('⚠️ Bundle size analysis not available');
      }

      this.metrics.performance = {
        package_metrics: {
          package_json_size: packageSize,
          package_lock_size: packageLockSize
        },
        build_metrics: buildMetrics,
        test_metrics: testMetrics,
        bundle_metrics: bundleMetrics,
        last_updated: this.timestamp
      };

      console.log('✅ Performance metrics collected');
    } catch (error) {
      console.error('❌ Failed to collect performance metrics:', error.message);
      this.metrics.performance = { error: error.message };
    }
  }

  async collectProjectHealthScore() {
    console.log('📈 Calculating project health score...');
    
    const scores = {
      code_quality: 0,
      security: 0,
      performance: 0,
      activity: 0
    };

    // Code quality score (0-100)
    if (this.metrics.code_quality && !this.metrics.code_quality.error) {
      let qualityScore = 100;
      
      // Test coverage impact
      if (this.metrics.code_quality.coverage) {
        const avgCoverage = (this.metrics.code_quality.coverage.lines + 
                           this.metrics.code_quality.coverage.branches + 
                           this.metrics.code_quality.coverage.statements) / 3;
        qualityScore = Math.min(qualityScore, avgCoverage);
      }
      
      // Lint issues impact
      if (this.metrics.code_quality.lint_results) {
        const errorPenalty = this.metrics.code_quality.lint_results.total_errors * 2;
        const warningPenalty = this.metrics.code_quality.lint_results.total_warnings * 0.5;
        qualityScore = Math.max(0, qualityScore - errorPenalty - warningPenalty);
      }
      
      scores.code_quality = Math.round(qualityScore);
    }

    // Security score (0-100)
    if (this.metrics.security && !this.metrics.security.error) {
      let securityScore = 100;
      
      if (this.metrics.security.vulnerability_scan) {
        const vulns = this.metrics.security.vulnerability_scan;
        securityScore -= (vulns.critical * 25) + (vulns.high * 10) + (vulns.moderate * 5) + (vulns.low * 1);
        securityScore = Math.max(0, securityScore);
      }
      
      scores.security = Math.round(securityScore);
    }

    // Activity score (0-100)
    if (this.metrics.git && !this.metrics.git.error) {
      let activityScore = 50; // Base score
      
      // Recent commits boost
      if (this.metrics.git.recent_commits_30d > 0) {
        activityScore += Math.min(30, this.metrics.git.recent_commits_30d * 2);
      }
      
      // Recent contributors boost
      if (this.metrics.git.recent_contributors_30d > 0) {
        activityScore += Math.min(20, this.metrics.git.recent_contributors_30d * 5);
      }
      
      scores.activity = Math.min(100, Math.round(activityScore));
    }

    // Performance score (simple baseline)
    scores.performance = 85; // Default good score unless we have negative indicators

    // Overall score
    const overallScore = Math.round(
      (scores.code_quality * 0.3) + 
      (scores.security * 0.4) + 
      (scores.performance * 0.2) + 
      (scores.activity * 0.1)
    );

    this.metrics.health_score = {
      overall: overallScore,
      breakdown: scores,
      grade: this.getGrade(overallScore),
      last_calculated: this.timestamp
    };

    console.log(`✅ Project health score: ${overallScore}/100 (${this.getGrade(overallScore)})`);
  }

  getGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  async saveMetrics() {
    console.log('💾 Saving metrics...');
    
    try {
      // Ensure reports directory exists
      await fs.mkdir('reports', { recursive: true });
      
      // Save detailed metrics
      const metricsFile = path.join('reports', `metrics-${new Date().toISOString().split('T')[0]}.json`);
      await fs.writeFile(metricsFile, JSON.stringify(this.metrics, null, 2));
      
      // Save summary metrics
      const summary = {
        timestamp: this.timestamp,
        health_score: this.metrics.health_score,
        summary: {
          commits: this.metrics.git?.total_commits,
          contributors: this.metrics.git?.total_contributors,
          test_coverage: this.metrics.code_quality?.coverage?.lines,
          vulnerabilities: this.metrics.security?.vulnerability_scan?.total_vulnerabilities,
          files: this.metrics.code_quality?.source_files
        }
      };
      
      const summaryFile = path.join('reports', 'metrics-latest.json');
      await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2));
      
      console.log(`✅ Metrics saved to ${metricsFile}`);
      return { metricsFile, summaryFile };
    } catch (error) {
      console.error('❌ Failed to save metrics:', error.message);
      throw error;
    }
  }

  async generateReport() {
    console.log('📄 Generating metrics report...');
    
    const report = [
      '# Cloud Remediator Sage - Metrics Report',
      `Generated on: ${new Date().toLocaleString()}`,
      '',
      '## Project Health Score',
      `**Overall Score:** ${this.metrics.health_score?.overall || 'N/A'}/100 (${this.metrics.health_score?.grade || 'N/A'})`,
      '',
      '### Score Breakdown',
      `- Code Quality: ${this.metrics.health_score?.breakdown?.code_quality || 'N/A'}/100`,
      `- Security: ${this.metrics.health_score?.breakdown?.security || 'N/A'}/100`,
      `- Performance: ${this.metrics.health_score?.breakdown?.performance || 'N/A'}/100`,
      `- Activity: ${this.metrics.health_score?.breakdown?.activity || 'N/A'}/100`,
      '',
      '## Repository Metrics',
      `- Total Commits: ${this.metrics.git?.total_commits || 'N/A'}`,
      `- Contributors: ${this.metrics.git?.total_contributors || 'N/A'}`,
      `- Active Branches: ${this.metrics.git?.active_branches || 'N/A'}`,
      `- Recent Activity (30d): ${this.metrics.git?.recent_commits_30d || 'N/A'} commits`,
      '',
      '## Code Quality',
      `- Source Files: ${this.metrics.code_quality?.source_files || 'N/A'}`,
      `- Test Files: ${this.metrics.code_quality?.test_files || 'N/A'}`,
      `- Lines of Code: ${this.metrics.code_quality?.source_lines || 'N/A'}`,
      `- Test Coverage: ${this.metrics.code_quality?.coverage?.lines || 'N/A'}%`,
      '',
      '## Security',
      `- Total Vulnerabilities: ${this.metrics.security?.vulnerability_scan?.total_vulnerabilities || 'N/A'}`,
      `- Critical: ${this.metrics.security?.vulnerability_scan?.critical || 'N/A'}`,
      `- High: ${this.metrics.security?.vulnerability_scan?.high || 'N/A'}`,
      `- Dependencies: ${this.metrics.security?.dependencies?.total || 'N/A'}`,
      '',
      '## Performance',
      `- Last Build Time: ${this.metrics.performance?.build_metrics?.last_build_time_readable || 'N/A'}`,
      `- Last Test Time: ${this.metrics.performance?.test_metrics?.last_test_time_readable || 'N/A'}`,
      '',
      '---',
      '*Report generated by Cloud Remediator Sage metrics collector*'
    ].join('\n');

    const reportFile = path.join('reports', `metrics-report-${new Date().toISOString().split('T')[0]}.md`);
    await fs.writeFile(reportFile, report);
    
    console.log(`✅ Report generated: ${reportFile}`);
    return reportFile;
  }

  // Helper methods
  calculateRepositoryAge() {
    try {
      const firstCommit = execSync('git log --reverse --format=%ci | head -1', { encoding: 'utf8' }).trim();
      const firstCommitDate = new Date(firstCommit);
      const now = new Date();
      return Math.floor((now - firstCommitDate) / (1000 * 60 * 60 * 24));
    } catch (error) {
      return null;
    }
  }

  async getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting metrics collection for Cloud Remediator Sage...\n');
  
  const collector = new MetricsCollector();
  
  try {
    await collector.initialize();
    
    // Collect all metrics
    await collector.collectGitMetrics();
    await collector.collectCodeQualityMetrics();
    await collector.collectSecurityMetrics();
    await collector.collectPerformanceMetrics();
    await collector.collectProjectHealthScore();
    
    // Save and report
    const files = await collector.saveMetrics();
    const reportFile = await collector.generateReport();
    
    console.log('\n🎉 Metrics collection completed successfully!');
    console.log(`📊 Health Score: ${collector.metrics.health_score?.overall}/100`);
    console.log(`📁 Files: ${files.metricsFile}, ${reportFile}`);
    
    // Exit with appropriate code based on health score
    const score = collector.metrics.health_score?.overall || 0;
    process.exit(score >= 70 ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ Metrics collection failed:', error.message);
    process.exit(1);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = MetricsCollector;
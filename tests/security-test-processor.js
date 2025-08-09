/**
 * Security-focused test results processor
 * Analyzes test results for security implications and generates security reports
 */

const fs = require('fs');
const path = require('path');

module.exports = (results) => {
  const securityFindings = {
    timestamp: new Date().toISOString(),
    testSummary: {
      totalTests: results.numTotalTests,
      passedTests: results.numPassedTests,
      failedTests: results.numFailedTests,
      pendingTests: results.numPendingTests,
      coverage: results.coverageMap ? {
        lines: results.coverageMap.getCoverageSummary().lines.pct,
        statements: results.coverageMap.getCoverageSummary().statements.pct,
        functions: results.coverageMap.getCoverageSummary().functions.pct,
        branches: results.coverageMap.getCoverageSummary().branches.pct
      } : null
    },
    securityTests: [],
    vulnerabilityPatterns: [],
    recommendations: []
  };

  // Analyze test results for security patterns
  results.testResults.forEach(testFile => {
    testFile.assertionResults.forEach(test => {
      // Check for security-related test names
      if (test.title.toLowerCase().includes('security') ||
          test.title.toLowerCase().includes('auth') ||
          test.title.toLowerCase().includes('xss') ||
          test.title.toLowerCase().includes('injection') ||
          test.title.toLowerCase().includes('csrf')) {
        
        securityFindings.securityTests.push({
          testName: test.title,
          status: test.status,
          file: testFile.testFilePath,
          duration: test.duration
        });
      }

      // Check for failed tests that might indicate security issues
      if (test.status === 'failed' && test.failureMessages) {
        test.failureMessages.forEach(message => {
          if (message.toLowerCase().includes('unauthorized') ||
              message.toLowerCase().includes('forbidden') ||
              message.toLowerCase().includes('timeout') ||
              message.toLowerCase().includes('error')) {
            
            securityFindings.vulnerabilityPatterns.push({
              type: 'failed_security_test',
              description: `Failed test may indicate security vulnerability: ${test.title}`,
              file: testFile.testFilePath,
              message: message.substring(0, 200) + '...'
            });
          }
        });
      }
    });
  });

  // Generate security recommendations based on coverage
  if (results.coverageMap) {
    const coverageSummary = results.coverageMap.getCoverageSummary();
    
    if (coverageSummary.lines.pct < 80) {
      securityFindings.recommendations.push({
        type: 'coverage',
        priority: 'high',
        description: `Line coverage is ${coverageSummary.lines.pct}%. Security-critical code should have >80% coverage.`
      });
    }

    if (coverageSummary.branches.pct < 75) {
      securityFindings.recommendations.push({
        type: 'coverage',
        priority: 'medium',
        description: `Branch coverage is ${coverageSummary.branches.pct}%. Error handling paths should be well tested.`
      });
    }
  }

  // Add recommendations for security testing
  if (securityFindings.securityTests.length === 0) {
    securityFindings.recommendations.push({
      type: 'security_testing',
      priority: 'high',
      description: 'No explicit security tests found. Consider adding tests for authentication, authorization, and input validation.'
    });
  }

  // Ensure reports directory exists
  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // Write security findings to file
  const securityReportPath = path.join(reportsDir, 'security-test-findings.json');
  fs.writeFileSync(securityReportPath, JSON.stringify(securityFindings, null, 2));

  console.log('\n🔒 Security Test Analysis Complete');
  console.log(`📊 Security tests found: ${securityFindings.securityTests.length}`);
  console.log(`⚠️  Potential vulnerabilities: ${securityFindings.vulnerabilityPatterns.length}`);
  console.log(`💡 Recommendations: ${securityFindings.recommendations.length}`);
  console.log(`📄 Report saved to: ${securityReportPath}`);

  return results;
};
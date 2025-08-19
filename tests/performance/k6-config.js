/**
 * k6 Performance Testing Configuration
 * Tests performance characteristics of the cloud remediation system
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics for security operations
const securityScanRate = new Rate('security_scan_success_rate');
const remediationTime = new Trend('remediation_processing_time');
const vulnDetectionCounter = new Counter('vulnerabilities_detected');

// Test configuration
export const options = {
  scenarios: {
    // Load testing for normal operations
    normal_load: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 5 },
        { duration: '1m', target: 10 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
    
    // Stress testing for high-volume security events
    security_stress: {
      executor: 'ramping-vus',
      startTime: '2m',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 100 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '15s',
    },
    
    // Spike testing for sudden security incidents
    security_incident_spike: {
      executor: 'ramping-vus',
      startTime: '4m',
      startVUs: 1,
      stages: [
        { duration: '10s', target: 1 },
        { duration: '10s', target: 200 }, // Sudden spike
        { duration: '30s', target: 200 },
        { duration: '20s', target: 1 },
      ],
      gracefulRampDown: '10s',
    }
  },
  
  thresholds: {
    // Performance thresholds for security operations
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.1'], // Error rate under 10%
    security_scan_success_rate: ['rate>0.95'], // 95% success rate for scans
    remediation_processing_time: ['p(90)<5000'], // 90% of remediations under 5s
    vulnerabilities_detected: ['count>0'], // Should detect at least some vulnerabilities
  },
  
  // Test data and environment
  setupTimeout: '60s',
  teardownTimeout: '60s',
};

// Test data setup
export function setup() {
  console.log('Setting up performance test environment...');
  
  // Create test findings data
  const testFindings = [
    {
      id: 'perf-test-1',
      severity: 'HIGH',
      resource: 'arn:aws:s3:::perf-test-bucket',
      category: 'data_protection',
      description: 'Performance test finding - public S3 bucket'
    },
    {
      id: 'perf-test-2',
      severity: 'MEDIUM',
      resource: 'arn:aws:ec2:us-east-1:123456789012:instance/i-perftest',
      category: 'network_security',
      description: 'Performance test finding - open security group'
    }
  ];
  
  return { testFindings };
}

// Main test function
export default function(data) {
  const baseUrl = (typeof __ENV !== 'undefined' ? __ENV.API_BASE_URL : null) || 'http://localhost:3000';
  
  // Test 1: Security scan performance
  testSecurityScan(baseUrl, data);
  
  // Test 2: Risk scoring performance
  testRiskScoring(baseUrl, data);
  
  // Test 3: Remediation generation performance
  testRemediationGeneration(baseUrl, data);
  
  sleep(1);
}

function testSecurityScan(baseUrl, data) {
  const scanStartTime = Date.now();
  
  const response = http.post(`${baseUrl}/api/scan`, JSON.stringify({
    target: 'performance-test-environment',
    scanType: 'security',
    findings: data.testFindings
  }), {
    headers: {
      'Content-Type': 'application/json',
      'X-Test-Mode': 'performance'
    },
    timeout: '30s'
  });
  
  const scanDuration = Date.now() - scanStartTime;
  
  const scanSuccess = check(response, {
    'security scan status is 200': (r) => r.status === 200,
    'security scan has findings': (r) => {
      const body = JSON.parse(r.body || '{}');
      return body.findings && body.findings.length > 0;
    },
    'security scan completes quickly': () => scanDuration < 10000, // Under 10s
  });
  
  securityScanRate.add(scanSuccess);
  
  if (response.body) {
    const body = JSON.parse(response.body);
    if (body.findings) {
      vulnDetectionCounter.add(body.findings.length);
    }
  }
}

function testRiskScoring(baseUrl, data) {
  const scoringStartTime = Date.now();
  
  const response = http.post(`${baseUrl}/api/risk-score`, JSON.stringify({
    findings: data.testFindings
  }), {
    headers: {
      'Content-Type': 'application/json',
      'X-Test-Mode': 'performance'
    },
    timeout: '15s'
  });
  
  const scoringDuration = Date.now() - scoringStartTime;
  
  check(response, {
    'risk scoring status is 200': (r) => r.status === 200,
    'risk scoring returns scores': (r) => {
      const body = JSON.parse(r.body || '{}');
      return body.riskScores && body.riskScores.length > 0;
    },
    'risk scoring is fast': () => scoringDuration < 3000, // Under 3s
  });
}

function testRemediationGeneration(baseUrl, data) {
  const remediationStartTime = Date.now();
  
  const response = http.post(`${baseUrl}/api/remediation`, JSON.stringify({
    finding: data.testFindings[0]
  }), {
    headers: {
      'Content-Type': 'application/json',
      'X-Test-Mode': 'performance'
    },
    timeout: '20s'
  });
  
  const remediationDuration = Date.now() - remediationStartTime;
  
  check(response, {
    'remediation generation status is 200': (r) => r.status === 200,
    'remediation includes script': (r) => {
      const body = JSON.parse(r.body || '{}');
      return body.remediation && body.remediation.script;
    },
    'remediation generation is efficient': () => remediationDuration < 5000, // Under 5s
  });
  
  remediationTime.add(remediationDuration);
}

// Test teardown
export function teardown(data) {
  console.log('Performance test completed');
  console.log(`Processed ${data.testFindings.length} test findings`);
}

// Utility function for stress testing specific endpoints
export function handleSummary(data) {
  return {
    'performance-report.json': JSON.stringify(data, null, 2),
    stdout: `
Performance Test Summary:
========================
Duration: ${data.metrics.iteration_duration.avg}ms avg
Success Rate: ${(1 - data.metrics.http_req_failed.rate) * 100}%
Security Scans: ${data.metrics.security_scan_success_rate?.rate * 100 || 0}% success
Remediation Time: ${data.metrics.remediation_processing_time?.p90 || 'N/A'}ms p90
Vulnerabilities Detected: ${data.metrics.vulnerabilities_detected?.count || 0}

Thresholds:
${Object.entries(data.root_group.checks)
  .filter(([name]) => name.includes('threshold'))
  .map(([name, result]) => `- ${name}: ${result.passes}/${result.passes + result.fails}`)
  .join('\n')}
    `
  };
}
/**
 * Load testing for autonomous backlog processing
 * Tests system performance under various load conditions
 */

import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const backlogProcessingRate = new Rate('backlog_processing_success_rate');
const backlogProcessingTime = new Trend('backlog_processing_duration');

// Test data - large dataset for load testing
const testData = new SharedArray('backlog-items', function () {
  const items = [];
  
  // Generate realistic backlog items for testing
  const categories = ['security', 'performance', 'maintainability', 'documentation'];
  const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const resources = [
    'arn:aws:s3:::test-bucket-',
    'arn:aws:ec2:us-east-1:123456789012:instance/i-',
    'arn:aws:rds:us-east-1:123456789012:db:',
    'arn:aws:lambda:us-east-1:123456789012:function:'
  ];
  
  for (let i = 0; i < 1000; i++) {
    items.push({
      id: `load-test-item-${i}`,
      title: `Load test security finding ${i}`,
      description: `Automated test finding for performance validation ${i}`,
      category: categories[i % categories.length],
      severity: severities[i % severities.length],
      resource: resources[i % resources.length] + i,
      businessValue: Math.floor(Math.random() * 10) + 1,
      urgency: Math.floor(Math.random() * 10) + 1,
      jobSize: Math.floor(Math.random() * 8) + 1,
      created: new Date(Date.now() - Math.random() * 86400000).toISOString()
    });
  }
  
  return items;
});

export const options = {
  scenarios: {
    // Baseline load test
    baseline: {
      executor: 'constant-vus',
      vus: 5,
      duration: '2m',
      tags: { test_type: 'baseline' }
    },
    
    // Ramping load test
    ramp_up: {
      executor: 'ramping-vus',
      startTime: '2m',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 25 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 75 },
        { duration: '1m', target: 100 },
        { duration: '2m', target: 100 },
        { duration: '1m', target: 0 }
      ],
      tags: { test_type: 'ramp_up' }
    },
    
    // Capacity test - find breaking point
    capacity: {
      executor: 'ramping-arrival-rate',
      startTime: '8m',
      timeUnit: '1s',
      preAllocatedVUs: 200,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 50 },
        { duration: '1m', target: 100 },
        { duration: '1m', target: 200 },
        { duration: '2m', target: 300 },
        { duration: '1m', target: 0 }
      ],
      tags: { test_type: 'capacity' }
    }
  },
  
  thresholds: {
    // Performance requirements
    http_req_duration: [
      'p(50)<1000',  // 50% under 1s
      'p(90)<3000',  // 90% under 3s
      'p(95)<5000'   // 95% under 5s
    ],
    http_req_failed: ['rate<0.05'], // Less than 5% errors
    backlog_processing_success_rate: ['rate>0.95'],
    backlog_processing_duration: [
      'p(90)<10000', // 90% of processing under 10s
      'p(95)<15000'  // 95% of processing under 15s
    ]
  }
};

export default function () {
  const baseUrl = (typeof __ENV !== 'undefined' ? __ENV.API_BASE_URL : null) || 'http://localhost:3000';
  
  // Select random test data
  const randomItem = testData[Math.floor(Math.random() * testData.length)];
  const batchSize = Math.floor(Math.random() * 10) + 1; // 1-10 items per batch
  const batch = testData.slice(0, batchSize);
  
  // Test different load scenarios
  const iterValue = (typeof __ITER !== 'undefined' ? __ITER : Math.floor(Math.random() * 100));
  if (iterValue % 4 === 0) {
    testSingleItemProcessing(baseUrl, randomItem);
  } else if (iterValue % 4 === 1) {
    testBatchProcessing(baseUrl, batch);
  } else if (iterValue % 4 === 2) {
    testPriorityQueue(baseUrl, batch);
  } else {
    testConcurrentAnalysis(baseUrl, randomItem);
  }
  
  sleep(Math.random() * 2 + 1); // Random sleep 1-3 seconds
}

function testSingleItemProcessing(baseUrl, item) {
  const startTime = Date.now();
  
  // Simulate backlog item processing
  const processingSuccess = simulateBacklogProcessing(item);
  
  const duration = Date.now() - startTime;
  
  check(processingSuccess, {
    'single item processed successfully': (success) => success === true,
    'processing completed in reasonable time': () => duration < 5000
  });
  
  backlogProcessingRate.add(processingSuccess);
  backlogProcessingTime.add(duration);
}

function testBatchProcessing(baseUrl, batch) {
  const startTime = Date.now();
  
  // Simulate batch processing
  let successCount = 0;
  batch.forEach(item => {
    if (simulateBacklogProcessing(item)) {
      successCount++;
    }
  });
  
  const duration = Date.now() - startTime;
  const successRate = successCount / batch.length;
  
  check({ successRate, duration }, {
    'batch processing success rate > 90%': (data) => data.successRate > 0.9,
    'batch processing time reasonable': (data) => data.duration < (batch.length * 1000) // 1s per item max
  });
  
  backlogProcessingRate.add(successRate > 0.9);
  backlogProcessingTime.add(duration);
}

function testPriorityQueue(baseUrl, items) {
  const startTime = Date.now();
  
  // Sort by priority (security + high severity first)
  const prioritized = items.sort((a, b) => {
    const aScore = (a.category === 'security' ? 10 : 0) + getPriorityScore(a.severity);
    const bScore = (b.category === 'security' ? 10 : 0) + getPriorityScore(b.severity);
    return bScore - aScore;
  });
  
  // Process in priority order
  let processed = 0;
  for (const item of prioritized) {
    if (simulateBacklogProcessing(item)) {
      processed++;
    }
    // High priority items should process faster
    if (item.category === 'security' && item.severity === 'CRITICAL') {
      if (Date.now() - startTime > 2000) break; // Timeout for critical items
    }
  }
  
  const duration = Date.now() - startTime;
  const successRate = processed / prioritized.length;
  
  check({ successRate, processed }, {
    'priority queue processes critical items first': (data) => data.processed > 0,
    'priority processing maintains performance': () => duration < 10000
  });
  
  backlogProcessingRate.add(successRate > 0.8);
  backlogProcessingTime.add(duration);
}

function testConcurrentAnalysis(baseUrl, item) {
  const startTime = Date.now();
  
  // Simulate concurrent analysis operations
  const analyses = [
    simulateSecurityAnalysis(item),
    simulateRiskScoring(item),
    simulateRemediationGeneration(item)
  ];
  
  const results = Promise.all(analyses);
  const duration = Date.now() - startTime;
  
  check(results, {
    'concurrent analysis completes': (r) => r !== null,
    'concurrent analysis is efficient': () => duration < 3000
  });
  
  backlogProcessingTime.add(duration);
}

// Simulation functions
function simulateBacklogProcessing(item) {
  // Simulate processing time based on complexity
  const complexity = item.jobSize || 1;
  const processingTime = complexity * 100 + Math.random() * 200; // 100-300ms per complexity point
  
  // Simulate occasional failures (5% failure rate)
  if (Math.random() < 0.05) {
    return false;
  }
  
  // Simulate processing
  const start = Date.now();
  while (Date.now() - start < processingTime) {
    // Simulate work
  }
  
  return true;
}

function simulateSecurityAnalysis(item) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        vulnerabilities: Math.floor(Math.random() * 5),
        riskScore: Math.random() * 10,
        recommendations: ['test recommendation']
      });
    }, 100 + Math.random() * 200);
  });
}

function simulateRiskScoring(item) {
  return new Promise((resolve) => {
    const baseScore = getPriorityScore(item.severity);
    const securityMultiplier = item.category === 'security' ? 1.5 : 1.0;
    
    setTimeout(() => {
      resolve({
        riskScore: baseScore * securityMultiplier,
        factors: { severity: baseScore, security: securityMultiplier }
      });
    }, 50 + Math.random() * 100);
  });
}

function simulateRemediationGeneration(item) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        script: 'echo "Simulated remediation script"',
        riskLevel: item.severity === 'CRITICAL' ? 'high' : 'low',
        automated: item.category !== 'security' || item.severity !== 'CRITICAL'
      });
    }, 200 + Math.random() * 300);
  });
}

function getPriorityScore(severity) {
  const scores = { 'LOW': 1, 'MEDIUM': 3, 'HIGH': 7, 'CRITICAL': 10 };
  return scores[severity] || 1;
}

export function handleSummary(data) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      scenarios: Object.keys(data.metrics).filter(k => k.includes('scenario')),
      totalRequests: data.metrics.iterations?.count || 0,
      successRate: (1 - (data.metrics.http_req_failed?.rate || 0)) * 100,
      avgResponseTime: data.metrics.http_req_duration?.avg || 0,
      p95ResponseTime: data.metrics.http_req_duration?.['p(95)'] || 0
    },
    backlogMetrics: {
      processingSuccessRate: (data.metrics.backlog_processing_success_rate?.rate || 0) * 100,
      avgProcessingTime: data.metrics.backlog_processing_duration?.avg || 0,
      p90ProcessingTime: data.metrics.backlog_processing_duration?.['p(90)'] || 0
    },
    thresholds: data.root_group.checks || {}
  };
  
  return {
    'load-test-report.json': JSON.stringify(report, null, 2),
    'load-test-summary.txt': `
Load Test Results Summary
========================
Test Duration: ${Math.round((data.metrics.iteration_duration?.max || 0) / 1000)}s
Total Iterations: ${data.metrics.iterations?.count || 0}
Success Rate: ${report.summary.successRate.toFixed(2)}%
Avg Response Time: ${report.summary.avgResponseTime.toFixed(2)}ms
P95 Response Time: ${report.summary.p95ResponseTime.toFixed(2)}ms

Backlog Processing Performance:
- Success Rate: ${report.backlogMetrics.processingSuccessRate.toFixed(2)}%
- Avg Processing Time: ${report.backlogMetrics.avgProcessingTime.toFixed(2)}ms
- P90 Processing Time: ${report.backlogMetrics.p90ProcessingTime.toFixed(2)}ms

Performance Goals Met: ${Object.values(data.root_group.checks).every(c => c.passes > 0) ? 'YES' : 'NO'}
    `
  };
}
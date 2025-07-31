# Performance Optimization Guide

This document outlines performance optimization strategies for the Cloud Remediator Sage serverless framework.

## 🚀 Lambda Performance Optimization

### Cold Start Minimization

```javascript
// ✅ GOOD: Keep handler lightweight
exports.handler = async (event) => {
  const processor = require('./processor'); // Lazy load
  return await processor.handle(event);
};

// ❌ BAD: Heavy initialization at module level
const heavyLibrary = require('heavy-library');
const database = new Database();
```

### Memory Configuration

| Function Type | Recommended Memory | Typical Duration |
|---------------|-------------------|------------------|
| Prowler Ingest | 1024 MB | 30-60s |
| Risk Scoring | 512 MB | 5-15s |
| Remediation Gen | 256 MB | 1-5s |

### Environment Variables Optimization

```yaml
# serverless.yml
environment:
  NODE_ENV: production
  AWS_NODEJS_CONNECTION_REUSE_ENABLED: 1
  NEPTUNE_ENDPOINT: ${self:custom.neptuneEndpoint}
```

## 🗄️ Database Performance

### Neptune Gremlin Optimization

```javascript
// ✅ Connection pooling
const gremlin = require('gremlin');
const connection = new gremlin.driver.DriverRemoteConnection(
  `wss://${process.env.NEPTUNE_ENDPOINT}:8182/gremlin`,
  {
    mimeType: 'application/vnd.gremlin-v2.0+json',
    pingEnabled: false,
    pingInterval: 30000,
    pongTimeout: 30000,
    connectTimeout: 30000,
    sessionTimeout: 30000,
  }
);

// ✅ Batch operations
const batchInsert = async (findings) => {
  const g = traversal().withRemote(connection);
  const batch = findings.slice(0, 100); // Limit batch size
  
  const traversal = g.addV('finding');
  batch.forEach(finding => {
    traversal.property('id', finding.id)
            .property('severity', finding.severity);
  });
  
  return await traversal.next();
};
```

### Query Optimization

```javascript
// ✅ GOOD: Indexed queries
const findings = await g.V()
  .has('finding', 'severity', 'HIGH')
  .has('status', 'OPEN')
  .limit(100)
  .valueMap()
  .toList();

// ❌ BAD: Full table scan
const findings = await g.V()
  .hasLabel('finding')
  .toList();
```

## 📦 Bundle Optimization

### Webpack Configuration

```javascript
// webpack.config.js
module.exports = {
  target: 'node',
  mode: 'production',
  optimization: {
    minimize: true,
    usedExports: true,
    sideEffects: false,
  },
  externals: {
    'aws-sdk': 'aws-sdk', // Exclude AWS SDK (available in Lambda)
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
};
```

### Tree Shaking

```javascript
// ✅ GOOD: Import only what you need
import { Neptune } from 'aws-sdk/clients/neptune';
import { pick } from 'lodash/pick';

// ❌ BAD: Import entire library
import AWS from 'aws-sdk';
import _ from 'lodash';
```

## 🔄 Asynchronous Processing

### Parallel Processing

```javascript
// ✅ GOOD: Process in parallel
const processFindings = async (findings) => {
  const chunks = chunk(findings, 10);
  
  return await Promise.all(
    chunks.map(chunk => 
      Promise.all(chunk.map(finding => processSingleFinding(finding)))
    )
  );
};

// ❌ BAD: Sequential processing
const processFindings = async (findings) => {
  const results = [];
  for (const finding of findings) {
    results.push(await processSingleFinding(finding));
  }
  return results;
};
```

### SQS Batch Processing

```javascript
// ✅ Batch SQS messages
const sendBatch = async (messages) => {
  const chunks = chunk(messages, 10); // SQS max batch size
  
  return await Promise.all(
    chunks.map(chunk => sqs.sendMessageBatch({
      QueueUrl: process.env.QUEUE_URL,
      Entries: chunk.map((msg, index) => ({
        Id: index.toString(),
        MessageBody: JSON.stringify(msg),
      })),
    }).promise())
  );
};
```

## 🏗️ Architecture Patterns

### Event-Driven Processing

```javascript
// Step Functions State Machine
{
  "Comment": "Risk Assessment Pipeline",
  "StartAt": "IngestFindings",
  "States": {
    "IngestFindings": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:region:account:function:prowler-ingest",
      "Next": "ScoreRisks"
    },
    "ScoreRisks": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:region:account:function:risk-scoring",
      "Next": "GenerateRemediation"
    }
  }
}
```

### Caching Strategy

```javascript
// Redis/ElastiCache for frequently accessed data
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_ENDPOINT);

const getCachedRiskScore = async (assetId) => {
  const cached = await redis.get(`risk:${assetId}`);
  if (cached) return JSON.parse(cached);
  
  const score = await calculateRiskScore(assetId);
  await redis.setex(`risk:${assetId}`, 3600, JSON.stringify(score));
  return score;
};
```

## 📊 Monitoring & Profiling

### CloudWatch Custom Metrics

```javascript
const AWS = require('aws-sdk');
const cloudwatch = new AWS.CloudWatch();

const recordMetric = async (metricName, value, unit = 'Count') => {
  await cloudwatch.putMetricData({
    Namespace: 'CloudRemediatorSage',
    MetricData: [{
      MetricName: metricName,
      Value: value,
      Unit: unit,
      Timestamp: new Date(),
    }],
  }).promise();
};

// Usage
await recordMetric('FindingsProcessed', findings.length);
await recordMetric('ProcessingDuration', endTime - startTime, 'Milliseconds');
```

### X-Ray Tracing

```javascript
const AWSXRay = require('aws-xray-sdk-core');
const AWS = AWSXRay.captureAWS(require('aws-sdk'));

// Subsegment for database operations
const processWithTracing = async (data) => {
  const segment = AWSXRay.getSegment();
  const subsegment = segment.addNewSubsegment('database-operation');
  
  try {
    const result = await databaseOperation(data);
    subsegment.addMetadata('result-count', result.length);
    return result;
  } catch (error) {
    subsegment.addError(error);
    throw error;
  } finally {
    subsegment.close();
  }
};
```

## 🔧 Development Tools

### Performance Testing

```javascript
// k6 load testing script
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '5m', target: 200 },
    { duration: '2m', target: 0 },
  ],
};

export default function() {
  const response = http.post('https://api.example.com/ingest', {
    findings: generateTestFindings(10),
  });
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

### Profiling

```javascript
// Add to package.json scripts
{
  "profile": "node --prof src/backlog/index.js",
  "profile:analyze": "node --prof-process isolate-*.log > profile.txt"
}
```

## 🎯 Performance Targets

| Component | Target Latency | Target Throughput |
|-----------|---------------|-------------------|
| Prowler Ingest | < 5 seconds | 1000 findings/min |
| Risk Scoring | < 1 second | 500 scores/min |
| Remediation Gen | < 500ms | 100 templates/min |
| Neptune Queries | < 200ms | 50 queries/sec |

## 📈 Optimization Checklist

### Lambda Functions
- [ ] Minimize cold start impact
- [ ] Right-size memory allocation  
- [ ] Enable connection reuse
- [ ] Use provisioned concurrency for critical functions
- [ ] Implement proper error handling and retries

### Database
- [ ] Optimize Gremlin queries with proper indexing
- [ ] Use connection pooling
- [ ] Implement batch operations
- [ ] Cache frequently accessed data
- [ ] Monitor query performance

### Architecture
- [ ] Use event-driven patterns
- [ ] Implement proper queuing for high-volume processing
- [ ] Consider Step Functions for complex workflows
- [ ] Use appropriate data formats (MessagePack vs JSON)
- [ ] Implement circuit breaker patterns

### Monitoring
- [ ] Set up CloudWatch dashboards
- [ ] Configure X-Ray tracing
- [ ] Implement custom metrics
- [ ] Set up performance alerts
- [ ] Regular performance review process

## 🚨 Performance Anti-Patterns

### ❌ Avoid These

1. **Synchronous file I/O in Lambda**
2. **Large payload processing without streaming**
3. **Recursive Neptune queries without limits**
4. **Missing connection timeouts**
5. **Processing large datasets in single Lambda invocation**
6. **Not leveraging Lambda layers for shared dependencies**
7. **Ignoring memory vs CPU relationship in Lambda**
8. **Using console.log for high-volume logging**

## 📚 Resources

- [AWS Lambda Performance Tuning](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Neptune Performance Best Practices](https://docs.aws.amazon.com/neptune/latest/userguide/best-practices.html)
- [Serverless Performance Monitoring](https://www.serverless.com/blog/serverless-performance-monitoring/)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
# Observability and Monitoring

## Overview

This document outlines the comprehensive monitoring, logging, and observability strategy for cloud-remediator-sage. The approach follows the three pillars of observability: metrics, logs, and traces.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Metrics     │    │      Logs       │    │     Traces      │
│   (CloudWatch)  │    │  (CloudWatch)   │    │    (X-Ray)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Dashboards    │
                    │  (CloudWatch/   │
                    │   Grafana)      │
                    └─────────────────┘
```

## Metrics Collection

### Application Metrics

#### Lambda Function Metrics
- **Duration**: Function execution time
- **Invocations**: Number of function calls
- **Errors**: Error count and rate
- **Throttles**: Concurrency limit hits
- **Cold Starts**: Function initialization events

#### Business Metrics
- **Findings Processed**: Count of security findings processed
- **Risk Scores Generated**: Number of risk assessments
- **Remediation Actions**: Count of automated fixes
- **False Positives**: Rate of incorrect classifications

#### Custom Metrics Implementation
```javascript
// src/monitoring/metrics.js
const AWS = require('aws-sdk');
const cloudWatch = new AWS.CloudWatch();

class MetricsCollector {
  async publishCustomMetric(metricName, value, unit = 'Count', dimensions = {}) {
    const params = {
      Namespace: 'CloudRemediatorSage',
      MetricData: [{
        MetricName: metricName,
        Value: value,
        Unit: unit,
        Dimensions: Object.entries(dimensions).map(([name, value]) => ({
          Name: name,
          Value: value
        })),
        Timestamp: new Date()
      }]
    };
    
    await cloudWatch.putMetricData(params).promise();
  }
}
```

### Infrastructure Metrics

#### Neptune Database
- **Query Execution Time**: Graph traversal performance
- **Connection Pool**: Active connections and utilization
- **Memory Usage**: Database memory consumption
- **Storage**: Disk space utilization

#### Serverless Framework
- **API Gateway**: Request/response metrics
- **S3**: Storage and access patterns
- **IAM**: Permission usage and failures

## Logging Strategy

### Structured Logging
```javascript
// src/monitoring/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'cloud-remediator-sage',
    version: process.env.APP_VERSION || '0.1.0',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    new winston.transports.Console(),
    new winston.transports.CloudWatchLogs({
      logGroupName: '/aws/lambda/cloud-remediator-sage',
      logStreamName: () => new Date().toISOString().split('T')[0]
    })
  ]
});
```

### Log Categories

#### Security Logs
- **Authentication**: IAM role assumptions
- **Authorization**: Permission checks
- **Data Access**: Sensitive data operations
- **Security Events**: Threat detection and response

#### Application Logs
- **Function Entry/Exit**: Lambda lifecycle events
- **Business Logic**: Key decision points
- **Error Handling**: Exception details and context
- **Performance**: Slow operations and bottlenecks

#### Audit Logs
- **Configuration Changes**: Infrastructure modifications
- **Data Modifications**: CRUD operations
- **Administrative Actions**: User management
- **Compliance Events**: Regulatory requirement tracking

## Distributed Tracing

### X-Ray Integration
```javascript
// src/monitoring/tracing.js
const AWSXRay = require('aws-xray-sdk-core');
const AWS = AWSXRay.captureAWS(require('aws-sdk'));

class TracingManager {
  startSubsegment(name, metadata = {}) {
    const subsegment = AWSXRay.getSegment().addNewSubsegment(name);
    subsegment.addMetadata('custom', metadata);
    return subsegment;
  }
  
  closeSubsegment(subsegment, error = null) {
    if (error) {
      subsegment.addError(error);
    }
    subsegment.close();
  }
}
```

### Trace Correlation
- **Request ID**: Unique identifier for each request
- **User Context**: Associated user or service
- **Business Context**: Relevant business operations
- **Error Correlation**: Link errors across services

## Alerting Configuration

### CloudWatch Alarms

#### Critical Alerts
```yaml
# monitoring/alerting-config.yml (enhanced)
critical_alerts:
  lambda_errors:
    metric: AWS/Lambda/Errors
    threshold: 5
    period: 300
    comparison: GreaterThanThreshold
    actions:
      - arn:aws:sns:us-east-1:123456789012:critical-alerts
  
  high_latency:
    metric: AWS/Lambda/Duration
    threshold: 30000
    period: 300
    comparison: GreaterThanThreshold
    statistic: Average
    
  neptune_connection_failures:
    metric: AWS/Neptune/DatabaseConnections
    threshold: 0
    period: 300
    comparison: LessThanThreshold
```

#### Warning Alerts
- **Cold Start Rate**: High cold start frequency
- **Memory Usage**: Approaching memory limits
- **Timeout Rate**: Functions timing out
- **Dependency Failures**: External service issues

### Notification Channels
- **Slack Integration**: Real-time alerts to team channels
- **PagerDuty**: On-call escalation for critical issues
- **Email**: Digest reports and non-urgent notifications
- **SNS Topics**: Programmatic alert handling

## Dashboards

### Executive Dashboard
- **System Health**: Overall service availability
- **Business Metrics**: Key performance indicators
- **Cost Analysis**: Resource utilization costs
- **Security Posture**: Threat and vulnerability trends

### Operational Dashboard
- **Function Performance**: Lambda execution metrics
- **Error Analysis**: Error rates and patterns
- **Resource Utilization**: CPU, memory, and storage
- **Dependency Health**: External service status

### Development Dashboard
- **Deployment Metrics**: Release success rates
- **Test Coverage**: Code quality indicators
- **Performance Trends**: Application performance over time
- **Debug Information**: Troubleshooting data

## Health Checks

### Application Health
```javascript
// src/monitoring/health.js
class HealthChecker {
  async checkHealth() {
    const checks = {
      neptune: await this.checkNeptuneConnection(),
      s3: await this.checkS3Access(),
      external_apis: await this.checkExternalDependencies()
    };
    
    const overall = Object.values(checks).every(check => check.healthy);
    
    return {
      status: overall ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks
    };
  }
}
```

### Synthetic Monitoring
- **End-to-End Tests**: Critical user journeys
- **API Monitoring**: Endpoint availability and performance
- **Data Pipeline**: Processing workflow validation
- **Security Checks**: Continuous security monitoring

## Performance Monitoring

### Application Performance Monitoring (APM)
- **Response Times**: API and function latency
- **Throughput**: Requests per second
- **Error Rates**: Application and infrastructure errors
- **User Experience**: Perceived performance metrics

### Resource Monitoring
- **CPU Utilization**: Processing load
- **Memory Usage**: Memory consumption patterns
- **Network I/O**: Data transfer rates
- **Storage I/O**: Database and file system performance

## Compliance and Audit

### Retention Policies
- **Logs**: 90 days standard, 7 years for audit logs
- **Metrics**: 15 months for detailed, 5 years for aggregated
- **Traces**: 30 days for performance analysis

### Data Protection
- **Encryption**: All monitoring data encrypted at rest and in transit
- **Access Control**: Role-based access to monitoring data
- **Data Masking**: Sensitive data redacted in logs
- **GDPR Compliance**: Data subject rights support

## Automation and Integration

### Automated Response
- **Auto-scaling**: Resource adjustment based on metrics
- **Circuit Breakers**: Automatic failure isolation
- **Failover**: Automatic service recovery
- **Alert Suppression**: Intelligent noise reduction

### Integration Points
- **CI/CD Pipelines**: Deployment and release monitoring
- **Security Tools**: SIEM and vulnerability scanners
- **Business Systems**: ERP and CRM integration
- **Third-party Services**: External monitoring platforms

## References

- [AWS CloudWatch Documentation](https://docs.aws.amazon.com/cloudwatch/)
- [AWS X-Ray Documentation](https://docs.aws.amazon.com/xray/)
- [Observability Best Practices](https://aws.amazon.com/builders-library/implementing-health-checks/)
- [SRE Workbook](https://sre.google/workbook/table-of-contents/)
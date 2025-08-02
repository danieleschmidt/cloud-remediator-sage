# Monitoring & Observability Setup Guide

## Overview

Cloud Remediator Sage implements comprehensive monitoring and observability across all layers of the application stack. This guide covers setup, configuration, and maintenance of the monitoring infrastructure.

## 🎯 Monitoring Architecture

### Core Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │───▶│   Prometheus    │───▶│    Grafana      │
│   (Metrics)     │    │   (Collection)  │    │  (Visualization)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Jaeger        │◀───│   AlertManager  │    │   CloudWatch    │
│  (Tracing)      │    │   (Alerting)    │    │  (AWS Metrics)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Monitoring Stack

| Component | Purpose | Port | Configuration |
|-----------|---------|------|---------------|
| **Prometheus** | Metrics collection & storage | 9090 | `/monitoring/prometheus.yml` |
| **Grafana** | Dashboards & visualization | 3001 | `/monitoring/grafana/` |
| **Jaeger** | Distributed tracing | 16686 | Built-in configuration |
| **AlertManager** | Alert routing & notification | 9093 | `/monitoring/alerting-config.yml` |
| **CloudWatch** | AWS native monitoring | N/A | IAM-based access |

## 🚀 Quick Setup

### Local Development

```bash
# Start monitoring stack
docker-compose --profile monitoring up -d

# Verify services
make status

# Access dashboards
open http://localhost:3001  # Grafana
open http://localhost:9090  # Prometheus
open http://localhost:16686 # Jaeger
```

### Production Setup

```bash
# Deploy monitoring infrastructure
terraform apply -target=module.monitoring

# Configure CloudWatch alarms
aws cloudformation deploy --template-file monitoring/cloudwatch-alarms.yaml

# Setup log aggregation
aws logs create-log-group --log-group-name /aws/lambda/cloud-remediator
```

## 📊 Metrics Collection

### Application Metrics

**Key Performance Indicators (KPIs):**

```javascript
// src/monitoring/metrics.js
const prometheus = require('prom-client');

// Business metrics
const securityFindingsTotal = new prometheus.Counter({
  name: 'security_findings_total',
  help: 'Total number of security findings processed',
  labelNames: ['severity', 'source', 'status']
});

const remediationActionsTotal = new prometheus.Counter({
  name: 'remediation_actions_total',
  help: 'Total number of remediation actions',
  labelNames: ['action_type', 'success', 'cloud_provider']
});

const riskScoreHistogram = new prometheus.Histogram({
  name: 'risk_score_distribution',
  help: 'Distribution of risk scores',
  buckets: [0.1, 0.5, 1.0, 2.0, 5.0, 8.0, 10.0]
});

// Technical metrics
const lambdaDuration = new prometheus.Histogram({
  name: 'lambda_duration_seconds',
  help: 'Lambda function execution duration',
  labelNames: ['function_name', 'success'],
  buckets: [0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0]
});

const neptuneQueryDuration = new prometheus.Histogram({
  name: 'neptune_query_duration_seconds',
  help: 'Neptune query execution duration',
  labelNames: ['query_type', 'status'],
  buckets: [0.01, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
});
```

### Custom Metrics Implementation

```javascript
// Example: Tracking security findings processing
async function processSecurityFinding(finding) {
  const timer = lambdaDuration.startTimer({ 
    function_name: 'process_finding',
    success: 'unknown'
  });
  
  try {
    const result = await processFind(finding);
    
    // Record business metrics
    securityFindingsTotal.inc({
      severity: finding.severity,
      source: finding.source,
      status: 'processed'
    });
    
    riskScoreHistogram.observe(result.riskScore);
    
    timer({ success: 'true' });
    return result;
    
  } catch (error) {
    timer({ success: 'false' });
    
    securityFindingsTotal.inc({
      severity: finding.severity,
      source: finding.source,
      status: 'failed'
    });
    
    throw error;
  }
}
```

## 🎨 Grafana Dashboards

### Dashboard Configuration

**Security Overview Dashboard (`security-overview.json`):**

```json
{
  "dashboard": {
    "title": "Cloud Remediator Sage - Security Overview",
    "tags": ["security", "monitoring"],
    "panels": [
      {
        "title": "Security Findings by Severity",
        "type": "stat",
        "targets": [{
          "expr": "sum by (severity) (security_findings_total)",
          "legendFormat": "{{severity}}"
        }],
        "fieldConfig": {
          "defaults": {
            "color": {
              "mode": "thresholds"
            },
            "thresholds": {
              "steps": [
                {"color": "green", "value": 0},
                {"color": "yellow", "value": 10},
                {"color": "red", "value": 50}
              ]
            }
          }
        }
      },
      {
        "title": "Remediation Success Rate",
        "type": "gauge",
        "targets": [{
          "expr": "sum(rate(remediation_actions_total{success=\"true\"}[5m])) / sum(rate(remediation_actions_total[5m])) * 100"
        }],
        "fieldConfig": {
          "defaults": {
            "min": 0,
            "max": 100,
            "unit": "percent",
            "thresholds": {
              "steps": [
                {"color": "red", "value": 0},
                {"color": "yellow", "value": 80},
                {"color": "green", "value": 95}
              ]
            }
          }
        }
      }
    ]
  }
}
```

### Performance Dashboard

**Key Panels:**
- Lambda function duration (95th percentile)
- Memory usage by function
- Error rates by service
- Neptune query performance
- AWS API call latency

### Business Dashboard

**Key Panels:**
- Security findings trend
- Risk score distribution
- Remediation actions by cloud provider
- Compliance coverage
- Time to remediation metrics

## 🚨 Alerting Configuration

### Alert Severity Levels

| Severity | Response Time | Escalation | Examples |
|----------|---------------|------------|----------|
| **Critical** | Immediate | Page on-call | Service down, data loss |
| **High** | 15 minutes | Slack + Email | High error rate, security breach |
| **Medium** | 1 hour | Email | Performance degradation |
| **Low** | Next business day | Ticket | Minor issues, warnings |

### Critical Alerts

```yaml
# High-priority alerts requiring immediate attention
critical_alerts:
  - name: "Service Down"
    condition: "up == 0"
    duration: "2m"
    action: "Page on-call engineer"
    
  - name: "Security Breach"
    condition: "unauthorized_access_total > 10"
    duration: "1m"
    action: "Alert security team + Page on-call"
    
  - name: "Data Loss Risk"
    condition: "neptune_connection_failures > 5"
    duration: "5m"
    action: "Page on-call + Escalate to manager"
```

### Business Logic Alerts

```yaml
business_alerts:
  - name: "Processing Backlog"
    condition: "remediation_queue_size > 100"
    duration: "10m"
    description: "Large backlog may indicate processing issues"
    
  - name: "No Security Findings"
    condition: "increase(security_findings_total[30m]) == 0"
    duration: "30m"
    description: "Scanner may not be functioning properly"
    
  - name: "High Risk Score Trend"
    condition: "avg_over_time(risk_score_avg[1h]) > 8"
    duration: "1h"
    description: "Overall risk posture is degrading"
```

## 📋 Logging Strategy

### Log Levels and Usage

```javascript
// Structured logging implementation
const logger = require('./logger');

// Critical: System failures, security incidents
logger.critical('Neptune connection failed', {
  endpoint: neptuneEndpoint,
  error: error.message,
  timestamp: new Date().toISOString()
});

// Error: Application errors, failed operations
logger.error('Failed to process security finding', {
  findingId: finding.id,
  source: finding.source,
  error: error.message
});

// Warning: Degraded performance, recoverable issues
logger.warn('High memory usage detected', {
  memoryUsage: process.memoryUsage(),
  threshold: '80%'
});

// Info: Normal operations, business events
logger.info('Security finding processed successfully', {
  findingId: finding.id,
  riskScore: result.riskScore,
  processingTime: duration
});

// Debug: Detailed execution information
logger.debug('Neptune query executed', {
  query: gremlinQuery,
  executionTime: queryDuration,
  resultCount: results.length
});
```

### Log Aggregation

**CloudWatch Log Groups:**
```bash
# Lambda function logs
/aws/lambda/cloud-remediator-prowler-ingest
/aws/lambda/cloud-remediator-risk-scoring
/aws/lambda/cloud-remediator-remediation-generator

# Application logs
/aws/ecs/cloud-remediator-sage

# VPC Flow logs
/aws/vpc/flowlogs
```

**Log Retention Policy:**
```yaml
log_retention:
  critical_logs: 365_days    # Security, audit logs
  error_logs: 90_days       # Error investigation
  info_logs: 30_days        # General operations
  debug_logs: 7_days        # Development debugging
```

## 🔍 Distributed Tracing

### Jaeger Configuration

```javascript
// OpenTelemetry tracing setup
const { NodeSDK } = require('@opentelemetry/auto-instrumentations-node');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');

const jaegerExporter = new JaegerExporter({
  endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
});

const sdk = new NodeSDK({
  traceExporter: jaegerExporter,
  instrumentations: [
    // Auto-instrument common libraries
    require('@opentelemetry/instrumentation-http'),
    require('@opentelemetry/instrumentation-aws-lambda'),
  ],
});

sdk.start();
```

### Trace Correlation

```javascript
// Custom span creation for business operations
const { trace } = require('@opentelemetry/api');

async function processSecurityFinding(finding) {
  const tracer = trace.getTracer('cloud-remediator-sage');
  
  return tracer.startActiveSpan('process-security-finding', async (span) => {
    span.setAttributes({
      'finding.id': finding.id,
      'finding.severity': finding.severity,
      'finding.source': finding.source
    });
    
    try {
      // Risk scoring trace
      const riskScore = await tracer.startActiveSpan('calculate-risk-score', 
        async (riskSpan) => {
          const score = await calculateRiskScore(finding);
          riskSpan.setAttributes({ 'risk.score': score });
          riskSpan.end();
          return score;
        }
      );
      
      // Remediation generation trace
      const remediation = await tracer.startActiveSpan('generate-remediation',
        async (remSpan) => {
          const rem = await generateRemediation(finding, riskScore);
          remSpan.setAttributes({ 'remediation.type': rem.type });
          remSpan.end();
          return rem;
        }
      );
      
      span.setStatus({ code: SpanStatusCode.OK });
      return { riskScore, remediation };
      
    } catch (error) {
      span.recordException(error);
      span.setStatus({ 
        code: SpanStatusCode.ERROR, 
        message: error.message 
      });
      throw error;
    } finally {
      span.end();
    }
  });
}
```

## 🎛️ CloudWatch Integration

### Custom Metrics to CloudWatch

```javascript
// Send custom metrics to CloudWatch
const { CloudWatch } = require('aws-sdk');
const cloudwatch = new CloudWatch();

async function putCustomMetric(metricName, value, unit = 'Count', dimensions = []) {
  const params = {
    Namespace: 'CloudRemediatorSage',
    MetricData: [{
      MetricName: metricName,
      Value: value,
      Unit: unit,
      Timestamp: new Date(),
      Dimensions: dimensions
    }]
  };
  
  await cloudwatch.putMetricData(params).promise();
}

// Usage examples
await putCustomMetric('SecurityFindingsProcessed', 1, 'Count', [
  { Name: 'Severity', Value: 'HIGH' },
  { Name: 'Source', Value: 'Prowler' }
]);

await putCustomMetric('RemediationExecutionTime', 2.5, 'Seconds', [
  { Name: 'CloudProvider', Value: 'AWS' },
  { Name: 'ResourceType', Value: 'S3Bucket' }
]);
```

### CloudWatch Alarms

```yaml
# CloudWatch alarm configuration
cloudwatch_alarms:
  lambda_errors:
    alarm_name: "CloudRemediatorSage-Lambda-Errors"
    metric_name: "Errors"
    namespace: "AWS/Lambda"
    statistic: "Sum"
    period: 300
    threshold: 5
    comparison_operator: "GreaterThanThreshold"
    alarm_actions:
      - "arn:aws:sns:us-east-1:ACCOUNT:lambda-alerts"
    
  neptune_cpu:
    alarm_name: "CloudRemediatorSage-Neptune-CPU"
    metric_name: "CPUUtilization" 
    namespace: "AWS/Neptune"
    statistic: "Average"
    period: 300
    threshold: 80
    comparison_operator: "GreaterThanThreshold"
```

## 🔧 Health Checks

### Application Health Endpoints

```javascript
// Health check implementation
app.get('/health', async (req, res) => {
  const healthChecks = await Promise.allSettled([
    checkNeptuneConnection(),
    checkS3Access(),
    checkMemoryUsage(),
    checkDiskSpace()
  ]);
  
  const status = healthChecks.every(check => 
    check.status === 'fulfilled' && check.value.healthy
  ) ? 'healthy' : 'unhealthy';
  
  res.status(status === 'healthy' ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    checks: healthChecks.map((check, index) => ({
      name: ['neptune', 's3', 'memory', 'disk'][index],
      status: check.status === 'fulfilled' ? 
        (check.value.healthy ? 'pass' : 'fail') : 'error',
      message: check.status === 'fulfilled' ? 
        check.value.message : check.reason.message
    }))
  });
});

// Deep health check
app.get('/health/deep', async (req, res) => {
  const deepChecks = await Promise.allSettled([
    checkDatabasePerformance(),
    checkExternalAPIAccess(),
    checkSecurityScannerStatus(),
    checkRemediationGeneration()
  ]);
  
  // Return detailed health information
});
```

### Infrastructure Health Monitoring

```yaml
# Health check configuration
health_checks:
  interval: 30s
  timeout: 10s
  healthy_threshold: 2
  unhealthy_threshold: 3
  
  endpoints:
    - name: "application"
      url: "http://localhost:3000/health"
      expected_status: 200
      
    - name: "deep_health"
      url: "http://localhost:3000/health/deep"
      expected_status: 200
      interval: 60s
      
    - name: "metrics"
      url: "http://localhost:3000/metrics"
      expected_status: 200
```

## 📈 Performance Monitoring

### Key Performance Metrics

```javascript
// Performance monitoring implementation
const performanceMetrics = {
  // Response time tracking
  responseTime: new prometheus.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
  }),
  
  // Throughput tracking
  requestsTotal: new prometheus.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code']
  }),
  
  // Resource utilization
  memoryUsage: new prometheus.Gauge({
    name: 'memory_usage_bytes',
    help: 'Memory usage in bytes'
  }),
  
  // Business metrics
  processingRate: new prometheus.Gauge({
    name: 'findings_processing_rate_per_minute',
    help: 'Rate of security findings processed per minute'
  })
};

// Middleware for automatic metrics collection
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    
    performanceMetrics.responseTime
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
      
    performanceMetrics.requestsTotal
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .inc();
  });
  
  next();
});
```

## 📱 Notification Channels

### Slack Integration

```javascript
// Slack webhook configuration
const slackConfig = {
  webhookUrl: process.env.SLACK_WEBHOOK_URL,
  channels: {
    critical: '#critical-alerts',
    security: '#security-alerts',
    operations: '#ops-alerts'
  }
};

async function sendSlackAlert(alert) {
  const message = {
    channel: slackConfig.channels[alert.category] || '#ops-alerts',
    username: 'Cloud Remediator Sage',
    icon_emoji: ':warning:',
    attachments: [{
      color: alert.severity === 'critical' ? 'danger' : 'warning',
      title: `${alert.severity.toUpperCase()}: ${alert.title}`,
      text: alert.description,
      fields: [
        { title: 'Service', value: alert.service, short: true },
        { title: 'Environment', value: alert.environment, short: true },
        { title: 'Time', value: alert.timestamp, short: true }
      ],
      actions: [{
        type: 'button',
        text: 'View Runbook',
        url: alert.runbook_url
      }]
    }]
  };
  
  await axios.post(slackConfig.webhookUrl, message);
}
```

### Email Notifications

```javascript
// Email notification setup
const emailConfig = {
  service: 'AWS SES',
  region: 'us-east-1',
  templates: {
    critical: 'critical-alert-template',
    security: 'security-alert-template',
    summary: 'daily-summary-template'
  }
};

async function sendEmailAlert(alert) {
  const ses = new AWS.SES({ region: emailConfig.region });
  
  const params = {
    Source: 'alerts@terragon.ai',
    Destination: {
      ToAddresses: alert.recipients
    },
    Template: emailConfig.templates[alert.type],
    TemplateData: JSON.stringify({
      alertName: alert.title,
      severity: alert.severity,
      description: alert.description,
      timestamp: alert.timestamp,
      runbookUrl: alert.runbook_url
    })
  };
  
  await ses.sendTemplatedEmail(params).promise();
}
```

## 🎯 Monitoring Best Practices

### 1. The Four Golden Signals

**Latency**
- Track response times for all critical operations
- Monitor 95th and 99th percentiles, not just averages
- Set SLA-based alerting thresholds

**Traffic**
- Monitor request rates and patterns
- Track business metrics (findings processed, remediations generated)
- Identify traffic anomalies

**Errors**
- Track error rates by service and operation
- Categorize errors (client vs server, temporary vs permanent)
- Monitor error trends over time

**Saturation**
- Monitor resource utilization (CPU, memory, disk, network)
- Track queue depths and processing backlogs
- Monitor database connection pools

### 2. Alerting Philosophy

**Do:**
- Alert on symptoms, not causes
- Use appropriate severity levels
- Include actionable information in alerts
- Test alerting channels regularly

**Don't:**
- Alert on every metric
- Use alerts for informational purposes
- Create noisy or duplicate alerts
- Alert without clear remediation steps

### 3. Dashboard Design

**Principles:**
- Start with business metrics
- Use appropriate visualizations
- Organize by audience (executive, operational, debugging)
- Keep dashboards focused and relevant

## 🔄 Maintenance and Operations

### Regular Maintenance Tasks

**Daily:**
- Review critical alerts and incidents
- Check dashboard health and availability
- Monitor resource usage trends

**Weekly:**
- Review alert effectiveness and false positives
- Update monitoring documentation
- Validate backup and recovery procedures

**Monthly:**
- Review and update alerting thresholds
- Analyze monitoring costs and optimization opportunities
- Update runbooks and escalation procedures

**Quarterly:**
- Review monitoring architecture and scaling needs
- Conduct monitoring disaster recovery tests
- Update monitoring tool versions and security patches

### Monitoring the Monitoring

```javascript
// Meta-monitoring implementation
const monitoringHealth = {
  prometheus: {
    check: () => axios.get('http://prometheus:9090/-/healthy'),
    interval: '30s'
  },
  grafana: {
    check: () => axios.get('http://grafana:3000/api/health'),
    interval: '30s'
  },
  alertmanager: {
    check: () => axios.get('http://alertmanager:9093/-/healthy'),
    interval: '30s'
  }
};

// Alert if monitoring components are down
setInterval(async () => {
  for (const [service, config] of Object.entries(monitoringHealth)) {
    try {
      await config.check();
    } catch (error) {
      await sendCriticalAlert({
        title: `Monitoring service ${service} is down`,
        description: `Unable to reach ${service}: ${error.message}`,
        severity: 'critical',
        category: 'infrastructure'
      });
    }
  }
}, 30000);
```

---

**Last Updated**: 2025-08-02  
**Maintained By**: Cloud Remediator Sage Operations Team
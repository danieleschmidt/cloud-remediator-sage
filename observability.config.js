module.exports = {
  // Observability strategy configuration
  strategy: {
    // Three pillars of observability
    metrics: {
      enabled: true,
      provider: 'prometheus',
      exportInterval: '15s',
      retention: '7d'
    },
    logs: {
      enabled: true,
      provider: 'cloudwatch',
      level: process.env.LOG_level || 'info',
      structured: true,
      retention: '30d'
    },
    traces: {
      enabled: true,
      provider: 'xray',
      samplingRate: 0.1, // 10% sampling
      retention: '7d'
    }
  },

  // Application Performance Monitoring (APM)
  apm: {
    // Key performance indicators
    kpis: [
      {
        name: 'response_time_p95',
        description: '95th percentile response time',
        threshold: 2000, // milliseconds
        alert: true
      },
      {
        name: 'error_rate',
        description: 'Error rate percentage',
        threshold: 0.01, // 1%
        alert: true
      },
      {
        name: 'throughput',
        description: 'Requests per minute',
        threshold: 100,
        alert: false
      },
      {
        name: 'lambda_cold_starts',
        description: 'Lambda cold start frequency',
        threshold: 0.2, // 20%
        alert: true
      }
    ],

    // Service level objectives
    slos: [
      {
        name: 'availability',
        target: 99.9, // percentage
        window: '30d'
      },
      {
        name: 'latency',
        target: 1500, // milliseconds p95
        window: '7d'
      },
      {
        name: 'error_budget',
        target: 0.1, // percentage
        window: '30d'
      }
    ]
  },

  // Infrastructure monitoring
  infrastructure: {
    aws: {
      lambda: {
        metrics: [
          'Duration',
          'Errors',
          'Throttles',
          'ConcurrentExecutions',
          'DeadLetterErrors'
        ],
        alarms: {
          errorRate: {
            threshold: 0.01,
            period: '5m',
            evaluationPeriods: 2
          },
          duration: {
            threshold: 10000, // milliseconds
            period: '5m',
            evaluationPeriods: 3
          }
        }
      },
      neptune: {
        metrics: [
          'DatabaseConnections',
          'GremlinRequestsPerSec',
          'GremlinErrors',
          'CPUUtilization',
          'NetworkThroughput'
        ],
        alarms: {
          connectionCount: {
            threshold: 80, // percentage of max
            period: '5m',
            evaluationPeriods: 2
          },
          errorRate: {
            threshold: 0.05,
            period: '5m',
            evaluationPeriods: 3
          }
        }
      },
      s3: {
        metrics: [
          'BucketSizeBytes',
          'NumberOfObjects',
          'AllRequests',
          '4xxErrors',
          '5xxErrors'
        ]
      }
    }
  },

  // Business metrics monitoring
  business: {
    metrics: [
      {
        name: 'findings_processed',
        description: 'Security findings processed per hour',
        type: 'counter'
      },
      {
        name: 'risk_score_distribution',
        description: 'Distribution of risk scores',
        type: 'histogram'
      },
      {
        name: 'remediation_success_rate',
        description: 'Successful remediation percentage',
        type: 'gauge'
      },
      {
        name: 'automation_coverage',
        description: 'Automated vs manual remediation ratio',
        type: 'gauge'
      },
      {
        name: 'mean_time_to_remediation',
        description: 'Average time from finding to remediation',
        type: 'histogram'
      }
    ],

    dashboards: [
      {
        name: 'security_overview',
        description: 'High-level security posture dashboard',
        widgets: [
          'findings_processed',
          'risk_score_distribution',
          'top_vulnerabilities',
          'remediation_status'
        ]
      },
      {
        name: 'operational_health',
        description: 'System health and performance',
        widgets: [
          'response_time_p95',
          'error_rate',
          'lambda_performance',
          'neptune_health'
        ]
      }
    ]
  },

  // Alerting configuration
  alerting: {
    channels: [
      {
        name: 'critical_alerts',
        provider: 'slack',
        webhook: process.env.SLACK_CRITICAL_WEBHOOK,
        conditions: ['priority:critical', 'severity:high']
      },
      {
        name: 'operational_alerts',
        provider: 'email',
        recipients: process.env.OPS_EMAIL_LIST?.split(',') || [],
        conditions: ['priority:medium', 'category:infrastructure']
      },
      {
        name: 'security_alerts',
        provider: 'pagerduty',
        integration_key: process.env.PAGERDUTY_INTEGRATION_KEY,
        conditions: ['category:security', 'severity:high']
      }
    ],

    rules: [
      {
        name: 'lambda_error_spike',
        condition: 'error_rate > 0.05 for 5m',
        severity: 'high',
        priority: 'critical',
        category: 'infrastructure',
        message: 'Lambda error rate spike detected'
      },
      {
        name: 'response_time_degradation',
        condition: 'response_time_p95 > 3000 for 10m',
        severity: 'medium',
        priority: 'medium',
        category: 'performance',
        message: 'Response time degradation detected'
      },
      {
        name: 'security_finding_backlog',
        condition: 'unprocessed_findings > 1000',
        severity: 'medium',
        priority: 'medium',
        category: 'security',
        message: 'Security finding processing backlog'
      }
    ]
  },

  // Custom instrumentation
  instrumentation: {
    // Automatic instrumentation
    auto: {
      lambda: true,
      http: true,
      database: true,
      aws_sdk: true
    },

    // Manual instrumentation points
    custom: [
      {
        name: 'risk_calculation_duration',
        type: 'timer',
        description: 'Time taken for risk score calculation'
      },
      {
        name: 'remediation_template_generation',
        type: 'timer',
        description: 'Time taken to generate remediation templates'
      },
      {
        name: 'graph_traversal_depth',
        type: 'histogram',
        description: 'Depth of Neptune graph traversals'
      },
      {
        name: 'autonomous_task_success',
        type: 'counter',
        description: 'Success rate of autonomous tasks'
      }
    ]
  },

  // Synthetic monitoring
  synthetic: {
    healthChecks: [
      {
        name: 'api_health',
        url: process.env.API_HEALTH_ENDPOINT || '/health',
        interval: '1m',
        timeout: '10s',
        expectedStatus: 200,
        expectedBody: 'OK'
      },
      {
        name: 'neptune_connectivity',
        type: 'database',
        connection: process.env.NEPTUNE_ENDPOINT,
        query: 'g.V().limit(1)',
        interval: '5m',
        timeout: '30s'
      }
    ],

    e2e_tests: [
      {
        name: 'finding_processing_flow',
        description: 'End-to-end finding processing test',
        steps: [
          'upload_test_finding',
          'verify_ingestion',
          'check_risk_scoring',
          'validate_remediation_generation'
        ],
        interval: '1h',
        timeout: '5m'
      }
    ]
  },

  // Cost monitoring
  cost: {
    tracking: {
      lambda: {
        budgetAlert: 100, // USD per month
        anomalyDetection: true
      },
      neptune: {
        budgetAlert: 500, // USD per month
        rightSizingRecommendations: true
      },
      s3: {
        budgetAlert: 50, // USD per month
        storageClassOptimization: true
      }
    }
  },

  // Compliance and audit monitoring
  compliance: {
    auditLogs: {
      enabled: true,
      events: [
        'configuration_changes',
        'access_modifications',
        'security_policy_updates',
        'data_access_patterns'
      ],
      retention: '7y' // Long-term retention for compliance
    },

    complianceChecks: [
      {
        name: 'data_encryption_at_rest',
        frequency: 'daily',
        automated: true
      },
      {
        name: 'access_control_review',
        frequency: 'weekly',
        automated: false
      },
      {
        name: 'security_configuration_drift',
        frequency: 'hourly',
        automated: true
      }
    ]
  }
};
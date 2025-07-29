module.exports = {
  // Chaos Engineering Configuration for Cloud Remediator Sage
  // Building resilience through controlled failure injection

  // Chaos Engineering Strategy
  strategy: {
    philosophy: 'fail_fast_learn_faster',
    approach: 'hypothesis_driven',
    scope: ['development', 'staging'], // Never production without explicit approval
    
    principles: [
      'build_hypothesis_around_steady_state',
      'vary_real_world_events',
      'run_experiments_in_production_like_environments',
      'automate_experiments_continuously',
      'minimize_blast_radius'
    ]
  },

  // Experiment Categories
  experiments: {
    // Infrastructure chaos experiments
    infrastructure: [
      {
        name: 'lambda_timeout_simulation',
        description: 'Simulate Lambda function timeouts under load',
        target: 'lambda_functions',
        failure_mode: 'timeout_injection',
        
        hypothesis: 'System gracefully handles Lambda timeouts with proper retry logic',
        
        parameters: {
          timeout_duration: '5s',
          affected_percentage: 10,
          duration: '5m'
        },
        
        success_criteria: [
          'error_rate < 5%',
          'retry_mechanism_activated',
          'user_experience_maintained',
          'downstream_services_unaffected'
        ],
        
        blast_radius: 'single_function',
        rollback_strategy: 'immediate_restoration'
      },
      
      {
        name: 'neptune_connection_failure',
        description: 'Simulate Neptune database connection failures',
        target: 'neptune_cluster',
        failure_mode: 'connection_drop',
        
        hypothesis: 'Application maintains functionality with database connection pooling and retries',
        
        parameters: {
          connection_failure_rate: 20,
          duration: '10m',
          affected_connections: 'random_subset'
        },
        
        success_criteria: [
          'connection_pool_recovery < 30s',
          'data_integrity_maintained',
          'read_operations_continue',
          'graceful_degradation_active'
        ]
      },

      {
        name: 's3_latency_injection',
        description: 'Inject high latency into S3 operations',
        target: 's3_operations',
        failure_mode: 'latency_injection',
        
        hypothesis: 'System handles S3 latency spikes without cascading failures',
        
        parameters: {
          latency_increase: '2000ms',
          affected_operations: ['get_object', 'put_object'],
          duration: '15m'
        },
        
        success_criteria: [
          'timeout_handling_works',
          'async_operations_continue',
          'user_feedback_provided',
          'no_data_corruption'
        ]
      }
    ],

    // Application-level chaos experiments
    application: [
      {
        name: 'memory_pressure_simulation',
        description: 'Simulate high memory usage in Lambda functions',
        target: 'application_memory',
        failure_mode: 'memory_exhaustion',
        
        hypothesis: 'Functions handle memory pressure gracefully without OOM errors',
        
        parameters: {
          memory_consumption: '80%',
          duration: '10m',
          target_functions: ['risk-scoring', 'remediation-generator']
        },
        
        success_criteria: [
          'no_out_of_memory_errors',
          'garbage_collection_effective',
          'performance_degradation < 50%',
          'memory_cleanup_after_experiment'
        ]
      },

      {
        name: 'dependency_failure_simulation',
        description: 'Simulate external API failures and timeouts',
        target: 'external_dependencies',
        failure_mode: 'service_unavailable',
        
        hypothesis: 'System continues core functionality when external services fail',
        
        parameters: {
          affected_services: ['aws_api', 'third_party_scanners'],
          failure_percentage: 50,
          duration: '20m'
        },
        
        success_criteria: [
          'fallback_mechanisms_activated',
          'cached_data_utilized',
          'user_notifications_sent',
          'partial_functionality_maintained'
        ]
      }
    ],

    // Security-focused chaos experiments
    security: [
      {
        name: 'credential_rotation_stress_test',
        description: 'Test system behavior during credential rotation',
        target: 'authentication_system',
        failure_mode: 'credential_invalidation',
        
        hypothesis: 'System handles credential rotation without service interruption',
        
        parameters: {
          rotation_frequency: 'every_5_minutes',
          duration: '30m',
          affected_credentials: ['database', 'api_keys']
        },
        
        success_criteria: [
          'seamless_credential_refresh',
          'no_authentication_failures',
          'minimal_service_interruption',
          'audit_logs_complete'
        ]
      }
    ]
  },

  // Experiment Execution Framework
  execution: {
    // Automated experiment runner
    automation: {
      enabled: true,
      scheduler: 'cron_based',
      
      schedule: {
        infrastructure_experiments: '0 2 * * MON', // Monday 2 AM
        application_experiments: '0 3 * * WED',   // Wednesday 3 AM
        security_experiments: '0 4 * * FRI'       // Friday 4 AM
      },
      
      prerequisites: [
        'system_health_check_passed',
        'no_ongoing_incidents',
        'monitoring_systems_operational',
        'rollback_procedures_ready'
      ]
    },

    // Safety mechanisms
    safety: {
      kill_switch: {
        enabled: true,
        triggers: [
          'error_rate > 10%',
          'response_time > 5000ms',
          'manual_intervention_required'
        ],
        action: 'immediate_experiment_termination'
      },
      
      blast_radius_control: {
        max_affected_percentage: 25,
        isolation_boundaries: [
          'function_level',
          'service_level',
          'environment_level'
        ]
      },
      
      rollback_procedures: {
        automatic_rollback: true,
        rollback_timeout: '60s',
        verification_checks: [
          'service_health_restored',
          'error_rates_normalized',
          'performance_metrics_recovered'
        ]
      }
    }
  },

  // Monitoring and Observability
  monitoring: {
    // Real-time experiment monitoring
    realtime: {
      metrics: [
        'error_rates',
        'response_times',
        'throughput',
        'resource_utilization',
        'user_experience_metrics'
      ],
      
      dashboards: [
        {
          name: 'chaos_experiment_dashboard',
          widgets: [
            'experiment_status',
            'blast_radius_visualization',
            'real_time_metrics',
            'hypothesis_validation'
          ]
        }
      ],
      
      alerting: {
        channels: ['slack', 'pagerduty'],
        conditions: [
          'experiment_failure',
          'unexpected_behavior',
          'safety_threshold_breached'
        ]
      }
    },

    // Post-experiment analysis
    analysis: {
      automated_reports: true,
      
      report_sections: [
        'hypothesis_validation',
        'system_behavior_analysis',
        'performance_impact_assessment',
        'improvement_recommendations',
        'lessons_learned'
      ],
      
      metrics_analysis: {
        before_during_after_comparison: true,
        statistical_significance_testing: true,
        trend_analysis: true
      }
    }
  },

  // Resilience Patterns
  resiliencePatterns: {
    // Circuit breaker implementation
    circuitBreaker: {
      enabled: true,
      thresholds: {
        failure_rate: 50, // percentage
        request_volume: 20,
        timeout: '10s'
      },
      
      recovery: {
        half_open_max_calls: 5,
        recovery_timeout: '60s'
      }
    },

    // Retry mechanisms
    retryPolicy: {
      enabled: true,
      strategies: {
        exponential_backoff: {
          initial_delay: '100ms',
          max_delay: '30s',
          multiplier: 2,
          max_attempts: 5
        },
        
        jitter: {
          enabled: true,
          type: 'full_jitter'
        }
      }
    },

    // Timeout handling
    timeouts: {
      service_timeouts: {
        lambda_function: '30s',
        database_query: '10s',
        external_api: '5s',
        file_upload: '60s'
      },
      
      graceful_degradation: {
        enabled: true,
        fallback_strategies: [
          'cached_responses',
          'default_values',
          'simplified_functionality'
        ]
      }
    },

    // Rate limiting
    rateLimiting: {
      enabled: true,
      algorithms: ['token_bucket', 'sliding_window'],
      
      limits: {
        api_requests: '1000/minute',
        database_connections: '50/second',
        file_operations: '100/minute'
      }
    }
  },

  // Game Days and Disaster Recovery
  gameDays: {
    // Scheduled disaster recovery exercises
    exercises: [
      {
        name: 'complete_region_failure',
        description: 'Simulate complete AWS region unavailability',
        frequency: 'quarterly',
        duration: '4h',
        
        scenarios: [
          'primary_region_down',
          'database_cluster_failure',
          'networking_issues',
          'dns_resolution_problems'
        ],
        
        objectives: [
          'test_disaster_recovery_procedures',
          'validate_backup_systems',
          'train_incident_response_team',
          'improve_recovery_documentation'
        ]
      },
      
      {
        name: 'security_incident_simulation',
        description: 'Simulate security breach and response',
        frequency: 'semi_annually',
        duration: '6h',
        
        scenarios: [
          'compromised_credentials',
          'data_exfiltration_attempt',
          'malicious_code_injection',
          'ddos_attack'
        ]
      }
    ]
  },

  // Chaos Engineering Maturity
  maturity: {
    // Current maturity assessment
    current_level: 'intermediate',
    
    maturity_levels: {
      beginner: [
        'manual_experiment_execution',
        'basic_monitoring',
        'simple_failure_injection'
      ],
      
      intermediate: [
        'automated_experiment_scheduling',
        'hypothesis_driven_testing',
        'blast_radius_control',
        'automated_rollback'
      ],
      
      advanced: [
        'continuous_chaos_engineering',
        'production_experiments',
        'advanced_failure_modes',
        'predictive_failure_analysis'
      ]
    },
    
    improvement_roadmap: [
      {
        quarter: 'Q1',
        goals: [
          'implement_basic_infrastructure_experiments',
          'setup_monitoring_dashboards',
          'establish_safety_procedures'
        ]
      },
      {
        quarter: 'Q2',
        goals: [
          'add_application_level_experiments',
          'automate_experiment_execution',
          'improve_hypothesis_validation'
        ]
      },
      {
        quarter: 'Q3',
        goals: [
          'introduce_security_chaos_testing',
          'implement_advanced_failure_modes',
          'setup_continuous_experimentation'
        ]
      }
    ]
  },

  // Tools and Integrations
  tools: {
    // Chaos engineering platforms
    platforms: {
      aws_fault_injection_simulator: {
        enabled: true,
        experiments: ['ec2', 'ecs', 'lambda', 'rds']
      },
      
      chaos_monkey: {
        enabled: false, // Enable for EC2-based deployments
        configuration: 'conservative'
      },
      
      litmus: {
        enabled: false, // Enable for Kubernetes deployments
        configuration: 'kubernetes_focused'
      }
    },

    // Custom chaos tools
    custom_tools: {
      lambda_chaos_extension: {
        enabled: true,
        failure_modes: [
          'timeout_injection',
          'memory_pressure',
          'network_latency',
          'exception_injection'
        ]
      }
    }
  }
};
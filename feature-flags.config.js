module.exports = {
  // Feature Flagging and A/B Testing Configuration
  // Progressive deployment and experimentation framework

  // Feature Flag Strategy
  strategy: {
    approach: 'progressive_deployment',
    philosophy: 'fail_safe_defaults',
    
    deployment_phases: [
      { name: 'development', traffic: 100, audience: 'developers' },
      { name: 'canary', traffic: 1, audience: 'internal_users' },
      { name: 'beta', traffic: 10, audience: 'beta_testers' },
      { name: 'gradual_rollout', traffic: 50, audience: 'general_users' },
      { name: 'full_deployment', traffic: 100, audience: 'all_users' }
    ],
    
    rollback_strategy: 'immediate_flag_disable',
    monitoring_integration: true
  },

  // Feature Flag Definitions
  flags: {
    // Core functionality flags
    core_features: {
      enhanced_risk_scoring: {
        key: 'enhanced_risk_scoring_v2',
        description: 'New ML-enhanced risk scoring algorithm',
        type: 'boolean',
        default_value: false,
        
        targeting: {
          enabled: true,
          rules: [
            {
              name: 'internal_users',
              conditions: [
                { attribute: 'user_type', operator: 'equals', value: 'internal' }
              ],
              rollout: { percentage: 100 }
            },
            {
              name: 'beta_customers',
              conditions: [
                { attribute: 'customer_tier', operator: 'equals', value: 'enterprise' },
                { attribute: 'beta_participant', operator: 'equals', value: true }
              ],
              rollout: { percentage: 25 }
            }
          ]
        },
        
        metrics: [
          'risk_scoring_accuracy',
          'processing_time',
          'user_satisfaction',
          'false_positive_rate'
        ],
        
        kill_switch: {
          enabled: true,
          triggers: [
            'error_rate > 5%',
            'processing_time > 10s',
            'user_complaints > 10'
          ]
        }
      },

      autonomous_remediation: {
        key: 'autonomous_remediation_engine',
        description: 'AI-powered autonomous remediation system',
        type: 'boolean',
        default_value: false,
        
        prerequisites: [
          'enhanced_risk_scoring_enabled',
          'user_has_remediation_permissions'
        ],
        
        targeting: {
          enabled: true,
          rules: [
            {
              name: 'power_users',
              conditions: [
                { attribute: 'user_experience_level', operator: 'equals', value: 'expert' },
                { attribute: 'account_age_days', operator: 'greater_than', value: 90 }
              ],
              rollout: { percentage: 10 }
            }
          ]
        }
      },

      real_time_dashboard: {
        key: 'real_time_security_dashboard',
        description: 'Real-time security posture dashboard',
        type: 'multivariate',
        
        variants: {
          control: { 
            name: 'classic_dashboard',
            description: 'Current dashboard implementation',
            weight: 50
          },
          variant_a: {
            name: 'enhanced_visualization',
            description: 'Enhanced charts and real-time updates',
            weight: 25
          },
          variant_b: {
            name: 'ai_insights_panel',
            description: 'Dashboard with AI-powered insights',
            weight: 25
          }
        },
        
        metrics: [
          'user_engagement_time',
          'dashboard_interaction_rate',
          'insight_click_through_rate',
          'user_task_completion_rate'
        ]
      }
    },

    // Performance optimization flags
    performance: {
      lambda_warm_start: {
        key: 'lambda_provisioned_concurrency',
        description: 'Enable provisioned concurrency for critical Lambda functions',
        type: 'json',
        default_value: {
          enabled: false,
          functions: [],
          concurrency_level: 5
        },
        
        targeting: {
          rules: [
            {
              name: 'high_traffic_periods',
              conditions: [
                { attribute: 'time_of_day', operator: 'between', value: ['09:00', '17:00'] },
                { attribute: 'day_of_week', operator: 'in', value: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] }
              ],
              rollout: { percentage: 100 }
            }
          ]
        }
      },

      neptune_connection_pooling: {
        key: 'enhanced_neptune_pooling',
        description: 'Advanced Neptune connection pooling strategy',
        type: 'string',
        default_value: 'standard',
        
        variants: ['standard', 'aggressive', 'conservative'],
        
        targeting: {
          rules: [
            {
              name: 'high_load_environments',
              conditions: [
                { attribute: 'environment', operator: 'equals', value: 'production' },
                { attribute: 'expected_load', operator: 'greater_than', value: 1000 }
              ],
              rollout: { 
                percentage: 100,
                variant_distribution: {
                  'standard': 34,
                  'aggressive': 33,
                  'conservative': 33
                }
              }
            }
          ]
        }
      }
    },

    // Experimental features
    experimental: {
      ai_powered_insights: {
        key: 'ai_security_insights',
        description: 'AI-powered security insights and recommendations',
        type: 'boolean',
        default_value: false,
        
        experimental: true,
        owner: 'ai_team',
        
        targeting: {
          rules: [
            {
              name: 'ai_beta_users',
              conditions: [
                { attribute: 'opted_into_ai_features', operator: 'equals', value: true },
                { attribute: 'account_type', operator: 'equals', value: 'premium' }
              ],
              rollout: { percentage: 5 }
            }
          ]
        },
        
        success_criteria: [
          'user_engagement > 70%',
          'insight_accuracy > 85%',
          'user_satisfaction_score > 4.0'
        ]
      },

      predictive_threat_detection: {
        key: 'predictive_threat_ml',
        description: 'Machine learning-based predictive threat detection',
        type: 'multivariate',
        
        variants: {
          control: { name: 'rule_based_detection', weight: 60 },
          ml_basic: { name: 'basic_ml_model', weight: 20 },
          ml_advanced: { name: 'advanced_ml_ensemble', weight: 20 }
        },
        
        success_criteria: [
          'detection_accuracy > current_baseline + 10%',
          'false_positive_rate < current_baseline - 20%',
          'processing_time < 5s'
        ]
      }
    }
  },

  // A/B Testing Configuration
  ab_testing: {
    // Experiment framework
    framework: {
      statistical_engine: 'bayesian_inference',
      confidence_level: 0.95,
      minimum_sample_size: 1000,
      maximum_experiment_duration: '30d',
      
      early_stopping: {
        enabled: true,
        criteria: [
          'statistical_significance_reached',
          'practical_significance_threshold_met',
          'adverse_effects_detected'
        ]
      }
    },

    // Active experiments
    experiments: [
      {
        name: 'remediation_ui_optimization',
        description: 'Testing different UI layouts for remediation workflow',
        
        hypothesis: 'Simplified remediation UI will increase task completion rate by 15%',
        
        variants: {
          control: {
            name: 'current_ui',
            description: 'Current remediation interface',
            traffic_allocation: 50
          },
          treatment: {
            name: 'simplified_ui',
            description: 'Streamlined single-page interface',
            traffic_allocation: 50
          }
        },
        
        primary_metrics: [
          'task_completion_rate',
          'time_to_complete_remediation',
          'user_error_rate'
        ],
        
        secondary_metrics: [
          'user_satisfaction_score',
          'feature_usage_frequency',
          'support_ticket_volume'
        ],
        
        guardrail_metrics: [
          'system_error_rate',
          'page_load_time',
          'user_abandonment_rate'
        ],
        
        audience: {
          targeting_rules: [
            { attribute: 'user_role', operator: 'equals', value: 'security_analyst' },
            { attribute: 'experience_level', operator: 'in', value: ['intermediate', 'advanced'] }
          ],
          exclusion_rules: [
            { attribute: 'account_status', operator: 'equals', value: 'trial' }
          ]
        },
        
        duration: {
          start_date: '2025-08-01',
          estimated_duration: '14d',
          max_duration: '30d'
        }
      },

      {
        name: 'notification_optimization',
        description: 'Testing notification frequency and content for security alerts',
        
        hypothesis: 'Intelligent notification batching will reduce alert fatigue while maintaining response times',
        
        variants: {
          control: {
            name: 'immediate_notifications',
            description: 'Current immediate notification system',
            traffic_allocation: 25
          },
          batched_5min: {
            name: 'five_minute_batching',
            description: 'Batch notifications every 5 minutes',
            traffic_allocation: 25
          },
          batched_15min: {
            name: 'fifteen_minute_batching',
            description: 'Batch notifications every 15 minutes',
            traffic_allocation: 25
          },
          intelligent: {
            name: 'ai_optimized_timing',
            description: 'AI-optimized notification timing',
            traffic_allocation: 25
          }
        },
        
        primary_metrics: [
          'notification_response_rate',
          'mean_time_to_response',
          'user_notification_satisfaction'
        ]
      }
    ],

    // Experiment lifecycle management
    lifecycle: {
      proposal_process: {
        required_fields: [
          'hypothesis',
          'success_criteria',
          'statistical_power_analysis',
          'risk_assessment'
        ],
        approval_workflow: 'product_team_review'
      },
      
      monitoring: {
        real_time_dashboards: true,
        automated_alerts: {
          significant_results: true,
          guardrail_violations: true,
          sample_ratio_mismatch: true
        }
      },
      
      analysis: {
        automated_statistical_analysis: true,
        causal_inference_analysis: true,
        segment_analysis: true,
        
        reporting: {
          stakeholder_summaries: true,
          detailed_statistical_reports: true,
          recommendation_generation: true
        }
      }
    }
  },

  // Progressive Deployment
  progressive_deployment: {
    // Deployment strategies
    strategies: {
      blue_green: {
        enabled: true,
        health_check_duration: '5m',
        rollback_triggers: [
          'health_check_failure',
          'error_rate_spike',
          'performance_degradation'
        ]
      },
      
      canary: {
        enabled: true,
        stages: [
          { percentage: 1, duration: '10m' },
          { percentage: 5, duration: '20m' },
          { percentage: 25, duration: '30m' },
          { percentage: 50, duration: '1h' },
          { percentage: 100, duration: 'indefinite' }
        ],
        
        promotion_criteria: [
          'error_rate < 1%',
          'response_time_p95 < baseline + 200ms',
          'no_critical_alerts'
        ]
      },
      
      ring_deployment: {
        enabled: true,
        rings: [
          { name: 'ring_0', audience: 'developers', percentage: 100 },
          { name: 'ring_1', audience: 'internal_users', percentage: 100 },
          { name: 'ring_2', audience: 'beta_customers', percentage: 100 },
          { name: 'ring_3', audience: 'all_customers', percentage: 100 }
        ],
        
        ring_progression: {
          automatic: true,
          delay_between_rings: '24h',
          health_check_required: true
        }
      }
    }
  },

  // Monitoring and Analytics
  monitoring: {
    // Real-time monitoring
    real_time: {
      metrics_collection: {
        flag_evaluations: true,
        experiment_exposures: true,
        conversion_events: true,
        performance_metrics: true
      },
      
      dashboards: [
        {
          name: 'feature_flag_health',
          widgets: [
            'flag_evaluation_rates',
            'flag_error_rates', 
            'targeting_rule_performance',
            'kill_switch_activations'
          ]
        },
        {
          name: 'experiment_monitoring',
          widgets: [
            'experiment_health_status',
            'sample_size_progress',
            'conversion_rate_trends',
            'statistical_significance'
          ]
        }
      ]
    },

    // Analytics and insights
    analytics: {
      feature_adoption: {
        enabled: true,
        metrics: [
          'feature_usage_rates',
          'user_engagement_depth',
          'feature_abandonment_rates',
          'conversion_funnel_analysis'
        ]
      },
      
      experiment_insights: {
        enabled: true,
        automated_insights: [
          'winner_identification',
          'segment_performance_analysis',
          'long_term_impact_assessment',
          'unexpected_behavior_detection'
        ]
      }
    }
  },

  // Integration Configuration
  integrations: {
    // External feature flag services
    services: {
      launchdarkly: {
        enabled: false,
        sdk_key: process.env.LAUNCHDARKLY_SDK_KEY,
        environment: process.env.ENVIRONMENT || 'development'
      },
      
      split: {
        enabled: false,
        api_key: process.env.SPLIT_API_KEY,
        environment: process.env.ENVIRONMENT || 'development'
      },
      
      optimizely: {
        enabled: false,
        sdk_key: process.env.OPTIMIZELY_SDK_KEY,
        datafile_url: process.env.OPTIMIZELY_DATAFILE_URL
      }
    },

    // Internal systems
    internal: {
      metrics_system: 'cloudwatch',
      logging_system: 'elasticsearch',
      notification_system: 'slack',
      
      data_export: {
        enabled: true,
        destinations: ['s3', 'redshift'],
        frequency: 'hourly'
      }
    }
  },

  // Governance and Compliance
  governance: {
    // Feature flag governance
    flag_governance: {
      mandatory_fields: [
        'description',
        'owner',
        'success_criteria',
        'cleanup_date'
      ],
      
      approval_process: {
        production_flags: 'security_team_approval',
        experimental_flags: 'peer_review'
      },
      
      lifecycle_management: {
        flag_cleanup_automation: true,
        stale_flag_detection: true,
        unused_flag_identification: true
      }
    },

    // Privacy and security
    privacy_security: {
      data_minimization: true,
      user_consent_tracking: true,
      gdpr_compliance: true,
      
      security_controls: [
        'flag_value_encryption',
        'access_control_enforcement',
        'audit_logging',
        'secure_flag_delivery'
      ]
    }
  },

  // Development and Testing
  development: {
    // Local development
    local_development: {
      override_flags: true,
      mock_experiments: true,
      development_dashboard: true
    },
    
    // Testing integration
    testing: {
      unit_test_helpers: true,
      integration_test_support: true,
      end_to_end_test_scenarios: true,
      
      test_data_management: {
        flag_state_fixtures: true,
        experiment_scenario_templates: true,
        mock_analytics_data: true
      }
    }
  }
};
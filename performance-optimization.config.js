/**
 * Advanced Performance Optimization Configuration
 * Cloud Remediator Sage - Lambda and Neptune Performance Tuning
 */

const config = {
  // ===================================================================
  // LAMBDA PERFORMANCE OPTIMIZATION
  // ===================================================================
  lambda: {
    // Memory and timeout optimization based on function profiles
    functions: {
      'prowler-ingest': {
        memorySize: 1024, // Optimized for JSON parsing and S3 operations
        timeout: 300,
        reservedConcurrency: 50,
        environment: {
          NODE_OPTIONS: '--max-old-space-size=900 --optimize-for-size',
          // V8 optimizations for JSON-heavy workloads
          UV_THREADPOOL_SIZE: '4',
          NODE_ENV: 'production'
        },
        performance: {
          coldStartOptimization: {
            enabled: true,
            strategies: [
              'minimal_dependencies',
              'connection_pooling',
              'lazy_loading'
            ]
          },
          memoryProfiling: {
            enabled: true,
            heapSnapshotThreshold: '800MB',
            gcMetrics: true
          }
        }
      },
      
      'risk-scoring': {
        memorySize: 2048, // High memory for complex calculations
        timeout: 300,
        reservedConcurrency: 20,
        environment: {
          NODE_OPTIONS: '--max-old-space-size=1800 --trace-gc',
          UV_THREADPOOL_SIZE: '8' // More threads for CPU-intensive work
        },
        performance: {
          algorithmOptimization: {
            wsjfCalculation: {
              batchSize: 100,
              parallelProcessing: true,
              cacheResults: true,
              cacheTTL: 300 // 5 minutes
            },
            riskMatrix: {
              precomputedTables: true,
              compressionEnabled: true,
              indexOptimization: true
            }
          }
        }
      },
      
      'remediation-generator': {
        memorySize: 1536,
        timeout: 300,
        reservedConcurrency: 30,
        environment: {
          NODE_OPTIONS: '--max-old-space-size=1400',
          TEMPLATE_CACHE_SIZE: '100'
        },
        performance: {
          templateOptimization: {
            precompileTemplates: true,
            templateCaching: true,
            compressionLevel: 6,
            minifyOutput: true
          }
        }
      },
      
      'health-check': {
        memorySize: 256, // Minimal for simple health checks
        timeout: 30,
        reservedConcurrency: 100,
        environment: {
          NODE_OPTIONS: '--max-old-space-size=200'
        }
      }
    },
    
    // Global Lambda optimizations
    globalOptimizations: {
      provisioned_concurrency: {
        enabled: process.env.STAGE === 'prod',
        functions: ['prowler-ingest', 'risk-scoring'],
        concurrency: 10
      },
      
      dead_letter_queues: {
        enabled: true,
        maxReceiveCount: 3,
        retentionPeriod: 14 // days
      },
      
      x_ray_tracing: {
        enabled: true,
        samplingRate: process.env.STAGE === 'prod' ? 0.1 : 1.0
      },
      
      enhanced_monitoring: {
        enabled: true,
        metrics: [
          'Duration',
          'Errors',
          'Throttles',
          'ConcurrentExecutions',
          'MemoryUtilization'
        ]
      }
    }
  },

  // ===================================================================
  // NEPTUNE DATABASE OPTIMIZATION
  // ===================================================================
  neptune: {
    connection: {
      // Connection pool configuration
      pool: {
        min: 2,
        max: 20,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 300000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 200
      },
      
      // Gremlin client optimization
      gremlin: {
        // WebSocket configuration
        traversalSource: 'g',
        mimeType: 'application/vnd.gremlin-v3.0+json',
        
        // Performance settings
        keepAlive: true,
        keepAliveInitialDelay: 0,
        keepAliveInterval: 30000,
        
        // Query optimization
        serializer: {
          className: 'org.apache.tinkerpop.gremlin.driver.ser.GraphSONMessageSerializerV3d0',
          config: {
            ioRegistries: ['org.janusgraph.graphdb.tinkerpop.JanusGraphIoRegistry']
          }
        }
      }
    },
    
    // Query optimization strategies
    queryOptimization: {
      // Index utilization
      indexStrategy: {
        composite: {
          // Optimize for common query patterns
          riskScoreQueries: ['vertex_type', 'severity', 'asset_id'],
          findingQueries: ['scanner_type', 'timestamp', 'status'],
          remediationQueries: ['remediation_type', 'priority', 'created_date']
        },
        
        mixed: {
          // Full-text search optimization
          textSearch: ['description', 'remediation_steps'],
          numericRange: ['risk_score', 'timestamp', 'effort_estimate']
        }
      },
      
      // Query pattern optimization
      traversalOptimization: {
        batchSize: 1000,
        
        // Common traversal patterns
        patterns: {
          riskAnalysis: {
            strategy: 'vertex_centric',
            indexHint: 'use_composite_index',
            pagination: true,
            caching: {
              enabled: true,
              ttl: 300
            }
          },
          
          blastRadiusAnalysis: {
            strategy: 'breadth_first',
            maxDepth: 5,
            pruning: {
              enabled: true,
              thresholds: {
                vertexCount: 10000,
                edgeCount: 50000
              }
            }
          },
          
          prioritizationQueries: {
            strategy: 'score_based_ordering',
            materialization: 'eager',
            parallelization: true
          }
        }
      },
      
      // Caching strategy
      caching: {
        levels: {
          application: {
            enabled: true,
            provider: 'memory',
            maxSize: '256MB',
            ttl: 300,
            strategy: 'lru'
          },
          
          query_result: {
            enabled: true,
            provider: 'redis',
            cluster: process.env.REDIS_CLUSTER_ENDPOINT,
            ttl: 900,
            compression: true
          },
          
          computed_metrics: {
            enabled: true,
            provider: 's3',
            bucket: process.env.CACHE_BUCKET,
            ttl: 3600,
            background_refresh: true
          }
        }
      }
    },
    
    // Performance monitoring
    monitoring: {
      slowQueryThreshold: 5000, // 5 seconds
      connectionPoolMetrics: true,
      queryPlanAnalysis: true,
      
      alerting: {
        highLatency: {
          threshold: 10000, // 10 seconds
          consecutiveFailures: 3
        },
        connectionExhaustion: {
          threshold: 0.9, // 90% of pool
          duration: 60 // seconds
        },
        queryFailureRate: {
          threshold: 0.05, // 5%
          window: 300 // 5 minutes
        }
      }
    }
  },

  // ===================================================================
  // APPLICATION-LEVEL OPTIMIZATIONS
  // ===================================================================
  application: {
    // Autonomous backlog performance
    backlog: {
      processing: {
        batchSize: 50,
        concurrency: 5,
        
        wsjf: {
          calculationBatching: true,
          batchSize: 100,
          cacheResults: true,
          cacheTTL: 300,
          
          optimizations: {
            vectorization: true,
            precomputedWeights: true,
            incrementalUpdates: true
          }
        },
        
        prioritization: {
          algorithm: 'heap_based',
          rebalanceThreshold: 0.1,
          maxHeapSize: 10000
        }
      },
      
      // Task execution optimization
      execution: {
        parallelPRs: 3,
        taskTimeout: 1800, // 30 minutes
        
        templateGeneration: {
          caching: true,
          precompilation: true,
          compression: true
        },
        
        gitOperations: {
          shallowClone: true,
          partialCheckout: true,
          compression: 9
        }
      }
    },
    
    // Security scanning performance
    security: {
      scanning: {
        parallelScans: 3,
        batchProcessing: true,
        batchSize: 100,
        
        findings: {
          deduplication: {
            algorithm: 'content_hash',
            lookbackPeriod: 86400 // 24 hours
          },
          
          processing: {
            streaming: true,
            compression: true,
            indexing: 'real_time'
          }
        }
      },
      
      riskScoring: {
        memoization: true,
        batchUpdates: true,
        
        cvss: {
          precomputedTables: true,
          vectorOptimization: true
        },
        
        assetCriticality: {
          cachingStrategy: 'write_through',
          updateFrequency: 3600 // 1 hour
        }
      }
    },
    
    // I/O optimization
    io: {
      s3Operations: {
        multipartUpload: {
          enabled: true,
          partSize: '100MB',
          queueSize: 4
        },
        
        transferAcceleration: {
          enabled: process.env.STAGE === 'prod'
        },
        
        compression: {
          enabled: true,
          algorithm: 'gzip',
          level: 6
        }
      },
      
      logOptimization: {
        structuredLogging: true,
        asyncLogging: true,
        batchSize: 100,
        flushInterval: 5000,
        compression: true
      }
    }
  },

  // ===================================================================
  // MONITORING AND METRICS
  // ===================================================================
  monitoring: {
    performance: {
      metrics: {
        // Lambda metrics
        lambdaDuration: {
          enabled: true,
          percentiles: [50, 90, 95, 99],
          dimensions: ['function_name', 'environment']
        },
        
        lambdaMemoryUtilization: {
          enabled: true,
          alertThreshold: 0.9
        },
        
        // Neptune metrics
        neptuneQueryLatency: {
          enabled: true,
          percentiles: [50, 90, 95, 99],
          slowQueryThreshold: 5000
        },
        
        neptuneConnectionPool: {
          enabled: true,
          metrics: ['active', 'idle', 'total', 'waiting']
        },
        
        // Application metrics
        backlogProcessingRate: {
          enabled: true,
          unit: 'items_per_minute'
        },
        
        wsjfCalculationTime: {
          enabled: true,
          percentiles: [50, 90, 95, 99]
        },
        
        securityScanThroughput: {
          enabled: true,
          unit: 'findings_per_second'
        }
      },
      
      dashboards: {
        operational: {
          widgets: [
            'lambda_invocations',
            'lambda_errors',
            'lambda_duration',
            'neptune_connections',
            'neptune_query_latency',
            'backlog_size',
            'processing_rate'
          ]
        },
        
        performance: {
          widgets: [
            'memory_utilization',
            'cpu_utilization',
            'query_performance',
            'cache_hit_rates',
            'throughput_metrics'
          ]
        }
      }
    },
    
    alerting: {
      performance: {
        lambdaHighDuration: {
          condition: 'avg(lambda_duration) > 25000', // 25s
          severity: 'warning',
          evaluation_periods: 2
        },
        
        neptuneHighLatency: {
          condition: 'avg(neptune_query_latency) > 10000', // 10s
          severity: 'critical',
          evaluation_periods: 3
        },
        
        lowThroughput: {
          condition: 'avg(backlog_processing_rate) < 10', // items/min
          severity: 'warning',
          evaluation_periods: 5
        }
      }
    }
  },

  // ===================================================================
  // ENVIRONMENT-SPECIFIC CONFIGURATIONS
  // ===================================================================
  environments: {
    development: {
      lambda: {
        provisioned_concurrency: false,
        x_ray_sampling_rate: 1.0
      },
      neptune: {
        pool_size: 5,
        query_timeout: 30000
      },
      caching: {
        enabled: false
      }
    },
    
    staging: {
      lambda: {
        provisioned_concurrency: true,
        x_ray_sampling_rate: 0.5
      },
      neptune: {
        pool_size: 10,
        query_timeout: 60000
      },
      caching: {
        enabled: true,
        ttl: 300
      }
    },
    
    production: {
      lambda: {
        provisioned_concurrency: true,
        x_ray_sampling_rate: 0.1
      },
      neptune: {
        pool_size: 20,
        query_timeout: 30000,
        read_replica: true
      },
      caching: {
        enabled: true,
        ttl: 900,
        multi_tier: true
      }
    }
  },

  // ===================================================================
  // COST OPTIMIZATION
  // ===================================================================
  costOptimization: {
    lambda: {
      rightSizing: {
        enabled: true,
        analysis_period: 7, // days
        memory_optimization: true,
        timeout_optimization: true
      },
      
      scheduledScaling: {
        enabled: true,
        schedules: [
          {
            time: '08:00',
            timezone: 'UTC',
            concurrency: 'high'
          },
          {
            time: '20:00',
            timezone: 'UTC',
            concurrency: 'low'
          }
        ]
      }
    },
    
    neptune: {
      instanceRightSizing: {
        enabled: true,
        cpu_threshold: 0.7,
        memory_threshold: 0.8
      },
      
      storageOptimization: {
        compression: true,
        archiving: {
          enabled: true,
          retention_days: 90
        }
      }
    },
    
    monitoring: {
      costMetrics: {
        lambda_cost_per_invocation: true,
        neptune_cost_per_query: true,
        storage_cost_trends: true
      },
      
      budgetAlerts: {
        monthly_budget: 1000, // USD
        alert_thresholds: [0.8, 0.9, 1.0]
      }
    }
  }
};

module.exports = config;
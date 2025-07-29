module.exports = {
  // Lambda function performance benchmarks
  lambdaFunctions: [
    {
      name: 'prowler-ingest',
      path: 'src/lambda/prowler-ingest.js',
      expectedColdStart: 3000, // ms
      expectedWarmStart: 500,  // ms
      memoryLimit: 512,        // MB
      timeoutLimit: 30000,     // ms
      benchmarks: {
        smallPayload: 100,      // records
        mediumPayload: 1000,    // records
        largePayload: 10000     // records
      }
    },
    {
      name: 'risk-scoring',
      path: 'src/lambda/risk-scoring.js',
      expectedColdStart: 2000,
      expectedWarmStart: 300,
      memoryLimit: 256,
      timeoutLimit: 15000,
      benchmarks: {
        simpleRisk: 10,      // calculations
        complexRisk: 100,    // calculations
        massiveRisk: 1000    // calculations
      }
    },
    {
      name: 'remediation-generator',
      path: 'src/lambda/remediation-generator.js',
      expectedColdStart: 4000,
      expectedWarmStart: 800,
      memoryLimit: 1024,
      timeoutLimit: 60000,
      benchmarks: {
        simpleRemediation: 5,     // templates
        complexRemediation: 25,   // templates
        batchRemediation: 100     // templates
      }
    }
  ],

  // Backlog system performance
  backlogSystem: {
    maxConcurrentTasks: 5,
    taskTimeout: 300000,        // 5 minutes
    discoveryInterval: 3600000, // 1 hour
    expectedTaskDuration: {
      discovery: 30000,    // 30 seconds
      prioritization: 5000, // 5 seconds
      execution: 120000    // 2 minutes
    }
  },

  // Database performance (Neptune)
  neptune: {
    connectionPool: {
      min: 2,
      max: 10,
      acquireTimeout: 30000,
      createTimeout: 30000,
      idleTimeout: 300000
    },
    queryPerformance: {
      simpleTraversal: 1000,  // ms
      complexTraversal: 5000, // ms
      batchOperations: 10000  // ms
    }
  },

  // API performance benchmarks
  api: {
    healthCheck: 100,        // ms
    dataRetrieval: 2000,     // ms
    dataProcessing: 5000,    // ms
    reportGeneration: 15000  // ms
  },

  // Memory usage monitoring
  memory: {
    heapWarningThreshold: 0.8,  // 80% of heap
    rssWarningThreshold: 512,   // MB
    gcFrequencyThreshold: 10    // per minute
  },

  // Network performance
  network: {
    awsApiLatency: 500,      // ms
    neptuneLatency: 200,     // ms
    s3OperationLatency: 1000 // ms
  },

  // Performance testing configuration
  loadTesting: {
    scenarios: [
      {
        name: 'normal-load',
        virtualUsers: 10,
        duration: '2m',
        rampUp: '30s'
      },
      {
        name: 'peak-load',
        virtualUsers: 50,
        duration: '5m',
        rampUp: '1m'
      },
      {
        name: 'stress-test',
        virtualUsers: 100,
        duration: '10m',
        rampUp: '2m'
      }
    ]
  },

  // Monitoring and alerting thresholds
  alerts: {
    responseTime: {
      warning: 2000,  // ms
      critical: 5000  // ms
    },
    errorRate: {
      warning: 0.01,  // 1%
      critical: 0.05  // 5%
    },
    throughput: {
      minimum: 100,   // requests/minute
      warning: 50     // requests/minute
    }
  },

  // Reporting configuration
  reporting: {
    enabled: true,
    format: ['json', 'html', 'prometheus'],
    retention: '30d',
    aggregation: {
      intervals: ['1m', '5m', '1h', '1d'],
      percentiles: [50, 75, 90, 95, 99]
    }
  }
};
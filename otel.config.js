// OpenTelemetry Configuration for Cloud Remediator Sage
// Advanced observability and monitoring setup

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base');

// Instrumentation packages
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { AwsInstrumentation } = require('@opentelemetry/instrumentation-aws-sdk');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');

// Exporters
const { CloudWatchMetricsExporter } = require('@opentelemetry/exporter-cloudwatch-metrics');
const { AWSXRayPropagator } = require('@opentelemetry/propagator-aws-xray');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

const serviceName = 'cloud-remediator-sage';
const serviceVersion = process.env.npm_package_version || '0.1.0';
const stage = process.env.STAGE || 'dev';

// Resource configuration with semantic attributes
const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
  [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: stage,
  [SemanticResourceAttributes.CLOUD_PROVIDER]: 'aws',
  [SemanticResourceAttributes.FAAS_NAME]: process.env.AWS_LAMBDA_FUNCTION_NAME,
  [SemanticResourceAttributes.FAAS_VERSION]: process.env.AWS_LAMBDA_FUNCTION_VERSION,
  // Custom attributes for security context
  'security.scan.engine': 'prowler',
  'security.remediation.type': 'autonomous',
  'backlog.prioritization': 'wsjf',
});

// Metrics configuration
const metricReader = new PeriodicExportingMetricReader({
  exporter: new CloudWatchMetricsExporter({
    region: process.env.AWS_REGION || 'us-east-1',
    namespace: 'CloudRemediatorSage',
    // Custom dimensions for security metrics
    dimensions: [
      { Name: 'Environment', Value: stage },
      { Name: 'Service', Value: serviceName },
      { Name: 'SecurityEngine', Value: 'prowler' },
    ],
  }),
  exportIntervalMillis: 30000, // Export every 30 seconds
});

// Trace configuration with X-Ray integration
const traceExporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'https://api.honeycomb.io/v1/traces',
  headers: {
    'x-honeycomb-team': process.env.HONEYCOMB_API_KEY || '',
    'x-honeycomb-dataset': `${serviceName}-${stage}`,
  },
});

// Advanced instrumentation configuration
const instrumentations = [
  getNodeAutoInstrumentations({
    // Disable default instrumentations that might be noisy
    '@opentelemetry/instrumentation-fs': {
      enabled: false, // File system operations can be very noisy
    },
    '@opentelemetry/instrumentation-dns': {
      enabled: false, // DNS lookups are typically not needed
    },
  }),
  
  // AWS SDK instrumentation for Lambda and Neptune
  new AwsInstrumentation({
    suppressInternalInstrumentation: true,
    sqsExtractLinkTraceId: true,
    // Custom attribute extractors for security context
    requestHook: (span, request) => {
      if (request.service === 'neptune-db') {
        span.setAttributes({
          'db.system': 'neptune',
          'db.operation.type': 'gremlin',
          'security.context': 'risk_analysis',
        });
      }
      if (request.service === 's3' && request.operation === 'getObject') {
        span.setAttributes({
          'security.scan.artifact': request.params?.Key || 'unknown',
          'security.bucket.type': 'findings',
        });
      }
    },
    responseHook: (span, response) => {
      if (response.error) {
        span.setAttributes({
          'error.type': response.error.name,
          'error.message': response.error.message,
          'security.remediation.status': 'failed',
        });
      }
    },
  }),
  
  // Enhanced HTTP instrumentation for external security APIs
  new HttpInstrumentation({
    ignoreincomingRequestHook: (req) => {
      // Ignore health check requests to reduce noise
      return req.url?.includes('/health') || req.url?.includes('/metrics');
    },
    requestHook: (span, request) => {
      // Add security context to HTTP requests
      const url = request.url || request.path;
      if (url?.includes('prowler') || url?.includes('security')) {
        span.setAttributes({
          'security.api.type': 'external_scanner',
          'security.request.category': 'vulnerability_data',
        });
      }
    },
  }),
];

// Initialize OpenTelemetry SDK
const sdk = new NodeSDK({
  resource,
  metricReader,
  spanProcessors: [
    new BatchSpanProcessor(traceExporter, {
      maxExportBatchSize: 100,
      scheduledDelayMillis: 1000,
      exportTimeoutMillis: 30000,
      maxQueueSize: 2048,
    }),
  ],
  textMapPropagator: new AWSXRayPropagator(),
  instrumentations,
});

// Enhanced error handling and monitoring
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  // Create a custom span for unhandled errors
  const tracer = require('@opentelemetry/api').trace.getTracer(serviceName);
  const span = tracer.startSpan('unhandled_rejection');
  span.setAttributes({
    'error.type': 'UnhandledRejection',
    'error.message': String(reason),
    'security.incident': true,
  });
  span.end();
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  const tracer = require('@opentelemetry/api').trace.getTracer(serviceName);
  const span = tracer.startSpan('uncaught_exception');
  span.setAttributes({
    'error.type': 'UncaughtException',
    'error.message': error.message,
    'security.incident': true,
    'severity': 'critical',
  });
  span.end();
  process.exit(1);
});

// Custom security metrics helpers
const securityMetrics = {
  // Track remediation success rates
  trackRemediation: (success, riskLevel, remediationType) => {
    const meter = require('@opentelemetry/api').metrics.getMeter(serviceName);
    const remediationCounter = meter.createCounter('security_remediation_total', {
      description: 'Total number of security remediations attempted',
    });
    
    remediationCounter.add(1, {
      success: success.toString(),
      risk_level: riskLevel,
      remediation_type: remediationType,
      environment: stage,
    });
  },
  
  // Track vulnerability discovery
  trackVulnerability: (severity, source, status) => {
    const meter = require('@opentelemetry/api').metrics.getMeter(serviceName);
    const vulnCounter = meter.createCounter('security_vulnerabilities_total', {
      description: 'Total number of vulnerabilities discovered',
    });
    
    vulnCounter.add(1, {
      severity,
      source,
      status,
      environment: stage,
    });
  },
  
  // Track WSJF scoring performance
  trackWSJF: (score, executionTime, backlogSize) => {
    const meter = require('@opentelemetry/api').metrics.getMeter(serviceName);
    const wsjfHistogram = meter.createHistogram('wsjf_calculation_duration', {
      description: 'Time taken to calculate WSJF scores',
      unit: 'ms',
    });
    
    wsjfHistogram.record(executionTime, {
      score_range: score > 10 ? 'high' : score > 5 ? 'medium' : 'low',
      backlog_size_range: backlogSize > 100 ? 'large' : backlogSize > 50 ? 'medium' : 'small',
      environment: stage,
    });
  },
};

module.exports = {
  sdk,
  securityMetrics,
  resource,
  serviceName,
};

// Auto-initialize in Lambda environments
if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
  sdk.start();
  console.log(`OpenTelemetry initialized for ${serviceName} in ${stage} environment`);
}
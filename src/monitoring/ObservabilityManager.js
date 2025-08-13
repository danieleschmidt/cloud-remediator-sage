/**
 * Observability Manager for Cloud Remediator Sage
 * Provides comprehensive monitoring, tracing, and alerting capabilities
 */

const { EventEmitter } = require('events');
const { StructuredLogger } = require('./logger');
const MetricsCollector = require('./metrics');
const AlertManager = require('./alertManager');
const HealthMonitor = require('./health');

class ObservabilityManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.enabled = options.enabled !== false;
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.serviceId = options.serviceId || 'cloud-remediator-sage';
    this.version = options.version || '0.1.0';
    
    // Core components
    this.logger = new StructuredLogger(this.serviceId);
    this.metrics = new MetricsCollector();
    this.alerts = new AlertManager();
    this.health = new HealthMonitor();
    
    // Tracing configuration
    this.tracing = {
      enabled: options.tracing?.enabled !== false,
      sampleRate: options.tracing?.sampleRate || 0.1,
      traces: new Map(),
      activeSpans: new Map()
    };
    
    // Performance monitoring
    this.performance = {
      requests: [],
      operations: new Map(),
      thresholds: {
        responseTime: 2000, // 2 seconds
        memoryUsage: 0.8,   // 80%
        errorRate: 0.05     // 5%
      }
    };
    
    // Circuit breaker states
    this.circuitBreakers = new Map();
    
    this.initialize();
  }

  /**
   * Initialize observability components
   */
  initialize() {
    if (!this.enabled) {
      this.logger.warn('Observability disabled - monitoring capabilities limited');
      return;
    }

    this.logger.info('Initializing Observability Manager', {
      serviceId: this.serviceId,
      environment: this.environment,
      version: this.version
    });

    // Initialize components
    this.initializeMetrics();
    this.initializeTracing();
    this.initializeHealthChecks();
    this.initializeAlerting();
    
    // Set up performance monitoring
    this.startPerformanceMonitoring();
    
    // Set up automatic cleanup
    this.setupCleanup();
    
    this.emit('initialized', {
      timestamp: new Date().toISOString(),
      components: ['metrics', 'tracing', 'health', 'alerts'],
      environment: this.environment
    });
  }

  /**
   * Start a new trace
   */
  startTrace(operationName, context = {}) {
    if (!this.tracing.enabled) return null;
    
    const traceId = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const trace = {
      id: traceId,
      operationName,
      startTime: Date.now(),
      spans: [],
      context: { ...context },
      status: 'active'
    };
    
    this.tracing.traces.set(traceId, trace);
    
    this.logger.debug('Trace started', {
      traceId,
      operationName,
      context
    });
    
    return traceId;
  }

  /**
   * Start a new span within a trace
   */
  startSpan(traceId, spanName, context = {}) {
    if (!this.tracing.enabled || !traceId) return null;
    
    const trace = this.tracing.traces.get(traceId);
    if (!trace) return null;
    
    const spanId = `span-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const span = {
      id: spanId,
      traceId,
      name: spanName,
      startTime: Date.now(),
      context: { ...context },
      tags: {},
      logs: [],
      status: 'active'
    };
    
    trace.spans.push(span);
    this.tracing.activeSpans.set(spanId, span);
    
    return spanId;
  }

  /**
   * Finish a span
   */
  finishSpan(spanId, tags = {}, error = null) {
    if (!spanId) return;
    
    const span = this.tracing.activeSpans.get(spanId);
    if (!span) return;
    
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.tags = { ...span.tags, ...tags };
    span.status = error ? 'error' : 'completed';
    
    if (error) {
      span.error = {
        message: error.message,
        stack: error.stack,
        type: error.constructor.name
      };
    }
    
    this.tracing.activeSpans.delete(spanId);
    
    this.logger.debug('Span finished', {
      spanId,
      traceId: span.traceId,
      duration: span.duration,
      status: span.status
    });
    
    // Emit span completion event
    this.emit('spanCompleted', span);
  }

  /**
   * Finish a trace
   */
  finishTrace(traceId, tags = {}) {
    if (!traceId) return;
    
    const trace = this.tracing.traces.get(traceId);
    if (!trace) return;
    
    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.tags = { ...trace.tags, ...tags };
    trace.status = 'completed';
    
    // Calculate trace statistics
    const completedSpans = trace.spans.filter(s => s.status === 'completed');
    const errorSpans = trace.spans.filter(s => s.status === 'error');
    
    trace.statistics = {
      totalSpans: trace.spans.length,
      completedSpans: completedSpans.length,
      errorSpans: errorSpans.length,
      errorRate: trace.spans.length > 0 ? errorSpans.length / trace.spans.length : 0
    };
    
    this.logger.info('Trace completed', {
      traceId,
      operationName: trace.operationName,
      duration: trace.duration,
      statistics: trace.statistics
    });
    
    // Emit trace completion event
    this.emit('traceCompleted', trace);
    
    // Clean up completed trace after delay
    setTimeout(() => {
      this.tracing.traces.delete(traceId);
    }, 300000); // 5 minutes
  }

  /**
   * Record a metric
   */
  recordMetric(name, value, tags = {}, type = 'gauge') {
    if (!this.enabled) return;
    
    const metric = {
      name,
      value,
      type,
      tags: {
        service: this.serviceId,
        environment: this.environment,
        ...tags
      },
      timestamp: Date.now()
    };
    
    this.metrics.record(metric);
    
    // Check thresholds and trigger alerts if needed
    this.checkMetricThresholds(metric);
  }

  /**
   * Record an operation timing
   */
  recordTiming(operationName, duration, tags = {}) {
    this.recordMetric(`${operationName}.duration`, duration, tags, 'histogram');
    
    // Update performance tracking
    const operation = this.performance.operations.get(operationName) || {
      count: 0,
      totalDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      avgDuration: 0
    };
    
    operation.count++;
    operation.totalDuration += duration;
    operation.minDuration = Math.min(operation.minDuration, duration);
    operation.maxDuration = Math.max(operation.maxDuration, duration);
    operation.avgDuration = operation.totalDuration / operation.count;
    
    this.performance.operations.set(operationName, operation);
  }

  /**
   * Get comprehensive system metrics
   */
  getMetrics() {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      timestamp: new Date().toISOString(),
      service: {
        id: this.serviceId,
        version: this.version,
        uptime: process.uptime(),
        environment: this.environment
      },
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss,
        utilization: memoryUsage.heapUsed / memoryUsage.heapTotal
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      traces: {
        active: this.tracing.traces.size,
        activeSpans: this.tracing.activeSpans.size
      },
      performance: {
        operations: Object.fromEntries(this.performance.operations),
        circuitBreakers: this.getCircuitBreakerStates()
      }
    };
  }

  /**
   * Initialize metrics collection
   */
  initializeMetrics() {
    this.metrics.initialize({
      service: this.serviceId,
      environment: this.environment
    });
    
    // Set up automatic system metrics collection
    setInterval(() => {
      const metrics = this.getMetrics();
      
      this.recordMetric('memory.used', metrics.memory.used);
      this.recordMetric('memory.utilization', metrics.memory.utilization);
      this.recordMetric('service.uptime', metrics.service.uptime);
      this.recordMetric('traces.active', metrics.traces.active);
      
    }, 30000); // Every 30 seconds
  }

  /**
   * Initialize distributed tracing
   */
  initializeTracing() {
    if (!this.tracing.enabled) return;
    
    this.logger.info('Distributed tracing enabled', {
      sampleRate: this.tracing.sampleRate
    });
  }

  /**
   * Initialize health checks
   */
  initializeHealthChecks() {
    this.health.initialize();
    
    // Set up health check monitoring
    this.health.on('healthStatusChanged', (status) => {
      this.recordMetric('health.status', status.healthy ? 1 : 0, {
        component: status.component
      });
      
      if (!status.healthy) {
        this.alerts.trigger('health_check_failed', {
          component: status.component,
          error: status.error,
          timestamp: status.timestamp
        });
      }
    });
  }

  /**
   * Initialize alerting
   */
  initializeAlerting() {
    this.alerts.initialize({
      service: this.serviceId,
      environment: this.environment
    });
  }

  /**
   * Start performance monitoring
   */
  startPerformanceMonitoring() {
    // Monitor event loop lag
    setInterval(() => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
        this.recordMetric('eventloop.lag', lag);
      });
    }, 10000); // Every 10 seconds
  }

  /**
   * Check metric thresholds
   */
  checkMetricThresholds(metric) {
    const { name, value, tags } = metric;
    
    // Response time threshold
    if (name.endsWith('.duration') && value > this.performance.thresholds.responseTime) {
      this.alerts.trigger('high_response_time', {
        operation: name.replace('.duration', ''),
        duration: value,
        threshold: this.performance.thresholds.responseTime,
        tags
      });
    }
    
    // Memory usage threshold
    if (name === 'memory.utilization' && value > this.performance.thresholds.memoryUsage) {
      this.alerts.trigger('high_memory_usage', {
        utilization: value,
        threshold: this.performance.thresholds.memoryUsage,
        tags
      });
    }
  }

  /**
   * Get circuit breaker states
   */
  getCircuitBreakerStates() {
    const states = {};
    for (const [name, breaker] of this.circuitBreakers) {
      states[name] = {
        state: breaker.state,
        failures: breaker.failures,
        lastFailure: breaker.lastFailure,
        nextAttempt: breaker.nextAttempt
      };
    }
    return states;
  }

  /**
   * Set up automatic cleanup
   */
  setupCleanup() {
    // Clean up old traces
    setInterval(() => {
      const cutoff = Date.now() - 3600000; // 1 hour ago
      
      for (const [traceId, trace] of this.tracing.traces) {
        if (trace.startTime < cutoff && trace.status === 'completed') {
          this.tracing.traces.delete(traceId);
        }
      }
    }, 600000); // Every 10 minutes
    
    // Clean up old performance data
    setInterval(() => {
      this.performance.requests = this.performance.requests.slice(-1000); // Keep last 1000
    }, 300000); // Every 5 minutes
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    this.logger.info('Shutting down Observability Manager');
    
    // Finish any active traces
    for (const [traceId, trace] of this.tracing.traces) {
      if (trace.status === 'active') {
        this.finishTrace(traceId, { shutdown: true });
      }
    }
    
    // Shutdown components
    await this.metrics.shutdown();
    await this.alerts.shutdown();
    await this.health.shutdown();
    
    this.emit('shutdown', {
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = ObservabilityManager;
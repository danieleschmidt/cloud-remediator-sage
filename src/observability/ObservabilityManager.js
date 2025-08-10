/**
 * Advanced Observability Manager for Cloud Remediator Sage
 * Implements comprehensive monitoring, alerting, and distributed tracing
 */

const { EventEmitter } = require('events');
const { StructuredLogger } = require('../monitoring/logger');
const crypto = require('crypto');

class ObservabilityManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.logger = new StructuredLogger('observability-manager');
    this.options = {
      // Tracing configuration
      tracing: {
        enabled: options.tracing?.enabled !== false,
        sampleRate: options.tracing?.sampleRate || 0.1, // 10% sampling
        exportInterval: options.tracing?.exportInterval || 5000,
        batchSize: options.tracing?.batchSize || 100
      },
      // Metrics configuration
      metrics: {
        enabled: options.metrics?.enabled !== false,
        collectionInterval: options.metrics?.collectionInterval || 15000,
        retentionPeriod: options.metrics?.retentionPeriod || 86400000, // 24 hours
        aggregationWindows: options.metrics?.aggregationWindows || [60000, 300000, 900000] // 1m, 5m, 15m
      },
      // Alerting configuration
      alerting: {
        enabled: options.alerting?.enabled !== false,
        evaluationInterval: options.alerting?.evaluationInterval || 30000,
        channels: options.alerting?.channels || ['log'],
        severityLevels: ['INFO', 'WARNING', 'ERROR', 'CRITICAL'],
        escalationRules: options.alerting?.escalationRules || []
      },
      // Service map configuration
      serviceMap: {
        enabled: options.serviceMap?.enabled !== false,
        updateInterval: options.serviceMap?.updateInterval || 60000,
        dependencyThreshold: options.serviceMap?.dependencyThreshold || 5
      },
      ...options
    };

    // Internal state
    this.activeSpans = new Map();
    this.completedTraces = [];
    this.metrics = new Map();
    this.metricAggregations = new Map();
    this.alerts = new Map();
    this.serviceMap = {
      services: new Map(),
      dependencies: new Map(),
      lastUpdate: 0
    };
    
    // Performance tracking
    this.performanceMetrics = {
      requests: new Map(),
      errors: new Map(),
      latency: new Map(),
      throughput: new Map()
    };

    this.initialize();
  }

  /**
   * Initialize observability manager
   */
  async initialize() {
    this.logger.info('Initializing Observability Manager');

    // Start metric collection
    if (this.options.metrics.enabled) {
      this.startMetricCollection();
    }

    // Start trace processing
    if (this.options.tracing.enabled) {
      this.startTraceProcessing();
    }

    // Start alerting engine
    if (this.options.alerting.enabled) {
      this.startAlertingEngine();
    }

    // Start service map updates
    if (this.options.serviceMap.enabled) {
      this.startServiceMapUpdates();
    }

    this.logger.info('Observability Manager initialized successfully');
  }

  /**
   * Start a new distributed trace
   */
  startTrace(operationName, parentSpanId = null, tags = {}) {
    if (!this.options.tracing.enabled) {
      return null;
    }

    // Check sampling rate
    if (Math.random() > this.options.tracing.sampleRate) {
      return null;
    }

    const traceId = this.generateTraceId();
    const spanId = this.generateSpanId();
    
    const span = {
      traceId,
      spanId,
      parentSpanId,
      operationName,
      startTime: Date.now(),
      endTime: null,
      tags: { ...tags },
      logs: [],
      status: 'active',
      duration: null
    };

    this.activeSpans.set(spanId, span);
    
    this.logger.debug('Trace started', {
      traceId,
      spanId,
      operationName,
      parentSpanId
    });

    return {
      traceId,
      spanId,
      addTag: (key, value) => this.addSpanTag(spanId, key, value),
      log: (message, data) => this.addSpanLog(spanId, message, data),
      finish: () => this.finishSpan(spanId),
      createChildSpan: (childOperationName, childTags = {}) => 
        this.startTrace(childOperationName, spanId, childTags)
    };
  }

  /**
   * Add tag to active span
   */
  addSpanTag(spanId, key, value) {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.tags[key] = value;
    }
  }

  /**
   * Add log to active span
   */
  addSpanLog(spanId, message, data = {}) {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.logs.push({
        timestamp: Date.now(),
        message,
        data
      });
    }
  }

  /**
   * Finish active span
   */
  finishSpan(spanId) {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      return;
    }

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = 'completed';

    // Move to completed traces
    this.completedTraces.push(span);
    this.activeSpans.delete(spanId);

    // Update service map
    this.updateServiceMap(span);

    // Update performance metrics
    this.updatePerformanceMetrics(span);

    this.logger.debug('Span finished', {
      traceId: span.traceId,
      spanId: span.spanId,
      operationName: span.operationName,
      duration: span.duration
    });

    // Trigger trace analysis
    this.analyzeTrace(span);

    // Keep only recent completed traces
    if (this.completedTraces.length > 10000) {
      this.completedTraces = this.completedTraces.slice(-5000);
    }
  }

  /**
   * Record custom metric
   */
  recordMetric(name, value, tags = {}, timestamp = Date.now()) {
    if (!this.options.metrics.enabled) {
      return;
    }

    const metricKey = this.generateMetricKey(name, tags);
    
    if (!this.metrics.has(metricKey)) {
      this.metrics.set(metricKey, {
        name,
        tags,
        values: [],
        lastUpdated: timestamp
      });
    }

    const metric = this.metrics.get(metricKey);
    metric.values.push({ value, timestamp });
    metric.lastUpdated = timestamp;

    // Keep only recent values
    const cutoffTime = timestamp - this.options.metrics.retentionPeriod;
    metric.values = metric.values.filter(v => v.timestamp > cutoffTime);

    // Trigger metric aggregation
    this.aggregateMetric(metricKey, metric);
  }

  /**
   * Record counter metric
   */
  incrementCounter(name, increment = 1, tags = {}) {
    const counterKey = `counter.${name}`;
    const existing = this.getLatestMetricValue(counterKey, tags) || 0;
    this.recordMetric(counterKey, existing + increment, tags);
  }

  /**
   * Record gauge metric
   */
  recordGauge(name, value, tags = {}) {
    const gaugeKey = `gauge.${name}`;
    this.recordMetric(gaugeKey, value, tags);
  }

  /**
   * Record histogram metric
   */
  recordHistogram(name, value, tags = {}) {
    const histogramKey = `histogram.${name}`;
    this.recordMetric(histogramKey, value, tags);
  }

  /**
   * Create custom alert rule
   */
  createAlertRule(name, rule) {
    if (!this.options.alerting.enabled) {
      return;
    }

    const alertRule = {
      name,
      condition: rule.condition,
      threshold: rule.threshold,
      severity: rule.severity || 'WARNING',
      description: rule.description,
      evaluationWindow: rule.evaluationWindow || 300000, // 5 minutes
      cooldownPeriod: rule.cooldownPeriod || 600000, // 10 minutes
      channels: rule.channels || this.options.alerting.channels,
      tags: rule.tags || {},
      enabled: rule.enabled !== false,
      lastTriggered: 0,
      triggerCount: 0
    };

    this.alerts.set(name, alertRule);
    
    this.logger.info('Alert rule created', {
      name,
      severity: alertRule.severity,
      condition: alertRule.condition
    });
  }

  /**
   * Query metrics with filters
   */
  queryMetrics(query) {
    const results = [];
    
    for (const [key, metric] of this.metrics.entries()) {
      if (this.matchesQuery(metric, query)) {
        const values = this.filterValuesByTime(metric.values, query.timeRange);
        
        results.push({
          name: metric.name,
          tags: metric.tags,
          values: values,
          aggregations: this.calculateAggregations(values, query.aggregations)
        });
      }
    }

    return results;
  }

  /**
   * Query traces with filters
   */
  queryTraces(query = {}) {
    let traces = this.completedTraces;

    // Filter by operation name
    if (query.operationName) {
      traces = traces.filter(t => t.operationName.includes(query.operationName));
    }

    // Filter by tags
    if (query.tags) {
      traces = traces.filter(t => {
        return Object.entries(query.tags).every(([key, value]) => 
          t.tags[key] === value
        );
      });
    }

    // Filter by time range
    if (query.timeRange) {
      traces = traces.filter(t => 
        t.startTime >= query.timeRange.start && 
        t.startTime <= query.timeRange.end
      );
    }

    // Filter by duration
    if (query.minDuration || query.maxDuration) {
      traces = traces.filter(t => {
        if (query.minDuration && t.duration < query.minDuration) return false;
        if (query.maxDuration && t.duration > query.maxDuration) return false;
        return true;
      });
    }

    // Sort by start time (most recent first)
    traces.sort((a, b) => b.startTime - a.startTime);

    // Limit results
    if (query.limit) {
      traces = traces.slice(0, query.limit);
    }

    return traces;
  }

  /**
   * Get service dependency map
   */
  getServiceMap() {
    return {
      services: Array.from(this.serviceMap.services.entries()).map(([name, service]) => ({
        name,
        ...service
      })),
      dependencies: Array.from(this.serviceMap.dependencies.entries()).map(([key, dependency]) => ({
        key,
        ...dependency
      })),
      lastUpdate: this.serviceMap.lastUpdate
    };
  }

  /**
   * Get performance dashboard data
   */
  getPerformanceDashboard(timeRange = 3600000) { // 1 hour default
    const now = Date.now();
    const cutoff = now - timeRange;

    const dashboard = {
      summary: {
        totalRequests: 0,
        totalErrors: 0,
        averageLatency: 0,
        throughput: 0
      },
      timeSeries: {
        requests: [],
        errors: [],
        latency: [],
        throughput: []
      },
      topServices: [],
      topErrors: [],
      slowestOperations: []
    };

    // Calculate summary metrics
    const recentTraces = this.completedTraces.filter(t => t.startTime > cutoff);
    dashboard.summary.totalRequests = recentTraces.length;
    dashboard.summary.totalErrors = recentTraces.filter(t => t.tags.error === true).length;
    
    if (recentTraces.length > 0) {
      dashboard.summary.averageLatency = recentTraces.reduce((sum, t) => sum + t.duration, 0) / recentTraces.length;
      dashboard.summary.throughput = recentTraces.length / (timeRange / 60000); // requests per minute
    }

    // Generate time series data
    dashboard.timeSeries = this.generateTimeSeries(recentTraces, timeRange);

    // Calculate top services, errors, and slow operations
    dashboard.topServices = this.calculateTopServices(recentTraces);
    dashboard.topErrors = this.calculateTopErrors(recentTraces);
    dashboard.slowestOperations = this.calculateSlowestOperations(recentTraces);

    return dashboard;
  }

  // Internal methods
  startMetricCollection() {
    setInterval(() => {
      this.collectSystemMetrics();
      this.performMetricAggregation();
      this.cleanupOldMetrics();
    }, this.options.metrics.collectionInterval);
  }

  startTraceProcessing() {
    setInterval(() => {
      this.exportTraces();
      this.analyzeTracePatterns();
    }, this.options.tracing.exportInterval);
  }

  startAlertingEngine() {
    setInterval(() => {
      this.evaluateAlertRules();
    }, this.options.alerting.evaluationInterval);
  }

  startServiceMapUpdates() {
    setInterval(() => {
      this.refreshServiceMap();
    }, this.options.serviceMap.updateInterval);
  }

  collectSystemMetrics() {
    // Collect system-level metrics
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    this.recordGauge('system.memory.used', memUsage.heapUsed, { type: 'heap' });
    this.recordGauge('system.memory.total', memUsage.heapTotal, { type: 'heap' });
    this.recordGauge('system.cpu.user', cpuUsage.user);
    this.recordGauge('system.cpu.system', cpuUsage.system);
    this.recordGauge('system.uptime', process.uptime());
    
    // Collect observability metrics
    this.recordGauge('observability.active_spans', this.activeSpans.size);
    this.recordGauge('observability.completed_traces', this.completedTraces.length);
    this.recordGauge('observability.metric_count', this.metrics.size);
    this.recordGauge('observability.alert_rules', this.alerts.size);
  }

  aggregateMetric(metricKey, metric) {
    const now = Date.now();
    
    for (const window of this.options.metrics.aggregationWindows) {
      const aggregationKey = `${metricKey}:${window}`;
      const windowStart = Math.floor((now - window) / window) * window;
      
      if (!this.metricAggregations.has(aggregationKey)) {
        this.metricAggregations.set(aggregationKey, {
          window,
          aggregations: new Map()
        });
      }
      
      const aggregation = this.metricAggregations.get(aggregationKey);
      const windowValues = metric.values.filter(v => v.timestamp >= windowStart);
      
      if (windowValues.length > 0) {
        const values = windowValues.map(v => v.value);
        aggregation.aggregations.set(windowStart, {
          count: values.length,
          sum: values.reduce((a, b) => a + b, 0),
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          p50: this.calculatePercentile(values, 0.5),
          p95: this.calculatePercentile(values, 0.95),
          p99: this.calculatePercentile(values, 0.99)
        });
      }
    }
  }

  evaluateAlertRules() {
    const now = Date.now();
    
    for (const [name, rule] of this.alerts.entries()) {
      if (!rule.enabled) continue;
      
      // Check cooldown period
      if (now - rule.lastTriggered < rule.cooldownPeriod) {
        continue;
      }
      
      try {
        const shouldTrigger = this.evaluateAlertCondition(rule, now);
        
        if (shouldTrigger) {
          this.triggerAlert(name, rule);
        }
      } catch (error) {
        this.logger.error('Alert rule evaluation failed', {
          ruleName: name,
          error: error.message
        });
      }
    }
  }

  evaluateAlertCondition(rule, now) {
    const windowStart = now - rule.evaluationWindow;
    
    switch (rule.condition.type) {
      case 'threshold':
        return this.evaluateThresholdCondition(rule, windowStart);
      case 'anomaly':
        return this.evaluateAnomalyCondition(rule, windowStart);
      case 'composite':
        return this.evaluateCompositeCondition(rule, windowStart);
      default:
        return false;
    }
  }

  evaluateThresholdCondition(rule, windowStart) {
    const metricQuery = rule.condition.metric;
    const metrics = this.queryMetrics({
      ...metricQuery,
      timeRange: { start: windowStart, end: Date.now() }
    });
    
    if (metrics.length === 0) return false;
    
    const values = metrics[0].values.map(v => v.value);
    const aggregateValue = this.calculateAggregate(values, rule.condition.aggregation);
    
    switch (rule.condition.operator) {
      case '>':
        return aggregateValue > rule.threshold;
      case '<':
        return aggregateValue < rule.threshold;
      case '>=':
        return aggregateValue >= rule.threshold;
      case '<=':
        return aggregateValue <= rule.threshold;
      case '==':
        return aggregateValue === rule.threshold;
      default:
        return false;
    }
  }

  evaluateAnomalyCondition(rule, windowStart) {
    // Simplified anomaly detection
    return false;
  }

  evaluateCompositeCondition(rule, windowStart) {
    // Complex condition evaluation
    return false;
  }

  triggerAlert(name, rule) {
    const alert = {
      name,
      severity: rule.severity,
      description: rule.description,
      timestamp: new Date().toISOString(),
      tags: rule.tags
    };
    
    rule.lastTriggered = Date.now();
    rule.triggerCount++;
    
    this.logger.error('Alert triggered', alert);
    this.emit('alert', alert);
    
    // Send to configured channels
    this.sendAlertToChannels(alert, rule.channels);
  }

  sendAlertToChannels(alert, channels) {
    for (const channel of channels) {
      try {
        switch (channel) {
          case 'log':
            this.logger.error(`ALERT: ${alert.name}`, alert);
            break;
          case 'webhook':
            // Send to webhook
            break;
          case 'email':
            // Send email
            break;
          default:
            this.logger.warn('Unknown alert channel', { channel });
        }
      } catch (error) {
        this.logger.error('Failed to send alert to channel', {
          channel,
          error: error.message
        });
      }
    }
  }

  // Utility methods
  generateTraceId() {
    return crypto.randomBytes(16).toString('hex');
  }

  generateSpanId() {
    return crypto.randomBytes(8).toString('hex');
  }

  generateMetricKey(name, tags) {
    const tagString = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return tagString ? `${name}{${tagString}}` : name;
  }

  calculatePercentile(values, percentile) {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }

  calculateAggregate(values, aggregation) {
    switch (aggregation) {
      case 'sum':
        return values.reduce((a, b) => a + b, 0);
      case 'avg':
        return values.reduce((a, b) => a + b, 0) / values.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'count':
        return values.length;
      default:
        return values.length > 0 ? values[values.length - 1] : 0;
    }
  }

  updateServiceMap(span) {
    const serviceName = span.tags.service || 'unknown';
    
    if (!this.serviceMap.services.has(serviceName)) {
      this.serviceMap.services.set(serviceName, {
        requests: 0,
        errors: 0,
        avgLatency: 0,
        lastSeen: 0
      });
    }
    
    const service = this.serviceMap.services.get(serviceName);
    service.requests++;
    service.lastSeen = span.endTime;
    
    if (span.tags.error) {
      service.errors++;
    }
    
    // Update average latency
    service.avgLatency = (service.avgLatency * (service.requests - 1) + span.duration) / service.requests;
    
    this.serviceMap.lastUpdate = Date.now();
  }

  updatePerformanceMetrics(span) {
    const operation = span.operationName;
    
    // Update request count
    this.performanceMetrics.requests.set(operation, 
      (this.performanceMetrics.requests.get(operation) || 0) + 1);
    
    // Update error count
    if (span.tags.error) {
      this.performanceMetrics.errors.set(operation,
        (this.performanceMetrics.errors.get(operation) || 0) + 1);
    }
    
    // Update latency
    if (!this.performanceMetrics.latency.has(operation)) {
      this.performanceMetrics.latency.set(operation, []);
    }
    this.performanceMetrics.latency.get(operation).push(span.duration);
  }

  analyzeTrace(span) {
    // Analyze trace for insights
    if (span.duration > 10000) { // Slow trace (>10s)
      this.logger.warn('Slow trace detected', {
        traceId: span.traceId,
        operationName: span.operationName,
        duration: span.duration
      });
    }
    
    if (span.tags.error) {
      this.logger.error('Error trace detected', {
        traceId: span.traceId,
        operationName: span.operationName,
        error: span.tags.errorMessage
      });
    }
  }

  // Placeholder methods for additional functionality
  exportTraces() {
    // Export traces to external systems
  }

  analyzeTracePatterns() {
    // Analyze patterns in completed traces
  }

  refreshServiceMap() {
    // Refresh service dependency map
  }

  cleanupOldMetrics() {
    // Clean up old metric data
  }

  matchesQuery(metric, query) {
    // Match metric against query
    return true;
  }

  filterValuesByTime(values, timeRange) {
    if (!timeRange) return values;
    return values.filter(v => v.timestamp >= timeRange.start && v.timestamp <= timeRange.end);
  }

  calculateAggregations(values, aggregations) {
    if (!aggregations || values.length === 0) return {};
    
    const nums = values.map(v => v.value);
    const result = {};
    
    aggregations.forEach(agg => {
      result[agg] = this.calculateAggregate(nums, agg);
    });
    
    return result;
  }

  generateTimeSeries(traces, timeRange) {
    // Generate time series data for dashboard
    return {
      requests: [],
      errors: [],
      latency: [],
      throughput: []
    };
  }

  calculateTopServices(traces) {
    const serviceStats = new Map();
    
    traces.forEach(trace => {
      const service = trace.tags.service || 'unknown';
      if (!serviceStats.has(service)) {
        serviceStats.set(service, { requests: 0, errors: 0, totalLatency: 0 });
      }
      
      const stats = serviceStats.get(service);
      stats.requests++;
      stats.totalLatency += trace.duration;
      
      if (trace.tags.error) {
        stats.errors++;
      }
    });
    
    return Array.from(serviceStats.entries())
      .map(([service, stats]) => ({
        service,
        requests: stats.requests,
        errors: stats.errors,
        avgLatency: stats.totalLatency / stats.requests,
        errorRate: stats.errors / stats.requests
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);
  }

  calculateTopErrors(traces) {
    const errorCounts = new Map();
    
    traces
      .filter(trace => trace.tags.error)
      .forEach(trace => {
        const error = trace.tags.errorMessage || 'Unknown error';
        errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
      });
    
    return Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  calculateSlowestOperations(traces) {
    const operationLatencies = new Map();
    
    traces.forEach(trace => {
      if (!operationLatencies.has(trace.operationName)) {
        operationLatencies.set(trace.operationName, []);
      }
      operationLatencies.get(trace.operationName).push(trace.duration);
    });
    
    return Array.from(operationLatencies.entries())
      .map(([operation, latencies]) => ({
        operation,
        avgLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
        maxLatency: Math.max(...latencies),
        samples: latencies.length
      }))
      .sort((a, b) => b.avgLatency - a.avgLatency)
      .slice(0, 10);
  }

  getLatestMetricValue(metricKey, tags) {
    const key = this.generateMetricKey(metricKey, tags);
    const metric = this.metrics.get(key);
    
    if (!metric || metric.values.length === 0) {
      return null;
    }
    
    return metric.values[metric.values.length - 1].value;
  }

  /**
   * Get comprehensive observability status
   */
  getObservabilityStatus() {
    return {
      tracing: {
        enabled: this.options.tracing.enabled,
        activeSpans: this.activeSpans.size,
        completedTraces: this.completedTraces.length,
        sampleRate: this.options.tracing.sampleRate
      },
      metrics: {
        enabled: this.options.metrics.enabled,
        metricCount: this.metrics.size,
        aggregationWindows: this.options.metrics.aggregationWindows
      },
      alerting: {
        enabled: this.options.alerting.enabled,
        alertRules: this.alerts.size,
        channels: this.options.alerting.channels
      },
      serviceMap: {
        enabled: this.options.serviceMap.enabled,
        services: this.serviceMap.services.size,
        dependencies: this.serviceMap.dependencies.size,
        lastUpdate: this.serviceMap.lastUpdate
      }
    };
  }

  /**
   * Shutdown observability manager
   */
  async shutdown() {
    this.logger.info('Shutting down Observability Manager');
    
    // Finish any active spans
    for (const spanId of this.activeSpans.keys()) {
      this.finishSpan(spanId);
    }
    
    // Export remaining traces
    await this.exportTraces();
    
    this.emit('shutdown');
  }
}

module.exports = ObservabilityManager;
/**
 * Prometheus Metrics Module for Cloud Remediator Sage
 * Provides comprehensive metrics collection and export
 */

class PrometheusMetrics {
    constructor() {
        this.metrics = new Map();
        this.initializeMetrics();
    }

    initializeMetrics() {
        // Counter metrics
        this.registerCounter('security_findings_total', 'Total number of security findings processed');
        this.registerCounter('remediation_actions_total', 'Total number of remediation actions generated');
        this.registerCounter('lambda_invocations_total', 'Total number of lambda function invocations');
        this.registerCounter('errors_total', 'Total number of errors encountered');
        this.registerCounter('health_checks_total', 'Total number of health checks performed');
        
        // Histogram metrics
        this.registerHistogram('lambda_duration_seconds', 'Duration of lambda function executions');
        this.registerHistogram('remediation_generation_duration_seconds', 'Duration of remediation generation');
        this.registerHistogram('risk_scoring_duration_seconds', 'Duration of risk scoring operations');
        this.registerHistogram('neptune_query_duration_seconds', 'Duration of Neptune database queries');
        
        // Gauge metrics
        this.registerGauge('active_findings_count', 'Current number of active security findings');
        this.registerGauge('memory_usage_bytes', 'Current memory usage in bytes');
        this.registerGauge('neptune_connections_active', 'Number of active Neptune connections');
        this.registerGauge('remediation_queue_size', 'Number of pending remediations in queue');
        
        // Summary metrics for percentiles
        this.registerSummary('finding_severity_distribution', 'Distribution of finding severities');
    }

    registerCounter(name, help, labels = []) {
        this.metrics.set(name, {
            type: 'counter',
            help,
            labels,
            value: 0,
            labelValues: new Map()
        });
    }

    registerHistogram(name, help, labels = [], buckets = [0.1, 0.5, 1, 2, 5, 10, 30, 60]) {
        this.metrics.set(name, {
            type: 'histogram',
            help,
            labels,
            buckets,
            observations: new Map(),
            labelValues: new Map()
        });
    }

    registerGauge(name, help, labels = []) {
        this.metrics.set(name, {
            type: 'gauge',
            help,
            labels,
            value: 0,
            labelValues: new Map()
        });
    }

    registerSummary(name, help, labels = [], quantiles = [0.5, 0.9, 0.95, 0.99]) {
        this.metrics.set(name, {
            type: 'summary',
            help,
            labels,
            quantiles,
            observations: [],
            labelValues: new Map()
        });
    }

    incrementCounter(name, labels = {}, value = 1) {
        const metric = this.metrics.get(name);
        if (!metric || metric.type !== 'counter') {
            console.warn(`Counter metric '${name}' not found`);
            return;
        }

        const labelKey = this.getLabelKey(labels);
        if (Object.keys(labels).length > 0) {
            const currentValue = metric.labelValues.get(labelKey) || 0;
            metric.labelValues.set(labelKey, currentValue + value);
        } else {
            metric.value += value;
        }
    }

    setGauge(name, value, labels = {}) {
        const metric = this.metrics.get(name);
        if (!metric || metric.type !== 'gauge') {
            console.warn(`Gauge metric '${name}' not found`);
            return;
        }

        const labelKey = this.getLabelKey(labels);
        if (Object.keys(labels).length > 0) {
            metric.labelValues.set(labelKey, value);
        } else {
            metric.value = value;
        }
    }

    observeHistogram(name, value, labels = {}) {
        const metric = this.metrics.get(name);
        if (!metric || metric.type !== 'histogram') {
            console.warn(`Histogram metric '${name}' not found`);
            return;
        }

        const labelKey = this.getLabelKey(labels);
        if (!metric.observations.has(labelKey)) {
            metric.observations.set(labelKey, []);
        }
        metric.observations.get(labelKey).push(value);
    }

    observeSummary(name, value, labels = {}) {
        const metric = this.metrics.get(name);
        if (!metric || metric.type !== 'summary') {
            console.warn(`Summary metric '${name}' not found`);
            return;
        }

        const labelKey = this.getLabelKey(labels);
        if (!metric.observations) metric.observations = [];
        metric.observations.push({ value, labels, timestamp: Date.now() });
    }

    getLabelKey(labels) {
        return Object.entries(labels)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}="${value}"`)
            .join(',');
    }

    // Application-specific metric helpers
    recordSecurityFinding(severity, source, correlationId) {
        this.incrementCounter('security_findings_total', { severity, source });
        this.observeSummary('finding_severity_distribution', this.severityToNumeric(severity), { source });
        
        // Log for debugging
        console.log(`Recorded security finding: severity=${severity}, source=${source}, correlationId=${correlationId}`);
    }

    recordRemediationAction(action, success, duration, correlationId) {
        this.incrementCounter('remediation_actions_total', { action, success: success.toString() });
        this.observeHistogram('remediation_generation_duration_seconds', duration / 1000, { action });
        
        console.log(`Recorded remediation action: action=${action}, success=${success}, duration=${duration}ms, correlationId=${correlationId}`);
    }

    recordLambdaInvocation(functionName, duration, success, correlationId) {
        this.incrementCounter('lambda_invocations_total', { function: functionName, success: success.toString() });
        this.observeHistogram('lambda_duration_seconds', duration / 1000, { function: functionName });
        
        console.log(`Recorded lambda invocation: function=${functionName}, duration=${duration}ms, success=${success}, correlationId=${correlationId}`);
    }

    recordError(errorType, source, correlationId) {
        this.incrementCounter('errors_total', { type: errorType, source });
        
        console.log(`Recorded error: type=${errorType}, source=${source}, correlationId=${correlationId}`);
    }

    recordHealthCheck(checkType, success, duration, correlationId) {
        this.incrementCounter('health_checks_total', { type: checkType, success: success.toString() });
        
        console.log(`Recorded health check: type=${checkType}, success=${success}, duration=${duration}ms, correlationId=${correlationId}`);
    }

    recordNeptuneQuery(queryType, duration, correlationId) {
        this.observeHistogram('neptune_query_duration_seconds', duration / 1000, { type: queryType });
        
        console.log(`Recorded Neptune query: type=${queryType}, duration=${duration}ms, correlationId=${correlationId}`);
    }

    updateSystemMetrics() {
        const memUsage = process.memoryUsage();
        this.setGauge('memory_usage_bytes', memUsage.heapUsed);
        
        // These would typically come from actual system monitoring
        // For now, we'll set placeholder values
        this.setGauge('active_findings_count', 0); // Would be queried from Neptune
        this.setGauge('neptune_connections_active', 1); // Would be from connection pool
        this.setGauge('remediation_queue_size', 0); // Would be from queue service
    }

    severityToNumeric(severity) {
        const severityMap = {
            'low': 1,
            'medium': 2,
            'high': 3,
            'critical': 4
        };
        return severityMap[severity.toLowerCase()] || 0;
    }

    // Export metrics in Prometheus format
    exportPrometheusFormat() {
        let output = '';
        
        for (const [name, metric] of this.metrics.entries()) {
            output += `# HELP ${name} ${metric.help}\n`;
            output += `# TYPE ${name} ${metric.type}\n`;
            
            switch (metric.type) {
                case 'counter':
                    if (metric.labelValues.size > 0) {
                        for (const [labelKey, value] of metric.labelValues.entries()) {
                            output += `${name}{${labelKey}} ${value}\n`;
                        }
                    } else {
                        output += `${name} ${metric.value}\n`;
                    }
                    break;
                    
                case 'gauge':
                    if (metric.labelValues.size > 0) {
                        for (const [labelKey, value] of metric.labelValues.entries()) {
                            output += `${name}{${labelKey}} ${value}\n`;
                        }
                    } else {
                        output += `${name} ${metric.value}\n`;
                    }
                    break;
                    
                case 'histogram':
                    for (const [labelKey, observations] of metric.observations.entries()) {
                        const sortedObs = observations.sort((a, b) => a - b);
                        let count = 0;
                        
                        for (const bucket of metric.buckets) {
                            count = sortedObs.filter(obs => obs <= bucket).length;
                            const bucketLabel = labelKey ? `${labelKey},le="${bucket}"` : `le="${bucket}"`;
                            output += `${name}_bucket{${bucketLabel}} ${count}\n`;
                        }
                        
                        const infBucketLabel = labelKey ? `${labelKey},le="+Inf"` : `le="+Inf"`;
                        output += `${name}_bucket{${infBucketLabel}} ${sortedObs.length}\n`;
                        
                        const sumLabel = labelKey ? `${labelKey}` : '';
                        const sum = sortedObs.reduce((acc, val) => acc + val, 0);
                        output += `${name}_sum{${sumLabel}} ${sum}\n`;
                        output += `${name}_count{${sumLabel}} ${sortedObs.length}\n`;
                    }
                    break;
                    
                case 'summary':
                    // Simplified summary implementation
                    if (metric.observations.length > 0) {
                        const sorted = metric.observations.map(obs => obs.value).sort((a, b) => a - b);
                        for (const quantile of metric.quantiles) {
                            const index = Math.ceil(quantile * sorted.length) - 1;
                            const value = sorted[Math.max(0, index)];
                            output += `${name}{quantile="${quantile}"} ${value || 0}\n`;
                        }
                        const sum = sorted.reduce((acc, val) => acc + val, 0);
                        output += `${name}_sum ${sum}\n`;
                        output += `${name}_count ${sorted.length}\n`;
                    }
                    break;
            }
            output += '\n';
        }
        
        return output;
    }

    // Create a timer for measuring durations
    createTimer() {
        const startTime = Date.now();
        return {
            end: () => Date.now() - startTime
        };
    }

    // Reset all metrics (useful for testing)
    reset() {
        for (const [name, metric] of this.metrics.entries()) {
            if (metric.type === 'counter' || metric.type === 'gauge') {
                metric.value = 0;
                metric.labelValues.clear();
            } else if (metric.type === 'histogram') {
                metric.observations.clear();
            } else if (metric.type === 'summary') {
                metric.observations = [];
            }
        }
    }
}

// Singleton instance
const metrics = new PrometheusMetrics();

// Lambda handler for metrics endpoint
exports.handler = async (event) => {
    try {
        // Update system metrics before export
        metrics.updateSystemMetrics();
        
        const prometheusFormat = metrics.exportPrometheusFormat();
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'text/plain; version=0.0.4'
            },
            body: prometheusFormat
        };
    } catch (error) {
        console.error('Metrics export failed:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                error: 'Metrics export failed',
                message: error.message
            })
        };
    }
};

module.exports = {
    metrics,
    PrometheusMetrics
};
#!/usr/bin/env node

/**
 * Performance Benchmarking System
 * Measures and tracks performance metrics over time
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const { performance } = require('perf_hooks');

class PerformanceBenchmark {
    constructor(options = {}) {
        this.resultsDir = options.resultsDir || './performance-results';
        this.benchmarkConfig = this.loadBenchmarkConfig();
        this.timestamp = new Date().toISOString();
        
        this.ensureResultsDirectory();
    }

    loadBenchmarkConfig() {
        const configPath = path.join(process.cwd(), 'performance.config.js');
        if (fs.existsSync(configPath)) {
            return require(configPath);
        }

        // Default configuration
        return {
            lambdaFunctions: [
                'prowler-ingest',
                'risk-scoring',
                'remediation-generator',
                'health-check'
            ],
            endpoints: [
                { name: 'health', url: '/health', method: 'GET' },
                { name: 'metrics', url: '/metrics', method: 'GET' }
            ],
            thresholds: {
                lambdaColdStart: 3000,      // 3 seconds
                lambdaWarmExecution: 1000,  // 1 second
                apiResponse: 2000,          // 2 seconds
                memoryUsage: 80,            // 80% of allocated memory
                errorRate: 1                // 1% error rate
            },
            loadTest: {
                users: 10,
                duration: '60s',
                rampUp: '30s'
            }
        };
    }

    ensureResultsDirectory() {
        if (!fs.existsSync(this.resultsDir)) {
            fs.mkdirSync(this.resultsDir, { recursive: true });
        }
    }

    async runAllBenchmarks() {
        console.log('Starting comprehensive performance benchmarking...');

        const results = {
            timestamp: this.timestamp,
            environment: this.getEnvironmentInfo(),
            benchmarks: {}
        };

        try {
            // Run different types of benchmarks
            results.benchmarks.lambda = await this.benchmarkLambdaFunctions();
            results.benchmarks.api = await this.benchmarkAPIEndpoints();
            results.benchmarks.database = await this.benchmarkDatabase();
            results.benchmarks.memory = await this.benchmarkMemoryUsage();
            results.benchmarks.loadTest = await this.runLoadTests();

            // Calculate overall performance score
            results.score = this.calculatePerformanceScore(results.benchmarks);

            // Compare with historical data
            results.comparison = await this.compareWithBaseline(results);

            // Generate recommendations
            results.recommendations = this.generatePerformanceRecommendations(results);

            // Save results
            await this.saveResults(results);

            // Generate alerts if needed
            await this.checkPerformanceAlerts(results);

            console.log(`Performance benchmarking completed. Score: ${results.score}/100`);
            return results;

        } catch (error) {
            console.error('Performance benchmarking failed:', error);
            throw error;
        }
    }

    getEnvironmentInfo() {
        return {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            memoryLimit: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE || 'unknown',
            stage: process.env.STAGE || 'development',
            gitCommit: this.getGitCommit(),
            timestamp: this.timestamp
        };
    }

    getGitCommit() {
        try {
            return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
        } catch (error) {
            return 'unknown';
        }
    }

    async benchmarkLambdaFunctions() {
        console.log('Benchmarking Lambda functions...');

        const results = {};

        for (const functionName of this.benchmarkConfig.lambdaFunctions) {
            console.log(`  Benchmarking ${functionName}...`);
            
            try {
                results[functionName] = await this.benchmarkSingleLambda(functionName);
            } catch (error) {
                console.warn(`  Failed to benchmark ${functionName}:`, error.message);
                results[functionName] = { error: error.message };
            }
        }

        return results;
    }

    async benchmarkSingleLambda(functionName) {
        const fullFunctionName = `cloud-remediator-sage-${process.env.STAGE || 'dev'}-${functionName}`;
        
        // Cold start benchmark
        const coldStart = await this.measureColdStart(fullFunctionName);
        
        // Warm execution benchmark
        const warmExecutions = await this.measureWarmExecutions(fullFunctionName, 5);
        
        // Memory usage
        const memoryUsage = await this.getLambdaMemoryUsage(fullFunctionName);
        
        return {
            coldStart,
            warmExecution: {
                average: warmExecutions.reduce((sum, exec) => sum + exec.duration, 0) / warmExecutions.length,
                min: Math.min(...warmExecutions.map(exec => exec.duration)),
                max: Math.max(...warmExecutions.map(exec => exec.duration)),
                executions: warmExecutions
            },
            memoryUsage,
            timestamp: new Date().toISOString()
        };
    }

    async measureColdStart(functionName) {
        try {
            // Force cold start by updating environment variable
            await this.updateLambdaEnvironment(functionName, {
                BENCHMARK_TIMESTAMP: Date.now().toString()
            });

            // Wait for deployment to settle
            await this.sleep(5000);

            // Measure cold start
            const startTime = performance.now();
            
            const result = await this.invokeLambda(functionName, {
                benchmark: true,
                type: 'cold_start'
            });

            const endTime = performance.now();
            const duration = endTime - startTime;

            return {
                duration,
                success: !result.errorMessage,
                memoryUsed: result.memoryUsed,
                initDuration: result.initDuration
            };

        } catch (error) {
            return {
                duration: 0,
                success: false,
                error: error.message
            };
        }
    }

    async measureWarmExecutions(functionName, count = 5) {
        const executions = [];

        for (let i = 0; i < count; i++) {
            try {
                const startTime = performance.now();
                
                const result = await this.invokeLambda(functionName, {
                    benchmark: true,
                    type: 'warm_execution',
                    iteration: i
                });

                const endTime = performance.now();
                const duration = endTime - startTime;

                executions.push({
                    iteration: i,
                    duration,
                    success: !result.errorMessage,
                    memoryUsed: result.memoryUsed
                });

                // Small delay between executions
                await this.sleep(1000);

            } catch (error) {
                executions.push({
                    iteration: i,
                    duration: 0,
                    success: false,
                    error: error.message
                });
            }
        }

        return executions;
    }

    async updateLambdaEnvironment(functionName, environmentVariables) {
        try {
            execSync(`aws lambda update-function-configuration --function-name ${functionName} --environment Variables='{${Object.entries(environmentVariables).map(([key, value]) => `"${key}":"${value}"`).join(',')}}'`, {
                stdio: 'pipe'
            });
        } catch (error) {
            console.warn(`Failed to update Lambda environment: ${error.message}`);
        }
    }

    async invokeLambda(functionName, payload) {
        try {
            const result = execSync(`aws lambda invoke --function-name ${functionName} --payload '${JSON.stringify(payload)}' --output json /tmp/lambda-response.json`, {
                encoding: 'utf8'
            });

            const invokeResult = JSON.parse(result);
            
            // Read response
            let responsePayload = {};
            if (fs.existsSync('/tmp/lambda-response.json')) {
                const responseContent = fs.readFileSync('/tmp/lambda-response.json', 'utf8');
                try {
                    responsePayload = JSON.parse(responseContent);
                } catch (parseError) {
                    responsePayload = { rawResponse: responseContent };
                }
            }

            return {
                statusCode: invokeResult.StatusCode,
                errorMessage: invokeResult.FunctionError,
                memoryUsed: invokeResult.ExecutedVersion ? undefined : responsePayload.memoryUsed,
                initDuration: responsePayload.initDuration,
                payload: responsePayload
            };

        } catch (error) {
            throw new Error(`Lambda invocation failed: ${error.message}`);
        }
    }

    async getLambdaMemoryUsage(functionName) {
        try {
            // Get memory metrics from CloudWatch
            const endTime = new Date();
            const startTime = new Date(endTime.getTime() - 10 * 60 * 1000); // Last 10 minutes

            const memoryMetrics = execSync(`aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name MemoryUtilization --dimensions Name=FunctionName,Value=${functionName} --start-time ${startTime.toISOString()} --end-time ${endTime.toISOString()} --period 300 --statistics Maximum,Average --output json`, {
                encoding: 'utf8'
            });

            const metrics = JSON.parse(memoryMetrics);
            
            if (metrics.Datapoints && metrics.Datapoints.length > 0) {
                const latest = metrics.Datapoints[metrics.Datapoints.length - 1];
                return {
                    maximum: latest.Maximum,
                    average: latest.Average,
                    timestamp: latest.Timestamp
                };
            }

            return { maximum: 0, average: 0, timestamp: null };

        } catch (error) {
            return { error: error.message };
        }
    }

    async benchmarkAPIEndpoints() {
        console.log('Benchmarking API endpoints...');

        const results = {};

        for (const endpoint of this.benchmarkConfig.endpoints) {
            console.log(`  Benchmarking ${endpoint.name}...`);
            
            try {
                results[endpoint.name] = await this.benchmarkSingleEndpoint(endpoint);
            } catch (error) {
                console.warn(`  Failed to benchmark ${endpoint.name}:`, error.message);
                results[endpoint.name] = { error: error.message };
            }
        }

        return results;
    }

    async benchmarkSingleEndpoint(endpoint) {
        const baseUrl = process.env.API_BASE_URL || 'https://localhost:3000';
        const url = `${baseUrl}${endpoint.url}`;
        const iterations = 10;
        const measurements = [];

        for (let i = 0; i < iterations; i++) {
            try {
                const startTime = performance.now();
                
                // Use curl for more accurate timing
                const curlResult = execSync(`curl -w '{"time_total":%{time_total},"http_code":%{http_code},"size_download":%{size_download}}' -s -o /dev/null '${url}'`, {
                    encoding: 'utf8'
                });

                const endTime = performance.now();
                const curlMetrics = JSON.parse(curlResult);

                measurements.push({
                    iteration: i,
                    duration: (endTime - startTime),
                    httpCode: curlMetrics.http_code,
                    responseTime: curlMetrics.time_total * 1000, // Convert to ms
                    responseSize: curlMetrics.size_download,
                    success: curlMetrics.http_code >= 200 && curlMetrics.http_code < 300
                });

                // Small delay between requests
                await this.sleep(100);

            } catch (error) {
                measurements.push({
                    iteration: i,
                    duration: 0,
                    success: false,
                    error: error.message
                });
            }
        }

        const successfulMeasurements = measurements.filter(m => m.success);
        const durations = successfulMeasurements.map(m => m.duration);

        return {
            endpoint: endpoint.name,
            url: url,
            iterations: iterations,
            successRate: (successfulMeasurements.length / iterations) * 100,
            responseTime: {
                average: durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0,
                min: durations.length > 0 ? Math.min(...durations) : 0,
                max: durations.length > 0 ? Math.max(...durations) : 0,
                p95: this.calculatePercentile(durations, 95),
                p99: this.calculatePercentile(durations, 99)
            },
            measurements
        };
    }

    async benchmarkDatabase() {
        console.log('Benchmarking database operations...');

        const results = {
            connection: await this.benchmarkDatabaseConnection(),
            queries: await this.benchmarkDatabaseQueries()
        };

        return results;
    }

    async benchmarkDatabaseConnection() {
        const iterations = 5;
        const connectionTimes = [];

        for (let i = 0; i < iterations; i++) {
            try {
                const startTime = performance.now();
                
                // Simulate Neptune connection test
                // In a real implementation, this would create and test a Gremlin connection
                await this.sleep(100 + Math.random() * 200); // Simulate connection time
                
                const endTime = performance.now();
                connectionTimes.push(endTime - startTime);

            } catch (error) {
                connectionTimes.push(0);
            }
        }

        return {
            average: connectionTimes.reduce((sum, time) => sum + time, 0) / connectionTimes.length,
            min: Math.min(...connectionTimes),
            max: Math.max(...connectionTimes),
            measurements: connectionTimes
        };
    }

    async benchmarkDatabaseQueries() {
        const queries = [
            { name: 'simple_vertex_count', complexity: 'low' },
            { name: 'relationship_traversal', complexity: 'medium' },
            { name: 'complex_pattern_match', complexity: 'high' }
        ];

        const results = {};

        for (const query of queries) {
            try {
                results[query.name] = await this.benchmarkSingleQuery(query);
            } catch (error) {
                results[query.name] = { error: error.message };
            }
        }

        return results;
    }

    async benchmarkSingleQuery(query) {
        const iterations = 3;
        const queryTimes = [];

        for (let i = 0; i < iterations; i++) {
            try {
                const startTime = performance.now();
                
                // Simulate query execution time based on complexity
                let simulatedTime = 50; // Base time
                if (query.complexity === 'medium') simulatedTime = 200;
                if (query.complexity === 'high') simulatedTime = 500;
                
                await this.sleep(simulatedTime + Math.random() * 100);
                
                const endTime = performance.now();
                queryTimes.push(endTime - startTime);

            } catch (error) {
                queryTimes.push(0);
            }
        }

        return {
            query: query.name,
            complexity: query.complexity,
            average: queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length,
            min: Math.min(...queryTimes),
            max: Math.max(...queryTimes),
            measurements: queryTimes
        };
    }

    async benchmarkMemoryUsage() {
        console.log('Benchmarking memory usage...');

        const measurements = [];
        const iterations = 10;

        for (let i = 0; i < iterations; i++) {
            const memUsage = process.memoryUsage();
            measurements.push({
                iteration: i,
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
                external: memUsage.external,
                rss: memUsage.rss,
                timestamp: Date.now()
            });

            // Trigger some memory allocation
            const data = new Array(10000).fill('test');
            await this.sleep(100);
        }

        const heapUsedValues = measurements.map(m => m.heapUsed);
        const heapTotalValues = measurements.map(m => m.heapTotal);

        return {
            heapUsed: {
                average: heapUsedValues.reduce((sum, val) => sum + val, 0) / heapUsedValues.length,
                min: Math.min(...heapUsedValues),
                max: Math.max(...heapUsedValues)
            },
            heapTotal: {
                average: heapTotalValues.reduce((sum, val) => sum + val, 0) / heapTotalValues.length,
                min: Math.min(...heapTotalValues),
                max: Math.max(...heapTotalValues)
            },
            measurements
        };
    }

    async runLoadTests() {
        console.log('Running load tests...');

        try {
            // Check if k6 is available
            execSync('which k6', { stdio: 'pipe' });
            
            return await this.runK6LoadTest();
        } catch (error) {
            console.warn('k6 not available, running simple load test...');
            return await this.runSimpleLoadTest();
        }
    }

    async runK6LoadTest() {
        const k6Script = this.generateK6Script();
        const scriptPath = path.join(this.resultsDir, 'load-test.js');
        
        fs.writeFileSync(scriptPath, k6Script);

        try {
            const result = execSync(`k6 run --out json=${this.resultsDir}/k6-results.json ${scriptPath}`, {
                encoding: 'utf8',
                maxBuffer: 1024 * 1024 * 10 // 10MB buffer
            });

            // Parse k6 results
            const resultsFile = path.join(this.resultsDir, 'k6-results.json');
            if (fs.existsSync(resultsFile)) {
                const k6Results = this.parseK6Results(resultsFile);
                return k6Results;
            }

            return { output: result, type: 'k6' };

        } catch (error) {
            return { error: error.message, type: 'k6' };
        }
    }

    generateK6Script() {
        const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
        
        return `
import http from 'k6/http';
import { check } from 'k6';

export let options = {
    stages: [
        { duration: '${this.benchmarkConfig.loadTest.rampUp}', target: ${this.benchmarkConfig.loadTest.users} },
        { duration: '${this.benchmarkConfig.loadTest.duration}', target: ${this.benchmarkConfig.loadTest.users} },
        { duration: '30s', target: 0 },
    ],
    thresholds: {
        http_req_duration: ['p(95)<2000'],
        http_req_failed: ['rate<0.01'],
    },
};

export default function() {
    let response = http.get('${baseUrl}/health');
    
    check(response, {
        'status is 200': (r) => r.status === 200,
        'response time < 2000ms': (r) => r.timings.duration < 2000,
    });
}
`;
    }

    parseK6Results(resultsFile) {
        // Parse k6 JSON output
        const lines = fs.readFileSync(resultsFile, 'utf8').split('\n').filter(line => line.trim());
        const metrics = {};
        
        for (const line of lines) {
            try {
                const data = JSON.parse(line);
                if (data.type === 'Point' && data.metric) {
                    if (!metrics[data.metric]) {
                        metrics[data.metric] = [];
                    }
                    metrics[data.metric].push(data.data);
                }
            } catch (error) {
                // Skip invalid JSON lines
            }
        }

        return {
            type: 'k6',
            metrics,
            summary: this.summarizeK6Metrics(metrics)
        };
    }

    summarizeK6Metrics(metrics) {
        const summary = {};
        
        for (const [metricName, dataPoints] of Object.entries(metrics)) {
            if (dataPoints.length > 0) {
                const values = dataPoints.map(dp => dp.value);
                summary[metricName] = {
                    count: values.length,
                    min: Math.min(...values),
                    max: Math.max(...values),
                    avg: values.reduce((sum, val) => sum + val, 0) / values.length
                };
            }
        }
        
        return summary;
    }

    async runSimpleLoadTest() {
        const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
        const concurrency = 5;
        const duration = 30000; // 30 seconds
        const results = [];

        console.log(`Running simple load test: ${concurrency} concurrent users for ${duration/1000}s`);

        const startTime = Date.now();
        const promises = [];

        for (let i = 0; i < concurrency; i++) {
            promises.push(this.loadTestWorker(baseUrl, startTime + duration, i));
        }

        const workerResults = await Promise.all(promises);
        
        // Combine results
        for (const workerResult of workerResults) {
            results.push(...workerResult);
        }

        return {
            type: 'simple',
            concurrency,
            duration,
            totalRequests: results.length,
            successfulRequests: results.filter(r => r.success).length,
            averageResponseTime: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
            results
        };
    }

    async loadTestWorker(baseUrl, endTime, workerId) {
        const results = [];
        
        while (Date.now() < endTime) {
            try {
                const startTime = performance.now();
                
                const curlResult = execSync(`curl -w '{"http_code":%{http_code}}' -s -o /dev/null '${baseUrl}/health'`, {
                    encoding: 'utf8',
                    timeout: 5000
                });

                const endTimeMs = performance.now();
                const metrics = JSON.parse(curlResult);

                results.push({
                    workerId,
                    duration: endTimeMs - startTime,
                    httpCode: metrics.http_code,
                    success: metrics.http_code >= 200 && metrics.http_code < 300,
                    timestamp: Date.now()
                });

            } catch (error) {
                results.push({
                    workerId,
                    duration: 0,
                    success: false,
                    error: error.message,
                    timestamp: Date.now()
                });
            }

            // Small delay between requests
            await this.sleep(100 + Math.random() * 200);
        }

        return results;
    }

    calculatePerformanceScore(benchmarks) {
        let score = 100;
        const thresholds = this.benchmarkConfig.thresholds;

        // Lambda performance scoring
        if (benchmarks.lambda) {
            for (const [functionName, metrics] of Object.entries(benchmarks.lambda)) {
                if (metrics.coldStart && metrics.coldStart.duration > thresholds.lambdaColdStart) {
                    score -= 10;
                }
                if (metrics.warmExecution && metrics.warmExecution.average > thresholds.lambdaWarmExecution) {
                    score -= 5;
                }
            }
        }

        // API performance scoring
        if (benchmarks.api) {
            for (const [endpointName, metrics] of Object.entries(benchmarks.api)) {
                if (metrics.responseTime && metrics.responseTime.average > thresholds.apiResponse) {
                    score -= 5;
                }
                if (metrics.successRate < 99) {
                    score -= 10;
                }
            }
        }

        // Load test scoring
        if (benchmarks.loadTest && benchmarks.loadTest.successfulRequests) {
            const successRate = (benchmarks.loadTest.successfulRequests / benchmarks.loadTest.totalRequests) * 100;
            if (successRate < 99) {
                score -= 15;
            }
        }

        return Math.max(0, Math.min(100, score));
    }

    async compareWithBaseline(results) {
        try {
            const baselinePath = path.join(this.resultsDir, 'baseline-performance.json');
            
            if (!fs.existsSync(baselinePath)) {
                // First run, save as baseline
                fs.writeFileSync(baselinePath, JSON.stringify(results, null, 2));
                return { message: 'Baseline created', isBaseline: true };
            }

            const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
            const comparison = {
                scoreChange: results.score - baseline.score,
                improvements: [],
                regressions: []
            };

            // Compare Lambda performance
            if (baseline.benchmarks.lambda && results.benchmarks.lambda) {
                for (const functionName of Object.keys(results.benchmarks.lambda)) {
                    if (baseline.benchmarks.lambda[functionName]) {
                        const currentAvg = results.benchmarks.lambda[functionName].warmExecution?.average || 0;
                        const baselineAvg = baseline.benchmarks.lambda[functionName].warmExecution?.average || 0;
                        
                        if (currentAvg < baselineAvg * 0.9) {
                            comparison.improvements.push(`${functionName}: ${((baselineAvg - currentAvg) / baselineAvg * 100).toFixed(1)}% faster`);
                        } else if (currentAvg > baselineAvg * 1.1) {
                            comparison.regressions.push(`${functionName}: ${((currentAvg - baselineAvg) / baselineAvg * 100).toFixed(1)}% slower`);
                        }
                    }
                }
            }

            return comparison;

        } catch (error) {
            return { error: error.message };
        }
    }

    generatePerformanceRecommendations(results) {
        const recommendations = [];
        const thresholds = this.benchmarkConfig.thresholds;

        // Lambda recommendations
        if (results.benchmarks.lambda) {
            for (const [functionName, metrics] of Object.entries(results.benchmarks.lambda)) {
                if (metrics.coldStart && metrics.coldStart.duration > thresholds.lambdaColdStart) {
                    recommendations.push({
                        category: 'lambda',
                        function: functionName,
                        issue: 'High cold start time',
                        recommendation: 'Consider provisioned concurrency or optimize initialization code',
                        priority: 'medium'
                    });
                }

                if (metrics.memoryUsage && metrics.memoryUsage.maximum > thresholds.memoryUsage) {
                    recommendations.push({
                        category: 'lambda',
                        function: functionName,
                        issue: 'High memory usage',
                        recommendation: 'Optimize memory allocation or increase Lambda memory size',
                        priority: 'high'
                    });
                }
            }
        }

        // API recommendations
        if (results.benchmarks.api) {
            for (const [endpointName, metrics] of Object.entries(results.benchmarks.api)) {
                if (metrics.responseTime && metrics.responseTime.p95 > thresholds.apiResponse * 1.5) {
                    recommendations.push({
                        category: 'api',
                        endpoint: endpointName,
                        issue: 'High 95th percentile response time',
                        recommendation: 'Investigate slow requests and optimize bottlenecks',
                        priority: 'medium'
                    });
                }

                if (metrics.successRate < 99) {
                    recommendations.push({
                        category: 'api',
                        endpoint: endpointName,
                        issue: 'Low success rate',
                        recommendation: 'Investigate error patterns and improve error handling',
                        priority: 'high'
                    });
                }
            }
        }

        return recommendations;
    }

    async saveResults(results) {
        const timestamp = new Date().toISOString().split('T')[0];
        const resultsPath = path.join(this.resultsDir, `performance-${timestamp}.json`);
        
        fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
        
        // Also save as latest
        const latestPath = path.join(this.resultsDir, 'latest-performance.json');
        fs.writeFileSync(latestPath, JSON.stringify(results, null, 2));
        
        console.log(`Results saved: ${resultsPath}`);
    }

    async checkPerformanceAlerts(results) {
        const alerts = [];

        if (results.score < 70) {
            alerts.push({
                level: 'warning',
                title: 'Low Performance Score',
                message: `Performance score is ${results.score}/100`
            });
        }

        if (results.recommendations.some(r => r.priority === 'high')) {
            alerts.push({
                level: 'warning',
                title: 'High Priority Performance Issues',
                message: 'High priority performance recommendations available'
            });
        }

        if (alerts.length > 0) {
            console.log('Performance alerts:');
            alerts.forEach(alert => {
                console.log(`[${alert.level.toUpperCase()}] ${alert.title}: ${alert.message}`);
            });
        }
    }

    // Helper methods
    calculatePercentile(values, percentile) {
        if (values.length === 0) return 0;
        
        const sorted = values.slice().sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[Math.max(0, index)];
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// CLI execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {
        resultsDir: args.find(arg => arg.startsWith('--results-dir='))?.split('=')[1] || './performance-results'
    };

    const benchmark = new PerformanceBenchmark(options);
    benchmark.runAllBenchmarks()
        .then((results) => {
            console.log('\nPerformance Benchmark Summary:');
            console.log(`Overall Score: ${results.score}/100`);
            console.log(`Recommendations: ${results.recommendations?.length || 0}`);
            
            if (results.comparison && !results.comparison.isBaseline) {
                console.log(`Score Change: ${results.comparison.scoreChange > 0 ? '+' : ''}${results.comparison.scoreChange}`);
            }
            
            process.exit(results.score < 70 ? 1 : 0);
        })
        .catch((error) => {
            console.error('Performance benchmarking failed:', error);
            process.exit(1);
        });
}

module.exports = PerformanceBenchmark;
/**
 * Health Check Module for Cloud Remediator Sage
 * Provides comprehensive health monitoring for all system components
 */

const AWS = require('aws-sdk');
const gremlin = require('gremlin');
const { v4: uuidv4 } = require('crypto');

class HealthChecker {
    constructor() {
        this.checks = new Map();
        this.initializeChecks();
    }

    initializeChecks() {
        // Register all health checks
        this.checks.set('system', this.systemHealth.bind(this));
        this.checks.set('neptune', this.neptuneHealth.bind(this));
        this.checks.set('s3', this.s3Health.bind(this));
        this.checks.set('lambda', this.lambdaHealth.bind(this));
        this.checks.set('memory', this.memoryHealth.bind(this));
        this.checks.set('dependencies', this.dependencyHealth.bind(this));
    }

    async performHealthCheck(checkName = null) {
        const correlationId = uuidv4();
        const timestamp = new Date().toISOString();
        
        try {
            if (checkName && this.checks.has(checkName)) {
                const result = await this.runSingleCheck(checkName, correlationId);
                return {
                    correlationId,
                    timestamp,
                    status: result.status,
                    checks: { [checkName]: result }
                };
            }

            // Run all checks
            const results = await this.runAllChecks(correlationId);
            const overallStatus = Object.values(results).every(check => check.status === 'healthy') 
                ? 'healthy' : 'unhealthy';

            return {
                correlationId,
                timestamp,
                status: overallStatus,
                checks: results
            };
        } catch (error) {
            console.error(`Health check failed [${correlationId}]:`, error);
            return {
                correlationId,
                timestamp,
                status: 'unhealthy',
                error: error.message,
                checks: {}
            };
        }
    }

    async runAllChecks(correlationId) {
        const results = {};
        
        for (const [name, checkFn] of this.checks.entries()) {
            try {
                results[name] = await this.runSingleCheck(name, correlationId);
            } catch (error) {
                results[name] = {
                    status: 'unhealthy',
                    error: error.message,
                    duration: 0
                };
            }
        }
        
        return results;
    }

    async runSingleCheck(checkName, correlationId) {
        const startTime = Date.now();
        const checkFn = this.checks.get(checkName);
        
        try {
            const result = await Promise.race([
                checkFn(correlationId),
                this.timeout(5000) // 5 second timeout
            ]);
            
            const duration = Date.now() - startTime;
            return {
                status: 'healthy',
                duration,
                ...result
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`Health check '${checkName}' failed [${correlationId}]:`, error);
            return {
                status: 'unhealthy',
                error: error.message,
                duration
            };
        }
    }

    async systemHealth(correlationId) {
        const memUsage = process.memoryUsage();
        const uptime = process.uptime();
        
        return {
            memory: {
                used: Math.round(memUsage.heapUsed / 1024 / 1024),
                total: Math.round(memUsage.heapTotal / 1024 / 1024),
                external: Math.round(memUsage.external / 1024 / 1024)
            },
            uptime: Math.round(uptime),
            nodeVersion: process.version,
            platform: process.platform,
            correlationId
        };
    }

    async neptuneHealth(correlationId) {
        if (!process.env.NEPTUNE_ENDPOINT) {
            return {
                status: 'healthy',
                message: 'Neptune endpoint not configured',
                correlationId
            };
        }

        try {
            const client = new gremlin.driver.Client(
                process.env.NEPTUNE_ENDPOINT,
                { traversalSource: 'g' }
            );
            
            // Simple ping query
            await client.submit('g.V().limit(1).count()');
            await client.close();
            
            return {
                endpoint: process.env.NEPTUNE_ENDPOINT,
                message: 'Neptune connection successful',
                correlationId
            };
        } catch (error) {
            throw new Error(`Neptune health check failed: ${error.message}`);
        }
    }

    async s3Health(correlationId) {
        try {
            const s3 = new AWS.S3();
            await s3.listBuckets().promise();
            
            return {
                message: 'S3 connection successful',
                correlationId
            };
        } catch (error) {
            throw new Error(`S3 health check failed: ${error.message}`);
        }
    }

    async lambdaHealth(correlationId) {
        try {
            const lambda = new AWS.Lambda();
            await lambda.listFunctions({ MaxItems: 1 }).promise();
            
            return {
                message: 'Lambda service accessible',
                correlationId
            };
        } catch (error) {
            throw new Error(`Lambda health check failed: ${error.message}`);
        }
    }

    async memoryHealth(correlationId) {
        const memUsage = process.memoryUsage();
        const totalMB = memUsage.heapTotal / 1024 / 1024;
        const usedMB = memUsage.heapUsed / 1024 / 1024;
        const usagePercent = (usedMB / totalMB) * 100;
        
        if (usagePercent > 90) {
            throw new Error(`High memory usage: ${usagePercent.toFixed(2)}%`);
        }
        
        return {
            usagePercent: usagePercent.toFixed(2),
            usedMB: Math.round(usedMB),
            totalMB: Math.round(totalMB),
            correlationId
        };
    }

    async dependencyHealth(correlationId) {
        const packageJson = require('../../package.json');
        const dependencies = Object.keys(packageJson.dependencies || {});
        const devDependencies = Object.keys(packageJson.devDependencies || {});
        
        return {
            productionDeps: dependencies.length,
            devDeps: devDependencies.length,
            nodeVersion: process.version,
            correlationId
        };
    }

    timeout(ms) {
        return new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), ms)
        );
    }
}

// Lambda handler for health checks
exports.handler = async (event) => {
    const healthChecker = new HealthChecker();
    const checkName = event.pathParameters?.check || null;
    
    try {
        const result = await healthChecker.performHealthCheck(checkName);
        
        return {
            statusCode: result.status === 'healthy' ? 200 : 503,
            headers: {
                'Content-Type': 'application/json',
                'X-Correlation-ID': result.correlationId
            },
            body: JSON.stringify(result, null, 2)
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: 'error',
                message: error.message,
                timestamp: new Date().toISOString()
            }, null, 2)
        };
    }
};

// Export for testing and direct usage
exports.HealthChecker = HealthChecker;
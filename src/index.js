/**
 * Main entry point for the Cloud Remediator Sage platform
 * Provides initialization and core orchestration capabilities
 */

const { StructuredLogger } = require('./monitoring/logger');
const NeptuneService = require('./services/NeptuneService');
const SecurityAnalysisService = require('./services/SecurityAnalysisService');
const QuantumAutoExecutor = require('./quantum/AutoExecutor');
const QuantumTaskPlanner = require('./quantum/TaskPlanner');
const ResilienceManager = require('./reliability/ResilienceManager');
const PerformanceManager = require('./performance/PerformanceManager');
const i18nManager = require('./i18n');

// Initialize global logger
const logger = new StructuredLogger('cloud-remediator-sage');

class CloudRemediatorSage {
  constructor(config = {}) {
    this.config = {
      stage: process.env.STAGE || 'dev',
      region: process.env.AWS_REGION || 'us-east-1',
      neptuneEndpoint: process.env.NEPTUNE_ENDPOINT,
      logLevel: process.env.LOG_LEVEL || 'info',
      ...config
    };

    this.logger = logger;
    this.performanceManager = new PerformanceManager();
    this.resilienceManager = new ResilienceManager();
    this.neptuneService = new NeptuneService();
    this.securityService = new SecurityAnalysisService();
    this.autoExecutor = new QuantumAutoExecutor();
    this.taskPlanner = new QuantumTaskPlanner();
    this.i18n = i18nManager;
    
    this.initialized = false;
  }

  /**
   * Initialize the platform services
   */
  async initialize() {
    if (this.initialized) return;

    this.logger.info('Initializing Cloud Remediator Sage platform', {
      stage: this.config.stage,
      region: this.config.region
    });

    try {
      // Initialize performance manager first for optimal startup
      await this.performanceManager.initialize();
      this.logger.info('Performance manager initialized');

      // Initialize resilience manager
      await this.resilienceManager.initialize();
      this.logger.info('Resilience manager initialized');

      // Initialize I18n with performance and resilience
      await this.performanceManager.executeWithPerformance(
        () => this.resilienceManager.executeWithResilience(
          () => this.i18n.initialize ? this.i18n.initialize() : Promise.resolve(),
          { serviceName: 'i18n', timeout: 10000 }
        ),
        { cacheKey: 'i18n-init', cacheTTL: 3600000, operationName: 'i18n-initialization' }
      );
      this.logger.info('I18n initialized');

      // Test Neptune connection with performance and resilience
      const neptuneHealth = await this.performanceManager.executeWithPerformance(
        () => this.resilienceManager.executeWithResilience(
          () => this.neptuneService.healthCheck(),
          { serviceName: 'neptune', useRetry: true, maxRetries: 2 }
        ),
        { cacheKey: 'neptune-health', cacheTTL: 30000, operationName: 'neptune-health-check' }
      );
      
      if (neptuneHealth.status === 'healthy') {
        this.logger.info('Neptune connection established', neptuneHealth.stats);
      } else {
        this.logger.warn('Neptune connection issues', neptuneHealth);
      }

      // Initialize quantum task planner with performance and resilience
      await this.performanceManager.executeWithPerformance(
        () => this.resilienceManager.executeWithResilience(
          () => this.taskPlanner.initialize ? this.taskPlanner.initialize() : Promise.resolve(),
          { serviceName: 'task-planner', timeout: 15000 }
        ),
        { operationName: 'task-planner-initialization', useOptimizer: true }
      );
      this.logger.info('Quantum task planner initialized');

      this.initialized = true;
      this.logger.info('Cloud Remediator Sage platform initialized successfully');

    } catch (error) {
      this.logger.error('Platform initialization failed', { error: error.message });
      // Don't throw in resilient mode - continue with degraded functionality
      this.logger.warn('Continuing with degraded functionality');
      this.initialized = true;
    }
  }

  /**
   * Process security findings from various scanners
   */
  async processFinding(rawFinding, source = 'unknown') {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const finding = await this.securityService.processFinding(rawFinding, source);
      
      this.logger.info('Finding processed successfully', {
        findingId: finding.id,
        source: finding.source,
        severity: finding.severity,
        resourceArn: finding.resource.arn
      });

      return finding;
    } catch (error) {
      this.logger.error('Failed to process finding', {
        error: error.message,
        source,
        rawFinding: JSON.stringify(rawFinding).substring(0, 200)
      });
      throw error;
    }
  }

  /**
   * Execute autonomous remediation planning
   */
  async planRemediation(findingIds = [], options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const plan = await this.taskPlanner.generateOptimalPlan({
        findingIds,
        maxParallelTasks: options.maxParallelTasks || 3,
        priorityThreshold: options.priorityThreshold || 7.0,
        executeImmediate: options.executeImmediate || false
      });

      this.logger.info('Remediation plan generated', {
        planId: plan.id,
        taskCount: plan.tasks.length,
        estimatedDuration: plan.estimatedDuration
      });

      return plan;
    } catch (error) {
      this.logger.error('Failed to generate remediation plan', { error: error.message });
      throw error;
    }
  }

  /**
   * Execute autonomous remediation
   */
  async executeRemediation(planId, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const result = await this.autoExecutor.execute({
        planId,
        dryRun: options.dryRun || false,
        safeMode: options.safeMode !== false, // Safe mode enabled by default
        approvalRequired: options.approvalRequired || false
      });

      this.logger.info('Remediation execution completed', {
        planId,
        success: result.success,
        tasksCompleted: result.completed,
        tasksFailed: result.failed
      });

      return result;
    } catch (error) {
      this.logger.error('Remediation execution failed', { 
        error: error.message, 
        planId 
      });
      throw error;
    }
  }

  /**
   * Get comprehensive system health status
   */
  async getHealthStatus() {
    if (!this.initialized) {
      return {
        status: 'initializing',
        timestamp: new Date().toISOString(),
        message: 'Platform is still initializing'
      };
    }

    try {
      // Get resilience manager system status (includes all health checks)
      const systemStatus = this.resilienceManager.getSystemStatus();
      
      // Add platform-specific health information with performance data
      const performanceMetrics = this.performanceManager.getMetrics();
      const performanceReport = this.performanceManager.getPerformanceReport();
      
      const platformHealth = {
        ...systemStatus,
        platform: {
          version: require('../package.json').version,
          uptime: process.uptime(),
          nodeVersion: process.version,
          stage: this.config.stage,
          region: this.config.region
        },
        performance: {
          metrics: performanceMetrics,
          report: {
            summary: performanceReport.summary,
            percentiles: performanceReport.percentiles,
            cacheStats: performanceReport.cacheStats
          }
        },
        services: {
          performanceManager: { status: 'healthy', metrics: performanceMetrics },
          resilienceManager: { status: 'healthy' },
          neptuneService: await this.checkServiceHealth(() => this.neptuneService.healthCheck()),
          taskPlanner: await this.checkServiceHealth(() => this.taskPlanner.healthCheck?.() || { status: 'healthy' }),
          autoExecutor: await this.checkServiceHealth(() => this.autoExecutor.healthCheck?.() || { status: 'healthy' }),
          i18n: { status: 'healthy' }
        }
      };

      return platformHealth;

    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Check individual service health with resilience
   */
  async checkServiceHealth(healthCheckFn) {
    try {
      return await this.resilienceManager.executeWithResilience(
        healthCheckFn,
        { useCircuitBreaker: false, useRetry: false, timeout: 5000 }
      );
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Graceful shutdown with resilience
   */
  async shutdown() {
    this.logger.info('Shutting down Cloud Remediator Sage platform');

    try {
      // Shutdown services in reverse order of initialization
      await this.neptuneService.disconnect();
      
      if (this.performanceManager) {
        await this.performanceManager.shutdown();
      }
      
      if (this.resilienceManager) {
        await this.resilienceManager.shutdown();
      }
      
      this.initialized = false;
      this.logger.info('Platform shutdown completed');
    } catch (error) {
      this.logger.error('Error during shutdown', { error: error.message });
    }
  }
}

// Export singleton instance for Lambda usage
const instance = new CloudRemediatorSage();

module.exports = {
  CloudRemediatorSage,
  instance,
  
  // Lambda-friendly exports
  initialize: () => instance.initialize(),
  processFinding: (rawFinding, source) => instance.processFinding(rawFinding, source),
  planRemediation: (findingIds, options) => instance.planRemediation(findingIds, options),
  executeRemediation: (planId, options) => instance.executeRemediation(planId, options),
  healthCheck: () => instance.getHealthStatus(),
  shutdown: () => instance.shutdown()
};
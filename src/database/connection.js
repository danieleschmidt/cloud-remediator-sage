/**
 * Database Connection Manager
 * Manages connections to Neptune graph database and other data stores
 */

const gremlin = require('gremlin');
const AWS = require('aws-sdk');
const { StructuredLogger } = require('../monitoring/logger');

const logger = new StructuredLogger('database-connection');

class DatabaseConnection {
  constructor() {
    this.neptune = null;
    this.neptuneConnection = null;
    this.s3 = null;
    this.dynamodb = null;
    this.ssm = null;
    this.connectionPool = new Map();
    this.healthStatus = {
      neptune: false,
      s3: false,
      dynamodb: false,
      ssm: false
    };
  }

  /**
   * Initialize all database connections
   * @returns {Promise<void>}
   */
  async initialize() {
    logger.info('Initializing database connections');

    try {
      // Initialize Neptune connection
      await this.initializeNeptune();
      
      // Initialize AWS services
      await this.initializeAWSServices();
      
      // Test all connections
      await this.testConnections();
      
      logger.info('Database connections initialized successfully', {
        status: this.healthStatus
      });

    } catch (error) {
      logger.error('Failed to initialize database connections', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Initialize Neptune graph database connection
   * @returns {Promise<void>}
   */
  async initializeNeptune() {
    try {
      const endpoint = process.env.NEPTUNE_ENDPOINT;
      const port = process.env.NEPTUNE_PORT || 8182;
      const useIAM = process.env.NEPTUNE_USE_IAM === 'true';

      if (!endpoint) {
        throw new Error('NEPTUNE_ENDPOINT environment variable is required');
      }

      const url = useIAM 
        ? `wss://${endpoint}:${port}/gremlin`
        : `ws://${endpoint}:${port}/gremlin`;

      const connectionOptions = {
        mimeType: 'application/vnd.gremlin-v2.0+json',
        pingEnabled: true,
        pingInterval: 30000,
        traversalSource: 'g',
        rejectUnauthorized: true
      };

      // Add IAM authentication if enabled
      if (useIAM) {
        const auth = await this.createNeptuneIAMAuth();
        connectionOptions.headers = auth.headers;
      }

      this.neptuneConnection = new gremlin.driver.DriverRemoteConnection(url, connectionOptions);
      
      const graph = new gremlin.structure.Graph();
      this.neptune = graph.traversal().withRemote(this.neptuneConnection);

      // Test connection
      await this.neptune.V().limit(1).toList();
      this.healthStatus.neptune = true;

      logger.info('Neptune connection established', {
        endpoint,
        port,
        useIAM
      });

    } catch (error) {
      logger.error('Failed to initialize Neptune connection', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create IAM authentication headers for Neptune
   * @returns {Promise<Object>} Authentication headers
   */
  async createNeptuneIAMAuth() {
    const region = process.env.AWS_REGION || 'us-east-1';
    const service = 'neptune-db';
    const endpoint = process.env.NEPTUNE_ENDPOINT;

    // Use AWS SDK to create signed headers
    const credentials = await AWS.config.credentialProvider.resolve();
    
    const request = {
      method: 'GET',
      url: `https://${endpoint}:8182/gremlin`,
      headers: {
        'host': endpoint
      }
    };

    const signer = new AWS.Signers.V4(request, service);
    signer.addAuthorization(credentials, new Date());

    return {
      headers: request.headers
    };
  }

  /**
   * Initialize AWS services
   * @returns {Promise<void>}
   */
  async initializeAWSServices() {
    const region = process.env.AWS_REGION || 'us-east-1';

    // Initialize S3
    this.s3 = new AWS.S3({
      region,
      maxRetries: 3,
      retryDelayOptions: {
        customBackoff: (retryCount) => Math.pow(2, retryCount) * 100
      }
    });

    // Initialize DynamoDB
    this.dynamodb = new AWS.DynamoDB.DocumentClient({
      region,
      maxRetries: 3,
      retryDelayOptions: {
        customBackoff: (retryCount) => Math.pow(2, retryCount) * 100
      }
    });

    // Initialize Systems Manager
    this.ssm = new AWS.SSM({
      region,
      maxRetries: 3
    });

    logger.info('AWS services initialized', { region });
  }

  /**
   * Test all database connections
   * @returns {Promise<void>}
   */
  async testConnections() {
    // Test S3
    try {
      await this.s3.listBuckets().promise();
      this.healthStatus.s3 = true;
    } catch (error) {
      logger.warn('S3 connection test failed', { error: error.message });
    }

    // Test DynamoDB
    try {
      await this.dynamodb.scan({
        TableName: 'test-table',
        Limit: 1
      }).promise();
      this.healthStatus.dynamodb = true;
    } catch (error) {
      // DynamoDB test may fail if table doesn't exist, which is OK
      if (error.code !== 'ResourceNotFoundException') {
        logger.warn('DynamoDB connection test failed', { error: error.message });
      } else {
        this.healthStatus.dynamodb = true;
      }
    }

    // Test SSM
    try {
      await this.ssm.getParameters({
        Names: ['test-parameter']
      }).promise();
      this.healthStatus.ssm = true;
    } catch (error) {
      // SSM test may fail if parameter doesn't exist, which is OK
      if (error.code !== 'ParameterNotFound') {
        logger.warn('SSM connection test failed', { error: error.message });
      } else {
        this.healthStatus.ssm = true;
      }
    }
  }

  /**
   * Get Neptune graph traversal
   * @returns {GraphTraversal} Neptune graph traversal
   */
  getNeptune() {
    if (!this.neptune) {
      throw new Error('Neptune connection not initialized');
    }
    return this.neptune;
  }

  /**
   * Get S3 client
   * @returns {AWS.S3} S3 client
   */
  getS3() {
    if (!this.s3) {
      throw new Error('S3 client not initialized');
    }
    return this.s3;
  }

  /**
   * Get DynamoDB client
   * @returns {AWS.DynamoDB.DocumentClient} DynamoDB client
   */
  getDynamoDB() {
    if (!this.dynamodb) {
      throw new Error('DynamoDB client not initialized');
    }
    return this.dynamodb;
  }

  /**
   * Get SSM client
   * @returns {AWS.SSM} SSM client
   */
  getSSM() {
    if (!this.ssm) {
      throw new Error('SSM client not initialized');
    }
    return this.ssm;
  }

  /**
   * Execute operation with connection retry
   * @param {Function} operation - Operation to execute
   * @param {string} connectionType - Type of connection (neptune, s3, dynamodb)
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {Promise<any>} Operation result
   */
  async executeWithRetry(operation, connectionType = 'neptune', maxRetries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        logger.warn('Database operation failed, retrying', {
          connectionType,
          attempt,
          maxRetries,
          error: error.message
        });

        if (attempt === maxRetries) {
          break;
        }

        // Reconnect if needed
        if (connectionType === 'neptune' && this.isConnectionError(error)) {
          await this.reconnectNeptune();
        }

        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Check if error is a connection error
   * @param {Error} error - Error to check
   * @returns {boolean} True if connection error
   */
  isConnectionError(error) {
    const connectionErrors = [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'Connection closed',
      'WebSocket connection closed'
    ];

    return connectionErrors.some(errorType => 
      error.message.includes(errorType) || error.code === errorType
    );
  }

  /**
   * Reconnect to Neptune
   * @returns {Promise<void>}
   */
  async reconnectNeptune() {
    try {
      if (this.neptuneConnection) {
        await this.neptuneConnection.close();
      }
      
      await this.initializeNeptune();
      
      logger.info('Neptune reconnected successfully');
    } catch (error) {
      logger.error('Failed to reconnect to Neptune', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get connection health status
   * @returns {Object} Health status of all connections
   */
  getHealthStatus() {
    return {
      ...this.healthStatus,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Close all connections
   * @returns {Promise<void>}
   */
  async close() {
    logger.info('Closing database connections');

    try {
      if (this.neptuneConnection) {
        await this.neptuneConnection.close();
        this.neptune = null;
        this.neptuneConnection = null;
      }

      // Clear connection pool
      this.connectionPool.clear();

      // Reset health status
      Object.keys(this.healthStatus).forEach(key => {
        this.healthStatus[key] = false;
      });

      logger.info('Database connections closed successfully');
    } catch (error) {
      logger.error('Error closing database connections', {
        error: error.message
      });
    }
  }

  /**
   * Get connection metrics
   * @returns {Object} Connection metrics
   */
  getMetrics() {
    return {
      connectionPool: {
        size: this.connectionPool.size,
        connections: Array.from(this.connectionPool.keys())
      },
      healthStatus: this.healthStatus,
      neptuneConnected: !!this.neptune,
      timestamp: new Date().toISOString()
    };
  }
}

// Singleton instance
let instance = null;

/**
 * Get database connection instance
 * @returns {DatabaseConnection} Database connection instance
 */
function getDatabaseConnection() {
  if (!instance) {
    instance = new DatabaseConnection();
  }
  return instance;
}

module.exports = {
  DatabaseConnection,
  getDatabaseConnection
};
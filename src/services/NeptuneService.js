/**
 * Neptune Service
 * Handles all interactions with Amazon Neptune graph database
 */

const gremlin = require('gremlin');
const { DriverRemoteConnection, RemoteConnection } = gremlin.driver;
const { Graph } = gremlin.structure;
const { __ } = gremlin.process;

class NeptuneService {
  constructor() {
    this.endpoint = process.env.NEPTUNE_ENDPOINT;
    this.port = process.env.NEPTUNE_PORT || 8182;
    this.connection = null;
    this.g = null;
    this.retryCount = 3;
    this.retryDelay = 1000;
  }

  /**
   * Initialize connection to Neptune
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.connection && this.g) {
      return;
    }

    try {
      const url = `wss://${this.endpoint}:${this.port}/gremlin`;
      this.connection = new DriverRemoteConnection(url, {
        mimeType: 'application/vnd.gremlin-v2.0+json',
        pingEnabled: true,
        pingInterval: 30000,
        traversalSource: 'g'
      });

      const graph = new Graph();
      this.g = graph.traversal().withRemote(this.connection);

      // Test connection
      await this.g.V().limit(1).toList();
      console.log('Connected to Neptune successfully');
    } catch (error) {
      console.error('Failed to connect to Neptune:', error);
      throw new Error(`Neptune connection failed: ${error.message}`);
    }
  }

  /**
   * Close Neptune connection
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
      this.g = null;
    }
  }

  /**
   * Execute Gremlin query with retry logic
   * @param {Function} queryFn - Function that returns a Gremlin query
   * @returns {Promise<any>} Query result
   */
  async executeWithRetry(queryFn) {
    for (let attempt = 1; attempt <= this.retryCount; attempt++) {
      try {
        await this.connect();
        return await queryFn();
      } catch (error) {
        console.error(`Query attempt ${attempt} failed:`, error);
        
        if (attempt === this.retryCount) {
          throw error;
        }
        
        // Exponential backoff
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Reset connection on error
        this.connection = null;
        this.g = null;
      }
    }
  }

  /**
   * Create a new finding vertex in Neptune
   * @param {Finding} finding - Finding object to store
   * @returns {Promise<void>}
   */
  async createFinding(finding) {
    const vertex = finding.toNeptuneVertex();
    
    return this.executeWithRetry(async () => {
      // Check if finding already exists
      const existing = await this.g.V().hasLabel('Finding')
        .has('id', finding.id)
        .toList();

      if (existing.length > 0) {
        // Update existing finding
        return this.updateFinding(finding);
      }

      // Create new finding vertex
      let query = this.g.addV('Finding').property('id', finding.id);
      
      // Add all properties
      Object.entries(vertex.properties).forEach(([key, value]) => {
        if (value !== null && value !== undefined && key !== 'id') {
          query = query.property(key, value);
        }
      });

      await query.next();
      console.log(`Created finding vertex: ${finding.id}`);
    });
  }

  /**
   * Update existing finding in Neptune
   * @param {Finding} finding - Finding object to update
   * @returns {Promise<void>}
   */
  async updateFinding(finding) {
    const vertex = finding.toNeptuneVertex();
    
    return this.executeWithRetry(async () => {
      let query = this.g.V().hasLabel('Finding').has('id', finding.id);

      // Update properties
      Object.entries(vertex.properties).forEach(([key, value]) => {
        if (value !== null && value !== undefined && key !== 'id') {
          query = query.property(key, value);
        }
      });

      await query.next();
      console.log(`Updated finding vertex: ${finding.id}`);
    });
  }

  /**
   * Create a new asset vertex in Neptune
   * @param {Asset} asset - Asset object to store
   * @returns {Promise<void>}
   */
  async createAsset(asset) {
    const vertex = asset.toNeptuneVertex();
    
    return this.executeWithRetry(async () => {
      // Check if asset already exists
      const existing = await this.g.V().hasLabel('Asset')
        .has('arn', asset.arn)
        .toList();

      if (existing.length > 0) {
        return this.updateAsset(asset);
      }

      // Create new asset vertex
      let query = this.g.addV('Asset').property('arn', asset.arn);
      
      // Add all properties
      Object.entries(vertex.properties).forEach(([key, value]) => {
        if (value !== null && value !== undefined && key !== 'arn') {
          query = query.property(key, value);
        }
      });

      await query.next();
      console.log(`Created asset vertex: ${asset.arn}`);
    });
  }

  /**
   * Update existing asset in Neptune
   * @param {Asset} asset - Asset object to update
   * @returns {Promise<void>}
   */
  async updateAsset(asset) {
    const vertex = asset.toNeptuneVertex();
    
    return this.executeWithRetry(async () => {
      let query = this.g.V().hasLabel('Asset').has('arn', asset.arn);

      // Update properties
      Object.entries(vertex.properties).forEach(([key, value]) => {
        if (value !== null && value !== undefined && key !== 'arn') {
          query = query.property(key, value);
        }
      });

      await query.next();
      console.log(`Updated asset vertex: ${asset.arn}`);
    });
  }

  /**
   * Create a relationship edge between two vertices
   * @param {string} fromId - Source vertex ID
   * @param {string} toId - Target vertex ID
   * @param {string} relationship - Relationship type
   * @param {Object} properties - Edge properties
   * @returns {Promise<void>}
   */
  async createRelationship(fromId, toId, relationship, properties = {}) {
    return this.executeWithRetry(async () => {
      // Check if relationship already exists
      const existing = await this.g.V().has('id', fromId)
        .outE(relationship)
        .where(__.inV().has('arn', toId))
        .toList();

      if (existing.length > 0) {
        return; // Relationship already exists
      }

      // Find source and target vertices
      const sourceVertex = await this.g.V().has('id', fromId).next();
      const targetVertex = await this.g.V().has('arn', toId).next();

      if (!sourceVertex.value || !targetVertex.value) {
        console.warn(`Cannot create relationship: missing vertex (${fromId} -> ${toId})`);
        return;
      }

      // Create edge
      let query = this.g.V().has('id', fromId)
        .addE(relationship)
        .to(__.V().has('arn', toId));

      // Add edge properties
      Object.entries(properties).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          query = query.property(key, value);
        }
      });

      await query.next();
      console.log(`Created relationship: ${fromId} -[${relationship}]-> ${toId}`);
    });
  }

  /**
   * Get asset by ARN
   * @param {string} arn - Asset ARN
   * @returns {Promise<Asset|null>} Asset object or null if not found
   */
  async getAsset(arn) {
    return this.executeWithRetry(async () => {
      const result = await this.g.V().hasLabel('Asset')
        .has('arn', arn)
        .valueMap(true)
        .toList();

      if (result.length === 0) {
        return null;
      }

      return this.mapToAsset(result[0]);
    });
  }

  /**
   * Get asset dependencies (what this asset depends on)
   * @param {string} arn - Asset ARN
   * @returns {Promise<Array>} Array of dependent assets
   */
  async getAssetDependencies(arn) {
    return this.executeWithRetry(async () => {
      const result = await this.g.V().hasLabel('Asset')
        .has('arn', arn)
        .out('depends-on')
        .valueMap(true)
        .toList();

      return result.map(this.mapToAsset);
    });
  }

  /**
   * Get asset dependents (what depends on this asset)
   * @param {string} arn - Asset ARN
   * @returns {Promise<Array>} Array of dependent assets
   */
  async getAssetDependents(arn) {
    return this.executeWithRetry(async () => {
      const result = await this.g.V().hasLabel('Asset')
        .has('arn', arn)
        .in_('depends-on')
        .valueMap(true)
        .toList();

      return result.map(this.mapToAsset);
    });
  }

  /**
   * Query findings with filters
   * @param {Object} filters - Query filters
   * @returns {Promise<Array>} Array of findings
   */
  async queryFindings(filters = {}) {
    return this.executeWithRetry(async () => {
      let query = this.g.V().hasLabel('Finding');

      // Apply filters
      if (filters.status) {
        query = query.has('status', filters.status);
      }
      if (filters.severity) {
        query = query.has('severity', filters.severity);
      }
      if (filters.accountId) {
        query = query.has('accountId', filters.accountId);
      }
      if (filters.region) {
        query = query.has('region', filters.region);
      }
      if (filters.category) {
        query = query.has('category', filters.category);
      }
      if (filters.source) {
        query = query.has('source', filters.source);
      }

      const result = await query.valueMap(true).toList();
      return result.map(this.mapToFinding);
    });
  }

  /**
   * Get finding trends over time
   * @param {Date} startDate - Start date for trend analysis
   * @param {string} accountId - Account ID filter (optional)
   * @returns {Promise<Array>} Trend data points
   */
  async getFindingTrends(startDate, accountId = null) {
    return this.executeWithRetry(async () => {
      let query = this.g.V().hasLabel('Finding')
        .has('createdAt', __.gte(startDate.toISOString()));

      if (accountId) {
        query = query.has('accountId', accountId);
      }

      // Group by day and severity
      const result = await query
        .group()
        .by(__.values('createdAt').map(date => date.substring(0, 10))) // Extract date part
        .by(__.groupCount().by('severity'))
        .toList();

      // Transform result into trend data
      const trends = [];
      if (result.length > 0) {
        const trendMap = result[0];
        for (const [date, severityCount] of trendMap.entries()) {
          trends.push({
            date,
            total: Object.values(severityCount).reduce((sum, count) => sum + count, 0),
            bySeverity: severityCount
          });
        }
      }

      return trends.sort((a, b) => a.date.localeCompare(b.date));
    });
  }

  /**
   * Update asset's last scanned timestamp
   * @param {string} arn - Asset ARN
   * @returns {Promise<void>}
   */
  async updateAssetLastScanned(arn) {
    return this.executeWithRetry(async () => {
      await this.g.V().hasLabel('Asset')
        .has('arn', arn)
        .property('lastScannedAt', new Date().toISOString())
        .next();
    });
  }

  /**
   * Get graph statistics
   * @returns {Promise<Object>} Graph statistics
   */
  async getGraphStats() {
    return this.executeWithRetry(async () => {
      const [findingCount, assetCount, relationshipCount] = await Promise.all([
        this.g.V().hasLabel('Finding').count().next(),
        this.g.V().hasLabel('Asset').count().next(),
        this.g.E().count().next()
      ]);

      return {
        findings: findingCount.value,
        assets: assetCount.value,
        relationships: relationshipCount.value,
        timestamp: new Date().toISOString()
      };
    });
  }

  /**
   * Map Neptune vertex result to Asset object
   * @param {Object} vertexMap - Neptune vertex map
   * @returns {Asset} Asset object
   */
  mapToAsset(vertexMap) {
    const props = {};
    
    // Extract properties from Neptune valueMap format
    Object.entries(vertexMap).forEach(([key, value]) => {
      if (Array.isArray(value) && value.length > 0) {
        props[key] = value[0];
      } else {
        props[key] = value;
      }
    });

    const { Asset } = require('../models');
    return new Asset(props);
  }

  /**
   * Get finding by ID
   * @param {string} findingId - Finding ID
   * @returns {Promise<Finding|null>} Finding object or null if not found
   */
  async getFinding(findingId) {
    return this.executeWithRetry(async () => {
      const result = await this.g.V().hasLabel('Finding')
        .has('id', findingId)
        .valueMap(true)
        .toList();
      
      return result.length > 0 ? this.mapToFinding(result[0]) : null;
    });
  }

  /**
   * Query remediations with filters
   * @param {Object} filters - Query filters
   * @returns {Promise<Array>} Array of remediation objects
   */
  async queryRemediations(filters = {}) {
    return this.executeWithRetry(async () => {
      let query = this.g.V().hasLabel('Remediation');
      
      if (filters.findingId) {
        query = query.has('findingId', filters.findingId);
      }
      if (filters.status) {
        query = query.has('status', filters.status);
      }
      if (filters.priority) {
        query = query.has('priority', filters.priority);
      }
      if (filters.templateType) {
        query = query.has('templateType', filters.templateType);
      }
      
      const result = await query.valueMap(true).toList();
      return result.map(this.mapToRemediation.bind(this));
    });
  }

  /**
   * Create a new remediation vertex in Neptune
   * @param {Remediation} remediation - Remediation object to store
   * @returns {Promise<void>}
   */
  async createRemediation(remediation) {
    const vertex = remediation.toNeptuneVertex();
    
    return this.executeWithRetry(async () => {
      // Check if remediation already exists
      const existing = await this.g.V().hasLabel('Remediation')
        .has('id', remediation.id)
        .toList();

      if (existing.length > 0) {
        // Update existing remediation
        return this.updateRemediation(remediation);
      }

      // Create new remediation vertex
      let query = this.g.addV('Remediation').property('id', remediation.id);
      
      // Add all properties
      Object.entries(vertex.properties).forEach(([key, value]) => {
        if (value !== null && value !== undefined && key !== 'id') {
          query = query.property(key, value);
        }
      });

      await query.next();
      console.log(`Created remediation vertex: ${remediation.id}`);

      // Create relationship to finding if specified
      if (remediation.findingId) {
        await this.createRelationship(
          remediation.findingId,
          remediation.id, 
          'has_remediation',
          { createdAt: new Date().toISOString() }
        );
      }
    });
  }

  /**
   * Update existing remediation in Neptune
   * @param {Remediation} remediation - Remediation object to update
   * @returns {Promise<void>}
   */
  async updateRemediation(remediation) {
    const vertex = remediation.toNeptuneVertex();
    
    return this.executeWithRetry(async () => {
      let query = this.g.V().hasLabel('Remediation').has('id', remediation.id);

      // Update properties
      Object.entries(vertex.properties).forEach(([key, value]) => {
        if (value !== null && value !== undefined && key !== 'id') {
          query = query.property(key, value);
        }
      });

      await query.next();
      console.log(`Updated remediation vertex: ${remediation.id}`);
    });
  }

  /**
   * Map Neptune vertex result to Remediation object
   * @param {Object} vertexMap - Neptune vertex map
   * @returns {Remediation} Remediation object
   */
  mapToRemediation(vertexMap) {
    const props = {};
    
    // Extract properties from Neptune valueMap format
    Object.entries(vertexMap).forEach(([key, value]) => {
      if (Array.isArray(value) && value.length > 0) {
        props[key] = value[0];
      } else {
        props[key] = value;
      }
    });

    // Handle JSON fields
    if (props.parameters && typeof props.parameters === 'string') {
      try {
        props.parameters = JSON.parse(props.parameters);
      } catch (e) {
        console.warn('Failed to parse remediation parameters:', e);
        props.parameters = {};
      }
    }

    if (props.metadata && typeof props.metadata === 'string') {
      try {
        props.metadata = JSON.parse(props.metadata);
      } catch (e) {
        console.warn('Failed to parse remediation metadata:', e);
        props.metadata = {};
      }
    }

    const { Remediation } = require('../models');
    return new Remediation(props);
  }

  /**
   * Map Neptune vertex result to Finding object
   * @param {Object} vertexMap - Neptune vertex map
   * @returns {Finding} Finding object
   */
  mapToFinding(vertexMap) {
    const props = {};
    
    // Extract properties from Neptune valueMap format
    Object.entries(vertexMap).forEach(([key, value]) => {
      if (Array.isArray(value) && value.length > 0) {
        props[key] = value[0];
      } else {
        props[key] = value;
      }
    });

    // Reconstruct resource object
    if (props.resourceArn) {
      props.resource = {
        arn: props.resourceArn,
        type: props.resourceType,
        region: props.region,
        accountId: props.accountId
      };
    }

    const { Finding } = require('../models');
    return new Finding(props);
  }

  /**
   * Health check for Neptune connection
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      await this.connect();
      const stats = await this.getGraphStats();
      
      return {
        status: 'healthy',
        endpoint: this.endpoint,
        stats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = NeptuneService;
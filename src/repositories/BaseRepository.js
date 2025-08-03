/**
 * Base Repository
 * Provides common CRUD operations for Neptune graph database
 */

const { getDatabaseConnection } = require('../database/connection');
const { StructuredLogger } = require('../monitoring/logger');

class BaseRepository {
  constructor(vertexLabel) {
    this.vertexLabel = vertexLabel;
    this.db = getDatabaseConnection();
    this.logger = new StructuredLogger(`${vertexLabel.toLowerCase()}-repository`);
  }

  /**
   * Get graph traversal instance
   * @returns {GraphTraversal} Neptune graph traversal
   */
  get g() {
    return this.db.getNeptune();
  }

  /**
   * Create a new vertex
   * @param {Object} data - Vertex data
   * @returns {Promise<string>} Vertex ID
   */
  async create(data) {
    return this.db.executeWithRetry(async () => {
      let query = this.g.addV(this.vertexLabel);

      // Add properties
      Object.entries(data).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          query = query.property(key, value);
        }
      });

      const result = await query.next();
      const vertexId = result.value.id;

      this.logger.debug('Created vertex', {
        label: this.vertexLabel,
        id: vertexId,
        properties: Object.keys(data)
      });

      return vertexId;
    });
  }

  /**
   * Find vertex by property
   * @param {string} property - Property name
   * @param {any} value - Property value
   * @returns {Promise<Object|null>} Vertex data or null
   */
  async findByProperty(property, value) {
    return this.db.executeWithRetry(async () => {
      const result = await this.g.V()
        .hasLabel(this.vertexLabel)
        .has(property, value)
        .valueMap(true)
        .toList();

      if (result.length === 0) {
        return null;
      }

      return this.transformVertex(result[0]);
    });
  }

  /**
   * Find vertex by ID
   * @param {string} id - Vertex ID
   * @returns {Promise<Object|null>} Vertex data or null
   */
  async findById(id) {
    return this.db.executeWithRetry(async () => {
      const result = await this.g.V(id)
        .hasLabel(this.vertexLabel)
        .valueMap(true)
        .toList();

      if (result.length === 0) {
        return null;
      }

      return this.transformVertex(result[0]);
    });
  }

  /**
   * Find multiple vertices by criteria
   * @param {Object} criteria - Search criteria
   * @param {Object} options - Query options (limit, offset, sort)
   * @returns {Promise<Array>} Array of vertices
   */
  async findMany(criteria = {}, options = {}) {
    return this.db.executeWithRetry(async () => {
      let query = this.g.V().hasLabel(this.vertexLabel);

      // Apply criteria
      Object.entries(criteria).forEach(([property, value]) => {
        if (value !== null && value !== undefined) {
          if (typeof value === 'object' && value.operator) {
            // Handle operators like gte, lte, between
            query = this.applyOperator(query, property, value);
          } else {
            query = query.has(property, value);
          }
        }
      });

      // Apply sorting
      if (options.sortBy) {
        const order = options.sortOrder === 'desc' ? 'desc' : 'asc';
        query = query.order().by(options.sortBy, order);
      }

      // Apply pagination
      if (options.offset) {
        query = query.skip(options.offset);
      }
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const result = await query.valueMap(true).toList();
      return result.map(vertex => this.transformVertex(vertex));
    });
  }

  /**
   * Update vertex by property
   * @param {string} property - Property name to find by
   * @param {any} value - Property value to find by
   * @param {Object} updates - Properties to update
   * @returns {Promise<boolean>} Success status
   */
  async updateByProperty(property, value, updates) {
    return this.db.executeWithRetry(async () => {
      let query = this.g.V()
        .hasLabel(this.vertexLabel)
        .has(property, value);

      // Apply updates
      Object.entries(updates).forEach(([key, val]) => {
        if (val !== null && val !== undefined) {
          query = query.property(key, val);
        }
      });

      const result = await query.next();
      
      this.logger.debug('Updated vertex', {
        label: this.vertexLabel,
        findBy: { [property]: value },
        updates: Object.keys(updates)
      });

      return result.value !== null;
    });
  }

  /**
   * Delete vertex by property
   * @param {string} property - Property name
   * @param {any} value - Property value
   * @returns {Promise<boolean>} Success status
   */
  async deleteByProperty(property, value) {
    return this.db.executeWithRetry(async () => {
      const result = await this.g.V()
        .hasLabel(this.vertexLabel)
        .has(property, value)
        .drop()
        .next();

      this.logger.debug('Deleted vertex', {
        label: this.vertexLabel,
        property,
        value
      });

      return result.value !== null;
    });
  }

  /**
   * Count vertices by criteria
   * @param {Object} criteria - Search criteria
   * @returns {Promise<number>} Count of vertices
   */
  async count(criteria = {}) {
    return this.db.executeWithRetry(async () => {
      let query = this.g.V().hasLabel(this.vertexLabel);

      // Apply criteria
      Object.entries(criteria).forEach(([property, value]) => {
        if (value !== null && value !== undefined) {
          query = query.has(property, value);
        }
      });

      const result = await query.count().next();
      return result.value;
    });
  }

  /**
   * Check if vertex exists
   * @param {string} property - Property name
   * @param {any} value - Property value
   * @returns {Promise<boolean>} Existence status
   */
  async exists(property, value) {
    return this.db.executeWithRetry(async () => {
      const result = await this.g.V()
        .hasLabel(this.vertexLabel)
        .has(property, value)
        .hasNext();

      return result;
    });
  }

  /**
   * Create edge between two vertices
   * @param {string} fromId - Source vertex ID
   * @param {string} toId - Target vertex ID
   * @param {string} edgeLabel - Edge label
   * @param {Object} properties - Edge properties
   * @returns {Promise<string>} Edge ID
   */
  async createEdge(fromId, toId, edgeLabel, properties = {}) {
    return this.db.executeWithRetry(async () => {
      let query = this.g.V(fromId)
        .addE(edgeLabel)
        .to(this.g.V(toId));

      // Add edge properties
      Object.entries(properties).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          query = query.property(key, value);
        }
      });

      const result = await query.next();
      const edgeId = result.value.id;

      this.logger.debug('Created edge', {
        fromId,
        toId,
        edgeLabel,
        edgeId,
        properties: Object.keys(properties)
      });

      return edgeId;
    });
  }

  /**
   * Find connected vertices
   * @param {string} vertexId - Source vertex ID
   * @param {string} edgeLabel - Edge label to traverse
   * @param {string} direction - Direction: 'out', 'in', 'both'
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Connected vertices
   */
  async findConnected(vertexId, edgeLabel, direction = 'out', options = {}) {
    return this.db.executeWithRetry(async () => {
      let query = this.g.V(vertexId);

      // Apply traversal direction
      switch (direction) {
        case 'out':
          query = query.out(edgeLabel);
          break;
        case 'in':
          query = query.in_(edgeLabel);
          break;
        case 'both':
          query = query.both(edgeLabel);
          break;
        default:
          throw new Error(`Invalid direction: ${direction}`);
      }

      // Apply filters
      if (options.hasLabel) {
        query = query.hasLabel(options.hasLabel);
      }

      // Apply limit
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const result = await query.valueMap(true).toList();
      return result.map(vertex => this.transformVertex(vertex));
    });
  }

  /**
   * Apply operator to query
   * @param {GraphTraversal} query - Current query
   * @param {string} property - Property name
   * @param {Object} operatorValue - Operator and value
   * @returns {GraphTraversal} Modified query
   */
  applyOperator(query, property, operatorValue) {
    const { operator, value } = operatorValue;

    switch (operator) {
      case 'gte':
        return query.has(property, this.g.__.gte(value));
      case 'gt':
        return query.has(property, this.g.__.gt(value));
      case 'lte':
        return query.has(property, this.g.__.lte(value));
      case 'lt':
        return query.has(property, this.g.__.lt(value));
      case 'between':
        return query.has(property, this.g.__.between(value.min, value.max));
      case 'in':
        return query.has(property, this.g.__.within(value));
      case 'not':
        return query.has(property, this.g.__.not(value));
      case 'contains':
        return query.has(property, this.g.__.containing(value));
      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }

  /**
   * Transform Neptune vertex result to plain object
   * @param {Object} vertex - Neptune vertex map
   * @returns {Object} Transformed vertex
   */
  transformVertex(vertex) {
    const result = {};

    Object.entries(vertex).forEach(([key, value]) => {
      if (key === 'id') {
        result.id = value;
      } else if (key === 'label') {
        result.label = value;
      } else if (Array.isArray(value) && value.length > 0) {
        // Neptune returns property values as arrays
        result[key] = value[0];
      } else {
        result[key] = value;
      }
    });

    return result;
  }

  /**
   * Execute batch operations
   * @param {Array} operations - Array of operation functions
   * @returns {Promise<Array>} Results array
   */
  async batch(operations) {
    return this.db.executeWithRetry(async () => {
      const results = [];
      
      for (const operation of operations) {
        try {
          const result = await operation();
          results.push({ success: true, result });
        } catch (error) {
          results.push({ success: false, error: error.message });
        }
      }

      return results;
    });
  }

  /**
   * Get repository metrics
   * @returns {Object} Repository metrics
   */
  getMetrics() {
    return {
      vertexLabel: this.vertexLabel,
      connectionStatus: this.db.getHealthStatus(),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = BaseRepository;
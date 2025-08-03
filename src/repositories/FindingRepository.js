/**
 * Finding Repository
 * Specialized repository for security finding operations
 */

const BaseRepository = require('./BaseRepository');
const { Finding } = require('../models');

class FindingRepository extends BaseRepository {
  constructor() {
    super('Finding');
  }

  /**
   * Create a new finding
   * @param {Finding} finding - Finding object
   * @returns {Promise<string>} Vertex ID
   */
  async createFinding(finding) {
    const validation = finding.validate();
    if (!validation.isValid) {
      throw new Error(`Invalid finding: ${validation.errors.join(', ')}`);
    }

    const vertex = finding.toNeptuneVertex();
    return this.create(vertex.properties);
  }

  /**
   * Find findings by status
   * @param {string} status - Finding status
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of findings
   */
  async findByStatus(status, options = {}) {
    const criteria = { status };
    const results = await this.findMany(criteria, options);
    return results.map(data => new Finding(data));
  }

  /**
   * Find findings by severity
   * @param {string} severity - Finding severity
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of findings
   */
  async findBySeverity(severity, options = {}) {
    const criteria = { severity };
    const results = await this.findMany(criteria, options);
    return results.map(data => new Finding(data));
  }

  /**
   * Find findings by risk score range
   * @param {number} minScore - Minimum risk score
   * @param {number} maxScore - Maximum risk score
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of findings
   */
  async findByRiskScore(minScore, maxScore = 10, options = {}) {
    const criteria = {
      riskScore: {
        operator: 'between',
        value: { min: minScore, max: maxScore }
      }
    };
    const results = await this.findMany(criteria, options);
    return results.map(data => new Finding(data));
  }

  /**
   * Find findings by account ID
   * @param {string} accountId - AWS account ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of findings
   */
  async findByAccount(accountId, options = {}) {
    const criteria = { accountId };
    const results = await this.findMany(criteria, options);
    return results.map(data => new Finding(data));
  }

  /**
   * Find findings by resource ARN
   * @param {string} resourceArn - Resource ARN
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of findings
   */
  async findByResource(resourceArn, options = {}) {
    const criteria = { resourceArn };
    const results = await this.findMany(criteria, options);
    return results.map(data => new Finding(data));
  }

  /**
   * Find findings by compliance framework
   * @param {string} framework - Compliance framework
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of findings
   */
  async findByComplianceFramework(framework, options = {}) {
    return this.db.executeWithRetry(async () => {
      let query = this.g.V()
        .hasLabel('Finding')
        .where(this.g.__.out('violates').has('name', framework));

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
      return result.map(vertex => new Finding(this.transformVertex(vertex)));
    });
  }

  /**
   * Get findings affected by asset
   * @param {string} assetArn - Asset ARN
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of findings
   */
  async findByAffectedAsset(assetArn, options = {}) {
    return this.db.executeWithRetry(async () => {
      let query = this.g.V()
        .hasLabel('Finding')
        .where(this.g.__.out('affects').has('arn', assetArn));

      // Apply filters
      if (options.status) {
        query = query.has('status', options.status);
      }

      // Apply sorting
      if (options.sortBy) {
        const order = options.sortOrder === 'desc' ? 'desc' : 'asc';
        query = query.order().by(options.sortBy, order);
      }

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const result = await query.valueMap(true).toList();
      return result.map(vertex => new Finding(this.transformVertex(vertex)));
    });
  }

  /**
   * Update finding risk score
   * @param {string} findingId - Finding ID
   * @param {number} riskScore - New risk score
   * @param {number} blastRadius - New blast radius
   * @returns {Promise<boolean>} Success status
   */
  async updateRiskScore(findingId, riskScore, blastRadius) {
    const updates = {
      riskScore,
      blastRadius,
      updatedAt: new Date().toISOString(),
      lastRiskCalculation: new Date().toISOString()
    };

    return this.updateByProperty('id', findingId, updates);
  }

  /**
   * Update finding status
   * @param {string} findingId - Finding ID
   * @param {string} status - New status
   * @param {string} reason - Reason for status change
   * @returns {Promise<boolean>} Success status
   */
  async updateStatus(findingId, status, reason = null) {
    const updates = {
      status,
      updatedAt: new Date().toISOString()
    };

    if (reason) {
      updates.statusReason = reason;
    }

    if (status === 'resolved') {
      updates.resolvedAt = new Date().toISOString();
    }

    return this.updateByProperty('id', findingId, updates);
  }

  /**
   * Get finding statistics
   * @param {Object} filters - Optional filters
   * @returns {Promise<Object>} Finding statistics
   */
  async getStatistics(filters = {}) {
    return this.db.executeWithRetry(async () => {
      let query = this.g.V().hasLabel('Finding');

      // Apply filters
      if (filters.accountId) {
        query = query.has('accountId', filters.accountId);
      }
      if (filters.status) {
        query = query.has('status', filters.status);
      }
      if (filters.dateFrom) {
        query = query.has('createdAt', this.g.__.gte(filters.dateFrom));
      }
      if (filters.dateTo) {
        query = query.has('createdAt', this.g.__.lte(filters.dateTo));
      }

      // Get counts by severity
      const severityCounts = await query
        .group()
        .by('severity')
        .by(this.g.__.count())
        .next();

      // Get counts by status
      const statusCounts = await this.g.V().hasLabel('Finding')
        .group()
        .by('status')
        .by(this.g.__.count())
        .next();

      // Get average risk score
      const avgRiskScore = await query
        .values('riskScore')
        .mean()
        .next();

      // Get total count
      const totalCount = await query.count().next();

      return {
        total: totalCount.value || 0,
        bySeverity: severityCounts.value || {},
        byStatus: statusCounts.value || {},
        averageRiskScore: avgRiskScore.value || 0,
        timestamp: new Date().toISOString()
      };
    });
  }

  /**
   * Get trend data for findings
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {string} groupBy - Group by period (day, week, month)
   * @returns {Promise<Array>} Trend data
   */
  async getTrendData(startDate, endDate, groupBy = 'day') {
    return this.db.executeWithRetry(async () => {
      const query = this.g.V()
        .hasLabel('Finding')
        .has('createdAt', this.g.__.between(startDate.toISOString(), endDate.toISOString()));

      // Group by time period
      let groupQuery;
      switch (groupBy) {
        case 'day':
          groupQuery = query
            .group()
            .by(this.g.__.values('createdAt').map(date => date.substring(0, 10)))
            .by(this.g.__.groupCount().by('severity'));
          break;
        case 'week':
          // Group by week number
          groupQuery = query
            .group()
            .by(this.g.__.values('createdAt').map(date => {
              const d = new Date(date);
              const startOfYear = new Date(d.getFullYear(), 0, 1);
              const dayOfYear = Math.floor((d - startOfYear) / (24 * 60 * 60 * 1000));
              return `${d.getFullYear()}-W${Math.ceil(dayOfYear / 7)}`;
            }))
            .by(this.g.__.groupCount().by('severity'));
          break;
        case 'month':
          groupQuery = query
            .group()
            .by(this.g.__.values('createdAt').map(date => date.substring(0, 7)))
            .by(this.g.__.groupCount().by('severity'));
          break;
        default:
          throw new Error(`Invalid groupBy value: ${groupBy}`);
      }

      const result = await groupQuery.next();
      
      // Transform result into trend data
      const trends = [];
      if (result.value) {
        for (const [period, severityCount] of result.value.entries()) {
          trends.push({
            period,
            total: Object.values(severityCount).reduce((sum, count) => sum + count, 0),
            bySeverity: severityCount
          });
        }
      }

      return trends.sort((a, b) => a.period.localeCompare(b.period));
    });
  }

  /**
   * Find duplicate findings
   * @param {Finding} finding - Finding to check for duplicates
   * @returns {Promise<Array>} Array of duplicate findings
   */
  async findDuplicates(finding) {
    const criteria = {
      source: finding.source,
      title: finding.title,
      resourceArn: finding.resource.arn,
      category: finding.category
    };

    const results = await this.findMany(criteria);
    return results
      .filter(f => f.id !== finding.id)
      .map(data => new Finding(data));
  }

  /**
   * Delete finding and all related edges
   * @param {string} findingId - Finding ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteFinding(findingId) {
    return this.db.executeWithRetry(async () => {
      // Delete all edges connected to this finding
      await this.g.V()
        .has('id', findingId)
        .bothE()
        .drop()
        .iterate();

      // Delete the finding vertex
      const result = await this.g.V()
        .has('id', findingId)
        .drop()
        .next();

      this.logger.info('Deleted finding and related edges', {
        findingId
      });

      return result.value !== null;
    });
  }
}

module.exports = FindingRepository;
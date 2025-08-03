/**
 * Security Analysis Service
 * Core business logic for analyzing security findings and calculating risk scores
 */

const { Finding, Asset } = require('../models');
const NeptuneService = require('./NeptuneService');

class SecurityAnalysisService {
  constructor() {
    this.neptuneService = new NeptuneService();
  }

  /**
   * Process and analyze a security finding
   * @param {Object} rawFinding - Raw finding data from scanner
   * @param {string} source - Source scanner (prowler, cloudsploit, steampipe)
   * @returns {Promise<Finding>} Processed finding with risk score
   */
  async processFinding(rawFinding, source) {
    try {
      // Create Finding object from raw data
      let finding;
      switch (source.toLowerCase()) {
        case 'prowler':
          finding = Finding.fromProwlerFinding(rawFinding);
          break;
        case 'cloudsploit':
          finding = Finding.fromCloudSploitFinding(rawFinding);
          break;
        default:
          finding = new Finding({ ...rawFinding, source });
      }

      // Validate finding
      const validation = finding.validate();
      if (!validation.isValid) {
        throw new Error(`Invalid finding: ${validation.errors.join(', ')}`);
      }

      // Get or create asset
      const asset = await this.getOrCreateAsset(finding.resource);

      // Calculate risk score
      const riskScore = await this.calculateRiskScore(finding, asset);
      finding.riskScore = riskScore.total;
      finding.blastRadius = riskScore.blastRadius;

      // Store in Neptune
      await this.storeFindingInGraph(finding, asset);

      return finding;
    } catch (error) {
      console.error('Error processing finding:', error);
      throw error;
    }
  }

  /**
   * Calculate comprehensive risk score for a finding
   * @param {Finding} finding - The security finding
   * @param {Asset} asset - The affected asset
   * @returns {Promise<Object>} Risk score breakdown
   */
  async calculateRiskScore(finding, asset) {
    try {
      // Base severity score (0-10)
      const severityScore = finding.getSeverityScore();

      // Asset criticality score (0-10)
      const criticalityScore = asset.getCriticalityScore();

      // Blast radius analysis
      const blastRadius = await this.calculateBlastRadius(asset);

      // Exposure factor (public vs private)
      const exposureFactor = asset.isPubliclyAccessible() ? 2.0 : 1.0;

      // Data sensitivity factor
      const sensitivityFactor = asset.containsSensitiveData() ? 1.5 : 1.0;

      // Age factor (older findings get higher priority)
      const ageFactor = Math.min(1 + (finding.calculateAge() * 0.02), 2.0);

      // Compliance impact
      const complianceImpact = this.calculateComplianceImpact(finding);

      // Calculate weighted risk score
      const baseScore = severityScore * 0.4 + criticalityScore * 0.3;
      const contextScore = blastRadius * 0.2 + complianceImpact * 0.1;
      const multiplier = exposureFactor * sensitivityFactor * ageFactor;

      const totalScore = Math.min((baseScore + contextScore) * multiplier, 10);

      return {
        total: Math.round(totalScore * 10) / 10,
        breakdown: {
          severity: severityScore,
          criticality: criticalityScore,
          blastRadius,
          exposure: exposureFactor,
          sensitivity: sensitivityFactor,
          age: ageFactor,
          compliance: complianceImpact
        },
        blastRadius
      };
    } catch (error) {
      console.error('Error calculating risk score:', error);
      // Return default score on error
      return { total: finding.getSeverityScore(), breakdown: {}, blastRadius: 1 };
    }
  }

  /**
   * Calculate blast radius by analyzing asset dependencies
   * @param {Asset} asset - The asset to analyze
   * @returns {Promise<number>} Blast radius score (1-10)
   */
  async calculateBlastRadius(asset) {
    try {
      // Start with asset's inherent blast radius
      let radius = asset.calculateBlastRadius();

      // Query Neptune for dependency graph
      const dependencies = await this.neptuneService.getAssetDependencies(asset.arn);
      const dependents = await this.neptuneService.getAssetDependents(asset.arn);

      // Calculate network effect
      const totalConnections = dependencies.length + dependents.length;
      const connectionImpact = Math.min(totalConnections * 0.2, 3);

      // Calculate criticality cascade
      const criticalDependents = dependents.filter(dep => 
        dep.criticality === 'critical' || dep.criticality === 'high'
      );
      const cascadeImpact = Math.min(criticalDependents.length * 0.5, 2);

      return Math.min(radius + connectionImpact + cascadeImpact, 10);
    } catch (error) {
      console.error('Error calculating blast radius:', error);
      return asset.calculateBlastRadius();
    }
  }

  /**
   * Calculate compliance impact score
   * @param {Finding} finding - The security finding
   * @returns {number} Compliance impact score (0-10)
   */
  calculateComplianceImpact(finding) {
    if (!finding.compliance || finding.compliance.length === 0) {
      return 0;
    }

    const frameworkWeights = {
      'pci-dss': 3,
      'hipaa': 3,
      'sox': 2.5,
      'gdpr': 2.5,
      'iso27001': 2,
      'nist': 2,
      'cis': 1.5,
      'aws-foundational': 1
    };

    let totalImpact = 0;
    for (const comp of finding.compliance) {
      const weight = frameworkWeights[comp.framework?.toLowerCase()] || 1;
      if (comp.status === 'non-compliant') {
        totalImpact += weight;
      }
    }

    return Math.min(totalImpact, 10);
  }

  /**
   * Get or create asset from finding resource information
   * @param {Object} resource - Resource information from finding
   * @returns {Promise<Asset>} Asset object
   */
  async getOrCreateAsset(resource) {
    try {
      // Try to get existing asset from Neptune
      let asset = await this.neptuneService.getAsset(resource.arn);

      if (!asset) {
        // Create new asset
        asset = new Asset({
          arn: resource.arn,
          type: resource.type,
          name: resource.name,
          accountId: resource.accountId,
          region: resource.region,
          tags: resource.tags,
          criticality: Asset.inferCriticality({
            service: this.extractServiceFromArn(resource.arn),
            tags: resource.tags,
            type: resource.type
          })
        });

        // Store in Neptune
        await this.neptuneService.createAsset(asset);
      }

      return asset;
    } catch (error) {
      console.error('Error getting/creating asset:', error);
      // Return minimal asset on error
      return new Asset({
        arn: resource.arn || 'unknown',
        type: resource.type || 'unknown',
        name: resource.name || 'unknown',
        accountId: resource.accountId || 'unknown',
        region: resource.region || 'unknown'
      });
    }
  }

  /**
   * Store finding and relationships in Neptune graph database
   * @param {Finding} finding - The processed finding
   * @param {Asset} asset - The associated asset
   * @returns {Promise<void>}
   */
  async storeFindingInGraph(finding, asset) {
    try {
      // Create finding vertex
      await this.neptuneService.createFinding(finding);

      // Create relationship between finding and asset
      await this.neptuneService.createRelationship(
        finding.id,
        asset.arn,
        'affects',
        { severity: finding.severity, riskScore: finding.riskScore }
      );

      // Update asset's last scanned timestamp
      await this.neptuneService.updateAssetLastScanned(asset.arn);

    } catch (error) {
      console.error('Error storing finding in graph:', error);
      // Don't throw - this is a storage operation
    }
  }

  /**
   * Get prioritized findings for remediation
   * @param {Object} filters - Filtering criteria
   * @param {number} limit - Maximum number of findings to return
   * @returns {Promise<Array>} Prioritized findings list
   */
  async getPrioritizedFindings(filters = {}, limit = 50) {
    try {
      const findings = await this.neptuneService.queryFindings({
        status: 'open',
        ...filters
      });

      // Sort by risk score and apply additional WSJF scoring
      return findings
        .sort((a, b) => {
          // Primary sort: risk score
          if (b.riskScore !== a.riskScore) {
            return b.riskScore - a.riskScore;
          }
          // Secondary sort: age (older first)
          return b.calculateAge() - a.calculateAge();
        })
        .slice(0, limit);

    } catch (error) {
      console.error('Error getting prioritized findings:', error);
      return [];
    }
  }

  /**
   * Generate risk summary for dashboard
   * @param {string} accountId - AWS account ID (optional)
   * @returns {Promise<Object>} Risk summary statistics
   */
  async generateRiskSummary(accountId = null) {
    try {
      const findings = await this.neptuneService.queryFindings({
        status: 'open',
        ...(accountId && { accountId })
      });

      const summary = {
        total: findings.length,
        bySeverity: {
          critical: findings.filter(f => f.severity === 'critical').length,
          high: findings.filter(f => f.severity === 'high').length,
          medium: findings.filter(f => f.severity === 'medium').length,
          low: findings.filter(f => f.severity === 'low').length,
          info: findings.filter(f => f.severity === 'info').length
        },
        byCategory: {},
        averageRiskScore: 0,
        complianceStatus: {},
        trendData: await this.getTrendData(accountId)
      };

      // Calculate category breakdown
      findings.forEach(finding => {
        summary.byCategory[finding.category] = 
          (summary.byCategory[finding.category] || 0) + 1;
      });

      // Calculate average risk score
      if (findings.length > 0) {
        summary.averageRiskScore = findings.reduce((sum, f) => sum + f.riskScore, 0) / findings.length;
      }

      // Calculate compliance status
      const frameworks = ['pci-dss', 'hipaa', 'gdpr', 'iso27001', 'nist'];
      for (const framework of frameworks) {
        const frameworkFindings = findings.filter(f => 
          f.compliance.some(c => c.framework === framework)
        );
        summary.complianceStatus[framework] = {
          total: frameworkFindings.length,
          critical: frameworkFindings.filter(f => f.severity === 'critical').length,
          high: frameworkFindings.filter(f => f.severity === 'high').length
        };
      }

      return summary;
    } catch (error) {
      console.error('Error generating risk summary:', error);
      return { total: 0, bySeverity: {}, byCategory: {}, averageRiskScore: 0 };
    }
  }

  /**
   * Get trend data for risk metrics over time
   * @param {string} accountId - AWS account ID (optional)
   * @returns {Promise<Array>} Trend data points
   */
  async getTrendData(accountId = null) {
    try {
      // Query findings created in the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const trends = await this.neptuneService.getFindingTrends(thirtyDaysAgo, accountId);
      return trends;
    } catch (error) {
      console.error('Error getting trend data:', error);
      return [];
    }
  }

  /**
   * Extract AWS service name from ARN
   * @param {string} arn - AWS ARN
   * @returns {string} Service name
   */
  extractServiceFromArn(arn) {
    if (!arn) return 'unknown';
    const parts = arn.split(':');
    return parts[2] || 'unknown';
  }
}

module.exports = SecurityAnalysisService;
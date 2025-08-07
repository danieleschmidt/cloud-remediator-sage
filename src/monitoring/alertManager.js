/**
 * Alert Manager
 * Handles alert processing, routing, and escalation for the CSPM platform
 */

const AWS = require('aws-sdk');
const { StructuredLogger } = require('./logger');

class AlertManager {
  constructor(options = {}) {
    this.logger = new StructuredLogger({ serviceName: 'alert-manager' });
    this.sns = new AWS.SNS();
    this.sqs = new AWS.SQS();
    
    // Configuration
    this.alertLevels = {
      INFO: 1,
      WARNING: 2,
      ERROR: 3,
      CRITICAL: 4
    };
    
    this.alertChannels = {
      SNS: options.snsTopicArn || process.env.ALERT_SNS_TOPIC,
      EMAIL: options.emailTopic || process.env.EMAIL_ALERT_TOPIC,
      SLACK: options.slackWebhook || process.env.SLACK_WEBHOOK_URL,
      PAGERDUTY: options.pagerDutyKey || process.env.PAGERDUTY_API_KEY
    };
    
    this.rateLimits = new Map();
    this.alertHistory = new Map();
    this.suppressionRules = new Map();
  }

  /**
   * Send alert with appropriate routing and escalation
   */
  async sendAlert(alert) {
    const correlationId = this.logger.createCorrelationId();
    const log = this.logger.child(correlationId);

    try {
      // Validate alert structure
      const validatedAlert = this.validateAlert(alert);
      if (!validatedAlert.isValid) {
        log.error('Invalid alert structure', null, { errors: validatedAlert.errors });
        return false;
      }

      // Check rate limiting
      if (this.isRateLimited(alert)) {
        log.warn('Alert rate limited', { alertType: alert.type });
        return false;
      }

      // Check suppression rules
      if (this.isSuppressed(alert)) {
        log.info('Alert suppressed by rule', { 
          alertType: alert.type,
          suppressionRule: this.getSuppressionRule(alert)
        });
        return false;
      }

      // Enrich alert with context
      const enrichedAlert = await this.enrichAlert(alert, correlationId);

      // Route alert based on severity and type
      const routingResult = await this.routeAlert(enrichedAlert, log);

      // Track alert history
      this.trackAlertHistory(enrichedAlert);

      // Update rate limits
      this.updateRateLimit(alert);

      log.info('Alert sent successfully', {
        alertId: enrichedAlert.id,
        alertType: enrichedAlert.type,
        severity: enrichedAlert.severity,
        channels: routingResult.channels
      });

      return true;

    } catch (error) {
      log.error('Failed to send alert', error, {
        alertType: alert.type,
        severity: alert.severity
      });
      return false;
    }
  }

  /**
   * Validate alert structure
   */
  validateAlert(alert) {
    const result = { isValid: true, errors: [] };

    if (!alert.type) {
      result.errors.push('Alert type is required');
    }

    if (!alert.severity || !this.alertLevels[alert.severity.toUpperCase()]) {
      result.errors.push('Valid alert severity is required (INFO, WARNING, ERROR, CRITICAL)');
    }

    if (!alert.message) {
      result.errors.push('Alert message is required');
    }

    if (!alert.source) {
      result.errors.push('Alert source is required');
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * Enrich alert with additional context
   */
  async enrichAlert(alert, correlationId) {
    const enriched = {
      ...alert,
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      correlationId,
      environment: process.env.STAGE || 'unknown',
      region: process.env.AWS_REGION || 'unknown',
      version: require('../../package.json').version
    };

    // Add system context
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
      enriched.lambda = {
        functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
        functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION,
        logGroup: process.env.AWS_LAMBDA_LOG_GROUP_NAME
      };
    }

    // Add tags for better categorization
    enriched.tags = this.generateAlertTags(alert);

    return enriched;
  }

  /**
   * Route alert to appropriate channels
   */
  async routeAlert(alert, log) {
    const routingRules = this.getRoutingRules(alert);
    const results = { channels: [], successes: 0, failures: 0 };

    for (const channel of routingRules.channels) {
      try {
        switch (channel) {
          case 'SNS':
            await this.sendToSNS(alert);
            break;
          case 'EMAIL':
            await this.sendToEmail(alert);
            break;
          case 'SLACK':
            await this.sendToSlack(alert);
            break;
          case 'PAGERDUTY':
            await this.sendToPagerDuty(alert);
            break;
          default:
            log.warn(`Unknown alert channel: ${channel}`);
            continue;
        }

        results.channels.push(channel);
        results.successes++;
        
      } catch (error) {
        log.error(`Failed to send alert via ${channel}`, error);
        results.failures++;
      }
    }

    return results;
  }

  /**
   * Get routing rules based on alert properties
   */
  getRoutingRules(alert) {
    const severity = alert.severity.toUpperCase();
    const alertType = alert.type.toLowerCase();

    // Default routing rules
    const rules = {
      channels: ['SNS'],
      escalationDelay: 0,
      maxEscalations: 1
    };

    // Critical alerts go to all channels
    if (severity === 'CRITICAL') {
      rules.channels = ['SNS', 'EMAIL', 'SLACK', 'PAGERDUTY'];
      rules.escalationDelay = 300; // 5 minutes
      rules.maxEscalations = 3;
    }
    // Error alerts go to email and Slack
    else if (severity === 'ERROR') {
      rules.channels = ['SNS', 'EMAIL', 'SLACK'];
      rules.escalationDelay = 600; // 10 minutes
      rules.maxEscalations = 2;
    }
    // Security alerts always include all channels
    else if (alertType.includes('security')) {
      rules.channels = ['SNS', 'EMAIL', 'SLACK', 'PAGERDUTY'];
      rules.escalationDelay = 180; // 3 minutes
      rules.maxEscalations = 3;
    }

    return rules;
  }

  /**
   * Send alert via SNS
   */
  async sendToSNS(alert) {
    if (!this.alertChannels.SNS) {
      throw new Error('SNS topic not configured');
    }

    const message = {
      default: JSON.stringify(alert),
      email: this.formatEmailMessage(alert),
      sms: this.formatSMSMessage(alert)
    };

    await this.sns.publish({
      TopicArn: this.alertChannels.SNS,
      Message: JSON.stringify(message),
      MessageStructure: 'json',
      Subject: `[${alert.severity}] ${alert.type}`,
      MessageAttributes: {
        severity: {
          DataType: 'String',
          StringValue: alert.severity
        },
        alertType: {
          DataType: 'String',
          StringValue: alert.type
        },
        environment: {
          DataType: 'String',
          StringValue: alert.environment
        }
      }
    }).promise();
  }

  /**
   * Send alert via email (using SNS)
   */
  async sendToEmail(alert) {
    if (!this.alertChannels.EMAIL) {
      return this.sendToSNS(alert); // Fallback to SNS
    }

    const emailBody = this.formatEmailMessage(alert);
    
    await this.sns.publish({
      TopicArn: this.alertChannels.EMAIL,
      Message: emailBody,
      Subject: `[${alert.environment}] [${alert.severity}] ${alert.type}: ${alert.message}`
    }).promise();
  }

  /**
   * Send alert to Slack
   */
  async sendToSlack(alert) {
    if (!this.alertChannels.SLACK) {
      throw new Error('Slack webhook not configured');
    }

    const slackMessage = {
      text: `🚨 ${alert.severity} Alert: ${alert.type}`,
      attachments: [{
        color: this.getSeverityColor(alert.severity),
        fields: [
          { title: 'Message', value: alert.message, short: false },
          { title: 'Source', value: alert.source, short: true },
          { title: 'Environment', value: alert.environment, short: true },
          { title: 'Time', value: alert.timestamp, short: true },
          { title: 'Alert ID', value: alert.id, short: true }
        ]
      }]
    };

    const https = require('https');
    const url = require('url');

    return new Promise((resolve, reject) => {
      const webhookUrl = new URL(this.alertChannels.SLACK);
      const postData = JSON.stringify(slackMessage);

      const options = {
        hostname: webhookUrl.hostname,
        port: 443,
        path: webhookUrl.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`Slack webhook returned ${res.statusCode}`));
        }
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  /**
   * Send alert to PagerDuty
   */
  async sendToPagerDuty(alert) {
    if (!this.alertChannels.PAGERDUTY) {
      throw new Error('PagerDuty integration key not configured');
    }

    // This is a placeholder for PagerDuty integration
    // In a real implementation, you would use the PagerDuty API
    console.log('PagerDuty alert would be sent:', {
      routing_key: this.alertChannels.PAGERDUTY,
      event_action: 'trigger',
      payload: {
        summary: `${alert.type}: ${alert.message}`,
        severity: alert.severity.toLowerCase(),
        source: alert.source,
        custom_details: alert
      }
    });
  }

  /**
   * Format alert for email
   */
  formatEmailMessage(alert) {
    return `
Alert Details:
--------------
Type: ${alert.type}
Severity: ${alert.severity}
Message: ${alert.message}
Source: ${alert.source}
Environment: ${alert.environment}
Timestamp: ${alert.timestamp}
Alert ID: ${alert.id}

Additional Context:
${JSON.stringify(alert.context || {}, null, 2)}

--
Cloud Remediator Sage Alert System
`;
  }

  /**
   * Format alert for SMS
   */
  formatSMSMessage(alert) {
    return `[${alert.severity}] ${alert.type}: ${alert.message}. Source: ${alert.source}. Time: ${alert.timestamp}`;
  }

  /**
   * Get Slack color for severity
   */
  getSeverityColor(severity) {
    const colors = {
      CRITICAL: '#FF0000',
      ERROR: '#FF8C00',
      WARNING: '#FFA500',
      INFO: '#008000'
    };
    return colors[severity.toUpperCase()] || '#808080';
  }

  /**
   * Check if alert is rate limited
   */
  isRateLimited(alert) {
    const key = `${alert.type}:${alert.source}`;
    const now = Date.now();
    const limit = this.rateLimits.get(key);

    if (!limit) {
      return false;
    }

    // Allow 1 alert per minute for the same type/source
    return now - limit.lastSent < 60000;
  }

  /**
   * Update rate limit tracking
   */
  updateRateLimit(alert) {
    const key = `${alert.type}:${alert.source}`;
    this.rateLimits.set(key, {
      lastSent: Date.now(),
      count: (this.rateLimits.get(key)?.count || 0) + 1
    });
  }

  /**
   * Check if alert is suppressed
   */
  isSuppressed(alert) {
    // Check for maintenance windows, known issues, etc.
    const maintenanceMode = process.env.MAINTENANCE_MODE === 'true';
    if (maintenanceMode && alert.severity !== 'CRITICAL') {
      return true;
    }

    // Check custom suppression rules
    for (const [ruleId, rule] of this.suppressionRules.entries()) {
      if (this.matchesSuppressionRule(alert, rule)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if alert matches suppression rule
   */
  matchesSuppressionRule(alert, rule) {
    if (rule.alertType && rule.alertType !== alert.type) {
      return false;
    }

    if (rule.severity && rule.severity !== alert.severity) {
      return false;
    }

    if (rule.source && rule.source !== alert.source) {
      return false;
    }

    return true;
  }

  /**
   * Get suppression rule that matches alert
   */
  getSuppressionRule(alert) {
    for (const [ruleId, rule] of this.suppressionRules.entries()) {
      if (this.matchesSuppressionRule(alert, rule)) {
        return ruleId;
      }
    }
    return null;
  }

  /**
   * Track alert history for analysis
   */
  trackAlertHistory(alert) {
    const key = `${alert.type}:${alert.source}`;
    const history = this.alertHistory.get(key) || [];
    
    history.push({
      timestamp: alert.timestamp,
      severity: alert.severity,
      id: alert.id
    });

    // Keep only last 100 alerts per type/source
    if (history.length > 100) {
      history.shift();
    }

    this.alertHistory.set(key, history);
  }

  /**
   * Generate alert tags for categorization
   */
  generateAlertTags(alert) {
    const tags = [
      `severity:${alert.severity.toLowerCase()}`,
      `type:${alert.type}`,
      `source:${alert.source}`,
      `environment:${alert.environment || 'unknown'}`
    ];

    // Add component-specific tags
    if (alert.source?.includes('lambda')) {
      tags.push('component:lambda');
    }
    if (alert.source?.includes('neptune')) {
      tags.push('component:neptune');
    }
    if (alert.source?.includes('s3')) {
      tags.push('component:s3');
    }

    return tags;
  }

  /**
   * Add suppression rule
   */
  addSuppressionRule(ruleId, rule) {
    this.suppressionRules.set(ruleId, {
      ...rule,
      createdAt: new Date().toISOString()
    });
  }

  /**
   * Remove suppression rule
   */
  removeSuppressionRule(ruleId) {
    return this.suppressionRules.delete(ruleId);
  }

  /**
   * Get alert statistics
   */
  getAlertStatistics() {
    const stats = {
      rateLimits: Object.fromEntries(this.rateLimits),
      suppressionRules: Object.fromEntries(this.suppressionRules),
      alertHistory: {}
    };

    // Aggregate alert history statistics
    for (const [key, history] of this.alertHistory.entries()) {
      stats.alertHistory[key] = {
        totalAlerts: history.length,
        recentAlerts: history.filter(alert => 
          Date.now() - new Date(alert.timestamp).getTime() < 86400000 // Last 24 hours
        ).length,
        severityBreakdown: history.reduce((acc, alert) => {
          acc[alert.severity] = (acc[alert.severity] || 0) + 1;
          return acc;
        }, {})
      };
    }

    return stats;
  }
}

module.exports = { AlertManager };
/**
 * Global Compliance Framework
 * Comprehensive compliance management for GDPR, CCPA, PDPA, and other international regulations
 */

const { StructuredLogger } = require('../monitoring/logger');
const EventEmitter = require('events');

class GlobalComplianceFramework extends EventEmitter {
  constructor(options = {}) {
    super();
    this.logger = new StructuredLogger('compliance-framework');
    
    this.config = {
      enabledFrameworks: options.enabledFrameworks || ['gdpr', 'ccpa', 'pdpa'],
      defaultDataClassification: options.defaultDataClassification || 'public',
      auditRetentionPeriod: options.auditRetentionPeriod || (7 * 365 * 24 * 60 * 60 * 1000), // 7 years
      automaticComplianceChecks: options.automaticComplianceChecks !== false,
      realTimeMonitoring: options.realTimeMonitoring !== false,
      ...options
    };
    
    // Compliance frameworks with detailed requirements
    this.complianceFrameworks = {
      gdpr: {
        name: 'General Data Protection Regulation',
        region: ['EU', 'EEA'],
        dataRetentionMax: 365 * 24 * 60 * 60 * 1000, // 1 year default
        consentRequired: true,
        rightToDelete: true,
        dataPortability: true,
        breachNotificationTime: 72 * 60 * 60 * 1000, // 72 hours
        dpoRequired: true,
        lawfulBasis: ['consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests'],
        requirements: {
          'data-minimization': { required: true, severity: 'high' },
          'purpose-limitation': { required: true, severity: 'high' },
          'storage-limitation': { required: true, severity: 'medium' },
          'accuracy': { required: true, severity: 'medium' },
          'security': { required: true, severity: 'high' },
          'accountability': { required: true, severity: 'high' }
        }
      },
      
      ccpa: {
        name: 'California Consumer Privacy Act',
        region: ['CA', 'US'],
        dataRetentionMax: 365 * 24 * 60 * 60 * 1000, // 1 year default
        consentRequired: false, // Opt-out model
        rightToDelete: true,
        dataPortability: true,
        breachNotificationTime: 0, // No specific requirement
        dpoRequired: false,
        requirements: {
          'consumer-notice': { required: true, severity: 'high' },
          'opt-out-rights': { required: true, severity: 'high' },
          'data-deletion': { required: true, severity: 'high' },
          'non-discrimination': { required: true, severity: 'medium' },
          'security': { required: true, severity: 'high' }
        }
      },
      
      pdpa: {
        name: 'Personal Data Protection Act',
        region: ['SG', 'TH'],
        dataRetentionMax: 365 * 24 * 60 * 60 * 1000, // 1 year default
        consentRequired: true,
        rightToDelete: true,
        dataPortability: false,
        breachNotificationTime: 72 * 60 * 60 * 1000, // 72 hours
        dpoRequired: true,
        requirements: {
          'consent-management': { required: true, severity: 'high' },
          'data-protection-policy': { required: true, severity: 'medium' },
          'access-limitation': { required: true, severity: 'high' },
          'retention-limitation': { required: true, severity: 'medium' },
          'security-arrangements': { required: true, severity: 'high' }
        }
      },
      
      sox: {
        name: 'Sarbanes-Oxley Act',
        region: ['US'],
        dataRetentionMax: 7 * 365 * 24 * 60 * 60 * 1000, // 7 years
        auditTrailRequired: true,
        requirements: {
          'internal-controls': { required: true, severity: 'high' },
          'audit-trails': { required: true, severity: 'high' },
          'document-retention': { required: true, severity: 'medium' },
          'management-assessment': { required: true, severity: 'medium' }
        }
      },
      
      pci_dss: {
        name: 'Payment Card Industry Data Security Standard',
        region: ['Global'],
        encryptionRequired: true,
        networkSegmentation: true,
        requirements: {
          'secure-network': { required: true, severity: 'high' },
          'cardholder-data-protection': { required: true, severity: 'critical' },
          'vulnerability-management': { required: true, severity: 'high' },
          'access-control': { required: true, severity: 'high' },
          'network-monitoring': { required: true, severity: 'high' },
          'security-policies': { required: true, severity: 'medium' }
        }
      }
    };
    
    // Data classification categories
    this.dataClassifications = {
      'public': { retentionDefault: 0, encryptionRequired: false, accessLevel: 'public' },
      'internal': { retentionDefault: 365, encryptionRequired: false, accessLevel: 'internal' },
      'confidential': { retentionDefault: 365, encryptionRequired: true, accessLevel: 'restricted' },
      'restricted': { retentionDefault: 90, encryptionRequired: true, accessLevel: 'highly-restricted' },
      'personal': { retentionDefault: 365, encryptionRequired: true, accessLevel: 'restricted', gdprApplicable: true },
      'sensitive-personal': { retentionDefault: 90, encryptionRequired: true, accessLevel: 'highly-restricted', gdprApplicable: true },
      'financial': { retentionDefault: 2555, encryptionRequired: true, accessLevel: 'highly-restricted', soxApplicable: true }, // 7 years
      'payment': { retentionDefault: 365, encryptionRequired: true, accessLevel: 'highly-restricted', pciApplicable: true }
    };
    
    // Regional compliance mapping
    this.regionalCompliance = {
      'EU': ['gdpr'],
      'EEA': ['gdpr'],
      'US': ['ccpa', 'sox'],
      'CA': ['ccpa'],
      'SG': ['pdpa'],
      'TH': ['pdpa'],
      'Global': ['pci_dss']
    };
    
    // Compliance state tracking
    this.complianceState = {
      assessments: new Map(),
      violations: new Map(),
      remediations: new Map(),
      auditTrail: [],
      lastAssessment: null,
      complianceScore: 0
    };
    
    // Automated monitoring
    this.monitoringRules = new Map();
    this.alertThresholds = new Map();
    
    this.isInitialized = false;
  }
  
  /**
   * Initialize the compliance framework
   */
  async initialize() {
    this.logger.info('Initializing Global Compliance Framework');
    
    try {
      // Initialize enabled frameworks
      for (const framework of this.config.enabledFrameworks) {
        if (this.complianceFrameworks[framework]) {
          await this.initializeFramework(framework);
          this.logger.info(`Framework ${framework} initialized`);
        }
      }
      
      // Setup automated monitoring
      if (this.config.automaticComplianceChecks) {
        await this.setupAutomaticMonitoring();
      }
      
      // Initialize audit trail
      this.initializeAuditTrail();
      
      this.isInitialized = true;
      this.logger.info('Global Compliance Framework initialized successfully');
      
    } catch (error) {
      this.logger.error('Compliance framework initialization failed', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Initialize specific compliance framework
   */
  async initializeFramework(frameworkId) {
    const framework = this.complianceFrameworks[frameworkId];
    if (!framework) {
      throw new Error(`Unknown compliance framework: ${frameworkId}`);
    }
    
    // Initialize framework-specific monitoring rules
    for (const [requirement, config] of Object.entries(framework.requirements || {})) {
      this.monitoringRules.set(`${frameworkId}-${requirement}`, {
        framework: frameworkId,
        requirement,
        severity: config.severity,
        required: config.required,
        lastCheck: null,
        violations: []
      });
    }
    
    // Set alert thresholds
    this.alertThresholds.set(frameworkId, {
      critical: 0,
      high: 2,
      medium: 5,
      low: 10
    });
  }
  
  /**
   * Assess compliance for data processing activity
   */
  async assessCompliance(activity) {
    const assessmentId = `assess-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.info('Starting compliance assessment', { 
      assessmentId,
      activity: activity.type,
      dataTypes: activity.dataTypes 
    });
    
    const assessment = {
      id: assessmentId,
      timestamp: new Date().toISOString(),
      activity,
      frameworks: [],
      violations: [],
      recommendations: [],
      overallScore: 0,
      status: 'pending'
    };
    
    try {
      // Determine applicable frameworks
      const applicableFrameworks = this.getApplicableFrameworks(activity);
      assessment.frameworks = applicableFrameworks;
      
      // Assess each applicable framework
      for (const frameworkId of applicableFrameworks) {
        const frameworkAssessment = await this.assessFrameworkCompliance(activity, frameworkId);
        assessment.violations.push(...frameworkAssessment.violations);
        assessment.recommendations.push(...frameworkAssessment.recommendations);
      }
      
      // Calculate overall compliance score
      assessment.overallScore = this.calculateComplianceScore(assessment);
      assessment.status = assessment.violations.length === 0 ? 'compliant' : 'non-compliant';
      
      // Store assessment
      this.complianceState.assessments.set(assessmentId, assessment);
      this.complianceState.lastAssessment = assessment;
      
      // Add to audit trail
      this.addAuditEntry({
        type: 'compliance-assessment',
        assessmentId,
        activity: activity.type,
        result: assessment.status,
        score: assessment.overallScore
      });
      
      this.logger.info('Compliance assessment completed', {
        assessmentId,
        status: assessment.status,
        score: assessment.overallScore,
        violations: assessment.violations.length
      });
      
      // Emit events for violations
      if (assessment.violations.length > 0) {
        this.emit('complianceViolation', assessment);
      }
      
      return assessment;
      
    } catch (error) {
      assessment.status = 'error';
      assessment.error = error.message;
      this.logger.error('Compliance assessment failed', { 
        assessmentId,
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Get applicable compliance frameworks for an activity
   */
  getApplicableFrameworks(activity) {
    const frameworks = new Set();
    
    // Based on data types
    for (const dataType of activity.dataTypes || []) {
      const classification = this.dataClassifications[dataType];
      if (classification) {
        if (classification.gdprApplicable) frameworks.add('gdpr');
        if (classification.soxApplicable) frameworks.add('sox');
        if (classification.pciApplicable) frameworks.add('pci_dss');
      }
    }
    
    // Based on geographic regions
    for (const region of activity.regions || []) {
      const regionalFrameworks = this.regionalCompliance[region] || [];
      for (const framework of regionalFrameworks) {
        if (this.config.enabledFrameworks.includes(framework)) {
          frameworks.add(framework);
        }
      }
    }
    
    return Array.from(frameworks);
  }
  
  /**
   * Assess compliance against specific framework
   */
  async assessFrameworkCompliance(activity, frameworkId) {
    const framework = this.complianceFrameworks[frameworkId];
    const assessment = {
      framework: frameworkId,
      violations: [],
      recommendations: [],
      score: 100
    };
    
    // Check each requirement
    for (const [requirementId, config] of Object.entries(framework.requirements || {})) {
      const violation = await this.checkRequirement(activity, frameworkId, requirementId, config);
      if (violation) {
        assessment.violations.push(violation);
        
        // Deduct points based on severity
        const severityScores = { critical: 25, high: 15, medium: 10, low: 5 };
        assessment.score -= severityScores[config.severity] || 10;
      }
    }
    
    // Framework-specific checks
    if (frameworkId === 'gdpr') {
      await this.assessGDPRSpecific(activity, assessment);
    } else if (frameworkId === 'ccpa') {
      await this.assessCCPASpecific(activity, assessment);
    } else if (frameworkId === 'pdpa') {
      await this.assessPDPASpecific(activity, assessment);
    }
    
    assessment.score = Math.max(0, assessment.score);
    return assessment;
  }
  
  /**
   * Check specific compliance requirement
   */
  async checkRequirement(activity, frameworkId, requirementId, config) {
    // This would contain actual compliance checking logic
    // For now, return null (no violation) as a placeholder
    
    // Example check for data retention
    if (requirementId === 'storage-limitation') {
      const framework = this.complianceFrameworks[frameworkId];
      if (activity.retentionPeriod > framework.dataRetentionMax) {
        return {
          framework: frameworkId,
          requirement: requirementId,
          severity: config.severity,
          description: `Data retention period exceeds ${frameworkId.toUpperCase()} maximum`,
          remediation: `Reduce retention period to ${Math.floor(framework.dataRetentionMax / (24*60*60*1000))} days`
        };
      }
    }
    
    return null;
  }
  
  /**
   * GDPR-specific compliance assessment
   */
  async assessGDPRSpecific(activity, assessment) {
    // Check for lawful basis
    if (!activity.lawfulBasis) {
      assessment.violations.push({
        framework: 'gdpr',
        requirement: 'lawful-basis',
        severity: 'high',
        description: 'No lawful basis specified for personal data processing',
        remediation: 'Specify lawful basis for processing (consent, contract, legal obligation, etc.)'
      });
    }
    
    // Check consent management
    if (activity.lawfulBasis === 'consent' && !activity.consentRecorded) {
      assessment.violations.push({
        framework: 'gdpr',
        requirement: 'consent-management',
        severity: 'high',
        description: 'Consent-based processing without proper consent records',
        remediation: 'Implement consent management system with audit trail'
      });
    }
    
    // Check data subject rights implementation
    if (!activity.dataSubjectRights || !activity.dataSubjectRights.includes('access')) {
      assessment.recommendations.push({
        framework: 'gdpr',
        type: 'enhancement',
        description: 'Implement data subject access rights mechanism',
        priority: 'high'
      });
    }
  }
  
  /**
   * CCPA-specific compliance assessment
   */
  async assessCCPASpecific(activity, assessment) {
    // Check consumer notice requirements
    if (!activity.privacyNotice) {
      assessment.violations.push({
        framework: 'ccpa',
        requirement: 'consumer-notice',
        severity: 'high',
        description: 'Missing privacy notice for California consumers',
        remediation: 'Provide clear privacy notice describing data collection and use'
      });
    }
    
    // Check opt-out mechanism
    if (!activity.optOutMechanism) {
      assessment.violations.push({
        framework: 'ccpa',
        requirement: 'opt-out-rights',
        severity: 'medium',
        description: 'No opt-out mechanism provided for data sale',
        remediation: 'Implement "Do Not Sell My Personal Information" mechanism'
      });
    }
  }
  
  /**
   * PDPA-specific compliance assessment
   */
  async assessPDPASpecific(activity, assessment) {
    // Check notification requirements
    if (!activity.dataProtectionNotification) {
      assessment.violations.push({
        framework: 'pdpa',
        requirement: 'data-protection-policy',
        severity: 'medium',
        description: 'Missing data protection notification',
        remediation: 'Provide data protection notification in accordance with PDPA requirements'
      });
    }
  }
  
  /**
   * Calculate overall compliance score
   */
  calculateComplianceScore(assessment) {
    if (assessment.violations.length === 0) {
      return 100;
    }
    
    const severityWeights = { critical: 25, high: 15, medium: 10, low: 5 };
    let totalDeduction = 0;
    
    for (const violation of assessment.violations) {
      totalDeduction += severityWeights[violation.severity] || 10;
    }
    
    return Math.max(0, 100 - totalDeduction);
  }
  
  /**
   * Setup automatic compliance monitoring
   */
  async setupAutomaticMonitoring() {
    this.logger.info('Setting up automatic compliance monitoring');
    
    // Schedule regular assessments
    setInterval(() => {
      this.performAutomaticAssessment();
    }, 24 * 60 * 60 * 1000); // Daily
    
    // Setup real-time monitoring if enabled
    if (this.config.realTimeMonitoring) {
      this.setupRealTimeMonitoring();
    }
  }
  
  /**
   * Perform automatic compliance assessment
   */
  async performAutomaticAssessment() {
    try {
      this.logger.info('Performing automatic compliance assessment');
      
      // This would assess all active data processing activities
      // For now, just log that it's running
      this.addAuditEntry({
        type: 'automatic-assessment',
        timestamp: new Date().toISOString(),
        result: 'completed'
      });
      
    } catch (error) {
      this.logger.error('Automatic compliance assessment failed', { error: error.message });
    }
  }
  
  /**
   * Setup real-time compliance monitoring
   */
  setupRealTimeMonitoring() {
    this.logger.info('Setting up real-time compliance monitoring');
    
    // Monitor for data access patterns
    this.on('dataAccess', (event) => {
      this.checkRealTimeCompliance(event);
    });
    
    // Monitor for data retention violations
    this.on('dataRetention', (event) => {
      this.checkRetentionCompliance(event);
    });
    
    // Monitor for consent violations
    this.on('consentEvent', (event) => {
      this.checkConsentCompliance(event);
    });
  }
  
  /**
   * Check real-time compliance for events
   */
  async checkRealTimeCompliance(event) {
    const violations = [];
    
    // Check if access is compliant
    for (const frameworkId of this.config.enabledFrameworks) {
      const framework = this.complianceFrameworks[frameworkId];
      
      // Example: Check access control requirements
      if (framework.requirements && framework.requirements['access-control']) {
        if (!event.authorization || !event.audit) {
          violations.push({
            framework: frameworkId,
            requirement: 'access-control',
            severity: 'high',
            description: 'Unauthorized or unaudited data access',
            event: event.id
          });
        }
      }
    }
    
    if (violations.length > 0) {
      this.emit('realTimeViolation', { event, violations });
    }
  }
  
  /**
   * Initialize audit trail system
   */
  initializeAuditTrail() {
    this.auditTrail = {
      entries: [],
      maxEntries: 100000, // Keep last 100k entries in memory
      persistencePath: '/tmp/compliance-audit.json'
    };
  }
  
  /**
   * Add entry to audit trail
   */
  addAuditEntry(entry) {
    const auditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...entry
    };
    
    this.complianceState.auditTrail.push(auditEntry);
    
    // Keep only recent entries in memory
    if (this.complianceState.auditTrail.length > this.auditTrail.maxEntries) {
      this.complianceState.auditTrail = this.complianceState.auditTrail.slice(-this.auditTrail.maxEntries);
    }
    
    this.emit('auditEntry', auditEntry);
  }
  
  /**
   * Generate compliance report
   */
  generateComplianceReport(options = {}) {
    const report = {
      generatedAt: new Date().toISOString(),
      period: options.period || '30-days',
      frameworks: this.config.enabledFrameworks,
      summary: {
        overallScore: this.complianceState.complianceScore,
        totalAssessments: this.complianceState.assessments.size,
        activeViolations: Array.from(this.complianceState.violations.values()).filter(v => v.status === 'open').length,
        resolvedViolations: Array.from(this.complianceState.violations.values()).filter(v => v.status === 'resolved').length
      },
      violations: [],
      recommendations: [],
      auditSummary: {
        totalEntries: this.complianceState.auditTrail.length,
        recentEntries: this.complianceState.auditTrail.slice(-100)
      }
    };
    
    // Add framework-specific summaries
    for (const frameworkId of this.config.enabledFrameworks) {
      report[frameworkId] = this.getFrameworkSummary(frameworkId);
    }
    
    return report;
  }
  
  /**
   * Get framework-specific compliance summary
   */
  getFrameworkSummary(frameworkId) {
    const framework = this.complianceFrameworks[frameworkId];
    const violations = Array.from(this.complianceState.violations.values())
      .filter(v => v.framework === frameworkId);
    
    return {
      name: framework.name,
      status: violations.length === 0 ? 'compliant' : 'non-compliant',
      violations: violations.length,
      requirements: Object.keys(framework.requirements || {}),
      lastAssessment: this.complianceState.lastAssessment?.timestamp
    };
  }
  
  /**
   * Get compliance status
   */
  getComplianceStatus() {
    return {
      initialized: this.isInitialized,
      enabledFrameworks: this.config.enabledFrameworks,
      overallScore: this.complianceState.complianceScore,
      lastAssessment: this.complianceState.lastAssessment?.timestamp,
      activeViolations: Array.from(this.complianceState.violations.values()).filter(v => v.status === 'open').length,
      monitoringActive: this.config.automaticComplianceChecks,
      auditEntries: this.complianceState.auditTrail.length
    };
  }
}

module.exports = GlobalComplianceFramework;
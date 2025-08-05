/**
 * Tests for Global Compliance Engine
 * Validates GDPR, CCPA, PDPA, SOX, HIPAA compliance checks
 */

const ComplianceEngine = require('../../src/compliance/ComplianceEngine');

describe('ComplianceEngine', () => {
  let complianceEngine;

  beforeEach(() => {
    complianceEngine = new ComplianceEngine({
      enabled: true,
      auditMode: true,
      strictMode: false
    });
  });

  afterEach(() => {
    // Clean up event listeners
    complianceEngine.removeAllListeners();
  });

  describe('Initialization', () => {
    test('should initialize with default frameworks', () => {
      expect(complianceEngine.frameworks).toHaveProperty('gdpr');
      expect(complianceEngine.frameworks).toHaveProperty('ccpa');
      expect(complianceEngine.frameworks).toHaveProperty('pdpa');
      expect(complianceEngine.frameworks).toHaveProperty('sox');
      expect(complianceEngine.frameworks).toHaveProperty('hipaa');
      expect(complianceEngine.frameworks).toHaveProperty('iso27001');
    });

    test('should enable frameworks by default', () => {
      expect(complianceEngine.frameworks.gdpr.enabled).toBe(true);
      expect(complianceEngine.frameworks.ccpa.enabled).toBe(true);
      expect(complianceEngine.frameworks.sox.enabled).toBe(true);
    });

    test('should initialize audit trail', () => {
      expect(Array.isArray(complianceEngine.auditTrail)).toBe(true);
      expect(complianceEngine.auditRetentionDays).toBe(2555); // 7 years for SOX
    });

    test('should emit initialized event', (done) => {
      const newEngine = new ComplianceEngine();
      newEngine.on('initialized', (data) => {
        expect(data).toHaveProperty('frameworks');
        expect(data).toHaveProperty('auditMode');
        expect(data).toHaveProperty('strictMode');
        done();
      });
    });
  });

  describe('GDPR Compliance', () => {
    test('should check data retention compliance', async () => {
      const activity = {
        type: 'data-processing',
        dataRetentionDays: 1200, // Exceeds GDPR limit
        hasConsent: true,
        hasDataMapping: true
      };

      const result = await complianceEngine.checkGDPRCompliance(activity, complianceEngine.frameworks.gdpr);
      
      expect(result.compliant).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('DATA_RETENTION_VIOLATION');
    });

    test('should check consent requirements', async () => {
      const activity = {
        type: 'data-processing',
        dataRetentionDays: 365,
        hasConsent: false, // Missing consent
        hasDataMapping: true
      };

      const result = await complianceEngine.checkGDPRCompliance(activity, complianceEngine.frameworks.gdpr);
      
      expect(result.compliant).toBe(false);
      expect(result.violations.some(v => v.type === 'CONSENT_VIOLATION')).toBe(true);
    });

    test('should recommend data mapping', async () => {
      const activity = {
        type: 'data-processing',
        dataRetentionDays: 365,
        hasConsent: true,
        hasDataMapping: false // Missing data mapping
      };

      const result = await complianceEngine.checkGDPRCompliance(activity, complianceEngine.frameworks.gdpr);
      
      expect(result.recommendations.some(r => r.type === 'DATA_MAPPING_REQUIRED')).toBe(true);
    });

    test('should pass compliant GDPR activity', async () => {
      const activity = {
        type: 'data-processing',
        dataRetentionDays: 365,
        hasConsent: true,
        hasDataMapping: true
      };

      const result = await complianceEngine.checkGDPRCompliance(activity, complianceEngine.frameworks.gdpr);
      
      expect(result.compliant).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('CCPA Compliance', () => {
    test('should check opt-out mechanism for data sales', async () => {
      const activity = {
        type: 'data-processing',
        involvesDataSale: true,
        hasOptOutMechanism: false, // Missing opt-out
        supportsConsumerRights: true
      };

      const result = await complianceEngine.checkCCPACompliance(activity, complianceEngine.frameworks.ccpa);
      
      expect(result.compliant).toBe(false);
      expect(result.violations.some(v => v.type === 'OPT_OUT_VIOLATION')).toBe(true);
    });

    test('should recommend consumer rights implementation', async () => {
      const activity = {
        type: 'data-processing',
        involvesDataSale: false,
        hasOptOutMechanism: false,
        supportsConsumerRights: false // Missing consumer rights
      };

      const result = await complianceEngine.checkCCPACompliance(activity, complianceEngine.frameworks.ccpa);
      
      expect(result.recommendations.some(r => r.type === 'CONSUMER_RIGHTS_REQUIRED')).toBe(true);
    });
  });

  describe('SOX Compliance', () => {
    test('should require audit trail for financial data', async () => {
      const activity = {
        type: 'financial-processing',
        involvesFinancialData: true,
        hasAuditTrail: false, // Missing audit trail
        dataRetentionDays: 2555
      };

      const result = await complianceEngine.checkSOXCompliance(activity, complianceEngine.frameworks.sox);
      
      expect(result.compliant).toBe(false);
      expect(result.violations.some(v => v.type === 'AUDIT_TRAIL_VIOLATION')).toBe(true);
    });

    test('should enforce financial data retention period', async () => {
      const activity = {
        type: 'financial-processing',
        involvesFinancialData: true,
        hasAuditTrail: true,
        dataRetentionDays: 1000 // Below SOX requirement
      };

      const result = await complianceEngine.checkSOXCompliance(activity, complianceEngine.frameworks.sox);
      
      expect(result.compliant).toBe(false);
      expect(result.violations.some(v => v.type === 'FINANCIAL_RETENTION_VIOLATION')).toBe(true);
    });
  });

  describe('HIPAA Compliance', () => {
    test('should require encryption for PHI', async () => {
      const activity = {
        type: 'healthcare-processing',
        involvesPHI: true,
        isEncrypted: false, // Missing encryption
        followsMinimumNecessary: true
      };

      const result = await complianceEngine.checkHIPAACompliance(activity, complianceEngine.frameworks.hipaa);
      
      expect(result.compliant).toBe(false);
      expect(result.violations.some(v => v.type === 'PHI_ENCRYPTION_VIOLATION')).toBe(true);
    });

    test('should enforce minimum necessary standard', async () => {
      const activity = {
        type: 'healthcare-processing',
        involvesPHI: true,
        isEncrypted: true,
        followsMinimumNecessary: false // Violates minimum necessary
      };

      const result = await complianceEngine.checkHIPAACompliance(activity, complianceEngine.frameworks.hipaa);
      
      expect(result.violations.some(v => v.type === 'MINIMUM_NECESSARY_VIOLATION')).toBe(true);
    });
  });

  describe('Comprehensive Compliance Check', () => {
    test('should check all enabled frameworks', async () => {
      const activity = {
        type: 'data-processing',
        dataRetentionDays: 365,
        hasConsent: true,
        hasDataMapping: true,
        involvesDataSale: false,
        supportsConsumerRights: true,
        involvesFinancialData: false,
        involvesPHI: false,
        hasAuditTrail: true,
        isEncrypted: true
      };

      const result = await complianceEngine.checkCompliance(activity);
      
      expect(result).toHaveProperty('compliant');
      expect(result).toHaveProperty('violations');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('requiredActions');
    });

    test('should aggregate violations from multiple frameworks', async () => {
      const activity = {
        type: 'mixed-processing',
        dataRetentionDays: 5000, // GDPR violation
        hasConsent: false, // GDPR violation
        involvesDataSale: true,
        hasOptOutMechanism: false, // CCPA violation
        involvesFinancialData: true,
        hasAuditTrail: false, // SOX violation
        involvesPHI: true,
        isEncrypted: false // HIPAA violation
      };

      const result = await complianceEngine.checkCompliance(activity);
      
      expect(result.compliant).toBe(false);
      expect(result.violations.length).toBeGreaterThan(3); // Multiple framework violations
    });
  });

  describe('Audit Logging', () => {
    test('should log compliance check events', async () => {
      const initialAuditCount = complianceEngine.auditTrail.length;
      
      const activity = {
        type: 'test-activity',
        dataRetentionDays: 365,
        hasConsent: true
      };

      await complianceEngine.checkCompliance(activity);
      
      expect(complianceEngine.auditTrail.length).toBeGreaterThan(initialAuditCount);
      
      const lastAuditEvent = complianceEngine.auditTrail[complianceEngine.auditTrail.length - 1];
      expect(lastAuditEvent.type).toBe('COMPLIANCE_CHECK');
    });

    test('should clean up old audit events', () => {
      // Add old audit event
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - (complianceEngine.auditRetentionDays + 1));
      
      complianceEngine.auditTrail.push({
        id: 'old-event',
        timestamp: oldDate.toISOString(),
        type: 'TEST_EVENT',
        details: {}
      });

      complianceEngine.cleanupAuditTrail();
      
      expect(complianceEngine.auditTrail.find(e => e.id === 'old-event')).toBeUndefined();
    });
  });

  describe('Compliance Reporting', () => {
    test('should generate comprehensive compliance report', async () => {
      const report = await complianceEngine.generateComplianceReport();
      
      expect(report).toHaveProperty('generated');
      expect(report).toHaveProperty('locale');
      expect(report).toHaveProperty('frameworks');
      expect(report).toHaveProperty('overallCompliance');
      expect(report).toHaveProperty('auditSummary');
      
      expect(report.overallCompliance).toHaveProperty('score');
      expect(report.overallCompliance).toHaveProperty('status');
      expect(report.overallCompliance).toHaveProperty('criticalViolations');
    });

    test('should generate localized reports', async () => {
      const enReport = await complianceEngine.generateComplianceReport({ locale: 'en' });
      const esReport = await complianceEngine.generateComplianceReport({ locale: 'es' });
      
      expect(enReport.locale).toBe('en');
      expect(esReport.locale).toBe('es');
    });

    test('should calculate framework requirements', () => {
      const gdprRequirements = complianceEngine.getFrameworkRequirements('gdpr');
      
      expect(gdprRequirements).toContain('User Consent Management');
      expect(gdprRequirements).toContain('Data Processing Mapping');
      expect(gdprRequirements).toContain('Right to Erasure/Deletion');
      expect(gdprRequirements).toContain('Data Portability');
    });

    test('should calculate next audit dates', () => {
      const nextAuditDate = complianceEngine.calculateNextAuditDate('iso27001');
      const nextYear = new Date(new Date().getFullYear() + 1, new Date().getMonth(), new Date().getDate());
      
      expect(new Date(nextAuditDate).getFullYear()).toBe(nextYear.getFullYear());
    });
  });

  describe('Data Classification', () => {
    test('should have defined data classification levels', () => {
      expect(complianceEngine.dataClassification).toHaveProperty('public');
      expect(complianceEngine.dataClassification).toHaveProperty('internal');
      expect(complianceEngine.dataClassification).toHaveProperty('confidential');
      expect(complianceEngine.dataClassification).toHaveProperty('restricted');
      expect(complianceEngine.dataClassification).toHaveProperty('secret');
      
      expect(complianceEngine.dataClassification.secret.level).toBe(4);
      expect(complianceEngine.dataClassification.secret.encryption).toBe(true);
    });
  });

  describe('Event Emissions', () => {
    test('should emit audit events', (done) => {
      complianceEngine.on('auditEvent', (event) => {
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('timestamp');
        expect(event).toHaveProperty('type');
        expect(event).toHaveProperty('details');
        done();
      });

      complianceEngine.logAuditEvent('TEST_EVENT', { test: 'data' });
    });
  });
});
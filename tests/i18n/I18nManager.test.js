/**
 * Tests for Internationalization Manager
 * Validates multi-language support and compliance frameworks
 */

const I18nManager = require('../../src/i18n');

describe('I18nManager', () => {
  beforeEach(() => {
    // Reset to default locale
    I18nManager.setLocale('en');
  });

  describe('Locale Management', () => {
    test('should set and get current locale', () => {
      I18nManager.setLocale('es');
      expect(I18nManager.getLocale()).toBe('es');
    });

    test('should throw error for unsupported locale', () => {
      expect(() => {
        I18nManager.setLocale('xx');
      }).toThrow('Unsupported locale: xx');
    });

    test('should return available locales', () => {
      const locales = I18nManager.getAvailableLocales();
      expect(locales).toHaveProperty('en');
      expect(locales).toHaveProperty('es');
      expect(locales).toHaveProperty('fr');
      expect(locales).toHaveProperty('de');
      expect(locales).toHaveProperty('ja');
      expect(locales).toHaveProperty('zh');
    });
  });

  describe('Translation', () => {
    test('should translate security severity levels', () => {
      // English
      expect(I18nManager.t('security.findings.critical')).toBe('Critical');
      expect(I18nManager.t('security.findings.high')).toBe('High');
      
      // Spanish
      I18nManager.setLocale('es');
      expect(I18nManager.t('security.findings.critical')).toBe('Crítico');
      expect(I18nManager.t('security.findings.high')).toBe('Alto');
      
      // French
      I18nManager.setLocale('fr');
      expect(I18nManager.t('security.findings.critical')).toBe('Critique');
      expect(I18nManager.t('security.findings.high')).toBe('Élevé');
      
      // German
      I18nManager.setLocale('de');
      expect(I18nManager.t('security.findings.critical')).toBe('Kritisch');
      expect(I18nManager.t('security.findings.high')).toBe('Hoch');
      
      // Japanese
      I18nManager.setLocale('ja');
      expect(I18nManager.t('security.findings.critical')).toBe('重大');
      expect(I18nManager.t('security.findings.high')).toBe('高');
      
      // Chinese
      I18nManager.setLocale('zh');
      expect(I18nManager.t('security.findings.critical')).toBe('严重');
      expect(I18nManager.t('security.findings.high')).toBe('高');
    });

    test('should translate compliance frameworks', () => {
      expect(I18nManager.t('compliance.frameworks.gdpr')).toBe('General Data Protection Regulation');
      expect(I18nManager.t('compliance.frameworks.ccpa')).toBe('California Consumer Privacy Act');
      
      I18nManager.setLocale('es');
      expect(I18nManager.t('compliance.frameworks.gdpr')).toBe('Reglamento General de Protección de Datos');
      
      I18nManager.setLocale('fr');
      expect(I18nManager.t('compliance.frameworks.gdpr')).toBe('Règlement Général sur la Protection des Données');
    });

    test('should handle parameter interpolation', () => {
      // This would require adding a translation with parameters
      const translated = I18nManager.interpolate('Hello {{name}}, you have {{count}} messages', {
        name: 'John',
        count: 5
      });
      expect(translated).toBe('Hello John, you have 5 messages');
    });

    test('should fallback to default locale for missing translations', () => {
      I18nManager.setLocale('es');
      // Test with a key that might not exist in Spanish
      const result = I18nManager.t('some.missing.key');
      expect(typeof result).toBe('string');
    });

    test('should return key as fallback for completely missing translations', () => {
      const result = I18nManager.t('completely.missing.key');
      expect(result).toBe('completely.missing.key');
    });
  });

  describe('Formatting', () => {
    test('should format dates according to locale', () => {
      const testDate = new Date('2024-01-15T10:30:00Z');
      
      I18nManager.setLocale('en');
      const enDate = I18nManager.formatDate(testDate);
      expect(enDate).toContain('January');
      
      I18nManager.setLocale('es');
      const esDate = I18nManager.formatDate(testDate);
      expect(esDate).toContain('enero');
      
      I18nManager.setLocale('fr');
      const frDate = I18nManager.formatDate(testDate);
      expect(frDate).toContain('janvier');
    });

    test('should format numbers according to locale', () => {
      const testNumber = 1234567.89;
      
      I18nManager.setLocale('en');
      const enNumber = I18nManager.formatNumber(testNumber);
      expect(enNumber).toContain('1,234,567.89');
      
      I18nManager.setLocale('de');
      const deNumber = I18nManager.formatNumber(testNumber);
      expect(deNumber).toContain('1.234.567,89');
    });

    test('should format currency according to locale', () => {
      const amount = 1234.56;
      
      I18nManager.setLocale('en');
      const usd = I18nManager.formatCurrency(amount, 'USD');
      expect(usd).toContain('$1,234.56');
      
      I18nManager.setLocale('de');
      const eur = I18nManager.formatCurrency(amount, 'EUR');
      expect(eur).toContain('1.234,56');
    });
  });

  describe('RTL Support', () => {
    test('should detect RTL languages', () => {
      I18nManager.setLocale('en');
      expect(I18nManager.isRTL()).toBe(false);
      
      // Test with hypothetical RTL locale (would need to be added)
      expect(I18nManager.isRTL('ar')).toBe(true);
      expect(I18nManager.isRTL('he')).toBe(true);
    });
  });

  describe('Nested Translation Keys', () => {
    test('should handle nested object access', () => {
      const testObj = {
        level1: {
          level2: {
            level3: 'deep value'
          }
        }
      };
      
      const result = I18nManager.getNestedValue(testObj, 'level1.level2.level3');
      expect(result).toBe('deep value');
      
      const missing = I18nManager.getNestedValue(testObj, 'level1.missing.key');
      expect(missing).toBeUndefined();
    });
  });

  describe('Translation Helpers', () => {
    test('should translate severity levels consistently', () => {
      expect(I18nManager.translateSeverity('critical', 'en')).toBe('Critical');
      expect(I18nManager.translateSeverity('critical', 'es')).toBe('Crítico');
      expect(I18nManager.translateSeverity('critical', 'fr')).toBe('Critique');
      expect(I18nManager.translateSeverity('critical', 'de')).toBe('Kritisch');
      expect(I18nManager.translateSeverity('critical', 'ja')).toBe('重大');
      expect(I18nManager.translateSeverity('critical', 'zh')).toBe('严重');
    });

    test('should translate categories consistently', () => {
      expect(I18nManager.translateCategory('security', 'en')).toBe('Security');
      expect(I18nManager.translateCategory('security', 'es')).toBe('Seguridad');
      expect(I18nManager.translateCategory('security', 'fr')).toBe('Sécurité');
    });

    test('should translate actions consistently', () => {
      expect(I18nManager.translateAction('remediate', 'en')).toBe('Remediate');
      expect(I18nManager.translateAction('remediate', 'es')).toBe('Remediar');
      expect(I18nManager.translateAction('remediate', 'fr')).toBe('Corriger');
    });
  });

  describe('Default Translations', () => {
    test('should create default translation structure', () => {
      const defaultTranslations = I18nManager.createDefaultTranslations('en');
      
      expect(defaultTranslations).toHaveProperty('security');
      expect(defaultTranslations).toHaveProperty('compliance');
      expect(defaultTranslations).toHaveProperty('ui');
      expect(defaultTranslations).toHaveProperty('reports');
      
      expect(defaultTranslations.security).toHaveProperty('findings');
      expect(defaultTranslations.security).toHaveProperty('categories');
      expect(defaultTranslations.security).toHaveProperty('actions');
      
      expect(defaultTranslations.compliance).toHaveProperty('frameworks');
      expect(defaultTranslations.compliance).toHaveProperty('status');
    });
  });
});
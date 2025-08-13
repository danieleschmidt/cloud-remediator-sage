/**
 * Internationalization (i18n) Manager
 * Supports multi-language security findings and compliance reporting
 * Languages: English, Spanish, French, German, Japanese, Chinese
 */

const path = require('path');
const fs = require('fs');

class I18nManager {
  constructor(defaultLocale = 'en') {
    this.defaultLocale = defaultLocale;
    this.currentLocale = defaultLocale;
    this.translations = new Map();
    this.loadedLocales = new Set();
    
    // Supported locales with region variants
    this.supportedLocales = {
      'en': 'English',
      'en-US': 'English (United States)',
      'en-GB': 'English (United Kingdom)',
      'es': 'Español',
      'es-ES': 'Español (España)',
      'es-MX': 'Español (México)',
      'fr': 'Français',
      'fr-FR': 'Français (France)',
      'fr-CA': 'Français (Canada)',
      'de': 'Deutsch',
      'de-DE': 'Deutsch (Deutschland)',
      'de-AT': 'Deutsch (Österreich)',
      'ja': '日本語',
      'ja-JP': '日本語 (日本)',
      'zh': '中文',
      'zh-CN': '中文 (简体)',
      'zh-TW': '中文 (繁體)'
    };
    
    // Compliance framework translations
    this.complianceFrameworks = {
      'gdpr': 'General Data Protection Regulation',
      'ccpa': 'California Consumer Privacy Act',
      'pdpa': 'Personal Data Protection Act',
      'sox': 'Sarbanes-Oxley Act',
      'pci-dss': 'Payment Card Industry Data Security Standard',
      'hipaa': 'Health Insurance Portability and Accountability Act',
      'iso27001': 'ISO/IEC 27001',
      'nist': 'NIST Cybersecurity Framework'
    };
    
    this.loadDefaultTranslations();
  }

  /**
   * Load default translations for all supported locales
   */
  loadDefaultTranslations() {
    // Load base translations for each locale
    for (const locale of Object.keys(this.supportedLocales)) {
      this.loadTranslationsForLocale(locale);
    }
  }

  /**
   * Load translations for a specific locale
   */
  loadTranslationsForLocale(locale) {
    if (this.loadedLocales.has(locale)) {
      return;
    }

    try {
      const translationPath = path.join(__dirname, 'locales', `${locale}.json`);
      if (fs.existsSync(translationPath)) {
        const translations = JSON.parse(fs.readFileSync(translationPath, 'utf8'));
        this.translations.set(locale, translations);
      } else {
        // Create default translation structure
        this.translations.set(locale, this.createDefaultTranslations(locale));
      }
      
      this.loadedLocales.add(locale);
    } catch (error) {
      console.warn(`Failed to load translations for locale ${locale}:`, error.message);
      // Fallback to default locale
      if (locale !== this.defaultLocale) {
        this.translations.set(locale, this.translations.get(this.defaultLocale) || {});
      }
    }
  }

  /**
   * Create default translations for a locale
   */
  createDefaultTranslations(locale) {
    const baseTranslations = {
      security: {
        findings: {
          critical: this.translateSeverity('critical', locale),
          high: this.translateSeverity('high', locale),
          medium: this.translateSeverity('medium', locale),
          low: this.translateSeverity('low', locale),
          info: this.translateSeverity('info', locale)
        },
        categories: {
          security: this.translateCategory('security', locale),
          compliance: this.translateCategory('compliance', locale),
          configuration: this.translateCategory('configuration', locale)
        },
        actions: {
          remediate: this.translateAction('remediate', locale),
          investigate: this.translateAction('investigate', locale),
          monitor: this.translateAction('monitor', locale),
          ignore: this.translateAction('ignore', locale)
        }
      },
      compliance: {
        frameworks: {},
        status: {
          compliant: this.translateComplianceStatus('compliant', locale),
          'non-compliant': this.translateComplianceStatus('non-compliant', locale),
          'not-applicable': this.translateComplianceStatus('not-applicable', locale)
        }
      },
      ui: {
        common: {
          yes: this.translateCommon('yes', locale),
          no: this.translateCommon('no', locale),
          loading: this.translateCommon('loading', locale),
          error: this.translateCommon('error', locale),
          success: this.translateCommon('success', locale)
        }
      },
      reports: {
        titles: {
          executive_summary: this.translateReportTitle('executive_summary', locale),
          risk_assessment: this.translateReportTitle('risk_assessment', locale),
          compliance_report: this.translateReportTitle('compliance_report', locale)
        }
      }
    };

    // Add compliance framework translations
    for (const [key, value] of Object.entries(this.complianceFrameworks)) {
      baseTranslations.compliance.frameworks[key] = this.translateComplianceFramework(key, locale);
    }

    return baseTranslations;
  }

  /**
   * Set current locale
   */
  setLocale(locale) {
    if (!this.supportedLocales[locale]) {
      throw new Error(`Unsupported locale: ${locale}`);
    }
    
    this.currentLocale = locale;
    this.loadTranslationsForLocale(locale);
  }

  /**
   * Get current locale
   */
  getLocale() {
    return this.currentLocale;
  }

  /**
   * Get available locales
   */
  getAvailableLocales() {
    return this.supportedLocales;
  }

  /**
   * Translate a key with optional parameters
   */
  t(key, params = {}, locale = null) {
    const targetLocale = locale || this.currentLocale;
    const translations = this.translations.get(targetLocale) || this.translations.get(this.defaultLocale) || {};
    
    let translation = this.getNestedValue(translations, key);
    
    if (!translation) {
      // Fallback to default locale
      const defaultTranslations = this.translations.get(this.defaultLocale) || {};
      translation = this.getNestedValue(defaultTranslations, key);
    }
    
    if (!translation) {
      console.warn(`Translation missing for key: ${key} in locale: ${targetLocale}`);
      return key; // Return key as fallback
    }
    
    // Replace parameters
    return this.interpolate(translation, params);
  }

  /**
   * Get nested value from object using dot notation
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }

  /**
   * Interpolate parameters into translation string
   */
  interpolate(template, params) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return Object.prototype.hasOwnProperty.call(params, key) ? params[key] : match;
    });
  }

  /**
   * Format date according to locale
   */
  formatDate(date, locale = null) {
    const targetLocale = locale || this.currentLocale;
    const options = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    
    return new Intl.DateTimeFormat(targetLocale, options).format(new Date(date));
  }

  /**
   * Format number according to locale
   */
  formatNumber(number, locale = null) {
    const targetLocale = locale || this.currentLocale;
    return new Intl.NumberFormat(targetLocale).format(number);
  }

  /**
   * Format currency according to locale
   */
  formatCurrency(amount, currency = 'USD', locale = null) {
    const targetLocale = locale || this.currentLocale;
    return new Intl.NumberFormat(targetLocale, {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  /**
   * Get RTL (Right-to-Left) languages
   */
  isRTL(locale = null) {
    const targetLocale = locale || this.currentLocale;
    const rtlLocales = ['ar', 'he', 'fa', 'ur'];
    return rtlLocales.some(rtl => targetLocale.startsWith(rtl));
  }

  // Translation helpers for different categories
  translateSeverity(severity, locale) {
    const translations = {
      en: { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', info: 'Info' },
      es: { critical: 'Crítico', high: 'Alto', medium: 'Medio', low: 'Bajo', info: 'Info' },
      fr: { critical: 'Critique', high: 'Élevé', medium: 'Moyen', low: 'Faible', info: 'Info' },
      de: { critical: 'Kritisch', high: 'Hoch', medium: 'Mittel', low: 'Niedrig', info: 'Info' },
      ja: { critical: '重大', high: '高', medium: '中', low: '低', info: '情報' },
      zh: { critical: '严重', high: '高', medium: '中', low: '低', info: '信息' }
    };
    
    const baseLocale = locale.split('-')[0];
    return translations[baseLocale]?.[severity] || translations.en[severity];
  }

  translateCategory(category, locale) {
    const translations = {
      en: { security: 'Security', compliance: 'Compliance', configuration: 'Configuration' },
      es: { security: 'Seguridad', compliance: 'Cumplimiento', configuration: 'Configuración' },
      fr: { security: 'Sécurité', compliance: 'Conformité', configuration: 'Configuration' },
      de: { security: 'Sicherheit', compliance: 'Compliance', configuration: 'Konfiguration' },
      ja: { security: 'セキュリティ', compliance: 'コンプライアンス', configuration: '設定' },
      zh: { security: '安全', compliance: '合规', configuration: '配置' }
    };
    
    const baseLocale = locale.split('-')[0];
    return translations[baseLocale]?.[category] || translations.en[category];
  }

  translateAction(action, locale) {
    const translations = {
      en: { remediate: 'Remediate', investigate: 'Investigate', monitor: 'Monitor', ignore: 'Ignore' },
      es: { remediate: 'Remediar', investigate: 'Investigar', monitor: 'Monitorear', ignore: 'Ignorar' },
      fr: { remediate: 'Corriger', investigate: 'Enquêter', monitor: 'Surveiller', ignore: 'Ignorer' },
      de: { remediate: 'Beheben', investigate: 'Untersuchen', monitor: 'Überwachen', ignore: 'Ignorieren' },
      ja: { remediate: '修復', investigate: '調査', monitor: '監視', ignore: '無視' },
      zh: { remediate: '修复', investigate: '调查', monitor: '监控', ignore: '忽略' }
    };
    
    const baseLocale = locale.split('-')[0];
    return translations[baseLocale]?.[action] || translations.en[action];
  }

  translateComplianceStatus(status, locale) {
    const translations = {
      en: { compliant: 'Compliant', 'non-compliant': 'Non-Compliant', 'not-applicable': 'Not Applicable' },
      es: { compliant: 'Conforme', 'non-compliant': 'No Conforme', 'not-applicable': 'No Aplicable' },
      fr: { compliant: 'Conforme', 'non-compliant': 'Non Conforme', 'not-applicable': 'Non Applicable' },
      de: { compliant: 'Konform', 'non-compliant': 'Nicht Konform', 'not-applicable': 'Nicht Zutreffend' },
      ja: { compliant: '準拠', 'non-compliant': '非準拠', 'not-applicable': '該当なし' },
      zh: { compliant: '合规', 'non-compliant': '不合规', 'not-applicable': '不适用' }
    };
    
    const baseLocale = locale.split('-')[0];
    return translations[baseLocale]?.[status] || translations.en[status];
  }

  translateComplianceFramework(framework, locale) {
    // For now, return English names as they are standard
    // In real implementation, some frameworks have localized names
    return this.complianceFrameworks[framework] || framework;
  }

  translateCommon(key, locale) {
    const translations = {
      en: { yes: 'Yes', no: 'No', loading: 'Loading...', error: 'Error', success: 'Success' },
      es: { yes: 'Sí', no: 'No', loading: 'Cargando...', error: 'Error', success: 'Éxito' },
      fr: { yes: 'Oui', no: 'Non', loading: 'Chargement...', error: 'Erreur', success: 'Succès' },
      de: { yes: 'Ja', no: 'Nein', loading: 'Laden...', error: 'Fehler', success: 'Erfolg' },
      ja: { yes: 'はい', no: 'いいえ', loading: '読み込み中...', error: 'エラー', success: '成功' },
      zh: { yes: '是', no: '否', loading: '加载中...', error: '错误', success: '成功' }
    };
    
    const baseLocale = locale.split('-')[0];
    return translations[baseLocale]?.[key] || translations.en[key];
  }

  translateReportTitle(title, locale) {
    const translations = {
      en: { 
        executive_summary: 'Executive Summary', 
        risk_assessment: 'Risk Assessment', 
        compliance_report: 'Compliance Report' 
      },
      es: { 
        executive_summary: 'Resumen Ejecutivo', 
        risk_assessment: 'Evaluación de Riesgos', 
        compliance_report: 'Informe de Cumplimiento' 
      },
      fr: { 
        executive_summary: 'Résumé Exécutif', 
        risk_assessment: 'Évaluation des Risques', 
        compliance_report: 'Rapport de Conformité' 
      },
      de: { 
        executive_summary: 'Zusammenfassung', 
        risk_assessment: 'Risikobewertung', 
        compliance_report: 'Compliance-Bericht' 
      },
      ja: { 
        executive_summary: 'エグゼクティブサマリー', 
        risk_assessment: 'リスク評価', 
        compliance_report: 'コンプライアンスレポート' 
      },
      zh: { 
        executive_summary: '执行摘要', 
        risk_assessment: '风险评估', 
        compliance_report: '合规报告' 
      }
    };
    
    const baseLocale = locale.split('-')[0];
    return translations[baseLocale]?.[title] || translations.en[title];
  }
}

// Export singleton instance
module.exports = new I18nManager();
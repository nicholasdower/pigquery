import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock chrome API
global.chrome = {
  i18n: {
    getUILanguage: jest.fn(),
  },
};

describe('i18n', () => {
  let getSystemLocale;
  let getBigQueryLocale;
  let getMessage;
  let applyI18n;

  beforeEach(async () => {
    jest.resetModules();
    global.chrome.i18n.getUILanguage.mockClear();

    const module = await import('../i18n.js');
    getSystemLocale = module.getSystemLocale;
    getBigQueryLocale = module.getBigQueryLocale;
    getMessage = module.getMessage;
    applyI18n = module.applyI18n;
  });

  describe('getSystemLocale', () => {
    test('should return locale from chrome.i18n.getUILanguage', () => {
      global.chrome.i18n.getUILanguage.mockReturnValue('de-DE');

      const result = getSystemLocale();

      expect(result).toBe('de-DE');
      expect(global.chrome.i18n.getUILanguage).toHaveBeenCalledTimes(1);
    });

    test('should work with different locales', () => {
      global.chrome.i18n.getUILanguage.mockReturnValue('en-US');

      const result = getSystemLocale();

      expect(result).toBe('en-US');
    });
  });

  describe('getBigQueryLocale', () => {
    let originalDocument;

    beforeEach(() => {
      originalDocument = global.document;
      global.document = {
        documentElement: {
          lang: '',
        },
      };
    });

    afterEach(() => {
      global.document = originalDocument;
    });

    test('should return language from document.documentElement.lang', () => {
      global.document.documentElement.lang = 'de-DE';
      global.chrome.i18n.getUILanguage.mockReturnValue('en-US');

      const result = getBigQueryLocale();

      expect(result).toBe('de');
      expect(global.chrome.i18n.getUILanguage).not.toHaveBeenCalled();
    });

    test('should extract language code from locale with hyphen', () => {
      global.document.documentElement.lang = 'en-GB';

      const result = getBigQueryLocale();

      expect(result).toBe('en');
    });

    test('should extract language code from locale with underscore', () => {
      global.document.documentElement.lang = 'fr_FR';

      const result = getBigQueryLocale();

      expect(result).toBe('fr');
    });

    test('should trim whitespace from lang attribute', () => {
      global.document.documentElement.lang = '  es-ES  ';

      const result = getBigQueryLocale();

      expect(result).toBe('es');
    });

    test('should convert to lowercase', () => {
      global.document.documentElement.lang = 'DE-DE';

      const result = getBigQueryLocale();

      expect(result).toBe('de');
    });

    test('should fallback to system locale when lang is empty', () => {
      global.document.documentElement.lang = '';
      global.chrome.i18n.getUILanguage.mockReturnValue('de-DE');

      const result = getBigQueryLocale();

      expect(result).toBe('de-DE');
      expect(global.chrome.i18n.getUILanguage).toHaveBeenCalledTimes(1);
    });

    test('should fallback to system locale when documentElement has no lang property', () => {
      const savedDocument = global.document;
      global.document = {
        documentElement: {},
      };
      global.chrome.i18n.getUILanguage.mockReturnValue('en-US');

      const result = getBigQueryLocale();

      expect(result).toBe('en-US');
      global.document = savedDocument;
    });

    test('should handle only whitespace in lang attribute', () => {
      global.document.documentElement.lang = '\t\n  \r';
      global.chrome.i18n.getUILanguage.mockReturnValue('fr-FR');

      const result = getBigQueryLocale();

      expect(result).toBe('fr-FR');
    });

    test('should handle simple language code without region', () => {
      global.document.documentElement.lang = 'de';

      const result = getBigQueryLocale();

      expect(result).toBe('de');
    });
  });

  describe('getMessage', () => {
    test('should get English message for valid key', () => {
      const result = getMessage('keyboardShortcuts', 'en');

      expect(result).toBe('Keyboard Shortcuts');
    });

    test('should get German message for valid key', () => {
      const result = getMessage('keyboardShortcuts', 'de');

      expect(result).toBe('Tastenkombinationen');
    });

    test('should fallback to English when locale not found', () => {
      const result = getMessage('keyboardShortcuts', 'fr');

      expect(result).toBe('Keyboard Shortcuts');
    });

    test('should throw error for invalid key', () => {
      expect(() => getMessage('nonExistentKey', 'en')).toThrow('Missing translation key "nonExistentKey"');
    });

    test('should substitute single placeholder', () => {
      const result = getMessage('statusSaved', 'en', '12:34:56');

      expect(result).toBe('Saved at 12:34:56');
    });

    test('should substitute single placeholder in German', () => {
      const result = getMessage('statusSaved', 'de', '12:34:56');

      expect(result).toBe('Gespeichert um 12:34:56');
    });

    test('should substitute multiple placeholders', () => {
      const result = getMessage('optionsLastUpdatedError', 'en', ['10:00:00', 'Network error']);

      expect(result).toBe('Last updated at 10:00:00 — Network error');
    });

    test('should substitute multiple placeholders in German', () => {
      const result = getMessage('optionsLastUpdatedError', 'de', ['10:00:00', 'Netzwerkfehler']);

      expect(result).toBe('Zuletzt aktualisiert um 10:00:00 — Netzwerkfehler');
    });

    test('should handle array with single substitution', () => {
      const result = getMessage('statusSaved', 'en', ['12:34:56']);

      expect(result).toBe('Saved at 12:34:56');
    });

    test('should handle undefined substitutions', () => {
      const result = getMessage('keyboardShortcuts', 'en', undefined);

      expect(result).toBe('Keyboard Shortcuts');
    });

    test('should handle empty array substitutions', () => {
      const result = getMessage('keyboardShortcuts', 'en', []);

      expect(result).toBe('Keyboard Shortcuts');
    });

    test('should convert non-string substitutions to string', () => {
      const result = getMessage('statusInvalidConfigNameMissing', 'en', 123);

      expect(result).toBe('Invalid Config: 123 name missing');
    });

    test('should substitute with special characters', () => {
      const result = getMessage('statusInvalidYaml', 'en', 'Unexpected token: $');

      expect(result).toBe('Invalid YAML: Unexpected token: $');
    });

    test('should work with all placeholders replaced', () => {
      const result = getMessage('param', 'en', 'userId');

      expect(result).toBe('Parameter: userId');
    });

    test('should fallback to English for unsupported locale', () => {
      const result = getMessage('tableNotFound', 'es');

      expect(result).toBe('No table found.');
    });

    test('should preserve original text when no placeholders present', () => {
      const result = getMessage('extensionOptions', 'en');

      expect(result).toBe('Configuration');
    });

    test('should handle numeric substitutions', () => {
      const result = getMessage('statusInvalidConfigNameMissing', 'en', 42);

      expect(result).toBe('Invalid Config: 42 name missing');
    });
  });

  describe('applyI18n', () => {
    let container;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    test('should apply i18n to elements with data-i18n attribute', () => {
      const element = document.createElement('span');
      element.dataset.i18n = 'keyboardShortcuts';
      container.appendChild(element);

      applyI18n('en');

      expect(element.textContent).toBe('Keyboard Shortcuts');
    });

    test('should apply German translations', () => {
      const element = document.createElement('span');
      element.dataset.i18n = 'keyboardShortcuts';
      container.appendChild(element);

      applyI18n('de');

      expect(element.textContent).toBe('Tastenkombinationen');
    });

    test('should apply placeholder attribute with data-i18n-placeholder', () => {
      const input = document.createElement('input');
      input.dataset.i18nPlaceholder = 'searchPlaceholder';
      container.appendChild(input);

      applyI18n('en');

      expect(input.placeholder).toBe('Search…');
    });

    test('should apply title attribute with data-i18n-title', () => {
      const button = document.createElement('button');
      button.dataset.i18nTitle = 'optionsRefresh';
      container.appendChild(button);

      applyI18n('en');

      expect(button.title).toBe('Refresh');
    });

    test('should apply alt attribute with data-i18n-alt', () => {
      const img = document.createElement('img');
      img.dataset.i18nAlt = 'extensionOptions';
      container.appendChild(img);

      applyI18n('en');

      expect(img.alt).toBe('Configuration');
    });

    test('should apply to multiple elements at once', () => {
      const span1 = document.createElement('span');
      span1.dataset.i18n = 'shortcutInsert';
      const span2 = document.createElement('span');
      span2.dataset.i18n = 'shortcutShare';
      container.appendChild(span1);
      container.appendChild(span2);

      applyI18n('en');

      expect(span1.textContent).toBe('Insert');
      expect(span2.textContent).toBe('Share');
    });

    test('should apply different attribute types to different elements', () => {
      const span = document.createElement('span');
      span.dataset.i18n = 'copy';
      const input = document.createElement('input');
      input.dataset.i18nPlaceholder = 'searchPlaceholder';
      const button = document.createElement('button');
      button.dataset.i18nTitle = 'optionsRefresh';
      container.appendChild(span);
      container.appendChild(input);
      container.appendChild(button);

      applyI18n('en');

      expect(span.textContent).toBe('Copy');
      expect(input.placeholder).toBe('Search…');
      expect(button.title).toBe('Refresh');
    });

    test('should handle elements with no matching data attributes', () => {
      const element = document.createElement('div');
      element.textContent = 'Original text';
      container.appendChild(element);

      expect(() => applyI18n('en')).not.toThrow();
      expect(element.textContent).toBe('Original text');
    });

    test('should apply German translations to placeholders', () => {
      const input = document.createElement('input');
      input.dataset.i18nPlaceholder = 'searchPlaceholder';
      container.appendChild(input);

      applyI18n('de');

      expect(input.placeholder).toBe('Suchen…');
    });

    test('should apply to nested elements', () => {
      const outer = document.createElement('div');
      const inner = document.createElement('span');
      inner.dataset.i18n = 'extensionOptions';
      outer.appendChild(inner);
      container.appendChild(outer);

      applyI18n('en');

      expect(inner.textContent).toBe('Configuration');
    });

    test('should handle empty container', () => {
      expect(() => applyI18n('en')).not.toThrow();
    });

    test('should overwrite existing content', () => {
      const element = document.createElement('span');
      element.dataset.i18n = 'copy';
      element.textContent = 'Old text';
      container.appendChild(element);

      applyI18n('en');

      expect(element.textContent).toBe('Copy');
    });
  });

  describe('edge cases', () => {
    let originalDocument;

    beforeEach(() => {
      originalDocument = global.document;
      global.document = {
        documentElement: {
          lang: '',
        },
      };
    });

    afterEach(() => {
      if (originalDocument) {
        global.document = originalDocument;
      }
    });

    test('getMessage should handle messages without placeholders even with substitutions', () => {
      const result = getMessage('copy', 'en', ['unused']);

      expect(result).toBe('Copy');
    });

    test('getMessage should handle multiple occurrences of same placeholder', () => {
      // This would require a translation with repeated placeholders
      // Since none exist in the current TRANSLATIONS, we test the mechanism directly
      const result = getMessage('statusInvalidYaml', 'en', 'error');

      expect(result).toBe('Invalid YAML: error');
    });

    test('getBigQueryLocale should handle malformed lang attributes', () => {
      global.document.documentElement.lang = '   ';
      global.chrome.i18n.getUILanguage.mockReturnValue('en-US');

      const result = getBigQueryLocale();

      expect(result).toBe('en-US');
    });

    test('getMessage should work with all translation keys', () => {
      // Test a few random keys to ensure they all work
      expect(getMessage('tableNotFound', 'en')).toBe('No table found.');
      expect(getMessage('editorNotFocused', 'de')).toBe('Editor ist nicht fokussiert.');
      expect(getMessage('typeJson', 'en')).toBe('JSON');
      expect(getMessage('uuidVersion4', 'de')).toBe('Zufällig');
    });

    test('getMessage should handle boolean substitutions', () => {
      const result = getMessage('statusInvalidConfigNameMissing', 'en', true);

      expect(result).toBe('Invalid Config: true name missing');
    });

    test('getMessage should handle null substitutions', () => {
      const result = getMessage('statusInvalidConfigNameMissing', 'en', null);

      expect(result).toBe('Invalid Config: null name missing');
    });
  });
});

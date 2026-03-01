import * as i18n from '../i18n.js';

const BASE64_REGEX = /^[A-Za-z0-9+/_-]+=*$/;

export class Base64 {
  #locale;

  constructor(locale) { this.#locale = locale; }

  get name() { return 'Base64'; }
  get group() { return 'Formatters'; }

  match(value) {
    if (!BASE64_REGEX.test(value)) return false;
    if (!/[a-z]/.test(value) || !/[A-Z0-9]/.test(value)) return false;

    try {
      const standard = value.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = atob(standard);
      const printableRatio =
        decoded.split('').filter(c => {
          const code = c.charCodeAt(0);
          return (code >= 32 && code < 127) || code === 9 || code === 10 || code === 13;
        }).length / decoded.length;
      return printableRatio >= 0.9;
    } catch {
      return false;
    }
  }

  url() { return null; }

  preview(content) {
    try {
      const standard = content.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = atob(standard);

      const typeName = i18n.getMessage('typeBase64', this.#locale);
      const label = i18n.getMessage('decoded', this.#locale);
      return [{ label: `${typeName} – ${label}`, value: decoded, type: 'text' }];
    } catch {
      return [];
    }
  }
}

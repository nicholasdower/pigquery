import * as i18n from '../i18n.js';

export class Json {
  #locale;

  constructor(locale) {
    this.#locale = locale;
  }

  get name() {
    return i18n.getMessage('typeJson', this.#locale);
  }
  get group() {
    return 'Default';
  }
  get tag() {
    return 'formatter';
  }
  isDefault() {
    return true;
  }

  match(value) {
    if (!value.startsWith('{') && !value.startsWith('[')) return false;
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }

  url() {
    return null;
  }

  preview(content) {
    try {
      const parsed = JSON.parse(content);
      const formatted = JSON.stringify(parsed, null, 2);
      if (formatted !== content) {
        const typeName = i18n.getMessage('typeJson', this.#locale);
        const label = i18n.getMessage('formatted', this.#locale);
        return [{ label: `${typeName} – ${label}`, value: formatted, type: 'json' }];
      }
      return [];
    } catch {
      return [];
    }
  }
}

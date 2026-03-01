import * as i18n from '../i18n.js';

export class Url {
  #locale;

  constructor(locale) { this.#locale = locale; }

  get name() { return 'URL'; }
  get group() { return 'Formatters'; }

  match(value) {
    if (!value.startsWith('http://') && !value.startsWith('https://')) return false;
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  url() { return null; }

  preview(content) {
    try {
      const parsed = new URL(content);
      const locale = this.#locale;
      const typeName = i18n.getMessage('typeUrl', locale);

      const items = [
        { label: `${typeName} – ${i18n.getMessage('protocol', locale)}`, value: parsed.protocol.replace(':', '') },
        { label: `${typeName} – ${i18n.getMessage('host', locale)}`, value: parsed.host },
      ];

      if (parsed.port)
        items.push({ label: `${typeName} – ${i18n.getMessage('port', locale)}`, value: parsed.port });
      if (parsed.pathname !== '/')
        items.push({ label: `${typeName} – ${i18n.getMessage('path', locale)}`, value: parsed.pathname });
      if (parsed.hash)
        items.push({ label: `${typeName} – ${i18n.getMessage('fragment', locale)}`, value: parsed.hash.slice(1) });

      if (parsed.searchParams.toString().length > 0) {
        for (const [key, value] of parsed.searchParams) {
          let displayValue = value;
          try {
            const decoded = decodeURIComponent(value);
            if (decoded !== value) displayValue = decoded;
          } catch {
            /* keep original */
          }
          items.push({ label: `${typeName} – ${i18n.getMessage('param', locale, key)}`, value: displayValue });
        }
      }

      return items;
    } catch {
      return [];
    }
  }
}

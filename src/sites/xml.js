import * as i18n from '../i18n.js';

const TAG_REGEX = /<[a-zA-Z][\w-]*[^>]*>/;

export class Xml {
  #locale;

  constructor(locale) {
    this.#locale = locale;
  }

  get name() {
    return i18n.getMessage('typeXml', this.#locale);
  }
  get group() {
    return 'Formatters';
  }
  isDefault() {
    return true;
  }

  match(value) {
    return value.startsWith('<') && TAG_REGEX.test(value);
  }

  url() {
    return null;
  }

  preview(content) {
    try {
      let formatted = '';
      let indent = 0;
      const indentStr = '  ';

      const tokens = content.match(/(<[^>]+>|[^<]+)/g);
      if (!tokens) return [];

      for (const token of tokens) {
        const trimmed = token.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('</')) {
          indent = Math.max(0, indent - 1);
          formatted += indentStr.repeat(indent) + trimmed + '\n';
        } else if (trimmed.startsWith('<') && trimmed.endsWith('/>')) {
          formatted += indentStr.repeat(indent) + trimmed + '\n';
        } else if (trimmed.startsWith('<?') || trimmed.startsWith('<!')) {
          formatted += trimmed + '\n';
        } else if (trimmed.startsWith('<')) {
          formatted += indentStr.repeat(indent) + trimmed + '\n';
          indent++;
        } else {
          formatted += indentStr.repeat(indent) + trimmed + '\n';
        }
      }

      formatted = formatted.trim();
      const typeName = i18n.getMessage('typeXml', this.#locale);
      const label = i18n.getMessage('formatted', this.#locale);
      return [{ label: `${typeName} – ${label}`, value: formatted, type: 'xml' }];
    } catch {
      return [];
    }
  }
}

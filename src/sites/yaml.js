import * as i18n from '../i18n.js';
import jsyaml from 'js-yaml';

const YAML_PATTERNS = [
  /^---/,
  /^\w+:/m,
  /^-\s+\w+:/m,
  /^-\s+[^-]/m,
];

export class Yaml {
  #locale;

  constructor(locale) { this.#locale = locale; }

  get name() { return i18n.getMessage('typeYaml', this.#locale); }
  get group() { return 'Formatters'; }
  isDefault() { return true; }

  match(value) {
    return this.preview(value).length > 0;
  }

  url() { return null; }

  preview(content) {
    if (!YAML_PATTERNS.some(p => p.test(content))) return [];
    if (content.startsWith('{') || content.startsWith('[') || content.startsWith('<')) return [];
    try {
      const parsed = jsyaml.load(content);
      if (typeof parsed !== 'object' || parsed === null) return [];
      const formatted = jsyaml.dump(parsed, { lineWidth: -1, noRefs: true }).trimEnd();
      const typeName = i18n.getMessage('typeYaml', this.#locale);
      const label = i18n.getMessage('formatted', this.#locale);
      return [{ label: `${typeName} – ${label}`, value: formatted, type: 'yaml' }];
    } catch {
      return [];
    }
  }
}

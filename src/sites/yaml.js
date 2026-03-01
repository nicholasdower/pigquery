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

  get name() { return 'YAML'; }
  get group() { return 'Formatters'; }

  match(value) {
    if (!YAML_PATTERNS.some(p => p.test(value))) return false;
    if (value.startsWith('{') || value.startsWith('[') || value.startsWith('<')) return false;
    try {
      const parsed = jsyaml.load(value);
      return typeof parsed === 'object' && parsed !== null;
    } catch {
      return false;
    }
  }

  url() { return null; }

  preview() {
    return [];
  }
}

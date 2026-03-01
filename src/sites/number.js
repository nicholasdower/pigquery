import * as i18n from '../i18n.js';

const NUMBER_REGEX = /^-?\d+(\.\d+)?$/;

function format(num, locale) {
  return Number.isInteger(num)
    ? num.toLocaleString(locale)
    : num.toLocaleString(locale, { maximumFractionDigits: 10 });
}

export class NumberFormat {
  #locale;

  constructor(locale) { this.#locale = locale; }

  get name() { return 'Number'; }
  get group() { return 'Formatters'; }

  match(value) {
    if (!NUMBER_REGEX.test(value)) return false;
    if (value.length >= 40 && value.length % 2 === 0 && /^\d+$/.test(value)) return false;
    const num = parseFloat(value);
    if (!isFinite(num)) return false;
    return format(num, this.#locale) !== value;
  }

  url() { return null; }

  preview(content) {
    const num = parseFloat(content);
    if (!isFinite(num)) return [];

    const formatted = format(num, this.#locale);
    if (formatted === content) return [];

    const typeName = i18n.getMessage('typeNumber', this.#locale);
    const label = i18n.getMessage('formatted', this.#locale);
    return [{ label: `${typeName} – ${label}`, value: formatted }];
  }
}

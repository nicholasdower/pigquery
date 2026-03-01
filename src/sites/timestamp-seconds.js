import * as i18n from '../i18n.js';
import { formatDate, formatDateLocalized } from './_helpers.js';

const NUMBER_REGEX = /^-?\d+(\.\d+)?$/;

export class TimestampSeconds {
  #locale;

  constructor(locale) { this.#locale = locale; }

  get name() { return 'Timestamp (s)'; }
  get group() { return 'Formatters'; }

  match(value) {
    if (!NUMBER_REGEX.test(value)) return false;
    if (value.length >= 40 && value.length % 2 === 0 && /^\d+$/.test(value)) return false;
    const num = parseFloat(value);
    if (!isFinite(num)) return false;
    if (!Number.isInteger(num) || num < 0) return false;
    return num <= 10000000000;
  }

  url() { return null; }

  preview(content) {
    const num = parseFloat(content);
    const locale = this.#locale;
    const typeName = i18n.getMessage('typeTimestampSeconds', locale);
    const date = new Date(num * 1000);

    return [
      { label: `${typeName} – ${i18n.getMessage('date', locale)}`, value: formatDate(date) },
      { label: `${typeName} – ${i18n.getMessage('dateLocalized', locale)}`, value: formatDateLocalized(date, locale) },
    ];
  }
}

import * as i18n from '../i18n.js';
import { formatDate, formatDateLocalized } from './_helpers.js';

const NUMBER_REGEX = /^-?\d+(\.\d+)?$/;

export class TimestampMilliseconds {
  #locale;

  constructor(locale) {
    this.#locale = locale;
  }

  get name() {
    return i18n.getMessage('typeTimestampMilliseconds', this.#locale);
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
    if (!NUMBER_REGEX.test(value)) return false;
    if (value.length >= 40 && value.length % 2 === 0 && /^\d+$/.test(value)) return false;
    const num = parseFloat(value);
    if (!isFinite(num)) return false;
    if (!Number.isInteger(num) || num < 0) return false;
    return num <= 10000000000000;
  }

  url() {
    return null;
  }

  preview(content) {
    const num = parseFloat(content);
    const locale = this.#locale;
    const typeName = i18n.getMessage('typeTimestampMilliseconds', locale);
    const date = new Date(num);

    return [
      { label: `${typeName} – ${i18n.getMessage('date', locale)}`, value: formatDate(date) },
      { label: `${typeName} – ${i18n.getMessage('dateLocalized', locale)}`, value: formatDateLocalized(date, locale) },
    ];
  }
}

import * as i18n from '../i18n.js';
import { formatDate, formatDateLocalized } from './_helpers.js';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_FULL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:\d{2})?)?$/;
const DATETIME_NO_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?$/;
const SQL_DATETIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?( UTC|[+-]\d{2}(:\d{2})?)?$/;
const RFC = /^[A-Za-z]{3},?\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s*(GMT|UTC|[+-]\d{4})?$/;

function normalize(text) {
  if (!SQL_DATETIME.test(text)) return text;
  let normalized = text.replace(' UTC', 'Z');
  normalized = normalized.replace(/([+-]\d{2})$/, '$1:00');
  normalized = normalized.replace(' ', 'T');
  return normalized;
}

export class DateFormat {
  #locale;

  constructor(locale) {
    this.#locale = locale;
  }

  get name() {
    return i18n.getMessage('typeDate', this.#locale);
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
    const isDateOnly = DATE_ONLY.test(value);
    const isDateTime =
      ISO_FULL.test(value) || DATETIME_NO_TZ.test(value) || SQL_DATETIME.test(value) || RFC.test(value);
    if (!isDateOnly && !isDateTime) return false;

    const date = new Date(normalize(value));
    if (isNaN(date.getTime())) return false;

    const year = date.getFullYear();
    return year >= 1900 && year <= 2200;
  }

  url() {
    return null;
  }

  preview(content) {
    const date = new Date(normalize(content));
    if (isNaN(date.getTime())) return [];

    const locale = this.#locale;
    const typeName = i18n.getMessage('typeDate', locale);
    const items = [];

    const isoDate = formatDate(date);
    if (isoDate !== content) {
      items.push({ label: `${typeName} – ${i18n.getMessage('date', locale)}`, value: isoDate });
    }

    items.push({
      label: `${typeName} – ${i18n.getMessage('dateLocalized', locale)}`,
      value: formatDateLocalized(date, locale),
    });
    items.push({
      label: `${typeName} – ${i18n.getMessage('milliseconds', locale)}`,
      value: String(date.getTime()),
    });

    return items;
  }
}

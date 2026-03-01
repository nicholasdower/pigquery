import * as i18n from '../i18n.js';

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-([1-5])[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

export class Uuid {
  #locale;

  constructor(locale) {
    this.#locale = locale;
  }

  get name() {
    return i18n.getMessage('typeUuid', this.#locale);
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
    return UUID_REGEX.test(value);
  }

  url() {
    return null;
  }

  preview(content) {
    const match = content.match(UUID_REGEX);
    if (!match) return [];

    const locale = this.#locale;
    const version = match[1];
    const versionNames = {
      1: i18n.getMessage('uuidVersion1', locale),
      2: i18n.getMessage('uuidVersion2', locale),
      3: i18n.getMessage('uuidVersion3', locale),
      4: i18n.getMessage('uuidVersion4', locale),
      5: i18n.getMessage('uuidVersion5', locale),
    };

    const typeName = i18n.getMessage('typeUuid', locale);
    return [
      {
        label: `${typeName} – ${i18n.getMessage('version', locale)}`,
        value: `${version} – ${versionNames[version] || i18n.getMessage('unknown', locale)}`,
      },
    ];
  }
}

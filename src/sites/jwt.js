import * as i18n from '../i18n.js';

const BASE64URL_PART = /^[A-Za-z0-9_-]+$/;

function decodeBase64Url(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return JSON.parse(atob(padded));
}

export class Jwt {
  #locale;

  constructor(locale) { this.#locale = locale; }

  get name() { return 'JWT'; }
  get group() { return 'Formatters'; }

  match(value) {
    const parts = value.split('.');
    if (parts.length !== 3) return false;
    if (!BASE64URL_PART.test(parts[0]) || !BASE64URL_PART.test(parts[1])) return false;

    try {
      const header = decodeBase64Url(parts[0]);
      return !!(header.alg || header.typ);
    } catch {
      return false;
    }
  }

  url() {
    return null;
  }

  preview(content) {
    const parts = content.split('.');

    try {
      const header = decodeBase64Url(parts[0]);
      const payload = decodeBase64Url(parts[1]);

      const locale = this.#locale;
      const typeName = i18n.getMessage('typeJwt', locale);
      const items = [
        {
          label: `${typeName} – ${i18n.getMessage('header', locale)}`,
          value: JSON.stringify(header, null, 2),
          type: 'json',
        },
        {
          label: `${typeName} – ${i18n.getMessage('payload', locale)}`,
          value: JSON.stringify(payload, null, 2),
          type: 'json',
        },
        {
          label: `${typeName} – ${i18n.getMessage('signature', locale)}`,
          value: parts[2],
        },
      ];

      if (payload.iat)
        items.push({
          label: `${typeName} – ${i18n.getMessage('issued', locale)}`,
          value: new Date(payload.iat * 1000).toISOString(),
        });
      if (payload.exp)
        items.push({
          label: `${typeName} – ${i18n.getMessage('expires', locale)}`,
          value: new Date(payload.exp * 1000).toISOString(),
        });
      if (payload.nbf)
        items.push({
          label: `${typeName} – ${i18n.getMessage('notBefore', locale)}`,
          value: new Date(payload.nbf * 1000).toISOString(),
        });

      return items;
    } catch {
      return [];
    }
  }
}

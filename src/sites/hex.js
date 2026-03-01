import * as i18n from '../i18n.js';

const HEX_REGEX = /^[0-9a-fA-F]+$/;

export class Hex {
  #locale;

  constructor(locale) {
    this.#locale = locale;
  }

  get name() {
    return i18n.getMessage('typeHex', this.#locale);
  }
  get group() {
    return 'Formatters';
  }
  isDefault() {
    return true;
  }

  match(value) {
    if (value.length < 20 || value.length % 2 !== 0) return false;
    return HEX_REGEX.test(value);
  }

  url() {
    return null;
  }

  preview(content) {
    const bytes = [];
    for (let i = 0; i < content.length; i += 2) {
      bytes.push(parseInt(content.slice(i, i + 2), 16));
    }

    const locale = this.#locale;
    const printable = bytes.every(b => (b >= 32 && b < 127) || b === 9 || b === 10 || b === 13);
    const items = [];

    if (printable) {
      const decoded = bytes.map(b => String.fromCharCode(b)).join('');
      const typeName = i18n.getMessage('typeHex', locale);
      const label = i18n.getMessage('decoded', locale);
      items.push({ label: `${typeName} – ${label}`, value: decoded, type: 'text' });
    } else {
      let hexDump = '';
      for (let i = 0; i < bytes.length; i += 16) {
        const chunk = bytes.slice(i, i + 16);
        const hex = chunk.map(b => b.toString(16).padStart(2, '0')).join(' ');
        const ascii = chunk.map(b => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('');
        hexDump += `${i.toString(16).padStart(4, '0')}  ${hex.padEnd(48)}  ${ascii}\n`;
      }
      const typeName = i18n.getMessage('typeHex', locale);
      items.push({ label: `${typeName} – ${i18n.getMessage('hexDump', locale)}`, value: hexDump.trim() });
    }

    return items;
  }
}

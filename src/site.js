export class Site {
  #name;
  #group;
  #url;
  #encode;
  #regex;
  #tag;
  #locale;

  constructor({ name, group, url, encode, regex, tag }, locale) {
    this.#name = name;
    this.#group = group;
    this.#url = url;
    this.#encode = encode;
    this.#regex = regex instanceof RegExp ? regex : new RegExp(regex);
    this.#tag = tag;
    this.#locale = locale;
  }

  get name() {
    return this.#name;
  }
  get group() {
    return this.#group;
  }
  get tag() {
    return this.#tag;
  }
  isDefault() {
    return false;
  }
  url(content) {
    return this.#url.replace('%s', this.#encode === false ? content : encodeURIComponent(content));
  }

  preview(content) {
    return [{ label: i18n.getMessage('site', this.#locale), value: this.url(content), type: 'text' }];
  }

  match(value) {
    return this.#regex.test(value);
  }
}

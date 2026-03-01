export class Site {
  #name;
  #group;
  #url;
  #encode;
  #regex;

  constructor({ name, group, url, encode, regex, tag }) {
    this.#name = name;
    this.#group = group;
    this.#url = url;
    this.#encode = encode;
    this.#regex = regex instanceof RegExp ? regex : new RegExp(regex);
    this.tag = tag;
  }

  get name() { return this.#name; }
  get group() { return this.#group; }
  isDefault() { return false; }
  url(content) { return this.#url.replace('%s', this.#encode === false ? content : encodeURIComponent(content)); }

  preview(content) {
    return [
      { label: 'Site', value: this.url(content), type: 'text' }
    ];
  }

  match(value) {
    return this.#regex.test(value);
  }
}

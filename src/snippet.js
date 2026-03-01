export class Snippet {
  #name;
  #group;
  #tag;
  #value;
  #locale;

  constructor({ name, group, tag, value }, locale) {
    this.#name = name;
    this.#group = group;
    this.#tag = tag;
    this.#value = value;
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
  get value() {
    return this.#value;
  }
  preview() {
    return [{ label: 'SQL', value: this.#value, type: 'sql' }];
  }
}

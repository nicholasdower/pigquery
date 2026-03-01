export class Snippet {
  #name;
  #group;
  #tag;
  #value;

  constructor({ name, group, tag, value }) {
    this.#name = name;
    this.#group = group;
    this.#tag = tag;
    this.#value = value;
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

const URL_REGEX = /^https?:\/\//;

export class OpenUrl {
  #locale;

  constructor(locale) { this.#locale = locale; }

  get name() { return 'Open URL'; }
  get group() { return 'Default'; }

  match(value) {
    return URL_REGEX.test(value);
  }

  url(content) {
    return content;
  }

  preview(content) {
    return [{ label: 'URL', value: content, type: 'text' }];
  }
}

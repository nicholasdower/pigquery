import * as i18n from './i18n.js';

export class Site {
  #name;
  #group;
  #url;
  #encode;
  #regex;
  #tag;
  #preview_url;
  #locale;

  constructor({ name, group, url, encode, regex, tag, preview_url }, locale) {
    this.#name = name;
    this.#group = group;
    this.#url = url;
    this.#encode = encode;
    this.#regex = regex instanceof RegExp ? regex : new RegExp(regex);
    this.#tag = tag;
    this.#preview_url = preview_url;
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

  #substituteContent(template, content) {
    return template.replace('%s', this.#encode === false ? content : encodeURIComponent(content));
  }

  preview(content) {
    if (!this.#preview_url) {
      return [{ label: i18n.getMessage('site', this.#locale), value: this.url(content), type: 'text' }];
    }

    const previewUrl = this.#substituteContent(this.#preview_url, content);
    const origin = new URL(previewUrl).origin + '/*';

    const name = this.#name;
    return chrome.runtime
      .sendMessage({
        action: 'fetchPreview',
        origin,
        url: previewUrl,
      })
      .then(result => {
        if (!result?.ok) return [];
        return [{ label: name, value: result.text, type: 'text' }];
      });
  }

  match(value) {
    return this.#regex.test(value);
  }
}

window.DEFAULT_CONFIG = {
  snippets: [
    {
      name: "shakespeare",
      tag: "table",
      value: "`bigquery-public-data.samples.shakespeare` s",
    },
    {
      name: "wikipedia",
      tag: "table",
      value: "`bigquery-public-data.samples.wikipedia` w",
    },
    {
      name: "shakespeare pigs",
      tag: "query",
      value: "select\n  word,\n  word_count,\n  corpus,\n  corpus_date\nfrom `bigquery-public-data.samples.shakespeare` s\nwhere word like '%pig%'\nlimit 100;",
    },
    {
      name: "wikipedia pigs",
      tag: "query",
      value: "select\n  *\nfrom `bigquery-public-data.samples.wikipedia` w\nwhere title like '%pig%'\nlimit 100;",
    }
  ],
  sites: [
    {
      name: "Google",
      regex: '^.*$',
      url: "https://www.google.com/search?q=%s",
    },
    {
      name: "Dict.cc",
      regex: '^.*$',
      url: "https://www.dict.cc/?s=%s",
    },
    {
      name: "Wikipedia",
      regex: '^.*$',
      url: "https://en.wikipedia.org/w/index.php?search=%s",
    },
  ]
};

function setMessage(element, key, attribute) {
  const message = chrome.i18n.getMessage(key);
  if (message) element[attribute] = message;
}

window.applyI18n = function() {
  document.querySelectorAll('[data-i18n]').forEach((element) => setMessage(element, element.dataset.i18n, "textContent"));
  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => setMessage(element, element.dataset['i18nPlaceholder'], "placeholder"));
  document.querySelectorAll('[data-i18n-title]').forEach((element) => setMessage(element, element.dataset['i18nTitle'], "title"));
  document.querySelectorAll('[data-i18n-alt]').forEach((element) => setMessage(element, element.dataset['i18nAlt'], "alt"));
};
const DEFAULT_CONFIG = {
  snippets: [
    {
      group: "samples",
      name: "shakespeare",
      tag: "table",
      value: "`bigquery-public-data.samples.shakespeare` s",
    },
    {
      group: "wikipedia",
      name: "wikipedia",
      tag: "table",
      value: "`bigquery-public-data.samples.wikipedia` w",
    },
    {
      group: "shakespeare",
      name: "shakespeare pigs",
      tag: "query",
      value: "select\n  word,\n  word_count,\n  corpus,\n  corpus_date\nfrom `bigquery-public-data.samples.shakespeare` s\nwhere word like '%pig%'\nlimit 100;",
    },
    {
      group: "wikipedia",
      name: "wikipedia pigs",
      tag: "query",
      value: "select\n  *\nfrom `bigquery-public-data.samples.wikipedia` w\nwhere title like '%pig%'\nlimit 100;",
    }
  ],
  sites: [
    {
      group: "common",
      name: "Google",
      regex: '^.*$',
      url: "https://www.google.com/search?q=%s",
    },
    {
      group: "shakespeare",
      name: "Dict.cc",
      regex: '^.*$',
      url: "https://www.dict.cc/?s=%s",
    },
    {
      group: "wikipedia",
      name: "Wikipedia",
      regex: '^.*$',
      url: "https://en.wikipedia.org/w/index.php?search=%s",
    },
  ]
};

function defaultConfig() {
  return DEFAULT_CONFIG;
}

window.pigquery ||= {};
window.pigquery.common = {
  defaultConfig,
};
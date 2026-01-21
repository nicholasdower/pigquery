const DEFAULT_CONFIG = [
  {
    type: "snippet",
    group: "samples",
    name: "shakespeare",
    tag: "table",
    value: "`bigquery-public-data.samples.shakespeare` s",
  },
  {
    type: "snippet",
    group: "wikipedia",
    name: "wikipedia",
    tag: "table",
    value: "`bigquery-public-data.samples.wikipedia` w",
  },
  {
    type: "snippet",
    group: "shakespeare",
    name: "shakespeare pigs",
    tag: "query",
    value: "select\n  word,\n  word_count,\n  corpus,\n  corpus_date\nfrom `bigquery-public-data.samples.shakespeare` s\nwhere word like '%pig%'\nlimit 100;",
  },
  {
    type: "snippet",
    group: "wikipedia",
    name: "wikipedia pigs",
    tag: "query",
    value: "select\n  *\nfrom `bigquery-public-data.samples.wikipedia` w\nwhere title like '%pig%'\nlimit 100;",
  },
  {
    type: "site",
    group: "common",
    name: "Google",
    regex: '^.*$',
    url: "https://www.google.com/search?q=%s",
  },
  {
    type: "site",
    group: "shakespeare",
    name: "Dict.cc",
    regex: '^.*$',
    url: "https://www.dict.cc/?s=%s",
  },
  {
    type: "site",
    group: "wikipedia",
    name: "Wikipedia",
    regex: '^.*$',
    url: "https://en.wikipedia.org/w/index.php?search=%s",
  },
];

function defaultConfig() {
  return DEFAULT_CONFIG;
}

window.pigquery ||= {};
window.pigquery.common = {
  defaultConfig,
};
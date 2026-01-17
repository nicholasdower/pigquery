window.DEFAULT_CONFIG = {
  snippets: [
    {
      label: "shakespeare",
      tag: "table",
      value: "`bigquery-public-data.samples.shakespeare` s",
    },
    {
      label: "wikipedia",
      tag: "table",
      value: "`bigquery-public-data.samples.wikipedia` w",
    },
    {
      label: "shakespeare pigs",
      tag: "query",
      value: "select\n  word,\n  word_count,\n  corpus,\n  corpus_date\nfrom `bigquery-public-data.samples.shakespeare` s\nwhere word like '%pig%'\nlimit 100;",
    },
    {
      label: "wikipedia pigs",
      tag: "query",
      value: "select\n  *\nfrom `bigquery-public-data.samples.wikipedia` w\nwhere title like '%pig%'\nlimit 100;",
    }
  ],
  sites: [
    {
      label: "Google",
      regex: '^.*$',
      url: "https://www.google.com/search?q=%s",
    },
    {
      label: "Dict.cc",
      regex: '^.*$',
      url: "https://www.dict.cc/?s=%s",
    },
    {
      label: "Wikipedia",
      regex: '^.*$',
      url: "https://en.wikipedia.org/w/index.php?search=%s",
    },
  ]
};

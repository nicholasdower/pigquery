window.DEFAULT_CONFIG = {
  snippets: [
    {
      description: "shakespeare",
      type: "table",
      value: "`bigquery-public-data.samples.shakespeare` s",
    },
    {
      description: "wikipedia",
      type: "table",
      value: "`bigquery-public-data.samples.wikipedia` w",
    },
    {
      description: "shakespeare pigs",
      type: "query",
      value: "select\n  word,\n  word_count,\n  corpus,\n  corpus_date\nfrom `bigquery-public-data.samples.shakespeare` s\nwhere word like '%pig%'\nlimit 100;",
    },
    {
      description: "wikipedia pigs",
      type: "query",
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

importScripts('js-yaml.min.js', 'config.js');

const config = self.pigquery.config;

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "refreshRemoteSources") {
    config.refreshRemoteSources();
  }
  if (message.action === "openOptionsPage") {
    chrome.runtime.openOptionsPage();
  }
});

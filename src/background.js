importScripts('../lib/js-yaml.min.js', 'config.js');

const config = self.pigquery.config;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "refreshRemoteSources") {
    config.refreshRemoteSources().then(() => {
      sendResponse({ done: true });
    });
    return true; // Keep channel open for async response
  }
  if (message.action === "openOptionsPage") {
    chrome.runtime.openOptionsPage();
  }
});

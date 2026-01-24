// background.js - Service worker for PigQuery
importScripts('js-yaml.min.js', 'config.js');

const config = self.pigquery.config;

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "refreshRemoteSources") {
    config.refreshRemoteSources()
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ refreshed: 0, errors: [err.message] }));
    return true; // Keep channel open for async response
  }
});

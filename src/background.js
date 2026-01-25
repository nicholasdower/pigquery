importScripts('../lib/js-yaml.min.js', 'config.js');

const config = self.pigquery.config;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "refreshRemoteSources") {
    config.refreshRemoteSources().then((result) => {
      sendResponse(result);
    });
    return true;
  }
  if (message.action === "addSource") {
    config.addSource(message.url).then((result) => {
      sendResponse(result);
    });
    return true;
  }
  if (message.action === "openOptionsPage") {
    chrome.runtime.openOptionsPage();
  }
});

import * as config from './config.js';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'refreshRemoteSources') {
    config.refreshRemoteSources();
  }
  if (message.action === 'addSource') {
    config.addSource(message.url).then(result => {
      sendResponse(result);
    });
    return true;
  }
  if (message.action === 'removeSource') {
    config.removeSource(message.url).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }
  if (message.action === 'saveLocalSource') {
    config.saveLocalSource(message.yaml).then(result => {
      sendResponse(result);
    });
    return true;
  }
  if (message.action === 'saveShortcuts') {
    config.saveShortcuts(message.shortcuts).then(result => {
      sendResponse(result);
    });
    return true;
  }
  if (message.action === 'openOptionsPage') {
    const url = message.locale
      ? chrome.runtime.getURL(`dist/options.html?hl=${message.locale}`)
      : chrome.runtime.getURL('dist/options.html');
    chrome.tabs.create({ url });
  }
});

async function updateErrorBadge() {
  const { hasErrors } = await config.loadConfiguration();

  if (hasErrors) {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Update badge when sources change
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes[config.STORAGE_KEY]) {
    updateErrorBadge();
  }
});

// Check on startup
updateErrorBadge();
config.clearStaleBusy();

// Reinject content script into BigQuery tabs and reopen options page after extension reload
async function reinjectContentScripts() {
  try {
    // Find all BigQuery tabs
    const tabs = await chrome.tabs.query({ url: 'https://console.cloud.google.com/*' });

    // Reinject content script into each tab
    for (const tab of tabs) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['dist/content.js'],
        });
      } catch (err) {
        // Tab may not be injectable (e.g., chrome:// page), ignore
        console.warn(`Could not inject content script into tab ${tab.id}:`, err);
      }
    }
  } catch (err) {
    console.error('Error reinjecting content scripts:', err);
  }
}

// Handle extension reload: reinject scripts and reopen options if needed
// Add a small delay to ensure extension is fully loaded after reload
setTimeout(() => {
  chrome.storage.local.get('reloadState').then(({ reloadState }) => {
    if (reloadState) {
      chrome.storage.local.remove('reloadState');

      const { reopenOptionsPage, optionsPageWasActive } = reloadState;

      // Reinject content scripts into all BigQuery tabs
      reinjectContentScripts();

      if (reopenOptionsPage) {
        // Open options page as active if it was active, otherwise in background
        const optionsUrl = chrome.runtime.getURL('dist/options.html');
        chrome.tabs.create({ url: optionsUrl, active: optionsPageWasActive });
      }
    }
  });
}, 100);

import * as config from './config.js';
import logger from './logger.js';

async function updateErrorBadge() {
  const { hasErrors } = await config.loadConfiguration();

  if (hasErrors) {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

async function reinjectContentScript(force) {
  logger.log('Reinjecting content script, force:', force);
  try {
    // Find all BigQuery tabs
    const tabs = await chrome.tabs.query({ url: 'https://console.cloud.google.com/*' });

    for (const tab of tabs) {
      logger.log(`Checking tab ${tab.id}`);
      try {
        let needsInjection;
        if (force) {
          needsInjection = true;
        } else {
          try {
            await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
            needsInjection = false;
            logger.log(`Content script already running in tab ${tab.id}`);
          } catch (err) {
            logger.log(`Content script not already running in tab ${tab.id}`);
            needsInjection = true;
          }
        }

        if (needsInjection) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => {
                document.dispatchEvent(new CustomEvent('pigquery-uninstall'));
              },
            });
          } catch (err) {
            // Old script may not be present or already disconnected, continue anyway
            logger.log(`Could not dispatch uninstall in tab ${tab.id}:`, err.message);
          }

          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['dist/content.js'],
          });
          logger.log(`Injected content script into tab ${tab.id}`);
        }
      } catch (err) {
        logger.warn(`Could not inject content script into tab ${tab.id}:`, err);
      }
    }
  } catch (err) {
    logger.error('Error reinjecting content scripts:', err);
  }
}

// Guard against invalidated extension context
if (chrome?.runtime?.id) {
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

  // Update badge when sources change
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[config.STORAGE_KEY]) {
      updateErrorBadge();
    }
  });

  // Check on startup
  updateErrorBadge();
  config.clearStaleBusy();

  chrome.storage.local.get('reloadState').then(({ reloadState }) => {
    if (reloadState) {
      logger.log('Reload triggered by user');
      reinjectContentScript(true); // force reinject since the user requested it
      chrome.storage.local.remove('reloadState');
      const { reopenOptionsPage } = reloadState;
      if (reopenOptionsPage) {
        const optionsUrl = chrome.runtime.getURL('dist/options.html');
        chrome.tabs.create({ url: optionsUrl, active: true });
      }
    } else {
      logger.log('Updating stale tabs');
      reinjectContentScript(false); // only reinject if the content script is not already running
    }
  });
}

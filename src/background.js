import * as config from './config.js';
import logger from './logger.js';

async function injectContentScript(tab, force) {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (force, tabId) => {
        const logs = [];
        const log = msg => logs.push(msg);

        try {
          const MARKER_ID = 'pigquery-extension-marker';

          let marker = document.getElementById(MARKER_ID);
          if (marker) {
            log(`Found ${marker.dataset.environment} content script in tab ${tabId}`);
          }

          if (force) {
            log('Force mode: uninstalling existing content script');
            document.dispatchEvent(new CustomEvent('pigquery-uninstall'));
            marker = document.getElementById(MARKER_ID);
          } else {
            if (marker) {
              const oldEnv = marker.dataset.environment;
              document.dispatchEvent(new CustomEvent('pigquery-uninstall-if-dead'));
              marker = document.getElementById(MARKER_ID);
              if (!marker) {
                log(`Uninstalled dead ${oldEnv} content script in tab ${tabId}`);
              }
            }

            if (marker) {
              if (process.env.NODE_ENV == 'dev' && marker.dataset.environment === 'prod') {
                log(`Uninstalling content script in tab ${tabId} because it is in production environment`);
                document.dispatchEvent(new CustomEvent('pigquery-uninstall'));
              } else if (process.env.NODE_ENV == 'prod' && marker.dataset.environment === 'dev') {
                log(`Skipping injection for tab ${tabId} because it is in development environment`);
                return { inject: false, logs };
              } else {
                log(`Content script already running in tab ${tabId}`);
                return { inject: false, logs };
              }
            }
          }

          marker = document.getElementById(MARKER_ID);
          if (marker) throw new Error('PigQuery uninstall failed');

          marker = document.createElement('div');
          marker.id = MARKER_ID;
          marker.setAttribute('data-environment', process.env.NODE_ENV);
          document.head.appendChild(marker);

          return { inject: true, logs };
        } catch (error) {
          log(`Skipping injection for tab ${tabId} because of error: ${error.message}`);
          return { inject: false, logs };
        }
      },
      args: [force, tab.id],
    });

    const { inject, logs } = result[0].result;
    logs.forEach(msg => logger.log(msg));

    if (!inject) return;

    logger.log(`Injecting content script into tab ${tab.id}`);
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['dist/pigquery.js'],
    });
    logger.log(`Injected content script into tab ${tab.id}`);
  } catch (err) {
    logger.error(`Error while injecting content script into tab ${tab.id}:`, err);
  }
}

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
  logger.log(`Checking tabs for reinjection, force: ${force}`);
  try {
    const urlPatterns = ['https://console.cloud.google.com/*'];
    if (process.env.NODE_ENV === 'dev') {
      urlPatterns.push('file:///*bigquery.html');
    }
    const tabs = await chrome.tabs.query({ url: urlPatterns });
    logger.log(`${tabs.length} BigQuery tab${tabs.length === 1 ? '' : 's'} found`);
    if (tabs.length === 0) return;

    for (const tab of tabs) {
      await injectContentScript(tab, force);
    }
  } catch (err) {
    logger.error('Error reinjecting content scripts:', err);
  }
}

// Guard against invalidated extension context
if (chrome?.runtime?.id) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    logger.log(`Received message from tab ${sender.tab.id}: ${message.action}`);

    if (message.action === 'refreshRemoteSources') {
      config.refreshRemoteSources();
      return true;
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

  // Inject content script when tab navigates to BigQuery
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    const isBigQueryUrl =
      tab.url?.startsWith('https://console.cloud.google.com/') ||
      (process.env.NODE_ENV === 'dev' && tab.url?.startsWith('file:///') && tab.url?.includes('bigquery.html'));
    if (changeInfo.status === 'complete' && isBigQueryUrl) {
      logger.log(`Tab ${tab.id} navigated to BigQuery`);
      injectContentScript(tab, false);
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
      //
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

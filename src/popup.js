import * as i18n from './i18n.js';
import * as config from './config.js';

const LOCALE = i18n.getSystemLocale();
i18n.applyI18n(LOCALE);

const t = (key, substitutions) => i18n.getMessage(key, LOCALE, substitutions);

const isMac = navigator.userAgentData.platform === 'macOS';
document.getElementById('shortcut-share').textContent = isMac ? '⌘+A' : 'Ctrl+A';
document.getElementById('shortcut-copy-cell').textContent = isMac ? 'Alt+⌘+Click / ⌘+C' : 'Ctrl+Alt+Click / Ctrl+C';

const shortcutInsertEl = document.getElementById('shortcut-insert');
const shortcutFocusTableEl = document.getElementById('shortcut-focus-table');

document.getElementById('options-link').addEventListener('click', e => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

const statusEl = document.getElementById('status');
const statusTextEl = document.getElementById('status-text');
const statusErrorEl = document.getElementById('status-error');
const refreshBtn = document.getElementById('refresh-btn');
const devSectionEl = document.getElementById('dev-section');
const updateBtn = document.getElementById('update-btn');

refreshBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'refreshRemoteSources' });
});

updateBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const optionsUrl = chrome.runtime.getURL('dist/options.html');
  const reloadState = { reopenOptionsPage: tab?.url?.startsWith(optionsUrl) };
  await chrome.storage.local.set({ reloadState });
  chrome.runtime.reload();
});

async function load() {
  const [sources, shortcuts, busy] = await Promise.all([
    config.loadSources(),
    config.loadShortcuts(),
    config.loadBusy(),
  ]);

  // Update shortcuts display
  shortcutInsertEl.textContent = config.formatShortcut(shortcuts.insertSnippet);
  shortcutFocusTableEl.textContent = config.formatShortcut(shortcuts.focusTable);

  // Update busy state
  refreshBtn.disabled = !!busy;
  refreshBtn.textContent = busy === 'refreshing' ? t('popupRefreshing') : t('popupRefresh');

  // Update status display
  if (busy === 'refreshing') {
    statusTextEl.textContent = t('popupRefreshing');
    statusErrorEl.style.display = 'none';
    return;
  }

  const remote = config.getRemoteSources(sources);

  if (remote.length === 0) {
    statusEl.style.display = 'none';
    return;
  }

  const timestamps = remote.map(s => s.timestamp).filter(Boolean);
  if (timestamps.length === 0) {
    statusEl.style.display = 'none';
    return;
  }

  const oldestTimestamp = Math.min(...timestamps);
  const date = new Date(oldestTimestamp);
  const hasErrors = remote.some(s => s.error);

  statusEl.style.display = '';
  statusTextEl.textContent = t('popupLastUpdated', date.toLocaleString());
  statusErrorEl.textContent = hasErrors ? t('popupHasErrors') : '';
  statusErrorEl.style.display = hasErrors ? '' : 'none';
}

chrome.storage.onChanged.addListener((_, areaName) => {
  if (areaName === 'local') load();
});

if (process.env.NODE_ENV !== 'prod') {
  devSectionEl.style.display = '';
}

load();

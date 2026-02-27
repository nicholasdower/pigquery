import * as i18n from './i18n.js';
import * as config from './config.js';
import refreshIconSvg from './refresh-icon.svg';

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

const buildDate = new Date(__BUILD_DATE__);
const buildDatePart = buildDate.toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' });
const buildTimePart = buildDate.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
document.getElementById('version-text').textContent =
  `v${__BUILD_VERSION__} \u2013 ${__BUILD_COMMIT__.slice(0, 7)} \u2013 ${buildDatePart} ${buildTimePart}`;

const statusEl = document.getElementById('status');
const statusTextEl = document.getElementById('status-text');
const statusErrorEl = document.getElementById('status-error');
const refreshBtn = document.getElementById('refresh-btn');
const updateBtn = document.getElementById('update-btn');
refreshBtn.innerHTML = refreshIconSvg;
updateBtn.innerHTML = refreshIconSvg;

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
  refreshBtn.title = busy === 'refreshing' ? t('popupRefreshing') : t('popupRefresh');

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
  const datePart = date.toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timePart = date.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
  statusTextEl.textContent = t('popupLastUpdated', [datePart, timePart]);
  statusErrorEl.textContent = hasErrors ? t('popupHasErrors') : '';
  statusErrorEl.style.display = hasErrors ? '' : 'none';
}

chrome.storage.onChanged.addListener((_, areaName) => {
  if (areaName === 'local') load();
});

load();

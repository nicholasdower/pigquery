import * as i18n from './i18n.js';
import * as config from './config.js';
import refreshIconSvg from './refresh-icon.svg';
import settingsIconSvg from './settings-icon.svg';

chrome.runtime.sendMessage({ action: 'ping' })

const LOCALE = i18n.getSystemLocale();
i18n.applyI18n(LOCALE);

const t = (key, substitutions) => i18n.getMessage(key, LOCALE, substitutions);

const isMac = navigator.userAgentData.platform === 'macOS';
document.getElementById('shortcut-share').textContent = isMac ? '⌘+A' : 'Ctrl+A';
document.getElementById('shortcut-copy-cell').textContent = isMac ? 'Alt+⌘+Click / ⌘+C' : 'Ctrl+Alt+Click / Ctrl+C';

const shortcutInsertEl = document.getElementById('shortcut-insert');
const shortcutFocusTableEl = document.getElementById('shortcut-focus-table');

const settingsBtn = document.getElementById('settings-btn');
settingsBtn.innerHTML = settingsIconSvg;
settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());

const headerRefreshBtn = document.getElementById('header-refresh-btn');
headerRefreshBtn.innerHTML = refreshIconSvg;
headerRefreshBtn.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'refreshRemoteSources' }));

async function load() {
  const [shortcuts, busy] = await Promise.all([
    config.loadShortcuts(),
    config.loadBusy(),
  ]);

  shortcutInsertEl.textContent = config.formatShortcut(shortcuts.insertSnippet);
  shortcutFocusTableEl.textContent = config.formatShortcut(shortcuts.focusTable);

  headerRefreshBtn.disabled = !!busy;
  headerRefreshBtn.title = busy === 'refreshing' ? t('popupRefreshing') : t('popupRefresh');
}

chrome.storage.onChanged.addListener((_, areaName) => {
  if (areaName === 'local') load();
});

load();

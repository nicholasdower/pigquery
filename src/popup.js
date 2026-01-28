const i18n = window.pigquery.i18n;
const config = window.pigquery.config;
const LOCALE = i18n.getSystemLocale();
i18n.applyI18n(LOCALE);

const t = (key, substitutions) => i18n.getMessage(key, LOCALE, substitutions);

const isMac = navigator.userAgentData.platform === 'macOS';
document.getElementById('shortcut-share').textContent = isMac ? '⌘+A' : 'Ctrl+A';
document.getElementById('shortcut-copy-cell').textContent = isMac ? 'Alt+⌘+Click' : 'Ctrl+Alt+Click';

document.getElementById('options-link').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

const statusEl = document.getElementById('status');
const statusTextEl = document.getElementById('status-text');
const statusErrorEl = document.getElementById('status-error');
const refreshBtn = document.getElementById('refresh-btn');

refreshBtn.textContent = t("popupRefresh");
refreshBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: "refreshRemoteSources" });
});

function updateBusyUI(busy) {
  refreshBtn.disabled = !!busy;
  refreshBtn.textContent = busy === 'refreshing' ? t("popupRefreshing") : t("popupRefresh");
  if (busy === 'refreshing') {
    statusTextEl.textContent = t("popupRefreshing");
    statusErrorEl.style.display = 'none';
  }
}

async function loadStatus() {
  const sources = await config.loadSources();
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

  // Find oldest timestamp
  const oldestTimestamp = Math.min(...timestamps);
  const date = new Date(oldestTimestamp);

  // Check for errors
  const hasErrors = remote.some(s => s.error);

  // Update status content
  statusEl.style.display = '';
  statusTextEl.textContent = t("popupLastUpdated", date.toLocaleString());
  statusErrorEl.textContent = hasErrors ? t("popupHasErrors") : '';
  statusErrorEl.style.display = hasErrors ? '' : 'none';
}

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes[config.STORAGE_KEY]) {
    loadStatus();
  }
  if (areaName === 'local' && changes[config.BUSY_KEY]) {
    updateBusyUI(changes[config.BUSY_KEY].newValue);
    // When operation completes, reload status
    if (!changes[config.BUSY_KEY].newValue) {
      loadStatus();
    }
  }
});

// Initialize
async function init() {
  const { [config.BUSY_KEY]: busy } = await chrome.storage.local.get(config.BUSY_KEY);
  updateBusyUI(busy);
  loadStatus();
}

init();

const i18n = window.pigquery.i18n;
const config = window.pigquery.config;
const LOCALE = i18n.getSystemLocale();
i18n.applyI18n(LOCALE);

const t = (key, substitutions) => i18n.getMessage(key, LOCALE, substitutions);

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
  refreshBtn.disabled = true;
  refreshBtn.textContent = t("popupRefreshing");
  chrome.runtime.sendMessage({ action: "refreshRemoteSources" }, () => {
    refreshBtn.disabled = false;
    refreshBtn.textContent = t("popupRefresh");
  });
});

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

// Listen for storage changes to update status
chrome.storage.onChanged.addListener((changes) => {
  if (changes[config.STORAGE_KEY]) {
    loadStatus();
  }
});

loadStatus();

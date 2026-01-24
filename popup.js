const i18n = window.pigquery.i18n;
const config = window.pigquery.config;
const LOCALE = i18n.getSystemLocale();
i18n.applyI18n(LOCALE);

const t = (key, substitutions) => i18n.getMessage(key, LOCALE, substitutions);

document.getElementById('options-link').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

async function loadStatus() {
  const statusEl = document.getElementById('status');
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

  // Build status content
  statusEl.style.display = '';
  statusEl.innerHTML = '';
  statusEl.appendChild(document.createTextNode(t("popupOldestUpdate", date.toLocaleString())));

  if (hasErrors) {
    const errorEl = document.createElement('div');
    errorEl.className = 'status-error';
    errorEl.textContent = t("popupHasErrors");
    statusEl.appendChild(errorEl);
  }

  const rowEl = document.createElement('div');
  rowEl.className = 'status-row';

  const refreshBtn = document.createElement('button');
  refreshBtn.className = 'refresh-btn';
  refreshBtn.textContent = t("popupRefresh");
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    refreshBtn.textContent = t("popupRefreshing");

    try {
      // Trigger a refresh. The storage listener will update the status.
      await chrome.runtime.sendMessage({ action: "refreshRemoteSources" });
    } catch (e) {
    }
  });
  rowEl.appendChild(refreshBtn);
  statusEl.appendChild(rowEl);
}

// Listen for storage changes to update status
chrome.storage.onChanged.addListener((changes) => {
  if (changes[config.STORAGE_KEY]) {
    loadStatus();
  }
});

loadStatus();

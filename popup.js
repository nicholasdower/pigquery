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
  const sources = await config.loadSources();
  const remote = config.getRemoteSources(sources);
  const statusEl = document.getElementById('status');
  
  if (remote.length === 0) {
    statusEl.style.display = 'none';
    return;
  }
  
  // Find oldest timestamp
  const timestamps = remote.map(s => s.timestamp).filter(Boolean);
  if (timestamps.length === 0) {
    statusEl.style.display = 'none';
    return;
  }
  
  const oldestTimestamp = Math.min(...timestamps);
  const date = new Date(oldestTimestamp);
  statusEl.textContent = t("popupOldestUpdate", date.toLocaleString());
}

loadStatus();

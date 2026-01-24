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
let refreshBtn = null;

async function loadStatus() {
  const sources = await config.loadSources();
  const remote = config.getRemoteSources(sources);
  
  if (remote.length === 0) {
    statusEl.style.display = 'none';
    return;
  }
  
  statusEl.style.display = '';
  
  // Find oldest timestamp
  const timestamps = remote.map(s => s.timestamp).filter(Boolean);
  if (timestamps.length === 0) {
    statusEl.style.display = 'none';
    return;
  }
  
  const oldestTimestamp = Math.min(...timestamps);
  const date = new Date(oldestTimestamp);
  
  // Check for errors
  const hasErrors = remote.some(s => s.error);
  
  // Build status content
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
  
  refreshBtn = document.createElement('button');
  refreshBtn.className = 'refresh-btn';
  refreshBtn.textContent = t("popupRefresh");
  refreshBtn.addEventListener('click', handleRefresh);
  rowEl.appendChild(refreshBtn);
  
  statusEl.appendChild(rowEl);
}

async function handleRefresh() {
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.textContent = t("popupRefreshing");
  }
  
  try {
    await chrome.runtime.sendMessage({ action: "refreshRemoteSources" });
  } catch (e) {
    // Service worker might not be ready, ignore
  }
  
  // Reload status after refresh completes
  // (storage listener may not fire if no changes occurred)
  await loadStatus();
}

// Listen for storage changes to update status
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[config.STORAGE_KEY]) {
    loadStatus();
  }
});

loadStatus();

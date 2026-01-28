const config = window.pigquery.config;
const i18n = window.pigquery.i18n;
const LOCALE = i18n.getSystemLocale();
i18n.applyI18n(LOCALE);

const t = (key, substitutions) => i18n.getMessage(key, LOCALE, substitutions);

const el = (id) => document.getElementById(id);

const textarea = el("payload");
const saveBtn = el("save");
const localStatusEl = el("localStatus");
const remoteStatusEl = el("remoteStatus");
const urlInput = el("urlInput");
const addUrlBtn = el("addUrl");
const refreshAllBtn = el("refreshAll");
const remoteSourcesEl = el("remoteSources");
const exampleEl = el("example");

let sources = [];
let busy = null; // Current operation: 'refreshing', 'adding', or null
let lastLoadedLocal = null; // Track the last loaded local config to detect unsaved edits

function updateButtonStates() {
  const unchanged = textarea.value === lastLoadedLocal;
  saveBtn.disabled = busy || unchanged;
  if (unchanged) {
    setLocalStatus("", "muted");
  }
  addUrlBtn.disabled = !!busy;
  refreshAllBtn.disabled = !!busy;
  remoteSourcesEl.querySelectorAll(".remove-btn").forEach(btn => {
    btn.disabled = !!busy;
  });
}

function setLocalStatus(message, kind = "muted") {
  localStatusEl.className = "status " + kind;
  localStatusEl.textContent = message;
}

function setRemoteStatus(message, kind = "muted") {
  remoteStatusEl.className = "status " + kind;
  remoteStatusEl.textContent = message;
}

function formatTimestamp(ts) {
  if (!ts) return "Never";
  const date = new Date(ts);
  return date.toLocaleString();
}

async function load() {
  sources = await config.loadSources();

  const local = sources.find(s => s.url === "local");
  const newLocalValue = local ? config.jsonToYaml(local.data) : "";

  // Only update the textarea if the user hasn't made unsaved edits
  const hasUnsavedEdits = lastLoadedLocal !== null && textarea.value !== lastLoadedLocal;
  if (!hasUnsavedEdits) {
    textarea.value = newLocalValue;
    lastLoadedLocal = newLocalValue;
  }

  updateButtonStates();

  const remote = config.getRemoteSources(sources);

  if (remote.length === 0) {
    remoteSourcesEl.innerHTML = "";
    return;
  }

  remoteSourcesEl.innerHTML = remote.map((source, index) => {
    const metaClass = source.error ? 'source-meta error' : 'source-meta';
    const metaText = source.error
      ? t("optionsLastUpdatedError", [formatTimestamp(source.timestamp), t(source.error.key, source.error.subs)])
      : t("optionsLastUpdated", formatTimestamp(source.timestamp));
    return `
      <div class="source-card" data-url="${escapeHtml(source.url)}">
        <div class="source-header">
          <div class="source-info">
            <div class="source-url">${escapeHtml(source.url)}</div>
            <div class="${metaClass}">${escapeHtml(metaText)}</div>
          </div>
          <div class="source-actions">
            <button type="button" class="danger remove-btn" data-url="${escapeHtml(source.url)}" data-i18n="optionsRemove">${t("optionsRemove")}</button>
          </div>
        </div>
        <textarea readonly>${source.data ? escapeHtml(config.jsonToYaml(source.data)) : ''}</textarea>
      </div>
    `;
  }).join("");

  remoteSourcesEl.querySelectorAll(".remove-btn").forEach(btn => {
    btn.addEventListener("click", () => removeSource(btn.dataset.url));
  });

  applyBusyState();
  updateButtonStates();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Applies the current busy state to source cards.
 * Only shows "Refreshing..." when actually refreshing, not when adding.
 */
function applyBusyState() {
  const remote = config.getRemoteSources(sources);
  for (const source of remote) {
    const card = remoteSourcesEl.querySelector(`[data-url="${CSS.escape(source.url)}"]`);
    if (!card) continue;

    const meta = card.querySelector('.source-meta');
    if (busy === 'refreshing') {
      meta.className = 'source-meta muted';
      meta.textContent = t("statusRefreshing");
    } else {
      const metaClass = source.error ? 'source-meta error' : 'source-meta';
      const metaText = source.error
        ? t("optionsLastUpdatedError", [formatTimestamp(source.timestamp), t(source.error.key, source.error.subs)])
        : t("optionsLastUpdated", formatTimestamp(source.timestamp));
      meta.className = metaClass;
      meta.textContent = metaText;
    }
  }
}

function onBusyStateChanged(newBusy) {
  busy = newBusy;

  applyBusyState();
  updateButtonStates();

  if (busy === 'refreshing') {
    setRemoteStatus(t("statusRefreshing"), "muted");
  } else if (busy === 'adding') {
    setRemoteStatus(t("statusFetching"), "muted");
  } else {
    setRemoteStatus("", "muted");
  }
}

async function saveLocal() {
  if (busy) return;
  
  const raw = textarea.value;

  if (raw.trim() === '') {
    sources = sources.filter(s => s.url !== "local");
    lastLoadedLocal = "";
    await config.saveSources(sources);
    setLocalStatus("", "muted");
    updateButtonStates();
    return;
  }

  const parsed = config.safeYamlParse(raw);
  if (!parsed.ok) {
    setLocalStatus(t("statusInvalidYaml", parsed.error.message), "error");
    return;
  }

  const validation = config.validateConfigItems(parsed.value);
  if (!validation.ok) {
    setLocalStatus(t(validation.errorKey, validation.errorSubs), "error");
    return;
  }

  const localIndex = sources.findIndex(s => s.url === "local");
  const localSource = {
    url: "local",
    timestamp: Date.now(),
    data: parsed.value
  };

  if (localIndex >= 0) {
    sources[localIndex] = localSource;
  } else {
    sources.unshift(localSource);
  }

  textarea.value = config.jsonToYaml(parsed.value);
  lastLoadedLocal = textarea.value;
  await config.saveSources(sources);
  setLocalStatus("", "muted");
  updateButtonStates();
}

async function addUrl() {
  if (busy) return;
  
  const url = urlInput.value.trim();

  if (!url) {
    setRemoteStatus(t("statusInvalidUrl"), "error");
    return;
  }

  try {
    new URL(url);
  } catch (e) {
    setRemoteStatus(t("statusInvalidUrl"), "error");
    return;
  }

  if (sources.find(s => s.url === url)) {
    setRemoteStatus(t("statusUrlExists"), "error");
    return;
  }

  const granted = await config.requestUrlPermission(url);
  if (!granted) {
    setRemoteStatus(t("statusPermissionDenied"), "error");
    return;
  }

  // Use background worker to queue behind any refresh and avoid race conditions
  const result = await chrome.runtime.sendMessage({ action: "addSource", url });

  if (!result.ok) {
    setRemoteStatus(t(result.errorKey, result.errorSubs), "error");
    return;
  }

  urlInput.value = "";
  setRemoteStatus("", "muted");
}

async function removeSource(url) {
  if (busy) return;
  
  sources = sources.filter(s => s.url !== url);
  await config.saveSources(sources);
}

async function refreshAll() {
  if (busy) return;
  
  const remote = config.getRemoteSources(sources);
  if (remote.length === 0) return;

  const result = await chrome.runtime.sendMessage({ action: "refreshRemoteSources" });

  if (result.failed > 0) {
    setRemoteStatus(t("statusRefreshAllFailed"), "error");
  } else {
    setRemoteStatus("", "muted");
  }
}

saveBtn.addEventListener("click", () => void saveLocal());
addUrlBtn.addEventListener("click", () => void addUrl());
refreshAllBtn.addEventListener("click", () => void refreshAll());
textarea.addEventListener("input", () => updateButtonStates());

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    void saveLocal();
  }
});

urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    void addUrl();
  }
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes[config.STORAGE_KEY]) {
    load();
    setRemoteStatus("", "muted");
  }
  if (areaName === 'local' && changes[config.BUSY_KEY]) {
    onBusyStateChanged(changes[config.BUSY_KEY].newValue);
  }
});

const EXAMPLE_YAML = `- group: shakespeare
  name: shakespeare
  tag: table
  value: "\`bigquery-public-data.samples.shakespeare\` s"
- group: shakespeare
  name: shakespeare pigs
  tag: query
  value: |-
    select
      *
    from \`bigquery-public-data.samples.shakespeare\` s
    where word like '%pig%';
- group: shakespeare
  name: Wikipedia
  regex: ^.*$
  url: https://en.wikipedia.org/w/index.php?search=%s`;

exampleEl.value = EXAMPLE_YAML;
exampleEl.style.height = exampleEl.scrollHeight + "px";

// Initialize
async function init() {
  const { [config.BUSY_KEY]: currentBusy } = await chrome.storage.local.get(config.BUSY_KEY);
  busy = currentBusy;
  await load();
}

void init();

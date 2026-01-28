const config = window.pigquery.config;
const i18n = window.pigquery.i18n;
const LOCALE = i18n.getSystemLocale();
i18n.applyI18n(LOCALE);

const t = (key, substitutions) => i18n.getMessage(key, LOCALE, substitutions);

const el = (id) => document.getElementById(id);

const textarea = el("payload");
const saveBtn = el("save");
const localStatusEl = el("localStatus");
const addUrlStatusEl = el("addUrlStatus");
const refreshStatusEl = el("refreshStatus");
const urlInput = el("urlInput");
const addUrlBtn = el("addUrl");
const refreshAllBtn = el("refreshAll");
const remoteSourcesEl = el("remoteSources");
const exampleEl = el("example");

let sources = [];
let busy = null; // Current operation: 'refreshing', 'adding', or null
let lastLoadedLocal = ""; // Track the last loaded local config to detect unsaved edits

function updateButtonStates() {
  const unchanged = textarea.value === lastLoadedLocal;
  saveBtn.disabled = busy || unchanged;
  if (unchanged) {
    setLocalStatus("", "muted");
  }
  addUrlBtn.disabled = !!busy;
  const hasRemoteSources = sources.some(s => s.url !== "local");
  refreshAllBtn.disabled = !!busy || !hasRemoteSources;
  remoteSourcesEl.querySelectorAll(".remove-btn").forEach(btn => {
    btn.disabled = !!busy;
  });
}

function setLocalStatus(message, kind = "muted") {
  localStatusEl.className = "status " + kind;
  localStatusEl.textContent = message;
}

function setAddUrlStatus(message, kind = "muted") {
  addUrlStatusEl.className = "status " + kind;
  addUrlStatusEl.textContent = message;
}

function setRefreshStatus(message, kind = "muted") {
  refreshStatusEl.className = "status " + kind;
  refreshStatusEl.textContent = message;
}

function formatTimestamp(ts) {
  if (!ts) return "Never";
  const date = new Date(ts);
  return date.toLocaleString();
}

async function load() {
  const storage = await chrome.storage.local.get([config.STORAGE_KEY, config.BUSY_KEY]);
  sources = JSON.parse(storage[config.STORAGE_KEY] || "[]");
  busy = storage[config.BUSY_KEY] || null;

  const local = sources.find(s => s.url === "local");
  const newLocalValue = local ? config.jsonToYaml(local.data) : "";

  // Only update the textarea if the user hasn't made unsaved edits
  const hasUnsavedEdits = textarea.value !== lastLoadedLocal;
  if (!hasUnsavedEdits) {
    textarea.value = newLocalValue;
    lastLoadedLocal = newLocalValue;
  }

  // Update refresh status based on busy state
  if (busy === 'refreshing') {
    setRefreshStatus(t("statusRefreshing"), "muted");
  } else if (busy === 'adding') {
    setRefreshStatus(t("statusFetching"), "muted");
  } else {
    setRefreshStatus("", "muted");
  }

  const remote = config.getRemoteSources(sources);

  if (remote.length === 0) {
    remoteSourcesEl.innerHTML = "";
    updateButtonStates();
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

async function saveLocal() {
  if (busy) return;
  
  const raw = textarea.value;

  if (raw.trim() === '') {
    lastLoadedLocal = "";
    await chrome.runtime.sendMessage({ action: "saveLocalSource", source: null });
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

  textarea.value = config.jsonToYaml(parsed.value);
  lastLoadedLocal = textarea.value;
  await chrome.runtime.sendMessage({ action: "saveLocalSource", source: { timestamp: Date.now(), data: parsed.value } });
  setLocalStatus("", "muted");
  updateButtonStates();
}

async function addUrl() {
  if (busy) return;
  
  const url = urlInput.value.trim();

  if (!url) {
    setAddUrlStatus(t("statusInvalidUrl"), "error");
    return;
  }

  try {
    new URL(url);
  } catch (e) {
    setAddUrlStatus(t("statusInvalidUrl"), "error");
    return;
  }

  if (sources.find(s => s.url === url)) {
    setAddUrlStatus(t("statusUrlExists"), "error");
    return;
  }

  const granted = await config.requestUrlPermission(url);
  if (!granted) {
    setAddUrlStatus(t("statusPermissionDenied"), "error");
    return;
  }

  const result = await chrome.runtime.sendMessage({ action: "addSource", url });
  if (!result.ok) {
    setAddUrlStatus(t(result.errorKey, result.errorSubs), "error");
    return;
  }

  urlInput.value = "";
  setAddUrlStatus("", "muted");
}

async function removeSource(url) {
  if (busy) return;
  
  await chrome.runtime.sendMessage({ action: "removeSource", url });
}

async function refreshAll() {
  if (busy) return;
  
  const remote = config.getRemoteSources(sources);
  if (remote.length === 0) return;

  await chrome.runtime.sendMessage({ action: "refreshRemoteSources" });
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

urlInput.addEventListener("input", () => {
  if (!urlInput.value.trim()) {
    setAddUrlStatus("", "muted");
  }
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && (changes[config.STORAGE_KEY] || changes[config.BUSY_KEY])) {
    load();
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

void load();

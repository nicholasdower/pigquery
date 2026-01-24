const config = window.pigquery.config;
const i18n = window.pigquery.i18n;
const LOCALE = i18n.getSystemLocale();
i18n.applyI18n(LOCALE);

const t = (key, substitutions) => i18n.getMessage(key, LOCALE, substitutions);

const el = (id) => document.getElementById(id);

const textarea = el("payload");
const saveBtn = el("save");
const statusEl = el("status");
const urlInput = el("urlInput");
const addUrlBtn = el("addUrl");
const refreshAllBtn = el("refreshAll");
const remoteSourcesEl = el("remoteSources");
const exampleEl = el("example");

// Local cache of sources
let sources = [];

function setStatus(message, kind = "muted") {
  statusEl.className = kind;
  statusEl.textContent = message;
}

function setStatusFromResult(result, successKey) {
  if (result.ok) {
    setStatus(t(successKey), "ok");
  } else {
    setStatus(t(result.errorKey, result.errorSubs), "error");
  }
}

function formatTimestamp(ts) {
  if (!ts) return "Never";
  const date = new Date(ts);
  return date.toLocaleString();
}

async function load() {
  sources = await config.loadSources();
  renderAll();
  setStatus(t("statusLoaded"));
}

function renderAll() {
  renderLocalConfig();
  renderRemoteSources();
}

function renderLocalConfig() {
  const local = config.getLocalSource(sources);
  if (local) {
    textarea.value = config.jsonToYaml(local.data);
  } else {
    textarea.value = "";
  }
}

function renderRemoteSources() {
  const remote = config.getRemoteSources(sources);
  
  if (remote.length === 0) {
    remoteSourcesEl.innerHTML = "";
    return;
  }
  
  remoteSourcesEl.innerHTML = remote.map((source, index) => {
    const errorHtml = source.error 
      ? `<div class="source-error">${escapeHtml(t(source.error.key, source.error.subs))}</div>` 
      : '';
    return `
      <div class="source-card" data-url="${escapeHtml(source.url)}">
        <div class="source-header">
          <div>
            <div class="source-url">${escapeHtml(source.url)}</div>
            <div class="source-meta">${t("optionsLastUpdated", formatTimestamp(source.timestamp))}</div>
            ${errorHtml}
          </div>
          <div class="source-actions">
            <button type="button" class="secondary refresh-btn" data-url="${escapeHtml(source.url)}" data-i18n="optionsRefresh">${t("optionsRefresh")}</button>
            <button type="button" class="danger remove-btn" data-url="${escapeHtml(source.url)}" data-i18n="optionsRemove">${t("optionsRemove")}</button>
          </div>
        </div>
        <textarea readonly>${source.data ? escapeHtml(config.jsonToYaml(source.data)) : ''}</textarea>
      </div>
    `;
  }).join("");
  
  // Attach event listeners
  remoteSourcesEl.querySelectorAll(".refresh-btn").forEach(btn => {
    btn.addEventListener("click", () => refreshSource(btn.dataset.url));
  });
  remoteSourcesEl.querySelectorAll(".remove-btn").forEach(btn => {
    btn.addEventListener("click", () => removeSource(btn.dataset.url));
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function saveLocal() {
  const raw = textarea.value;
  
  if (raw.trim() === '') {
    // Remove local source if empty
    sources = sources.filter(s => s.url !== "local");
    await config.saveSources(sources);
    setStatus(t("statusSaved"), "ok");
    return;
  }
  
  const parsed = config.safeYamlParse(raw);
  if (!parsed.ok) {
    setStatus(t("statusInvalidYaml", parsed.error.message), "error");
    return;
  }
  
  const validation = config.validateConfigItems(parsed.value);
  if (!validation.ok) {
    setStatus(t(validation.errorKey, validation.errorSubs), "error");
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
  await config.saveSources(sources);
  setStatus(t("statusSaved"), "ok");
}

async function addUrl() {
  const url = urlInput.value.trim();
  
  if (!url) {
    setStatus(t("statusInvalidUrl"), "error");
    return;
  }
  
  try {
    new URL(url);
  } catch (e) {
    setStatus(t("statusInvalidUrl"), "error");
    return;
  }
  
  // Check if URL already exists
  if (sources.find(s => s.url === url)) {
    await refreshSource(url);
    return;
  }
  
  // Request permission for the URL
  const granted = await config.requestUrlPermission(url);
  if (!granted) {
    setStatus(t("statusPermissionDenied"), "error");
    return;
  }
  
  setStatus(t("statusFetching"), "muted");
  
  const result = await config.fetchYamlFromUrl(url);
  if (!result.ok) {
    setStatus(t(result.errorKey, result.errorSubs), "error");
    return;
  }
  
  sources.push({
    url: url,
    timestamp: Date.now(),
    data: result.value,
    error: null
  });
  
  await config.saveSources(sources);
  urlInput.value = "";
  renderRemoteSources();
  setStatus(t("statusUrlAdded"), "ok");
}

async function refreshSource(url) {
  setStatus(t("statusFetching"), "muted");
  
  const result = await config.fetchYamlFromUrl(url);
  const index = sources.findIndex(s => s.url === url);
  
  if (index >= 0) {
    if (result.ok) {
      sources[index] = {
        url: url,
        timestamp: Date.now(),
        data: result.value,
        error: null
      };
    } else {
      sources[index] = {
        ...sources[index],
        error: { key: result.errorKey, subs: result.errorSubs }
      };
    }
  }
  
  await config.saveSources(sources);
  renderRemoteSources();
  
  if (result.ok) {
    setStatus(t("statusFetched"), "ok");
  } else {
    setStatus(t(result.errorKey, result.errorSubs), "error");
  }
}

async function removeSource(url) {
  sources = sources.filter(s => s.url !== url);
  await config.saveSources(sources);
  renderRemoteSources();
  setStatus(t("statusUrlRemoved"), "ok");
}

async function refreshAll() {
  const remote = config.getRemoteSources(sources);
  if (remote.length === 0) return;
  
  setStatus(t("statusFetching"), "muted");
  
  let failedCount = 0;
  for (const source of remote) {
    const result = await config.fetchYamlFromUrl(source.url);
    const index = sources.findIndex(s => s.url === source.url);
    if (index < 0) continue;

    if (result.ok) {
      sources[index] = {
        url: source.url,
        timestamp: Date.now(),
        data: result.value,
        error: null
      };
    } else {
      sources[index] = {
        ...sources[index],
        error: { key: result.errorKey, subs: result.errorSubs }
      };
      failedCount++;
    }
  }
  
  await config.saveSources(sources);
  renderRemoteSources();
  
  if (failedCount > 0) {
    setStatus(t("statusFetchError", `${failedCount} source(s) failed`), "error");
  } else {
    setStatus(t("statusFetched"), "ok");
  }
}

// Event listeners
saveBtn.addEventListener("click", () => void saveLocal());
addUrlBtn.addEventListener("click", () => void addUrl());
refreshAllBtn.addEventListener("click", () => void refreshAll());

// Ctrl/Cmd+S saves
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    void saveLocal();
  }
});

// Enter in URL input adds URL
urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    void addUrl();
  }
});

// Listen for storage changes from other contexts (popup, content script, etc.)
chrome.storage.onChanged.addListener((changes) => {
  if (changes[config.STORAGE_KEY]) {
    sources = JSON.parse(changes[config.STORAGE_KEY].newValue);
    renderRemoteSources();
  }
});

// Populate example
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

const common = window.pigquery.common;
const i18n = window.pigquery.i18n;
const LOCALE = i18n.getSystemLocale();
i18n.applyI18n(LOCALE);

const t = (key, substitutions) => i18n.getMessage(key, LOCALE, substitutions);

const STORAGE_KEY = "userPayload";

const el = (id) => document.getElementById(id);

const textarea = el("payload");
const saveBtn = el("save");
const statusEl = el("status");
const urlInput = el("urlInput");
const addUrlBtn = el("addUrl");
const refreshAllBtn = el("refreshAll");
const remoteSourcesEl = el("remoteSources");
const exampleEl = el("example");

// Storage format: array of source objects
// { url: "local" | "https://...", timestamp: number, data: [...config items] }
let sources = [];

function setStatus(message, kind = "muted") {
  statusEl.className = kind;
  statusEl.textContent = message;
}

function safeYamlParse(text) {
  try {
    return { ok: true, value: jsyaml.load(text) };
  } catch (e) {
    return { ok: false, error: e };
  }
}

function jsonToYaml(obj) {
  return jsyaml.dump(obj, { indent: 2, lineWidth: -1, quotingType: '"', forceQuotes: false });
}

function formatTimestamp(ts) {
  if (!ts) return "Never";
  const date = new Date(ts);
  return date.toLocaleString();
}

function validateConfigItems(items) {
  if (!Array.isArray(items)) {
    return { ok: false, error: t("statusInvalidConfigArray") };
  }
  for (const option of items) {
    let type;
    if (option.regex) {
      type = "site";
    } else {
      type = "snippet";
    }
    if (typeof option.name !== "string" || option.name.trim() === "") {
      return { ok: false, error: t("statusInvalidConfigNameMissing", type) };
    }
    if (typeof option.tag === "string" && option.tag.trim() === "") {
      return { ok: false, error: t("statusInvalidConfigTagInvalid", type) };
    }
    if (option.tag && typeof option.tag !== "string") {
      return { ok: false, error: t("statusInvalidConfigTagInvalid", type) };
    }
    if (typeof option.group !== "string" || option.group.trim() === "") {
      return { ok: false, error: t("statusInvalidConfigGroupMissing", type) };
    }
    if (type === "snippet") {
      if (typeof option.value !== "string" || option.value.trim() === "") {
        return { ok: false, error: t("statusInvalidConfigSnippetsValueMissing") };
      }
    }
    if (type === "site") {
      if (typeof option.regex !== "string" || option.regex.trim() === "") {
        return { ok: false, error: t("statusInvalidConfigSitesRegexMissing") };
      }
      if (typeof option.url !== "string" || option.url.trim() === "") {
        return { ok: false, error: t("statusInvalidConfigSitesUrlMissing") };
      }
      try {
        new RegExp(option.regex);
      } catch (e) {
        return { ok: false, error: t("statusInvalidConfigSitesRegexInvalid") };
      }
      if (!option.url.includes("%s")) {
        return { ok: false, error: t("statusInvalidConfigSitesUrlMissingPlaceholder") };
      }
    }
  }
  return { ok: true };
}

async function requestUrlPermission(url) {
  try {
    const urlObj = new URL(url);
    const origin = `${urlObj.origin}/*`;
    
    const hasPermission = await chrome.permissions.contains({ origins: [origin] });
    if (hasPermission) {
      return true;
    }
    
    return await chrome.permissions.request({ origins: [origin] });
  } catch (e) {
    return false;
  }
}

async function fetchYamlFromUrl(url) {
  const granted = await requestUrlPermission(url);
  if (!granted) {
    return { ok: false, error: t("statusPermissionDenied") };
  }
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }
    const yamlText = await response.text();
    const parsed = safeYamlParse(yamlText);
    if (!parsed.ok) {
      return { ok: false, error: t("statusInvalidYaml", parsed.error.message) };
    }
    const validation = validateConfigItems(parsed.value);
    if (!validation.ok) {
      return { ok: false, error: validation.error };
    }
    return { ok: true, value: parsed.value };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function saveToStorage() {
  const json = JSON.stringify(sources, null, 2);
  await chrome.storage.local.set({ [STORAGE_KEY]: json });
}

async function load() {
  const data = await chrome.storage.local.get([STORAGE_KEY]);
  sources = data[STORAGE_KEY] ? JSON.parse(data[STORAGE_KEY]) : [];
  renderAll();
  setStatus(t("statusLoaded"));
}

function getLocalSource() {
  return sources.find(s => s.url === "local");
}

function getRemoteSources() {
  return sources.filter(s => s.url !== "local");
}

function renderAll() {
  renderLocalConfig();
  renderRemoteSources();
}

function renderLocalConfig() {
  const local = getLocalSource();
  if (local) {
    textarea.value = jsonToYaml(local.data);
  } else {
    textarea.value = "";
  }
}

function renderRemoteSources() {
  const remote = getRemoteSources();
  
  if (remote.length === 0) {
    remoteSourcesEl.innerHTML = "";
    return;
  }
  
  remoteSourcesEl.innerHTML = remote.map((source, index) => `
    <div class="source-card" data-url="${escapeHtml(source.url)}">
      <div class="source-header">
        <div>
          <div class="source-url">${escapeHtml(source.url)}</div>
          <div class="source-meta">${t("optionsLastUpdated", formatTimestamp(source.timestamp))}</div>
        </div>
        <div class="source-actions">
          <button type="button" class="secondary refresh-btn" data-url="${escapeHtml(source.url)}" data-i18n="optionsRefresh">${t("optionsRefresh")}</button>
          <button type="button" class="danger remove-btn" data-url="${escapeHtml(source.url)}" data-i18n="optionsRemove">${t("optionsRemove")}</button>
        </div>
      </div>
      <textarea readonly>${escapeHtml(jsonToYaml(source.data))}</textarea>
    </div>
  `).join("");
  
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
    await saveToStorage();
    setStatus(t("statusSaved"), "ok");
    return;
  }
  
  const parsed = safeYamlParse(raw);
  if (!parsed.ok) {
    setStatus(t("statusInvalidYaml", parsed.error.message), "error");
    return;
  }
  
  const validation = validateConfigItems(parsed.value);
  if (!validation.ok) {
    setStatus(validation.error, "error");
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
  
  textarea.value = jsonToYaml(parsed.value);
  await saveToStorage();
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
  
  setStatus(t("statusFetching"), "muted");
  
  const result = await fetchYamlFromUrl(url);
  if (!result.ok) {
    setStatus(t("statusFetchError", result.error), "error");
    return;
  }
  
  sources.push({
    url: url,
    timestamp: Date.now(),
    data: result.value
  });
  
  await saveToStorage();
  urlInput.value = "";
  renderRemoteSources();
  setStatus(t("statusUrlAdded"), "ok");
}

async function refreshSource(url) {
  setStatus(t("statusFetching"), "muted");
  
  const result = await fetchYamlFromUrl(url);
  if (!result.ok) {
    setStatus(t("statusFetchError", result.error), "error");
    return;
  }
  
  const index = sources.findIndex(s => s.url === url);
  if (index >= 0) {
    sources[index] = {
      url: url,
      timestamp: Date.now(),
      data: result.value
    };
  }
  
  await saveToStorage();
  renderRemoteSources();
  setStatus(t("statusFetched"), "ok");
}

async function removeSource(url) {
  sources = sources.filter(s => s.url !== url);
  await saveToStorage();
  renderRemoteSources();
  setStatus(t("statusUrlRemoved"), "ok");
}

async function refreshAll() {
  const remote = getRemoteSources();
  if (remote.length === 0) return;
  
  setStatus(t("statusFetching"), "muted");
  
  let hasError = false;
  for (const source of remote) {
    const result = await fetchYamlFromUrl(source.url);
    if (result.ok) {
      const index = sources.findIndex(s => s.url === source.url);
      if (index >= 0) {
        sources[index] = {
          url: source.url,
          timestamp: Date.now(),
          data: result.value
        };
      }
    } else {
      hasError = true;
    }
  }
  
  await saveToStorage();
  renderRemoteSources();
  
  if (hasError) {
    setStatus(t("statusFetchError", "Some sources failed"), "error");
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

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
  renderAll();
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
      ? `<span class="source-status error">${escapeHtml(t(source.error.key, source.error.subs))}</span>` 
      : '';
    return `
      <div class="source-card" data-url="${escapeHtml(source.url)}">
        <div class="source-url">${escapeHtml(source.url)}</div>
        <div class="source-meta">${t("optionsLastUpdated", formatTimestamp(source.timestamp))}</div>
        <textarea readonly>${source.data ? escapeHtml(config.jsonToYaml(source.data)) : ''}</textarea>
        <div class="source-actions">
          <button type="button" class="secondary refresh-btn" data-url="${escapeHtml(source.url)}" data-i18n="optionsRefresh">${t("optionsRefresh")}</button>
          <button type="button" class="danger remove-btn" data-url="${escapeHtml(source.url)}" data-i18n="optionsRemove">${t("optionsRemove")}</button>
          ${errorHtml}
        </div>
      </div>
    `;
  }).join("");

  remoteSourcesEl.querySelectorAll(".refresh-btn").forEach(btn => {
    btn.addEventListener("click", () => refreshSource(btn.dataset.url, btn));
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
    sources = sources.filter(s => s.url !== "local");
    await config.saveSources(sources);
    setLocalStatus(t("statusSaved"), "ok");
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
  await config.saveSources(sources);
  setLocalStatus(t("statusSaved"), "ok");
}

async function addUrl() {
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
    await refreshSource(url);
    return;
  }

  const granted = await config.requestUrlPermission(url);
  if (!granted) {
    setRemoteStatus(t("statusPermissionDenied"), "error");
    return;
  }
  
  setRemoteStatus(t("statusFetching"), "muted");
  
  const result = await config.fetchYamlFromUrl(url);
  if (!result.ok) {
    setRemoteStatus(t(result.errorKey, result.errorSubs), "error");
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
  setRemoteStatus(t("statusUrlAdded"), "ok");
}

async function refreshSource(url, btn) {
  if (btn) {
    btn.disabled = true;
  }

  const card = remoteSourcesEl.querySelector(`[data-url="${CSS.escape(url)}"]`);
  if (card) {
    const actions = card.querySelector('.source-actions');
    let status = actions.querySelector('.source-status');
    if (!status) {
      status = document.createElement('span');
      status.className = 'source-status muted';
      actions.appendChild(status);
    }
    status.className = 'source-status muted';
    status.textContent = t("statusFetching");
  }
  
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
    setRemoteStatus(t("statusFetched"), "ok");
  } else {
    setRemoteStatus("", "muted");
  }
}

async function removeSource(url) {
  sources = sources.filter(s => s.url !== url);
  await config.saveSources(sources);
  renderRemoteSources();
  setRemoteStatus(t("statusUrlRemoved"), "ok");
}

async function refreshAll() {
  const remote = config.getRemoteSources(sources);
  if (remote.length === 0) return;
  
  setRemoteStatus(t("statusFetching"), "muted");
  
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
    setRemoteStatus(t("statusFetchError", `${failedCount} source(s) failed`), "error");
  } else {
    setRemoteStatus(t("statusFetched"), "ok");
  }
}

saveBtn.addEventListener("click", () => void saveLocal());
addUrlBtn.addEventListener("click", () => void addUrl());
refreshAllBtn.addEventListener("click", () => void refreshAll());

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

// Listen for storage changes from other contexts (popup, content script, etc.)
chrome.storage.onChanged.addListener((changes) => {
  if (changes[config.STORAGE_KEY]) {
    sources = JSON.parse(changes[config.STORAGE_KEY].newValue);
    renderRemoteSources();
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

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
let busy = false;

function setBusy(value) {
  busy = value;
  saveBtn.disabled = value;
  addUrlBtn.disabled = value;
  refreshAllBtn.disabled = value;
  remoteSourcesEl.querySelectorAll(".refresh-btn, .remove-btn").forEach(btn => {
    btn.disabled = value;
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

function formatTime(date) {
  return date.toLocaleTimeString();
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
            <button type="button" class="secondary refresh-btn" data-url="${escapeHtml(source.url)}" data-i18n="optionsRefresh">${t("optionsRefresh")}</button>
            <button type="button" class="danger remove-btn" data-url="${escapeHtml(source.url)}" data-i18n="optionsRemove">${t("optionsRemove")}</button>
          </div>
        </div>
        <textarea readonly>${source.data ? escapeHtml(config.jsonToYaml(source.data)) : ''}</textarea>
      </div>
    `;
  }).join("");

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
  if (busy) return;
  
  const raw = textarea.value;

  if (raw.trim() === '') {
    setBusy(true);
    try {
      sources = sources.filter(s => s.url !== "local");
      await config.saveSources(sources);
      setLocalStatus(t("statusSaved", formatTime(new Date())), "ok");
    } finally {
      setBusy(false);
    }
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

  setBusy(true);
  try {
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
    setLocalStatus(t("statusSaved", formatTime(new Date())), "ok");
  } finally {
    setBusy(false);
  }
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

  setBusy(true);
  try {
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
    setRemoteStatus("", "muted");
  } finally {
    setBusy(false);
  }
}

async function refreshSource(url) {
  if (busy) return;
  
  setBusy(true);
  try {
    setRemoteStatus("", "muted");
    const card = remoteSourcesEl.querySelector(`[data-url="${CSS.escape(url)}"]`);
    const meta = card.querySelector('.source-meta');
    meta.className = 'source-meta muted';
    meta.textContent = t("statusRefreshing");

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
  } finally {
    setBusy(false);
  }
}

async function removeSource(url) {
  if (busy) return;
  
  setBusy(true);
  try {
    sources = sources.filter(s => s.url !== url);
    await config.saveSources(sources);
    renderRemoteSources();
    setRemoteStatus("", "muted");
  } finally {
    setBusy(false);
  }
}

async function refreshAll() {
  if (busy) return;
  
  const remote = config.getRemoteSources(sources);
  if (remote.length === 0) return;

  setBusy(true);
  try {
    setRemoteStatus("", "muted");

    // Show refreshing state on all sources
    for (const source of remote) {
      const card = remoteSourcesEl.querySelector(`[data-url="${CSS.escape(source.url)}"]`);
      if (card) {
        const meta = card.querySelector('.source-meta');
        meta.className = 'source-meta muted';
        meta.textContent = t("statusRefreshing");
      }
    }

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
      setRemoteStatus(t("statusRefreshAllFailed"), "error");
    } else {
      setRemoteStatus(t("statusFetched"), "ok");
    }
  } finally {
    setBusy(false);
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

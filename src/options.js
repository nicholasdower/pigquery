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

// Shortcuts elements
const shortcutInsertBtn = el("shortcut-insertSnippet");
const resetShortcutsBtn = el("resetShortcuts");
const shortcutsStatusEl = el("shortcutsStatus");

let sources = [];
let busy = null; // Current operation: 'refreshing', 'adding', or null
let lastLoadedLocal = ""; // Track the last loaded local config to detect unsaved edits
let shortcuts = {}; // Current shortcut configuration
let recordingShortcut = null; // Which shortcut is being recorded ('insertSnippet' or null)

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
  // Shortcut buttons - disabled when busy (unless currently recording that shortcut)
  shortcutInsertBtn.disabled = !!busy && recordingShortcut !== 'insertSnippet';
  resetShortcutsBtn.disabled = !!busy;
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

function setShortcutsStatus(message, kind = "muted") {
  shortcutsStatusEl.className = "status " + kind;
  shortcutsStatusEl.textContent = message;
}

const isMac = navigator.userAgentData?.platform === 'macOS';

/**
 * Formats a shortcut object as a human-readable string.
 * e.g., { key: 'Y', ctrl: true, shift: true } -> "Ctrl+Shift+Y"
 */
function formatShortcut(shortcut) {
  const parts = [];
  if (shortcut.ctrl) parts.push("Ctrl");
  if (shortcut.alt) parts.push("Alt");
  if (shortcut.shift) parts.push("Shift");
  if (shortcut.meta) parts.push(isMac ? "⌘" : "Win");
  parts.push(shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key);
  return parts.join("+");
}

/**
 * Updates the shortcut button displays with current shortcuts.
 */
function updateShortcutButtons() {
  if (recordingShortcut === 'insertSnippet') {
    shortcutInsertBtn.textContent = t("shortcutRecording") || "Press keys...";
  } else {
    shortcutInsertBtn.textContent = formatShortcut(shortcuts.insertSnippet);
  }
}

/**
 * Loads shortcuts from storage and updates the UI.
 */
async function loadShortcuts() {
  shortcuts = await config.loadShortcuts();
  updateShortcutButtons();
}

/**
 * Starts recording a shortcut for the given key.
 */
function startRecording(shortcutKey) {
  if (busy) return;
  recordingShortcut = shortcutKey;
  updateShortcutButtons();
  updateButtonStates();
}

/**
 * Cancels the current shortcut recording.
 */
function cancelRecording() {
  recordingShortcut = null;
  updateShortcutButtons();
  updateButtonStates();
}

/**
 * Converts a KeyboardEvent.code to a readable key name.
 * e.g., "KeyO" -> "o", "Digit1" -> "1", "BracketLeft" -> "["
 */
function codeToKey(code) {
  if (code.startsWith("Key")) return code.slice(3).toLowerCase();
  if (code.startsWith("Digit")) return code.slice(5);
  const specialKeys = {
    Backquote: "`", Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]",
    Backslash: "\\", Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/",
    Space: "Space", Enter: "Enter", Tab: "Tab", Backspace: "Backspace",
    ArrowUp: "ArrowUp", ArrowDown: "ArrowDown", ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight",
    Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown",
    Insert: "Insert", Delete: "Delete",
  };
  return specialKeys[code] || code;
}

/**
 * Handles a keydown event during shortcut recording.
 */
function handleShortcutKeydown(e) {
  if (!recordingShortcut) return;

  // Escape cancels recording
  if (e.code === "Escape") {
    e.preventDefault();
    cancelRecording();
    return;
  }

  // Ignore modifier-only keypresses
  if (["ControlLeft", "ControlRight", "AltLeft", "AltRight", "ShiftLeft", "ShiftRight", "MetaLeft", "MetaRight"].includes(e.code)) {
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  const newShortcut = {
    code: e.code,
    key: codeToKey(e.code),
    ctrl: e.ctrlKey,
    alt: e.altKey,
    shift: e.shiftKey,
    meta: e.metaKey
  };

  const shortcutKey = recordingShortcut;
  recordingShortcut = null;

  // Update local state immediately
  shortcuts[shortcutKey] = newShortcut;
  updateShortcutButtons();

  // Save through service worker
  saveShortcuts();
}

/**
 * Saves the current shortcuts configuration.
 */
async function saveShortcuts() {
  if (busy) return;

  const result = await chrome.runtime.sendMessage({ action: "saveShortcuts", shortcuts });

  if (!result.ok) {
    setShortcutsStatus(t(result.errorKey, result.errorSubs), "error");
    return;
  }

  setShortcutsStatus("", "muted");
  updateButtonStates();
}

/**
 * Resets shortcuts to defaults.
 */
async function resetShortcuts() {
  if (busy) return;

  shortcuts = { ...config.DEFAULT_SHORTCUTS };
  updateShortcutButtons();
  await saveShortcuts();
}

function formatTimestamp(ts) {
  if (!ts) return "Never";
  const date = new Date(ts);
  return date.toLocaleString();
}

/**
 * Loads just the busy state and updates UI accordingly.
 * Used when only BUSY_KEY changes, to avoid re-rendering sources.
 */
async function loadBusyState() {
  busy = await config.loadBusy();

  // Cancel recording if busy (e.g., another page triggered an operation)
  if (busy && recordingShortcut) {
    cancelRecording();
  }

  // Update refresh status based on busy state
  if (busy === 'refreshing') {
    setRefreshStatus(t("statusRefreshing"), "muted");
  } else if (busy === 'adding') {
    setRefreshStatus(t("statusFetching"), "muted");
  } else {
    setRefreshStatus("", "muted");
  }

  applyBusyState();
  updateButtonStates();
}

async function load() {
  sources = await config.loadSources();
  await loadBusyState();

  const local = config.getLocalSource(sources);
  const newLocalValue = local ? config.jsonToYaml(local.data) : "";

  // Only update the textarea if the user hasn't made unsaved edits
  const hasUnsavedEdits = textarea.value !== lastLoadedLocal;
  if (!hasUnsavedEdits) {
    textarea.value = newLocalValue;
    lastLoadedLocal = newLocalValue;
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

  const result = await chrome.runtime.sendMessage({ action: "saveLocalSource", yaml: textarea.value });

  if (!result.ok) {
    setLocalStatus(t(result.errorKey, result.errorSubs), "error");
    return;
  }

  textarea.value = result.yaml;
  lastLoadedLocal = result.yaml;
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

// Shortcut recording event listeners
shortcutInsertBtn.addEventListener("click", () => {
  if (recordingShortcut === "insertSnippet") {
    cancelRecording();
  } else {
    startRecording("insertSnippet");
  }
});
resetShortcutsBtn.addEventListener("click", () => void resetShortcuts());

document.addEventListener("keydown", (e) => {
  // Handle shortcut recording
  if (recordingShortcut) {
    handleShortcutKeydown(e);
    return;
  }

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
  if (areaName === 'local') {
    if (changes[config.STORAGE_KEY]) {
      load();
    }
    if (changes[config.BUSY_KEY]) {
      loadBusyState();
    }
    if (changes[config.SHORTCUTS_KEY]) {
      loadShortcuts();
    }
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
void loadShortcuts();
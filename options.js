window.applyI18n();

const STORAGE_KEY = "userPayload";

const el = (id) => document.getElementById(id);

const textarea = el("payload");
const saveBtn = el("save");
const statusEl = el("status");

function setStatus(message, kind = "muted") {
  statusEl.className = kind;
  statusEl.textContent = message;
}

function safeJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e };
  }
}

async function load() {
  const data = await chrome.storage.local.get([STORAGE_KEY]);
  textarea.value = data[STORAGE_KEY] ?? JSON.stringify(window.DEFAULT_CONFIG, null, 2);
  setStatus(chrome.i18n.getMessage("statusLoaded"));
}

async function save() {
  const raw = textarea.value;
  if (raw.trim() === '') {
    await chrome.storage.local.remove(STORAGE_KEY);
    textarea.value = JSON.stringify(window.DEFAULT_CONFIG, null, 2);
    setStatus(chrome.i18n.getMessage("statusSaved"), "ok");
    return;
  }

  const parsed = safeJsonParse(raw.trim() === "" ? "null" : raw);
  if (!parsed.ok) {
    setStatus(
      chrome.i18n.getMessage("statusInvalidJson", parsed.error.message),
      "error"
    );
    return;
  }
  const config = parsed.value;
  if (typeof config !== "object" || config === null) {
    setStatus(
      chrome.i18n.getMessage("statusInvalidConfigObject"),
      "error"
    );
    return;
  }
  if (!Array.isArray(config.snippets)) {
    setStatus(
      chrome.i18n.getMessage("statusInvalidConfigSnippetsArrayMissing"),
      "error"
    );
    return;
  }
  for (const option of config.snippets) {
    if (typeof option.name !== "string" || option.name.trim() === "") {
      setStatus(
        chrome.i18n.getMessage("statusInvalidConfigSnippetsNameMissing"),
        "error"
      );
      return;
    }
    if (typeof option.tag === "string" && option.tag.trim() === "") {
      setStatus(
        chrome.i18n.getMessage("statusInvalidConfigSnippetsTagEmpty"),
        "error"
      );
      return;
    }
    if (option.tag && typeof option.tag !== "string") {
      setStatus(
        chrome.i18n.getMessage("statusInvalidConfigSnippetsTagInvalid"),
        "error"
      );
      return;
    }
    if (typeof option.value !== "string" || option.value.trim() === "") {
      setStatus(
        chrome.i18n.getMessage("statusInvalidConfigSnippetsValueMissing"),
        "error"
      );
      return;
    }
  }
  if (!Array.isArray(config.sites)) {
    setStatus(
      chrome.i18n.getMessage("statusInvalidConfigSitesArrayMissing"),
      "error"
    );
    return;
  }
  for (const option of config.sites) {
    if (typeof option.name !== "string" || option.name.trim() === "") {
      setStatus(
        chrome.i18n.getMessage("statusInvalidConfigSitesNameMissing"),
        "error"
      );
      return;
    }
    if (typeof option.regex !== "string" || option.regex.trim() === "") {
      setStatus(
        chrome.i18n.getMessage("statusInvalidConfigSitesRegexMissing"),
        "error"
      );
      return;
    }
    if (typeof option.url !== "string" || option.url.trim() === "") {
      setStatus(
        chrome.i18n.getMessage("statusInvalidConfigSitesUrlMissing"),
        "error"
      );
      return;
    }
    try {
      new RegExp(option.regex);
    } catch (e) {
      setStatus(
        chrome.i18n.getMessage("statusInvalidConfigSitesRegexInvalid"),
        "error"
      );
      return;
    }
    if (!option.url.includes("%s")) {
      setStatus(
        chrome.i18n.getMessage("statusInvalidConfigSitesUrlMissingPlaceholder"),
        "error"
      );
    }
  }

  const pretty = JSON.stringify(config, null, 2);
  textarea.value = pretty;

  await chrome.storage.local.set({ [STORAGE_KEY]: pretty });

  setStatus(chrome.i18n.getMessage("statusSaved"), "ok");
}

saveBtn.addEventListener("click", () => void save());

// Ctrl/Cmd+S saves
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    void save();
  }
});

void load();

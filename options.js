const getMessage = (key, fallback, substitutions) => {
  const fn = chrome?.i18n?.getMessage;
  if (typeof fn === "function") {
    const message = fn.call(chrome.i18n, key, substitutions);
    if (message) {
      return message;
    }
  }
  return fallback ?? "";
};

function setMessage(element, key, attribute) {
  const message = chrome.i18n.getMessage(key);
  if (message) element[attribute] = message;
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((element) => setMessage(element, element.dataset.i18n, "textContent"));
  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => setMessage(element, element.dataset['i18nPlaceholder'], "placeholder"));
  document.querySelectorAll('[data-i18n-title]').forEach((element) => setMessage(element, element.dataset['i18nTitle'], "title"));
  document.querySelectorAll('[data-i18n-alt]').forEach((element) => setMessage(element, element.dataset['i18nAlt'], "alt"));
};
applyI18n();

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
  setStatus(getMessage("statusLoaded", "Loaded"));
}

async function save() {
  const raw = textarea.value;
  if (raw.trim() === '') {
    await chrome.storage.local.remove(STORAGE_KEY);
    textarea.value = JSON.stringify(window.DEFAULT_CONFIG, null, 2);
    setStatus(getMessage("statusSaved", "Saved"), "ok");
    return;
  }

  const parsed = safeJsonParse(raw.trim() === "" ? "null" : raw);
  if (!parsed.ok) {
    setStatus(
      getMessage("statusInvalidJson", `Invalid JSON: ${parsed.error.message}`, parsed.error.message),
      "error"
    );
    return;
  }
  const config = parsed.value;
  if (typeof config !== "object" || config === null) {
    setStatus(getMessage("statusInvalidConfigObject", "Invalid Config: object expected"), "error");
    return;
  }
  if (!Array.isArray(config.snippets)) {
    setStatus(
      getMessage("statusInvalidConfigSnippetsArrayMissing", "Invalid Config: snippets array missing"),
      "error"
    );
    return;
  }
  for (const option of config.snippets) {
    if (typeof option.name !== "string" || option.name.trim() === "") {
      setStatus(
        getMessage("statusInvalidConfigSnippetsNameMissing", "Invalid Config: snippets.name missing"),
        "error"
      );
      return;
    }
    if (typeof option.tag === "string" && option.tag.trim() === "") {
      setStatus(
        getMessage("statusInvalidConfigSnippetsTagEmpty", "Invalid Config: snippets.tag string empty"),
        "error"
      );
      return;
    }
    if (option.tag && typeof option.tag !== "string") {
      setStatus(
        getMessage("statusInvalidConfigSnippetsTagInvalid", "Invalid Config: snippets.tag string invalid"),
        "error"
      );
      return;
    }
    if (typeof option.value !== "string" || option.value.trim() === "") {
      setStatus(
        getMessage("statusInvalidConfigSnippetsValueMissing", "Invalid Config: snippets.value missing"),
        "error"
      );
      return;
    }
  }
  if (!Array.isArray(config.sites)) {
    setStatus(
      getMessage("statusInvalidConfigSitesArrayMissing", "Invalid Config: sites array missing"),
      "error"
    );
    return;
  }
  for (const option of config.sites) {
    if (typeof option.name !== "string" || option.name.trim() === "") {
      setStatus(
        getMessage("statusInvalidConfigSitesNameMissing", "Invalid Config: sites.name missing"),
        "error"
      );
      return;
    }
    if (typeof option.regex !== "string" || option.regex.trim() === "") {
      setStatus(
        getMessage("statusInvalidConfigSitesRegexMissing", "Invalid Config: sites.regex missing"),
        "error"
      );
      return;
    }
    if (typeof option.url !== "string" || option.url.trim() === "") {
      setStatus(
        getMessage("statusInvalidConfigSitesUrlMissing", "Invalid Config: sites.url missing"),
        "error"
      );
      return;
    }
    try {
      new RegExp(option.regex);
    } catch (e) {
      setStatus(
        getMessage("statusInvalidConfigSitesRegexInvalid", "Invalid Config: sites.regex invalid"),
        "error"
      );
      return;
    }
    if (!option.url.includes("%s")) {
      setStatus(
        getMessage(
          "statusInvalidConfigSitesUrlMissingPlaceholder",
          "Invalid Config: sites.url must include %s"
        ),
        "error"
      );
    }
  }

  const pretty = JSON.stringify(config, null, 2);
  textarea.value = pretty;

  await chrome.storage.local.set({ [STORAGE_KEY]: pretty });

  setStatus(getMessage("statusSaved", "Saved"), "ok");
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

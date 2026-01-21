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
  textarea.value = data[STORAGE_KEY] ?? JSON.stringify(common.defaultConfig(), null, 2);
  setStatus(t("statusLoaded"));
}

async function save() {
  const raw = textarea.value;
  if (raw.trim() === '') {
    await chrome.storage.local.remove(STORAGE_KEY);
    textarea.value = JSON.stringify(common.defaultConfig(), null, 2);
    setStatus(t("statusSaved"), "ok");
    return;
  }

  const parsed = safeJsonParse(raw.trim() === "" ? "null" : raw);
  if (!parsed.ok) {
    setStatus(
      t("statusInvalidJson", parsed.error.message),
      "error"
    );
    return;
  }
  const config = parsed.value;
  if (!Array.isArray(config)) {
    setStatus(
      t("statusInvalidConfigArray"),
      "error"
    );
    return;
  }
  for (const option of config) {
    if (typeof option.type !== "string" || option.type.trim() === "") {
      setStatus(
        t("statusInvalidConfigTypeMissing"),
        "error"
      );
      return;
    }
    if (option.type.trim() !== "snippet" && option.type.trim() !== "site") {
      setStatus(
        t("statusInvalidConfigTypeInvalid", option.type),
        "error"
      );
      return;
    }
    if (typeof option.name !== "string" || option.name.trim() === "") {
      setStatus(
        t("statusInvalidConfigNameMissing", option.type),
        "error"
      );
      return;
    }
    if (typeof option.tag === "string" && option.tag.trim() === "") {
      setStatus(
        t("statusInvalidConfigTagInvalid", option.type),
        "error"
      );
      return;
    }
    if (option.tag && typeof option.tag !== "string") {
      setStatus(
        t("statusInvalidConfigTagInvalid", option.type),
        "error"
      );
      return;
    }
    if (typeof option.group !== "string" || option.group.trim() === "") {
      setStatus(
        t("statusInvalidConfigGroupMissing", option.type),
        "error"
      );
      return;
    }
    if (option.type === "snippet") {
      if (typeof option.value !== "string" || option.value.trim() === "") {
        setStatus(
          t("statusInvalidConfigSnippetsValueMissing"),
          "error"
        );
        return;
      }
    }
    if (option.type === "site") {
      if (typeof option.regex !== "string" || option.regex.trim() === "") {
        setStatus(
          t("statusInvalidConfigSitesRegexMissing"),
          "error"
        );
        return;
      }
      if (typeof option.url !== "string" || option.url.trim() === "") {
        setStatus(
          t("statusInvalidConfigSitesUrlMissing"),
          "error"
        );
        return;
      }
      try {
        new RegExp(option.regex);
      } catch (e) {
        setStatus(
          t("statusInvalidConfigSitesRegexInvalid"),
          "error"
        );
        return;
      }
      if (!option.url.includes("%s")) {
        setStatus(
          t("statusInvalidConfigSitesUrlMissingPlaceholder"),
          "error"
        );
      }
    }
  }

  const pretty = JSON.stringify(config, null, 2);
  textarea.value = pretty;

  await chrome.storage.local.set({ [STORAGE_KEY]: pretty });

  setStatus(t("statusSaved"), "ok");
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

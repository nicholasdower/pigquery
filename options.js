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

async function load() {
  const data = await chrome.storage.local.get([STORAGE_KEY]);
  const config = data[STORAGE_KEY] ? JSON.parse(data[STORAGE_KEY]) : common.defaultConfig();
  textarea.value = jsonToYaml(config);
  setStatus(t("statusLoaded"));
}

async function save() {
  const raw = textarea.value;
  if (raw.trim() === '') {
    await chrome.storage.local.remove(STORAGE_KEY);
    textarea.value = jsonToYaml(common.defaultConfig());
    setStatus(t("statusSaved"), "ok");
    return;
  }

  const parsed = safeYamlParse(raw);
  if (!parsed.ok) {
    setStatus(
      t("statusInvalidYaml", parsed.error.message),
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
    let type;
    if (option.regex) {
      type = "site";
    } else {
      type = "snippet";
    }
    if (typeof option.name !== "string" || option.name.trim() === "") {
      setStatus(
        t("statusInvalidConfigNameMissing", type),
        "error"
      );
      return;
    }
    if (typeof option.tag === "string" && option.tag.trim() === "") {
      setStatus(
        t("statusInvalidConfigTagInvalid", type),
        "error"
      );
      return;
    }
    if (option.tag && typeof option.tag !== "string") {
      setStatus(
        t("statusInvalidConfigTagInvalid", type),
        "error"
      );
      return;
    }
    if (typeof option.group !== "string" || option.group.trim() === "") {
      setStatus(
        t("statusInvalidConfigGroupMissing", type),
        "error"
      );
      return;
    }
    if (type === "snippet") {
      if (typeof option.value !== "string" || option.value.trim() === "") {
        setStatus(
          t("statusInvalidConfigSnippetsValueMissing"),
          "error"
        );
        return;
      }
    }
    if (type === "site") {
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

  const json = JSON.stringify(config, null, 2);
  textarea.value = jsonToYaml(config);

  await chrome.storage.local.set({ [STORAGE_KEY]: json });

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

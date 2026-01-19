const TRANSLATIONS = {
  keyboardShortcuts: {
    en: "Keyboard Shortcuts",
    de: "Tastenkombinationen",
  },
  shortcutInsert: {
    en: "Insert",
    de: "Einsetzen",
  },
  shortcutShare: {
    en: "Share",
    de: "Teilen",
  },
  shortcutOpenSite: {
    en: "Open site",
    de: "Website öffnen",
  },
  shortcutCopyCell: {
    en: "Copy cell",
    de: "Zelle kopieren",
  },
  extensionOptions: {
    en: "Extension Options",
    de: "Erweiterungsoptionen",
  },
  optionsPlaceholder: {
    en: "Enter configuration",
    de: "Konfiguration eingeben",
  },
  optionsSave: {
    en: "Save",
    de: "Speichern",
  },
  statusLoaded: {
    en: "Loaded",
    de: "Geladen",
  },
  statusSaved: {
    en: "Saved",
    de: "Gespeichert",
  },
  statusInvalidJson: {
    en: "Invalid JSON: $1",
    de: "Ungültiges JSON: $1",
  },
  statusInvalidConfigObject: {
    en: "Invalid Config: object expected",
    de: "Ungültige Konfiguration: Objekt erwartet",
  },
  statusInvalidConfigSnippetsArrayMissing: {
    en: "Invalid Config: snippets array missing",
    de: "Ungültige Konfiguration: snippets Array fehlt",
  },
  statusInvalidConfigSnippetsNameMissing: {
    en: "Invalid Config: snippets[].name string missing",
    de: "Ungültige Konfiguration: snippets[].name String fehlt",
  },
  statusInvalidConfigSnippetsTagEmpty: {
    en: "Invalid Config: snippets[].tag string empty",
    de: "Ungültige Konfiguration: snippets[].tag String leer",
  },
  statusInvalidConfigSnippetsTagInvalid: {
    en: "Invalid Config: snippets[].tag string invalid",
    de: "Ungültige Konfiguration: snippets[].tag String ungültig",
  },
  statusInvalidConfigSnippetsValueMissing: {
    en: "Invalid Config: snippets[].value string missing",
    de: "Ungültige Konfiguration: snippets[].value String fehlt",
  },
  statusInvalidConfigSitesArrayMissing: {
    en: "Invalid Config: sites array missing",
    de: "Ungültige Konfiguration: sites Array fehlt",
  },
  statusInvalidConfigSitesNameMissing: {
    en: "Invalid Config: sites[].name string missing",
    de: "Ungültige Konfiguration: sites[].name String fehlt",
  },
  statusInvalidConfigSitesRegexMissing: {
    en: "Invalid Config: sites[].regex string missing",
    de: "Ungültige Konfiguration: sites[].regex String fehlt",
  },
  statusInvalidConfigSitesUrlMissing: {
    en: "Invalid Config: sites[].url string missing",
    de: "Ungültige Konfiguration: sites[].url String fehlt",
  },
  statusInvalidConfigSitesRegexInvalid: {
    en: "Invalid Config: sites[].regex invalid",
    de: "Ungültige Konfiguration: sites[].regex ungültig",
  },
  statusInvalidConfigSitesUrlMissingPlaceholder: {
    en: "Invalid Config: sites[].url must include %s",
    de: "Ungültige Konfiguration: sites[].url muss %s enthalten",
  },
};

function getSystemLocale() {
  return chrome.i18n.getUILanguage()
}

function getBigQueryLocale() {
  return "en";
}

function normalizeLocale(locale) {
  return locale?.trim()?.toLowerCase()?.split(/[-_]/)[0] || "en";
}

function formatMessage(template, substitutions) {
  if (!Array.isArray(substitutions)) {
    substitutions = substitutions === undefined ? [] : [substitutions];
  }
  return substitutions.reduce((current, value, index) => {
    const pattern = new RegExp(`\\$${index + 1}`, "g");
    return current.replace(pattern, String(value));
  }, template);
}

function getMessage(key, locale, substitutions) {
  if (!TRANSLATIONS[key]) throw new Error(`Missing translation key \"${key}\"`);

  for (const candidate of [locale, "en"]) {
    const message = TRANSLATIONS[key][candidate];
    if (message) return formatMessage(message, substitutions);
  }
  throw new Error(`Missing "en" for translation key \"${key}\"`);
}

function setMessage(element, key, attribute, locale, substitutions) {
  element[attribute] = getMessage(key, locale, substitutions);
}

function applyI18n(locale) {
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    setMessage(element, element.dataset.i18n, "textContent", locale);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    setMessage(element, element.dataset.i18nPlaceholder, "placeholder", locale);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((element) => {
    setMessage(element, element.dataset.i18nTitle, "title", locale);
  });
  document.querySelectorAll("[data-i18n-alt]").forEach((element) => {
    setMessage(element, element.dataset.i18nAlt, "alt", locale);
  });
}

window.i18n = {
  getBigQueryLocale,
  getSystemLocale,
  getMessage,
  applyI18n,
};
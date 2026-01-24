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
  statusInvalidYaml: {
    en: "Invalid YAML: $1",
    de: "Ungültiges YAML: $1",
  },
  statusInvalidConfigObject: {
    en: "Invalid Config: array expected",
    de: "Ungültige Konfiguration: Array erwartet",
  },
  statusInvalidConfigNameMissing: {
    en: "Invalid Config: $1 name missing",
    de: "Ungültige Konfiguration: $1 name fehlt",
  },
  statusInvalidConfigTagInvalid: {
    en: "Invalid Config: $1 tag invalid",
    de: "Ungültige Konfiguration: $1 tag ungültig",
  },
  statusInvalidConfigGroupMissing: {
    en: "Invalid Config: $1 group missing",
    de: "Ungültige Konfiguration: $1 group fehlt",
  },
  statusInvalidConfigSnippetsValueMissing: {
    en: "Invalid Config: snippet value missing",
    de: "Ungültige Konfiguration: snippet value fehlt",
  },
  statusInvalidConfigSitesRegexMissing: {
    en: "Invalid Config: site regex missing",
    de: "Ungültige Konfiguration: site regex fehlt",
  },
  statusInvalidConfigSitesUrlMissing: {
    en: "Invalid Config: site url missing",
    de: "Ungültige Konfiguration: site url fehlt",
  },
  statusInvalidConfigSitesRegexInvalid: {
    en: "Invalid Config: site regex invalid",
    de: "Ungültige Konfiguration: site regex ungültig",
  },
  statusInvalidConfigSitesUrlMissingPlaceholder: {
    en: "Invalid Config: site.url must include %s",
    de: "Ungültige Konfiguration: site.url muss %s enthalten",
  },
  searchPlaceholder: {
    en: "Search…",
    de: "Suchen…",
  },
  cellCopied: {
    en: "Cell copied to clipboard.",
    de: "Zelle in die Zwischenablage kopiert.",
  },
  editorNotFocused: {
    en: "Editor not focused.",
    de: "Editor nicht fokussiert.",
  },
  linkCopied: {
    en: "Link copied to clipboard.",
    de: "Link in die Zwischenablage kopiert.",
  },
  noOptionsFound: {
    en: "No options found.",
    de: "Keine Optionen gefunden.",
  },
  optionsAddUrl: {
    en: "Add URL",
    de: "URL hinzufügen",
  },
  optionsUrlPlaceholder: {
    en: "Enter YAML URL",
    de: "YAML-URL eingeben",
  },
  optionsLocalConfig: {
    en: "Local Configuration",
    de: "Lokale Konfiguration",
  },
  optionsRemoteSources: {
    en: "Remote Sources",
    de: "Remote-Quellen",
  },
  optionsLastUpdated: {
    en: "Last updated: $1",
    de: "Zuletzt aktualisiert: $1",
  },
  optionsRefresh: {
    en: "Refresh",
    de: "Aktualisieren",
  },
  optionsRemove: {
    en: "Remove",
    de: "Entfernen",
  },
  optionsRefreshAll: {
    en: "Refresh All",
    de: "Alle aktualisieren",
  },
  statusFetching: {
    en: "Fetching...",
    de: "Wird abgerufen...",
  },
  statusFetched: {
    en: "Fetched successfully",
    de: "Erfolgreich abgerufen",
  },
  statusFetchError: {
    en: "Fetch error: $1",
    de: "Abruffehler: $1",
  },
  statusPermissionDenied: {
    en: "Permission denied for this URL",
    de: "Zugriff auf diese URL verweigert",
  },
  statusUrlAdded: {
    en: "URL added",
    de: "URL hinzugefügt",
  },
  statusUrlRemoved: {
    en: "URL removed",
    de: "URL entfernt",
  },
  statusInvalidUrl: {
    en: "Invalid URL",
    de: "Ungültige URL",
  },
  statusInvalidConfigArray: {
    en: "Invalid Config: array expected",
    de: "Ungültige Konfiguration: Array erwartet",
  },
  optionsExample: {
    en: "Example",
    de: "Beispiel",
  },
  popupOldestUpdate: {
    en: "Oldest update: $1",
    de: "Älteste Aktualisierung: $1",
  },
  popupHasErrors: {
    en: "Some sources have errors",
    de: "Einige Quellen haben Fehler",
  }
};

function getSystemLocale() {
  return chrome.i18n.getUILanguage()
}

function getBigQueryLocale() {
  return document.documentElement.lang?.trim()?.toLowerCase()?.split(/[-_]/)[0] || "en";
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

window.pigquery ||= {};
window.pigquery.i18n = {
  getBigQueryLocale,
  getSystemLocale,
  getMessage,
  applyI18n,
};

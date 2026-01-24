const TRANSLATIONS = {
  // popup.html: Header title
  keyboardShortcuts: {
    en: "Keyboard Shortcuts",
    de: "Tastenkombinationen",
  },
  // popup.html: Shortcut label for insert snippet into editor
  shortcutInsert: {
    en: "Insert",
    de: "Einsetzen",
  },
  // popup.html: Shortcut label for create share link
  shortcutShare: {
    en: "Share",
    de: "Teilen",
  },
  // popup.html: Shortcut label for opening external site
  shortcutOpenSite: {
    en: "Open site",
    de: "Website öffnen",
  },
  // popup.html: Shortcut label for copy table cell
  shortcutCopyCell: {
    en: "Copy cell",
    de: "Zelle kopieren",
  },
  // popup.html: Footer link to extension options page
  extensionOptions: {
    en: "Extension Options",
    de: "Erweiterungsoptionen",
  },
  // options.html: Local configuration textarea placeholder
  optionsPlaceholder: {
    en: "Enter configuration",
    de: "Konfiguration eingeben",
  },
  // options.html: Save local configuration button
  optionsSave: {
    en: "Save",
    de: "Speichern",
  },
  // options.js: Status after configurations are successfully loaded from storage
  statusLoaded: {
    en: "Loaded",
    de: "Geladen",
  },
  // options.js: Status after saving local configuration to storage
  statusSaved: {
    en: "Saved",
    de: "Gespeichert",
  },
  // options.js, config.js: YAML parse error. $1 = error message
  statusInvalidYaml: {
    en: "Invalid YAML: $1",
    de: "Ungültiges YAML: $1",
  },
  // config.js: YAML validation error. $1 = "snippet" or "site"
  statusInvalidConfigNameMissing: {
    en: "Invalid Config: $1 name missing",
    de: "Ungültige Konfiguration: $1 name fehlt",
  },
  // config.js: YAML validation error. $1 = "snippet" or "site"
  statusInvalidConfigTagInvalid: {
    en: "Invalid Config: $1 tag invalid",
    de: "Ungültige Konfiguration: $1 tag ungültig",
  },
  // config.js: YAML validation error. $1 = "snippet" or "site"
  statusInvalidConfigGroupMissing: {
    en: "Invalid Config: $1 group missing",
    de: "Ungültige Konfiguration: $1 group fehlt",
  },
  // config.js: YAML validation error for snippet
  statusInvalidConfigSnippetsValueMissing: {
    en: "Invalid Config: snippet value missing",
    de: "Ungültige Konfiguration: snippet value fehlt",
  },
  // config.js: YAML validation error for site
  statusInvalidConfigSitesRegexMissing: {
    en: "Invalid Config: site regex missing",
    de: "Ungültige Konfiguration: site regex fehlt",
  },
  // config.js: YAML validation error for site
  statusInvalidConfigSitesUrlMissing: {
    en: "Invalid Config: site url missing",
    de: "Ungültige Konfiguration: site url fehlt",
  },
  // config.js: YAML validation error for site
  statusInvalidConfigSitesRegexInvalid: {
    en: "Invalid Config: site regex invalid",
    de: "Ungültige Konfiguration: site regex ungültig",
  },
  // config.js: YAML validation error for site
  statusInvalidConfigSitesUrlMissingPlaceholder: {
    en: "Invalid Config: site.url must include %s",
    de: "Ungültige Konfiguration: site.url muss %s enthalten",
  },
  // content.js: Modal search input placeholder
  searchPlaceholder: {
    en: "Search…",
    de: "Suchen…",
  },
  // content.js: Toast after copying table cell to clipboard
  cellCopied: {
    en: "Cell copied to clipboard.",
    de: "Zelle in die Zwischenablage kopiert.",
  },
  // content.js: Toast when editor not focused while trying to trigger insertion or share link creation
  editorNotFocused: {
    en: "Editor not focused.",
    de: "Editor nicht fokussiert.",
  },
  // content.js: Toast after copying share link to clipboard
  linkCopied: {
    en: "Link copied to clipboard.",
    de: "Link in die Zwischenablage kopiert.",
  },
  // content.js: Modal empty state when no snippets or sites match the search query or none are configured
  noOptionsFound: {
    en: "No options found.",
    de: "Keine Optionen gefunden.",
  },
  // options.html: Add remote YAML source button
  optionsAddUrl: {
    en: "Add URL",
    de: "URL hinzufügen",
  },
  // options.html: YAML source URL input placeholder
  optionsUrlPlaceholder: {
    en: "Enter YAML URL",
    de: "YAML-URL eingeben",
  },
  // options.html: Section header for local YAML configuration
  optionsLocalConfig: {
    en: "Local Configuration",
    de: "Lokale Konfiguration",
  },
  // options.html: Section header for remote YAML sources
  optionsRemoteSources: {
    en: "Remote Sources",
    de: "Remote-Quellen",
  },
  // options.js: Remote sources last updated timestamp. $1 = formatted date
  optionsLastUpdated: {
    en: "Last updated: $1",
    de: "Zuletzt aktualisiert: $1",
  },
  // options.js: Refresh button for individual remote YAML source
  optionsRefresh: {
    en: "Refresh",
    de: "Aktualisieren",
  },
  // options.js: Remove button for individual remote YAML source
  optionsRemove: {
    en: "Remove",
    de: "Entfernen",
  },
  // options.html: Refresh all remote YAML sources button
  optionsRefreshAll: {
    en: "Refresh All",
    de: "Alle aktualisieren",
  },
  // options.js: Status while fetching remote YAML source
  statusFetching: {
    en: "Fetching...",
    de: "Wird abgerufen...",
  },
  // options.js: Status after successful fetch of remote YAML source
  statusFetched: {
    en: "Fetched successfully",
    de: "Erfolgreich abgerufen",
  },
  // options.js, config.js: Error fetching remote YAML source. $1 = error details
  statusFetchError: {
    en: "Fetch error: $1",
    de: "Abruffehler: $1",
  },
  // options.js: Permission denied by user for access to remote YAML source URL
  statusPermissionDenied: {
    en: "Permission denied for this URL",
    de: "Zugriff auf diese URL verweigert",
  },
  // options.js: Status after adding remote YAML source URL
  statusUrlAdded: {
    en: "URL added",
    de: "URL hinzugefügt",
  },
  // options.js: Status after removing remote YAML source URL
  statusUrlRemoved: {
    en: "URL removed",
    de: "URL entfernt",
  },
  // options.js: Invalid YAML source URL error
  statusInvalidUrl: {
    en: "Invalid URL",
    de: "Ungültige URL",
  },
  // config.js: Validation error when YAML configuration is not an array
  statusInvalidConfigArray: {
    en: "Invalid Config: array expected",
    de: "Ungültige Konfiguration: Array erwartet",
  },
  // options.html: Section header for example YAML configuration
  optionsExample: {
    en: "Example",
    de: "Beispiel",
  },
  // popup.js: Shows oldest remote source update time. $1 = formatted date
  popupOldestUpdate: {
    en: "Oldest update: $1",
    de: "Älteste Aktualisierung: $1",
  },
  // popup.js: Error indicator when there were one or more errors refreshing remote YAML sources
  popupHasErrors: {
    en: "Some sources have errors",
    de: "Einige Quellen haben Fehler",
  },
  // popup.js: Refresh button used to refresh all remote YAML sources
  popupRefresh: {
    en: "Refresh",
    de: "Aktualisieren",
  },
  // popup.js: Refresh button state while refreshing remote YAML sources
  popupRefreshing: {
    en: "Refreshing…",
    de: "Wird aktualisiert…",
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

self.pigquery ||= {};
self.pigquery.i18n = {
  getBigQueryLocale,
  getSystemLocale,
  getMessage,
  applyI18n,
};

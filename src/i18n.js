const TRANSLATIONS = {
  // popup.html: Header title
  keyboardShortcuts: {
    en: "Keyboard Shortcuts",
    de: "Tastenkombinationen",
  },
  // popup.html: Shortcut label for insert snippet into editor
  shortcutInsert: {
    en: "Insert",
    de: "Einfügen",
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
  // popup.html: Shortcut label for focus table
  shortcutFocusTable: {
    en: "Toggle editor/table",
    de: "Editor/Tabelle umschalten",
  },
  // content.js: Toast when no table is found when trying to focus
  tableNotFound: {
    en: "No table found.",
    de: "Keine Tabelle gefunden.",
  },
  // popup.html: Footer link to extension options page
  extensionOptions: {
    en: "Configuration",
    de: "Konfiguration",
  },
  // popup.html: Footer link to report a bug
  reportBug: {
    en: "Report a Bug",
    de: "Fehler melden",
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
  // options.js: Status after saving local configuration to storage. $1 = time
  statusSaved: {
    en: "Saved at $1",
    de: "Gespeichert um $1",
  },
  // options.js, config.js: YAML parse error. $1 = error message
  statusInvalidYaml: {
    en: "Invalid YAML: $1",
    de: "Ungültiges YAML: $1",
  },
  // config.js: YAML validation error. $1 = "snippet" or "site"
  statusInvalidConfigNameMissing: {
    en: "Invalid Config: $1 name missing",
    de: "Ungültige Konfiguration: name für $1 fehlt",
  },
  // config.js: YAML validation error. $1 = "snippet" or "site"
  statusInvalidConfigTagInvalid: {
    en: "Invalid Config: $1 tag invalid",
    de: "Ungültige Konfiguration: tag für $1 ist ungültig",
  },
  // config.js: YAML validation error. $1 = "snippet" or "site"
  statusInvalidConfigGroupMissing: {
    en: "Invalid Config: $1 group missing",
    de: "Ungültige Konfiguration: group für $1 fehlt",
  },
  // config.js: YAML validation error for snippet
  statusInvalidConfigSnippetsValueMissing: {
    en: "Invalid Config: snippet value missing",
    de: "Ungültige Konfiguration: value für snippet fehlt",
  },
  // config.js: YAML validation error for site
  statusInvalidConfigSitesRegexMissing: {
    en: "Invalid Config: site regex missing",
    de: "Ungültige Konfiguration: regex für site fehlt",
  },
  // config.js: YAML validation error for site
  statusInvalidConfigSitesUrlMissing: {
    en: "Invalid Config: site url missing",
    de: "Ungültige Konfiguration: url für site fehlt",
  },
  // config.js: YAML validation error for site
  statusInvalidConfigSitesRegexInvalid: {
    en: "Invalid Config: site regex invalid",
    de: "Ungültige Konfiguration: regex für site ist ungültig",
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
    de: "Editor ist nicht fokussiert.",
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
    en: "Last updated at $1",
    de: "Zuletzt aktualisiert um $1",
  },
  // options.js: Remote sources last updated with error. $1 = formatted date, $2 = error message
  optionsLastUpdatedError: {
    en: "Last updated at $1 — $2",
    de: "Zuletzt aktualisiert um $1 — $2",
  },
  // options.js: Status while refreshing remote YAML source
  statusRefreshing: {
    en: "Refreshing…",
    de: "Wird aktualisiert…",
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
  // options.js: Status when some sources failed during refresh all. $1 = count
  statusRefreshAllFailed: {
    en: "Some sources have errors",
    de: "Einige Quellen haben Fehler",
  },
  // options.js: Permission denied for access to remote YAML source URL
  statusPermissionDenied: {
    en: "Permission denied for this URL",
    de: "Zugriff auf diese URL verweigert",
  },
  // options.js: Invalid YAML source URL error
  statusInvalidUrl: {
    en: "Invalid URL",
    de: "Ungültige URL",
  },
  // options.js: Error when trying to add a URL that already exists
  statusUrlExists: {
    en: "URL already exists",
    de: "URL existiert bereits",
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
  // popup.js: Remote sources last updated timestamp. $1 = formatted date
  popupLastUpdated: {
    en: "Last updated at $1",
    de: "Zuletzt aktualisiert um $1",
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
  },
  // content.js: Copy button in content panel
  copy: {
    en: "Copy",
    de: "Kopieren",
  },
  // content.js: Toast after copying formatted content to clipboard
  contentCopied: {
    en: "Copied to clipboard.",
    de: "In die Zwischenablage kopiert.",
  },
  // content.js: Copy original button in content panel (when formatted differs from original)
  copyOriginal: {
    en: "Copy Original",
    de: "Original kopieren",
  },
  // options.html: Header for insert snippet shortcut section
  shortcutInsertSnippet: {
    en: "Insert",
    de: "Einfügen",
  },
  // options.js: Shortcut button text when recording a new shortcut
  shortcutRecording: {
    en: "Press keys…",
    de: "Tasten drücken…",
  },
  // options.html: Footer link to BigQuery
  footerBigQuery: {
    en: "BigQuery",
    de: "BigQuery",
  },
  // options.html: Footer link to Chrome Web Store
  footerStore: {
    en: "Store",
    de: "Store",
  },
  // options.html: Footer link to source code
  footerSource: {
    en: "Source",
    de: "Quellcode",
  },
  // options.html: Footer link to report a bug
  footerBug: {
    en: "Bug",
    de: "Fehler",
  },
  // formatters.js: Type name for JSON
  typeJson: {
    en: "JSON",
    de: "JSON",
  },
  // formatters.js: Type name for JWT
  typeJwt: {
    en: "JWT",
    de: "JWT",
  },
  // formatters.js: Type name for UUID
  typeUuid: {
    en: "UUID",
    de: "UUID",
  },
  // formatters.js: Type name for Date
  typeDate: {
    en: "Date",
    de: "Datum",
  },
  // formatters.js: Type name for Number
  typeNumber: {
    en: "Number",
    de: "Zahl",
  },
  // formatters.js: Type name for Timestamp (Milliseconds)
  typeTimestampMilliseconds: {
    en: "Timestamp (Milliseconds)",
    de: "Zeitstempel (Millisekunden)",
  },
  // formatters.js: Type name for Timestamp (Seconds)
  typeTimestampSeconds: {
    en: "Timestamp (Seconds)",
    de: "Zeitstempel (Sekunden)",
  },
  // formatters.js: Type name for URL
  typeUrl: {
    en: "URL",
    de: "URL",
  },
  // formatters.js: Type name for XML
  typeXml: {
    en: "XML",
    de: "XML",
  },
  // formatters.js: Type name for YAML
  typeYaml: {
    en: "YAML",
    de: "YAML",
  },
  // formatters.js: Type name for Base64
  typeBase64: {
    en: "Base64",
    de: "Base64",
  },
  // formatters.js: Type name for Hex
  typeHex: {
    en: "Hex",
    de: "Hex",
  },
  // formatters.js: Label for original content
  original: {
    en: "Original",
    de: "Original",
  },
  // formatters.js: Label for formatted content
  formatted: {
    en: "Formatted",
    de: "Formatiert",
  },
  // formatters.js: Label for decoded content
  decoded: {
    en: "Decoded",
    de: "Dekodiert",
  },
  // formatters.js: Label for date in ISO 8601 format
  date: {
    en: "ISO 8601",
    de: "ISO 8601",
  },
  // formatters.js: Label for localized date
  dateLocalized: {
    en: "Localized",
    de: "Lokalisiert",
  },
  // formatters.js: Label for milliseconds
  milliseconds: {
    en: "Milliseconds",
    de: "Millisekunden",
  },
  // formatters.js: Label for JWT signature
  signature: {
    en: "Signature",
    de: "Signatur",
  },
  // formatters.js: Label for JWT issued time
  issued: {
    en: "Issued",
    de: "Ausgestellt",
  },
  // formatters.js: Label for JWT expiration time
  expires: {
    en: "Expires",
    de: "Läuft ab",
  },
  // formatters.js: Label for JWT not before time
  notBefore: {
    en: "Not Before",
    de: "Nicht vor",
  },
  // formatters.js: Label for URL protocol
  protocol: {
    en: "Protocol",
    de: "Protokoll",
  },
  // formatters.js: Label for URL path
  path: {
    en: "Path",
    de: "Pfad",
  },
  // formatters.js: Label for JWT header
  header: {
    en: "Header",
    de: "Header",
  },
  // formatters.js: Label for JWT payload
  payload: {
    en: "Payload",
    de: "Payload",
  },
  // formatters.js: Label for URL host
  host: {
    en: "Host",
    de: "Host",
  },
  // formatters.js: Label for URL port
  port: {
    en: "Port",
    de: "Port",
  },
  // formatters.js: Label for URL fragment
  fragment: {
    en: "Fragment",
    de: "Fragment",
  },
  // formatters.js: Label for UUID version. $1 = version info
  version: {
    en: "Version",
    de: "Version",
  },
  // formatters.js: Label for URL parameter. $1 = parameter name
  param: {
    en: "Parameter: $1",
    de: "Parameter: $1",
  },
  // formatters.js: Label for hex dump
  hexDump: {
    en: "Hex Dump",
    de: "Hexdump",
  },
  // formatters.js: Unknown value for UUID version
  unknown: {
    en: "Unknown",
    de: "Unbekannt",
  },
  // formatters.js: UUID version 1 name
  uuidVersion1: {
    en: "Time-based (MAC address)",
    de: "Zeitbasiert (MAC-Adresse)",
  },
  // formatters.js: UUID version 2 name
  uuidVersion2: {
    en: "DCE Security",
    de: "DCE-Sicherheit",
  },
  // formatters.js: UUID version 3 name
  uuidVersion3: {
    en: "Name-based (MD5)",
    de: "Namensbasiert (MD5)",
  },
  // formatters.js: UUID version 4 name
  uuidVersion4: {
    en: "Random",
    de: "Zufällig",
  },
  // formatters.js: UUID version 5 name
  uuidVersion5: {
    en: "Name-based (SHA-1)",
    de: "Namensbasiert (SHA-1)",
  }
};

function getSystemLocale() {
  return chrome.i18n.getUILanguage()
}

function getBigQueryLocale() {
  return document.documentElement.lang?.trim()?.toLowerCase()?.split(/[-_]/)[0] || getSystemLocale();
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

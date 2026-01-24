// config.js - Configuration management module
(function() {
  const STORAGE_KEY = "userPayload";

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

  /**
   * Validates an array of config items (snippets and sites).
   * Returns { ok: true } or { ok: false, errorKey, errorSubs }
   */
  function validateConfigItems(items) {
    if (!Array.isArray(items)) {
      return { ok: false, errorKey: "statusInvalidConfigArray" };
    }
    for (const option of items) {
      let type;
      if (option.regex) {
        type = "site";
      } else {
        type = "snippet";
      }
      if (typeof option.name !== "string" || option.name.trim() === "") {
        return { ok: false, errorKey: "statusInvalidConfigNameMissing", errorSubs: type };
      }
      if (typeof option.tag === "string" && option.tag.trim() === "") {
        return { ok: false, errorKey: "statusInvalidConfigTagInvalid", errorSubs: type };
      }
      if (option.tag && typeof option.tag !== "string") {
        return { ok: false, errorKey: "statusInvalidConfigTagInvalid", errorSubs: type };
      }
      if (typeof option.group !== "string" || option.group.trim() === "") {
        return { ok: false, errorKey: "statusInvalidConfigGroupMissing", errorSubs: type };
      }
      if (type === "snippet") {
        if (typeof option.value !== "string" || option.value.trim() === "") {
          return { ok: false, errorKey: "statusInvalidConfigSnippetsValueMissing" };
        }
      }
      if (type === "site") {
        if (typeof option.regex !== "string" || option.regex.trim() === "") {
          return { ok: false, errorKey: "statusInvalidConfigSitesRegexMissing" };
        }
        if (typeof option.url !== "string" || option.url.trim() === "") {
          return { ok: false, errorKey: "statusInvalidConfigSitesUrlMissing" };
        }
        try {
          new RegExp(option.regex);
        } catch (e) {
          return { ok: false, errorKey: "statusInvalidConfigSitesRegexInvalid" };
        }
        if (!option.url.includes("%s")) {
          return { ok: false, errorKey: "statusInvalidConfigSitesUrlMissingPlaceholder" };
        }
      }
    }
    return { ok: true };
  }

  /**
   * Fetches and parses YAML from a URL.
   * Returns { ok: true, value } or { ok: false, errorKey, errorSubs }
   */
  async function fetchYamlFromUrl(url) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        return { ok: false, errorKey: "statusFetchError", errorSubs: `HTTP ${response.status}: ${response.statusText}` };
      }
      const yamlText = await response.text();
      const parsed = safeYamlParse(yamlText);
      if (!parsed.ok) {
        return { ok: false, errorKey: "statusInvalidYaml", errorSubs: parsed.error.message };
      }
      const validation = validateConfigItems(parsed.value);
      if (!validation.ok) {
        return validation;
      }
      return { ok: true, value: parsed.value };
    } catch (e) {
      return { ok: false, errorKey: "statusFetchError", errorSubs: e.message };
    }
  }

  /**
   * Requests permission for a URL's origin.
   * Returns true if granted, false otherwise.
   */
  async function requestUrlPermission(url) {
    try {
      const urlObj = new URL(url);
      const origin = `${urlObj.origin}/*`;
      
      const hasPermission = await chrome.permissions.contains({ origins: [origin] });
      if (hasPermission) {
        return true;
      }
      
      return await chrome.permissions.request({ origins: [origin] });
    } catch (e) {
      return false;
    }
  }

  /**
   * Loads sources from chrome.storage.local.
   * Returns array of source objects.
   */
  async function loadSources() {
    const data = await chrome.storage.local.get([STORAGE_KEY]);
    return data[STORAGE_KEY] ? JSON.parse(data[STORAGE_KEY]) : [];
  }

  /**
   * Saves sources to chrome.storage.local.
   */
  async function saveSources(sources) {
    const json = JSON.stringify(sources, null, 2);
    await chrome.storage.local.set({ [STORAGE_KEY]: json });
  }

  /**
   * Gets the local source from sources array.
   */
  function getLocalSource(sources) {
    return sources.find(s => s.url === "local");
  }

  /**
   * Gets remote sources from sources array.
   */
  function getRemoteSources(sources) {
    return sources.filter(s => s.url !== "local");
  }

  /**
   * Refreshes all remote sources by fetching their URLs.
   * Updates storage if any sources were refreshed.
   * Returns { refreshed: number, errors: string[] }
   */
  async function refreshRemoteSources() {
    const sources = await loadSources();
    const remoteSources = getRemoteSources(sources);
    
    if (remoteSources.length === 0) {
      return { refreshed: 0, errors: [] };
    }

    let refreshedCount = 0;
    const errors = [];

    for (const source of remoteSources) {
      const result = await fetchYamlFromUrl(source.url);
      if (result.ok) {
        const index = sources.findIndex(s => s.url === source.url);
        if (index >= 0) {
          sources[index] = {
            url: source.url,
            timestamp: Date.now(),
            data: result.value
          };
          refreshedCount++;
        }
      } else {
        errors.push(`${source.url}: ${result.errorKey}`);
      }
    }

    if (refreshedCount > 0) {
      await saveSources(sources);
    }

    return { refreshed: refreshedCount, errors };
  }

  // Export to pigquery.config (works in both window and service worker contexts)
  const global = typeof window !== 'undefined' ? window : self;
  global.pigquery = global.pigquery || {};
  global.pigquery.config = {
    STORAGE_KEY,
    safeYamlParse,
    jsonToYaml,
    validateConfigItems,
    fetchYamlFromUrl,
    requestUrlPermission,
    loadSources,
    saveSources,
    getLocalSource,
    getRemoteSources,
    refreshRemoteSources
  };
})();

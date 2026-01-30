const STORAGE_KEY = "userPayload";
const BUSY_KEY = "busy";
let operationPromise = null;

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
 * Loads and processes configuration from all sources.
 * Deduplicates by name+group+tag within snippets and sites separately,
 * preferring local over remote (last definition wins).
 * Returns { snippets: [...], sites: [...], hasErrors: boolean }.
 */
async function loadConfiguration() {
  const sources = await loadSources();
  // Order remote then local, so local definitions come last and win
  const allItems = [
    ...sources.filter(s => s.url !== "local"),
    ...sources.filter(s => s.url === "local"),
  ].flatMap(source => source.data);

  // Dedupe: first occurrence order, last occurrence value
  const dedupe = (items) => {
    const map = new Map();
    for (const item of items) {
      map.set(`${item.name}\0${item.group}\0${item.tag ?? ""}\0${item.regex ?? ""}`, item);
    }
    return [...map.values()];
  };

  const hasErrors = sources.some(source => source.error != null);

  // Default built-in sites
  const defaultSites = [
    { name: 'Open URL', group: 'Default', regex: /^https?:\/\//, url: '%s', encode: false },
  ];

  const userSites = dedupe(allItems.filter(item => item.url)).map(item => ({ ...item, regex: new RegExp(item.regex) }));

  return {
    snippets: dedupe(allItems.filter(item => !item.url)),
    sites: [...userSites, ...defaultSites],
    hasErrors,
  };
}

/**
 * Saves sources to chrome.storage.local.
 */
async function saveSources(sources) {
  const json = JSON.stringify(sources, null, 2);
  await chrome.storage.local.set({ [STORAGE_KEY]: json });
}

/**
 * Saves the local source from raw YAML text.
 * Pass empty string to remove it.
 * Returns { ok: true, yaml: string } or { ok: false, errorKey, errorSubs }
 */
async function saveLocalSource(rawYaml) {
  if (operationPromise) return { ok: false, errorKey: "statusBusy" };

  const sources = await loadSources();
  const filtered = sources.filter(s => s.url !== "local");

  if (rawYaml.trim() === '') {
    await saveSources(filtered);
    return { ok: true, yaml: "" };
  }

  const parsed = safeYamlParse(rawYaml);
  if (!parsed.ok) {
    return { ok: false, errorKey: "statusInvalidYaml", errorSubs: parsed.error.message };
  }

  const validation = validateConfigItems(parsed.value);
  if (!validation.ok) {
    return { ok: false, errorKey: validation.errorKey, errorSubs: validation.errorSubs };
  }

  filtered.unshift({
    url: "local",
    timestamp: Date.now(),
    data: parsed.value
  });
  await saveSources(filtered);
  return { ok: true, yaml: jsonToYaml(parsed.value) };
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
 * Updates the busy state in local storage.
 */
async function setBusyState(type) {
  if (type) {
    await chrome.storage.local.set({ [BUSY_KEY]: type });
  } else {
    await chrome.storage.local.remove(BUSY_KEY);
  }
}

/**
 * Refreshes all remote sources by fetching their URLs.
 * Updates storage with new data or error state.
 */
async function refreshRemoteSources() {
  if (operationPromise) return;

  await setBusyState('refreshing');

  operationPromise = doRefreshRemoteSources();
  try {
    await operationPromise;
  } finally {
    operationPromise = null;
    await setBusyState(null);
  }
}

async function doRefreshRemoteSources() {
  const sources = await loadSources();
  const remoteSources = getRemoteSources(sources);

  if (remoteSources.length === 0) return;

  for (const source of remoteSources) {
    const result = await fetchYamlFromUrl(source.url);
    const index = sources.findIndex(s => s.url === source.url);
    if (index < 0) continue;

    if (result.ok) {
      sources[index] = {
        url: source.url,
        timestamp: Date.now(),
        data: result.value,
        error: null
      };
    } else {
      sources[index] = {
        ...sources[index],
        error: { key: result.errorKey, subs: result.errorSubs }
      };
    }
  }

  await saveSources(sources);
}

/**
 * Adds a new remote source by URL.
 * Queues behind any in-progress operations.
 * Returns { ok: true } or { ok: false, errorKey, errorSubs }
 */
async function addSource(url) {
  if (operationPromise) {
    return { ok: false, errorKey: "statusBusy" };
  }

  await setBusyState('adding');

  operationPromise = doAddSource(url);
  try {
    return await operationPromise;
  } finally {
    operationPromise = null;
    await setBusyState(null);
  }
}

async function doAddSource(url) {
  const sources = await loadSources();

  if (sources.find(s => s.url === url)) {
    return { ok: false, errorKey: "statusUrlExists" };
  }

  const result = await fetchYamlFromUrl(url);
  if (!result.ok) {
    return result;
  }

  sources.push({
    url: url,
    timestamp: Date.now(),
    data: result.value,
    error: null
  });

  await saveSources(sources);
  return { ok: true };
}

/**
 * Removes a source by URL.
 */
async function removeSource(url) {
  if (operationPromise) return;

  const sources = await loadSources();
  const filtered = sources.filter(s => s.url !== url);
  await saveSources(filtered);
}

self.pigquery = self.pigquery || {};
self.pigquery.config = {
  STORAGE_KEY,
  BUSY_KEY,
  jsonToYaml,
  requestUrlPermission,
  loadSources,
  loadConfiguration,
  saveLocalSource,
  getLocalSource,
  getRemoteSources,
  refreshRemoteSources,
  addSource,
  removeSource
};

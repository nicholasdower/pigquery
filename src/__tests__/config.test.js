import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import {
  STORAGE_KEY,
  BUSY_KEY,
  SHORTCUTS_KEY,
  DEFAULT_SHORTCUTS,
  formatShortcut,
  jsonToYaml,
  loadSources,
  loadConfiguration,
  saveLocalSource,
  getLocalSource,
  getRemoteSources,
  loadBusy,
  clearStaleBusy,
  refreshRemoteSources,
  addSource,
  removeSource,
  loadShortcuts,
  saveShortcuts,
} from '../config.js';

// Mock chrome.storage.local
global.chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
    },
  },
};

// Mock fetch
global.fetch = jest.fn();

// Mock navigator for formatShortcut tests
global.navigator = {
  userAgentData: undefined,
};

describe('config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('formatShortcut', () => {
    test('should format basic shortcut with Ctrl+Shift', () => {
      const shortcut = { key: 'y', ctrl: true, shift: true, alt: false, meta: false };
      expect(formatShortcut(shortcut)).toBe('Ctrl+Shift+Y');
    });

    test('should format shortcut with all modifiers on Windows', () => {
      global.navigator.userAgentData = { platform: 'Windows' };
      const shortcut = { key: 'a', ctrl: true, alt: true, shift: true, meta: true };
      expect(formatShortcut(shortcut)).toBe('Ctrl+Alt+Shift+Win+A');
    });

    test('should format shortcut with meta key on macOS', () => {
      global.navigator.userAgentData = { platform: 'macOS' };
      const shortcut = { key: 'a', ctrl: false, alt: false, shift: false, meta: true };
      expect(formatShortcut(shortcut)).toBe('⌘+A');
    });

    test('should format shortcut with only Alt key', () => {
      const shortcut = { key: 'x', ctrl: false, alt: true, shift: false, meta: false };
      expect(formatShortcut(shortcut)).toBe('Alt+X');
    });

    test('should uppercase single character keys', () => {
      const shortcut = { key: 'b', ctrl: true, shift: false, alt: false, meta: false };
      expect(formatShortcut(shortcut)).toBe('Ctrl+B');
    });

    test('should handle multi-character key names', () => {
      const shortcut = { key: 'Enter', ctrl: true, shift: false, alt: false, meta: false };
      expect(formatShortcut(shortcut)).toBe('Ctrl+Enter');
    });

    test('should handle shortcut with no modifiers', () => {
      const shortcut = { key: 'F1', ctrl: false, shift: false, alt: false, meta: false };
      expect(formatShortcut(shortcut)).toBe('F1');
    });
  });

  describe('jsonToYaml', () => {
    test('should convert simple object to YAML', () => {
      const obj = { name: 'test', value: 'hello' };
      const yaml = jsonToYaml(obj);
      expect(yaml).toContain('name: test');
      expect(yaml).toContain('value: hello');
    });

    test('should convert array to YAML', () => {
      const arr = [
        { name: 'item1', group: 'Group1', value: 'val1' },
        { name: 'item2', group: 'Group2', value: 'val2' },
      ];
      const yaml = jsonToYaml(arr);
      expect(yaml).toContain('- name: item1');
      expect(yaml).toContain('- name: item2');
    });

    test('should handle nested objects', () => {
      const obj = { outer: { inner: 'value' } };
      const yaml = jsonToYaml(obj);
      expect(yaml).toContain('outer:');
      expect(yaml).toContain('inner: value');
    });
  });

  describe('loadSources', () => {
    test('should return empty array when no sources exist', async () => {
      chrome.storage.local.get.mockResolvedValue({});
      const sources = await loadSources();
      expect(sources).toEqual([]);
      expect(chrome.storage.local.get).toHaveBeenCalledWith([STORAGE_KEY]);
    });

    test('should parse and return stored sources', async () => {
      const storedSources = [
        { url: 'local', data: [{ name: 'test', group: 'Test', value: 'val' }] },
        { url: 'https://example.com/config.yaml', data: [] },
      ];
      chrome.storage.local.get.mockResolvedValue({
        [STORAGE_KEY]: JSON.stringify(storedSources),
      });

      const sources = await loadSources();
      expect(sources).toEqual(storedSources);
    });
  });

  describe('loadConfiguration', () => {
    test('should return default sites when no sources exist', async () => {
      chrome.storage.local.get.mockResolvedValue({});

      const config = await loadConfiguration();

      expect(config.snippets).toEqual([]);
      expect(config.sites).toHaveLength(12);
      expect(config.sites[0].name).toBe('JWT');
      expect(config.hasErrors).toBe(false);
      expect(config.hasRemoteSources).toBe(false);
    });

    test('should load and separate snippets and sites', async () => {
      const sources = [
        {
          url: 'local',
          data: [
            { name: 'snippet1', group: 'Test', value: 'SELECT *' },
            { name: 'site1', group: 'Test', regex: 'test', url: 'https://example.com?q=%s' },
          ],
        },
      ];
      chrome.storage.local.get.mockResolvedValue({
        [STORAGE_KEY]: JSON.stringify(sources),
      });

      const config = await loadConfiguration();

      expect(config.snippets).toHaveLength(1);
      expect(config.snippets[0].name).toBe('snippet1');
      expect(config.sites).toHaveLength(13); // user site + default
      expect(config.sites[0].name).toBe('site1');
    });

    test('should deduplicate items by name+group+tag', async () => {
      const sources = [
        {
          url: 'https://example.com/config.yaml',
          data: [{ name: 'test', group: 'Test', value: 'remote' }],
        },
        {
          url: 'local',
          data: [{ name: 'test', group: 'Test', value: 'local' }],
        },
      ];
      chrome.storage.local.get.mockResolvedValue({
        [STORAGE_KEY]: JSON.stringify(sources),
      });

      const config = await loadConfiguration();

      expect(config.snippets).toHaveLength(1);
      // Local should win over remote
      expect(config.snippets[0].value).toBe('local');
    });

    test('should mark hasErrors when source has error', async () => {
      const sources = [
        {
          url: 'https://example.com/config.yaml',
          data: [],
          error: { key: 'statusFetchError', subs: 'Network error' },
        },
      ];
      chrome.storage.local.get.mockResolvedValue({
        [STORAGE_KEY]: JSON.stringify(sources),
      });

      const config = await loadConfiguration();

      expect(config.hasErrors).toBe(true);
    });

    test('should mark hasRemoteSources when remote sources exist', async () => {
      const sources = [
        {
          url: 'https://example.com/config.yaml',
          data: [],
        },
      ];
      chrome.storage.local.get.mockResolvedValue({
        [STORAGE_KEY]: JSON.stringify(sources),
      });

      const config = await loadConfiguration();

      expect(config.hasRemoteSources).toBe(true);
    });
  });

  describe('saveLocalSource', () => {
    test('should save valid YAML as local source', async () => {
      chrome.storage.local.get.mockResolvedValue({});
      chrome.storage.local.set.mockResolvedValue(undefined);

      const yaml = '- name: test\n  group: Test\n  value: SELECT *';
      const result = await saveLocalSource(yaml);

      expect(result.ok).toBe(true);
      expect(result.yaml).toBeTruthy();
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    test('should remove local source when empty string provided', async () => {
      const sources = [
        { url: 'local', data: [] },
        { url: 'https://example.com/config.yaml', data: [] },
      ];
      chrome.storage.local.get.mockResolvedValue({
        [STORAGE_KEY]: JSON.stringify(sources),
      });
      chrome.storage.local.set.mockResolvedValue(undefined);

      const result = await saveLocalSource('');

      expect(result.ok).toBe(true);
      expect(result.yaml).toBe('');
      // Should only save remote sources
      const savedData = JSON.parse(chrome.storage.local.set.mock.calls[0][0][STORAGE_KEY]);
      expect(savedData).toHaveLength(1);
      expect(savedData[0].url).toBe('https://example.com/config.yaml');
    });

    test('should return error for invalid YAML', async () => {
      chrome.storage.local.get.mockResolvedValue({});

      const yaml = 'invalid: yaml: syntax: error';
      const result = await saveLocalSource(yaml);

      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('statusInvalidYaml');
    });

    test('should return error for missing required fields', async () => {
      chrome.storage.local.get.mockResolvedValue({});

      const yaml = '- name: test\n  value: SELECT *'; // Missing group
      const result = await saveLocalSource(yaml);

      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('statusInvalidConfigGroupMissing');
    });

    test('should return error for invalid snippet (missing value)', async () => {
      chrome.storage.local.get.mockResolvedValue({});

      const yaml = '- name: test\n  group: Test'; // Missing value
      const result = await saveLocalSource(yaml);

      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('statusInvalidConfigSnippetsValueMissing');
    });

    test('should return error for invalid site (missing regex)', async () => {
      chrome.storage.local.get.mockResolvedValue({});

      // Item with url but whitespace-only regex - should be detected as site
      const yaml = '- name: test\n  group: Test\n  regex: "   "\n  url: https://example.com?q=%s';
      const result = await saveLocalSource(yaml);

      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('statusInvalidConfigSitesRegexMissing');
    });

    test('should return error for invalid site (missing url)', async () => {
      chrome.storage.local.get.mockResolvedValue({});

      const yaml = '- name: test\n  group: Test\n  regex: test'; // Missing url
      const result = await saveLocalSource(yaml);

      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('statusInvalidConfigSitesUrlMissing');
    });

    test('should return error for invalid regex pattern', async () => {
      chrome.storage.local.get.mockResolvedValue({});

      const yaml = '- name: test\n  group: Test\n  regex: "[invalid"\n  url: https://example.com?q=%s';
      const result = await saveLocalSource(yaml);

      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('statusInvalidConfigSitesRegexInvalid');
    });

    test('should return error for site URL missing %s placeholder', async () => {
      chrome.storage.local.get.mockResolvedValue({});

      const yaml = '- name: test\n  group: Test\n  regex: test\n  url: https://example.com'; // Missing %s
      const result = await saveLocalSource(yaml);

      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('statusInvalidConfigSitesUrlMissingPlaceholder');
    });

    test('should return error when busy', async () => {
      chrome.storage.local.get.mockResolvedValue({});
      chrome.storage.local.set.mockResolvedValue(undefined);

      // Start a save operation
      const yaml1 = '- name: test1\n  group: Test\n  value: SELECT 1';
      const promise1 = saveLocalSource(yaml1);

      // Try to start another while first is in progress
      const yaml2 = '- name: test2\n  group: Test\n  value: SELECT 2';
      const result2 = await saveLocalSource(yaml2);

      expect(result2.ok).toBe(false);
      expect(result2.errorKey).toBe('statusBusy');

      // Wait for first to complete
      await promise1;
    });

    test('should accept valid tag field', async () => {
      chrome.storage.local.get.mockResolvedValue({});
      chrome.storage.local.set.mockResolvedValue(undefined);

      const yaml = '- name: test\n  group: Test\n  tag: TABLE\n  value: SELECT *';
      const result = await saveLocalSource(yaml);

      expect(result.ok).toBe(true);
    });

    test('should reject empty tag field', async () => {
      chrome.storage.local.get.mockResolvedValue({});

      const yaml = '- name: test\n  group: Test\n  tag: ""\n  value: SELECT *';
      const result = await saveLocalSource(yaml);

      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('statusInvalidConfigTagInvalid');
    });

    test('should reject non-string tag field', async () => {
      chrome.storage.local.get.mockResolvedValue({});

      const yaml = '- name: test\n  group: Test\n  tag: 123\n  value: SELECT *';
      const result = await saveLocalSource(yaml);

      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('statusInvalidConfigTagInvalid');
    });
  });

  describe('getLocalSource', () => {
    test('should return local source when it exists', () => {
      const sources = [
        { url: 'https://example.com/config.yaml', data: [] },
        { url: 'local', data: [{ name: 'test', group: 'Test', value: 'val' }] },
      ];

      const local = getLocalSource(sources);

      expect(local).toBeDefined();
      expect(local.url).toBe('local');
    });

    test('should return undefined when no local source exists', () => {
      const sources = [{ url: 'https://example.com/config.yaml', data: [] }];

      const local = getLocalSource(sources);

      expect(local).toBeUndefined();
    });
  });

  describe('getRemoteSources', () => {
    test('should return only remote sources', () => {
      const sources = [
        { url: 'https://example.com/config.yaml', data: [] },
        { url: 'local', data: [] },
        { url: 'https://another.com/config.yaml', data: [] },
      ];

      const remote = getRemoteSources(sources);

      expect(remote).toHaveLength(2);
      expect(remote[0].url).toBe('https://example.com/config.yaml');
      expect(remote[1].url).toBe('https://another.com/config.yaml');
    });

    test('should return empty array when only local source exists', () => {
      const sources = [{ url: 'local', data: [] }];

      const remote = getRemoteSources(sources);

      expect(remote).toEqual([]);
    });
  });

  describe('loadBusy', () => {
    test('should return null when not busy', async () => {
      chrome.storage.local.get.mockResolvedValue({});

      const busy = await loadBusy();

      expect(busy).toBeNull();
      expect(chrome.storage.local.get).toHaveBeenCalledWith([BUSY_KEY]);
    });

    test('should return busy type when busy', async () => {
      chrome.storage.local.get.mockResolvedValue({ [BUSY_KEY]: 'refreshing' });

      const busy = await loadBusy();

      expect(busy).toBe('refreshing');
    });
  });

  describe('clearStaleBusy', () => {
    test('should clear busy state when no operation in progress', async () => {
      chrome.storage.local.get.mockResolvedValue({ [BUSY_KEY]: 'refreshing' });
      chrome.storage.local.remove.mockResolvedValue(undefined);

      await clearStaleBusy();

      expect(chrome.storage.local.remove).toHaveBeenCalledWith(BUSY_KEY);
    });

    test('should not clear busy state when null', async () => {
      chrome.storage.local.get.mockResolvedValue({});
      chrome.storage.local.remove.mockResolvedValue(undefined);

      await clearStaleBusy();

      expect(chrome.storage.local.remove).not.toHaveBeenCalled();
    });
  });

  describe('refreshRemoteSources', () => {
    test('should fetch and update remote sources', async () => {
      const sources = [{ url: 'https://example.com/config.yaml', data: [], timestamp: 0 }];
      chrome.storage.local.get.mockResolvedValue({
        [STORAGE_KEY]: JSON.stringify(sources),
      });
      chrome.storage.local.set.mockResolvedValue(undefined);
      chrome.storage.local.remove.mockResolvedValue(undefined);

      const yamlData = '- name: test\n  group: Test\n  value: SELECT *';
      fetch.mockResolvedValue({
        ok: true,
        text: async () => yamlData,
      });

      await refreshRemoteSources();

      expect(fetch).toHaveBeenCalledWith('https://example.com/config.yaml', { cache: 'no-store' });
      expect(chrome.storage.local.set).toHaveBeenCalled();

      // Get the call arguments - chrome.storage.local.set was called with an object
      const setCallArgs = chrome.storage.local.set.mock.calls.find(call => call[0] && call[0][STORAGE_KEY]);
      expect(setCallArgs).toBeDefined();

      const savedData = JSON.parse(setCallArgs[0][STORAGE_KEY]);
      expect(savedData[0].data).toHaveLength(1);
      expect(savedData[0].data[0].name).toBe('test');
      expect(savedData[0].error).toBeNull();
    });

    test('should set error when fetch fails', async () => {
      const sources = [{ url: 'https://example.com/config.yaml', data: [], timestamp: 0 }];
      chrome.storage.local.get.mockResolvedValue({
        [STORAGE_KEY]: JSON.stringify(sources),
      });
      chrome.storage.local.set.mockResolvedValue(undefined);
      chrome.storage.local.remove.mockResolvedValue(undefined);

      fetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await refreshRemoteSources();

      const setCallArgs = chrome.storage.local.set.mock.calls.find(call => call[0] && call[0][STORAGE_KEY]);
      expect(setCallArgs).toBeDefined();

      const savedData = JSON.parse(setCallArgs[0][STORAGE_KEY]);
      expect(savedData[0].error).toBeDefined();
      expect(savedData[0].error.key).toBe('statusFetchError');
    });

    test('should do nothing when no remote sources exist', async () => {
      const sources = [{ url: 'local', data: [] }];
      chrome.storage.local.get.mockResolvedValue({
        [STORAGE_KEY]: JSON.stringify(sources),
      });
      chrome.storage.local.set.mockResolvedValue(undefined);
      chrome.storage.local.remove.mockResolvedValue(undefined);

      await refreshRemoteSources();

      expect(fetch).not.toHaveBeenCalled();
    });

    test('should handle YAML parse errors', async () => {
      const sources = [{ url: 'https://example.com/config.yaml', data: [], timestamp: 0 }];
      chrome.storage.local.get.mockResolvedValue({
        [STORAGE_KEY]: JSON.stringify(sources),
      });
      chrome.storage.local.set.mockResolvedValue(undefined);
      chrome.storage.local.remove.mockResolvedValue(undefined);

      fetch.mockResolvedValue({
        ok: true,
        text: async () => 'invalid: yaml: syntax',
      });

      await refreshRemoteSources();

      const setCallArgs = chrome.storage.local.set.mock.calls.find(call => call[0] && call[0][STORAGE_KEY]);
      expect(setCallArgs).toBeDefined();

      const savedData = JSON.parse(setCallArgs[0][STORAGE_KEY]);
      expect(savedData[0].error).toBeDefined();
      expect(savedData[0].error.key).toBe('statusInvalidYaml');
    });
  });

  describe('addSource', () => {
    test('should add valid remote source', async () => {
      chrome.storage.local.get.mockResolvedValue({});
      chrome.storage.local.set.mockResolvedValue(undefined);
      chrome.storage.local.remove.mockResolvedValue(undefined);

      const yamlData = '- name: test\n  group: Test\n  value: SELECT *';
      fetch.mockResolvedValue({
        ok: true,
        text: async () => yamlData,
      });

      const result = await addSource('https://example.com/config.yaml');

      expect(result.ok).toBe(true);
      expect(fetch).toHaveBeenCalledWith('https://example.com/config.yaml', { cache: 'no-store' });
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    test('should return error when URL already exists', async () => {
      const sources = [{ url: 'https://example.com/config.yaml', data: [] }];
      chrome.storage.local.get.mockResolvedValue({
        [STORAGE_KEY]: JSON.stringify(sources),
      });
      chrome.storage.local.set.mockResolvedValue(undefined);
      chrome.storage.local.remove.mockResolvedValue(undefined);

      const result = await addSource('https://example.com/config.yaml');

      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('statusUrlExists');
      expect(fetch).not.toHaveBeenCalled();
    });

    test('should return error when fetch fails', async () => {
      chrome.storage.local.get.mockResolvedValue({});
      chrome.storage.local.set.mockResolvedValue(undefined);
      chrome.storage.local.remove.mockResolvedValue(undefined);

      fetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await addSource('https://example.com/config.yaml');

      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('statusFetchError');
    });

    test('should return error when busy', async () => {
      chrome.storage.local.get.mockResolvedValue({});
      chrome.storage.local.set.mockResolvedValue(undefined);
      chrome.storage.local.remove.mockResolvedValue(undefined);

      fetch.mockResolvedValue({
        ok: true,
        text: async () => '- name: test\n  group: Test\n  value: SELECT *',
      });

      // Start first operation
      const promise1 = addSource('https://example1.com/config.yaml');

      // Try second operation while first is in progress
      const result2 = await addSource('https://example2.com/config.yaml');

      expect(result2.ok).toBe(false);
      expect(result2.errorKey).toBe('statusBusy');

      // Wait for first to complete
      await promise1;
    });
  });

  describe('removeSource', () => {
    test('should remove source by URL', async () => {
      const sources = [
        { url: 'https://example.com/config.yaml', data: [] },
        { url: 'https://another.com/config.yaml', data: [] },
      ];
      chrome.storage.local.get.mockResolvedValue({
        [STORAGE_KEY]: JSON.stringify(sources),
      });
      chrome.storage.local.set.mockResolvedValue(undefined);
      chrome.storage.local.remove.mockResolvedValue(undefined);

      await removeSource('https://example.com/config.yaml');

      const setCallArgs = chrome.storage.local.set.mock.calls.find(call => call[0] && call[0][STORAGE_KEY]);
      expect(setCallArgs).toBeDefined();

      const savedData = JSON.parse(setCallArgs[0][STORAGE_KEY]);
      expect(savedData).toHaveLength(1);
      expect(savedData[0].url).toBe('https://another.com/config.yaml');
    });

    test('should do nothing if source does not exist', async () => {
      const sources = [{ url: 'https://example.com/config.yaml', data: [] }];
      chrome.storage.local.get.mockResolvedValue({
        [STORAGE_KEY]: JSON.stringify(sources),
      });
      chrome.storage.local.set.mockResolvedValue(undefined);
      chrome.storage.local.remove.mockResolvedValue(undefined);

      await removeSource('https://nonexistent.com/config.yaml');

      const setCallArgs = chrome.storage.local.set.mock.calls.find(call => call[0] && call[0][STORAGE_KEY]);
      expect(setCallArgs).toBeDefined();

      const savedData = JSON.parse(setCallArgs[0][STORAGE_KEY]);
      expect(savedData).toHaveLength(1);
    });
  });

  describe('loadShortcuts', () => {
    test('should return default shortcuts when none stored', async () => {
      chrome.storage.local.get.mockResolvedValue({});

      const shortcuts = await loadShortcuts();

      expect(shortcuts).toEqual(DEFAULT_SHORTCUTS);
      expect(chrome.storage.local.get).toHaveBeenCalledWith([SHORTCUTS_KEY]);
    });

    test('should merge stored shortcuts with defaults', async () => {
      const storedShortcuts = {
        insertSnippet: { code: 'KeyZ', key: 'z', ctrl: true, shift: false, alt: false, meta: false },
      };
      chrome.storage.local.get.mockResolvedValue({
        [SHORTCUTS_KEY]: storedShortcuts,
      });

      const shortcuts = await loadShortcuts();

      expect(shortcuts.insertSnippet.key).toBe('z');
      expect(shortcuts.focusTable).toEqual(DEFAULT_SHORTCUTS.focusTable);
    });
  });

  describe('saveShortcuts', () => {
    test('should save shortcuts to storage', async () => {
      chrome.storage.local.set.mockResolvedValue(undefined);
      chrome.storage.local.remove.mockResolvedValue(undefined);

      const shortcuts = {
        insertSnippet: { code: 'KeyZ', key: 'z', ctrl: true, shift: true, alt: false, meta: false },
        focusTable: { code: 'KeyX', key: 'x', ctrl: true, shift: true, alt: false, meta: false },
      };

      const result = await saveShortcuts(shortcuts);

      expect(result.ok).toBe(true);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ [SHORTCUTS_KEY]: shortcuts });
    });

    test('should return error when busy', async () => {
      chrome.storage.local.set.mockResolvedValue(undefined);
      chrome.storage.local.remove.mockResolvedValue(undefined);

      const shortcuts1 = { insertSnippet: DEFAULT_SHORTCUTS.insertSnippet };
      const shortcuts2 = { focusTable: DEFAULT_SHORTCUTS.focusTable };

      // Start first save
      const promise1 = saveShortcuts(shortcuts1);

      // Try second save while first is in progress
      const result2 = await saveShortcuts(shortcuts2);

      expect(result2.ok).toBe(false);
      expect(result2.errorKey).toBe('statusBusy');

      // Wait for first to complete
      await promise1;
    });
  });

  describe('edge cases and validation', () => {
    test('should reject config that is not an array', async () => {
      chrome.storage.local.get.mockResolvedValue({});

      const yaml = 'name: test\ngroup: Test\nvalue: SELECT *'; // Object instead of array
      const result = await saveLocalSource(yaml);

      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('statusInvalidConfigArray');
    });

    test('should reject config with empty name', async () => {
      chrome.storage.local.get.mockResolvedValue({});

      const yaml = '- name: ""\n  group: Test\n  value: SELECT *';
      const result = await saveLocalSource(yaml);

      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('statusInvalidConfigNameMissing');
    });

    test('should reject config with whitespace-only name', async () => {
      chrome.storage.local.get.mockResolvedValue({});

      const yaml = '- name: "   "\n  group: Test\n  value: SELECT *';
      const result = await saveLocalSource(yaml);

      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('statusInvalidConfigNameMissing');
    });

    test('should reject config with empty group', async () => {
      chrome.storage.local.get.mockResolvedValue({});

      const yaml = '- name: test\n  group: ""\n  value: SELECT *';
      const result = await saveLocalSource(yaml);

      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('statusInvalidConfigGroupMissing');
    });

    test('should reject config with whitespace-only group', async () => {
      chrome.storage.local.get.mockResolvedValue({});

      const yaml = '- name: test\n  group: "   "\n  value: SELECT *';
      const result = await saveLocalSource(yaml);

      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('statusInvalidConfigGroupMissing');
    });

    test('should reject snippet with empty value', async () => {
      chrome.storage.local.get.mockResolvedValue({});

      const yaml = '- name: test\n  group: Test\n  value: ""';
      const result = await saveLocalSource(yaml);

      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('statusInvalidConfigSnippetsValueMissing');
    });

    test('should reject site with whitespace-only regex', async () => {
      chrome.storage.local.get.mockResolvedValue({});

      const yaml = '- name: test\n  group: Test\n  regex: "   "\n  url: https://example.com?q=%s';
      const result = await saveLocalSource(yaml);

      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('statusInvalidConfigSitesRegexMissing');
    });

    test('should reject site with empty url', async () => {
      chrome.storage.local.get.mockResolvedValue({});

      const yaml = '- name: test\n  group: Test\n  regex: test\n  url: ""';
      const result = await saveLocalSource(yaml);

      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('statusInvalidConfigSitesUrlMissing');
    });

    test('should handle network errors during fetch', async () => {
      chrome.storage.local.get.mockResolvedValue({});
      chrome.storage.local.set.mockResolvedValue(undefined);
      chrome.storage.local.remove.mockResolvedValue(undefined);

      fetch.mockRejectedValue(new Error('Network error'));

      const result = await addSource('https://example.com/config.yaml');

      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('statusFetchError');
      expect(result.errorSubs).toBe('Network error');
    });
  });
});

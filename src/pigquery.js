import * as config from './config.js';
import * as i18n from './i18n.js';
import * as search from './search.js';
import * as formatters from './formatters.js';
import { compressAndEncode, decodeAndDecompress } from './compression.js';
import logger from './logger.js';
import Uninstaller from './uninstaller.js';
import {
  makeEl,
  showToast,
  getInitials,
  getLabelColor,
  findEditorTextArea,
  insertIntoEditor,
  getVisibleOrActiveEditor,
  matchesShortcut,
  sortSites,
} from './utils.js';
import hljs from 'highlight.js/lib/core';
import sql from 'highlight.js/lib/languages/sql';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import highlightCss from 'highlight.js/styles/atom-one-dark.min.css';
import modalStyles from './modal.css';

const MARKER_ID = 'pigquery-extension-marker';
const uninstaller = new Uninstaller();

if (!document.getElementById(MARKER_ID)) throw new Error('PigQuery marker not set');

uninstaller.register(() => document.getElementById(MARKER_ID).remove());

// Register languages for syntax highlighting
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('yaml', yaml);

const LOCALE = i18n.getBigQueryLocale();
i18n.applyI18n(LOCALE);

// Load icons as data URLs at startup so they remain available even if extension context is invalidated
let ICON_URL = '';
let ICON_ERROR_URL = '';

async function loadIconAsDataURL(path) {
  const url = chrome.runtime.getURL(path);
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

(async () => {
  ICON_URL = await loadIconAsDataURL('icons/icon.svg');
  ICON_ERROR_URL = await loadIconAsDataURL('icons/icon-badge-error.svg');
})();

const isMac = navigator.userAgentData.platform === 'macOS';

let configuration;
let shortcuts = config.DEFAULT_SHORTCUTS;
let onConfigurationChange = null;
let recentSnippetGroups = [];
let hasRemoteSources = false;

// Inject highlight.js theme CSS
uninstaller.appendChild(document.head, makeEl('style', { id: 'pig-highlight-style', text: highlightCss }));

function sortSnippets(items) {
  return items.slice().sort((a, b) => {
    const aIndex = recentSnippetGroups.indexOf(a.group);
    const bIndex = recentSnippetGroups.indexOf(b.group);
    // Both in recent list: sort by recency (lower index = more recent)
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    // Only one in recent list: that one comes first
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    // Neither in recent list: sort by group name
    return a.group.localeCompare(b.group);
  });
}

function addRecentSnippetGroup(group) {
  recentSnippetGroups = [group, ...recentSnippetGroups.filter(g => g !== group)];
}

async function load() {
  const [loaded, loadedShortcuts] = await Promise.all([config.loadConfiguration(), config.loadShortcuts()]);
  configuration = {
    snippets: sortSnippets(loaded.snippets),
    sites: sortSites(loaded.sites, null),
    hasErrors: loaded.hasErrors,
  };
  shortcuts = loadedShortcuts;
  hasRemoteSources = loaded.hasRemoteSources;
  onConfigurationChange?.();
}

load();

const storageChangeListener = changes => {
  if (config.STORAGE_KEY in changes || config.SHORTCUTS_KEY in changes) {
    load();
  }
};
chrome.storage.onChanged.addListener(storageChangeListener);
uninstaller.register(() => {
  if (chrome.runtime?.id) {
    chrome.storage.onChanged.removeListener(storageChangeListener);
  }
}, 'storageChangeListener');
chrome.runtime.sendMessage({ action: 'refreshRemoteSources' });

// Extract and remove the 'pig' query parameter on page load.
const url = new URL(window.location.href);
const queryParam = url.searchParams.get('pig');
let query = queryParam?.length ? decodeAndDecompress(queryParam.trim()).trim() : null;

if (url.searchParams.has('pig')) {
  url.searchParams.delete('pig');
  window.history.replaceState({}, '', url.toString());

  // Keep removing the 'pig' param if the page re-adds it (check for 10 seconds)
  const startTime = Date.now();
  uninstaller.setInterval(
    () => {
      const currentUrl = new URL(window.location.href);
      if (currentUrl.searchParams.has('pig')) {
        currentUrl.searchParams.delete('pig');
        window.history.replaceState({}, '', currentUrl.toString());
      }

      if (Date.now() - startTime > 10000) {
        uninstaller.uninstall('pig-param-cleaner');
      }
    },
    100,
    'pig-param-cleaner'
  );
}

let clickedTab = false;
if (query && query.length > 0) {
  const cleanup = inserted => {
    if (inserted) {
      showToast(i18n.getMessage('queryInsertSucceeded', LOCALE));
    } else {
      showToast(i18n.getMessage('queryInsertFailed', LOCALE));
    }
    uninstaller.uninstallGroup('query-insert');
  };

  const tryInsertQuery = () => {
    if (!clickedTab) {
      const tabs = document.querySelectorAll('cfc-panel-sub-header [role="tab"]');
      if (tabs.length === 0) return false;
      tabs[tabs.length - 1].click();
      clickedTab = true;
    }

    const editors = document.querySelectorAll('cfc-code-editor');
    if (editors.length === 0) return false;
    const editor = editors[editors.length - 1];
    const ta = findEditorTextArea(editor);
    if (!ta) return false;

    cleanup(true);
    insertIntoEditor(editor, query.trim());
    return true;
  };

  uninstaller.setTimeout(() => cleanup(false), 10_000, 'query-insert-timeout', 'query-insert');

  // Try immediately in case editor already exists
  if (!tryInsertQuery()) {
    // If not found, observe for DOM changes
    uninstaller.observe(
      () => tryInsertQuery(),
      document.body,
      {
        childList: true,
        subtree: true,
      },
      'query-insert-observer',
      'query-insert'
    );
  }
}

uninstaller.appendChild(document.head, makeEl('style', { id: 'pig-modal-style', text: modalStyles }));

function openPopup(getOptions, onOptionSelected, getHasErrors, contentOrGetter) {
  if (document.querySelector('.pig-modal-overlay')) return;

  let options = getOptions();
  let filtered = options.slice();
  let activeIndex = 0;
  let hasErrors = getHasErrors();
  let ignoreMouseTimeout = null;

  const overlayEl = makeEl('div', { className: 'pig-modal-overlay' });
  const listEl = makeEl('div', { className: 'pig-modal-list' });

  uninstaller.register(
    (
      el => () =>
        el.focus()
    )(document.activeElement),
    'popup-focus-restore',
    'popup'
  );
  uninstaller.register(
    () => {
      onConfigurationChange = null;
    },
    'popup-configuration-change-handler',
    'popup'
  );

  function ignoreMouseTemporarily() {
    if (ignoreMouseTimeout) clearTimeout(ignoreMouseTimeout);
    ignoreMouseTimeout = setTimeout(() => {
      ignoreMouseTimeout = null;
    }, 150);
  }

  overlayEl.addEventListener('mousedown', e => {
    if (e.target === overlayEl) {
      e.preventDefault();
      e.stopPropagation();
      uninstaller.uninstallGroup('popup');
    }
  });

  // Document-level Escape handler (keydown on modal only works when focus is inside)
  uninstaller.addEventListener(
    document,
    'keydown',
    e => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        uninstaller.uninstallGroup('popup');
      }
    },
    true,
    'popup-escape-handler',
    'popup'
  );

  function scrollActiveIntoView() {
    const items = listEl.querySelectorAll('.pig-modal-item');
    const active = items[activeIndex];
    if (!active) return;

    if (activeIndex === 0) {
      // Ensure the top padding is visible
      listEl.scrollTop = 0;
      return;
    }
    if (activeIndex === items.length - 1) {
      listEl.scrollTop = listEl.scrollHeight;
      return;
    }

    active.scrollIntoView({ block: 'nearest' });
  }

  function updateActiveStyles() {
    const items = listEl.querySelectorAll('.pig-modal-item');
    items.forEach((el, i) => {
      if (i === activeIndex) el.classList.add('active');
      else el.classList.remove('active');
    });
    scrollActiveIntoView();
  }

  const modalEl = makeEl('div', { className: 'pig-modal pig-modal-with-content' });

  modalEl.addEventListener('keydown', e => {
    // Trap focus within modal
    if (e.key === 'Tab') {
      // Get all focusable elements in the modal dynamically
      const allFocusable = Array.from(
        modalEl.querySelectorAll('input, button:not([tabindex="-1"]), [tabindex="0"]')
      ).filter(el => el.checkVisibility?.()); // Filter out hidden elements

      if (allFocusable.length === 0) return;

      const currentIndex = allFocusable.indexOf(document.activeElement);
      e.preventDefault();
      e.stopPropagation();

      let nextIndex;
      if (currentIndex === -1) {
        nextIndex = 0;
      } else if (e.shiftKey) {
        nextIndex = (currentIndex - 1 + allFocusable.length) % allFocusable.length;
      } else {
        nextIndex = (currentIndex + 1) % allFocusable.length;
      }
      allFocusable[nextIndex].focus();
      return;
    }

    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.altKey) {
      // Alt+Arrow scrolls content panel
      const scrollAmount = 40; // pixels to scroll
      const direction = e.key === 'ArrowDown' ? 1 : -1;
      contentPanel.scrollTop += scrollAmount * direction;
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      if (filtered.length) {
        activeIndex = (activeIndex + 1) % filtered.length;
        updateActiveStyles();
        updateContentPanel();
        ignoreMouseTemporarily();
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      if (filtered.length) {
        activeIndex = (activeIndex - 1 + filtered.length) % filtered.length;
        updateActiveStyles();
        updateContentPanel();
        ignoreMouseTemporarily();
      }
      return;
    }

    if (e.key === 'Enter') {
      // Let buttons handle their own Enter
      if (document.activeElement && document.activeElement.tagName === 'BUTTON') {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      onOptionSelected(filtered[activeIndex]);
      uninstaller.uninstallGroup('popup');
      return;
    }

    e.stopPropagation();
  });

  function renderList() {
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);

    if (filtered.length === 0) {
      const empty = makeEl('div', { className: 'pig-modal-empty' });
      empty.textContent = i18n.getMessage('noOptionsFound', LOCALE);
      listEl.appendChild(empty);
      return;
    }

    filtered.forEach((opt, idx) => {
      const itemClass = 'pig-modal-item' + (idx === activeIndex ? ' active' : '');
      const item = opt.url ? makeEl('a', { className: itemClass }) : makeEl('div', { className: itemClass });

      if (opt.url) {
        item.href = opt.url;
        item.target = '_blank';
        item.rel = 'noopener noreferrer';
      }

      const wrapper = makeEl('div', { className: 'pig-modal-item-wrapper' });

      const group = makeEl('span', { className: 'pig-modal-item-group', text: getInitials(opt.group) });
      const groupColors = getLabelColor(opt.group);
      group.style.color = groupColors.text;
      wrapper.appendChild(group);

      const name = makeEl('span', { className: 'pig-modal-item-name', text: opt.name });
      wrapper.appendChild(name);

      if (opt.tag) {
        const tag = makeEl('span', { className: 'pig-modal-item-tag', text: opt.tag });
        const colors = getLabelColor(opt.tag);
        tag.style.backgroundColor = colors.bg;
        tag.style.color = colors.text;
        wrapper.appendChild(tag);
      }

      item.appendChild(wrapper);

      item.addEventListener('mousedown', e => {
        // Prevent input blur before click handler runs
        e.preventDefault();
      });

      const updateSelection = () => {
        if (ignoreMouseTimeout) return;
        if (activeIndex !== idx) {
          activeIndex = idx;
          updateActiveStyles();
          updateContentPanel();
        }
      };

      item.addEventListener('mouseenter', updateSelection);
      item.addEventListener('mousemove', updateSelection);

      item.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        onOptionSelected(filtered[idx]);
        uninstaller.uninstallGroup('popup');
      });

      listEl.appendChild(item);
    });

    scrollActiveIntoView();
  }

  const header = makeEl('div', { className: 'pig-modal-header' });
  const iconContainer = makeEl('div', { className: 'pig-modal-logo-container' });
  const iconEl = document.createElement('img');
  iconEl.className = 'pig-modal-logo';
  iconEl.alt = 'PigQuery';
  iconEl.src = ICON_URL;
  iconContainer.appendChild(iconEl);
  header.appendChild(iconContainer);

  const inputEl = makeEl('input', { className: 'pig-modal-input' });
  inputEl.type = 'text';
  inputEl.placeholder = i18n.getMessage('searchPlaceholder', LOCALE);
  inputEl.autocomplete = 'off';
  inputEl.spellcheck = false;

  inputEl.addEventListener('input', () => {
    const query = (inputEl.value || '').trim().toLowerCase();
    filtered = search.filter(options, query);
    activeIndex = 0;
    renderList();
    updateContentPanel();
  });

  inputEl.addEventListener('focus', () => {
    modalEl.classList.add('input-focused');
  });

  inputEl.addEventListener('blur', () => {
    modalEl.classList.remove('input-focused');
  });

  onConfigurationChange = () => {
    // Save currently selected item to preserve selection if it still exists
    const currentItem = filtered[activeIndex];

    options = getOptions();
    const query = (inputEl.value || '').trim().toLowerCase();
    filtered = search.filter(options, query);

    // Try to find the previously selected item in the new filtered list
    if (currentItem) {
      const newIndex = filtered.findIndex(
        item => item.group === currentItem.group && item.name === currentItem.name && item.tag === currentItem.tag
      );
      activeIndex = newIndex !== -1 ? newIndex : 0;
    } else {
      activeIndex = 0;
    }

    renderList();
    updateContentPanel();

    hasErrors = getHasErrors();
    updateErrorBadge();
    updateRefreshButtonVisibility();
  };

  header.appendChild(inputEl);

  // Refresh button
  const refreshBtn = makeEl('button', { className: 'pig-modal-refresh' });
  refreshBtn.type = 'button';
  refreshBtn.innerHTML =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>';
  refreshBtn.title = 'Refresh';

  let isBusy = false;

  function updateRefreshState(busy) {
    isBusy = busy;
    if (busy) {
      refreshBtn.classList.add('busy');
    } else {
      refreshBtn.classList.remove('busy');
    }
  }

  function updateErrorBadge() {
    const existingBadge = refreshBtn.querySelector('.pig-modal-refresh-badge');
    if (hasErrors && !existingBadge) {
      const badgeEl = document.createElement('img');
      badgeEl.className = 'pig-modal-refresh-badge';
      badgeEl.alt = 'Error';
      badgeEl.src = ICON_ERROR_URL;
      refreshBtn.appendChild(badgeEl);
    } else if (!hasErrors && existingBadge) {
      existingBadge.remove();
    }
  }

  function updateRefreshButtonVisibility() {
    if (hasRemoteSources) {
      refreshBtn.style.display = '';
    } else {
      refreshBtn.style.display = 'none';
    }
  }

  updateErrorBadge();
  updateRefreshButtonVisibility();

  // Check initial busy state, skip if extension context has been invalidated
  if (chrome.runtime?.id) {
    chrome.storage.local.get(config.BUSY_KEY, result => {
      updateRefreshState(!!result[config.BUSY_KEY]);
    });

    // Listen for busy state changes
    uninstaller.addChromeStorageListener(
      changes => {
        if (config.BUSY_KEY in changes) {
          updateRefreshState(!!changes[config.BUSY_KEY].newValue);
        }
      },
      'popup-busy-listener',
      'popup'
    );
  }

  refreshBtn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    if (!chrome.runtime?.id) {
      showToast(i18n.getMessage('extensionNotAvailable', LOCALE));
      return;
    }
    if (!isBusy) {
      chrome.runtime.sendMessage({ action: 'refreshRemoteSources' });
    }
    inputEl.focus();
  });

  header.appendChild(refreshBtn);

  // Settings button
  const settingsBtn = makeEl('button', { className: 'pig-modal-settings' });
  settingsBtn.type = 'button';
  settingsBtn.innerHTML =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>';
  settingsBtn.title = 'Settings';
  settingsBtn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    if (!chrome.runtime?.id) {
      showToast(i18n.getMessage('extensionNotAvailable', LOCALE));
      return;
    }
    chrome.runtime.sendMessage({ action: 'openOptionsPage', locale: LOCALE });
    inputEl.focus();
  });
  header.appendChild(settingsBtn);

  modalEl.appendChild(header);

  // Create body container for list and content panel
  const bodyEl = makeEl('div', { className: 'pig-modal-body pig-modal-two-panel' });
  bodyEl.appendChild(listEl);

  // Content panel elements (will be populated by updateContentPanel)
  const contentPanel = makeEl('div', { className: 'pig-modal-content-panel' });
  bodyEl.appendChild(contentPanel);

  const isDynamicContent = typeof contentOrGetter === 'function';
  let isContentPanelInitialized = false;

  function updateContentPanel() {
    // Skip updates if content is static and already initialized
    if (!isDynamicContent && isContentPanelInitialized) return;

    const selectedItem = filtered[activeIndex];
    if (isDynamicContent && !selectedItem) {
      contentPanel.innerHTML = '';
      contentPanel.style.display = '';
      isContentPanelInitialized = false;
      return;
    }

    isContentPanelInitialized = true;

    const contentInfo = isDynamicContent ? contentOrGetter(selectedItem) : contentOrGetter;

    // Reuse existing items if possible so that there isn't a flicker in the case that keyboard focus is in the content panel
    const existingItems = Array.from(contentPanel.querySelectorAll('.pig-format-item'));

    contentInfo.forEach((item, index) => {
      let itemEl = existingItems[index];
      let headerEl, labelEl, copyBtn, valueEl;

      if (itemEl) {
        // Reuse existing item - find its children
        headerEl = itemEl.querySelector('.pig-format-item-header');
        labelEl = headerEl.querySelector('.pig-format-item-label');
        copyBtn = headerEl.querySelector('.pig-format-item-copy');
        valueEl = itemEl.querySelector('.pig-format-item-value');
      } else {
        // Create new item
        itemEl = makeEl('div', { className: 'pig-format-item' });

        headerEl = makeEl('div', { className: 'pig-format-item-header' });
        labelEl = makeEl('div', { className: 'pig-format-item-label' });
        headerEl.appendChild(labelEl);

        copyBtn = makeEl('button', { className: 'pig-format-item-copy' });
        copyBtn.innerHTML =
          '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5.5" y="5.5" width="8" height="9" rx="1.5"/><path d="M3 10.5V3.5a1.5 1.5 0 0 1 1.5-1.5H10"/></svg>';
        copyBtn.title = 'Copy';
        copyBtn.addEventListener('click', e => {
          e.stopPropagation();
          const currentValue = valueEl.textContent;
          navigator.clipboard.writeText(currentValue);
          showToast(i18n.getMessage('contentCopied', LOCALE));
          inputEl.focus();
        });
        copyBtn.addEventListener('focus', () => {
          // Only scroll on keyboard focus, not mouse click
          if (!copyBtn.matches(':focus-visible')) return;
          if (index === 0) {
            contentPanel.scrollTop = 0;
          } else {
            itemEl.scrollIntoView({ block: 'nearest' });
          }
        });
        headerEl.appendChild(copyBtn);

        itemEl.appendChild(headerEl);

        valueEl = makeEl('div', { className: 'pig-format-item-value' });

        // Select text on right-click so browser shows "Copy" in context menu
        valueEl.addEventListener('contextmenu', () => {
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(valueEl);
          selection.removeAllRanges();
          selection.addRange(range);
        });

        itemEl.appendChild(valueEl);
        contentPanel.appendChild(itemEl);
      }

      // Update content
      labelEl.textContent = item.label;

      if (['json', 'xml', 'yaml', 'sql'].includes(item.type)) {
        const highlighted = hljs.highlight(item.value, { language: item.type });
        valueEl.innerHTML = highlighted.value;
        if (!valueEl.classList.contains('hljs')) {
          valueEl.classList.add('hljs');
        }
      } else {
        valueEl.textContent = item.value;
        valueEl.classList.remove('hljs');
      }
    });

    contentPanel.style.display = '';

    // Only reset scroll position for dynamic content
    if (isDynamicContent) {
      contentPanel.scrollTop = 0;
    }
  }

  modalEl.appendChild(bodyEl);

  overlayEl.appendChild(modalEl);
  uninstaller.appendChild(document.body, overlayEl, 'popup-overlay', 'popup');
  ignoreMouseTemporarily();
  renderList();
  updateContentPanel();

  // Redirect focus back to modal if it escapes (e.g., user clicks URL bar then tabs back)
  uninstaller.addEventListener(
    document,
    'focusin',
    e => {
      if (!modalEl.contains(e.target)) {
        inputEl.focus();
      }
    },
    false,
    'popup-focus-redirect',
    'popup'
  );

  inputEl.focus();
}

uninstaller.addEventListener(
  document,
  'keydown',
  e => {
    if (document.querySelector('.pig-modal-overlay')) return;

    // Uninstall any pending copy timeout
    uninstaller.uninstall('copy-share-link-timeout');

    if (!e.isComposing && !e.repeat && matchesShortcut(e, shortcuts.insertSnippet)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      if (!(e.target instanceof Element)) {
        showToast(i18n.getMessage('editorNotFocused', LOCALE));

        return;
      }
      const editor = e.target.closest('cfc-code-editor');
      if (!editor) {
        showToast(i18n.getMessage('editorNotFocused', LOCALE));
        return;
      }
      openPopup(
        () => configuration.snippets,
        option => {
          addRecentSnippetGroup(option.group);
          configuration.snippets = sortSnippets(configuration.snippets);
          insertIntoEditor(editor, option.value);
        },
        () => configuration.hasErrors,
        item => [{ label: 'SQL', value: item.value, type: 'sql' }]
      );
      return;
    }

    if (
      !e.isComposing &&
      !e.repeat &&
      e.key.toLowerCase() === 'a' &&
      !e.shiftKey &&
      !e.altKey &&
      (isMac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey)
    ) {
      logger.debug('Received select all shortcut');
      if (!e.target.closest('cfc-code-editor')) {
        showToast(i18n.getMessage('editorNotFocused', LOCALE));
        return;
      }
      // Uninstall any pending copy timeout
      uninstaller.uninstall('copy-share-link-timeout');
      copyShareLink();
      return;
    }

    if (!e.isComposing && !e.repeat && matchesShortcut(e, shortcuts.focusTable)) {
      logger.debug('Received focus table/editor shortcut');
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // Check if currently in editor
      const isInEditor = e.target instanceof Element && e.target.closest('cfc-code-editor');

      if (isInEditor) {
        // Focus table
        const tables = Array.from(document.querySelectorAll('bq-results-table-optimized')).filter(el =>
          el.checkVisibility?.()
        ); // Filter out hidden elements

        if (tables.length === 0) {
          logger.debug('No tables found');
          showToast(i18n.getMessage('tableNotFound', LOCALE));
          return;
        }

        const table = tables[0];

        const cell = table.querySelector('[role="cell"]');
        const header = table.querySelector('[role="columnheader"]');
        if (cell) {
          logger.debug('Focusing cell');
          cell.focus();
          cell.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else if (header) {
          logger.debug('Focusing header');
          header.focus();
          header.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
          logger.debug('Focusing table');
          table.focus();
          table.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      } else {
        // Focus editor
        const editor = getVisibleOrActiveEditor();
        if (!editor) {
          logger.debug('No editor found');
          showToast(i18n.getMessage('editorNotFound', LOCALE));
          return;
        }

        const ta = findEditorTextArea(editor);
        if (ta) {
          logger.debug('Focusing text area');
          ta.focus();
          editor.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
          logger.debug('Focusing editor');
          editor.focus();
          editor.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
      return;
    }

    //
    if (e.key === 'Alt') {
      logger.debug('Received alt down event');
      uninstaller.addClass(document.documentElement, 'alt-down', 'alt-down-class');
    }
  },
  true
);

uninstaller.addEventListener(
  document,
  'keyup',
  e => {
    if (e.key === 'Alt') {
      uninstaller.uninstall('alt-down-class');
    }
  },
  false
);

function handleTableCellOpenPopup(cell) {
  const content = cell.innerText;

  const getMatchingOptions = () =>
    configuration.sites
      .filter(option => option.regex.test(content))
      .map(option => ({
        ...option,
        url: option.url.replace('%s', option.encode === false ? content : encodeURIComponent(content)),
      }));
  const contentInfo = formatters.detectContentType(content);
  openPopup(
    getMatchingOptions,
    option => {
      configuration.sites = sortSites(configuration.sites, { group: option.group, name: option.name, tag: option.tag });
      window.open(option.url, '_blank', 'noopener,noreferrer');
    },
    () => configuration.hasErrors,
    contentInfo
  );

  // BigQuery steals focus asynchronously on the results table. Re-focus if this happens.
  const onFocusIn = () => {
    const input = document.querySelector('.pig-modal-input');
    if (input) {
      input.focus();
    } else {
      cell.removeEventListener('focusin', onFocusIn, true);
    }
  };

  cell.addEventListener('focusin', onFocusIn, true);
  return true;
}

uninstaller.addEventListener(
  document,
  'click',
  e => {
    if (!e.altKey) return;
    if (e.shiftKey) return; // BigQuery ignores shift clicks so we do too.

    if (!(e.target instanceof Element)) return false;
    const table = e.target.closest('bq-results-table-optimized');
    if (!table) return false;
    const cell = table.querySelector('[role="cell"]');
    if (!cell) return false;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const content = cell.innerText;

    if (isMac ? e.metaKey : e.ctrlKey) {
      navigator.clipboard.writeText(content);
      showToast(i18n.getMessage('cellCopied', LOCALE));
      return true;
    }

    // Focus the cell so it's properly focused when the modal closes
    cell.focus();
    handleTableCellOpenPopup(cell);
  },
  true
);

uninstaller.addEventListener(
  document,
  'keydown',
  e => {
    if (e.key !== 'Enter') return;

    if (!(e.target instanceof Element)) return false;
    const table = e.target.closest('bq-results-table-optimized');
    if (!table) return false;
    const cell = table.querySelector('[role="cell"]');
    if (!cell) return false;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    handleTableCellOpenPopup(cell);
  },
  true
);

function copyShareLink() {
  // Set up a one-time copy event handler to intercept Monaco's copy
  const handler = e => {
    logger.debug('Copy event handler called');
    document.removeEventListener('copy', handler, false);

    // Get the selected text - Monaco should have prepared the selection
    const selection = e.clipboardData?.getData('text/plain') || '';
    if (!selection.trim()) {
      logger.debug('No selection found');
      // Let normal copy proceed if no selection
      return;
    }

    // Clear clipboard and set our share link instead
    e.clipboardData.clearData();

    const url = new URL(window.location.href);
    const project = url.searchParams.get('project');
    url.search = '';
    url.hash = '';
    url.searchParams.set('pig', compressAndEncode(selection));
    if (project) url.searchParams.set('project', project);
    const shareLink = url.toString();

    logger.debug(`Copying share link: ${shareLink}`);
    e.clipboardData.setData('text/plain', shareLink);
    e.preventDefault();
    showToast(i18n.getMessage('linkCopied', LOCALE));
  };

  uninstaller.setTimeout(
    () => {
      logger.debug('Firing copy event');
      document.addEventListener('copy', handler, false);
      document.execCommand('copy');
      // Clean up handler if copy didn't fire (e.g., no selection)
      document.removeEventListener('copy', handler, false);
    },
    500,
    'copy-share-link-timeout'
  );
}

// Listen for uninstall event
uninstaller.addEventListener(
  document,
  'pigquery-uninstall',
  () => {
    uninstaller.uninstallAll();
    logger.debug('uninstalled');
  },
  false
);

// Listen for conditional uninstall event
uninstaller.addEventListener(
  document,
  'pigquery-uninstall-if-dead',
  () => {
    if (!chrome.runtime?.id) {
      uninstaller.uninstallAll();
      logger.debug('uninstalled');
    }
  },
  false
);

uninstaller.addEventListener(
  document,
  'pigquery-remove-all-sources',
  () => {
    if (!chrome.runtime?.id) {
      logger.debug('Not removing all sources because runtime is not available');
      return;
    }
    chrome.runtime.sendMessage({ action: 'removeAllSources' });
    logger.debug('Removed all sources');
  },
  false
);

logger.debug('loaded');

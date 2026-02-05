const config = window.pigquery.config;
const i18n = window.pigquery.i18n;
const search = window.pigquery.search;
const formatters = window.pigquery.formatters;
const LOCALE = i18n.getBigQueryLocale();
i18n.applyI18n(LOCALE);

const ICON_URL = chrome.runtime.getURL("icons/icon.svg");
const ICON_ERROR_URL = chrome.runtime.getURL("icons/icon-badge-error.svg");

const isMac = navigator.userAgentData.platform === 'macOS';

let configuration;
let shortcuts = config.DEFAULT_SHORTCUTS;
let onConfigurationChange = null;
let recentSnippetGroups = [];

/**
 * Checks if a keyboard event matches a shortcut configuration.
 */
function matchesShortcut(e, shortcut) {
  return e.code === shortcut.code &&
         e.ctrlKey === shortcut.ctrl &&
         e.altKey === shortcut.alt &&
         e.shiftKey === shortcut.shift &&
         e.metaKey === shortcut.meta;
}

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

function sortSites(items, prioritySite) {
  return items.slice().sort((a, b) => {
    if (prioritySite) {
      const aIsLast = a.group === prioritySite.group && a.name === prioritySite.name && a.tag === prioritySite.tag;
      const bIsLast = b.group === prioritySite.group && b.name === prioritySite.name && b.tag === prioritySite.tag;
      if (aIsLast !== bIsLast) return aIsLast ? -1 : 1;
    }
    const groupCmp = a.group.localeCompare(b.group);
    if (groupCmp !== 0) return groupCmp;
    const tagCmp = (a.tag ?? "").localeCompare(b.tag ?? "");
    if (tagCmp !== 0) return tagCmp;
    return a.name.localeCompare(b.name);
  });
}

async function load() {
  const [loaded, loadedShortcuts] = await Promise.all([
    config.loadConfiguration(),
    config.loadShortcuts(),
  ]);
  configuration = {
    snippets: sortSnippets(loaded.snippets),
    sites: sortSites(loaded.sites, null),
    hasErrors: loaded.hasErrors,
  };
  shortcuts = loadedShortcuts;
  onConfigurationChange?.();
}

load();

chrome.storage.onChanged.addListener((changes) => {
  if (config.STORAGE_KEY in changes || config.SHORTCUTS_KEY in changes) {
    load();
  }
});
chrome.runtime.sendMessage({ action: "refreshRemoteSources" });

// Extract and remove the 'pig' query parameter on page load.
const url = new URL(window.location.href);
const queryParam = url.searchParams.get("pig");
let query = queryParam?.length ? base64Decode(queryParam.trim()).trim() : null;

if (url.searchParams.has("pig")) {
  url.searchParams.delete("pig");
  window.history.replaceState({}, '', url.toString());

  // Keep removing the 'pig' param if the page re-adds it (check for 10 seconds)
  const startTime = Date.now();
  const intervalId = setInterval(() => {
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.has("pig")) {
      currentUrl.searchParams.delete("pig");
      window.history.replaceState({}, '', currentUrl.toString());
    }

    if (Date.now() - startTime > 10000) {
      clearInterval(intervalId);
    }
  }, 100);
}

let clickedTab = false;
if (query && query.length > 0) {

  const observer = new MutationObserver(() => {
    if (!clickedTab) {
      const tabs = document.querySelectorAll('cfc-panel-sub-header [role="tab"]');
      if (tabs.length === 0) return;
      tabs[tabs.length - 1].click();
      clickedTab = true;
    }

    const editors = document.querySelectorAll('cfc-code-editor');
    if (editors.length === 0) return;
    const editor = editors[editors.length - 1];
    const ta = findEditorTextArea(editor);
    if (!ta) return;

    cleanup();
    insertIntoEditor(editor, query.trim());
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  const timeoutId = setTimeout(cleanup, 10_000);

  function cleanup() {
    observer.disconnect();
    clearTimeout(timeoutId);
  }
}

function base64Encode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64Decode(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function findEditorTextArea(editor) {
  let ta = editor.querySelector("textarea.inputarea") || editor.querySelector("textarea");
  if (ta) return ta;

  return null;
}

function insertIntoEditor(editor, text) {
  if (!editor) return null;
  const ta = findEditorTextArea(editor);
  if (!ta) return false;

  // First try to simulate a paste event. This avoids auto-formatting issues in Monaco and can be reverted with a single undo.
  try {
    ta.focus();

    const dt = new DataTransfer();
    dt.setData("text/plain", text);

    const pasteEvent = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: dt,
    });

    const prevented = !ta.dispatchEvent(pasteEvent);
    // Monaco usually handles paste by preventing default.
    if (prevented) return true;
  } catch (_) {
    // ignore and fall back
  }

  const isMultiline = text.includes("\n");

  // Single-line inserts: execCommand behaves closest to normal typing.
  if (!isMultiline) {
    try {
      ta.focus();
      if (document.execCommand && document.execCommand("insertText", false, text)) {
        return true;
      }
    } catch (_) {
      // ignore and fall back
    }
  }

  // Fallback: direct range insertion + input event.
  // (Kept for environments where ClipboardEvent/DataTransfer is unavailable.)
  try {
    ta.focus();
    const start = ta.selectionStart ?? (ta.value?.length ?? 0);
    const end = ta.selectionEnd ?? (ta.value?.length ?? 0);

    if (typeof ta.setRangeText === "function") {
      ta.setRangeText(text, start, end, "end");
    } else {
      const v = ta.value ?? "";
      ta.value = v.slice(0, start) + text + v.slice(end);
      const pos = start + text.length;
      if (typeof ta.selectionStart === "number") {
        ta.selectionStart = ta.selectionEnd = pos;
      }
    }

    const inputType = isMultiline ? "insertFromPaste" : "insertText";
    ta.dispatchEvent(new InputEvent("input", { bubbles: true, inputType, data: text }));
    return true;
  } catch (_) {
    return false;
  }
}

const styles = `
  .pig-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.55);
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    box-sizing: border-box;
  }
  .pig-modal {
    width: min(720px, 100%);
    background: #111;
    border: 1px solid rgba(255,255,255,0.14);
    border-radius: 12px;
    box-shadow: 0 18px 60px rgba(0,0,0,0.6);
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    color: #fff;
    overflow: hidden;
  }
  .pig-modal-header {
    padding: 14px;
    border-bottom: 1px solid rgba(255,255,255,0.10);
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .pig-modal-input {
    width: 100%;
    flex: 1;
    box-sizing: border-box;
    padding: 10px 12px 10px 0;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.14);
    background: rgba(255,255,255,0.06);
    color: #fff;
    outline: none;
    font-size: 14px;
  }
  .pig-modal-input::placeholder {
    color: rgba(255,255,255,0.45);
  }
  .pig-modal-list {
    height: min(50vh, 480px);
    overflow: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .pig-modal-empty {
    padding: 12px 10px;
    opacity: 0.65;
    font-size: 13px;
    user-select: none;
  }
  .pig-modal-item {
    padding: 12px;
    border-radius: 10px;
    cursor: pointer;
    user-select: none;
    border: 1px solid rgba(255,255,255,0.12);
    display: block;
    text-decoration: none;
    color: inherit;
    background: rgba(255,255,255,0.04);
    font-size: 14px;
    line-height: 1.3;
  }
  .pig-modal-item:hover {
    background: rgba(255,255,255,0.08);
  }
  .pig-modal.input-focused .pig-modal-item.active {
    background: rgba(96, 165, 250, 0.2);
    border-color: rgba(96, 165, 250, 0.5);
    box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.3);
  }
  .pig-modal.input-focused .pig-modal-item.active:hover {
    background: rgba(96, 165, 250, 0.25);
  }
  .pig-modal-item[type="button"] {
    width: 100%;
    text-align: left;
    appearance: none;
    color: #fff;
  }
  .pig-modal-item-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .alt-down bq-results-table-optimized {
    cursor: pointer;
  }
  .pig-toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: rgb(17, 17, 17);
    color: #fff;
    padding: 12px 20px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.14);
    box-shadow: 0 18px 60px rgba(0,0,0,0.6);
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    font-size: 14px;
    z-index: 2147483647;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  .pig-toast.show {
    opacity: 1;
  }
  .pig-modal-item-wrapper {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .pig-modal-item-tag {
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    white-space: nowrap;
    flex-shrink: 0;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pig-modal-item-group {
    padding: 3px 0px;
    white-space: nowrap;
    flex-shrink: 0;
    min-width: 24px;
    text-align: center;
  }
  .pig-modal-logo-container {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    padding: 4px;
    box-sizing: border-box;
  }
  .pig-modal-refresh {
    position: relative;
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    border: 1px solid transparent;
    background: transparent;
    color: rgba(255,255,255,0.6);
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    outline: none;
    transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .pig-modal-refresh:hover,
  .pig-modal-settings:hover {
    color: rgba(255,255,255,0.9);
    background: rgba(255,255,255,0.08);
  }
  .pig-modal-refresh:focus,
  .pig-modal-settings:focus {
    border-color: rgba(96, 165, 250, 0.5);
    box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.3);
  }
  .pig-modal-settings {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    border: 1px solid transparent;
    background: transparent;
    color: rgba(255,255,255,0.6);
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    outline: none;
    transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .pig-modal-refresh.busy {
    pointer-events: none;
  }
  .pig-modal-refresh.busy svg {
    animation: pig-spin 1s linear infinite;
  }
  .pig-modal-refresh-badge {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 10px;
    height: 10px;
    display: block;
  }
  @keyframes pig-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .pig-modal-logo {
    width: 24px;
    height: 24px;
    display: block;
  }
  .pig-modal.pig-modal-with-content {
    width: min(1100px, 100%);
  }
  .pig-modal-body {
    display: flex;
    flex-direction: column;
  }
  .pig-modal-body.pig-modal-two-panel {
    flex-direction: row;
  }
  .pig-modal-two-panel .pig-modal-list {
    flex: 1;
    min-width: 0;
    border-right: 1px solid rgba(255,255,255,0.10);
  }
  .pig-modal-content-panel {
    flex: 1;
    min-width: 0;
    max-height: min(50vh, 480px);
    overflow: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .pig-format-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 10px;
    border-radius: 6px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
  }
  .pig-format-item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .pig-format-item-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: rgba(255,255,255,0.5);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pig-format-item-value {
    font-family: 'SF Mono', Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    line-height: 1.5;
    color: rgba(255,255,255,0.9);
    white-space: pre-wrap;
    word-break: break-word;
  }
  .pig-format-item-value.hljs {
    background: transparent;
    padding: 0;
    color: rgb(255, 255, 255);
  }
  /* BigQuery-inspired syntax highlighting colors */
  .pig-format-item-value .hljs-keyword {
    color: rgb(138, 180, 248);
  }
  .pig-format-item-value .hljs-string {
    color: rgb(168, 218, 181);
  }
  .pig-format-item-value .hljs-number {
    color: rgb(250, 144, 62);
  }
  .pig-format-item-value .hljs-built_in,
  .pig-format-item-value .hljs-title.function_ {
    color: rgb(138, 180, 248);
  }
  .pig-format-item-value .hljs-literal {
    color: rgb(250, 144, 62);
  }
  .pig-format-item-value .hljs-type {
    color: rgb(138, 180, 248);
  }
  .pig-format-item-value .hljs-comment {
    color: rgba(255, 255, 255, 0.4);
    font-style: italic;
  }
  /* JSON-specific: property names */
  .pig-format-item-value .hljs-attr {
    color: rgb(138, 180, 248);
  }
  /* XML-specific: tag names */
  .pig-format-item-value .hljs-name,
  .pig-format-item-value .hljs-tag {
    color: rgb(138, 180, 248);
  }
  .pig-format-item-value .hljs-attribute {
    color: rgb(168, 218, 181);
  }
  .pig-format-item-copy {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: rgba(255,255,255,0.35);
    cursor: pointer;
    transition: color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    outline: none;
  }
  .pig-format-item-copy:hover {
    color: rgba(255,255,255,0.7);
  }
  .pig-format-item-copy:focus {
    color: rgba(255,255,255,0.7);
    border-color: rgba(96, 165, 250, 0.5);
    box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.3);
  }
  .pig-format-item-copy:active {
    color: rgba(255,255,255,0.9);
  }
  .pig-modal-content-type {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    padding: 3px 8px;
    border-radius: 4px;
    background: rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.7);
  }
  .pig-modal-content-type.sql {
    background: rgba(99, 102, 241, 0.15);
    color: rgb(165, 180, 252);
  }
  @media (max-width: 900px) {
    .pig-modal-body.pig-modal-two-panel {
      flex-direction: column;
    }
    .pig-modal-two-panel .pig-modal-list {
      border-right: none;
      border-bottom: 1px solid rgba(255,255,255,0.10);
      max-height: min(30vh, 300px);
    }
    .pig-modal-content-panel {
      max-height: min(30vh, 300px);
    }
  }
`;

document.head.appendChild(makeEl("style", { id: "pig-modal-style", text: styles }));

function getInitials(name) {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    // Take first letter of first two words
    return (words[0][0] + words[1][0]).toUpperCase();
  } else if (name.length === 1) {
    return name[0].toUpperCase();
  } else {
    return name[0].toUpperCase() + name[1];
  }
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

function getLabelColor(name) {
  // Vibrant colors for tags
  const colors = [
    { bg: 'rgba(59, 130, 246, 0.2)', text: 'rgb(147, 197, 253)' },  // blue
    { bg: 'rgba(16, 185, 129, 0.2)', text: 'rgb(110, 231, 183)' },  // green
    { bg: 'rgba(245, 158, 11, 0.2)', text: 'rgb(251, 191, 36)' },   // amber
    { bg: 'rgba(139, 92, 246, 0.2)', text: 'rgb(196, 181, 253)' },  // purple
    { bg: 'rgba(236, 72, 153, 0.2)', text: 'rgb(249, 168, 212)' },  // pink
    { bg: 'rgba(6, 182, 212, 0.2)', text: 'rgb(103, 232, 249)' },   // cyan
    { bg: 'rgba(239, 68, 68, 0.2)', text: 'rgb(252, 165, 165)' },   // red
    { bg: 'rgba(168, 85, 247, 0.2)', text: 'rgb(216, 180, 254)' },  // violet
    { bg: 'rgba(34, 197, 94, 0.2)', text: 'rgb(134, 239, 172)' },   // emerald
    { bg: 'rgba(234, 179, 8, 0.2)', text: 'rgb(250, 204, 21)' },    // yellow
  ];

  const index = Math.abs(hashString(name)) % colors.length;
  return colors[index];
}

function showToast(message, duration = 2000) {
  const toast = makeEl("div", { className: "pig-toast", text: message });
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

function makeEl(tag, { id, className, text } = {}) {
  const el = document.createElement(tag);
  if (id) el.id = id;
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

function openPopup(getOptions, onOptionSelected, getHasErrors, getContent) {
  if (document.querySelector('.pig-modal-overlay')) return;

  let options = getOptions();
  let filtered = options.slice();
  let activeIndex = 0;
  let hasErrors = getHasErrors();
  let busyListener = null;

  const lastFocusedEl = document.activeElement;

  const overlayEl = makeEl("div", { className: "pig-modal-overlay" });
  const listEl = makeEl("div", { className: "pig-modal-list" });

  let focusRedirectHandler = null;
  let escapeHandler = null;

  function closePopup() {
    if (!overlayEl) return;
    onConfigurationChange = null;
    if (busyListener) {
      chrome.storage.onChanged.removeListener(busyListener);
    }
    if (focusRedirectHandler) {
      document.removeEventListener('focusin', focusRedirectHandler);
    }
    if (escapeHandler) {
      document.removeEventListener('keydown', escapeHandler, true);
    }
    overlayEl.remove();
    lastFocusedEl.focus();
  }

  overlayEl.addEventListener("mousedown", (e) => {
    if (e.target === overlayEl) {
      e.preventDefault();
      e.stopPropagation();
      closePopup();
    }
  });

  // Document-level Escape handler (keydown on modal only works when focus is inside)
  escapeHandler = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closePopup();
    }
  };
  document.addEventListener("keydown", escapeHandler, true);

  function scrollActiveIntoView() {
    const items = listEl.querySelectorAll(".pig-modal-item");
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

    active.scrollIntoView({ block: "nearest" });
  }

  function updateActiveStyles() {
    const items = listEl.querySelectorAll(".pig-modal-item");
    items.forEach((el, i) => {
      if (i === activeIndex) el.classList.add("active");
      else el.classList.remove("active");
    });
    scrollActiveIntoView();
  }

  const modalEl = makeEl("div", { className: "pig-modal pig-modal-with-content" });

  // Focusable elements in desired order - will be populated after elements are created
  let focusableElements = [];

  modalEl.addEventListener("keydown", (e) => {
    // Trap focus within modal
    if (e.key === "Tab") {
      // Get all focusable elements in the modal dynamically
      const allFocusable = Array.from(modalEl.querySelectorAll(
        'input, button:not([tabindex="-1"]), [tabindex="0"]'
      )).filter(el => el.offsetParent !== null); // Filter out hidden elements
      
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

    if (e.key === "ArrowDown" && document.activeElement === inputEl) {
      e.preventDefault();
      e.stopPropagation();
      if (filtered.length) {
        activeIndex = (activeIndex + 1) % filtered.length;
        updateActiveStyles();
        updateContentPanel();
      }
      return;
    }

    if (e.key === "ArrowUp" && document.activeElement === inputEl) {
      e.preventDefault();
      e.stopPropagation();
      if (filtered.length) {
        activeIndex = (activeIndex - 1 + filtered.length) % filtered.length;
        updateActiveStyles();
        updateContentPanel();
      }
      return;
    }

    if (e.key === "Enter") {
      // Only select item if input is focused, let buttons handle their own Enter
      if (document.activeElement === inputEl) {
        e.preventDefault();
        e.stopPropagation();
        onOptionSelected(filtered[activeIndex]);
        closePopup();
      }
      return;
    }

    e.stopPropagation();
  });

  function renderList() {
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);

    if (filtered.length === 0) {
      const empty = makeEl("div", { className: "pig-modal-empty" });
      empty.textContent = i18n.getMessage("noOptionsFound", LOCALE);
      listEl.appendChild(empty);
      return;
    }

    filtered.forEach((opt, idx) => {
      const itemClass = "pig-modal-item" + (idx === activeIndex ? " active" : "");
      const item = opt.url
        ? makeEl("a", { className: itemClass })
        : makeEl("div", { className: itemClass });

      if (opt.url) {
        item.href = opt.url;
        item.target = "_blank";
        item.rel = "noopener noreferrer";
      }

      const wrapper = makeEl("div", { className: "pig-modal-item-wrapper" });

      const group = makeEl("span", { className: "pig-modal-item-group", text: getInitials(opt.group) });
      const groupColors = getLabelColor(opt.group);
      group.style.color = groupColors.text;
      wrapper.appendChild(group);

      const name = makeEl("span", { className: "pig-modal-item-name", text: opt.name });
      wrapper.appendChild(name);

      if (opt.tag) {
        const tag = makeEl("span", { className: "pig-modal-item-tag", text: opt.tag });
        const colors = getLabelColor(opt.tag);
        tag.style.backgroundColor = colors.bg;
        tag.style.color = colors.text;
        wrapper.appendChild(tag);
      }

      item.appendChild(wrapper);

      item.addEventListener("mousedown", (e) => {
        // Prevent input blur before click handler runs
        e.preventDefault();
      });

      item.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onOptionSelected(filtered[idx]);
        closePopup();
      });

      listEl.appendChild(item);
    });

    scrollActiveIntoView();
  }

  const header = makeEl("div", { className: "pig-modal-header" });
  const iconContainer = makeEl("div", { className: "pig-modal-logo-container" });
  const iconEl = document.createElement("img");
  iconEl.className = "pig-modal-logo";
  iconEl.alt = "PigQuery";
  iconEl.src = ICON_URL;
  iconContainer.appendChild(iconEl);
  header.appendChild(iconContainer);

  const inputEl = makeEl("input", { className: "pig-modal-input" });
  inputEl.type = "text";
  inputEl.placeholder = i18n.getMessage("searchPlaceholder", LOCALE);
  inputEl.autocomplete = "off";
  inputEl.spellcheck = false;

  inputEl.addEventListener("input", () => {
    const query = (inputEl.value || "").trim().toLowerCase();
    filtered = search.filter(options, query);
    activeIndex = 0;
    renderList();
    updateContentPanel();
  });

  inputEl.addEventListener("focus", () => {
    modalEl.classList.add("input-focused");
  });

  inputEl.addEventListener("blur", () => {
    modalEl.classList.remove("input-focused");
  });

  onConfigurationChange = () => {
    options = getOptions();
    const query = (inputEl.value || "").trim().toLowerCase();
    filtered = search.filter(options, query);
    activeIndex = 0;
    renderList();
    updateContentPanel();

    hasErrors = getHasErrors();
    updateErrorBadge();
  };

  header.appendChild(inputEl);

  // Refresh button
  const refreshBtn = makeEl("button", { className: "pig-modal-refresh" });
  refreshBtn.type = "button";
  refreshBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>`;
  refreshBtn.title = "Refresh";

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
      const badgeEl = document.createElement("img");
      badgeEl.className = "pig-modal-refresh-badge";
      badgeEl.alt = "Error";
      badgeEl.src = ICON_ERROR_URL;
      refreshBtn.appendChild(badgeEl);
    } else if (!hasErrors && existingBadge) {
      existingBadge.remove();
    }
  }

  updateErrorBadge();

  // Check initial busy state
  chrome.storage.local.get(config.BUSY_KEY, (result) => {
    updateRefreshState(!!result[config.BUSY_KEY]);
  });

  // Listen for busy state changes
  busyListener = (changes) => {
    if (config.BUSY_KEY in changes) {
      updateRefreshState(!!changes[config.BUSY_KEY].newValue);
    }
  };
  chrome.storage.onChanged.addListener(busyListener);

  refreshBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isBusy) {
      chrome.runtime.sendMessage({ action: "refreshRemoteSources" });
    }
  });

  header.appendChild(refreshBtn);

  // Settings button
  const settingsBtn = makeEl("button", { className: "pig-modal-settings" });
  settingsBtn.type = "button";
  settingsBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>';
  settingsBtn.title = "Settings";
  settingsBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    chrome.runtime.sendMessage({ action: "openOptionsPage" });
  });
  header.appendChild(settingsBtn);

  modalEl.appendChild(header);

  // Create body container for list and content panel
  const bodyEl = makeEl("div", { className: "pig-modal-body pig-modal-two-panel" });
  bodyEl.appendChild(listEl);

  // Content panel elements (will be populated by updateContentPanel)
  const contentPanel = makeEl("div", { className: "pig-modal-content-panel" });
  bodyEl.appendChild(contentPanel);

  function updateContentPanel() {
    const selectedItem = filtered[activeIndex] || null;
    const contentInfo = getContent(selectedItem);

    // Clear existing content
    while (contentPanel.firstChild) contentPanel.removeChild(contentPanel.firstChild);

    if (contentInfo && contentInfo.length > 0) {
      contentInfo.forEach((item, index) => {
        const itemEl = makeEl("div", { className: "pig-format-item" });
        
        const copyValue = () => {
          navigator.clipboard.writeText(item.value);
          showToast(i18n.getMessage("contentCopied", LOCALE));
        };
        
        const headerEl = makeEl("div", { className: "pig-format-item-header" });
        
        const labelEl = makeEl("div", { className: "pig-format-item-label", text: item.label });
        headerEl.appendChild(labelEl);
        
        const copyBtn = makeEl("button", { className: "pig-format-item-copy" });
        copyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5.5" y="5.5" width="8" height="9" rx="1.5"/><path d="M3 10.5V3.5a1.5 1.5 0 0 1 1.5-1.5H10"/></svg>';
        copyBtn.title = "Copy";
        copyBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          copyValue();
        });
        copyBtn.addEventListener("focus", () => {
          // Only scroll on keyboard focus, not mouse click
          if (!copyBtn.matches(':focus-visible')) return;
          if (index === 0) {
            contentPanel.scrollTop = 0;
          } else {
            itemEl.scrollIntoView({ block: "nearest" });
          }
        });
        headerEl.appendChild(copyBtn);
        
        itemEl.appendChild(headerEl);

        const valueEl = makeEl("div", { className: "pig-format-item-value" });

        if (['json', 'xml', 'yaml', 'sql'].includes(item.type)) {
          const highlighted = hljs.highlight(item.value, {language: item.type});
          valueEl.innerHTML = highlighted.value;
          valueEl.classList.add('hljs');
        } else {
          valueEl.textContent = item.value;
        }
        itemEl.appendChild(valueEl);
        
        // Select text on right-click so browser shows "Copy" in context menu
        valueEl.addEventListener("contextmenu", () => {
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(valueEl);
          selection.removeAllRanges();
          selection.addRange(range);
        });

        contentPanel.appendChild(itemEl);
      });

      contentPanel.style.display = '';
    } else {
      contentPanel.style.display = 'none';
    }
  }

  modalEl.appendChild(bodyEl);

  overlayEl.appendChild(modalEl);
  document.body.appendChild(overlayEl);
  renderList();
  updateContentPanel();

  // Set up focus trap order: input → refresh → settings
  focusableElements = [inputEl, refreshBtn, settingsBtn];

  // Redirect focus back to modal if it escapes (e.g., user clicks URL bar then tabs back)
  focusRedirectHandler = (e) => {
    if (!modalEl.contains(e.target)) {
      inputEl.focus();
    }
  };
  document.addEventListener('focusin', focusRedirectHandler);

  inputEl.focus();
}

function getVisibleOrActiveEditor() {
  const editors = document.querySelectorAll('cfc-code-editor');

  const visibleEditors = Array.from(editors).filter(el =>
    el.checkVisibility ? el.checkVisibility() : (
      el.offsetWidth > 0 &&
      el.offsetHeight > 0 &&
      getComputedStyle(el).visibility !== 'hidden'
    )
  );

  if (visibleEditors.length === 1) {
    return visibleEditors[0];
  }

  if (visibleEditors.length > 1) {
    const activeEl = document.activeElement;
    if (!activeEl) return null;
    const activeEditor = activeEl.closest('cfc-code-editor');
    if (activeEditor && activeEditor.checkVisibility()) {
      return activeEditor;
    }
  }

  return null;
}

document.addEventListener(
  "keydown",
  (e) => {
    if (document.querySelector('.pig-modal-overlay')) return;

    if (window.copyTimeoutId) {
      clearTimeout(window.copyTimeoutId);
      window.copyTimeoutId = null;
    }

    if (!e.isComposing && !e.repeat && matchesShortcut(e, shortcuts.insertSnippet)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      if (!(e.target instanceof Element)) {
        showToast(i18n.getMessage("editorNotFocused", LOCALE));

        return;
      }
      const editor = e.target.closest('cfc-code-editor');
      if (!editor) {
        showToast(i18n.getMessage("editorNotFocused", LOCALE));
        return;
      }
      openPopup(() => configuration.snippets, (option) => {
        addRecentSnippetGroup(option.group);
        configuration.snippets = sortSnippets(configuration.snippets);
        insertIntoEditor(editor, option.value);
      }, () => configuration.hasErrors, (item) => item ? [{ label: 'SQL', value: item.value, type: 'sql' }] : null);
      return;
    }

    if (!e.isComposing && !e.repeat && e.key === 'a' && !e.shiftKey && !e.altKey && (isMac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey)) {
      if (!e.target.closest('cfc-code-editor')) {
        showToast(i18n.getMessage("editorNotFocused", LOCALE));
        return;
      }
      if (window.copyTimeoutId) {
        clearTimeout(window.copyTimeoutId);
        window.copyTimeoutId = null;
      }
      window.copyTimeoutId = copyShareLink();
      return;
    }

    if (e.key === 'Alt') {
      document.documentElement.classList.add('alt-down');
    }
  },
  true
);

document.addEventListener(
  "keyup",
  (e) => {
    if (e.key === 'Alt') {
      document.documentElement.classList.remove('alt-down');
    }
  }
);

function handleTableCellAction(e) {
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
    showToast(i18n.getMessage("cellCopied", LOCALE));
    return true;
  }

  const getMatchingOptions = () => configuration.sites
    .filter(option => option.regex.test(content))
    .map(option => ({
      ...option,
      url: option.url.replace('%s', option.encode === false ? content : encodeURIComponent(content))
    }));
  const contentInfo = formatters.detectContentType(content);
  openPopup(getMatchingOptions, (option) => {
    configuration.sites = sortSites(configuration.sites, { group: option.group, name: option.name, tag: option.tag });
    window.open(option.url, "_blank", "noopener,noreferrer");
  }, () => configuration.hasErrors, () => contentInfo);

  // BigQuery steals focus asynchronously on the results table. Re-focus if this happens.
  const onFocusIn = () => {
    const input = document.querySelector(".pig-modal-input");
    if (input) {
      input.focus();
    } else {
      cell.removeEventListener('focusin', onFocusIn, true);
    }
  };

  cell.addEventListener('focusin', onFocusIn, true);
  return true;
}

document.addEventListener(
  'click',
  (e) => {
    if (!e.altKey) return;
    if (e.shiftKey) return; // BigQuery ignores shift clicks so we do too.
    handleTableCellAction(e);
  },
  true
);

document.addEventListener(
  'keydown',
  (e) => {
    if (!e.altKey) return;
    if (e.key !== 'Enter') return;
    if (e.shiftKey) return; // BigQuery ignores shift clicks so we ignore shift-enter.
    handleTableCellAction(e);
  },
  true
);

function copyShareLink() {
  return setTimeout(async () => {
    document.execCommand("copy");
    const query = await navigator.clipboard.readText();
    const url = new URL(window.location.href);
    const project = url.searchParams.get("project");
    url.search = "";
    url.hash = "";
    url.searchParams.set("pig", base64Encode(query));
    if (project) url.searchParams.set("project", project);
    const shareLink = url.toString();
    await navigator.clipboard.writeText(shareLink);
    showToast(i18n.getMessage("linkCopied", LOCALE));
  }, 500);
}

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

async function loadConfiguration() {
  const loaded = await config.loadConfiguration();
  configuration = {
    snippets: sortSnippets(loaded.snippets),
    sites: sortSites(loaded.sites, null),
    hasErrors: loaded.hasErrors,
  };
  onConfigurationChange?.();
}

loadConfiguration();

async function loadShortcuts() {
  shortcuts = await config.loadShortcuts();
}
loadShortcuts();

chrome.storage.onChanged.addListener((changes) => {
  if (config.STORAGE_KEY in changes) {
    loadConfiguration();
  }
  if (config.SHORTCUTS_KEY in changes) {
    loadShortcuts();
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
    gap: 10px;
  }
  .pig-modal-input {
    width: 100%;
    flex: 1;
    box-sizing: border-box;
    padding: 10px 12px;
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
  .pig-modal-link {
    color: #6cb6ff;
    text-decoration: none;
    cursor: pointer;
  }
  .pig-modal-link:hover {
    text-decoration: underline;
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
  .pig-modal-item.active {
    background: rgba(96, 165, 250, 0.2);
    border-color: rgba(96, 165, 250, 0.5);
    box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.3);
  }
  .pig-modal-item.active:hover {
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
    position: relative;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    cursor: pointer;
    border: none;
    background: transparent;
    padding: 4px;
    border-radius: 4px;
    box-sizing: border-box;
  }
  .pig-modal-refresh {
    position: relative;
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    border: none;
    background: transparent;
    color: rgba(255,255,255,0.6);
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: color 0.15s ease, background 0.15s ease;
  }
  .pig-modal-refresh:hover {
    color: rgba(255,255,255,0.9);
    background: rgba(255,255,255,0.08);
  }
  .pig-modal-refresh.busy {
    pointer-events: none;
  }
  .pig-modal-refresh.busy svg {
    animation: pig-spin 1s linear infinite;
  }
  .pig-modal-refresh.error {
    color: rgb(248, 113, 113);
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
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .pig-modal-content-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-shrink: 0;
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
  .pig-modal-content-type.json {
    background: rgba(250, 204, 21, 0.15);
    color: rgb(250, 204, 21);
  }
  .pig-modal-content-type.yaml {
    background: rgba(139, 92, 246, 0.15);
    color: rgb(196, 181, 253);
  }
  .pig-modal-content-type.jwt {
    background: rgba(236, 72, 153, 0.15);
    color: rgb(249, 168, 212);
  }
  .pig-modal-content-type.base64 {
    background: rgba(34, 197, 94, 0.15);
    color: rgb(134, 239, 172);
  }
  .pig-modal-content-type.date {
    background: rgba(20, 184, 166, 0.15);
    color: rgb(94, 234, 212);
  }
  .pig-modal-content-type.datetime {
    background: rgba(14, 165, 233, 0.15);
    color: rgb(125, 211, 252);
  }
  .pig-modal-content-type.number {
    background: rgba(251, 146, 60, 0.15);
    color: rgb(253, 186, 116);
  }
  .pig-modal-content-type.url {
    background: rgba(6, 182, 212, 0.15);
    color: rgb(103, 232, 249);
  }
  .pig-modal-content-type.xml {
    background: rgba(245, 158, 11, 0.15);
    color: rgb(251, 191, 36);
  }
  .pig-modal-content-type.hex {
    background: rgba(168, 85, 247, 0.15);
    color: rgb(216, 180, 254);
  }
  .pig-modal-content-type.uuid {
    background: rgba(239, 68, 68, 0.15);
    color: rgb(252, 165, 165);
  }
  .pig-modal-content-type.sql {
    background: rgba(99, 102, 241, 0.15);
    color: rgb(165, 180, 252);
  }
  .pig-modal-content-copy {
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.14);
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.8);
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .pig-modal-content-copy:hover {
    background: rgba(255,255,255,0.12);
  }
  .pig-modal-content-pre {
    flex: 1;
    margin: 0;
    padding: 12px;
    border-radius: 8px;
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.08);
    font-family: 'SF Mono', Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    line-height: 1.5;
    color: rgba(255,255,255,0.85);
    white-space: pre-wrap;
    word-break: break-word;
    overflow: auto;
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

  function closePopup() {
    if (!overlayEl) return;
    onConfigurationChange = null;
    if (busyListener) {
      chrome.storage.onChanged.removeListener(busyListener);
    }
    if (focusRedirectHandler) {
      document.removeEventListener('focusin', focusRedirectHandler);
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
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closePopup();
      return;
    }

    // Trap focus within modal
    if (e.key === "Tab") {
      const currentIndex = focusableElements.indexOf(document.activeElement);
      if (currentIndex !== -1) {
        e.preventDefault();
        e.stopPropagation();
        let nextIndex;
        if (e.shiftKey) {
          nextIndex = (currentIndex - 1 + focusableElements.length) % focusableElements.length;
        } else {
          nextIndex = (currentIndex + 1) % focusableElements.length;
        }
        focusableElements[nextIndex].focus();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      if (filtered.length) {
        activeIndex = (activeIndex + 1) % filtered.length;
        updateActiveStyles();
        updateContentPanel();
      }
      return;
    }

    if (e.key === "ArrowUp") {
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
      empty.textContent = i18n.getMessage("noOptionsFound", LOCALE) + " ";
      const link = makeEl("a", { className: "pig-modal-link", text: i18n.getMessage("extensionOptions", LOCALE) });
      link.href = "#";
      link.addEventListener("click", (e) => {
        e.preventDefault();
        chrome.runtime.sendMessage({ action: "openOptionsPage" });
      });
      empty.appendChild(link);
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
  const iconContainer = makeEl("button", { className: "pig-modal-logo-container" });
  iconContainer.type = "button";
  iconContainer.title = "Options";
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

  iconContainer.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    chrome.runtime.sendMessage({ action: "openOptionsPage" });
    inputEl.focus();
  });

  inputEl.addEventListener("input", () => {
    const query = (inputEl.value || "").trim().toLowerCase();
    filtered = search.filter(options, query);
    activeIndex = 0;
    renderList();
    updateContentPanel();
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
      refreshBtn.classList.add('error');
    } else if (!hasErrors && existingBadge) {
      existingBadge.remove();
      refreshBtn.classList.remove('error');
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
    inputEl.focus();
  });

  header.appendChild(refreshBtn);

  modalEl.appendChild(header);

  // Create body container for list and content panel
  const bodyEl = makeEl("div", { className: "pig-modal-body pig-modal-two-panel" });
  bodyEl.appendChild(listEl);

  // Content panel elements (will be populated by updateContentPanel)
  let currentFormattedContent = null;

  const contentPanel = makeEl("div", { className: "pig-modal-content-panel" });

  const contentHeader = makeEl("div", { className: "pig-modal-content-header" });
  const typeLabel = makeEl("span", { className: "pig-modal-content-type" });
  contentHeader.appendChild(typeLabel);

  const copyBtn = makeEl("button", { className: "pig-modal-content-copy", text: i18n.getMessage("copy", LOCALE) || "Copy" });
  copyBtn.addEventListener("click", () => {
    if (currentFormattedContent) {
      navigator.clipboard.writeText(currentFormattedContent);
      showToast(i18n.getMessage("contentCopied", LOCALE) || "Copied to clipboard");
    }
  });
  contentHeader.appendChild(copyBtn);
  contentPanel.appendChild(contentHeader);

  const pre = makeEl("pre", { className: "pig-modal-content-pre" });
  contentPanel.appendChild(pre);

  bodyEl.appendChild(contentPanel);

  function updateContentPanel() {
    const selectedItem = filtered[activeIndex] || null;
    const contentInfo = getContent(selectedItem);

    if (contentInfo && contentInfo.formatted) {
      currentFormattedContent = contentInfo.formatted;

      // Update type label
      typeLabel.className = `pig-modal-content-type ${contentInfo.type || 'text'}`;
      typeLabel.textContent = (contentInfo.type || 'text').toUpperCase();

      // Update content
      pre.textContent = contentInfo.formatted;

      contentPanel.style.display = '';
    } else {
      currentFormattedContent = null;
      contentPanel.style.display = 'none';
    }
  }

  modalEl.appendChild(bodyEl);

  overlayEl.appendChild(modalEl);
  document.body.appendChild(overlayEl);
  renderList();
  updateContentPanel();

  // Set up focus trap order: input → refresh → copy → logo
  focusableElements = [inputEl, refreshBtn, copyBtn, iconContainer];

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
      }, () => configuration.hasErrors, (item) => item ? { type: 'sql', formatted: item.value } : null);
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

document.addEventListener(
  'click',
  (e) => {
    if (!e.altKey) return;
    if (e.shiftKey) return; // BigQuery ignores shift clicks so we do too.
    if (!(e.target instanceof Element)) return;
    const table = e.target.closest('bq-results-table-optimized');
    if (!table) return;
    const cell = table.querySelector('[role="cell"]');
    if (!cell) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const content = cell.innerText.trim();

    if (isMac ? e.metaKey : e.ctrlKey) {
      navigator.clipboard.writeText(content);
      showToast(i18n.getMessage("cellCopied", LOCALE));
      return;
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

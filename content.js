const common = window.pigquery.common;
const i18n = window.pigquery.i18n;
const search = window.pigquery.search;
const LOCALE = i18n.getBigQueryLocale();
i18n.applyI18n(LOCALE);

const ICON_URL = chrome.runtime.getURL("icon.svg");

let config;

function setConfig(newConfig) {
  config = newConfig
  config.sites = config.sites.map(option => ({
    ...option,
    regex: new RegExp(option.regex),
  }));
}

function loadConfig() {
  setConfig(common.defaultConfig());
  chrome.storage.local.get(["userPayload"], (result) => {
    if (result.userPayload) {
      setConfig(JSON.parse(result.userPayload));
    }
  });
}
loadConfig();

chrome.storage.onChanged.addListener(loadConfig);

// Extract and remove the 'pig' query parameter on page load
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

    cleanup();
    insertIntoEditor(editors[editors.length - 1], query.trim());
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
  .pig-modal-item {
    padding: 12px;
    border-radius: 10px;
    cursor: pointer;
    user-select: none;
    border: 1px solid rgba(255,255,255,0.12);
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
  .pig-modal-logo {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    display: block;
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

function openPopup(options, onOptionSelected) {
  if (document.querySelector('.pig-modal-overlay')) return;

  let filtered = options.slice();
  let activeIndex = 0;

  const lastFocusedEl = document.activeElement;

  const overlayEl = makeEl("div", { className: "pig-modal-overlay" });
  const listEl = makeEl("div", { className: "pig-modal-list" });

  function closePopup() {
    if (!overlayEl) return;
    overlayEl.remove();
    if (lastFocusedEl && typeof lastFocusedEl.focus === "function") lastFocusedEl.focus();
  }

  overlayEl.addEventListener("mousedown", (e) => {
    if (e.target === overlayEl) closePopup();
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

  const modalEl = makeEl("div", { className: "pig-modal" });
  modalEl.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closePopup();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      if (filtered.length) {
        activeIndex = (activeIndex + 1) % filtered.length;
        updateActiveStyles();
      }
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      if (filtered.length) {
        activeIndex = (activeIndex - 1 + filtered.length) % filtered.length;
        updateActiveStyles();
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      onOptionSelected(filtered[activeIndex]);
      closePopup();
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
      const item = makeEl("div", { className: "pig-modal-item" + (idx === activeIndex ? " active" : "") });

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

      item.addEventListener("click", () => {
        onOptionSelected(filtered[idx]);
        closePopup();
      });

      listEl.appendChild(item);
    });

    scrollActiveIntoView();
  }

  const header = makeEl("div", { className: "pig-modal-header" });
  const iconEl = document.createElement("img");
  iconEl.className = "pig-modal-logo";
  iconEl.alt = "PigQuery";
  iconEl.src = ICON_URL;
  header.appendChild(iconEl);

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
  });

  header.appendChild(inputEl);

  modalEl.appendChild(header);
  modalEl.appendChild(listEl);

  overlayEl.appendChild(modalEl);
  document.body.appendChild(overlayEl);
  renderList();

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

    if (!e.isComposing && !e.repeat && e.key === 'i' && e.shiftKey && e.metaKey && !e.altKey && !e.ctrlKey) {
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
      openPopup(config.snippets, (option) => {
        insertIntoEditor(editor, option.value);
      });
      return;
    }

    if (!e.isComposing && !e.repeat && e.key === 'a' && !e.shiftKey && e.metaKey && !e.altKey && !e.ctrlKey) {
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

    if (!e.isComposing && !e.repeat && e.key === 'c' && !e.shiftKey && e.metaKey && !e.altKey && !e.ctrlKey) {
      if (window.copyTimeoutId) {
        clearTimeout(window.copyTimeoutId);
        window.copyTimeoutId = null;
      }
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

    if (e.metaKey) {
      navigator.clipboard.writeText(content);
      showToast(i18n.getMessage("cellCopied", LOCALE));
      return;
    }

    const matchingOptions = config.sites.filter(option => option.regex.test(content));
    openPopup(matchingOptions, (option) => {
      window.open(option.url.replace('%s', encodeURIComponent(content)), "_blank", "noopener,noreferrer");
    });

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

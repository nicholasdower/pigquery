let config = {
  snippets: window.DEFAULT_CONFIG.snippets,
  sites: window.DEFAULT_CONFIG.sites.map(option => ({
    ...option,
    regex: new RegExp(option.regex),
  })),
};

chrome.storage.local.get(["userPayload"], (result) => {
  if (result.userPayload) {
    config = JSON.parse(result.userPayload);
    config.sites = config.sites.map(option => ({
      ...option,
      regex: new RegExp(option.regex),
    }));
  }
});

let clickedTab = false;
chrome.runtime.sendMessage({ type: "GET_QUERY" }, (resp) => {
  let query = resp?.query;

  query = query ? base64Decode(query.trim()).trim() : null;
  if (!query || query.length === 0) return;

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
});

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

  if (editor.shadowRoot) {
    ta = editor.shadowRoot.querySelector("textarea.inputarea") || editor.shadowRoot.querySelector("textarea");
    if (ta) return ta;
  }

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

// --------- UI (POPUP) ---------
let overlayEl = null;
let modalEl = null;
let inputEl = null;
let listEl = null;

let filtered = config.snippets.slice();
let activeIndex = 0;
// Prevent scroll-induced mouseenter from changing selection when navigating with keyboard.
let lastNavMethod = "keyboard";

function setNavMethod(method) {
  lastNavMethod = method;
  // When navigating via keyboard, disable hover highlighting entirely.
  if (modalEl) {
    if (method === "mouse") modalEl.classList.add("tm-nav-mouse");
    else modalEl.classList.remove("tm-nav-mouse");
  }
}
let lastEditor = null;
let lastFocusedEl = document.activeElement;

const styles = `
  .tm-modal-overlay {
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
  .tm-modal {
    background: #111;
    border: 1px solid rgba(255,255,255,0.14);
    border-radius: 12px;
    box-shadow: 0 18px 60px rgba(0,0,0,0.6);
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    color: #fff;
    overflow: hidden;
  }
  #tm-snippet-modal {
    width: min(720px, 100%);
  }
  #tm-snippet-header {
    padding: 14px;
    border-bottom: 1px solid rgba(255,255,255,0.10);
  }
  #tm-snippet-input {
    width: 100%;
    box-sizing: border-box;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.14);
    background: rgba(255,255,255,0.06);
    color: #fff;
    outline: none;
    font-size: 14px;
  }
  #tm-snippet-input::placeholder {
    color: rgba(255,255,255,0.45);
  }
  .tm-modal-list {
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  #tm-snippet-list {
    height: min(50vh, 480px);
    overflow: auto;
  }
  .tm-modal-item {
    padding: 10px;
    border-radius: 10px;
    cursor: pointer;
    user-select: none;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.04);
    font-size: 14px;
    line-height: 1.3;
  }
  .tm-modal-item:hover {
    background: rgba(255,255,255,0.08);
  }
  #tm-snippet-modal.tm-nav-mouse .tm-modal-item:hover:not(.active) {
    background: rgba(255,255,255,0.07);
  }
  .tm-modal-item.active {
    background: rgba(255,255,255,0.10);
    border-color: rgba(255,255,255,0.18);
  }
  .tm-modal-item[type="button"] {
    width: 100%;
    text-align: left;
    appearance: none;
    color: #fff;
  }
  #tm-snippet-empty {
    padding: 12px 10px;
    opacity: 0.65;
    font-size: 13px;
    user-select: none;
  }
  .tm-kbd {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    padding: 2px 6px;
    border: 1px solid rgba(255,255,255,0.18);
    border-bottom-color: rgba(255,255,255,0.25);
    border-radius: 6px;
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.9);
  }
  .alt-down bq-results-table-optimized {
    cursor: pointer;
  }
  #tm-click-modal {
    width: min(520px, 100%);
  }
  .tm-toast {
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
  .tm-toast.show {
    opacity: 1;
  }

  .tm-link-icon-button {
    width: 24px;
    height: 24px;
    padding: 0;
    background-color: white; /* icon color */
    border: none;
    cursor: pointer;

    /* transparent button, icon via mask */
    -webkit-mask: url("data:image/svg+xml;utf8,\
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>\
  <path d='M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11 4'/>\
  <path d='M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07L13 20'/>\
  </svg>") center / 16px 16px no-repeat;

    mask: url("data:image/svg+xml;utf8,\
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>\
  <path d='M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11 4'/>\
  <path d='M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07L13 20'/>\
  </svg>") center / 16px 16px no-repeat;
  }

  .tm-link-icon-button:hover {
    opacity: 0.8;
  }

  .tm-link-icon-button:focus {
    outline: none;
  }
  .tm-modal-item-wrapper {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .tm-modal-item-description {
    flex: 1;
    min-width: 0;
  }
  .tm-type-label {
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    white-space: nowrap;
    flex-shrink: 0;
  }
`;

function addStyles() {
  const style = document.createElement("style");
  style.id = "tm-snippet-style";
  style.textContent = styles;
  document.head.appendChild(style);
}

addStyles();

function getTypeColor(type) {
  // Hash function to generate consistent color for each type
  let hash = 0;
  for (let i = 0; i < type.length; i++) {
    hash = type.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Generate colors that look good on dark background
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

  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

function showToast(message, duration = 2000) {
  const toast = document.createElement("div");
  toast.className = "tm-toast";
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

function matches(query, option) {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return option.description.toLowerCase().includes(q) ||  option.type.toLowerCase().includes(q);
}

function updateActiveStyles() {
  const items = listEl.querySelectorAll(".tm-modal-item");
  items.forEach((el, i) => {
    if (i === activeIndex) el.classList.add("active");
    else el.classList.remove("active");
  });
  scrollActiveIntoView();
}

function scrollActiveIntoView() {
  const items = listEl.querySelectorAll(".tm-modal-item");
  const active = items[activeIndex];
  if (!active) return;

  // Special handling for first and last items to show padding
  if (activeIndex === 0) {
    listEl.scrollTop = 0;
    return;
  }
  if (activeIndex === items.length - 1) {
    listEl.scrollTop = listEl.scrollHeight;
    return;
  }

  // Reliable scrolling within an overflow container.
  // 'nearest' keeps the list stable and avoids jumping.
  try {
    active.scrollIntoView({ block: "nearest" });
  } catch (_) {
    // Fallback: manual scroll using bounding boxes
    const c = listEl.getBoundingClientRect();
    const r = active.getBoundingClientRect();
    const topOverflow = r.top - c.top;
    const bottomOverflow = r.bottom - c.bottom;
    if (topOverflow < 0) listEl.scrollTop += topOverflow;
    else if (bottomOverflow > 0) listEl.scrollTop += bottomOverflow;
  }
}

function chooseIndex(idx) {
  const opt = filtered[idx];
  if (!opt) return;
  if (!lastEditor) return;
  insertIntoEditor(lastEditor, opt.value);
  closePopup();
}

function renderList() {
  while (listEl.firstChild) listEl.removeChild(listEl.firstChild);

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.id = "tm-snippet-empty";
    if (config.snippets.length === 0) {
      empty.textContent = "No insert options configured.";
    } else {
      empty.textContent = "No insert options match.";
    }
    listEl.appendChild(empty);
    return;
  }

  filtered.forEach((opt, idx) => {
    const item = document.createElement("div");
    item.className = "tm-modal-item" + (idx === activeIndex ? " active" : "");

    const wrapper = document.createElement("div");
    wrapper.className = "tm-modal-item-wrapper";

    const description = document.createElement("span");
    description.className = "tm-modal-item-description";
    description.textContent = opt.description;

    const typeLabel = document.createElement("span");
    typeLabel.className = "tm-type-label";
    typeLabel.textContent = opt.type;
    const colors = getTypeColor(opt.type);
    typeLabel.style.backgroundColor = colors.bg;
    typeLabel.style.color = colors.text;

    wrapper.appendChild(description);
    wrapper.appendChild(typeLabel);
    item.appendChild(wrapper);

    // Only let the mouse change selection if the user actually moved the mouse recently.
    // This avoids selection "jumping" while the list scrolls under a stationary cursor.
    item.addEventListener("mouseenter", () => {
      if (lastNavMethod !== "mouse") return;
      activeIndex = idx;
      updateActiveStyles();
    });

    item.addEventListener("mousedown", (e) => {
      // Prevent input blur before click handler runs
      e.preventDefault();
    });

    item.addEventListener("click", () => {
      chooseIndex(idx);
    });

    listEl.appendChild(item);
  });

  scrollActiveIntoView();
}

function applyFilter() {
  const q = inputEl.value || "";
  filtered = config.snippets.filter((opt) => matches(q, opt));
  activeIndex = 0;
  renderList();
}

function onOverlayMouseDown(e) {
  if (e.target === overlayEl) closePopup();
}

function onPopupKeyDown(e) {
  if (e.key === "Escape") {
    e.preventDefault();
    closePopup();
    return;
  }

  if (e.key === "ArrowDown") {
    setNavMethod("keyboard");
    e.preventDefault();
    if (filtered.length) {
      activeIndex = (activeIndex + 1) % filtered.length;
      updateActiveStyles();
    }
    return;
  }

  if (e.key === "ArrowUp") {
    setNavMethod("keyboard");
    e.preventDefault();
    if (filtered.length) {
      activeIndex = (activeIndex - 1 + filtered.length) % filtered.length;
      updateActiveStyles();
    }
    return;
  }

  if (e.key === "Enter") {
    e.preventDefault();
    if (filtered.length) chooseIndex(activeIndex);
    return;
  }
}

function makeEl(tag, { id, className, text } = {}) {
  const el = document.createElement(tag);
  if (id) el.id = id;
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

function openPopup(editor) {
  if (overlayEl) return;

  lastFocusedEl = document.activeElement;
  lastEditor = editor;

  overlayEl = makeEl("div", { className: "tm-modal-overlay" });
  overlayEl.id = "tm-snippet-overlay";
  overlayEl.addEventListener("mousedown", onOverlayMouseDown);

  modalEl = makeEl("div", { className: "tm-modal" });
  modalEl.id = "tm-snippet-modal";
  // Default to keyboard navigation mode on open (no hover highlight unless mouse moves).
  setNavMethod("keyboard");
  modalEl.addEventListener("keydown", onPopupKeyDown);

  const header = makeEl("div", { id: "tm-snippet-header" });

  inputEl = document.createElement("input");
  inputEl.id = "tm-snippet-input";
  inputEl.type = "text";
  inputEl.placeholder = "Search…";
  inputEl.autocomplete = "off";
  inputEl.spellcheck = false;
  inputEl.addEventListener("input", applyFilter);
  inputEl.addEventListener("keydown", onPopupKeyDown);

  header.appendChild(inputEl);

  listEl = makeEl("div", { id: "tm-snippet-list", className: "tm-modal-list" });

  // If the user moves the mouse over the list, allow hover to change selection.
  listEl.addEventListener("mousemove", (ev) => {
    // If the user starts using the mouse after keyboard navigation,
    // immediately move the active selection to the item under the cursor
    // so we never show two highlighted rows.
    const wasKeyboard = lastNavMethod !== "mouse";
    setNavMethod("mouse");
    if (!wasKeyboard) return;

    const el = document.elementFromPoint(ev.clientX, ev.clientY);
    const item = el && el.closest ? el.closest(".tm-modal-item") : null;
    if (!item || !listEl.contains(item)) return;

    const items = Array.from(listEl.querySelectorAll(".tm-modal-item"));
    const idx = items.indexOf(item);
    if (idx >= 0) {
      activeIndex = idx;
      updateActiveStyles();
    }
  });

  modalEl.appendChild(header);
  modalEl.appendChild(listEl);

  overlayEl.appendChild(modalEl);
  document.body.appendChild(overlayEl);

  // Default: all options match
  filtered = config.snippets.slice();
  activeIndex = 0;
  renderList();

  // Focus search box
  inputEl.focus();
  inputEl.select();
}

function closePopup() {
  if (!overlayEl) return;

  overlayEl.removeEventListener("mousedown", onOverlayMouseDown);
  overlayEl.remove();

  overlayEl = null;
  modalEl = null;
  inputEl = null;
  listEl = null;
  lastEditor = null;

  // Restore focus if possible
  try {
    if (lastFocusedEl && typeof lastFocusedEl.focus === "function") lastFocusedEl.focus();
  } catch (_) {
    // ignore
  } finally {
    lastFocusedEl = null;
  }
}

document.addEventListener(
  "keydown",
  (e) => {
    // Toggle behavior: if popup open and insert shortcut pressed again, close it.
    if (!e.isComposing && !e.repeat && e.key === 'i' && e.ctrlKey && e.metaKey && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

      if (!(e.target instanceof Element)) {
        showToast("Editor not focused.");
        return;
      }
      const editor = e.target.closest('cfc-code-editor');
      if (!editor) {
        showToast("Editor not focused.");
        return;
      }
      if (overlayEl) {
        closePopup();
      } else {
        openPopup(editor);
      }
      return;
    }

    // When popup is open, intercept navigation keys globally (even if the search input has focus).
    if (overlayEl) {
      const k = e.key;
      if (k === "Escape" || k === "ArrowDown" || k === "ArrowUp" || k === "Enter") {
        // Ensure the browser/site does not consume these keys.
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        onPopupKeyDown(e);
        return;
      }

      // For all other keys (typing in the search box), keep them working,
      // but prevent BigQuery/Monaco from reacting.
      e.stopPropagation();
      return;
    }

    if (!e.isComposing && !e.repeat && e.key === 's' && e.ctrlKey && e.metaKey && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

      if (!(e.target instanceof Element)) {
        showToast("Editor not focused.");
        return;
      }
      const editor = e.target.closest('cfc-code-editor');
      if (!editor) {
        showToast("Editor not focused.");
        return;
      }
      copyShareLink(editor);
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

    const query = cell.innerText.trim();

    if (e.metaKey) {
      navigator.clipboard.writeText(query);
      showToast("Copied to clipboard.");
      return;
    }
    if (config.sites.length === 0) {
      showToast("No click options configured.");
      return;
    }
    const matchingItems = config.sites.filter(item => item.regex.test(query));
    if (matchingItems.length === 0) {
      showToast("No matching click option found.");
      return;
    }

    function cleanup() {
      document.removeEventListener("keydown", onKeyDown, true);
      backdrop.remove();
    }

    function openUrl(url) {
      window.open(url, "_blank", "noopener,noreferrer");
      cleanup();
    }

    function onKeyDown(e) {
      if (e.key === "Escape") cleanup();
      if (e.key === "Enter" && document.activeElement instanceof HTMLButtonElement) {
        document.activeElement.click();
      }
    }

    const backdrop = document.createElement("div");
    backdrop.className = "tm-modal-overlay";
    backdrop.id = "tm-click-backdrop";
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");
    backdrop.tabIndex = -1;

    const modal = document.createElement("div");
    modal.className = "tm-modal";
    modal.id = "tm-click-modal";

    const list = document.createElement("div");
    list.className = "tm-modal-list";
    list.id = "tm-click-list";

    matchingItems.forEach((item, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tm-modal-item";
      btn.textContent = item.label;
      btn.dataset.index = String(idx);

      btn.addEventListener("click", () => openUrl(item.url.replace('%s', encodeURIComponent(query))));
      list.appendChild(btn);
    });

    modal.appendChild(list);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) cleanup();
    });

    document.addEventListener("keydown", onKeyDown, true);

    const firstBtn = list.querySelector("button");
    if (firstBtn) firstBtn.focus();
  },
  true
);

function copyShareLink(editor) {
  const viewLines = editor.querySelector('[role="code"] [role="presentation"] .view-lines');
  if (!viewLines) return;
  const query = viewLines.innerText.trim().replace(/\u00A0/g, ' ');
  const url = new URL(window.location.href);
  const project = url.searchParams.get("project");
  url.search = "";
  url.hash = "";
  if (project) url.searchParams.set("project", project);
  url.searchParams.set("q", base64Encode(query));
  const shareLink = url.toString();
  navigator.clipboard.writeText(shareLink);
  showToast("Query copied to clipboard.");
}
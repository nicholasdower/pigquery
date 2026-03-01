/**
 * DOM utilities
 */

/**
 * Creates a DOM element with optional id, className, and text content.
 */
export function makeEl(tag, { id, className, text } = {}) {
  const el = document.createElement(tag);
  if (id) el.id = id;
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

/**
 * Shows a toast notification message.
 */
export function showToast(message, duration = 2000) {
  const toast = makeEl('div', { className: 'pig-toast', text: message });
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 0);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

/**
 * Visual/Display utilities
 */

/**
 * Gets initials from a name (first letter of first two words, or first two letters if single word).
 */
export function getInitials(name) {
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

/**
 * Hashes a string to a number.
 */
export function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

/**
 * Gets a color pair (background and text) for a label based on its name.
 */
export function getLabelColor(name) {
  // Vibrant colors for tags
  const colors = [
    { bg: 'rgba(59, 130, 246, 0.2)', text: 'rgb(147, 197, 253)' }, // blue
    { bg: 'rgba(16, 185, 129, 0.2)', text: 'rgb(110, 231, 183)' }, // green
    { bg: 'rgba(245, 158, 11, 0.2)', text: 'rgb(251, 191, 36)' }, // amber
    { bg: 'rgba(139, 92, 246, 0.2)', text: 'rgb(196, 181, 253)' }, // purple
    { bg: 'rgba(236, 72, 153, 0.2)', text: 'rgb(249, 168, 212)' }, // pink
    { bg: 'rgba(6, 182, 212, 0.2)', text: 'rgb(103, 232, 249)' }, // cyan
    { bg: 'rgba(239, 68, 68, 0.2)', text: 'rgb(252, 165, 165)' }, // red
    { bg: 'rgba(168, 85, 247, 0.2)', text: 'rgb(216, 180, 254)' }, // violet
    { bg: 'rgba(34, 197, 94, 0.2)', text: 'rgb(134, 239, 172)' }, // emerald
    { bg: 'rgba(234, 179, 8, 0.2)', text: 'rgb(250, 204, 21)' }, // yellow
  ];

  const index = Math.abs(hashString(name)) % colors.length;
  return colors[index];
}

/**
 * Editor utilities
 */

/**
 * Finds the textarea element within a code editor.
 */
export function findEditorTextArea(editor) {
  let ta = editor.querySelector('textarea.inputarea') || editor.querySelector('textarea');
  if (ta) return ta;

  return null;
}

/**
 * Inserts text into a code editor using various strategies.
 */
export function insertIntoEditor(editor, text) {
  if (!editor) return null;
  const ta = findEditorTextArea(editor);
  if (!ta) return false;

  // First try to simulate a paste event. This avoids auto-formatting issues in Monaco and can be reverted with a single undo.
  try {
    ta.focus();

    const dt = new DataTransfer();
    dt.setData('text/plain', text);

    const pasteEvent = new ClipboardEvent('paste', {
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

  const isMultiline = text.includes('\n');

  // Single-line inserts: execCommand behaves closest to normal typing.
  if (!isMultiline) {
    try {
      ta.focus();
      if (document.execCommand && document.execCommand('insertText', false, text)) {
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
    const start = ta.selectionStart ?? ta.value?.length ?? 0;
    const end = ta.selectionEnd ?? ta.value?.length ?? 0;

    if (typeof ta.setRangeText === 'function') {
      ta.setRangeText(text, start, end, 'end');
    } else {
      const v = ta.value ?? '';
      ta.value = v.slice(0, start) + text + v.slice(end);
      const pos = start + text.length;
      if (typeof ta.selectionStart === 'number') {
        ta.selectionStart = ta.selectionEnd = pos;
      }
    }

    const inputType = isMultiline ? 'insertFromPaste' : 'insertText';
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType, data: text }));
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Gets the visible or active code editor on the page.
 */
export function getVisibleOrActiveEditor() {
  const editors = document.querySelectorAll('cfc-code-editor');

  const visibleEditors = Array.from(editors).filter(el => el.checkVisibility());

  if (visibleEditors.length === 1) {
    return visibleEditors[0];
  }

  if (visibleEditors.length > 1) {
    const activeEl = document.activeElement;
    if (!activeEl) return null;
    const activeEditor = activeEl.closest('cfc-code-editor');
    if (activeEditor?.checkVisibility()) {
      return activeEditor;
    }
  }

  return null;
}

/**
 * Keyboard utilities
 */

/**
 * Checks if a keyboard event matches a shortcut configuration.
 */
export function matchesShortcut(e, shortcut) {
  return (
    e.code === shortcut.code &&
    e.ctrlKey === shortcut.ctrl &&
    e.altKey === shortcut.alt &&
    e.shiftKey === shortcut.shift &&
    e.metaKey === shortcut.meta
  );
}

/**
 * Sorting utilities
 */

/**
 * Sorts sites by priority, then by group, tag, and name.
 */
export function sortSites(items, prioritySite) {
  return items.slice().sort((a, b) => {
    if (prioritySite) {
      const aIsLast = a.group === prioritySite.group && a.name === prioritySite.name && a.tag === prioritySite.tag;
      const bIsLast = b.group === prioritySite.group && b.name === prioritySite.name && b.tag === prioritySite.tag;
      if (aIsLast !== bIsLast) return aIsLast ? -1 : 1;
    }
    const aDefault = a.isDefault?.() ?? false;
    const bDefault = b.isDefault?.() ?? false;
    if (aDefault !== bDefault) return aDefault ? -1 : 1;
    const groupCmp = a.group.localeCompare(b.group);
    if (groupCmp !== 0) return groupCmp;
    const tagCmp = (a.tag ?? '').localeCompare(b.tag ?? '');
    if (tagCmp !== 0) return tagCmp;
    return a.name.localeCompare(b.name);
  });
}

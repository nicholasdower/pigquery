/**
 * Tests for utils.js
 */

import { jest } from '@jest/globals';
import {
  makeEl,
  showToast,
  getInitials,
  hashString,
  getLabelColor,
  findEditorTextArea,
  insertIntoEditor,
  getVisibleOrActiveEditor,
  matchesShortcut,
  sortSites,
} from '../utils.js';

describe('DOM Utilities', () => {
  describe('makeEl', () => {
    it('should create a basic element with just a tag', () => {
      const el = makeEl('div');
      expect(el.tagName).toBe('DIV');
      expect(el.id).toBe('');
      expect(el.className).toBe('');
      expect(el.textContent).toBe('');
    });

    it('should create an element with an id', () => {
      const el = makeEl('div', { id: 'test-id' });
      expect(el.id).toBe('test-id');
    });

    it('should create an element with a className', () => {
      const el = makeEl('div', { className: 'test-class' });
      expect(el.className).toBe('test-class');
    });

    it('should create an element with text content', () => {
      const el = makeEl('div', { text: 'Hello World' });
      expect(el.textContent).toBe('Hello World');
    });

    it('should create an element with all properties', () => {
      const el = makeEl('span', {
        id: 'my-span',
        className: 'my-class',
        text: 'Test Text',
      });
      expect(el.tagName).toBe('SPAN');
      expect(el.id).toBe('my-span');
      expect(el.className).toBe('my-class');
      expect(el.textContent).toBe('Test Text');
    });

    it('should handle text content of 0', () => {
      const el = makeEl('div', { text: 0 });
      expect(el.textContent).toBe('0');
    });

    it('should not set text content if text is null', () => {
      const el = makeEl('div', { text: null });
      expect(el.textContent).toBe('');
    });

    it('should not set text content if text is undefined', () => {
      const el = makeEl('div', { text: undefined });
      expect(el.textContent).toBe('');
    });
  });

  describe('showToast', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it('should create and append a toast element', () => {
      showToast('Test message');

      const toast = document.querySelector('.pig-toast');
      expect(toast).toBeTruthy();
      expect(toast.textContent).toBe('Test message');
    });

    it('should add "show" class after setTimeout', () => {
      showToast('Test message');
      const toast = document.querySelector('.pig-toast');

      expect(toast.classList.contains('show')).toBe(false);

      jest.advanceTimersByTime(0);

      expect(toast.classList.contains('show')).toBe(true);
    });

    it('should remove "show" class after default duration', () => {
      showToast('Test message');
      const toast = document.querySelector('.pig-toast');

      jest.advanceTimersByTime(0);
      expect(toast.classList.contains('show')).toBe(true);

      jest.advanceTimersByTime(2000); // default duration
      expect(toast.classList.contains('show')).toBe(false);
    });

    it('should remove toast element 200ms after hiding', () => {
      showToast('Test message');
      const toast = document.querySelector('.pig-toast');

      jest.advanceTimersByTime(0);
      jest.advanceTimersByTime(2000); // duration
      expect(toast.parentNode).toBeTruthy();

      jest.advanceTimersByTime(200); // removal delay
      expect(toast.parentNode).toBe(null);
    });

    it('should respect custom duration', () => {
      showToast('Test message', 5000);
      const toast = document.querySelector('.pig-toast');

      jest.advanceTimersByTime(0);
      expect(toast.classList.contains('show')).toBe(true);

      jest.advanceTimersByTime(4999);
      expect(toast.classList.contains('show')).toBe(true);

      jest.advanceTimersByTime(1);
      expect(toast.classList.contains('show')).toBe(false);
    });
  });
});

describe('Visual/Display Utilities', () => {
  describe('getInitials', () => {
    it('should get initials from two-word name', () => {
      expect(getInitials('John Doe')).toBe('JD');
    });

    it('should get initials from three-word name (first two words)', () => {
      expect(getInitials('John Paul Jones')).toBe('JP');
    });

    it('should get first two letters from single-word name', () => {
      expect(getInitials('Alice')).toBe('Al');
    });

    it('should handle single character name', () => {
      expect(getInitials('A')).toBe('A');
    });

    it('should handle names with extra whitespace', () => {
      expect(getInitials('  John   Doe  ')).toBe('JD');
    });

    it('should uppercase lowercase names', () => {
      expect(getInitials('john doe')).toBe('JD');
    });

    it('should handle mixed case names', () => {
      expect(getInitials('jOhN dOe')).toBe('JD');
    });

    it('should handle two-letter single word', () => {
      expect(getInitials('Jo')).toBe('Jo');
    });
  });

  describe('hashString', () => {
    it('should hash a string to a number', () => {
      const hash = hashString('test');
      expect(typeof hash).toBe('number');
    });

    it('should produce consistent hashes for the same string', () => {
      const hash1 = hashString('hello');
      const hash2 = hashString('hello');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different strings', () => {
      const hash1 = hashString('hello');
      const hash2 = hashString('world');
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
      const hash = hashString('');
      expect(hash).toBe(0);
    });

    it('should handle single character', () => {
      const hash = hashString('a');
      expect(typeof hash).toBe('number');
      expect(hash).not.toBe(0);
    });

    it('should handle special characters', () => {
      const hash = hashString('!@#$%');
      expect(typeof hash).toBe('number');
    });

    it('should handle unicode characters', () => {
      const hash = hashString('你好世界');
      expect(typeof hash).toBe('number');
    });
  });

  describe('getLabelColor', () => {
    it('should return an object with bg and text properties', () => {
      const color = getLabelColor('test');
      expect(color).toHaveProperty('bg');
      expect(color).toHaveProperty('text');
      expect(typeof color.bg).toBe('string');
      expect(typeof color.text).toBe('string');
    });

    it('should return consistent colors for the same name', () => {
      const color1 = getLabelColor('bug');
      const color2 = getLabelColor('bug');
      expect(color1).toEqual(color2);
    });

    it('should return valid rgba/rgb color strings', () => {
      const color = getLabelColor('feature');
      expect(color.bg).toMatch(/^rgba?\(/);
      expect(color.text).toMatch(/^rgba?\(/);
    });

    it('should distribute different names across available colors', () => {
      const colors = new Set();
      for (let i = 0; i < 20; i++) {
        const color = getLabelColor(`label${i}`);
        colors.add(JSON.stringify(color));
      }
      // Should have multiple different colors (not all the same)
      expect(colors.size).toBeGreaterThan(1);
    });

    it('should handle empty string', () => {
      const color = getLabelColor('');
      expect(color).toHaveProperty('bg');
      expect(color).toHaveProperty('text');
    });
  });
});

describe('Editor Utilities', () => {
  describe('findEditorTextArea', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    it('should find textarea with class "inputarea"', () => {
      const editor = document.createElement('div');
      const textarea = document.createElement('textarea');
      textarea.className = 'inputarea';
      editor.appendChild(textarea);

      const found = findEditorTextArea(editor);
      expect(found).toBe(textarea);
    });

    it('should find a generic textarea if no "inputarea" exists', () => {
      const editor = document.createElement('div');
      const textarea = document.createElement('textarea');
      editor.appendChild(textarea);

      const found = findEditorTextArea(editor);
      expect(found).toBe(textarea);
    });

    it('should prefer "inputarea" textarea over generic textarea', () => {
      const editor = document.createElement('div');
      const genericTextarea = document.createElement('textarea');
      const inputareaTextarea = document.createElement('textarea');
      inputareaTextarea.className = 'inputarea';

      editor.appendChild(genericTextarea);
      editor.appendChild(inputareaTextarea);

      const found = findEditorTextArea(editor);
      expect(found).toBe(inputareaTextarea);
    });

    it('should return null if no textarea exists', () => {
      const editor = document.createElement('div');
      const found = findEditorTextArea(editor);
      expect(found).toBe(null);
    });

    it('should handle nested textareas', () => {
      const editor = document.createElement('div');
      const wrapper = document.createElement('div');
      const textarea = document.createElement('textarea');
      textarea.className = 'inputarea';

      wrapper.appendChild(textarea);
      editor.appendChild(wrapper);

      const found = findEditorTextArea(editor);
      expect(found).toBe(textarea);
    });
  });

  describe('insertIntoEditor', () => {
    let editor, textarea;

    beforeEach(() => {
      document.body.innerHTML = '';
      editor = document.createElement('div');
      textarea = document.createElement('textarea');
      textarea.className = 'inputarea';
      textarea.value = 'initial text';
      editor.appendChild(textarea);
      document.body.appendChild(editor);
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should return null if editor is null', () => {
      const result = insertIntoEditor(null, 'test');
      expect(result).toBe(null);
    });

    it('should return false if no textarea found', () => {
      const emptyEditor = document.createElement('div');
      const result = insertIntoEditor(emptyEditor, 'test');
      expect(result).toBe(false);
    });

    it('should insert text into textarea (fallback method)', () => {
      textarea.selectionStart = 7;
      textarea.selectionEnd = 7;

      const result = insertIntoEditor(editor, ' inserted');
      expect(result).toBe(true);
      expect(textarea.value).toContain('inserted');
    });

    it('should replace selected text', () => {
      textarea.value = 'hello world';
      textarea.selectionStart = 6;
      textarea.selectionEnd = 11;

      insertIntoEditor(editor, 'everyone');
      expect(textarea.value).toBe('hello everyone');
    });

    it('should insert at cursor position when no selection', () => {
      textarea.value = 'hello world';
      textarea.selectionStart = 5;
      textarea.selectionEnd = 5;

      insertIntoEditor(editor, ',');
      expect(textarea.value).toBe('hello, world');
    });

    it('should handle multiline text insertion', () => {
      textarea.value = '';
      textarea.selectionStart = 0;
      textarea.selectionEnd = 0;

      const multiline = 'line 1\nline 2\nline 3';
      insertIntoEditor(editor, multiline);
      expect(textarea.value).toBe(multiline);
    });

    it('should handle insertion at end of text', () => {
      textarea.value = 'hello';
      textarea.selectionStart = 5;
      textarea.selectionEnd = 5;

      insertIntoEditor(editor, ' world');
      expect(textarea.value).toBe('hello world');
    });

    it('should handle insertion at beginning of text', () => {
      textarea.value = 'world';
      textarea.selectionStart = 0;
      textarea.selectionEnd = 0;

      insertIntoEditor(editor, 'hello ');
      expect(textarea.value).toBe('hello world');
    });

    it('should focus the textarea', () => {
      const focusSpy = jest.spyOn(textarea, 'focus');
      insertIntoEditor(editor, 'test');
      expect(focusSpy).toHaveBeenCalled();
    });
  });

  describe('getVisibleOrActiveEditor', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    it('should return null if no editors exist', () => {
      const result = getVisibleOrActiveEditor();
      expect(result).toBe(null);
    });

    it('should return the single visible editor', () => {
      const editor = document.createElement('cfc-code-editor');
      editor.checkVisibility = () => true;
      document.body.appendChild(editor);

      const result = getVisibleOrActiveEditor();
      expect(result).toBe(editor);
    });

    it('should return null if editor is hidden', () => {
      const editor = document.createElement('cfc-code-editor');
      editor.checkVisibility = () => false;
      document.body.appendChild(editor);

      const result = getVisibleOrActiveEditor();
      expect(result).toBe(null);
    });

    it('should return active editor when multiple visible editors exist', () => {
      const editor1 = document.createElement('cfc-code-editor');
      const editor2 = document.createElement('cfc-code-editor');
      const textarea = document.createElement('textarea');

      Object.defineProperty(editor1, 'offsetWidth', { value: 100, configurable: true });
      Object.defineProperty(editor1, 'offsetHeight', { value: 100, configurable: true });
      Object.defineProperty(editor2, 'offsetWidth', { value: 100, configurable: true });
      Object.defineProperty(editor2, 'offsetHeight', { value: 100, configurable: true });

      editor2.appendChild(textarea);
      document.body.appendChild(editor1);
      document.body.appendChild(editor2);

      // Mock checkVisibility
      editor1.checkVisibility = () => true;
      editor2.checkVisibility = () => true;

      // Mock activeElement
      Object.defineProperty(document, 'activeElement', {
        value: textarea,
        configurable: true,
      });

      const result = getVisibleOrActiveEditor();
      expect(result).toBe(editor2);
    });

    it('should handle editor with checkVisibility method', () => {
      const editor = document.createElement('cfc-code-editor');
      editor.checkVisibility = jest.fn(() => true);
      Object.defineProperty(editor, 'offsetWidth', { value: 100, configurable: true });
      Object.defineProperty(editor, 'offsetHeight', { value: 100, configurable: true });
      document.body.appendChild(editor);

      const result = getVisibleOrActiveEditor();
      expect(result).toBe(editor);
      expect(editor.checkVisibility).toHaveBeenCalled();
    });
  });
});

describe('Keyboard Utilities', () => {
  describe('matchesShortcut', () => {
    it('should match when all properties match', () => {
      const event = {
        code: 'KeyS',
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        metaKey: false,
      };
      const shortcut = {
        code: 'KeyS',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };
      expect(matchesShortcut(event, shortcut)).toBe(true);
    });

    it('should not match when code differs', () => {
      const event = {
        code: 'KeyA',
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        metaKey: false,
      };
      const shortcut = {
        code: 'KeyS',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };
      expect(matchesShortcut(event, shortcut)).toBe(false);
    });

    it('should not match when ctrl differs', () => {
      const event = {
        code: 'KeyS',
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
      };
      const shortcut = {
        code: 'KeyS',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };
      expect(matchesShortcut(event, shortcut)).toBe(false);
    });

    it('should not match when alt differs', () => {
      const event = {
        code: 'KeyS',
        ctrlKey: true,
        altKey: true,
        shiftKey: false,
        metaKey: false,
      };
      const shortcut = {
        code: 'KeyS',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };
      expect(matchesShortcut(event, shortcut)).toBe(false);
    });

    it('should not match when shift differs', () => {
      const event = {
        code: 'KeyS',
        ctrlKey: true,
        altKey: false,
        shiftKey: true,
        metaKey: false,
      };
      const shortcut = {
        code: 'KeyS',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };
      expect(matchesShortcut(event, shortcut)).toBe(false);
    });

    it('should not match when meta differs', () => {
      const event = {
        code: 'KeyS',
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        metaKey: true,
      };
      const shortcut = {
        code: 'KeyS',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };
      expect(matchesShortcut(event, shortcut)).toBe(false);
    });

    it('should match complex shortcut with multiple modifiers', () => {
      const event = {
        code: 'KeyZ',
        ctrlKey: true,
        altKey: true,
        shiftKey: true,
        metaKey: false,
      };
      const shortcut = {
        code: 'KeyZ',
        ctrl: true,
        alt: true,
        shift: true,
        meta: false,
      };
      expect(matchesShortcut(event, shortcut)).toBe(true);
    });
  });
});

describe('Sorting Utilities', () => {
  describe('sortSites', () => {
    it('should sort sites by group, tag, and name', () => {
      const sites = [
        { group: 'B', tag: 'tag1', name: 'Site 1' },
        { group: 'A', tag: 'tag2', name: 'Site 2' },
        { group: 'A', tag: 'tag1', name: 'Site 3' },
      ];

      const sorted = sortSites(sites);

      expect(sorted[0].group).toBe('A');
      expect(sorted[1].group).toBe('A');
      expect(sorted[2].group).toBe('B');
    });

    it('should sort by tag within the same group', () => {
      const sites = [
        { group: 'A', tag: 'zebra', name: 'Site 1' },
        { group: 'A', tag: 'alpha', name: 'Site 2' },
        { group: 'A', tag: 'beta', name: 'Site 3' },
      ];

      const sorted = sortSites(sites);

      expect(sorted[0].tag).toBe('alpha');
      expect(sorted[1].tag).toBe('beta');
      expect(sorted[2].tag).toBe('zebra');
    });

    it('should sort by name within the same group and tag', () => {
      const sites = [
        { group: 'A', tag: 'tag1', name: 'Zebra' },
        { group: 'A', tag: 'tag1', name: 'Alpha' },
        { group: 'A', tag: 'tag1', name: 'Beta' },
      ];

      const sorted = sortSites(sites);

      expect(sorted[0].name).toBe('Alpha');
      expect(sorted[1].name).toBe('Beta');
      expect(sorted[2].name).toBe('Zebra');
    });

    it('should handle sites without tags', () => {
      const sites = [
        { group: 'A', tag: null, name: 'Site 1' },
        { group: 'A', tag: '', name: 'Site 2' },
        { group: 'A', tag: 'tag1', name: 'Site 3' },
      ];

      const sorted = sortSites(sites);

      // Sites without tags should come before those with tags
      expect(sorted[0].tag).toBe(null);
      expect(sorted[1].tag).toBe('');
      expect(sorted[2].tag).toBe('tag1');
    });

    it('should not modify the original array', () => {
      const sites = [
        { group: 'B', tag: 'tag1', name: 'Site 1' },
        { group: 'A', tag: 'tag2', name: 'Site 2' },
      ];

      const original = [...sites];
      sortSites(sites);

      expect(sites).toEqual(original);
    });

    it('should handle empty array', () => {
      const sorted = sortSites([]);
      expect(sorted).toEqual([]);
    });

    it('should handle single item array', () => {
      const sites = [{ group: 'A', tag: 'tag1', name: 'Site 1' }];
      const sorted = sortSites(sites);
      expect(sorted).toEqual(sites);
    });

    it('should perform stable sort for identical items', () => {
      const sites = [
        { group: 'A', tag: 'tag1', name: 'Site' },
        { group: 'A', tag: 'tag1', name: 'Site' },
      ];

      const sorted = sortSites(sites);
      expect(sorted.length).toBe(2);
    });
  });
});

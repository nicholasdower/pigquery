# PigQuery Code Review & TODO List

## Overview

This document contains findings from a comprehensive code review of the PigQuery Chrome extension codebase, organized by priority and category.

---

## 🟠 P1 - Maintainability

### Error Handling

- [ ] **Silent error swallowing** - Multiple `catch (_)` blocks that silently ignore errors without logging:
  - `content.js:189, 203, 229` - Editor insertion fallbacks
  - `formatters.js:13, 31, 85, 131, 476, 535, 616` - Various format detection
  - `config.js:29` - YAML parsing

  **Recommendation:** At minimum, log errors to help with debugging. Consider adding error telemetry.

### Code Duplication

- [ ] **Duplicate timestamp formatting logic** - Nearly identical date/time formatting code appears in:
  - `formatters.js:138-224` (`formatDateTimeOutput`)
  - `formatters.js:379-433` (inside `tryNumber`)

  **Recommendation:** Extract shared timestamp formatting into a single reusable function.

- [ ] **Duplicate relative time calculation** - Same relative time logic ("X minutes ago") in:
  - `formatters.js:196-219`
  - `formatters.js:414-432`

- [ ] **Similar status update patterns** - `options.js` has three nearly identical status functions:
  - `setLocalStatus()`, `setAddUrlStatus()`, `setShortcutsStatus()`

  **Recommendation:** Create a single `setStatus(element, message, kind)` function.

- [ ] **Duplicate busy state handling** - Similar patterns in `options.js` for checking/setting busy state across multiple async functions.

### Large Functions / Single Responsibility

- [ ] **`openPopup()` in content.js is ~400 lines** (lines 643-1036)
  - Creates DOM elements
  - Handles keyboard navigation
  - Manages focus trapping
  - Renders list items
  - Manages content panel
  - Handles refresh state

  **Recommendation:** Split into smaller focused functions or a class:
  - `createModalDOM()`
  - `ModalKeyboardHandler`
  - `ModalListRenderer`
  - `ContentPanelManager`

- [ ] **`tryNumber()` in formatters.js is ~140 lines** (lines 296-439)

  **Recommendation:** Extract sub-formatters: `formatAsFileSize()`, `formatAsTimestamp()`, `formatIntegerRepresentations()`.

### Global State

- [ ] **Multiple global variables in content.js** (lines 13-16):

  ```js
  let configuration;
  let shortcuts = config.DEFAULT_SHORTCUTS;
  let onConfigurationChange = null;
  let recentSnippetGroups = [];
  ```

  **Recommendation:** Consider encapsulating in a state object or module pattern.

- [ ] **Global state in options.js** (lines 25-29):
  ```js
  let sources = [];
  let busy = null;
  let lastLoadedLocal = '';
  let shortcuts = {};
  let recordingShortcut = null;
  ```

### Naming

- [ ] **Single-letter or vague variable names:**
  - `t` function in options.js/popup.js (translation shorthand) - consider `translate` or `tr`
  - `el` function in options.js - consider `getElementById` or `byId`
  - `s` in various places for source
  - `e` for events (acceptable but inconsistent with `event` elsewhere)
- [ ] **Inconsistent naming patterns:**
  - `STORAGE_KEY` vs `config.BUSY_KEY` (some constants exposed, some not)
  - `loadConfiguration` vs `loadSources` vs `loadBusy` (inconsistent return semantics)

### Missing Type Safety / Documentation

- [ ] **No JSDoc on public API functions** - Functions like `filter()`, `detectContentType()`, `loadConfiguration()` would benefit from type documentation.
- [ ] **Magic numbers:**
  - `formatters.js:1` - `MIN_CONTENT_LENGTH_FOR_DISPLAY = 200` (good!)
  - `formatters.js:95` - `text.length < 20` (should be a constant)
  - `formatters.js:544` - `text.length < 20` (duplicate magic number)
  - `content.js:107` - `10000` ms timeout (should be constant)
  - `content.js:139` - `10_000` ms timeout (inconsistent format with line 107)
  - `search.js:79, 80, 81, 156` - Scoring weights should be named constants

---

## 🟡 P2 - Code Quality / Polish

### Dead Code / Unused

- [ ] **Verify CSS usage** - Several CSS classes defined in `content.js` styles block. Audit for unused classes.
- [ ] **Unused function parameter** - `search.js:94` `matchesField` receives `fieldNorm` but never uses it:
  ```js
  function matchesField(queryToken, fieldNorm, fieldTokens, fieldAcronym)
  ```
- [ ] **Potentially unused** - `config.js` exports many functions. Verify all are used.

### Comments

- [ ] **Missing file-level comments** - Files like `formatters.js` could use a header explaining the module's purpose.

### Simplification Opportunities

- [ ] **Deep nesting in search.js** - `scoreItem()` function has 4+ levels of nesting. Consider early returns or extraction.
- [ ] **Repetitive event listener setup** - `options.js` lines 355-394 could use a helper for adding click handlers.
- [ ] **String template in options.js:232-250** - Large HTML template string. Consider a template helper or DOM builder.

## 🔵 P3 - Enhancements

- [ ] **Add light mode** - Currently only dark theme
- [ ] **Support multiple tags** - Current model is single tag per item
- [ ] **Disable groups feature** - Allow users to disable entire groups
- [ ] **Precreate search index** - Performance optimization for large configs
- [ ] **Windows testing** - Verify production build on Windows
- [ ] Allow specifying cursor position for snippets. Think function with params.
- [ ] Custom formatters.

---

## 🟢 Architecture / Future Improvements

### Code Organization

- [ ] **Split content.js** - Currently 1200+ lines handling:
  - Modal UI components → `modal.js`
  - Editor manipulation → `editor.js`
  - Event handling → `events.js`
  - Toast notifications → `toast.js`

- [ ] **Create shared utilities module** - Functions used across files:
  - DOM helpers
  - Date formatting
  - String utilities

### Testing Infrastructure

- [ ] **Set up test framework** - Jest or Vitest
- [ ] **Unit tests for search.js** - Pure functions, easy to test
- [ ] **Unit tests for formatters.js** - Pure functions with clear inputs/outputs
- [ ] **Unit tests for config.js validation** - `validateConfigItems()`
- [ ] **Integration tests** - Chrome extension testing

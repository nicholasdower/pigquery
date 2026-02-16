import logger from './logger.js';

/**
 * Uninstaller - Manages a collection of uninstall functions
 * that can be registered, executed, and removed by name.
 */
class Uninstaller {
  constructor(name = 'Uninstaller') {
    this.name = name;
    // Store uninstall functions in insertion order using Map
    this.uninstallFunctions = new Map();
    // Track which names belong to which group
    this.groups = new Map();
  }

  /**
   * Register an uninstall function with an optional name
   * @param {Function} uninstallFn - Function to call when uninstalling
   * @param {string} [name] - Optional unique identifier for the uninstall function (auto-generated if not provided)
   * @param {string} [group] - Optional group name to organize uninstall functions
   */
  register(uninstallFn, name, group) {
    if (typeof uninstallFn !== 'function') {
      throw new TypeError('Uninstall function must be a function');
    }
    if (name !== undefined && typeof name !== 'string') {
      throw new TypeError('Name must be a string');
    }
    if (group !== undefined && typeof group !== 'string') {
      throw new TypeError('Group must be a string');
    }

    // Auto-generate name if not provided
    const functionName = name || `uninstall-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    this.uninstallFunctions.set(functionName, uninstallFn);
    logger.debug(`[${this.name}] registered: ${functionName}${group ? ` (group: ${group})` : ''}`);

    // Add to group if specified
    if (group) {
      if (!this.groups.has(group)) {
        this.groups.set(group, new Set());
      }
      this.groups.get(group).add(functionName);
    }
  }

  /**
   * Uninstall and remove a specific registered function by name
   * @param {string} name - Name of the uninstall function to execute
   * @throws Will propagate any error thrown by the uninstall function
   */
  uninstall(name) {
    logger.debug(`[${this.name}] uninstalling: ${name}`);

    const uninstallFn = this.uninstallFunctions.get(name);
    if (!uninstallFn) {
      return; // Silently ignore if not found
    }

    // Remove from all data structures first to ensure cleanup even if execution throws
    this.uninstallFunctions.delete(name);
    this._removeFromGroups(name);

    // Execute the uninstall function (let errors propagate)
    uninstallFn();
  }

  /**
   * Uninstall all functions in a specific group, ignoring any errors
   * Executes uninstall functions in reverse order (LIFO - last registered, first uninstalled)
   * @param {string} group - Name of the group to uninstall
   */
  uninstallGroup(group) {
    logger.debug(`[${this.name}] uninstalling group: ${group}`);

    const names = this.groups.get(group);
    if (!names || names.size === 0) {
      return; // Silently ignore if group not found or empty
    }

    // Get all names in this group (convert Set to Array for reversing)
    const nameArray = Array.from(names);

    // Remove the group immediately
    this.groups.delete(group);

    // Uninstall in reverse order, catching and ignoring errors
    for (const name of nameArray.reverse()) {
      logger.debug(`[${this.name}] uninstalling: ${name}`);
      const uninstallFn = this.uninstallFunctions.get(name);
      if (uninstallFn) {
        this.uninstallFunctions.delete(name);
        this._removeFromGroups(name);
        try {
          uninstallFn();
        } catch (error) {
          // Silently ignore errors during uninstallGroup
        }
      }
    }
  }

  /**
   * Remove a name from all groups (helper method)
   * @private
   * @param {string} name - Name to remove from groups
   */
  _removeFromGroups(name) {
    for (const [groupName, names] of this.groups.entries()) {
      names.delete(name);
      // Clean up empty groups
      if (names.size === 0) {
        this.groups.delete(groupName);
      }
    }
  }

  /**
   * Uninstall all registered functions, ignoring any errors
   * Executes uninstall functions in reverse order (LIFO - last registered, first uninstalled)
   */
  uninstallAll() {
    logger.debug(`[${this.name}] uninstalling all`);

    // Create array of entries to iterate over
    const entries = Array.from(this.uninstallFunctions.entries());

    // Clear all data structures immediately
    this.uninstallFunctions.clear();
    this.groups.clear();

    // Execute all uninstall functions in reverse order, catching and ignoring errors
    for (const [name, uninstallFn] of entries.reverse()) {
      try {
        logger.debug(`[${this.name}] uninstalling: ${name}`);
        uninstallFn();
      } catch (error) {
        // Silently ignore errors during uninstallAll
        logger.debug(`[${this.name}] error uninstalling ${name}:`, error);
      }
    }
  }

  /**
   * Check if an uninstall function is registered
   * @param {string} name - Name to check
   * @returns {boolean} True if registered
   */
  has(name) {
    return this.uninstallFunctions.has(name);
  }

  /**
   * Get the number of registered uninstall functions
   * @returns {number} Count of registered functions
   */
  size() {
    return this.uninstallFunctions.size;
  }

  /**
   * Remove all registered functions without executing them
   */
  clear() {
    this.uninstallFunctions.clear();
    this.groups.clear();
  }

  /**
   * Add an event listener to a target element and register its cleanup
   * @param {EventTarget} target - The event target (e.g., document, window, or any element)
   * @param {string} type - Event type (e.g., 'keydown', 'click')
   * @param {Function} listener - Event listener function
   * @param {boolean|Object} options - useCapture boolean or options object
   * @param {string} [name] - Optional unique identifier for the uninstall function (auto-generated if not provided)
   * @param {string} [group] - Optional group name
   */
  addEventListener(target, type, listener, options, name, group) {
    target.addEventListener(type, listener, options);
    this.register(
      () => {
        target.removeEventListener(type, listener, options);
      },
      name,
      group
    );
  }

  /**
   * Append a child element to a parent and register its cleanup (removal)
   * @param {Node} parent - The parent node to append to
   * @param {Node} child - The child node to append
   * @param {string} [name] - Optional unique identifier for the uninstall function (auto-generated if not provided)
   * @param {string} [group] - Optional group name
   */
  appendChild(parent, child, name, group) {
    parent.appendChild(child);
    this.register(
      () => {
        child.remove();
      },
      name,
      group
    );
  }

  /**
   * Add a CSS class to an element and register its cleanup (removal)
   * @param {Element} element - The element to add the class to
   * @param {string} className - The CSS class name to add
   * @param {string} [name] - Optional unique identifier for the uninstall function (auto-generated if not provided)
   * @param {string} [group] - Optional group name
   */
  addClass(element, className, name, group) {
    element.classList.add(className);
    this.register(
      () => {
        element.classList.remove(className);
      },
      name,
      group
    );
  }

  /**
   * Add a chrome.storage listener and register its cleanup
   * @param {Function} listener - The listener function to add
   * @param {string} [name] - Optional unique identifier for the uninstall function (auto-generated if not provided)
   * @param {string} [group] - Optional group name
   */
  addChromeStorageListener(listener, name, group) {
    chrome.storage.onChanged.addListener(listener);
    this.register(
      () => {
        if (chrome.runtime?.id) {
          chrome.storage.onChanged.removeListener(listener);
        }
      },
      name,
      group
    );
  }

  /**
   * Add a chrome.runtime.onMessage listener and register its cleanup
   * @param {Function} listener - The listener function to add
   * @param {string} [name] - Optional unique identifier for the uninstall function (auto-generated if not provided)
   * @param {string} [group] - Optional group name
   */
  addChromeMessageListener(listener, name, group) {
    chrome.runtime.onMessage.addListener(listener);
    this.register(
      () => {
        if (chrome.runtime?.id) {
          chrome.runtime.onMessage.removeListener(listener);
        }
      },
      name,
      group
    );
  }

  /**
   * Set an interval and register its cleanup
   * @param {Function} callback - The function to call repeatedly
   * @param {number} delay - The delay in milliseconds between calls
   * @param {string} [name] - Optional unique identifier for the uninstall function (auto-generated if not provided)
   * @param {string} [group] - Optional group name
   */
  setInterval(callback, delay, name, group) {
    const intervalId = setInterval(callback, delay);
    this.register(
      () => {
        clearInterval(intervalId);
      },
      name,
      group
    );
  }

  /**
   * Set a timeout and register its cleanup
   * @param {Function} callback - The function to call after the delay
   * @param {number} delay - The delay in milliseconds
   * @param {string} [name] - Optional unique identifier for the uninstall function (auto-generated if not provided)
   * @param {string} [group] - Optional group name
   */
  setTimeout(callback, delay, name, group) {
    const timeoutId = setTimeout(callback, delay);
    this.register(
      () => {
        clearTimeout(timeoutId);
      },
      name,
      group
    );
  }

  /**
   * Create a MutationObserver and register its cleanup
   * @param {Function} callback - The callback function for the observer
   * @param {Node} target - The target node to observe
   * @param {MutationObserverInit} options - The observer options
   * @param {string} [name] - Optional unique identifier for the uninstall function (auto-generated if not provided)
   * @param {string} [group] - Optional group name
   */
  observe(callback, target, options, name, group) {
    const observer = new MutationObserver(callback);
    observer.observe(target, options);
    this.register(
      () => {
        observer.disconnect();
      },
      name,
      group
    );
  }
}

export default Uninstaller;

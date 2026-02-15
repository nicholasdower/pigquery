import logger from './logger.js';

/**
 * Canceler - Manages a collection of cancellation functions
 * that can be registered, executed, and removed by name.
 */
class Canceler {
  constructor(name = 'Canceler') {
    this.name = name;
    // Store cancellation functions in insertion order using Map
    this.cancelFunctions = new Map();
    // Track which names belong to which group
    this.groups = new Map();
  }

  /**
   * Register a cancellation function with an optional name
   * @param {Function} cancelFn - Function to call when canceling
   * @param {string} [name] - Optional unique identifier for the cancel function (auto-generated if not provided)
   * @param {string} [group] - Optional group name to organize cancel functions
   */
  register(cancelFn, name, group) {
    if (typeof cancelFn !== 'function') {
      throw new TypeError('Cancel function must be a function');
    }
    if (name !== undefined && typeof name !== 'string') {
      throw new TypeError('Name must be a string');
    }
    if (group !== undefined && typeof group !== 'string') {
      throw new TypeError('Group must be a string');
    }

    // Auto-generate name if not provided
    const functionName = name || `cancel-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    this.cancelFunctions.set(functionName, cancelFn);
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
   * Cancel and remove a specific registered function by name
   * @param {string} name - Name of the cancel function to execute
   * @throws Will propagate any error thrown by the cancel function
   */
  cancel(name) {
    logger.debug(`[${this.name}] canceling: ${name}`);

    const cancelFn = this.cancelFunctions.get(name);
    if (!cancelFn) {
      return; // Silently ignore if not found
    }

    // Remove from all data structures first to ensure cleanup even if execution throws
    this.cancelFunctions.delete(name);
    this._removeFromGroups(name);

    // Execute the cancel function (let errors propagate)
    cancelFn();
  }

  /**
   * Cancel all functions in a specific group, ignoring any errors
   * Executes cancel functions in reverse order (LIFO - last registered, first canceled)
   * @param {string} group - Name of the group to cancel
   */
  cancelGroup(group) {
    logger.debug(`[${this.name}] canceling group: ${group}`);

    const names = this.groups.get(group);
    if (!names || names.size === 0) {
      return; // Silently ignore if group not found or empty
    }

    // Get all names in this group (convert Set to Array for reversing)
    const nameArray = Array.from(names);

    // Remove the group immediately
    this.groups.delete(group);

    // Cancel in reverse order, catching and ignoring errors
    for (const name of nameArray.reverse()) {
      logger.debug(`[${this.name}] canceling: ${name}`);
      const cancelFn = this.cancelFunctions.get(name);
      if (cancelFn) {
        this.cancelFunctions.delete(name);
        this._removeFromGroups(name);
        try {
          cancelFn();
        } catch (error) {
          // Silently ignore errors during cancelGroup
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
   * Cancel all registered functions, ignoring any errors
   * Executes cancel functions in reverse order (LIFO - last registered, first canceled)
   */
  cancelAll() {
    logger.debug(`[${this.name}] canceling all`);

    // Create array of entries to iterate over
    const entries = Array.from(this.cancelFunctions.entries());

    // Clear all data structures immediately
    this.cancelFunctions.clear();
    this.groups.clear();

    // Execute all cancel functions in reverse order, catching and ignoring errors
    for (const [name, cancelFn] of entries.reverse()) {
      try {
        logger.debug(`[${this.name}] canceling: ${name}`);
        cancelFn();
      } catch (error) {
        // Silently ignore errors during cancelAll
        logger.debug(`[${this.name}] error canceling ${name}:`, error);
      }
    }
  }

  /**
   * Check if a cancel function is registered
   * @param {string} name - Name to check
   * @returns {boolean} True if registered
   */
  has(name) {
    return this.cancelFunctions.has(name);
  }

  /**
   * Get the number of registered cancel functions
   * @returns {number} Count of registered functions
   */
  size() {
    return this.cancelFunctions.size;
  }

  /**
   * Remove all registered functions without executing them
   */
  clear() {
    this.cancelFunctions.clear();
    this.groups.clear();
  }

  /**
   * Add an event listener to a target element and register its cleanup
   * @param {EventTarget} target - The event target (e.g., document, window, or any element)
   * @param {string} type - Event type (e.g., 'keydown', 'click')
   * @param {Function} listener - Event listener function
   * @param {boolean|Object} options - useCapture boolean or options object
   * @param {string} [name] - Optional unique identifier for the cancel function (auto-generated if not provided)
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
   * @param {string} [name] - Optional unique identifier for the cancel function (auto-generated if not provided)
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
   * @param {string} [name] - Optional unique identifier for the cancel function (auto-generated if not provided)
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
   * @param {string} [name] - Optional unique identifier for the cancel function (auto-generated if not provided)
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
   * @param {string} [name] - Optional unique identifier for the cancel function (auto-generated if not provided)
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
   * @param {string} [name] - Optional unique identifier for the cancel function (auto-generated if not provided)
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
   * @param {string} [name] - Optional unique identifier for the cancel function (auto-generated if not provided)
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
   * @param {string} [name] - Optional unique identifier for the cancel function (auto-generated if not provided)
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

export default Canceler;

/**
 * Canceler - Manages a collection of cancellation functions
 * that can be registered, executed, and removed by name.
 */
class Canceler {
  constructor() {
    // Store cancellation functions in insertion order using Map
    this.cancelFunctions = new Map();
    // Track which names belong to which group
    this.groups = new Map();
  }

  /**
   * Register a cancellation function with a name
   * @param {string} name - Unique identifier for the cancel function
   * @param {Function} cancelFn - Function to call when canceling
   * @param {string} [group] - Optional group name to organize cancel functions
   */
  register(name, cancelFn, group) {
    if (typeof name !== 'string') {
      throw new TypeError('Name must be a string');
    }
    if (typeof cancelFn !== 'function') {
      throw new TypeError('Cancel function must be a function');
    }
    if (group !== undefined && typeof group !== 'string') {
      throw new TypeError('Group must be a string');
    }

    this.cancelFunctions.set(name, cancelFn);

    // Add to group if specified
    if (group) {
      if (!this.groups.has(group)) {
        this.groups.set(group, new Set());
      }
      this.groups.get(group).add(name);
    }
  }

  /**
   * Cancel and remove a specific registered function by name
   * @param {string} name - Name of the cancel function to execute
   * @throws Will propagate any error thrown by the cancel function
   */
  cancel(name) {
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
    // Create array of entries to iterate over
    const entries = Array.from(this.cancelFunctions.entries());

    // Clear all data structures immediately
    this.cancelFunctions.clear();
    this.groups.clear();

    // Execute all cancel functions in reverse order, catching and ignoring errors
    for (const [, cancelFn] of entries.reverse()) {
      try {
        cancelFn();
      } catch (error) {
        // Silently ignore errors during cancelAll
        // Could optionally log these if needed
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
}

export default Canceler;

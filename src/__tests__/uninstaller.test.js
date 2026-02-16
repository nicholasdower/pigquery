import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import Uninstaller from '../uninstaller.js';

// Mock logger
jest.mock('../logger.js', () => ({
  default: {
    debug: jest.fn(),
  },
}));

describe('Uninstaller', () => {
  let uninstaller;

  beforeEach(() => {
    uninstaller = new Uninstaller('TestUninstaller');
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should create uninstaller with default name', () => {
      const u = new Uninstaller();
      expect(u.name).toBe('Uninstaller');
      expect(u.size()).toBe(0);
    });

    test('should create uninstaller with custom name', () => {
      expect(uninstaller.name).toBe('TestUninstaller');
      expect(uninstaller.size()).toBe(0);
    });
  });

  describe('register', () => {
    test('should register function with explicit name', () => {
      const fn = jest.fn();
      uninstaller.register(fn, 'test-function');

      expect(uninstaller.has('test-function')).toBe(true);
      expect(uninstaller.size()).toBe(1);
    });

    test('should register function without name (auto-generated)', () => {
      const fn = jest.fn();
      uninstaller.register(fn);

      expect(uninstaller.size()).toBe(1);
    });

    test('should register function with group', () => {
      const fn1 = jest.fn();
      const fn2 = jest.fn();
      uninstaller.register(fn1, 'fn1', 'group1');
      uninstaller.register(fn2, 'fn2', 'group1');

      expect(uninstaller.has('fn1')).toBe(true);
      expect(uninstaller.has('fn2')).toBe(true);
      expect(uninstaller.size()).toBe(2);
    });

    test('should throw TypeError if uninstallFn is not a function', () => {
      expect(() => {
        uninstaller.register('not a function');
      }).toThrow(TypeError);
      expect(() => {
        uninstaller.register('not a function');
      }).toThrow('Uninstall function must be a function');
    });

    test('should throw TypeError if name is not a string', () => {
      const fn = jest.fn();
      expect(() => {
        uninstaller.register(fn, 123);
      }).toThrow(TypeError);
      expect(() => {
        uninstaller.register(fn, 123);
      }).toThrow('Name must be a string');
    });

    test('should throw TypeError if group is not a string', () => {
      const fn = jest.fn();
      expect(() => {
        uninstaller.register(fn, 'name', 123);
      }).toThrow(TypeError);
      expect(() => {
        uninstaller.register(fn, 'name', 123);
      }).toThrow('Group must be a string');
    });

    test('should allow registering multiple functions', () => {
      const fn1 = jest.fn();
      const fn2 = jest.fn();
      const fn3 = jest.fn();

      uninstaller.register(fn1, 'fn1');
      uninstaller.register(fn2, 'fn2');
      uninstaller.register(fn3, 'fn3');

      expect(uninstaller.size()).toBe(3);
    });
  });

  describe('uninstall', () => {
    test('should execute and remove registered function', () => {
      const fn = jest.fn();
      uninstaller.register(fn, 'test-function');

      uninstaller.uninstall('test-function');

      expect(fn).toHaveBeenCalledTimes(1);
      expect(uninstaller.has('test-function')).toBe(false);
      expect(uninstaller.size()).toBe(0);
    });

    test('should silently ignore uninstall of non-existent function', () => {
      expect(() => {
        uninstaller.uninstall('non-existent');
      }).not.toThrow();
      expect(uninstaller.size()).toBe(0);
    });

    test('should propagate errors thrown by uninstall function', () => {
      const error = new Error('Uninstall error');
      const fn = jest.fn(() => {
        throw error;
      });
      uninstaller.register(fn, 'failing-function');

      expect(() => {
        uninstaller.uninstall('failing-function');
      }).toThrow(error);

      // Function should still be removed even if it throws
      expect(uninstaller.has('failing-function')).toBe(false);
    });

    test('should remove function from group when uninstalled', () => {
      const fn1 = jest.fn();
      const fn2 = jest.fn();
      uninstaller.register(fn1, 'fn1', 'group1');
      uninstaller.register(fn2, 'fn2', 'group1');

      uninstaller.uninstall('fn1');

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(uninstaller.has('fn1')).toBe(false);
      expect(uninstaller.has('fn2')).toBe(true);
      expect(uninstaller.size()).toBe(1);
    });
  });

  describe('uninstallGroup', () => {
    test('should uninstall all functions in a group in reverse order', () => {
      const order = [];
      const fn1 = jest.fn(() => order.push('fn1'));
      const fn2 = jest.fn(() => order.push('fn2'));
      const fn3 = jest.fn(() => order.push('fn3'));

      uninstaller.register(fn1, 'fn1', 'group1');
      uninstaller.register(fn2, 'fn2', 'group1');
      uninstaller.register(fn3, 'fn3', 'group1');

      uninstaller.uninstallGroup('group1');

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
      expect(fn3).toHaveBeenCalledTimes(1);
      // Should execute in reverse order (LIFO)
      expect(order).toEqual(['fn3', 'fn2', 'fn1']);
      expect(uninstaller.size()).toBe(0);
    });

    test('should silently ignore errors during group uninstall', () => {
      const fn1 = jest.fn(() => {
        throw new Error('Error 1');
      });
      const fn2 = jest.fn(() => {
        throw new Error('Error 2');
      });
      uninstaller.register(fn1, 'fn1', 'group1');
      uninstaller.register(fn2, 'fn2', 'group1');

      expect(() => {
        uninstaller.uninstallGroup('group1');
      }).not.toThrow();

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
      expect(uninstaller.size()).toBe(0);
    });

    test('should silently ignore uninstall of non-existent group', () => {
      expect(() => {
        uninstaller.uninstallGroup('non-existent');
      }).not.toThrow();
    });

    test('should only uninstall functions in specified group', () => {
      const fn1 = jest.fn();
      const fn2 = jest.fn();
      const fn3 = jest.fn();

      uninstaller.register(fn1, 'fn1', 'group1');
      uninstaller.register(fn2, 'fn2', 'group2');
      uninstaller.register(fn3, 'fn3', 'group1');

      uninstaller.uninstallGroup('group1');

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).not.toHaveBeenCalled();
      expect(fn3).toHaveBeenCalledTimes(1);
      expect(uninstaller.has('fn2')).toBe(true);
      expect(uninstaller.size()).toBe(1);
    });

    test('should handle empty group', () => {
      uninstaller.register(jest.fn(), 'fn1', 'group1');
      uninstaller.uninstall('fn1'); // This removes the function and cleans up the empty group

      expect(() => {
        uninstaller.uninstallGroup('group1');
      }).not.toThrow();
    });
  });

  describe('uninstallAll', () => {
    test('should uninstall all functions in reverse order', () => {
      const order = [];
      const fn1 = jest.fn(() => order.push('fn1'));
      const fn2 = jest.fn(() => order.push('fn2'));
      const fn3 = jest.fn(() => order.push('fn3'));

      uninstaller.register(fn1, 'fn1');
      uninstaller.register(fn2, 'fn2');
      uninstaller.register(fn3, 'fn3');

      uninstaller.uninstallAll();

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
      expect(fn3).toHaveBeenCalledTimes(1);
      // Should execute in reverse order (LIFO)
      expect(order).toEqual(['fn3', 'fn2', 'fn1']);
      expect(uninstaller.size()).toBe(0);
    });

    test('should silently ignore errors during uninstallAll', () => {
      const fn1 = jest.fn(() => {
        throw new Error('Error 1');
      });
      const fn2 = jest.fn();
      const fn3 = jest.fn(() => {
        throw new Error('Error 3');
      });

      uninstaller.register(fn1, 'fn1');
      uninstaller.register(fn2, 'fn2');
      uninstaller.register(fn3, 'fn3');

      expect(() => {
        uninstaller.uninstallAll();
      }).not.toThrow();

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
      expect(fn3).toHaveBeenCalledTimes(1);
      expect(uninstaller.size()).toBe(0);
    });

    test('should handle empty uninstaller', () => {
      expect(() => {
        uninstaller.uninstallAll();
      }).not.toThrow();
      expect(uninstaller.size()).toBe(0);
    });

    test('should clear all groups', () => {
      uninstaller.register(jest.fn(), 'fn1', 'group1');
      uninstaller.register(jest.fn(), 'fn2', 'group2');

      uninstaller.uninstallAll();

      expect(uninstaller.groups.size).toBe(0);
    });
  });

  describe('has', () => {
    test('should return true for registered function', () => {
      uninstaller.register(jest.fn(), 'test-function');
      expect(uninstaller.has('test-function')).toBe(true);
    });

    test('should return false for non-existent function', () => {
      expect(uninstaller.has('non-existent')).toBe(false);
    });

    test('should return false after function is uninstalled', () => {
      uninstaller.register(jest.fn(), 'test-function');
      uninstaller.uninstall('test-function');
      expect(uninstaller.has('test-function')).toBe(false);
    });
  });

  describe('size', () => {
    test('should return 0 for empty uninstaller', () => {
      expect(uninstaller.size()).toBe(0);
    });

    test('should return correct count of registered functions', () => {
      uninstaller.register(jest.fn(), 'fn1');
      expect(uninstaller.size()).toBe(1);

      uninstaller.register(jest.fn(), 'fn2');
      expect(uninstaller.size()).toBe(2);

      uninstaller.register(jest.fn(), 'fn3');
      expect(uninstaller.size()).toBe(3);
    });

    test('should decrease when functions are uninstalled', () => {
      uninstaller.register(jest.fn(), 'fn1');
      uninstaller.register(jest.fn(), 'fn2');
      uninstaller.register(jest.fn(), 'fn3');

      uninstaller.uninstall('fn2');
      expect(uninstaller.size()).toBe(2);

      uninstaller.uninstall('fn1');
      expect(uninstaller.size()).toBe(1);

      uninstaller.uninstall('fn3');
      expect(uninstaller.size()).toBe(0);
    });
  });

  describe('clear', () => {
    test('should remove all functions without executing them', () => {
      const fn1 = jest.fn();
      const fn2 = jest.fn();
      const fn3 = jest.fn();

      uninstaller.register(fn1, 'fn1', 'group1');
      uninstaller.register(fn2, 'fn2', 'group2');
      uninstaller.register(fn3, 'fn3');

      uninstaller.clear();

      expect(fn1).not.toHaveBeenCalled();
      expect(fn2).not.toHaveBeenCalled();
      expect(fn3).not.toHaveBeenCalled();
      expect(uninstaller.size()).toBe(0);
      expect(uninstaller.groups.size).toBe(0);
    });

    test('should handle empty uninstaller', () => {
      expect(() => {
        uninstaller.clear();
      }).not.toThrow();
      expect(uninstaller.size()).toBe(0);
    });
  });

  describe('addEventListener', () => {
    test('should add event listener and register cleanup', () => {
      const target = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };
      const listener = jest.fn();

      uninstaller.addEventListener(target, 'click', listener, false, 'test-listener');

      expect(target.addEventListener).toHaveBeenCalledWith('click', listener, false);
      expect(uninstaller.has('test-listener')).toBe(true);

      uninstaller.uninstall('test-listener');

      expect(target.removeEventListener).toHaveBeenCalledWith('click', listener, false);
    });

    test('should add event listener with options object', () => {
      const target = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };
      const listener = jest.fn();
      const options = { once: true, passive: true };

      uninstaller.addEventListener(target, 'scroll', listener, options, 'test-listener');

      expect(target.addEventListener).toHaveBeenCalledWith('scroll', listener, options);

      uninstaller.uninstall('test-listener');

      expect(target.removeEventListener).toHaveBeenCalledWith('scroll', listener, options);
    });

    test('should add event listener with group', () => {
      const target = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };
      const listener = jest.fn();

      uninstaller.addEventListener(target, 'click', listener, false, 'test-listener', 'event-group');

      expect(uninstaller.has('test-listener')).toBe(true);
      expect(uninstaller.size()).toBe(1);

      uninstaller.uninstallGroup('event-group');

      expect(target.removeEventListener).toHaveBeenCalledWith('click', listener, false);
      expect(uninstaller.size()).toBe(0);
    });

    test('should auto-generate name if not provided', () => {
      const target = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };
      const listener = jest.fn();

      uninstaller.addEventListener(target, 'click', listener, false);

      expect(uninstaller.size()).toBe(1);
    });
  });

  describe('appendChild', () => {
    test('should append child and register cleanup', () => {
      const parent = {
        appendChild: jest.fn(),
      };
      const child = {
        remove: jest.fn(),
      };

      uninstaller.appendChild(parent, child, 'test-child');

      expect(parent.appendChild).toHaveBeenCalledWith(child);
      expect(uninstaller.has('test-child')).toBe(true);

      uninstaller.uninstall('test-child');

      expect(child.remove).toHaveBeenCalled();
    });

    test('should append child with group', () => {
      const parent = {
        appendChild: jest.fn(),
      };
      const child = {
        remove: jest.fn(),
      };

      uninstaller.appendChild(parent, child, 'test-child', 'dom-group');

      expect(uninstaller.has('test-child')).toBe(true);

      uninstaller.uninstallGroup('dom-group');

      expect(child.remove).toHaveBeenCalled();
    });

    test('should auto-generate name if not provided', () => {
      const parent = {
        appendChild: jest.fn(),
      };
      const child = {
        remove: jest.fn(),
      };

      uninstaller.appendChild(parent, child);

      expect(uninstaller.size()).toBe(1);
    });
  });

  describe('addClass', () => {
    test('should add class and register cleanup', () => {
      const element = {
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
        },
      };

      uninstaller.addClass(element, 'test-class', 'test-class-name');

      expect(element.classList.add).toHaveBeenCalledWith('test-class');
      expect(uninstaller.has('test-class-name')).toBe(true);

      uninstaller.uninstall('test-class-name');

      expect(element.classList.remove).toHaveBeenCalledWith('test-class');
    });

    test('should add class with group', () => {
      const element = {
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
        },
      };

      uninstaller.addClass(element, 'test-class', 'test-class-name', 'style-group');

      expect(uninstaller.has('test-class-name')).toBe(true);

      uninstaller.uninstallGroup('style-group');

      expect(element.classList.remove).toHaveBeenCalledWith('test-class');
    });

    test('should auto-generate name if not provided', () => {
      const element = {
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
        },
      };

      uninstaller.addClass(element, 'test-class');

      expect(uninstaller.size()).toBe(1);
    });
  });

  describe('addChromeStorageListener', () => {
    let mockChrome;

    beforeEach(() => {
      mockChrome = {
        storage: {
          onChanged: {
            addListener: jest.fn(),
            removeListener: jest.fn(),
          },
        },
        runtime: {
          id: 'test-extension-id',
        },
      };
      global.chrome = mockChrome;
    });

    test('should add storage listener and register cleanup', () => {
      const listener = jest.fn();

      uninstaller.addChromeStorageListener(listener, 'test-storage-listener');

      expect(mockChrome.storage.onChanged.addListener).toHaveBeenCalledWith(listener);
      expect(uninstaller.has('test-storage-listener')).toBe(true);

      uninstaller.uninstall('test-storage-listener');

      expect(mockChrome.storage.onChanged.removeListener).toHaveBeenCalledWith(listener);
    });

    test('should not remove listener if extension is unloaded', () => {
      const listener = jest.fn();

      uninstaller.addChromeStorageListener(listener, 'test-storage-listener');

      // Simulate extension unload
      mockChrome.runtime.id = undefined;

      uninstaller.uninstall('test-storage-listener');

      expect(mockChrome.storage.onChanged.removeListener).not.toHaveBeenCalled();
    });

    test('should add storage listener with group', () => {
      const listener = jest.fn();

      uninstaller.addChromeStorageListener(listener, 'test-storage-listener', 'chrome-group');

      expect(uninstaller.has('test-storage-listener')).toBe(true);

      uninstaller.uninstallGroup('chrome-group');

      expect(mockChrome.storage.onChanged.removeListener).toHaveBeenCalledWith(listener);
    });

    test('should auto-generate name if not provided', () => {
      const listener = jest.fn();

      uninstaller.addChromeStorageListener(listener);

      expect(uninstaller.size()).toBe(1);
    });
  });

  describe('addChromeMessageListener', () => {
    let mockChrome;

    beforeEach(() => {
      mockChrome = {
        runtime: {
          id: 'test-extension-id',
          onMessage: {
            addListener: jest.fn(),
            removeListener: jest.fn(),
          },
        },
      };
      global.chrome = mockChrome;
    });

    test('should add message listener and register cleanup', () => {
      const listener = jest.fn();

      uninstaller.addChromeMessageListener(listener, 'test-message-listener');

      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalledWith(listener);
      expect(uninstaller.has('test-message-listener')).toBe(true);

      uninstaller.uninstall('test-message-listener');

      expect(mockChrome.runtime.onMessage.removeListener).toHaveBeenCalledWith(listener);
    });

    test('should not remove listener if extension is unloaded', () => {
      const listener = jest.fn();

      uninstaller.addChromeMessageListener(listener, 'test-message-listener');

      // Simulate extension unload
      mockChrome.runtime.id = undefined;

      uninstaller.uninstall('test-message-listener');

      expect(mockChrome.runtime.onMessage.removeListener).not.toHaveBeenCalled();
    });

    test('should add message listener with group', () => {
      const listener = jest.fn();

      uninstaller.addChromeMessageListener(listener, 'test-message-listener', 'chrome-group');

      expect(uninstaller.has('test-message-listener')).toBe(true);

      uninstaller.uninstallGroup('chrome-group');

      expect(mockChrome.runtime.onMessage.removeListener).toHaveBeenCalledWith(listener);
    });

    test('should auto-generate name if not provided', () => {
      const listener = jest.fn();

      uninstaller.addChromeMessageListener(listener);

      expect(uninstaller.size()).toBe(1);
    });
  });

  describe('setInterval', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should set interval and register cleanup', () => {
      const callback = jest.fn();

      uninstaller.setInterval(callback, 1000, 'test-interval');

      expect(uninstaller.has('test-interval')).toBe(true);

      jest.advanceTimersByTime(2500);
      expect(callback).toHaveBeenCalledTimes(2);

      uninstaller.uninstall('test-interval');

      jest.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalledTimes(2); // Should not be called again
    });

    test('should set interval with group', () => {
      const callback = jest.fn();

      uninstaller.setInterval(callback, 1000, 'test-interval', 'timer-group');

      expect(uninstaller.has('test-interval')).toBe(true);

      uninstaller.uninstallGroup('timer-group');

      jest.advanceTimersByTime(1000);
      expect(callback).not.toHaveBeenCalled();
    });

    test('should auto-generate name if not provided', () => {
      const callback = jest.fn();

      uninstaller.setInterval(callback, 1000);

      expect(uninstaller.size()).toBe(1);
    });
  });

  describe('setTimeout', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should set timeout and register cleanup', () => {
      const callback = jest.fn();

      uninstaller.setTimeout(callback, 1000, 'test-timeout');

      expect(uninstaller.has('test-timeout')).toBe(true);

      uninstaller.uninstall('test-timeout');

      jest.advanceTimersByTime(1000);
      expect(callback).not.toHaveBeenCalled();
    });

    test('should set timeout with group', () => {
      const callback = jest.fn();

      uninstaller.setTimeout(callback, 1000, 'test-timeout', 'timer-group');

      expect(uninstaller.has('test-timeout')).toBe(true);

      uninstaller.uninstallGroup('timer-group');

      jest.advanceTimersByTime(1000);
      expect(callback).not.toHaveBeenCalled();
    });

    test('should auto-generate name if not provided', () => {
      const callback = jest.fn();

      uninstaller.setTimeout(callback, 1000);

      expect(uninstaller.size()).toBe(1);
    });
  });

  describe('observe', () => {
    test('should create observer and register cleanup', () => {
      const callback = jest.fn();
      const target = document.createElement('div');
      const options = { childList: true };

      uninstaller.observe(callback, target, options, 'test-observer');

      expect(uninstaller.has('test-observer')).toBe(true);

      // Trigger a mutation
      target.appendChild(document.createElement('span'));

      uninstaller.uninstall('test-observer');

      // The observer should be disconnected, so adding more children shouldn't trigger callback
      const callCountBeforeUninstall = callback.mock.calls.length;
      target.appendChild(document.createElement('div'));

      // Give any pending callbacks time to execute
      expect(callback.mock.calls.length).toBe(callCountBeforeUninstall);
    });

    test('should create observer with group', () => {
      const callback = jest.fn();
      const target = document.createElement('div');
      const options = { childList: true };

      uninstaller.observe(callback, target, options, 'test-observer', 'observer-group');

      expect(uninstaller.has('test-observer')).toBe(true);

      uninstaller.uninstallGroup('observer-group');

      expect(uninstaller.size()).toBe(0);
    });

    test('should auto-generate name if not provided', () => {
      const callback = jest.fn();
      const target = document.createElement('div');
      const options = { childList: true };

      uninstaller.observe(callback, target, options);

      expect(uninstaller.size()).toBe(1);
    });
  });

  describe('_removeFromGroups', () => {
    test('should remove name from all groups', () => {
      const fn = jest.fn();
      uninstaller.register(fn, 'fn1', 'group1');
      uninstaller.register(fn, 'fn2', 'group1');
      uninstaller.register(fn, 'fn3', 'group2');

      uninstaller._removeFromGroups('fn1');

      expect(uninstaller.groups.get('group1').has('fn1')).toBe(false);
      expect(uninstaller.groups.get('group1').has('fn2')).toBe(true);
      expect(uninstaller.groups.get('group2').has('fn3')).toBe(true);
    });

    test('should clean up empty groups', () => {
      const fn = jest.fn();
      uninstaller.register(fn, 'fn1', 'group1');

      uninstaller._removeFromGroups('fn1');

      expect(uninstaller.groups.has('group1')).toBe(false);
    });

    test('should handle name not in any group', () => {
      const fn = jest.fn();
      uninstaller.register(fn, 'fn1');

      expect(() => {
        uninstaller._removeFromGroups('fn1');
      }).not.toThrow();
    });
  });

  describe('complex scenarios', () => {
    test('should handle mixed groups and individual uninstalls', () => {
      const order = [];
      const fn1 = jest.fn(() => order.push('fn1'));
      const fn2 = jest.fn(() => order.push('fn2'));
      const fn3 = jest.fn(() => order.push('fn3'));
      const fn4 = jest.fn(() => order.push('fn4'));

      uninstaller.register(fn1, 'fn1', 'group1');
      uninstaller.register(fn2, 'fn2', 'group1');
      uninstaller.register(fn3, 'fn3', 'group2');
      uninstaller.register(fn4, 'fn4');

      uninstaller.uninstall('fn4');
      expect(order).toEqual(['fn4']);

      uninstaller.uninstallGroup('group1');
      expect(order).toEqual(['fn4', 'fn2', 'fn1']);

      uninstaller.uninstall('fn3');
      expect(order).toEqual(['fn4', 'fn2', 'fn1', 'fn3']);

      expect(uninstaller.size()).toBe(0);
    });

    test('should handle re-registering after uninstall', () => {
      const fn1 = jest.fn();
      const fn2 = jest.fn();

      uninstaller.register(fn1, 'reusable-name');
      uninstaller.uninstall('reusable-name');

      expect(fn1).toHaveBeenCalledTimes(1);

      // Re-register with same name
      uninstaller.register(fn2, 'reusable-name');
      uninstaller.uninstall('reusable-name');

      expect(fn2).toHaveBeenCalledTimes(1);
    });

    test('should handle large number of functions', () => {
      const functions = [];
      const count = 1000;

      for (let i = 0; i < count; i++) {
        const fn = jest.fn();
        functions.push(fn);
        uninstaller.register(fn, `fn${i}`);
      }

      expect(uninstaller.size()).toBe(count);

      uninstaller.uninstallAll();

      expect(uninstaller.size()).toBe(0);
      functions.forEach(fn => {
        expect(fn).toHaveBeenCalledTimes(1);
      });
    });

    test('should maintain insertion order during execution', () => {
      const order = [];

      for (let i = 0; i < 10; i++) {
        uninstaller.register(() => order.push(i), `fn${i}`);
      }

      uninstaller.uninstallAll();

      // Should execute in reverse order (LIFO)
      expect(order).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
    });
  });
});

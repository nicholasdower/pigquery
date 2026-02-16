import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock chrome API and console methods
global.chrome = {
  runtime: {
    getManifest: jest.fn(),
  },
};

// Save original console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
};

describe('logger', () => {
  let logger;
  let mockConsole;

  beforeEach(async () => {
    // Reset modules to clear cached getName
    jest.resetModules();

    // Mock console methods
    mockConsole = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    console.log = mockConsole.log;
    console.warn = mockConsole.warn;
    console.error = mockConsole.error;
    console.debug = mockConsole.debug;

    // Reset chrome mock
    global.chrome = {
      runtime: {
        getManifest: jest.fn(),
      },
    };
  });

  afterEach(() => {
    // Restore original console methods
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;
  });

  describe('getName', () => {
    test('should get name with version from chrome.runtime.getManifest', async () => {
      global.chrome.runtime.getManifest.mockReturnValue({ version: '1.2.3' });

      const { default: loggerInstance } = await import('../logger.js');
      loggerInstance.log('test');

      expect(mockConsole.log).toHaveBeenCalledTimes(1);
      const call = mockConsole.log.mock.calls[0];
      expect(call[0]).toContain('PigQuery v1.2.3');
      expect(call[0]).toContain(process.env.NODE_ENV);
    });

    test('should return undefined when getManifest returns no version', async () => {
      global.chrome.runtime.getManifest.mockReturnValue({});

      const { default: loggerInstance } = await import('../logger.js');
      loggerInstance.log('test');

      expect(mockConsole.log).toHaveBeenCalledTimes(1);
      const call = mockConsole.log.mock.calls[0];
      expect(call[0]).toContain('undefined');
      expect(call[1]).toBe('test');
    });

    test('should use unknown version when chrome.runtime throws error', async () => {
      global.chrome.runtime.getManifest.mockImplementation(() => {
        throw new Error('Runtime error');
      });

      const { default: loggerInstance } = await import('../logger.js');
      loggerInstance.log('test');

      expect(mockConsole.log).toHaveBeenCalledTimes(1);
      const call = mockConsole.log.mock.calls[0];
      expect(call[0]).toContain('PigQuery v(unknown)');
      expect(call[0]).toContain(process.env.NODE_ENV);
    });

    test('should cache name after first call', async () => {
      global.chrome.runtime.getManifest.mockReturnValue({ version: '1.0.0' });

      const { default: loggerInstance } = await import('../logger.js');

      loggerInstance.log('first');
      loggerInstance.log('second');

      expect(global.chrome.runtime.getManifest).toHaveBeenCalledTimes(1);
      expect(mockConsole.log).toHaveBeenCalledTimes(2);

      const firstCall = mockConsole.log.mock.calls[0][0];
      const secondCall = mockConsole.log.mock.calls[1][0];
      expect(firstCall).toContain('PigQuery v1.0.0');
      expect(secondCall).toContain('PigQuery v1.0.0');
    });

    test('should handle undefined chrome global', async () => {
      const originalChrome = global.chrome;
      global.chrome = undefined;

      const { default: loggerInstance } = await import('../logger.js');
      loggerInstance.log('test');

      expect(mockConsole.log).toHaveBeenCalledTimes(1);
      const call = mockConsole.log.mock.calls[0];
      expect(call[0]).toContain('undefined');
      expect(call[1]).toBe('test');

      global.chrome = originalChrome;
    });
  });

  describe('log method', () => {
    beforeEach(async () => {
      global.chrome.runtime.getManifest.mockReturnValue({ version: '1.0.0' });
      logger = (await import('../logger.js')).default;
    });

    test('should log with timestamp, level, name, and message', () => {
      logger.log('test message');

      expect(mockConsole.log).toHaveBeenCalledTimes(1);
      const call = mockConsole.log.mock.calls[0];
      expect(call[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z - LOG - PigQuery v1\.0\.0 .* -$/);
      expect(call[1]).toBe('test message');
    });

    test('should log multiple arguments', () => {
      logger.log('message', 123, { key: 'value' });

      expect(mockConsole.log).toHaveBeenCalledTimes(1);
      const call = mockConsole.log.mock.calls[0];
      expect(call[0]).toContain('LOG');
      expect(call[1]).toBe('message');
      expect(call[2]).toBe(123);
      expect(call[3]).toEqual({ key: 'value' });
    });

    test('should log without arguments', () => {
      logger.log();

      expect(mockConsole.log).toHaveBeenCalledTimes(1);
      const call = mockConsole.log.mock.calls[0];
      expect(call[0]).toContain('LOG');
    });
  });

  describe('warn method', () => {
    beforeEach(async () => {
      global.chrome.runtime.getManifest.mockReturnValue({ version: '1.0.0' });
      logger = (await import('../logger.js')).default;
    });

    test('should warn with timestamp, level, name, and message', () => {
      logger.warn('warning message');

      expect(mockConsole.warn).toHaveBeenCalledTimes(1);
      const call = mockConsole.warn.mock.calls[0];
      expect(call[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z - WARN - PigQuery v1\.0\.0 .* -$/);
      expect(call[1]).toBe('warning message');
    });

    test('should warn multiple arguments', () => {
      logger.warn('warning', 456, [1, 2, 3]);

      expect(mockConsole.warn).toHaveBeenCalledTimes(1);
      const call = mockConsole.warn.mock.calls[0];
      expect(call[0]).toContain('WARN');
      expect(call[1]).toBe('warning');
      expect(call[2]).toBe(456);
      expect(call[3]).toEqual([1, 2, 3]);
    });
  });

  describe('error method', () => {
    beforeEach(async () => {
      global.chrome.runtime.getManifest.mockReturnValue({ version: '1.0.0' });
      logger = (await import('../logger.js')).default;
    });

    test('should error with timestamp, level, name, and message', () => {
      logger.error('error message');

      expect(mockConsole.error).toHaveBeenCalledTimes(1);
      const call = mockConsole.error.mock.calls[0];
      expect(call[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z - ERROR - PigQuery v1\.0\.0 .* -$/);
      expect(call[1]).toBe('error message');
    });

    test('should error multiple arguments including Error objects', () => {
      const error = new Error('test error');
      logger.error('error occurred', error);

      expect(mockConsole.error).toHaveBeenCalledTimes(1);
      const call = mockConsole.error.mock.calls[0];
      expect(call[0]).toContain('ERROR');
      expect(call[1]).toBe('error occurred');
      expect(call[2]).toBe(error);
    });
  });

  describe('debug method', () => {
    beforeEach(async () => {
      global.chrome.runtime.getManifest.mockReturnValue({ version: '1.0.0' });
      logger = (await import('../logger.js')).default;
    });

    test('should debug with timestamp, level, name, and message', () => {
      logger.debug('debug message');

      expect(mockConsole.debug).toHaveBeenCalledTimes(1);
      const call = mockConsole.debug.mock.calls[0];
      expect(call[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z - DEBUG - PigQuery v1\.0\.0 .* -$/);
      expect(call[1]).toBe('debug message');
    });

    test('should debug multiple arguments', () => {
      logger.debug('debug', true, null, undefined);

      expect(mockConsole.debug).toHaveBeenCalledTimes(1);
      const call = mockConsole.debug.mock.calls[0];
      expect(call[0]).toContain('DEBUG');
      expect(call[1]).toBe('debug');
      expect(call[2]).toBe(true);
      expect(call[3]).toBe(null);
      expect(call[4]).toBe(undefined);
    });
  });

  describe('timestamp format', () => {
    beforeEach(async () => {
      global.chrome.runtime.getManifest.mockReturnValue({ version: '1.0.0' });
      logger = (await import('../logger.js')).default;
    });

    test('should use ISO 8601 timestamp format', () => {
      const beforeTime = new Date().toISOString();
      logger.log('test');
      const afterTime = new Date().toISOString();

      const call = mockConsole.log.mock.calls[0][0];
      const timestamp = call.split(' - ')[0];

      // Verify it's a valid ISO timestamp
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Verify timestamp is between before and after
      expect(timestamp >= beforeTime).toBe(true);
      expect(timestamp <= afterTime).toBe(true);
    });
  });

  describe('all logging methods', () => {
    beforeEach(async () => {
      global.chrome.runtime.getManifest.mockReturnValue({ version: '2.5.0' });
      logger = (await import('../logger.js')).default;
    });

    test('should call correct console methods', () => {
      logger.log('log');
      logger.warn('warn');
      logger.error('error');
      logger.debug('debug');

      expect(mockConsole.log).toHaveBeenCalledTimes(1);
      expect(mockConsole.warn).toHaveBeenCalledTimes(1);
      expect(mockConsole.error).toHaveBeenCalledTimes(1);
      expect(mockConsole.debug).toHaveBeenCalledTimes(1);
    });

    test('should include correct log level in output', () => {
      logger.log('test');
      logger.warn('test');
      logger.error('test');
      logger.debug('test');

      expect(mockConsole.log.mock.calls[0][0]).toContain('- LOG -');
      expect(mockConsole.warn.mock.calls[0][0]).toContain('- WARN -');
      expect(mockConsole.error.mock.calls[0][0]).toContain('- ERROR -');
      expect(mockConsole.debug.mock.calls[0][0]).toContain('- DEBUG -');
    });
  });
});

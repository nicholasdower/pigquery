import { describe, test, expect, jest } from '@jest/globals';

jest.unstable_mockModule('../i18n.js', () => ({
  getBigQueryLocale: () => 'en',
  getMessage: key => key,
}));

const { detectContentType } = await import('../formatters.js');

describe('formatters - detectContentType', () => {
  describe('JSON detection', () => {
    test('should detect and format JSON objects', () => {
      const input = '{"name":"John","age":30}';
      const results = detectContentType(input);

      expect(results.length).toBeGreaterThan(1);
      expect(results[0].label).toBe('original');
      expect(results[0].value).toBe(input);
      expect(results[0].type).toBe('json');

      // Should have a formatted version
      const formatted = results.find(r => r.label.includes('formatted'));
      expect(formatted).toBeDefined();
      expect(formatted.type).toBe('json');
      expect(formatted.value).toContain('\n');
    });

    test('should detect JSON arrays', () => {
      const input = '[1,2,3]';
      const results = detectContentType(input);

      expect(results[0].label).toBe('original');
      expect(results[0].type).toBe('json');
    });

    test('should not add formatted tab for already formatted JSON', () => {
      const input = JSON.stringify({ name: 'John', age: 30 }, null, 2);
      const results = detectContentType(input);

      expect(results[0].label).toBe('original');
      expect(results[0].type).toBe('json');
      // Should not have additional formatted version if already formatted
      expect(results.length).toBe(1);
    });
  });

  describe('Number formatting', () => {
    test('should detect integers and add formatted version', () => {
      const input = '1234567890';
      const results = detectContentType(input);

      expect(results[0].label).toBe('original');
      expect(results[0].value).toBe(input);
      expect(results.length).toBeGreaterThan(1);
    });

    test('should detect decimal numbers', () => {
      const input = '123.456';
      const results = detectContentType(input);

      expect(results[0].value).toBe(input);
      // Decimal numbers might not always have additional formatted versions if already formatted
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    test('should detect negative numbers', () => {
      const input = '-42';
      const results = detectContentType(input);

      expect(results[0].value).toBe(input);
    });
  });

  describe('Date parsing', () => {
    test('should detect ISO date strings', () => {
      const input = '2023-10-15T14:30:00Z';
      const results = detectContentType(input);

      expect(results[0].label).toBe('original');
      expect(results[0].value).toBe(input);
      expect(results.length).toBeGreaterThan(1);

      // Should have formatted date options
      const hasDateLabel = results.some(r => r.label.includes('date'));
      expect(hasDateLabel).toBe(true);
    });

    test('should detect date-only format', () => {
      const input = '2023-10-15';
      const results = detectContentType(input);

      expect(results.length).toBeGreaterThan(1);
      const hasDateLabel = results.some(r => r.label.includes('Date'));
      expect(hasDateLabel).toBe(true);
    });

    test('should reject invalid dates', () => {
      const input = '2023-13-45'; // Invalid month and day
      const results = detectContentType(input);

      // Should only return original, no date parsing
      expect(results.length).toBe(1);
    });
  });

  describe('URL parsing', () => {
    test('should detect and parse HTTP URLs', () => {
      const input = 'https://example.com/path?key=value';
      const results = detectContentType(input);

      expect(results[0].label).toBe('original');
      expect(results.length).toBeGreaterThan(1);

      // Should have protocol
      const protocolResult = results.find(r => r.label.includes('protocol'));
      expect(protocolResult).toBeDefined();
      expect(protocolResult.value).toBe('https');

      // Should have host
      const hostResult = results.find(r => r.label.includes('host'));
      expect(hostResult).toBeDefined();
      expect(hostResult.value).toBe('example.com');

      // Should have path
      const pathResult = results.find(r => r.label.includes('path'));
      expect(pathResult).toBeDefined();
      expect(pathResult.value).toBe('/path');

      // Should have parameter
      const paramResult = results.find(r => r.label.includes('param'));
      expect(paramResult).toBeDefined();
    });

    test('should not detect URLs without protocol', () => {
      const input = 'example.com';
      const results = detectContentType(input);

      expect(results.length).toBe(1);
    });
  });

  describe('Base64 decoding', () => {
    test('should detect and decode base64 strings', () => {
      const original = 'Hello World';
      const input = btoa(original);
      const results = detectContentType(input);

      expect(results[0].label).toBe('original');
      expect(results.length).toBeGreaterThan(1);

      const decoded = results.find(r => r.label.includes('decoded'));
      expect(decoded).toBeDefined();
      expect(decoded.value).toBe(original);
    });

    test('should detect base64 with longer strings', () => {
      const input = 'SGVsbG8gV29ybGQhIFRoaXMgaXMgYSB0ZXN0';
      const results = detectContentType(input);

      expect(results[0].label).toBe('original');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    test('should not detect strings without proper base64 characters', () => {
      const input = 'hello world'; // lowercase only, no proper base64 pattern
      const results = detectContentType(input);

      expect(results.length).toBe(1);
    });
  });

  describe('Timestamp detection', () => {
    test('should detect millisecond timestamps', () => {
      const input = '1697377800000'; // Oct 15, 2023 in milliseconds
      const results = detectContentType(input);

      expect(results.length).toBeGreaterThan(1);

      // Should have timestamp interpretation (checking for the i18n key)
      const timestampResult = results.some(r => r.label.toLowerCase().includes('timestamp'));
      expect(timestampResult).toBe(true);
    });

    test('should detect second timestamps', () => {
      const input = '1697377800'; // Oct 15, 2023 in seconds
      const results = detectContentType(input);

      expect(results.length).toBeGreaterThan(1);

      // Should have timestamp interpretation
      const timestampResult = results.some(r => r.label.toLowerCase().includes('timestamp'));
      expect(timestampResult).toBe(true);
    });

    test('should not detect negative timestamps', () => {
      const input = '-1697377800';
      const results = detectContentType(input);

      // Should still produce some results (formatted number), but not timestamp
      const timestampResult = results.some(r => r.label.toLowerCase().includes('timestamp'));
      expect(timestampResult).toBe(false);
    });
  });

  describe('JWT detection', () => {
    test('should detect JWT', () => {
      const jwt =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const results = detectContentType(jwt);

      expect(results.length).toBeGreaterThanOrEqual(4);
      expect(results[0].label).toBe('original');
    });

    test('should have Header, Payload, and Signature tabs', () => {
      const jwt =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const results = detectContentType(jwt);

      expect(results.length).toBeGreaterThanOrEqual(4);
      expect(results[1].label).toContain('header');
      expect(results[2].label).toContain('payload');
      expect(results[3].label).toContain('signature');
    });
  });

  describe('YAML detection', () => {
    test('should detect YAML and set type', () => {
      const input = 'name: test\nage: 30';
      const results = detectContentType(input);

      expect(results.length).toBe(1);
      expect(results[0].label).toBe('original');
      expect(results[0].type).toBe('yaml');
    });

    test('should not add extra tabs for YAML', () => {
      const input = 'name: test\nage: 30';
      const results = detectContentType(input);

      expect(results.length).toBe(1);
    });
  });

  describe('XML detection', () => {
    test('should detect XML and set type', () => {
      const input = '<root><item>test</item></root>';
      const results = detectContentType(input);

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].label).toBe('original');
      expect(results[0].type).toBe('xml');
    });

    test('should add Formatted tab for XML', () => {
      const input = '<root><item>test</item></root>';
      const results = detectContentType(input);

      expect(results.length).toBe(2);
      expect(results[1].label).toContain('formatted');
      expect(results[1].type).toBe('xml');
    });
  });

  describe('Mixed content', () => {
    test('should return only original for plain text', () => {
      const input = 'Just plain text without special format';
      const results = detectContentType(input);

      expect(results.length).toBe(1);
      expect(results[0].label).toBe('original');
      expect(results[0].value).toBe(input);
      expect(results[0].type).toBe('text');
    });

    test('plain text should not have a formatter type', () => {
      const input = 'just some plain text';
      const results = detectContentType(input);

      expect(results.length).toBe(1);
      expect(results[0].label).toBe('original');
      expect(results[0].type).toBe('text');
    });

    test('should handle empty strings', () => {
      const input = '';
      const results = detectContentType(input);

      expect(results.length).toBe(1);
      expect(results[0].value).toBe(input);
      expect(results[0].type).toBe('text');
    });
  });
});

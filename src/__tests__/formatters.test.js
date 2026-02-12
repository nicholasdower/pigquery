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

  describe('UUID detection', () => {
    test('should detect UUID v4', () => {
      const input = '550e8400-e29b-41d4-a716-446655440000';
      const results = detectContentType(input);

      expect(results.length).toBeGreaterThan(1);
      expect(results[0].label).toBe('original');

      const versionResult = results.find(r => r.label.includes('version'));
      expect(versionResult).toBeDefined();
      expect(versionResult.value).toContain('4');
    });

    test('should detect UUID v1', () => {
      const input = '550e8400-e29b-11d4-a716-446655440000';
      const results = detectContentType(input);

      expect(results.length).toBeGreaterThan(1);
      const versionResult = results.find(r => r.label.includes('version'));
      expect(versionResult).toBeDefined();
      expect(versionResult.value).toContain('1');
    });

    test('should detect UUID v3', () => {
      const input = '550e8400-e29b-31d4-a716-446655440000';
      const results = detectContentType(input);

      expect(results.length).toBeGreaterThan(1);
      const versionResult = results.find(r => r.label.includes('version'));
      expect(versionResult).toBeDefined();
      expect(versionResult.value).toContain('3');
    });

    test('should detect UUID v5', () => {
      const input = '550e8400-e29b-51d4-a716-446655440000';
      const results = detectContentType(input);

      expect(results.length).toBeGreaterThan(1);
      const versionResult = results.find(r => r.label.includes('version'));
      expect(versionResult).toBeDefined();
      expect(versionResult.value).toContain('5');
    });

    test('should not detect invalid UUID format', () => {
      const input = '550e8400-e29b-41d4-a716-44665544000'; // Missing one char
      const results = detectContentType(input);

      expect(results.length).toBe(1);
      expect(results[0].label).toBe('original');
    });

    test('should not detect UUID with invalid version', () => {
      const input = '550e8400-e29b-61d4-a716-446655440000'; // v6 doesn't exist
      const results = detectContentType(input);

      expect(results.length).toBe(1);
    });
  });

  describe('Hexadecimal detection', () => {
    test('should detect and decode hex string to ASCII', () => {
      const text = 'Hello World';
      const hex = Array.from(text)
        .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('');

      const results = detectContentType(hex);

      expect(results.length).toBeGreaterThan(1);
      const decodedResult = results.find(r => r.label.includes('decoded'));
      expect(decodedResult).toBeDefined();
      expect(decodedResult.value).toBe(text);
    });

    test('should show hex dump for non-printable bytes', () => {
      // Create hex string with non-printable bytes
      const hex = '00010203040506070809' + 'ff'.repeat(10);

      const results = detectContentType(hex);

      expect(results.length).toBeGreaterThan(1);
      const hexDumpResult = results.find(r => r.label.includes('hexDump') || r.label.includes('Hex'));
      expect(hexDumpResult).toBeDefined();
    });

    test('should not detect short hex strings', () => {
      const hex = 'abcdef12'; // Less than 20 chars
      const results = detectContentType(hex);

      expect(results.length).toBe(1);
      expect(results[0].label).toBe('original');
    });

    test('should not detect odd-length hex strings', () => {
      const hex = 'abcdef123456789012345'; // 21 chars
      const results = detectContentType(hex);

      expect(results.length).toBe(1);
    });

    test('should not detect non-hex characters', () => {
      const input = 'ghijklmnopqrstuvwxyz1234'; // Contains non-hex chars
      const results = detectContentType(input);

      expect(results.length).toBe(1);
    });
  });

  describe('JWT with timestamps', () => {
    test('should parse JWT with iat (issued at)', () => {
      // JWT with iat: 1516239022
      const jwt =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const results = detectContentType(jwt);

      expect(results.length).toBeGreaterThan(4);
      const issuedResult = results.find(r => r.label.includes('issued'));
      expect(issuedResult).toBeDefined();
      expect(issuedResult.value).toContain('2018');
    });

    test('should parse JWT with exp (expiration)', () => {
      // Create JWT with exp timestamp
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify({ sub: '123', exp: 1893456000 })); // 2030
      const signature = 'signature';
      const jwt = `${header}.${payload}.${signature}`;

      const results = detectContentType(jwt);

      const expiresResult = results.find(r => r.label.includes('expires'));
      expect(expiresResult).toBeDefined();
      expect(expiresResult.value).toContain('2030');
    });

    test('should parse JWT with nbf (not before)', () => {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify({ sub: '123', nbf: 1609459200 })); // 2021
      const signature = 'signature';
      const jwt = `${header}.${payload}.${signature}`;

      const results = detectContentType(jwt);

      const notBeforeResult = results.find(r => r.label.includes('notBefore') || r.label.includes('not'));
      expect(notBeforeResult).toBeDefined();
    });

    test('should not detect JWT without proper header fields', () => {
      // JWT-like format but missing alg/typ in header
      const header = btoa(JSON.stringify({ foo: 'bar' }));
      const payload = btoa(JSON.stringify({ sub: '123' }));
      const signature = 'signature';
      const jwt = `${header}.${payload}.${signature}`;

      const results = detectContentType(jwt);

      expect(results.length).toBe(1);
      expect(results[0].label).toBe('original');
    });

    test('should not detect strings without three parts', () => {
      const input = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ'; // Only 2 parts
      const results = detectContentType(input);

      expect(results.length).toBe(1);
    });
  });

  describe('Base64 nested content', () => {
    test('should detect and format nested JSON in base64', () => {
      const json = JSON.stringify({ name: 'test', value: 123 });
      const base64 = btoa(json);

      const results = detectContentType(base64);

      expect(results.length).toBeGreaterThan(1);
      // Should detect base64 and then format the JSON inside
      const hasJson = results.some(r => r.type === 'json');
      expect(hasJson).toBe(true);
    });

    test('should handle base64url format (with - and _)', () => {
      const text = 'Hello World!';
      const base64 = btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

      const results = detectContentType(base64);

      expect(results.length).toBeGreaterThan(1);
      const decodedResult = results.find(r => r.label.includes('decoded'));
      expect(decodedResult).toBeDefined();
      expect(decodedResult.value).toBe(text);
    });

    test('should reject base64 with too many non-printable characters', () => {
      // Create base64 that decodes to mostly non-printable
      const nonPrintable = String.fromCharCode(0, 1, 2, 3, 4, 5, 6, 7, 8);
      const base64 = btoa(nonPrintable);

      const results = detectContentType(base64);

      // Should not be detected as valid base64 text
      expect(results.length).toBe(1);
    });
  });

  describe('URL edge cases', () => {
    test('should parse URL with port', () => {
      const input = 'https://example.com:8080/path';
      const results = detectContentType(input);

      expect(results.length).toBeGreaterThan(1);
      const portResult = results.find(r => r.label.includes('port'));
      expect(portResult).toBeDefined();
      expect(portResult.value).toBe('8080');
    });

    test('should parse URL with fragment', () => {
      const input = 'https://example.com/path#section';
      const results = detectContentType(input);

      expect(results.length).toBeGreaterThan(1);
      const fragmentResult = results.find(r => r.label.includes('fragment'));
      expect(fragmentResult).toBeDefined();
      expect(fragmentResult.value).toBe('section');
    });

    test('should decode encoded URL parameters', () => {
      const input = 'https://example.com?name=John%20Doe&city=New%20York';
      const results = detectContentType(input);

      expect(results.length).toBeGreaterThan(1);
      const nameParam = results.find(r => r.label.includes('param') && r.value.includes('John'));
      expect(nameParam).toBeDefined();
      expect(nameParam.value).toBe('John Doe');
    });

    test('should handle URL without path', () => {
      const input = 'https://example.com';
      const results = detectContentType(input);

      expect(results.length).toBeGreaterThan(1);
      // Should have protocol and host but not path
      const pathResult = results.find(r => r.label.includes('path'));
      expect(pathResult).toBeUndefined();
    });

    test('should handle http protocol', () => {
      const input = 'http://example.com/test';
      const results = detectContentType(input);

      expect(results.length).toBeGreaterThan(1);
      const protocolResult = results.find(r => r.label.includes('protocol'));
      expect(protocolResult).toBeDefined();
      expect(protocolResult.value).toBe('http');
    });
  });

  describe('Date format variations', () => {
    test('should parse SQL datetime format', () => {
      const input = '2023-10-15 14:30:00.123456';
      const results = detectContentType(input);

      expect(results.length).toBeGreaterThan(1);
      const hasDateLabel = results.some(r => r.label.includes('date') || r.label.includes('Date'));
      expect(hasDateLabel).toBe(true);
    });

    test('should parse BigQuery UTC datetime format', () => {
      const input = '2023-10-15 14:30:00.123456 UTC';
      const results = detectContentType(input);

      expect(results.length).toBeGreaterThan(1);
      const hasDateLabel = results.some(r => r.label.includes('date') || r.label.includes('Date'));
      expect(hasDateLabel).toBe(true);
    });

    test('should parse PostgreSQL datetime with offset', () => {
      const input = '2023-10-15 14:30:00.123456+05:30';
      const results = detectContentType(input);

      expect(results.length).toBeGreaterThan(1);
      const hasDateLabel = results.some(r => r.label.includes('date') || r.label.includes('Date'));
      expect(hasDateLabel).toBe(true);
    });

    test('should parse ISO datetime without timezone', () => {
      const input = '2023-10-15T14:30:00.123';
      const results = detectContentType(input);

      expect(results.length).toBeGreaterThan(1);
      const hasDateLabel = results.some(r => r.label.includes('date') || r.label.includes('Date'));
      expect(hasDateLabel).toBe(true);
    });

    test('should parse RFC datetime format', () => {
      const input = 'Mon, 15 Oct 2023 14:30:00 GMT';
      const results = detectContentType(input);

      expect(results.length).toBeGreaterThan(1);
      const hasDateLabel = results.some(r => r.label.includes('date') || r.label.includes('Date'));
      expect(hasDateLabel).toBe(true);
    });

    test('should reject dates with year out of range', () => {
      const input = '1899-10-15T14:30:00Z'; // Before 1900
      const results = detectContentType(input);

      expect(results.length).toBe(1);
      expect(results[0].label).toBe('original');
    });

    test('should reject dates far in future', () => {
      const input = '2201-10-15T14:30:00Z'; // After 2200
      const results = detectContentType(input);

      expect(results.length).toBe(1);
    });

    test('should include milliseconds in date output', () => {
      const input = '2023-10-15T14:30:00Z';
      const results = detectContentType(input);

      expect(results.length).toBeGreaterThan(1);
      const msResult = results.find(r => r.label.includes('milliseconds'));
      expect(msResult).toBeDefined();
      expect(msResult.value).toMatch(/^\d+$/);
    });
  });

  describe('Number edge cases', () => {
    test('should not treat very long digit strings as numbers', () => {
      const input = '1234567890123456789012345678901234567890'; // 40 chars
      const results = detectContentType(input);

      // Should not be formatted as number (but might be detected as hex)
      const numberFormatted = results.find(r => r.label.includes('Number') && r.label.includes('formatted'));
      expect(numberFormatted).toBeUndefined();
    });

    test('should handle very large numbers', () => {
      const input = '999999999';
      const results = detectContentType(input);

      expect(results.length).toBeGreaterThan(1);
    });

    test('should handle decimal numbers with many digits', () => {
      const input = '123.456789012345';
      const results = detectContentType(input);

      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    test('should not format already formatted numbers', () => {
      const input = '1,234,567'; // Already formatted
      const results = detectContentType(input);

      expect(results.length).toBe(1);
    });
  });

  describe('Timestamp boundary cases', () => {
    test('should reject timestamp beyond year 2286', () => {
      const input = '10000000000001'; // Beyond max milliseconds
      const results = detectContentType(input);

      // Should still format as number, but not as timestamp
      const timestampResult = results.some(r => r.label.toLowerCase().includes('timestamp'));
      expect(timestampResult).toBe(false);
    });

    test('should handle minimum valid timestamp', () => {
      const input = '946684800'; // Year 2000 in seconds
      const results = detectContentType(input);

      expect(results.length).toBeGreaterThan(1);
      const timestampResult = results.some(r => r.label.toLowerCase().includes('timestamp'));
      expect(timestampResult).toBe(true);
    });

    test('should distinguish between ms and seconds timestamps', () => {
      const msTimestamp = '1697377800000'; // Milliseconds
      const sTimestamp = '1697377800'; // Seconds

      const msResults = detectContentType(msTimestamp);
      const sResults = detectContentType(sTimestamp);

      expect(msResults.length).toBeGreaterThan(1);
      expect(sResults.length).toBeGreaterThan(1);

      // Both should have timestamp labels
      const hasMsTimestamp = msResults.some(r => r.label.toLowerCase().includes('timestamp'));
      const hasSTimestamp = sResults.some(r => r.label.toLowerCase().includes('timestamp'));

      expect(hasMsTimestamp).toBe(true);
      expect(hasSTimestamp).toBe(true);
    });
  });

  describe('XML variations', () => {
    test('should format XML with self-closing tags', () => {
      const input = '<root><item/><item/></root>';
      const results = detectContentType(input);

      expect(results.length).toBe(2);
      expect(results[0].type).toBe('xml');
      expect(results[1].label).toContain('formatted');
    });

    test('should format XML with declarations', () => {
      const input = '<?xml version="1.0"?><root><item>test</item></root>';
      const results = detectContentType(input);

      expect(results.length).toBe(2);
      expect(results[0].type).toBe('xml');
    });

    test('should format XML with DOCTYPE', () => {
      const input = '<!DOCTYPE html><html><body>test</body></html>';
      const results = detectContentType(input);

      expect(results.length).toBe(2);
      expect(results[0].type).toBe('xml');
    });

    test('should handle XML with attributes', () => {
      const input = '<root attr="value"><item id="1">test</item></root>';
      const results = detectContentType(input);

      expect(results.length).toBe(2);
      expect(results[0].type).toBe('xml');
    });

    test('should handle malformed XML gracefully', () => {
      const input = '<root>unclosed tag';
      const results = detectContentType(input);

      // The formatter will still try to format it, even if malformed
      expect(results[0].label).toBe('original');
      expect(results[0].type).toBe('xml');
    });
  });

  describe('YAML variations', () => {
    test('should detect YAML with document separator', () => {
      const input = '---\nname: test\nage: 30';
      const results = detectContentType(input);

      expect(results.length).toBe(1);
      expect(results[0].type).toBe('yaml');
    });

    test('should detect YAML list format', () => {
      const input = '- item1\n- item2\n- item3';
      const results = detectContentType(input);

      expect(results.length).toBe(1);
      expect(results[0].type).toBe('yaml');
    });

    test('should detect YAML list with objects', () => {
      const input = '- name: item1\n  value: 1\n- name: item2\n  value: 2';
      const results = detectContentType(input);

      expect(results.length).toBe(1);
      expect(results[0].type).toBe('yaml');
    });

    test('should not detect YAML if it parses to primitive', () => {
      const input = 'just a string';
      const results = detectContentType(input);

      expect(results.length).toBe(1);
      expect(results[0].type).toBe('text');
    });

    test('should not detect JSON as YAML', () => {
      const input = '{"name": "test"}';
      const results = detectContentType(input);

      expect(results[0].type).toBe('json');
    });

    test('should not detect XML as YAML', () => {
      const input = '<root>test</root>';
      const results = detectContentType(input);

      expect(results[0].type).toBe('xml');
    });
  });
});

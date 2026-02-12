import { describe, test, expect } from '@jest/globals';
import { compressAndEncode, decodeAndDecompress } from '../compression.js';

describe('compression utilities', () => {
  describe('compressAndEncode', () => {
    test('should compress and encode a simple string', () => {
      const input = 'SELECT * FROM table';
      const encoded = compressAndEncode(input);

      // Should return a base64url string (no +, /, or = characters)
      expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('=');
    });

    test('should produce different output for different inputs', () => {
      const input1 = 'SELECT * FROM users';
      const input2 = 'SELECT * FROM posts';

      const encoded1 = compressAndEncode(input1);
      const encoded2 = compressAndEncode(input2);

      expect(encoded1).not.toBe(encoded2);
    });

    test('should handle empty string', () => {
      const input = '';
      const encoded = compressAndEncode(input);

      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(0);
    });

    test('should handle unicode characters', () => {
      const input = 'SELECT * FROM users WHERE name = "José Müller 中文"';
      const encoded = compressAndEncode(input);

      expect(typeof encoded).toBe('string');
      expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    test('should compress long strings efficiently', () => {
      const longQuery = 'SELECT * FROM table WHERE id = 1 '.repeat(100);
      const encoded = compressAndEncode(longQuery);

      // Compressed output should be significantly smaller than input
      // (gzip is very effective on repetitive text)
      expect(encoded.length).toBeLessThan(longQuery.length);
    });
  });

  describe('decodeAndDecompress', () => {
    test('should decode what was encoded', () => {
      const input = 'SELECT * FROM users WHERE id = 42';
      const encoded = compressAndEncode(input);
      const decoded = decodeAndDecompress(encoded);

      expect(decoded).toBe(input);
    });

    test('should handle unicode characters round-trip', () => {
      const input = 'SELECT * FROM users WHERE name = "José Müller 中文 emoji 🎉"';
      const encoded = compressAndEncode(input);
      const decoded = decodeAndDecompress(encoded);

      expect(decoded).toBe(input);
    });

    test('should handle empty string round-trip', () => {
      const input = '';
      const encoded = compressAndEncode(input);
      const decoded = decodeAndDecompress(encoded);

      expect(decoded).toBe(input);
    });

    test('should handle long queries round-trip', () => {
      const input =
        'SELECT users.id, users.name, users.email, orders.id as order_id, orders.total FROM users INNER JOIN orders ON users.id = orders.user_id WHERE users.created_at > "2023-01-01" AND orders.status = "completed" ORDER BY orders.created_at DESC LIMIT 100';
      const encoded = compressAndEncode(input);
      const decoded = decodeAndDecompress(encoded);

      expect(decoded).toBe(input);
    });

    test('should handle standard base64 encoding (backward compatibility)', () => {
      // Test with base64 instead of base64url
      const input = 'test+string/with=padding';
      const base64Standard = btoa(new TextEncoder().encode(input).reduce((s, b) => s + String.fromCharCode(b), ''));

      // Should decode standard base64 (legacy uncompressed format)
      const decoded = decodeAndDecompress(base64Standard);
      expect(decoded).toBe(input);
    });
  });
});

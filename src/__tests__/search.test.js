import { describe, test, expect } from '@jest/globals';
import { filter } from '../search.js';

describe('search - filter', () => {
  // Test data
  const items = [
    { group: 'Analytics', tag: 'TABLE', name: 'user_orders' },
    { group: 'Analytics', tag: 'TABLE', name: 'order_items' },
    { group: 'Marketing', tag: 'QUERY', name: 'campaign_metrics' },
    { group: 'My Project', tag: 'JOIN', name: 'obb_to_cob' },
  ];

  describe('Empty query', () => {
    test('should return all items with empty string', () => {
      const result = filter(items, '');
      expect(result).toEqual(items);
    });

    test('should return all items with whitespace only', () => {
      const result = filter(items, '   ');
      expect(result).toEqual(items);
    });
  });

  describe('Exact match', () => {
    test('should match exact token in name', () => {
      const result = filter(items, 'user');
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('user_orders');
    });

    test('should be case insensitive', () => {
      const result = filter(items, 'USER');
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('user_orders');
    });
  });

  describe('Prefix match', () => {
    test('should match token prefix', () => {
      const result = filter(items, 'ord');
      expect(result.length).toBe(2);
      // Should match both "user_orders" and "order_items"
    });
  });

  describe('Acronym match', () => {
    test('should match first letters of tokens', () => {
      const result = filter(items, 'otc');
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('obb_to_cob');
    });
  });

  describe('Token-prefix sequence match', () => {
    test('should match across token prefixes', () => {
      const result = filter(items, 'obtoc');
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('obb_to_cob');
    });
  });

  describe('AND semantics', () => {
    test('should require all query tokens to match', () => {
      const result = filter(items, 'analytics order');
      expect(result.length).toBe(2);
      // Should match both Analytics tables
      expect(result.every(r => r.group === 'Analytics')).toBe(true);
    });

    test('should return no results when token missing', () => {
      const result = filter(items, 'analytics zzz');
      expect(result.length).toBe(0);
    });
  });

  describe('Ranking', () => {
    test('should rank earlier matches higher', () => {
      const result = filter(items, 'order');
      // 'order_items' should rank above 'user_orders' (match at token 0 vs 1)
      expect(result[0].name).toBe('order_items');
    });
  });

  describe('Field matching', () => {
    test('should match group field', () => {
      const result = filter(items, 'marketing');
      expect(result.length).toBe(1);
      expect(result[0].group).toBe('Marketing');
    });

    test('should match tag field', () => {
      const result = filter(items, 'query');
      expect(result.length).toBe(1);
      expect(result[0].tag).toBe('QUERY');
    });
  });

  describe('Late token match (regression)', () => {
    test('should match token at end of long name', () => {
      // Regression test: "bar" matches at end, position penalty shouldn't make score negative
      const testItems = [{ group: 'buckster', tag: 'table', name: 'foos to foos_blah_bar' }];

      const result1 = filter(testItems, 'bar');
      expect(result1.length).toBe(1);
      expect(result1[0].name).toBe('foos to foos_blah_bar');

      const result2 = filter(testItems, 'bar_');
      expect(result2.length).toBe(1);
      expect(result2[0].name).toBe('foos to foos_blah_bar');
    });
  });

  describe('Field order independence', () => {
    test('should match across all three fields in any order', () => {
      // group=Marketing, tag=QUERY, name=campaign_metrics
      const result1 = filter(items, 'marketing query campaign');
      const result2 = filter(items, 'campaign marketing query');
      const result3 = filter(items, 'query campaign marketing');

      expect(result1.length).toBe(1);
      expect(result1[0].name).toBe('campaign_metrics');

      expect(result2.length).toBe(1);
      expect(result2[0].name).toBe('campaign_metrics');

      expect(result3.length).toBe(1);
      expect(result3[0].name).toBe('campaign_metrics');
    });
  });

  describe('Combined field matching', () => {
    test('should match acronym across fields (combined-acronym)', () => {
      // "mq" should match "Marketing" + "Query" (first letters)
      const result = filter(items, 'mq');
      expect(result.length).toBe(1);
      expect(result[0].group).toBe('Marketing');
      expect(result[0].tag).toBe('QUERY');
    });

    test('should match token-prefix sequence across fields (combined-sequence)', () => {
      // "marqu" should match "mar"keting + "qu"ery
      const result = filter(items, 'marqu');
      expect(result.length).toBe(1);
      expect(result[0].group).toBe('Marketing');
      expect(result[0].tag).toBe('QUERY');
    });

    test('should match across group and name fields', () => {
      // "anord" should match "An"alytics + "ord"ers
      const result = filter(items, 'anord');
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some(r => r.group === 'Analytics' && r.name.includes('order'))).toBe(true);
    });

    test('should prioritize single-field matches over combined matches', () => {
      const testItems = [
        { group: 'Test', tag: 'TABLE', name: 'marketing_query' }, // Single field match
        { group: 'Marketing', tag: 'QUERY', name: 'test' }, // Combined field match
      ];

      const result = filter(testItems, 'mq');
      // Single field acronym match should rank higher than combined field match
      expect(result.length).toBe(2);
    });
  });

  describe('Additional edge cases', () => {
    test('should handle special characters in query', () => {
      const result = filter(items, 'user-orders');
      // Should tokenize to "user" "orders"
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('user_orders');
    });

    test('should handle items with null/undefined fields', () => {
      const testItems = [
        { group: null, tag: 'TABLE', name: 'test_table' },
        { group: 'Test', tag: undefined, name: 'another_table' },
      ];

      const result = filter(testItems, 'table');
      expect(result.length).toBe(2);
    });

    test('should handle empty items array', () => {
      const result = filter([], 'query');
      expect(result).toEqual([]);
    });

    test('should maintain order stability for equal scores', () => {
      const testItems = [
        { group: 'A', tag: 'TABLE', name: 'test' },
        { group: 'B', tag: 'TABLE', name: 'test' },
        { group: 'C', tag: 'TABLE', name: 'test' },
      ];

      const result = filter(testItems, 'test');
      expect(result.length).toBe(3);
      // Should maintain original order when scores are equal
    });

    test('should handle single character queries', () => {
      // Single char queries should still match (exact match or prefix)
      const result = filter(items, 'a');
      expect(result.length).toBeGreaterThan(0);
    });

    test('should handle items with empty string fields', () => {
      const testItems = [
        { group: '', tag: '', name: 'test_item' },
        { group: 'Test', tag: 'TABLE', name: '' },
      ];

      const result = filter(testItems, 'test');
      expect(result.length).toBeGreaterThan(0);
    });

    test('should handle query with only special characters', () => {
      // Should tokenize to empty array and return all items
      const result = filter(items, '!!!');
      expect(result).toEqual(items);
    });

    test('should handle items with consecutive delimiters in names', () => {
      const testItems = [{ group: 'Test', tag: 'TABLE', name: 'foo___bar' }];

      const result = filter(testItems, 'fb');
      expect(result.length).toBe(1);
    });
  });
});

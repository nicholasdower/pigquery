/**
 * @jest-environment node
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import {
  startChrome,
  stopChrome,
  goToBigQueryEditor,
  waitForBigQueryEditor,
  getClipboard,
  waitForClipboard,
  generateLongQuery,
  getShareLinkPattern,
  getBaseUrl,
  selectAll,
  copy,
  paste,
} from './helpers.js';

describe('Share Query Integration', () => {
  let page;
  const timeout = 60000; // 60 second timeout for integration tests

  beforeAll(async () => {
    const result = await startChrome();
    page = result.page;
  }, timeout);

  afterAll(async () => {
    await stopChrome();
  }, timeout);

  test(
    'should share a long query via URL and decompress it correctly',
    async () => {
      // Generate a long SQL query (around 5KB)
      const originalQuery = generateLongQuery(5000);

      // Wait for BigQuery editor to be ready
      let editor = await goToBigQueryEditor(page);

      // Paste the query into the editor
      await page.evaluate(query => navigator.clipboard.writeText(query), originalQuery);
      await editor.focus();
      await paste(page);
      await page.waitForTimeout(100);

      // Select all text
      await selectAll(page);
      await page.waitForTimeout(1000);

      // Wait for the clipboard to contain a share link
      const shareUrl = await waitForClipboard(page, getShareLinkPattern());

      // Navigate to the URL in the current tab and wait for BigQuery to load
      await page.goto(shareUrl);
      await waitForBigQueryEditor(page);

      // Select all, copy and verify query
      await selectAll(page);
      await page.waitForTimeout(2000); // Wait for the copy link to be copied to the clipboard
      await copy(page); // Overwrite the clipboard with the original query
      expect(await getClipboard(page)).toBe(originalQuery);
    },
    timeout
  );

  test(
    'should decompress a known share URL',
    async () => {
      await page.goto(`${getBaseUrl()}?pig=H4sIAAAAAAAAAytOzUlNLlFQSsvPV7IGABB_kz0NAAAA&project=PigQuery`);
      await waitForBigQueryEditor(page);
      await selectAll(page);
      await copy(page);
      expect(await getClipboard(page)).toBe('select "foo";');
    },
    timeout
  );
});

/**
 * @jest-environment node
 */

import { describe, test, beforeAll, afterAll } from '@jest/globals';
import {
  startChrome,
  stopChrome,
  goToBigQueryEditor,
  waitForClipboard,
  generateLongQuery,
  getShareLinkPattern,
  getBaseUrl,
  selectAll,
  paste,
  assertEditorContent,
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

      // Paste the query into the editor and select all
      await page.evaluate(query => navigator.clipboard.writeText(query), originalQuery);
      await editor.focus();
      await paste(page);
      await selectAll(page);
      await page.waitForTimeout(1000); // Wait for the contents to be copied. We are going to steal focus in waitForClipboard.

      // Wait for the clipboard to contain a share link
      const shareUrl = await waitForClipboard(page, getShareLinkPattern());

      // Navigate to the URL in the current tab and wait for BigQuery to load
      await page.goto(shareUrl);
      await assertEditorContent(page, originalQuery);
    },
    timeout
  );

  test(
    'should decompress a known share URL',
    async () => {
      await page.goto(`${getBaseUrl()}?pig=H4sIAAAAAAAAAytOzUlNLlFQSsvPV7IGABB_kz0NAAAA&project=PigQuery`);
      await assertEditorContent(page, 'select "foo";');
    },
    timeout
  );
});

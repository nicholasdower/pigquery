/**
 * @jest-environment node
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import {
  startChrome,
  stopChrome,
  waitForBigQueryEditor,
  getClipboard,
  waitForClipboard,
  generateLongQuery,
} from './helpers.js';

// Skip integration tests by default unless INTEGRATION_TESTS=true
const describeIntegration = process.env.INTEGRATION_TESTS === 'true' ? describe : describe.skip;

describeIntegration('Share Query Integration', () => {
  let page;
  const timeout = 60000; // 60 second timeout for integration tests

  beforeAll(async () => {
    const result = await startChrome();
    page = result.page;
  }, timeout);

  afterAll(async () => {
    // Set up dialog handler to accept any "are you sure you want to close" alerts
    if (page) {
      page.on('dialog', async dialog => {
        await dialog.accept();
      });
    }
    await stopChrome();
  }, timeout);

  test(
    'should share a long query via URL and decompress it correctly',
    async () => {
      // Generate a long SQL query (around 5KB)
      const originalQuery = generateLongQuery(5000);

      // Wait for BigQuery editor to be ready
      await waitForBigQueryEditor(page);

      // Copy the query to clipboard and paste it
      await page.evaluate(query => navigator.clipboard.writeText(query), originalQuery);
      await page.waitForTimeout(200);
      await page.keyboard.press('Meta+KeyV');
      await page.waitForTimeout(1000);

      // Select all text with Command+A
      await page.keyboard.press('Meta+KeyA');
      await page.waitForTimeout(1000);

      // Wait for the clipboard to contain a BigQuery URL
      const shareUrl = await waitForClipboard(/https:\/\/console\.cloud\.google\.com\/bigquery/, 10000, 200);

      // Verify URL contains the query parameter
      expect(shareUrl).toMatch(/https:\/\/console\.cloud\.google\.com\/bigquery/);
      expect(shareUrl).toContain('?');
      expect(shareUrl).toContain('pig=');

      // Navigate to the URL in the current tab
      await page.goto(shareUrl);

      // Wait for BigQuery to load again
      await waitForBigQueryEditor(page);

      // Wait for the editor to contain text
      let editorHasText = false;
      const maxAttempts = 50;
      let attempts = 0;

      while (!editorHasText && attempts < maxAttempts) {
        try {
          const editorText = await page.evaluate(() => {
            const editor = document.querySelector('.view-lines');
            return editor ? editor.textContent : '';
          });

          if (editorText && editorText.trim().length > 100) {
            editorHasText = true;
          } else {
            await page.waitForTimeout(200);
            attempts++;
          }
        } catch (err) {
          await page.waitForTimeout(200);
          attempts++;
        }
      }

      expect(editorHasText).toBe(true);

      // Select all with Command+A
      await page.keyboard.press('Meta+KeyA');

      // Copy with Command+C
      await page.keyboard.press('Meta+KeyC');
      await page.waitForTimeout(1000);

      // Get the clipboard content
      const clipboardContent = await getClipboard();
      expect(clipboardContent).toBe(originalQuery);
    },
    timeout
  );
});

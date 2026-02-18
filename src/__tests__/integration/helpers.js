import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let chromeProcess = null;
let browser = null;
let page = null;

/**
 * Start Chrome with remote debugging and connect via CDP
 * @param {string} url - Initial URL to open
 * @returns {Promise<{browser: import('playwright').Browser, page: import('playwright').Page, chromeProcess: import('child_process').ChildProcess}>}
 */
export async function startChrome(url) {
  // Use local bigquery.html if USE_LOCAL_BIGQUERY is set
  if (!url && process.env.USE_LOCAL_BIGQUERY === 'true') {
    const localPath = path.join(__dirname, 'bigquery.html');
    url = `file://${localPath}`;
  } else if (!url) {
    url = 'https://console.cloud.google.com/bigquery';
  }

  const profileDir = path.join(__dirname, '..', '..', '..', 'profile');

  chromeProcess = spawn(
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ['--remote-debugging-port=9222', `--user-data-dir=${profileDir}`, '--window-size=1280,800', url],
    {
      detached: false,
      stdio: 'ignore',
    }
  );

  await new Promise(resolve => setTimeout(resolve, 3000));

  browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const defaultContext = browser.contexts()[0];
  page = defaultContext.pages()[0];

  return { browser, page, chromeProcess };
}

/**
 * Stop Chrome and clean up
 */
export async function stopChrome() {
  if (chromeProcess) {
    // Kill the Chrome process directly to avoid any close dialogs
    chromeProcess.kill('SIGTERM');

    // Give it a moment to close
    await new Promise(resolve => setTimeout(resolve, 1000));

    chromeProcess = null;
  }

  if (browser) {
    try {
      await browser.close();
    } catch (err) {
      // Ignore errors during cleanup since we already killed the process
      console.warn('Error closing browser (expected after process kill):', err.message);
    }
    browser = null;
    page = null;
  }
}

/**
 * Waits for the BigQuery code editor textarea to be visible.
 * @param {import('playwright').Page} page
 * @param {number} timeout
 * @returns {Promise<import('playwright').ElementHandle>}
 */
export async function waitForBigQueryEditor(page, timeout = 30000) {
  return await page.waitForSelector('cfc-code-editor textarea', { state: 'visible', timeout });
}

/**
 * Navigates to and focuses the BigQuery editor.
 * @param {import('playwright').Page} page
 * @param {number} timeout
 * @returns {Promise<import('playwright').ElementHandle>}
 */
export async function goToBigQueryEditor(page, timeout = 30000) {
  await page.waitForSelector('cfc-panel-sub-header [role="tab"]', { timeout });
  const tabs = await page.$$('cfc-panel-sub-header [role="tab"]');
  await tabs[tabs.length - 1].click();
  return await waitForBigQueryEditor(page, timeout);
}

const CLIPBOARD_INPUT_ID = '__pigquery_clipboard_helper__';
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

/**
 * Selects all content in the currently focused element (Cmd+A / Ctrl+A).
 * @param {import('playwright').Page} page
 */
export async function selectAll(page) {
  await page.keyboard.press(`${MOD}+KeyA`);
}

/**
 * Copies the current selection to the clipboard (Cmd+C / Ctrl+C).
 * @param {import('playwright').Page} page
 */
export async function copy(page) {
  await page.keyboard.press(`${MOD}+KeyC`);
}

/**
 * Pastes clipboard content into the currently focused element (Cmd+V / Ctrl+V).
 * @param {import('playwright').Page} page
 */
export async function paste(page) {
  await page.keyboard.press(`${MOD}+KeyV`);
}

/**
 * Returns the base BigQuery URL depending on the environment.
 * @returns {string}
 */
export function getBaseUrl() {
  if (process.env.USE_LOCAL_BIGQUERY === 'true') {
    return `file://${path.join(__dirname, 'bigquery.html')}`;
  }
  return 'https://console.cloud.google.com/bigquery';
}

/**
 * Returns the share link pattern depending on the environment.
 * @returns {RegExp}
 */
export function getShareLinkPattern() {
  return process.env.USE_LOCAL_BIGQUERY === 'true'
    ? /file:\/\/.*bigquery\.html.*\?pig=/
    : /https:\/\/console\.cloud\.google\.com\/bigquery.*\?pig=/;
}

/**
 * Get clipboard content by pasting into a temporary input element in the browser.
 * @param {import('playwright').Page} page
 * @returns {Promise<string>}
 */
export async function getClipboard(page) {
  await page.evaluate(id => {
    let input = document.getElementById(id);
    if (!input) {
      input = document.createElement('textarea');
      input.id = id;
      input.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
      document.body.appendChild(input);
    }
    input.value = '';
    input.focus();
  }, CLIPBOARD_INPUT_ID);

  await page.keyboard.press('Meta+v');

  return await page.evaluate(id => {
    const input = document.getElementById(id);
    const value = input ? input.value : '';
    input?.remove();
    return value;
  }, CLIPBOARD_INPUT_ID);
}

/**
 * Wait for clipboard to contain a specific pattern.
 * @param {import('playwright').Page} page
 * @param {RegExp|string} pattern - Pattern to match (string or regex)
 * @param {number} timeout - Timeout in milliseconds
 * @param {number} pollInterval - How often to check in milliseconds
 * @returns {Promise<string>} The clipboard content that matched
 */
export async function waitForClipboard(page, pattern, timeout = 5000, pollInterval = 100) {
  const startTime = Date.now();
  const isRegex = pattern instanceof RegExp;

  while (Date.now() - startTime < timeout) {
    const clipboard = await getClipboard(page);

    if (isRegex ? pattern.test(clipboard) : clipboard.includes(pattern)) {
      return clipboard;
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Clipboard did not match pattern within ${timeout}ms`);
}

/**
 * Generate a long SQL query for testing
 * @param {number} length - Approximate length of the query
 * @returns {string}
 */
export function generateLongQuery(length = 5000) {
  const tables = [
    {
      alias: 's',
      name: '`bigquery-public-data.samples.shakespeare`',
      cols: ['word', 'word_count', 'corpus', 'corpus_date'],
    },
    {
      alias: 'w',
      name: '`bigquery-public-data.samples.wikipedia`',
      cols: ['title', 'id', 'language', 'wp_namespace', 'is_redirect'],
    },
  ];

  let query = 'SELECT\n';
  const targetLength = length - 200; // Leave room for final clause

  while (query.length < targetLength) {
    const table = tables[Math.floor(Math.random() * tables.length)];
    const col = table.cols[Math.floor(Math.random() * table.cols.length)];
    query += `  ${table.alias}.${col},\n`;
  }

  // Remove trailing comma and newline
  query = query.slice(0, -2) + '\n';
  query += `FROM ${tables[0].name} AS ${tables[0].alias}\n`;
  query += `JOIN ${tables[1].name} AS ${tables[1].alias}\n`;
  query += `  ON ${tables[0].alias}.word = ${tables[1].alias}.title\n`;
  query += `WHERE ${tables[0].alias}.word_count > 10\n`;
  query += `ORDER BY ${tables[0].alias}.word_count DESC\n`;
  query += 'LIMIT 100;';

  return query;
}

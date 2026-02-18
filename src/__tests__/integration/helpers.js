import { chromium } from 'playwright';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execPromise = promisify(exec);

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

/**
 * Get clipboard content using pbpaste (macOS)
 * @returns {Promise<string>}
 */
export async function getClipboard() {
  const { stdout } = await execPromise('pbpaste');
  return stdout;
}

/**
 * Wait for clipboard to contain a specific pattern
 * @param {RegExp|string} pattern - Pattern to match (string or regex)
 * @param {number} timeout - Timeout in milliseconds
 * @param {number} pollInterval - How often to check in milliseconds
 * @returns {Promise<string>} The clipboard content that matched
 */
export async function waitForClipboard(pattern, timeout = 5000, pollInterval = 100) {
  const startTime = Date.now();
  const isRegex = pattern instanceof RegExp;

  while (Date.now() - startTime < timeout) {
    const clipboard = await getClipboard();

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

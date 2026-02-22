import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VIDEOS_DIR = path.join(process.cwd(), 'test-videos');

const ANSI = { reset: '\x1b[0m', gray: '\x1b[90m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m' };
const CONSOLE_COLORS = { warning: ANSI.yellow, error: ANSI.red, debug: ANSI.gray };

function forwardConsoleLogs(p) {
  p.on('console', msg => {
    const color = CONSOLE_COLORS[msg.type()] ?? ANSI.cyan;
    process.stdout.write(`${color}[Browser] ${msg.text()}${ANSI.reset}\n`);
  });
}

function getChromeBin() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  if (process.env.CI === 'true') return chromium.executablePath();
  if (process.platform === 'darwin') return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  return 'google-chrome-stable';
}

async function waitForCDP(url, timeout = 15000, getError = () => null) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    const spawnError = getError();
    if (spawnError) throw new Error(`Chrome failed to start: ${spawnError.message}`);
    try {
      return await chromium.connectOverCDP(url);
    } catch (err) {
      lastError = err;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  throw new Error(`CDP not available at ${url} after ${timeout}ms: ${lastError?.message}`);
}

let chromeProcess = null;
let browser = null;
let page = null;
let swLogPollingInterval = null;

async function injectWorkerLogCapture(worker) {
  try {
    await worker.evaluate(() => {
      if (self.__pw_log_capture_installed) return;
      self.__pw_log_capture_installed = true;
      self.__pw_logs = [];
      const capture =
        type =>
        (...args) =>
          self.__pw_logs.push({
            type,
            text: args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '),
          });
      console.log = capture('log');
      console.warn = capture('warn');
      console.error = capture('error');
      console.debug = capture('debug');
    });
  } catch {
    // Worker may not be accessible yet
  }
}

function forwardServiceWorkerLogs(context) {
  const attachWorker = worker => {
    process.stdout.write(`${ANSI.gray}[Worker] Service worker registered: ${worker.url()}${ANSI.reset}\n`);
    injectWorkerLogCapture(worker);
  };

  context.serviceWorkers().forEach(attachWorker);
  context.on('serviceworker', attachWorker);

  swLogPollingInterval = setInterval(async () => {
    for (const worker of context.serviceWorkers()) {
      try {
        const logs = await worker.evaluate(() => {
          const captured = self.__pw_logs ?? [];
          self.__pw_logs = [];
          return captured;
        });
        for (const { type, text } of logs) {
          const color = type === 'error' ? ANSI.red : type === 'warn' ? ANSI.yellow : ANSI.gray;
          process.stdout.write(`${color}[Worker] ${text}${ANSI.reset}\n`);
        }
      } catch {
        // Worker may be dormant or inaccessible
      }
    }
  }, 500);
}

/**
 * Start Chrome and connect.
 * CI: uses chromium.launchPersistentContext (extension loading without developer mode).
 * Non-CI: spawns system Chrome and connects via CDP.
 * @param {string} url - Initial URL to open
 * @returns {Promise<{browser: import('playwright').BrowserContext|import('playwright').Browser, page: import('playwright').Page, chromeProcess: import('child_process').ChildProcess|null}>}
 */
export async function startChrome(url, { recordVideo = true } = {}) {
  const isCI = process.env.CI === 'true';

  if (!url && isCI) {
    const localPath = path.join(__dirname, 'bigquery.html');
    url = `file://${localPath}`;
  } else if (!url) {
    url = 'https://console.cloud.google.com/bigquery';
  }

  const profileDir = isCI
    ? path.join(os.tmpdir(), `pigquery-test-profile-${process.pid}`)
    : path.join(__dirname, '..', '..', '..', 'profile');

  const extensionDir = path.join(__dirname, '..', '..', '..', 'build', 'dev');

  if (isCI) {
    fs.mkdirSync(path.join(profileDir, 'Default'), { recursive: true });
    fs.writeFileSync(
      path.join(profileDir, 'Default', 'Preferences'),
      JSON.stringify({ translate: { enabled: false } })
    );

    if (recordVideo) {
      fs.rmSync(VIDEOS_DIR, { recursive: true, force: true });
      fs.mkdirSync(VIDEOS_DIR, { recursive: true });
    }

    const context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      ...(recordVideo && {
        recordVideo: {
          dir: VIDEOS_DIR,
          size: { width: 1280, height: 800 },
        },
      }),
      args: [
        `--disable-extensions-except=${extensionDir}`,
        `--load-extension=${extensionDir}`,
        '--window-size=1280,800',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-sync',
        '--disable-features=IdentityConsistency',
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
      ],
    });

    // Chrome 122+ blocks unpacked extensions unless developer mode is enabled.
    // Navigate to chrome://extensions and toggle developer mode on before
    // opening the target page so content scripts are injected correctly.
    const extPage = await context.newPage();
    await extPage.goto('chrome://extensions/');
    await extPage.waitForTimeout(1000);
    const toggle = extPage.locator('#devMode');
    await toggle.waitFor({ state: 'visible', timeout: 5000 });
    const isEnabled = await toggle.evaluate(el => el.checked);
    if (!isEnabled) {
      await toggle.click();
      await extPage.waitForTimeout(1000);
      const isNowEnabled = await toggle.evaluate(el => el.checked);
      if (!isNowEnabled) {
        throw new Error('Developer mode toggle did not become checked after click');
      }
    }
    await extPage.waitForTimeout(1000);
    try {
      await extPage.evaluate(
        () =>
          new Promise(resolve => {
            // eslint-disable-next-line no-undef
            chrome.developerPrivate.getExtensionsInfo({}, extensions => {
              const ext = extensions.find(e => e.location === 'UNPACKED');
              if (!ext) return resolve();
              // eslint-disable-next-line no-undef
              chrome.developerPrivate.updateExtensionConfiguration(
                { extensionId: ext.id, pinnedToToolbar: true },
                resolve
              );
            });
          })
      );
    } catch {
      // API not accessible – extension stays unpinned.
    }
    await extPage.close();

    const pages = context.pages();
    page = pages.length > 0 ? pages[0] : await context.newPage();
    forwardConsoleLogs(page);
    await page.goto(url);
    await page.waitForTimeout(1000);
    await page.bringToFront();
    await page.evaluate(() => window.focus());
    browser = context;
    chromeProcess = null;

    forwardServiceWorkerLogs(context);

    return { browser: context, page, chromeProcess: null };
  }

  // Non-CI: spawn system Chrome and connect via CDP
  const chromeArgs = [
    '--remote-debugging-port=9222',
    `--user-data-dir=${profileDir}`,
    '--window-size=1280,800',
    `--load-extension=${extensionDir}`,
    '--enable-extensions',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-sync',
    '--disable-features=IdentityConsistency',
    url,
  ];

  chromeProcess = spawn(getChromeBin(), chromeArgs, {
    detached: false,
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  let spawnError = null;
  chromeProcess.on('error', err => {
    spawnError = err;
  });
  const CHROME_STDERR_NOISE = ['DEPRECATED_ENDPOINT', 'registration_request', 'QUOTA_EXCEEDED'];
  chromeProcess.stderr.on('data', data => {
    const msg = data.toString();
    if ((msg.includes('ERROR') || msg.includes('FATAL')) && !CHROME_STDERR_NOISE.some(s => msg.includes(s))) {
      process.stderr.write(`${ANSI.red}[Chrome stderr] ${msg.trim()}${ANSI.reset}\n`);
    }
  });

  browser = await waitForCDP('http://127.0.0.1:9222', 15000, () => spawnError);
  const defaultContext = browser.contexts()[0];
  page = defaultContext.pages()[0];
  forwardConsoleLogs(page);
  forwardServiceWorkerLogs(defaultContext);

  return { browser, page, chromeProcess };
}

/**
 * Stop Chrome and clean up
 */
export async function stopChrome() {
  if (swLogPollingInterval) {
    clearInterval(swLogPollingInterval);
    swLogPollingInterval = null;
  }

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
  const editor = await page.waitForSelector('cfc-code-editor textarea', { state: 'visible', timeout });
  await page.waitForFunction(() => !!document.getElementById('pig-highlight-style'), { timeout });
  return editor;
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
 * Asserts that the current editor content matches the expected value,
 * retrying until the content matches or the timeout is reached.
 * @param {import('playwright').Page} page
 * @param {string|RegExp} expected
 * @param {number} timeout - Timeout in milliseconds
 * @param {number} pollInterval - How often to retry in milliseconds
 */
export async function assertEditorContent(page, expected, timeout = 5000, pollInterval = 500) {
  const editor = await waitForBigQueryEditor(page);
  const startTime = Date.now();
  const matches = content => (expected instanceof RegExp ? expected.test(content) : content === expected);
  let lastContent = '';

  while (Date.now() - startTime < timeout) {
    await editor.focus();
    await selectAll(page);
    await copy(page);
    lastContent = await getClipboard(page);

    if (matches(lastContent)) return;

    await page.waitForTimeout(pollInterval);
  }

  const preview = lastContent.length > 200 ? lastContent.slice(0, 200) + '…' : lastContent;
  throw new Error(
    `Editor content did not match within ${timeout}ms\n` +
      `  Expected: ${expected}\n` +
      `  Received: ${JSON.stringify(preview)}`
  );
}

/**
 * Returns the base BigQuery URL depending on the environment.
 * @returns {string}
 */
export function getBaseUrl() {
  if (process.env.CI === 'true') {
    return `file://${path.join(__dirname, 'bigquery.html')}`;
  }
  return 'https://console.cloud.google.com/bigquery';
}

/**
 * Returns the share link pattern depending on the environment.
 * @returns {RegExp}
 */
export function getShareLinkPattern() {
  return process.env.CI === 'true'
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

  await page.keyboard.press(`${MOD}+v`);

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
  let lastClipboard = '';

  while (Date.now() - startTime < timeout) {
    lastClipboard = await getClipboard(page);

    if (isRegex ? pattern.test(lastClipboard) : lastClipboard.includes(pattern)) {
      return lastClipboard;
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  const preview = lastClipboard.length > 200 ? lastClipboard.slice(0, 200) + '…' : lastClipboard;
  throw new Error(
    `Clipboard did not match pattern within ${timeout}ms\n` +
      `  Expected: ${pattern}\n` +
      `  Received: ${JSON.stringify(preview)}`
  );
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

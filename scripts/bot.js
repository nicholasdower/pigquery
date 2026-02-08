const { chromium } = require('playwright');
const { spawn, exec } = require('child_process');
const path = require('path');
const util = require('util');

const execPromise = util.promisify(exec);

async function startChrome(url) {
  const profileDir = path.join(__dirname, '..', 'profile');
  console.log('Starting Chrome with remote debugging...');
  const chromeProcess = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--remote-debugging-port=9222',
    `--user-data-dir=${profileDir}`,
    '--window-size=1280,800',
    url
  ], {
    detached: false,
    stdio: 'ignore'
  });

  console.log('Waiting for Chrome to start...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  chromeProcess.on('exit', () => process.exit(0));

  return chromeProcess;
}

async function connectToChrome() {
  console.log('Connecting to Chrome...');
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const defaultContext = browser.contexts()[0];
  const page = defaultContext.pages()[0];
  return [browser, page];
}

async function screenshot(filename) {
  await execPromise(`osascript -e 'tell application "Google Chrome" to activate'`);
  await new Promise(resolve => setTimeout(resolve, 300));
  const { stdout } = await execPromise(`osascript -e 'tell application "Google Chrome" to get bounds of window 1'`);
  const [x1, y1, x2, y2] = stdout.trim().split(', ').map(Number);
  await execPromise(`screencapture -x -R${x1},${y1},${x2 - x1},${y2 - y1} ${filename}`);
}

async function openAction() {
  await startChrome('https://console.cloud.google.com/bigquery');
  await connectToChrome();
}

async function recordAction() {
  const chromeProcess = await startChrome('https://console.cloud.google.com/bigquery');
  const [browser, page] = await connectToChrome();

  await page.waitForSelector('.view-lines', { timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.click('.view-lines');
  await page.keyboard.press('Control+Shift+KeyY');
  await page.waitForSelector('.pig-modal', { timeout: 5000 });
  await page.waitForTimeout(1000);

  // Click settings icon to open options page
  await page.click('.pig-modal-settings');
  await page.waitForTimeout(1000);

  // Get the new options tab
  const context = browser.contexts()[0];
  const pages = context.pages();
  const optionsPage = pages[pages.length - 1];

  // Remove all existing sources
  await optionsPage.waitForSelector('#urlInput', { timeout: 5000 });
  while (await optionsPage.$('.remove-btn')) {
    await optionsPage.click('.remove-btn');
    await optionsPage.waitForTimeout(300);
  }

  // Take a screenshot of empty options
  await screenshot('screenshots/pigquery-1.png');

  // Enter URL in the input and press Enter
  await optionsPage.fill('#urlInput', 'https://raw.githubusercontent.com/nicholasdower/pigquery/refs/heads/master/samples/samples.yaml');
  await optionsPage.press('#urlInput', 'Enter');

  // Wait for source card to appear
  await optionsPage.waitForSelector('.source-card', { timeout: 10000 });
  await optionsPage.waitForTimeout(500);

  // Close the options tab to return to BigQuery
  await optionsPage.close();
  await page.waitForTimeout(500);

  // Verify pig-modal-item exists
  await page.waitForSelector('.pig-modal-item', { timeout: 5000 });

  // Focus the input and type "query", wait for list to update
  await page.click('.pig-modal-input');
  await page.keyboard.type('query');
  await page.waitForTimeout(1000);

  await screenshot('screenshots/pigquery-2.png');

  chromeProcess.kill('SIGTERM');
}

async function main() {
  const action = process.argv[2];

  switch (action) {
    case 'open':
      await openAction();
      break;
    case 'record':
      await recordAction();
      break;
    default:
      console.error('Unknown action:', action);
      console.log('Usage: node record-demo.js [open|record]');
      console.log('  open   - Open Chrome with BigQuery');
      console.log('  record - Record a demo (default)');
      process.exit(1);
  }
}

main().catch(console.error);

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
  return page;
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
  const page = await connectToChrome();

  await page.waitForSelector('.view-lines', { timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.click('.view-lines');
  await page.keyboard.press('Control+Shift+KeyY');
  await page.waitForSelector('.pig-modal', { timeout: 5000 });
  await page.waitForTimeout(1000);
  await screenshot('screenshots/bigquery-demo.png');

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

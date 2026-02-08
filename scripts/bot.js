const { chromium } = require('playwright');
const { spawn, exec } = require('child_process');
const path = require('path');
const util = require('util');

const execPromise = util.promisify(exec);

async function startChrome(profileDir, url = 'https://console.cloud.google.com/bigquery') {
  console.log('Starting Chrome with remote debugging...');
  const chromeProcess = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--remote-debugging-port=9222',
    `--user-data-dir=${profileDir}`,
    url
  ], {
    detached: false,
    stdio: 'ignore'
  });

  console.log('Waiting for Chrome to start...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  return chromeProcess;
}

async function openAction() {
  const profileDir = path.join(__dirname, '..', 'profile');
  await startChrome(profileDir);
  console.log('Chrome is running. Press Ctrl+C to close.');
}

async function recordAction() {
  const profileDir = path.join(__dirname, '..', 'profile');
  const chromeProcess = await startChrome(profileDir);

  console.log('Connecting to Chrome...');
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const defaultContext = browser.contexts()[0];
  
  // Use the existing BigQuery page
  const page = defaultContext.pages()[0];

  // Set viewport size
  await page.setViewportSize({ width: 1920, height: 1080 });

  console.log('Waiting for editor to load...');
  // Wait for the SQL editor textarea/contenteditable to be visible
  await page.waitForSelector('.view-lines', { timeout: 30000 });

  // Give it a moment to fully render
  await page.waitForTimeout(2000);

  console.log('Clicking into editor...');
  await page.click('.view-lines');

  console.log('Pressing Ctrl+Shift+Y...');
  await page.keyboard.press('Control+Shift+KeyY');

  // Wait a bit to capture the result
  await page.waitForTimeout(3000);

  console.log('Taking screenshot...');
  await page.screenshot({ path: 'screenshots/bigquery-demo.png', fullPage: true });

  console.log('Closing Chrome...');
  await browser.close();
  
  // Kill the Chrome process
  chromeProcess.kill('SIGTERM');
  
  // Wait a moment and force kill if still running
  await new Promise(resolve => setTimeout(resolve, 1000));
  try {
    chromeProcess.kill('SIGKILL');
  } catch (e) {
    // Process already dead, that's fine
  }

  console.log('Done! Screenshot saved to screenshots/bigquery-demo.png');
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

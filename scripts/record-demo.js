const { chromium } = require('playwright');

async function recordDemo() {
  console.log('Instructions:');
  console.log('1. First, start Chrome with remote debugging:');
  console.log('   /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222');
  console.log('2. Then run this script');
  console.log('');
  console.log('Connecting to Chrome...');

  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const defaultContext = browser.contexts()[0];
  const page = await defaultContext.newPage();

  // Set viewport size
  await page.setViewportSize({ width: 1920, height: 1080 });

  console.log('Navigating to BigQuery...');
  await page.goto('https://console.cloud.google.com/bigquery');

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

  console.log('Closing page...');
  await page.close();

  console.log('Done! Screenshot saved (leave Chrome running if you want)');
}

recordDemo().catch(console.error);

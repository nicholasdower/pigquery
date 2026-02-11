const { chromium } = require('playwright');
const { spawn, exec } = require('child_process');
const path = require('path');
const util = require('util');

const execPromise = util.promisify(exec);

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { action: null, lang: 'en' };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--lang' && args[i + 1]) {
      result.lang = args[++i];
    } else if (!args[i].startsWith('-')) {
      result.action = args[i];
    }
  }

  return result;
}

function getBigQueryUrl(lang) {
  const base = 'https://console.cloud.google.com/bigquery';
  return lang ? `${base}?hl=${lang}` : base;
}

async function startChrome(url) {
  console.log('Starting Chrome with remote debugging...');
  const profileDir = path.join(__dirname, '..', 'profile');
  const chromeProcess = spawn(
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ['--remote-debugging-port=9222', `--user-data-dir=${profileDir}`, '--window-size=1280,800', url],
    {
      detached: false,
      stdio: 'ignore',
    }
  );

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
  await execPromise('osascript -e \'tell application "Google Chrome" to activate\'');
  await new Promise(resolve => setTimeout(resolve, 300));
  const { stdout } = await execPromise('osascript -e \'tell application "Google Chrome" to get bounds of window 1\'');
  const [x1, y1, x2, y2] = stdout.trim().split(', ').map(Number);
  await execPromise(`screencapture -x -R${x1},${y1},${x2 - x1},${y2 - y1} ${filename}`);
  // Resize to logical pixels (half of Retina resolution)
  await execPromise(`sips -Z ${x2 - x1} ${filename}`);
}

async function getChromeBounds() {
  const { stdout } = await execPromise('osascript -e \'tell application "Google Chrome" to get bounds of window 1\'');
  const [x1, y1, x2, y2] = stdout.trim().split(', ').map(Number);
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

async function startVideoRecording(filename) {
  await execPromise('osascript -e \'tell application "Google Chrome" to activate\'');
  await new Promise(resolve => setTimeout(resolve, 300));
  const { x, y, width, height } = await getChromeBounds();

  const screencapture = spawn('screencapture', ['-v', '-R', `${x},${y},${width},${height}`, filename], {
    stdio: ['pipe', 'ignore', 'ignore'],
  });

  await new Promise(resolve => setTimeout(resolve, 500));
  return screencapture;
}

async function stopVideoRecording(screencaptureProcess) {
  screencaptureProcess.kill('SIGINT');
  await new Promise(resolve => screencaptureProcess.on('close', resolve));
}

async function openAction(lang) {
  await startChrome(getBigQueryUrl(lang));
  await connectToChrome();
}

async function recordAction(lang) {
  const chromeProcess = await startChrome(getBigQueryUrl(lang));
  const [browser, page] = await connectToChrome();

  await page.waitForSelector('.view-lines', { timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.click('.view-lines');
  await page.keyboard.press('Control+Shift+KeyY');
  await page.waitForSelector('.pig-modal', { timeout: 5000 });
  await page.waitForTimeout(1000);

  // Click settings icon to open options page
  await page.keyboard.press('Tab');
  await page.waitForTimeout(1000);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(1000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);

  // Get the new options tab
  const context = browser.contexts()[0];
  let pages = context.pages();
  let optionsPage = pages[pages.length - 1];

  // Remove all existing sources
  await optionsPage.waitForSelector('#urlInput', { timeout: 5000 });
  while (await optionsPage.$('.remove-btn')) {
    await optionsPage.click('.remove-btn');
    await optionsPage.waitForTimeout(1000);
  }

  // Close options and dismiss modal before recording
  await optionsPage.close();
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Start video recording
  console.log('Starting video recording...');
  const videoPath = `store/${lang}/demo.mp4`;
  await execPromise(`rm -f ${videoPath}`);
  const ffmpegProcess = await startVideoRecording(videoPath);
  await page.waitForTimeout(2000);

  // Enter query into the editor
  await page.keyboard.type('select\ns.word, sum(s.word_count) as count, max(w.timestamp) as timestamp\nfrom ', {
    delay: 100,
  });
  await page.waitForTimeout(500);

  // Open the modal again
  await page.keyboard.press('Control+Shift+KeyY');
  await page.waitForSelector('.pig-modal', { timeout: 5000 });
  await page.waitForTimeout(3000);

  // Click settings icon to open options page
  await page.keyboard.press('Tab');
  await page.waitForTimeout(1000);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(1000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);

  // Get the new options tab
  pages = context.pages();
  optionsPage = pages[pages.length - 1];

  // Take a screenshot of empty options
  await optionsPage.waitForSelector('#urlInput', { timeout: 5000 });
  await screenshot(`store/${lang}/pigquery-1.png`);

  // Tab to focus the URL input
  // eslint-disable-next-line no-undef
  while (!(await optionsPage.evaluate(() => document.activeElement?.id === 'urlInput'))) {
    await optionsPage.keyboard.press('Tab');
    await optionsPage.waitForTimeout(300);
  }

  // Enter URL in the input and press Enter
  await optionsPage.fill(
    '#urlInput',
    'https://raw.githubusercontent.com/nicholasdower/pigquery/refs/heads/master/samples/samples.yaml'
  );
  await page.waitForTimeout(500);
  await optionsPage.keyboard.press('Enter');

  // Wait for source card to appear
  await optionsPage.waitForSelector('.source-card', { timeout: 10000 });
  await optionsPage.waitForTimeout(3000);

  // Close the options tab to return to BigQuery
  await optionsPage.close();
  await page.waitForTimeout(2000);

  // Type "shake" to filter results, then press down until we find "shakespeare"
  await page.click('.pig-modal-input');
  await page.type('.pig-modal-input', 'shake', { delay: 100 });
  await page.waitForTimeout(500);
  while (true) {
    await page.waitForTimeout(500);
    const activeText = await page.$eval('.pig-modal-item.active .pig-modal-item-name', el => el.textContent);
    if (activeText === 'shakespeare') break;
    await page.keyboard.press('ArrowDown');
  }

  // Click the item with name "shakespeare"
  await page.waitForTimeout(1000);
  await page.click('.pig-modal-item-name:has-text("shakespeare")');
  await page.waitForTimeout(1000);

  // Complete query into the editor
  await page.keyboard.type('\njoin ', { delay: 100 });
  await page.waitForTimeout(500);

  // Open the modal again
  await page.keyboard.press('Control+Shift+KeyY');
  await page.waitForSelector('.pig-modal', { timeout: 5000 });
  await page.waitForTimeout(1000);

  // Type "join" to filter results, then press down until we find "wikipedia to shakespeare"
  await page.click('.pig-modal-input');
  await page.type('.pig-modal-input', 'join', { delay: 100 });
  while (true) {
    await page.waitForTimeout(500);
    const activeText = await page.$eval('.pig-modal-item.active .pig-modal-item-name', el => el.textContent);
    if (activeText === 'wikipedia to shakespeare') break;
    await page.keyboard.press('ArrowDown');
  }

  await screenshot(`store/${lang}/pigquery-2.png`);

  // Click the item with name "wikipedia to shakespeare"
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);

  // Complete query into the editor
  await page.keyboard.type('\ngroup by s.word order by 2 desc limit 10;', { delay: 100 });
  await page.waitForTimeout(500);

  // Run the query with command+enter
  await page.keyboard.press('Meta+Enter');

  // Wait for results table to appear
  await page.waitForSelector('bq-results-table-optimized', { timeout: 30000 });
  await page.waitForTimeout(1000);

  // Focus the table with ctrl+shift+u
  await page.keyboard.press('Control+Shift+KeyU');
  await page.waitForTimeout(1000);

  // Hit right arrow twice to change focused cell
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);

  // Hit enter to open the snippets modal
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);

  await screenshot(`store/${lang}/pigquery-3.png`);

  // Scroll down the content pane
  await page.keyboard.press('Alt+ArrowDown');
  await page.waitForTimeout(1000);

  // Hit escape to return to results then open the modal again
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(300);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(300);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(300);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(300);
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(300);
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);

  // Type "wiki" to filter snippets then go to Wikipedia
  await page.type('.pig-modal-input', 'wiki', { delay: 100 });
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);

  // Get the new tab and close it
  pages = context.pages();
  const wikiPage = pages[pages.length - 1];
  await wikiPage.close();
  await page.waitForTimeout(3000);

  // Copy the share link
  await page.keyboard.press('Control+Shift+KeyU');
  await page.waitForTimeout(1000);
  await page.keyboard.press('Meta+a');
  await page.waitForTimeout(3000);

  // Open new tab via AppleScript (Cmd+T focuses address bar automatically)
  await execPromise('osascript -e \'tell application "System Events" to keystroke "t" using command down\'');
  await page.waitForTimeout(1000);

  // Paste URL from clipboard
  await execPromise('osascript -e \'tell application "System Events" to keystroke "v" using command down\'');
  await page.waitForTimeout(1000);

  // Go to beginning of URL
  await execPromise('osascript -e \'tell application "System Events" to key code 123 using command down\''); // Cmd+Left
  await page.waitForTimeout(2000);

  // Navigate
  await execPromise('osascript -e \'tell application "System Events" to key code 36\''); // Enter key

  // Get the new page
  pages = context.pages();
  const newPage = pages[pages.length - 1];

  // Wait for BigQuery to load
  await newPage.waitForSelector('.view-lines', { timeout: 30000 });
  await newPage.waitForTimeout(1000);
  await newPage.click('.view-lines');

  // Run the query
  await newPage.keyboard.press('Meta+Enter');

  // Wait for results
  await newPage.waitForSelector('bq-results-table-optimized', { timeout: 30000 });
  await newPage.waitForTimeout(3000);

  console.log('Stopping video recording...');
  await stopVideoRecording(ffmpegProcess);

  chromeProcess.kill('SIGTERM');
}

async function main() {
  const { action, lang } = parseArgs();

  switch (action) {
  case 'open':
    await openAction(lang);
    break;
  case 'record':
    await recordAction(lang);
    break;
  default:
    console.error('Unknown action:', action);
    console.log('Usage: node bot.js [open|record] [--lang <code>]');
    console.log('  open   - Open Chrome with BigQuery');
    console.log('  record - Record a demo video and take screenshots');
    console.log('  --lang - Set the language (e.g., de, en)');
    process.exit(1);
  }
}

main().catch(console.error);

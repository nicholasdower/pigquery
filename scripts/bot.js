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
  const chromeProcess = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--remote-debugging-port=9222',
    `--user-data-dir=${profileDir}`,
    '--window-size=1280,800',
    url
  ], {
    detached: false,
    stdio: "ignore",
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

async function getChromeBounds() {
  const { stdout } = await execPromise(`osascript -e 'tell application "Google Chrome" to get bounds of window 1'`);
  const [x1, y1, x2, y2] = stdout.trim().split(', ').map(Number);
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

async function startVideoRecording(filename) {
  await execPromise(`osascript -e 'tell application "Google Chrome" to activate'`);
  await new Promise(resolve => setTimeout(resolve, 300));
  const { x, y, width, height } = await getChromeBounds();

  // Ensure dimensions are even (required by ffmpeg)
  const w = width % 2 === 0 ? width : width - 1;
  const h = height % 2 === 0 ? height : height - 1;

  const ffmpeg = spawn('ffmpeg', [
    '-f', 'avfoundation',
    '-capture_cursor', '1',
    '-framerate', '30',
    '-i', '1:none',  // Screen capture, no audio
    '-vf', `crop=${w}:${h}:${x}:${y}`,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-pix_fmt', 'yuv420p',
    '-y',
    filename
  ], {
    stdio: ['pipe', 'ignore', 'ignore']
  });

  await new Promise(resolve => setTimeout(resolve, 500));
  return ffmpeg;
}

async function stopVideoRecording(ffmpegProcess) {
  ffmpegProcess.stdin.write('q');
  await new Promise(resolve => ffmpegProcess.on('close', resolve));
}

async function openAction(lang) {
  await startChrome(getBigQueryUrl(lang));
  await connectToChrome();
}

async function recordAction(lang) {
  const chromeProcess = await startChrome(getBigQueryUrl(lang));
  const [browser, page] = await connectToChrome();

  console.log('Starting video recording...');
  const ffmpegProcess = await startVideoRecording(`store/${lang}/demo.mp4`);

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
  await screenshot(`store/${lang}/pigquery-1.png`);

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

  // Press down until we find "shakespeare words in wikipedia"
  await page.click('.pig-modal-input');
  while (true) {
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);
    const activeText = await page.$eval('.pig-modal-item.active .pig-modal-item-name', el => el.textContent);
    if (activeText === 'shakespeare words in wikipedia') break;
  }

  await screenshot(`store/${lang}/pigquery-2.png`);

  // Clear and type "formatter demo"
  await page.fill('.pig-modal-input', 'formatter demo');
  await page.waitForTimeout(500);

  // Click the item with name "formatter demo"
  await page.click('.pig-modal-item-name:has-text("formatter demo")');
  await page.waitForTimeout(500);

  // Run the query with command+enter
  await page.keyboard.press('Meta+Enter');

  // Wait for results table to appear
  await page.waitForSelector('bq-results-table-optimized', { timeout: 30000 });
  await page.waitForTimeout(1000);

  // Focus the table with ctrl+shift+u
  await page.keyboard.press('Control+Shift+KeyU');
  await page.waitForTimeout(500);

  // Hit right arrow twice to change focused cell
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);

  // Hit enter to open the snippets modal
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);

  await screenshot(`screenshots/${lang}/pigquery-3.png`);

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

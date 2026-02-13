#!/usr/bin/env node
import fs from 'fs';
import { execSync } from 'child_process';

const buildDir = 'build/prod';

if (!fs.existsSync(buildDir)) {
  console.error(`❌ Build directory not found: ${buildDir}`);
  console.error('   Run "npm run build:prod" first');
  process.exit(1);
}

console.log('\n🔑 Signing extension...');

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf-8'));
const version = manifest.version;
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const keyPath = 'privatekey';

if (!fs.existsSync(keyPath)) {
  console.warn('⚠️  Private key not found at ./privatekey - skipping signing');
  console.log('   Extension is ready at: ' + buildDir);
  process.exit(0);
}

try {
  execSync(
    `"${chromePath}" --pack-extension="${process.cwd()}/${buildDir}" --pack-extension-key="${process.cwd()}/${keyPath}"`,
    { stdio: 'inherit' }
  );

  const crxName = `pigquery-${version}.crx`;
  if (!fs.existsSync(`${buildDir}.crx`)) {
    console.error(`❌ Extension not found: ${crxName}`);
    process.exit(1);
  }
  fs.renameSync(`${buildDir}.crx`, crxName);
  console.log(`✓ Extension signed: ${crxName}`);
} catch (error) {
  console.error('Failed to sign extension:', error.message);
  process.exit(1);
}

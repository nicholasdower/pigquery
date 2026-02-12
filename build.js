#!/usr/bin/env node
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const distDir = 'dist';
const shouldPackage = process.argv.includes('--package');

// Plugin to import CSS as string
const cssTextPlugin = {
  name: 'css-text',
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async args => {
      const css = await fs.promises.readFile(args.path, 'utf8');
      return {
        contents: `export default ${JSON.stringify(css)}`,
        loader: 'js',
      };
    });
  },
};

// Clean and create dist directory
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
}
fs.mkdirSync(distDir, { recursive: true });

// Build configuration
const buildOptions = {
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  sourcemap: process.env.NODE_ENV !== 'production',
  minify: process.env.NODE_ENV === 'production',
  logLevel: 'info',
};

function copyFile(src, dest) {
  fs.copyFileSync(src, dest);
  console.log(`✓ Copied ${src} -> ${dest}`);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}


async function build() {
  try {
    // Build content script
    await esbuild.build({
      ...buildOptions,
      entryPoints: ['src/content.js'],
      outfile: `${distDir}/content.js`,
      external: ['chrome'],
      plugins: [cssTextPlugin],
    });

    // Build popup script
    await esbuild.build({
      ...buildOptions,
      entryPoints: ['src/popup.js'],
      outfile: `${distDir}/popup.js`,
      external: ['chrome'],
    });

    // Build options script
    await esbuild.build({
      ...buildOptions,
      entryPoints: ['src/options.js'],
      outfile: `${distDir}/options.js`,
      external: ['chrome'],
    });

    // Build background service worker
    await esbuild.build({
      ...buildOptions,
      entryPoints: ['src/background.js'],
      outfile: `${distDir}/background.js`,
      external: ['chrome'],
    });

    // Copy HTML files
    copyFile('src/popup.html', `${distDir}/popup.html`);
    copyFile('src/options.html', `${distDir}/options.html`);

    console.log('✓ Build completed successfully');

    // Package and sign if requested
    if (shouldPackage) {
      await packageExtension();
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

async function packageExtension() {
  console.log('\n📦 Packaging extension...');

  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf-8'));
  const version = manifest.version;
  const commit = execSync('git rev-parse HEAD').toString().trim();
  const packageDir = `package/pigquery-${version}`;

  console.log(`Version: ${version} (${commit})`);

  // Clean and create package directory
  if (fs.existsSync('package')) {
    fs.rmSync('package', { recursive: true });
  }
  fs.mkdirSync(packageDir, { recursive: true });

  // Copy built files
  copyDir(distDir, `${packageDir}/dist`);

  // Copy icons (prod version)
  copyDir('icons-prod', `${packageDir}/icons`);

  // Copy locales
  copyDir('_locales', `${packageDir}/_locales`);

  // Copy LICENSE
  copyFile('LICENSE.txt', `${packageDir}/LICENSE.txt`);

  // Create modified manifest (remove dev-only permissions)
  const prodManifest = { ...manifest };
  if (prodManifest.permissions) {
    prodManifest.permissions = prodManifest.permissions.filter(
      p => p !== 'management' && p !== 'tabs' && p !== 'scripting'
    );
  }
  fs.writeFileSync(
    `${packageDir}/manifest.json`,
    JSON.stringify(prodManifest, null, 2)
  );
  console.log('✓ Created manifest.json (removed dev-only permissions)');

  // Save commit hash
  fs.writeFileSync(`${packageDir}/commit.txt`, commit);

  // Sign the extension
  console.log('\n🔑 Signing extension...');
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const keyPath = 'privatekey';

  if (!fs.existsSync(keyPath)) {
    console.warn('⚠️  Private key not found at ./privatekey - skipping signing');
    console.log('✓ Package created (unsigned)');
    return;
  }

  try {
    execSync(
      `"${chromePath}" --pack-extension="${process.cwd()}/${packageDir}" --pack-extension-key="${process.cwd()}/${keyPath}"`,
      { stdio: 'inherit' }
    );
    console.log(`✓ Package signed: package/pigquery-${version}.crx`);
  } catch (error) {
    console.error('Failed to sign extension:', error.message);
    process.exit(1);
  }
}

build();

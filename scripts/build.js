#!/usr/bin/env node
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const nodeEnv = process.env.NODE_ENV;
if (!nodeEnv || (nodeEnv !== 'prod' && nodeEnv !== 'dev')) {
  throw new Error('NODE_ENV must be set to either "prod" or "dev"');
}
const isProd = nodeEnv === 'prod';
const buildDir = `build/${nodeEnv}`;

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

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

// Clean and create build directory
if (fs.existsSync(buildDir)) {
  fs.rmSync(buildDir, { recursive: true });
}
fs.mkdirSync(buildDir, { recursive: true });

// Build configuration
const buildOptions = {
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  sourcemap: true,
  minify: false,
  logLevel: 'info',
  define: {
    'process.env.NODE_ENV': JSON.stringify(nodeEnv),
    '__BUILD_DATE__': JSON.stringify(new Date().toISOString()),
    '__BUILD_VERSION__': JSON.stringify(manifest.version),
    '__BUILD_COMMIT__': JSON.stringify(execSync('git rev-parse HEAD').toString().trim()),
  },
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
    console.log(`\n🔨 Building extension (${nodeEnv})...`);

    // Create dist subdirectory
    const distDir = `${buildDir}/dist`;
    fs.mkdirSync(distDir, { recursive: true });

    // Build pigquery script
    await esbuild.build({
      ...buildOptions,
      entryPoints: ['src/pigquery.js'],
      outfile: `${distDir}/pigquery.js`,
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

    // Copy icons (use prod icons for prod build, dev icons otherwise)
    const iconsDir = isProd ? 'icons-prod' : 'icons';
    copyDir(iconsDir, `${buildDir}/icons`);

    // Copy locales
    copyDir('_locales', `${buildDir}/_locales`);

    // Copy LICENSE
    copyFile('LICENSE.txt', `${buildDir}/LICENSE.txt`);

    // Copy and modify manifest
    const manifestPath = `${buildDir}/manifest.json`;
    copyFile('manifest.json', manifestPath);

    // Remove file:/// permission for prod builds
    if (isProd) {
      manifest.host_permissions = manifest.host_permissions.filter(perm => !perm.startsWith('file:///'));
      // Remove file:/// and raw.githubusercontent.com from web_accessible_resources
      manifest.web_accessible_resources.forEach(resource => {
        resource.matches = resource.matches.filter(
          match => !match.startsWith('file:///') && match !== 'https://raw.githubusercontent.com/*'
        );
      });
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
      console.log('✓ Removed file:/// and raw.githubusercontent.com permissions for prod build');
    }

    console.log(`✓ Build completed successfully: ${buildDir}`);
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();

#!/usr/bin/env node
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const distDir = 'dist';

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

function updateHtmlScriptPaths(htmlPath, outputPath, scriptName) {
  let html = fs.readFileSync(htmlPath, 'utf-8');
  // Remove lib script tags
  html = html.replace(/<script src="\.\.\/lib\/js-yaml\.min\.js"><\/script>\s*/g, '');
  // Remove individual module script tags (i18n.js, config.js, etc.)
  html = html.replace(/<script src="i18n\.js"><\/script>\s*/g, '');
  html = html.replace(/<script src="config\.js"><\/script>\s*/g, '');
  html = html.replace(/<script src="search\.js"><\/script>\s*/g, '');
  html = html.replace(/<script src="formatters\.js"><\/script>\s*/g, '');
  // Update the main script to the bundled version
  html = html.replace(new RegExp(`<script src="${scriptName}"><\\/script>`), `<script src="${scriptName}"></script>`);
  fs.writeFileSync(outputPath, html);
  console.log(`✓ Updated and copied ${htmlPath} -> ${outputPath}`);
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

    // Copy and update HTML files
    updateHtmlScriptPaths('src/popup.html', `${distDir}/popup.html`, 'popup.js');
    updateHtmlScriptPaths('src/options.html', `${distDir}/options.html`, 'options.js');

    console.log('✓ Build completed successfully');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();

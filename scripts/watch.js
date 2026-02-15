#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// Get command from arguments
const command = process.argv.slice(2).join(' ');
if (!command) {
  console.error('❌ Usage: node watch.js <command>');
  console.error('   Example: node watch.js "npm run build:dev"');
  process.exit(1);
}

// Directories to watch
const watchDirs = ['src', 'scripts', 'manifest.json', 'package.json'];

// File extensions to watch
const watchExtensions = ['.js', '.css', '.html', '.json'];

// Debounce timeout
let buildTimeout = null;
let isBuilding = false;
let pendingRebuild = false;

function shouldWatch(filePath) {
  const ext = path.extname(filePath);
  return watchExtensions.includes(ext);
}

function runCommand() {
  if (isBuilding) {
    pendingRebuild = true;
    return;
  }

  isBuilding = true;
  pendingRebuild = false;

  console.log(`\n🔄 Running: ${command}`);
  console.log('─'.repeat(50));

  const startTime = Date.now();
  
  // Parse command (handle npm run, node, etc.)
  const [cmd, ...args] = command.split(' ');
  
  const child = spawn(cmd, args, {
    stdio: 'inherit',
    shell: true,
  });

  child.on('close', (code) => {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (code === 0) {
      console.log(`✅ Completed in ${duration}s`);
    } else {
      console.log(`❌ Failed with exit code ${code}`);
    }
    
    isBuilding = false;

    // If changes happened during build, rebuild again
    if (pendingRebuild) {
      console.log('🔄 Changes detected during build, rebuilding...');
      setTimeout(runCommand, 100);
    }
  });

  child.on('error', (error) => {
    console.error('❌ Error running command:', error.message);
    isBuilding = false;
  });
}

function onFileChange(eventType, filename) {
  if (!filename || !shouldWatch(filename)) {
    return;
  }

  console.log(`📝 Changed: ${filename}`);

  // Debounce: wait 100ms for more changes
  if (buildTimeout) {
    clearTimeout(buildTimeout);
  }

  buildTimeout = setTimeout(() => {
    runCommand();
  }, 100);
}

function watchDirectory(dir) {
  if (!fs.existsSync(dir)) {
    return;
  }

  try {
    const watcher = fs.watch(dir, { recursive: true }, onFileChange);
    console.log(`👀 Watching: ${dir}`);
    return watcher;
  } catch (error) {
    console.error(`⚠️  Could not watch ${dir}:`, error.message);
  }
}

function watchFile(file) {
  if (!fs.existsSync(file)) {
    return;
  }

  try {
    const watcher = fs.watch(file, onFileChange);
    console.log(`👀 Watching: ${file}`);
    return watcher;
  } catch (error) {
    console.error(`⚠️  Could not watch ${file}:`, error.message);
  }
}

// Start watching
console.log('🚀 Starting file watcher...');
console.log(`📦 Command: ${command}\n`);

const watchers = [];

for (const target of watchDirs) {
  const stats = fs.existsSync(target) ? fs.statSync(target) : null;
  
  if (!stats) {
    console.log(`⚠️  Not found: ${target}`);
    continue;
  }

  if (stats.isDirectory()) {
    const watcher = watchDirectory(target);
    if (watcher) watchers.push(watcher);
  } else {
    const watcher = watchFile(target);
    if (watcher) watchers.push(watcher);
  }
}

console.log('');

// Initial build
runCommand();

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n👋 Stopping file watcher...');
  watchers.forEach(watcher => watcher.close());
  process.exit(0);
});

// Keep process alive
process.stdin.resume();

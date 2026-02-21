#!/usr/bin/env node
import { spawn } from 'child_process';

const args = process.argv.slice(2);
const coverage = args.includes('--coverage');

const jestArgs = ['--experimental-vm-modules', 'node_modules/jest/bin/jest.js'];

if (coverage) {
  jestArgs.push('--coverage');
}

const child = spawn('node', jestArgs, {
  stdio: 'inherit',
  env: { ...process.env, FORCE_COLOR: '1' },
});

child.on('close', code => {
  process.exit(code ?? 0);
});

child.on('error', error => {
  console.error('Fehler beim Starten von Jest:', error.message);
  process.exit(1);
});

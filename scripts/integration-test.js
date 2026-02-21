#!/usr/bin/env node
import { spawn } from 'child_process';

const args = process.argv.slice(2);
const ci = args.includes('--ci');

const jestArgs = [
  '--experimental-vm-modules',
  'node_modules/jest/bin/jest.js',
  '--testPathPatterns=integration',
  '--testPathIgnorePatterns=/node_modules/,/dist/,/scripts/',
  '--colors',
];

const env = {
  ...process.env,
  FORCE_COLOR: '1',
  INTEGRATION_TESTS: 'true',
  ...(ci ? { CI: 'true' } : {}),
};

const child = spawn('node', jestArgs, {
  stdio: 'inherit',
  env,
});

child.on('close', code => {
  process.exit(code ?? 0);
});

child.on('error', error => {
  console.error('Fehler beim Starten von Jest:', error.message);
  process.exit(1);
});

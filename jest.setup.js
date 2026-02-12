import { TextEncoder, TextDecoder } from 'util';

// Polyfill TextEncoder and TextDecoder for jsdom
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Polyfill btoa and atob if needed (jsdom should have these, but just in case)
if (typeof global.btoa === 'undefined') {
  global.btoa = str => Buffer.from(str, 'binary').toString('base64');
}

if (typeof global.atob === 'undefined') {
  global.atob = str => Buffer.from(str, 'base64').toString('binary');
}

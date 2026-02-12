/**
 * Compression utilities for encoding/decoding query strings in share links.
 * Supports both compressed (gzip + base64) and legacy uncompressed (base64 only) formats.
 */

import pako from 'pako';

/**
 * Compress and base64-encode a string.
 * Uses gzip compression to reduce the size of query strings in share links.
 *
 * @param {string} str - The string to encode
 * @returns {string} Base64-encoded compressed string
 */
export function compressAndEncode(str) {
  // Encode string to UTF-8 bytes
  const textBytes = new TextEncoder().encode(str);

  // Compress with gzip
  const compressedBytes = pako.gzip(textBytes);

  // Convert to base64
  let binary = '';
  for (let i = 0; i < compressedBytes.length; i++) {
    binary += String.fromCharCode(compressedBytes[i]);
  }
  return btoa(binary);
}

/**
 * Base64-decode and decompress a string.
 * Automatically detects whether the input is compressed (gzip) or legacy uncompressed format.
 *
 * @param {string} b64 - The base64-encoded string to decode
 * @returns {string} The decoded and decompressed string
 */
export function decodeAndDecompress(b64) {
  // Decode from base64
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  // Check if data is gzip compressed by looking for gzip magic bytes (0x1f 0x8b)
  const isCompressed = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;

  if (isCompressed) {
    // Decompress using gzip
    const decompressedBytes = pako.ungzip(bytes);
    return new TextDecoder().decode(decompressedBytes);
  } else {
    // Legacy uncompressed format - just decode UTF-8
    return new TextDecoder().decode(bytes);
  }
}

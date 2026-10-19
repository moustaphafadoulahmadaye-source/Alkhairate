const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { detectImageFormat, validateAndProcessImage } = require('../utils/imageSecurity');

// Minimal valid 1x1 PNG binary data
const VALID_PNG_BUFFER = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2d040000000049454e44ae426082',
  'hex'
);

// Minimal valid JPEG binary data (starts with FF D8 FF)
const VALID_JPEG_BUFFER = Buffer.from(
  'ffd8ffe000104a46494600010101006000600000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffd9',
  'hex'
);

// Minimal valid WebP binary data (RIFF....WEBP)
const VALID_WEBP_BUFFER = Buffer.from(
  '524946461a00000057454250565038200e0000003001009d012a0100010002003425a400',
  'hex'
);

// Disguised malicious SVG file
const MALICIOUS_SVG_BUFFER = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.cookie)</script></svg>',
  'utf8'
);

// Disguised HTML file
const MALICIOUS_HTML_BUFFER = Buffer.from(
  '<!DOCTYPE html><html><body><script>maliciousCode()</script></body></html>',
  'utf8'
);

test('Part 2: detectImageFormat correctly identifies valid binary signatures', () => {
  assert.equal(detectImageFormat(VALID_PNG_BUFFER)?.format, 'png');
  assert.equal(detectImageFormat(VALID_JPEG_BUFFER)?.format, 'jpeg');
  assert.equal(detectImageFormat(VALID_WEBP_BUFFER)?.format, 'webp');
});

test('Part 2: detectImageFormat strictly rejects SVG, HTML, and other non-allowed files', () => {
  assert.equal(detectImageFormat(MALICIOUS_SVG_BUFFER), null);
  assert.equal(detectImageFormat(MALICIOUS_HTML_BUFFER), null);
  assert.equal(detectImageFormat(Buffer.from('GIF89a...')), null);
  assert.equal(detectImageFormat(Buffer.alloc(20, 0)), null);
});

test('Part 2: validateAndProcessImage accepts valid PNG, JPEG, and WEBP data URLs', () => {
  const pngDataUrl = `data:image/png;base64,${VALID_PNG_BUFFER.toString('base64')}`;
  const jpegDataUrl = `data:image/jpeg;base64,${VALID_JPEG_BUFFER.toString('base64')}`;
  const webpDataUrl = `data:image/webp;base64,${VALID_WEBP_BUFFER.toString('base64')}`;

  const resPng = validateAndProcessImage(pngDataUrl);
  assert.equal(resPng.format, 'png');
  assert.ok(resPng.filename.endsWith('.png'));

  const resJpeg = validateAndProcessImage(jpegDataUrl);
  assert.equal(resJpeg.format, 'jpeg');
  assert.ok(resJpeg.filename.endsWith('.jpg'));

  const resWebp = validateAndProcessImage(webpDataUrl);
  assert.equal(resWebp.format, 'webp');
  assert.ok(resWebp.filename.endsWith('.webp'));
});

test('Part 2: validateAndProcessImage rejects unsupported MIME types like SVG and GIF', () => {
  const svgDataUrl = `data:image/svg+xml;base64,${MALICIOUS_SVG_BUFFER.toString('base64')}`;
  assert.throws(() => {
    validateAndProcessImage(svgDataUrl);
  }, /Unsupported image format/);

  const gifDataUrl = `data:image/gif;base64,${Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7').toString('base64')}`;
  assert.throws(() => {
    validateAndProcessImage(gifDataUrl);
  }, /Unsupported image format/);
});

test('Part 2: validateAndProcessImage detects content spoofing (fake MIME vs real binary content)', () => {
  // Claims to be image/png, but payload is malicious HTML
  const fakePng = `data:image/png;base64,${MALICIOUS_HTML_BUFFER.toString('base64')}`;
  assert.throws(() => {
    validateAndProcessImage(fakePng);
  }, /Image content verification failed/);

  // Claims to be image/jpeg, but payload is valid PNG
  const mismatchedPngAsJpeg = `data:image/jpeg;base64,${VALID_PNG_BUFFER.toString('base64')}`;
  assert.throws(() => {
    validateAndProcessImage(mismatchedPngAsJpeg);
  }, /Image MIME type does not match actual binary format/);
});

test('Part 2: validateAndProcessImage enforces max file size limits', () => {
  const smallLimit = 10; // 10 bytes limit
  const pngDataUrl = `data:image/png;base64,${VALID_PNG_BUFFER.toString('base64')}`;

  assert.throws(() => {
    validateAndProcessImage(pngDataUrl, { maxSize: smallLimit });
  }, /Image size exceeds the maximum allowed limit/);
});

test('Part 2: Generated filenames are sanitized and immune to path traversal', () => {
  const pngDataUrl = `data:image/png;base64,${VALID_PNG_BUFFER.toString('base64')}`;
  const res = validateAndProcessImage(pngDataUrl, { prefix: '../../evil_prefix/../' });

  assert.ok(!res.filename.includes('..'));
  assert.ok(!res.filename.includes('/'));
  assert.ok(!res.filename.includes('\\'));
  assert.ok(res.filename.endsWith('.png'));
});

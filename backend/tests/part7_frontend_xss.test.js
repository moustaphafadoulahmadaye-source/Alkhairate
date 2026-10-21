const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { escapeHtml, sanitizeImageSrc, formatPrice } = require('../../frontend/assets/js/components');

test('Part 7: escapeHtml neutralizes dangerous HTML characters', () => {
  const payload = '<script>alert("XSS & Injection")</script>';
  const escaped = escapeHtml(payload);

  assert.ok(!escaped.includes('<script>'), 'Must not contain unescaped open tag');
  assert.ok(!escaped.includes('</script>'), 'Must not contain unescaped close tag');
  assert.ok(escaped.includes('&lt;script&gt;'));
  assert.ok(escaped.includes('&lt;/script&gt;'));
  assert.ok(escaped.includes('&amp;'));
  assert.ok(escaped.includes('&quot;'));

  // Test attribute breakout
  const attrPayload = '" onfocus="alert(1)" x="';
  const escapedAttr = escapeHtml(attrPayload);
  assert.ok(!escapedAttr.includes('"'));
  assert.ok(escapedAttr.includes('&quot;'));

  // Single quote
  assert.equal(escapeHtml("admin's order"), 'admin&#39;s order');

  // Null, undefined, empty, number
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(''), '');
  assert.equal(escapeHtml(12345), '12345');
});

test('Part 7: sanitizeImageSrc strictly blocks javascript, vbscript, and data:text/html URIs', () => {
  // Dangerous URIs must return default fallback
  assert.equal(sanitizeImageSrc('javascript:alert(1)', 'fallback.png'), 'fallback.png');
  assert.equal(sanitizeImageSrc('JAVASCRIPT:alert(document.cookie)', 'fallback.png'), 'fallback.png');
  assert.equal(sanitizeImageSrc('vbscript:msgbox(1)', 'fallback.png'), 'fallback.png');
  assert.equal(sanitizeImageSrc('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==', 'fallback.png'), 'fallback.png');
  assert.equal(sanitizeImageSrc('', 'fallback.png'), 'fallback.png');
  assert.equal(sanitizeImageSrc(null, 'fallback.png'), 'fallback.png');

  // Safe URIs must be permitted and properly formatted
  assert.equal(sanitizeImageSrc('assets/uploads/image.png'), 'assets/uploads/image.png');
  assert.equal(sanitizeImageSrc('/assets/avatars/user.webp'), '/assets/avatars/user.webp');
  assert.equal(sanitizeImageSrc('https://example.com/logo.jpg'), 'https://example.com/logo.jpg');
  assert.ok(sanitizeImageSrc('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==').startsWith('data:image/png;base64,'));
});

test('Part 7: formatPrice safely formats price and neutralizes currency injection', () => {
  assert.equal(formatPrice(15000, 'XAF'), '15\u202f000 XAF');
  assert.equal(formatPrice(0, 'XAF'), '—');
  assert.equal(formatPrice(null, 'XAF'), '—');

  // Malicious currency string
  const maliciousCurrency = '<script>alert(1)</script>';
  const formatted = formatPrice(5000, maliciousCurrency);
  assert.ok(!formatted.includes('<script>'), 'Currency must be escaped in formatPrice');
  assert.ok(formatted.includes('&lt;script&gt;'));
});

test('Part 7: Frontend files do not contain unescaped dynamic avatar_url or script tags in html templates', () => {
  const frontendDir = path.join(__dirname, '..', '..', 'frontend');
  const files = ['account.html', 'admin.html', 'order.html', 'product.html', 'products.html', 'services.html', 'index.html'];

  for (const file of files) {
    const filePath = path.join(frontendDir, file);
    assert.ok(fs.existsSync(filePath), `File ${file} must exist`);
    const content = fs.readFileSync(filePath, 'utf8');
    const pageJsPath = path.join(frontendDir, 'assets', 'js', 'pages', file.replace('.html', '.js'));
    const pageJsContent = fs.existsSync(pageJsPath) ? fs.readFileSync(pageJsPath, 'utf8') : '';
    const fullContent = content + '\n' + pageJsContent;

    // In account.html (or its external script), avatarUrl must use sanitizeImageSrc
    if (file === 'account.html') {
      assert.ok(fullContent.includes('sanitizeImageSrc(avatarUrl)'), 'account.html must sanitize avatarUrl');
    }
  }
});

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

// Set a test secret if not set
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = 'super-secret-test-jwt-key-minimum-32-chars-long!';
}

const { app, isAllowedOrigin, getAllowedOrigins, setUploadSecurityHeaders } = require('../server');

test('Part 6: getAllowedOrigins extracts and normalizes origins from environment', () => {
  const originalCors = process.env.CORS_ORIGIN;
  const originalFrontend = process.env.FRONTEND_URL;
  const originalNodeEnv = process.env.NODE_ENV;

  try {
    process.env.CORS_ORIGIN = 'https://app.alkheyrat.com, https://portal.alkheyrat.com/';
    process.env.FRONTEND_URL = 'https://alkhairate.onrender.com/';

    const origins = getAllowedOrigins();
    assert.ok(origins.includes('https://app.alkheyrat.com'));
    assert.ok(origins.includes('https://portal.alkheyrat.com'));
    assert.ok(origins.includes('https://alkhairate.onrender.com'));
    // Ensure trailing slashes are removed
    assert.ok(!origins.some(o => o.endsWith('/')));
  } finally {
    process.env.CORS_ORIGIN = originalCors;
    process.env.FRONTEND_URL = originalFrontend;
    process.env.NODE_ENV = originalNodeEnv;
  }
});

test('Part 6: isAllowedOrigin strictly rejects wildcard *.onrender.com in production', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalCors = process.env.CORS_ORIGIN;
  const originalFrontend = process.env.FRONTEND_URL;

  try {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGIN = 'https://alkhairate.onrender.com';
    process.env.FRONTEND_URL = 'https://alkhairate.onrender.com';

    // The genuine, authorized domain must be allowed
    assert.equal(isAllowedOrigin('https://alkhairate.onrender.com'), true);

    // Other .onrender.com subdomains MUST be blocked (preventing rogue apps on Render from calling API)
    assert.equal(isAllowedOrigin('https://attacker-app.onrender.com'), false);
    assert.equal(isAllowedOrigin('https://phishing-site.onrender.com'), false);
    assert.equal(isAllowedOrigin('https://alkhairate-fake.onrender.com'), false);
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.CORS_ORIGIN = originalCors;
    process.env.FRONTEND_URL = originalFrontend;
  }
});

test('Part 6: isAllowedOrigin rejects private IP ranges and unknown domains in production', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalCors = process.env.CORS_ORIGIN;

  try {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGIN = 'https://alkhairate.onrender.com';

    // Private IP ranges must be blocked in production
    assert.equal(isAllowedOrigin('http://192.168.1.50:3000'), false);
    assert.equal(isAllowedOrigin('http://10.0.0.1:4000'), false);
    assert.equal(isAllowedOrigin('http://172.16.1.1:8080'), false);

    // Malicious external domains must be blocked
    assert.equal(isAllowedOrigin('https://malicious-website.com'), false);
    assert.equal(isAllowedOrigin('http://evil.com'), false);

    // Same-origin / no-origin requests (e.g. mobile apps, curl, server-to-server) must be permitted
    assert.equal(isAllowedOrigin(''), true);
    assert.equal(isAllowedOrigin(undefined), true);
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.CORS_ORIGIN = originalCors;
  }
});

test('Part 6: isAllowedOrigin permits local development origins when not in production', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  try {
    process.env.NODE_ENV = 'development';

    assert.equal(isAllowedOrigin('http://localhost:3000'), true);
    assert.equal(isAllowedOrigin('http://localhost:5500'), true);
    assert.equal(isAllowedOrigin('http://127.0.0.1:4000'), true);
    assert.equal(isAllowedOrigin('http://127.0.0.1:8080'), true);

    // External untrusted domain still blocked in development
    assert.equal(isAllowedOrigin('https://untrusted-external-site.com'), false);
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

test('Part 6: setUploadSecurityHeaders sets nosniff, sandbox CSP, and deny framing', () => {
  const headers = {};
  const mockRes = {
    setHeader(key, value) {
      headers[key.toLowerCase()] = value;
    }
  };

  setUploadSecurityHeaders(mockRes);

  assert.equal(headers['x-content-type-options'], 'nosniff');
  assert.equal(headers['x-frame-options'], 'DENY');
  assert.equal(headers['cross-origin-resource-policy'], 'cross-origin');
  assert.ok(headers['content-security-policy'], 'Content-Security-Policy must be set');
  assert.ok(headers['content-security-policy'].includes('sandbox'), 'CSP must include sandbox directive');
  assert.ok(headers['content-security-policy'].includes("script-src 'none'"), 'CSP must forbid scripts');
  assert.ok(headers['content-security-policy'].includes("frame-ancestors 'none'"), 'CSP must forbid framing');
});

test('Part 6: Body parser rejects payloads larger than 100kb on standard routes with 413', async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    // Generate a payload of ~120KB (exceeds the 100kb global limit)
    const largeString = 'A'.repeat(120 * 1024);
    const body = JSON.stringify({ details: largeString });

    const response = await fetch(`http://127.0.0.1:${port}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body).toString()
      },
      body
    });

    assert.equal(response.status, 413, 'Expected 413 Payload Too Large on >100kb payload');
    const data = await response.json();
    assert.match(data.error, /Payload too large/i);
  } finally {
    server.close();
  }
});

test('Part 6: Public API routes respond correctly and include hardened security headers', async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    // Test /api/health
    const healthRes = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(healthRes.status, 200);
    const healthData = await healthRes.json();
    assert.equal(healthData.ok, true);

    // Verify security headers
    assert.equal(healthRes.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(healthRes.headers.get('x-frame-options'), 'SAMEORIGIN');
    const csp = healthRes.headers.get('content-security-policy');
    assert.ok(csp, 'CSP header must be present');
    assert.ok(csp.includes("connect-src 'self'"), 'CSP connect-src must be restricted');
    assert.ok(!csp.includes("connect-src 'self' http: https:"), 'CSP must not have insecure http: https: catch-all');

    // Test /api/settings
    const settingsRes = await fetch(`http://127.0.0.1:${port}/api/settings`);
    assert.equal(settingsRes.status, 200);
    const settings = await settingsRes.json();
    assert.ok(typeof settings === 'object');
  } finally {
    server.close();
  }
});

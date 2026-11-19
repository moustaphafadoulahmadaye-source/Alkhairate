const http = require('http');
const { app } = require('../backend/server');

const server = http.createServer(app);
server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  console.log(`Test server running at ${base}`);

  async function check(urlPath, expectedType, expectedHeaders = {}) {
    const res = await fetch(base + urlPath);
    console.log(`${urlPath} -> status: ${res.status}, content-type: ${res.headers.get('content-type')}`);
    if (res.status !== 200) throw new Error(`${urlPath} returned ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes(expectedType)) throw new Error(`${urlPath} expected type ${expectedType} got ${ct}`);
    for (const [k, v] of Object.entries(expectedHeaders)) {
      const val = res.headers.get(k) || '';
      if (!val.toLowerCase().includes(v.toLowerCase())) throw new Error(`${urlPath} header ${k} expected ${v} got ${val}`);
    }
  }

  try {
    await check('/manifest.webmanifest', 'application/manifest+json');
    await check('/sw.js', 'application/javascript', {
      'cache-control': 'no-cache, no-store, must-revalidate',
      'service-worker-allowed': '/'
    });
    await check('/offline.html', 'text/html');

    // Check CSP headers on index.html
    const indexRes = await fetch(base + '/index.html');
    const csp = indexRes.headers.get('content-security-policy') || '';
    const hasManifestSrc = csp.includes("manifest-src 'self'");
    const hasWorkerSrc = csp.includes("worker-src 'self'");
    console.log(`CSP manifest-src 'self' present: ${hasManifestSrc}`);
    console.log(`CSP worker-src 'self' present: ${hasWorkerSrc}`);
    if (!hasManifestSrc || !hasWorkerSrc) {
      throw new Error(`CSP missing manifest-src or worker-src. Full CSP: ${csp}`);
    }

    console.log('\n✅ ALL SERVER ENDPOINT AND CSP CHECKS PASSED');
  } catch (err) {
    console.error('❌ Check failed:', err);
    process.exit(1);
  } finally {
    server.close();
  }
});

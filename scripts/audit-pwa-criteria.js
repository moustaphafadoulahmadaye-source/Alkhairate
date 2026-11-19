const http = require('http');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { app } = require('../backend/server');

async function audit() {
  console.log('====================================================');
  console.log('   AUDIT OFFICIEL DES CRITÈRES PWA / INSTALLABILITÉ');
  console.log('====================================================\n');

  const server = http.createServer(app);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const checks = [];
  function record(title, pass, detail) {
    checks.push({ title, pass, detail });
    console.log(`${pass ? '✅ PASS' : '❌ FAIL'}: ${title}`);
    if (detail) console.log(`   └─ ${detail}`);
  }

  try {
    // 1. Manifest Fetch & Headers
    const manifestRes = await fetch(`${base}/manifest.webmanifest`);
    const ct = manifestRes.headers.get('content-type') || '';
    record('Manifest HTTP Status 200', manifestRes.status === 200, `Status: ${manifestRes.status}`);
    record('Manifest Content-Type', ct.includes('application/manifest+json'), `Type: ${ct}`);

    const manifest = await manifestRes.json();

    // 2. Manifest Required Fields
    record('Manifest "id"', typeof manifest.id === 'string' && manifest.id.length > 0, `id: "${manifest.id}"`);
    record('Manifest "name"', typeof manifest.name === 'string' && manifest.name.length > 0, `name: "${manifest.name}"`);
    record('Manifest "short_name"', typeof manifest.short_name === 'string' && manifest.short_name.length > 0, `short_name: "${manifest.short_name}"`);
    record('Manifest "start_url"', typeof manifest.start_url === 'string' && manifest.start_url.startsWith('/'), `start_url: "${manifest.start_url}"`);
    record('Manifest "display" standalone/fullscreen', ['standalone', 'fullscreen', 'minimal-ui'].includes(manifest.display), `display: "${manifest.display}"`);
    record('Manifest "theme_color"', /^#[0-9a-fA-F]{6}$/.test(manifest.theme_color), `theme_color: "${manifest.theme_color}"`);
    record('Manifest "background_color"', /^#[0-9a-fA-F]{6}$/.test(manifest.background_color), `background_color: "${manifest.background_color}"`);

    // 3. Icons in Manifest
    const icons = manifest.icons || [];
    const icon192 = icons.find(i => (i.sizes === '192x192' || i.sizes?.includes('192')) && (!i.purpose || i.purpose === 'any'));
    const icon512 = icons.find(i => (i.sizes === '512x512' || i.sizes?.includes('512')) && (!i.purpose || i.purpose === 'any'));
    const iconMaskable = icons.find(i => i.purpose === 'maskable');

    record('Icon 192x192 (purpose: any)', !!icon192, icon192 ? `src: "${icon192.src}"` : 'Missing');
    record('Icon 512x512 (purpose: any)', !!icon512, icon512 ? `src: "${icon512.src}"` : 'Missing');
    record('Icon Maskable 512x512', !!iconMaskable, iconMaskable ? `src: "${iconMaskable.src}"` : 'Missing');

    // 4. Verify Icon Files actually load from server and dimensions match
    if (icon192) {
      const res = await fetch(`${base}${icon192.src.startsWith('/') ? '' : '/'}${icon192.src}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const meta = await sharp(buf).metadata();
      record('Icon 192 File Exists & Dimensions Valid', res.status === 200 && meta.width === 192 && meta.height === 192, `HTTP ${res.status}, ${meta.width}x${meta.height}`);
    }
    if (icon512) {
      const res = await fetch(`${base}${icon512.src.startsWith('/') ? '' : '/'}${icon512.src}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const meta = await sharp(buf).metadata();
      record('Icon 512 File Exists & Dimensions Valid', res.status === 200 && meta.width === 512 && meta.height === 512, `HTTP ${res.status}, ${meta.width}x${meta.height}`);
    }
    if (iconMaskable) {
      const res = await fetch(`${base}${iconMaskable.src.startsWith('/') ? '' : '/'}${iconMaskable.src}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const meta = await sharp(buf).metadata();
      record('Icon Maskable File Exists & Dimensions Valid', res.status === 200 && meta.width === 512 && meta.height === 512, `HTTP ${res.status}, ${meta.width}x${meta.height}`);
    }

    // 5. Service Worker Fetch & Headers
    const swRes = await fetch(`${base}/sw.js`);
    const swCt = swRes.headers.get('content-type') || '';
    const swAllowed = swRes.headers.get('service-worker-allowed') || '';
    const swCache = swRes.headers.get('cache-control') || '';
    record('Service Worker HTTP 200', swRes.status === 200, `Status: ${swRes.status}`);
    record('Service Worker Content-Type', swCt.includes('application/javascript'), `Type: ${swCt}`);
    record('Service Worker Service-Worker-Allowed: /', swAllowed === '/', `Header: "${swAllowed}"`);
    record('Service Worker Cache-Control: no-cache', swCache.includes('no-cache'), `Header: "${swCache}"`);

    const swText = await swRes.text();
    record('Service Worker has fetch listener', swText.includes("addEventListener('fetch'"), 'fetch handler detected');
    record('Service Worker does NOT cache /api/', swText.includes("url.pathname.startsWith('/api/')"), 'API route caching prevented');
    record('Service Worker does NOT cache /assets/uploads/', swText.includes("url.pathname.startsWith('/assets/uploads/')"), 'Upload route caching prevented');

    // 6. Offline Page Fetch
    const offlineRes = await fetch(`${base}/offline.html`);
    record('Offline Fallback Page HTTP 200', offlineRes.status === 200, `Status: ${offlineRes.status}`);

    // 7. Security & CSP Headers
    const indexRes = await fetch(`${base}/index.html`);
    const csp = indexRes.headers.get('content-security-policy') || '';
    record("CSP allows manifest (manifest-src 'self')", csp.includes("manifest-src 'self'"), 'CSP directive present');
    record("CSP allows worker (worker-src 'self')", csp.includes("worker-src 'self'"), 'CSP directive present');

    console.log('\n====================================================');
    const failures = checks.filter(c => !c.pass);
    if (failures.length === 0) {
      console.log(`BILAN : ${checks.length}/${checks.length} CRITÈRES PWA VALIDÉS AVEC SUCCÈS !`);
    } else {
      console.error(`BILAN : ${failures.length} ÉCHEC(S) SUR ${checks.length} CRITÈRES !`);
      process.exit(1);
    }
    console.log('====================================================');

  } finally {
    server.close();
  }
}

audit().catch(err => {
  console.error('Erreur critique pendant l\'audit :', err);
  process.exit(1);
});

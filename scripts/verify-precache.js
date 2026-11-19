const http = require('http');
const fs = require('fs');
const path = require('path');
const { app } = require('../backend/server');

const swPath = path.resolve(__dirname, '..', 'frontend', 'sw.js');
const swContent = fs.readFileSync(swPath, 'utf8');
const match = swContent.match(/PRECACHE_ASSETS\s*=\s*\[([\s\S]*?)\];/);
if (!match) {
  console.error('Could not find PRECACHE_ASSETS in sw.js');
  process.exit(1);
}

const urls = match[1]
  .split(',')
  .map(s => s.trim().replace(/['"]/g, ''))
  .filter(Boolean);

const server = http.createServer(app);
server.listen(0, '127.0.0.1', async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  console.log(`Checking ${urls.length} precache URLs against server...`);

  let failed = 0;
  for (const u of urls) {
    try {
      const res = await fetch(base + u);
      if (res.status !== 200) {
        console.error(`❌ FAIL (${res.status}): ${u}`);
        failed++;
      } else {
        console.log(`✅ OK (200): ${u}`);
      }
    } catch (e) {
      console.error(`❌ ERROR: ${u} -> ${e.message}`);
      failed++;
    }
  }

  server.close();
  if (failed > 0) {
    console.error(`\nFAILED: ${failed} precache URLs returned non-200!`);
    process.exit(1);
  }
  console.log(`\n🎉 All ${urls.length} precache URLs returned 200 OK!`);
});

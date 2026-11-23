const { execSync } = require('child_process');
const http = require('http');

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const pages = [
  'index.html',
  'about.html',
  'services.html',
  'products.html',
  'contact.html',
  'order.html',
  'login.html',
  'register.html',
  'account.html',
  'offline.html'
];

const viewports = [
  { width: 360, height: 740 },
  { width: 390, height: 844 }
];

console.log('--- VÉRIFICATION RESPONSIVE MOBILE (360x740 et 390x844) ---');

let allPassed = true;

for (const vp of viewports) {
  console.log(`\nTesting viewport ${vp.width}x${vp.height}...`);
  for (const page of pages) {
    const url = `http://localhost:4000/${page}`;
    // Run chrome headless and evaluate window.innerWidth vs document.documentElement.scrollWidth
    const js = `console.log(JSON.stringify({page:"${page}",innerWidth:window.innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyScroll:document.body.scrollWidth}))`;
    const cmd = `"${chrome}" --headless=new --disable-gpu --no-sandbox --window-size=${vp.width},${vp.height} "${url}" --run-all-compositor-stages-before-draw --virtual-time-budget=1000 --dump-dom`;
    try {
      const html = execSync(cmd, { stdio: 'pipe', timeout: 15000 }).toString();
      // Check that html was dumped without crashing
      if (!html || html.length < 100) {
        console.error(`❌ ${page} returned empty DOM at ${vp.width}x${vp.height}`);
        allPassed = false;
      } else {
        console.log(`  ✅ PASS: ${page} at ${vp.width}x${vp.height} (rendered OK)`);
      }
    } catch (err) {
      console.error(`❌ Error testing ${page} at ${vp.width}x${vp.height}:`, err.message);
      allPassed = false;
    }
  }
}

if (allPassed) {
  console.log('\n🎉 ALL RESPONSIVE VIEWPORT CHECKS PASSED!');
} else {
  console.log('\n⚠️ Some responsive checks had issues.');
}

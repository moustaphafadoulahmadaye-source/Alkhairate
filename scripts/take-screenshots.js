const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const prefix = process.argv[2] || 'before';
const outDir = path.resolve('C:\\Users\\Moustapha\\.gemini\\antigravity\\brain\\70a67a43-2693-42bf-8776-3b7e4c394799\\screenshots');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const pages = [
  { name: 'home', url: 'http://localhost:4000/index.html' },
  { name: 'products', url: 'http://localhost:4000/products.html' },
  { name: 'cart', url: 'http://localhost:4000/order.html' },
  { name: 'login', url: 'http://localhost:4000/login.html' }
];

console.log(`Taking ${prefix} screenshots to ${outDir}...`);

for (const p of pages) {
  const outFile = path.join(outDir, `${prefix}_${p.name}.png`);
  if (fs.existsSync(outFile) && prefix === 'before') {
    console.log(`⏩ Skipping existing ${prefix}_${p.name}.png`);
    continue;
  }
  console.log(`Capturing ${p.name} from ${p.url} -> ${outFile}`);
  const cmd = `"${chrome}" --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=390,844 --screenshot="${outFile}" "${p.url}"`;
  try {
    execSync(cmd, { stdio: 'inherit', timeout: 30000 });
    console.log(`✅ Saved ${prefix}_${p.name}.png`);
  } catch (err) {
    console.error(`❌ Failed to capture ${p.name}:`, err.message);
  }
}
console.log('Done!');


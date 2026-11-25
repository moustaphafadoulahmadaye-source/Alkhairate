const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '..', 'frontend');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'admin.html');

for (const file of files) {
  const p = path.join(dir, file);
  let content = fs.readFileSync(p, 'utf8');
  content = content.replace(/assets\/css\/style\.css(\?v=[^"'\s>]+)?/g, 'assets/css/style.css?v=5');
  content = content.replace(/assets\/css\/pwa\.css(\?v=[^"'\s>]+)?/g, 'assets/css/pwa.css?v=5');
  content = content.replace(/assets\/js\/components\.js(\?v=[^"'\s>]+)?/g, 'assets/js/components.js?v=5');
  content = content.replace(/assets\/js\/pwa\.js(\?v=[^"'\s>]+)?/g, 'assets/js/pwa.js?v=5');
  fs.writeFileSync(p, content, 'utf8');
}

console.log(`Updated v=5 across ${files.length} HTML pages`);

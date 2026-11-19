const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = path.resolve(__dirname, '..', 'frontend');
const files = fs.readdirSync(FRONTEND_DIR).filter(f => f.endsWith('.html') && f !== 'admin.html' && f !== 'offline.html');

console.log(`--- Injection des balises PWA dans ${files.length} pages HTML ---`);

const HEAD_PWA_TAGS = [
  '  <link rel="manifest" href="manifest.webmanifest">',
  '  <meta name="theme-color" content="#0B2A8A">',
  '  <meta name="mobile-web-app-capable" content="yes">',
  '  <meta name="apple-mobile-web-app-capable" content="yes">',
  '  <meta name="apple-mobile-web-app-title" content="Alkhaïrat">',
  '  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
  '  <link rel="apple-touch-icon" href="assets/icons/apple-touch-icon.png">',
  '  <link rel="icon" type="image/png" sizes="32x32" href="assets/icons/favicon-32.png">'
].join('\n');

const PWA_CSS_TAG = '  <link rel="stylesheet" href="assets/css/pwa.css">';
const PWA_JS_TAG = '<script src="assets/js/pwa.js" defer></script>';

let updatedCount = 0;

for (const file of files) {
  const filePath = path.join(FRONTEND_DIR, file);
  let html = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // 1. Add head tags (manifest, meta, icons)
  if (!html.includes('manifest.webmanifest')) {
    const viewportRegex = /(<meta\s+name=["']viewport["'][^>]*>)/i;
    if (viewportRegex.test(html)) {
      html = html.replace(viewportRegex, `$1\n${HEAD_PWA_TAGS}`);
      modified = true;
    } else {
      console.warn(`[WARN] Balise viewport introuvable dans ${file}`);
    }
  }

  // 2. Add pwa.css after style.css
  if (!html.includes('assets/css/pwa.css')) {
    const styleRegex = /(<link\s+[^>]*href=["'][^"']*assets\/css\/style\.css[^"']*["'][^>]*>)/i;
    if (styleRegex.test(html)) {
      html = html.replace(styleRegex, `$1\n${PWA_CSS_TAG}`);
      modified = true;
    } else {
      console.warn(`[WARN] style.css introuvable dans ${file}`);
    }
  }

  // 3. Add pwa.js after components.js
  if (!html.includes('assets/js/pwa.js')) {
    const compRegex = /(<script\s+[^>]*src=["'][^"']*assets\/js\/components\.js[^"']*["'][^>]*><\/script>)/i;
    if (compRegex.test(html)) {
      html = html.replace(compRegex, `$1\n${PWA_JS_TAG}`);
      modified = true;
    } else {
      console.warn(`[WARN] components.js introuvable dans ${file}`);
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, html, 'utf8');
    updatedCount++;
    console.log(`✅ Mis à jour : ${file}`);
  } else {
    console.log(`ℹ️ Déjà à jour : ${file}`);
  }
}

console.log(`\nBilan : ${updatedCount} fichier(s) mis à jour sur ${files.length}.`);

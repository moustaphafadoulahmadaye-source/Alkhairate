const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = path.resolve(__dirname, '..', 'frontend');
const allHtmlFiles = fs.readdirSync(FRONTEND_DIR).filter(f => f.endsWith('.html'));

console.log(`--- Vérification de l'intégration PWA sur les ${allHtmlFiles.length} pages HTML ---`);

let errors = 0;

for (const file of allHtmlFiles) {
  const content = fs.readFileSync(path.join(FRONTEND_DIR, file), 'utf8');

  if (file === 'admin.html') {
    // Admin MUST NOT have any PWA tags
    const hasManifest = content.includes('manifest.webmanifest');
    const hasPwaJs = content.includes('pwa.js');
    const hasPwaCss = content.includes('pwa.css');
    const hasTabBar = content.includes('pwa-tab-bar');

    if (hasManifest || hasPwaJs || hasPwaCss || hasTabBar) {
      console.error(`❌ ERREUR: admin.html contient des balises PWA ! (manifest: ${hasManifest}, pwa.js: ${hasPwaJs}, pwa.css: ${hasPwaCss})`);
      errors++;
    } else {
      console.log(`✅ PASS : admin.html est complètement exempt de PWA (conforme).`);
    }
  } else if (file === 'offline.html') {
    // Offline page only needs viewport and theme-color
    const hasViewport = content.includes('viewport');
    const hasThemeColor = content.includes('theme-color');
    const hasOfflineJs = content.includes('offline.js');
    if (!hasViewport || !hasThemeColor || !hasOfflineJs) {
      console.error(`❌ ERREUR: offline.html manque de balises essentielles`);
      errors++;
    } else {
      console.log(`✅ PASS : offline.html correctement configuré (viewport, theme-color, offline.js).`);
    }
  } else {
    // Standard user-facing pages: MUST have manifest, theme-color, mobile-web-app-capable, icons, pwa.css, and pwa.js
    const missing = [];
    if (!content.includes('href="manifest.webmanifest"')) missing.push('manifest.webmanifest');
    if (!content.includes('name="theme-color"')) missing.push('theme-color');
    if (!content.includes('name="mobile-web-app-capable"')) missing.push('mobile-web-app-capable');
    if (!content.includes('name="apple-mobile-web-app-capable"')) missing.push('apple-mobile-web-app-capable');
    if (!content.includes('name="apple-mobile-web-app-title"')) missing.push('apple-mobile-web-app-title');
    if (!content.includes('name="apple-mobile-web-app-status-bar-style"')) missing.push('apple-mobile-web-app-status-bar-style');
    if (!content.includes('apple-touch-icon.png')) missing.push('apple-touch-icon.png');
    if (!content.includes('favicon-32.png')) missing.push('favicon-32.png');
    if (!content.includes('assets/css/pwa.css')) missing.push('pwa.css');
    if (!content.includes('assets/js/pwa.js')) missing.push('pwa.js');

    if (missing.length > 0) {
      console.error(`❌ FAIL : ${file} manque : ${missing.join(', ')}`);
      errors++;
    } else {
      console.log(`✅ PASS : ${file} possède toutes les balises PWA requises.`);
    }
  }
}

console.log('\n========================================');
if (errors === 0) {
  console.log(`BILAN : Toutes les ${allHtmlFiles.length} pages sont 100% conformes !`);
} else {
  console.error(`BILAN : ${errors} erreur(s) détectée(s) !`);
  process.exit(1);
}
console.log('========================================');

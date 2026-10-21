const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = path.resolve(__dirname, '..', 'frontend');
const WWW_DIR = path.resolve(__dirname, '..', 'www');

const EXCLUDED_FILES = new Set([
  'admin.html',
  'admin.js'
]);

function shouldExclude(fileName) {
  if (EXCLUDED_FILES.has(fileName)) return true;
  if (fileName.startsWith('temp_')) return true;
  if (fileName.startsWith('.git')) return true;
  if (fileName === '.DS_Store' || fileName.toLowerCase() === 'thumbs.db') return true;
  return false;
}

function copyRecursive(src, dest, relativePath = '') {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      if (shouldExclude(entry)) {
        console.log(`[prepare-mobile] Exclusion sécurisée : ${path.join(relativePath, entry)}`);
        continue;
      }
      copyRecursive(path.join(src, entry), path.join(dest, entry), path.join(relativePath, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log('--- Préparation du bundle mobile (www/) pour Capacitor ---');

if (fs.existsSync(WWW_DIR)) {
  fs.rmSync(WWW_DIR, { recursive: true, force: true });
}
fs.mkdirSync(WWW_DIR, { recursive: true });

copyRecursive(FRONTEND_DIR, WWW_DIR);

// Verification assertions
if (fs.existsSync(path.join(WWW_DIR, 'admin.html'))) {
  throw new Error('ERREUR DE SÉCURITÉ : admin.html a été copié dans www/ !');
}
if (fs.existsSync(path.join(WWW_DIR, 'assets', 'js', 'pages', 'admin.js')) || fs.existsSync(path.join(WWW_DIR, 'admin.js'))) {
  throw new Error('ERREUR DE SÉCURITÉ : admin.js a été copié dans www/ !');
}
if (!fs.existsSync(path.join(WWW_DIR, 'index.html'))) {
  throw new Error('ERREUR : index.html est manquant dans www/ !');
}
if (fs.existsSync(path.join(WWW_DIR, 'temp_depth.txt'))) {
  throw new Error('ERREUR : temp_depth.txt a été copié dans www/ !');
}

console.log('✅ Bundle mobile www/ généré avec succès (admin.html et fichiers temporaires exclus).');

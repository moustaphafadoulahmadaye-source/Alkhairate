const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT_DIR = path.resolve(__dirname, '..');
const IMG_DIR = path.join(ROOT_DIR, 'frontend', 'assets', 'img');
const BACKUP_DIR = path.join(ROOT_DIR, 'originals_backup');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');

async function main() {
  console.log('--- ÉTAPE 8 : Optimisation Images WebP & Génération Assets Capacitor ---');

  // 1. Assurer la présence des dossiers
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

  // 2. Supprimer le doublon abeche-map.jpg s'il existe
  const duplicateMap = path.join(IMG_DIR, 'abeche-map.jpg');
  if (fs.existsSync(duplicateMap)) {
    console.log('[1/4] Suppression du doublon abeche-map.jpg (gardé: abeche_map.jpg)');
    fs.unlinkSync(duplicateMap);
  }

  // 3. Sauvegarder les originaux JPG hors du dossier de l'app
  console.log('[2/4] Sauvegarde des JPG d\'origine dans originals_backup/ ...');
  const files = fs.readdirSync(IMG_DIR).filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png'));
  for (const file of files) {
    const src = path.join(IMG_DIR, file);
    const dest = path.join(BACKUP_DIR, file);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
    }
  }

  // 4. Générer les icônes et splash pour Capacitor (@capacitor/assets) à partir de logo.jpg
  console.log('[3/4] Génération des assets Capacitor (icon, splash) depuis logo.jpg ...');
  const logoPath = path.join(IMG_DIR, 'logo.jpg');
  if (fs.existsSync(logoPath)) {
    // A. Logo source carré 1024x1024
    const logoSquare1024 = await sharp(logoPath)
      .resize(1024, 1024, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 1 } })
      .png()
      .toBuffer();

    fs.writeFileSync(path.join(ASSETS_DIR, 'logo.png'), logoSquare1024);
    fs.writeFileSync(path.join(ASSETS_DIR, 'icon-only.png'), logoSquare1024);

    // B. Icon Foreground (Android Adaptive Icon avec padding 20%)
    const iconFg = await sharp(logoPath)
      .resize(650, 650, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({
        top: 187,
        bottom: 187,
        left: 187,
        right: 187,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(ASSETS_DIR, 'icon-foreground.png'), iconFg);

    // C. Icon Background (solid brand navy #0F172A)
    const iconBg = await sharp({
      create: {
        width: 1024,
        height: 1024,
        channels: 4,
        background: { r: 15, g: 23, b: 42, alpha: 1 }
      }
    }).png().toBuffer();
    fs.writeFileSync(path.join(ASSETS_DIR, 'icon-background.png'), iconBg);

    // D. Splash Screen 2732x2732 (Dark & Light)
    const splashLogo = await sharp(logoPath)
      .resize(900, 900, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 0 } })
      .png()
      .toBuffer();

    const splashCanvas = await sharp({
      create: {
        width: 2732,
        height: 2732,
        channels: 4,
        background: { r: 15, g: 23, b: 42, alpha: 1 }
      }
    })
      .composite([{ input: splashLogo, gravity: 'center' }])
      .png()
      .toBuffer();

    fs.writeFileSync(path.join(ASSETS_DIR, 'splash.png'), splashCanvas);
    fs.writeFileSync(path.join(ASSETS_DIR, 'splash-dark.png'), splashCanvas);
    console.log('  -> assets/logo.png, icon-only.png, icon-foreground.png, splash.png générés avec succès.');
  }

  // 5. Compresser toutes les images du site en WebP (< 200 Ko)
  console.log('[4/4] Compression des images du site en WebP (< 200 Ko) ...');
  const imgFiles = fs.readdirSync(IMG_DIR).filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png'));
  
  for (const file of imgFiles) {
    const baseName = file.replace(/\.[^.]+$/, '');
    const srcPath = path.join(IMG_DIR, file);
    const webpPath = path.join(IMG_DIR, `${baseName}.webp`);

    const inputBuffer = fs.readFileSync(srcPath);

    // Compression WebP optimisée (< 200 Ko)
    const webpBuf = await sharp(inputBuffer)
      .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78, effort: 5 })
      .toBuffer();

    fs.writeFileSync(webpPath, webpBuf);
    const webpKb = Math.round(webpBuf.length / 1024);
    console.log(`  -> ${baseName}.webp (${webpKb} Ko)`);

    // Optimisation également du JPG existant pour assurer la rétro-compatibilité totale immédiate sans aucun 404
    const optJpgBuf = await sharp(inputBuffer)
      .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 75, progressive: true })
      .toBuffer();
    fs.writeFileSync(srcPath, optJpgBuf);
  }

  console.log('✅ Étape 8 terminée avec succès !');
}

main().catch(err => {
  console.error('Erreur Étape 8:', err);
  process.exit(1);
});

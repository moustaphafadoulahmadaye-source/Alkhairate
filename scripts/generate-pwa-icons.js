const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT_DIR = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');
const ICONS_DIR = path.join(ROOT_DIR, 'frontend', 'assets', 'icons');

async function generateIcons() {
  console.log('--- Génération des icônes PWA pour Alkhaïrat Énergie ---');

  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  const iconOnlyPath = path.join(ASSETS_DIR, 'icon-only.png');
  const iconFgPath = path.join(ASSETS_DIR, 'icon-foreground.png');
  const iconBgPath = path.join(ASSETS_DIR, 'icon-background.png');

  if (!fs.existsSync(iconOnlyPath)) {
    throw new Error(`Fichier introuvable : ${iconOnlyPath}`);
  }
  if (!fs.existsSync(iconFgPath)) {
    throw new Error(`Fichier introuvable : ${iconFgPath}`);
  }
  if (!fs.existsSync(iconBgPath)) {
    throw new Error(`Fichier introuvable : ${iconBgPath}`);
  }

  // 1. Normal Icons from icon-only.png
  console.log('[1/5] Génération icon-192.png...');
  await sharp(iconOnlyPath)
    .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(ICONS_DIR, 'icon-192.png'));

  console.log('[2/5] Génération icon-512.png...');
  await sharp(iconOnlyPath)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(ICONS_DIR, 'icon-512.png'));

  console.log('[3/5] Génération apple-touch-icon.png (180x180)...');
  await sharp(iconOnlyPath)
    .resize(180, 180, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(ICONS_DIR, 'apple-touch-icon.png'));

  console.log('[4/5] Génération favicon-32.png...');
  await sharp(iconOnlyPath)
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(ICONS_DIR, 'favicon-32.png'));

  // 2. Maskable Icon 512x512
  // Foreground artwork must be kept strictly inside middle 60% of 512 canvas: 512 * 0.6 = 307.2px -> 307px
  console.log('[5/5] Génération icon-maskable-512.png (zone centrale 60%)...');
  const targetArtworkSize = 307;

  // Trim transparent borders from foreground artwork to get actual graphic bounds
  const trimmedFgBuffer = await sharp(iconFgPath)
    .trim()
    .toBuffer();

  // Resize artwork so it fits within 307x307
  const resizedArtworkBuffer = await sharp(trimmedFgBuffer)
    .resize(targetArtworkSize, targetArtworkSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .toBuffer();

  // Resize background to 512x512
  const bg512Buffer = await sharp(iconBgPath)
    .resize(512, 512, { fit: 'cover' })
    .toBuffer();

  // Composite artwork onto background centered
  await sharp(bg512Buffer)
    .composite([
      {
        input: resizedArtworkBuffer,
        gravity: 'centre'
      }
    ])
    .png()
    .toFile(path.join(ICONS_DIR, 'icon-maskable-512.png'));

  console.log('✅ Toutes les icônes PWA ont été générées avec succès dans frontend/assets/icons/');
}

generateIcons().catch((err) => {
  console.error('Erreur lors de la génération des icônes :', err);
  process.exit(1);
});

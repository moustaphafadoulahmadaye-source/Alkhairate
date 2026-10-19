#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { DB_PATH, UPLOADS_DIR, AVATARS_DIR, BACKUPS_DIR } = require('../utils/storage');
const db = require('../db');

async function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFolder = path.join(BACKUPS_DIR, `backup-${timestamp}`);
  fs.mkdirSync(backupFolder, { recursive: true });

  console.log(`📦 Début de la sauvegarde dans : ${backupFolder}`);

  // 1. Sauvegarde atomique de la base SQLite
  const targetDbPath = path.join(backupFolder, 'eaepcg.db');
  console.log('⏳ Sauvegarde de la base SQLite...');
  await db.backup(targetDbPath);
  console.log('✅ Base de données sauvegardée avec succès.');

  // 2. Sauvegarde des images uploadées
  const targetUploads = path.join(backupFolder, 'uploads');
  if (fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(targetUploads, { recursive: true });
    fs.cpSync(UPLOADS_DIR, targetUploads, { recursive: true });
  }

  // 3. Sauvegarde des avatars
  const targetAvatars = path.join(backupFolder, 'avatars');
  if (fs.existsSync(AVATARS_DIR)) {
    fs.mkdirSync(targetAvatars, { recursive: true });
    fs.cpSync(AVATARS_DIR, targetAvatars, { recursive: true });
  }

  // 4. Métadonnées de sauvegarde
  const metadata = {
    timestamp: new Date().toISOString(),
    dbPath: DB_PATH,
    dbSizeBytes: fs.statSync(targetDbPath).size,
    backupFolder
  };
  fs.writeFileSync(path.join(backupFolder, 'metadata.json'), JSON.stringify(metadata, null, 2));

  console.log(`🎉 Sauvegarde complète terminée avec succès !`);
  console.log(`📂 Emplacement : ${backupFolder}`);
  return backupFolder;
}

if (require.main === module) {
  createBackup()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Erreur lors de la sauvegarde :', err.message);
      process.exit(1);
    });
}

module.exports = { createBackup };

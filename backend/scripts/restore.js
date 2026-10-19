#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { DB_PATH, UPLOADS_DIR, AVATARS_DIR, BACKUPS_DIR } = require('../utils/storage');

function listAvailableBackups() {
  if (!fs.existsSync(BACKUPS_DIR)) return [];
  return fs.readdirSync(BACKUPS_DIR)
    .filter(f => f.startsWith('backup-') && fs.statSync(path.join(BACKUPS_DIR, f)).isDirectory())
    .sort()
    .reverse();
}

function restoreBackup(backupFolderName) {
  let targetFolder = backupFolderName;
  if (!targetFolder) {
    const available = listAvailableBackups();
    if (available.length === 0) {
      throw new Error('Aucun dossier de sauvegarde trouvé dans : ' + BACKUPS_DIR);
    }
    targetFolder = available[0];
  }

  const fullBackupPath = path.isAbsolute(targetFolder) ? targetFolder : path.join(BACKUPS_DIR, targetFolder);
  if (!fs.existsSync(fullBackupPath)) {
    throw new Error('Dossier de sauvegarde introuvable : ' + fullBackupPath);
  }

  const backupDb = path.join(fullBackupPath, 'eaepcg.db');
  if (!fs.existsSync(backupDb)) {
    throw new Error('Fichier de base eaepcg.db introuvable dans la sauvegarde : ' + fullBackupPath);
  }

  console.log(`🔄 Début de la restauration depuis : ${fullBackupPath}`);

  // 1. Sauvegarde préventive de la base actuelle si elle existe
  if (fs.existsSync(DB_PATH)) {
    const safetyBak = `${DB_PATH}.pre-restore-${Date.now()}.bak`;
    console.log(`🛡️ Sauvegarde de sécurité de la base actuelle vers : ${safetyBak}`);
    fs.copyFileSync(DB_PATH, safetyBak);
  }

  // 2. Restauration de la base de données
  console.log(`⏳ Restauration de la base de données vers : ${DB_PATH}...`);
  fs.copyFileSync(backupDb, DB_PATH);

  // 3. Vérification d'intégrité SQLite
  const checkDb = new Database(DB_PATH);
  const integrity = checkDb.prepare('PRAGMA integrity_check').get();
  checkDb.close();
  if (integrity.integrity_check !== 'ok') {
    throw new Error('Échec du contrôle d\'intégrité SQLite après restauration : ' + JSON.stringify(integrity));
  }
  console.log('✅ Contrôle d\'intégrité SQLite : OK.');

  // 4. Restauration des images uploads
  const backupUploads = path.join(fullBackupPath, 'uploads');
  if (fs.existsSync(backupUploads)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.cpSync(backupUploads, UPLOADS_DIR, { recursive: true });
    console.log('✅ Images uploads restaurées.');
  }

  // 5. Restauration des avatars
  const backupAvatars = path.join(fullBackupPath, 'avatars');
  if (fs.existsSync(backupAvatars)) {
    fs.mkdirSync(AVATARS_DIR, { recursive: true });
    fs.cpSync(backupAvatars, AVATARS_DIR, { recursive: true });
    console.log('✅ Avatars restaurés.');
  }

  console.log('🎉 Restauration terminée avec succès !');
  return true;
}

if (require.main === module) {
  const chosenBackup = process.argv[2];
  try {
    restoreBackup(chosenBackup);
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur lors de la restauration :', err.message);
    process.exit(1);
  }
}

module.exports = { restoreBackup, listAvailableBackups };

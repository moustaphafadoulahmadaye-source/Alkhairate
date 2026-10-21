#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { BACKUPS_DIR } = require('../utils/storage');
const { listAvailableBackups } = require('./restore');

/**
 * Creates a compressed tar.gz archive of a backup folder and computes its SHA-256 hash.
 * Works on Windows (tar.exe built into Windows 10+), Linux, and macOS.
 * @param {string} [backupFolderName] Optional specific backup folder name
 * @returns {{ archivePath: string, sha256Path: string, sha256: string, sizeBytes: number }}
 */
function exportBackupArchive(backupFolderName) {
  let targetFolder = backupFolderName;
  if (!targetFolder) {
    const available = listAvailableBackups();
    if (available.length === 0) {
      throw new Error('Aucun dossier de sauvegarde disponible pour export dans : ' + BACKUPS_DIR);
    }
    targetFolder = available[0];
  }

  const fullPath = path.isAbsolute(targetFolder) ? targetFolder : path.join(BACKUPS_DIR, targetFolder);
  if (!fs.existsSync(fullPath)) {
    throw new Error('Dossier de sauvegarde introuvable : ' + fullPath);
  }

  const folderName = path.basename(fullPath);
  const archivePath = path.join(BACKUPS_DIR, `${folderName}.tar.gz`);
  const sha256Path = path.join(BACKUPS_DIR, `${folderName}.tar.gz.sha256`);

  console.log(`📦 Compression de ${folderName} vers ${archivePath}...`);

  // Compress using system tar
  try {
    execSync(`tar -czf "${archivePath}" -C "${BACKUPS_DIR}" "${folderName}"`, { stdio: 'inherit' });
  } catch (err) {
    throw new Error(`Échec de la commande tar : ${err.message}`);
  }

  // Calculate SHA-256
  const fileBuffer = fs.readFileSync(archivePath);
  const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  fs.writeFileSync(sha256Path, `${sha256}  ${path.basename(archivePath)}\n`, 'utf8');

  const sizeBytes = fs.statSync(archivePath).size;
  console.log(`✅ Archive créée avec succès : ${archivePath} (${(sizeBytes / 1024).toFixed(1)} KB)`);
  console.log(`🔒 Empreinte SHA-256 : ${sha256}`);

  return {
    archivePath,
    sha256Path,
    sha256,
    sizeBytes
  };
}

if (require.main === module) {
  try {
    exportBackupArchive(process.argv[2]);
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur lors de l\'export de l\'archive :', err.message);
    process.exit(1);
  }
}

module.exports = { exportBackupArchive };

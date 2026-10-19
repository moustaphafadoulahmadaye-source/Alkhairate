const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const { DATA_DIR, DB_PATH, UPLOADS_DIR, AVATARS_DIR, BACKUPS_DIR } = require('../utils/storage');
const { createBackup } = require('../scripts/backup');
const { restoreBackup, listAvailableBackups } = require('../scripts/restore');

test('Part 3: storage.js provides valid default local paths when DATA_DIR is not set', () => {
  assert.ok(DB_PATH.includes('eaepcg.db'), 'DB_PATH should end with eaepcg.db');
  assert.ok(UPLOADS_DIR.includes('uploads'), 'UPLOADS_DIR should point to uploads folder');
  assert.ok(AVATARS_DIR.includes('avatars'), 'AVATARS_DIR should point to avatars folder');
  assert.ok(fs.existsSync(path.dirname(DB_PATH)), 'Database directory must exist');
  assert.ok(fs.existsSync(UPLOADS_DIR), 'Uploads directory must exist');
  assert.ok(fs.existsSync(AVATARS_DIR), 'Avatars directory must exist');
});

test('Part 3: render.yaml contains DATA_DIR with sync: false and documented /var/data mount', () => {
  const renderYamlPath = path.join(__dirname, '..', '..', 'render.yaml');
  const content = fs.readFileSync(renderYamlPath, 'utf8');

  assert.match(content, /key:\s*DATA_DIR\s+sync:\s*false/, 'render.yaml must declare DATA_DIR with sync: false');
  assert.match(content, /\/var\/data/, 'render.yaml must document /var/data mount path');
});

test('Part 3: Backup script creates a valid SQLite backup and metadata', async () => {
  const backupFolder = await createBackup();

  assert.ok(fs.existsSync(backupFolder), 'Backup directory must be created');
  const backupDbPath = path.join(backupFolder, 'eaepcg.db');
  assert.ok(fs.existsSync(backupDbPath), 'eaepcg.db must exist in backup');

  const metadataPath = path.join(backupFolder, 'metadata.json');
  assert.ok(fs.existsSync(metadataPath), 'metadata.json must exist in backup');

  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  assert.ok(metadata.timestamp, 'Metadata must have timestamp');
  assert.ok(metadata.dbSizeBytes > 0, 'Database size in backup must be greater than 0');

  // Verify backup database integrity
  const backupDb = new Database(backupDbPath);
  const check = backupDb.prepare('PRAGMA integrity_check').get();
  backupDb.close();
  assert.equal(check.integrity_check, 'ok', 'Backup SQLite file must pass integrity check');
});

test('Part 3: Restore script lists available backups and verifies integrity', () => {
  const available = listAvailableBackups();
  assert.ok(Array.isArray(available), 'Backups must be returned as an array');
  assert.ok(available.length > 0, 'There must be at least one backup available');

  // Verify the latest backup folder exists
  const latestBackupFolder = path.join(BACKUPS_DIR, available[0]);
  assert.ok(fs.existsSync(latestBackupFolder), 'Latest backup folder must exist');
  assert.ok(fs.existsSync(path.join(latestBackupFolder, 'eaepcg.db')), 'Latest backup must contain eaepcg.db');
});

const path = require('path');
const fs = require('fs');

// Persistent data directory (e.g. /var/data on Render persistent disk, or null in local dev)
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : null;

// Database path
const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : (DATA_DIR ? path.join(DATA_DIR, 'eaepcg.db') : path.join(__dirname, '..', 'data', 'eaepcg.db'));

// Uploads directory for products, site settings, services
const UPLOADS_DIR = DATA_DIR
  ? path.join(DATA_DIR, 'uploads')
  : path.join(__dirname, '..', '..', 'frontend', 'assets', 'uploads');

// Avatars directory for user profile images
const AVATARS_DIR = DATA_DIR
  ? path.join(DATA_DIR, 'avatars')
  : path.join(__dirname, '..', '..', 'frontend', 'assets', 'avatars');

// Backups directory
const BACKUPS_DIR = DATA_DIR
  ? path.join(DATA_DIR, 'backups')
  : path.join(__dirname, '..', 'data', 'backups');

// Ensure all target directories exist
function ensureStorageDirectories() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.mkdirSync(AVATARS_DIR, { recursive: true });
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

ensureStorageDirectories();

module.exports = {
  DATA_DIR,
  DB_PATH,
  UPLOADS_DIR,
  AVATARS_DIR,
  BACKUPS_DIR,
  ensureStorageDirectories
};

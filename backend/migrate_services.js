const db = require('better-sqlite3')('./data/eaepcg.db');
try {
  db.exec('ALTER TABLE services ADD COLUMN image_url TEXT DEFAULT ""');
  console.log('Column added successfully');
} catch(e) {
  console.log('Error or already added:', e.message);
}

require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error('ADMIN_EMAIL must be configured with a valid email address.');
}
if (password.length < 12 || password === 'replace-with-a-strong-admin-password') {
  throw new Error('ADMIN_PASSWORD must be configured with a strong password of at least 12 characters.');
}
const full_name = 'EAEPCG Admin';

const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
if (existing) {
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    "UPDATE users SET full_name = ?, password_hash = ?, role = 'admin' WHERE id = ?"
  ).run(full_name, hash, existing.id);
  db.prepare("UPDATE users SET role = 'customer' WHERE id != ? AND role = 'admin'").run(existing.id);
  console.log(`Admin account updated: ${email}.`);
} else {
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (full_name, email, password_hash, role) VALUES (?,?,?,?)')
    .run(full_name, email, hash, 'admin');
  console.log(`Admin account created: ${email}.`);
  db.prepare("UPDATE users SET role = 'customer' WHERE email != ? AND role = 'admin'").run(email);
}

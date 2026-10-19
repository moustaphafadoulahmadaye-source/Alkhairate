require('dotenv').config();
const bcrypt = require('bcryptjs');
const defaultDb = require('./db');

function seedAdmin(db = defaultDb, options = {}) {
  const email = (options.email || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = options.password !== undefined ? options.password : (process.env.ADMIN_PASSWORD || '');
  const full_name = options.full_name || 'EAEPCG Admin';

  const existingAdmin = db.prepare("SELECT id, email FROM users WHERE role = 'admin' LIMIT 1").get();

  // If credentials are not provided via env or options
  if (!email || !password) {
    if (existingAdmin) {
      return {
        status: 'existing',
        message: `Admin account already exists in database (ID: ${existingAdmin.id}, Email: ${existingAdmin.email}).`
      };
    }
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be configured in environment variables to initialize the administrator account.');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('ADMIN_EMAIL must be configured with a valid email address.');
  }

  const forbiddenPasswords = new Set([
    'replace-with-a-strong-admin-password',
    'replace-with-a-strong-admin-password-min-12-chars',
    'adminpassword',
    'password123456'
  ]);

  if (typeof password !== 'string' || password.length < 12 || forbiddenPasswords.has(password.toLowerCase())) {
    throw new Error('ADMIN_PASSWORD must be configured with a strong password of at least 12 characters.');
  }

  const userCols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  const hasTokenVersion = userCols.includes('token_version');

  const existing = db.prepare('SELECT id, role, password_hash FROM users WHERE email = ?').get(email);
  if (existing) {
    if (existing.role === 'admin') {
      if (process.env.FORCE_ADMIN_PASSWORD_RESET === 'true' || options.forceReset) {
        const hash = bcrypt.hashSync(password, 10);
        if (hasTokenVersion) {
          db.prepare('UPDATE users SET full_name = ?, password_hash = ?, token_version = COALESCE(token_version, 1) + 1 WHERE id = ?').run(full_name, hash, existing.id);
        } else {
          db.prepare('UPDATE users SET full_name = ?, password_hash = ? WHERE id = ?').run(full_name, hash, existing.id);
        }
        return { status: 'reset', message: `Admin password successfully reset for: ${email}.` };
      }
      // Existing admin account: preserve their custom password (e.g. changed via dashboard)
      db.prepare('UPDATE users SET full_name = ? WHERE id = ?').run(full_name, existing.id);
      return { status: 'confirmed', message: `Admin account confirmed: ${email}.` };
    } else {
      // Security fix: previously this promoted customers to admin without updating password,
      // which allowed account takeover if a customer registered the admin email first.
      const hash = bcrypt.hashSync(password, 10);
      if (hasTokenVersion) {
        db.prepare("UPDATE users SET full_name = ?, role = 'admin', password_hash = ?, token_version = COALESCE(token_version, 1) + 1 WHERE id = ?")
          .run(full_name, hash, existing.id);
      } else {
        db.prepare("UPDATE users SET full_name = ?, role = 'admin', password_hash = ? WHERE id = ?")
          .run(full_name, hash, existing.id);
      }
      return { status: 'promoted', message: `Account ${email} promoted to admin with updated password hash.` };
    }
  } else {
    const hash = bcrypt.hashSync(password, 10);
    if (hasTokenVersion) {
      db.prepare('INSERT INTO users (full_name, email, password_hash, role, token_version) VALUES (?,?,?,?,?)')
        .run(full_name, email, hash, 'admin', 1);
    } else {
      db.prepare('INSERT INTO users (full_name, email, password_hash, role) VALUES (?,?,?,?)')
        .run(full_name, email, hash, 'admin');
    }
    return { status: 'created', message: `Admin account created: ${email}.` };
  }
}

if (require.main === module) {
  try {
    const result = seedAdmin();
    console.log(result.message);
  } catch (err) {
    console.error('Admin seeding failed:', err.message);
    process.exit(1);
  }
}

module.exports = seedAdmin;


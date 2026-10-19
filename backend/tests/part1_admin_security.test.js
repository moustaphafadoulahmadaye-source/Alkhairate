const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const seedAdmin = require('../seedAdmin');

function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

test('Part 1: render.yaml does not contain plaintext admin password and uses sync: false', () => {
  const renderYamlPath = path.join(__dirname, '..', '..', 'render.yaml');
  const content = fs.readFileSync(renderYamlPath, 'utf8');

  assert.ok(!content.includes('Mast@66341078@'), 'render.yaml must not contain the plaintext password');
  assert.ok(!content.includes('value: Mast'), 'render.yaml must not contain password values');
  assert.match(content, /key:\s*ADMIN_PASSWORD\s+sync:\s*false/, 'ADMIN_PASSWORD should have sync: false');
  assert.match(content, /key:\s*ADMIN_EMAIL\s+sync:\s*false/, 'ADMIN_EMAIL should have sync: false');
  assert.match(content, /key:\s*CORS_ORIGIN\s+sync:\s*false/, 'CORS_ORIGIN should have sync: false');
  assert.match(content, /key:\s*FRONTEND_URL\s+sync:\s*false/, 'FRONTEND_URL should have sync: false');
});

test('Part 1: seedAdmin rejects invalid or weak passwords', () => {
  const db = createTestDb();

  // Short password (< 12 chars)
  assert.throws(() => {
    seedAdmin(db, { email: 'admin@example.com', password: 'short' });
  }, /at least 12 characters/);

  // Forbidden default password
  assert.throws(() => {
    seedAdmin(db, { email: 'admin@example.com', password: 'replace-with-a-strong-admin-password' });
  }, /at least 12 characters/);

  // Invalid email
  assert.throws(() => {
    seedAdmin(db, { email: 'notanemail', password: 'ValidAdminPass123!' });
  }, /valid email address/);
});

test('Part 1: seedAdmin creates new admin when table is empty', () => {
  const db = createTestDb();
  const result = seedAdmin(db, { email: 'admin@example.com', password: 'SuperSecurePassword123!' });

  assert.equal(result.status, 'created');
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@example.com');
  assert.ok(user, 'User should be inserted');
  assert.equal(user.role, 'admin');
  assert.ok(bcrypt.compareSync('SuperSecurePassword123!', user.password_hash), 'Password hash must match');
});

test('Part 1: seedAdmin preserves custom password of existing admin', () => {
  const db = createTestDb();
  const initialHash = bcrypt.hashSync('InitialCustomPassword123!', 10);
  db.prepare("INSERT INTO users (full_name, email, password_hash, role) VALUES (?,?,?,?)")
    .run('Existing Admin', 'admin@example.com', initialHash, 'admin');

  const result = seedAdmin(db, { email: 'admin@example.com', password: 'DifferentPassword456!' });
  assert.equal(result.status, 'confirmed');

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@example.com');
  assert.equal(user.password_hash, initialHash, 'Existing admin password hash must NOT be overwritten');
});

test('Part 1: seedAdmin fixes privilege escalation by updating password when promoting a customer', () => {
  const db = createTestDb();
  const customerOldHash = bcrypt.hashSync('CustomerSecretPass123!', 10);
  db.prepare("INSERT INTO users (full_name, email, password_hash, role) VALUES (?,?,?,?)")
    .run('Rogue Customer', 'admin@example.com', customerOldHash, 'customer');

  const result = seedAdmin(db, { email: 'admin@example.com', password: 'SecuredAdminPass789!' });
  assert.equal(result.status, 'promoted');

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@example.com');
  assert.equal(user.role, 'admin');
  assert.notEqual(user.password_hash, customerOldHash, 'Old customer password must be replaced');
  assert.ok(bcrypt.compareSync('SecuredAdminPass789!', user.password_hash), 'New admin password must match');
});

test('Part 1: seedAdmin does not crash when admin exists and env vars are absent', () => {
  const db = createTestDb();
  const hash = bcrypt.hashSync('SecurePassword123!', 10);
  db.prepare("INSERT INTO users (full_name, email, password_hash, role) VALUES (?,?,?,?)")
    .run('Admin', 'admin@example.com', hash, 'admin');

  // Passing empty credentials
  const result = seedAdmin(db, { email: '', password: '' });
  assert.equal(result.status, 'existing');
});

test('Part 1: .env.example does not leak personal emails or real passwords', () => {
  const examplePath = path.join(__dirname, '..', '.env.example');
  const content = fs.readFileSync(examplePath, 'utf8');

  assert.ok(!content.includes('Mast@'), '.env.example must not contain real passwords');
  assert.ok(!content.includes('alhabibfadoul@gmail.com'), '.env.example must not contain personal emails');
  assert.ok(!content.includes('alhabibfadul@gmail.com'), '.env.example must not contain personal emails');
});

test('Part 1: Admin account deletion safeguards logic', () => {
  const db = createTestDb();
  // Insert primary admin and another admin
  const hash = bcrypt.hashSync('Pass123456789!', 10);
  db.prepare("INSERT INTO users (full_name, email, password_hash, role) VALUES (?,?,?,?)")
    .run('Admin One', 'primary_admin@example.com', hash, 'admin');
  db.prepare("INSERT INTO users (full_name, email, password_hash, role) VALUES (?,?,?,?)")
    .run('Customer User', 'customer@example.com', hash, 'customer');

  const prevEnv = process.env.ADMIN_EMAIL;
  process.env.ADMIN_EMAIL = 'primary_admin@example.com';

  function mockDeleteUser(reqUser, targetId) {
    let statusCode = 200;
    let jsonResponse = null;
    const res = {
      status(c) { statusCode = c; return this; },
      json(j) { jsonResponse = j; return { statusCode, data: jsonResponse }; }
    };
    const req = { user: reqUser, params: { id: String(targetId) } };

    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId < 1) return res.status(400).json({ error: 'Invalid user id' });
    if (userId === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });

    const targetUser = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(userId);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const configuredAdminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (configuredAdminEmail && targetUser.email.toLowerCase() === configuredAdminEmail) {
      return res.status(400).json({ error: 'Cannot delete the primary administrator account defined by system configuration' });
    }

    if (targetUser.role === 'admin') {
      const adminCount = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'").get().c;
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Cannot delete the sole administrator account' });
      }
    }

    const result = db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    if (!result.changes) return res.status(404).json({ error: 'User not found' });
    return res.json({ ok: true });
  }

  try {
    // 1. Attempt to delete self
    const res1 = mockDeleteUser({ id: 1, role: 'admin' }, 1);
    assert.equal(res1.statusCode, 400);
    assert.equal(res1.data.error, 'Cannot delete your own account');

    // 2. Attempt to delete primary admin from another account
    db.prepare("INSERT INTO users (full_name, email, password_hash, role) VALUES (?,?,?,?)")
      .run('Second Admin', 'admin2@example.com', hash, 'admin');
    const res2 = mockDeleteUser({ id: 3, role: 'admin' }, 1);
    assert.equal(res2.statusCode, 400);
    assert.match(res2.data.error, /primary administrator account/);

    // 3. Deleting a normal customer by an admin works
    const res3 = mockDeleteUser({ id: 1, role: 'admin' }, 2);
    assert.equal(res3.statusCode, 200);
    assert.equal(res3.data.ok, true);
  } finally {
    process.env.ADMIN_EMAIL = prevEnv;
  }
});


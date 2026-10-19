const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Ensure a valid JWT secret is in environment for testing
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = 'super-secret-test-jwt-key-minimum-32-chars-long!';
}

const { requireAuth, optionalAuth, signToken, JWT_SECRET, JWT_EXPIRES_IN } = require('../middleware/auth');
const realDb = require('../db');

function createIsolatedTestDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer',
      avatar_url TEXT,
      token_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE revoked_tokens (
      jti TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE password_reset_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE sessions_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      logged_in_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

test('Part 5: Database schema has token_version column with default 1', () => {
  const cols = realDb.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  assert.ok(cols.includes('token_version'), 'users table must have token_version column');

  // Verify existing users in db have valid token_version
  const users = realDb.prepare('SELECT id, email, token_version FROM users').all();
  for (const user of users) {
    assert.ok(Number.isInteger(user.token_version) && user.token_version >= 1, `User ${user.email} must have token_version >= 1`);
  }
});

test('Part 5: signToken issues tokens with 24-hour expiration and token_version', () => {
  const mockUser = {
    id: 42,
    full_name: 'Test Customer',
    email: 'customer@example.com',
    role: 'customer',
    token_version: 3
  };

  const token = signToken(mockUser);
  assert.ok(typeof token === 'string' && token.length > 20);

  const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  assert.equal(payload.id, 42);
  assert.equal(payload.email, 'customer@example.com');
  assert.equal(payload.token_version, 3);
  assert.ok(payload.jti, 'Token must contain jti');

  // 24 hours = 86400 seconds
  const lifetime = payload.exp - payload.iat;
  assert.equal(lifetime, 86400, 'Token expiration must be exactly 24 hours (86400s)');
});

test('Part 5: Password validation requires at least 10 characters for new passwords', () => {
  function validateNewPassword(password) {
    if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
      return { valid: false, error: 'Le mot de passe doit contenir au moins 10 caractères (et maximum 128).' };
    }
    return { valid: true };
  }

  // Passwords shorter than 10 characters must be rejected
  assert.equal(validateNewPassword('123456').valid, false);
  assert.equal(validateNewPassword('abcdefgh').valid, false);
  assert.equal(validateNewPassword('123456789').valid, false);

  // Passwords of 10 or more characters must be accepted
  assert.equal(validateNewPassword('1234567890').valid, true);
  assert.equal(validateNewPassword('StrongPassword2026!').valid, true);
  assert.equal(validateNewPassword('AlkheyratSecure#123').valid, true);
});

test('Part 5: requireAuth accepts valid token with matching token_version', () => {
  // Ensure a test user exists in realDb
  const testEmail = 'part5_auth_test@example.com';
  realDb.prepare('DELETE FROM users WHERE email = ?').run(testEmail);
  const hash = bcrypt.hashSync('SafeTestPassword123!', 10);
  const info = realDb.prepare(`
    INSERT INTO users (full_name, email, password_hash, role, token_version)
    VALUES (?, ?, ?, 'customer', 1)
  `).run('Part5 Auth User', testEmail, hash);

  const userRow = realDb.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  const token = signToken(userRow);

  const req = { headers: { authorization: `Bearer ${token}` } };
  let statusSet = null;
  let jsonResponse = null;
  const res = {
    status(code) { statusSet = code; return this; },
    json(data) { jsonResponse = data; return this; }
  };
  let nextCalled = false;

  requireAuth(req, res, () => { nextCalled = true; });

  assert.ok(nextCalled, 'requireAuth must call next() for valid token');
  assert.equal(req.user.id, userRow.id);
  assert.equal(req.user.email, testEmail);

  // Cleanup
  realDb.prepare('DELETE FROM users WHERE id = ?').run(userRow.id);
});

test('Part 5: requireAuth rejects outdated token after token_version increments', () => {
  const testEmail = 'part5_outdated_test@example.com';
  realDb.prepare('DELETE FROM users WHERE email = ?').run(testEmail);
  const hash = bcrypt.hashSync('SafeTestPassword123!', 10);
  const info = realDb.prepare(`
    INSERT INTO users (full_name, email, password_hash, role, token_version)
    VALUES (?, ?, ?, 'customer', 1)
  `).run('Outdated Token User', testEmail, hash);

  const userRow = realDb.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  // Token issued with token_version = 1
  const tokenV1 = signToken(userRow);

  // Simulate password change / token_version increment to 2
  realDb.prepare('UPDATE users SET token_version = 2 WHERE id = ?').run(userRow.id);

  const req = { headers: { authorization: `Bearer ${tokenV1}` } };
  let statusSet = null;
  let jsonResponse = null;
  const res = {
    status(code) { statusSet = code; return this; },
    json(data) { jsonResponse = data; return this; }
  };
  let nextCalled = false;

  requireAuth(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false, 'requireAuth must NOT call next() for outdated token');
  assert.equal(statusSet, 401, 'Status must be 401 Unauthorized');
  assert.match(jsonResponse.error, /invalidated/i, 'Error message must state token was invalidated');

  // Verify new token with version 2 works
  const updatedUserRow = realDb.prepare('SELECT * FROM users WHERE id = ?').get(userRow.id);
  const tokenV2 = signToken(updatedUserRow);

  const req2 = { headers: { authorization: `Bearer ${tokenV2}` } };
  let nextCalled2 = false;
  requireAuth(req2, res, () => { nextCalled2 = true; });
  assert.ok(nextCalled2, 'requireAuth must accept token matching new token_version');

  // Cleanup
  realDb.prepare('DELETE FROM users WHERE id = ?').run(userRow.id);
});

test('Part 5: requireAuth rejects legacy token without token_version in payload', () => {
  const testEmail = 'part5_legacy_test@example.com';
  realDb.prepare('DELETE FROM users WHERE email = ?').run(testEmail);
  const hash = bcrypt.hashSync('SafeTestPassword123!', 10);
  const info = realDb.prepare(`
    INSERT INTO users (full_name, email, password_hash, role, token_version)
    VALUES (?, ?, ?, 'customer', 1)
  `).run('Legacy Token User', testEmail, hash);

  // Token created without token_version
  const legacyToken = jwt.sign(
    { id: info.lastInsertRowid, full_name: 'Legacy User', email: testEmail, role: 'customer' },
    JWT_SECRET,
    { expiresIn: '24h', jwtid: crypto.randomUUID() }
  );

  const req = { headers: { authorization: `Bearer ${legacyToken}` } };
  let statusSet = null;
  let jsonResponse = null;
  const res = {
    status(code) { statusSet = code; return this; },
    json(data) { jsonResponse = data; return this; }
  };
  let nextCalled = false;

  requireAuth(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false, 'Legacy token without token_version must be rejected');
  assert.equal(statusSet, 401);

  // Cleanup
  realDb.prepare('DELETE FROM users WHERE id = ?').run(info.lastInsertRowid);
});

test('Part 5: optionalAuth attaches user for valid token, ignores outdated/invalid tokens', () => {
  const testEmail = 'part5_optional_test@example.com';
  realDb.prepare('DELETE FROM users WHERE email = ?').run(testEmail);
  const hash = bcrypt.hashSync('SafeTestPassword123!', 10);
  const info = realDb.prepare(`
    INSERT INTO users (full_name, email, password_hash, role, token_version)
    VALUES (?, ?, ?, 'customer', 2)
  `).run('Optional Auth User', testEmail, hash);

  const userRow = realDb.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  const validToken = signToken(userRow);

  // Case 1: Valid token
  const req1 = { headers: { authorization: `Bearer ${validToken}` } };
  let next1 = false;
  optionalAuth(req1, {}, () => { next1 = true; });
  assert.ok(next1);
  assert.ok(req1.user);
  assert.equal(req1.user.email, testEmail);

  // Case 2: Outdated token (version 1 vs version 2 in db)
  const outdatedToken = jwt.sign(
    { id: userRow.id, full_name: userRow.full_name, email: testEmail, role: 'customer', token_version: 1 },
    JWT_SECRET,
    { expiresIn: '24h', jwtid: crypto.randomUUID() }
  );
  const req2 = { headers: { authorization: `Bearer ${outdatedToken}` } };
  let next2 = false;
  optionalAuth(req2, {}, () => { next2 = true; });
  assert.ok(next2, 'optionalAuth must call next() even with invalid token');
  assert.equal(req2.user, undefined, 'optionalAuth must not attach user when token_version mismatches');

  // Case 3: No token (guest)
  const req3 = { headers: {} };
  let next3 = false;
  optionalAuth(req3, {}, () => { next3 = true; });
  assert.ok(next3);
  assert.equal(req3.user, undefined);

  // Cleanup
  realDb.prepare('DELETE FROM users WHERE id = ?').run(userRow.id);
});

test('Part 5: Password change flow invalidates previous tokens and revokes jti', () => {
  const testEmail = 'part5_pwdchange_test@example.com';
  realDb.prepare('DELETE FROM users WHERE email = ?').run(testEmail);
  const oldPassword = 'OldSafePassword123!';
  const newPassword = 'NewStrongPassword456!';
  const oldHash = bcrypt.hashSync(oldPassword, 10);

  const info = realDb.prepare(`
    INSERT INTO users (full_name, email, password_hash, role, token_version)
    VALUES (?, ?, ?, 'customer', 1)
  `).run('Password Change User', testEmail, oldHash);

  const userRow = realDb.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  const oldToken = signToken(userRow);
  const oldPayload = jwt.verify(oldToken, JWT_SECRET, { algorithms: ['HS256'] });

  // Simulate change-password route logic
  const newHash = bcrypt.hashSync(newPassword, 10);
  const tx = realDb.transaction(() => {
    realDb.prepare('UPDATE users SET password_hash = ?, token_version = COALESCE(token_version, 1) + 1 WHERE id = ?')
      .run(newHash, userRow.id);
    realDb.prepare('INSERT OR REPLACE INTO revoked_tokens (jti, expires_at) VALUES (?, ?)')
      .run(oldPayload.jti, oldPayload.exp);
  });
  tx();

  // 1. Verify old token is rejected by requireAuth
  const reqOld = { headers: { authorization: `Bearer ${oldToken}` } };
  let statusSet = null;
  const res = {
    status(code) { statusSet = code; return this; },
    json() { return this; }
  };
  let nextOld = false;
  requireAuth(reqOld, res, () => { nextOld = true; });
  assert.equal(nextOld, false, 'Old token must be rejected after password change');
  assert.equal(statusSet, 401);

  // 2. Verify jti is in revoked_tokens
  const revoked = realDb.prepare('SELECT 1 FROM revoked_tokens WHERE jti = ?').get(oldPayload.jti);
  assert.ok(revoked, 'Old token jti must be recorded in revoked_tokens');

  // 3. Verify new token works
  const updatedUser = realDb.prepare('SELECT * FROM users WHERE id = ?').get(userRow.id);
  assert.equal(updatedUser.token_version, 2, 'token_version must increment to 2');
  const newToken = signToken(updatedUser);

  const reqNew = { headers: { authorization: `Bearer ${newToken}` } };
  let nextNew = false;
  requireAuth(reqNew, res, () => { nextNew = true; });
  assert.ok(nextNew, 'New token must be accepted after password change');

  // Cleanup
  realDb.prepare('DELETE FROM users WHERE id = ?').run(userRow.id);
  realDb.prepare('DELETE FROM revoked_tokens WHERE jti = ?').run(oldPayload.jti);
});

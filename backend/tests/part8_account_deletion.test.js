const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const bcrypt = require('bcryptjs');

// Ensure test JWT secret
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = 'super-secret-test-jwt-key-minimum-32-chars-long!';
}

const { app } = require('../server');
const db = require('../db');
const { signToken } = require('../middleware/auth');

test('Part 8: DELETE /api/auth/me requires authentication (401)', async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: 'AnyPassword123!' })
    });

    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

test('Part 8: DELETE /api/auth/me requires current_password in body (400)', async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  // Create temporary user
  const email = `test-pwd-req-${Date.now()}@example.com`;
  const hash = bcrypt.hashSync('Password123!', 10);
  const ins = db.prepare('INSERT INTO users (full_name, email, password_hash, role, token_version) VALUES (?, ?, ?, ?, 1)')
    .run('Test User', email, hash, 'customer');
  const userId = ins.lastInsertRowid;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const token = signToken(user);

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({}) // Missing current_password
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /mot de passe/i);

    // User should still exist
    const stillThere = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    assert.ok(stillThere);
  } finally {
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    server.close();
  }
});

test('Part 8: DELETE /api/auth/me rejects invalid current_password (400)', async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const email = `test-wrong-pwd-${Date.now()}@example.com`;
  const hash = bcrypt.hashSync('CorrectPassword123!', 10);
  const ins = db.prepare('INSERT INTO users (full_name, email, password_hash, role, token_version) VALUES (?, ?, ?, ?, 1)')
    .run('Wrong Password User', email, hash, 'customer');
  const userId = ins.lastInsertRowid;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const token = signToken(user);

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ current_password: 'WrongPassword999!' })
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /incorrect/i);

    // Verify user is not deleted
    const stillThere = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    assert.ok(stillThere);
  } finally {
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    server.close();
  }
});

test('Part 8: DELETE /api/auth/me protects primary admin from accidental deletion (403)', async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const originalAdminEmail = process.env.ADMIN_EMAIL;
  const adminEmail = `primary-admin-${Date.now()}@example.com`;
  process.env.ADMIN_EMAIL = adminEmail;

  const hash = bcrypt.hashSync('AdminPassword123!', 10);
  const ins = db.prepare('INSERT INTO users (full_name, email, password_hash, role, token_version) VALUES (?, ?, ?, ?, 1)')
    .run('Primary Admin', adminEmail, hash, 'admin');
  const userId = ins.lastInsertRowid;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const token = signToken(user);

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ current_password: 'AdminPassword123!' })
    });

    assert.equal(res.status, 403);
    const data = await res.json();
    assert.match(data.error, /administrateur principal/i);

    // Verify admin is still in database
    const stillThere = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    assert.ok(stillThere);
  } finally {
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    process.env.ADMIN_EMAIL = originalAdminEmail;
    server.close();
  }
});

test('Part 8: Customer account deletion permanently removes user, revokes token, and preserves orders anonymously', async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const email = `delete-success-${Date.now()}@example.com`;
  const plainPassword = 'CustomerSecurePassword123!';
  const hash = bcrypt.hashSync(plainPassword, 10);

  // 1. Create customer
  const insUser = db.prepare(`
    INSERT INTO users (full_name, email, phone, password_hash, role, token_version)
    VALUES (?, ?, ?, ?, 'customer', 1)
  `).run('Jean Dupont', email, '+235 66 12 34 56', hash);
  const userId = insUser.lastInsertRowid;

  // 2. Attach an order and a message
  const insOrder = db.prepare(`
    INSERT INTO orders (user_id, service, details, status)
    VALUES (?, 'pompe-forage', 'Forage avec pompe solaire 3HP', 'pending')
  `).run(userId);
  const orderId = insOrder.lastInsertRowid;

  const insMsg = db.prepare(`
    INSERT INTO messages (user_id, subject, body, status)
    VALUES (?, 'Question technique', 'Besoin de devis pour raccordement', 'new')
  `).run(userId);
  const msgId = insMsg.lastInsertRowid;

  // Add session log entry
  db.prepare('INSERT INTO sessions_log (user_id) VALUES (?)').run(userId);

  // Sign token
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const token = signToken(user);

  try {
    // 3. Request account deletion
    const res = await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ current_password: plainPassword })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.match(data.message, /supprimés avec succès/i);

    // 4. Verify user record is completely removed
    const deletedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    assert.equal(deletedUser, undefined, 'User row must be removed from users table');

    // 5. Verify sessions_log was purged
    const sessions = db.prepare('SELECT * FROM sessions_log WHERE user_id = ?').all(userId);
    assert.equal(sessions.length, 0, 'User sessions must be purged');

    // 6. Verify order was NOT deleted (legal retention), but detached and anonymized
    const preservedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    assert.ok(preservedOrder, 'Order must be retained for legal/accounting obligations');
    assert.equal(preservedOrder.user_id, null, 'user_id in order must be null');
    assert.equal(preservedOrder.guest_name, 'Jean Dupont', 'guest_name must preserve customer name');
    assert.equal(preservedOrder.guest_email, email, 'guest_email must preserve customer email');
    assert.equal(preservedOrder.guest_phone, '+235 66 12 34 56', 'guest_phone must preserve customer phone');

    // 7. Verify message was detached
    const preservedMsg = db.prepare('SELECT * FROM messages WHERE id = ?').get(msgId);
    assert.ok(preservedMsg, 'Message must be retained');
    assert.equal(preservedMsg.user_id, null, 'user_id in message must be null');
    assert.equal(preservedMsg.guest_name, 'Jean Dupont');

    // 8. Verify token cannot be reused
    const meRes = await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.equal(meRes.status, 401, 'Revoked token must be rejected with 401');
  } finally {
    // Cleanup order and message created during test
    db.prepare('DELETE FROM orders WHERE id = ?').run(orderId);
    db.prepare('DELETE FROM messages WHERE id = ?').run(msgId);
    server.close();
  }
});

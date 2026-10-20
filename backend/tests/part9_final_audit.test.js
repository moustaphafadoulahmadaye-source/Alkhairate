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
const { calculateVerifiedOrderTotal } = require('../routes/orders');

test('Part 9: calculateVerifiedOrderTotal recalculates authentic price and blocks price tampering', () => {
  // Grab a couple of real product items from DB
  const items = db.prepare('SELECT id, price, currency FROM product_items LIMIT 2').all();
  assert.ok(items.length >= 2, 'Need at least 2 product items in DB');

  const expectedTotal = (items[0].price * 2) + (items[1].price * 3);

  // Client attempts to send forged total = 50 XAF instead of expectedTotal
  const verified = calculateVerifiedOrderTotal({
    items: [
      { id: items[0].id, quantity: 2 },
      { id: items[1].id, quantity: 3 }
    ],
    clientTotal: 50, // Tampered price
    clientCurrency: 'USD'
  });

  assert.equal(verified.total, expectedTotal, 'Server must enforce authentic database price');
  assert.equal(verified.isVerified, true);
  assert.equal(verified.currency, items[0].currency || 'XAF');
});

test('Part 9: calculateVerifiedOrderTotal rejects nonexistent product items (400)', () => {
  assert.throws(() => {
    calculateVerifiedOrderTotal({
      items: [{ id: 999999, quantity: 1 }]
    });
  }, /introuvable en stock/i);
});

test('Part 9: calculateVerifiedOrderTotal adds extra selected pump price from database', () => {
  const pumpItem = db.prepare("SELECT id, price FROM product_items WHERE product_id IN (SELECT id FROM products WHERE service_slug = 'vente-pompes') LIMIT 1").get()
    || db.prepare('SELECT id, price FROM product_items LIMIT 1').get();

  const verified = calculateVerifiedOrderTotal({
    items: [],
    selected_pump_id: pumpItem.id,
    clientTotal: 10 // Tampered
  });

  assert.equal(verified.total, pumpItem.price);
  assert.equal(verified.isVerified, true);
});

test('Part 9: POST /api/orders enforces server-side recalculated price over forged client total', async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  // Create temporary customer
  const email = `audit-customer-${Date.now()}@example.com`;
  const hash = bcrypt.hashSync('SecurePassword123!', 10);
  const insUser = db.prepare('INSERT INTO users (full_name, email, password_hash, role, token_version) VALUES (?, ?, ?, ?, 1)')
    .run('Audit Customer', email, hash, 'customer');
  const userId = insUser.lastInsertRowid;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const token = signToken(user);

  // Get a product item
  const item = db.prepare('SELECT id, price, currency FROM product_items LIMIT 1').get();
  assert.ok(item, 'Product item must exist');
  const expectedTotal = item.price * 3;

  let createdOrderId = null;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        service: 'commerce-general',
        details: 'Commande audit test',
        quantity: 3,
        total: 1, // Tampered client total: 1 XAF!
        currency: 'XAF',
        items: [{ id: item.id, quantity: 3 }]
      })
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.order);
    createdOrderId = data.order.id;

    // Check DB row: total must be the true recalculated price, NOT 1
    const dbOrder = db.prepare('SELECT total, currency FROM orders WHERE id = ?').get(createdOrderId);
    assert.equal(dbOrder.total, expectedTotal, 'Stored order total must be server recalculated total');
    assert.notEqual(dbOrder.total, 1, 'Tampered price must NOT be saved');
  } finally {
    if (createdOrderId) db.prepare('DELETE FROM orders WHERE id = ?').run(createdOrderId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    server.close();
  }
});

test('Part 9: E2E Auth flow - register, login, profile view, and role isolation', async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const testEmail = `e2e-reg-${Date.now()}@example.com`;
  const plainPassword = 'AuditStrongPassword123!';

  let testUserId = null;

  try {
    // 1. Weak password rejected
    const weakRes = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Audit User',
        email: testEmail,
        password: 'short',
        password_confirmation: 'short'
      })
    });
    assert.equal(weakRes.status, 400);

    // 2. Valid registration
    const regRes = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Audit User',
        email: testEmail,
        password: plainPassword,
        password_confirmation: plainPassword
      })
    });
    assert.equal(regRes.status, 201);
    const regData = await regRes.json();
    assert.ok(regData.token);
    assert.equal(regData.user.email, testEmail);
    testUserId = regData.user.id;

    // 3. Login with correct password
    const loginRes = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: plainPassword
      })
    });
    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.ok(loginData.token);

    // 4. Access protected profile /api/auth/me
    const meRes = await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${loginData.token}` }
    });
    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.user.id, testUserId);
    assert.equal(meData.user.role, 'customer');

    // 5. Customer token rejected on admin-only route (403)
    const adminRes = await fetch(`http://127.0.0.1:${port}/api/admin/orders`, {
      headers: { 'Authorization': `Bearer ${loginData.token}` }
    });
    assert.equal(adminRes.status, 403, 'Customer token must be forbidden on admin route');
  } finally {
    if (testUserId) {
      db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
    }
    server.close();
  }
});

test('Part 9: Public catalog APIs respond with products and services', async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    // 1. Services
    const servicesRes = await fetch(`http://127.0.0.1:${port}/api/services`);
    assert.equal(servicesRes.status, 200);
    const servicesData = await servicesRes.json();
    assert.ok(Array.isArray(servicesData.services));
    assert.ok(servicesData.services.length > 0);

    // 2. Products
    const productsRes = await fetch(`http://127.0.0.1:${port}/api/products`);
    assert.equal(productsRes.status, 200);
    const productsData = await productsRes.json();
    assert.ok(Array.isArray(productsData.products));
    assert.ok(productsData.products.length > 0);
  } finally {
    server.close();
  }
});

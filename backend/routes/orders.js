const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { sanitizeSlug, sanitizeText } = require('../utils/sanitize');
const { notify, sendOrderConfirmation, sendAdminNotification } = require('../services/email');
const router = express.Router();

// Create an order - login required
router.post('/', requireAuth, (req, res) => {
  const { service, details, quantity, total, currency } = req.body || {};
  const safeService = typeof service === 'string' ? sanitizeSlug(service) : '';
  const safeDetails = sanitizeText(details, { maxLength: 5000 });
  const safeQuantity = typeof quantity === 'string' || typeof quantity === 'number' ? sanitizeText(quantity, { maxLength: 80 }) : null;
  const safeCurrency = typeof currency === 'string' ? sanitizeText(currency, { maxLength: 3 }).toUpperCase() : 'XAF';

  if (!safeService) return res.status(400).json({ error: 'service is required' });
  if (!db.prepare('SELECT 1 FROM services WHERE slug = ?').get(safeService)) {
    return res.status(400).json({ error: 'service must be a valid service' });
  }
  if (!safeDetails || safeDetails.length > 5000) {
    return res.status(400).json({ error: 'details must be between 1 and 5000 characters' });
  }
  const numericTotal = total === '' || total == null ? null : Number(total);
  if (numericTotal !== null && (!Number.isFinite(numericTotal) || numericTotal < 0)) {
    return res.status(400).json({ error: 'total must be a non-negative number' });
  }
  if (safeQuantity !== null && safeQuantity.length > 80) return res.status(400).json({ error: 'quantity is too long' });
  if (!/^[A-Z]{3}$/.test(safeCurrency)) return res.status(400).json({ error: 'currency must be a 3-letter code' });
  const info = db.prepare(
    'INSERT INTO orders (user_id, service, details, quantity, total, currency, status) VALUES (?,?,?,?,?,?,?)'
  ).run(req.user.id, safeService, safeDetails, safeQuantity || null, numericTotal, safeCurrency, 'pending');
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(info.lastInsertRowid);
  const emailOrder = { ...order, full_name: req.user.full_name, email: req.user.email };
  notify(() => sendOrderConfirmation(emailOrder), 'order confirmation');
  notify(() => sendAdminNotification('New order received', `Order #${order.id} from ${req.user.full_name} <${req.user.email}>\n${safeService}\n${safeDetails}`), 'new order email');
  res.status(201).json({ order });
});

// List my own orders - login required
router.get('/mine', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json({ orders: rows });
});

// Guest order - no login required
router.post('/guest', (req, res) => {
  const { service, details, quantity, total, currency, guest_name, guest_phone, guest_email } = req.body || {};
  const safeService = typeof service === 'string' ? sanitizeSlug(service) : '';
  const safeDetails = sanitizeText(details, { maxLength: 5000 });
  const safeName = typeof guest_name === 'string' ? sanitizeText(guest_name, { maxLength: 200 }) : '';
  const safePhone = typeof guest_phone === 'string' ? sanitizeText(guest_phone, { maxLength: 50 }) : '';
  const safeEmail = typeof guest_email === 'string' ? sanitizeText(guest_email, { maxLength: 200 }) : '';
  const safeQuantity = typeof quantity === 'string' || typeof quantity === 'number' ? sanitizeText(quantity, { maxLength: 80 }) : null;
  const safeCurrency = typeof currency === 'string' ? sanitizeText(currency, { maxLength: 3 }).toUpperCase() : 'XAF';

  if (!safeName) return res.status(400).json({ error: 'Nom complet requis / Full name is required' });
  if (!safePhone) return res.status(400).json({ error: 'Téléphone requis / Phone is required' });
  if (!safeService) return res.status(400).json({ error: 'service is required' });
  if (!db.prepare('SELECT 1 FROM services WHERE slug = ?').get(safeService)) {
    return res.status(400).json({ error: 'service must be a valid service' });
  }
  if (!safeDetails || safeDetails.length > 5000) {
    return res.status(400).json({ error: 'details must be between 1 and 5000 characters' });
  }
  const numericTotal = total === '' || total == null ? null : Number(total);
  if (numericTotal !== null && (!Number.isFinite(numericTotal) || numericTotal < 0)) {
    return res.status(400).json({ error: 'total must be a non-negative number' });
  }
  if (safeQuantity !== null && safeQuantity.length > 80) return res.status(400).json({ error: 'quantity is too long' });
  if (!/^[A-Z]{3}$/.test(safeCurrency)) return res.status(400).json({ error: 'currency must be a 3-letter code' });

  const info = db.prepare(
    'INSERT INTO orders (user_id, guest_name, guest_phone, guest_email, service, details, quantity, total, currency, status) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(null, safeName, safePhone, safeEmail || null, safeService, safeDetails, safeQuantity || null, numericTotal, safeCurrency, 'pending');
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(info.lastInsertRowid);
  notify(() => sendAdminNotification('New guest order received', `Order #${order.id} from ${safeName} (${safePhone})\n${safeEmail ? 'Email: ' + safeEmail + '\n' : ''}${safeService}\n${safeDetails}`), 'new guest order email');
  res.status(201).json({ order });
});

module.exports = router;

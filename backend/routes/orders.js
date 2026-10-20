const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { sanitizeSlug, sanitizeText } = require('../utils/sanitize');
const { notify, sendOrderConfirmation, sendAdminNotification } = require('../services/email');
const router = express.Router();

/**
 * Recalculates order total server-side by checking real database prices in product_items.
 * Prevents client-side price tampering before any online or on-delivery payment.
 */
function calculateVerifiedOrderTotal({ items, selected_pump_id, clientTotal, clientCurrency }) {
  let computedTotal = 0;
  let hasDatabaseItems = false;
  let resolvedCurrency = 'XAF';

  // 1. Recalculate from catalog product items
  if (Array.isArray(items) && items.length > 0) {
    hasDatabaseItems = true;
    for (const item of items) {
      const itemId = Number(item.id);
      const qty = Math.max(1, Math.min(1000, Number(item.quantity) || 1));
      if (!Number.isInteger(itemId) || itemId <= 0) {
        throw new Error('Identifiant de produit invalide dans la commande');
      }
      const dbItem = db.prepare('SELECT price, currency FROM product_items WHERE id = ?').get(itemId);
      if (!dbItem) {
        throw new Error(`Produit introuvable en stock (ID: ${itemId})`);
      }
      computedTotal += (Number(dbItem.price) || 0) * qty;
      if (dbItem.currency) resolvedCurrency = dbItem.currency;
    }
  }

  // 2. Add extra selected pump price from database if present
  if (selected_pump_id) {
    const pumpId = Number(selected_pump_id);
    if (Number.isInteger(pumpId) && pumpId > 0) {
      const pumpItem = db.prepare('SELECT price, currency FROM product_items WHERE id = ?').get(pumpId);
      if (pumpItem) {
        hasDatabaseItems = true;
        computedTotal += (Number(pumpItem.price) || 0);
        if (pumpItem.currency) resolvedCurrency = pumpItem.currency;
      }
    }
  }

  // 3. If database items were ordered, enforce server-computed total
  if (hasDatabaseItems) {
    return {
      total: computedTotal,
      currency: resolvedCurrency,
      isVerified: true
    };
  }

  // 4. Pure custom services (e.g. quote requests, custom installation)
  const numericTotal = clientTotal === '' || clientTotal == null ? null : Number(clientTotal);
  if (numericTotal !== null && (!Number.isFinite(numericTotal) || numericTotal < 0)) {
    throw new Error('Le total doit être un nombre positif');
  }

  const safeCurrency = typeof clientCurrency === 'string' ? sanitizeText(clientCurrency, { maxLength: 3 }).toUpperCase() : 'XAF';
  if (!/^[A-Z]{3}$/.test(safeCurrency)) {
    throw new Error('Le code de devise doit comporter 3 lettres (ex: XAF)');
  }

  return {
    total: numericTotal,
    currency: safeCurrency,
    isVerified: false
  };
}

// Create an order - login required
router.post('/', requireAuth, (req, res) => {
  const { service, details, quantity, total, currency, items, selected_pump_id } = req.body || {};
  const safeService = typeof service === 'string' ? sanitizeSlug(service) : '';
  const safeDetails = sanitizeText(details, { maxLength: 5000 });
  const safeQuantity = typeof quantity === 'string' || typeof quantity === 'number' ? sanitizeText(quantity, { maxLength: 80 }) : null;

  if (!safeService) return res.status(400).json({ error: 'service is required' });
  if (!db.prepare('SELECT 1 FROM services WHERE slug = ?').get(safeService)) {
    return res.status(400).json({ error: 'service must be a valid service' });
  }
  if (!safeDetails || safeDetails.length > 5000) {
    return res.status(400).json({ error: 'details must be between 1 and 5000 characters' });
  }

  let verifiedOrder;
  try {
    verifiedOrder = calculateVerifiedOrderTotal({
      items,
      selected_pump_id,
      clientTotal: total,
      clientCurrency: currency
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  if (safeQuantity !== null && safeQuantity.length > 80) return res.status(400).json({ error: 'quantity is too long' });

  const info = db.prepare(
    'INSERT INTO orders (user_id, service, details, quantity, total, currency, status) VALUES (?,?,?,?,?,?,?)'
  ).run(req.user.id, safeService, safeDetails, safeQuantity || null, verifiedOrder.total, verifiedOrder.currency, 'pending');
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
  const { service, details, quantity, total, currency, items, selected_pump_id, guest_name, guest_phone, guest_email } = req.body || {};
  const safeService = typeof service === 'string' ? sanitizeSlug(service) : '';
  const safeDetails = sanitizeText(details, { maxLength: 5000 });
  const safeName = typeof guest_name === 'string' ? sanitizeText(guest_name, { maxLength: 200 }) : '';
  const safePhone = typeof guest_phone === 'string' ? sanitizeText(guest_phone, { maxLength: 50 }) : '';
  const safeEmail = typeof guest_email === 'string' ? sanitizeText(guest_email, { maxLength: 200 }) : '';
  const safeQuantity = typeof quantity === 'string' || typeof quantity === 'number' ? sanitizeText(quantity, { maxLength: 80 }) : null;

  if (!safeName) return res.status(400).json({ error: 'Nom complet requis / Full name is required' });
  if (!safePhone) return res.status(400).json({ error: 'Téléphone requis / Phone is required' });
  if (!safeService) return res.status(400).json({ error: 'service is required' });
  if (!db.prepare('SELECT 1 FROM services WHERE slug = ?').get(safeService)) {
    return res.status(400).json({ error: 'service must be a valid service' });
  }
  if (!safeDetails || safeDetails.length > 5000) {
    return res.status(400).json({ error: 'details must be between 1 and 5000 characters' });
  }

  let verifiedOrder;
  try {
    verifiedOrder = calculateVerifiedOrderTotal({
      items,
      selected_pump_id,
      clientTotal: total,
      clientCurrency: currency
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  if (safeQuantity !== null && safeQuantity.length > 80) return res.status(400).json({ error: 'quantity is too long' });

  const info = db.prepare(
    'INSERT INTO orders (user_id, guest_name, guest_phone, guest_email, service, details, quantity, total, currency, status) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(null, safeName, safePhone, safeEmail || null, safeService, safeDetails, safeQuantity || null, verifiedOrder.total, verifiedOrder.currency, 'pending');
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(info.lastInsertRowid);
  notify(() => sendAdminNotification('New guest order received', `Order #${order.id} from ${safeName} (${safePhone})\n${safeEmail ? 'Email: ' + safeEmail + '\n' : ''}${safeService}\n${safeDetails}`), 'new guest order email');
  res.status(201).json({ order });
});

router.calculateVerifiedOrderTotal = calculateVerifiedOrderTotal;
module.exports = router;

const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { notify, sendOrderStatus } = require('../services/email');
const router = express.Router();

const ORDER_STATUS_ALIASES = { processing: 'confirmed', ready: 'shipped', completed: 'delivered' };
const ORDER_STATUS_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: []
};

function normalizeOrderStatus(status) {
  if (typeof status !== 'string') return status;
  return ORDER_STATUS_ALIASES[status] || status;
}

function isValidOrderStatusTransition(currentStatus, nextStatus) {
  const normalizedCurrent = normalizeOrderStatus(currentStatus);
  const normalizedNext = normalizeOrderStatus(nextStatus);
  if (!normalizedCurrent || !normalizedNext) return false;
  const allowed = ORDER_STATUS_TRANSITIONS[normalizedCurrent] || [];
  return allowed.includes(normalizedNext);
}

router.use(requireAuth, requireAdmin);

// Dashboard summary
router.get('/summary', (req, res) => {
  const usersCount = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  const ordersCount = db.prepare('SELECT COUNT(*) c FROM orders').get().c;
  const messagesCount = db.prepare('SELECT COUNT(*) c FROM messages').get().c;
  const pendingOrders = db.prepare("SELECT COUNT(*) c FROM orders WHERE status = 'pending'").get().c;
  const newMessages = db.prepare("SELECT COUNT(*) c FROM messages WHERE status = 'new'").get().c;
  const productsCount = db.prepare('SELECT COUNT(*) c FROM products').get().c;
  const recentLogins = db.prepare(`
    SELECT sl.id, sl.logged_in_at, u.full_name, u.email
    FROM sessions_log sl JOIN users u ON u.id = sl.user_id
    ORDER BY sl.logged_in_at DESC LIMIT 10
  `).all();
  res.json({ usersCount, ordersCount, messagesCount, pendingOrders, newMessages, productsCount, recentLogins });
});

// All registered users (who signed up / who is registered)
router.get('/users', (req, res) => {
  const rows = db.prepare('SELECT id, full_name, email, phone, role, created_at FROM users ORDER BY created_at DESC').all();
  res.json({ users: rows });
});

// Delete a user (cannot delete yourself, primary admin, or sole remaining admin)
router.delete('/users/:id', (req, res) => {
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
  res.json({ ok: true });
});

// All orders, with the customer's name/email (supports guest orders)
router.get('/orders', (req, res) => {
  const rows = db.prepare(`
    SELECT o.*, 
      COALESCE(u.full_name, o.guest_name) AS full_name, 
      COALESCE(u.email, o.guest_email) AS email, 
      COALESCE(u.phone, o.guest_phone) AS phone,
      CASE WHEN o.user_id IS NULL THEN 1 ELSE 0 END AS is_guest
    FROM orders o LEFT JOIN users u ON u.id = o.user_id
    ORDER BY o.created_at DESC
  `).all();
  res.json({ orders: rows });
});

// Update an order's status
router.patch('/orders/:id', (req, res) => {
  const { status } = req.body;
  const normalizedStatus = normalizeOrderStatus(status);
  const allowed = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
  if (!allowed.includes(normalizedStatus)) return res.status(400).json({ error: 'Invalid status' });

  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId < 1) return res.status(400).json({ error: 'Invalid order id' });

  const currentOrder = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId);
  if (!currentOrder) return res.status(404).json({ error: 'Order not found' });

  if (!isValidOrderStatusTransition(currentOrder.status, normalizedStatus)) {
    return res.status(400).json({
      error: `Invalid status transition from ${currentOrder.status} to ${normalizedStatus}`
    });
  }

  const result = db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(normalizedStatus, orderId);
  if (!result.changes) return res.status(404).json({ error: 'Order not found' });
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  const customer = order.user_id ? db.prepare('SELECT full_name, email FROM users WHERE id = ?').get(order.user_id) : null;
  if (customer) notify(() => sendOrderStatus({ ...order, ...customer }), 'order status email');
  if (order.user_id) {
    try {
      const { sendOrderStatusPushNotification } = require('../services/push');
      sendOrderStatusPushNotification(order.user_id, order, normalizedStatus).catch(e => {
        console.error('[Push Notification Error]:', e.message);
      });
    } catch(e) {}
  }
  res.json({ order });
});

// All messages, with the customer's name/email
router.get('/messages', (req, res) => {
  const rows = db.prepare(`
    SELECT m.*, 
      COALESCE(u.full_name, m.guest_name) AS full_name, 
      COALESCE(u.email, m.guest_email) AS email, 
      COALESCE(u.phone, m.guest_phone) AS phone
    FROM messages m LEFT JOIN users u ON u.id = m.user_id
    ORDER BY m.created_at DESC
  `).all();
  res.json({ messages: rows });
});

// Mark a message read/replied
router.patch('/messages/:id', (req, res) => {
  const { status } = req.body;
  const allowed = ['new', 'read', 'replied'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const messageId = Number(req.params.id);
  if (!Number.isInteger(messageId) || messageId < 1) return res.status(400).json({ error: 'Invalid message id' });
  const result = db.prepare('UPDATE messages SET status = ? WHERE id = ?').run(status, messageId);
  if (!result.changes) return res.status(404).json({ error: 'Message not found' });
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
  res.json({ message });
});

// Recent logins (who is signed in / has signed in)
router.get('/sessions', (req, res) => {
  const rows = db.prepare(`
    SELECT sl.id, sl.logged_in_at, u.full_name, u.email
    FROM sessions_log sl JOIN users u ON u.id = sl.user_id
    ORDER BY sl.logged_in_at DESC LIMIT 100
  `).all();
  res.json({ sessions: rows });
});

// Settings update
router.post('/settings', (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'Key is required' });

  if (key.startsWith('service_')) {
    const slug = key.replace('service_', '');
    db.prepare('UPDATE services SET image_url = ? WHERE slug = ?').run(value || '', slug);
  } else {
    if (!value) {
      db.prepare('DELETE FROM site_settings WHERE key = ?').run(key);
    } else {
      db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
    }
  }
  res.json({ ok: true });
});

router.delete('/settings/:key', (req, res) => {
  const { key } = req.params;
  if (!key) return res.status(400).json({ error: 'Key is required' });

  if (key.startsWith('service_')) {
    const slug = key.replace('service_', '');
    db.prepare('UPDATE services SET image_url = "" WHERE slug = ?').run(slug);
  } else {
    db.prepare('DELETE FROM site_settings WHERE key = ?').run(key);
  }
  res.json({ ok: true });
});

module.exports = router;

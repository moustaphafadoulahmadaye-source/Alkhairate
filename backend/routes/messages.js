const express = require('express');
const db = require('../db');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const { sanitizeText } = require('../utils/sanitize');
const { notify, sendMessageConfirmation, sendAdminNotification } = require('../services/email');
const router = express.Router();

function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    const user = db.prepare('SELECT id, full_name, email, phone FROM users WHERE id = ?').get(payload.id);
    if (user) req.user = user;
  } catch (e) {}
  next();
}

// Send a message - optional login
router.post('/', optionalAuth, (req, res) => {
  const { subject, body, guest_name, guest_phone, guest_email } = req.body;
  const safeBody = sanitizeText(body, { maxLength: 5000 });
  const safeSubject = typeof subject === 'string' ? sanitizeText(subject, { maxLength: 200 }) : '';
  
  if (!safeBody) return res.status(400).json({ error: 'body is required' });

  let info;
  let senderName, senderEmail;

  if (req.user) {
    info = db.prepare(
      'INSERT INTO messages (user_id, subject, body, status) VALUES (?,?,?,?)'
    ).run(req.user.id, safeSubject, safeBody, 'new');
    senderName = req.user.full_name;
    senderEmail = req.user.email;
  } else {
    const safeGuestName = sanitizeText(guest_name || '', { maxLength: 100 }) || 'Guest';
    const safeGuestPhone = sanitizeText(guest_phone || '', { maxLength: 50 });
    const safeGuestEmail = sanitizeText(guest_email || '', { maxLength: 100 });
    info = db.prepare(
      'INSERT INTO messages (guest_name, guest_phone, guest_email, subject, body, status) VALUES (?,?,?,?,?,?)'
    ).run(safeGuestName, safeGuestPhone, safeGuestEmail, safeSubject, safeBody, 'new');
    senderName = safeGuestName;
    senderEmail = safeGuestEmail;
  }

  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(info.lastInsertRowid);
  const emailMessage = { ...message, full_name: senderName, email: senderEmail };
  if (senderEmail) notify(() => sendMessageConfirmation(emailMessage), 'message confirmation');
  notify(() => sendAdminNotification('New customer message', `Message from ${senderName} <${senderEmail || 'N/A'}>\nSubject: ${safeSubject || '—'}\n${safeBody}`), 'new message email');
  res.status(201).json({ message });
});

// List my own messages - login required
router.get('/mine', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json({ messages: rows });
});

module.exports = router;

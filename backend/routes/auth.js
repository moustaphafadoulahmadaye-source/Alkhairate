const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAuth, signToken, JWT_SECRET } = require('../middleware/auth');
const { sanitizeText } = require('../utils/sanitize');
const { notify, sendWelcome, sendAdminNotification, sendPasswordReset } = require('../services/email');
const { AVATARS_DIR } = require('../utils/storage');

const router = express.Router();

router.post('/register', (req, res) => {
  const { full_name, email, phone, password, password_confirmation } = req.body || {};
  const normalizedName = sanitizeText(full_name, { maxLength: 120 });
  const normalizedEmail = sanitizeText(email, { maxLength: 254 }).toLowerCase();
  const normalizedPhone = typeof phone === 'string' ? sanitizeText(phone, { maxLength: 40 }) : null;
  if (!normalizedName || !normalizedEmail || !password) {
    return res.status(400).json({ error: 'full_name, email and password are required' });
  }
  if (normalizedName.length < 2 || normalizedName.length > 120) {
    return res.status(400).json({ error: 'full_name must be between 2 and 120 characters' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
    return res.status(400).json({ error: 'email must be valid' });
  }
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 10 caractères (et maximum 128).' });
  }
  if (password !== password_confirmation) {
    return res.status(400).json({ error: 'password confirmation does not match' });
  }
  if (normalizedPhone !== null && normalizedPhone.length > 40) {
    return res.status(400).json({ error: 'phone must be 40 characters or fewer' });
  }
  const configuredAdminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (configuredAdminEmail && normalizedEmail === configuredAdminEmail) {
    return res.status(400).json({ error: 'This email address is reserved for administrative use.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

  const hash = bcrypt.hashSync(password, 10);
  let info;
  try {
    info = db.prepare(
      'INSERT INTO users (full_name, email, phone, password_hash, role, token_version) VALUES (?,?,?,?,?,?)'
    ).run(normalizedName, normalizedEmail, normalizedPhone || null, hash, 'customer', 1);
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    throw error;
  }

  const userForToken = { id: info.lastInsertRowid, full_name: normalizedName, email: normalizedEmail, role: 'customer', token_version: 1 };
  const user = { id: info.lastInsertRowid, full_name: normalizedName, email: normalizedEmail, role: 'customer' };
  const token = signToken(userForToken);
  notify(() => sendWelcome(user), 'welcome email');
  notify(() => sendAdminNotification('New customer registration', `New customer: ${user.full_name} <${user.email}>`), 'new customer email');
  res.status(201).json({ token, user });
});

router.post('/forgot-password', (req, res) => {
  const normalizedEmail = typeof req.body?.email === 'string' ? sanitizeText(req.body.email, { maxLength: 254 }).toLowerCase() : '';
  const genericResponse = { message: 'If an account exists for that email, password reset instructions will be sent.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return res.json(genericResponse);

  db.prepare('DELETE FROM password_reset_tokens WHERE expires_at <= ? OR used_at IS NOT NULL')
    .run(Math.floor(Date.now() / 1000));
  const user = db.prepare('SELECT id, full_name, email FROM users WHERE email = ?').get(normalizedEmail);
  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
    db.prepare('INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
      .run(tokenHash, user.id, expiresAt);
    const defaultUrl = process.env.NODE_ENV === 'production'
      ? 'https://alkhairate.onrender.com'
      : `http://localhost:${process.env.PORT || 4000}`;
    const baseUrl = (process.env.FRONTEND_URL || defaultUrl).replace(/\/+$/, '');
    const resetUrl = `${baseUrl}/reset-password.html?token=${rawToken}`;
    const { isSmtpConfigured } = require('../services/email');
    if (!isSmtpConfigured()) {
      console.log(`[Password Reset Notice] SMTP non configuré. Lien de réinitialisation pour ${user.email} : ${resetUrl}`);
    }
    notify(() => sendPasswordReset(user, resetUrl), 'password reset email');
  }
  res.json(genericResponse);
});

router.post('/reset-password', (req, res) => {
  const { token, password, password_confirmation } = req.body || {};
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 10 caractères (et maximum 128).' });
  }
  if (password !== password_confirmation) return res.status(400).json({ error: 'password confirmation does not match' });
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const row = db.prepare(`
    SELECT prt.user_id
    FROM password_reset_tokens prt
    WHERE prt.token_hash = ? AND prt.used_at IS NULL AND prt.expires_at > ?
  `).get(tokenHash, Math.floor(Date.now() / 1000));
  if (!row) return res.status(400).json({ error: 'Invalid or expired reset token' });

  const hash = bcrypt.hashSync(password, 10);
  const update = db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ?, token_version = COALESCE(token_version, 1) + 1 WHERE id = ?')
      .run(hash, row.user_id);
    db.prepare('UPDATE password_reset_tokens SET used_at = datetime(\'now\') WHERE token_hash = ?').run(tokenHash);
  });
  update();
  res.json({ message: 'Password reset successfully. Please log in with your new password.' });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const normalizedEmail = typeof email === 'string' ? sanitizeText(email, { maxLength: 254 }).toLowerCase() : '';
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  db.prepare('INSERT INTO sessions_log (user_id) VALUES (?)').run(row.id);

  const user = { id: row.id, full_name: row.full_name, email: row.email, role: row.role, avatar_url: row.avatar_url };
  const token = signToken(row);
  res.json({ token, user });
});

router.post('/logout', requireAuth, (req, res) => {
  const expiresAt = Number(req.authPayload.exp);
  db.prepare('INSERT OR REPLACE INTO revoked_tokens (jti, expires_at) VALUES (?, ?)').run(
    req.authPayload.jti,
    Number.isInteger(expiresAt) ? expiresAt : Math.floor(Date.now() / 1000)
  );
  res.status(204).send();
});

router.get('/me', requireAuth, (req, res) => {
  const row = db.prepare('SELECT id, full_name, email, phone, role, avatar_url, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!row) return res.status(404).json({ error: 'User not found' });
  res.json({ user: row });
});

router.patch('/me', requireAuth, (req, res) => {
  const { full_name, email, phone, avatar_url } = req.body || {};
  const normalizedName = typeof full_name === 'string' ? sanitizeText(full_name, { maxLength: 120 }) : undefined;
  const normalizedEmail = typeof email === 'string' ? sanitizeText(email, { maxLength: 254 }).toLowerCase() : undefined;
  const normalizedPhone = typeof phone === 'string' ? sanitizeText(phone, { maxLength: 40 }) : phone === null ? null : undefined;
  const normalizedAvatar = typeof avatar_url === 'string' ? avatar_url : undefined;
  if (normalizedName !== undefined && (normalizedName.length < 2 || normalizedName.length > 120)) {
    return res.status(400).json({ error: 'full_name must be between 2 and 120 characters' });
  }
  if (normalizedEmail !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: 'email must be valid' });
  }
  if (normalizedPhone !== undefined && normalizedPhone !== null && normalizedPhone.length > 40) {
    return res.status(400).json({ error: 'phone must be 40 characters or fewer' });
  }
  if (normalizedEmail) {
    const configuredAdminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (configuredAdminEmail && normalizedEmail === configuredAdminEmail && req.user.role !== 'admin') {
      return res.status(400).json({ error: 'This email address is reserved for administrative use.' });
    }
    const duplicate = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(normalizedEmail, req.user.id);
    if (duplicate) return res.status(409).json({ error: 'An account with this email already exists' });
  }
  const updates = [];
  const values = [];
  if (normalizedName !== undefined) { updates.push('full_name = ?'); values.push(normalizedName); }
  if (normalizedEmail !== undefined) { updates.push('email = ?'); values.push(normalizedEmail); }
  if (normalizedPhone !== undefined) { updates.push('phone = ?'); values.push(normalizedPhone); }
  if (normalizedAvatar !== undefined) { updates.push('avatar_url = ?'); values.push(normalizedAvatar); }
  if (updates.length) db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values, req.user.id);
  const user = db.prepare('SELECT id, full_name, email, phone, role, avatar_url, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json({ user });
});

// Change password (authenticated users and admin)
router.post('/change-password', requireAuth, (req, res) => {
  const { current_password, new_password, new_password_confirmation } = req.body || {};

  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Le mot de passe actuel et le nouveau mot de passe sont requis.' });
  }

  if (typeof new_password !== 'string' || new_password.length < 10 || new_password.length > 128) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 10 caractères.' });
  }

  if (new_password !== new_password_confirmation) {
    return res.status(400).json({ error: 'La confirmation du mot de passe ne correspond pas.' });
  }

  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!userRow) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }

  if (!bcrypt.compareSync(current_password, userRow.password_hash)) {
    return res.status(400).json({ error: 'Le mot de passe actuel est incorrect.' });
  }

  const newHash = bcrypt.hashSync(new_password, 10);
  const update = db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ?, token_version = COALESCE(token_version, 1) + 1 WHERE id = ?')
      .run(newHash, req.user.id);
    if (req.authPayload?.jti) {
      db.prepare('INSERT OR REPLACE INTO revoked_tokens (jti, expires_at) VALUES (?, ?)').run(
        req.authPayload.jti,
        Number.isInteger(Number(req.authPayload.exp)) ? Number(req.authPayload.exp) : Math.floor(Date.now() / 1000) + 86400
      );
    }
  });
  update();

  const updatedRow = db.prepare('SELECT id, full_name, email, role, avatar_url, token_version FROM users WHERE id = ?').get(req.user.id);
  const updatedUser = {
    id: updatedRow.id,
    full_name: updatedRow.full_name,
    email: updatedRow.email,
    role: updatedRow.role,
    avatar_url: updatedRow.avatar_url
  };
  const token = signToken(updatedRow);

  res.json({
    ok: true,
    message: 'Votre mot de passe a été modifié avec succès !',
    token,
    user: updatedUser
  });
});

// Delete account (authenticated users)
router.delete('/me', requireAuth, (req, res) => {
  const { current_password } = req.body || {};

  if (!current_password || typeof current_password !== 'string') {
    return res.status(400).json({ error: 'Le mot de passe actuel est requis pour confirmer la suppression de votre compte.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }

  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(400).json({ error: 'Le mot de passe actuel est incorrect.' });
  }

  // Prevent primary admin or sole admin from deleting their account
  const configuredAdminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (user.role === 'admin' && configuredAdminEmail && user.email.toLowerCase() === configuredAdminEmail) {
    return res.status(403).json({ error: 'Le compte administrateur principal ne peut pas être supprimé.' });
  }
  if (user.role === 'admin') {
    const adminCount = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'").get().c;
    if (adminCount <= 1) {
      return res.status(403).json({ error: 'Impossible de supprimer le dernier compte administrateur restant.' });
    }
  }

  // Anonymize/detach orders & messages to retain accounting records legally
  const deleteTransaction = db.transaction(() => {
    // 1. Detach and preserve orders for commercial/accounting retention (mandatory 10-year legal record)
    db.prepare(`
      UPDATE orders SET
        guest_name = COALESCE(NULLIF(guest_name, ''), ?),
        guest_email = COALESCE(NULLIF(guest_email, ''), ?),
        guest_phone = COALESCE(NULLIF(guest_phone, ''), ?),
        user_id = NULL
      WHERE user_id = ?
    `).run(user.full_name, user.email, user.phone, user.id);

    // 2. Detach messages
    db.prepare(`
      UPDATE messages SET
        guest_name = COALESCE(NULLIF(guest_name, ''), ?),
        guest_email = COALESCE(NULLIF(guest_email, ''), ?),
        guest_phone = COALESCE(NULLIF(guest_phone, ''), ?),
        user_id = NULL
      WHERE user_id = ?
    `).run(user.full_name, user.email, user.phone, user.id);

    // 3. Purge sessions, push tokens, and password reset tokens
    try {
      db.prepare('DELETE FROM device_tokens WHERE user_id = ?').run(user.id);
    } catch(e) {}
    db.prepare('DELETE FROM sessions_log WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);

    // 4. Invalidate / revoke token
    if (req.authPayload?.jti) {
      const exp = Number.isInteger(Number(req.authPayload.exp)) ? Number(req.authPayload.exp) : Math.floor(Date.now() / 1000) + 86400;
      db.prepare('INSERT OR REPLACE INTO revoked_tokens (jti, expires_at) VALUES (?, ?)').run(req.authPayload.jti, exp);
    }

    // 5. Delete user from database
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  });
  deleteTransaction();

  // 6. Delete avatar file from disk if stored locally
  if (user.avatar_url && typeof user.avatar_url === 'string') {
    try {
      const filename = path.basename(user.avatar_url);
      if (filename && filename !== '.' && filename !== '..') {
        const filePath = path.join(AVATARS_DIR, filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (e) {
      // Ignore avatar cleanup error
    }
  }

  res.json({
    ok: true,
    message: 'Votre compte et vos données personnelles ont été supprimés avec succès.'
  });
});

module.exports = router;

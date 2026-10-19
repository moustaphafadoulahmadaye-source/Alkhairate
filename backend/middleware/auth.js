const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '24h';
const WEAK_SECRETS = new Set([
  'change_this_secret_in_production',
  'your-strong-random-secret',
  'replace-with-a-long-random-secret'
]);

function isStrongJwtSecret(secret) {
  return typeof secret === 'string'
    && secret.length >= 32
    && !WEAK_SECRETS.has(secret.toLowerCase());
}

if (!isStrongJwtSecret(JWT_SECRET)) {
  throw new Error('JWT_SECRET must be set to a strong random value of at least 32 characters.');
}

function signToken(user) {
  const payload = {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    avatar_url: user.avatar_url || null,
    token_version: Number(user.token_version) || 1
  };
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    jwtid: crypto.randomUUID()
  });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof payload.jti !== 'string' || !payload.jti) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    db.prepare('DELETE FROM revoked_tokens WHERE expires_at <= ?').run(Math.floor(Date.now() / 1000));
    if (db.prepare('SELECT 1 FROM revoked_tokens WHERE jti = ?').get(payload.jti)) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }
    const userId = Number(payload.id);
    if (!Number.isInteger(userId) || userId < 1) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = db.prepare(
      'SELECT id, full_name, email, phone, role, avatar_url, token_version, created_at FROM users WHERE id = ?'
    ).get(userId);
    if (!user) return res.status(401).json({ error: 'User account no longer exists' });

    const currentVersion = Number(user.token_version) || 1;
    const tokenVersion = typeof payload.token_version === 'number' ? payload.token_version : 0;
    if (tokenVersion !== currentVersion) {
      return res.status(401).json({ error: 'Token has been invalidated. Please log in again.' });
    }

    req.user = user;
    req.authToken = token;
    req.authPayload = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof payload.jti !== 'string' || !payload.jti) return next();

    // Check revocation
    const isRevoked = db.prepare('SELECT 1 FROM revoked_tokens WHERE jti = ?').get(payload.jti);
    if (isRevoked) return next();

    const userId = Number(payload.id);
    if (!Number.isInteger(userId) || userId < 1) return next();

    const user = db.prepare(
      'SELECT id, full_name, email, phone, role, avatar_url, token_version, created_at FROM users WHERE id = ?'
    ).get(userId);
    if (!user) return next();

    const currentVersion = Number(user.token_version) || 1;
    const tokenVersion = typeof payload.token_version === 'number' ? payload.token_version : 0;
    if (tokenVersion !== currentVersion) {
      return next();
    }

    req.user = user;
    req.authToken = token;
    req.authPayload = payload;
  } catch (e) {
    // If token is invalid or expired, continue as guest
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || !Number.isInteger(req.user.id)) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(401).json({ error: 'User account no longer exists' });
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireAdmin,
  signToken,
  JWT_SECRET,
  JWT_EXPIRES_IN
};

const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;
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
      'SELECT id, full_name, email, phone, role, created_at FROM users WHERE id = ?'
    ).get(userId);
    if (!user) return res.status(401).json({ error: 'User account no longer exists' });

    req.user = user;
    req.authToken = token;
    req.authPayload = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
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

module.exports = { requireAuth, requireAdmin, JWT_SECRET };

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRoutes = require('./routes/auth');
const servicesRoutes = require('./routes/services');
const ordersRoutes = require('./routes/orders');
const messagesRoutes = require('./routes/messages');
const productsRoutes = require('./routes/products');
const adminRoutes = require('./routes/admin');
const uploadRoutes = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 4000;
const allowedOrigins = (process.env.CORS_ORIGIN || `http://localhost:${PORT}`)
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
    ) {
      return true;
    }
  } catch (e) {}
  return false;
}

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  }
}));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      fontSrc: ["'self'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "http:", "https:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"]
    }
  }
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth/register', rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth/forgot-password', rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth/reset-password', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false }));
app.use('/api/orders', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));
app.use('/api/messages', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));

app.get('/api/health', (req, res) => res.json({ ok: true, name: 'EAEPCG API' }));
app.get('/api/settings', (req, res) => {
  try {
    const db = require('./db');
    const rows = db.prepare('SELECT key, value FROM site_settings').all();
    const settings = {};
    rows.forEach(r => settings[r.key] = r.value);

    // Also include services image_url as service_<slug>
    const services = db.prepare('SELECT slug, image_url FROM services').all();
    services.forEach(s => {
      if (s.image_url) {
        settings[`service_${s.slug}`] = s.image_url;
      }
    });

    res.json(settings);
  } catch (e) {
    console.error('Error fetching settings:', e);
    res.json({});
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', express.json({ limit: '5mb' }), uploadRoutes);

// Optionally serve the frontend as static files too (same-origin deployment)
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_DIR));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'), (err) => { if (err) next(); });
});

app.use((err, req, res, next) => {
  if (err.message === 'Origin is not allowed by CORS') {
    return res.status(403).json({ error: 'Origin is not allowed' });
  }

  const isDbFailure = err && (
    err.code === 'SQLITE_BUSY' ||
    err.code === 'SQLITE_LOCKED' ||
    err.code === 'SQLITE_CORRUPT' ||
    err.code === 'SQLITE_NOTADB'
  );

  console.error('Unhandled request error:', err && err.message ? err.message : err);
  res.status(isDbFailure ? 503 : 500).json({
    error: isDbFailure ? 'Database unavailable. Please try again later.' : 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`EAEPCG backend running on http://localhost:${PORT}`);
});

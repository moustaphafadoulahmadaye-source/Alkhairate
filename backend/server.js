const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const servicesRoutes = require('./routes/services');
const ordersRoutes = require('./routes/orders');
const messagesRoutes = require('./routes/messages');
const productsRoutes = require('./routes/products');
const adminRoutes = require('./routes/admin');
const uploadRoutes = require('./routes/upload');
const { UPLOADS_DIR, AVATARS_DIR } = require('./utils/storage');

const app = express();
const PORT = process.env.PORT || 4000;

if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

function getAllowedOrigins() {
  const configured = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map(origin => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  if (process.env.FRONTEND_URL) {
    const fe = process.env.FRONTEND_URL.trim().replace(/\/+$/, '');
    if (fe && !configured.includes(fe)) {
      configured.push(fe);
    }
  }

  // Capacitor mobile app origins (Android & iOS)
  const capacitorOrigins = ['capacitor://localhost', 'https://localhost', 'http://localhost'];
  for (const capOrigin of capacitorOrigins) {
    if (!configured.includes(capOrigin)) {
      configured.push(capOrigin);
    }
  }

  // Safe fallback in production if not explicitly configured
  if (configured.length === 0 && process.env.NODE_ENV === 'production') {
    configured.push('https://alkhairate.onrender.com');
  }

  return configured;
}

function isAllowedOrigin(origin) {
  // Allow requests with no origin header (same-origin, curl, server-to-server, mobile apps)
  if (!origin) return true;

  const normalized = origin.trim().replace(/\/+$/, '');
  const allowed = getAllowedOrigins();

  if (allowed.includes(normalized)) return true;

  // Development mode only: allow localhost and 127.0.0.1 on any local port
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    try {
      const url = new URL(normalized);
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        return true;
      }
    } catch (e) {}
  }

  return false;
}

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true
}));

// Progressive Content Security Policy configuration
const isCspReportOnly = process.env.CSP_REPORT_ONLY === 'true';

app.use(helmet({
  contentSecurityPolicy: {
    reportOnly: isCspReportOnly,
    directives: {
      defaultSrc: ["'self'"],
      // Strict CSP: 'unsafe-inline' removed as all page scripts are modularized in assets/js/pages/
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      fontSrc: ["'self'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      // Tighter connectSrc: only self and explicit allowed origins
      connectSrc: ["'self'", ...getAllowedOrigins()],
      mediaSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      reportUri: ['/api/csp-report'],
      ...(process.env.NODE_ENV === 'production' ? { upgradeInsecureRequests: [] } : {})
    }
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

// Feature / Permissions policy header
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  next();
});

// CSP report handler
app.post('/api/csp-report', express.json({ type: ['application/json', 'application/csp-report'] }), (req, res) => {
  if (req.body && process.env.NODE_ENV !== 'test') {
    console.warn('[CSP Violation Report]:', JSON.stringify(req.body));
  }
  res.status(204).end();
});

// Body parser separation:
// - /api/upload accepts base64 payloads up to 8MB (for 5MB binary images)
// - All other routes strictly limited to 100kb to prevent body-parsing denial of service
const uploadJsonParser = express.json({ limit: '8mb' });
const uploadUrlencodedParser = express.urlencoded({ extended: true, limit: '8mb' });

const standardJsonParser = express.json({ limit: '100kb' });
const standardUrlencodedParser = express.urlencoded({ extended: true, limit: '100kb' });

app.use((req, res, next) => {
  if (req.path.startsWith('/api/upload')) {
    uploadJsonParser(req, res, (err) => {
      if (err) return next(err);
      uploadUrlencodedParser(req, res, next);
    });
  } else {
    standardJsonParser(req, res, (err) => {
      if (err) return next(err);
      standardUrlencodedParser(req, res, next);
    });
  }
});

// Rate limiting
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth/register', rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth/forgot-password', rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth/reset-password', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth/delete-account', rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false }));
app.use('/api/orders', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));
app.use('/api/messages', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));
app.use('/api/upload', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));
app.use('/api/push', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));

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
app.use('/api/upload', uploadRoutes);
app.use('/api/push', require('./routes/push'));

// Reinforced security headers for uploaded assets
function setUploadSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; img-src 'self'; style-src 'none'; script-src 'none'; frame-ancestors 'none'; sandbox"
  );
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
}

// Serve uploads and avatars from persistent storage
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

app.use('/assets/uploads', express.static(UPLOADS_DIR, {
  etag: true,
  maxAge: '1d',
  setHeaders: setUploadSecurityHeaders
}));

const REPO_UPLOADS_DIR = path.join(FRONTEND_DIR, 'assets', 'uploads');
if (path.resolve(REPO_UPLOADS_DIR) !== path.resolve(UPLOADS_DIR)) {
  app.use('/assets/uploads', express.static(REPO_UPLOADS_DIR, {
    etag: true,
    maxAge: '1d',
    setHeaders: setUploadSecurityHeaders
  }));
}

app.use('/assets/avatars', express.static(AVATARS_DIR, {
  etag: true,
  maxAge: '1d',
  setHeaders: setUploadSecurityHeaders
}));

// Serve frontend static files
app.use(express.static(FRONTEND_DIR, {
  etag: true,
  maxAge: 0,
  setHeaders: (res, filePath) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (filePath.includes('uploads') || filePath.includes('avatars')) {
      setUploadSecurityHeaders(res);
    }
    if (filePath.endsWith('.html') || filePath.endsWith('.css') || filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'), (err) => { if (err) next(); });
});

app.use((err, req, res, next) => {
  if (err.message === 'Origin is not allowed by CORS') {
    return res.status(403).json({ error: 'Origin is not allowed' });
  }

  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({ error: 'Payload too large. Maximum allowed size exceeded.' });
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

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`EAEPCG backend running on port ${PORT}`);
    try {
      const seedAdmin = require('./seedAdmin');
      const result = seedAdmin();
      if (result && result.message) {
        console.log(`[Admin Seed] ${result.message}`);
      }
    } catch (e) {
      console.warn('[Admin Seed Notice]', e.message);
    }
  });
}

module.exports = {
  app,
  isAllowedOrigin,
  getAllowedOrigins,
  setUploadSecurityHeaders
};

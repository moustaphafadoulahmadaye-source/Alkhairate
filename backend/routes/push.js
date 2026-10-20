const express = require('express');
const db = require('../db');
const { optionalAuth } = require('../middleware/auth');
const router = express.Router();

/**
 * Register or update a mobile device push token
 * Associates with user_id if authenticated
 */
router.post('/register', optionalAuth, (req, res) => {
  const { token, platform } = req.body || {};

  if (!token || typeof token !== 'string' || token.trim().length < 10 || token.length > 500) {
    return res.status(400).json({ error: 'Jeton de notification push invalide' });
  }

  const safeToken = token.trim();
  const safePlatform = platform === 'ios' ? 'ios' : 'android';
  const userId = req.user ? req.user.id : null;

  try {
    db.prepare(`
      INSERT INTO device_tokens (user_id, token, platform, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(token) DO UPDATE SET
        user_id = COALESCE(excluded.user_id, device_tokens.user_id),
        platform = excluded.platform,
        updated_at = datetime('now')
    `).run(userId, safeToken, safePlatform);

    res.json({ ok: true, registered: true });
  } catch(err) {
    console.error('[Push Router] Erreur enregistrement jeton:', err.message);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement du jeton' });
  }
});

module.exports = router;

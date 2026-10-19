const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { validateAndProcessImage } = require('../utils/imageSecurity');

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'frontend', 'assets', 'uploads');
const AVATARS_DIR = path.join(__dirname, '..', '..', 'frontend', 'assets', 'avatars');

// General image upload (products, site settings, services) — Admin only
router.post('/', requireAuth, requireAdmin, (req, res) => {
  const { imageBase64 } = req.body || {};
  if (!imageBase64) {
    return res.status(400).json({ error: 'Image data is required' });
  }

  try {
    const { buffer, filename } = validateAndProcessImage(imageBase64, {
      maxSize: 5 * 1024 * 1024,
      prefix: 'upload'
    });

    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    const filePath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filePath, buffer);

    const relativeUrl = 'assets/uploads/' + filename;
    res.json({ url: relativeUrl, filename });
  } catch (err) {
    const isValidationErr = err.message && (
      err.message.includes('PNG') ||
      err.message.includes('MIME') ||
      err.message.includes('format') ||
      err.message.includes('base64') ||
      err.message.includes('size') ||
      err.message.includes('required')
    );
    return res.status(isValidationErr ? 400 : 500).json({
      error: isValidationErr ? err.message : 'Failed to upload image'
    });
  }
});

// User avatar upload — Authenticated users
router.post('/avatar', requireAuth, (req, res) => {
  const { imageBase64 } = req.body || {};
  if (!imageBase64) {
    return res.status(400).json({ error: 'Image data is required' });
  }

  try {
    const { buffer, filename } = validateAndProcessImage(imageBase64, {
      maxSize: 2 * 1024 * 1024,
      prefix: `avatar_${req.user.id}`
    });

    if (!fs.existsSync(AVATARS_DIR)) {
      fs.mkdirSync(AVATARS_DIR, { recursive: true });
    }

    const filePath = path.join(AVATARS_DIR, filename);
    fs.writeFileSync(filePath, buffer);

    const relativeUrl = 'assets/avatars/' + filename;
    res.json({ url: relativeUrl, filename });
  } catch (err) {
    const isValidationErr = err.message && (
      err.message.includes('PNG') ||
      err.message.includes('MIME') ||
      err.message.includes('format') ||
      err.message.includes('base64') ||
      err.message.includes('size') ||
      err.message.includes('required')
    );
    return res.status(isValidationErr ? 400 : 500).json({
      error: isValidationErr ? err.message : 'Failed to upload avatar'
    });
  }
});

module.exports = router;


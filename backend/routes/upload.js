const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const router = express.Router();

router.post('/', requireAuth, requireAdmin, (req, res) => {
  const { imageBase64, filename } = req.body;
  if (!imageBase64 || !filename) {
    return res.status(400).json({ error: 'Image and filename required' });
  }

  try {
    // Parse the base64 string
    const match = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!match || match.length !== 3) {
      return res.status(400).json({ error: 'Invalid base64 string' });
    }

    const type = match[1];
    const data = Buffer.from(match[2], 'base64');
    
    // Validate image type roughly
    if (!type.startsWith('image/')) {
      return res.status(400).json({ error: 'Only images are allowed' });
    }

    const ext = path.extname(filename) || '.png';
    const safeName = Date.now() + '_' + Math.round(Math.random() * 1e9) + ext;
    
    const uploadDir = path.join(__dirname, '..', '..', 'frontend', 'assets', 'uploads');
    
    if (!fs.existsSync(uploadDir)){
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const filePath = path.join(uploadDir, safeName);
    fs.writeFileSync(filePath, data);

    const relativeUrl = 'assets/uploads/' + safeName;
    res.json({ url: relativeUrl });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

router.post('/avatar', requireAuth, (req, res) => {
  const { imageBase64, filename } = req.body;
  if (!imageBase64 || !filename) {
    return res.status(400).json({ error: 'Image and filename required' });
  }

  try {
    const match = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!match || match.length !== 3) {
      return res.status(400).json({ error: 'Invalid base64 string' });
    }

    const type = match[1];
    const data = Buffer.from(match[2], 'base64');
    
    if (!type.startsWith('image/')) {
      return res.status(400).json({ error: 'Only images are allowed' });
    }

    // Limit avatar size to ~2MB
    if (data.length > 2 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image too large (max 2MB)' });
    }

    const ext = path.extname(filename) || '.png';
    const safeName = 'avatar_' + req.user.id + '_' + Date.now() + ext;
    
    const uploadDir = path.join(__dirname, '..', '..', 'frontend', 'assets', 'avatars');
    
    if (!fs.existsSync(uploadDir)){
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const filePath = path.join(uploadDir, safeName);
    fs.writeFileSync(filePath, data);

    const relativeUrl = 'assets/avatars/' + safeName;
    res.json({ url: relativeUrl });
  } catch (err) {
    console.error('Avatar upload error:', err);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

module.exports = router;

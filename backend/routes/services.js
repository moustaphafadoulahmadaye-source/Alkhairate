const express = require('express');
const db = require('../db');
const router = express.Router();

// Public: anyone can browse services, no login required
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM services ORDER BY name_fr').all();
  res.json({ services: rows });
});

// Get complete catalog for a service (Service -> Categories -> Items)
router.get('/:slug/catalog', (req, res) => {
  const service = db.prepare('SELECT * FROM services WHERE slug = ?').get(req.params.slug);
  if (!service) return res.status(404).json({ error: 'Service not found' });

  // Get categories (products) for this service
  const categories = db.prepare('SELECT * FROM products WHERE service_slug = ? ORDER BY name_fr').all(service.slug);
  
  // Get all items belonging to these categories
  const items = db.prepare(`
    SELECT pi.*, p.slug as category_slug 
    FROM product_items pi 
    JOIN products p ON pi.product_id = p.id 
    WHERE p.service_slug = ?
    ORDER BY pi.category_fr, pi.name_fr
  `).all(service.slug);

  res.json({ service, categories, items });
});

module.exports = router;

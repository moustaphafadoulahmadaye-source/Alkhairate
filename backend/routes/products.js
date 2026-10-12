const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sanitizeSlug, sanitizeText } = require('../utils/sanitize');
const router = express.Router();

// ── Public routes (no login needed) ──

// List all products (with item count)
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT p.*, COUNT(pi.id) AS item_count
    FROM products p LEFT JOIN product_items pi ON pi.product_id = p.id
    GROUP BY p.id ORDER BY p.name_fr
  `).all();
  res.json({ products: rows });
});
// Get featured items (latest 10 items) for homepage carousel
router.get('/items/featured', (req, res) => {
  const items = db.prepare(`
    SELECT pi.*, p.service_slug 
    FROM product_items pi
    JOIN products p ON pi.product_id = p.id
    ORDER BY pi.id DESC
    LIMIT 10
  `).all();
  res.json({ items });
});

// Get one product with all its items
router.get('/:slug', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE slug = ?').get(req.params.slug);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const items = db.prepare('SELECT * FROM product_items WHERE product_id = ? ORDER BY category_fr, name_fr').all(product.id);
  res.json({ product, items });
});

// ── Admin routes ──

// Create a product
router.post('/', requireAuth, requireAdmin, (req, res) => {
  const { slug, name_fr, name_en, description_fr, description_en, icon, image_url, service_slug } = req.body;
  const safeSlug = sanitizeSlug(slug);
  const safeNameFr = sanitizeText(name_fr, { maxLength: 120 });
  const safeNameEn = sanitizeText(name_en, { maxLength: 120 });
  const safeDescriptionFr = sanitizeText(description_fr, { maxLength: 2000 });
  const safeDescriptionEn = sanitizeText(description_en, { maxLength: 2000 });
  const safeIcon = typeof icon === 'string' ? sanitizeText(icon, { maxLength: 20 }) : '📦';
  const safeImageUrl = typeof image_url === 'string' ? sanitizeText(image_url, { maxLength: 500 }) : '';
  const safeServiceSlug = typeof service_slug === 'string' ? sanitizeSlug(service_slug) : null;

  if (!safeSlug || !safeNameFr || !safeNameEn || safeSlug.length > 120 || safeNameFr.length > 120 || safeNameEn.length > 120) {
    return res.status(400).json({ error: 'valid slug, name_fr and name_en are required' });
  }
  if (safeServiceSlug && !db.prepare('SELECT 1 FROM services WHERE slug = ?').get(safeServiceSlug)) return res.status(400).json({ error: 'Invalid service' });
  try {
    const info = db.prepare(
      'INSERT INTO products (slug, name_fr, name_en, description_fr, description_en, icon, image_url, service_slug) VALUES (?,?,?,?,?,?,?,?)'
    ).run(safeSlug, safeNameFr, safeNameEn, safeDescriptionFr, safeDescriptionEn, safeIcon || '📦', safeImageUrl, safeServiceSlug || null);
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ product });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'A product with this slug already exists' });
    console.error('Add product error:', e);
    return res.status(500).json({ error: 'Database error: ' + e.message });
  }
});

// Delete a product (and all its items via CASCADE)
router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  const result = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Product not found' });
  res.json({ ok: true });
});

// Update a product
router.patch('/:id', requireAuth, requireAdmin, (req, res) => {
  const current = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: 'Product not found' });

  const { slug, name_fr, name_en, description_fr, description_en, icon, image_url, service_slug } = req.body;
  const safeSlug = slug === undefined ? current.slug : sanitizeSlug(slug);
  const safeNameFr = name_fr === undefined ? current.name_fr : sanitizeText(name_fr, { maxLength: 120 });
  const safeNameEn = name_en === undefined ? current.name_en : sanitizeText(name_en, { maxLength: 120 });
  const safeDescriptionFr = description_fr === undefined ? current.description_fr : sanitizeText(description_fr, { maxLength: 2000 });
  const safeDescriptionEn = description_en === undefined ? current.description_en : sanitizeText(description_en, { maxLength: 2000 });
  const safeIcon = icon === undefined ? current.icon : sanitizeText(icon, { maxLength: 20 });
  const safeImageUrl = image_url === undefined ? current.image_url : sanitizeText(image_url, { maxLength: 500 });
  const safeServiceSlug = service_slug === undefined ? current.service_slug : sanitizeSlug(service_slug);

  if (!safeSlug || !safeNameFr || !safeNameEn) return res.status(400).json({ error: 'valid slug, name_fr and name_en are required' });
  
  try {
    db.prepare(
      'UPDATE products SET slug=?, name_fr=?, name_en=?, description_fr=?, description_en=?, icon=?, image_url=?, service_slug=? WHERE id=?'
    ).run(safeSlug, safeNameFr, safeNameEn, safeDescriptionFr, safeDescriptionEn, safeIcon || '📦', safeImageUrl || '', safeServiceSlug || null, req.params.id);
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    res.json({ product });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'A product with this slug already exists' });
    throw e;
  }
});

// Add an item to a product
router.post('/:id/items', requireAuth, requireAdmin, (req, res) => {
  const { name_fr, name_en, category_fr, category_en, price, currency, image_url } = req.body;
  const safeNameFr = sanitizeText(name_fr, { maxLength: 120 });
  const safeNameEn = sanitizeText(name_en, { maxLength: 120 });
  const safeCategoryFr = sanitizeText(category_fr, { maxLength: 120 });
  const safeCategoryEn = sanitizeText(category_en, { maxLength: 120 });
  const safeImageUrl = typeof image_url === 'string' ? sanitizeText(image_url, { maxLength: 500 }) : '';
  const safeCurrency = typeof currency === 'string' ? sanitizeText(currency, { maxLength: 3 }).toUpperCase() : 'XAF';

  if (!safeNameFr || !safeNameEn) return res.status(400).json({ error: 'name_fr, name_en required' });
  const productId = Number(req.params.id);
  const numericPrice = Number(price ?? 0);
  if (!Number.isInteger(productId) || productId < 1 || !db.prepare('SELECT 1 FROM products WHERE id = ?').get(productId)) return res.status(404).json({ error: 'Product not found' });
  if (!Number.isFinite(numericPrice) || numericPrice < 0) return res.status(400).json({ error: 'price must be a non-negative number' });
  if (!/^[A-Z]{3}$/.test(safeCurrency)) return res.status(400).json({ error: 'currency must be a 3-letter code' });
  const info = db.prepare(
    'INSERT INTO product_items (product_id, name_fr, name_en, category_fr, category_en, price, currency, image_url) VALUES (?,?,?,?,?,?,?,?)'
  ).run(productId, safeNameFr, safeNameEn, safeCategoryFr, safeCategoryEn, numericPrice, safeCurrency, safeImageUrl);
  const item = db.prepare('SELECT * FROM product_items WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ item });
});

// Update an item
router.patch('/items/:itemId', requireAuth, requireAdmin, (req, res) => {
  const { name_fr, name_en, category_fr, category_en, price, currency, image_url, in_stock } = req.body;
  const current = db.prepare('SELECT * FROM product_items WHERE id = ?').get(req.params.itemId);
  if (!current) return res.status(404).json({ error: 'Item not found' });

  const nextNameFr = name_fr === undefined ? current.name_fr : sanitizeText(name_fr, { maxLength: 120 });
  const nextNameEn = name_en === undefined ? current.name_en : sanitizeText(name_en, { maxLength: 120 });
  const nextCategoryFr = category_fr === undefined ? current.category_fr : sanitizeText(category_fr, { maxLength: 120 });
  const nextCategoryEn = category_en === undefined ? current.category_en : sanitizeText(category_en, { maxLength: 120 });
  const nextCurrency = currency === undefined ? current.currency : sanitizeText(currency, { maxLength: 3 }).toUpperCase();
  const nextImageUrl = image_url === undefined ? current.image_url : sanitizeText(image_url, { maxLength: 500 });

  if (!nextNameFr || !nextNameEn) return res.status(400).json({ error: 'name_fr, name_en required' });
  if (!/^[A-Z]{3}$/.test(nextCurrency)) return res.status(400).json({ error: 'currency must be a 3-letter code' });

  db.prepare(`UPDATE product_items SET name_fr=?, name_en=?, category_fr=?, category_en=?, price=?, currency=?, image_url=?, in_stock=? WHERE id=?`)
    .run(
      nextNameFr, nextNameEn,
      nextCategoryFr, nextCategoryEn,
      price ?? current.price, nextCurrency,
      nextImageUrl, in_stock ?? current.in_stock,
      req.params.itemId
    );
  const item = db.prepare('SELECT * FROM product_items WHERE id = ?').get(req.params.itemId);
  res.json({ item });
});

// Delete an item
router.delete('/items/:itemId', requireAuth, requireAdmin, (req, res) => {
  const result = db.prepare('DELETE FROM product_items WHERE id = ?').run(req.params.itemId);
  if (!result.changes) return res.status(404).json({ error: 'Item not found' });
  res.json({ ok: true });
});

module.exports = router;

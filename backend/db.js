const Database = require('better-sqlite3');
const { DB_PATH } = require('./utils/storage');

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer', -- 'customer' or 'admin'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name_fr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_fr TEXT,
  description_en TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name_fr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_fr TEXT,
  description_en TEXT,
  icon TEXT DEFAULT '📦',
  image_url TEXT DEFAULT '',
  service_slug TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  name_fr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  category_fr TEXT DEFAULT '',
  category_en TEXT DEFAULT '',
  price REAL DEFAULT 0,
  currency TEXT DEFAULT 'XAF',
  image_url TEXT DEFAULT '',
  in_stock INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  guest_name TEXT,
  guest_phone TEXT,
  guest_email TEXT,
  service TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  guest_name TEXT,
  guest_phone TEXT,
  guest_email TEXT,
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  logged_in_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

const orderColumns = db.prepare('PRAGMA table_info(orders)').all().map(column => column.name);
if (!orderColumns.includes('quantity')) db.exec('ALTER TABLE orders ADD COLUMN quantity TEXT');
if (!orderColumns.includes('total')) db.exec('ALTER TABLE orders ADD COLUMN total REAL');
if (!orderColumns.includes('currency')) db.exec("ALTER TABLE orders ADD COLUMN currency TEXT DEFAULT 'XAF'");

const productColumns = db.prepare('PRAGMA table_info(products)').all().map(column => column.name);
if (!productColumns.includes('image_url')) db.exec("ALTER TABLE products ADD COLUMN image_url TEXT DEFAULT ''");

const serviceColumns = db.prepare('PRAGMA table_info(services)').all().map(column => column.name);
if (!serviceColumns.includes('image_url')) db.exec("ALTER TABLE services ADD COLUMN image_url TEXT DEFAULT ''");

// Seed services
const count = db.prepare('SELECT COUNT(*) AS c FROM services').get().c;
if (count === 0) {
  const insert = db.prepare(`INSERT INTO services (slug, name_fr, name_en, description_fr, description_en) VALUES (?,?,?,?,?)`);
  const seed = db.transaction((rows) => rows.forEach(r => insert.run(...r)));
  seed([
    ['pompe-forage', 'Installation de pompe forage', 'Borehole pump installation',
      'Installation de pompes manuelles et automatiques, systèmes de distribution d\'eau, réservoirs et châteaux d\'eau, tuyauterie professionnelle, réparation et entretien.',
      'Manual and automatic pump installation, water distribution systems, tanks and water towers, professional piping, repair and maintenance.'],
    ['vente-pompes', 'Vente de pompes', 'Pump sales',
      'Vente de pompes hydrauliques et solaires de différentes capacités.',
      'Sale of hydraulic and solar pumps of various capacities.'],
    ['materiels-electriques', 'Commerce de matériels électriques', 'Electrical equipment trading',
      'Câbles électriques, disjoncteurs, prises et interrupteurs, panneaux solaires, pompes, régulateurs et batteries, ampoules LED, compteurs électriques.',
      'Electrical cables, breakers, sockets and switches, solar panels, pumps, regulators and batteries, LED bulbs, electric meters.'],
    ['commerce-general', 'Commerce général', 'General trading',
      'Produits techniques et équipements professionnels divers.',
      'A range of technical products and professional equipment.'],
    ['lavage', 'Service lavage (auto et équipements)', 'Wash service (vehicles & equipment)',
      'Lavage de véhicules et motocycles (Rackha), lavage des tapis et réservoirs, entretien des véhicules, nettoyage de machines et équipements industriels.',
      'Vehicle and motorcycle wash (Rackha), carpet and tank washing, vehicle maintenance, machine and industrial equipment cleaning.'],
    ['installation-immeubles', 'Installation des immeubles', 'Building installations',
      'Installation électrique complète, câblage bâtiment, installation solaire, mise aux normes de sécurité.',
      'Complete electrical installation, building wiring, solar installation, safety code compliance.']
  ]);
}

// Seed default site settings if empty
const settingsCount = db.prepare('SELECT COUNT(*) AS c FROM site_settings').get().c;
if (settingsCount === 0) {
  const insSetting = db.prepare('INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)');
  const defaultSettings = [
    ['site_logo', 'assets/img/logo.jpg'],
    ['hero', 'assets/img/hero-solar.jpg'],
    ['contact', 'assets/img/pompe.jpg'],
    ['about', 'assets/img/materiels.jpg'],
    ['about_expertise', 'assets/img/about-expertise.jpg'],
    ['about_ingenierie', 'assets/img/installation.jpg'],
    ['about_distribution', 'assets/img/about-distribution.jpg'],
    ['service_pompe-forage', 'assets/img/pompe.jpg'],
    ['service_materiels-electriques', 'assets/img/materiels.jpg'],
    ['service_commerce-general', 'assets/img/commerce.jpg'],
    ['service_lavage', 'assets/img/lavage.jpg'],
    ['service_installation-immeubles', 'assets/img/installation.jpg'],
    ['service_vente-pompes', 'assets/img/vente-pompes.jpg']
  ];
  defaultSettings.forEach(([k, v]) => insSetting.run(k, v));
} else {
  db.prepare('INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)').run('site_logo', 'assets/img/logo.jpg');
}

// Ensure service default images are set
const serviceImages = {
  'pompe-forage': 'assets/img/pompe.jpg',
  'vente-pompes': 'assets/img/vente-pompes.jpg',
  'materiels-electriques': 'assets/img/materiels.jpg',
  'commerce-general': 'assets/img/commerce.jpg',
  'lavage': 'assets/img/lavage.jpg',
  'installation-immeubles': 'assets/img/installation.jpg'
};
for (const [slug, img] of Object.entries(serviceImages)) {
  db.prepare("UPDATE services SET image_url = ? WHERE slug = ? AND (image_url IS NULL OR image_url = '')").run(img, slug);
}

// Seed products and items
const prodCount = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
if (prodCount === 0) {
  const insProd = db.prepare(`INSERT INTO products (slug, name_fr, name_en, description_fr, description_en, icon, image_url, service_slug) VALUES (?,?,?,?,?,?,?,?)`);
  const insItem = db.prepare(`INSERT INTO product_items (product_id, name_fr, name_en, category_fr, category_en, price, currency, image_url) VALUES (?,?,?,?,?,?,?,?)`);

  const seedProducts = db.transaction(() => {
    // 1. Câbles électriques
    let id = insProd.run('cables-electriques', 'Câbles électriques', 'Electrical cables',
      'Câbles de différentes sections pour installations résidentielles et industrielles.',
      'Cables of various sizes for residential and industrial installations.', '🔌', '', 'materiels-electriques').lastInsertRowid;
    insItem.run(id, 'Câble 1.5mm² — rouleau 100m', 'Cable 1.5mm² — 100m roll', 'Résidentiel', 'Residential', 15000, 'XAF', '');
    insItem.run(id, 'Câble 2.5mm² — rouleau 100m', 'Cable 2.5mm² — 100m roll', 'Résidentiel', 'Residential', 25000, 'XAF', '');
    insItem.run(id, 'Câble 4mm² — rouleau 100m', 'Cable 4mm² — 100m roll', 'Industriel', 'Industrial', 40000, 'XAF', '');
    insItem.run(id, 'Câble 6mm² — rouleau 100m', 'Cable 6mm² — 100m roll', 'Industriel', 'Industrial', 60000, 'XAF', '');

    // 2. Disjoncteurs
    id = insProd.run('disjoncteurs', 'Disjoncteurs', 'Circuit breakers',
      'Disjoncteurs de protection pour tableaux électriques.',
      'Protection breakers for electrical panels.', '⚡', '', 'materiels-electriques').lastInsertRowid;
    insItem.run(id, 'Disjoncteur 10A monophasé', 'Breaker 10A single-phase', 'Monophasé', 'Single-phase', 5000, 'XAF', '');
    insItem.run(id, 'Disjoncteur 20A monophasé', 'Breaker 20A single-phase', 'Monophasé', 'Single-phase', 6500, 'XAF', '');
    insItem.run(id, 'Disjoncteur 32A monophasé', 'Breaker 32A single-phase', 'Monophasé', 'Single-phase', 8000, 'XAF', '');
    insItem.run(id, 'Disjoncteur 63A triphasé', 'Breaker 63A three-phase', 'Triphasé', 'Three-phase', 25000, 'XAF', '');

    // 3. Prises et interrupteurs
    id = insProd.run('prises-interrupteurs', 'Prises et interrupteurs', 'Sockets and switches',
      'Appareillage électrique pour installations intérieures.',
      'Electrical fittings for indoor installations.', '🔘', '', 'materiels-electriques').lastInsertRowid;
    insItem.run(id, 'Prise murale simple', 'Single wall socket', 'Prises', 'Sockets', 1500, 'XAF', '');
    insItem.run(id, 'Prise murale double', 'Double wall socket', 'Prises', 'Sockets', 2500, 'XAF', '');
    insItem.run(id, 'Interrupteur simple', 'Single switch', 'Interrupteurs', 'Switches', 1000, 'XAF', '');
    insItem.run(id, 'Interrupteur va-et-vient', 'Two-way switch', 'Interrupteurs', 'Switches', 2000, 'XAF', '');

    // 4. Panneaux solaires
    id = insProd.run('panneaux-solaires', 'Panneaux solaires', 'Solar panels',
      'Panneaux photovoltaïques pour habitations et entreprises.',
      'Photovoltaic panels for homes and businesses.', '☀️', '', 'materiels-electriques').lastInsertRowid;
    insItem.run(id, 'Panneau 100W monocristallin', '100W monocrystalline panel', 'Résidentiel', 'Residential', 35000, 'XAF', '');
    insItem.run(id, 'Panneau 200W monocristallin', '200W monocrystalline panel', 'Résidentiel', 'Residential', 65000, 'XAF', '');
    insItem.run(id, 'Panneau 300W monocristallin', '300W monocrystalline panel', 'Professionnel', 'Professional', 95000, 'XAF', '');
    insItem.run(id, 'Panneau 400W monocristallin', '400W monocrystalline panel', 'Professionnel', 'Professional', 130000, 'XAF', '');

    // 5. Pompes
    id = insProd.run('pompes', 'Pompes', 'Pumps',
      'Pompes hydrauliques manuelles et automatiques pour forage et distribution d\'eau.',
      'Manual and automatic hydraulic pumps for boreholes and water distribution.', '💧', '', 'vente-pompes').lastInsertRowid;
    insItem.run(id, 'Pompe manuelle India Mark II', 'India Mark II hand pump', 'Manuelle', 'Manual', 250000, 'XAF', '');
    insItem.run(id, 'Pompe submersible 1.5HP', 'Submersible pump 1.5HP', 'Automatique', 'Automatic', 180000, 'XAF', '');
    insItem.run(id, 'Pompe submersible 3HP', 'Submersible pump 3HP', 'Automatique', 'Automatic', 350000, 'XAF', '');
    insItem.run(id, 'Pompe solaire submersible', 'Solar submersible pump', 'Solaire', 'Solar', 450000, 'XAF', '');

    // 6. Régulateurs et batteries
    id = insProd.run('regulateurs-batteries', 'Régulateurs et batteries', 'Regulators and batteries',
      'Régulateurs de charge solaire et batteries de stockage.',
      'Solar charge regulators and storage batteries.', '🔋', '', 'materiels-electriques').lastInsertRowid;
    insItem.run(id, 'Régulateur PWM 30A', 'PWM regulator 30A', 'Régulateurs', 'Regulators', 15000, 'XAF', '');
    insItem.run(id, 'Régulateur MPPT 40A', 'MPPT regulator 40A', 'Régulateurs', 'Regulators', 45000, 'XAF', '');
    insItem.run(id, 'Batterie 12V 100Ah gel', 'Battery 12V 100Ah gel', 'Batteries', 'Batteries', 85000, 'XAF', '');
    insItem.run(id, 'Batterie 12V 200Ah gel', 'Battery 12V 200Ah gel', 'Batteries', 'Batteries', 160000, 'XAF', '');

    // 7. Ampoules LED
    id = insProd.run('ampoules-led', 'Ampoules LED', 'LED bulbs',
      'Éclairage LED économique pour tous types d\'installations.',
      'Energy-saving LED lighting for all types of installations.', '💡', '', 'materiels-electriques').lastInsertRowid;
    insItem.run(id, 'Ampoule LED 7W E27', 'LED bulb 7W E27', 'Standard', 'Standard', 1500, 'XAF', '');
    insItem.run(id, 'Ampoule LED 12W E27', 'LED bulb 12W E27', 'Standard', 'Standard', 2000, 'XAF', '');
    insItem.run(id, 'Tube LED 18W T8 120cm', 'LED tube 18W T8 120cm', 'Tubes', 'Tubes', 4500, 'XAF', '');
    insItem.run(id, 'Projecteur LED 50W', 'LED floodlight 50W', 'Projecteurs', 'Floodlights', 12000, 'XAF', '');

    // 8. Compteurs électriques
    id = insProd.run('compteurs-electriques', 'Compteurs électriques', 'Electric meters',
      'Compteurs de consommation électrique.',
      'Electricity consumption meters.', '📟', '', 'materiels-electriques').lastInsertRowid;
    insItem.run(id, 'Compteur monophasé 60A', 'Single-phase meter 60A', 'Monophasé', 'Single-phase', 25000, 'XAF', '');
    insItem.run(id, 'Compteur triphasé 100A', 'Three-phase meter 100A', 'Triphasé', 'Three-phase', 65000, 'XAF', '');
    insItem.run(id, 'Compteur prépayé', 'Prepaid meter', 'Prépayé', 'Prepaid', 45000, 'XAF', '');

    // 9. Équipements professionnels
    id = insProd.run('equipements-pro', 'Équipements professionnels', 'Professional equipment',
      'Outils et équipements pour professionnels du bâtiment et de l\'énergie.',
      'Tools and equipment for building and energy professionals.', '🛠️', '', 'commerce-general').lastInsertRowid;
    insItem.run(id, 'Perceuse électrique 750W', 'Electric drill 750W', 'Outillage', 'Tools', 35000, 'XAF', '');
    insItem.run(id, 'Meuleuse 125mm 850W', 'Angle grinder 125mm 850W', 'Outillage', 'Tools', 28000, 'XAF', '');
    insItem.run(id, 'Testeur de tension', 'Voltage tester', 'Mesure', 'Measurement', 8000, 'XAF', '');
    insItem.run(id, 'Multimètre numérique', 'Digital multimeter', 'Mesure', 'Measurement', 12000, 'XAF', '');

    // 10. Produits techniques divers
    id = insProd.run('produits-techniques', 'Produits techniques divers', 'Various technical products',
      'Tuyaux flexibles, invide, et autres fournitures techniques.',
      'Flexible pipes, inverters, and other technical supplies.', '🧰', '', 'commerce-general').lastInsertRowid;
    insItem.run(id, 'Tuyau flexible 1/2" — 50m', 'Flexible pipe 1/2" — 50m', 'Tuyauterie', 'Piping', 18000, 'XAF', '');
    insItem.run(id, 'Tuyau flexible 3/4" — 50m', 'Flexible pipe 3/4" — 50m', 'Tuyauterie', 'Piping', 25000, 'XAF', '');
    insItem.run(id, 'Onduleur 1000W', 'Inverter 1000W', 'Onduleurs', 'Inverters', 75000, 'XAF', '');
    insItem.run(id, 'Onduleur 3000W', 'Inverter 3000W', 'Onduleurs', 'Inverters', 180000, 'XAF', '');
  });

  seedProducts();
}

// Migration: add guest columns to existing orders table
try {
  const cols = db.prepare("PRAGMA table_info(orders)").all().map(c => c.name);
  if (!cols.includes('guest_name')) db.exec("ALTER TABLE orders ADD COLUMN guest_name TEXT");
  if (!cols.includes('guest_phone')) db.exec("ALTER TABLE orders ADD COLUMN guest_phone TEXT");
  if (!cols.includes('guest_email')) db.exec("ALTER TABLE orders ADD COLUMN guest_email TEXT");
} catch(e) { /* columns already exist */ }

// Migration: add avatar_url to users table
try {
  const cols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
  if (!cols.includes('avatar_url')) db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT");
} catch(e) {}

// Migration: Add vente-pompes service and move products from pompe-forage
try {
  const serviceExists = db.prepare("SELECT COUNT(*) as c FROM services WHERE slug = 'vente-pompes'").get().c;
  if (!serviceExists) {
    db.prepare(`INSERT INTO services (slug, name_fr, name_en, description_fr, description_en) VALUES (?,?,?,?,?)`)
      .run('vente-pompes', 'Vente de pompes', 'Pump sales', 'Vente de pompes hydrauliques et solaires.', 'Sale of hydraulic and solar pumps.');
  }
  db.prepare("UPDATE products SET service_slug = 'vente-pompes' WHERE service_slug = 'pompe-forage'").run();
} catch (e) {
  console.error("Migration error vente-pompes:", e);
}

module.exports = db;

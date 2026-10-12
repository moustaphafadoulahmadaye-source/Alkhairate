const db = require('better-sqlite3')('./data/eaepcg.db');

const services = [
  { slug: 'pompe-forage', catFr: 'Pompes et Forage', catEn: 'Pumps & Drilling' },
  { slug: 'vente-pompes', catFr: 'Vente de Pompes', catEn: 'Pump Sales' },
  { slug: 'materiels-electriques', catFr: 'Électricité', catEn: 'Electricity' },
  { slug: 'commerce-general', catFr: 'Quincaillerie', catEn: 'Hardware' },
  { slug: 'lavage', catFr: 'Nettoyage', catEn: 'Cleaning' },
  { slug: 'installation-immeubles', catFr: 'Construction', catEn: 'Construction' }
];

const sampleProducts = {
  'vente-pompes': [
    { slug: 'pompe-manuelle-india-mark-ii', fr: 'Pompe manuelle India Mark II (Robuste)', en: 'India Mark II Hand Pump (Robust)', price: 250000, img: 'https://images.unsplash.com/photo-1627993356029-45041ff91b0c?q=80&w=400&auto=format&fit=crop' },
    { slug: 'pompe-submersible-1.5hp', fr: 'Pompe submersible 1.5HP (Standard)', en: 'Submersible Pump 1.5HP (Standard)', price: 180000, img: 'https://images.unsplash.com/photo-1542338106-218a0a672722?q=80&w=400&auto=format&fit=crop' },
    { slug: 'pompe-submersible-3hp', fr: 'Pompe submersible 3HP (Haute Qualité)', en: 'Submersible Pump 3HP (High Quality)', price: 350000, img: 'https://images.unsplash.com/photo-1542338106-218a0a672722?q=80&w=400&auto=format&fit=crop' },
    { slug: 'pompe-solaire-lorentz-2hp', fr: 'Pompe Solaire Lorentz 2HP (Premium)', en: 'Lorentz Solar Pump 2HP (Premium)', price: 850000, img: 'https://images.unsplash.com/photo-1613665813446-82a78c468a1d?q=80&w=400&auto=format&fit=crop' },
    { slug: 'pompe-solaire-10hp', fr: 'Pompe Solaire 10HP (Industrielle)', en: '10HP Solar Pump (Industrial)', price: 1200000, img: 'https://images.unsplash.com/photo-1605651202774-7d573fd3f12d?q=80&w=400&auto=format&fit=crop' }
  ],
  'materiels-electriques': [
    // AMPOULES
    { slug: 'ampoule-led-12w', fr: 'Ampoule LED 12W (Économique)', en: '12W LED Bulb (Economy)', price: 1500, img: 'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?q=80&w=400&auto=format&fit=crop' },
    { slug: 'ampoule-led-50w', fr: 'Ampoule LED 50W (Haute Puissance)', en: '50W LED Bulb (High Power)', price: 4500, img: 'https://images.unsplash.com/photo-1541577015486-5d66cbcc10a1?q=80&w=400&auto=format&fit=crop' },
    { slug: 'projecteur-led-100w', fr: 'Projecteur LED 100W (Extérieur)', en: '100W LED Floodlight (Outdoor)', price: 15000, img: 'https://images.unsplash.com/photo-1626082928816-e4ff8ebce1cf?q=80&w=400&auto=format&fit=crop' },
    
    // CABLES
    { slug: 'cable-electrique-1.5mm', fr: 'Rouleau Câble Électrique 1.5mm²', en: '1.5mm² Electrical Cable Roll', price: 12000, img: 'https://images.unsplash.com/photo-1558434557-cb3930eeb816?q=80&w=400&auto=format&fit=crop' },
    { slug: 'cable-electrique-2.5mm', fr: 'Rouleau Câble Électrique 2.5mm² (Standard)', en: '2.5mm² Electrical Cable Roll', price: 18000, img: 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?q=80&w=400&auto=format&fit=crop' },
    { slug: 'cable-solaire-4mm', fr: 'Câble Solaire Spécial 4mm² (100m)', en: '4mm² Solar Cable (100m)', price: 45000, img: 'https://images.unsplash.com/photo-1605651202774-7d573fd3f12d?q=80&w=400&auto=format&fit=crop' },
    
    // PANNEAUX SOLAIRES
    { slug: 'panneau-solaire-150w', fr: 'Panneau Solaire 150W (Standard)', en: '150W Solar Panel (Standard)', price: 45000, img: 'https://images.unsplash.com/photo-1509391366360-1200155694b2?q=80&w=400&auto=format&fit=crop' },
    { slug: 'panneau-solaire-330w', fr: 'Panneau Solaire 330W (Poly)', en: '330W Solar Panel (Poly)', price: 75000, img: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=400&auto=format&fit=crop' },
    { slug: 'panneau-solaire-450w', fr: 'Panneau Solaire 450W (Mono Haute Qualité)', en: '450W Solar Panel (Mono High Quality)', price: 110000, img: 'https://images.unsplash.com/photo-1613665813446-82a78c468a1d?q=80&w=400&auto=format&fit=crop' },
    
    // GENERATEURS
    { slug: 'generateur-essence-3kva', fr: 'Générateur Essence 3 kVA (Portable)', en: '3 kVA Petrol Generator', price: 250000, img: 'https://images.unsplash.com/photo-1621213076161-0b5c11090333?q=80&w=400&auto=format&fit=crop' },
    { slug: 'generateur-diesel-10kva', fr: 'Générateur Diesel 10 kVA (Industriel)', en: '10 kVA Diesel Generator', price: 1800000, img: 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?q=80&w=400&auto=format&fit=crop' }
  ],
  'commerce-general': [
    { slug: 'batterie-solaire-100ah', fr: 'Batterie Solaire 100Ah (Gel)', en: '100Ah Solar Battery (Gel)', price: 95000, img: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=400&auto=format&fit=crop' },
    { slug: 'batterie-solaire-200ah', fr: 'Batterie Solaire 200Ah (Lithium Haute Qualité)', en: '200Ah Solar Battery (Lithium)', price: 350000, img: 'https://images.unsplash.com/photo-1581092334884-25e1bb342e47?q=80&w=400&auto=format&fit=crop' }
  ]
};

try {
  db.prepare('BEGIN').run();
  
  // Clear old products to avoid duplicate slugs easily
  db.prepare('DELETE FROM products').run();
  db.prepare('DELETE FROM product_items').run();

  const insertProduct = db.prepare('INSERT INTO products (slug, name_fr, name_en, service_slug) VALUES (?, ?, ?, ?)');
  const insertItem = db.prepare('INSERT INTO product_items (product_id, name_fr, name_en, category_fr, category_en, price, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)');

  for (const srv of services) {
    const prods = sampleProducts[srv.slug];
    if (!prods) continue;
    
    for (const p of prods) {
      const res = insertProduct.run(p.slug, p.fr, p.en, srv.slug);
      const pid = res.lastInsertRowid;
      insertItem.run(pid, p.fr, p.en, srv.catFr, srv.catEn, p.price, p.img);
    }
  }

  db.prepare('COMMIT').run();
  console.log('Electrical products inserted successfully!');
} catch (e) {
  db.prepare('ROLLBACK').run();
  console.error('Error inserting products:', e);
}

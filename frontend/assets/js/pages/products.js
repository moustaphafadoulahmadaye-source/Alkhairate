renderHeader('products.html'); renderFooter();

  function formatPrice(p,c){if(!p||p===0)return'—';return new Intl.NumberFormat('fr-FR').format(p)+' '+(c||'XAF');}

  const svgPlaceholder = `
    <div class="icon-wrap">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--blue-deep)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
    </div>
  `;

  let currentItems = [];

  function renderGrid(categoryId) {
    const grid = document.getElementById('itemsGrid');
    if (!grid) return;
    
    let filtered = currentItems;
    if (categoryId !== 'all') {
      filtered = currentItems.filter(item => String(item.product_id) === String(categoryId));
    }

    if (filtered.length === 0) {
      grid.innerHTML = `<div class="empty-category"><span data-fr>Aucun produit disponible dans cette catégorie.</span><span data-en>No products available in this category.</span><span data-ar>لا توجد منتجات في هذه الفئة.</span></div>`;
      return;
    }

    grid.innerHTML = filtered.map(item => {
      const localizedName = currentLang() === 'en' ? item.name_en : item.name_fr;
      return `
      <div class="item-card" data-id="${escapeHtml(item.id)}" data-name="${escapeHtml(localizedName)}" data-price="${Number(item.price) || 0}" data-currency="${escapeHtml(item.currency || 'XAF')}" data-service="${escapeHtml(item.service_slug||'')}" data-image="${typeof sanitizeImageSrc === 'function' ? sanitizeImageSrc(item.image_url) : escapeHtml(item.image_url||'')}">
        ${item.image_url ? `<div class="item-img"><img src="${typeof sanitizeImageSrc === 'function' ? sanitizeImageSrc(item.image_url) : escapeHtml(item.image_url)}" alt=""></div>` : svgPlaceholder}
        <div class="item-name"><span data-fr>${escapeHtml(item.name_fr)}</span><span data-en>${escapeHtml(item.name_en)}</span><span data-ar>${escapeHtml(item.name_fr)}</span></div>
        <div class="item-price">${formatPrice(item.price, item.currency)}</div>
        <div class="item-stock ${item.in_stock?'yes':'no'}">
          ${item.in_stock ? `<span data-fr>En stock</span><span data-en>In stock</span><span data-ar>متوفر</span>` : `<span data-fr>Rupture</span><span data-en>Out of stock</span><span data-ar>غير متوفر</span>`}
        </div>
        ${Auth.getUser()?.role !== 'admin' ? `
        <div style="display:flex; gap:8px; margin-top:12px;">
          <button class="item-card-btn btn-cart" type="button" style="flex:1;">
            <span data-fr>+ Panier</span><span data-en>+ Cart</span><span data-ar>+ السلة</span>
          </button>
          <button class="item-card-btn btn-buy" type="button" style="flex:1; background:var(--brand-primary); color:white; border-color:var(--brand-primary);">
            <span data-fr>Commander</span><span data-en>Order Now</span><span data-ar>اطلب الآن</span>
          </button>
        </div>` : ''}
      </div>`;
    }).join('');
  }

  function applyCatalogData(data, isOfflineCache = false) {
    const container = document.getElementById('catalogContainer');
    const { service, categories, items } = data;
    
    const nameFr = escapeHtml(service.name_fr), nameEn = escapeHtml(service.name_en);
    document.getElementById('heroTitle').innerHTML = `<span data-fr>${nameFr}</span><span data-en>${nameEn}</span><span data-ar>${nameFr}</span>`;
    document.getElementById('heroDesc').innerHTML = `<span data-fr>${escapeHtml(service.description_fr||'')}</span><span data-en>${escapeHtml(service.description_en||'')}</span><span data-ar>${escapeHtml(service.description_fr||'')}</span>`;
    
    let html = '';
    if (isOfflineCache) {
      html += `<div style="background:#fef3c7; border:1px solid #fde68a; color:#92400e; padding:10px 16px; border-radius:10px; margin-bottom:20px; font-size:13.5px; font-weight:600; display:flex; align-items:center; gap:8px;">
        <span>📡</span>
        <span>Mode hors ligne : affichage du catalogue en mémoire locale.</span>
      </div>`;
    }
    html += `<div class="category-filter" id="catFilter">
      <div class="filter-pill active" data-cat="all"><span data-fr>Tout</span><span data-en>All</span><span data-ar>الكل</span></div>
    `;
    categories.forEach(cat => {
      html += `<div class="filter-pill" data-cat="${cat.id}"><span data-fr>${escapeHtml(cat.name_fr)}</span><span data-en>${escapeHtml(cat.name_en)}</span><span data-ar>${escapeHtml(cat.name_fr)}</span></div>`;
    });
    html += `</div><div class="item-grid" id="itemsGrid"></div>`;
    
    currentItems = items;
    container.innerHTML = html;
    renderGrid('all');
    
    // Filter click events
    document.getElementById('catFilter').addEventListener('click', (e) => {
      const pill = e.target.closest('.filter-pill');
      if (!pill) return;
      
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      
      renderGrid(pill.dataset.cat);
    });
  }

  function loadCatalog() {
    const container = document.getElementById('catalogContainer');
    let hash = window.location.hash.substring(1);
    if (!hash) {
      hash = 'commerce-general';
    }

    const cached = typeof CatalogCache !== 'undefined' ? CatalogCache.get('service_' + hash) : null;
    if (typeof navigator !== 'undefined' && !navigator.onLine && cached) {
      applyCatalogData(cached, true);
      return;
    }

    renderLoading(container);
    
    apiFetch('/services/' + encodeURIComponent(hash) + '/catalog').then(data => {
      if (typeof CatalogCache !== 'undefined') {
        CatalogCache.set('service_' + hash, data);
      }
      applyCatalogData(data, false);
    }).catch(err => {
      if (cached) {
        applyCatalogData(cached, true);
        return;
      }
      document.getElementById('heroTitle').innerHTML = `<span data-fr>Catalogue</span><span data-en>Catalog</span><span data-ar>الكتالوج</span>`;
      document.getElementById('heroDesc').innerHTML = ``;
      if (err.status === 404) {
        container.innerHTML = `<p class="async-state error-state"><span data-fr>Service introuvable.</span><span data-en>Service not found.</span><span data-ar>الخدمة غير موجودة.</span></p>`;
        return;
      }
      renderApiError(container, loadCatalog);
    });
  }
  
  window.addEventListener('hashchange', loadCatalog);
  loadCatalog();

  // Cart logic
  window.addToCart = async function(id, name, price, currency, serviceSlug, imageUrl) {
    let contentHtml = '';
    if (imageUrl) {
      contentHtml += `<div style="text-align:center; margin-bottom:16px;"><img src="${escapeHtml(imageUrl)}" style="width:120px; height:120px; object-fit:cover; border-radius:12px; border:2px solid rgba(0,0,0,0.05); box-shadow:0 4px 12px rgba(0,0,0,0.05);"></div>`;
    }
    
    const textMsg = {
      fr:"Combien de '" + name + "' souhaitez-vous ajouter au panier ?",
      en:"How many '" + name + "' do you want to add to cart?",
      ar:"كم '" + name + "' تريد إضافته إلى السلة؟"
    }[currentLang()] || "Quantité ?";
    
    contentHtml += `<p style="text-align:center; margin:0; font-weight:600; font-size:15px; color:var(--text-main);">${escapeHtml(textMsg)}</p>`;

    const qtyStr = await showModal(
      {fr:"Ajouter au panier",en:"Add to cart",ar:"أضف إلى السلة"}[currentLang()] || "Ajouter",
      contentHtml,
      { prompt: true, promptValue: "1", confirmText: {fr:"Ajouter",en:"Add",ar:"إضافة"}[currentLang()] || 'Ajouter', cancelText: {fr:"Annuler",en:"Cancel",ar:"إلغاء"}[currentLang()] || 'Annuler' }
    );
    if (!qtyStr) return;
    const quantity = parseInt(qtyStr, 10);
    if (quantity < 1 || isNaN(quantity)) {
      showModal(localizedText('loadError'), {fr:"Quantité invalide",en:"Invalid quantity",ar:"كمية غير صالحة"}[currentLang()], { cancelText: null });
      return;
    }
    
    Cart.add({ id, name, price, quantity, currency, serviceSlug, imageUrl });
    showModal('Succès', {fr:"Ajouté au panier !",en:"Added to cart!",ar:"تمت الإضافة إلى السلة!"}[currentLang()], { cancelText: null });
  };

  document.addEventListener('click', (e) => {
    if (Auth.getUser()?.role === 'admin') return;
    
    const card = e.target.closest('.item-card');
    if (!card) return;
    const btnBuy = e.target.closest('.btn-buy');
    const btnCart = e.target.closest('.btn-cart');
    
    // Default to cart flow if they clicked somewhere on the card but not on the direct buy button
    const isDirectBuy = !!btnBuy;
    
    const id = parseInt(card.getAttribute('data-id'), 10);
    const name = card.getAttribute('data-name');
    const price = parseFloat(card.getAttribute('data-price')) || 0;
    const currency = card.getAttribute('data-currency') || 'XAF';
    const serviceSlug = card.getAttribute('data-service') || '';
    const imageUrl = card.getAttribute('data-image') || '';
    
    if (id && name) {
      if (isDirectBuy) {
        Cart.clear();
        Cart.add({ id, name, price, quantity: 1, currency, serviceSlug, imageUrl });
        window.location.href = 'order.html';
      } else {
        addToCart(id, name, price, currency, serviceSlug, imageUrl);
      }
    }
  });

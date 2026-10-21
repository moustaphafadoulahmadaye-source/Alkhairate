renderHeader('services.html'); renderFooter();
  const IMAGES = {
    'pompe-forage': 'assets/img/pompe.jpg',
    'vente-pompes': 'assets/img/vente-pompes.jpg',
    'materiels-electriques': 'assets/img/materiels.jpg',
    'commerce-general': 'assets/img/commerce.jpg',
    'lavage': 'assets/img/lavage.jpg',
    'installation-immeubles': 'assets/img/installation.jpg'
  };

  function renderServicesList(services, products, isOffline = false) {
    const container = document.getElementById('servicesGrid');
    if (!services || !services.length) { renderEmpty(container, 'emptyServices'); return; }
    const prodsByService = {};
    (products || []).forEach(p => { 
      if(p.service_slug){
        if(!prodsByService[p.service_slug]) prodsByService[p.service_slug]=[];
        prodsByService[p.service_slug].push(p);
      } 
    });
    let html = '';
    if (isOffline) {
      html += `<div style="grid-column: 1 / -1; background:#fef3c7; border:1px solid #fde68a; color:#92400e; padding:10px 16px; border-radius:10px; margin-bottom:12px; font-size:13.5px; font-weight:600; display:flex; align-items:center; gap:8px;">
        <span>📡</span>
        <span>Mode hors ligne : affichage des services en mémoire locale.</span>
      </div>`;
    }
    html += services.map((s, index) => {
      const related = prodsByService[s.slug]||[];
      let href = related.length ? `products.html#${s.slug}` : `order.html?service=${s.slug}`;
      if (s.slug === 'lavage') href = 'lavage.html';
      const num = String(index + 1).padStart(2, '0');
      
      // Use DB image if set, else fallback to hardcoded IMAGES array
      const imgUrl = s.image_url || IMAGES[s.slug] || 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80';
      
      const numItems = related.reduce((acc, curr) => acc + (curr.item_count || 0), 0);
      const isAlt = index % 2 !== 0 ? 'alt' : '';
      
      return `
        <a class="premium-service-card ${isAlt}" href="${escapeHtml(href)}" id="${escapeHtml(s.slug)}">
          <div class="psc-bg">
            <img src="${typeof sanitizeImageSrc === 'function' ? sanitizeImageSrc(imgUrl) : escapeHtml(imgUrl)}" alt="${escapeHtml(s.name_fr)}">
          </div>
          <div class="psc-content">
            <div class="psc-num">SERVICE ${num}</div>
            <h3 class="psc-title">
              <span data-fr>${escapeHtml(s.name_fr)}</span>
              <span data-en>${escapeHtml(s.name_en)}</span>
              <span data-ar>${escapeHtml(s.name_fr)}</span>
            </h3>
            <p class="psc-desc">
              <span data-fr>${escapeHtml(s.description_fr||'')}</span>
              <span data-en>${escapeHtml(s.description_en||'')}</span>
              <span data-ar>${escapeHtml(s.description_fr||'')}</span>
            </p>
            <div class="psc-footer">
              <div class="psc-count"><strong>${numItems}</strong> <span data-fr>ÉQUIPEMENT(S)</span><span data-en>EQUIPMENT(S)</span><span data-ar>المعدات</span></div>
              <div class="psc-arrow">→</div>
            </div>
          </div>
        </a>
      `;
    }).join('');
    container.innerHTML = html;

    // Auto-scroll to the requested service if the URL has a hash
    if (window.location.hash) {
      setTimeout(() => {
        const target = document.getElementById(window.location.hash.substring(1));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    }
  }

  function loadServices(){
    const container = document.getElementById('servicesGrid');
    const cached = typeof CatalogCache !== 'undefined' ? CatalogCache.get('services_catalog') : null;
    if (typeof navigator !== 'undefined' && !navigator.onLine && cached) {
      renderServicesList(cached.services, cached.products, true);
      return;
    }

    renderLoading(container);
    Promise.all([apiFetch('/services'), apiFetch('/products')]).then(([sData, pData]) => {
      if (typeof CatalogCache !== 'undefined') {
        CatalogCache.set('services_catalog', { services: sData.services, products: pData.products });
      }
      renderServicesList(sData.services, pData.products, false);
    }).catch(() => {
      if (cached) {
        renderServicesList(cached.services, cached.products, true);
        return;
      }
      renderApiError(container, loadServices);
    });
  }
  loadServices();

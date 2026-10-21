renderHeader('products.html'); renderFooter();

  const shareBtn = document.getElementById('btnShareProduct');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      const title = document.getElementById('heroTitle')?.textContent || 'Alkhaïrat Énergie';
      const desc = document.getElementById('heroDesc')?.textContent || '';
      if (typeof shareProduct === 'function') {
        shareProduct(title, desc, window.location.href);
      }
    });
  }
  const waBtn = document.getElementById('btnProductWhatsApp');
  if (waBtn && typeof getWhatsAppUrl === 'function') {
    waBtn.href = getWhatsAppUrl();
  }
  const slug = new URLSearchParams(window.location.search).get('slug');
  if (!slug) {
    document.getElementById('heroTitle').innerHTML = `<span data-fr>Produit</span><span data-en>Product</span><span data-ar>المنتج</span>`;
    document.getElementById('itemsContainer').innerHTML = `<p class="async-state error-state"><span data-fr>Veuillez sélectionner un produit dans le catalogue.</span><span data-en>Please select a product from the catalog.</span><span data-ar>يرجى اختيار منتج من الكتالوج.</span></p>`;
    try { window.location.href = 'products.html'; } catch(e){}
  }
  function formatPrice(p,c){if(!p||p===0)return'—';return new Intl.NumberFormat('fr-FR').format(p)+' '+(c||'XAF');}
  
  window.addToCart = async function(id, name, price, currency, serviceSlug) {
    const qtyStr = await showModal(
      {fr:"Quantité ?",en:"Quantity?",ar:"الكمية؟"}[currentLang()] || "Quantité ?",
      {fr:"Combien de '" + name + "' souhaitez-vous ajouter au panier ?",en:"How many '" + name + "' do you want to add to cart?",ar:"كم '" + name + "' تريد إضافته إلى السلة؟"}[currentLang()]||"Quantité ?",
      { prompt: true, promptValue: "1", confirmText: {fr:"Ajouter",en:"Add",ar:"إضافة"}[currentLang()] || 'Ajouter', cancelText: {fr:"Annuler",en:"Cancel",ar:"إلغاء"}[currentLang()] || 'Annuler' }
    );
    if (!qtyStr) return;
    const quantity = parseInt(qtyStr, 10);
    if (quantity < 1 || isNaN(quantity)) {
      showModal(localizedText('loadError'), {fr:"Quantité invalide",en:"Invalid quantity",ar:"كمية غير صالحة"}[currentLang()], { cancelText: null });
      return;
    }
    
    Cart.add({ id, name, price, quantity, currency, serviceSlug });
    showModal('Succès', {fr:"Ajouté au panier !",en:"Added to cart!",ar:"تمت الإضافة إلى السلة!"}[currentLang()], { cancelText: null });
  };

  document.getElementById('itemsContainer').addEventListener('click', (e) => {
    const card = e.target.closest('.item-card');
    if (!card) return;
    const id = parseInt(card.getAttribute('data-id'), 10);
    const name = card.getAttribute('data-name');
    const price = parseFloat(card.getAttribute('data-price')) || 0;
    const currency = card.getAttribute('data-currency') || 'XAF';
    const serviceSlug = card.getAttribute('data-service') || '';
    if (id && name) addToCart(id, name, price, currency, serviceSlug);
  });

  const svgPlaceholder = `
    <div class="icon-wrap">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--blue-deep)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
    </div>
  `;

  function loadProduct(){
  const container = document.getElementById('itemsContainer');
  renderLoading(container);
  apiFetch('/products/'+encodeURIComponent(slug)).then(({product,items})=>{
    const lang = document.documentElement.lang;
    const nameFr = escapeHtml(product.name_fr), nameEn = escapeHtml(product.name_en);
    document.getElementById('heroEyebrow').innerHTML=`<span data-fr>${nameFr}</span><span data-en>${nameEn}</span><span data-ar>${nameFr}</span>`;
    document.getElementById('heroTitle').innerHTML=`<span data-fr>${nameFr}</span><span data-en>${nameEn}</span><span data-ar>${nameFr}</span>`;
    document.getElementById('heroDesc').innerHTML=`<span data-fr>${escapeHtml(product.description_fr||'')}</span><span data-en>${escapeHtml(product.description_en||'')}</span><span data-ar>${escapeHtml(product.description_fr||'')}</span>`;
    if(!items.length){renderEmpty(container, 'emptyItems');return;}
    const categories={};
    items.forEach(item=>{
      const cat = lang==='en' ? (item.category_en||'General') : (item.category_fr||'Général');
      if(!categories[cat])categories[cat]=[];
      categories[cat].push(item);
    });
    document.getElementById('itemsContainer').innerHTML = Object.entries(categories).map(([cat,catItems])=>`
      <div class="cat-section">
        <div class="cat-title">${escapeHtml(cat)} <span style="opacity:0.5; font-size:12px; margin-left:8px;">(${catItems.length})</span></div>
        <div class="item-grid">${catItems.map(item=>{
          const localizedName = currentLang()==='en'?item.name_en:item.name_fr;
          return `
          <div class="item-card" data-id="${escapeHtml(item.id)}" data-name="${escapeHtml(localizedName)}" data-price="${Number(item.price) || 0}" data-currency="${escapeHtml(item.currency || 'XAF')}" data-service="${escapeHtml(product.service_slug||'')}">
            ${item.image_url ? `<div class="item-img"><img src="${typeof sanitizeImageSrc === 'function' ? sanitizeImageSrc(item.image_url) : escapeHtml(item.image_url)}" alt=""></div>` : svgPlaceholder}
            <div class="item-name"><span data-fr>${escapeHtml(item.name_fr)}</span><span data-en>${escapeHtml(item.name_en)}</span><span data-ar>${escapeHtml(item.name_fr)}</span></div>
            <div class="item-price">${formatPrice(item.price, item.currency)}</div>
            <div class="item-stock ${item.in_stock?'yes':'no'}">
              ${item.in_stock?`<span data-fr>En stock</span><span data-en>In stock</span><span data-ar>متوفر</span>`:`<span data-fr>Rupture</span><span data-en>Out of stock</span><span data-ar>غير متوفر</span>`}
            </div>
            <div style="margin-top:12px; font-size:13px; font-weight:600; color:var(--yellow); text-transform:uppercase;">
              <span data-fr>+ Ajouter au panier</span><span data-en>+ Add to cart</span><span data-ar>+ أضف إلى السلة</span>
            </div>
          </div>`}).join('')}
        </div>
      </div>`).join('');
  }).catch((err)=>{
    document.getElementById('heroTitle').innerHTML = `<span data-fr>Produit introuvable</span><span data-en>Product not found</span><span data-ar>المنتج غير موجود</span>`;
    if (err.status === 404) {
      container.innerHTML = `<p class="async-state error-state">${escapeHtml(localizedText('productNotFound'))}</p>`;
      return;
    }
    renderApiError(container, loadProduct);
  });
  }
  if (slug) {
    loadProduct();
  }

function renderHeader(activePage){
  const links = [
    ['index.html',    'Accueil',           'Home',      'الرئيسية'],
    ['about.html',    'À propos',          'About',     'من نحن'],
    ['services.html', 'Services',          'Services',  'خدماتنا'],
    ['products.html', 'Commerce général',  'General trading', 'التجارة العامة'],
    ['contact.html',  'Contact',           'Contact',   'اتصل بنا'],
  ];
  const linkHtml = links.map(([href, fr, en, ar]) => {
    const active = activePage === href ? ' class="active"' : '';
    return `<a href="${href}"${active}><span data-fr>${fr}</span><span data-en>${en}</span><span data-ar>${ar}</span></a>`;
  }).join('');

  const langLabels = {fr:'FR', en:'ANG', ar:'عر'};
  const cl = currentLang();

  document.getElementById('site-header').innerHTML = `
  <div class="topbar">
    <div class="topbar-inner">
      <div class="topbar-left">
        <a href="https://maps.google.com/?q=Abéché,+Tchad" target="_blank" class="topbar-info">📍 Abéché, Tchad</a>
        <span class="topbar-divider">|</span>
        <a href="tel:+23566341078" class="topbar-info">📞 +235 66 34 10 78</a>
      </div>
      <div class="topbar-right">
        <div class="lang-toggle" id="langToggle">
          <button class="lang-btn" id="langBtn">${langLabels[cl] || 'FR'}</button>
          <div class="lang-dropdown" id="langDropdown">
            <button data-lang="fr" class="${cl==='fr'?'active':''}">Français</button>
            <button data-lang="en" class="${cl==='en'?'active':''}">English</button>
            <button data-lang="ar" class="${cl==='ar'?'active':''}">عربي</button>
          </div>
        </div>
        <div class="nav-actions" id="navActions"></div>
      </div>
    </div>
  </div>
  <header>
    <div class="nav">
      <a class="brand" href="index.html">
        <img src="assets/img/logo.jpg" alt="Logo EAEPCG">
        <div class="brand-text">
          <div class="name">Alkhaïrat Énergie</div>
          <div class="sub">EAEPCG · Énergie & Solutions Industrielles</div>
        </div>
      </a>
      <button class="nav-hamburger" id="navHamburger" aria-label="Menu" type="button">
        <span></span>
        <span></span>
        <span></span>
      </button>
      <nav class="links" id="navLinks">${linkHtml}
        ${Auth.getUser()?.role === 'admin' ? `
        <a href="admin.html?filter=pending" class="nav-cart-link" style="background:var(--yellow); color:var(--ink); padding:8px 12px; margin-right:8px;" title="Notifications">
          <span data-fr>Notifications</span><span data-en>Notifications</span><span data-ar>إشعارات</span><span class="nav-cart-badge" id="adminNotifBadge" style="display:none; background:var(--red); color:white; border:2px solid var(--yellow); right:-6px; top:-6px;"></span>
        </a>
        ` : ''}
        ${(Auth.getUser()?.role !== 'admin' && activePage !== 'admin.html') ? `
        <a href="order.html" class="nav-quote-btn">
          <span data-fr>Demander un devis</span><span data-en>Get a Quote</span><span data-ar>طلب تسعيرة</span>
        </a>
        <a href="order.html" class="nav-cart-link" id="navCartLink" title="Panier">
          🛒 <span data-fr>Panier</span><span data-en>Cart</span><span data-ar>السلة</span>
          <span class="nav-cart-badge" id="navCartBadge" style="display:none;"></span>
        </a>
        ` : ''}
      </nav>
    </div>
  </header>`;

  // Mobile Hamburger Menu toggle
  const navHamburger = document.getElementById('navHamburger');
  const navLinks = document.getElementById('navLinks');
  if (navHamburger && navLinks) {
    navHamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      navHamburger.classList.toggle('active');
      navLinks.classList.toggle('mobile-open');
    });
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navHamburger.classList.remove('active');
        navLinks.classList.remove('mobile-open');
      });
    });
    document.addEventListener('click', (e) => {
      if (!navLinks.contains(e.target) && !navHamburger.contains(e.target)) {
        navHamburger.classList.remove('active');
        navLinks.classList.remove('mobile-open');
      }
    });
  }

  // Language dropdown toggle
  const langBtn = document.getElementById('langBtn');
  const langDropdown = document.getElementById('langDropdown');
  if(langBtn && langDropdown){
    langBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      langDropdown.classList.toggle('open');
    });
    langDropdown.querySelectorAll('button[data-lang]').forEach(btn => {
      btn.addEventListener('click', () => {
        setLang(btn.dataset.lang);
        langDropdown.classList.remove('open');
        langBtn.textContent = '🌐 ' + ({fr:'FR',en:'ANG',ar:'عر'}[btn.dataset.lang] || 'FR');
        langDropdown.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
    document.addEventListener('click', () => langDropdown.classList.remove('open'));
  }

  renderNavActions();
  updateCartBadge();
  syncGlobalLogo();
}

function syncGlobalLogo() {
  try {
    const cachedLogo = localStorage.getItem('eaepcg_site_logo');
    if (cachedLogo) {
      document.querySelectorAll('.brand img, .site-logo-img, #headerSiteLogo, #homeEnterpriseLogo, #siteLogoHero, #footerSiteLogo').forEach(img => {
        img.src = cachedLogo;
      });
    }
    fetch((window.location.protocol === 'file:' ? 'http://localhost:4000/api' : '/api') + '/settings')
      .then(r => r.json())
      .then(s => {
        if (s && s.site_logo) {
          localStorage.setItem('eaepcg_site_logo', s.site_logo);
          document.querySelectorAll('.brand img, .site-logo-img, #headerSiteLogo, #homeEnterpriseLogo, #siteLogoHero, #footerSiteLogo').forEach(img => {
            img.src = s.site_logo;
          });
        }
      })
      .catch(() => {});
  } catch(e) {}
}

const Cart = {
  getItems: () => JSON.parse(localStorage.getItem('eaepcg_cart') || '[]'),
  saveItems: (items) => {
    localStorage.setItem('eaepcg_cart', JSON.stringify(items));
    window.dispatchEvent(new Event('cartUpdated'));
  },
  add: (item) => {
    const items = Cart.getItems();
    const ex = items.find(i => i.id === item.id);
    if (ex) ex.quantity += item.quantity;
    else items.push(item);
    Cart.saveItems(items);
  },
  remove: (id) => {
    Cart.saveItems(Cart.getItems().filter(i => String(i.id) !== String(id)));
  },
  clear: () => Cart.saveItems([]),
  count: () => Cart.getItems().reduce((a, b) => a + b.quantity, 0),
  total: () => Cart.getItems().reduce((a, b) => a + (b.price * b.quantity), 0)
};

window.addEventListener('cartUpdated', () => { renderNavActions(); updateCartBadge(); });

function updateCartBadge(){
  const badge = document.getElementById('navCartBadge');
  if(!badge) return;
  const count = Cart.count();
  if(count > 0){ badge.textContent = count; badge.style.display = 'inline-flex'; }
  else { badge.style.display = 'none'; }
}

function renderNavActions(){
  const el = document.getElementById('navActions');
  if (!el) return;
  const user = Auth.getUser();

  if (user){
    const dash = user.role === 'admin' ? 'admin.html' : 'account.html';
    el.innerHTML = `
      <a class="topbar-link" href="${dash}">👤 ${escapeHtml(user.full_name.split(' ')[0])}</a>
      <span class="topbar-divider">|</span>
      <button class="topbar-link" id="logoutBtn" style="background:none; border:none; cursor:pointer;"><span data-fr>Déconnexion</span><span data-en>Log out</span><span data-ar>خروج</span></button>
    `;
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      try { if (Auth.getToken()) await apiFetch('/auth/logout', { method: 'POST' }); }
      finally {
        Auth.clear();
        window.location.href = 'index.html';
      }
    });
  } else {
    el.innerHTML = `
      <a class="topbar-link" href="login.html"><span data-fr>Connexion</span><span data-en>Log in</span><span data-ar>دخول</span></a>
      <span class="topbar-divider">|</span>
      <a class="topbar-link topbar-link-accent" href="register.html"><span data-fr>Créer un compte</span><span data-en>Sign up</span><span data-ar>إنشاء حساب</span></a>
    `;
  }
}

function renderFooter(){
  const waUrl = 'https://wa.me/23566341078?text=Bonjour%2C%20je%20vous%20contacte%20depuis%20votre%20site%20web%20EAEPCG.%20Je%20souhaite%20avoir%20des%20informations.';
  document.getElementById('site-footer').innerHTML = `
  <a class="whatsapp-fab" href="${waUrl}" target="_blank" rel="noopener" aria-label="WhatsApp">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.06-.173-.299-.018-.461.13-.611.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
    </svg>
  </a>
  <footer>
    <div class="footer-top">
      <div class="footer-col">
        <h4><strong>Alkhaïrat Énergie</strong> (EAEPCG)</h4>
        <p>
          <span data-fr>L'énergie et le commerce, réunis. Des solutions haut de gamme pour les infrastructures, l'énergie et la construction au Tchad.</span>
          <span data-en>Energy and trade, united. Premium solutions for infrastructure, energy and construction in Chad.</span>
          <span data-ar>الطاقة والتجارة، معاً. حلول ممتازة للبنية التحتية والطاقة والبناء في تشاد.</span>
        </p>
      </div>
      <div class="footer-col">
        <h4><span data-fr>Liens rapides</span><span data-en>Quick Links</span><span data-ar>روابط سريعة</span></h4>
        <ul>
          <li><a href="index.html"><span data-fr>Accueil</span><span data-en>Home</span><span data-ar>الرئيسية</span></a></li>
          <li><a href="services.html"><span data-fr>Nos Services</span><span data-en>Our Services</span><span data-ar>خدماتنا</span></a></li>
          <li><a href="products.html"><span data-fr>Commerce Général</span><span data-en>General Trading</span><span data-ar>التجارة العامة</span></a></li>
          <li><a href="about.html"><span data-fr>À propos</span><span data-en>About us</span><span data-ar>من نحن</span></a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4><span data-fr>Contact & Infos</span><span data-en>Contact & Info</span><span data-ar>اتصل بنا ومعلومات</span></h4>
        <p>📍 <strong>Localisation:</strong><br> Abéché, Tchad</p>
        <p>📞 <strong>Téléphone:</strong><br> <a href="tel:+23566341078" style="color:#b9c3e0; text-decoration:none;">+235 66 34 10 78</a></p>
        <p>📧 <strong>Email:</strong><br> <a href="mailto:contact@alkhairat-energie.com" style="color:#b9c3e0; text-decoration:none;">contact@alkhairat-energie.com</a></p>
      </div>
    </div>
    <div class="footer-bottom">
      <span data-fr>© 2026 Établissement Alkhaïrat Énergie (EAEPCG). Tous droits réservés.</span>
      <span data-en>© 2026 Etablissement Alkhaïrat Énergie (EAEPCG). All rights reserved.</span>
      <span data-ar>© 2026 مؤسسة الخيرات للطاقة (EAEPCG). جميع الحقوق محفوظة.</span>
    </div>
  </footer>`;
}

function escapeHtml(str){
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function currentLang(){
  return localStorage.getItem('eaepcg_lang') || 'fr';
}

function initLangToggle(){
  document.documentElement.lang = currentLang();
}

function setLang(lang){
  document.documentElement.lang = lang;
  localStorage.setItem('eaepcg_lang', lang);
}

const UI_TEXT = {
  loading: { fr: 'Chargement…', en: 'Loading…', ar: 'جاري التحميل…' },
  retry: { fr: 'Réessayer', en: 'Retry', ar: 'إعادة المحاولة' },
  loadError: {
    fr: 'Impossible de charger les données. Vérifiez votre connexion puis réessayez.',
    en: 'Unable to load the data. Please check your connection and try again.',
    ar: 'تعذر تحميل البيانات. تحقق من اتصالك ثم حاول مرة أخرى.'
  },
  emptyProducts: { fr: 'Aucun produit disponible pour le moment.', en: 'No products are available yet.', ar: 'لا توجد منتجات متاحة حالياً.' },
  emptyServices: { fr: 'Aucun service disponible pour le moment.', en: 'No services are available yet.', ar: 'لا توجد خدمات متاحة حالياً.' },
  emptyOrders: { fr: 'Aucune commande pour le moment.', en: 'No orders yet.', ar: 'لا توجد طلبات حتى الآن.' },
  emptyMessages: { fr: 'Aucun message pour le moment.', en: 'No messages yet.', ar: 'لا توجد رسائل حتى الآن.' },
  emptyUsers: { fr: 'Aucun client pour le moment.', en: 'No customers yet.', ar: 'لا يوجد عملاء حتى الآن.' },
  emptyItems: { fr: 'Aucun article disponible. Contactez-nous.', en: 'No items available. Contact us.', ar: 'لا توجد منتجات متاحة. تواصل معنا.' },
  productNotFound: { fr: 'Produit introuvable.', en: 'Product not found.', ar: 'المنتج غير موجود.' }
};

function localizedText(key){
  const text = UI_TEXT[key] || UI_TEXT.loadError;
  return text[currentLang()] || text.fr;
}

function renderLoading(container){
  container.innerHTML = `<p class="async-state loading-state">${escapeHtml(localizedText('loading'))}</p>`;
}

function renderEmpty(container, key){
  container.innerHTML = `<p class="async-state empty-state">${escapeHtml(localizedText(key))}</p>`;
}

function renderApiError(container, retry){
  container.innerHTML = `
    <div class="async-state error-state">
      <p>${escapeHtml(localizedText('loadError'))}</p>
      <button type="button" class="btn btn-outline btn-sm async-retry">${escapeHtml(localizedText('retry'))}</button>
    </div>`;
  container.querySelector('.async-retry').addEventListener('click', retry);
}

function renderTableLoading(tbody, colspan){
  tbody.innerHTML = `<tr><td colspan="${colspan}"><span class="async-state loading-state">${escapeHtml(localizedText('loading'))}</span></td></tr>`;
}

function renderTableEmpty(tbody, colspan, key){
  tbody.innerHTML = `<tr><td colspan="${colspan}"><span class="async-state empty-state">${escapeHtml(localizedText(key))}</span></td></tr>`;
}

function renderTableError(tbody, colspan, retry){
  tbody.innerHTML = `<tr><td colspan="${colspan}"><span class="async-state error-state"><span>${escapeHtml(localizedText('loadError'))}</span><button type="button" class="btn btn-outline btn-sm async-retry">${escapeHtml(localizedText('retry'))}</button></span></td></tr>`;
  tbody.querySelector('.async-retry').addEventListener('click', retry);
}

initLangToggle();

/**
 * Shows a custom modal dialog.
 * @param {string} title The title of the modal.
 * @param {string|HTMLElement} content The body content (HTML string or DOM element).
 * @param {object} options Options for the modal.
 * @param {string} [options.confirmText="OK"] Text for confirm button.
 * @param {string} [options.cancelText="Cancel"] Text for cancel button. If null, cancel button is hidden.
 * @param {boolean} [options.danger=false] If true, confirm button is red.
 * @param {boolean} [options.wide=false] If true, modal is wider.
 * @param {boolean} [options.prompt=false] If true, includes a text input field.
 * @param {string} [options.promptValue=""] Initial value for the prompt.
 * @returns {Promise<boolean|string|null>} Resolves to true/string if confirmed, false/null if cancelled.
 */
function showModal(title, content, options = {}) {
  return new Promise(resolve => {
    const opts = Object.assign({
      confirmText: 'OK',
      cancelText: 'Cancel',
      danger: false,
      wide: false,
      prompt: false,
      promptValue: ''
    }, options);

    const overlay = document.createElement('div');
    overlay.className = 'custom-modal-overlay';
    
    const card = document.createElement('div');
    card.className = 'custom-modal-card' + (opts.wide ? ' wide' : '');

    const titleEl = document.createElement('h3');
    titleEl.className = 'custom-modal-title';
    titleEl.textContent = title;
    
    const bodyEl = document.createElement('div');
    bodyEl.className = 'custom-modal-body';
    if (typeof content === 'string') {
      bodyEl.innerHTML = content;
    } else {
      bodyEl.appendChild(content);
    }
    
    let inputEl = null;
    if (opts.prompt) {
      inputEl = document.createElement('input');
      inputEl.type = 'text';
      inputEl.style.cssText = 'width: 100%; padding: 12px; margin-top: 16px; border: 1px solid var(--line); border-radius: 8px; font-family: inherit; font-size: 16px;';
      inputEl.value = opts.promptValue;
      bodyEl.appendChild(inputEl);
    }
    
    const actions = document.createElement('div');
    actions.className = 'custom-modal-actions';
    
    const cleanup = () => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 300);
    };

    if (opts.cancelText) {
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'custom-modal-btn cancel';
      cancelBtn.textContent = opts.cancelText;
      cancelBtn.onclick = () => { cleanup(); resolve(opts.prompt ? null : false); };
      actions.appendChild(cancelBtn);
    }
    
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'custom-modal-btn ' + (opts.danger ? 'danger' : 'confirm');
    confirmBtn.textContent = opts.confirmText;
    confirmBtn.onclick = () => { 
      cleanup(); 
      resolve(opts.prompt ? (inputEl.value.trim() || null) : true); 
    };
    actions.appendChild(confirmBtn);

    card.appendChild(titleEl);
    card.appendChild(bodyEl);
    card.appendChild(actions);
    overlay.appendChild(card);
    
    document.body.appendChild(overlay);
    
    // Trigger animation
    requestAnimationFrame(() => {
      overlay.classList.add('show');
    });
  });
}

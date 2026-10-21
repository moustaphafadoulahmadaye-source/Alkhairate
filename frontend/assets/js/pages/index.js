renderHeader('index.html'); renderFooter();

  const IMAGES = {
    'pompe-forage': 'assets/img/pompe.jpg',
    'vente-pompes': 'assets/img/vente-pompes.jpg',
    'materiels-electriques': 'assets/img/materiels.jpg',
    'commerce-general': 'assets/img/commerce.jpg',
    'lavage': 'assets/img/lavage.jpg',
    'installation-immeubles': 'assets/img/installation.jpg'
  };

  async function loadHomeServices() {
    const container = document.getElementById('homeServicesGrid');
    renderLoading(container);
    try {
      const [sRes, pRes] = await Promise.all([apiFetch('/services'), apiFetch('/products')]);
      if (!sRes.services.length) { container.innerHTML = ''; return; }
      
      const prodsByService = {};
      if (pRes.products) {
        pRes.products.forEach(p => { 
          if(p.service_slug){
            if(!prodsByService[p.service_slug]) prodsByService[p.service_slug]=[];
            prodsByService[p.service_slug].push(p);
          } 
        });
      }

      container.innerHTML = sRes.services.map((s, idx) => {
        const related = prodsByService[s.slug] || [];
        const numItems = related.reduce((acc, curr) => acc + (curr.item_count || 0), 0);
        
        let href = '';
        if (s.slug === 'lavage') {
          href = 'lavage.html';
        } else {
          href = related.length ? `products.html#${s.slug}` : `order.html?service=${s.slug}`;
        }
        
        // Use DB image if set, else fallback to hardcoded IMAGES array
        const imgUrl = s.image_url || IMAGES[s.slug] || 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80';
        
        const isEven = idx % 2 === 1;
        const numStr = (idx + 1).toString().padStart(2, '0');
        
        return `
          <a class="premium-service-card ${isEven ? 'alt' : ''}" href="${escapeHtml(href)}">
            <div class="psc-bg">
              <img src="${typeof sanitizeImageSrc === 'function' ? sanitizeImageSrc(imgUrl) : escapeHtml(imgUrl)}" alt="${escapeHtml(s.name_fr)}">
            </div>
            <div class="psc-content">
              <div class="psc-num">SERVICE ${numStr}</div>
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
    } catch(e) {
      container.innerHTML = '';
    }
  }

  // Hero Slider & Tabs Controller
  function initHeroSlider() {
    const slides = document.querySelectorAll('.intl-bg-slide');
    const tabs = document.querySelectorAll('.intl-tab');
    if (!slides.length) return;
    let current = 0;
    let timer = null;

    function goTo(idx) {
      slides[current].classList.remove('active');
      if (tabs[current]) tabs[current].classList.remove('active');
      current = (idx + slides.length) % slides.length;
      slides[current].classList.add('active');
      if (tabs[current]) tabs[current].classList.add('active');
    }

    function startTimer() {
      stopTimer();
      timer = setInterval(() => goTo(current + 1), 5000);
    }
    function stopTimer() {
      if (timer) clearInterval(timer);
    }

    tabs.forEach((tab, idx) => {
      tab.addEventListener('click', () => { goTo(idx); startTimer(); });
    });

    const hero = document.getElementById('intlHero');
    if (hero) {
      hero.addEventListener('mouseenter', stopTimer);
      hero.addEventListener('mouseleave', startTimer);
    }
    startTimer();
  }

  async function loadSiteSettings() {
    try {
      const settings = await apiFetch('/settings');
      if (settings.site_logo) {
        document.querySelectorAll('#siteLogoHero, #homeEnterpriseLogo, .brand img').forEach(img => {
          img.src = settings.site_logo;
        });
      }
      if (settings.hero) {
        document.getElementById('heroSlide1').src = settings.hero;
      }
      if (settings.contact) {
        document.getElementById('heroSlide2').src = settings.contact;
      }
      if (settings.about) {
        document.getElementById('heroSlide3').src = settings.about;
      }
    } catch(e) {}
  }

  initHeroSlider();
  loadHomeServices();
  loadSiteSettings();

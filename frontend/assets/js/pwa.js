(function () {
  'use strict';

  // 1. EXIT IMMEDIATELY if running inside Capacitor native app or on admin.html
  if (typeof window === 'undefined') return;

  const isNative = (typeof window.isNativeApp === 'function' && window.isNativeApp()) ||
    (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());

  if (isNative) {
    return;
  }

  const currentPath = window.location.pathname || '';
  if (currentPath.endsWith('/admin.html') || currentPath === '/admin.html') {
    return;
  }

  // 2. Helper: Standalone detection
  function isStandalone() {
    return !!(
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      (document.referrer && document.referrer.includes('android-app://'))
    );
  }

  const DISMISS_KEY_INSTALL = 'eaepcg_pwa_install_dismissed';
  const DISMISS_KEY_IOS = 'eaepcg_pwa_ios_dismissed';
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  function isDismissed(key) {
    try {
      const val = localStorage.getItem(key);
      if (!val) return false;
      return (Date.now() - Number(val)) < SEVEN_DAYS_MS;
    } catch (e) {
      return false;
    }
  }

  function setDismissed(key) {
    try {
      localStorage.setItem(key, String(Date.now()));
    } catch (e) {}
  }

  // Helper to create 3-language span element
  function createLangSpan(frText, enText, arText) {
    const wrap = document.createElement('span');

    const sFr = document.createElement('span');
    sFr.setAttribute('data-fr', '');
    sFr.textContent = frText;

    const sEn = document.createElement('span');
    sEn.setAttribute('data-en', '');
    sEn.textContent = enText;

    const sAr = document.createElement('span');
    sAr.setAttribute('data-ar', '');
    sAr.textContent = arText;

    wrap.appendChild(sFr);
    wrap.appendChild(sEn);
    wrap.appendChild(sAr);
    return wrap;
  }

  // 3. Service Worker Registration & Update Notification
  let newWorkerWaiting = null;

  function showUpdateBar(registration) {
    if (document.getElementById('pwaUpdateBar')) return;

    const bar = document.createElement('div');
    bar.id = 'pwaUpdateBar';
    bar.className = 'pwa-update-bar';

    const textWrap = document.createElement('div');
    textWrap.className = 'pwa-update-text';

    const icon = document.createElement('span');
    icon.textContent = '🔄';
    textWrap.appendChild(icon);

    const msg = createLangSpan(
      'Une nouvelle version est disponible.',
      'A new version is available.',
      'يتوفر إصدار جديد من التطبيق.'
    );
    textWrap.appendChild(msg);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pwa-update-btn';
    btn.appendChild(createLangSpan('Actualiser', 'Update', 'تحديث'));

    btn.addEventListener('click', function () {
      btn.disabled = true;
      if (registration && registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else if (newWorkerWaiting) {
        newWorkerWaiting.postMessage({ type: 'SKIP_WAITING' });
      } else {
        window.location.reload();
      }
    });

    bar.appendChild(textWrap);
    bar.appendChild(btn);
    document.body.appendChild(bar);
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(function (registration) {
          if (registration.waiting) {
            newWorkerWaiting = registration.waiting;
            showUpdateBar(registration);
          }

          registration.addEventListener('updatefound', function () {
            const installingWorker = registration.installing;
            if (!installingWorker) return;

            installingWorker.addEventListener('statechange', function () {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                newWorkerWaiting = installingWorker;
                showUpdateBar(registration);
              }
            });
          });
        })
        .catch(function (err) {
          console.warn('[PWA] Service Worker registration failed:', err);
        });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    });
  }

  // 4. Offline Banner Reuse
  function showOfflineBanner() {
    let banner = document.getElementById('offlineBanner');
    if (banner) return;

    banner = document.createElement('div');
    banner.id = 'offlineBanner';
    banner.className = 'offline-banner';

    const content = document.createElement('div');
    content.className = 'offline-content';

    const icon = document.createElement('span');
    icon.style.fontSize = '22px';
    icon.textContent = '📡';

    const textCol = document.createElement('div');

    const strong = document.createElement('strong');
    strong.appendChild(createLangSpan('Mode hors ligne', 'Offline mode', 'وضع غير متصل'));

    const br = document.createElement('br');

    const sub = document.createElement('span');
    sub.style.fontSize = '12.5px';
    sub.style.opacity = '0.85';
    sub.appendChild(createLangSpan(
      'Connexion Internet interrompue.',
      'No internet connection.',
      'انقطع الاتصال بالإنترنت.'
    ));

    textCol.appendChild(strong);
    textCol.appendChild(br);
    textCol.appendChild(sub);

    content.appendChild(icon);
    content.appendChild(textCol);

    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'offline-retry-btn';
    retryBtn.id = 'btnRetryNetwork';
    retryBtn.appendChild(createLangSpan('Réessayer', 'Try again', 'إعادة المحاولة'));

    retryBtn.addEventListener('click', function () {
      if (navigator.onLine) {
        banner.remove();
      } else {
        window.location.reload();
      }
    });

    banner.appendChild(content);
    banner.appendChild(retryBtn);
    document.body.appendChild(banner);
  }

  function hideOfflineBanner() {
    const banner = document.getElementById('offlineBanner');
    if (banner) banner.remove();
  }

  window.addEventListener('offline', showOfflineBanner);
  window.addEventListener('online', hideOfflineBanner);
  if (!navigator.onLine) {
    showOfflineBanner();
  }

  // 5. Install Cards (Android/Desktop beforeinstallprompt & iOS Safari Tip)
  let deferredPrompt = null;

  function showInstallCard(promptEvent) {
    if (document.getElementById('pwaInstallCard') || isStandalone() || isDismissed(DISMISS_KEY_INSTALL)) return;

    const card = document.createElement('div');
    card.id = 'pwaInstallCard';
    card.className = 'pwa-install-card';

    const inner = document.createElement('div');
    inner.className = 'pwa-install-card-inner';

    const icon = document.createElement('img');
    icon.src = 'assets/icons/icon-192.png';
    icon.alt = 'Alkhaïrat';
    icon.className = 'pwa-app-icon';

    const info = document.createElement('div');
    info.className = 'pwa-install-info';

    const title = document.createElement('div');
    title.className = 'pwa-install-title';
    title.appendChild(createLangSpan(
      "Installer l'application Alkhaïrat",
      "Install Alkhaïrat App",
      "تثبيت تطبيق الخيرات"
    ));

    const sub = document.createElement('p');
    sub.className = 'pwa-install-sub';
    sub.appendChild(createLangSpan(
      'Accès rapide et consultation hors ligne',
      'Fast access and offline browsing',
      'وصول سريع وتصفح دون اتصال'
    ));

    info.appendChild(title);
    info.appendChild(sub);

    const actions = document.createElement('div');
    actions.className = 'pwa-install-actions';

    const btnInstall = document.createElement('button');
    btnInstall.type = 'button';
    btnInstall.className = 'pwa-btn-install';
    btnInstall.appendChild(createLangSpan('Installer', 'Install', 'تثبيت'));

    btnInstall.addEventListener('click', async function () {
      if (!promptEvent) return;
      promptEvent.prompt();
      try {
        const choice = await promptEvent.userChoice;
        if (choice.outcome === 'accepted') {
          deferredPrompt = null;
        }
      } catch (e) {}
      card.remove();
    });

    const btnDismiss = document.createElement('button');
    btnDismiss.type = 'button';
    btnDismiss.className = 'pwa-btn-dismiss';
    btnDismiss.setAttribute('aria-label', 'Fermer');
    btnDismiss.textContent = '✕';

    btnDismiss.addEventListener('click', function () {
      setDismissed(DISMISS_KEY_INSTALL);
      card.remove();
    });

    actions.appendChild(btnInstall);
    actions.appendChild(btnDismiss);

    inner.appendChild(icon);
    inner.appendChild(info);
    inner.appendChild(actions);

    card.appendChild(inner);
    document.body.appendChild(card);
  }

  function hideInstallCard() {
    const card = document.getElementById('pwaInstallCard');
    if (card) card.remove();
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;

    if (isStandalone() || isDismissed(DISMISS_KEY_INSTALL)) return;

    setTimeout(function () {
      if (deferredPrompt && !isStandalone() && !isDismissed(DISMISS_KEY_INSTALL)) {
        showInstallCard(deferredPrompt);
      }
    }, 4000);
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    hideInstallCard();
  });

  // iOS Safari Install Tip
  function showIosTipCard() {
    if (document.getElementById('pwaIosTip') || isStandalone() || isDismissed(DISMISS_KEY_IOS)) return;

    const tip = document.createElement('div');
    tip.id = 'pwaIosTip';
    tip.className = 'pwa-ios-tip';

    const inner = document.createElement('div');
    inner.className = 'pwa-ios-tip-inner';

    const icon = document.createElement('img');
    icon.src = 'assets/icons/icon-192.png';
    icon.alt = 'Alkhaïrat';
    icon.className = 'pwa-app-icon';

    const textDiv = document.createElement('div');
    textDiv.className = 'pwa-ios-tip-text';
    textDiv.appendChild(createLangSpan(
      "Installer l'application : appuyez sur Partager puis « Ajouter à l'écran d'accueil ».",
      "Install app: tap Share then « Add to Home Screen ».",
      "لتثبيت التطبيق: اضغط على مشاركة ثم «إضافة إلى الشاشة الرئيسية»."
    ));

    const btnDismiss = document.createElement('button');
    btnDismiss.type = 'button';
    btnDismiss.className = 'pwa-btn-dismiss';
    btnDismiss.setAttribute('aria-label', 'Fermer');
    btnDismiss.textContent = '✕';

    btnDismiss.addEventListener('click', function () {
      setDismissed(DISMISS_KEY_IOS);
      tip.remove();
    });

    inner.appendChild(icon);
    inner.appendChild(textDiv);
    inner.appendChild(btnDismiss);

    tip.appendChild(inner);
    document.body.appendChild(tip);
  }

  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isSafari = /Safari/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Android/i.test(navigator.userAgent);
  if (isIos && isSafari && !isStandalone() && !isDismissed(DISMISS_KEY_IOS)) {
    setTimeout(function () {
      if (!isStandalone() && !isDismissed(DISMISS_KEY_IOS)) {
        showIosTipCard();
      }
    }, 4000);
  }

  // 6. Mobile Bottom Tab Bar (5 tabs)
  function buildTabBar() {
    if (document.getElementById('pwaTabBar')) return;

    const path = window.location.pathname || '';
    const fileName = path.split('/').pop() || 'index.html';

    let activeTab = 'index';
    if (fileName === '' || fileName === 'index.html') {
      activeTab = 'index';
    } else if (fileName === 'services.html') {
      activeTab = 'services';
    } else if (fileName === 'products.html' || fileName === 'product.html') {
      activeTab = 'products';
    } else if (fileName === 'order.html' || fileName === 'order-lavage.html') {
      activeTab = 'order';
    } else if (['account.html', 'login.html', 'register.html', 'forgot-password.html', 'reset-password.html'].includes(fileName)) {
      activeTab = 'account';
    }

    const nav = document.createElement('nav');
    nav.id = 'pwaTabBar';
    nav.className = 'pwa-tab-bar';
    nav.setAttribute('aria-label', 'Navigation mobile');

    // SVGs
    const homeSvg = '<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>';
    const servicesSvg = '<svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>';
    const productsSvg = '<svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>';
    const cartSvg = '<svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>';
    const userSvg = '<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';

    function createTab(href, iconSvg, labelFr, labelEn, labelAr, isActive, hasBadge) {
      const link = document.createElement('a');
      link.className = 'pwa-tab-item' + (isActive ? ' active' : '');
      link.href = href;

      const iconWrap = document.createElement('div');
      iconWrap.className = 'pwa-tab-icon';
      iconWrap.innerHTML = iconSvg;

      if (hasBadge) {
        const badge = document.createElement('span');
        badge.className = 'pwa-tab-badge';
        badge.id = 'pwaCartBadge';
        badge.style.display = 'none';
        iconWrap.appendChild(badge);
      }

      const label = document.createElement('span');
      label.className = 'pwa-tab-label';
      label.appendChild(createLangSpan(labelFr, labelEn, labelAr));

      link.appendChild(iconWrap);
      link.appendChild(label);
      return link;
    }

    // Determine account target URL (account.html if logged in, otherwise login.html)
    let hasUser = false;
    try {
      if (typeof Auth !== 'undefined' && Auth && typeof Auth.getUser === 'function') {
        hasUser = !!Auth.getUser();
      } else if (typeof localStorage !== 'undefined') {
        hasUser = !!localStorage.getItem('eaepcg_token');
      }
    } catch (e) {
      hasUser = false;
    }
    const accountHref = hasUser ? 'account.html' : 'login.html';

    nav.appendChild(createTab('index.html', homeSvg, 'Accueil', 'Home', 'الرئيسية', activeTab === 'index', false));
    nav.appendChild(createTab('services.html', servicesSvg, 'Services', 'Services', 'الخدمات', activeTab === 'services', false));
    nav.appendChild(createTab('products.html', productsSvg, 'Produits', 'Products', 'المنتجات', activeTab === 'products', false));
    nav.appendChild(createTab('order.html', cartSvg, 'Panier', 'Cart', 'السلة', activeTab === 'order', true));
    nav.appendChild(createTab(accountHref, userSvg, 'Compte', 'Account', 'حسابي', activeTab === 'account', false));

    document.body.appendChild(nav);
    updatePwaCartCount();
  }

  function updatePwaCartCount() {
    const badge = document.getElementById('pwaCartBadge');
    if (!badge) return;

    let count = 0;
    try {
      if (typeof Cart !== 'undefined' && Cart && typeof Cart.count === 'function') {
        count = Cart.count();
      } else if (typeof localStorage !== 'undefined') {
        const items = JSON.parse(localStorage.getItem('eaepcg_cart') || '[]');
        count = items.reduce(function (sum, item) {
          return sum + (item.quantity || 1);
        }, 0);
      }
    } catch (e) {
      count = 0;
    }

    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }

  window.addEventListener('cartUpdated', updatePwaCartCount);
  window.addEventListener('storage', function (e) {
    if (e.key === 'eaepcg_cart') {
      updatePwaCartCount();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildTabBar);
  } else {
    buildTabBar();
  }
})();

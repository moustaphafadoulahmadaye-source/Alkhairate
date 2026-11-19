(function () {
  'use strict';

  // Synchronize language with stored preference
  try {
    const savedLang = localStorage.getItem('eaepcg_lang');
    if (savedLang && ['fr', 'en', 'ar'].includes(savedLang)) {
      document.documentElement.lang = savedLang;
    }
  } catch (e) {}

  // Language selector button handlers if present
  document.querySelectorAll('[data-set-lang]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const lang = btn.getAttribute('data-set-lang');
      if (lang) {
        document.documentElement.lang = lang;
        try {
          localStorage.setItem('eaepcg_lang', lang);
        } catch (e) {}
      }
    });
  });

  // Manual reload on button click
  const retryBtn = document.getElementById('offlineRetryBtn');
  if (retryBtn) {
    retryBtn.addEventListener('click', function () {
      retryBtn.disabled = true;
      retryBtn.classList.add('loading');
      setTimeout(function () {
        window.location.reload();
      }, 200);
    });
  }

  // Automatic reload when connectivity is restored
  window.addEventListener('online', function () {
    const banner = document.getElementById('onlineReconnectedBanner');
    if (banner) {
      banner.style.display = 'block';
    }
    setTimeout(function () {
      window.location.reload();
    }, 600);
  });
})();

renderHeader('login.html');
  renderFooter();

  if (Auth.isLoggedIn()) window.location.href = Auth.isAdmin() ? 'admin.html' : 'account.html';

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginSubmitBtn');
    const msg = document.getElementById('formMsg');
    msg.className = 'form-msg';
    msg.textContent = '';
    
    btn.disabled = true;
    const origText = btn.innerHTML;
    btn.textContent = { fr: 'Connexion en cours...', en: 'Logging in...', ar: 'جاري تسجيل الدخول...' }[currentLang()] || 'En cours...';

    const fd = new FormData(e.target);
    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: fd.get('email'),
          password: fd.get('password')
        })
      });
      Auth.setSession(data.token, data.user);
      window.location.href = data.user.role === 'admin' ? 'admin.html' : 'account.html';
    } catch (err) {
      msg.classList.add('show', 'err');
      msg.textContent = err.data && err.data.error ? err.data.error : 'Identifiants incorrects';
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  });

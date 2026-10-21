renderHeader('register.html');
  renderFooter();

  if (Auth.isLoggedIn()) window.location.href = 'account.html';

  document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('regSubmitBtn');
    const msg = document.getElementById('formMsg');
    msg.className = 'form-msg';
    msg.textContent = '';
    
    btn.disabled = true;
    const origText = btn.innerHTML;
    btn.textContent = { fr: 'Création en cours...', en: 'Creating account...', ar: 'جاري إنشاء الحساب...' }[currentLang()] || 'En cours...';

    const fd = new FormData(e.target);
    try {
      const data = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          full_name: fd.get('full_name'),
          email: fd.get('email'),
          phone: fd.get('phone'),
          password: fd.get('password'),
          password_confirmation: fd.get('password_confirmation')
        })
      });
      Auth.setSession(data.token, data.user);
      window.location.href = 'account.html';
    } catch (err) {
      msg.classList.add('show', 'err');
      msg.textContent = err.data && err.data.error ? err.data.error : 'Erreur lors de la création du compte';
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  });

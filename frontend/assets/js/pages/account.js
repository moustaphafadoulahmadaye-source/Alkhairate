renderHeader('account.html'); renderFooter();
  function updateAvatarDisplay(user) {
    const avatarUrl = user.avatar_url;
    const safeAvatar = typeof sanitizeImageSrc === 'function' ? sanitizeImageSrc(avatarUrl) : (avatarUrl || '');
    const initial = user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U';
    
    // Main header avatar
    const headerAvatar = document.getElementById('dashAvatar');
    if (headerAvatar) {
      if (safeAvatar) {
        headerAvatar.style.background = `url("${safeAvatar}") center/cover no-repeat`;
        headerAvatar.textContent = '';
      } else {
        headerAvatar.style.background = `linear-gradient(135deg, #0f172a 0%, #1e293b 100%)`;
        headerAvatar.textContent = initial;
      }
    }

    // Form preview avatar
    const formPreview = document.getElementById('formAvatarPreview');
    const formInitials = document.getElementById('formAvatarInitials');
    if (formPreview) {
      if (safeAvatar) {
        formPreview.style.backgroundImage = `url("${safeAvatar}")`;
        formPreview.style.backgroundPosition = 'center';
        formPreview.style.backgroundSize = 'cover';
        formPreview.style.backgroundRepeat = 'no-repeat';
        if (formInitials) formInitials.style.display = 'none';
      } else {
        formPreview.style.backgroundImage = `none`;
        if (formInitials) {
          formInitials.style.display = 'block';
          formInitials.textContent = initial;
        }
      }
    }
  }

  window.removeAvatar = async function() {
    if (!confirm({fr:'Voulez-vous vraiment supprimer votre photo ?',en:'Really remove your photo?',ar:'هل تريد حقًا حذف صورتك؟'}[currentLang()])) return;
    try {
      const res = await apiFetch('/auth/me', { method: 'PATCH', body: JSON.stringify({ avatar_url: '' }) });
      Auth.setSession(Auth.getToken(), res.user);
      updateAvatarDisplay(res.user);
      document.getElementById('avatarUrlInput').value = '';
      
      const formPreview = document.getElementById('formAvatarPreview');
      if (formPreview) {
        formPreview.style.backgroundImage = 'none';
        const fi = document.getElementById('formAvatarInitials');
        if (fi) {
          fi.style.display = 'block';
          fi.textContent = res.user.full_name ? res.user.full_name.charAt(0).toUpperCase() : 'U';
        }
      }
    } catch(err) {
      console.error(err);
    }
  };

  if (!Auth.isLoggedIn()) { document.getElementById('lockedSection').hidden = false; }
  else {
    const user = Auth.getUser();
    if (document.getElementById('welcomeName')) document.getElementById('welcomeName').textContent = user.full_name || 'Bienvenue';
    if (document.getElementById('welcomeEmail')) {
      const el = document.getElementById('welcomeEmail');
      el.textContent = user.email || '';
      el.title = user.email || '';
    }
    
    updateAvatarDisplay(user);

    document.querySelector('#profileForm [name="full_name"]').value = user.full_name || '';
    document.querySelector('#profileForm [name="email"]').value = user.email || '';
    document.querySelector('#profileForm [name="phone"]').value = user.phone || '';
    document.getElementById('avatarUrlInput').value = user.avatar_url || '';

    document.getElementById('appSection').hidden = false;
    loadOrders(); loadMessages();
    document.querySelectorAll('.account-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.account-nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-orders').hidden = btn.dataset.tab !== 'orders';
        document.getElementById('tab-messages').hidden = btn.dataset.tab !== 'messages';
        document.getElementById('tab-profile').hidden = btn.dataset.tab !== 'profile';
      });
    });
  }

  // Helper for native avatar capture via @capacitor/camera
  async function selectAndUploadAvatarNative() {
    const Camera = window.Capacitor?.Plugins?.Camera;
    if (!Camera) return null;
    try {
      const photo = await Camera.getPhoto({
        quality: 85,
        allowEditing: true,
        resultType: 'base64',
        source: 'PROMPT'
      });
      if (!photo || !photo.base64String) return null;
      const mime = photo.format === 'png' ? 'image/png' : (photo.format === 'webp' ? 'image/webp' : 'image/jpeg');
      const base64 = `data:${mime};base64,${photo.base64String}`;
      const filename = `avatar_${Date.now()}.${photo.format || 'jpeg'}`;
      
      const res = await apiFetch('/upload/avatar', {
        method: 'POST',
        body: JSON.stringify({ imageBase64: base64, filename })
      });
      return { url: res.url, base64 };
    } catch(err) {
      if (err && err.message && !err.message.includes('User cancelled')) {
        console.warn('Native camera error:', err);
      }
      return null;
    }
  }

  // Handle form avatar selection (preview & staging)
  const avatarFile = document.getElementById('avatarFileInput');
  const avatarUploadLabel = document.querySelector('label[for="avatarFileInput"]');
  
  if (avatarUploadLabel) {
    avatarUploadLabel.addEventListener('click', async (e) => {
      if (typeof isNativeApp === 'function' && isNativeApp() && window.Capacitor?.Plugins?.Camera) {
        e.preventDefault();
        const uploaded = await selectAndUploadAvatarNative();
        if (uploaded && uploaded.url) {
          document.getElementById('avatarUrlInput').value = uploaded.url;
          const formPreview = document.getElementById('formAvatarPreview');
          const safeBase64 = typeof sanitizeImageSrc === 'function' ? sanitizeImageSrc(uploaded.base64) : uploaded.base64;
          if (formPreview && safeBase64) {
            formPreview.style.backgroundImage = `url("${safeBase64}")`;
            const fi = document.getElementById('formAvatarInitials');
            if (fi) fi.style.display = 'none';
          }
          const headerAvatar = document.getElementById('dashAvatar');
          if (headerAvatar) {
            headerAvatar.style.background = `url("${safeBase64}") center/cover no-repeat`;
            headerAvatar.textContent = '';
          }
        }
      }
    });
  }

  if (avatarFile) {
    avatarFile.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        alert('Image trop volumineuse (max 2MB)');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target.result;
        // Preview locally first
        const formPreview = document.getElementById('formAvatarPreview');
        const safeBase64 = typeof sanitizeImageSrc === 'function' ? sanitizeImageSrc(base64) : base64;
        if (formPreview && safeBase64) {
          formPreview.style.backgroundImage = `url("${safeBase64}")`;
          const fi = document.getElementById('formAvatarInitials');
          if (fi) fi.style.display = 'none';
        }

        try {
          // Upload to server
          const res = await apiFetch('/upload/avatar', {
            method: 'POST',
            body: JSON.stringify({ imageBase64: base64, filename: file.name })
          });
          if (res && res.url) {
            document.getElementById('avatarUrlInput').value = res.url;
            
            // Also optionally update header
            const headerAvatar = document.getElementById('dashAvatar');
            if (headerAvatar) {
              const safeResUrl = typeof sanitizeImageSrc === 'function' ? sanitizeImageSrc(res.url) : res.url;
              if (safeResUrl) {
                headerAvatar.style.background = `url("${safeResUrl}") center/cover no-repeat`;
                headerAvatar.textContent = '';
              }
            }
          }
        } catch (error) {
          console.error("Avatar upload failed", error);
          alert("Erreur lors de l'envoi de l'image.");
        }
      };
      reader.readAsDataURL(file);
    });
  }

  // Handle sidebar avatar click and auto-upload
  const sidebarAvatar = document.getElementById('dashAvatar');
  const sidebarInput = document.getElementById('sidebarAvatarInput');
  if (sidebarAvatar) {
    sidebarAvatar.addEventListener('click', async () => {
      if (typeof isNativeApp === 'function' && isNativeApp() && window.Capacitor?.Plugins?.Camera) {
        const uploaded = await selectAndUploadAvatarNative();
        if (uploaded && uploaded.url) {
          try {
            const updateRes = await apiFetch('/auth/me', {
              method: 'PATCH', body: JSON.stringify({ avatar_url: uploaded.url })
            });
            Auth.setSession(Auth.getToken(), updateRes.user);
            updateAvatarDisplay(updateRes.user);
            document.getElementById('avatarUrlInput').value = uploaded.url;
          } catch(err) {
            console.error(err);
          }
        }
      } else if (sidebarInput) {
        sidebarInput.click();
      }
    });
  }
  if (sidebarInput) {
    sidebarInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) return alert('Image trop volumineuse (max 2MB)');
      
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target.result;
        try {
          // 1. Upload to server
          const res = await apiFetch('/upload/avatar', {
            method: 'POST', body: JSON.stringify({ imageBase64: base64, filename: file.name })
          });
          if (res && res.url) {
            // 2. Auto-save to profile
            const updateRes = await apiFetch('/auth/me', {
              method: 'PATCH', body: JSON.stringify({ avatar_url: res.url })
            });
            // 3. Update UI & Session
            Auth.setSession(Auth.getToken(), updateRes.user);
            updateAvatarDisplay(updateRes.user);
            document.getElementById('avatarUrlInput').value = res.url;
          }
        } catch(err) {
          console.error(err);
          alert("Erreur d'upload.");
        }
      };
      reader.readAsDataURL(file);
    });
  }

  async function loadOrders(){
    const table = document.getElementById('ordersBody');
    renderTableLoading(table, 4);
    try {
      const d = await apiFetch('/orders/mine');
      if (!d.orders.length) { renderTableEmpty(table, 4, 'emptyOrders'); return; }
      table.innerHTML = d.orders.map(o=>`<tr><td>${escapeHtml(o.service)}</td><td>${escapeHtml(o.details||'')}</td><td><span class="status-badge ${escapeHtml(o.status)}">${escapeHtml(o.status.replace('_',' '))}</span></td><td>${escapeHtml(o.created_at)}</td></tr>`).join('');
    } catch(e) { renderTableError(table, 4, loadOrders); }
  }
  async function loadMessages(){
    const table = document.getElementById('messagesBody');
    renderTableLoading(table, 4);
    try {
      const d = await apiFetch('/messages/mine');
      if (!d.messages.length) { renderTableEmpty(table, 4, 'emptyMessages'); return; }
      table.innerHTML = d.messages.map(m=>`<tr><td>${escapeHtml(m.subject||'—')}</td><td>${escapeHtml(m.body)}</td><td><span class="status-badge ${escapeHtml(m.status)}">${escapeHtml(m.status)}</span></td><td>${escapeHtml(m.created_at)}</td></tr>`).join('');
    } catch(e) { renderTableError(table, 4, loadMessages); }
  }
  document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('profileMsg');
    msg.className = 'form-msg';
    const fd = new FormData(e.target);
    try {
      const data = await apiFetch('/auth/me', { method: 'PATCH', body: JSON.stringify({
        full_name: fd.get('full_name'), 
        email: fd.get('email'), 
        phone: fd.get('phone'),
        avatar_url: fd.get('avatar_url')
      }) });
      const token = Auth.getToken();
      Auth.setSession(token, data.user);
      if (document.getElementById('welcomeName')) document.getElementById('welcomeName').textContent = data.user.full_name || 'Bienvenue';
      if (document.getElementById('welcomeEmail')) {
        const el = document.getElementById('welcomeEmail');
        el.textContent = data.user.email || '';
        el.title = data.user.email || '';
      }
      updateAvatarDisplay(data.user);
      msg.classList.add('show', 'ok');
      msg.textContent = {fr:'Profil enregistré.',en:'Profile saved.',ar:'تم حفظ الملف الشخصي.'}[currentLang()];
    } catch (err) {
      msg.classList.add('show', 'err');
      msg.textContent = err.data?.error || localizedText('loadError');
    }
  });

  // Delete account modal logic
  const openDeleteModalBtn = document.getElementById('btnOpenDeleteAccountModal');
  const deleteModal = document.getElementById('deleteAccountModal');
  const cancelDeleteBtn = document.getElementById('btnCancelDeleteModal');
  const confirmDeleteBtn = document.getElementById('btnConfirmDeleteAccount');
  const deletePwdInput = document.getElementById('deleteCurrentPassword');
  const confirmCheckbox = document.getElementById('confirmDeleteCheckbox');
  const deleteModalError = document.getElementById('deleteModalError');

  function updateDeleteButtonState() {
    if (confirmDeleteBtn) {
      const canSubmit = confirmCheckbox && confirmCheckbox.checked && deletePwdInput && deletePwdInput.value.trim().length > 0;
      confirmDeleteBtn.disabled = !canSubmit;
      confirmDeleteBtn.style.opacity = canSubmit ? '1' : '0.5';
      confirmDeleteBtn.style.cursor = canSubmit ? 'pointer' : 'not-allowed';
    }
  }

  if (openDeleteModalBtn && deleteModal) {
    openDeleteModalBtn.addEventListener('click', () => {
      deleteModal.style.display = 'flex';
      deleteModal.setAttribute('aria-hidden', 'false');
      setTimeout(() => deleteModal.classList.add('show'), 10);
      if (deletePwdInput) deletePwdInput.value = '';
      if (confirmCheckbox) confirmCheckbox.checked = false;
      if (deleteModalError) {
        deleteModalError.style.display = 'none';
        deleteModalError.textContent = '';
      }
      updateDeleteButtonState();
      if (deletePwdInput) deletePwdInput.focus();
    });
  }

  function closeDeleteModal() {
    if (deleteModal) {
      deleteModal.classList.remove('show');
      deleteModal.setAttribute('aria-hidden', 'true');
      setTimeout(() => {
        deleteModal.style.display = 'none';
        if (deletePwdInput) deletePwdInput.value = '';
        if (confirmCheckbox) confirmCheckbox.checked = false;
        if (deleteModalError) deleteModalError.style.display = 'none';
        updateDeleteButtonState();
      }, 300);
    }
  }

  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', closeDeleteModal);
  }

  if (deletePwdInput) {
    deletePwdInput.addEventListener('input', updateDeleteButtonState);
  }
  if (confirmCheckbox) {
    confirmCheckbox.addEventListener('change', updateDeleteButtonState);
  }

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
      const password = (deletePwdInput ? deletePwdInput.value : '').trim();
      if (!password) {
        if (deleteModalError) {
          deleteModalError.className = 'form-msg err';
          deleteModalError.style.display = 'block';
          deleteModalError.textContent = 'Veuillez saisir votre mot de passe actuel.';
        }
        return;
      }
      if (!confirmCheckbox || !confirmCheckbox.checked) {
        if (deleteModalError) {
          deleteModalError.className = 'form-msg err';
          deleteModalError.style.display = 'block';
          deleteModalError.textContent = 'Veuillez cocher la case de confirmation.';
        }
        return;
      }

      confirmDeleteBtn.disabled = true;
      confirmDeleteBtn.textContent = 'Suppression en cours...';

      try {
        const res = await apiFetch('/auth/me', {
          method: 'DELETE',
          body: JSON.stringify({ current_password: password })
        });
        if (deleteModalError) {
          deleteModalError.className = 'form-msg ok';
          deleteModalError.style.display = 'block';
          deleteModalError.textContent = res.message || 'Votre compte a été supprimé. Redirection...';
        }
        setTimeout(() => {
          Auth.clear();
          window.location.href = 'index.html';
        }, 1200);
      } catch (err) {
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.textContent = 'Supprimer définitivement';
        if (deleteModalError) {
          deleteModalError.className = 'form-msg err';
          deleteModalError.style.display = 'block';
          deleteModalError.textContent = err.data?.error || err.message || 'Erreur lors de la suppression.';
        }
        updateDeleteButtonState();
      }
    });
  }

const avatarUpload = document.querySelector(".premium-avatar-upload");
if (avatarUpload) {
  const overlay = avatarUpload.querySelector(".premium-avatar-overlay");
  if (overlay) {
    avatarUpload.addEventListener("mouseenter", () => { overlay.style.opacity = "1"; });
    avatarUpload.addEventListener("mouseleave", () => { overlay.style.opacity = "0"; });
  }
}


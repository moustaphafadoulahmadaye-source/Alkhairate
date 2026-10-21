let lastPendingOrdersCount = null;
  let lastNewMessagesCount = null;
  let audioCtx = null;
  let soundEnabled = true;

  // Web Audio Chime generator (Dual-tone melodic chime)
  function getAudioContext() {
    try {
      if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) audioCtx = new AudioContextClass();
      }
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
    } catch(e) {}
    return audioCtx;
  }

  // Pre-unlock AudioContext on first user interaction
  ['click', 'touchstart', 'keydown'].forEach(evt => {
    window.addEventListener(evt, () => { getAudioContext(); }, { once: true, passive: true });
  });

  function playNotificationChime(type = 'message') {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const playTone = (freq, start, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(0.24, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };

      if (type === 'message') {
        // Melodic dual-tone chime: D5 (587.33Hz) -> A5 (880.00Hz)
        playTone(587.33, now, 0.28);
        playTone(880.00, now + 0.12, 0.45);
      } else {
        // Order chime: C5 (523.25Hz) -> E5 (659.25Hz) -> G5 (783.99Hz)
        playTone(523.25, now, 0.2);
        playTone(659.25, now + 0.1, 0.2);
        playTone(783.99, now + 0.2, 0.45);
      }
    } catch(e) {
      console.warn('Audio chime failed:', e);
    }
  }

  // Native Browser Web Push Notification
  function triggerNativePushNotification(title, body, tag = 'eaepcg-notif') {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          body: body,
          icon: 'assets/img/logo.jpg',
          badge: 'assets/img/logo.jpg',
          tag: tag,
          renotify: true
        });
        notif.onclick = () => {
          window.focus();
          switchToView(tag.includes('order') ? 'view-orders' : 'view-messages');
          notif.close();
        };
      } catch(e) {
        console.warn('Native notification failed:', e);
      }
    }
  }

  // Floating In-App Toast Notification
  function showToastNotification({ type = 'msg', title, meta, body, targetView = 'view-messages' }) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `notif-toast ${type === 'msg' ? 'toast-msg' : 'toast-order'}`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
      <div class="notif-toast-icon">${type === 'msg' ? '📩' : '📦'}</div>
      <div class="notif-toast-body">
        <div class="notif-toast-title">${escapeHtml(title || 'Notification')}</div>
        ${meta ? `<div class="notif-toast-meta">${escapeHtml(meta)}</div>` : ''}
        ${body ? `<div class="notif-toast-text">${escapeHtml(body)}</div>` : ''}
      </div>
      <button class="notif-toast-close" type="button" aria-label="Fermer">&times;</button>
    `;

    toast.addEventListener('click', (e) => {
      if (e.target.closest('.notif-toast-close')) return;
      switchToView(targetView);
      toast.remove();
    });

    const closeBtn = toast.querySelector('.notif-toast-close');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 250);
    });

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 250);
      }
    }, 8000);
  }

  // Generic View Switcher
  function switchToView(viewId) {
    closeMobileSidebar();
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view-section');
    navItems.forEach(b => {
      b.classList.toggle('active', b.dataset.target === viewId);
    });
    views.forEach(v => {
      v.classList.toggle('active', v.id === viewId);
    });
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch(e) {}
    if (viewId === 'view-settings') loadSiteSettingsManager();
    if (viewId === 'view-messages') loadMessages();
    if (viewId === 'view-orders') loadOrders();
    if (viewId === 'view-products') loadProducts();
    if (viewId === 'view-clients') loadUsers();
    if (viewId === 'view-dashboard') loadSummary();
  }
  window.switchToView = switchToView;

  // Mobile Drawer Elements & Helpers (defined globally so usable anywhere)
  const adminSidebar = document.getElementById('adminSidebar');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');
  const mobileSidebarToggle = document.getElementById('mobileSidebarToggle');
  const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');

  function openMobileSidebar() {
    if (adminSidebar) adminSidebar.classList.add('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileSidebar() {
    if (adminSidebar) adminSidebar.classList.remove('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (mobileSidebarToggle) mobileSidebarToggle.addEventListener('click', openMobileSidebar);
  if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeMobileSidebar);
  if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeMobileSidebar);

  // Notification Topbar Dropdown Wiring
  const notifBellBtn = document.getElementById('notifBellBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  const testSoundBtn = document.getElementById('testSoundBtn');
  const viewAllMsgsBtn = document.getElementById('viewAllMsgsBtn');
  const viewAllOrdersBtn = document.getElementById('viewAllOrdersBtn');
  const enablePushBtn = document.getElementById('enablePushBtn');

  function checkPushPermissionBanner() {
    const banner = document.getElementById('notifPermissionBanner');
    if (!banner || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      banner.style.display = 'flex';
    } else {
      banner.style.display = 'none';
    }
  }

  if (notifBellBtn && notifDropdown) {
    notifBellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = notifDropdown.style.display === 'block';
      notifDropdown.style.display = isVisible ? 'none' : 'block';
      checkPushPermissionBanner();
      getAudioContext();
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.notif-wrapper')) {
        notifDropdown.style.display = 'none';
      }
    });
  }

  if (testSoundBtn) {
    testSoundBtn.addEventListener('click', () => {
      getAudioContext();
      playNotificationChime('message');
    });
  }

  if (enablePushBtn) {
    enablePushBtn.addEventListener('click', async () => {
      if ('Notification' in window) {
        const res = await Notification.requestPermission();
        checkPushPermissionBanner();
        if (res === 'granted') {
          playNotificationChime('message');
          triggerNativePushNotification('🔔 Notifications activées', 'Vous recevrez désormais les alertes de messages et commandes !');
        }
      }
    });
  }

  if (viewAllMsgsBtn) {
    viewAllMsgsBtn.addEventListener('click', () => {
      if (notifDropdown) notifDropdown.style.display = 'none';
      switchToView('view-messages');
    });
  }

  if (viewAllOrdersBtn) {
    viewAllOrdersBtn.addEventListener('click', () => {
      if (notifDropdown) notifDropdown.style.display = 'none';
      switchToView('view-orders');
    });
  }

  function updateNotificationUI(d) {
    const unreadMsgs = Number(d.newMessages) || 0;
    const pendingOrders = Number(d.pendingOrders) || 0;
    const totalAlerts = unreadMsgs + pendingOrders;

    // Topbar Badge
    const bellBadge = document.getElementById('notifBadge');
    if (bellBadge) {
      if (totalAlerts > 0) {
        bellBadge.textContent = totalAlerts > 99 ? '99+' : totalAlerts;
        bellBadge.style.display = 'inline-flex';
      } else {
        bellBadge.style.display = 'none';
      }
    }

    // Dropdown Counter
    const dropdownCounter = document.getElementById('notifDropdownCounter');
    if (dropdownCounter) {
      if (totalAlerts > 0) {
        dropdownCounter.textContent = `${totalAlerts} en attente`;
        dropdownCounter.style.display = 'inline-block';
      } else {
        dropdownCounter.style.display = 'none';
      }
    }

    // Sidebar Badges
    const sidebarMsgBadge = document.getElementById('sidebarMsgBadge');
    if (sidebarMsgBadge) {
      if (unreadMsgs > 0) {
        sidebarMsgBadge.textContent = unreadMsgs;
        sidebarMsgBadge.style.display = 'inline-block';
      } else {
        sidebarMsgBadge.style.display = 'none';
      }
    }

    const sidebarOrdersBadge = document.getElementById('sidebarOrdersBadge');
    if (sidebarOrdersBadge) {
      if (pendingOrders > 0) {
        sidebarOrdersBadge.textContent = pendingOrders;
        sidebarOrdersBadge.style.display = 'inline-block';
      } else {
        sidebarOrdersBadge.style.display = 'none';
      }
    }

    // Dropdown List Items
    const notifDropdownList = document.getElementById('notifDropdownList');
    if (notifDropdownList) {
      if (totalAlerts === 0) {
        notifDropdownList.innerHTML = `
          <div style="padding:24px 16px; text-align:center; color:var(--text-muted); font-size:13px;">
            <div style="font-size:24px; margin-bottom:6px;">✅</div>
            Tout est à jour ! Aucune notification en attente.
          </div>
        `;
      } else {
        let itemsHtml = '';
        if (unreadMsgs > 0) {
          itemsHtml += `
            <div class="notif-item unread" data-view="view-messages">
              <div class="notif-item-icon msg">📩</div>
              <div style="flex:1;">
                <div class="notif-item-title">${unreadMsgs} message${unreadMsgs > 1 ? 's' : ''} non lu${unreadMsgs > 1 ? 's' : ''}</div>
                <div class="notif-item-desc">Nouveaux messages clients reçus sur le site. Cliquez pour ouvrir la boîte.</div>
              </div>
            </div>
          `;
        }
        if (pendingOrders > 0) {
          itemsHtml += `
            <div class="notif-item unread" data-view="view-orders">
              <div class="notif-item-icon">📦</div>
              <div style="flex:1;">
                <div class="notif-item-title">${pendingOrders} commande${pendingOrders > 1 ? 's' : ''} en attente</div>
                <div class="notif-item-desc">Des commandes attendent votre validation. Cliquez pour traiter.</div>
              </div>
            </div>
          `;
        }
        notifDropdownList.innerHTML = itemsHtml;
      }
    }
  }

  if (!Auth.isLoggedIn() || !Auth.isAdmin()) {
    const isLocalFile = window.location.protocol === 'file:';
    if (!isLocalFile) {
      if (!Auth.isLoggedIn()) {
        window.location.replace('login.html');
      } else {
        window.location.replace('account.html');
      }
    } else {
      document.getElementById('lockedSection').hidden = false;
    }
  } else {
    document.getElementById('appSection').hidden = false;
    
    // Sidebar Navigation Logic
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(btn => {
      btn.addEventListener('click', () => {
        switchToView(btn.dataset.target);
      });
    });

    // Check URL parameters for explicit tabs
    const params = new URLSearchParams(window.location.search);
    if (params.get('filter') === 'pending') {
      switchToView('view-orders');
    }

    // Load initial data
    loadSummary();
    loadOrders();
    loadProducts();
    loadUsers();
    loadMessages();
    loadSiteSettingsManager();
    initSettingsManagerEvents();

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      try { await apiFetch('/auth/logout', { method: 'POST' }); }
      finally { Auth.clear(); window.location.href = 'login.html'; }
    });

    // Search Logic (Simple text match for tables)
    ['orders', 'products', 'clients', 'messages'].forEach(type => {
      const input = document.getElementById('search-' + type);
      if (input) {
        input.addEventListener('input', (e) => {
          const term = e.target.value.toLowerCase();
          const tbody = document.getElementById(type === 'clients' ? 'usersBody' : type + 'Body');
          Array.from(tbody.querySelectorAll('tr:not(.item-edit-row)')).forEach(row => {
            row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
          });
        });
      }
    });
  }

  async function loadSummary(isPolling = false) {
    const container = document.getElementById('statGrid');
    try {
      const d = await apiFetch('/admin/summary');

      // Check for incoming new messages
      if (lastNewMessagesCount !== null && d.newMessages > lastNewMessagesCount) {
        const diff = d.newMessages - lastNewMessagesCount;
        playNotificationChime('message');
        triggerNativePushNotification(
          '📩 Nouveau message client',
          diff === 1 ? 'Vous avez reçu un nouveau message sur le site.' : `Vous avez reçu ${diff} nouveaux messages.`
        );

        // Fetch latest message to display rich notification details
        try {
          const mData = await apiFetch('/admin/messages');
          if (mData && mData.messages && mData.messages.length) {
            const m = mData.messages[0];
            showToastNotification({
              type: 'msg',
              title: `📩 Nouveau message : ${m.full_name || 'Client'}`,
              meta: m.subject || m.email || m.phone || 'Visiteur web',
              body: m.body || '',
              targetView: 'view-messages'
            });
          } else {
            showToastNotification({
              type: 'msg',
              title: '📩 Nouveau message reçu !',
              body: 'Un client vient de vous envoyer un message.',
              targetView: 'view-messages'
            });
          }
        } catch(err) {
          showToastNotification({
            type: 'msg',
            title: '📩 Nouveau message reçu !',
            body: 'Un client vient de vous envoyer un message.',
            targetView: 'view-messages'
          });
        }

        // Auto-refresh messages table if currently viewed
        const msgView = document.getElementById('view-messages');
        if (msgView && msgView.classList.contains('active')) {
          loadMessages();
        }
      }

      // Check for incoming new orders
      if (lastPendingOrdersCount !== null && d.pendingOrders > lastPendingOrdersCount) {
        playNotificationChime('order');
        triggerNativePushNotification('📦 Nouvelle commande reçue !', 'Une nouvelle commande est en attente de traitement.');
        showToastNotification({
          type: 'order',
          title: '📦 Nouvelle commande reçue !',
          body: 'Une nouvelle commande vient d\'être passée sur votre boutique.',
          targetView: 'view-orders'
        });

        // Auto-refresh orders table if currently viewed
        const orderView = document.getElementById('view-orders');
        if (orderView && orderView.classList.contains('active')) {
          loadOrders();
        }
      }

      lastPendingOrdersCount = Number(d.pendingOrders) || 0;
      lastNewMessagesCount = Number(d.newMessages) || 0;

      // Update Topbar bell, dropdown, and sidebar badges
      updateNotificationUI(d);

      if (container) {
        container.innerHTML = `
          <!-- Chiffre d'Affaires -->
          <div class="stat-card">
            <div class="stat-header">
              <div class="stat-icon c-green">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
              </div>
              <div class="stat-title">Chiffre d'Affaires</div>
            </div>
            <div class="stat-val">0 <small>FCFA</small></div>
            <div class="stat-footer">
              <span class="stat-badge b-green">0 FCFA</span> par commande
            </div>
          </div>

          <!-- Commandes -->
          <div class="stat-card" style="cursor:pointer;" data-view="view-orders">
            <div class="stat-header">
              <div class="stat-icon c-blue">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
              </div>
              <div class="stat-title">Commandes</div>
            </div>
            <div class="stat-val">${d.ordersCount}</div>
            <div class="stat-footer">
              <span class="stat-badge b-blue">${d.pendingOrders} en attente</span>
            </div>
          </div>

          <!-- Clients -->
          <div class="stat-card" style="cursor:pointer;" data-view="view-clients">
            <div class="stat-header">
              <div class="stat-icon c-purple">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              </div>
              <div class="stat-title">Clients</div>
            </div>
            <div class="stat-val">${d.usersCount}</div>
            <div class="stat-footer">
              <span class="stat-badge b-purple">Membres inscrits</span>
            </div>
          </div>

          <!-- Produits -->
          <div class="stat-card" style="cursor:pointer;" data-view="view-products">
            <div class="stat-header">
              <div class="stat-icon c-orange">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
              </div>
              <div class="stat-title">Produits</div>
            </div>
            <div class="stat-val">${d.productsCount}</div>
            <div class="stat-footer">
              En catalogue
            </div>
          </div>

          <!-- Messages -->
          <div class="stat-card" style="cursor:pointer;" data-view="view-messages">
            <div class="stat-header">
              <div class="stat-icon" style="background:#FEE2E2; color:#DC2626;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              </div>
              <div class="stat-title">Messages</div>
            </div>
            <div class="stat-val">${d.messagesCount || 0}</div>
            <div class="stat-footer">
              <span class="stat-badge ${d.newMessages > 0 ? 'b-red' : 'b-blue'}">${d.newMessages || 0} non lu${(d.newMessages || 0) > 1 ? 's' : ''}</span>
            </div>
          </div>
        `;
      }
    } catch(e) { if(e.status===401||e.status===403) { Auth.clear(); window.location.href='login.html'; } }
  }

  // Real-time polling every 10 seconds
  setInterval(() => { if (Auth.isLoggedIn() && Auth.isAdmin()) loadSummary(true); }, 10000);

  function getStatusClass(s) {
    if(s==='pending'||s==='new') return 's-pending';
    if(s==='confirmed'||s==='replied') return 's-confirmed';
    if(s==='shipped'||s==='read') return 's-shipped';
    if(s==='cancelled') return 's-cancelled';
    return '';
  }

  let currentOrderFilter = 'all';

  // Tab click listener
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('order-tab')) {
      document.querySelectorAll('.order-tab').forEach(b => {
        b.style.background = 'white';
        b.style.color = 'var(--text-muted)';
        b.classList.remove('active');
      });
      e.target.style.background = 'var(--brand-primary)';
      e.target.style.color = 'white';
      e.target.classList.add('active');
      currentOrderFilter = e.target.getAttribute('data-filter');
      loadOrders();
    }
  });

  async function loadOrders(){
    const table = document.getElementById('ordersBody');
    try {
      const d = await apiFetch('/admin/orders');
      
      let filteredOrders = d.orders;
      if (currentOrderFilter === 'commerce') {
        filteredOrders = d.orders.filter(o => o.service === 'commerce-general' || o.service === 'materiels-electriques');
      } else if (currentOrderFilter === 'lavage') {
        filteredOrders = d.orders.filter(o => o.service === 'lavage');
      } else if (currentOrderFilter === 'installation') {
        filteredOrders = d.orders.filter(o => o.service === 'installation-immeubles');
      } else if (currentOrderFilter === 'pompe') {
        filteredOrders = d.orders.filter(o => o.service === 'pompe-forage');
      }

      if (!filteredOrders.length) { table.innerHTML = '<tr><td colspan="6">Aucune commande pour cette catégorie.</td></tr>'; return; }
      table.innerHTML = filteredOrders.map(o => {
        const opts = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
        const optionsHtml = opts.map(s=>`<option value="${s}" ${s===o.status?'selected':''}>${s}</option>`).join('');
        return `
        <tr>
          <td><strong>${escapeHtml(o.full_name)}</strong> ${o.is_guest?'<span style="font-size:10px; background:#E2E8F0; padding:2px 6px; border-radius:4px; margin-left:4px;">GUEST</span>':''}</td>
          <td>${escapeHtml(o.email||'')}<br><small style="color:var(--text-muted);">${escapeHtml(o.phone||'')}</small></td>
          <td><span style="background:#F1F5F9; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:700;">${escapeHtml(o.service)}</span></td>
          <td>${escapeHtml(o.details||'')}</td>
          <td><select data-id="${escapeHtml(o.id)}" class="status-select ${escapeHtml(getStatusClass(o.status))}">${optionsHtml}</select></td>
          <td style="color:var(--text-muted); font-size:13px;">${escapeHtml(o.created_at)}</td>
        </tr>`
      }).join('');
      
      table.querySelectorAll('.status-select').forEach(sel => {
        sel.addEventListener('change', async()=>{
          sel.className = 'status-select ' + getStatusClass(sel.value);
          await apiFetch('/admin/orders/'+sel.dataset.id,{method:'PATCH',body:JSON.stringify({status:sel.value})});
          loadSummary();
        });
      });
    } catch(e) {}
  }

  async function loadProducts(){
    const table = document.getElementById('productsBody');
    try {
      const d = await apiFetch('/products');
      if (!d.products.length) { table.innerHTML = '<tr><td colspan="5">Aucun produit.</td></tr>'; return; }
      
      let html = '';
      for (const p of d.products) {
        const detail = await apiFetch('/products/' + encodeURIComponent(p.slug));
        html += detail.items.map(it => `
          <tr>
            <td>
              <div style="display:flex; align-items:center; gap:12px;">
                <img src="${typeof sanitizeImageSrc === 'function' ? sanitizeImageSrc(it.image_url, 'assets/img/placeholder.png') : (it.image_url ? escapeHtml(it.image_url) : 'assets/img/placeholder.png')}" alt="Produit" style="width:48px; height:48px; object-fit:cover; border-radius:8px; border:1px solid var(--border-light); background:#F8FAFC;">
                <div>
                  <strong>${escapeHtml(it.name_fr)}</strong><br>
                  <small style="color:var(--text-muted);">${escapeHtml(it.name_en)}</small>
                </div>
              </div>
            </td>
            <td><span style="background:#F1F5F9; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:700;">${escapeHtml(p.name_fr)}</span></td>
            <td><strong>${new Intl.NumberFormat('fr-FR').format(it.price)} ${escapeHtml(it.currency || 'XAF')}</strong></td>
            <td>${it.in_stock ? '<span style="color:#10B981; font-weight:700;">En stock</span>' : '<span style="color:#EF4444; font-weight:700;">Rupture</span>'}</td>
            <td style="text-align:right;">
              <button class="btn-danger deleteItem" data-item-id="${escapeHtml(it.id)}">Supprimer</button>
            </td>
          </tr>
        `).join('');
      }
      table.innerHTML = html;
      
      table.querySelectorAll('.deleteItem').forEach(btn => {
        btn.addEventListener('click', () => {
          showModal('Supprimer ce produit ?', 'Cette action est irréversible. Êtes-vous sûr de vouloir supprimer cet article du catalogue ?', {
            confirmText: 'Supprimer',
            cancelText: 'Annuler',
            danger: true
          }).then(async (confirmed) => {
            if(!confirmed) return;
            await apiFetch('/products/items/' + btn.dataset.itemId, { method: 'DELETE' });
            loadProducts();
          });
        });
      });
    } catch(e) {}
  }

  document.getElementById('openAddProductModal').addEventListener('click', () => {
    const template = document.getElementById('addProductFormTemplate');
    const formNode = template.content.cloneNode(true);
    const form = formNode.querySelector('form');
    
    showModal('Ajouter un nouveau produit', form, { confirmText: 'Créer le produit', cancelText: 'Annuler' }).then(async (confirmed) => {
      if (!confirmed) return;
      const realForm = document.querySelector('.custom-modal-overlay #addProductForm');
      if (!realForm) return;

      const fd = new FormData(realForm);
      try {
        const uploadedUrl = await handleImageUpload(realForm).catch(() => null);
        await apiFetch('/products', {
          method: 'POST',
          body: JSON.stringify({
            slug: fd.get('slug'), name_fr: fd.get('name_fr'), name_en: fd.get('name_en'),
            description_fr: fd.get('description_fr'), description_en: fd.get('description_en'),
            service_slug: fd.get('service_slug'),
            image_url: uploadedUrl || ''
          })
        });
        loadProducts(); loadSummary();
      } catch(err){}
    });
  });

  async function loadUsers(){
    const table = document.getElementById('usersBody');
    try {
      const d = await apiFetch('/admin/users');
      const me = Auth.getUser();
      table.innerHTML = d.users.map(u => `
        <tr>
          <td><strong>${escapeHtml(u.full_name)}</strong></td>
          <td>${escapeHtml(u.email)}<br><small style="color:var(--text-muted);">${escapeHtml(u.phone||'')}</small></td>
          <td><span style="background:${u.role==='admin'?'var(--brand-primary)':'#F1F5F9'}; color:${u.role==='admin'?'white':'#475569'}; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:700; text-transform:uppercase;">${escapeHtml(u.role)}</span></td>
          <td style="color:var(--text-muted); font-size:13px;">${escapeHtml(u.created_at)}</td>
          <td style="text-align:right;">${u.id !== me.id ? `<button class="btn-danger deleteUser" data-user-id="${escapeHtml(u.id)}">Supprimer</button>` : '<span style="color:var(--text-muted);">(Vous)</span>'}</td>
        </tr>`).join('');
        
      table.querySelectorAll('.deleteUser').forEach(btn => {
        btn.addEventListener('click', () => {
          showModal('Supprimer ce compte ?', 'Cette action est irréversible. Le compte et ses données seront effacés.', {
            confirmText: 'Supprimer',
            cancelText: 'Annuler',
            danger: true
          }).then(async (confirmed) => {
            if(!confirmed) return;
            await apiFetch('/admin/users/' + btn.dataset.userId, { method: 'DELETE' });
            loadUsers(); loadSummary();
          });
        });
      });
    } catch(e) {}
  }

  async function loadMessages(){
    const table = document.getElementById('messagesBody');
    try {
      const d = await apiFetch('/admin/messages');
      if (!d.messages || !d.messages.length) {
        table.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--text-muted);">Aucun message pour le moment.</td></tr>';
        return;
      }
      table.innerHTML = d.messages.map(m => {
        const isNew = m.status === 'new';
        const opts = ['new', 'read', 'replied'];
        const optionsHtml = opts.map(s=>`<option value="${s}" ${s===m.status?'selected':''}>${s}</option>`).join('');
        return `
        <tr class="${isNew ? 'row-unread-msg' : ''}" data-msg-id="${m.id}">
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              ${isNew ? '<span class="unread-dot" title="Nouveau message non lu"></span>' : ''}
              <strong>${escapeHtml(m.full_name || 'Client')}</strong>
            </div>
          </td>
          <td>${escapeHtml(m.email || '—')}<br><small style="color:var(--text-muted);">${escapeHtml(m.phone||'')}</small></td>
          <td><strong>${escapeHtml(m.subject||'—')}</strong></td>
          <td style="font-size:13px; max-width:280px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(m.body)}">${escapeHtml(m.body)}</td>
          <td><select data-id="${escapeHtml(m.id)}" class="status-select ${escapeHtml(getStatusClass(m.status))}">${optionsHtml}</select></td>
        </tr>`;
      }).join('');
      
      table.querySelectorAll('.status-select').forEach(sel => {
        sel.addEventListener('change', async()=>{
          sel.className = 'status-select ' + getStatusClass(sel.value);
          const row = sel.closest('tr');
          if (row && sel.value !== 'new') {
            row.classList.remove('row-unread-msg');
            const dot = row.querySelector('.unread-dot');
            if (dot) dot.remove();
          }
          await apiFetch('/admin/messages/'+sel.dataset.id,{method:'PATCH',body:JSON.stringify({status:sel.value})});
          loadSummary();
        });
      });
    } catch(e) {}
  }

  async function handleImageUpload(formElement) {
    const fileInput = formElement.querySelector('input[type="file"]');
    const file = fileInput ? fileInput.files[0] : null;
    if (!file) return null;
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await apiFetch('/upload', {
            method: 'POST',
            body: JSON.stringify({
              imageBase64: reader.result,
              filename: file.name
            })
          });
          resolve(res.url);
        } catch (err) {
          console.error('Upload failed:', err);
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('File reading failed'));
      reader.readAsDataURL(file);
    });
  }

  // ── SITE IMAGES DEFINITIONS & MANAGER ──
  const SITE_IMAGES = [
    {
      key: 'site_logo',
      category: 'accueil',
      name: "Logo Officiel de l'Entreprise (EAEPCG)",
      page: "Toutes les pages (Accueil, En-tête, Pied de page)",
      section: "Identité Visuelle & Logo Entreprise",
      defaultUrl: "assets/img/logo.jpg",
      desc: "Logo officiel de votre entreprise affiché en haut, sur la page d'accueil, dans la navigation et le pied de page."
    },
    {
      key: 'hero',
      category: 'accueil',
      name: "Accueil — Bannière Principale (Slide 1)",
      page: "Page d'Accueil (index.html)",
      section: "Haut de page — Diapo 1",
      defaultUrl: "assets/img/hero-solar.jpg",
      desc: "Grande image principale affichée en haut de la page d'accueil (Centrale Solaire & Énergie au Tchad)."
    },
    {
      key: 'contact',
      category: 'accueil',
      name: "Accueil — Bannière Secondaire (Slide 2)",
      page: "Page d'Accueil (index.html)",
      section: "Haut de page — Diapo 2",
      defaultUrl: "assets/img/pompe.jpg",
      desc: "Deuxième image du diaporama international d'accueil (Station de Pompage Solaire Forage)."
    },
    {
      key: 'about',
      category: 'accueil',
      name: "Accueil — Bannière Tertiaire (Slide 3)",
      page: "Page d'Accueil (index.html)",
      section: "Haut de page — Diapo 3",
      defaultUrl: "assets/img/materiels.jpg",
      desc: "Troisième image du diaporama international d'accueil (Matériels Électriques Industriels)."
    },
    {
      key: 'about_expertise',
      category: 'about',
      name: "À Propos — 1. Expertise & Confiance",
      page: "Page À Propos (about.html)",
      section: "Section Expertise & Métiers",
      defaultUrl: "assets/img/about-expertise.jpg",
      desc: "Équipe d'ingénieurs et techniciens sur site de projet au Tchad."
    },
    {
      key: 'about_ingenierie',
      category: 'about',
      name: "À Propos — 2. Ingénierie Globale",
      page: "Page À Propos (about.html)",
      section: "Section Ingénierie Globale",
      defaultUrl: "assets/img/installation.jpg",
      desc: "Ingénieurs et électriciens qualifiés sur armoire électrique industrielle."
    },
    {
      key: 'about_distribution',
      category: 'about',
      name: "À Propos — 3. Logistique & Distribution",
      page: "Page À Propos (about.html)",
      section: "Section Déploiement Tchad",
      defaultUrl: "assets/img/about-distribution.jpg",
      desc: "Centre logistique et flotte de distribution couvrant le Tchad."
    },
    {
      key: 'service_commerce-general',
      category: 'services',
      name: "Service: Commerce Général",
      page: "Services & Accueil",
      section: "Carte de Service",
      defaultUrl: "assets/img/commerce.jpg",
      desc: "Showroom professionnel d'outillage technique et quincaillerie."
    },
    {
      key: 'service_materiels-electriques',
      category: 'services',
      name: "Service: Matériels Électriques",
      page: "Services & Accueil",
      section: "Carte de Service",
      defaultUrl: "assets/img/materiels.jpg",
      desc: "Magasin de câbles, disjoncteurs, compteurs et régulateurs solaires."
    },
    {
      key: 'service_lavage',
      category: 'services',
      name: "Service: Station de Lavage",
      page: "Services, Accueil & Lavage",
      section: "Carte de Service & Page Dédiée",
      defaultUrl: "assets/img/lavage.jpg",
      desc: "Station moderne de lavage haute pression véhicules et motos."
    },
    {
      key: 'service_installation-immeubles',
      category: 'services',
      name: "Service: Installation Immeubles",
      page: "Services & Accueil",
      section: "Carte de Service",
      defaultUrl: "assets/img/installation.jpg",
      desc: "Installation électrique complète et câblage de grands bâtiments."
    },
    {
      key: 'service_pompe-forage',
      category: 'services',
      name: "Service: Pompes de forage",
      page: "Services & Accueil",
      section: "Carte de Service",
      defaultUrl: "assets/img/pompe.jpg",
      desc: "Installation de pompes solaires de forage et distribution d'eau."
    },
    {
      key: 'service_vente-pompes',
      category: 'services',
      name: "Service: Vente de pompes",
      page: "Services & Accueil",
      section: "Carte de Service",
      defaultUrl: "assets/img/vente-pompes.jpg",
      desc: "Showroom de vente de pompes hydrauliques et submersibles."
    }
  ];

  let currentSiteSettingsCache = {};
  let currentGalleryFilter = 'all';

  function getActiveImageUrl(item) {
    if (currentSiteSettingsCache && currentSiteSettingsCache[item.key]) {
      return currentSiteSettingsCache[item.key];
    }
    return item.defaultUrl;
  }

  function isCustomImage(item) {
    return !!(currentSiteSettingsCache && currentSiteSettingsCache[item.key]);
  }

  function updateActivePreview(selectedKey) {
    const item = SITE_IMAGES.find(i => i.key === selectedKey) || SITE_IMAGES[0];
    const activeUrl = getActiveImageUrl(item);
    const isCustom = isCustomImage(item);

    const descEl = document.getElementById('selectedImageDesc');
    if (descEl) descEl.textContent = item.desc;

    const displayImg = document.getElementById('currentImageDisplay');
    if (displayImg) {
      displayImg.src = activeUrl;
    }

    const viewLink = document.getElementById('currentImageViewLink');
    if (viewLink) {
      viewLink.href = activeUrl;
    }

    const titleEl = document.getElementById('currentImageTitle');
    if (titleEl) titleEl.textContent = item.name;

    const pageEl = document.getElementById('currentImagePage');
    if (pageEl) pageEl.textContent = item.page;

    const sourceEl = document.getElementById('currentImageSource');
    if (sourceEl) sourceEl.textContent = activeUrl;

    const badgeEl = document.getElementById('currentStatusBadge');
    if (badgeEl) {
      if (isCustom) {
        badgeEl.className = 'badge-status-custom';
        badgeEl.innerHTML = '<span style="width:7px; height:7px; border-radius:50%; background:#059669;"></span> Image Personnalisée (En ligne)';
      } else {
        badgeEl.className = 'badge-status-default';
        badgeEl.innerHTML = '<span style="width:7px; height:7px; border-radius:50%; background:#64748B;"></span> Image par Défaut du site';
      }
    }

    const deleteBtn = document.getElementById('deleteImageBtn');
    if (deleteBtn) {
      deleteBtn.style.opacity = isCustom ? '1' : '0.45';
      deleteBtn.title = isCustom ? 'Supprimer l\'image personnalisée pour revenir à l\'image par défaut' : 'Déjà à l\'image par défaut';
    }
  }

  function renderImagesGallery() {
    const grid = document.getElementById('allImagesGalleryGrid');
    if (!grid) return;

    const filtered = SITE_IMAGES.filter(item => {
      if (currentGalleryFilter === 'all') return true;
      return item.category === currentGalleryFilter;
    });

    grid.innerHTML = filtered.map(item => {
      const activeUrl = getActiveImageUrl(item);
      const isCustom = isCustomImage(item);
      return `
        <div class="gallery-card" data-key="${item.key}">
          <div class="gallery-thumb">
            <img src="${escapeHtml(activeUrl)}" alt="${escapeHtml(item.name)}" data-fallback="${item.defaultUrl}">
            <div style="position:absolute; top:10px; right:10px;">
              ${isCustom 
                ? '<span class="badge-status-custom" style="box-shadow:0 2px 6px rgba(0,0,0,0.15); font-size:11px;">En ligne</span>' 
                : '<span class="badge-status-default" style="box-shadow:0 2px 6px rgba(0,0,0,0.15); font-size:11px;">Par défaut</span>'}
            </div>
            <div style="position:absolute; bottom:10px; left:10px;">
              <span style="background:rgba(15,23,42,0.8); color:white; font-size:11px; font-weight:700; padding:3px 10px; border-radius:100px; backdrop-filter:blur(4px);">
                ${escapeHtml(item.page.split(' ')[0])}
              </span>
            </div>
          </div>
          <div class="gallery-card-body">
            <div>
              <h4 class="gallery-card-title">${escapeHtml(item.name)}</h4>
              <p class="gallery-card-desc">${escapeHtml(item.desc)}</p>
            </div>
            <button type="button" class="btn-quick-edit" data-edit-key="${item.key}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              Gérer cette image
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  window.selectImageForEdit = function(key) {
    const select = document.getElementById('settingsImageKey');
    if (select) {
      select.value = key;
      updateActivePreview(key);
      const formBox = document.getElementById('siteSettingsForm');
      if (formBox) {
        formBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  async function loadSiteSettingsManager() {
    try {
      const res = await apiFetch('/settings');
      currentSiteSettingsCache = res || {};
      const select = document.getElementById('settingsImageKey');
      const selectedKey = select ? select.value : 'hero';
      updateActivePreview(selectedKey);
      renderImagesGallery();
    } catch (err) {
      console.error('Failed to load site settings:', err);
    }
  }

  function initSettingsManagerEvents() {
    const select = document.getElementById('settingsImageKey');
    if (select) {
      select.addEventListener('change', (e) => {
        updateActivePreview(e.target.value);
      });
    }

    const fileInput = document.getElementById('settingsImageFile');
    const fileNameSpan = document.getElementById('settingsFileName');
    const previewContainer = document.getElementById('newImagePreviewContainer');
    const previewImg = document.getElementById('newImagePreviewImg');
    const previewName = document.getElementById('newImagePreviewName');
    const previewSize = document.getElementById('newImagePreviewSize');
    const clearBtn = document.getElementById('clearSelectedFileBtn');

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          fileNameSpan.textContent = file.name;
          fileNameSpan.style.color = 'var(--text-heading)';
          fileNameSpan.style.borderColor = 'var(--brand-primary)';
          
          const reader = new FileReader();
          reader.onload = (ev) => {
            if (previewImg) previewImg.src = ev.target.result;
            if (previewName) previewName.textContent = file.name;
            if (previewSize) previewSize.textContent = (file.size / 1024).toFixed(1) + ' Ko';
            if (previewContainer) previewContainer.style.display = 'block';
          };
          reader.readAsDataURL(file);
        } else {
          resetFileInput();
        }
      });
    }

    function resetFileInput() {
      if (fileInput) fileInput.value = '';
      if (fileNameSpan) {
        fileNameSpan.textContent = 'Aucun fichier sélectionné';
        fileNameSpan.style.color = 'var(--text-muted)';
        fileNameSpan.style.borderColor = 'var(--border-light)';
      }
      if (previewContainer) previewContainer.style.display = 'none';
      if (previewImg) previewImg.src = '';
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', resetFileInput);
    }

    const refreshBtn = document.getElementById('refreshSettingsBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.style.opacity = '0.5';
        await loadSiteSettingsManager();
        refreshBtn.style.opacity = '1';
        showNotification('Images actualisées avec succès !');
      });
    }

    // Gallery filter tabs
    const filterButtons = document.querySelectorAll('.gallery-filter-btn');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentGalleryFilter = btn.dataset.filter;
        renderImagesGallery();
      });
    });

    // Form submit: Replace image
    const form = document.getElementById('siteSettingsForm');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = fileInput && fileInput.files && fileInput.files[0];
        if (!file) {
          alert("Veuillez sélectionner un fichier image à téléverser.");
          return;
        }

        const submitBtn = document.getElementById('saveImageBtn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = 'Publication en cours...';
        submitBtn.disabled = true;

        try {
          const uploadedUrl = await handleImageUpload(form);
          const key = select.value;
          await apiFetch('/admin/settings', {
            method: 'POST',
            body: JSON.stringify({ key, value: uploadedUrl })
          });
          currentSiteSettingsCache[key] = uploadedUrl;
          if (key === 'site_logo') {
            document.querySelectorAll('.sidebar-header img, #siteLogoHero, #homeEnterpriseLogo, .brand img').forEach(img => img.src = uploadedUrl);
            try { localStorage.setItem('eaepcg_site_logo', uploadedUrl); } catch(e) {}
          }
          resetFileInput();
          updateActivePreview(key);
          renderImagesGallery();
          showNotification('Image mise à jour et publiée avec succès !');
        } catch (err) {
          console.error(err);
          showNotification('Échec de la mise à jour de l\'image.');
        } finally {
          submitBtn.innerHTML = originalText;
          submitBtn.disabled = false;
        }
      });
    }

    // Delete button: Reset to default image
    const deleteBtn = document.getElementById('deleteImageBtn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        const key = select.value;
        const item = SITE_IMAGES.find(i => i.key === key);
        if (!isCustomImage(item)) {
          alert('Cette image utilise déjà la valeur par défaut du thème.');
          return;
        }

        if (!confirm(`Voulez-vous vraiment supprimer l'image personnalisée pour "${item.name}" et revenir à l'image par défaut ?`)) {
          return;
        }

        deleteBtn.disabled = true;
        deleteBtn.textContent = 'Réinitialisation...';

        try {
          await apiFetch(`/admin/settings/${key}`, { method: 'DELETE' });
          delete currentSiteSettingsCache[key];
          if (key === 'site_logo') {
            document.querySelectorAll('.sidebar-header img, #siteLogoHero, #homeEnterpriseLogo, .brand img').forEach(img => img.src = 'assets/img/logo.jpg');
            try { localStorage.removeItem('eaepcg_site_logo'); } catch(e) {}
          }
          resetFileInput();
          updateActivePreview(key);
          renderImagesGallery();
          showNotification('Image réinitialisée vers l\'image par défaut.');
        } catch (err) {
          console.error(err);
          showNotification('Erreur lors de la réinitialisation.');
        } finally {
          deleteBtn.disabled = false;
          deleteBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            RÉTABLIR L'IMAGE PAR DÉFAUT
          `;
        }
      });
    }
  }

  // ── PASSWORD CHANGE CONTROLLER ──
  const passwordModal = document.getElementById('passwordModal');
  const openPasswordModalBtn = document.getElementById('openPasswordModalBtn');
  const settingsOpenPwdModalBtn = document.getElementById('settingsOpenPwdModalBtn');
  const closePasswordModalBtn = document.getElementById('closePasswordModalBtn');
  const cancelPasswordModalBtn = document.getElementById('cancelPasswordModalBtn');
  const changePasswordForm = document.getElementById('changePasswordForm');
  const passwordAlert = document.getElementById('passwordAlert');
  const savePasswordBtn = document.getElementById('savePasswordBtn');
  const savePasswordBtnText = document.getElementById('savePasswordBtnText');

  function openPasswordModal() {
    if (!passwordModal) return;
    passwordModal.style.display = 'flex';
    passwordModal.setAttribute('aria-hidden', 'false');
    if (changePasswordForm) changePasswordForm.reset();
    if (passwordAlert) passwordAlert.style.display = 'none';
    const firstInput = document.getElementById('currentPasswordInput');
    if (firstInput) setTimeout(() => firstInput.focus(), 100);
  }

  function closePasswordModal() {
    if (!passwordModal) return;
    passwordModal.style.display = 'none';
    passwordModal.setAttribute('aria-hidden', 'true');
    if (changePasswordForm) changePasswordForm.reset();
  }

  if (openPasswordModalBtn) openPasswordModalBtn.addEventListener('click', openPasswordModal);
  if (settingsOpenPwdModalBtn) settingsOpenPwdModalBtn.addEventListener('click', openPasswordModal);
  if (closePasswordModalBtn) closePasswordModalBtn.addEventListener('click', closePasswordModal);
  if (cancelPasswordModalBtn) cancelPasswordModalBtn.addEventListener('click', closePasswordModal);

  if (passwordModal) {
    passwordModal.addEventListener('click', (e) => {
      if (e.target === passwordModal) closePasswordModal();
    });
  }

  // Password visibility toggle buttons
  document.querySelectorAll('.pwd-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (!input) return;
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🔒';
        btn.title = 'Masquer le mot de passe';
      } else {
        input.type = 'password';
        btn.textContent = '👁️';
        btn.title = 'Afficher le mot de passe';
      }
    });
  });

  if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const current_password = document.getElementById('currentPasswordInput').value;
      const new_password = document.getElementById('newPasswordInput').value;
      const new_password_confirmation = document.getElementById('confirmPasswordInput').value;

      if (!current_password || !new_password) {
        showPwdAlert('Veuillez renseigner tous les champs obligatoires.', 'error');
        return;
      }
      if (new_password.length < 10) {
        showPwdAlert('Le nouveau mot de passe doit comporter au moins 10 caractères.', 'error');
        return;
      }
      if (new_password !== new_password_confirmation) {
        showPwdAlert('La confirmation du mot de passe ne correspond pas.', 'error');
        return;
      }

      if (savePasswordBtn) savePasswordBtn.disabled = true;
      if (savePasswordBtnText) savePasswordBtnText.textContent = 'Enregistrement en cours...';

      try {
        const res = await apiFetch('/auth/change-password', {
          method: 'POST',
          body: JSON.stringify({ current_password, new_password, new_password_confirmation })
        });

        if (res && res.token && res.user) {
          Auth.setSession(res.token, res.user);
        }

        showPwdAlert('✅ Mot de passe modifié avec succès !', 'success');
        playNotificationChime('message');
        showNotification('Votre mot de passe a été mis à jour avec succès.');

        setTimeout(() => {
          closePasswordModal();
        }, 1600);
      } catch (err) {
        const msg = err && err.message ? err.message : 'Une erreur est survenue lors de la mise à jour.';
        showPwdAlert('❌ ' + msg, 'error');
      } finally {
        if (savePasswordBtn) savePasswordBtn.disabled = false;
        if (savePasswordBtnText) savePasswordBtnText.textContent = 'Enregistrer le mot de passe';
      }
    });
  }

  function showPwdAlert(msg, type) {
    if (!passwordAlert) return;
    passwordAlert.style.display = 'block';
    if (type === 'success') {
      passwordAlert.style.background = '#ECFDF5';
      passwordAlert.style.color = '#065F46';
      passwordAlert.style.border = '1px solid #A7F3D0';
    } else {
      passwordAlert.style.background = '#FEF2F2';
      passwordAlert.style.color = '#991B1B';
      passwordAlert.style.border = '1px solid #FECACA';
    }
    passwordAlert.textContent = msg;
  }

  function showNotification(msg) {
    let el = document.getElementById('admin-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'admin-toast';
      el.style.cssText = 'position:fixed; bottom:30px; right:30px; background:#0F172A; color:white; padding:14px 22px; border-radius:12px; font-weight:600; box-shadow:0 10px 25px rgba(0,0,0,0.25); z-index:9999; display:flex; align-items:center; gap:12px; border-left:4px solid #10B981; font-size:14px;';
      document.body.appendChild(el);
    }
    el.innerHTML = `<div style="width:24px; height:24px; border-radius:50%; background:#10B981; color:white; display:flex; align-items:center; justify-content:center; flex-shrink:0;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg></div> <span>${escapeHtml(msg)}</span>`;
    setTimeout(() => { el.remove(); }, 5000);
  }

// CSP compliance: delegated handlers and non-inline listeners
document.getElementById("currentImageDisplay")?.addEventListener("error", function() { this.src = "assets/img/commerce.jpg"; });
document.getElementById("notifDropdownList")?.addEventListener("click", (e) => {
  const item = e.target.closest("[data-view]");
  if (item) {
    if (document.getElementById("notifDropdown")) document.getElementById("notifDropdown").style.display = "none";
    switchToView(item.dataset.view);
  }
});
document.getElementById("dashContent")?.addEventListener("click", (e) => {
  const card = e.target.closest(".stat-card[data-view]");
  if (card) {
    switchToView(card.dataset.view);
  }
});
const galleryGrid = document.getElementById("galleryGrid");
if (galleryGrid) {
  galleryGrid.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-edit-key]");
    if (btn) {
      selectImageForEdit(btn.dataset.editKey);
    }
  });
  galleryGrid.addEventListener("error", (e) => {
    if (e.target.tagName === "IMG" && e.target.dataset.fallback) {
      e.target.src = e.target.dataset.fallback;
    }
  }, true);
}


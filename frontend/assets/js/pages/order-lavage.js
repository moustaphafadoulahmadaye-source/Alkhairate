renderHeader('services.html'); renderFooter();

  if (Auth.getUser()?.role === 'admin') {
    window.location.replace('admin.html');
  }

  function renderBooking() {
    const container = document.getElementById('bookingContent');

    if (!Auth.isLoggedIn()) {
      container.innerHTML = `
      <div style="text-align:center; padding:20px;">
        <h3 style="margin-bottom:16px; color:#111827; font-weight:800; font-family:'Outfit', sans-serif;">Connexion requise</h3>
        <p style="color:#64748b; margin-bottom:24px; font-size:15px;">
          Vous devez avoir un compte client pour effectuer une réservation.
        </p>
        <a href="login.html" class="btn-submit" style="text-decoration:none; display:inline-block; width:auto;">
          Se connecter pour réserver
        </a>
      </div>`;
      return;
    }

    const user = Auth.getUser();
    const prefillName = user ? user.full_name : '';
    const prefillPhone = user ? (user.phone || '') : '';

    container.innerHTML = `
    <form id="lavageForm">
      
      <div class="form-group">
        <label class="form-label">Type de service souhaité *</label>
        <select name="lavage_type" class="form-control" required>
          <option value="" disabled selected>Sélectionnez un service...</option>
          <option value="Voiture (Complet)">Voiture - Lavage Complet (Int/Ext)</option>
          <option value="Voiture (Extérieur uniquement)">Voiture - Extérieur uniquement</option>
          <option value="Voiture (Intérieur uniquement)">Voiture - Intérieur uniquement</option>
          <option value="Moto">Moto - Lavage complet</option>
          <option value="Tapis / Moquettes">Tapis & Moquettes - Nettoyage</option>
          <option value="Équipement Industriel">Équipement Industriel</option>
          <option value="Autre">Autre (Précisez ci-dessous)</option>
        </select>
      </div>

      <div class="info-box-premium">
        <strong style="display:block; color:#1e3a8a; font-size:15px; margin-bottom:6px;">Service réalisé à la Station EAEPCG</strong>
        <span style="color:#475569; font-size:14px; line-height:1.5; display:block;">Pour garantir un résultat optimal, tous nos lavages sont effectués exclusivement sur place à notre station professionnelle.</span>
        <input type="hidden" name="lavage_location" value="À la station EAEPCG">
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
        <div>
          <label class="form-label">Date souhaitée *</label>
          <input type="date" name="lavage_date" class="form-control" required>
        </div>
        <div>
          <label class="form-label">Heure souhaitée *</label>
          <input type="time" name="lavage_time" class="form-control" required>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
        <div>
          <label class="form-label">Nom complet *</label>
          <input type="text" name="full_name" class="form-control" value="${escapeHtml(prefillName)}" readonly style="background-color: #e2e8f0; color: #64748b; cursor: not-allowed;">
        </div>
        <div>
          <label class="form-label">Téléphone *</label>
          <input type="tel" name="phone" class="form-control" value="${escapeHtml(prefillPhone)}" required placeholder="+235 66 00 00 00">
        </div>
      </div>

      <div class="form-group" style="margin-bottom: 32px;">
        <label class="form-label">Détails ou précisions (Optionnel)</label>
        <textarea name="notes" class="form-control" rows="3" placeholder="Ex: Modèle du véhicule, état des tapis..." style="resize:vertical;"></textarea>
      </div>

      <div class="payment-method-notice" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px; margin-bottom:20px; font-size:13.5px; color:#334155; display:flex; align-items:flex-start; gap:10px;">
        <span style="font-size:20px; line-height:1;">ℹ️</span>
        <div>
          <strong style="color:#0f172a;"><span data-fr>Paiement sur place après prestation</span><span data-en>Payment on site after service</span></strong><br>
          <span data-fr>Cette réservation concerne un service physique de lavage. Aucun paiement n'est exigé ni débité dans l'application. Le règlement se fait sur place à la station ou auprès de notre technicien après réalisation du service.</span>
          <span data-en>This booking is for physical washing services. No payment is charged in the app. Payment is made on-site after service completion.</span>
        </div>
      </div>

      <button type="submit" class="btn-submit">
        <span>Confirmer la réservation</span>
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
      </button>
      <div class="form-msg" id="bookingMsg"></div>
    </form>`;

    document.getElementById('lavageForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('bookingMsg'); msg.className = 'form-msg';
      const fd = new FormData(e.target);
      
      const lavageType = fd.get('lavage_type');
      const lavageLocation = fd.get('lavage_location');
      const lavageDate = fd.get('lavage_date');
      const lavageTime = fd.get('lavage_time');
      const fullName = fd.get('full_name');
      const phone = fd.get('phone');
      const address = fd.get('address');
      const notes = fd.get('notes');

      let details = `Demande de réservation : LAVAGE\n\n`;
      details += `Type de lavage: ${lavageType}\n`;
      details += `Lieu: ${lavageLocation}\n`;
      details += `Rendez-vous: ${lavageDate} à ${lavageTime}\n\n`;
      details += `Client: ${fullName}\n`;
      details += `Téléphone: ${phone}\n`;
      if (address) details += `Adresse: ${address}\n`;
      if (notes) details += `Notes: ${notes}\n`;

      const orderPayload = { 
        service: 'lavage', 
        details: details,
        quantity: 1,
        total: 0,
        currency: 'XAF'
      };

      try {
        await apiFetch('/orders', { method: 'POST', body: JSON.stringify(orderPayload) });
        msg.classList.add('show','ok'); 
        msg.textContent = {fr:'Réservation envoyée avec succès ! Nous vous contacterons pour confirmer.',en:'Booking sent successfully! We will contact you to confirm.',ar:'تم إرسال الحجز بنجاح! سنتواصل معك للتأكيد.'}[currentLang()]||'OK';
        e.target.reset();

        // Prompt for push notification permission on mobile after order
        if (typeof requestPushNotifications === 'function') {
          setTimeout(requestPushNotifications, 1000);
        }

        setTimeout(() => { window.location.href = 'order.html'; }, 3000); // redirect to order history
      } catch(err){ 
        msg.classList.add('show','err'); 
        msg.textContent = err.data?.error||localizedText('loadError'); 
      }
    });
  }

  renderBooking();

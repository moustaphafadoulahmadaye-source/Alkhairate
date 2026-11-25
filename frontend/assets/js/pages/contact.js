renderHeader('contact.html');
  renderFooter();

  // Initialize WhatsApp contact link if present
  const contactWa = document.getElementById('contactWhatsAppLink');
  if (contactWa && typeof getWhatsAppUrl === 'function') {
    contactWa.href = getWhatsAppUrl();
  }

  // Handle Form Submission
  document.getElementById('premiumContactForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('cSubmitBtn');
    const alertBox = document.getElementById('cAlert');
    
    // Reset alert
    alertBox.style.display = 'none';
    alertBox.className = 'alert-message';

    const name = document.getElementById('cName').value.trim();
    const phone = document.getElementById('cPhone').value.trim();
    const email = document.getElementById('cEmail').value.trim();
    const service = document.getElementById('cService').value;
    const message = document.getElementById('cMessage').value.trim();

    if (!message) return;

    btn.disabled = true;
    const origHtml = btn.innerHTML;
    btn.textContent = { fr: 'Envoi en cours...', en: 'Sending...', ar: 'جاري الإرسال...' }[currentLang()] || 'En cours...';

    const subject = `[${service}] Nouveau Contact: ${name}`;
    const bodyText = `Nom: ${name}\nTéléphone: ${phone}\nEmail: ${email || 'N/A'}\nService: ${service}\n\nMessage:\n${message}`;

    try {
      // Always save message to backend
      await apiFetch('/messages', {
        method: 'POST',
        body: JSON.stringify({ 
          subject, 
          body: bodyText,
          guest_name: name,
          guest_phone: phone,
          guest_email: email
        })
      });

      // If User is Logged In, just show success
      if (Auth && typeof Auth.isLoggedIn === 'function' && Auth.isLoggedIn()) {
        alertBox.className = 'alert-message alert-success';
        alertBox.textContent = {
          fr: 'Votre message a été envoyé avec succès !',
          en: 'Your message has been sent successfully!',
          ar: 'تم إرسال رسالتك بنجاح!'
        }[currentLang()] || 'Message envoyé !';
        alertBox.style.display = 'block';
        document.getElementById('premiumContactForm').reset();
      } else {
        // Guest User: also Redirect to WhatsApp with structured professional format
        const lang = (typeof currentLang === 'function') ? currentLang() : 'fr';
        let waText = '';
        if (lang === 'ar') {
          waText = `🏛️ *مؤسسة الخيرات للطاقة (EAEPCG)*\n` +
                   `📩 *طلب تواصل واستفسار جديد*\n` +
                   `──────────────────────────\n` +
                   `👤 *الاسم :* ${name}\n` +
                   `📞 *الهاتف :* ${phone}\n` +
                   (email ? `✉️ *البريد :* ${email}\n` : '') +
                   `🛠️ *الخدمة :* ${service}\n` +
                   `──────────────────────────\n` +
                   `💬 *تفاصيل الرسالة :*\n${message}\n` +
                   `──────────────────────────\n` +
                   `_مرسل عبر تطبيق مؤسسة الخيرات للطاقة_`;
        } else if (lang === 'en') {
          waText = `🏛️ *Établissement Alkhaïrat Énergie (EAEPCG)*\n` +
                   `📩 *New Contact & Quote Inquiry*\n` +
                   `──────────────────────────\n` +
                   `👤 *Name :* ${name}\n` +
                   `📞 *Phone :* ${phone}\n` +
                   (email ? `✉️ *Email :* ${email}\n` : '') +
                   `🛠️ *Service :* ${service}\n` +
                   `──────────────────────────\n` +
                   `💬 *Message :*\n${message}\n` +
                   `──────────────────────────\n` +
                   `_Sent via Alkhaïrat Énergie Platform_`;
        } else {
          waText = `🏛️ *Établissement Alkhaïrat Énergie (EAEPCG)*\n` +
                   `📩 *Nouvelle demande de contact & devis*\n` +
                   `──────────────────────────\n` +
                   `👤 *Nom :* ${name}\n` +
                   `📞 *Téléphone :* ${phone}\n` +
                   (email ? `✉️ *Email :* ${email}\n` : '') +
                   `🛠️ *Service :* ${service}\n` +
                   `──────────────────────────\n` +
                   `💬 *Message :*\n${message}\n` +
                   `──────────────────────────\n` +
                   `_Envoyé via l'application Alkhaïrat Énergie_`;
        }

        const phoneTarget = (typeof COMPANY_CONFIG !== 'undefined' && COMPANY_CONFIG.phoneRaw) ? COMPANY_CONFIG.phoneRaw : '23566341078';
        const waUrl = `https://wa.me/${phoneTarget}?text=${encodeURIComponent(waText)}`;
        window.open(waUrl, '_blank');

        alertBox.className = 'alert-message alert-success';
        alertBox.textContent = {
          fr: 'Redirection vers WhatsApp pour envoyer votre demande.',
          en: 'Redirecting to WhatsApp to send your request.',
          ar: 'جاري التوجيه إلى واتساب لإرسال طلبك.'
        }[currentLang()] || 'Redirection WhatsApp.';
        alertBox.style.display = 'block';
        document.getElementById('premiumContactForm').reset();
      }
    } catch (err) {
      alertBox.className = 'alert-message alert-error';
      alertBox.textContent = err.data?.error || localizedText('loadError') || 'Une erreur est survenue.';
      alertBox.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
  });

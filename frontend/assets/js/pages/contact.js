renderHeader('contact.html');
  renderFooter();

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
        // Guest User: also Redirect to WhatsApp
        let waText = `*EAEPCG - Nouveau Contact*\n\n`;
        waText += `*Nom :* ${name}\n`;
        waText += `*Téléphone :* ${phone}\n`;
        if (email) waText += `*Email :* ${email}\n`;
        waText += `*Service:* ${service}\n\n`;
        waText += `*Message:*\n${message}\n`;

        const waUrl = `https://wa.me/23566341078?text=${encodeURIComponent(waText)}`;
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

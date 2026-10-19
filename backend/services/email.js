const nodemailer = require('nodemailer');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getMissingSmtpConfig() {
  const missing = [];
  if (!process.env.SMTP_HOST) missing.push('SMTP_HOST');
  if (!process.env.SMTP_PORT) missing.push('SMTP_PORT');
  if (!process.env.SMTP_USER) missing.push('SMTP_USER');
  if (!process.env.SMTP_PASSWORD) missing.push('SMTP_PASSWORD');
  if (!process.env.EMAIL_FROM) missing.push('EMAIL_FROM');
  return missing;
}

function isSmtpConfigured() {
  return getMissingSmtpConfig().length === 0;
}

function createTransporter() {
  if (!isSmtpConfigured()) return null;

  const port = Number(process.env.SMTP_PORT);
  const isSecure = process.env.SMTP_SECURE === 'true' || port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: port || 587,
    secure: isSecure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
}

async function verifySmtpConnection() {
  const missing = getMissingSmtpConfig();
  if (missing.length > 0) {
    return {
      ok: false,
      status: 'NOT_CONFIGURED',
      error: `La configuration SMTP est incomplète. Variables manquantes : ${missing.join(', ')}`
    };
  }

  const transporter = createTransporter();
  try {
    await transporter.verify();
    return {
      ok: true,
      status: 'CONNECTED',
      message: `Connexion SMTP réussie vers ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`
    };
  } catch (err) {
    return {
      ok: false,
      status: 'CONNECTION_FAILED',
      error: `Échec de connexion SMTP : ${err.message}`
    };
  }
}

function renderHtmlEmail({ title, preheader, contentHtml }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9; font-family:'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#1e293b; line-height:1.6;">
  ${preheader ? `<div style="display:none; max-height:0; overflow:hidden;">${escapeHtml(preheader)}</div>` : ''}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9; padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:600px; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.06); border:1px solid #e2e8f0;">
          <!-- Header -->
          <tr>
            <td style="background-color:#0b1a30; padding:24px 30px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:20px; font-weight:700; letter-spacing:0.5px;">
                Établissement Alkhairat Énergie
              </h1>
              <p style="margin:4px 0 0 0; color:#94a3b8; font-size:13px; font-weight:500;">
                EAEPCG — Solutions Solaires & Équipements Professionnels
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 30px;">
              ${contentHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc; padding:20px 30px; text-align:center; border-top:1px solid #e2e8f0;">
              <p style="margin:0; font-size:13px; color:#64748b;">
                📞 Téléphone / WhatsApp : <a href="tel:+23566341078" style="color:#0284c7; text-decoration:none;">+235 66 34 10 78</a><br>
                📍 N'Djamena, Tchad — Service client disponible 24/7
              </p>
              <p style="margin:8px 0 0 0; font-size:11px; color:#94a3b8;">
                Cet e-mail a été envoyé automatiquement depuis la plateforme EAEPCG.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendEmail({ to, subject, text, html }) {
  if (!to || typeof to !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) {
    console.warn(`[SMTP Warning] Envoi annulé : adresse e-mail destinataire invalide ou manquante ("${to}").`);
    return { success: false, reason: 'INVALID_RECIPIENT', error: 'Invalid or missing recipient email address.' };
  }

  const missing = getMissingSmtpConfig();
  if (missing.length > 0) {
    console.warn(`[SMTP Notification] Envoi annulé pour <${to}> : la configuration SMTP est incomplète (manque : ${missing.join(', ')}).`);
    return {
      success: false,
      reason: 'SMTP_NOT_CONFIGURED',
      error: `Configuration SMTP incomplète. Variables manquantes : ${missing.join(', ')}`
    };
  }

  const transporter = createTransporter();
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: to.trim(),
      subject,
      text,
      html
    });
    console.log(`[SMTP Success] E-mail envoyé avec succès à <${to}> (Sujet : "${subject}", ID : ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[SMTP Error] Échec de transmission de l'e-mail à <${to}> : ${err.message}`);
    return { success: false, reason: 'SEND_FAILED', error: err.message };
  }
}

async function sendWelcome(user) {
  const name = user.full_name || 'Client';
  const subject = 'Bienvenue chez Établissement Alkhairat Énergie (EAEPCG)';
  const text = `Bonjour ${name},\n\nVotre compte client a été créé avec succès sur la plateforme EAEPCG.\nVous pouvez désormais passer vos commandes, suivre leur statut et échanger directement avec notre service technique.\n\nCordialement,\nL'équipe EAEPCG`;
  
  const contentHtml = `
    <h2 style="margin:0 0 16px 0; font-size:18px; color:#0f172a;">Bienvenue ${escapeHtml(name)} !</h2>
    <p style="margin:0 0 12px 0; color:#334155; font-size:15px;">
      Votre compte client a été créé avec succès sur la plateforme <strong>Établissement Alkhairat Énergie (EAEPCG)</strong>.
    </p>
    <p style="margin:0 0 20px 0; color:#334155; font-size:15px;">
      Vous pouvez désormais accéder à votre espace, suivre l'évolution de vos commandes et demander des devis d'installations solaires, de forage ou d'équipements électriques.
    </p>
    <div style="text-align:center; margin:28px 0;">
      <a href="${escapeHtml(process.env.FRONTEND_URL || 'https://alkhairate.onrender.com')}/login.html" 
         style="background-color:#0284c7; color:#ffffff; text-decoration:none; padding:12px 28px; border-radius:8px; font-weight:600; font-size:15px; display:inline-block;">
        Accéder à mon compte
      </a>
    </div>
  `;

  return sendEmail({
    to: user.email,
    subject,
    text,
    html: renderHtmlEmail({ title: subject, preheader: 'Votre compte EAEPCG est prêt.', contentHtml })
  });
}

function orderDetailsText(order) {
  return [
    `Numéro de commande : #${order.id}`,
    `Date : ${order.created_at || 'Aujourd\'hui'}`,
    `Client : ${order.full_name || '—'}`,
    `Service / Produits : ${order.service || '—'}`,
    `Détails : ${order.details || '—'}`,
    `Quantité : ${order.quantity || '—'}`,
    `Montant total : ${order.total != null && order.total !== '' ? `${order.total} ${order.currency || 'XAF'}` : 'Sur devis'}`,
    `Statut actuel : ${order.status || 'En attente'}`
  ].join('\n');
}

function orderTableHtml(order) {
  return `
    <div style="background-color:#f8fafc; border-radius:8px; border:1px solid #e2e8f0; padding:18px 20px; margin:20px 0;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="6" style="font-size:14px; color:#334155;">
        <tr>
          <td width="35%" style="font-weight:600; color:#64748b;">Numéro de commande :</td>
          <td style="font-weight:700; color:#0f172a;">#${escapeHtml(order.id)}</td>
        </tr>
        <tr>
          <td style="font-weight:600; color:#64748b;">Service / Produits :</td>
          <td style="font-weight:600; color:#0f172a;">${escapeHtml(order.service || '—')}</td>
        </tr>
        <tr>
          <td style="font-weight:600; color:#64748b;">Détails :</td>
          <td>${escapeHtml(order.details || '—')}</td>
        </tr>
        <tr>
          <td style="font-weight:600; color:#64748b;">Quantité :</td>
          <td>${escapeHtml(order.quantity || '—')}</td>
        </tr>
        <tr>
          <td style="font-weight:600; color:#64748b;">Montant total :</td>
          <td style="font-weight:700; color:#0284c7;">${order.total != null && order.total !== '' ? `${escapeHtml(order.total)} ${escapeHtml(order.currency || 'XAF')}` : 'Sur devis'}</td>
        </tr>
        <tr>
          <td style="font-weight:600; color:#64748b;">Statut :</td>
          <td><span style="background-color:#e0f2fe; color:#0369a1; padding:3px 10px; border-radius:12px; font-weight:600; font-size:13px;">${escapeHtml(order.status || 'pending')}</span></td>
        </tr>
      </table>
    </div>
  `;
}

async function sendOrderConfirmation(order) {
  const subject = `Confirmation de votre commande #${order.id} — EAEPCG`;
  const text = `Bonjour ${order.full_name || 'Client'},\n\nNous avons bien reçu votre commande.\n\n${orderDetailsText(order)}\n\nNotre équipe traite votre demande dans les plus brefs délais.\nPour toute question, contactez-nous au +235 66 34 10 78.`;
  
  const contentHtml = `
    <h2 style="margin:0 0 16px 0; font-size:18px; color:#0f172a;">Merci pour votre commande !</h2>
    <p style="margin:0 0 12px 0; color:#334155; font-size:15px;">
      Bonjour <strong>${escapeHtml(order.full_name || 'Client')}</strong>, nous vous confirmons la bonne réception de votre commande.
    </p>
    ${orderTableHtml(order)}
    <p style="margin:16px 0 0 0; color:#64748b; font-size:14px;">
      Notre équipe commerciale et technique prépare le traitement de votre commande. Vous serez notifié par e-mail à chaque étape.
    </p>
  `;

  return sendEmail({
    to: order.email,
    subject,
    text,
    html: renderHtmlEmail({ title: subject, preheader: `Votre commande #${order.id} a été reçue.`, contentHtml })
  });
}

async function sendOrderStatus(order) {
  const statusLabels = {
    pending: 'En attente',
    confirmed: 'Confirmée',
    processing: 'En cours de traitement',
    shipped: 'Expédiée / En livraison',
    delivered: 'Livrée / Terminée',
    cancelled: 'Annulée'
  };
  const statusLabel = statusLabels[order.status] || order.status;
  const subject = `Mise à jour : Commande #${order.id} [${statusLabel}]`;
  const text = `Bonjour ${order.full_name || 'Client'},\n\nLe statut de votre commande #${order.id} a été mis à jour : ${statusLabel}.\n\n${orderDetailsText(order)}`;

  const contentHtml = `
    <h2 style="margin:0 0 16px 0; font-size:18px; color:#0f172a;">Suivi de votre commande #${escapeHtml(order.id)}</h2>
    <p style="margin:0 0 12px 0; color:#334155; font-size:15px;">
      Bonjour <strong>${escapeHtml(order.full_name || 'Client')}</strong>,<br>
      Le statut de votre commande est désormais : <strong>${escapeHtml(statusLabel)}</strong>.
    </p>
    ${orderTableHtml(order)}
  `;

  return sendEmail({
    to: order.email,
    subject,
    text,
    html: renderHtmlEmail({ title: subject, preheader: `Votre commande #${order.id} est maintenant ${statusLabel}.`, contentHtml })
  });
}

async function sendMessageConfirmation(message) {
  const subject = 'Confirmation de réception de votre message — EAEPCG';
  const text = `Bonjour ${message.full_name || 'Client'},\n\nNous avons bien reçu votre message :\n"${message.subject ? message.subject + ' : ' : ''}${message.body}"\n\nUn conseiller EAEPCG vous répondra dans les plus brefs délais.`;

  const contentHtml = `
    <h2 style="margin:0 0 16px 0; font-size:18px; color:#0f172a;">Message bien reçu !</h2>
    <p style="margin:0 0 12px 0; color:#334155; font-size:15px;">
      Bonjour <strong>${escapeHtml(message.full_name || 'Client')}</strong>, nous accusons réception de votre demande.
    </p>
    <div style="background-color:#f8fafc; border-left:4px solid #0284c7; padding:14px 18px; margin:16px 0; border-radius:0 8px 8px 0;">
      <p style="margin:0 0 6px 0; font-weight:600; color:#0f172a;">${escapeHtml(message.subject || 'Demande de renseignement')}</p>
      <p style="margin:0; color:#475569; font-size:14px; white-space:pre-wrap;">${escapeHtml(message.body)}</p>
    </div>
    <p style="margin:16px 0 0 0; color:#64748b; font-size:14px;">
      Notre équipe prend en charge votre requête et vous recontactera très rapidement.
    </p>
  `;

  return sendEmail({
    to: message.email,
    subject,
    text,
    html: renderHtmlEmail({ title: subject, preheader: 'Votre message a bien été reçu par nos équipes.', contentHtml })
  });
}

async function sendPasswordReset(user, resetUrl) {
  const name = user.full_name || 'Client';
  const subject = 'Réinitialisation de votre mot de passe — EAEPCG';
  const text = `Bonjour ${name},\n\nUne demande de réinitialisation de mot de passe a été demandée pour votre compte EAEPCG.\n\nCliquez sur le lien suivant pour définir un nouveau mot de passe (valable 1 heure) :\n${resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute sécurité.`;

  const contentHtml = `
    <h2 style="margin:0 0 16px 0; font-size:18px; color:#0f172a;">Réinitialisation de votre mot de passe</h2>
    <p style="margin:0 0 14px 0; color:#334155; font-size:15px;">
      Bonjour <strong>${escapeHtml(name)}</strong>,<br>
      Nous avons reçu une demande de réinitialisation du mot de passe associé à votre adresse <strong>${escapeHtml(user.email)}</strong>.
    </p>
    <div style="text-align:center; margin:28px 0;">
      <a href="${escapeHtml(resetUrl)}" 
         style="background-color:#0284c7; color:#ffffff; text-decoration:none; padding:13px 30px; border-radius:8px; font-weight:700; font-size:15px; display:inline-block; box-shadow:0 2px 6px rgba(2,132,199,0.3);">
        Changer mon mot de passe
      </a>
    </div>
    <p style="margin:20px 0 0 0; color:#64748b; font-size:13px;">
      ⏳ <em>Ce lien est à usage unique et expire dans 60 minutes.</em><br>
      Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br>
      <a href="${escapeHtml(resetUrl)}" style="color:#0284c7; word-break:break-all;">${escapeHtml(resetUrl)}</a>
    </p>
    <p style="margin:16px 0 0 0; color:#94a3b8; font-size:12px;">
      Si vous n'êtes pas l'auteur de cette demande, vous pouvez ignorer cet e-mail en toute sécurité : votre compte reste protégé.
    </p>
  `;

  return sendEmail({
    to: user.email,
    subject,
    text,
    html: renderHtmlEmail({ title: subject, preheader: 'Lien de réinitialisation de votre mot de passe EAEPCG', contentHtml })
  });
}

async function sendAdminNotification(subject, text) {
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim();
  if (!adminEmail) {
    console.warn('[Admin Notification Skipped] Variable ADMIN_EMAIL non configurée.');
    return { success: false, reason: 'ADMIN_EMAIL_NOT_CONFIGURED' };
  }

  const contentHtml = `
    <h2 style="margin:0 0 16px 0; font-size:18px; color:#0f172a;">Alerte Administrateur EAEPCG</h2>
    <div style="background-color:#f8fafc; border-left:4px solid #f59e0b; padding:14px 18px; margin:16px 0; border-radius:0 8px 8px 0;">
      <p style="margin:0 0 8px 0; font-weight:700; color:#0f172a;">${escapeHtml(subject)}</p>
      <p style="margin:0; color:#334155; font-size:14px; white-space:pre-wrap;">${escapeHtml(text)}</p>
    </div>
  `;

  return sendEmail({
    to: adminEmail,
    subject: `[ADMIN] ${subject}`,
    text,
    html: renderHtmlEmail({ title: `[ADMIN] ${subject}`, preheader: subject, contentHtml })
  });
}

function notify(task, description) {
  Promise.resolve()
    .then(async () => {
      const result = await task();
      if (result && result.success === false && result.reason !== 'SMTP_NOT_CONFIGURED') {
        console.warn(`[Notification Warning] (${description}) : ${result.error || result.reason}`);
      }
    })
    .catch((error) => console.error(`[Notification Error] (${description}) :`, error.message));
}

module.exports = {
  sendWelcome,
  sendOrderConfirmation,
  sendOrderStatus,
  sendMessageConfirmation,
  sendPasswordReset,
  sendAdminNotification,
  sendEmail,
  notify,
  isSmtpConfigured,
  getMissingSmtpConfig,
  verifySmtpConnection,
  createTransporter
};

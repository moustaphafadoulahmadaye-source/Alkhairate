const db = require('../db');

const STATUS_LABELS = {
  pending: 'en attente de validation',
  confirmed: 'confirmée',
  shipped: 'en cours de livraison',
  delivered: 'livrée avec succès',
  cancelled: 'annulée'
};

function isFcmConfigured() {
  return !!(process.env.FCM_SERVER_KEY && process.env.FCM_SERVER_KEY.trim().length > 10);
}

/**
 * Sends a push notification to all active devices of a customer when their order status changes.
 */
async function sendOrderStatusPushNotification(userId, order, status) {
  if (!userId) return { ok: false, reason: 'NO_USER_ID' };

  let tokens = [];
  try {
    tokens = db.prepare('SELECT token, platform FROM device_tokens WHERE user_id = ?').all(userId);
  } catch(e) {
    console.error('[Push Service] Erreur lecture device_tokens:', e.message);
    return { ok: false, error: e.message };
  }

  if (!tokens || tokens.length === 0) {
    return { ok: true, sentCount: 0, reason: 'NO_REGISTERED_TOKENS' };
  }

  const statusFr = STATUS_LABELS[status] || status;
  const title = 'Mise à jour de votre commande — Alkhaïrat';
  const body = `Votre commande #${order.id} est maintenant ${statusFr}.`;

  if (!isFcmConfigured()) {
    console.log(`[Push Notification (Simulation)] FCM non configuré. Envoi vers ${tokens.length} appareil(s) client #${userId} : "${title}" - "${body}"`);
    return {
      ok: true,
      simulated: true,
      sentCount: tokens.length,
      title,
      body
    };
  }

  const fcmKey = process.env.FCM_SERVER_KEY.trim();
  let successCount = 0;

  for (const { token } of tokens) {
    try {
      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=${fcmKey}`
        },
        body: JSON.stringify({
          to: token,
          notification: {
            title,
            body,
            sound: 'default'
          },
          data: {
            orderId: String(order.id),
            status: String(status)
          }
        })
      });

      if (response.ok) {
        successCount++;
      } else {
        const errText = await response.text();
        console.warn(`[Push Service] Échec envoi FCM au token ${token.slice(0, 10)}... :`, errText);
      }
    } catch(err) {
      console.error('[Push Service] Erreur réseau FCM:', err.message);
    }
  }

  return { ok: true, sentCount: successCount };
}

module.exports = {
  isFcmConfigured,
  sendOrderStatusPushNotification
};

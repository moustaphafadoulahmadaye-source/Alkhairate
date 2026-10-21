const crypto = require('crypto');
const db = require('../db');

const STATUS_LABELS = {
  pending: 'en attente de validation',
  confirmed: 'confirmée',
  shipped: 'en cours de livraison',
  delivered: 'livrée avec succès',
  cancelled: 'annulée'
};

let cachedOAuthToken = null;
let cachedOAuthExpiresAt = 0;

/**
 * Parses FCM_SERVICE_ACCOUNT_JSON from environment.
 * Accepts raw JSON string or base64 encoded JSON string.
 */
function getServiceAccount() {
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  try {
    if (trimmed.startsWith('{')) {
      return JSON.parse(trimmed);
    }
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (e) {
    console.error('[Push Service] Format invalide pour FCM_SERVICE_ACCOUNT_JSON:', e.message);
    return null;
  }
}

function isFcmConfigured() {
  const sa = getServiceAccount();
  return !!(sa && sa.project_id && sa.client_email && sa.private_key);
}

/**
 * Obtains a Google OAuth2 access token for FCM v1 using a signed JWT.
 * Tokens are cached in-memory until near expiry.
 */
async function getGoogleAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedOAuthToken && cachedOAuthExpiresAt > now + 300) {
    return cachedOAuthToken;
  }

  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encodeBase64Url = (obj) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');

  const unsignedToken = `${encodeBase64Url(header)}.${encodeBase64Url(payload)}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedToken);
  const signature = signer.sign(serviceAccount.private_key, 'base64url');

  const jwt = `${unsignedToken}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${encodeURIComponent(jwt)}`
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Échec d'obtention du jeton OAuth2 Google FCM: ${res.status} ${errText}`);
  }

  const data = await res.json();
  cachedOAuthToken = data.access_token;
  cachedOAuthExpiresAt = now + (data.expires_in || 3600);
  return cachedOAuthToken;
}

/**
 * Sends a single raw FCM v1 notification message to a specific device token.
 * Automatically deletes stale / unregistered tokens from DB if Google reports them.
 */
async function sendRawPushNotification({ token, title, body, data = {} }) {
  const sa = getServiceAccount();
  if (!sa || !sa.project_id) {
    throw new Error('FCM v1 non configuré : variable FCM_SERVICE_ACCOUNT_JSON manquante ou incomplète.');
  }

  const accessToken = await getGoogleAccessToken(sa);
  const endpoint = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(sa.project_id)}/messages:send`;

  const messagePayload = {
    message: {
      token,
      notification: {
        title,
        body
      },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [String(k), String(v)])
      ),
      android: {
        priority: 'HIGH',
        notification: {
          sound: 'default',
          channel_id: 'orders_channel'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify(messagePayload)
  });

  const responseText = await response.text();
  let responseJson = null;
  try {
    responseJson = JSON.parse(responseText);
  } catch (e) {
    responseJson = { raw: responseText };
  }

  if (!response.ok) {
    const errCode = responseJson?.error?.details?.[0]?.errorCode || responseJson?.error?.status || '';
    const isUnregistered =
      response.status === 404 ||
      errCode === 'UNREGISTERED' ||
      responseText.includes('UNREGISTERED') ||
      responseText.includes('Requested entity was not found');

    if (isUnregistered) {
      try {
        db.prepare('DELETE FROM device_tokens WHERE token = ?').run(token);
        console.log(`[Push Service] Jeton FCM obsolète ou désinstallé nettoyé avec succès : ${token.slice(0, 12)}...`);
      } catch (dbErr) {
        console.error('[Push Service] Erreur lors de la suppression du jeton obsolète:', dbErr.message);
      }
    }

    const error = new Error(`FCM v1 Error (${response.status}): ${responseText}`);
    error.status = response.status;
    error.response = responseJson;
    error.isUnregistered = isUnregistered;
    throw error;
  }

  return responseJson;
}

/**
 * Sends order status update notifications to all registered devices of a customer.
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
  const data = {
    orderId: String(order.id),
    status: String(status)
  };

  if (!isFcmConfigured()) {
    console.log(`[Push Notification (Simulation)] FCM v1 non configuré. Envoi vers ${tokens.length} appareil(s) client #${userId} : "${title}" - "${body}"`);
    return {
      ok: true,
      simulated: true,
      sentCount: tokens.length,
      title,
      body
    };
  }

  let successCount = 0;
  for (const { token } of tokens) {
    try {
      await sendRawPushNotification({ token, title, body, data });
      successCount++;
    } catch(err) {
      console.warn(`[Push Service] Notification non délivrée au token ${token.slice(0, 10)}... : ${err.message}`);
    }
  }

  return { ok: true, sentCount: successCount };
}

module.exports = {
  isFcmConfigured,
  getServiceAccount,
  getGoogleAccessToken,
  sendRawPushNotification,
  sendOrderStatusPushNotification
};

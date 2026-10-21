#!/usr/bin/env node
/**
 * Script de test direct d'envoi de notification push via FCM HTTP v1.
 * 
 * Usage :
 *   node backend/scripts/testPush.js <DEVICE_TOKEN>
 * 
 * Ou en définissant la variable TEST_DEVICE_TOKEN :
 *   TEST_DEVICE_TOKEN="..." node backend/scripts/testPush.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config();

const { isFcmConfigured, getServiceAccount, sendRawPushNotification } = require('../services/push');

async function main() {
  const token = process.argv[2] || process.env.TEST_DEVICE_TOKEN;

  console.log('====================================================');
  console.log('  TEST D\'ENVOI NOTIFICATION PUSH — FCM HTTP v1');
  console.log('====================================================\n');

  if (!isFcmConfigured()) {
    console.error('❌ ERREUR : FCM HTTP v1 n\'est pas configuré.');
    console.error('Assurez-vous que la variable FCM_SERVICE_ACCOUNT_JSON est définie dans votre environnement.');
    console.error('Format attendu : contenu JSON du compte de service Firebase (brut ou encodé en base64).\n');
    process.exit(1);
  }

  const sa = getServiceAccount();
  console.log(`✅ Compte de service Firebase chargé :`);
  console.log(`   - Projet Firebase : ${sa.project_id}`);
  console.log(`   - Client Email    : ${sa.client_email}`);
  console.log('');

  if (!token) {
    console.log('⚠️ Aucun jeton d\'appareil fourni.');
    console.log('Usage : node backend/scripts/testPush.js <DEVICE_TOKEN>');
    console.log('\nPour obtenir un jeton de test réel :');
    console.log(' 1. Lancez l\'application sur votre téléphone Android ou iOS.');
    console.log(' 2. Connectez le téléphone à l\'ordinateur et ouvrez chrome://inspect (sur Android) ou la console Safari (sur iOS).');
    console.log(' 3. Copiez le jeton affiché dans la console ou inspectez la table SQLite `device_tokens`.');
    console.log(' 4. Relancez cette commande avec le jeton.');
    process.exit(0);
  }

  console.log(`🚀 Tentative d'envoi vers le jeton : ${token.slice(0, 15)}...${token.slice(-10)}`);

  try {
    const result = await sendRawPushNotification({
      token,
      title: '🔔 Test Alkhaïrat Énergie',
      body: 'Ceci est un test de notification push direct via FCM HTTP v1 !',
      data: {
        test: 'true',
        sentAt: new Date().toISOString()
      }
    });

    console.log('\n🎉 SUCCÈS ! Réponse officielle de Google FCM :');
    console.log(JSON.stringify(result, null, 2));
    console.log('\nLa notification a été acceptée par les serveurs de Google.');
  } catch (err) {
    console.error('\n❌ ÉCHEC DE L\'ENVOI :');
    console.error(`Message : ${err.message}`);
    if (err.response) {
      console.error('\nDétails de la réponse Google :');
      console.error(JSON.stringify(err.response, null, 2));
    }
    if (err.isUnregistered) {
      console.log('\n💡 Diagnostic : Ce jeton est considéré comme "UNREGISTERED" par Google.');
      console.log('   Cause : L\'application a été désinstallée ou le jeton a expiré.');
      console.log('   Le jeton a été automatiquement purgé de la base de données.');
    }
    process.exit(1);
  }
}

main().catch(e => {
  console.error('Erreur inattendue :', e);
  process.exit(1);
});

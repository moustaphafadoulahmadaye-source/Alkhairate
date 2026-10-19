#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config();

const { verifySmtpConnection, sendEmail, isSmtpConfigured, getMissingSmtpConfig } = require('../services/email');

async function main() {
  console.log('========================================================');
  console.log('🧪 Diagnostic du service e-mail EAEPCG Alkheyrat');
  console.log('========================================================\n');

  console.log('1. Vérification des variables d\'environnement :');
  console.log('   - SMTP_HOST     :', process.env.SMTP_HOST || '(non défini)');
  console.log('   - SMTP_PORT     :', process.env.SMTP_PORT || '(non défini)');
  console.log('   - SMTP_SECURE   :', process.env.SMTP_SECURE || '(défaut : false / 587)');
  console.log('   - SMTP_USER     :', process.env.SMTP_USER || '(non défini)');
  console.log('   - SMTP_PASSWORD :', process.env.SMTP_PASSWORD ? '******** (masqué)' : '(non défini)');
  console.log('   - EMAIL_FROM    :', process.env.EMAIL_FROM || '(non défini)');
  console.log('   - ADMIN_EMAIL   :', process.env.ADMIN_EMAIL || '(non défini)');
  console.log('   - FRONTEND_URL  :', process.env.FRONTEND_URL || 'https://alkhairate.onrender.com');

  const missing = getMissingSmtpConfig();
  if (missing.length > 0) {
    console.log('\n⚠️ Configuration SMTP incomplète !');
    console.log(`   Variables manquantes : ${missing.join(', ')}`);
    console.log('\n💡 Pour configurer un fournisseur réel :');
    console.log('   - Gmail : SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_SECURE=true, mot de passe d\'application');
    console.log('   - Brevo (Sendinblue) : SMTP_HOST=smtp-relay.brevo.com, SMTP_PORT=587, clé API Brevo');
    console.log('   - Hostinger/cPanel : SMTP_HOST=smtp.votre-domaine.com, SMTP_PORT=465');
    console.log('========================================================');
    process.exit(0);
  }

  console.log('\n2. Test de connexion au serveur SMTP...');
  const verifyResult = await verifySmtpConnection();
  if (!verifyResult.ok) {
    console.error('❌ Échec de connexion au serveur SMTP :');
    console.error(`   ${verifyResult.error}`);
    console.log('========================================================');
    process.exit(1);
  }

  console.log('✅ ' + verifyResult.message);

  const targetEmail = process.argv[2] || process.env.ADMIN_EMAIL;
  if (!targetEmail) {
    console.log('\nℹ️ Aucun destinataire spécifié et ADMIN_EMAIL absent : envoi de test ignoré.');
    console.log('========================================================');
    process.exit(0);
  }

  console.log(`\n3. Envoi d'un e-mail de test à <${targetEmail}>...`);
  const sendResult = await sendEmail({
    to: targetEmail,
    subject: 'Test de configuration SMTP — EAEPCG Alkheyrat',
    text: 'Ceci est un e-mail de test confirmant que la passerelle SMTP d\'EAEPCG Alkheyrat fonctionne correctement.',
    html: '<p>Ceci est un e-mail de test confirmant que la passerelle SMTP d\'<strong>EAEPCG Alkheyrat</strong> fonctionne correctement.</p>'
  });

  if (sendResult.success) {
    console.log(`✅ E-mail de test envoyé avec succès ! (ID : ${sendResult.messageId})`);
  } else {
    console.error(`❌ Échec d'envoi : ${sendResult.error}`);
    process.exit(1);
  }

  console.log('========================================================');
}

main().catch(err => {
  console.error('Erreur inattendue :', err);
  process.exit(1);
});

#!/usr/bin/env node
const readline = require('readline');
const bcrypt = require('bcryptjs');
const db = require('../db');

function validatePassword(pass) {
  if (!pass || typeof pass !== 'string' || pass.trim().length < 12) {
    throw new Error('Le mot de passe doit contenir au moins 12 caractères.');
  }

  const forbidden = [
    'Mast@66341078@',
    'replace-with-a-strong-admin-password',
    'adminpassword',
    'password123456'
  ];

  if (forbidden.includes(pass.trim())) {
    throw new Error('Ce mot de passe est compromis ou trop faible. Veuillez choisir un mot de passe sécurisé et unique.');
  }
}

function updateAdminPassword(newPassword) {
  validatePassword(newPassword);

  const admin = db.prepare("SELECT id, email FROM users WHERE role = 'admin' LIMIT 1").get();
  if (!admin) {
    throw new Error("Aucun compte administrateur n'a été trouvé dans la base de données.");
  }

  const hash = bcrypt.hashSync(newPassword.trim(), 10);
  db.prepare('UPDATE users SET password_hash = ?, token_version = COALESCE(token_version, 1) + 1 WHERE id = ?').run(hash, admin.id);

  // Verification step
  const updated = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(admin.id);
  const isValid = bcrypt.compareSync(newPassword.trim(), updated.password_hash);
  if (!isValid) {
    throw new Error('Échec de vérification du mot de passe après mise à jour.');
  }

  console.log('✅ Succès : Le mot de passe du compte administrateur (' + admin.email + ') a été mis à jour et vérifié avec succès.');
  console.log('👉 N\'oubliez pas de mettre à jour également la variable ADMIN_PASSWORD dans votre dashboard Render !');
  return true;
}

const argPassword = process.argv[2];
if (argPassword) {
  try {
    updateAdminPassword(argPassword);
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur :', err.message);
    process.exit(1);
  }
} else {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Entrez le nouveau mot de passe administrateur (min. 12 caractères) : ', (answer) => {
    rl.close();
    try {
      updateAdminPassword(answer);
      process.exit(0);
    } catch (err) {
      console.error('❌ Erreur :', err.message);
      process.exit(1);
    }
  });
}

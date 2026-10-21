# Guide Hébergement, Persistance des Données & E-mails — EAEPCG Alkheyrat

Ce document décrit la configuration de la persistance des données sur Render, la stratégie de sauvegarde automatique et la configuration SMTP.

---

## 1. Problématique du Disque Éphémère (Plan Render Gratuit)

Sur le plan gratuit de Render :
- Le conteneur s'endort après 15 minutes d'inactivité.
- Le système de fichiers est **éphémère** : à chaque redéploiement ou redémarrage du service, tout fichier créé localement (base SQLite `eaepcg.db`, images uploadées dans `uploads/`, avatars dans `avatars/`) est **définitivement perdu**.

---

## 2. Solution Recommandée : Disque Persistant Render (Persistent Disk)

La solution la plus simple, sans changer le code de base de données (SQLite continue d'être utilisé à haute performance sans latence réseau) :

### Coût mensuel
- **Plan Starter Web Service** : 7 $ / mois (obligatoire pour pouvoir attacher un disque).
- **Disque persistant** : 0,25 $ / Go / mois.
- **Total estimé pour 1 Go** : **~7,25 $ / mois**.

### Procédure de configuration sur le Dashboard Render
1. Rendez-vous sur votre dashboard : [https://dashboard.render.com](https://dashboard.render.com).
2. Sélectionnez le service web **alkhairate**.
3. Dans l'onglet **Settings** : passez l'instance en plan **Starter** (7 $/mois).
4. Allez dans l'onglet **Disks** (colonne de gauche) et cliquez sur **Add Disk** :
   - **Name** : `alkhairate-data`
   - **Mount Path** : `/var/data`
   - **Size** : `1 GB` (ou plus selon le volume d'images).
5. Dans l'onglet **Environment** du service, ajoutez ou confirmez la variable :
   - `DATA_DIR` = `/var/data`
6. Cliquez sur **Save Changes**. Le service redémarre automatiquement avec le disque monté.

### Structure automatique des dossiers sur `/var/data`
Le backend configure automatiquement :
- Base SQLite : `/var/data/eaepcg.db`
- Images du catalogue et du site : `/var/data/uploads/`
- Avatars clients : `/var/data/avatars/`
- Sauvegardes locales : `/var/data/backups/`

---

## 3. Alternative : Migration vers PostgreSQL Managé Render

Si vous préférez séparer complètement la base de données du serveur web :
- **Render PostgreSQL Managé** : 7 $ / mois.
- **Stockage d'images externe** : Cloudflare R2 ou AWS S3 (Bucket gratuit ou < 0,10 $/mois).
- **Avantage** : Permet de monter plusieurs instances web en parallèle (horizontal scaling).
- **Inconvénient** : Coût total légèrement plus élevé (~14 $/mois au lieu de ~7,25 $/mois).

---

## 4. Sauvegardes Automatiques et Restauration

### A. Créer une sauvegarde
Sur le serveur (via le Shell Render ou cron) ou en local :
```bash
npm run backup
```
- Réalise une sauvegarde atomique de SQLite via `db.backup()`.
- Copie l'ensemble des images et avatars.
- Génère un fichier `metadata.json` avec timestamp et taille.

### B. Exporter en archive compressée (.tar.gz) avec empreinte SHA-256
```bash
npm run export-archive
```
- Crée une archive compressée `backup-YYYY-MM-DDTHH-MM-SS.tar.gz`.
- Calcule son hash SHA-256 dans `backup-YYYY-MM-DDTHH-MM-SS.tar.gz.sha256`.
- Cette archive peut être envoyée automatiquement vers un stockage externe (Cloudflare R2, AWS S3, Google Drive, ou par SFTP).

### C. Tester la restauration
Pour restaurer la dernière sauvegarde :
```bash
npm run restore
```
Pour restaurer une sauvegarde spécifique :
```bash
npm run restore backup-2026-10-21T10-30-50-689Z
```
Le script de restauration effectue :
1. Une sauvegarde préventive de la base actuelle (`.bak`).
2. La copie de la base SQLite.
3. **Le contrôle d'intégrité SQLite obligatoire** (`PRAGMA integrity_check`).
4. La restauration complète des dossiers `uploads/` et `avatars/`.

---

## 5. Configuration SMTP (E-mails Transactionnels)

Pour que l'application puisse envoyer les e-mails de bienvenue, réinitialisation de mot de passe et notifications de commandes :

### Variables à ajouter dans le Dashboard Render (Environment)

| Variable | Exemple Gmail | Exemple Brevo (recommandé) |
|---|---|---|
| `SMTP_HOST` | `smtp.gmail.com` | `smtp-relay.brevo.com` |
| `SMTP_PORT` | `465` | `587` |
| `SMTP_SECURE` | `true` | `false` |
| `SMTP_USER` | `votre-adresse@gmail.com` | `votre-login-brevo` |
| `SMTP_PASSWORD` | Mot de passe d'application Google (16 lettres) | Clé SMTP Brevo (`xsmtpib-...`) |
| `EMAIL_FROM` | `Alkhairat Énergie <votre-adresse@gmail.com>` | `Alkhairat Énergie <contact@alkhairat-energie.com>` |
| `ADMIN_EMAIL` | `contact@alkhairat-energie.com` | `contact@alkhairat-energie.com` |
| `FRONTEND_URL`| `https://alkhairate.onrender.com` | `https://alkhairate.onrender.com` |

> [!TIP]
> **Pourquoi Brevo (Sendinblue) est recommandé :**
> - Plan gratuit : 300 e-mails/jour (largement suffisant pour l'activité).
> - Taux de délivrabilité maximal en boîte de réception (pas de spam).
> - Configuration en 3 minutes : créer un compte sur [brevo.com](https://www.brevo.com), aller dans **SMTP & API** > **Générer une nouvelle clé SMTP**.

### Test de la passerelle e-mail
Une fois les variables renseignées sur Render, testez directement depuis le terminal ou via Render Shell :
```bash
npm run test-email votre-adresse@gmail.com
```
Le script vérifie la connectivité DNS/TLS, teste l'authentification et transmet un e-mail de test complet.

# Guide de Build iOS sans Mac — Alkhaïrat Énergie

Vous êtes sous Windows et ne possédez pas d'ordinateur Mac. Ce guide vous explique comment générer votre application iOS (`.ipa`), la signer et la publier sur **Apple TestFlight** et l'**App Store**.

---

## 1. Comment compiler pour iOS sans Mac ?

Apple exige macOS et Xcode pour compiler une application iOS. Deux solutions cloud permettent de compiler et signer sans posséder de Mac :

### Solution 1 : GitHub Actions macOS (Gratuit & Déjà configuré dans le projet)
Votre projet contient déjà le workflow [`.github/workflows/build-mobile.yml`](.github/workflows/build-mobile.yml) qui tourne sur des serveurs virtuels Apple (`macos-14` avec Xcode préinstallé) fournis par GitHub.

### Solution 2 : Codemagic (Spécialisé Mobile, Très simple)
[Codemagic.io](https://codemagic.io) propose 500 minutes de build gratuites par mois. Il gère automatiquement les certificats Apple, la signature et l'envoi vers TestFlight d'un simple clic depuis votre navigateur Windows.

---

## 2. Ce que vous devez créer dans votre compte Apple Developer

Pour publier sur l'App Store, un compte **Apple Developer Program** (99 $/an) sur [developer.apple.com](https://developer.apple.com) est obligatoire.

### A. Créer l'identifiant d'application (App ID)
1. Rendez-vous sur **Certificates, Identifiers & Profiles** > **Identifiers**.
2. Cliquez sur le bouton **+** et sélectionnez **App IDs**.
3. Renseignez :
   - **Description :** `Alkheyrat Energie`
   - **Bundle ID :** `Explicit` > `com.alkhairat.energie`
4. Dans la liste des fonctionnalités (Capabilities), cochez :
   - ✅ **Push Notifications** (pour les notifications de statut de commande).
5. Cliquez sur **Continue** puis **Register**.

### B. Créer la Clé API App Store Connect (Recommandé pour automatiser sans 2FA)
Une clé API permet à GitHub Actions ou Codemagic de téléverser vos builds sur TestFlight automatiquement sans vous demander de code SMS ou 2FA :
1. Rendez-vous sur [appstoreconnect.apple.com](https://appstoreconnect.apple.com) > **Utilisateurs et accès** > onglet **Intégrations (Clés)**.
2. Cliquez sur **Générer une clé API**.
3. Nom : `GitHub Actions CI`, Rôle : **Gestionnaire d'apps (App Manager)**.
4. Notez précieusement :
   - L'**ID de l'émetteur (Issuer ID)** (UUID sous forme `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).
   - L'**ID de la clé (Key ID)** (10 caractères, ex: `9X7ZABCD12`).
   - Téléchargez le fichier de clé privée `AuthKey_XXXXXX.p8` (téléchargeable une seule fois).

### C. Certificat de distribution et Profil de provisionnement
- **Certificat de distribution Apple :** Créez un certificat de type *Apple Distribution*. Exportez-le au format `.p12` avec un mot de passe.
- **Profil de provisionnement (Provisioning Profile) :** Créez un profil de type *App Store Connect Distribution* associé au Bundle ID `com.alkhairat.energie` et à votre certificat. Téléchargez le fichier `.mobileprovision`.

---

## 3. Configuration des Secrets GitHub (pour le build automatique)

Dans votre dépôt GitHub, allez dans **Settings** > **Secrets and variables** > **Actions** > **New repository secret** :

| Nom du Secret | Description |
|---|---|
| `BUILD_CERTIFICATE_BASE64` | Votre certificat `.p12` converti en chaîne base64 |
| `P12_PASSWORD` | Le mot de passe de votre certificat `.p12` |
| `BUILD_PROVISION_PROFILE_BASE64` | Votre fichier `.mobileprovision` converti en base64 |
| `KEYCHAIN_PASSWORD` | Un mot de passe temporaire quelconque (ex: `A1b2C3d4Secret`) |

> Pour convertir un fichier en Base64 sous Windows PowerShell :
> ```powershell
> [Convert]::ToBase64String([IO.File]::ReadAllBytes("chemin\vers\mon_certificat.p12")) | Set-Clipboard
> ```
> Le contenu est directement copié dans votre presse-papier, prêt à être collé dans GitHub !

---

## 4. Permissions Déclarées dans `Info.plist` (Exigences Apple Review)

Apple rejette toute application qui demande l'accès aux fonctionnalités de l'appareil sans explication claire. Dans [`ios/App/App/Info.plist`](ios/App/App/Info.plist), les autorisations suivantes sont déjà configurées :

### 1. Caméra (`NSCameraUsageDescription`)
- **Texte :** *"Alkhaïrat Énergie utilise votre appareil photo pour vous permettre de prendre et mettre à jour votre photo de profil client."*
- **Usage :** Prise de photo directe dans l'espace client (Mon Espace > Profil).

### 2. Bibliothèque Photo (`NSPhotoLibraryUsageDescription`)
- **Texte :** *"Alkhaïrat Énergie accède à votre galerie photo pour vous permettre de choisir une photo de profil."*
- **Usage :** Sélection d'un avatar existant.

### 3. Enregistrement Photo (`NSPhotoLibraryAddUsageDescription`)
- **Texte :** *"Alkhaïrat Énergie enregistre vos fiches de commande et devis dans votre galerie à votre demande."*

### 4. Notifications Push
- Gérées dynamiquement après la première commande (via `@capacitor/push-notifications`).

---

## 5. Lancer un Build iOS depuis votre navigateur

1. Allez sur votre dépôt GitHub dans l'onglet **Actions**.
2. Cliquez sur **Build Mobile (Android & iOS)** dans la liste de gauche.
3. Cliquez sur le bouton **Run workflow**, choisissez `ios` (ou `both`) et validez.
4. GitHub Actions alloue une machine macOS, compile votre projet, et met à disposition l'archive `.xcarchive` et l'IPA en téléchargement direct dans la section *Artifacts*.

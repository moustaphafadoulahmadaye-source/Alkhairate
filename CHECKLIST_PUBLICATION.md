# Checklist de Publication — Google Play Store & Apple App Store

Ce document récapitule toutes les actions requises pour publier **Alkhaïrat Énergie** (`com.alkhairat.energie`) sur Google Play et l'App Store.

---

## 1. Comptes Développeur & Frais

| Plateforme | Type de compte | Frais | Lien d'inscription |
|---|---|---|---|
| **Google Play** | Google Play Console (Personnel ou Entreprise) | **25 $ USD** (Paiement unique à vie) | [play.google.com/console](https://play.google.com/console/signup) |
| **Apple App Store** | Apple Developer Program | **99 $ USD / an** (Abonnement annuel) | [developer.apple.com/programs](https://developer.apple.com/programs/enroll/) |

---

## 2. Checklist Google Play Store (Android)

- [x] **Code & Sécurité :**
  - [x] Bundle ID : `com.alkhairat.energie`
  - [x] URLs API pointant vers `https://alkhairate.onrender.com/api`
  - [x] Aucune URL relative d'image cassée (gérées par `assetUrl()`)
  - [x] Administration (`admin.html`) exclue du bundle mobile public
  - [x] Token JWT stocké de façon sécurisée (`@capacitor/preferences`)
  - [x] Bouton de suppression de compte fonctionnel dans `account.html`
- [x] **Ressources Graphiques (Générées) :**
  - [x] Icône de l'application : `assets/logo.png` (1024x1024 px)
  - [x] Icônes adaptatives Android (mipmap-mdpi à xxxhdpi dans `android/app/src/main/res/`)
  - [x] Écrans de démarrage (Splash screens portrait/paysage jour/nuit)
  - [ ] Bannière Feature Graphic (1024 x 500 px) à charger dans la Play Console
  - [ ] Captures d'écran téléphone (min 2, max 8)
- [x] **Fiche Store & Données (Voir `STORE_METADATA.md`) :**
  - [x] Titre (30 car.) : *Alkhaïrat Énergie*
  - [x] Description courte (80 car.) : *Équipements solaires, forages, pompes et services de lavage au Tchad.*
  - [x] Description longue rédigée
  - [x] Catégorie : *Entreprise (Business)* ou *Shopping*
  - [x] URL Politique de confidentialité : `https://alkhairate.onrender.com/privacy.html`
  - [x] Questionnaire "Sécurité des données" (Data Safety) préparé
- [ ] **Signature & Publication :**
  - [ ] Générer le Keystore avec `.\scripts\generate-keystore.ps1`
  - [ ] Sauvegarder le Keystore à 3 endroits hors ligne sécurisés
  - [ ] Activer *Play App Signing* dans la console Google Play
  - [ ] Compiler l'AAB (`npm run android:sync` puis `./gradlew bundleRelease`)
  - [ ] Déployer l'AAB sur la voie de **Test fermé (Closed Testing)**
  - [ ] **Règle des 14 jours :** Faire tester par au moins 12 testeurs pendant 14 jours consécutifs
  - [ ] Demander l'accès à la production après validation des 14 jours

---

## 3. Checklist Apple App Store (iOS sans Mac)

- [x] **Conformité Apple Guidelines :**
  - [x] Guideline 4.2 (Fonctionnalités natives réelles) : Notifications push, partage natif, appareil photo pour avatar, cache catalogue hors ligne, contact WhatsApp/appel direct
  - [x] Guideline 5.1.1(v) : Suppression de compte client immédiate dans l'app (`account.html`)
  - [x] Guideline 3.1.5 : Vente de biens matériels physiques et services sur site (aucun prélèvement in-app exigé, mention claire du paiement hors ligne à la livraison)
  - [x] Pas de liens cassés, pas de pages en construction
  - [x] Safe areas iOS (`viewport-fit=cover`, `env(safe-area-inset-*)`)
- [x] **Autorisations déclarées dans `ios/App/App/Info.plist` :**
  - [x] `NSCameraUsageDescription` (FR)
  - [x] `NSPhotoLibraryUsageDescription` (FR)
  - [x] `NSPhotoLibraryAddUsageDescription` (FR)
- [x] **Assets Graphiques iOS :**
  - [x] AppIcon 1024x1024 dans `Assets.xcassets`
  - [x] Splash screens universels intégrés
- [ ] **Apple Developer & App Store Connect :**
  - [ ] Créer l'App ID `com.alkhairat.energie` avec Capability *Push Notifications*
  - [ ] Créer la Clé API App Store Connect (`.p8`) avec rôle *App Manager*
  - [ ] Créer le certificat de distribution Apple (`.p12`) et le profil de provisionnement
  - [ ] Ajouter les secrets dans GitHub Actions (`BUILD_CERTIFICATE_BASE64`, etc.)
- [ ] **Compilation & TestFlight :**
  - [ ] Déclencher le workflow GitHub Actions `Build Mobile (Android & iOS)`
  - [ ] Installer le build sur iPhone via **Apple TestFlight**
  - [ ] Remplir la fiche App Store Connect (Textes de `STORE_METADATA.md`)
  - [ ] Soumettre à la vérification Apple (Apple App Review)

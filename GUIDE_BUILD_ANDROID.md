# Guide de Build et Publication Android — Alkhaïrat Énergie

Ce guide explique étape par étape comment signer, compiler et publier l'application Android **Alkhaïrat Énergie** (`com.alkhairat.energie`) sur le Google Play Store.

---

## 1. Structure du Projet Android

- **Répertoire Android :** `android/`
- **Configuration :** `android/app/build.gradle`
- **Application ID :** `com.alkhairat.energie`
- **Version actuelle :** `versionCode 1`, `versionName "1.0"`
- **Ressources graphiques :** Icônes adaptatives et splash screens déjà générés dans `android/app/src/main/res/` par `@capacitor/assets`.
- **Bundle Web embarqué :** `android/app/src/main/assets/public/` (généré depuis `www/` sans `admin.html`).

---

## 2. Générer le Keystore de Signature Release

### A. Commande de génération
Exécutez dans PowerShell :
```powershell
.\scripts\generate-keystore.ps1
```
Ou directement avec l'outil Java JDK :
```powershell
& "C:\Program Files\Java\jdk-25\bin\keytool.exe" -genkeypair -v `
  -keystore alkheyrat-release.jks `
  -alias alkheyrat `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000 `
  -storetype JKS
```

### B. Règles Absolues de Sécurité du Keystore
> [!WARNING]
> **RÈGLE CRITIQUE DE SAUVEGARDE :**
> Si vous perdez votre fichier `.jks` ou son mot de passe, **il est techniquement impossible de publier une mise à jour** de votre application sur Google Play. Vous seriez obligé de changer d'ID d'application et de perdre tous vos utilisateurs installés.
> 
> - **Ne commitez JAMAIS** votre fichier `alkheyrat-release.jks` dans Git (il est déjà exclu dans `.gitignore`).
> - **Sauvegardez-le immédiatement à 3 endroits distincts :**
>   1. Une clé USB sécurisée hors ligne.
>   2. Votre coffre-fort de mots de passe (ex. Bitwarden / 1Password avec pièce jointe).
>   3. Une sauvegarde cloud chiffrée privée.

### C. Activer « Play App Signing » (Signature d'application par Google Play)
Lors de la création de l'application sur la Google Play Console, **laissez cochée l'option par défaut "Play App Signing"** (Signature d'application par Google Play).
- **Pourquoi c'est indispensable :** Avec Play App Signing, Google conserve la clé de signature racine dans son infrastructure ultra-sécurisée. Le fichier que vous générez ci-dessus sert de *clé de téléversement (Upload Key)*. Si un jour votre ordinateur crashait ou si la clé était égarée, l'assistance Google Play Console peut réinitialiser votre clé de téléversement sans bloquer l'application.

---

## 3. Génération de l'Android App Bundle (AAB)

Google Play exige le format **AAB** (Android App Bundle, `.aab`) pour toute nouvelle application.

### Méthode A : Avec Android Studio (Recommandé sur Windows)
1. Ouvrez le projet dans Android Studio :
   ```bash
   npm run android:open
   ```
2. Dans Android Studio, cliquez sur le menu : **Build** > **Generate Signed Bundle / APK...**
3. Sélectionnez **Android App Bundle (.aab)** puis cliquez sur **Next**.
4. Renseignez :
   - **Key store path :** sélectionnez votre fichier `alkheyrat-release.jks`.
   - **Key store password :** votre mot de passe keystore.
   - **Key alias :** `alkheyrat`.
   - **Key password :** votre mot de passe de clé.
5. Sélectionnez la variante de build **release**.
6. Cliquez sur **Create**.
7. Le fichier AAB signé est généré dans `android/app/release/app-release.aab`.

### Méthode B : En ligne de commande (Gradle)
Définissez les variables d'environnement dans votre terminal PowerShell :
```powershell
$env:KEYSTORE_PATH = "$PWD\alkheyrat-release.jks"
$env:KEYSTORE_PASSWORD = "votre_mot_de_passe"
$env:KEY_ALIAS = "alkheyrat"
$env:KEY_PASSWORD = "votre_mot_de_passe"

cd android
.\gradlew.bat bundleRelease
cd ..
```
L'AAB prêt pour le store sera dans `android/app/build/outputs/bundle/release/app-release.aab`.

---

## 4. Gestion des Versions (`versionCode` & `versionName`)

À chaque future mise à jour que vous soumettez à Google Play, éditez `android/app/build.gradle` :
```groovy
defaultConfig {
    versionCode 2          // STRICTEMENT croissant : 1, 2, 3, 4...
    versionName "1.1"      // Chaîne affichée aux utilisateurs
}
```
Puis relancez `npm run android:sync` et le build du bundle.

---

## 5. Règle Obligatoire Google Play : Test Fermé (12 Testeurs / 14 Jours)

> [!IMPORTANT]
> **OBLIGATION POUR TOUT NOUVEAU COMPTE PERSONNEL GOOGLE PLAY :**
> Depuis novembre 2023, Google impose à tout compte personnel de développeur créé récemment une période probatoire de test avant de pouvoir ouvrir l'accès à la Production :
> 
> 1. Vous devez créer une voie de **Test fermé (Closed Testing)** dans la Google Play Console.
> 2. Vous devez recruter au minimum **12 testeurs** (amis, collègues, clients).
> 3. Chaque testeur doit accepter l'invitation Google Play (lien web ou lien Play Store) et **télécharger l'application**.
> 4. Les 12 testeurs doivent rester inscrits et conserver l'application active pendant **14 jours consécutifs minimum**.
> 5. Une fois les 14 jours écoulés, un bouton **"Demander l'accès à la production"** s'active dans la Play Console. Vous répondrez à un bref questionnaire de bilan (ex: retours des utilisateurs, stabilité) et Google validera l'accès à la publication publique.

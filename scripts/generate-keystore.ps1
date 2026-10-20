# Script de génération du Keystore de signature pour Google Play
# ATTENTION : Ne commitez JAMAIS votre keystore ni vos mots de passe dans Git.
# Conservez précieusement ce fichier dans un emplacement sécurisé (coffre-fort, disque externe, gestionnaire de mots de passe).
# Si vous perdez ce keystore, vous ne pourrez plus mettre à jour l'application sur Google Play.

$KeytoolPath = "C:\Program Files\Java\jdk-25\bin\keytool.exe"
if (-not (Test-Path $KeytoolPath)) {
    $KeytoolCmd = Get-Command keytool -ErrorAction SilentlyContinue
    if ($KeytoolCmd) {
        $KeytoolPath = $KeytoolCmd.Source
    } else {
        Write-Error "keytool.exe introuvable. Veuillez installer un JDK Java ou vérifier le chemin."
        exit 1
    }
}

$OutputFile = "alkheyrat-release.jks"
$Alias = "alkheyrat"

Write-Host "--- Génération du Keystore de production pour Alkhaïrat Énergie ---" -ForegroundColor Cyan
Write-Host "Fichier cible : $OutputFile"
Write-Host "Alias : $Alias"
Write-Host "Validité : 10 000 jours (~27 ans)"
Write-Host ""
Write-Host "IMPORTANT : Utilisez un mot de passe robuste et notez-le soigneusement." -ForegroundColor Yellow

& $KeytoolPath -genkeypair -v `
    -keystore $OutputFile `
    -alias $Alias `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -storetype JKS

if (Test-Path $OutputFile) {
    Write-Host ""
    Write-Host "✅ Keystore généré avec succès : $OutputFile" -ForegroundColor Green
    Write-Host "RAPPEL CRUCIAL : Le fichier $OutputFile est déjà protégé dans .gitignore." -ForegroundColor Green
    Write-Host "Faites immédiatement une double sauvegarde (ex: clé USB + coffre-fort cloud privé)." -ForegroundColor Yellow
}

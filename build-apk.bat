@echo off
setlocal enabledelayedexpansion

echo ================================================
echo   ImproVote - Build APK + GitHub Release
echo ================================================
echo.

:: ── Demander l'URL du serveur ───────────────────────────────────────────────
set /p SERVER_URL="URL du serveur (ex: https://improvote.monserveur.com) : "
if "!SERVER_URL!"=="" (
  echo ERREUR : URL requise.
  pause & exit /b 1
)

:: ── Verifier les prerequis ──────────────────────────────────────────────────
where node >nul 2>&1 || (echo ERREUR : Node.js introuvable. & pause & exit /b 1)
where java >nul 2>&1 || (echo ERREUR : Java introuvable. Installer JDK 17+. & pause & exit /b 1)
where gh >nul 2>&1 || (echo ERREUR : gh CLI introuvable. Installer depuis https://cli.github.com & pause & exit /b 1)

if not defined ANDROID_HOME (
  echo ERREUR : ANDROID_HOME non defini. Configurer le SDK Android.
  pause & exit /b 1
)

:: ── Installer les deps Capacitor si besoin ──────────────────────────────────
echo [1/6] Verification des dependances Capacitor...
if not exist "node_modules\@capacitor\core" (
  echo Installation de Capacitor...
  call npm install @capacitor/core @capacitor/android @capacitor/cli --save
)

:: ── Build web ────────────────────────────────────────────────────────────────
echo [2/6] Build de l'application web...
set VITE_SERVER_URL=!SERVER_URL!
call npm run build
if errorlevel 1 (echo ERREUR : Build web echoue. & pause & exit /b 1)

:: ── Initialiser / synchroniser Capacitor ────────────────────────────────────
echo [3/6] Synchronisation Capacitor...
if not exist "android" (
  echo Ajout de la plateforme Android...
  call npx cap add android
)
call npx cap sync android
if errorlevel 1 (echo ERREUR : cap sync echoue. & pause & exit /b 1)

:: ── Build APK ────────────────────────────────────────────────────────────────
echo [4/6] Build de l'APK...
cd android
call gradlew.bat assembleDebug
if errorlevel 1 (echo ERREUR : Gradle build echoue. & pause & cd .. & exit /b 1)
cd ..

:: ── Copier l'APK ─────────────────────────────────────────────────────────────
echo [5/6] Copie de l'APK...
set APK_SRC=android\app\build\outputs\apk\debug\app-debug.apk
set APK_DST=ImproVote.apk
copy /Y "!APK_SRC!" "!APK_DST!" >nul
if errorlevel 1 (echo ERREUR : APK introuvable. & pause & exit /b 1)
echo APK genere : !APK_DST!

:: ── GitHub Release ───────────────────────────────────────────────────────────
echo [6/6] Creation de la release GitHub...

:: Determiner le prochain numero de version
for /f "tokens=*" %%v in ('gh release list --limit 1 --json tagName --jq ".[0].tagName" 2^>nul') do set LAST_TAG=%%v
if "!LAST_TAG!"=="" (
  set NEW_TAG=v1.0.0
) else (
  :: Incrementer le patch (ex: v1.0.3 -> v1.0.4)
  for /f "tokens=1,2,3 delims=." %%a in ("!LAST_TAG:v=!") do (
    set /a PATCH=%%c+1
    set NEW_TAG=v%%a.%%b.!PATCH!
  )
)

set /p CONFIRM="Publier la release !NEW_TAG! sur GitHub ? (O/N) : "
if /i not "!CONFIRM!"=="O" (
  echo Release annulee. APK disponible localement : !APK_DST!
  pause & exit /b 0
)

gh release create "!NEW_TAG!" "!APK_DST!" --title "ImproVote !NEW_TAG!" --notes "Build APK - serveur : !SERVER_URL!"
if errorlevel 1 (echo ERREUR : Release GitHub echouee. & pause & exit /b 1)

echo.
echo ================================================
echo   APK publie avec succes : !NEW_TAG!
echo ================================================
pause

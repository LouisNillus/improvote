@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"

REM Config locale optionnelle (surcharge GH_APK_REPO, VITE_SERVER_URL, etc.)
if exist "build_apk.local.bat" call "build_apk.local.bat"

REM Hydrate VITE_SERVER_URL depuis .env si non defini
if exist ".env" (
  for /f "usebackq tokens=1,* delims==" %%A in (`findstr /b /c:"VITE_SERVER_URL=" ".env"`) do (
    if "%%A"=="VITE_SERVER_URL" if "%VITE_SERVER_URL%"=="" set "VITE_SERVER_URL=%%B"
  )
)

if "%VITE_SERVER_URL%"=="" (
  echo [ERREUR] VITE_SERVER_URL non configure.
  echo          Definis VITE_SERVER_URL dans un fichier .env ou build_apk.local.bat.
  echo          Exemple: VITE_SERVER_URL=https://improvote.monserveur.com
  pause
  exit /b 1
)

echo ==============================================
echo   ImproVote - Build APK + GitHub Release
echo ==============================================
echo.
echo [INFO] Serveur cible : %VITE_SERVER_URL%
echo.

where npm >nul 2>nul
if errorlevel 1 (echo [ERREUR] npm introuvable. & pause & exit /b 1)
echo [CHECK] npm OK

where gh >nul 2>nul
if errorlevel 1 (echo [ERREUR] gh introuvable. Installe GitHub CLI puis lance "gh auth login". & pause & exit /b 1)
echo [CHECK] gh OK

gh auth status >nul 2>nul
if errorlevel 1 (echo [ERREUR] gh non authentifie. Lance "gh auth login". & pause & exit /b 1)
echo [CHECK] gh auth OK

where java >nul 2>nul
if errorlevel 1 (echo [ERREUR] Java introuvable. Installe un JDK 17+. & pause & exit /b 1)
echo [CHECK] Java OK

if "%ANDROID_SDK_ROOT%"=="" set "ANDROID_SDK_ROOT=%LOCALAPPDATA%\Android\Sdk"
if "%ANDROID_HOME%"=="" set "ANDROID_HOME=%ANDROID_SDK_ROOT%"

if not exist "%ANDROID_SDK_ROOT%\cmdline-tools\latest\bin\sdkmanager.bat" (
  echo [ERREUR] Android SDK cmdline-tools introuvable:
  echo          %ANDROID_SDK_ROOT%\cmdline-tools\latest\bin\sdkmanager.bat
  pause
  exit /b 1
)
echo [CHECK] Android SDK OK

if not exist "node_modules" (
  echo [INFO] node_modules absent, installation npm...
  call npm install
  if errorlevel 1 (echo [ERREUR] Echec npm install. & pause & exit /b 1)
)

REM Installer Capacitor si absent
if not exist "node_modules\@capacitor\core" (
  echo [INFO] Installation Capacitor...
  call npm install @capacitor/core @capacitor/android @capacitor/cli --save
  if errorlevel 1 (echo [ERREUR] Echec installation Capacitor. & pause & exit /b 1)
)

echo [1/6] Build web...
call npx vite build
if errorlevel 1 (echo [ERREUR] Echec build web. & pause & exit /b 1)

if not exist "android" (
  echo [INFO] Plateforme Android absente, ajout via Capacitor...
  call npx cap add android
  if errorlevel 1 (echo [ERREUR] Echec npx cap add android. & pause & exit /b 1)
)

echo [2/6] Sync Capacitor Android...
call npx cap sync android
if errorlevel 1 (echo [ERREUR] Echec npx cap sync android. & pause & exit /b 1)

echo [3/6] Acceptation des licences SDK...
(for /l %%N in (1,1,300) do @echo y) | call "%ANDROID_SDK_ROOT%\cmdline-tools\latest\bin\sdkmanager.bat" --licenses >nul 2>nul

echo [4/6] Installation SDK requis...
call "%ANDROID_SDK_ROOT%\cmdline-tools\latest\bin\sdkmanager.bat" "platform-tools" "platforms;android-36" "build-tools;36.0.0"
if errorlevel 1 (echo [ERREUR] Echec installation composants SDK. & pause & exit /b 1)

echo [5/6] Build APK debug...
pushd android
call gradlew.bat assembleDebug
if errorlevel 1 (popd & echo [ERREUR] Echec build APK. & pause & exit /b 1)
popd

set "APK_OUTPUT_DIR=android\app\build\outputs\apk\debug"

REM Recherche exhaustive de l'APK genere
set "APK_SRC="
for /f "delims=" %%F in ('dir /b /a:-d "%APK_OUTPUT_DIR%\*.apk" 2^>nul') do (
  if not defined APK_SRC set "APK_SRC=%APK_OUTPUT_DIR%\%%F"
)
if not defined APK_SRC (
  echo [ERREUR] APK introuvable dans %APK_OUTPUT_DIR%
  pause & exit /b 1
)
echo [INFO] APK trouve : %APK_SRC%

set "APK_DIR=apk_dist"
if not exist "%APK_DIR%" mkdir "%APK_DIR%"

for /f "usebackq delims=" %%T in (`powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"`) do set "STAMP=%%T"

if "%GH_APK_REPO%"==""           set "GH_APK_REPO=LouisNillus/improvote"
if "%GH_APK_TAG%"==""            set "GH_APK_TAG=apk-download"
if "%GH_APK_TITLE%"==""          set "GH_APK_TITLE=ImproVote APK"
if "%GH_APK_ASSET_PREFIX%"==""   set "GH_APK_ASSET_PREFIX=improvote-release"

set "GH_ASSET_NAME=%GH_APK_ASSET_PREFIX%-!STAMP!.apk"
set "GH_ASSET_PATH=%CD%\%APK_DIR%\%GH_ASSET_NAME%"
copy /Y "%APK_SRC%" "%GH_ASSET_PATH%" >nul

echo [6/6] Upload GitHub Release...
gh release view "%GH_APK_TAG%" -R "%GH_APK_REPO%" >nul 2>nul
if errorlevel 1 (
  gh release create "%GH_APK_TAG%" -R "%GH_APK_REPO%" --title "%GH_APK_TITLE%" --notes "APK ImproVote - telechargement direct."
  if errorlevel 1 (echo [ERREUR] Echec creation release GitHub. & pause & exit /b 1)
)

gh release upload "%GH_APK_TAG%" "%GH_ASSET_PATH%" -R "%GH_APK_REPO%" --clobber
if errorlevel 1 (
  echo [WARN] Echec upload GitHub. APK local disponible:
  echo        %GH_ASSET_PATH%
  pause & exit /b 0
)

set "APK_URL=https://github.com/%GH_APK_REPO%/releases/download/%GH_APK_TAG%/%GH_ASSET_NAME%"

echo.
echo ==============================================
echo [OK] APK genere et uploade
echo ==============================================
echo APK local  : %GH_ASSET_PATH%
echo APK source : %APK_SRC%
echo Serveur    : %VITE_SERVER_URL%
echo URL        : %APK_URL%
echo.

pause
exit /b 0

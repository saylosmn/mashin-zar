@echo off
chcp 65001 >nul
title Mashin zar - buh alkham
echo ============================================================
echo   Машин зар: кодыг татаж, апп-ыг Expo дээр build хийнэ
echo ============================================================
echo.

where git >nul 2>nul || (echo [!] Git суулгаагүй байна: https://git-scm.com/download/win & pause & exit /b 1)
where node >nul 2>nul || (echo [!] Node.js суулгаагүй байна: https://nodejs.org & pause & exit /b 1)

cd /d "%USERPROFILE%\Documents"
if exist "mashin-zar\.git" (
  echo [1/6] Кодыг шинэчилж байна...
  cd mashin-zar
  git pull || goto :err
) else (
  echo [1/6] Кодыг GitHub-аас татаж байна... ^(GitHub нэвтрэх цонх гарвал нэвтэрнэ үү^)
  git clone https://github.com/saylosmn/mashin-zar || goto :err
  cd mashin-zar
)
cd mobile

echo.
echo [2/6] Сангуудыг суулгаж байна (хэдэн минут)...
call npm install || goto :err

echo.
echo [3/6] Expo аккаунт шалгаж байна...
call npx -y eas-cli@latest whoami >nul 2>nul
if errorlevel 1 (
  echo     Expo-д нэвтрээгүй байна. Доор и-мэйл/нууц үгээ оруулна уу ^(expo.dev аккаунт^):
  call npx -y eas-cli@latest login || goto :err
)

echo.
echo [4/6] EAS project холбож байна...
call npx -y eas-cli@latest init --non-interactive --force || goto :err
call npx -y eas-cli@latest update:configure --platform android --non-interactive

echo.
echo [5/6] APK build хийж байна (Expo сервер дээр 10-20 мин).
echo     "Generate a new Android Keystore?" гэж асуувал Enter дарна.
call npx -y eas-cli@latest build -p android --profile preview --wait || goto :err

echo.
echo [6/6] APK холбоосыг сайт руу дамжуулж байна...
for /f "usebackq delims=" %%U in (`powershell -NoProfile -Command "$j = npx -y eas-cli@latest build:list --platform android --status finished --limit 1 --json --non-interactive | Out-String | ConvertFrom-Json; $j[0].artifacts.buildUrl"`) do set APK=%%U
for /f "usebackq delims=" %%V in (`powershell -NoProfile -Command "(Get-Content app.json -Raw | ConvertFrom-Json).expo.version"`) do set VER=%%V
if "%APK%"=="" goto :err
echo     APK: %APK%
echo %APK%| clip
start "" "https://web-mu-fawn-45.vercel.app/admin/settings?apk=%APK%&v=%VER%#apk"
echo.
echo ============================================================
echo   БОЛСОН! Нээгдсэн хуудсан дээр шар хүрээтэй "Хадгалах" дарна.
echo   Ингэхэд сайтын "Апп татах" товч шинэ APK руу заана.
echo   Цаашид кодыг шинэчлэх: mobile\update.bat
echo ============================================================
pause
exit /b 0

:err
echo.
echo [X] Алдаа гарлаа. Энэ цонхны зургийг Claude-д явуулаарай.
pause
exit /b 1

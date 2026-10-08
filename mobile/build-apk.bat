@echo off
chcp 65001 >nul
echo === Машин зар: Android APK гаргах ===
cd /d %~dp0
call npm install || goto :err
echo.
echo [1/3] Expo аккаунтаар нэвтэрнэ (expo.dev дээр бүртгэлгүй бол эхлээд бүртгүүлнэ)
call npx eas-cli@latest login || goto :err
echo.
echo [2/3] EAS project холбож байна (асуулт гарвал Y дарна)
call npx eas-cli@latest init || goto :err
echo.
echo [2b] Шинэчлэл (EAS Update) тохируулж байна
call npx eas-cli@latest update:configure || goto :err
echo.
echo [3/3] APK build хийж байна (Expo-ийн сервер дээр 10-20 минут)
call npx eas-cli@latest build -p android --profile preview || goto :err
echo.
echo === Болсон! Дээрх "Application Archive URL" (.apk) холбоосыг хуулж ===
echo === сайтын Админ - Тохиргоо - "Апп татах (APK)" хэсэгт оруулна.   ===
pause
exit /b 0
:err
echo Алдаа гарлаа. Дээрх мессежийг Claude-д явуулаарай.
pause
exit /b 1

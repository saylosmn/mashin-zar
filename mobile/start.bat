@echo off
chcp 65001 >nul
echo === Машин зар: Expo Go дээр турших ===
cd /d %~dp0
git pull
call npm install || goto :err
call npx expo start --tunnel --clear
exit /b 0
:err
echo Алдаа гарлаа. Дээрх мессежийг Claude-д явуулаарай.
pause
exit /b 1

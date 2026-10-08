@echo off
chcp 65001 >nul
echo === Машин зар: суулгасан аппыг шинэчлэх (EAS Update) ===
echo APK дахин суулгах шаардлагагүй - апп дараа нээгдэхдээ шинэ кодоо татна.
cd /d %~dp0
git pull
call npm install || goto :err
call npx eas-cli@latest update --channel preview --message "Shinechlel" --non-interactive || goto :err
echo.
echo === Болсон! Утсан дээрх аппыг хаагаад 2 удаа дахин нээвэл шинэ хувилбар орно. ===
pause
exit /b 0
:err
echo Алдаа гарлаа. Дээрх мессежийг Claude-д явуулаарай.
pause
exit /b 1

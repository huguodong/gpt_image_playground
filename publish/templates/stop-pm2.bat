@echo off
setlocal
cd /d "%~dp0"

pm2 delete gpt-image-async >nul 2>&1
pm2 save >nul 2>&1
pm2 status
exit /b 0

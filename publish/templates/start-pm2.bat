@echo off
setlocal
cd /d "%~dp0"

pm2 start ecosystem.config.cjs --update-env
if errorlevel 1 (
  echo Failed to start pm2 app.
  exit /b 1
)

pm2 save
pm2 status gpt-image-async
exit /b 0

@echo off
setlocal
cd /d "%~dp0"

node --check server\async-responses-service.mjs
if errorlevel 1 (
  echo Syntax check failed.
  exit /b 1
)

echo Async service syntax is valid.
node -e "const fs=require('fs'); console.log(fs.existsSync('node_modules') ? 'node_modules present' : 'node_modules missing');"
exit /b 0

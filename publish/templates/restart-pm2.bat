@echo off
setlocal
cd /d "%~dp0"

call "%~dp0stop-pm2.bat"
if errorlevel 1 exit /b 1

call "%~dp0start-pm2.bat"
exit /b %errorlevel%

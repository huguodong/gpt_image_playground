@echo off
setlocal

set "ROOT_DIR=%~dp0"
for %%I in ("%ROOT_DIR%") do set "ROOT_DIR=%%~fI"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"

cd /d "%ROOT_DIR%"

if "%ASYNC_JOB_SECRET%"=="" set "ASYNC_JOB_SECRET=local-dev-job-secret"
if "%ASYNC_DB_PATH%"=="" set "ASYNC_DB_PATH=%ROOT_DIR%\response-image-jobs.sqlite"

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm not found in PATH.
  exit /b 1
)

echo [INFO] Project root: %ROOT_DIR%
echo [INFO] Starting async service and frontend dev server...
echo.

if not exist "%ROOT_DIR%\logs" mkdir "%ROOT_DIR%\logs"
if not exist "%ROOT_DIR%\logs\async-service.out.log" powershell -NoProfile -Command "[System.IO.File]::WriteAllBytes('%ROOT_DIR%\\logs\\async-service.out.log',[byte[]](239,187,191))"
if not exist "%ROOT_DIR%\logs\async-service.err.log" powershell -NoProfile -Command "[System.IO.File]::WriteAllBytes('%ROOT_DIR%\\logs\\async-service.err.log',[byte[]](239,187,191))"
echo [%date% %time%] async service start>> "%ROOT_DIR%\logs\async-service.out.log"

echo [1/2] Starting async service...
start "gpt-image-async" /D "%ROOT_DIR%" cmd /k "set ASYNC_JOB_SECRET=%ASYNC_JOB_SECRET% && set ASYNC_DB_PATH=%ASYNC_DB_PATH% && npm run serve:async-responses 1>>logs\async-service.out.log 2>>logs\async-service.err.log"

echo [2/2] Starting frontend dev server...
start "gpt-image-web" /D "%ROOT_DIR%" cmd /k "npm run dev -- --host 127.0.0.1 --port 4173 --strictPort"

echo.
echo [DONE] Startup commands sent.
echo [INFO] Async logs:
echo   %ROOT_DIR%\logs\async-service.out.log
echo   %ROOT_DIR%\logs\async-service.err.log
exit /b 0

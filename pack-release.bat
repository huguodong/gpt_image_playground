@echo off
setlocal enabledelayedexpansion

set "ROOT_DIR=%~dp0"
for %%I in ("%ROOT_DIR%") do set "ROOT_DIR=%%~fI"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"

set "PUBLISH_DIR=%ROOT_DIR%\publish"
set "RELEASE_DIR=%PUBLISH_DIR%\release"
set "ASYNC_DIR=%RELEASE_DIR%\async-service"
set "WEB_DIR=%RELEASE_DIR%\web"
set "NGINX_DIR=%RELEASE_DIR%\nginx"
set "TEMPLATE_DIR=%PUBLISH_DIR%\templates"
set "LOCAL_TEMPLATE_DIR=%PUBLISH_DIR%\local-templates"
set "CLOUD_NGINX_TEMPLATE=%LOCAL_TEMPLATE_DIR%\cloud-server-image.52moyu.net.conf"

if not exist "%CLOUD_NGINX_TEMPLATE%" (
  set "CLOUD_NGINX_TEMPLATE=%TEMPLATE_DIR%\cloud-server-image.52moyu.net.example.conf"
)

echo [1/5] Building frontend...
pushd "%ROOT_DIR%"
call npm run build
if errorlevel 1 (
  echo Build failed.
  popd
  exit /b 1
)
popd

echo [2/5] Preparing release folder...
if exist "%RELEASE_DIR%" rmdir /s /q "%RELEASE_DIR%"
mkdir "%RELEASE_DIR%"
mkdir "%ASYNC_DIR%"
mkdir "%WEB_DIR%"
mkdir "%NGINX_DIR%"
mkdir "%ASYNC_DIR%\server"

echo [3/5] Copying frontend assets...
robocopy "%ROOT_DIR%\dist" "%WEB_DIR%\dist" /E >nul
if errorlevel 8 (
  echo Failed to copy frontend dist.
  exit /b 1
)

echo [4/5] Copying async service files...
copy /y "%ROOT_DIR%\server\async-responses-service.mjs" "%ASYNC_DIR%\server\async-responses-service.mjs" >nul
copy /y "%TEMPLATE_DIR%\async-service-package.json" "%ASYNC_DIR%\package.json" >nul
copy /y "%TEMPLATE_DIR%\ecosystem.config.cjs" "%ASYNC_DIR%\ecosystem.config.cjs" >nul
copy /y "%TEMPLATE_DIR%\start-pm2.bat" "%ASYNC_DIR%\start-pm2.bat" >nul
copy /y "%TEMPLATE_DIR%\stop-pm2.bat" "%ASYNC_DIR%\stop-pm2.bat" >nul
copy /y "%TEMPLATE_DIR%\restart-pm2.bat" "%ASYNC_DIR%\restart-pm2.bat" >nul
copy /y "%TEMPLATE_DIR%\run-once-check.bat" "%ASYNC_DIR%\run-once-check.bat" >nul
copy /y "%TEMPLATE_DIR%\README.txt" "%ASYNC_DIR%\README.txt" >nul
copy /y "%TEMPLATE_DIR%\19-server-8333.conf" "%NGINX_DIR%\19-server-8333.conf" >nul
copy /y "%CLOUD_NGINX_TEMPLATE%" "%NGINX_DIR%\cloud-server-image.52moyu.net.conf" >nul

echo [5/5] Installing runtime dependencies into async-service...
pushd "%ASYNC_DIR%"
call npm install --omit=dev
if errorlevel 1 (
  echo Runtime dependency install failed.
  popd
  exit /b 1
)
popd

echo.
echo Release package is ready:
echo   %RELEASE_DIR%
echo.
echo Web files:
echo   %WEB_DIR%\dist
echo Async service files:
echo   %ASYNC_DIR%
echo Nginx config samples:
echo   %NGINX_DIR%
exit /b 0

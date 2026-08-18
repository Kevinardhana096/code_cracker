@echo off
if "%CODE_CRACKER_ADMIN_PASSWORD%"=="" (
  echo ERROR: Set CODE_CRACKER_ADMIN_PASSWORD minimal 12 karakter.
  exit /b 1
)
if "%CODE_CRACKER_VERIFICATION_SECRET%"=="" (
  echo ERROR: Set CODE_CRACKER_VERIFICATION_SECRET minimal 32 karakter.
  exit /b 1
)
cd /d "%~dp0"

if not exist node_modules (
    echo [Setup] Installing dependencies...
    call npm install
    echo.
)

echo [Start] Launching Code Cracker server...
node src\index.js
pause

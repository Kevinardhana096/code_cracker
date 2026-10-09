@echo off
cd /d "%~dp0"

if not exist node_modules (
    echo [Setup] Installing dependencies...
    call npm install
    echo.
)

echo [Start] Launching Code Cracker server...
node src\index.js
pause

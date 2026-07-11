@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo      Texas Poker Friends Server
echo ========================================
echo.

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js ^>= 18
    echo Download: https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo [OK] Node.js %NODE_VER%

REM Install dependencies
if not exist node_modules (
    echo [..] Installing dependencies...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] npm install failed
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed
)

REM Kill old server
for /f "tokens=2 delims=," %%a in ('tasklist /fi "imagename eq node.exe" /fo csv /nh 2^>nul') do (
    taskkill /f /pid %%a >nul 2>nul
)
if %ERRORLEVEL% equ 0 echo [OK] Stopped old server

REM Start server and open browser
echo [OK] Starting server on http://localhost:3009
start http://localhost:3009
node server/index.js

pause

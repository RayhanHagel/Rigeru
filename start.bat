@echo off
setlocal

set BASE_DIR=%~dp0
set FRONTEND_DIR=%BASE_DIR%frontend
set VENV_DIR=%BASE_DIR%.venv
set SCRAPER_DIR=%BASE_DIR%utilities\playwright_scraper

:: 1. Setup Python venv
if not exist "%VENV_DIR%" (
    echo [SETUP] Virtual environment not found. Creating '.venv'
    python -m venv "%VENV_DIR%"
    echo [SETUP] Installing Python dependencies
    "%VENV_DIR%\Scripts\pip.exe" install -r "%BASE_DIR%requirements.txt"
    echo [SETUP] Python dependencies installed successfully.
)

:: 2. Setup Node modules
if not exist "%FRONTEND_DIR%\node_modules" (
    echo [SETUP] Node modules not found. Installing frontend dependencies
    cd /d "%FRONTEND_DIR%"
    call npm install
    echo [SETUP] Node dependencies installed successfully.
)

:: 3. Setup Node modules for Playwright Scraper
if exist "%SCRAPER_DIR%" (
    if not exist "%SCRAPER_DIR%\node_modules" (
        echo [SETUP] Playwright scraper modules not found. Installing
        cd /d "%SCRAPER_DIR%"
        call npm install
        call npx playwright install
        echo [SETUP] Playwright scraper dependencies installed successfully.
    )
)

echo.
:: Kill any existing process on port 8000 (Backend)
echo [CLEANUP] Checking for existing processes on port 8000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
    echo [CLEANUP] Killing PID %%a listening on port 8000
    taskkill /F /PID %%a >nul 2>&1
)

:: Kill any existing process on port 3000 or 3001 (Frontend)
echo [CLEANUP] Checking for existing processes on ports 3000 and 3001
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo [CLEANUP] Killing PID %%a listening on port 3000
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    echo [CLEANUP] Killing PID %%a listening on port 3001
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo [START] Starting Next.js Frontend and FastAPI Backend in SEPARATE terminals
echo You can manage them in their respective windows.
echo.

:: Start FastAPI Backend in a NEW window
start "FastAPI Backend" cmd /k "cd /d "%BASE_DIR%" && "%VENV_DIR%\Scripts\python.exe" -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir backend --reload-dir utilities"

:: Start Next.js Frontend in a NEW window
start "Next.js Frontend" cmd /k "cd /d "%FRONTEND_DIR%" && set NODE_OPTIONS=--max-old-space-size=8192 && npm run dev -- -H 0.0.0.0"

echo [DONE] Both scripts have been launched in their own terminal windows.
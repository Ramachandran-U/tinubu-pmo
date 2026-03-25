@echo off
title Tinubu PMO v2 (Redesign) - ports 3005/5174
echo ============================================
echo   Tinubu PMO v2 (Redesign Version)
echo   Backend: http://localhost:3005
echo   Frontend: http://localhost:5174
echo ============================================
echo.

cd /d "%~dp0"

echo Switching to v2-redesign branch...
git checkout v2-redesign

echo.
echo Starting servers...
echo.

start "PMO v2 - Backend" cmd /k "cd /d "%~dp0" && set DATABASE_URL=postgresql://tinubu:tinubu_secret@localhost:5433/tinubu_pmo && set PORT=3005 && node server/index.js"

timeout /t 3 /nobreak >nul

start "PMO v2 - Frontend" cmd /k "cd /d "%~dp0\client" && npx vite --host --port 5174"

timeout /t 5 /nobreak >nul

echo.
echo ============================================
echo   v2 is starting up!
echo   Open http://localhost:5174 in your browser
echo ============================================
echo.
echo Press any key to open in browser...
pause >nul
start http://localhost:5174

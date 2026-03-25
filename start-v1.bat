@echo off
title Tinubu PMO v1 (Current) - ports 3004/5173
echo ============================================
echo   Tinubu PMO v1 (Current Version)
echo   Backend: http://localhost:3004
echo   Frontend: http://localhost:5173
echo ============================================
echo.

cd /d "%~dp0"

echo Switching to master branch...
git checkout master

echo.
echo Starting servers...
echo.

set DATABASE_URL=postgresql://tinubu:tinubu_secret@localhost:5433/tinubu_pmo
set PORT=3004

start "PMO v1 - Backend" cmd /k "cd /d "%~dp0" && set DATABASE_URL=postgresql://tinubu:tinubu_secret@localhost:5433/tinubu_pmo && set PORT=3004 && node server/index.js"

timeout /t 3 /nobreak >nul

start "PMO v1 - Frontend" cmd /k "cd /d "%~dp0\client" && npx vite --host --port 5173"

timeout /t 5 /nobreak >nul

echo.
echo ============================================
echo   v1 is starting up!
echo   Open http://localhost:5173 in your browser
echo ============================================
echo.
echo Press any key to open in browser...
pause >nul
start http://localhost:5173

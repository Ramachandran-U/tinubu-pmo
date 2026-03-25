@echo off
title Tinubu PMO - Both Versions Side by Side
echo ============================================
echo   Tinubu PMO - Side by Side Demo
echo   v1 (Current):  http://localhost:5173
echo   v2 (Redesign): http://localhost:5174
echo ============================================
echo.
echo NOTE: This requires two separate copies of the repo
echo       or git worktree. Starting both from the same
echo       directory will cause branch conflicts.
echo.
echo RECOMMENDED: Use git worktree for the second version:
echo.
echo   cd tinubu-pmo
echo   git worktree add ../tinubu-pmo-v2 v2-redesign
echo.
echo Then run start-v1.bat from tinubu-pmo/
echo  and start-v2.bat from tinubu-pmo-v2/
echo.
echo ============================================
echo.

cd /d "%~dp0"

echo Setting up git worktree for v2...
if not exist "..\tinubu-pmo-v2" (
    git worktree add ..\tinubu-pmo-v2 v2-redesign
    echo Installing dependencies in worktree...
    cd /d "%~dp0\..\tinubu-pmo-v2"
    call npm install
    cd client && call npm install && cd ..
    cd /d "%~dp0"
    echo Worktree ready.
) else (
    echo Worktree already exists at ..\tinubu-pmo-v2
)

echo.
echo Starting v1 (Current - master)...
start "PMO v1 - Backend" cmd /k "cd /d "%~dp0" && set DATABASE_URL=postgresql://tinubu:tinubu_secret@localhost:5433/tinubu_pmo && set PORT=3004 && node server/index.js"
timeout /t 2 /nobreak >nul
start "PMO v1 - Frontend" cmd /k "cd /d "%~dp0\client" && npx vite --host --port 5173"

echo Starting v2 (Redesign - v2-redesign)...
start "PMO v2 - Backend" cmd /k "cd /d "%~dp0\..\tinubu-pmo-v2" && set DATABASE_URL=postgresql://tinubu:tinubu_secret@localhost:5433/tinubu_pmo && set PORT=3005 && node server/index.js"
timeout /t 2 /nobreak >nul
start "PMO v2 - Frontend" cmd /k "cd /d "%~dp0\..\tinubu-pmo-v2\client" && npx vite --host --port 5174"

timeout /t 5 /nobreak >nul

echo.
echo ============================================
echo   Both versions starting!
echo   v1: http://localhost:5173
echo   v2: http://localhost:5174
echo ============================================
echo.
echo Press any key to open both in browser...
pause >nul
start http://localhost:5173
start http://localhost:5174

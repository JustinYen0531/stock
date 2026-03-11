@echo off
setlocal

cd /d "%~dp0"
title StockAI Dev Server

echo ====================================
echo   StockAI Dev Server
echo ====================================
echo.

where node >nul 2>&1
if errorlevel 1 goto :missing_node

where npm >nul 2>&1
if errorlevel 1 goto :missing_npm

if not exist "backend\package.json" goto :missing_backend

if not exist "backend\node_modules" (
  echo Installing backend dependencies...
  call npm --prefix backend install
  if errorlevel 1 goto :install_failed
  echo.
)

echo Starting server on http://localhost:8000
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:8000"
call npm --prefix backend run dev
goto :end

:missing_node
echo Node.js was not found in PATH.
echo Install Node.js, then run this file again.
goto :pause_and_exit

:missing_npm
echo npm was not found in PATH.
echo Reinstall Node.js or fix PATH, then run this file again.
goto :pause_and_exit

:missing_backend
echo backend\package.json was not found.
echo Make sure this file stays in the project root.
goto :pause_and_exit

:install_failed
echo Backend dependency installation failed.
goto :pause_and_exit

:pause_and_exit
echo.
pause
exit /b 1

:end
echo.
pause

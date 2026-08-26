@echo off
cd /d "%~dp0"
echo Building BuildCore Construction PM...
echo.
if not exist node_modules (
  echo Installing dependencies first...
  call npm.cmd install --cache .npm-cache
  if errorlevel 1 goto failed
)
call npm.cmd run build
if errorlevel 1 goto failed
echo.
echo Production build is ready in:
echo %~dp0dist
echo.
pause
exit /b 0

:failed
echo.
echo Build failed. Keep this window open and send the error text.
pause
exit /b 1

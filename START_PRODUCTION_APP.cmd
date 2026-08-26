@echo off
cd /d "%~dp0"
echo Starting production preview...
echo.
if not exist dist (
  echo Production build not found. Building first...
  call npm.cmd run build
  if errorlevel 1 goto failed
)
echo Open this address in your browser:
echo http://127.0.0.1:4174
echo.
call npm.cmd run preview:local
pause
exit /b 0

:failed
echo.
echo Could not start production preview. Keep this window open and send the error text.
pause
exit /b 1

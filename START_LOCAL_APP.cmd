@echo off
cd /d "%~dp0"
echo Starting BuildCore Construction PM...
echo.
if not exist node_modules (
  echo Installing dependencies first...
  call npm.cmd install --cache .npm-cache
)
echo.
echo Open this address in your browser:
echo http://127.0.0.1:5174
echo.
call npm.cmd run dev:local
pause

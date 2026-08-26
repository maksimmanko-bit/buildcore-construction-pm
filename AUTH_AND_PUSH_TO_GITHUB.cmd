@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0AUTH_AND_PUSH_TO_GITHUB.ps1"
pause

@echo off
cd /d "%~dp0"
echo Pushing BuildCore Construction PM to GitHub...
echo Repository: https://github.com/maksimmanko-bit/buildcore-construction-pm
echo.
git remote remove origin 2>nul
git remote add origin https://github.com/maksimmanko-bit/buildcore-construction-pm.git
git branch -M main
git push -u origin main
if errorlevel 1 goto failed
echo.
echo Done. Open:
echo https://github.com/maksimmanko-bit/buildcore-construction-pm
pause
exit /b 0

:failed
echo.
echo Push failed. If GitHub login window opened, finish login and run this file again.
echo If no login window opened, open Git Bash in this folder and run:
echo git push -u origin main
pause
exit /b 1

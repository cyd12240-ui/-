@echo off
cd /d "%~dp0"
echo Pushing to GitHub...
git push -u origin main
pause

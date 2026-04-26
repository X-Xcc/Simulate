@echo off
chcp 65001 >nul
echo.
echo === Push to GitHub ===
echo.

cd /d "%~dp0"

git add -A
git status --short
if errorlevel 1 (
    echo [ERROR] git add failed
    pause
    exit /b 1
)

echo.
git commit -m "update project"
if errorlevel 1 (
    echo [WARN] No changes to commit
)

echo.
git push origin main
if errorlevel 1 (
    echo [ERROR] Push failed
    pause
    exit /b 1
)

echo.
echo [OK] Pushed to GitHub
pause

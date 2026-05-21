@echo off
echo Starting YOLOv8 Security System...

start "Backend" cmd /k "cd /d %~dp0server && mvn spring-boot:run"
start "Frontend" cmd /k "cd /d %~dp0web && npm run dev"

echo.
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:5173
echo.
pause

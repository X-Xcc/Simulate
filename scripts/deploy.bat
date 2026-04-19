@echo off
chcp 65001 >nul
echo ==========================================
echo   YOLOv8 Security Monitor - Docker Deploy
echo ==========================================

:: Check if Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    echo Error: Docker is not installed. Please install Docker Desktop first.
    pause
    exit /b 1
)

:: Create necessary directories
echo Creating directories...
if not exist "data" mkdir data
if not exist "videos" mkdir videos
if not exist "models" mkdir models
if not exist "results" mkdir results

:: Download YOLOv8 model if not exists
if not exist "models\yolov8n.pt" (
    echo Downloading YOLOv8 model...
    curl -L -o models\yolov8n.pt https://github.com/ultralytics/assets/releases/download/v8.1.0/yolov8n.pt
    if errorlevel 1 (
        echo Warning: Failed to download model. Please download manually from:
        echo https://github.com/ultralytics/assets/releases/download/v8.1.0/yolov8n.pt
    )
)

:: Build and start
echo Building Docker image...
docker-compose build

echo Starting services...
docker-compose up -d

echo.
echo ==========================================
echo   Deployment Complete!
echo ==========================================
echo.
echo Access the application at: http://localhost:5000
echo.
echo Useful commands:
echo   View logs:    docker-compose logs -f
echo   Stop:         docker-compose down
echo   Restart:      docker-compose restart
echo   Status:       docker-compose ps
echo.
pause

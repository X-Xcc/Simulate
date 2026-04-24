@echo off
chcp 65001 > /dev/null
echo ========================================
echo YOLOv8 Security Monitor - Build WAR Package
echo ========================================
echo.

REM Change to backend directory where pom.xml lives
cd /d "%~dp0..\backend"

echo [1/3] Cleaning old build files...
call mvn clean
if %errorlevel% neq 0 (
    echo Cleanup failed!
    pause
    exit /b 1
)
echo Cleanup completed.
echo.

echo [2/3] Compiling project...
call mvn compile
if %errorlevel% neq 0 (
    echo Compilation failed!
    pause
    exit /b 1
)
echo Compilation completed.
echo.

echo [3/3] Packaging to WAR file...
call mvn package -DskipTests
if %errorlevel% neq 0 (
    echo Packaging failed!
    pause
    exit /b 1
)
echo Packaging completed.
echo.

echo ========================================
echo Build successful!
echo WAR file location: target\yolov8-security.war
echo ========================================
echo.

echo Deployment instructions:
echo 1. Copy target\yolov8-security.war to Tomcat's webapps directory
echo 2. Start Tomcat
echo 3. Access http://localhost:8080/yolov8-security/
echo.

pause

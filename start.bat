@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set "BASE_DIR=%~dp0"
set "BACKEND_DIR=%BASE_DIR%backend"
set "JAVA_CMD="

echo ==========================================
echo   YOLOv8 Security System - Start Script
echo ==========================================
echo.

java -version >nul 2>&1
if %errorlevel% equ 0 (
    echo Found system Java
    set "JAVA_CMD=java"
    goto start_backend
)

for /d %%i in ("%BASE_DIR%jdk-18*") do (
    if exist "%%i\bin\java.exe" (
        echo Found JDK: %%i
        set "JAVA_CMD=%%i\bin\java.exe"
        goto start_backend
    )
)

echo Java not found!
echo Please install JDK 18 first.
pause
exit /b 1

:start_backend
echo.
echo ==========================================
echo   Starting Spring Boot Backend...
echo ==========================================
echo.

echo BASE_DIR: %BASE_DIR%
echo BACKEND_DIR: %BACKEND_DIR%
echo JAVA_CMD: %JAVA_CMD%
echo.

if not exist "%BACKEND_DIR%\target\yolov8-security.war" (
    echo ERROR: WAR file not found!
    echo Looking for: %BACKEND_DIR%\target\yolov8-security.war
    pause
    exit /b 1
)

"%JAVA_CMD%" -jar "%BACKEND_DIR%\target\yolov8-security.war"

echo.
echo Service stopped. Press any key to exit...
pause >nul
endlocal

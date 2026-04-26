@echo off
chcp 65001 >nul
title YOLOv8 Security System

:: Get absolute project root
set PROJECT_ROOT=%~dp0
if "%PROJECT_ROOT:~-1%=="% set PROJECT_ROOT=%PROJECT_ROOT:~0,-1%
set BACKEND_DIR=%PROJECT_ROOT%\backend

echo.
echo ========================================
echo   YOLOv8 Security System - Startup
echo ========================================
echo   Project: %PROJECT_ROOT%
echo.

:: ---- Check Java ----
where java >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Java not found! Install JDK 17+
    pause
    exit /b 1
)
echo [OK] Java

:: ---- Check Python ----
set PYTHON_EXE=python
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] Python not in PATH, checking .venv...
    if exist "%PROJECT_ROOT%\.venv\Scripts\python.exe" (
        set PYTHON_EXE=%PROJECT_ROOT%\.venv\Scripts\python.exe
    ) else (
        echo [ERROR] Python not found! Install Python 3.10+
        pause
        exit /b 1
    )
)
echo [OK] Python

:: ---- Check Maven ----
if exist "%PROJECT_ROOT%\mvnw.bat" (
    set MAVEN_CMD=%PROJECT_ROOT%\mvnw.bat
    echo [OK] Maven wrapper
) else (
    where mvn >nul 2>&1
    if %errorlevel% equ 0 (
        set MAVEN_CMD=mvn
        echo [OK] Maven (PATH)
    ) else (
        echo [ERROR] Maven not found!
        echo    Install: winget install Apache.Maven
        pause
        exit /b 1
    )
)

echo.
echo ========================================
echo   Step 1: Python deps
echo ========================================
cd /d "%PROJECT_ROOT%"
call %PYTHON_EXE% -m pip install -r requirements.txt -q 2>&1
if %errorlevel% neq 0 (
    echo [WARN] pip install had issues
)
echo [DONE]

echo.
echo ========================================
echo   Step 2: Build backend
echo ========================================
cd /d "%BACKEND_DIR%"
call "%MAVEN_CMD%" clean package -DskipTests -q 2>nul
if %errorlevel% neq 0 (
    echo [WARN] Build verbose output:
    call "%MAVEN_CMD%" clean package -DskipTests
)
if %errorlevel% neq 0 (
    echo [ERROR] Build failed!
    cd /d "%PROJECT_ROOT%"
    pause
    exit /b 1
)
echo [DONE]

:: Create data dir if missing
if not exist "%BACKEND_DIR%\data" mkdir "%BACKEND_DIR%\data"

echo.
echo ========================================
echo   Step 3: Start services
echo ========================================
echo.

:: 1. Spring Boot backend
echo [START] Backend (http://localhost:8080)
start "YOLOv8 Backend" cmd /k "cd /d "%BACKEND_DIR%" && java -jar target\yolov8-security.war"

echo [WAIT] 10s for backend...
timeout /t 10 /nobreak >nul

:: 2. YOLOv8 detection script
echo [START] Detection script
start "YOLOv8 Detection" cmd /k "cd /d "%PROJECT_ROOT%" && %PYTHON_EXE% ai-models\yolov8_security.py"

timeout /t 5 /nobreak >nul

:: 3. Qwen VL service (optional)
echo [START] Qwen VL (http://localhost:5001)
start "Qwen VL" cmd /k "cd /d "%PROJECT_ROOT%" && %PYTHON_EXE% ai-models\qwen_vl_service.py"

echo.
echo ========================================
echo   All services started!
echo ========================================
echo.
echo   Backend:   http://localhost:8080
echo   Qwen VL:   http://localhost:5001
echo   Detection: check "YOLOv8 Detection" window
echo.
echo   Stop: close windows or Ctrl+C in each
echo.
echo   Press any key to open browser...
pause >nul
start http://localhost:8080
pause

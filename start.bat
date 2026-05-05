@echo off
chcp 936 >nul 2>&1
setlocal enabledelayedexpansion

set "BASE_DIR=%~dp0"
if "%BASE_DIR:~-1%"=="\" set "BASE_DIR=%BASE_DIR:~0,-1%"
set "BACKEND_DIR=%BASE_DIR%\backend"
set "AI_DIR=%BASE_DIR%\ai-models"
set "MODEL_DIR=%BASE_DIR%\models"
set "DATA_DIR=%BACKEND_DIR%\data"
set "VENV_DIR=%BASE_DIR%\.venv"

echo.
echo  ===========================================
echo    YOLOv8 Security System - One Click Start
echo  ===========================================
echo.

:: ==========================================
:: 1. Check prerequisites
:: ==========================================
echo [1/6] Checking environment...

set "JAVA_CMD="

if exist "%BASE_DIR%\jdk-18.0.2.1+1\bin\java.exe" (
    set "JAVA_CMD=%BASE_DIR%\jdk-18.0.2.1+1\bin\java.exe"
    echo    Java: bundled JDK OK
    goto :check_venv
)

for /f "delims=" %%i in ('dir /b /ad "%BASE_DIR%" 2^>nul ^| findstr /i "^jdk"') do (
    if exist "%BASE_DIR%%%i\bin\java.exe" (
        set "JAVA_CMD=%BASE_DIR%\%%i\bin\java.exe"
        echo    Java: bundled JDK OK
        goto :check_venv
    )
)

where java >nul 2>&1
if %errorlevel% equ 0 (
    java -version >nul 2>&1
    if !errorlevel! equ 0 (
        set "JAVA_CMD=java"
        echo    Java: system java OK
        goto :check_venv
    )
)

echo [ERROR] Java not found!
echo    Install JDK 18 or ensure jdk-18 folder exists in project root.
pause
exit /b 1

:check_venv
if not exist "%VENV_DIR%\Scripts\python.exe" (
    echo [ERROR] venv not found: %VENV_DIR%
    echo    Run: python -m venv "%VENV_DIR%"
    pause
    exit /b 1
)
echo    Python: venv OK

if not exist "%MODEL_DIR%\yolov8n-pose.pt" (
    echo [ERROR] Model not found: models\yolov8n-pose.pt
    pause
    exit /b 1
)
echo    Model: OK

:: ==========================================
:: 2. Auto-create .env if missing
:: ==========================================
echo.
echo [2/6] Checking config...
if not exist "%BASE_DIR%\.env" (
    if exist "%BASE_DIR%\.env.example" (
        copy "%BASE_DIR%\.env.example" "%BASE_DIR%\.env" >nul
        echo    Created .env from .env.example
    ) else (
        echo API_KEY=default-dev-token> "%BASE_DIR%\.env"
        echo    Created .env with default token
    )
) else (
    echo    .env: OK
)

:: ==========================================
:: 3. Ensure data directory exists
:: ==========================================
if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"

:: ==========================================
:: Load credential variables from .env
:: ==========================================
for /f "usebackq tokens=1,* delims==" %%a in ("%BASE_DIR%\.env") do (
    set "line=%%a"
    if not "!line:~0,1!"=="#" (
        if "%%a"=="ADMIN_USERNAME" set "ADMIN_USERNAME=%%b"
        if "%%a"=="ADMIN_PASSWORD" set "ADMIN_PASSWORD=%%b"
        if "%%a"=="JWT_SECRET" set "JWT_SECRET=%%b"
    )
)

:: ==========================================
:: 3. Kill old processes (before build to unlock WAR)
:: ==========================================
echo.
echo [3/6] Stopping old processes...
taskkill /F /IM java.exe >nul 2>&1
taskkill /F /IM python.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo    Done.

:: ==========================================
:: 4. Build WAR
:: ==========================================
echo.
echo [4/6] Building backend with Maven...
set "MAVEN_JAR=%BASE_DIR%\.mvn\wrapper\maven-wrapper.jar"
if not exist "%MAVEN_JAR%" set "MAVEN_JAR=%BASE_DIR%\maven-wrapper\maven-wrapper.jar"
"%JAVA_CMD%" "-Dmaven.multiModuleProjectDirectory=%BASE_DIR%" -classpath "%MAVEN_JAR%" org.apache.maven.wrapper.MavenWrapperMain -f backend\pom.xml clean package -DskipTests
if %errorlevel% neq 0 (
    echo [ERROR] Maven build failed!
    pause
    exit /b 1
)
echo    Build complete.

:: ==========================================
:: 5. Start Spring Boot backend
:: ==========================================
echo.
echo [5/6] Starting Spring Boot backend (port 5000)...
set "WAR_PATH=%BACKEND_DIR%\target\yolov8-security.war"
start "YOLOv8-Backend" /MIN "%JAVA_CMD%" -jar "%WAR_PATH%"

:: Wait for backend ready
echo.
echo    Waiting for backend...
set RETRY=0

:wait_loop
timeout /t 2 /nobreak >nul
set /a RETRY+=1
if !RETRY! gtr 30 (
    echo    Backend taking too long, continuing...
    goto :start_python
)
curl -s -o nul -w "%%{http_code}" http://127.0.0.1:5000/yolov8-security/ 2>nul | findstr "200 302" >nul
if !errorlevel! neq 0 (
    echo    Waiting... [!RETRY!/30]
    goto :wait_loop
)
echo    Backend ready!

:: ==========================================
:: 6. Start Python detection
:: ==========================================
:start_python
echo.
echo [6/6] Starting Python AI detection...
set "PY_EXE=%VENV_DIR%\Scripts\python.exe"
start "YOLOv8-Detection" /MIN cmd /c "cd /d "%AI_DIR%" && "%PY_EXE%" yolov8_security.py"

:: ==========================================
:: Done
:: ==========================================
echo.
echo  ===========================================
echo    All services started!
echo.
echo    Backend:   http://127.0.0.1:5000/yolov8-security
echo    Detection: running in background
echo  ===========================================
echo.
echo    Opening browser in 3 seconds...
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:5000/yolov8-security"

echo.
echo    Press any key to stop all services...
pause >nul

:: Cleanup on exit
echo.
echo    Stopping services...
taskkill /F /FI "WINDOWTITLE eq YOLOv8-Backend*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq YOLOv8-Detection*" >nul 2>&1
taskkill /F /IM java.exe >nul 2>&1
taskkill /F /IM python.exe >nul 2>&1
echo    Done.
endlocal

@echo off
setlocal enabledelayedexpansion

set PROJECT_ROOT=%~dp0
cd /d "%PROJECT_ROOT%"

:: ============================================================
::   YOLOv8 Security - One-Click Start
:: ============================================================
:: Usage:
::   start.bat              Start all 3 components
::   start.bat --no-python   Skip Python detection
::   start.bat --no-frontend Skip frontend dev server
::   start.bat --prod        Production mode (built frontend, no Vite)
:: ============================================================

set SKIP_PYTHON=0
set SKIP_FRONTEND=0
set PROD_MODE=0

:parse_args
if "%~1"=="" goto :check_prereqs
if /i "%~1"=="--no-python"  set SKIP_PYTHON=1
if /i "%~1"=="--no-detection" set SKIP_PYTHON=1
if /i "%~1"=="--no-frontend" set SKIP_FRONTEND=1
if /i "%~1"=="--prod"       set PROD_MODE=1
shift
goto :parse_args

:check_prereqs
echo.
echo   ========================================
echo     YOLOv8 Security System
echo   ========================================
echo.

:: --- Java ---
echo   [1/3] Java...
set JAVA_OK=0
for %%e in ("%JAVA_HOME%") do if exist "%%~e\bin\java.exe" set JAVA_OK=1
if !JAVA_OK!==0 (
    :: Try built-in JDK
    if exist "%PROJECT_ROOT%server\jdk-18.0.2.1+1\bin\java.exe" (
        set JAVA_HOME=%PROJECT_ROOT%server\jdk-18.0.2.1+1
        set JAVA_OK=1
    )
)
if !JAVA_OK!==0 (
    where java >nul 2>&1 && set JAVA_OK=1
)
if !JAVA_OK!==0 (
    echo   [FAIL] Java not found - set JAVA_HOME or add to PATH
    goto :end_error
)
echo   [OK]   Java: !JAVA_HOME!\bin\java.exe

:: --- Python ---
echo   [2/3] Python...
set PYTHON_OK=0
if exist "%PROJECT_ROOT%.venv\Scripts\python.exe" (
    set PYTHON_EXE=%PROJECT_ROOT%.venv\Scripts\python.exe
    set PYTHON_OK=1
) else (
    where python >nul 2>&1 && set PYTHON_EXE=python && set PYTHON_OK=1
)
if !PYTHON_OK!==0 (
    echo   [WARN] Python not found - detection module will be skipped
    set SKIP_PYTHON=1
) else (
    echo   [OK]   Python: !PYTHON_EXE!
)

:: --- Node ---
echo   [3/3] Node...
set NODE_OK=0
where node >nul 2>&1 && set NODE_OK=1
if !NODE_OK!==0 (
    echo   [WARN] Node not found - frontend dev server will be skipped
    set SKIP_FRONTEND=1
) else (
    for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
    echo   [OK]   Node: !NODE_VER!
)

:: --- Port check ---
echo.
echo   Checking ports...
set PORT_CONFLICT=0
for %%p in (5000 5173) do (
    netstat -ano 2>nul | findstr "LISTENING" | findstr ":%%p " >nul 2>&1
    if !errorlevel!==0 (
        echo   [WARN] Port %%p is already in use
        set /a PORT_CONFLICT+=1
    )
)
if !PORT_CONFLICT! gtr 0 (
    echo.
    echo   WARNING: !PORT_CONFLICT! ports in use. Existing processes may interfere.
    choice /C YN /M "   Continue anyway?"
    if errorlevel 2 goto :end
)

:: ============================================================
::   Start Components
:: ============================================================
echo.
echo   ========================================
echo     Starting Components
echo   ========================================
echo.

:: --- Python Detection ---
if !SKIP_PYTHON!==1 (
    echo   [SKIP] Python detection module
    goto :start_backend
)

echo   [START] Python detection module...
start "Detection" cmd /k "cd /d "%PROJECT_ROOT%detection" && "!PYTHON_EXE!" yolov8_security.py"
echo   [OK]   Detection started in new window

:: --- Java Backend ---
:start_backend
echo   [START] Java backend (port 5000)...
if exist "%PROJECT_ROOT%server\mvnw" (
    start "Backend-5000" cmd /k "cd /d "%PROJECT_ROOT%server" && mvnw spring-boot:run"
) else (
    start "Backend-5000" cmd /k "cd /d "%PROJECT_ROOT%server" && mvn spring-boot:run"
)
echo   [OK]   Backend started in new window

:: --- Frontend ---
if !SKIP_FRONTEND!==1 (
    echo   [SKIP] Frontend dev server
    goto :done
)

if !PROD_MODE!==1 (
    echo   [INFO]  Production mode - frontend served by Java at port 5000
    echo   [INFO]  Run build.bat first if you haven't built yet
    goto :done
)

echo   [START] Frontend dev server (port 5173)...
if not exist "%PROJECT_ROOT%web\node_modules" (
    echo   [INFO]  node_modules not found, running npm install first...
    cd /d "%PROJECT_ROOT%web"
    call npm install
    cd /d "%PROJECT_ROOT%"
)
start "Frontend-5173" cmd /k "cd /d "%PROJECT_ROOT%web" && npm run dev"

:done
echo.
echo   ========================================
echo     All Components Started
echo   ========================================
echo.
echo     Detection  :  Python window (if not skipped)
echo     Backend    :  http://localhost:5000
if !SKIP_FRONTEND!==0 (
    if !PROD_MODE!==0 (
        echo     Frontend   :  http://localhost:5173
    )
)
echo     Login      :  http://localhost:5000  (production)
echo                  http://localhost:5173   (dev)
echo.
echo   Close individual windows to stop each component.
echo   Or run: stop.bat to kill all.
echo.
pause
goto :end

:end_error
echo.
echo   Fix prerequisites above, then re-run.
pause
:end
endlocal

@echo off

REM ===================== YOLOv8 安防监控系统快速启动脚本 =====================
REM 此脚本会启动所有必要的服务
REM 包括：Java后端服务、Qwen VL服务和YOLOv8安防监控系统

setlocal

REM Change to project root (parent of scripts/)
cd /d "%~dp0.."

echo ===================== YOLOv8 安防监控系统 =====================
echo 正在启动所有服务...
echo =============================================================

REM 1. 检查Java是否安装
java -version >/dev/null 2>&1
if %errorlevel% neq 0 (
    echo 错误：未检测到Java环境，请先安装Java 17或更高版本
    pause
    exit /b 1
)

REM 2. 检查Python是否安装
python --version >/dev/null 2>&1
if %errorlevel% neq 0 (
    echo 错误：未检测到Python环境，请先安装Python 3.8或更高版本
    pause
    exit /b 1
)

REM 3. 创建必要的目录
if not exist "data" mkdir "data"
if not exist "videos" mkdir "videos"
if not exist "results" mkdir "results"
if not exist "models" mkdir "models"

REM 4. 检查WAR包是否存在
if not exist "backend\target\yolov8-security.war" (
    echo WARN: WAR包不存在，请先执行 scripts\build_war.bat 进行打包
    echo.
)

REM 5. 启动Java后端服务（在新窗口）
echo 正在启动Java后端服务...
start "Java Backend" cmd /k "cd /d \"%cd%\backend\" && java -jar target/yolov8-security.war"

REM 6. 启动Qwen VL服务（在新窗口）
echo 正在启动Qwen VL服务...
start "Qwen VL Service" cmd /k "cd /d \"%cd%\ai-models\" && python qwen_vl_service.py"

REM 7. 等待几秒钟，确保服务启动
echo 等待服务启动...
timeout /t 10 /nobreak >/dev/null

echo 所有服务已启动完毕！
echo =
echo Java后端服务：http://localhost:5000/yolov8-security
echo Qwen VL服务：http://localhost:5001
echo YOLOv8安防监控系统：将在当前窗口启动
echo =
echo 按任意键启动YOLOv8安防监控系统...
pause >/dev/null

REM 8. 启动YOLOv8安防监控系统
echo 正在启动YOLOv8安防监控系统...
cd /d "%cd%\ai-models"
python yolov8_security.py

endlocal

@echo off

REM ===================== YOLOv8 安防监控系统快速启动脚本 =====================
REM 此脚本会启动所有必要的服务
REM 包括：Java后端服务、Qwen VL服务和YOLOv8安防监控系统

setlocal

echo ===================== YOLOv8 安防监控系统 =====================
echo 正在启动所有服务...
echo =============================================================

REM 1. 检查Java是否安装
java -version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误：未检测到Java环境，请先安装Java 8或更高版本
    pause
    exit /b 1
)

REM 2. 检查Python是否安装
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误：未检测到Python环境，请先安装Python 3.8或更高版本
    pause
    exit /b 1
)

REM 3. 创建必要的目录
if not exist "models" mkdir "models"
if not exist "videos" mkdir "videos"
if not exist "results" mkdir "results"
if not exist "data" mkdir "data"

REM 4. 启动Java后端服务（在新窗口）
echo 正在启动Java后端服务...
start "Java Backend" cmd /c "java -jar target/yolov8-security.war"

REM 5. 启动Qwen VL服务（在新窗口）
echo 正在启动Qwen VL服务...
start "Qwen VL Service" cmd /c "set QWEN_VL_MODEL_PATH=D:\AI_Project\Models && python code\qwen_vl_service.py"

REM 6. 等待几秒钟，确保服务启动
ping localhost -n 5 >nul

echo 所有服务已启动完毕！
echo =
echo Java后端服务：http://localhost:8080
if defined QWEN_VL_MODEL_PATH (
    echo Qwen VL服务：http://localhost:5001
) else (
    echo Qwen VL服务：请设置QWEN_VL_MODEL_PATH环境变量后重新启动
)
echo YOLOv8安防监控系统：将在当前窗口启动
echo =
echo 按任意键启动YOLOv8安防监控系统...
pause >nul

REM 7. 启动YOLOv8安防监控系统
echo 正在启动YOLOv8安防监控系统...
python code\yolov8_security.py

endlocal

@echo off
chcp 65001 >nul
echo ========================================
echo Qwen2.5-VL-7B Dependency Installation
echo ========================================
echo.

echo [1/4] Checking Python environment...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Python not found!
    echo Please install Python 3.8+ and add to PATH
    pause
    exit /b 1
)
echo Python is installed
echo.

echo [2/4] Upgrading pip...
python -m pip install --upgrade pip
echo.

echo [3/4] Installing basic dependencies...
echo Installing Flask and Flask-CORS...
pip install flask flask-cors Pillow
echo.

echo [4/4] Installing AI dependencies...
echo Installing PyTorch (CUDA version)...
echo If you have NVIDIA GPU, CUDA version is recommended
echo.
echo Choose PyTorch version:
echo 1. CUDA 11.8 (Recommended if you have NVIDIA GPU)
echo 2. CUDA 12.1 (If you have newer NVIDIA GPU)
echo 3. CPU version (If you don't have GPU)
echo.

set /p choice="Enter option (1/2/3): "

if "%choice%"=="1" (
    echo Installing PyTorch with CUDA 11.8...
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
) else if "%choice%"=="2" (
    echo Installing PyTorch with CUDA 12.1...
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
) else if "%choice%"=="3" (
    echo Installing PyTorch CPU version...
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
) else (
    echo Invalid option, defaulting to CPU version
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
)

echo.
echo Installing Transformers and dependencies...
pip install transformers accelerate

echo.
echo Installing qwen-vl-utils...
pip install qwen-vl-utils

echo.
echo ========================================
echo Dependencies installed successfully!
echo ========================================
echo.
echo Next steps:
echo 1. Ensure model files are in ./models/Qwen2.5-VL-7B-Instruct directory
echo 2. Run start_qwen_service.bat to start AI service
echo 3. Start Spring Boot application
echo.

pause

@echo off
echo ==========================================
echo   Python 环境彻底清理脚本
echo ==========================================
echo.

echo [1/4] 正在删除 D:\Python ...
if exist "D:\Python" (
    rmdir /s /q "D:\Python"
    echo    ✅ D:\Python 已删除
) else (
    echo    ⚠️  D:\Python 不存在，跳过
)
echo.

echo [2/4] 正在清理用户 PATH 环境变量 ...
powershell -Command "[Environment]::SetEnvironmentVariable('Path', ([Environment]::GetEnvironmentVariable('Path', 'User') -split ';' | Where-Object { $_ -notlike '*D:\Python*' -and $_ -notlike '*D:\Anaconda3*' -and $_ -notlike '*jdk-18*' } -join ';'), 'User')"
echo    ✅ 用户 PATH 已清理（移除了 Python/Anaconda/jdk-18）
echo.

echo [3/4] 删除项目中的多余目录 ...
if exist "d:\yolov8_security\.venv" (
    rmdir /s /q "d:\yolov8_security\.venv"
    echo    ✅ .venv 已删除
) else (
    echo    ⚠️  .venv 不存在，跳过
)

if exist "d:\yolov8_security\jdk-18" (
    rmdir /s /q "d:\yolov8_security\jdk-18"
    echo    ✅ jdk-18 已删除
) else (
    echo    ⚠️  jdk-18 不存在，跳过
)

if exist "d:\yolov8_security\start-backend.bat" (
    del /q "d:\yolov8_security\start-backend.bat"
    echo    ✅ start-backend.bat 已删除
) else (
    echo    ⚠️  start-backend.bat 不存在，跳过
)
echo.

echo [4/4] 验证清理结果 ...
echo.
echo 当前 Conda 环境:
conda env list
echo.
echo 请重新打开命令行窗口使环境变量生效！
echo.
echo ==========================================
echo   清理完成！
echo ==========================================
pause

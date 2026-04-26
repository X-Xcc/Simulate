@echo off
chcp 65001 >nul
title 一键上传项目到 GitHub

echo ================================================
echo 一键上传项目到 GitHub 脚本
echo ================================================
echo.

:: 检查 Git 是否安装
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] Git 未安装！
    echo 请先下载并安装 Git：https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)
echo [成功] Git 已安装

:: 检查当前目录是否为 Git 仓库
if not exist ".git" (
    echo [提示] 当前目录不是 Git 仓库，正在初始化...
    git init
    if %errorlevel% neq 0 (
        echo [错误] Git 初始化失败！
        pause
        exit /b 1
    )
    echo [成功] Git 仓库初始化完成
    
    :: 使用默认远程仓库 URL
    set "REMOTE_URL=https://github.com/X-Xcc/EverBright.git"
    echo [提示] 使用默认远程仓库 URL: %REMOTE_URL%
    
    git remote add origin %REMOTE_URL%
    if %errorlevel% neq 0 (
        echo [错误] 添加远程仓库失败！
        pause
        exit /b 1
    )
    echo [成功] 远程仓库添加完成
) else (
    echo [成功] Git 仓库已存在
    :: 检查是否有远程仓库
    for /f "tokens=2" %%i in ('git remote -v ^| findstr origin') do set "REMOTE_URL=%%i"
    if "%REMOTE_URL%" == "" (
        echo [提示] 未设置远程仓库，正在添加...
        :: 使用默认远程仓库 URL
        set "REMOTE_URL=https://github.com/X-Xcc/EverBright.git"
        echo [提示] 使用默认远程仓库 URL: %REMOTE_URL%
        git remote add origin %REMOTE_URL%
        if %errorlevel% neq 0 (
            echo [错误] 添加远程仓库失败！
            pause
            exit /b 1
        )
        echo [成功] 远程仓库添加完成
    ) else (
        echo [成功] 远程仓库已设置: %REMOTE_URL%
    )
)

echo.
echo ================================================
echo 开始上传项目文件...
echo ================================================
echo.

:: 添加所有文件到暂存区
echo [步骤 1] 添加文件到暂存区...
git add .
if %errorlevel% neq 0 (
    echo [错误] 添加文件失败！
    pause
    exit /b 1
)
echo [成功] 文件添加完成

:: 提交更改
echo [步骤 2] 提交更改...
set /p "COMMIT_MSG=请输入提交信息 (默认: 更新项目文件): "
if "%COMMIT_MSG%" == "" set "COMMIT_MSG=更新项目文件"
git commit -m "%COMMIT_MSG%"
if %errorlevel% neq 0 (
    echo [错误] 提交失败！可能没有需要提交的更改。
    echo 继续执行推送操作...
)
echo [成功] 提交完成

:: 推送更改到远程仓库
echo [步骤 3] 推送到 GitHub...
git push -u origin main
if %errorlevel% neq 0 (
    echo [错误] 推送失败！
    echo 可能的原因：
    echo 1. 远程仓库不存在
    echo 2. 网络连接问题
    echo 3. 权限不足
    echo 请检查远程仓库 URL 是否正确，以及您是否有推送权限。
    pause
    exit /b 1
)
echo [成功] 推送完成

echo.
echo ================================================
echo 项目上传成功！
echo ================================================
echo 您的项目已成功上传到 GitHub 仓库：
echo %REMOTE_URL%
echo.
echo 按任意键退出...
pause >nul
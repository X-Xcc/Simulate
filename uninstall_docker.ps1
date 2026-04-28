# Docker Desktop 完全卸载脚本
# 必须以管理员身份运行

Write-Host "Docker Desktop 完全卸载流程" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red

# 第 1 步: 停止 Docker 服务
Write-Host "`n[1] 停止 Docker 服务..." -ForegroundColor Yellow
try {
    Stop-Service -Name "Docker" -Force -ErrorAction SilentlyContinue
    Stop-Service -Name "com.docker.service" -Force -ErrorAction SilentlyContinue
    Write-Host "✓ Docker 服务已停止" -ForegroundColor Green
} catch {
    Write-Host "⚠ 无法停止服务（可能未运行）" -ForegroundColor Yellow
}

# 第 2 步: 卸载程序
Write-Host "`n[2] 卸载 Docker Desktop 程序..." -ForegroundColor Yellow
$uninstallPaths = @(
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Docker",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Docker"
)

$found = $false
foreach ($path in $uninstallPaths) {
    if (Test-Path $path) {
        $uninstallString = (Get-ItemProperty $path).UninstallString
        if ($uninstallString) {
            Write-Host "找到卸载程序: $uninstallString" -ForegroundColor Cyan
            Write-Host "请等待卸载完成..." -ForegroundColor Yellow
            & cmd /c $uninstallString /S
            $found = $true
            Start-Sleep -Seconds 5
        }
    }
}

if (-not $found) {
    Write-Host "⚠ 未找到卸载程序，请手动操作:" -ForegroundColor Yellow
    Write-Host "  控制面板 > 程序 > 程序和功能 > 找到 Docker Desktop > 卸载" -ForegroundColor Cyan
}

# 第 3 步: 删除 Docker 相关文件夹
Write-Host "`n[3] 删除 Docker 相关文件..." -ForegroundColor Yellow
$dockerPaths = @(
    "C:\ProgramData\Docker",
    "C:\ProgramData\DockerDesktop",
    "$env:APPDATA\Docker",
    "$env:APPDATA\DockerDesktop"
)

foreach ($dockerPath in $dockerPaths) {
    if (Test-Path $dockerPath) {
        Write-Host "删除: $dockerPath" -ForegroundColor Cyan
        Remove-Item -Path $dockerPath -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "✓ 已删除" -ForegroundColor Green
    }
}

# 第 4 步: 删除注册表项
Write-Host "`n[4] 清理注册表..." -ForegroundColor Yellow
$regPaths = @(
    "HKCU:\Software\Docker",
    "HKCU:\Software\DockerDesktop",
    "HKLM:\Software\Docker",
    "HKLM:\Software\DockerDesktop"
)

foreach ($regPath in $regPaths) {
    if (Test-Path $regPath) {
        Write-Host "删除: $regPath" -ForegroundColor Cyan
        Remove-Item -Path $regPath -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "✓ 已删除" -ForegroundColor Green
    }
}

# 完成
Write-Host "`n========================================" -ForegroundColor Red
Write-Host "✓ Docker Desktop 已完全卸载" -ForegroundColor Green
Write-Host "`n建议: 重启计算机以完成清理" -ForegroundColor Yellow
Write-Host "按任意键继续..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

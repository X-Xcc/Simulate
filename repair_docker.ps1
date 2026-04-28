# 修复 Docker Desktop 权限问题
# 必须以管理员身份运行此脚本

Write-Host "正在修复 Docker Desktop 权限..." -ForegroundColor Yellow

# 修复目录权限
$path = "C:\ProgramData\DockerDesktop"
$username = $env:USERNAME

Write-Host "当前用户: $username" -ForegroundColor Cyan
Write-Host "目标路径: $path" -ForegroundColor Cyan

if (Test-Path $path) {
    Write-Host "找到目录，正在修复权限..." -ForegroundColor Green
    try {
        icacls $path /grant:r "$username`:(OI)(CI)F" /T
        Write-Host "✓ 权限修复完成" -ForegroundColor Green
    } catch {
        Write-Host "✗ 权限修复失败: $_" -ForegroundColor Red
    }
} else {
    Write-Host "目录不存在，可能需要重新安装 Docker" -ForegroundColor Red
}

Write-Host "`n修复完成，请关闭此窗口" -ForegroundColor Yellow

$body = '{"username":"admin","password":"123"}'
$r = Invoke-RestMethod -Uri 'http://localhost:5000/api/login' -Method POST -ContentType 'application/json' -Body $body -TimeoutSec 5
Write-Host "Login response type: $($r.GetType().Name)"
Write-Host "Login response: $($r | Out-String)"
$token = $r.token
if (-not $token) {
    $token = $r.tokenValue
}
if (-not $token) {
    Write-Host "Trying alternate..."
    $token = $r.access_token
}
Write-Host "Token value: $token"

$payload = '{"base64":"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=","type":"fight","cameraId":"cam-test","cameraName":"测试摄像头"}'
$headers = @{ Authorization = "Bearer $token" }
try {
    $result = Invoke-RestMethod -Uri 'http://localhost:5000/api/screenshot/upload' -Method POST -ContentType 'application/json' -Headers $headers -Body $payload -TimeoutSec 10
    Write-Host "Upload result: $($result | ConvertTo-Json -Compress)"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}

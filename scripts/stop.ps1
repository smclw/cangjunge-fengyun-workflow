$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runtimeFile = Join-Path $projectRoot '.runtime\server.json'
if (-not (Test-Path -LiteralPath $runtimeFile)) { Write-Host '工作流当前没有运行记录。'; exit 0 }

try { $runtime = Get-Content -Raw -Encoding UTF8 -LiteralPath $runtimeFile | ConvertFrom-Json } catch {
  Remove-Item -LiteralPath $runtimeFile -Force -ErrorAction SilentlyContinue
  Write-Host '旧运行记录已失效并清理。'; exit 0
}
$pidToStop = [int]$runtime.pid
$process = Get-Process -Id $pidToStop -ErrorAction SilentlyContinue
if (-not $process) {
  Remove-Item -LiteralPath $runtimeFile -Force -ErrorAction SilentlyContinue
  Write-Host '服务已停止；旧运行记录已清理。'; exit 0
}
if (-not $runtime.projectRoot -or -not ([string]$runtime.projectRoot).Equals($projectRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw '运行记录不属于当前项目，已拒绝停止。'
}
try {
  $startedAt = ([datetime]$runtime.startedAt).ToUniversalTime()
  $processStart = $process.StartTime.ToUniversalTime()
  if ([math]::Abs(($startedAt - $processStart).TotalSeconds) -gt 15) { throw 'PID 启动时间与运行记录不匹配。' }
} catch { throw "运行身份校验失败，已拒绝停止：$($_.Exception.Message)" }
$commandLine = (Get-CimInstance Win32_Process -Filter "ProcessId=$pidToStop" -ErrorAction SilentlyContinue).CommandLine
if (-not $commandLine -or -not $commandLine.Contains('app/server/index.ts') -or -not $commandLine.Contains('--import')) {
  throw "PID $pidToStop 不是本项目启动的服务，已拒绝停止，避免误关其他程序。"
}
try {
  $health = Invoke-RestMethod -Uri "$($runtime.url)/api/health" -TimeoutSec 2
  if ($health.ok -ne $true -or $health.name -ne 'Topview涨粉变现工作流' -or [int]$health.schemaVersion -ne 1) { throw '健康响应身份不匹配。' }
} catch { throw "服务身份校验失败，已拒绝停止：$($_.Exception.Message)" }
Stop-Process -Id $pidToStop -ErrorAction Stop
for ($attempt = 0; $attempt -lt 20; $attempt++) {
  if (-not (Get-Process -Id $pidToStop -ErrorAction SilentlyContinue)) { break }
  Start-Sleep -Milliseconds 100
}
Remove-Item -LiteralPath $runtimeFile -Force -ErrorAction SilentlyContinue
Write-Host "Topview 涨粉变现工作流已停止（PID $pidToStop）。"

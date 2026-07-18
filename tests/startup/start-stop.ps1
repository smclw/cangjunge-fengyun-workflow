$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$startScript = Join-Path $projectRoot 'scripts\start.ps1'
$stopScript = Join-Path $projectRoot 'scripts\stop.ps1'
$runtimeFile = Join-Path $projectRoot '.runtime\server.json'
$results = [System.Collections.Generic.List[string]]::new()

function Assert-True([bool]$condition,[string]$message) { if (-not $condition) { throw "断言失败：$message" }; $results.Add("通过：$message") }
function Read-Runtime { Get-Content -Raw -Encoding UTF8 -LiteralPath $runtimeFile | ConvertFrom-Json }
function Stop-IfRunning { if (Test-Path -LiteralPath $runtimeFile) { & $stopScript | Out-Host } }

try {
  Stop-IfRunning
  & $startScript -NoBrowser -PreferredPort 4173 | Out-Host
  $first = Read-Runtime
  Assert-True ((Invoke-RestMethod -Uri "$($first.url)/api/health" -TimeoutSec 3).ok -eq $true) '中文路径可启动并通过健康检查'
  $firstPid = [int]$first.pid
  & $startScript -NoBrowser -PreferredPort 4173 | Out-Host
  $duplicate = Read-Runtime
  Assert-True ([int]$duplicate.pid -eq $firstPid) '重复启动复用原服务且不产生第二个PID'
  & $stopScript | Out-Host
  Assert-True (-not (Get-Process -Id $firstPid -ErrorAction SilentlyContinue)) '停止脚本仅关闭记录的项目服务'
  Assert-True (-not (Test-Path -LiteralPath $runtimeFile)) '停止后清理运行记录'

  $conflictPort = 43210
  $portJob = Start-Job -ScriptBlock { param($port) $listener=[System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,$port);$listener.Start();try{while($true){Start-Sleep -Milliseconds 200}}finally{$listener.Stop()} } -ArgumentList $conflictPort
  Start-Sleep -Milliseconds 500
  Assert-True ($portJob.State -eq 'Running') '端口冲突测试占位服务已就绪'
  & $startScript -NoBrowser -PreferredPort $conflictPort | Out-Host
  $shifted = Read-Runtime
  Assert-True ([int]$shifted.port -eq ($conflictPort + 1)) '首选端口冲突时自动选择下一可用端口'
  & $stopScript | Out-Host
  Stop-Job -Job $portJob -ErrorAction SilentlyContinue
  Remove-Job -Job $portJob -Force -ErrorAction SilentlyContinue

  & $startScript -NoBrowser -PreferredPort 4173 | Out-Host
  $restartOne = Read-Runtime
  & $stopScript | Out-Host
  & $startScript -NoBrowser -PreferredPort 4173 | Out-Host
  $restartTwo = Read-Runtime
  Assert-True ((Invoke-RestMethod -Uri "$($restartTwo.url)/api/projects" -TimeoutSec 3).Count -ge 1) '停止后重启可恢复已有项目数据'
  Assert-True ([int]$restartTwo.pid -ne [int]$restartOne.pid) '重启产生新的受控PID'
  & $stopScript | Out-Host

  $env:TOPVIEW_NO_BROWSER = '1'
  $startBatch = Start-Process -FilePath cmd.exe -ArgumentList @('/d','/c','启动工作流.bat') -WorkingDirectory $projectRoot -PassThru
  for ($attempt=0; $attempt -lt 40 -and -not (Test-Path -LiteralPath $runtimeFile); $attempt++) { Start-Sleep -Milliseconds 250 }
  $batchRuntime = Read-Runtime
  Assert-True ((Invoke-RestMethod -Uri "$($batchRuntime.url)/api/health" -TimeoutSec 3).ok -eq $true) 'BAT入口实际启动成功'
  Assert-True ($startBatch.WaitForExit(5000)) '启动BAT自身正常退出且服务继续运行'
  $stopBatch = Start-Process -FilePath cmd.exe -ArgumentList @('/d','/c','停止工作流.bat') -WorkingDirectory $projectRoot -PassThru
  Assert-True ($stopBatch.WaitForExit(5000)) '停止BAT自身正常退出'
  Assert-True (-not (Test-Path -LiteralPath $runtimeFile)) 'BAT入口实际停止成功'
  Remove-Item Env:TOPVIEW_NO_BROWSER -ErrorAction SilentlyContinue

  Write-Host "启动专项验收完成，共 $($results.Count) 项："
  $results | ForEach-Object { Write-Host $_ }
} finally {
  Stop-IfRunning
  Get-Job -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'Job*' } | Stop-Job -ErrorAction SilentlyContinue
  Get-Job -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'Job*' } | Remove-Job -Force -ErrorAction SilentlyContinue
}

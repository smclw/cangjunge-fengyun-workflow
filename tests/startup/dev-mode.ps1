$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$logDir = [IO.Path]::GetFullPath((Join-Path $tempRoot "cangjunge-dev-test-$([Guid]::NewGuid().ToString('N'))"))
if (-not $logDir.StartsWith($tempRoot,[StringComparison]::OrdinalIgnoreCase)) { throw '临时日志目录越界。' }
[void](New-Item -ItemType Directory -Path $logDir)
$stdout = Join-Path $logDir 'stdout.log'
$stderr = Join-Path $logDir 'stderr.log'
$devProcess = $null

function Assert-True([bool]$condition,[string]$message) {
  if (-not $condition) { throw "断言失败：$message" }
  Write-Host "通过：$message"
}

function Test-Port([int]$port) {
  $client = [Net.Sockets.TcpClient]::new()
  try {
    $pending = $client.BeginConnect('127.0.0.1',$port,$null,$null)
    if (-not $pending.AsyncWaitHandle.WaitOne(250)) { return $false }
    $client.EndConnect($pending)
    return $true
  } catch { return $false } finally { $client.Dispose() }
}

function Wait-ForDev {
  for ($attempt=0; $attempt -lt 80; $attempt++) {
    if ($devProcess.HasExited) { break }
    try {
      $health = Invoke-RestMethod -Uri 'http://127.0.0.1:5173/api/health' -TimeoutSec 2
      if ($health.ok -eq $true) { return $health }
    } catch { Start-Sleep -Milliseconds 250 }
  }
  $out = if (Test-Path -LiteralPath $stdout) { Get-Content -Raw -LiteralPath $stdout } else { '' }
  $err = if (Test-Path -LiteralPath $stderr) { Get-Content -Raw -LiteralPath $stderr } else { '' }
  throw "开发模式未就绪。`nSTDOUT:`n$out`nSTDERR:`n$err"
}

try {
  $env:TOPVIEW_DEV_NO_BROWSER = '1'
  $devProcess = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/d','/s','/c','npm.cmd run dev') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
  $health = Wait-ForDev
  $page = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5173/' -TimeoutSec 3
  Assert-True ($page.StatusCode -eq 200) 'npm run dev 启动 Vite 页面'
  Assert-True ($health.name -eq 'Topview涨粉变现工作流') 'Vite /api 代理连接正确的后端'
  Assert-True ((Test-Port 4173) -and (Test-Port 5173)) '开发模式同时监听 4173 和 5173'
  $webListeners = @(Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort 5173 -State Listen -ErrorAction Stop)
  Assert-True ($webListeners.Count -eq 1) '识别唯一的 Vite 监听进程'
  Stop-Process -Id $webListeners[0].OwningProcess -Force
  Assert-True ($devProcess.WaitForExit(10000)) '前端异常退出后 npm run dev 自动结束'
  Assert-True ($devProcess.ExitCode -ne 0) '子进程失败时开发命令返回非零状态'
} finally {
  Remove-Item Env:TOPVIEW_DEV_NO_BROWSER -ErrorAction SilentlyContinue
  if ($null -ne $devProcess) {
    $devProcess.Refresh()
    if (-not $devProcess.HasExited) {
      & taskkill.exe /PID $devProcess.Id /T /F 2>$null | Out-Null
      [void]$devProcess.WaitForExit(5000)
    }
  }
}

for ($attempt=0; $attempt -lt 40 -and ((Test-Port 4173) -or (Test-Port 5173)); $attempt++) { Start-Sleep -Milliseconds 250 }
Assert-True (-not (Test-Port 4173) -and -not (Test-Port 5173)) '结束测试后释放两个开发端口'
Remove-Item -LiteralPath $stdout,$stderr -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $logDir -Force -ErrorAction SilentlyContinue

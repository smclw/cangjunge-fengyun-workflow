param(
  [switch]$NoBrowser,
  [switch]$SkipInstall,
  [int]$PreferredPort = 4173
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runtimeDir = Join-Path $projectRoot '.runtime'
$runtimeFile = Join-Path $runtimeDir 'server.json'
$logDir = Join-Path $projectRoot 'data\logs'
$stdoutLog = Join-Path $logDir 'server.log'
$stderrLog = Join-Path $logDir 'server-error.log'
New-Item -ItemType Directory -Force -Path $runtimeDir, $logDir | Out-Null

function Write-Step([string]$message) {
  $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $message"
  Write-Host $line
  Add-Content -LiteralPath (Join-Path $logDir 'startup.log') -Value $line -Encoding UTF8
}

function Test-WorkflowHealth([string]$url) {
  try {
    $result = Invoke-RestMethod -Uri "$url/api/health" -TimeoutSec 2
    return $result.ok -eq $true -and $result.name -eq 'Topview涨粉变现工作流' -and [int]$result.schemaVersion -eq 1
  } catch { return $false }
}

function Test-RuntimeIdentity($runtime, $process) {
  try {
    if (-not $runtime.projectRoot -or -not ([string]$runtime.projectRoot).Equals($projectRoot, [System.StringComparison]::OrdinalIgnoreCase)) { return $false }
    $startedAt = ([datetime]$runtime.startedAt).ToUniversalTime()
    $processStart = $process.StartTime.ToUniversalTime()
    return [math]::Abs(($startedAt - $processStart).TotalSeconds) -le 15
  } catch { return $false }
}

if (Test-Path -LiteralPath $runtimeFile) {
  try {
    $runtime = Get-Content -Raw -Encoding UTF8 -LiteralPath $runtimeFile | ConvertFrom-Json
    $existing = Get-Process -Id ([int]$runtime.pid) -ErrorAction SilentlyContinue
    if ($existing -and (Test-RuntimeIdentity $runtime $existing) -and (Test-WorkflowHealth ([string]$runtime.url))) {
      Write-Step "工作流已在运行：$($runtime.url)（PID $($runtime.pid)），不会重复启动。"
      if (-not $NoBrowser) { Start-Process ([string]$runtime.url) }
      exit 0
    }
  } catch { Write-Step '检测到无效的旧运行记录，正在安全清理。' }
  Remove-Item -LiteralPath $runtimeFile -Force -ErrorAction SilentlyContinue
}

$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $nodeCommand) { throw '未检测到 Node.js。请安装 Node.js 22 LTS 后重试。' }
if (-not $npmCommand) { throw '检测到 Node.js，但未找到 npm.cmd。请修复 Node.js/npm 安装。' }
Write-Step "Node.js：$(& node.exe --version)；项目：$projectRoot"

if (-not $SkipInstall -and -not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules'))) {
  Write-Step '首次运行：正在使用 npm.cmd 安装本地依赖。'
  & npm.cmd install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw '依赖安装失败，请查看上方 npm 输出。' }
}

$distIndex = Join-Path $projectRoot 'app\client\dist\index.html'
$needsBuild = -not (Test-Path -LiteralPath $distIndex)
if (-not $needsBuild) {
  $distTime = (Get-Item -LiteralPath $distIndex).LastWriteTimeUtc
  $latestSource = Get-ChildItem -LiteralPath (Join-Path $projectRoot 'app\client\src') -Recurse -File | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
  $needsBuild = $latestSource -and $latestSource.LastWriteTimeUtc -gt $distTime
}
if ($needsBuild) {
  Write-Step '正在构建本地操作台。'
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw '操作台构建失败，请运行 scripts\validate.ps1 查看详细原因。' }
}

$port = $null
for ($candidate = $PreferredPort; $candidate -le ($PreferredPort + 26); $candidate++) {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $candidate)
  try { $listener.Start(); $port = $candidate; break } catch { } finally { try { $listener.Stop() } catch { } }
}
if (-not $port) { throw "端口 $PreferredPort-$($PreferredPort + 26) 均被占用。" }

Write-Step "正在启动本地服务，端口：$port"
$arguments = @('--import', 'tsx', 'app/server/index.ts', '--port', [string]$port)
$process = Start-Process -FilePath $nodeCommand.Source -ArgumentList $arguments -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru
$url = "http://127.0.0.1:$port"
$runtimeData = [ordered]@{ pid = $process.Id; port = $port; url = $url; startedAt = (Get-Date).ToUniversalTime().ToString('o'); projectRoot = $projectRoot }
$runtimeData | ConvertTo-Json | Set-Content -LiteralPath $runtimeFile -Encoding UTF8

$ready = $false
for ($attempt = 0; $attempt -lt 40; $attempt++) {
  Start-Sleep -Milliseconds 250
  if (Test-WorkflowHealth $url) { $ready = $true; break }
  if ($process.HasExited) { break }
}
if (-not $ready) {
  if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
  Remove-Item -LiteralPath $runtimeFile -Force -ErrorAction SilentlyContinue
  $detail = if (Test-Path -LiteralPath $stderrLog) { Get-Content -Raw -Encoding UTF8 -LiteralPath $stderrLog } else { '没有错误日志。' }
  throw "服务未能就绪：$detail"
}

Write-Step "启动成功：$url（PID $($process.Id)）"
if (-not $NoBrowser) { Start-Process $url }
Write-Host '关闭此窗口不会停止服务；需要停止时请双击“停止工作流.bat”。'

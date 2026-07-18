$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) { throw '未检测到 Node.js。' }
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules\tsx'))) { throw '项目依赖尚未安装，请先双击“启动工作流.bat”。' }
Push-Location $projectRoot
try { & node.exe --import tsx scripts/backup-cli.ts; if ($LASTEXITCODE -ne 0) { throw '备份失败。' } } finally { Pop-Location }

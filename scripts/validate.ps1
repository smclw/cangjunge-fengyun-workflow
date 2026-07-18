$ErrorActionPreference = 'Stop'
$env:PYTHONUTF8 = '1'
$env:PYTHONIOENCODING = 'utf-8'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location $projectRoot
try {
  & npm.cmd run validate
  if ($LASTEXITCODE -ne 0) { throw '应用验证失败。' }
  & node.exe .agents/skills/topview-growth-monetization/scripts/validate-skill.mjs
  if ($LASTEXITCODE -ne 0) { throw '项目 Skill 验证失败。' }
  Write-Host '应用、测试、构建与项目 Skill 验证全部通过。'
} finally { Pop-Location }

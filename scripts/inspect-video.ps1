param([Parameter(Mandatory=$true)][string]$Path)
$ErrorActionPreference = 'Stop'
$resolved = (Resolve-Path -LiteralPath $Path).Path
$item = Get-Item -LiteralPath $resolved
$hash = Get-FileHash -LiteralPath $resolved -Algorithm SHA256
[ordered]@{ Name=$item.Name; FullPath=$item.FullName; Bytes=$item.Length; LastWriteTime=$item.LastWriteTime; SHA256=$hash.Hash } | Format-List
if (Get-Command ffprobe.exe -ErrorAction SilentlyContinue) { & ffprobe.exe -v error -show_entries format=duration,size,bit_rate -show_streams -of json -- $resolved }

@echo off
chcp 65001 >nul
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop.ps1"
if errorlevel 1 pause

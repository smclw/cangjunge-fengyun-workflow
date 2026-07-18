@echo off
chcp 65001 >nul
setlocal
set "BROWSER_ARG="
if "%TOPVIEW_NO_BROWSER%"=="1" set "BROWSER_ARG=-NoBrowser"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1" %BROWSER_ARG%
if errorlevel 1 (
  echo.
  echo 启动失败，请查看上方中文原因和 data\logs\startup.log。
  pause
)

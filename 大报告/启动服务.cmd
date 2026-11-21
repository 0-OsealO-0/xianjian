@echo off
chcp 65001 >nul
title 先见 · 本机服务
echo.
echo   先见 本机服务启动中…
echo   打开后访问： http://127.0.0.1:8787/
echo   关掉这个窗口就停止服务。
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo   [!] 没找到 node。装一个 Node.js 18+ 再来。
  pause
  exit /b 1
)
cd /d "%~dp0.."
node "服务\server.mjs"
pause

@echo off
chcp 65001 >nul
title 小红书库

echo 正在启动小红书库...
echo.

:: 检查 node 是否安装
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo 【错误】未检测到 Node.js，请先安装：
    echo   https://nodejs.org  下载 LTS 版本安装即可
    pause
    exit
)

:: 首次运行自动安装依赖
if not exist "node_modules" (
    echo 首次运行，正在安装依赖（需要联网，约1分钟）...
    npm install
    echo.
)

echo 启动成功！请在浏览器打开：
echo   http://localhost:3001
echo.
echo 关闭此窗口 = 停止服务
echo.

node server.js
pause

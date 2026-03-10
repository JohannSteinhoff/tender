@echo off
setlocal
set "NODE_DIR=%~dp0src\.tools\portable-node\node-v24.14.0-win-x64"
if not exist "%NODE_DIR%\npm.cmd" (
  echo Portable Node.js not found at "%NODE_DIR%"
  exit /b 1
)
set "PATH=%NODE_DIR%;%PATH%"
"%NODE_DIR%\npm.cmd" %*

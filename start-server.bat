@echo off
rem Double-click to start the salary-note web app. Works from any current directory.
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo [ERROR] .venv not found in "%~dp0"
  echo Run once in this folder:
  echo    py -3.12 -m venv .venv
  echo    .venv\Scripts\python.exe -m pip install -r requirements.txt
  pause
  exit /b 1
)
echo Starting server ... the browser will open automatically. Close this window to stop.
.venv\Scripts\python.exe server.py --open
pause

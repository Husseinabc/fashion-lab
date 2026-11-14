@echo off
chcp 65001 >nul
echo Starting local server at http://localhost:8000 ...
start "" http://localhost:8000/index.html
python -m http.server 8000
pause

@echo off
rem Starts the Python API and the React dev server in two windows.
rem First run: create backend\.venv and run "npm install" in frontend (see README.md).
start "Optiva API" cmd /k "cd /d %~dp0backend && .venv\Scripts\python -m uvicorn app.main:app --reload --port 8000"
start "Optiva Web" cmd /k "cd /d %~dp0frontend && npm run dev"
echo Open http://localhost:5173

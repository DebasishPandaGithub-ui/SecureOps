@echo off
setlocal
cd /d "%~dp0"

if not exist "backend\.env" (
  copy "backend\.env.example" "backend\.env" >nul
  echo Created backend\.env. Edit it and set a unique JWT_SECRET before starting.
  pause
  exit /b 1
)
findstr /C:"replace_with_a_unique_random_secret" "backend\.env" >nul
if not errorlevel 1 (
  echo ERROR: Replace the placeholder JWT_SECRET in backend\.env with a unique random value of at least 32 characters.
  pause
  exit /b 1
)
if not exist "frontend\.env" copy "frontend\.env.example" "frontend\.env" >nul

if not exist "backend\node_modules" (
  echo Installing backend dependencies...
  call npm install --prefix backend
  if errorlevel 1 goto :fail
)
if not exist "frontend\node_modules" (
  echo Installing frontend dependencies...
  call npm install --prefix frontend
  if errorlevel 1 goto :fail
)

start "SecureOps Backend" cmd /k "cd /d ""%~dp0backend"" && npm run dev"
start "SecureOps Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"
echo Started backend and frontend terminals. Ensure MongoDB is running and backend\.env has a valid MONGO_URI.
echo Frontend: http://localhost:5173
pause
exit /b 0

:fail
echo Dependency installation failed. Check your internet connection and npm output above.
pause
exit /b 1

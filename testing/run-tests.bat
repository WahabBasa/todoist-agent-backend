@echo off
echo 🚀 TaskAI Automated Testing Suite
echo ================================

REM Check if TaskAI is running
echo 📡 Checking if TaskAI is running...
curl -s http://localhost:5174 >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ❌ TaskAI is not running on localhost:5174
    echo 💡 Please start TaskAI first:
    echo    cd "C:\Users\AtheA\Desktop\Personal_Programs\todoist-agent-backend\ea-ai-main2\ea-ai-main2"
    echo    npm run dev
    pause
    exit /b 1
)

echo ✅ TaskAI is running

REM Navigate to testing directory
cd /d "C:\Users\AtheA\Desktop\Personal_Programs\todoist-agent-backend\testing"

REM Install dependencies if needed
if not exist node_modules (
    echo 📦 Installing dependencies...
    npm install
)

echo.
echo 🎯 Choose testing method:
echo 1. Browser Testing (Visual - opens browser)
echo 2. API Testing (Fast - direct API calls)
echo 3. Both methods
echo.

set /p choice="Enter choice (1-3): "

if "%choice%"=="1" (
    echo 🌐 Running browser tests...
    node browser-test-runner.js
) else if "%choice%"=="2" (
    echo ⚡ Running API tests...
    node automated-test-runner.js
) else if "%choice%"=="3" (
    echo 🔄 Running both test methods...
    node automated-test-runner.js
    node browser-test-runner.js
) else (
    echo ❌ Invalid choice
    pause
    exit /b 1
)

echo.
echo 🎉 Testing completed!
echo 📄 Check these files for results:
echo    - test-results-automated.json
echo    - test-results-readable.md  
echo    - browser-test-results.json
echo.
pause
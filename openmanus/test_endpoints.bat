@echo off
echo ===============================================
echo Testing OpenManus API Endpoints using curl
echo ===============================================

set BASE_URL=http://localhost:3000

echo.
echo ==============================================
echo STEP 1: Checking Health Status
echo ==============================================
echo GET %BASE_URL%/api/health
curl -s %BASE_URL%/api/health > health_response.json
type health_response.json
echo.

echo.
echo ==============================================
echo STEP 2: Starting Process
echo ==============================================
echo GET %BASE_URL%/api/start-process
curl -s %BASE_URL%/api/start-process > start_process_response.json
type start_process_response.json
echo.

echo Waiting 3 seconds for process to initialize...
timeout /t 3 > nul

echo.
echo ==============================================
echo STEP 3: Checking Logs
echo ==============================================
echo GET %BASE_URL%/api/logs
curl -s %BASE_URL%/api/logs > logs_response.json
type logs_response.json
echo.

echo.
echo ==============================================
echo STEP 4: Stopping Process
echo ==============================================
echo GET %BASE_URL%/api/stop-process
curl -s %BASE_URL%/api/stop-process > stop_process_response.json
type stop_process_response.json
echo.

echo Waiting 2 seconds for process to stop...
timeout /t 2 > nul

echo.
echo ==============================================
echo Verifying Process Stopped
echo ==============================================
echo GET %BASE_URL%/api/health
curl -s %BASE_URL%/api/health > health_after_stop_response.json
type health_after_stop_response.json
echo.

echo.
echo ===============================================
echo Testing Complete!
echo =============================================== 
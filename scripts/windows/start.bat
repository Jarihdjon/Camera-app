@echo off
REM One-click start: builds the iPad app if needed, then runs the server.
cd /d "%~dp0\..\.."
if not exist node_modules (call npm install || goto :error)
if not exist web\dist (call npm run build || goto :error)
call npm start
goto :eof
:error
echo Something went wrong. Check the messages above.
pause

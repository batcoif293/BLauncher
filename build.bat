@echo off
echo Installing dependencies...
call npm install
echo Building BatcoifLauncher.exe...
call npm run dist
echo.
echo Done. Your exe is in the "dist" folder.
pause

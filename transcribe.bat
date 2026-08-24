@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo   NS KINETIC SUBTITLES — Universal Video/Audio Transcriber
echo ========================================================
echo.

if "%~1"=="" (
    echo Drag and drop any video or audio file onto this .bat file!
    echo Or enter file path manually:
    set /p "INPUT_FILE=File path: "
) else (
    set "INPUT_FILE=%~1"
)

if "%INPUT_FILE%"=="" (
    echo No file specified. Exiting...
    pause
    exit /b 1
)

echo Processing: %INPUT_FILE%
echo.

node "%~dp0transcribe.js" "%INPUT_FILE%"

echo.
pause

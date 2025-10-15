@echo off
title FTP Upload - Autofill Project
echo =====================================================
echo   FTP Upload Script for ftp.lightnightdev.com
echo =====================================================

REM === CONFIGURATION ===
set HOST=ftp.lightnightdev.com
set USER=lightnig

REM === Prompt for password ===
set /p PASS=Enter password for %USER%: 

REM === Create temporary FTP command file ===
(
echo open %HOST%
echo user %USER% %PASS%
echo prompt
echo binary

REM === Upload index.html to /autofill ===
echo cd autofill
echo put index.html

REM === Upload /js folder ===
echo cd js
echo lcd js
echo mput *

REM === Upload /js_src folder ===
echo cd js_src
echo lcd js_src
echo mput *

REM === Back up to project root ===
echo cd ..
echo lcd ..
echo cd ..
echo lcd ..

REM === Upload /css folder ===
echo cd css
echo lcd css
echo mput *

REM === End ===
echo bye
) > ftpcmd.dat

ftp -n -s:ftpcmd.dat

del ftpcmd.dat
echo.
echo ✅ Upload complete.
pause

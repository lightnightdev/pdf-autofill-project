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
echo mput index.html
echo lcd js
echo cd js
echo mput autofill.min.js

REM === End ===
echo bye
) > ftpcmd.dat

ftp -n -s:ftpcmd.dat

del ftpcmd.dat
echo.
echo ✅ Upload complete.
pause

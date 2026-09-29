@echo off
setlocal enabledelayedexpansion

:: ==========================================
:: Configuration
:: ==========================================
set "ZROK_EXE=C:\zrok\zrok.exe"
set "NAME=my-jenkins-local"
set "NAMESPACE=public"
set "TARGET_URL=http://host.docker.internal:8080"

echo ==========================================
echo Starting zrok share reset sequence...
echo ==========================================

:: ------------------------------------------
:: Step 1 & 2: Delete attached share and release reserved name
:: ------------------------------------------
echo [Step 1] Attempting to clean up existing name/share...
set "ATTACHED_TOKEN="

:: Run 'delete name' and capture error output if a share is still attached
for /f "usebackq tokens=*" %%T in (`powershell -NoProfile -Command ^
    "$out = & '%ZROK_EXE%' delete name -n %NAMESPACE% %NAME% 2>&1; " ^
    "if ($out -match 'attached to share ''([^'']+)''') { $matches[1] }" 2^>nul`) do (
        set "ATTACHED_TOKEN=%%T"
)

if defined ATTACHED_TOKEN (
    echo Found attached share token: !ATTACHED_TOKEN!
    echo Deleting share token '!ATTACHED_TOKEN!'...
    "%ZROK_EXE%" delete share !ATTACHED_TOKEN!
    
    echo Retrying name deletion...
    "%ZROK_EXE%" delete name -n %NAMESPACE% %NAME%
) else (
    echo Name reservation deleted or was not locked by an active share.
)

:: ------------------------------------------
:: Step 3: Create fresh name reservation
:: ------------------------------------------
echo [Step 2] Creating name '%NAME%' in namespace '%NAMESPACE%'...
"%ZROK_EXE%" create name -n %NAMESPACE% %NAME%

if errorlevel 1 (
    echo [ERROR] Name creation failed. Halting before share step.
    goto END
)

:: ------------------------------------------
:: Step 4: Start public share
:: ------------------------------------------
echo [Step 3] Starting zrok share for %TARGET_URL%...
"%ZROK_EXE%" share public %TARGET_URL% -n %NAMESPACE%:%NAME%

:END
echo.
echo ==========================================
echo Process finished or stopped.
echo ==========================================
pause
endlocal
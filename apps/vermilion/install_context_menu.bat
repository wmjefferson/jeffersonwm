@echo off
:: ──────────────────────────────────────────────────────────────────
:: install_context_menu.bat
::
:: Adds a "Vermilion" entry to the Windows Explorer right-click
:: context menu for folders.  Run this script AS ADMINISTRATOR.
::
:: To remove, run:  uninstall_context_menu.bat
:: ──────────────────────────────────────────────────────────────────

set "APP_DIR=%~dp0"
set "PYTHON_EXE=python"
set "MAIN_PY=%APP_DIR%main.py"

:: Add registry keys for folder background (right-click inside a folder)
reg add "HKEY_CLASSES_ROOT\Directory\shell\Vermilion" /ve /d "Organize with Vermilion" /f
reg add "HKEY_CLASSES_ROOT\Directory\shell\Vermilion" /v "Icon" /d "shell32.dll,3" /f
reg add "HKEY_CLASSES_ROOT\Directory\shell\Vermilion\command" /ve /d "\"%PYTHON_EXE%\" \"%MAIN_PY%\" \"%%V\"" /f

:: Also add for right-click ON a folder (from parent directory)
reg add "HKEY_CLASSES_ROOT\Directory\Background\shell\Vermilion" /ve /d "Organize with Vermilion" /f
reg add "HKEY_CLASSES_ROOT\Directory\Background\shell\Vermilion" /v "Icon" /d "shell32.dll,3" /f
reg add "HKEY_CLASSES_ROOT\Directory\Background\shell\Vermilion\command" /ve /d "\"%PYTHON_EXE%\" \"%MAIN_PY%\" \"%%V\"" /f

echo.
echo ✅ Context menu installed successfully.
echo    Right-click any folder to see "Organize with Vermilion".
echo.
pause

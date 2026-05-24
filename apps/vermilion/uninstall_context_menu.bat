@echo off
:: ──────────────────────────────────────────────────────────────────
:: uninstall_context_menu.bat
::
:: Removes the "Vermilion" context menu entry.
:: Run this script AS ADMINISTRATOR.
:: ──────────────────────────────────────────────────────────────────

reg delete "HKEY_CLASSES_ROOT\Directory\shell\Vermilion" /f 2>nul
reg delete "HKEY_CLASSES_ROOT\Directory\Background\shell\Vermilion" /f 2>nul

echo.
echo ✅ Context menu removed.
echo.
pause

@echo off
rem Lo ejecuta el Programador de tareas de Windows. Publica los datos y deja log en logs\publish.log.
cd /d "%~dp0.."
node scripts\publish.mjs %*
exit /b %ERRORLEVEL%

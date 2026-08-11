@echo off
rem ============================================================
rem  SUBIR ACTUALIZACIONES a cPanel (solo los archivos de dist-web)
rem  Configura tus datos en ftp-config.txt (unica vez) y luego
rem  ejecuta subir.bat cada vez que quieras publicar un cambio.
rem  Los nombres de archivo son FIJOS: se sobreescriben, no hay
rem  que borrar nada. Las migraciones de BD se aplican solas.
rem ============================================================
setlocal enabledelayedexpansion
if not exist ftp-config.txt (echo Falta ftp-config.txt: edita el archivo ftp-config.txt y pon tus datos FTP & pause & exit /b 1)
for /f "usebackq tokens=1,* delims==" %%A in ("ftp-config.txt") do set "%%A=%%B"
if "%HOST%"=="" (echo ftp-config.txt mal: falta HOST & pause & exit /b 1)
if "%USER%"=="" (echo ftp-config.txt mal: falta USER & pause & exit /b 1)
echo Subiendo dist-web a ftp://%HOST%%RUTA%/ ...
for /R dist-web %%F in (*) do (
  set "rel=%%F"
  set "rel=!rel:%~dp0dist-web\=!"
  set "rel=!rel:\=/!"
  set "skip=0"
  if "!rel!"=="api/config.generated.php" set "skip=1"
  if "!rel!"=="api/router.local.php" set "skip=1"
  if "!skip!"=="1" (echo   OJO: !rel! es local, no se sube) else (
    curl.exe -s --ftp-create-dirs -T "%%F" "ftp://%HOST%%RUTA%/!rel!"
    if errorlevel 1 (echo FALLO al subir: !rel! & pause & exit /b 1)
    echo   OK: !rel!
  )
)
echo.
echo LISTO: actualizacion publicada. Recarga la app con Ctrl+F5.
pause
@echo off
cd /d "%~dp0"
echo [1/4] Compilando app web...
call npx vite build --config web/vite.config.web.js || goto :error
echo [2/4] Copiando backend PHP...
call xcopy web\api dist-web\api /e /i /y >nul
copy web\.htaccess dist-web\.htaccess >nul
echo [3/4] Limpiando config local y router de desarrollo...
del dist-web\api\config.generated.php 2>nul
del dist-web\router.local.php 2>nul
echo [A] Version para actualizaciones...
if exist update-repo\version.json (
  copy /y update-repo\version.json dist-web\version.json >nul
) else (
  echo {"version":1} > dist-web\version.json
)
echo [4/4] Creando nexbit-pos-web.zip...
rem IMPORTANTE: make-zip.ps1 escribe entradas con "/" (Compress-Archive / ZipFile
rem usan "\" y rompen la extraccion en cPanel/Linux con php ZipArchive)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0web\tools\make-zip.ps1" -Src "%~dp0dist-web" -Out "%~dp0nexbit-pos-web.zip" || goto :error
echo.
echo LISTO: nexbit-pos-web.zip (contenido = public_html/)
pause
exit /b 0
:error
echo ERROR en el build.
pause
exit /b 1
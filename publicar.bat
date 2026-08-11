@echo off
rem ============================================================
rem  PUBLICAR actualizacion a GitHub (repo PRIVADO)
rem  1) sube version.json (v+1)  2) empaqueta  3) sube el zip al repo
rem  Los clientes la aplican con el boton "Actualizar" de Config.
rem  Preparacion una sola vez (ver README -> Actualizacion por boton):
rem    gh repo create nexbit-pos-web --private --source update-repo --push
rem ============================================================
cd /d "%~dp0"
echo [1/3] Nueva version...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0web\tools\bump-version.ps1" -File "%~dp0update-repo\version.json" || (echo ERROR leyendo version.json & pause & exit /b 1)
call .\empaquetar.bat || exit /b 1
echo [3/3] Subiendo a GitHub...
copy /y nexbit-pos-web.zip update-repo\ >nul
git -C update-repo add -A
git -C update-repo commit -m "Actualizacion Nexbit POS web" || (echo Nada nuevo que publicar & pause & exit /b 1)
git -C update-repo push || (echo FALLO el push: verifica origin en update-repo\.git\config & pause & exit /b 1)
echo.
echo PUBLICADA. Los clientes veran "Actualizar ahora" en Config.
pause
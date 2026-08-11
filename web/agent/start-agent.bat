@echo off
rem Nexbit POS Web - Arranca el agente local de impresion (una vez por PC de caja).
cd /d "%~dp0"
start "" /min cmd /c "node print-agent.js"
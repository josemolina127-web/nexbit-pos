# Sube +1 la version del update (version.json) y la escribe SIN BOM y como JSON
# valido, con comillas. Usado por publicar.bat (un archivo, nada de quoting inline).
param([string]$File)
$v = 0
if (Test-Path $File) {
  $raw = Get-Content $File -Raw
  $j = $raw -replace "^\uFEFF", '' | ConvertFrom-Json
  $v = [int]$j.version
}
$v++
$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $File).Path, '{"version": ' + $v + '}', $utf8)
Write-Host "Nueva version: $v"
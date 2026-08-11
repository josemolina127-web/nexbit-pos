# Crea un zip usando SIEMPRE "/" en las rutas de las entradas.
# Compress-Archive y ZipFile::CreateFromDirectory guardan "\" en Windows
# (rompe la extraccion con PHP ZipArchive en cPanel/Linux). Comparte la
# logica empaquetar.bat y smoke.js. NO confia en la longitud de rutas:
# usa Resolve-Path -Relative (evita el bug del nombre corto 8.3).
param([string]$Src, [string]$Out)
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path $Out) { Remove-Item $Out -Force }
$zip = [System.IO.Compression.ZipFile]::Open([System.IO.Path]::GetFullPath($Out), 'Create')
Push-Location $Src
try {
  Get-ChildItem -Recurse -File | ForEach-Object {
    $rel = (Resolve-Path -Relative $_.FullName) -replace '^\.\\', '' -replace '\\', '/'
    $entry = $zip.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
    $es = $entry.Open()
    $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
    $es.Write($bytes, 0, $bytes.Length)
    $es.Dispose()
  }
} finally {
  Pop-Location
}
$zip.Dispose()
# Auto-verificacion: ninguna entrada puede llevar "\" (rompe ZipArchive en cPanel)
$zip2 = [System.IO.Compression.ZipFile]::OpenRead([System.IO.Path]::GetFullPath($Out))
$bad = @($zip2.Entries | Where-Object { $_.FullName.Contains('\') })
$zip2.Dispose()
if ($bad.Count -gt 0) { Write-Error "ZIP INVALIDO: $($bad.Count) entradas con '\' (ej: $($bad[0].FullName))"; exit 1 }
Write-Host "zip creado: $Out (entradas con /)"
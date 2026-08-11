# Copia las imágenes de packages/shared/assets/images a los public/img de cada app web.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$src = "packages\shared\assets\images"
foreach ($app in @("landing","admin","webapp")) {
  $dest = "apps\$app\public\img"
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  Copy-Item "$src\*" $dest -Force
  Write-Host "-> imagenes copiadas a $dest"
}
Write-Host "Listo (OK)"

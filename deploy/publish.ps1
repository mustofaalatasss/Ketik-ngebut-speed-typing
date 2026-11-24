<#
  Langkah A (dijalankan di laptop Windows): build frontend dan backend untuk Linux,
  lalu kemas semuanya menjadi satu berkas publish\ketikngebut.tar.gz untuk diunggah ke VPS.

  Cara pakai (dari folder proyek):
    powershell -ExecutionPolicy Bypass -File deploy\publish.ps1
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$out = Join-Path $root 'publish'

if (Test-Path $out) { Remove-Item -Recurse -Force $out }
New-Item -ItemType Directory $out | Out-Null

Write-Host '1/4 Build frontend (npm run build)...' -ForegroundColor Cyan
npm --prefix web run build
if ($LASTEXITCODE -ne 0) { throw 'Build frontend gagal.' }

Write-Host '2/4 Build backend untuk Linux x64 (dotnet publish)...' -ForegroundColor Cyan
dotnet publish src/KetikNgebut.Api -c Release -r linux-x64 --self-contained false -p:DebugType=none -o "$out/api"
if ($LASTEXITCODE -ne 0) { throw 'Build backend gagal.' }
Remove-Item "$out/api/appsettings.Development.json" -ErrorAction SilentlyContinue
Copy-Item -Recurse 'web/dist' "$out/web"

Write-Host '3/4 Salin berkas deploy (akhir baris diubah ke format Linux)...' -ForegroundColor Cyan
New-Item -ItemType Directory "$out/deploy" | Out-Null
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
Get-ChildItem 'deploy' -File | Where-Object { $_.Extension -ne '.ps1' } | ForEach-Object {
  $text = [System.IO.File]::ReadAllText($_.FullName) -replace "`r`n", "`n"
  [System.IO.File]::WriteAllText((Join-Path "$out/deploy" $_.Name), $text, $utf8NoBom)
}

Write-Host '4/4 Kemas menjadi ketikngebut.tar.gz...' -ForegroundColor Cyan
tar -czf "$out/ketikngebut.tar.gz" -C "$out" api web deploy
if ($LASTEXITCODE -ne 0) { throw 'Gagal membuat arsip.' }

$mb = (Get-Item "$out/ketikngebut.tar.gz").Length / 1MB
Write-Host ('Selesai: publish\ketikngebut.tar.gz ({0:N1} MB). Unggah berkas ini ke VPS.' -f $mb) -ForegroundColor Green

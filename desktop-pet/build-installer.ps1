# 构建小肥鱼桌面宠物：PyInstaller -> Inno Setup
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$assets = Join-Path $root 'desktop-pet\assets'
$icon = Join-Path $assets 'dsh-pet.ico'
$out = Join-Path $root 'artifacts\installer'
New-Item -ItemType Directory -Force -Path $out | Out-Null

$pyArgs = @(
  '--noconfirm', '--clean', '--windowed', '--onedir', '--name', 'DSH-Pet',
  '--icon', $icon,
  '--add-data', "$assets;assets",
  '--distpath', (Join-Path $out 'dist'),
  '--workpath', (Join-Path $out 'build'),
  '--specpath', $out,
  (Join-Path $root 'desktop-pet\pet.py')
)
& pyinstaller @pyArgs
if ($LASTEXITCODE -ne 0) { throw 'PyInstaller failed' }

$iscc = @(
  (Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 6\ISCC.exe'),
  'C:\Program Files (x86)\Inno Setup 6\ISCC.exe',
  'C:\Program Files\Inno Setup 6\ISCC.exe'
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) { throw 'Inno Setup ISCC.exe not found; install Inno Setup 6 first.' }

& $iscc (Join-Path $root 'desktop-pet\installer\dsh-pet.iss')
if ($LASTEXITCODE -ne 0) { throw 'Inno Setup failed' }
Write-Host "Installer written to $out"

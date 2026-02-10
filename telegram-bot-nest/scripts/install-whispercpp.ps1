param(
  [string]$ModelName = "ggml-base.bin"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$installRoot = Join-Path $repoRoot ".local\whispercpp"
New-Item -ItemType Directory -Force -Path $installRoot | Out-Null

function Ensure-Command {
  param(
    [string]$Name,
    [string]$WingetId
  )
  if (Get-Command $Name -ErrorAction SilentlyContinue) {
    return
  }
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw "winget no esta disponible. Instala '$Name' manualmente."
  }
  Write-Host "Instalando $Name con winget..."
  winget install --id $WingetId -e --accept-source-agreements --accept-package-agreements
}

Ensure-Command -Name "ffmpeg" -WingetId "Gyan.FFmpeg"

Write-Host "Descargando whisper.cpp (Windows x64)..."
$release = Invoke-RestMethod -Uri "https://api.github.com/repos/ggml-org/whisper.cpp/releases/latest" -Headers @{ "User-Agent" = "codex-setup" }
$asset = $release.assets | Where-Object { $_.name -eq "whisper-bin-x64.zip" } | Select-Object -First 1
if (-not $asset) {
  $asset = $release.assets | Where-Object { $_.name -eq "whisper-blas-bin-x64.zip" } | Select-Object -First 1
}
if (-not $asset) {
  $asset = $release.assets | Where-Object { $_.name -match "x64\\.zip$" } | Select-Object -First 1
}
if (-not $asset) {
  $names = ($release.assets | ForEach-Object { $_.name }) -join ", "
  throw "No encontre un binario Windows x64 en la release. Assets: $names"
}

$zipPath = Join-Path $installRoot "whisper-bin.zip"
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipPath
Expand-Archive -Path $zipPath -DestinationPath $installRoot -Force
Remove-Item $zipPath -Force

$cliExe = Get-ChildItem -Path $installRoot -Recurse -Filter "whisper-cli.exe" | Select-Object -First 1
if (-not $cliExe) {
  $cliExe = Get-ChildItem -Path $installRoot -Recurse -Filter "main.exe" | Select-Object -First 1
}
if (-not $cliExe) {
  throw "No encontre whisper-cli.exe ni main.exe en el paquete descargado."
}

$modelPath = Join-Path $installRoot $ModelName
$needsModel = $true
if (Test-Path $modelPath) {
  $file = Get-Item $modelPath
  if ($file.Length -gt 0) {
    $needsModel = $false
  }
}
if ($needsModel) {
  Write-Host "Descargando modelo $ModelName..."
  $modelUrl = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/$ModelName"
  Invoke-WebRequest -Uri $modelUrl -OutFile $modelPath
}

$ffmpegPath = $null
$cmd = Get-Command ffmpeg -ErrorAction SilentlyContinue
if ($cmd) {
  $ffmpegPath = $cmd.Source
}
if (-not $ffmpegPath) {
  $winGetRoot = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages"
  if (Test-Path $winGetRoot) {
    $found = Get-ChildItem -Path $winGetRoot -Recurse -Filter ffmpeg.exe -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) {
      $ffmpegPath = $found.FullName
    }
  }
}
if (-not $ffmpegPath) {
  $ffmpegPath = "ffmpeg"
}

$envPath = Join-Path $repoRoot ".env"
if (-not (Test-Path $envPath)) {
  Copy-Item (Join-Path $repoRoot ".env.example") $envPath
}

function Set-EnvLine {
  param(
    [string]$Key,
    [string]$Value
  )

  $lines = @()
  if (Test-Path $envPath) {
    $lines = Get-Content $envPath
  }

  $found = $false
  $newLines = foreach ($line in $lines) {
    if ($line -match "^$Key=") {
      $found = $true
      "$Key=$Value"
    } else {
      $line
    }
  }

  if (-not $found) {
    $newLines += "$Key=$Value"
  }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllLines($envPath, $newLines, $utf8NoBom)
}

Set-EnvLine -Key "STT_PROVIDER" -Value "whispercpp"
Set-EnvLine -Key "WHISPER_CPP_PATH" -Value $cliExe.FullName
Set-EnvLine -Key "WHISPER_MODEL_PATH" -Value $modelPath
Set-EnvLine -Key "WHISPER_LANGUAGE" -Value "es"
Set-EnvLine -Key "FFMPEG_PATH" -Value $ffmpegPath

Write-Host "Listo. Reinicia el bot con: pnpm run start:dev"

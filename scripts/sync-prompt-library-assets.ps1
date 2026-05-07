$ErrorActionPreference = 'Stop'

$rootDir = Split-Path -Parent $PSScriptRoot
$libraryDir = Join-Path $rootDir 'public\prompt-library'
$manifestPath = Join-Path $libraryDir 'asset-manifest.json'
$coversDir = Join-Path $libraryDir 'covers'
$thumbsDir = Join-Path $libraryDir 'cases\thumbs'
$cacheDir = Join-Path $libraryDir '.cache'

if (-not (Test-Path -LiteralPath $manifestPath)) {
  throw "Asset manifest not found: $manifestPath"
}

Add-Type -AssemblyName System.Drawing

function Ensure-Dir {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

function Reset-Dir {
  param([string]$Path)
  Ensure-Dir -Path $Path
  Get-ChildItem -LiteralPath $Path -Force | Remove-Item -Recurse -Force
}

function Get-Encoder {
  param([string]$MimeType)
  return [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
    Where-Object { $_.MimeType -eq $MimeType } |
    Select-Object -First 1
}

function Save-JpegThumbnail {
  param(
    [string]$SourcePath,
    [string]$TargetPath,
    [int]$MaxWidth,
    [int]$MaxHeight,
    [long]$Quality = 82
  )

  $image = $null
  $bitmap = $null
  $graphics = $null

  try {
    $image = [System.Drawing.Image]::FromFile($SourcePath)
    $scale = [Math]::Min($MaxWidth / $image.Width, $MaxHeight / $image.Height)
    if ($scale -gt 1) { $scale = 1 }

    $width = [Math]::Max([int][Math]::Round($image.Width * $scale), 1)
    $height = [Math]::Max([int][Math]::Round($image.Height * $scale), 1)

    $bitmap = New-Object System.Drawing.Bitmap($width, $height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::White)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.DrawImage($image, 0, 0, $width, $height)

    $encoder = Get-Encoder -MimeType 'image/jpeg'
    $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, $Quality)

    Ensure-Dir -Path (Split-Path -Parent $TargetPath)
    $bitmap.Save($TargetPath, $encoder, $encoderParams)
  }
  finally {
    if ($graphics) { $graphics.Dispose() }
    if ($bitmap) { $bitmap.Dispose() }
    if ($image) { $image.Dispose() }
  }
}

function Download-File {
  param(
    [string]$Url,
    [string]$TargetPath
  )

  Invoke-WebRequest -Uri $Url -OutFile $TargetPath
}

function Sync-ImageSet {
  param(
    [object[]]$Items,
    [string]$DestinationRoot,
    [int]$MaxWidth,
    [int]$MaxHeight,
    [string]$Label
  )

  $count = $Items.Count
  for ($index = 0; $index -lt $count; $index += 1) {
    $item = $Items[$index]
    if ([string]::IsNullOrWhiteSpace($item.url)) { continue }

    $relativeOutput = [string]$item.output
    $targetPath = Join-Path $libraryDir $relativeOutput.Replace('/', '\')
    $tempPath = Join-Path $cacheDir ([System.IO.Path]::GetFileName($relativeOutput) + '.download')

    Download-File -Url $item.url -TargetPath $tempPath
    Save-JpegThumbnail -SourcePath $tempPath -TargetPath $targetPath -MaxWidth $MaxWidth -MaxHeight $MaxHeight

    if ((($index + 1) % 25) -eq 0 -or ($index + 1) -eq $count) {
      Write-Host "$Label $($index + 1)/$count"
    }
  }
}

Ensure-Dir -Path $libraryDir
Reset-Dir -Path $coversDir
Reset-Dir -Path $thumbsDir
Reset-Dir -Path $cacheDir

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json

Sync-ImageSet -Items @($manifest.covers) -DestinationRoot $coversDir -MaxWidth 720 -MaxHeight 420 -Label 'covers'
Sync-ImageSet -Items @($manifest.cases) -DestinationRoot $thumbsDir -MaxWidth 640 -MaxHeight 640 -Label 'cases'

Remove-Item -LiteralPath $cacheDir -Recurse -Force
Write-Host 'Prompt library thumbnails synced.'

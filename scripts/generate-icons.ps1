# Genera icon.png, tray.png e icon.ico de Hora: anillo abierto, fondo transparente.
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$resources = Join-Path (Split-Path $PSScriptRoot -Parent) "resources"
New-Item -ItemType Directory -Force -Path $resources | Out-Null

function Get-Point([single]$cx, [single]$cy, [single]$angleDeg, [single]$length) {
  $rad = $angleDeg * [Math]::PI / 180
  return New-Object System.Drawing.PointF (
    ($cx + [Math]::Cos($rad) * $length),
    ($cy + [Math]::Sin($rad) * $length)
  )
}

function New-HoraIcon([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)

  $cx = $size / 2
  $cy = $size / 2
  $stroke = if ($size -le 16) {
    [Math]::Max(2.2, $size * 0.22)
  } elseif ($size -le 32) {
    $size * 0.175
  } else {
    $size * 0.12
  }

  $inset = ($size * 0.07) + ($stroke / 2)
  $span = $size - (2 * $inset)
  $ring = New-Object System.Drawing.RectangleF $inset, $inset, $span, $span

  $copperPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(200, 196, 106, 58), $stroke)
  $copperPen.Alignment = [System.Drawing.Drawing2D.PenAlignment]::Center
  $g.DrawEllipse($copperPen, $ring)

  $sageWidth = [Math]::Max(1.6, $stroke * 0.7)
  $sagePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(175, 143, 165, 122), $sageWidth)
  $sagePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $sagePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawArc($sagePen, $ring, -90, 102)

  $tickWidth = if ($size -le 16) { [Math]::Max(1.5, $size * 0.13) } else { $size * 0.07 }
  $creamPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(220, 244, 238, 228), $tickWidth)
  $creamPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $creamPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  $inner = ($span / 2) - ($stroke * 0.15)
  $tickStart = Get-Point $cx $cy -90 ($inner * 0.18)
  $tickEnd = Get-Point $cx $cy -90 ($inner * 0.72)
  $g.DrawLine($creamPen, $tickStart, $tickEnd)

  $hubR = [Math]::Max(1.05, $size * 0.042)
  $hub = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(200, 196, 106, 58))
  $g.FillEllipse($hub, ($cx - $hubR), ($cy - $hubR), ($hubR * 2), ($hubR * 2))

  $copperPen.Dispose()
  $sagePen.Dispose()
  $creamPen.Dispose()
  $hub.Dispose()
  $g.Dispose()
  return $bmp
}

function Get-PngBytes([System.Drawing.Bitmap]$bmp) {
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $bytes = $ms.ToArray()
  $ms.Dispose()
  return , [byte[]]$bytes
}

function Save-Png([System.Drawing.Bitmap]$bmp, [string]$path) {
  if (Test-Path $path) {
    Remove-Item $path -Force
  }
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Save-Ico([object[]]$frames, [string]$path) {
  $count = $frames.Count
  $offset = 6 + (16 * $count)
  $fs = [System.IO.File]::Create($path)
  try {
    $header = New-Object byte[] (6 + (16 * $count))
    [BitConverter]::GetBytes([uint16]0).CopyTo($header, 0)
    [BitConverter]::GetBytes([uint16]1).CopyTo($header, 2)
    [BitConverter]::GetBytes([uint16]$count).CopyTo($header, 4)
    $cursor = 6
    foreach ($frame in $frames) {
      $bytes = [byte[]]$frame.Bytes
      $dim = if ($frame.Width -ge 256) { [byte]0 } else { [byte]$frame.Width }
      $header[$cursor] = $dim
      $header[$cursor + 1] = $dim
      $header[$cursor + 2] = 0
      $header[$cursor + 3] = 0
      [BitConverter]::GetBytes([uint16]1).CopyTo($header, $cursor + 4)
      [BitConverter]::GetBytes([uint16]32).CopyTo($header, $cursor + 6)
      [BitConverter]::GetBytes([uint32]$bytes.Length).CopyTo($header, $cursor + 8)
      [BitConverter]::GetBytes([uint32]$offset).CopyTo($header, $cursor + 12)
      $offset += $bytes.Length
      $cursor += 16
    }
    $fs.Write($header, 0, $header.Length)
    foreach ($frame in $frames) {
      $bytes = [byte[]]$frame.Bytes
      $fs.Write($bytes, 0, $bytes.Length)
    }
  } finally {
    $fs.Dispose()
  }
}

$app = New-HoraIcon 256
Save-Png $app (Join-Path $resources "icon.png")

$tray = New-HoraIcon 32
Save-Png $tray (Join-Path $resources "tray.png")
$tray.Dispose()

$icoSizes = @(16, 24, 32, 48, 64, 128, 256)
$frames = New-Object System.Collections.Generic.List[object]
foreach ($size in $icoSizes) {
  $bmp = if ($size -eq 256) { $app } else { New-HoraIcon $size }
  $frames.Add([pscustomobject]@{
    Width = $size
    Bytes = Get-PngBytes $bmp
  })
  if ($size -ne 256) {
    $bmp.Dispose()
  }
}
Save-Ico $frames.ToArray() (Join-Path $resources "icon.ico")
$app.Dispose()

Write-Host "Iconos generados en $resources"

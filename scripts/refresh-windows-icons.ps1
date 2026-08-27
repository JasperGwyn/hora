param(
  [Parameter(Mandatory = $true)]
  [string]$InstallDir
)

$ErrorActionPreference = "Stop"

$exe = Join-Path $InstallDir "Hora.exe"
$ico = Join-Path $InstallDir "resources\icon.ico"
if (-not (Test-Path $exe)) {
  throw "No encontré $exe"
}

$iconLocation = if (Test-Path $ico) { "$ico,0" } else { "$exe,0" }
$links = @(
  (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Hora.lnk"),
  (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Hora\Hora.lnk"),
  (Join-Path $env:USERPROFILE "Desktop\Hora.lnk")
)
if ($env:PUBLIC) {
  $links += Join-Path $env:PUBLIC "Desktop\Hora.lnk"
}

$shell = New-Object -ComObject WScript.Shell
foreach ($link in $links) {
  if (-not (Test-Path $link)) {
    continue
  }
  $shortcut = $shell.CreateShortcut($link)
  $shortcut.TargetPath = $exe
  $shortcut.WorkingDirectory = $InstallDir
  $shortcut.IconLocation = $iconLocation
  $shortcut.Save()
}

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class HoraShellNotify {
  [DllImport("shell32.dll")]
  public static extern void SHChangeNotify(int eventId, uint flags, IntPtr item1, IntPtr item2);
}
"@
[HoraShellNotify]::SHChangeNotify(0x08000000, 0x1000, [IntPtr]::Zero, [IntPtr]::Zero)

$ie4 = Join-Path $env:SystemRoot "System32\ie4uinit.exe"
if (Test-Path $ie4) {
  & $ie4 -show | Out-Null
}

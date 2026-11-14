param([string]$HtmlDir, [string]$OutRoot, [string]$Only = '')
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$pieces = Get-Content (Join-Path $HtmlDir 'pieces.json') -Raw -Encoding utf8 | ConvertFrom-Json
foreach ($p in $pieces) {
  if ($Only -and $p.name -notlike $Only) { continue }
  $dir = Join-Path $OutRoot $p.folder
  New-Item -ItemType Directory -Force $dir | Out-Null
  $out = Join-Path $dir ($p.name + '.png')
  if (Test-Path $out) { Remove-Item $out -Force }
  $tmp = Join-Path $HtmlDir ($p.name + '.png')
  if (Test-Path $tmp) { Remove-Item $tmp -Force }
  $budget = if ($p.name -like '*reels*') { 25000 } else { 6000 }
  $url = ([System.Uri](Join-Path $HtmlDir ($p.name + '.html'))).AbsoluteUri
  $args = @('--headless=new', '--disable-gpu', '--no-first-run', "--user-data-dir=$HtmlDir\edge-profile", '--hide-scrollbars',
    '--force-device-scale-factor=1', "--window-size=$($p.w),$($p.h)", "--virtual-time-budget=$budget", '--allow-file-access-from-files',
    "--screenshot=$tmp", $url)
  $proc = Start-Process -FilePath $edge -ArgumentList $args -PassThru -WindowStyle Hidden
  if (-not $proc.WaitForExit(90000)) { Stop-Process -Id $proc.Id -Force; Write-Output "TIMEOUT $($p.name)"; continue }
  if (Test-Path $tmp) { Move-Item $tmp $out -Force }
  if (Test-Path $out) { Write-Output ("ok  {0}  {1} KB" -f $p.name, [int]((Get-Item $out).Length / 1KB)) } else { Write-Output "FALHOU $($p.name)" }
}

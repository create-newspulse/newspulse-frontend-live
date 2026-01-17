param(
  [Parameter(Mandatory = $false)]
  [string]$BackendBase = 'http://localhost:3010'
)

$ErrorActionPreference = 'Stop'
$base = $BackendBase.Trim().TrimEnd('/')

Write-Host "Checking backend connectivity: $base" -ForegroundColor Cyan

$paths = @(
  '/api/public/settings',
  '/api/system/public-mode'
)

foreach ($p in $paths) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 -Uri ($base + $p)
    Write-Host ("{0} => {1}" -f $p, $r.StatusCode)
  } catch {
    $msg = $_.Exception.Message
    Write-Host ("{0} => FAIL ({1})" -f $p, $msg) -ForegroundColor Yellow
  }
}

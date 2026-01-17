param(
  [string]$Base = ''
)

$ErrorActionPreference = 'Stop'

function Resolve-NextBase {
  param([string]$ProvidedBase)

  if ($ProvidedBase -and $ProvidedBase.Trim() -ne '') {
    return $ProvidedBase.Trim().TrimEnd('/')
  }

  $portsToTry = 3000..3010
  foreach ($port in $portsToTry) {
    $candidate = "http://localhost:$port"
    try {
      $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri ($candidate + '/_devPagesManifest.json')
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) {
        return $candidate
      }
    } catch {
      # ignore
    }
  }

  return 'http://localhost:3000'
}

$baseResolved = Resolve-NextBase -ProvidedBase $Base

Write-Host "Probing Next endpoints at $baseResolved" -ForegroundColor Cyan

$paths = @(
  '/_devPagesManifest.json',
  '/api/public/mode',
  '/api/public/settings',
  '/api/public/news?category=top&limit=1',
  '/api/public/stories'
)

foreach ($p in $paths) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 -Uri ($baseResolved + $p)
    Write-Host ("{0} => {1}" -f $p, $r.StatusCode)
  } catch {
    $msg = $_.Exception.Message
    Write-Host ("{0} => FAIL ({1})" -f $p, $msg) -ForegroundColor Yellow
  }
}

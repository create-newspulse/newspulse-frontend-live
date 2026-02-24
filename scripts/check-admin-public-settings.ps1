param(
  [Parameter(Mandatory = $false)]
  [string]$Base = 'http://localhost:3000',

  [Parameter(Mandatory = $false)]
  [string]$Token
)

$ErrorActionPreference = 'Stop'
$base = $Base.Trim().TrimEnd('/')

$draft = "$base/api/admin/settings/public/draft"
$publish = "$base/api/admin/settings/public/publish"

$authHeaders = @{}
if ($Token -and $Token.Trim()) {
  $authHeaders['Authorization'] = "Bearer $($Token.Trim())"
}

Write-Host "GET $draft" -ForegroundColor Cyan
$d = Invoke-RestMethod -Method GET -Uri $draft -Headers (@{ Accept = 'application/json' } + $authHeaders)
$d | ConvertTo-Json -Depth 10

Write-Host "`nOPTIONS $draft (Origin 5173)" -ForegroundColor Cyan
$opt = Invoke-WebRequest -UseBasicParsing -Method OPTIONS -Uri $draft -Headers (@{ Origin = 'http://localhost:5173'; 'Access-Control-Request-Method' = 'PUT'; 'Access-Control-Request-Headers' = 'Content-Type' } + $authHeaders)
$opt.StatusCode
$opt.Headers | ConvertTo-Json -Depth 6

Write-Host "`nPUT $draft (toggle footer off)" -ForegroundColor Cyan
$body = @{ settings = @{ modules = @{ footer = @{ enabled = $false; order = 20 } } } } | ConvertTo-Json -Depth 10
$put = Invoke-RestMethod -Method PUT -Uri $draft -ContentType 'application/json' -Body $body -Headers (@{ Accept = 'application/json' } + $authHeaders)
$put | ConvertTo-Json -Depth 10

Write-Host "`nPOST $publish" -ForegroundColor Cyan
if (-not ($Token -and $Token.Trim())) {
  Write-Host "Skipping publish (no -Token provided)." -ForegroundColor Yellow
  exit 0
}

try {
  $p = Invoke-RestMethod -Method POST -Uri $publish -Headers (@{ Accept = 'application/json' } + $authHeaders)
  $p | ConvertTo-Json -Depth 10
} catch {
  $resp = $_.Exception.Response
  if ($resp -and $resp.StatusCode -eq 401) {
    Write-Host "Publish returned 401 (Unauthorized). Check your -Token." -ForegroundColor Yellow
    exit 0
  }
  throw
}

param(
  [Parameter(Mandatory = $false)]
  [string]$Base = 'http://localhost:3000'
)

$ErrorActionPreference = 'Stop'
$base = $Base.Trim().TrimEnd('/')

$draft = "$base/api/admin/settings/public/draft"
$publish = "$base/api/admin/settings/public/publish"

Write-Host "GET $draft" -ForegroundColor Cyan
$d = Invoke-RestMethod -Method GET -Uri $draft -Headers @{ Accept = 'application/json' }
$d | ConvertTo-Json -Depth 10

Write-Host "`nOPTIONS $draft (Origin 5173)" -ForegroundColor Cyan
$opt = Invoke-WebRequest -Method OPTIONS -Uri $draft -Headers @{ Origin = 'http://localhost:5173'; 'Access-Control-Request-Method' = 'PUT'; 'Access-Control-Request-Headers' = 'Content-Type' }
$opt.StatusCode
$opt.Headers | ConvertTo-Json -Depth 6

Write-Host "`nPUT $draft (toggle footer off)" -ForegroundColor Cyan
$body = @{ settings = @{ modules = @{ footer = @{ enabled = $false; order = 20 } } } } | ConvertTo-Json -Depth 10
$put = Invoke-RestMethod -Method PUT -Uri $draft -ContentType 'application/json' -Body $body -Headers @{ Accept = 'application/json' }
$put | ConvertTo-Json -Depth 10

Write-Host "`nPOST $publish" -ForegroundColor Cyan
$p = Invoke-RestMethod -Method POST -Uri $publish -Headers @{ Accept = 'application/json' }
$p | ConvertTo-Json -Depth 10

param(
  [Parameter(Mandatory = $false)]
  [string]$Base = 'http://localhost:3010'
)

$ErrorActionPreference = 'Stop'
$base = $Base.Trim().TrimEnd('/')

Write-Host "Checking site-settings endpoints: $base" -ForegroundColor Cyan

$pub = Invoke-RestMethod -Method GET -Uri "$base/api/site-settings/public"
$adm = Invoke-RestMethod -Method GET -Uri "$base/api/site-settings/admin"
$put = Invoke-RestMethod -Method PUT -Uri "$base/api/site-settings/admin" -ContentType 'application/json' -Body '{"liveTickerOn":false,"breakingMode":"off","liveSpeedSec":30}'

@{ public = $pub; admin = $adm; put = $put } | ConvertTo-Json -Depth 8

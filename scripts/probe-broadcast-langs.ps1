param(
  [Parameter(Mandatory = $false)]
  [string]$Base = 'http://localhost:3000'
)

$ErrorActionPreference = 'Stop'
$base = $Base.Trim().TrimEnd('/')

$endpoint = "$base/api/public/broadcast"

foreach ($lang in @('en', 'hi', 'gu')) {
  $url = "${endpoint}?lang=$lang"
  Write-Host "GET $url" -ForegroundColor Cyan

  try {
    $resp = Invoke-WebRequest -UseBasicParsing -Method GET -Uri $url
    Write-Host ("{0} {1}" -f $lang, $resp.StatusCode) -ForegroundColor Green

    try {
      $json = $resp.Content | ConvertFrom-Json
      $breaking = $json.breaking
      $live = $json.live

      if ($breaking -or $live) {
        $summary = @{
          breaking = @{
            enabled = $breaking.enabled
            mode = $breaking.mode
            durationSec = $breaking.durationSec
            items = @($breaking.items).Count
          }
          live = @{
            enabled = $live.enabled
            mode = $live.mode
            durationSec = $live.durationSec
            items = @($live.items).Count
          }
        }
        $summary | ConvertTo-Json -Depth 6
      } else {
        $json | ConvertTo-Json -Depth 6
      }
    } catch {
      Write-Host "(non-JSON response body)" -ForegroundColor Yellow
    }

    Write-Host ""
  } catch {
    $code = $null
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
      $code = $_.Exception.Response.StatusCode.value__
    }
    $codeText = if ($null -ne $code) { $code } else { 'unknown' }
    Write-Host ("{0} ERR {1}" -f $lang, $codeText) -ForegroundColor Red
    Write-Host ""
  }
}

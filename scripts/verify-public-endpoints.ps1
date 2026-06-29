param(
  [Parameter(Mandatory = $false)]
  [string]$ProjectId = "project-a4cef2bd-9f4d-4539-b02",

  [Parameter(Mandatory = $false)]
  [string]$Region = "us-central1",

  [Parameter(Mandatory = $false)]
  [string]$ServiceName = "telegram-ai-router",

  [Parameter(Mandatory = $false)]
  [string]$ExpectedRevision = "telegram-ai-router-00016-tzj",

  [Parameter(Mandatory = $false)]
  [string]$GcloudPath = ""
)

$ErrorActionPreference = "Stop"

$workspaceRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$bundledGcloud = Join-Path $workspaceRoot "tools\google-cloud-cli-bundled-tar\google-cloud-sdk\bin\gcloud.cmd"
$env:CLOUDSDK_CONFIG = Join-Path $workspaceRoot ".gcloud-config"

foreach ($name in @("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy")) {
  Remove-Item "Env:$name" -ErrorAction SilentlyContinue
}

if (-not $GcloudPath) {
  if (Test-Path $bundledGcloud) {
    $GcloudPath = $bundledGcloud
  } else {
    $gcloudCommand = Get-Command gcloud -ErrorAction SilentlyContinue
    if (-not $gcloudCommand) {
      throw "gcloud was not found in PATH and bundled gcloud was not found at $bundledGcloud"
    }
    $GcloudPath = $gcloudCommand.Source
  }
}

$serviceJson = & $GcloudPath run services describe $ServiceName `
  --project $ProjectId `
  --region $Region `
  --format json | ConvertFrom-Json

$serviceUrl = $serviceJson.status.url
if (-not $serviceUrl) {
  throw "Cloud Run service URL was empty."
}

$traffic = @($serviceJson.status.traffic)
$activeTraffic = $traffic | Where-Object { $_.percent -eq 100 } | Select-Object -First 1
if (-not $activeTraffic -or $activeTraffic.revisionName -ne $ExpectedRevision) {
  throw "Expected 100 percent traffic on $ExpectedRevision, got $($activeTraffic.revisionName)"
}

Write-Host "Public endpoint verification for $serviceUrl"
Write-Host "Traffic OK: 100% $($activeTraffic.revisionName)"

$rootResponse = Invoke-RestMethod -Uri "$serviceUrl/" -Method Get
if ($rootResponse.ok -ne $true -or $rootResponse.service -ne $ServiceName -or $rootResponse.dryRun -ne $false) {
  throw "Root health response did not match expected production shape."
}
Write-Host "Root endpoint OK: service=$($rootResponse.service), dryRun=$($rootResponse.dryRun)"

$payloadPath = Join-Path (Get-Location) "test-payloads\telegram-message.json"
$fakeWebhookBodyFile = [System.IO.Path]::GetTempFileName()
try {
  $statusText = & curl.exe `
    -sS `
    -o $fakeWebhookBodyFile `
    -w "%{http_code}" `
    -H "Content-Type: application/json" `
    -X POST `
    --data-binary "@$payloadPath" `
    "$serviceUrl/webhook/telegram"

  if ($LASTEXITCODE -ne 0) {
    throw "curl webhook secret gate check failed with exit code $LASTEXITCODE"
  }

  $fakeWebhookStatusCode = [int]$statusText
  $fakeWebhookContent = Get-Content -LiteralPath $fakeWebhookBodyFile -Raw
} finally {
  Remove-Item -LiteralPath $fakeWebhookBodyFile -Force -ErrorAction SilentlyContinue
}

if ($fakeWebhookStatusCode -ne 401) {
  throw "Webhook secret gate expected HTTP 401, got $fakeWebhookStatusCode"
}

$fakeWebhookBody = $fakeWebhookContent | ConvertFrom-Json
if ($fakeWebhookBody.ok -ne $false -or $fakeWebhookBody.error -ne "invalid_telegram_webhook_secret") {
  throw "Webhook secret gate response body did not match expected shape."
}
Write-Host "Webhook secret gate OK: HTTP 401 invalid_telegram_webhook_secret"

$logRows = & $GcloudPath logging read "resource.type=`"cloud_run_revision`" AND resource.labels.service_name=`"$ServiceName`" AND resource.labels.revision_name=`"$ExpectedRevision`" AND jsonPayload.event=`"telegram_webhook_error`"" `
  --project $ProjectId `
  --limit 10 `
  --format json | ConvertFrom-Json

$recentErrorRows = @($logRows)
if (-not $recentErrorRows) {
  throw "No recent telegram_webhook_error structured logs were found."
}

foreach ($row in $recentErrorRows) {
  $payload = $row.jsonPayload
  if ($payload.PSObject.Properties.Name -contains "chatId") {
    throw "Raw chatId was found in structured error log."
  }
  if ($payload.PSObject.Properties.Name -contains "chatHash" -and -not $payload.chatHash) {
    throw "Empty chatHash was found in structured error log."
  }
}

Write-Host "Structured error log privacy OK: no raw chatId in checked rows."
Write-Host "Public endpoint verification complete. No secrets were read, no webhook was changed, and no Telegram message was sent."

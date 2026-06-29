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
  [string]$GcloudPath = "",

  [switch]$CheckTelegramWebhook
)

$ErrorActionPreference = "Stop"

$workspaceRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$bundledGcloud = Join-Path $workspaceRoot "tools\google-cloud-cli-bundled-tar\google-cloud-sdk\bin\gcloud.cmd"
$bundledPython = Join-Path $workspaceRoot "tools\google-cloud-cli-bundled-tar\google-cloud-sdk\platform\bundledpython\python.exe"
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

Write-Host "Read-only verification for $ServiceName in $ProjectId/$Region"

$serviceJson = & $GcloudPath run services describe $ServiceName `
  --project $ProjectId `
  --region $Region `
  --format json | ConvertFrom-Json

$traffic = @($serviceJson.status.traffic)
$activeTraffic = $traffic | Where-Object { $_.percent -eq 100 } | Select-Object -First 1

if (-not $activeTraffic) {
  throw "No revision has 100 percent traffic."
}

if ($activeTraffic.revisionName -ne $ExpectedRevision) {
  throw "Expected 100 percent traffic on $ExpectedRevision, got $($activeTraffic.revisionName)"
}

Write-Host "Cloud Run traffic OK: 100% $($activeTraffic.revisionName)"
Write-Host "Cloud Run URL: $($serviceJson.status.url)"

$logRows = & $GcloudPath logging read "resource.type=`"cloud_run_revision`" AND resource.labels.service_name=`"$ServiceName`" AND resource.labels.revision_name=`"$ExpectedRevision`" AND jsonPayload.event:*" `
  --project $ProjectId `
  --limit 20 `
  --format json | ConvertFrom-Json

$webhookRows = @($logRows) | Where-Object {
  $_.jsonPayload.event -in @("telegram_update_received", "ai_reply_generated", "telegram_reply_sent", "telegram_reply_skipped_dry_run")
}

foreach ($row in $webhookRows) {
  $payload = $row.jsonPayload
  if ($payload.PSObject.Properties.Name -contains "chatId") {
    throw "Raw chatId was found in structured logs for event $($payload.event)"
  }
  if (($payload.event -ne "service_started") -and ($payload.PSObject.Properties.Name -contains "chatHash") -and (-not $payload.chatHash)) {
    throw "Empty chatHash was found in structured logs for event $($payload.event)"
  }
}

Write-Host "Structured log privacy OK: no raw chatId in checked rows."

if ($CheckTelegramWebhook) {
  if (-not (Test-Path $bundledPython)) {
    throw "Bundled Python was not found at $bundledPython"
  }

  $token = & $GcloudPath secrets versions access latest --secret=telegram-bot-token --project $ProjectId
  $env:TG_BOT_TOKEN_FOR_INFO = $token
  try {
    & $bundledPython -c "import os,json,urllib.request; token=os.environ['TG_BOT_TOKEN_FOR_INFO']; r=urllib.request.urlopen('https://api.telegram.org/bot'+token+'/getWebhookInfo',timeout=60); d=json.loads(r.read().decode())['result']; print('Telegram webhook URL:', d.get('url')); print('Telegram pending_update_count:', d.get('pending_update_count')); print('Telegram last_error_message:', d.get('last_error_message'))"
  } finally {
    Remove-Item Env:TG_BOT_TOKEN_FOR_INFO -ErrorAction SilentlyContinue
    $token = $null
  }
} else {
  Write-Host "Telegram webhook check skipped. Re-run with -CheckTelegramWebhook to read bot token from Secret Manager without printing it."
}

Write-Host "Read-only production verification complete. No Cloud Run deploy, Secret Manager change, webhook change, or Telegram message was performed."

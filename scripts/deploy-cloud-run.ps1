param(
  [Parameter(Mandatory = $false)]
  [string]$ProjectId = "",

  [Parameter(Mandatory = $false)]
  [string]$Region = "us-central1",

  [Parameter(Mandatory = $false)]
  [string]$ServiceName = "",

  [Parameter(Mandatory = $false)]
  [string]$ServiceAccount = "",

  [Parameter(Mandatory = $false)]
  [string]$VertexModel = "gemini-2.5-flash",

  [Parameter(Mandatory = $false)]
  [string]$TokenRotatedAt = "",

  [Parameter(Mandatory = $false)]
  [string]$LogPrivacyRev = "",

  [Parameter(Mandatory = $false)]
  [string]$GcloudPath = "",

  [switch]$ConfirmDeploy
)

$ErrorActionPreference = "Stop"

if (-not $ProjectId -or -not $ServiceName -or -not $ServiceAccount) {
  throw "ProjectId, ServiceName, and ServiceAccount are required. This public template has no production defaults."
}

if (-not $ConfirmDeploy) {
  Write-Host "Dry run only. Re-run with -ConfirmDeploy to deploy to Cloud Run."
  Write-Host "Project: $ProjectId"
  Write-Host "Region:  $Region"
  Write-Host "Service: $ServiceName"
  if ($ServiceAccount) {
    Write-Host "Service account: $ServiceAccount"
  }
  Write-Host "Dry run env: false"
  Write-Host "Vertex model: $VertexModel"
  Write-Host "Token rotated at: $TokenRotatedAt"
  Write-Host "Log privacy rev: $LogPrivacyRev"
  if ($GcloudPath) {
    Write-Host "gcloud path: $GcloudPath"
  } else {
    Write-Host "gcloud path: auto-detect"
  }
  exit 0
}

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

if (-not (Test-Path $GcloudPath) -and -not (Get-Command $GcloudPath -ErrorAction SilentlyContinue)) {
  throw "gcloud executable was not found: $GcloudPath"
}

$envVars = @(
  "NODE_ENV=production",
  "DRY_RUN=false",
  "GOOGLE_CLOUD_PROJECT=$ProjectId",
  "GOOGLE_CLOUD_LOCATION=$Region",
  "VERTEX_MODEL=$VertexModel",
  "TOKEN_ROTATED_AT=$TokenRotatedAt",
  "LOG_PRIVACY_REV=$LogPrivacyRev"
) -join ","

$args = @(
  "run", "deploy", $ServiceName,
  "--source", ".",
  "--project", $ProjectId,
  "--region", $Region,
  "--allow-unauthenticated",
  "--service-account", $ServiceAccount,
  "--set-env-vars", $envVars,
  "--set-secrets", "TELEGRAM_BOT_TOKEN=telegram-bot-token:latest,TELEGRAM_WEBHOOK_SECRET=telegram-webhook-secret:latest"
)

& $GcloudPath @args

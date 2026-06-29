param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [Parameter(Mandatory = $true)]
  [string]$WebhookUrl,

  [string]$BotTokenSecretName = "telegram-bot-token",

  [string]$WebhookSecretName = "telegram-webhook-secret",

  [string]$GcloudPath = "gcloud",

  [string]$CloudSdkConfig = ""
)

$ErrorActionPreference = "Stop"

if ($CloudSdkConfig) {
  $env:CLOUDSDK_CONFIG = $CloudSdkConfig
}

$botToken = & $GcloudPath secrets versions access latest --secret $BotTokenSecretName --project $ProjectId
$webhookSecret = & $GcloudPath secrets versions access latest --secret $WebhookSecretName --project $ProjectId

if ([string]::IsNullOrWhiteSpace($botToken)) {
  throw "Telegram bot token secret is empty or has no latest version."
}

if ([string]::IsNullOrWhiteSpace($webhookSecret)) {
  throw "Telegram webhook secret is empty or has no latest version."
}

$body = @{
  url = $WebhookUrl
  secret_token = $webhookSecret
  allowed_updates = @("message")
  drop_pending_updates = $true
} | ConvertTo-Json -Compress

$response = Invoke-RestMethod `
  -Method Post `
  -Uri "https://api.telegram.org/bot$botToken/setWebhook" `
  -ContentType "application/json" `
  -Body $body

if (-not $response.ok) {
  throw "Telegram setWebhook failed: $($response.description)"
}

Write-Host "Telegram webhook set successfully. Tokens were not printed."

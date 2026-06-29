param(
  [Parameter(Mandatory = $true)]
  [string]$CloudRunUrl,

  [Parameter(Mandatory = $true)]
  [string]$WebhookSecret,

  [switch]$ConfirmSetWebhook
)

$ErrorActionPreference = "Stop"

$webhookUrl = "$CloudRunUrl/webhook/telegram"

Write-Host "Target webhook URL:"
Write-Host $webhookUrl
Write-Host ""
Write-Host "This script does not read or print TELEGRAM_BOT_TOKEN."
Write-Host "Run the command below only from a secure shell where TELEGRAM_BOT_TOKEN is set."
Write-Host ""

$command = @"
Invoke-RestMethod -Method Post `
  -Uri "https://api.telegram.org/bot`$env:TELEGRAM_BOT_TOKEN/setWebhook" `
  -ContentType "application/json" `
  -Body (@{
    url = "$webhookUrl"
    secret_token = "$WebhookSecret"
    drop_pending_updates = `$true
  } | ConvertTo-Json)
"@

if (-not $ConfirmSetWebhook) {
  Write-Host "Dry run only. Re-run with -ConfirmSetWebhook to print the exact command."
  exit 0
}

Write-Host $command

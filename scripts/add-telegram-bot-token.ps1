param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [string]$SecretName = "telegram-bot-token",

  [string]$GcloudPath = "gcloud",

  [string]$CloudSdkConfig = ""
)

$ErrorActionPreference = "Stop"

Write-Host "Enter Telegram bot token. Input is hidden and will not be printed."
$secureToken = Read-Host "TELEGRAM_BOT_TOKEN" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)

try {
  $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  if ([string]::IsNullOrWhiteSpace($token)) {
    throw "Telegram bot token cannot be empty."
  }

  $tmp = [System.IO.Path]::GetTempFileName()
  try {
    [System.IO.File]::WriteAllText($tmp, $token, [System.Text.Encoding]::ASCII)
    if ($CloudSdkConfig) {
      $env:CLOUDSDK_CONFIG = $CloudSdkConfig
    }
    & $GcloudPath secrets versions add $SecretName --project $ProjectId --data-file $tmp --quiet
    Write-Host "Secret version added for $SecretName. Token was not printed."
  }
  finally {
    if (Test-Path $tmp) {
      Remove-Item -LiteralPath $tmp -Force
    }
  }
}
finally {
  if ($bstr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

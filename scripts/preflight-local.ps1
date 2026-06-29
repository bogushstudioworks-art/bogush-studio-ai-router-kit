param(
  [Parameter(Mandatory = $false)]
  [string]$NodeBinPath = "",

  [Parameter(Mandatory = $false)]
  [switch]$SkipNpmTest
)

$ErrorActionPreference = "Stop"

$workspaceRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$codexNodeRoot = Join-Path $env:LOCALAPPDATA "OpenAI\Codex\runtimes\cua_node"
$requiredFiles = @(
  "src\server.js",
  "package.json",
  "cloudbuild.yaml",
  "service.template.yaml",
  "scripts\deploy-cloud-run.ps1",
  "scripts\config-audit-test.mjs",
  "scripts\verify-public-endpoints.ps1",
  "scripts\webhook-edge-test.mjs",
  "scripts\telegram-send-failure-test.mjs",
  "scripts\command-reply-test.mjs",
  "scripts\log-privacy-test.mjs",
  "scripts\prompt-policy-test.mjs",
  "scripts\prompt-product-test.mjs",
  "ROLLBACK_RUNBOOK.md",
  "LOCAL_TESTS.md"
)

Write-Host "Preflight: checking required files..."
foreach ($file in $requiredFiles) {
  if (-not (Test-Path (Join-Path (Get-Location) $file))) {
    throw "Required file is missing: $file"
  }
}

if (-not $NodeBinPath) {
  if (Get-Command npm -ErrorAction SilentlyContinue) {
    $NodeBinPath = ""
  } else {
    $runtimeBin = Get-ChildItem -Path $codexNodeRoot -Directory -ErrorAction SilentlyContinue |
      ForEach-Object { Join-Path $_.FullName "bin" } |
      Where-Object { Test-Path (Join-Path $_ "npm.cmd") } |
      Sort-Object -Descending |
      Select-Object -First 1

    if ($runtimeBin) {
      $NodeBinPath = $runtimeBin
    } else {
      throw "npm was not found in PATH and no bundled Codex Node runtime with npm.cmd was found under $codexNodeRoot"
    }
  }
}

if ($NodeBinPath) {
  $env:PATH = "$NodeBinPath;$env:PATH"
  Write-Host "Preflight: using Node bin path: $NodeBinPath"
} else {
  Write-Host "Preflight: using npm from PATH"
}

if (-not $SkipNpmTest) {
  Write-Host "Preflight: running npm test..."
  & npm test
  if ($LASTEXITCODE -ne 0) {
    throw "npm test failed with exit code $LASTEXITCODE"
  }
}

Write-Host "Preflight: checking deploy helper dry run..."
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\scripts\deploy-cloud-run.ps1"
if ($LASTEXITCODE -ne 0) {
  throw "deploy helper dry run failed with exit code $LASTEXITCODE"
}

Write-Host "Preflight complete. No Cloud Run deploy, Secret Manager change, webhook change, or Telegram message was performed."

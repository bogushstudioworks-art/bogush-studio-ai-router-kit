# Local Tests

These tests avoid real Telegram and avoid Google Cloud when `GOOGLE_CLOUD_PROJECT` is empty.

## Full Local Regression Suite

```powershell
npm test
```

This runs:

- `npm run check`
- `npm run smoke`
- `npm run test:webhook`
- `npm run test:send-failure`
- `npm run test:logs`
- `npm run test:prompt`
- `npm run test:product`
- `npm run test:commands`
- `npm run test:config`

## Local Preflight

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\preflight-local.ps1
```

This checks required files, runs `npm test`, and verifies deploy helper dry-run. It does not deploy, change secrets, change webhook, or send Telegram messages.

If `npm` is not in PATH, the script auto-detects the current bundled Codex Node runtime under `%LOCALAPPDATA%\OpenAI\Codex\runtimes\cua_node`.

## Health

```powershell
Invoke-RestMethod http://localhost:8080/healthz
```

Expected:

```json
{
  "ok": true,
  "service": "telegram-ai-router",
  "dryRun": true
}
```

## Telegram Text Payload

```powershell
$headers = @{ "X-Telegram-Bot-Api-Secret-Token" = "local-secret" }
$body = Get-Content .\test-payloads\telegram-message.json -Raw
Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:8080/webhook/telegram `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $body
```

Expected with no `GOOGLE_CLOUD_PROJECT`:

```json
{
  "ok": true,
  "dryRun": true,
  "chatHash": "15e2b0d3c33891eb",
  "replyLength": 132
}
```

## Non-text Payload

```powershell
$body = Get-Content .\test-payloads\telegram-non-text.json -Raw
Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:8080/webhook/telegram `
  -ContentType "application/json" `
  -Body $body
```

Expected:

```json
{
  "ok": true,
  "ignored": true
}
```

## Webhook Edge Regression

```powershell
npm run test:webhook
```

Expected:

- missing `X-Telegram-Bot-Api-Secret-Token` returns 401 when `TELEGRAM_WEBHOOK_SECRET` is set
- empty text payload is ignored with `{ "ok": true, "ignored": true }`
- non-text payload is ignored with `{ "ok": true, "ignored": true }`
- edge responses do not expose raw `chatId` or `replyPreview`

## Telegram Send Failure Regression

```powershell
npm run test:send-failure
```

Expected:

- `DRY_RUN=false` local send path is tested with mocked Telegram API fetch
- failed Telegram `sendMessage` returns generic `{ "ok": false, "error": "telegram_webhook_error" }`
- failed response does not expose raw `chatId`, bot token, or `replyPreview`
- structured error log does not expose bot token or raw `chatId` field

## Structured Log Privacy Regression

```powershell
npm run test:logs
```

Expected:

- webhook structured events include `chatHash`
- webhook structured events do not include raw `chatId`
- message text and reply text are not present in structured logs

The test checks:

- `telegram_update_received`
- `ai_reply_generated`
- `telegram_reply_skipped_dry_run`

## Prompt Policy Regression

```powershell
npm run test:prompt
```

Expected:

- ordinary questions, tests, greetings, summaries, drafts, and explanations are answered directly
- manual confirmation is reserved for explicit external side-effect requests
- words like production, deploy, token, and webhook are treated as context unless the user asks to perform the action

## Product Routing Prompt Regression

```powershell
npm run test:product
```

Expected:

- Bogush Studio Works Route identity is present
- assistant, task router, content helper, technical coordinator, client/project intake, and music lab modes are present
- `/start`, post, Reels, Codex task, and Claude task flows are present
- prompt tells the bot not to claim external changes unless they were actually performed

## Static Command Reply Regression

```powershell
npm run test:commands
```

Expected:

- `/start` and `/help` return a compact Bogush Studio Works Route menu
- `/post`, `/reels`, `/codex`, and `/claude` return compact templates
- `/post <topic>`, `/reels <topic>`, `/codex <task>`, and `/claude <topic>` return compact filled drafts
- ordinary text still routes to the model

## Deploy Config Audit Regression

```powershell
npm run test:config
```

Expected:

- deploy templates use the current production project, region, service account, model, secrets, and `LOG_PRIVACY_REV`
- deploy templates do not set `DRY_RUN=true`
- deploy templates do not route traffic to unsafe revision `telegram-ai-router-00011-sm5`

## Deploy Helper Dry Run

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloud-run.ps1
```

Expected:

- prints current deploy defaults
- does not call Cloud Run deploy
- tells the operator to re-run with `-ConfirmDeploy` for an actual deploy

## Read-only Production Verification

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-production-readonly.ps1
```

Expected:

- verifies Cloud Run traffic is on the expected revision
- checks recent structured logs for raw `chatId`
- does not deploy, change secrets, change webhook, or send Telegram messages

Optional webhook status check:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-production-readonly.ps1 -CheckTelegramWebhook
```

Use the optional flag only when reading the bot token from Secret Manager is explicitly approved. The token is not printed.

## Public Endpoint Verification

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-public-endpoints.ps1
```

Expected:

- verifies 100% Cloud Run traffic is on the expected revision
- checks the root health endpoint returns `dryRun=false`
- sends a fake webhook request without secret and expects HTTP 401
- checks structured error logs do not expose raw `chatId`
- does not read secrets, change webhook, or send Telegram messages

# Cloud Run Setup Checklist

Use this checklist before any deploy or webhook change.

## Project
- Confirm Google Cloud project ID.
- Confirm billing is intentional and active.
- Confirm region, default: `us-central1`.
- Confirm service name, default: `telegram-ai-router`.

## Service Account
- Runtime service account currently used in production:
  `vertex-claude-execution@project-a4cef2bd-9f4d-4539-b02.iam.gserviceaccount.com`.
- Grant only required roles:
  - `roles/aiplatform.user` for Vertex AI calls.
  - `roles/secretmanager.secretAccessor` for runtime secret reads.
  - Cloud Run runtime permissions handled by Cloud Run.

## Secrets
- Store `TELEGRAM_BOT_TOKEN` in Secret Manager as `telegram-bot-token`.
- Store `TELEGRAM_WEBHOOK_SECRET` in Secret Manager as `telegram-webhook-secret`.
- Do not store secrets in `.env`, source control, screenshots, docs, or chat.

## Runtime Safety
- Current production profile uses `DRY_RUN=false`.
- Before any new deploy, run local preflight:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\preflight-local.ps1
```

- Do not deploy if `npm test` or deploy helper dry-run fails.
- Test `/healthz`.
- Test Telegram payload locally or through Cloud Run logs before enabling outbound replies.
- Keep `DRY_RUN=false` only when outbound Telegram replies are intentionally approved.

## Webhook
- Set Telegram webhook only after Cloud Run URL and secret are confirmed.
- Use `X-Telegram-Bot-Api-Secret-Token`.
- Do not publish bot tokens in command history or screenshots.

## Manual Confirmation Required
- Deploying Cloud Run.
- Creating or changing secrets.
- Setting Telegram webhook.
- Turning `DRY_RUN=false`.
- Granting IAM roles.
- Changing billing/project target.

## Current Production References
- Project: `project-a4cef2bd-9f4d-4539-b02`
- Region: `us-central1`
- Service: `telegram-ai-router`
- Current revision: `telegram-ai-router-hashlogs-20260621-1918`
- Emergency behavior rollback: `telegram-ai-router-00010-fvn` (not privacy-audited)
- Unsafe revision: `telegram-ai-router-00011-sm5` (do not route traffic to it)

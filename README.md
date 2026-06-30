# Bogush Studio AI Router Kit

[![CI](https://github.com/bogushstudioworks-art/bogush-studio-ai-router-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/bogushstudioworks-art/bogush-studio-ai-router-kit/actions/workflows/ci.yml)

Safe-by-default Node.js template for routing Telegram webhook messages to Vertex AI
Gemini on Google Cloud Run.

This repository is a public template extracted from an internal Bogush Studio
prototype. It intentionally excludes production tokens, live webhook values,
private client data, billing configuration, and deployment defaults.

## What It Does
- Accepts Telegram webhook updates on `POST /webhook/telegram`.
- Validates `X-Telegram-Bot-Api-Secret-Token` when `TELEGRAM_WEBHOOK_SECRET` is set.
- Calls Vertex AI Gemini through `@google/genai`.
- Sends a Telegram reply only when `DRY_RUN=false`.
- Exposes `GET /healthz` for Cloud Run health checks.

## Why This Exists

Many studios and solo builders want a practical AI intake bot without starting
from a workflow automation platform. This kit keeps the first version small:
one Cloud Run service, explicit environment variables, dry-run defaults, local
tests, and a clear path to production hardening.

## Files
- `src/server.js` - Express service.
- `Dockerfile` - Cloud Run container image.
- `package.json` - Node dependencies and scripts.
- `.env.example` - environment variable template.
- `cloudbuild.yaml` - Cloud Build template with tests before deploy.
- `service.template.yaml` - Cloud Run service template for manual review.
- `docs/architecture.md` - system design and request flow.
- `docs/deployment.md` - deployment checklist and safety notes.
- `docs/operations.md` - release, runtime, logging, and rollback runbook.
- `CHANGELOG.md` - release history.
- `SETUP_CHECKLIST.md` - pre-deploy checklist.
- `SECRETS_AND_IAM.md` - Secret Manager and IAM plan.
- `LOCAL_TESTS.md` - local smoke test commands.
- `test-payloads/` - Telegram webhook sample payloads.
- `scripts/` - local tests and guarded helper templates.

## Local Run
```powershell
cd bogush-studio-ai-router-kit
npm install
Copy-Item .env.example .env
npm run dev
```

Health check:
```powershell
Invoke-RestMethod http://localhost:8080/healthz
```

## Required Environment Variables
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `GOOGLE_CLOUD_PROJECT`
- `GOOGLE_CLOUD_LOCATION`
- `VERTEX_MODEL`
- `DRY_RUN`

## Deploy
Deployment is intentionally template-only. Before deploying, create your own:

- Google Cloud project
- Cloud Run service
- service account
- Secret Manager entries
- Telegram bot token
- Telegram webhook secret

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloud-run.ps1 `
  -ProjectId "your-project-id" `
  -Region "us-central1" `
  -ServiceName "your-router-service" `
  -ServiceAccount "your-service-account@your-project-id.iam.gserviceaccount.com" `
  -ConfirmDeploy
```

On this laptop, use `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ...` because direct script execution can be blocked by Windows ExecutionPolicy.

Do not deploy until project, billing, service account, secrets, webhook behavior,
and rollback target are manually confirmed.

## Webhook Setup

The webhook script does not call Telegram by default.

```powershell
.\scripts\set-telegram-webhook.ps1 `
  -CloudRunUrl "https://telegram-ai-router-xxxxx-uc.a.run.app" `
  -WebhookSecret "manual-secret-value"
```

Re-run with `-ConfirmSetWebhook` only when you want it to print the exact Telegram command for manual execution.

## Project Status

Early public template. The current focus is:

- keep the deployment path safe by default
- improve tests and CI coverage
- document practical Cloud Run and Telegram setup
- avoid shipping any production-specific data

See [ROADMAP.md](ROADMAP.md).

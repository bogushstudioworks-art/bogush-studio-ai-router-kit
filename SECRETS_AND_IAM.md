# Secrets And IAM Plan

This file lists required cloud resources without secret values.

## Secret Manager

Required secrets:

| Secret name | Purpose | Runtime env |
|---|---|---|
| `telegram-bot-token` | Telegram Bot API token from BotFather | `TELEGRAM_BOT_TOKEN` |
| `telegram-webhook-secret` | Random webhook verification token | `TELEGRAM_WEBHOOK_SECRET` |

Suggested commands, for manual execution only:

```powershell
gcloud secrets create telegram-bot-token --replication-policy=automatic --project PROJECT_ID
gcloud secrets create telegram-webhook-secret --replication-policy=automatic --project PROJECT_ID
```

Then add secret versions manually from a secure terminal. Do not paste tokens into shared logs.

## Service Account

Suggested service account:

```powershell
gcloud iam service-accounts create telegram-ai-router-sa `
  --display-name "Telegram AI Router Cloud Run" `
  --project PROJECT_ID
```

Required roles:

```powershell
gcloud projects add-iam-policy-binding PROJECT_ID `
  --member "serviceAccount:telegram-ai-router-sa@PROJECT_ID.iam.gserviceaccount.com" `
  --role "roles/aiplatform.user"

gcloud projects add-iam-policy-binding PROJECT_ID `
  --member "serviceAccount:telegram-ai-router-sa@PROJECT_ID.iam.gserviceaccount.com" `
  --role "roles/secretmanager.secretAccessor"
```

## Notes
- Keep `roles/editor` out of this service.
- Use one service account per deployable service.
- Rotate Telegram token if it was ever pasted into logs, screenshots, chat, or docs.

# Deployment Guide

## Prerequisites

- Google Cloud project with billing configured.
- Cloud Run API enabled.
- Vertex AI API enabled.
- Secret Manager API enabled.
- Telegram bot token from BotFather.
- A generated Telegram webhook secret.

## Required Secrets

Store these in Secret Manager:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`

Do not commit secret values to this repository.

## Required Environment Variables

- `NODE_ENV=production`
- `DRY_RUN=false` only after local and staging checks pass
- `GOOGLE_CLOUD_PROJECT`
- `GOOGLE_CLOUD_LOCATION`
- `VERTEX_MODEL`

## Suggested Deployment Sequence

1. Run local tests.
2. Deploy with `DRY_RUN=true`.
3. Verify `/healthz`.
4. Send a Telegram test update to staging.
5. Confirm logs do not expose raw chat IDs or message content.
6. Switch to `DRY_RUN=false` only after operator review.
7. Set the Telegram webhook with the confirmed Cloud Run URL and webhook
   secret.

## Rollback

Keep the previous Cloud Run revision available. If replies fail or unexpected
messages are sent, route traffic back to the last known good revision and set
`DRY_RUN=true` before further debugging.


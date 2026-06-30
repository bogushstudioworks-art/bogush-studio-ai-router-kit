# Operations Runbook

This runbook is for maintainers running the Telegram AI Router template on Cloud Run.

## Release Gate

Before a release or deploy:

```powershell
npm ci
npm test
```

The test suite checks:

- JavaScript syntax.
- Local service smoke flow.
- Webhook secret rejection.
- Non-text and empty-text Telegram updates.
- Telegram send failure handling.
- Structured log privacy.
- Prompt policy coverage.
- Command replies.
- Public config template safety.

## Deploy Guardrails

- Keep `DRY_RUN=true` until webhook routing and logs are verified.
- Store real Telegram and webhook tokens only in Secret Manager.
- Do not commit `.env` or screenshots containing token values.
- Use one dedicated Cloud Run service account per deployable service.
- Avoid broad roles such as `roles/editor`.

## Runtime Checks

Health endpoint:

```text
GET /
```

Expected shape:

```json
{
  "ok": true,
  "service": "telegram-ai-router",
  "dryRun": true
}
```

Webhook endpoint:

```text
POST /webhook/telegram
```

The endpoint requires the configured webhook secret. Requests without the secret must return:

```json
{
  "ok": false,
  "error": "invalid_telegram_webhook_secret"
}
```

## Log Privacy

Structured logs must not contain:

- Raw Telegram chat IDs.
- Raw user message text.
- Bot token values.
- Webhook secret values.

Use hashed chat identifiers and event metadata instead.

## Rollback

Cloud Run rollback should be a traffic-only operation to a previously verified revision.

Before rollback:

- Confirm the target revision passed the same privacy checks.
- Confirm the target revision has compatible environment variables and secrets.
- Do not route traffic to a revision marked unsafe or not privacy-audited.

After rollback:

- Verify health endpoint.
- Check structured logs for errors.
- Confirm no raw chat IDs or message text appear in logs.

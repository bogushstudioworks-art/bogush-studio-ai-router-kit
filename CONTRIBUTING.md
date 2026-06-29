# Contributing

Thanks for considering a contribution.

## Scope

This project is a small, safe-by-default Telegram to Vertex AI router template.
Contributions should keep the template easy to audit and easy to deploy.

Good contribution areas:

- clearer setup documentation
- safer deployment defaults
- more local tests
- better error handling
- additional provider adapters behind explicit configuration
- security hardening that does not add heavy operational complexity

Avoid:

- committing real tokens, project IDs, service account keys, or chat data
- adding production-specific defaults
- making the service send external messages by default
- broad framework rewrites without a concrete reason

## Local Checks

```powershell
npm install
npm test
```

## Pull Request Checklist

- [ ] No secrets or private IDs are committed.
- [ ] `DRY_RUN` remains the safe default.
- [ ] Tests pass locally.
- [ ] Documentation is updated when behavior changes.
- [ ] New external side effects require explicit configuration.


# Changelog

All notable changes to this project are documented here.

## 0.1.0 - 2026-06-30

Initial public template release.

### Added

- Express webhook service for Telegram updates.
- Vertex AI reply generation through `@google/genai`.
- Dry-run mode for safe local and staging execution.
- Webhook secret validation.
- Structured privacy-preserving logs with `chatHash` instead of raw chat IDs.
- Local smoke, webhook, prompt, command, send-failure, log privacy, and config tests.
- Cloud Run deployment helper templates.
- Secret Manager and IAM setup notes.
- Architecture, deployment, roadmap, security, and contribution documentation.

### Security

- No production tokens or project-specific IDs are included in the public template.
- Config audit test checks for internal project IDs, service accounts, pinned revisions, and known token fragments.

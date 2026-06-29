# Architecture

## Overview

Bogush Studio AI Router Kit is a single Node.js service designed for Cloud Run.
It receives Telegram webhook updates, validates optional Telegram webhook
secrets, generates a reply with Vertex AI Gemini, and sends the response back to
Telegram only when `DRY_RUN=false`.

## Request Flow

```mermaid
flowchart LR
  Telegram["Telegram webhook"] --> Router["Express /webhook/telegram"]
  Router --> Validate["Validate webhook secret"]
  Validate --> Classify["Extract text and chat metadata"]
  Classify --> Commands["Static command router"]
  Classify --> Gemini["Vertex AI Gemini"]
  Commands --> Reply["Reply text"]
  Gemini --> Reply
  Reply --> DryRun{"DRY_RUN?"}
  DryRun -->|true| LogOnly["Log reply length only"]
  DryRun -->|false| Send["Telegram sendMessage"]
```

## Safety Defaults

- `DRY_RUN=true` by default.
- Raw chat IDs are not logged; a short SHA-256 hash is logged instead.
- Telegram messages are not sent unless explicitly enabled.
- Webhook setup helper does not call Telegram unless explicitly confirmed.
- Deploy helper requires project, service, and service account parameters.

## Main Modules

- `src/server.js`: Express app, webhook route, command router, Gemini call, and
  Telegram send logic.
- `scripts/*.mjs`: local tests for webhook behavior, logging privacy, command
  replies, prompt policy, and failure paths.
- `scripts/*.ps1`: guarded helper scripts for deployment and webhook setup.

## Production Boundary

This repository is a template. Production operators must provide their own:

- Google Cloud project
- Cloud Run service
- service account
- Secret Manager values
- Telegram bot token
- Telegram webhook secret


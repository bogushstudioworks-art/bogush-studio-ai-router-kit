import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const port = 8094;
const baseUrl = `http://127.0.0.1:${port}`;

process.env.PORT = String(port);
process.env.DRY_RUN = "true";
process.env.TELEGRAM_WEBHOOK_SECRET = "local-secret";
process.env.GOOGLE_CLOUD_PROJECT = "";

const { startServer } = await import("../src/server.js");
const server = startServer(port);

try {
  await waitForHealth();

  const textPayload = JSON.parse(
    await readFile("test-payloads/telegram-message.json", "utf8"),
  );
  const nonTextPayload = JSON.parse(
    await readFile("test-payloads/telegram-non-text.json", "utf8"),
  );

  const missingSecretResponse = await postJson("/webhook/telegram", textPayload);

  const emptyTextPayload = structuredClone(textPayload);
  emptyTextPayload.update_id = 100000003;
  emptyTextPayload.message.text = "   ";
  const emptyTextResponse = await postJson("/webhook/telegram", emptyTextPayload, {
    "X-Telegram-Bot-Api-Secret-Token": "local-secret",
  });

  const nonTextResponse = await postJson("/webhook/telegram", nonTextPayload, {
    "X-Telegram-Bot-Api-Secret-Token": "local-secret",
  });

  assert(missingSecretResponse.status === 401, "missing secret should return 401");
  assert(
    missingSecretResponse.body.error === "invalid_telegram_webhook_secret",
    "missing secret should return invalid secret error",
  );
  assert(
    !Object.hasOwn(missingSecretResponse.body, "chatId"),
    "missing secret response should not expose raw chatId",
  );
  assert(
    !Object.hasOwn(missingSecretResponse.body, "replyPreview"),
    "missing secret response should not expose reply text",
  );

  assert(emptyTextResponse.status === 200, "empty text should return 200");
  assert(emptyTextResponse.body.ok === true, "empty text should return ok");
  assert(emptyTextResponse.body.ignored === true, "empty text should be ignored");
  assert(
    !Object.hasOwn(emptyTextResponse.body, "chatId"),
    "empty text response should not expose raw chatId",
  );
  assert(
    !Object.hasOwn(emptyTextResponse.body, "replyPreview"),
    "empty text response should not expose reply text",
  );

  assert(nonTextResponse.status === 200, "non-text should return 200");
  assert(nonTextResponse.body.ok === true, "non-text should return ok");
  assert(nonTextResponse.body.ignored === true, "non-text should be ignored");
  assert(
    !Object.hasOwn(nonTextResponse.body, "chatId"),
    "non-text response should not expose raw chatId",
  );
  assert(
    !Object.hasOwn(nonTextResponse.body, "replyPreview"),
    "non-text response should not expose reply text",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        missingSecretResponse,
        emptyTextResponse,
        nonTextResponse,
      },
      null,
      2,
    ),
  );
} finally {
  server.close();
}

async function waitForHealth() {
  const started = Date.now();
  while (Date.now() - started < 10_000) {
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) return;
    } catch {
      // Server is not ready yet.
    }

    await delay(250);
  }

  throw new Error("server did not become healthy");
}

async function postJson(path, body, headers = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

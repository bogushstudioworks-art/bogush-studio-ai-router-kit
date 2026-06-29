import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const port = 8091;
const baseUrl = `http://127.0.0.1:${port}`;

process.env.PORT = String(port);
process.env.DRY_RUN = "true";
process.env.TELEGRAM_WEBHOOK_SECRET = "local-secret";
process.env.GOOGLE_CLOUD_PROJECT = "";

const { startServer } = await import("../src/server.js");
const server = startServer(port);

try {
  await waitForHealth();

  const health = await getJson("/healthz");
  const textPayload = JSON.parse(
    await readFile("test-payloads/telegram-message.json", "utf8"),
  );
  const nonTextPayload = JSON.parse(
    await readFile("test-payloads/telegram-non-text.json", "utf8"),
  );

  const textResponse = await postJson("/webhook/telegram", textPayload, {
    "X-Telegram-Bot-Api-Secret-Token": "local-secret",
  });

  const nonTextResponse = await postJson("/webhook/telegram", nonTextPayload, {
    "X-Telegram-Bot-Api-Secret-Token": "local-secret",
  });

  assert(health.ok === true, "health.ok should be true");
  assert(health.dryRun === true, "health.dryRun should be true");
  assert(textResponse.ok === true, "text payload should return ok");
  assert(textResponse.dryRun === true, "text payload should stay dry-run");
  assert(textResponse.chatHash === "15e2b0d3c33891eb", "text payload chatHash mismatch");
  assert(!Object.hasOwn(textResponse, "chatId"), "text response should not expose raw chatId");
  assert(!Object.hasOwn(textResponse, "replyPreview"), "text response should not expose reply text");
  assert(textResponse.replyLength > 0, "text response replyLength should be positive");
  assert(nonTextResponse.ok === true, "non-text payload should return ok");
  assert(nonTextResponse.ignored === true, "non-text payload should be ignored");

  console.log(
    JSON.stringify(
      {
        ok: true,
        health,
        textResponse,
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

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  return response.json();
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

  return response.json();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

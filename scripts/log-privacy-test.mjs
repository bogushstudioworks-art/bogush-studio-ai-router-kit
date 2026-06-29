import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const port = 8092;
const baseUrl = `http://127.0.0.1:${port}`;
const webhookSecret = "local-secret";

process.env.PORT = String(port);
process.env.DRY_RUN = "true";
process.env.TELEGRAM_WEBHOOK_SECRET = webhookSecret;
process.env.GOOGLE_CLOUD_PROJECT = "";

const capturedLogs = [];
const originalLog = console.log;
const originalError = console.error;

console.log = captureConsole("log", originalLog);
console.error = captureConsole("error", originalError);

const { startServer } = await import("../src/server.js");
const server = startServer(port);

try {
  await waitForHealth();

  const payload = JSON.parse(
    await readFile("test-payloads/telegram-message.json", "utf8"),
  );
  const expectedChatHash = hashChatId(payload.message.chat.id);
  const response = await postJson("/webhook/telegram", payload, {
    "X-Telegram-Bot-Api-Secret-Token": webhookSecret,
  });

  assert(response.ok === true, "webhook response should be ok");
  assert(response.chatHash === expectedChatHash, "response chatHash mismatch");
  assert(!Object.hasOwn(response, "chatId"), "response exposed raw chatId");
  assert(!Object.hasOwn(response, "replyPreview"), "response exposed reply text");
  assert(response.replyLength > 0, "response replyLength should be positive");

  const structuredLogs = capturedLogs
    .map((entry) => tryParseJson(entry.message))
    .filter(Boolean);
  const webhookLogs = structuredLogs.filter((entry) =>
    [
      "telegram_update_received",
      "ai_reply_generated",
      "telegram_reply_skipped_dry_run",
    ].includes(entry.event),
  );

  assert(webhookLogs.length === 3, "expected three webhook structured logs");

  for (const entry of webhookLogs) {
    assert(!Object.hasOwn(entry, "chatId"), `${entry.event} logged raw chatId`);
    assert(
      entry.chatHash === expectedChatHash,
      `${entry.event} chatHash mismatch`,
    );
    assert(
      !JSON.stringify(entry).includes(payload.message.text),
      `${entry.event} logged message text`,
    );
  }

  console.log = originalLog;
  console.error = originalError;
  originalLog(
    JSON.stringify(
      {
        ok: true,
        checkedEvents: webhookLogs.map((entry) => entry.event),
        chatHash: expectedChatHash,
        rawChatIdLogged: false,
        messageTextLogged: false,
        rawChatIdInResponse: false,
        replyTextInResponse: false,
      },
      null,
      2,
    ),
  );
} finally {
  server.close();
  console.log = originalLog;
  console.error = originalError;
}

function captureConsole(level, original) {
  return (...args) => {
    const message = args.map(String).join(" ");
    capturedLogs.push({ level, message });
    original(...args);
  };
}

function hashChatId(chatId) {
  return createHash("sha256").update(String(chatId)).digest("hex").slice(0, 16);
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

  return response.json();
}

function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

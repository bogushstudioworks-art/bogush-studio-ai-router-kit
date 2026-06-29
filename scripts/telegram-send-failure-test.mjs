import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const port = 8095;
const baseUrl = `http://127.0.0.1:${port}`;
const fakeToken = "local-fake-token";

process.env.PORT = String(port);
process.env.DRY_RUN = "false";
process.env.TELEGRAM_BOT_TOKEN = fakeToken;
process.env.TELEGRAM_WEBHOOK_SECRET = "local-secret";
process.env.GOOGLE_CLOUD_PROJECT = "";

const realFetch = globalThis.fetch;
const errorLogs = [];
const originalConsoleError = console.error;

console.error = (...args) => {
  errorLogs.push(args.map(String).join(" "));
  originalConsoleError(...args);
};

globalThis.fetch = async (url, options) => {
  const urlText = String(url);
  if (urlText.startsWith("https://api.telegram.org/")) {
    const body = JSON.parse(String(options?.body || "{}"));
    assert(body.chat_id === 123456789, "telegram send should use expected chat id");
    assert(typeof body.text === "string" && body.text.length > 0, "telegram send text is required");

    return new Response("forbidden", {
      status: 403,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return realFetch(url, options);
};

const { startServer } = await import("../src/server.js");
const server = startServer(port);

try {
  await waitForHealth();

  const textPayload = JSON.parse(
    await readFile("test-payloads/telegram-message.json", "utf8"),
  );

  const failureResponse = await postJson("/webhook/telegram", textPayload, {
    "X-Telegram-Bot-Api-Secret-Token": "local-secret",
  });

  assert(failureResponse.status === 500, "failed Telegram send should return 500");
  assert(failureResponse.body.ok === false, "failed Telegram send should return ok=false");
  assert(
    failureResponse.body.error === "telegram_webhook_error",
    "failed Telegram send should expose only generic webhook error",
  );
  assert(
    !JSON.stringify(failureResponse.body).includes("123456789"),
    "failed Telegram response should not expose raw chatId",
  );
  assert(
    !JSON.stringify(failureResponse.body).includes(fakeToken),
    "failed Telegram response should not expose bot token",
  );
  assert(
    !Object.hasOwn(failureResponse.body, "replyPreview"),
    "failed Telegram response should not expose reply text",
  );

  const errorLogText = errorLogs.join("\n");
  assert(errorLogText.includes("telegram_webhook_error"), "failure should emit error log");
  assert(
    !errorLogText.includes(fakeToken),
    "failed Telegram error log should not expose bot token",
  );
  assert(
    !errorLogText.includes('"chatId"'),
    "failed Telegram error log should not expose raw chatId field",
  );
  assert(
    !errorLogText.includes("123456789"),
    "failed Telegram error log should not expose raw chatId value",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        failureResponse,
        errorLogged: true,
      },
      null,
      2,
    ),
  );
} finally {
  server.close();
  globalThis.fetch = realFetch;
  console.error = originalConsoleError;
}

async function waitForHealth() {
  const started = Date.now();
  while (Date.now() - started < 10_000) {
    try {
      const response = await realFetch(`${baseUrl}/healthz`);
      if (response.ok) return;
    } catch {
      // Server is not ready yet.
    }

    await delay(250);
  }

  throw new Error("server did not become healthy");
}

async function postJson(path, body, headers = {}) {
  const response = await realFetch(`${baseUrl}${path}`, {
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

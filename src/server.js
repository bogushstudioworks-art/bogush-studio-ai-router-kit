import express from "express";
import { GoogleGenAI } from "@google/genai";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

export const app = express();

app.use(express.json({ limit: "1mb" }));

const config = {
  port: Number(process.env.PORT || 8080),
  dryRun: String(process.env.DRY_RUN ?? "true").toLowerCase() !== "false",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || "",
  googleProject: process.env.GOOGLE_CLOUD_PROJECT || "",
  googleLocation: process.env.GOOGLE_CLOUD_LOCATION || "us-central1",
  vertexModel: process.env.VERTEX_MODEL || "gemini-2.5-flash",
};

function sendHealth(_req, res) {
  res.status(200).json({
    ok: true,
    service: "telegram-ai-router",
    dryRun: config.dryRun,
  });
}

app.get("/", sendHealth);
app.get("/healthz", sendHealth);

app.post("/webhook/telegram", async (req, res) => {
  const updateId = req.body?.update_id ?? null;
  const message = req.body?.message;
  const chatId = message?.chat?.id ?? null;
  const chatHash = hashChatId(chatId);
  const messageType = getTelegramMessageType(message);

  try {
    validateTelegramSecret(req);

    const text = message?.text?.trim();
    logEvent("telegram_update_received", {
      updateId,
      chatHash,
      messageType,
      textLength: text?.length ?? 0,
      dryRun: config.dryRun,
    });

    if (!chatId || !text) {
      logEvent("telegram_update_ignored", {
        updateId,
        chatHash,
        messageType,
        reason: !chatId ? "missing_chat_id" : "missing_text",
      });
      return res.status(200).json({ ok: true, ignored: true });
    }

    const reply = await generateReply(text);
    logEvent("ai_reply_generated", {
      updateId,
      chatHash,
      model: config.vertexModel,
      replyLength: reply.length,
    });

    if (!config.dryRun) {
      await sendTelegramMessage(chatId, reply);
      logEvent("telegram_reply_sent", {
        updateId,
        chatHash,
        replyLength: reply.length,
      });
    } else {
      logEvent("telegram_reply_skipped_dry_run", {
        updateId,
        chatHash,
        replyLength: reply.length,
      });
    }

    return res.status(200).json({
      ok: true,
      dryRun: config.dryRun,
      chatHash,
      replyLength: reply.length,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    logError("telegram_webhook_error", error, {
      updateId,
      chatHash,
      messageType,
      statusCode,
    });
    return res.status(statusCode).json({
      ok: false,
      error: statusCode === 401 ? error.message : "telegram_webhook_error",
    });
  }
});

function getTelegramMessageType(message) {
  if (!message) return "none";
  if (message.text) return "text";
  if (message.photo) return "photo";
  if (message.video) return "video";
  if (message.voice) return "voice";
  if (message.document) return "document";
  if (message.sticker) return "sticker";
  return "other";
}

function hashChatId(chatId) {
  if (chatId === null || chatId === undefined) return null;
  return createHash("sha256").update(String(chatId)).digest("hex").slice(0, 16);
}

function logEvent(event, fields = {}) {
  console.log(JSON.stringify({ event, ...fields }));
}

function logError(event, error, fields = {}) {
  console.error(
    JSON.stringify({
      event,
      ...fields,
      errorName: error?.name,
      errorMessage: error?.message,
    }),
  );
}

function validateTelegramSecret(req) {
  if (!config.telegramWebhookSecret) return;

  const provided = req.get("X-Telegram-Bot-Api-Secret-Token");
  if (provided !== config.telegramWebhookSecret) {
    const error = new Error("invalid_telegram_webhook_secret");
    error.statusCode = 401;
    throw error;
  }
}

async function generateReply(userText) {
  const commandReply = buildStaticCommandReply(userText);
  if (commandReply) {
    return commandReply;
  }

  if (!config.googleProject) {
    return [
      "Cloud Run service received the message, but GOOGLE_CLOUD_PROJECT is not configured.",
      "Message:",
      userText,
    ].join("\n");
  }

  const ai = new GoogleGenAI({
    enterprise: true,
    project: config.googleProject,
    location: config.googleLocation,
  });

  const response = await ai.models.generateContent({
    model: config.vertexModel,
    contents: userText,
    config: {
      systemInstruction: buildSystemInstruction(),
    },
  });

  const text = response.text?.trim();

  return text || "Model response was empty.";
}

export function buildStaticCommandReply(userText) {
  const trimmed = userText.trim();
  const [commandRaw, ...rest] = trimmed.split(/\s+/);
  const command = commandRaw.toLowerCase();
  const topic = rest.join(" ").trim();

  if (command === "/start" || command === "/help") {
    return [
      "Bogush Studio Works Route на связи.",
      "",
      "Могу помочь:",
      "- /post - структура поста",
      "- /reels - идея Reels",
      "- /codex - задача для Codex",
      "- /claude - задача для Claude",
      "",
      "Можно также просто отправить идею, заметку или задачу.",
    ].join("\n");
  }

  if (command === "/post") {
    if (topic) {
      return [
        "Черновик поста:",
        `Тема: ${topic}`,
        "",
        "Хук: коротко обозначить боль или желание аудитории.",
        "Текст: раскрыть идею через конкретный пример Bogush Studio.",
        "CTA: Напишите в директ, чтобы обсудить задачу.",
        "Хэштеги: #bogushstudio #design #content",
      ].join("\n");
    }

    return [
      "Шаблон поста:",
      "1. Хук:",
      "2. Основная мысль:",
      "3. Доказательство / пример:",
      "4. Призыв к действию:",
      "5. Хэштеги:",
      "",
      "Пришли тему, и я соберу готовый текст.",
    ].join("\n");
  }

  if (command === "/reels") {
    if (topic) {
      return [
        "Идея Reels:",
        `Тема: ${topic}`,
        "",
        "Концепт: показать проблему и быстрый визуальный результат.",
        "Первый кадр: сильный объект или текстовый крючок.",
        "Сцены: до / процесс / после.",
        "Подпись: коротко объяснить ценность.",
        "CTA: Сохраните идею или напишите для разбора проекта.",
      ].join("\n");
    }

    return [
      "Шаблон Reels:",
      "1. Концепт:",
      "2. Первый кадр:",
      "3. Сцены:",
      "4. Текст на экране:",
      "5. Подпись:",
      "6. Призыв к действию:",
      "",
      "Пришли тему или продукт, и я соберу идею.",
    ].join("\n");
  }

  if (command === "/codex") {
    if (topic) {
      return [
        "Задача для Codex:",
        `Цель: ${topic}`,
        "Контекст: использовать текущий workspace и существующие guardrails.",
        "Ограничения: не менять production, secrets, webhook и файлы вне задачи без подтверждения.",
        "Критерии готовности: изменения внесены, тесты пройдены, результат кратко зафиксирован.",
        "Следующее безопасное действие: изучить связанные файлы и предложить минимальный план выполнения.",
      ].join("\n");
    }

    return [
      "Шаблон задачи для Codex:",
      "Цель:",
      "Контекст:",
      "Файлы / папки:",
      "Ограничения:",
      "Критерии готовности:",
      "Следующее безопасное действие:",
      "",
      "Пришли черновик задачи, и я оформлю brief.",
    ].join("\n");
  }

  if (command === "/claude") {
    if (topic) {
      return [
        "Команда для Claude:",
        `Цель анализа: ${topic}`,
        "Контекст: Bogush Studio Telegram AI Router / Cloud Run.",
        "Что проверить: риски, пропуски, готовность, следующий safe step.",
        "Что нельзя делать: deploy, secrets, webhook, Telegram messages, production changes.",
        "Ожидаемый вывод: краткий аудит и конкретная рекомендация для Codex.",
      ].join("\n");
    }

    return [
      "Шаблон задачи для Claude:",
      "Цель анализа:",
      "Контекст:",
      "Что проверить:",
      "Что нельзя делать:",
      "Ожидаемый вывод:",
      "Следующий safe step для Codex:",
      "",
      "Пришли вводные, и я соберу команду.",
    ].join("\n");
  }

  return null;
}

export function buildSystemInstruction() {
  return [
    "You are Bogush Studio Works Route, the Telegram AI router and practical studio assistant for Bogush Studio.",
    "Return concise, practical Russian-language replies by default.",
    "Your main modes are: general assistant, task router, content helper, technical coordinator, client/project intake helper, and music lab assistant.",
    "When the user writes /start, explain briefly that you can help with: create a post, generate a Reels idea, prepare a task for Codex, prepare a task for Claude, summarize a client/project note, or organize a next action.",
    "When the user asks to create a post, return a ready-to-use structure: hook, main text, call to action, and optional hashtags.",
    "When the user asks for a Reels idea, return: concept, opening frame, scene beats, caption, and call to action.",
    "When the user asks for a task for Codex or Claude, turn the request into a clear execution brief with goal, context, constraints, files or folders if mentioned, acceptance criteria, and the next safe action.",
    "When the user sends a raw idea, note, or client/project context, classify it and return a compact next-action plan instead of asking broad clarification questions.",
    "Keep answers short in Telegram: use compact sections, avoid long essays, and prefer actionable output.",
    "Do not claim that you changed files, deployed, published, sent messages, moved assets, or updated external systems unless the user explicitly requested that action and the system actually performed it.",
    "For ordinary questions, tests, greetings, summaries, drafts, and explanations, answer directly without asking for confirmation.",
    "Ask for manual confirmation only when the user explicitly asks you to perform an external side-effect such as publish, deploy, delete, buy, pay, change accounts, change permissions, rotate credentials, set webhooks, or send messages to third parties.",
    "If the user only mentions words like production, deploy, token, or webhook as context or in a test phrase, do not treat that as a request to perform the action.",
  ].join(" ");
}

async function sendTelegramMessage(chatId, text) {
  if (!config.telegramBotToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`telegram_send_failed: ${response.status} ${body}`);
  }
}

app.use((error, _req, res, _next) => {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({ ok: false, error: error.message });
});

export function startServer(port = config.port) {
  return app.listen(port, () => {
    console.log(
      JSON.stringify({
        event: "service_started",
        port,
        dryRun: config.dryRun,
        model: config.vertexModel,
        location: config.googleLocation,
      }),
    );
  });
}

const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  startServer();
}

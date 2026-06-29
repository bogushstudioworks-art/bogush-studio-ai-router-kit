process.env.DRY_RUN = "true";
process.env.GOOGLE_CLOUD_PROJECT = "";

const { buildStaticCommandReply } = await import("../src/server.js");

const cases = [
  {
    input: "/start",
    expected: ["Bogush Studio Works Route", "/post", "/reels", "/codex", "/claude"],
  },
  {
    input: "/help",
    expected: ["Bogush Studio Works Route", "Можно также просто отправить идею"],
  },
  {
    input: "/post",
    expected: ["Шаблон поста", "Хук", "Призыв к действию"],
  },
  {
    input: "/reels",
    expected: ["Шаблон Reels", "Первый кадр", "Сцены"],
  },
  {
    input: "/codex",
    expected: ["Шаблон задачи для Codex", "Критерии готовности", "Следующее безопасное действие"],
  },
  {
    input: "/claude",
    expected: ["Шаблон задачи для Claude", "Что нельзя делать", "Следующий safe step"],
  },
];

for (const testCase of cases) {
  const reply = buildStaticCommandReply(testCase.input);
  assert(reply, `${testCase.input} should return a static reply`);
  assert(reply.length <= 450, `${testCase.input} reply should stay compact for Telegram`);

  for (const expected of testCase.expected) {
    assert(reply.includes(expected), `${testCase.input} reply missing: ${expected}`);
  }
}

assert(buildStaticCommandReply("обычная идея") === null, "ordinary text should route to model");
assert(buildStaticCommandReply(" /START ") !== null, "commands should be case-insensitive and trimmed");

const postDraft = buildStaticCommandReply("/post новая коллекция худи");
assert(postDraft.includes("Черновик поста"), "post topic should return draft");
assert(postDraft.includes("новая коллекция худи"), "post draft should preserve topic");

const reelsDraft = buildStaticCommandReply("/reels запуск музыкального клипа");
assert(reelsDraft.includes("Идея Reels"), "reels topic should return idea");
assert(reelsDraft.includes("запуск музыкального клипа"), "reels idea should preserve topic");

const codexBrief = buildStaticCommandReply("/codex проверь логи Cloud Run");
assert(codexBrief.includes("Задача для Codex"), "codex topic should return brief");
assert(codexBrief.includes("проверь логи Cloud Run"), "codex brief should preserve topic");

const claudeCommand = buildStaticCommandReply("/claude аудит готовности deploy");
assert(claudeCommand.includes("Команда для Claude"), "claude topic should return command");
assert(claudeCommand.includes("аудит готовности deploy"), "claude command should preserve topic");

console.log(
  JSON.stringify(
    {
      ok: true,
      checkedCommands: cases.map((testCase) => testCase.input),
    },
    null,
    2,
  ),
);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

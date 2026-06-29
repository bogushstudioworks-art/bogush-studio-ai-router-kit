process.env.DRY_RUN = "true";
process.env.GOOGLE_CLOUD_PROJECT = "";

const { buildSystemInstruction } = await import("../src/server.js");

const instruction = buildSystemInstruction();
const normalized = instruction.toLowerCase();

for (const expected of [
  "bogush studio works route",
  "telegram ai router",
  "russian-language replies",
  "general assistant",
  "task router",
  "content helper",
  "technical coordinator",
  "client/project intake helper",
  "music lab assistant",
  "/start",
  "create a post",
  "reels idea",
  "task for codex",
  "task for claude",
  "execution brief",
  "acceptance criteria",
  "next safe action",
  "hook",
  "call to action",
  "scene beats",
]) {
  assertIncludes(normalized, expected);
}

for (const safetyTerm of [
  "do not claim that you changed files",
  "deployed",
  "published",
  "updated external systems",
]) {
  assertIncludes(normalized, safetyTerm);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      policy: "Bogush Studio product routing modes are present",
      instructionLength: instruction.length,
    },
    null,
    2,
  ),
);

function assertIncludes(value, expected) {
  if (!value.includes(expected)) {
    throw new Error(`system instruction missing product behavior: ${expected}`);
  }
}

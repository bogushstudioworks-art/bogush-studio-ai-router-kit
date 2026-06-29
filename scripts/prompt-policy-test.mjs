process.env.DRY_RUN = "true";
process.env.GOOGLE_CLOUD_PROJECT = "";

const { buildSystemInstruction } = await import("../src/server.js");

const instruction = buildSystemInstruction();
const normalized = instruction.toLowerCase();

assertIncludes(normalized, "answer directly without asking for confirmation");
assertIncludes(normalized, "manual confirmation only");
assertIncludes(normalized, "explicitly asks");
assertIncludes(normalized, "external side-effect");

for (const ordinaryTerm of [
  "ordinary questions",
  "tests",
  "greetings",
  "summaries",
  "drafts",
  "explanations",
]) {
  assertIncludes(normalized, ordinaryTerm);
}

for (const sideEffectTerm of [
  "publish",
  "deploy",
  "delete",
  "buy",
  "pay",
  "change accounts",
  "change permissions",
  "rotate credentials",
  "set webhooks",
  "send messages to third parties",
]) {
  assertIncludes(normalized, sideEffectTerm);
}

for (const contextTerm of ["production", "deploy", "token", "webhook"]) {
  assertIncludes(normalized, contextTerm);
}

assertIncludes(normalized, "do not treat that as a request to perform the action");

console.log(
  JSON.stringify(
    {
      ok: true,
      policy: "ordinary messages answer directly; confirmation only for explicit external side effects",
      instructionLength: instruction.length,
    },
    null,
    2,
  ),
);

function assertIncludes(value, expected) {
  if (!value.includes(expected)) {
    throw new Error(`system instruction missing: ${expected}`);
  }
}

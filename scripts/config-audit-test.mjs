import { readFile } from "node:fs/promises";

const files = {
  cloudbuild: await readFile("cloudbuild.yaml", "utf8"),
  deployScript: await readFile("scripts/deploy-cloud-run.ps1", "utf8"),
  packageJson: await readFile("package.json", "utf8"),
  preflightScript: await readFile("scripts/preflight-local.ps1", "utf8"),
  publicEndpointVerifyScript: await readFile(
    "scripts/verify-public-endpoints.ps1",
    "utf8",
  ),
  productionVerifyScript: await readFile(
    "scripts/verify-production-readonly.ps1",
    "utf8",
  ),
  serviceTemplate: await readFile("service.template.yaml", "utf8"),
};

assertIncludes(files.cloudbuild, "_REGION: us-central1");
assertIncludes(files.cloudbuild, "_SERVICE_NAME: telegram-ai-router");
assertIncludes(
  files.cloudbuild,
  "_SERVICE_ACCOUNT: telegram-ai-router-sa@PROJECT_ID.iam.gserviceaccount.com",
);
assertIncludes(files.cloudbuild, "VERTEX_MODEL=${_VERTEX_MODEL}");
assertIncludes(files.cloudbuild, "DRY_RUN=${_DRY_RUN}");
assertIncludes(files.cloudbuild, "TELEGRAM_BOT_TOKEN=telegram-bot-token:latest");
assertIncludes(files.cloudbuild, "TELEGRAM_WEBHOOK_SECRET=telegram-webhook-secret:latest");

assertIncludes(files.deployScript, "ProjectId, ServiceName, and ServiceAccount are required");
assertIncludes(files.deployScript, "This public template has no production defaults");
assertIncludes(files.deployScript, "-ConfirmDeploy");
assertIncludes(files.deployScript, "DRY_RUN=false");

assertIncludes(files.preflightScript, "npm test");
assertIncludes(files.preflightScript, "deploy-cloud-run.ps1");
assertIncludes(files.preflightScript, "No Cloud Run deploy");

assertIncludes(files.packageJson, "test:webhook");
assertIncludes(files.packageJson, "test:send-failure");
assertIncludes(files.packageJson, "test:product");
assertIncludes(files.packageJson, "test:commands");
assertIncludes(files.packageJson, "test:config");

assertIncludes(files.productionVerifyScript, "ProjectId, ServiceName, and ExpectedRevision are required");
assertIncludes(files.productionVerifyScript, "This public template has no production defaults");
assertIncludes(files.productionVerifyScript, "CheckTelegramWebhook");
assertIncludes(files.productionVerifyScript, "Raw chatId was found");
assertIncludes(files.productionVerifyScript, "No Cloud Run deploy");

assertIncludes(files.publicEndpointVerifyScript, "ProjectId, ServiceName, and ExpectedRevision are required");
assertIncludes(files.publicEndpointVerifyScript, "invalid_telegram_webhook_secret");
assertIncludes(files.publicEndpointVerifyScript, "No secrets were read");
assertIncludes(files.publicEndpointVerifyScript, "no Telegram message was sent");

assertIncludes(
  files.serviceTemplate,
  "serviceAccountName: telegram-ai-router-sa@PROJECT_ID.iam.gserviceaccount.com",
);
assertIncludes(files.serviceTemplate, 'value: "true"');
assertIncludes(files.serviceTemplate, "name: telegram-bot-token");
assertIncludes(files.serviceTemplate, "name: telegram-webhook-secret");

for (const [name, contents] of Object.entries(files)) {
  assertNotIncludes(contents, "project-a4cef2bd", `${name} must not expose an internal project id`);
  assertNotIncludes(contents, "vertex-claude-execution", `${name} must not expose an internal service account`);
  assertNotIncludes(contents, "telegram-ai-router-00016", `${name} must not pin an internal revision`);
  assertNotIncludes(contents, "telegram-ai-router-00011", `${name} must not mention an unsafe rollback revision`);
  assertNotIncludes(contents, "8789934236:", `${name} must not expose a Telegram token prefix`);
  assertNotIncludes(contents, "AAFR", `${name} must not expose a Telegram token fragment`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      checkedFiles: Object.keys(files),
      publicTemplate: true,
    },
    null,
    2,
  ),
);

function assertIncludes(value, expectedValue) {
  if (!value.includes(expectedValue)) {
    throw new Error(`expected to find: ${expectedValue}`);
  }
}

function assertNotIncludes(value, unexpectedValue, message) {
  if (value.includes(unexpectedValue)) {
    throw new Error(message);
  }
}

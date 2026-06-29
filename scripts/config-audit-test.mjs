import { readFile } from "node:fs/promises";

const expected = {
  projectId: "project-a4cef2bd-9f4d-4539-b02",
  region: "us-central1",
  serviceName: "telegram-ai-router",
  serviceAccount:
    "vertex-claude-execution@project-a4cef2bd-9f4d-4539-b02.iam.gserviceaccount.com",
  vertexModel: "gemini-2.5-flash",
  tokenRotatedAt: "2026-06-21T1158Z",
  logPrivacyRev: "hashlogs-20260621-1918",
  currentRevision: "telegram-ai-router-00016-tzj",
  botTokenSecret: "telegram-bot-token:latest",
  webhookSecret: "telegram-webhook-secret:latest",
};

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

assertIncludes(files.cloudbuild, `_REGION: ${expected.region}`);
assertIncludes(files.cloudbuild, `_SERVICE_NAME: ${expected.serviceName}`);
assertIncludes(files.cloudbuild, `_SERVICE_ACCOUNT: ${expected.serviceAccount}`);
assertIncludes(files.cloudbuild, `DRY_RUN=false`);
assertIncludes(files.cloudbuild, `VERTEX_MODEL=\${_VERTEX_MODEL}`);
assertIncludes(files.cloudbuild, `TOKEN_ROTATED_AT=\${_TOKEN_ROTATED_AT}`);
assertIncludes(files.cloudbuild, `LOG_PRIVACY_REV=\${_LOG_PRIVACY_REV}`);
assertIncludes(files.cloudbuild, `TELEGRAM_BOT_TOKEN=${expected.botTokenSecret}`);
assertIncludes(files.cloudbuild, `TELEGRAM_WEBHOOK_SECRET=${expected.webhookSecret}`);

assertIncludes(files.deployScript, `$ProjectId = "${expected.projectId}"`);
assertIncludes(files.deployScript, `$Region = "${expected.region}"`);
assertIncludes(files.deployScript, `$ServiceName = "${expected.serviceName}"`);
assertIncludes(files.deployScript, `$ServiceAccount = "${expected.serviceAccount}"`);
assertIncludes(files.deployScript, `$VertexModel = "${expected.vertexModel}"`);
assertIncludes(files.deployScript, `$TokenRotatedAt = "${expected.tokenRotatedAt}"`);
assertIncludes(files.deployScript, `$LogPrivacyRev = "${expected.logPrivacyRev}"`);
assertIncludes(files.deployScript, "$GcloudPath = \"\"");
assertIncludes(files.deployScript, "CLOUDSDK_CONFIG");
assertIncludes(files.deployScript, "google-cloud-cli-bundled-tar");
assertIncludes(files.deployScript, "gcloud was not found in PATH");
assertIncludes(files.deployScript, `"DRY_RUN=false"`);
assertIncludes(files.deployScript, expected.botTokenSecret);
assertIncludes(files.deployScript, expected.webhookSecret);
assertIncludes(files.deployScript, "-ConfirmDeploy");

assertIncludes(files.preflightScript, "npm test");
assertIncludes(files.preflightScript, "deploy-cloud-run.ps1");
assertIncludes(files.preflightScript, "No Cloud Run deploy");
assertIncludes(files.preflightScript, "cua_node");

assertIncludes(files.packageJson, "test:webhook");
assertIncludes(files.packageJson, "test:send-failure");
assertIncludes(files.packageJson, "test:product");
assertIncludes(files.packageJson, "test:commands");
assertIncludes(files.packageJson, "webhook-edge-test.mjs");
assertIncludes(files.packageJson, "telegram-send-failure-test.mjs");
assertIncludes(files.packageJson, "prompt-product-test.mjs");
assertIncludes(files.packageJson, "command-reply-test.mjs");

assertIncludes(files.productionVerifyScript, expected.projectId);
assertIncludes(files.productionVerifyScript, expected.region);
assertIncludes(files.productionVerifyScript, expected.serviceName);
assertIncludes(files.productionVerifyScript, "ExpectedRevision");
assertIncludes(files.productionVerifyScript, expected.currentRevision);
assertIncludes(files.productionVerifyScript, "CheckTelegramWebhook");
assertIncludes(files.productionVerifyScript, "Raw chatId was found");
assertIncludes(files.productionVerifyScript, "No Cloud Run deploy");

assertIncludes(files.publicEndpointVerifyScript, expected.projectId);
assertIncludes(files.publicEndpointVerifyScript, expected.region);
assertIncludes(files.publicEndpointVerifyScript, expected.serviceName);
assertIncludes(files.publicEndpointVerifyScript, expected.currentRevision);
assertIncludes(files.publicEndpointVerifyScript, "invalid_telegram_webhook_secret");
assertIncludes(files.publicEndpointVerifyScript, "No secrets were read");
assertIncludes(files.publicEndpointVerifyScript, "no Telegram message was sent");

assertIncludes(
  files.serviceTemplate,
  "serviceAccountName: vertex-claude-execution@PROJECT_ID.iam.gserviceaccount.com",
);
assertIncludes(files.serviceTemplate, 'value: "false"');
assertIncludes(files.serviceTemplate, `value: ${expected.region}`);
assertIncludes(files.serviceTemplate, `value: ${expected.vertexModel}`);
assertIncludes(files.serviceTemplate, `value: ${expected.tokenRotatedAt}`);
assertIncludes(files.serviceTemplate, `value: ${expected.logPrivacyRev}`);
assertIncludes(files.serviceTemplate, "name: telegram-bot-token");
assertIncludes(files.serviceTemplate, "name: telegram-webhook-secret");

const rollbackRunbook = await readFile("ROLLBACK_RUNBOOK.md", "utf8");
assertIncludes(rollbackRunbook, "current production revision");
assertIncludes(rollbackRunbook, "functional emergency rollback revision");
assertIncludes(rollbackRunbook, "not privacy-audited");
assertIncludes(rollbackRunbook, "do not route traffic to it");

for (const [name, contents] of Object.entries(files)) {
  assertNotIncludes(contents, "DRY_RUN=true", `${name} must not set DRY_RUN=true`);
  assertNotIncludes(
    contents,
    "telegram-ai-router-00011-sm5=100",
    `${name} must not route traffic to unsafe revision 00011-sm5`,
  );
}

console.log(
  JSON.stringify(
    {
      ok: true,
      checkedFiles: Object.keys(files),
      productionProfile: {
        projectId: expected.projectId,
        region: expected.region,
        serviceName: expected.serviceName,
        dryRun: false,
        vertexModel: expected.vertexModel,
        logPrivacyRev: expected.logPrivacyRev,
      },
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

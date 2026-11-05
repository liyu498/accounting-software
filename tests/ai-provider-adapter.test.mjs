import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function commandBody(source, command) {
  const marker = `pub async fn ${command}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing command ${command}`);
  const next = source.indexOf("#[tauri::command]", start + marker.length);
  return source.slice(start, next === -1 ? source.length : next);
}

test("AI provider configuration is company scoped and never stores credentials", () => {
  const db = read("src-tauri/src/db.rs");
  const automation = read("src-tauri/src/commands/automation.rs");
  const lib = read("src-tauri/src/lib.rs");

  assert.match(db, /CREATE TABLE IF NOT EXISTS ai_provider_configs/);
  assert.match(db, /credential_env TEXT NOT NULL/);
  assert.doesNotMatch(db, /api_key\s+TEXT|access_token\s+TEXT|secret_key\s+TEXT/);
  assert.match(db, /CREATE TABLE IF NOT EXISTS ai_provider_runs/);
  assert.match(db, /source_checksum TEXT NOT NULL/);
  assert.match(db, /response_payload TEXT/);

  for (const command of [
    "get_ai_provider_configs",
    "upsert_ai_provider_config",
    "run_ai_recognition_job",
  ]) {
    assert.match(automation, new RegExp(`pub async fn ${command}\\(`));
    assert.match(lib, new RegExp(`commands::automation::${command}`));
  }

  for (const command of [
    "upsert_ai_provider_config",
    "run_ai_recognition_job",
  ]) {
    const body = commandBody(automation, command);
    assert.match(body, /auth_token: String/);
    assert.match(body, /authenticated_actor/);
    assert.match(body, /operation_audit_logs/);
  }
});

test("recognition adapter blocks unsafe egress and leaves results pending review", () => {
  const automation = read("src-tauri/src/commands/automation.rs");
  const api = read("src/lib/api.ts");
  const preview = read("src/lib/tauri.ts");
  const workspace = read(
    "src/pages/operations/AiOperationsWorkspace.tsx",
  );

  assert.match(automation, /fn validate_ai_provider_endpoint/);
  assert.match(automation, /https/);
  assert.match(automation, /localhost|loopback|private/i);
  assert.match(automation, /AI_PROVIDER_MAX_FILE_BYTES/);
  assert.match(automation, /std::env::var/);
  assert.match(automation, /pending_review/);
  assert.doesNotMatch(
    commandBody(automation, "run_ai_recognition_job"),
    /generated_voucher_id\s*=/,
  );

  assert.match(api, /export interface AiProviderConfig/);
  assert.match(api, /getAiProviderConfigs/);
  assert.match(api, /upsertAiProviderConfig/);
  assert.match(api, /runAiRecognitionJob/);
  assert.match(preview, /get_ai_provider_configs/);
  assert.match(preview, /run_ai_recognition_job/);
  assert.match(workspace, /识别服务设置/);
  assert.match(workspace, /执行识别/);
  assert.match(workspace, /人工复核/);
});

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('external adapter connections are versioned, secretless, and auditable', () => {
  const db = read('src-tauri/src/db.rs')
  assert.match(db, /const LATEST_SCHEMA_VERSION: i64 = 15/)
  assert.match(db, /name: "verified_external_adapter_connections"/)
  assert.match(db, /CREATE TABLE IF NOT EXISTS adapter_provider_configs/)
  assert.match(db, /credential_env TEXT NOT NULL/)
  assert.doesNotMatch(db, /adapter_provider_configs[\s\S]{0,1200}(?:api_key|access_token|password) TEXT/)
  assert.match(db, /CREATE TABLE IF NOT EXISTS adapter_provider_verifications/)
  assert.match(db, /request_fingerprint TEXT NOT NULL/)
  assert.match(db, /verified_by TEXT NOT NULL/)
})

test('desktop commands configure and verify adapter connections without client actors', () => {
  const automation = read('src-tauri/src/commands/automation.rs')
  const lib = read('src-tauri/src/lib.rs')
  for (const command of [
    'get_adapter_provider_config',
    'upsert_adapter_provider_config',
    'verify_adapter_authorization',
  ]) {
    assert.match(automation, new RegExp(`pub async fn ${command}\\(`))
    assert.match(lib, new RegExp(`commands::automation::${command},`))
  }
  assert.match(automation, /validate_external_provider_endpoint/)
  assert.match(automation, /validate_external_provider_destination/)
  assert.match(automation, /credential_env/)
  assert.match(automation, /std::env::var/)
  assert.match(automation, /RedirectPolicy::none/)
  assert.match(automation, /auth_token: String/)
  assert.match(automation, /authenticated_actor/)
  assert.match(automation, /operation_audit_logs/)
  assert.doesNotMatch(automation, /pub\s+(?:api_key|access_token|password):/)
})

test('frontend exposes connection verification only in the desktop runtime', () => {
  const api = read('src/lib/api.ts')
  const preview = read('src/lib/tauri.ts')
  const workspace = read('src/pages/operations/AdapterAuthorizationWorkspace.tsx')
  assert.match(api, /getAdapterProviderConfig/)
  assert.match(api, /upsertAdapterProviderConfig/)
  assert.match(api, /verifyAdapterAuthorization/)
  assert.match(preview, /真实接口授权验证仅支持桌面版/)
  assert.match(workspace, /连接验证/)
  assert.match(workspace, /凭证环境变量/)
  assert.match(workspace, /https:\/\//)
  assert.match(workspace, /不会保存密钥/)
})

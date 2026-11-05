import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

function commandBody(source, command) {
  const marker = `pub async fn ${command}(`
  const start = source.indexOf(marker)
  assert.notEqual(start, -1, `missing command ${command}`)
  const next = source.indexOf('#[tauri::command]', start + marker.length)
  return source.slice(start, next === -1 ? source.length : next)
}

test('tax adapter executions are versioned, idempotent, and auditable', () => {
  const db = read('src-tauri/src/db.rs')
  assert.match(db, /const LATEST_SCHEMA_VERSION: i64 = 15/)
  assert.match(db, /name: "audited_external_adapter_executions"/)
  assert.match(db, /CREATE TABLE IF NOT EXISTS external_adapter_executions/)
  assert.match(db, /idempotency_key TEXT NOT NULL UNIQUE/)
  assert.match(db, /source_fingerprint TEXT NOT NULL/)
  assert.match(db, /executed_by TEXT NOT NULL/)
  assert.doesNotMatch(db, /external_adapter_executions[\s\S]{0,1600}(?:api_key|access_token|password) TEXT/)
})

test('tax submission enforces immutable preconditions and never submits silently', () => {
  const automation = read('src-tauri/src/commands/automation.rs')
  const submit = commandBody(automation, 'submit_tax_declaration_task')
  assert.match(submit, /submission_confirmed/)
  assert.match(submit, /ensure_tax_submission_ready/)
  assert.match(automation, /fn ensure_tax_submission_ready[\s\S]*declaration_status[\s\S]*confirmed/)
  assert.match(automation, /fn ensure_tax_submission_ready[\s\S]*validation_status[\s\S]*passed/)
  assert.match(automation, /fn ensure_tax_submission_ready[\s\S]*risk_count/)
  assert.match(automation, /fn ensure_tax_submission_ready[\s\S]*snapshot_fingerprint/)
  assert.match(submit, /idempotency_key/)
  assert.match(automation, /fn ensure_authorized_tax_adapter[\s\S]*auth_status[\s\S]*authorized/)
  assert.match(submit, /operation_audit_logs/)
  assert.match(submit, /auth_token: String/)
  assert.match(submit, /authenticated_actor/)
})

test('receipt synchronization is separate from filing and does not initiate payment', () => {
  const automation = read('src-tauri/src/commands/automation.rs')
  const sync = commandBody(automation, 'sync_tax_declaration_receipt')
  assert.match(sync, /sync_confirmed/)
  assert.match(sync, /receipt_no/)
  assert.match(sync, /payment_status/)
  assert.match(sync, /operation_audit_logs/)
  assert.doesNotMatch(sync, /initiate_payment|execute_payment|付款指令/)
})

test('tax submission and receipt sync are wired through desktop and guarded in browser preview', () => {
  const lib = read('src-tauri/src/lib.rs')
  const api = read('src/lib/api.ts')
  const preview = read('src/lib/tauri.ts')
  const workspace = read('src/pages/tax/TaxWorkspace.tsx')
  for (const command of ['submit_tax_declaration_task', 'sync_tax_declaration_receipt']) {
    assert.match(lib, new RegExp(`commands::automation::${command},`))
  }
  assert.match(api, /submitTaxDeclarationTask/)
  assert.match(api, /syncTaxDeclarationReceipt/)
  assert.match(preview, /真实税局申报与回执同步仅支持桌面版/)
  assert.match(workspace, /提交税局/)
  assert.match(workspace, /同步回执/)
  assert.match(workspace, /不会自动发起扣款或付款/)
})

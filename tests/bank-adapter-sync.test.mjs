import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('bank staging is versioned and review-gated', () => {
  const db = read('src-tauri/src/db.rs')
  assert.match(db, /const LATEST_SCHEMA_VERSION: i64 = 15/)
  assert.match(db, /name: "reviewable_external_bank_staging"/)
  assert.match(db, /CREATE TABLE IF NOT EXISTS external_bank_sync_batches/)
  assert.match(db, /CREATE TABLE IF NOT EXISTS external_bank_sync_items/)
  assert.match(db, /account_mask TEXT NOT NULL/)
  assert.match(db, /direction TEXT NOT NULL CHECK \(direction IN \('income', 'expense'\)\)/)
  assert.match(db, /UNIQUE \(authorization_id, external_transaction_id\)/)
})

test('bank sync stages external rows and formal import remains explicit', () => {
  const automation = read('src-tauri/src/commands/automation.rs')
  assert.match(automation, /pub async fn sync_external_bank_statement\(/)
  assert.match(automation, /ensure_authorized_bank_adapter/)
  assert.match(automation, /bank_statement_sync/)
  const syncStart = automation.indexOf('pub async fn sync_external_bank_statement(')
  const syncEnd = automation.indexOf('\n#[tauri::command]', syncStart + 20)
  assert.doesNotMatch(automation.slice(syncStart, syncEnd), /INSERT INTO bank_transactions/)
  const importStart = automation.indexOf('pub async fn import_external_bank_sync_item(')
  const importEnd = automation.indexOf('\n#[tauri::command]', importStart + 20)
  const importBody = automation.slice(importStart, importEnd)
  assert.match(importBody, /review_confirmed/)
  assert.match(importBody, /INSERT INTO bank_transactions/)
  assert.match(importBody, /review_status = 'imported'/)
  assert.match(importBody, /operation_audit_logs/)
})

test('bank adapter commands are wired and browser preview never fakes synchronization', () => {
  const lib = read('src-tauri/src/lib.rs')
  const api = read('src/lib/api.ts')
  const preview = read('src/lib/tauri.ts')
  const workspace = read('src/pages/operations/BankStatementWorkspace.tsx')
  for (const command of [
    'sync_external_bank_statement',
    'get_external_bank_sync_items',
    'import_external_bank_sync_item',
    'reject_external_bank_sync_item',
  ]) assert.match(lib, new RegExp(`commands::automation::${command},`))
  assert.match(api, /syncExternalBankStatement/)
  assert.match(api, /getExternalBankSyncItems/)
  assert.match(preview, /真实银行流水同步仅支持桌面版；浏览器预览不会连接网银、生成流水或发起付款/)
  assert.match(workspace, /同步银行流水/)
  assert.match(workspace, /银行待复核/)
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('invoice-pool staging is versioned, normalized, and reviewable', () => {
  const db = read('src-tauri/src/db.rs')
  assert.match(db, /const LATEST_SCHEMA_VERSION: i64 = 15/)
  assert.match(db, /name: "reviewable_external_invoice_staging"/)
  assert.match(db, /CREATE TABLE IF NOT EXISTS external_invoice_sync_batches/)
  assert.match(db, /CREATE TABLE IF NOT EXISTS external_invoice_sync_items/)
  assert.match(db, /CREATE TABLE IF NOT EXISTS external_invoice_sync_item_lines/)
  assert.match(db, /review_status TEXT NOT NULL/)
  assert.match(db, /UNIQUE \(authorization_id, external_invoice_id\)/)
  assert.match(db, /payload_checksum TEXT NOT NULL/)
})

test('external invoice sync requires a verified channel and never creates formal invoices', () => {
  const automation = read('src-tauri/src/commands/automation.rs')
  assert.match(automation, /pub async fn sync_external_invoice_pool\(/)
  assert.match(automation, /sync_confirmed/)
  assert.match(automation, /ensure_authorized_invoice_pool_adapter/)
  assert.match(automation, /invoice_pool_sync/)
  assert.match(automation, /external_invoice_sync_items/)
  assert.match(automation, /external_invoice_sync_item_lines/)
  const start = automation.indexOf('pub async fn sync_external_invoice_pool(')
  const end = automation.indexOf('\n#[tauri::command]', start + 20)
  const body = automation.slice(start, end)
  assert.doesNotMatch(body, /INSERT INTO invoices/)
  assert.match(body, /operation_audit_logs/)
  assert.match(body, /authenticated_actor/)
})

test('staged invoice import is explicit, transactional, and audit-backed', () => {
  const automation = read('src-tauri/src/commands/automation.rs')
  const start = automation.indexOf('pub async fn import_external_invoice_sync_item(')
  const end = automation.indexOf('\n#[tauri::command]', start + 20)
  const body = automation.slice(start, end)
  assert.ok(start >= 0)
  assert.match(body, /review_confirmed/)
  assert.match(body, /begin\(\)/)
  assert.match(body, /INSERT INTO invoices/)
  assert.match(body, /INSERT INTO invoice_lines/)
  assert.match(body, /review_status = 'imported'/)
  assert.match(body, /operation_audit_logs/)
  assert.match(body, /authenticated_actor/)
})

test('invoice-pool commands are registered, bridged, and blocked in browser preview', () => {
  const lib = read('src-tauri/src/lib.rs')
  const api = read('src/lib/api.ts')
  const preview = read('src/lib/tauri.ts')
  const workspace = read('src/pages/operations/InputInvoiceWorkspace.tsx')
  for (const command of [
    'sync_external_invoice_pool',
    'get_external_invoice_sync_items',
    'import_external_invoice_sync_item',
    'reject_external_invoice_sync_item',
  ]) assert.match(lib, new RegExp(`commands::automation::${command},`))
  assert.match(api, /syncExternalInvoicePool/)
  assert.match(api, /getExternalInvoiceSyncItems/)
  assert.match(api, /importExternalInvoiceSyncItem/)
  assert.match(api, /rejectExternalInvoiceSyncItem/)
  assert.match(preview, /真实发票池同步仅支持桌面版；浏览器预览不会连接票池或生成正式发票/)
  assert.match(workspace, /同步票池/)
  assert.match(workspace, /票池待复核/)
})

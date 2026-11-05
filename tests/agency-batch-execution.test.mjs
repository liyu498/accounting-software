import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('agency batch execution persists one result per account set', () => {
  const db = read('src-tauri/src/db.rs')
  const agency = read('src-tauri/src/commands/agency.rs')

  assert.match(db, /CREATE TABLE IF NOT EXISTS agency_batch_task_items/)
  assert.match(db, /UNIQUE \(task_id, company_id\)/)
  assert.match(agency, /pub async fn get_agency_batch_task_items/)
  assert.match(agency, /pub async fn run_agency_batch_task/)
  assert.match(agency, /run_agency_batch_task_record/)
  assert.match(agency, /'批量操作', '执行批量任务'/)
})

test('batch execution dispatches safe local work and uses the accounting close guard', () => {
  const agency = read('src-tauri/src/commands/agency.rs')
  const periods = read('src-tauri/src/commands/periods.rs')

  assert.match(agency, /close_period_record/)
  assert.match(agency, /INSERT INTO automation_jobs/)
  assert.match(agency, /invoice_collection/)
  assert.match(agency, /bank_collection/)
  assert.match(agency, /tax_package_generation/)
  assert.match(periods, /pub\(crate\) async fn close_period_record/)
  assert.match(periods, /ensure_period_reconciled/)
})

test('agency batch page exposes execution and per-account result details', () => {
  const api = read('src/lib/api.ts')
  const page = read('src/pages/agency/AgencyModulePage.tsx')
  const bridge = read('src/lib/tauri.ts')

  assert.match(api, /getBatchTaskItems:/)
  assert.match(api, /runBatchTask:/)
  assert.match(page, /执行任务/)
  assert.match(page, /逐账套结果/)
  assert.match(bridge, /cmd === "run_agency_batch_task"/)
  assert.match(bridge, /cmd === "get_agency_batch_task_items"/)
  assert.match(bridge, /浏览器预览不执行正式批量结账/)
})

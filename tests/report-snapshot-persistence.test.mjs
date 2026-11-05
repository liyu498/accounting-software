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

test('statutory reports persist immutable scoped versions with server-derived actors', () => {
  const db = read('src-tauri/src/db.rs')
  const periods = read('src-tauri/src/commands/periods.rs')
  const lib = read('src-tauri/src/lib.rs')

  assert.match(db, /CREATE TABLE IF NOT EXISTS report_snapshots/)
  assert.match(db, /UNIQUE \(company_id, period_id, report_type, version\)/)
  assert.match(db, /snapshot_json TEXT NOT NULL/)
  assert.match(db, /source_fingerprint TEXT NOT NULL/)
  assert.match(db, /template_fingerprint TEXT/)

  for (const command of ['publish_report_snapshot', 'get_report_snapshots', 'get_report_snapshot']) {
    assert.match(periods, new RegExp(`pub async fn ${command}\\(`))
    assert.match(lib, new RegExp(`commands::periods::${command}`))
  }

  const publish = commandBody(periods, 'publish_report_snapshot')
  assert.match(publish, /auth_token: String/)
  assert.match(publish, /authenticated_actor/)
  assert.match(publish, /build_report_snapshot_payload/)
  assert.match(publish, /INSERT INTO report_snapshots/)
  assert.match(publish, /operation_audit_logs/)
  assert.match(periods, /fn stable_report_fingerprint/)
})

test('report formula mutations retain immutable before and after notes', () => {
  const db = read('src-tauri/src/db.rs')
  const periods = read('src-tauri/src/commands/periods.rs')

  assert.match(db, /CREATE TABLE IF NOT EXISTS report_formula_notes/)
  assert.match(db, /before_json TEXT/)
  assert.match(db, /after_json TEXT/)
  assert.match(db, /operator TEXT NOT NULL/)
  assert.match(periods, /write_report_formula_note/)

  for (const command of ['create_report_item', 'update_report_item', 'delete_report_item']) {
    const body = commandBody(periods, command)
    assert.match(body, /auth_token: String/, `${command} must receive the authenticated session`)
    assert.match(body, /authenticated_actor/, `${command} must derive its actor server-side`)
    assert.match(body, /write_report_formula_note/, `${command} must retain immutable change evidence`)
  }
})

test('financial statement workspace publishes and reopens versioned snapshots', () => {
  const api = read('src/lib/api.ts')
  const preview = read('src/lib/tauri.ts')
  const workspace = read('src/pages/operations/FinancialStatementWorkspace.tsx')

  assert.match(api, /export interface ReportSnapshot/)
  assert.match(api, /publishReportSnapshot/)
  assert.match(api, /getReportSnapshots/)
  assert.match(api, /getReportSnapshot/)
  assert.match(preview, /publish_report_snapshot/)
  assert.match(preview, /get_report_snapshots/)
  assert.match(preview, /get_report_snapshot/)
  assert.match(workspace, /发布快照/)
  assert.match(workspace, /历史版本/)
  assert.match(workspace, /sourceFingerprint/)
})

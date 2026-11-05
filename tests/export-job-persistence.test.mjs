import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('desktop export jobs are immutable, scoped, and audited in SQLite', () => {
  const db = read('src-tauri/src/db.rs')
  const commands = read('src-tauri/src/commands/export_jobs.rs')
  const lib = read('src-tauri/src/lib.rs')

  assert.match(db, /CREATE TABLE IF NOT EXISTS export_jobs/)
  assert.match(db, /scope_kind TEXT NOT NULL CHECK \(scope_kind IN \('account', 'agency'\)\)/)
  assert.match(commands, /pub async fn get_export_jobs/)
  assert.match(commands, /pub async fn create_export_job/)
  assert.match(commands, /authenticated_actor/)
  assert.match(commands, /operation_audit_logs/)
  assert.match(lib, /commands::export_jobs::get_export_jobs/)
  assert.match(lib, /commands::export_jobs::create_export_job/)
})

test('export producers register successful account and agency jobs', () => {
  const registry = read('src/lib/exportJobs.ts')
  const operational = read('src/components/operations/OperationalExportActions.tsx')
  const accounting = read('src/components/operations/AccountingReportExportActions.tsx')
  const agency = read('src/pages/agency/AgencyModulePage.tsx')
  const fileCenter = read('src/pages/operations/FileCenterWorkspace.tsx')

  assert.match(registry, /invoke<RawExportJob\[]>\('get_export_jobs'/)
  assert.match(registry, /invoke<RawExportJob>\('create_export_job'/)
  assert.match(registry, /export async function recordExportJob/)
  assert.match(registry, /scopeKind:\s*'account'\s*\|\s*'agency'/)
  assert.match(operational, /await recordExportJob/)
  assert.match(accounting, /await recordExportJob/)
  assert.match(agency, /useExportJobs\('agency'\)/)
  assert.match(agency, /await recordExportJob/)
  assert.match(fileCenter, /useExportJobs\('account'\)/)
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('tax declarations persist immutable versioned source snapshots', () => {
  const db = read('src-tauri/src/db.rs')
  const commands = read('src-tauri/src/commands/automation.rs')

  assert.match(db, /CREATE TABLE IF NOT EXISTS tax_declaration_snapshots/)
  assert.match(db, /UNIQUE \(task_id, version\)/)
  assert.match(db, /snapshot_version INTEGER NOT NULL DEFAULT 0/)
  assert.match(db, /snapshot_fingerprint TEXT/)
  assert.match(commands, /write_tax_declaration_snapshot/)
  assert.match(commands, /pub async fn upsert_tax_declaration_task[\s\S]*?auth_token: String/)
  assert.match(commands, /upsert_tax_declaration_task[\s\S]*?authenticated_actor/)
  assert.match(commands, /tax_declaration_snapshots/)
  assert.match(commands, /operation_audit_logs/)
  assert.match(commands, /已完成本地确认的申报事项不能再次覆盖/)
})

test('tax package exposes the immutable snapshot identity', () => {
  const api = read('src/lib/api.ts')
  const workspace = read('src/pages/tax/TaxWorkspace.tsx')
  const preview = read('src/lib/tauri.ts')

  assert.match(api, /snapshotVersion: number/)
  assert.match(api, /snapshotFingerprint: string \| null/)
  assert.match(api, /snapshot_version: number/)
  assert.match(api, /snapshot_fingerprint: string \| null/)
  assert.match(workspace, /snapshotVersion/)
  assert.match(workspace, /snapshotFingerprint/)
  assert.match(workspace, /快照版本/)
  assert.match(workspace, /任务指纹/)
  assert.match(preview, /snapshot_version: number/)
  assert.match(preview, /snapshot_fingerprint: string \| null/)
})

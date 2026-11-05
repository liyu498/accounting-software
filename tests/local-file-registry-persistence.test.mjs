import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('desktop file registry is persisted and scoped in SQLite', () => {
  const db = read('src-tauri/src/db.rs')
  const commands = read('src-tauri/src/commands/local_files.rs')
  const lib = read('src-tauri/src/lib.rs')

  assert.match(db, /CREATE TABLE IF NOT EXISTS local_file_records/)
  assert.match(db, /record_kind TEXT NOT NULL CHECK \(record_kind IN \('import', 'attachment'\)\)/)
  assert.match(db, /deleted_at TEXT/)
  assert.match(commands, /pub async fn get_local_file_records/)
  assert.match(commands, /pub async fn create_local_file_record/)
  assert.match(commands, /pub async fn update_local_file_record/)
  assert.match(commands, /pub async fn delete_local_file_record/)
  assert.match(commands, /pub async fn copy_local_voucher_attachments/)
  assert.match(commands, /authenticated_actor/)
  assert.match(commands, /operation_audit_logs/)
  assert.match(commands, /deleted_at = datetime\('now'\)/)
  assert.match(lib, /commands::local_files::get_local_file_records/)
  assert.match(lib, /commands::local_files::copy_local_voucher_attachments/)
})

test('desktop registry bridge uses commands while browser preview retains local storage', () => {
  const registry = read('src/lib/localFileRegistry.ts')
  const fileCenter = read('src/pages/operations/FileCenterWorkspace.tsx')
  const voucherList = read('src/pages/operations/VoucherWorkspace.tsx')
  const voucherDetail = read('src/pages/operations/VoucherDetailWorkspace.tsx')

  assert.match(registry, /invoke<RawLocalFileRecord\[]>\('get_local_file_records'/)
  assert.match(registry, /invoke<RawLocalFileRecord>\('create_local_file_record'/)
  assert.match(registry, /invoke<RawLocalFileRecord>\('update_local_file_record'/)
  assert.match(registry, /invoke<boolean>\('delete_local_file_record'/)
  assert.match(registry, /invoke<RawLocalFileRecord\[]>\('copy_local_voucher_attachments'/)
  assert.match(registry, /if \(isTauri\)/)
  assert.match(registry, /window\.localStorage/)
  assert.match(fileCenter, /await updateLocalAttachmentAssociation/)
  assert.match(fileCenter, /await updateLocalImportJobValidation/)
  assert.match(voucherList, /await copyLocalVoucherAttachmentAssociations/)
  assert.match(voucherDetail, /await copyLocalVoucherAttachmentAssociations/)
})

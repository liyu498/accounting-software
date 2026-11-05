import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const db = readFileSync(
  new URL('../src-tauri/src/db.rs', import.meta.url),
  'utf8',
)

test('database upgrades are recorded as ordered versioned migrations', () => {
  assert.match(db, /CREATE TABLE IF NOT EXISTS schema_migrations/)
  assert.match(db, /const LATEST_SCHEMA_VERSION: i64 = \d+/)
  assert.match(db, /async fn run_versioned_migrations/)
  assert.match(db, /ORDER BY version/)
  assert.match(db, /INSERT INTO schema_migrations/)
  assert.match(db, /transaction\.commit\(\)/)
})

test('migration tests cover legacy upgrades and transactional rollback', () => {
  assert.match(db, /upgrades_a_legacy_database_without_losing_business_data/)
  assert.match(db, /failed_versioned_migration_rolls_back_every_statement/)
  assert.match(db, /rollback_probe/)
  assert.match(db, /tax_deadline_rules/)
  assert.match(db, /tax_calendar_days/)
})

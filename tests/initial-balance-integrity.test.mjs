import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('initial balances are limited to detail accounts and keep a persisted lock', () => {
  const backend = read('src-tauri/src/commands/periods.rs')
  const database = read('src-tauri/src/db.rs')
  const workspace = read('src/pages/operations/InitializationWorkspace.tsx')
  const store = read('src/stores/periodStore.ts')

  assert.match(database, /initial_balances_finalized_at/)
  assert.match(database, /initial_balances_finalized_by/)
  assert.match(backend, /期初余额已确认，不能继续修改/)
  assert.match(backend, /is_detail = 1/)
  assert.match(workspace, /account\.is_detail === 1/)
  assert.match(workspace, /initial_balances_finalized_at/)
  assert.match(store, /initial_balances_finalized_at:\s*string \| null/)
})

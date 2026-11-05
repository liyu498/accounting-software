import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('cash-flow reports expose and display cash-balance reconciliation', () => {
  const backend = read('src-tauri/src/commands/periods.rs')
  const store = read('src/stores/periodStore.ts')
  const workspace = read('src/pages/operations/FinancialStatementWorkspace.tsx')
  const logic = read('src/lib/reportLogic.ts')

  for (const source of [backend, store]) {
    assert.match(source, /cash_balance_change/)
    assert.match(source, /reconciliation_difference/)
    assert.match(source, /is_reconciled/)
  }
  assert.match(workspace, /现金勾稽/)
  assert.match(workspace, /现金及现金等价物余额变动/)
  assert.match(logic, /cash_balance_change:/)
  assert.match(logic, /is_reconciled:/)
})

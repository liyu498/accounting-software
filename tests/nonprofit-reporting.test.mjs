import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('2026 nonprofit activity statement uses a classified statutory matrix', () => {
  const store = read('src/stores/periodStore.ts')
  const workspace = read('src/pages/operations/FinancialStatementWorkspace.tsx')

  assert.match(store, /nonprofit_activity_matrix/)
  assert.match(store, /classification_complete: boolean/)
  assert.match(store, /current_unrestricted_amount: number/)
  assert.match(store, /current_restricted_amount: number/)
  assert.match(store, /ytd_unrestricted_amount: number/)
  assert.match(store, /ytd_restricted_amount: number/)
  assert.match(workspace, /income_activity_matrix/)
  assert.match(workspace, /本月数/)
  assert.match(workspace, /本年累计数/)
  assert.match(workspace, /非限定性/)
  assert.match(workspace, /限定性/)
  assert.match(workspace, /headerGroups/)
})

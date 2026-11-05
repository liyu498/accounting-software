import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('enterprise income statement uses current and prior comparative statutory columns', () => {
  const store = read('src/stores/periodStore.ts')
  const workspace = read('src/pages/operations/FinancialStatementWorkspace.tsx')

  assert.match(store, /column_basis: 'monthly_ytd' \| 'current_comparative' \| 'nonprofit_activity_matrix'/)
  assert.match(store, /has_comparative_period: boolean/)
  assert.match(store, /comparative_amount: number/)
  assert.match(workspace, /column_basis === 'current_comparative'/)
  assert.match(workspace, /comparative_amount/)
  assert.match(workspace, /本期金额/)
  assert.match(workspace, /上期金额/)
  assert.match(workspace, /缺少上年同期账期/)
})

test('enterprise cash-flow statement uses the same current and prior comparative columns', () => {
  const store = read('src/stores/periodStore.ts')
  const workspace = read('src/pages/operations/FinancialStatementWorkspace.tsx')

  assert.match(store, /net_increase_comparative: number/)
  assert.match(workspace, /cashFlowStatement\?\.column_basis === 'current_comparative'/)
  assert.match(workspace, /item\.comparative_amount/)
})

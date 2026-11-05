import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('cash-flow mappings use structured account, direction, and report-item fields', () => {
  const store = read('src/stores/matchingRuleStore.ts')
  const workspace = read('src/pages/operations/MatchingRuleWorkspace.tsx')

  for (const field of [
    'source_account_code',
    'cash_direction',
    'cash_flow_item_code',
    'summary_keyword',
  ]) {
    assert.match(store, new RegExp(field))
  }
  assert.match(workspace, /useAccountStore/)
  assert.match(workspace, /useReportTemplateStore/)
  assert.match(workspace, /来源科目/)
  assert.match(workspace, /现金方向/)
  assert.match(workspace, /现金流量项目/)
  assert.match(workspace, /摘要关键词/)
})

test('cash-flow reports expose mapping completeness and estimate mode', () => {
  const backend = read('src-tauri/src/commands/periods.rs')
  const store = read('src/stores/periodStore.ts')
  const workspace = read('src/pages/operations/FinancialStatementWorkspace.tsx')

  for (const source of [backend, store]) {
    assert.match(source, /classification_mode/)
    assert.match(source, /unmapped_cash_amount/)
    assert.match(source, /is_classification_complete/)
  }
  assert.match(workspace, /科目公式估算/)
  assert.match(workspace, /未映射现金/)
  assert.match(workspace, /凭证映射/)
})

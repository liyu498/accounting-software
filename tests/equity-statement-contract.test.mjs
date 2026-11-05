import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('enterprise and cooperative equity changes use statutory layouts with component data', () => {
  const rustEntry = read('src-tauri/src/lib.rs')
  const commands = read('src-tauri/src/commands/periods.rs')
  const store = read('src/stores/periodStore.ts')
  const workspace = read('src/pages/operations/FinancialStatementWorkspace.tsx')
  const liveRows = read('src/lib/liveModuleRows.ts')

  assert.match(rustEntry, /commands::periods::get_equity_change_statement/)
  assert.match(commands, /pub async fn get_equity_change_statement/)
  assert.match(commands, /find_report_template_for_company[\s\S]*"equity_change"/)
  assert.match(store, /export interface EquityChangeResult/)
  assert.match(store, /invoke<EquityChangeResult>\('get_equity_change_statement'/)
  assert.match(workspace, /getEquityChangeStatement/)
  assert.match(workspace, /\['enterprise', 'cooperative'\]\.includes/)
  assert.match(workspace, /会农社 03 表/)
  assert.match(workspace, /equity_change_matrix/)
  assert.match(workspace, /classification_complete/)
  assert.match(store, /columns: EquityChangeColumn\[\]/)
  assert.match(store, /values: number\[\]/)
  assert.match(store, /comparative_values: number\[\]/)
  assert.match(store, /has_comparative_period: boolean/)
  assert.match(workspace, /本年金额/)
  assert.match(workspace, /上年金额/)
  assert.match(workspace, /headerGroups/)
  assert.match(workspace, /净资产变动分析/)
  assert.match(workspace, /所有者权益变动分析/)
  assert.match(workspace, /reportKind: 'management_statement'/)
  assert.doesNotMatch(liveRows, /\['capitalReserve', 'BS602'\]/)
  assert.match(liveRows, /findEquityItemByName/)
})

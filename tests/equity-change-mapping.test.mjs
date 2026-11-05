import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('equity change classification rules have a reachable accounting-system-aware workspace', () => {
  const app = read('src/App.tsx')
  const shell = read('src/components/layout/AppShell.tsx')
  const store = read('src/stores/matchingRuleStore.ts')
  const workspace = read('src/pages/operations/MatchingRuleWorkspace.tsx')

  assert.match(store, /'equity_change'/)
  assert.match(store, /'increase' \| 'decrease'/)
  assert.match(app, /EquityChangeMappingWorkspace/)
  assert.match(app, /path="\/settings\/equity-change-mapping"/)
  assert.match(shell, /权益变动映射/)
  assert.match(shell, /\/settings\/equity-change-mapping/)
  assert.match(workspace, /export function EquityChangeMappingWorkspace/)
  assert.match(workspace, /scope: "equity_change"/)
  assert.match(workspace, /report_type === "equity_change"/)
  assert.match(workspace, /权益增加/)
  assert.match(workspace, /权益减少/)
})

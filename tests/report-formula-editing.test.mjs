import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('report formula editing persists statutory line numbers and calculation signs', () => {
  const commands = read('src-tauri/src/commands/periods.rs')
  const store = read('src/stores/reportTemplateStore.ts')
  const workspace = read('src/pages/operations/ReportFormulaWorkspace.tsx')

  assert.match(commands, /pub line_number: Option<String>/)
  assert.match(commands, /pub calculation_sign: Option<i32>/)
  assert.match(commands, /UPDATE report_items SET[\s\S]*line_number = \?[\s\S]*calculation_sign = \?/)
  assert.match(commands, /INSERT INTO report_items[\s\S]*line_number, calculation_sign/)
  assert.match(store, /lineNumber: string/)
  assert.match(store, /calculationSign: number/)
  assert.match(store, /line_number: input\.lineNumber/)
  assert.match(store, /calculation_sign: input\.calculationSign/)
  assert.match(workspace, /lineNumber: string/)
  assert.match(workspace, /calculationSign: 1 \| -1/)
  assert.match(workspace, /Field label="汇总方向"/)
  assert.match(workspace, /aria-pressed=\{draft\.calculationSign === -1\}/)
})

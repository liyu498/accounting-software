import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('system report templates are immutable and can be cloned per company', () => {
  const database = read('src-tauri/src/db.rs')
  const commands = read('src-tauri/src/commands/periods.rs')
  const rustEntry = read('src-tauri/src/lib.rs')
  const store = read('src/stores/reportTemplateStore.ts')
  const workspace = read('src/pages/operations/ReportFormulaWorkspace.tsx')

  assert.match(database, /report_templates ADD COLUMN company_id TEXT/)
  assert.match(commands, /pub company_id: Option<String>/)
  assert.match(commands, /pub async fn clone_report_template_for_company/)
  assert.match(commands, /系统标准模板只读/)
  assert.match(commands, /is_statutory[\s\S]*0/)
  assert.match(rustEntry, /commands::periods::clone_report_template_for_company/)
  assert.match(store, /cloneReportTemplate/)
  assert.match(store, /clone_report_template_for_company/)
  assert.match(workspace, /复制为账套模板/)
  assert.match(workspace, /activeTemplate\?\.is_system === 1/)
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('invoice detail and tax history use durable scoped tables', () => {
  const db = read('src-tauri/src/db.rs')
  assert.match(db, /CREATE TABLE IF NOT EXISTS invoice_lines/)
  assert.match(db, /UNIQUE \(invoice_id, line_no\)/)
  assert.match(db, /CREATE TABLE IF NOT EXISTS invoice_tax_events/)
  assert.match(db, /prevent_invoice_tax_event_update/)
  assert.match(db, /prevent_invoice_tax_event_delete/)
  assert.match(db, /invoice tax events are immutable/)
})

test('invoice detail writes reconcile cents and commit with audit', () => {
  const commands = read('src-tauri/src/commands/invoices.rs')
  assert.match(commands, /fn money_cents/)
  assert.match(commands, /detail_amount_cents != money_cents\(header_amount\)/)
  assert.match(commands, /detail_tax_cents != money_cents\(header_tax_amount\)/)
  assert.match(commands, /pub async fn update_invoice_with_lines/)
  assert.match(commands, /更新发票及明细/)
  assert.match(commands, /authenticated_actor\(db\.pool\(\), &auth_token\)/)
  assert.match(commands, /发票状态和凭证关联必须通过专用业务流程变更/)
})

test('input tax events and output review are dedicated audited workflows', () => {
  const commands = read('src-tauri/src/commands/invoices.rs')
  assert.match(commands, /pub async fn create_invoice_tax_event/)
  assert.match(commands, /只有进项发票可以登记认证与抵扣历史/)
  assert.match(commands, /请先补齐并核对发票货物或服务明细/)
  assert.match(commands, /pub async fn review_output_invoice/)
  assert.match(commands, /销项发票明细合计与表头不一致/)
  assert.match(commands, /'发票管理', '复核销项发票'/)
})

test('invoice workspaces expose line reconciliation and immutable tax history', () => {
  const api = read('src/lib/api.ts')
  const input = read('src/pages/operations/InputInvoiceWorkspace.tsx')
  const output = read('src/pages/operations/OutputInvoiceWorkspace.tsx')
  const lineEditor = read('src/components/operations/InvoiceLineEditor.tsx')

  assert.match(api, /updateWithLines:/)
  assert.match(api, /createTaxEvent:/)
  assert.match(api, /reviewOutput:/)
  assert.match(input, /<InvoiceLineEditor/)
  assert.match(output, /<InvoiceLineEditor/)
  assert.match(input, /aria-label="进项税务记录"/)
  assert.match(input, /追加式本地记录不可修改或删除/)
  assert.match(output, /invoiceApi\.reviewOutput/)
  assert.match(lineEditor, /明细金额/)
  assert.match(lineEditor, /核对一致/)
})

test('invoice creation always requires reconciled detail lines', () => {
  const commands = read('src-tauri/src/commands/invoices.rs')
  const api = read('src/lib/api.ts')
  const bridge = read('src/lib/tauri.ts')

  assert.match(commands, /pub lines: Vec<InvoiceLineInput>/)
  assert.doesNotMatch(commands, /if let Some\(lines\) = input\.lines\.as_ref\(\)/)
  assert.match(api, /lines: InvoiceLineInput\[\]/)
  assert.match(bridge, /if \(rawLines\.length === 0\) throw new Error\("发票至少需要一条货物或服务明细"\)/)
})

test('legacy invoice store cannot bypass dedicated detail workflows', () => {
  const store = read('src/stores/invoiceStore.ts')
  const api = read('src/lib/api.ts')
  const rustEntry = read('src-tauri/src/lib.rs')

  assert.doesNotMatch(store, /createInvoice:/)
  assert.doesNotMatch(store, /updateInvoice:/)
  assert.doesNotMatch(store, /deleteInvoice:/)
  assert.doesNotMatch(api, /\n  update: async \(id: string, invoice:/)
  assert.doesNotMatch(rustEntry, /commands::invoices::update_invoice,/)
})

test('invoice deletion and voucher matching use server actors and immutable audit', () => {
  const commands = read('src-tauri/src/commands/invoices.rs')
  const bridge = read('src/lib/tauri.ts')
  const input = read('src/pages/operations/InputInvoiceWorkspace.tsx')
  const output = read('src/pages/operations/OutputInvoiceWorkspace.tsx')

  assert.match(commands, /async fn delete_invoice_record/)
  assert.match(commands, /只有待复核且未关联凭证的发票可以删除/)
  assert.match(commands, /'发票管理', '删除发票'/)
  assert.match(commands, /async fn match_invoice_to_voucher_record/)
  assert.match(commands, /发票明细合计与表头不一致，不能关联凭证/)
  assert.match(commands, /'发票管理', '关联发票与凭证'/)
  assert.match(bridge, /action: "删除发票"/)
  assert.match(bridge, /action: "关联发票与凭证"/)
  assert.match(input, /invoiceApi\.delete\(invoice\.id, companyId\)/)
  assert.match(output, /invoiceApi\.delete\(invoice\.id, companyId\)/)
  assert.match(input, /aria-label="删除进项发票"/)
  assert.match(output, /aria-label="删除销项发票"/)
})

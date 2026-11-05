import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('accounting reconciliation is wired from Tauri through closing checks', () => {
  const tauri = read('src-tauri/src/lib.rs')
  const periodStore = read('src/stores/periodStore.ts')
  const browserBridge = read('src/lib/tauri.ts')
  const closingWorkspace = read('src/pages/operations/ClosingTasksWorkspace.tsx')
  const periodCommands = read('src-tauri/src/commands/periods.rs')

  assert.match(tauri, /commands::periods::get_accounting_reconciliation/)
  assert.match(periodStore, /export interface AccountingReconciliationResult/)
  assert.match(periodStore, /getAccountingReconciliation:.*AccountingReconciliationResult/)
  assert.match(periodStore, /invoke<AccountingReconciliationResult>\('get_accounting_reconciliation'/)
  assert.match(browserBridge, /cmd === "get_accounting_reconciliation"/)
  assert.match(browserBridge, /balance_sheet_equation/)
  assert.match(closingWorkspace, /getAccountingReconciliation/)
  assert.match(closingWorkspace, /title: '账簿与报表勾稽'/)
  assert.match(closingWorkspace, /reconciliation\.is_reconciled/)
  assert.match(closingWorkspace, /资产负债表、利润表、权益变动表/)
  assert.match(periodCommands, /"equity_statement_to_balance_sheet"/)
  assert.match(periodCommands, /"equity_change_classification"/)
  assert.match(periodCommands, /"net_profit_to_equity_classification"/)
  assert.match(periodCommands, /"surplus_to_equity_classification"/)
  assert.match(periodCommands, /close_period_record\(db\.pool\(\), &input\.period_id, &actor\)/)
  assert.match(periodCommands, /pub\(crate\) async fn close_period_record/)
  assert.match(periodCommands, /ensure_period_close_sequence\(pool, &company_id, period_id\)/)
  assert.match(periodCommands, /ensure_settlement_rules_completed/)
  assert.match(periodCommands, /ensure_period_reconciled\(pool, period_id\)/)
  assert.match(periodCommands, /ensure_period_reopen_sequence\(db\.pool\(\), &company_id, &period_id\)/)
  assert.match(periodCommands, /'账期管理', '结账'/)
  assert.match(periodCommands, /'账期管理', '反结账'/)
})

test('period-bound accounting source commands reject writes to closed periods', () => {
  const labelPeriodModules = [
    'account_transfers',
    'bank_reconciliation_records',
    'bank_transactions',
    'business_orders',
    'document_records',
    'fixed_assets',
    'inventory_movements',
    'payroll',
    'settlement_records',
    'social_security',
  ]

  for (const module of labelPeriodModules) {
    const source = read(`src-tauri/src/commands/${module}.rs`)
    const guardReferences = source.match(/ensure_period_label_open/g) ?? []
    assert.ok(
      guardReferences.length >= 3,
      `${module} must guard both create and update paths with the shared period lock`,
    )
  }

  const inventoryMovements = read('src-tauri/src/commands/inventory_movements.rs')
  assert.match(
    inventoryMovements,
    /ensure_period_label_open\(db\.pool\(\), &company_id, &movement\.period, "生成成本结转"\)/,
  )

  const costCarryovers = read('src-tauri/src/commands/cost_carryover_records.rs')
  assert.match(
    costCarryovers,
    /ensure_period_label_open\([\s\S]*?&i\.company_id,[\s\S]*?&current\.period,[\s\S]*?"修改成本结转记录"/,
    'cost carryover review must reject updates to a closed period',
  )

  const invoices = read('src-tauri/src/commands/invoices.rs')
  const invoiceGuardReferences = invoices.match(/ensure_period_id_open/g) ?? []
  assert.ok(
    invoiceGuardReferences.length >= 5,
    'invoice create, update, delete, and voucher matching paths must share the period-id lock',
  )

  const vouchers = read('src-tauri/src/commands/vouchers.rs')
  const copyStart = vouchers.indexOf('pub async fn copy_voucher(')
  const copyEnd = vouchers.indexOf('#[tauri::command]', copyStart + 1)
  const copyBody = vouchers.slice(copyStart, copyEnd)
  assert.match(copyBody, /ensure_period_id_open/)
  assert.match(vouchers, /async fn ensure_import_period_open/)
  assert.match(vouchers, /ensure_import_period_open\(&resolved_period_id, &mut tx\)/)
  assert.match(vouchers, /已结账期间不能导入凭证/)
})

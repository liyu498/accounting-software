import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('subsidiary ledger preserves balance direction and voucher drill-through', () => {
  const backend = read('src-tauri/src/commands/periods.rs')
  const workspace = read('src/pages/operations/LedgerDetailWorkspace.tsx')

  assert.match(backend, /fn subsidiary_balance_direction/)
  assert.match(backend, /SELECT v\.id, v\.voucher_date/)
  assert.match(backend, /balance_direction:\s*subsidiary_balance_direction/)
  assert.match(workspace, /voucherId\?: string/)
  assert.match(workspace, /voucherId:\s*row\.voucher_id \|\| undefined/)
  assert.match(workspace, /navigate\(`\/vouchers\/detail\/\$\{row\.voucherId\}`\)/)
})

test('ledger hierarchy uses detail accounts for subsidiary selection and preserves source accounts', () => {
  const backend = read('src-tauri/src/commands/periods.rs')
  const workspace = read('src/pages/operations/LedgerDetailWorkspace.tsx')
  const report = read('src/pages/operations/LedgerReportWorkspace.tsx')
  const store = read('src/stores/periodStore.ts')

  assert.match(backend, /async fn build_general_ledger/)
  assert.match(backend, /source_account_code/)
  assert.match(backend, /source_account_name/)
  assert.match(workspace, /detailAccounts/)
  assert.match(workspace, /trialBalance\?\.items\.filter\(\(item\) => item\.is_detail\)/)
  assert.match(report, /entry\.source_account_code/)
  assert.match(store, /source_account_code:\s*string/)
  assert.match(store, /source_account_name:\s*string/)
})

test('voucher posting normalizes each closing balance to one side', () => {
  const vouchers = read('src-tauri/src/commands/vouchers.rs')
  const database = read('src-tauri/src/db.rs')

  assert.match(vouchers, /recompute_account_closing_balance/)
  assert.doesNotMatch(
    vouchers,
    /closing_debit\s*=\s*opening_debit\s*\+\s*period_debit/,
  )
  assert.match(database, /UPDATE account_balances[\s\S]*closing_debit = CASE/)
})

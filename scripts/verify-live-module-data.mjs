import { readFileSync } from 'node:fs'

const adapterSource = readFileSync('src/lib/liveModuleRows.ts', 'utf8')
const pageSource = readFileSync('src/pages/operations/BusinessModulePage.tsx', 'utf8')

const requiredAdapterSnippets = [
  ['invoice row mapper', 'export function mapLiveInvoiceRows'],
  ['voucher row mapper', 'export function mapLiveVoucherRows'],
  ['invoice summary mapper', 'export function summarizeLiveInvoices'],
  ['voucher summary mapper', 'export function summarizeLiveVouchers'],
  ['trial balance row mapper', 'export function mapLiveTrialBalanceRows'],
  ['general ledger row mapper', 'export function mapLiveGeneralLedgerRows'],
  ['balance sheet row mapper', 'export function mapLiveBalanceSheetRows'],
  ['income statement row mapper', 'export function mapLiveIncomeStatementRows'],
  ['cash flow row mapper', 'export function mapLiveCashFlowRows'],
  ['company info row mapper', 'export function mapLiveCompanyInfoRows'],
  ['initial balance row mapper', 'export function mapLiveInitialBalanceRows'],
  ['output invoice type', "invoice.invoice_type === invoiceType"],
  ['invoice type boundary', "invoiceType: 'output' | 'input'"],
  ['voucher direction filter', "entry.direction === direction"],
  ['voucher debit mapping', "entryAccount(voucher.entries, 'debit')"],
  ['voucher credit mapping', "entryAccount(voucher.entries, 'credit')"],
]

const requiredPageSnippets = [
  ['live invoice store import', "from '../../stores/invoiceStore'"],
  ['live voucher store import', "from '../../stores/voucherStore'"],
  ['selected company integration', 'selectedCompanyId'],
  ['current period integration', 'currentPeriodId'],
  ['live data refresh effect', 'fetchInvoices({'],
  ['live voucher query effect', 'queryVouchers({'],
  ['output live row mapping', 'mapLiveInvoiceRows(invoices, \'output\')'],
  ['input live row mapping', 'mapLiveInvoiceRows(invoices, \'input\')'],
  ['voucher live row mapping', 'mapLiveVoucherRows(vouchers)'],
  ['trial balance refresh', 'fetchTrialBalance(currentPeriodId)'],
  ['general ledger refresh', 'getGeneralLedger(currentPeriodId)'],
  ['balance sheet refresh', 'getBalanceSheet(currentPeriodId)'],
  ['income statement refresh', 'getIncomeStatement(currentPeriodId)'],
  ['cash flow refresh', 'getCashFlowStatement(currentPeriodId)'],
  ['trial balance mapping', 'mapLiveTrialBalanceRows(liveReports.trialBalance)'],
  ['general ledger mapping', 'mapLiveGeneralLedgerRows(liveReports.generalLedger)'],
  ['balance sheet mapping', 'mapLiveBalanceSheetRows(liveReports.balanceSheet)'],
  ['income statement mapping', 'mapLiveIncomeStatementRows(liveReports.incomeStatement)'],
  ['cash flow mapping', 'mapLiveCashFlowRows(liveReports.cashFlow)'],
  ['company info mapping', 'mapLiveCompanyInfoRows(selectedCompany)'],
  ['initial balance mapping', 'mapLiveInitialBalanceRows(liveReports.initialBalance)'],
  ['initial balance validation', 'validateInitialBalances(currentPeriodId)'],
  ['browser mock fallback', 'isTauri && selectedCompanyId'],
]

function verify(source, checks, sourceName) {
  return checks
    .filter(([, snippet]) => !source.includes(snippet))
    .map(([label, snippet]) => `${sourceName}: ${label} missing snippet: ${snippet}`)
}

const errors = [
  ...verify(adapterSource, requiredAdapterSnippets, 'live module adapter'),
  ...verify(pageSource, requiredPageSnippets, 'business module page'),
]

if (errors.length > 0) {
  console.error('Live data adapter verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Live data adapter verification passed:')
console.log(JSON.stringify({
  modules: ['outputInvoice', 'inputInvoice', 'voucher', 'trialBalanceReport', 'generalLedgerReport', 'balanceSheetReport', 'incomeStatementReport', 'cashFlowReport', 'companyInfo', 'initialBalance'],
  scope: 'selected company and accounting period',
  browserFallback: 'existing mock rows',
}, null, 2))

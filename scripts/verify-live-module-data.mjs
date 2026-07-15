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
  ['subject settings row mapper', 'export function mapLiveSubjectRows'],
  ['auxiliary archive row mapper', 'export function mapLiveAuxiliaryArchiveRows'],
  ['ledger overview row mapper', 'export function mapLiveLedgerOverviewRows'],
  ['account summary row mapper', 'export function mapLiveAccountSummaryRows'],
  ['subsidiary ledger row mapper', 'export function mapLiveSubsidiaryLedgerRows'],
  ['auxiliary ledger row mapper', 'export function mapLiveAuxiliaryLedgerRows'],
  ['auxiliary balance row mapper', 'export function mapLiveAuxiliaryBalanceRows'],
  ['period management row mapper', 'export function mapLivePeriodManagementRows'],
  ['period management summary mapper', 'export function summarizeLivePeriodManagement'],
  ['history balance row mapper', 'export function mapLiveHistoryBalanceRows'],
  ['history general ledger row mapper', 'export function mapLiveHistoryGeneralLedgerRows'],
  ['history subsidiary ledger row mapper', 'export function mapLiveHistorySubsidiaryLedgerRows'],
  ['history voucher row mapper', 'export function mapLiveHistoryVoucherRows'],
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
  ['account archive refresh', 'fetchAccounts(selectedCompanyId)'],
  ['auxiliary category refresh', 'fetchCategories(selectedCompanyId)'],
  ['auxiliary item refresh', 'fetchAllItems(selectedCompanyId)'],
  ['subject settings mapping', 'mapLiveSubjectRows(accounts)'],
  ['auxiliary archive mapping', 'mapLiveAuxiliaryArchiveRows(kind, auxiliaryCategories, auxiliaryItems)'],
  ['ledger overview mapping', 'mapLiveLedgerOverviewRows(liveReports.ledgerOverview)'],
  ['account summary mapping', 'mapLiveAccountSummaryRows(liveReports.accountSummary)'],
  ['subsidiary ledger query', 'getSubsidiaryLedger(currentPeriodId, selectedLedgerAccountCode)'],
  ['auxiliary ledger query', 'fetchAuxiliaryLedger({'],
  ['auxiliary balance query', 'fetchAuxiliaryBalance(selectedAuxiliaryCategoryId, currentPeriodId, selectedCompanyId)'],
  ['subsidiary ledger mapping', 'mapLiveSubsidiaryLedgerRows(liveReports.subsidiaryLedger)'],
  ['auxiliary ledger mapping', 'mapLiveAuxiliaryLedgerRows(liveReports.auxiliaryLedger'],
  ['auxiliary balance mapping', 'mapLiveAuxiliaryBalanceRows(liveReports.auxiliaryBalance'],
  ['ledger account selector', 'aria-label="明细账科目"'],
  ['auxiliary category selector', 'aria-label="辅助账类别"'],
  ['auxiliary item selector', 'aria-label="辅助账项目"'],
  ['period management refresh', 'fetchPeriods(selectedCompanyId)'],
  ['period management mapping', 'mapLivePeriodManagementRows(periods)'],
  ['period management live scope', 'usesLivePeriodManagementData'],
  ['history trial balance query', 'fetchTrialBalance(selectedHistoryPeriodId)'],
  ['history general ledger query', 'getGeneralLedger(selectedHistoryPeriodId)'],
  ['history balance mapping', 'mapLiveHistoryBalanceRows(liveReports.historyBalance'],
  ['history general ledger mapping', 'mapLiveHistoryGeneralLedgerRows(liveReports.historyGeneralLedger'],
  ['history period selector', 'aria-label="历史账期"'],
  ['history report live scope', 'usesLiveHistoryReportData'],
  ['history subsidiary ledger query', 'getSubsidiaryLedger(selectedHistoryPeriodId, selectedHistoryLedgerAccountCode)'],
  ['history subsidiary ledger mapping', 'mapLiveHistorySubsidiaryLedgerRows(liveReports.historySubsidiaryLedger'],
  ['history subsidiary ledger selector', 'aria-label="历史明细账科目"'],
  ['history voucher query', "period_id: selectedHistoryPeriodId"],
  ['history voucher mapping', 'mapLiveHistoryVoucherRows(liveReports.historyVouchers'],
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
  modules: ['outputInvoice', 'inputInvoice', 'voucher', 'ledgerReport', 'accountSummaryReport', 'trialBalanceReport', 'generalLedgerReport', 'subsidiaryLedgerReport', 'auxiliaryLedgerReport', 'auxiliaryBalanceReport', 'balanceSheetReport', 'incomeStatementReport', 'cashFlowReport', 'companyInfo', 'initialBalance', 'subjectSettings', 'customerArchive', 'supplierArchive', 'otherContactArchive', 'projectArchive', 'departmentArchive', 'periodManagement', 'historyVoucher', 'historyBalance', 'historyGeneralLedger', 'historySubsidiaryLedger'],
  scope: 'selected company and accounting period',
  browserFallback: 'existing mock rows',
}, null, 2))

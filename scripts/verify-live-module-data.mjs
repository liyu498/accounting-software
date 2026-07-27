import { existsSync, readFileSync } from 'node:fs'

const adapterSource = readFileSync('src/lib/liveModuleRows.ts', 'utf8')
const pageSource = readFileSync('src/pages/operations/BusinessModulePage.tsx', 'utf8')
const taxWorkspaceSource = readFileSync('src/pages/tax/TaxWorkspace.tsx', 'utf8')
const agencyModuleSource = readFileSync('src/pages/agency/AgencyModulePage.tsx', 'utf8')
const agencyCommandSource = readFileSync('src-tauri/src/commands/agency.rs', 'utf8')
const apiSource = readFileSync('src/lib/api.ts', 'utf8')
const welcomeSource = readFileSync('src/pages/Welcome.tsx', 'utf8')
const appSource = readFileSync('src/App.tsx', 'utf8')
const dashboardSource = readFileSync('src/pages/Dashboard.tsx', 'utf8')
const shellSource = readFileSync('src/components/layout/AppShell.tsx', 'utf8')
const companyStoreSource = readFileSync('src/stores/companyStore.ts', 'utf8')
const companyCommandSource = readFileSync('src-tauri/src/commands/companies.rs', 'utf8')
const databaseSource = readFileSync('src-tauri/src/db.rs', 'utf8')
const periodCommandSource = readFileSync('src-tauri/src/commands/periods.rs', 'utf8')
const backupCommandSource = existsSync('src-tauri/src/commands/backups.rs')
  ? readFileSync('src-tauri/src/commands/backups.rs', 'utf8')
  : ''
const employeeCommandSource = existsSync('src-tauri/src/commands/employees.rs')
  ? readFileSync('src-tauri/src/commands/employees.rs', 'utf8')
  : ''
const payrollCommandSource = existsSync('src-tauri/src/commands/payroll.rs')
  ? readFileSync('src-tauri/src/commands/payroll.rs', 'utf8')
  : ''
const socialSecurityCommandSource = existsSync('src-tauri/src/commands/social_security.rs')
  ? readFileSync('src-tauri/src/commands/social_security.rs', 'utf8')
  : ''
const specialDeductionCommandSource = existsSync('src-tauri/src/commands/special_deductions.rs')
  ? readFileSync('src-tauri/src/commands/special_deductions.rs', 'utf8')
  : ''
const bankTransactionCommandSource = existsSync('src-tauri/src/commands/bank_transactions.rs')
  ? readFileSync('src-tauri/src/commands/bank_transactions.rs', 'utf8')
  : ''
const documentRecordCommandSource = existsSync('src-tauri/src/commands/document_records.rs')
  ? readFileSync('src-tauri/src/commands/document_records.rs', 'utf8')
  : ''
const accountTransferCommandSource = existsSync('src-tauri/src/commands/account_transfers.rs')
  ? readFileSync('src-tauri/src/commands/account_transfers.rs', 'utf8')
  : ''
const fixedAssetCommandSource = existsSync('src-tauri/src/commands/fixed_assets.rs')
  ? readFileSync('src-tauri/src/commands/fixed_assets.rs', 'utf8')
  : ''
const inventoryMovementCommandSource = existsSync('src-tauri/src/commands/inventory_movements.rs')
  ? readFileSync('src-tauri/src/commands/inventory_movements.rs', 'utf8')
  : ''
const inventoryItemCommandSource = existsSync('src-tauri/src/commands/inventory_items.rs')
  ? readFileSync('src-tauri/src/commands/inventory_items.rs', 'utf8')
  : ''
const unitCommandSource = existsSync('src-tauri/src/commands/units.rs')
  ? readFileSync('src-tauri/src/commands/units.rs', 'utf8')
  : ''
const settlementRuleStoreSource = readFileSync('src/stores/settlementRuleStore.ts', 'utf8')
const templateCommandSource = readFileSync('src-tauri/src/commands/templates.rs', 'utf8')
const templateStoreSource = readFileSync('src/stores/templateStore.ts', 'utf8')
const auxiliaryStoreSource = readFileSync('src/stores/auxiliaryStore.ts', 'utf8')
const auxiliaryCommandSource = readFileSync('src-tauri/src/commands/auxiliary.rs', 'utf8')
const voucherEntryRowSource = readFileSync('src/components/voucher/VoucherEntryRow.tsx', 'utf8')
const matchingRuleStoreSource = existsSync('src/stores/matchingRuleStore.ts')
  ? readFileSync('src/stores/matchingRuleStore.ts', 'utf8')
  : ''
const matchingRuleCommandSource = existsSync('src-tauri/src/commands/matching_rules.rs')
  ? readFileSync('src-tauri/src/commands/matching_rules.rs', 'utf8')
  : ''
const assetCategoryStoreSource = existsSync('src/stores/assetCategoryStore.ts')
  ? readFileSync('src/stores/assetCategoryStore.ts', 'utf8')
  : ''
const assetCategoryCommandSource = existsSync('src-tauri/src/commands/asset_categories.rs')
  ? readFileSync('src-tauri/src/commands/asset_categories.rs', 'utf8')
  : ''
const businessTagStoreSource = existsSync('src/stores/businessTagStore.ts')
  ? readFileSync('src/stores/businessTagStore.ts', 'utf8')
  : ''
const businessTagCommandSource = existsSync('src-tauri/src/commands/business_tags.rs')
  ? readFileSync('src-tauri/src/commands/business_tags.rs', 'utf8')
  : ''
const businessOrderCommandSource = existsSync('src-tauri/src/commands/business_orders.rs')
  ? readFileSync('src-tauri/src/commands/business_orders.rs', 'utf8')
  : ''
const settlementRecordCommandSource = existsSync('src-tauri/src/commands/settlement_records.rs')
  ? readFileSync('src-tauri/src/commands/settlement_records.rs', 'utf8')
  : ''
const bankReconciliationCommandSource = existsSync('src-tauri/src/commands/bank_reconciliation_records.rs')
  ? readFileSync('src-tauri/src/commands/bank_reconciliation_records.rs', 'utf8')
  : ''
const costCarryoverCommandSource = existsSync('src-tauri/src/commands/cost_carryover_records.rs')
  ? readFileSync('src-tauri/src/commands/cost_carryover_records.rs', 'utf8')
  : ''
const companyAccountStoreSource = existsSync('src/stores/companyAccountStore.ts')
  ? readFileSync('src/stores/companyAccountStore.ts', 'utf8')
  : ''
const companyAccountCommandSource = existsSync('src-tauri/src/commands/company_accounts.rs')
  ? readFileSync('src-tauri/src/commands/company_accounts.rs', 'utf8')
  : ''
const automationCommandSource = readFileSync('src-tauri/src/commands/automation.rs', 'utf8')
const voucherCommandSource = readFileSync('src-tauri/src/commands/vouchers.rs', 'utf8')
const localFileRegistrySource = readFileSync('src/lib/localFileRegistry.ts', 'utf8')

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
  ['company account row mapper', 'export function mapLiveCompanyAccountRows'],
  ['company account summary mapper', 'export function summarizeLiveCompanyAccounts'],
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
  ['settlement rule row mapper', 'export function mapLiveSettlementRuleRows'],
  ['currency row mapper', 'export function mapLiveCurrencyRows'],
  ['currency summary mapper', 'export function summarizeLiveCurrencies'],
  ['common digest row mapper', 'export function mapLiveCommonDigestRows'],
  ['common digest summary mapper', 'export function summarizeLiveCommonDigests'],
  ['voucher template row mapper', 'export function mapLiveVoucherTemplateRows'],
  ['voucher template summary mapper', 'export function summarizeLiveVoucherTemplates'],
  ['report formula row mapper', 'export function mapLiveReportFormulaRows'],
  ['report formula summary mapper', 'export function summarizeLiveReportFormulas'],
  ['adapter authorization row mapper', 'export function mapLiveAdapterAuthorizationRows'],
  ['adapter authorization summary mapper', 'export function summarizeLiveAdapterAuthorizations'],
  ['operation audit row mapper', 'export function mapLiveOperationAuditRows'],
  ['operation audit summary mapper', 'export function summarizeLiveOperationAudits'],
  ['auxiliary category row mapper', 'export function mapLiveAuxiliaryCategoryRows'],
  ['auxiliary item row mapper', 'export function mapLiveAuxiliaryItemRows'],
  ['voucher recycle row mapper', 'export function mapLiveVoucherRecycleRows'],
  ['voucher recycle summary mapper', 'export function summarizeLiveVoucherRecycle'],
  ['declaration receipt row mapper', 'export function mapLiveDeclarationReceiptRows'],
  ['declaration receipt summary mapper', 'export function summarizeLiveDeclarationReceipts'],
  ['tax init row mapper', 'export function mapLiveTaxInitRows'],
  ['tax init summary mapper', 'export function summarizeLiveTaxInit'],
  ['tax report row mapper', 'export function mapLiveTaxReportRows'],
  ['tax report summary mapper', 'export function summarizeLiveTaxReports'],
  ['automation job row mapper', 'export function mapLiveAutomationJobRows'],
  ['automation job summary mapper', 'export function summarizeLiveAutomationJobs'],
  ['automation suggestion view type', "view: 'queue' | 'recognition' | 'suggestion'"],
  ['automation suggestion job boundary', "const suggestionJobs = jobs.filter((job) => job.jobType === 'voucher_suggestion')"],
  ['finance tax report row mapper', 'export function mapLiveFinanceTaxReportRows'],
  ['finance tax report summary mapper', 'export function summarizeLiveFinanceTaxReports'],
  ['financial overview row mapper', 'export function mapLiveFinancialOverviewRows'],
  ['financial overview summary mapper', 'export function summarizeLiveFinancialOverview'],
  ['risk check row mapper', 'export function mapLiveRiskCheckRows'],
  ['risk check summary mapper', 'export function summarizeLiveRiskChecks'],
  ['closing task row mapper', 'export function mapLiveClosingTaskRows'],
  ['closing task summary mapper', 'export function summarizeLiveClosingTasks'],
  ['invoice voucher matching row mapper', 'export function mapLiveInvoiceVoucherMatchingRows'],
  ['invoice voucher matching summary mapper', 'export function summarizeLiveInvoiceVoucherMatching'],
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
  ['output live row mapping', 'mapLiveInvoiceRows(invoices, \'output\', invoiceTagIds, businessTags)'],
  ['input live row mapping', 'mapLiveInvoiceRows(invoices, \'input\', invoiceTagIds, businessTags)'],
  ['voucher live row mapping', 'mapLiveVoucherRows(vouchers, voucherTagIds, businessTags)'],
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
  ['company account mapping', 'mapLiveCompanyAccountRows(companyAccounts)'],
  ['company bank account live scope', 'usesLiveCompanyBankAccountData'],
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
  ['settlement rule refresh', 'fetchSettlementRules(selectedCompanyId)'],
  ['settlement rule mapping', 'mapLiveSettlementRuleRows(settlementRules)'],
  ['settlement rule live scope', 'usesLiveSettlementRuleData'],
  ['currency refresh', 'fetchCurrencies(selectedCompanyId)'],
  ['currency mapping', 'mapLiveCurrencyRows(currencies)'],
  ['currency live scope', 'usesLiveCurrencyData'],
  ['template workspace refresh', 'fetchTemplateWorkspace(selectedCompanyId)'],
  ['common digest mapping', 'mapLiveCommonDigestRows(commonDigests)'],
  ['voucher template mapping', 'mapLiveVoucherTemplateRows(voucherTemplates, voucherTemplateTypes)'],
  ['template settings live scope', 'usesLiveTemplateSettingsData'],
  ['report template refresh', 'fetchReportTemplateWorkspace(selectedCompanyId)'],
  ['report formula mapping', 'mapLiveReportFormulaRows(reportTemplates, reportItems)'],
  ['report formula live scope', 'usesLiveReportFormulaData'],
  ['adapter authorization refresh', 'automationApi.getAdapterAuthorizations'],
  ['tax adapter mapping', "mapLiveAdapterAuthorizationRows(adapterAuthorizations, 'tax')"],
  ['bank adapter mapping', "mapLiveAdapterAuthorizationRows(adapterAuthorizations, 'bank')"],
  ['adapter authorization live scope', 'usesLiveAdapterAuthorizationData'],
  ['operation audit refresh', 'automationApi.getOperationAuditLogs'],
  ['operation audit mapping', 'mapLiveOperationAuditRows(operationAuditLogs)'],
  ['operation audit live scope', 'usesLiveOperationAuditData'],
  ['module rule log live scope', 'const usesLiveRuleLogData = Boolean(isTauri && selectedCompanyId)'],
  ['module audit persistence', 'automationApi.writeOperationAuditLog({'],
  ['module period scoped audits', 'const scopedOperationAuditLogs = useMemo(() => operationAuditLogs.filter((log) => log.objectRef?.includes(currentPeriodLabel))'],
  ['module rules log binding', '<RulesLogPanel notes={config.notes} logs={visibleRuleLogs} usesLiveData={usesLiveRuleLogData} />'],
  ['module detail row state', 'const [detailRow, setDetailRow] = useState<ModuleRow | null>(null)'],
  ['module detail dialog', '业务明细'],
  ['module import template builder', 'function buildImportTemplate(params: {'],
  ['module import template export', 'await exportRowsToXlsx({\n      sheetRows,\n      columnWidths,\n      merges,\n      sheetName: `${title}导入模板`,'],
  ['module import template audit', "writeModuleAudit('下载导入模板', fileName, '普通', '成功')"],
  ['module import candidate preview', '候选数据预览'],
  ['module import field mapping', 'function buildImportFieldMappings(headers: string[], columns: ModuleColumn[])'],
  ['module import mapping panel', '字段映射建议'],
  ['module import write confirmation', '确认写入本地台账'],
  ['module import write handler', 'const handleCommitLocalImport = async () => {'],
  ['module import settings targets', "type LocalImportWriteTarget = 'invoice' | 'bank' | 'document' | 'businessOrder' | 'employee' | 'payroll' | 'socialSecurity' | 'specialDeduction' | 'inventoryMovement' | 'fixedAsset' | 'inventoryItem' | 'settlement' | 'bankReconciliation' | 'measurementUnit' | 'accountTransfer' | 'costCarryover' | 'companyAccount' | 'auxiliaryArchive' | 'businessTag' | 'currency' | 'matchingRule' | 'settlementRule' | 'commonDigest' | 'voucherTemplate' | 'assetCategory' | 'auxiliaryCategory' | 'auxiliaryItem' | 'initialBalance'"],
  ['module import committed status', "status === '已关联' || status === '已校验' || status === '已写入'"],
  ['module receipt and expense import scope', "if (kind === 'documentRegister' || kind === 'receipt' || kind === 'expenseReimbursement') return 'document'"],
  ['module matching rule import scope', "if (kind === 'invoiceMatchingRules' || kind === 'billMatchingRules' || kind === 'cashFlowMapping') return 'matchingRule'"],
  ['module settlement rule import scope', "if (kind === 'settlementRules') return 'settlementRule'"],
  ['module common digest import scope', "if (kind === 'commonDigests') return 'commonDigest'"],
  ['module voucher template import scope', "if (kind === 'voucherTemplateSettings') return 'voucherTemplate'"],
  ['module asset category import scope', "if (kind === 'assetCategory') return 'assetCategory'"],
  ['module auxiliary category import scope', "if (kind === 'auxiliaryCategories') return 'auxiliaryCategory'"],
  ['module auxiliary item import scope', "if (kind === 'auxiliaryItems') return 'auxiliaryItem'"],
  ['module initial balance import scope', "if (kind === 'initialBalance') return 'initialBalance'"],
  ['module matching rule local write', "await createMatchingRule({ companyId: selectedCompanyId, ruleScope, name, conditionText, actionText"],
  ['module settlement rule local write', "await createSettlementRule({ companyId: selectedCompanyId, name, ruleType"],
  ['module common digest local write', "await createCommonDigest({ companyId: selectedCompanyId, content })"],
  ['module voucher template local write', "await createVoucherTemplate({ companyId: selectedCompanyId, typeId: templateType.id, name, entries })"],
  ['module asset category local write', "await createAssetCategory({ companyId: selectedCompanyId, code, name, usefulLifeMonths"],
  ['module auxiliary category local write', "await createAuxiliaryCategory({ company_id: selectedCompanyId, code, name, sort_order: sortOrder })"],
  ['module auxiliary item local write', "await createAuxiliaryItem({ category_id: categoryId, company_id: selectedCompanyId, code, name"],
  ['module initial balance local write', "await saveInitialBalance({ period_id: currentPeriodId, account_code: accountCode, opening_debit: openingDebit, opening_credit: openingCredit, created_by: '本地导入' })"],
  ['module import failure rows', 'const failureRows: LocalImportFailure[] = []'],
  ['module import failure list', '失败行清单'],
  ['module current period export file', 'const exportPeriodLabel = currentPeriodLabel === \'当前账期\' ? \'2026-05\' : currentPeriodLabel'],
  ['module excel export audit', "writeModuleAudit('导出Excel', fileName"],
  ['module pdf export audit', "writeModuleAudit('导出PDF', fileName"],
  ['module print export audit', "writeModuleAudit('打印', fileName"],
  ['auxiliary category mapping', 'mapLiveAuxiliaryCategoryRows(auxiliaryCategories)'],
  ['auxiliary item mapping', 'mapLiveAuxiliaryItemRows(auxiliaryCategories, auxiliaryItems)'],
  ['voucher recycle refresh', 'getDeletedVouchers(selectedCompanyId)'],
  ['voucher recycle mapping', 'mapLiveVoucherRecycleRows(deletedVouchers)'],
  ['voucher recycle live scope', 'usesLiveVoucherRecycleData'],
  ['tax declaration refresh', 'automationApi.getTaxDeclarationTasks'],
  ['declaration receipt mapping', 'mapLiveDeclarationReceiptRows(taxDeclarationTasks)'],
  ['declaration receipt live scope', 'usesLiveDeclarationReceiptData'],
  ['tax init mapping', 'mapLiveTaxInitRows(taxDeclarationTasks, adapterAuthorizations)'],
  ['tax init live scope', 'usesLiveTaxInitData'],
  ['tax report mapping', 'mapLiveTaxReportRows(taxDeclarationTasks)'],
  ['tax report live scope', 'usesLiveTaxReportData'],
  ['automation job refresh', 'automationApi.getAutomationJobs'],
  ['AI job queue mapping', "mapLiveAutomationJobRows(automationJobs, 'queue')"],
  ['AI recognition mapping', "mapLiveAutomationJobRows(automationJobs, 'recognition')"],
  ['AI voucher suggestion mapping', "mapLiveAutomationJobRows(automationJobs, 'suggestion')"],
  ['AI voucher suggestion live kind', "'aiVoucherSuggestions'"],
  ['automation job live scope', 'usesLiveAutomationJobData'],
  ['AI voucher suggestion confirmation binding', 'automationApi.updateAutomationJobStatus({'],
  ['AI voucher suggestion confirmation status', "status: 'confirmed'"],
  ['AI voucher suggestion confirmation audit', "writeModuleAudit('确认AI凭证建议'"],
  ['AI voucher suggestion confirmation boundary', '不会自动生成或入账凭证'],
  ['AI voucher suggestion row confirmation', "const suggestionJobId = row.id.replace('automation-suggestion-', '')"],
  ['AI voucher suggestion draft review guard', "if (kind === 'aiVoucherSuggestions') {"],
  ['AI voucher suggestion draft review audit', "writeModuleAudit('打开AI凭证草稿复核'"],
  ['risk check mapping', 'mapLiveRiskCheckRows(vouchers, invoices)'],
  ['risk check summary mapping', 'summarizeLiveRiskChecks(vouchers, invoices)'],
  ['risk check live kind', "'riskCheck'"],
  ['closing task mapping', 'mapLiveClosingTaskRows(currentPeriod, vouchers, liveReports.trialBalance, liveReports.balanceSheet)'],
  ['closing task summary mapping', 'summarizeLiveClosingTasks(currentPeriod, vouchers, liveReports.trialBalance, liveReports.balanceSheet)'],
  ['closing task live scope', 'usesLiveClosingTaskData'],
  ['closing period command binding', "await closePeriod(currentPeriodId, 'admin')"],
  ['closing period confirmation', '确认结账账期 ${currentPeriodLabel} 吗？结账后账期将锁定。'],
  ['invoice voucher matching mapping', 'mapLiveInvoiceVoucherMatchingRows(invoices, vouchers)'],
  ['invoice voucher matching summary mapping', 'summarizeLiveInvoiceVoucherMatching(invoices, vouchers)'],
  ['invoice voucher matching live scope', 'usesLiveInvoiceVoucherMatchingData'],
  ['finance tax report mapping', 'mapLiveFinanceTaxReportRows(taxDeclarationTasks)'],
  ['finance tax report live scope', 'usesLiveFinanceTaxReportData'],
  ['financial overview mapping', 'mapLiveFinancialOverviewRows(liveReports.balanceSheet, liveReports.incomeStatement, liveReports.cashFlow)'],
  ['financial overview live scope', 'usesLiveFinancialOverviewData'],
  ['browser mock fallback', 'isTauri && selectedCompanyId'],
  ['document export context', 'const exportDocumentContext = {'],
  ['document export company binding', 'companyName: selectedCompany?.name ||'],
  ['document export period binding', 'periodLabel: exportPeriodLabel'],
  ['document export taxpayer binding', 'taxpayerId: selectedCompany?.tax_id ||'],
  ['print template context binding', 'context: params.context'],
  ['excel template context binding', 'context: params.context'],
  ['export center live scope', "const usesLiveExportData = Boolean(isTauri && selectedCompanyId && kind === 'exportCenter')"],
  ['export center audit mapper', 'function mapOperationAuditExportRows(logs: OperationAuditLog[]): ModuleRow[]'],
  ['export center audit filter', 'function isExportOperationAudit(log: OperationAuditLog)'],
  ['export center live rows', 'if (kind === \'exportCenter\' && usesLiveExportData)'],
  ['export center audit fetch', "kind === 'auditLog' || kind === 'exportCenter'"],
  ['import center live scope', "const usesLiveImportData = Boolean(isTauri && selectedCompanyId && kind === 'importCenter')"],
  ['import center audit mapper', 'function mapOperationAuditImportRows(logs: OperationAuditLog[]): ModuleRow[]'],
  ['import center audit filter', 'function isImportOperationAudit(log: OperationAuditLog)'],
  ['import center upload audit filter', "log.action.includes('上传')"],
  ['import center local and live rows', "if (kind === 'importCenter' && (usesLiveImportData || localImportJobs.length > 0))"],
  ['import center audit fetch', "kind === 'auditLog' || kind === 'exportCenter' || kind === 'importCenter'"],
  ['module import file ref', 'const importFileRef = useRef<HTMLInputElement>(null)'],
  ['module import capability guard', "const supportsFileImport = /导入|采集|上传/.test(config.importLabel)"],
  ['module import file selection', 'importFileRef.current?.click()'],
  ['module import file audit', '`${title}-${file.name}`'],
  ['module import hidden input', 'ref={importFileRef}'],
  ['local file registry binding', "from '../../lib/localFileRegistry'"],
  ['local import job registration', 'recordLocalImportJob({'],
  ['local attachment registration', 'recordLocalAttachment({'],
  ['local import job mapping', 'mapLocalImportJobRows(localImportJobs)'],
  ['local attachment mapping', 'mapLocalAttachmentRows(localAttachmentRecords)'],
  ['local file record removal', 'removeLocalImportJob(row.id)'],
  ['local attachment record removal', 'removeLocalAttachment(row.id)'],
  ['local file action label', "kind === 'attachmentCenter' || kind === 'importCenter' ? '撤销登记'"],
  ['attachment association registry update', 'updateLocalAttachmentAssociation'],
  ['attachment association editor', '关联本地附件单据'],
  ['attachment association boundary', '不会移动原始文件、写入外部存储或修改凭证'],
  ['local import validation registry update', 'updateLocalImportJobValidation'],
  ['local import validation editor', '核验本机导入批次'],
  ['local import validation boundary', '不会写入账套业务数据或调用外部系统'],
]

const requiredLocalFileRegistrySnippets = [
  ['local import preview rows type', 'previewRows: string[][]'],
  ['local import preview capture', 'previewRows: parsed.rows.slice(0, 5)'],
  ['local import full parser', 'export async function parseLocalImportFile(file: File)'],
  ['local import committed status', "status: '已写入'"],
]

const requiredTaxWorkspaceSnippets = [
  ['tax workspace live scope', 'usesLiveTaxDeclarationData'],
  ['tax workspace task state', 'setTaxDeclarationTasks'],
  ['tax workspace task mapping', 'mapTaxDeclarationTaskToRow'],
  ['tax workspace visible rows', 'visibleDeclarationRows'],
  ['tax workspace live list refresh', 'getTaxDeclarationTasks({ companyId, period: currentPeriod })'],
  ['tax workspace selected period store', 'const currentPeriodId = usePeriodStore((state) => state.currentPeriodId)'],
  ['tax workspace selected period label', 'const currentPeriodLabel = currentPeriodRecord'],
  ['tax workspace live period scope', 'Boolean(isTauri && selectedCompanyId && currentPeriodId)'],
  ['tax workspace dynamic export file', '税务申报包-${currentPeriod}.pdf'],
  ['tax workspace table binding', 'filteredDeclarationRows.map((row) =>'],
  ['tax workspace active tax tab', "const [activeTab, setActiveTab] = useState('申报清单')"],
  ['tax workspace query filter', 'const [searchTerm, setSearchTerm] = useState(\'\')'],
  ['tax workspace filtered row computation', 'const filteredDeclarationRows = useMemo(() => {'],
  ['tax workspace operation audit state', 'const [operationAuditLogs, setOperationAuditLogs] = useState<OperationAuditLog[]>([])'],
  ['tax workspace period scoped audits', 'const scopedOperationAuditLogs = useMemo(() => operationAuditLogs.filter((log) => log.objectRef?.includes(currentPeriod))'],
  ['tax workspace live risk rows', 'const visibleRiskRows = useMemo<RiskRow[]>(() => {'],
  ['tax workspace live rule logs', 'const visibleRuleLogs = useMemo<RuleLog[]>(() => {'],
  ['tax workspace rules log binding', '<TaxRulesLogPanel riskRows={visibleRiskRows} logs={visibleRuleLogs} onRiskLink={handleRiskLink} />'],
  ['tax workspace export binding', 'buildTaxDeclarationPackageHtml(exportedAt, visibleDeclarationRows, taxPackageMetadata, visibleRiskRows, visibleRuleLogs)'],
  ['tax workspace html export audit', "action: '导出申报包'"],
  ['tax workspace pdf export audit', "action: '导出申报包 PDF'"],
  ['tax workspace print export audit', "action: '打印申报包'"],
  ['tax workspace selection state', 'const [selectedDeclarationIds, setSelectedDeclarationIds] = useState<Set<string>>(new Set())'],
  ['tax workspace bulk confirmation action', "await confirmDeclaration(selectedDeclarationRows, '批量确认申报')"],
  ['tax workspace confirmation boundary', '不会向税局提交或发起扣款'],
  ['tax workspace detail editor state', 'const [showDeclarationDetailDialog, setShowDeclarationDetailDialog] = useState(false)'],
  ['tax workspace detail save binding', 'const saveDeclarationDetail = async'],
  ['tax workspace detail local boundary', '保存仅更新本地取数和校验状态'],
  ['tax workspace initialization template export', 'exportRowsToXlsx({'],
  ['tax workspace initialization template boundary', '仅用于本地税种认定和取数维护；不包含税局密码，不提交税局、不扣款。'],
  ['tax workspace initialization template columns', "'取数依据/人工复核说明'"],
  ['tax workspace initialization template parser', "await import('read-excel-file/browser')"],
  ['tax workspace initialization import preview', 'setTaxInitializationImportPreview'],
  ['tax workspace initialization import confirmation', '确认写入本地申报事项'],
  ['tax workspace initialization import boundary', '不会向税局提交申报、发起扣款或保存税局密码'],
]

const requiredWelcomeSnippets = [
  ['company creation deep link', "new URLSearchParams(location.search).get('createCompany') === '1'"],
  ['company form metadata persistence', 'enterprise_type: newCompany.enterpriseType'],
  ['company service period persistence', 'service_start: newCompany.serviceStart'],
  ['company authorization metadata helper', 'function buildCompanyAuthorizationInputs(companyId: string, company: CompanyForm)'],
  ['company authorization persistence', 'persistCompanyAuthorizationMetadata(company.id, newCompany)'],
  ['company authorization masks account', 'accountMask: maskAuthorizationAccount(company.taxLoginAccount)'],
  ['company authorization password boundary', "riskMessage: '待完成合法授权验证；不保存密码、不执行真实提交'"],
  ['company industrial authorization metadata', "adapterType: 'industrial_commercial'"],
  ['company industrial contact masking', 'accountMask: maskAuthorizationAccount(company.businessContactPhone)'],
  ['company authorization metadata parser', 'function parseTaxAuthorizationIdentity(value: string | null)'],
  ['company edit authorization loading', 'automationApi.getAdapterAuthorizations({ companyId: company.id })'],
  ['company edit authorization notice', '已载入授权元数据；账号、身份证号、邮箱和密码不会回填'],
  ['company account update guard', 'if (company.taxLoginAccount.trim())'],
  ['company import file input', 'ref={companyImportRef}'],
  ['company import excel parser', "import('read-excel-file/browser')"],
  ['company import header scanner', 'function findCompanyImportHeaderRow'],
  ['company import duplicate tax guard', 'existingTaxIds.has(candidate.tax_id)'],
  ['company import secret column boundary', "const forbiddenImportHeaders = ['密码', '账号', '验证码', 'Cookie']"],
  ['company import create binding', 'await createCompany(candidate)'],
  ['company collection preflight queue', "jobType: 'tax_profile_collection'"],
  ['company collection duplicate query', "automationApi.getAutomationJobs({ companyId: target.id, period: target.period })"],
  ['company collection duplicate guard', "job.jobType === 'tax_profile_collection' && ['queued', 'running', 'review'].includes(job.status)"],
  ['company collection external boundary', '不执行真实税局登录、资料抓取或外部提交'],
  ['welcome desktop audit boundary', 'if (!isTauri) return'],
  ['welcome desktop audit persistence', 'moduleName: \'机构-账套管理\''],
  ['welcome desktop audit scope', 'objectRef: `机构账套｜${object}`'],
]

const requiredCompanyPersistenceSnippets = [
  ['company store extended archive fields', 'enterprise_type?: string'],
  ['company store service period fields', 'service_start?: string'],
  ['company command persists extended archive fields', 'enterprise_type, service_start, service_end'],
  ['company database enterprise type migration', 'ALTER TABLE companies ADD COLUMN enterprise_type TEXT'],
  ['company database service period migration', 'ALTER TABLE companies ADD COLUMN service_start TEXT'],
]

const requiredAgencyModuleSnippets = [
  ['agency company data source', 'useCompanyStore()'],
  ['agency company refresh', 'await fetchCompanies()'],
  ['agency company row mapper', 'function mapAgencyCompanyRow(item: Company, kind: AgencyModuleKind)'],
  ['agency account enterprise type mapping', 'type: item.enterprise_type ||'],
  ['agency account service period mapping', 'serviceEnd: item.service_start || item.service_end'],
  ['agency company tab filter', 'function filterAgencyCompanyRows(rows: AgencyRow[], activeTab: string)'],
  ['agency company creation deep link', "navigate('/?createCompany=1')"],
  ['agency client tab consolidation', "tabs: ['全部客户', '启用账套', '停用账套', '一般纳税人', '小规模纳税人']"],
  ['agency account tab consolidation', "tabs: ['正常', '停用', '一般纳税人', '小规模纳税人']"],
  ['agency company tab presentation', "baseConfig.title === '客户总览' || baseConfig.title === '账套管理'"],
  ['agency account selection binding', 'selectCompany(row.id)'],
  ['agency account period refresh', 'await fetchPeriods(row.id)'],
  ['agency service contract data source', 'agencyApi.getServiceContracts()'],
  ['agency fee collection data source', 'agencyApi.getFeeCollections({ period })'],
  ['agency collaboration data source', 'agencyApi.getCollaborationItems()'],
  ['agency fee collection mapper', 'function mapFeeCollectionRow(item: AgencyFeeCollection)'],
  ['agency collaboration mapper', 'function mapCollaborationItemRow(item: AgencyCollaborationItem)'],
  ['agency live tab selection', "activeTab === '收费管理'"],
  ['agency contract archive row mapper', 'function mapAgencyContractArchiveRow(item: AgencyServiceContract)'],
  ['agency contract archive live tab', "activeTab === '归档记录'"],
  ['agency service package row mapper', 'function mapAgencyServicePackageRows(items: AgencyServiceContract[])'],
  ['agency service package live tab', "activeTab === '服务套餐'"],
  ['agency service contract tab consolidation', "tabs: ['服务合同', '收费管理', '客户协同', '服务套餐', '归档记录']"],
  ['agency overview data source', 'agencyApi.getOverview(agencyPeriodLabel)'],
  ['agency overview state', 'setAgencyOverview(response.data ?? null)'],
  ['agency overview live scope', "kind === 'dataStats'"],
  ['agency overview row mapper', 'function mapAgencyOverviewRows(overview: AgencyOperationOverview, activeTab: string)'],
  ['agency overview summary mapper', 'function summarizeAgencyOverview(overview: AgencyOperationOverview)'],
  ['agency authorization data source', 'agencyApi.getAuthorizations()'],
  ['agency authorization row mapper', 'function mapAgencyAuthorizationRow(item: AdapterAuthorization)'],
  ['agency authorization tab filter', 'function agencyAuthorizationAdapterType(activeTab: string)'],
  ['agency authorization expiry filter', 'function isAuthorizationExpiryReminder(expiresAt: string | null)'],
  ['agency authorization live scope', "kind === 'authorizationCenter'"],
  ['agency batch task data source', 'agencyApi.getBatchTasks({ period })'],
  ['agency batch task create binding', 'agencyApi.createBatchTasks('],
  ['agency batch task precheck binding', 'agencyApi.runBatchTaskPrecheck({ id: row.id, operator: \'admin\' })'],
  ['agency batch task precheck boundary', '本地预检完成，不会登录或调用税局、银行等外部系统'],
  ['agency batch task row mapper', 'function mapAgencyBatchTaskRow(item: AgencyBatchTask)'],
  ['agency batch task tab filter', 'function filterAgencyBatchTaskRows(rows: AgencyRow[], activeTab: string)'],
  ['agency batch tab consolidation', "tabs: ['操作任务', '批量采集', '批量生成', '批量结账', '批量申报', '申报回执', '审批记录']"],
  ['agency batch task live scope', "kind === 'batchOps'"],
  ['agency health check data source', 'agencyApi.getHealthChecks(period)'],
  ['agency health check row mapper', 'function mapAgencyHealthCheckRow(item: AgencyHealthCheckItem)'],
  ['agency health check live scope', "kind === 'healthCheck'"],
  ['agency automation data source', 'agencyApi.getAutomationJobs({ period })'],
  ['agency automation row mapper', 'function mapAgencyAutomationJobRow(item: AutomationJob)'],
  ['agency collection preflight label', "if (jobType === 'tax_profile_collection') return '税务资料采集预检'"],
  ['agency collection preflight tab filter', "if (activeTab === '采集预检') return rows.filter((row) => row.values.name.includes('采集预检'))"],
  ['agency automation live scope', "kind === 'automation'"],
  ['agency invoice management row mapper', 'function mapAgencyInvoiceManagementRow(item: AgencyFeeCollection)'],
  ['agency invoice management live scope', "kind === 'invoiceManagement'"],
  ['agency download job source', 'const exportJobs = useExportJobs()'],
  ['agency download live rows', "kind === 'downloadCenter' ? pageConfig.rows"],
  ['agency download summary mapper', 'function summarizeAgencyDownloadJobs(rows: AgencyRow[])'],
  ['agency download period mapper', 'function extractAgencyExportPeriod(job: ExportJob)'],
  ['agency Tauri empty-state boundary', 'isTauri ? remoteRows ?? [] : remoteRows ?? pageConfig.rows'],
  ['agency selected period store', 'const currentPeriodId = usePeriodStore((state) => state.currentPeriodId)'],
  ['agency dynamic period label', 'const agencyPeriodLabel = currentPeriod'],
  ['agency batch task period binding', 'agencyApi.createBatchTasks({ period: agencyPeriodLabel, taskTypes: selectedBatchTaskTypes, operator: \'admin\' })'],
  ['agency audit persistence', 'automationApi.writeOperationAuditLog({'],
  ['agency excel current period export', 'const fileName = `${pageConfig.title}-${agencyPeriodLabel}.xlsx`'],
  ['agency pdf current period export', 'const fileName = `${pageConfig.title}-${agencyPeriodLabel}.pdf`'],
  ['agency print current period export', 'const fileName = `${pageConfig.title}-${agencyPeriodLabel}-print`'],
  ['agency export audit', "writeAgencyAudit('导出Excel', fileName"],
  ['agency print audit', "writeAgencyAudit('打印', fileName"],
  ['agency pdf audit', "writeAgencyAudit('导出PDF', fileName"],
]

const requiredAgencyFeeEntryCommandSnippets = [
  ['agency fee collection create command', 'pub async fn create_agency_fee_collection'],
]

const requiredAgencyFeeEntryApiSnippets = [
  ['agency fee collection create api', 'createFeeCollection: async'],
]

const requiredAgencyFeeEntryPageSnippets = [
  ['agency fee collection create dialog', '新增收费记录'],
  ['agency fee collection create binding', 'agencyApi.createFeeCollection({'],
]

const requiredAgencyCollaborationEntryCommandSnippets = [
  ['agency collaboration create command', 'pub async fn create_agency_collaboration_item'],
]

const requiredAgencyCollaborationEntryApiSnippets = [
  ['agency collaboration create api', 'createCollaborationItem: async'],
]

const requiredAgencyCollaborationEntryPageSnippets = [
  ['agency collaboration create dialog', '新增协同事项'],
  ['agency collaboration create binding', 'agencyApi.createCollaborationItem({'],
]

const requiredAgencyAuthorizationEntryPageSnippets = [
  ['agency authorization create dialog', '新增授权记录'],
  ['agency authorization create binding', 'automationApi.upsertAdapterAuthorization({'],
  ['agency authorization secret boundary', '不录入密码、验证码、Cookie 或税务局会话信息'],
]

const requiredAgencyServiceContractEntryPageSnippets = [
  ['agency service contract create dialog', '新增服务合同'],
  ['agency service contract structured form', '<span>服务开始</span>'],
  ['agency service contract create binding', 'agencyApi.createServiceContract({'],
]

const requiredAgencyBatchTaskApiSnippets = [
  ['agency batch task selection input', 'taskTypes?: string[]'],
  ['agency batch task review api', 'reviewBatchTask: async'],
]

const requiredAgencyBatchTaskCommandSnippets = [
  ['agency batch task type filter', 'task_types'],
  ['agency batch task deduplication', 'WHERE NOT EXISTS'],
  ['agency batch task result summary', 'CreateAgencyBatchTasksResult'],
  ['agency batch task review command', 'pub async fn review_agency_batch_task'],
  ['agency batch task approval state', 'awaiting_approval'],
]

const requiredAgencyBatchTaskPageSnippets = [
  ['agency batch task selection dialog', '选择批量预检任务'],
  ['agency batch task selection state', 'selectedBatchTaskTypes'],
  ['agency batch task selected API call', 'taskTypes: selectedBatchTaskTypes'],
  ['agency batch task review handler', 'handleReviewBatchTask'],
  ['agency batch task approval action', '通过预检'],
  ['agency batch task rejection action', '驳回预检'],
  ['agency batch task local tab filter', 'filterAgencyBatchTaskRows(localRows, activeTab)'],
  ['agency batch task local row lifecycle', 'setLocalRows([])\n    setOperationNotice(null)\n  }, [kind])'],
  ['agency account import handoff', "navigate('/?importCompanies=1')"],
  ['agency overview period binding', 'agencyApi.getOverview(agencyPeriodLabel)'],
  ['agency module period binding', 'fetchAgencyRows(kind, activeTab, agencyPeriodLabel)'],
  ['agency row detail state', 'const [detailRow, setDetailRow] = useState<AgencyRow | null>(null)'],
  ['agency row detail dialog', '机构级明细'],
]

const requiredWelcomeImportHandoffSnippets = [
  ['welcome agency import query trigger', "get('importCompanies') === '1'"],
  ['welcome company import picker trigger', 'companyImportRef.current?.click()'],
]

const requiredMeasurementUnitEntryPageSnippets = [
  ['measurement unit structured dialog', '<span>单位名称</span>'],
  ['measurement unit create binding', 'measurementUnitApi.createMeasurementUnit(unitInput)'],
]

const requiredInventoryItemEntryPageSnippets = [
  ['inventory item structured dialog', '<span>存货编码</span>'],
  ['inventory item create binding', 'inventoryItemApi.createInventoryItem(itemInput)'],
]

const requiredSocialSecurityEntryPageSnippets = [
  ['social security structured dialog', '<span>缴费城市</span>'],
  ['social security create binding', 'socialSecurityApi.createSocialSecurityRecord(securityInput)'],
]

const requiredInvoiceEntryPageSnippets = [
  ['invoice create store binding', 'const createInvoice = useInvoiceStore((state) => state.createInvoice)'],
  ['invoice create dialog', '新增发票'],
  ['invoice create action', 'await createInvoice({'],
]

const requiredVoucherEntryPageSnippets = [
  ['voucher create store binding', 'const addVoucher = useVoucherStore((state) => state.addVoucher)'],
  ['voucher word source', 'const voucherWords = usePeriodStore((state) => state.voucherWords)'],
  ['voucher structured workspace', '凭证分录'],
  ['voucher create action', 'await addVoucher({'],
  ['voucher client balance guard', '借贷金额不平衡'],
  ['voucher list new navigation', "navigate('/vouchers/new')"],
  ['voucher edit source binding', 'const updateVoucher = useVoucherStore((state) => state.updateVoucher)'],
  ['voucher edit load binding', 'await getVoucher(voucherId, selectedCompanyId)'],
  ['voucher edit action', 'await updateVoucher({'],
  ['voucher edit workspace', "kind === 'voucherCreate' || kind === 'voucherEdit'"],
  ['voucher detail workspace', "kind === 'voucherCreate' || kind === 'voucherEdit' || kind === 'voucherDetail'"],
  ['voucher detail read only guard', "const isVoucherReadOnly = kind === 'voucherDetail'"],
  ['voucher row detail navigation', "navigate(`/vouchers/detail/${row.id}`)"],
  ['voucher row edit navigation', "navigate(`/vouchers/edit/${row.id}`)"],
  ['voucher approve binding', 'const approveVoucher = useVoucherStore((state) => state.approveVoucher)'],
  ['voucher reverse approve binding', 'const reverseApproveVoucher = useVoucherStore((state) => state.reverseApproveVoucher)'],
  ['voucher approval action', 'await approveVoucher(loadedVoucher.id, \'admin\', selectedCompanyId)'],
  ['voucher reverse approval action', 'await reverseApproveVoucher(loadedVoucher.id, selectedCompanyId)'],
  ['voucher delete binding', 'const deleteVoucher = useVoucherStore((state) => state.deleteVoucher)'],
  ['voucher restore binding', 'const restoreVoucher = useVoucherStore((state) => state.restoreVoucher)'],
  ['voucher permanent delete binding', 'const permanentDeleteVoucher = useVoucherStore((state) => state.permanentDeleteVoucher)'],
  ['voucher soft delete action', 'await deleteVoucher(loadedVoucher.id, selectedCompanyId)'],
  ['voucher restore action', 'await restoreVoucher(row.id, selectedCompanyId)'],
  ['voucher permanent delete action', 'await permanentDeleteVoucher(row.id, selectedCompanyId)'],
  ['voucher recycle selection state', 'const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set())'],
  ['voucher recycle batch restore', 'await Promise.all(selectedIds.map((id) => restoreVoucher(id, selectedCompanyId)))'],
  ['voucher batch approve binding', 'const batchApprove = useVoucherStore((state) => state.batchApprove)'],
  ['voucher batch reverse binding', 'const batchReverseApprove = useVoucherStore((state) => state.batchReverseApprove)'],
  ['voucher batch approve action', "await batchApprove(selectedIds, 'admin', selectedCompanyId)"],
  ['voucher batch reverse action', 'await batchReverseApprove(selectedIds, selectedCompanyId)'],
]

const requiredInvoiceEditPageSnippets = [
  ['invoice edit store binding', 'const updateInvoice = useInvoiceStore((state) => state.updateInvoice)'],
  ['invoice detail store binding', 'const getInvoice = useInvoiceStore((state) => state.getInvoice)'],
  ['invoice edit load action', 'await getInvoice(row.id, selectedCompanyId)'],
  ['invoice edit update action', 'await updateInvoice(editingInvoiceId, {'],
  ['invoice to voucher navigation', "navigate('/vouchers/new')"],
  ['invoice no fake generation notice', '请在新建凭证页选择科目并完成借贷平衡后保存'],
  ['invoice voucher match binding', 'const matchInvoiceToVoucher = useInvoiceStore((state) => state.matchInvoiceToVoucher)'],
  ['invoice voucher match dialog', '人工匹配发票与凭证'],
  ['invoice voucher match action', 'await matchInvoiceToVoucher(selectedMatchInvoiceId, selectedMatchVoucherId, selectedCompanyId)'],
]

const requiredAppSnippets = [
  ['AI root route uses live queue', "<Route path=\"/ai\" element={businessPage('aiJobQueue'"],
]

const requiredShellSnippets = [
  ['shell selected company binding', 'const selectedCompany = useCompanyStore((state) => state.companies.find((company) => company.id === state.selectedCompanyId))'],
  ['shell selected period binding', 'const currentPeriod = usePeriodStore((state) => state.periods.find((period) => period.id === state.currentPeriodId))'],
  ['shell audit company label', 'const auditCompanyLabel = selectedCompany?.name ||'],
  ['shell audit period label', 'const auditPeriodLabel = currentPeriod'],
  ['shell audit scope binding', 'voucher: `${auditPeriodLabel}/${auditCompanyLabel}`'],
]

const requiredDashboardSnippets = [
  ['dashboard current company scope', 'const usesLiveDashboardData = Boolean(isTauri && selectedCompanyId && currentPeriodId)'],
  ['dashboard invoice refresh', 'fetchInvoices({ company_id: selectedCompanyId, period_id: currentPeriodId })'],
  ['dashboard voucher refresh', 'queryVouchers({ company_id: selectedCompanyId, period_id: currentPeriodId, page: 1, page_size: 100 })'],
  ['dashboard tax task source', 'automationApi.getTaxDeclarationTasks({ companyId: selectedCompanyId, period: currentPeriodLabel })'],
  ['dashboard AI task source', 'automationApi.getAutomationJobs({ companyId: selectedCompanyId, period: currentPeriodLabel })'],
]

const requiredBackupCommandSnippets = [
  ['backup command creates snapshot', 'pub async fn create_local_backup'],
  ['backup command lists snapshots', 'pub async fn list_local_backups'],
  ['backup command verifies snapshot', 'pub async fn verify_local_backup'],
  ['backup snapshot uses sqlite vacuum', 'VACUUM INTO'],
  ['backup storage directory', 'join("backups")'],
  ['backup verification checks sqlite header', 'SQLite format 3'],
]

const requiredBackupPageSnippets = [
  ['backup api create binding', 'backupApi.createLocalBackup()'],
  ['backup api list binding', 'backupApi.listLocalBackups()'],
  ['backup api verification binding', 'backupApi.verifyLocalBackup(row.id)'],
  ['backup local data scope', "kind === 'backupRestore'"],
  ['backup snapshot audit', "writeModuleAudit('立即备份'"],
  ['backup verification audit', "writeModuleAudit('核验备份'"],
]

const requiredEmployeeCommandSnippets = [
  ['employee table schema', 'CREATE TABLE IF NOT EXISTS employees'],
  ['employee list command', 'pub async fn get_employees'],
  ['employee create command', 'pub async fn create_employee'],
  ['employee update command', 'pub async fn update_employee'],
  ['employee company scope', 'WHERE company_id = ?'],
]

const requiredEmployeePageSnippets = [
  ['employee api list binding', 'employeeApi.getEmployees(selectedCompanyId)'],
  ['employee api create binding', 'employeeApi.createEmployee(input)'],
  ['employee api update binding', 'employeeApi.updateEmployee({'],
  ['employee row mapper', 'mapLiveEmployeeRows(employees)'],
  ['employee summary mapper', 'summarizeLiveEmployees(employees)'],
]

const requiredPayrollCommandSnippets = [
  ['payroll table schema', 'CREATE TABLE IF NOT EXISTS payroll_records'],
  ['payroll list command', 'pub async fn get_payroll_records'],
  ['payroll create command', 'pub async fn create_payroll_record'],
  ['payroll update command', 'pub async fn update_payroll_record'],
  ['payroll current period filter', 'AND p.period = ?'],
]

const requiredPayrollPageSnippets = [
  ['payroll api list binding', 'payrollApi.getPayrollRecords({ companyId: selectedCompanyId, period: currentPeriodLabel })'],
  ['payroll api create binding', 'payrollApi.createPayrollRecord({'],
  ['payroll api update binding', 'payrollApi.updatePayrollRecord({'],
  ['payroll edit state', 'const [editingPayrollId, setEditingPayrollId] = useState<string | null>(null)'],
  ['payroll row mapper', 'mapLivePayrollRows(payrollRecords)'],
  ['payroll summary mapper', 'summarizeLivePayroll(payrollRecords)'],
]

const requiredSettlementRuleEntrySnippets = [
  ['settlement rule create action', 'createSettlementRule: async'],
  ['settlement rule update action', 'updateSettlementRule: async'],
  ['settlement rule delete action', 'deleteSettlementRule: async'],
]

const requiredSettlementRulePageSnippets = [
  ['settlement rule edit state', 'const [editingSettlementRuleId, setEditingSettlementRuleId] = useState<string | null>(null)'],
  ['settlement rule create binding', 'createSettlementRule({'],
  ['settlement rule update binding', 'updateSettlementRule({'],
]

const requiredCurrencyEntryPageSnippets = [
  ['currency edit state', 'const [editingCurrencyId, setEditingCurrencyId] = useState<string | null>(null)'],
  ['currency create binding', 'createCurrency({'],
  ['currency update binding', 'updateCurrency({'],
]

const requiredCommonDigestCommandSnippets = [
  ['common digest update company scope', 'UPDATE common_digests SET content = ? WHERE id = ? AND company_id = ?'],
  ['common digest delete company scope', 'pub async fn delete_common_digest(id: String, company_id: String'],
]

const requiredCommonDigestEntryPageSnippets = [
  ['common digest edit state', 'const [editingCommonDigestId, setEditingCommonDigestId] = useState<string | null>(null)'],
  ['common digest create binding', 'createCommonDigest({'],
  ['common digest update binding', 'updateCommonDigest({'],
]

const requiredVoucherTemplateCommandSnippets = [
  ['voucher template type company scope', 'SELECT id FROM voucher_template_types WHERE id = ? AND company_id = ?'],
  ['voucher template entries validation', '凭证模板分录格式无效'],
]

const requiredVoucherTemplateEntryStoreSnippets = [
  ['voucher template create action', 'createVoucherTemplate: async'],
  ['voucher template update action', 'updateVoucherTemplate: async'],
  ['voucher template delete action', 'deleteVoucherTemplate: async'],
]

const requiredVoucherTemplateEntryPageSnippets = [
  ['voucher template edit state', 'const [editingVoucherTemplateId, setEditingVoucherTemplateId] = useState<string | null>(null)'],
  ['voucher template create binding', 'createVoucherTemplate({'],
  ['voucher template update binding', 'updateVoucherTemplate({'],
]

const requiredAdapterAuthorizationEntryPageSnippets = [
  ['adapter authorization edit state', 'const [editingAdapterAuthorizationId, setEditingAdapterAuthorizationId] = useState<string | null>(null)'],
  ['adapter authorization save binding', 'automationApi.upsertAdapterAuthorization({'],
]

const requiredReportFormulaEntryStoreSnippets = [
  ['report formula update action', 'updateReportItem: async'],
]

const requiredReportFormulaEntryPageSnippets = [
  ['report formula edit state', 'const [editingReportFormulaId, setEditingReportFormulaId] = useState<string | null>(null)'],
  ['report formula update binding', 'updateReportItem({'],
]

const requiredAuxiliaryArchiveStoreSnippets = [
  ['auxiliary item fetch company scope', 'fetchItems: (categoryId: string, companyId: string)'],
  ['auxiliary category create action', 'createCategory: async'],
  ['auxiliary category update action', 'updateCategory: async'],
  ['auxiliary category company scoped delete', 'deleteCategory: async (id, companyId)'],
  ['auxiliary item create action', 'createItem: async'],
  ['auxiliary item update action', 'updateItem: async'],
  ['auxiliary item company scoped delete', 'deleteItem: async (id, companyId)'],
  ['auxiliary item company scoped toggle', 'toggleItem: async (id, companyId)'],
]

const requiredAuxiliaryArchiveCommandSnippets = [
  ['auxiliary category system delete guard', '系统预置辅助核算类别不能删除'],
  ['auxiliary category system update guard', '系统预置辅助核算类别不能修改'],
]

const requiredAuxiliaryArchivePageSnippets = [
  ['auxiliary category create binding', 'const createAuxiliaryCategory = useAuxiliaryStore((state) => state.createCategory)'],
  ['auxiliary item create binding', 'const createAuxiliaryItem = useAuxiliaryStore((state) => state.createItem)'],
  ['auxiliary category dialog state', 'const [showAuxiliaryCategoryDialog, setShowAuxiliaryCategoryDialog] = useState(false)'],
  ['auxiliary item dialog state', 'const [showAuxiliaryItemDialog, setShowAuxiliaryItemDialog] = useState(false)'],
  ['auxiliary category save handler', 'const handleSaveAuxiliaryCategory = async'],
  ['auxiliary item save handler', 'const handleSaveAuxiliaryItem = async'],
  ['auxiliary category create action', 'createAuxiliaryCategory({'],
  ['auxiliary item create action', 'createAuxiliaryItem({'],
  ['auxiliary item toggle company scope', 'toggleAuxiliaryItem(item.id, selectedCompanyId)'],
  ['auxiliary category dialog title', '新增辅助核算类别'],
  ['auxiliary item dialog title', '新增辅助核算项目'],
]

const requiredVoucherEntryAuxiliarySnippets = [
  ['voucher auxiliary item company scope', 'fetchItems(cat.category_id, selectedCompanyId)'],
]

const requiredMatchingRuleCommandSnippets = [
  ['matching rule list command', 'pub async fn get_matching_rules'],
  ['matching rule create command', 'pub async fn create_matching_rule'],
  ['matching rule update command', 'pub async fn update_matching_rule'],
  ['matching rule delete command', 'pub async fn delete_matching_rule'],
]

const requiredMatchingRuleStoreSnippets = [
  ['matching rule fetch action', 'fetchMatchingRules: async'],
  ['matching rule create action', 'createMatchingRule: async'],
  ['matching rule update action', 'updateMatchingRule: async'],
  ['matching rule delete action', 'deleteMatchingRule: async'],
]

const requiredMatchingRulePageSnippets = [
  ['matching rule store binding', "from '../../stores/matchingRuleStore'"],
  ['matching rule live scope', "['invoiceMatchingRules', 'billMatchingRules', 'cashFlowMapping']"],
  ['matching rule row mapping', 'mapLiveMatchingRuleRows(matchingRules, matchingRuleScope)'],
  ['matching rule editor state', 'const [showMatchingRuleDialog, setShowMatchingRuleDialog] = useState(false)'],
  ['matching rule save binding', 'createMatchingRule({'],
]

const requiredAssetCategoryCommandSnippets = [
  ['asset category list command', 'pub async fn get_asset_categories'],
  ['asset category create command', 'pub async fn create_asset_category'],
  ['asset category update command', 'pub async fn update_asset_category'],
  ['asset category delete command', 'pub async fn delete_asset_category'],
  ['asset category toggle command', 'pub async fn toggle_asset_category'],
]
const requiredAssetCategoryStoreSnippets = [
  ['asset category fetch action', 'fetchAssetCategories: async'],
  ['asset category create action', 'createAssetCategory: async'],
  ['asset category update action', 'updateAssetCategory: async'],
  ['asset category delete action', 'deleteAssetCategory: async'],
  ['asset category toggle action', 'toggleAssetCategory: async'],
]
const requiredAssetCategoryPageSnippets = [
  ['asset category store binding', "from '../../stores/assetCategoryStore'"],
  ['asset category live scope', "kind === 'assetCategory'"],
  ['asset category row mapping', 'mapLiveAssetCategoryRows(assetCategories)'],
  ['asset category editor state', 'const [showAssetCategoryDialog, setShowAssetCategoryDialog] = useState(false)'],
  ['asset category save binding', 'createAssetCategory({'],
]
const requiredBusinessTagCommandSnippets = [
  ['business tag list command', 'pub async fn get_business_tags'],
  ['business tag create command', 'pub async fn create_business_tag'],
  ['business tag update command', 'pub async fn update_business_tag'],
  ['business tag delete command', 'pub async fn delete_business_tag'],
  ['invoice tag list command', 'pub async fn get_invoice_tag_ids'],
  ['invoice tag replace command', 'pub async fn replace_invoice_tags'],
  ['voucher tag list command', 'pub async fn get_voucher_tag_ids'],
  ['voucher tag replace command', 'pub async fn replace_voucher_tags'],
  ['bank transaction tag list command', 'pub async fn get_bank_transaction_tag_ids'],
  ['bank transaction tag replace command', 'pub async fn replace_bank_transaction_tags'],
]
const requiredBusinessTagStoreSnippets = [
  ['business tag fetch action', 'fetchBusinessTags: async'],
  ['business tag create action', 'createBusinessTag: async'],
  ['business tag update action', 'updateBusinessTag: async'],
  ['business tag delete action', 'deleteBusinessTag: async'],
  ['invoice tag fetch action', 'fetchInvoiceTagIds: async'],
  ['invoice tag replace action', 'replaceInvoiceTags: async'],
  ['voucher tag fetch action', 'fetchVoucherTagIds: async'],
  ['voucher tag replace action', 'replaceVoucherTags: async'],
  ['bank transaction tag fetch action', 'fetchBankTransactionTagIds: async'],
  ['bank transaction tag replace action', 'replaceBankTransactionTags: async'],
]
const requiredBusinessTagPageSnippets = [
  ['business tag store binding', "from '../../stores/businessTagStore'"],
  ['business tag live scope', "kind === 'tagArchive'"],
  ['business tag row mapping', 'mapLiveBusinessTagRows(businessTags)'],
  ['business tag editor state', 'const [showBusinessTagDialog, setShowBusinessTagDialog] = useState(false)'],
  ['business tag save binding', 'createBusinessTag({'],
  ['invoice tag selection state', 'const [selectedInvoiceTagIds, setSelectedInvoiceTagIds] = useState<string[]>([])'],
  ['invoice tag save binding', 'replaceInvoiceTags(invoice.id, selectedCompanyId, selectedInvoiceTagIds)'],
  ['invoice tag live mapper', 'mapLiveInvoiceRows(invoices, \'output\', invoiceTagIds, businessTags)'],
  ['voucher tag selection state', 'const [selectedVoucherTagIds, setSelectedVoucherTagIds] = useState<string[]>([])'],
  ['voucher tag save binding', 'replaceVoucherTags(voucher.id, selectedCompanyId, selectedVoucherTagIds)'],
  ['voucher tag live mapper', 'mapLiveVoucherRows(vouchers, voucherTagIds, businessTags)'],
  ['bank transaction tag selection state', 'const [selectedBankTransactionTagIds, setSelectedBankTransactionTagIds] = useState<string[]>([])'],
  ['bank transaction tag save binding', 'replaceBankTransactionTags(result.data.id, selectedCompanyId, selectedBankTransactionTagIds)'],
  ['bank transaction tag live mapper', 'mapLiveBankTransactionRows(bankTransactions, kind, bankTransactionTagIds, businessTags)'],
  ['business tag filter state', "const [businessTagFilter, setBusinessTagFilter] = useState('全部')"],
  ['business tag filter binding', "businessTagFilter === '全部' || row.values.tags?.split(' / ').includes(businessTagFilter)"],
]
const requiredBusinessOrderCommandSnippets = [
  ['business order list command', 'pub async fn get_business_orders'],
  ['business order create command', 'pub async fn create_business_order'],
  ['business order update command', 'pub async fn update_business_order'],
]
const requiredStructuredAiSuggestionSchemaSnippets = [
  ['AI suggestion number column', 'suggestion_no TEXT'],
  ['AI suggestion debit column', 'debit_subject TEXT'],
  ['AI suggestion credit column', 'credit_subject TEXT'],
  ['AI suggestion amount column', 'suggestion_amount REAL'],
]
const requiredStructuredAiSuggestionCommandSnippets = [
  ['AI suggestion structured read', 'j.suggestion_no'],
  ['AI suggestion structured insert', 'suggestion_no, debit_subject, credit_subject, suggestion_amount'],
]
const requiredStructuredAiSuggestionApiSnippets = [
  ['AI suggestion typed debit subject', 'debitSubject: string | null'],
  ['AI suggestion typed credit subject', 'creditSubject: string | null'],
  ['AI suggestion typed amount', 'suggestionAmount: number | null'],
  ['AI suggestion API debit mapping', 'debit_subject: input.debitSubject'],
  ['AI suggestion API amount mapping', 'suggestion_amount: input.suggestionAmount'],
]
const requiredStructuredAiSuggestionAdapterSnippets = [
  ['AI suggestion structured debit row', 'debit: job.debitSubject ||'],
  ['AI suggestion structured credit row', 'credit: job.creditSubject ||'],
  ['AI suggestion structured amount row', 'amount: job.suggestionAmount === null'],
]
const requiredMultiColumnLedgerAdapterSnippets = [
  ['multi-column ledger row mapper', 'export function mapLiveMultiColumnLedgerRows'],
  ['multi-column ledger summary mapper', 'export function summarizeLiveMultiColumnLedger'],
]
const requiredMultiColumnLedgerPageSnippets = [
  ['multi-column ledger live scope', "'multiColumnLedgerReport'"],
  ['multi-column ledger report request', "kind === 'multiColumnLedgerReport'"],
  ['multi-column ledger live mapper', 'mapLiveMultiColumnLedgerRows(liveReports.multiColumnLedger)'],
]
const requiredIncomeQuarterAdapterSnippets = [
  ['income quarter row mapper', 'export function mapLiveIncomeQuarterRows'],
  ['income quarter summary mapper', 'export function summarizeLiveIncomeQuarter'],
]
const requiredIncomeQuarterPageSnippets = [
  ['income quarter live scope', "'incomeQuarterReport'"],
  ['income quarter baseline request', 'getIncomeStatement(priorQuarterPeriod.id)'],
  ['income quarter live mapper', 'mapLiveIncomeQuarterRows(liveReports.incomeStatement, liveReports.incomeQuarterBaseline'],
]
const requiredCashFlowQuarterAdapterSnippets = [
  ['cash flow quarter row mapper', 'export function mapLiveCashFlowQuarterRows'],
  ['cash flow quarter summary mapper', 'export function summarizeLiveCashFlowQuarter'],
]
const requiredCashFlowQuarterPageSnippets = [
  ['cash flow quarter live scope', "'cashFlowQuarterReport'"],
  ['cash flow quarter baseline request', 'getCashFlowStatement(priorQuarterPeriod.id)'],
  ['cash flow quarter live mapper', 'mapLiveCashFlowQuarterRows(liveReports.cashFlow, liveReports.cashFlowQuarterBaseline'],
]
const requiredEquityChangeAdapterSnippets = [
  ['equity change row mapper', 'export function mapLiveEquityChangeRows'],
  ['equity change summary mapper', 'export function summarizeLiveEquityChange'],
]
const requiredEquityChangePageSnippets = [
  ['equity change live scope', "'equityChangeReport'"],
  ['equity change balance sheet request', 'getBalanceSheet(currentPeriodId)'],
  ['equity change income statement request', 'getIncomeStatement(currentPeriodId)'],
  ['equity change live mapper', 'mapLiveEquityChangeRows(liveReports.balanceSheet, liveReports.incomeStatement)'],
]
const requiredDeclarationCalendarAdapterSnippets = [
  ['declaration calendar row mapper', 'export function mapLiveDeclarationCalendarRows'],
  ['declaration calendar summary mapper', 'export function summarizeLiveDeclarationCalendar'],
]
const requiredDeclarationCalendarPageSnippets = [
  ['declaration calendar live scope', "kind === 'declarationCalendar'"],
  ['declaration calendar task loader', 'usesLiveDeclarationCalendarData'],
  ['declaration calendar live mapper', 'mapLiveDeclarationCalendarRows(taxDeclarationTasks)'],
]
const requiredNonTaxRevenueAdapterSnippets = [
  ['non-tax revenue row mapper', 'export function mapLiveNonTaxRevenueRows'],
  ['non-tax revenue summary mapper', 'export function summarizeLiveNonTaxRevenue'],
  ['non-tax revenue task scope', 'function isNonTaxRevenueTask'],
]
const requiredNonTaxRevenuePageSnippets = [
  ['non-tax revenue live scope', "kind === 'nonTaxRevenueReport'"],
  ['non-tax revenue task loader', 'usesLiveNonTaxRevenueData'],
  ['non-tax revenue live mapper', 'mapLiveNonTaxRevenueRows(taxDeclarationTasks)'],
  ['non-tax revenue manual save', 'automationApi.upsertTaxDeclarationTask({'],
  ['non-tax revenue editor title', '新增非税缴费事项'],
  ['non-tax revenue external submission boundary', '不会计算法定税额、生成外部缴款书或提交申报'],
]
const requiredTaxTaskConfirmationPageSnippets = [
  ['local tax task kind guard', "const isLocalTaxTaskKind = ['declarationCalendar', 'taxReport', 'financeTaxReport', 'nonTaxRevenueReport'].includes(kind)"],
  ['local tax task lookup', 'const taxTaskForRow = (row: ModuleRow) =>'],
  ['local tax task confirmation binding', 'automationApi.confirmTaxDeclarationTask({'],
  ['local tax task confirmation boundary', '不会向税局提交'],
  ['local tax task action label', "isConfirmedTaxTask(row) ? '已确认' : '确认事项'"],
]
const requiredDeclarationReceiptSchemaSnippets = [
  ['tax task payment status column', "payment_status TEXT NOT NULL DEFAULT 'unrecorded'"],
  ['tax task payment number column', 'payment_no TEXT'],
  ['tax task receipt received column', 'receipt_received_at TEXT'],
]
const requiredDeclarationReceiptCommandSnippets = [
  ['tax task payment select', 't.payment_status'],
  ['tax task payment insert', 'payment_status, payment_no, receipt_received_at'],
  ['tax task payment update', 'payment_status = excluded.payment_status'],
]
const requiredDeclarationReceiptPageSnippets = [
  ['receipt payment row mapping', 'paymentStatus: task.paymentStatus'],
  ['receipt archive editor state', 'const [showDeclarationReceiptDialog, setShowDeclarationReceiptDialog] = useState(false)'],
  ['receipt archive save binding', 'const handleSaveDeclarationReceipt = async'],
  ['receipt archive editor title', '归档回执缴款信息'],
  ['receipt archive external boundary', '不会发起税局申报或银行扣款'],
]
const requiredTaxInitPageSnippets = [
  ['tax init editor state', 'const [showTaxInitDialog, setShowTaxInitDialog] = useState(false)'],
  ['tax init save binding', 'const handleSaveTaxInit = async'],
  ['tax init editor title', '新增申报认定事项'],
  ['tax init upsert', 'automationApi.upsertTaxDeclarationTask({'],
  ['tax init external boundary', '不会登录税局、提交申报或扣款'],
]
const requiredStampTaxSchemaSnippets = [
  ['stamp tax item column', 'stamp_tax_item TEXT'],
  ['stamp tax rate column', 'stamp_tax_rate REAL'],
]
const requiredStampTaxCommandSnippets = [
  ['stamp tax item insert', 'stamp_tax_item, stamp_tax_rate'],
  ['stamp tax rate validation', 'input.stamp_tax_rate.filter'],
]
const requiredStampTaxPageSnippets = [
  ['stamp tax live scope', "kind === 'stampTaxReport'"],
  ['stamp tax live mapper', 'mapLiveStampTaxRows(documentRecords)'],
  ['stamp tax manual rate field', '印花税率（%）'],
]
const requiredCashFlowQuarterCommandSnippets = [
  ['cash flow YTD result field', 'net_increase_year_to_date: f64'],
  ['cash flow item YTD field', 'year_to_date: f64'],
  ['cash flow YTD period query', 'period_month <= ? ORDER BY period_month'],
  ['cash flow current period field', 'current_amount,'],
]
const requiredStructuredAiSuggestionPageSnippets = [
  ['AI suggestion editor state', 'const [showAiVoucherSuggestionDialog, setShowAiVoucherSuggestionDialog] = useState(false)'],
  ['AI suggestion create binding', 'automationApi.createAutomationJob({'],
  ['AI suggestion editor title', '新增 AI 凭证建议'],
  ['AI suggestion draft query id', "new URLSearchParams(location.search).get('aiSuggestion')"],
  ['AI suggestion draft data request', 'automationApi.getAutomationJobs({ companyId: selectedCompanyId, period: currentPeriodLabel })'],
  ['AI suggestion draft confirmation guard', "suggestion.status.toLowerCase() !== 'confirmed'"],
  ['AI suggestion draft prefill audit', "writeModuleAudit('预填AI凭证草稿'"],
  ['AI suggestion draft deep link', "navigate(`/vouchers/new?aiSuggestion=${encodeURIComponent(suggestionJobId)}`)"],
]
const requiredAiSuggestionVoucherLinkSchemaSnippets = [
  ['AI suggestion voucher id column', 'generated_voucher_id TEXT'],
  ['AI suggestion voucher number column', 'generated_voucher_number TEXT'],
]
const requiredAiSuggestionVoucherLinkCommandSnippets = [
  ['AI suggestion confirmed linkage guard', "job_type = 'voucher_suggestion'"],
  ['AI suggestion confirmed status guard', "status = 'confirmed'"],
  ['AI suggestion voucher linkage update', 'generated_voucher_id = ?'],
  ['AI suggestion completion status', "status = 'completed'"],
]
const requiredAiSuggestionVoucherLinkPageSnippets = [
  ['AI suggestion id passed on manual save', 'ai_suggestion_id: aiVoucherSuggestionId || undefined'],
  ['AI suggestion save audit', "writeModuleAudit('关联AI建议凭证'"],
]
const requiredAiSuggestionVoucherLinkAdapterSnippets = [
  ['AI suggestion actual voucher display', 'voucher: job.generatedVoucherNumber || job.sourceId ||'],
]
const requiredAiSuggestionVoucherUnlinkCommandSnippets = [
  ['AI suggestion permanent-delete reset status', "SET generated_voucher_id = NULL, generated_voucher_number = NULL, status = 'confirmed'"],
  ['AI suggestion permanent-delete reset scope', 'WHERE generated_voucher_id = ? AND company_id = ?'],
]
const requiredAiSuggestionVoucherNavigationPageSnippets = [
  ['AI suggestion linked voucher lookup', 'job.generatedVoucherId'],
  ['AI suggestion linked voucher navigation', 'navigate(`/vouchers/detail/${job.generatedVoucherId}`)'],
  ['AI suggestion linked voucher action label', "row.status === '已生成凭证' ? '查看凭证'"],
]
const requiredBusinessOrderPageSnippets = [
  ['business order live scope', "['purchaseManagement', 'salesManagement'].includes(kind)"],
  ['business order editor state', 'const [showBusinessOrderDialog, setShowBusinessOrderDialog] = useState(false)'],
  ['business order list request', 'businessOrderApi.getBusinessOrders'],
  ['business order purchase mapper', "mapLiveBusinessOrderRows(businessOrders, 'purchase')"],
  ['business order sales mapper', "mapLiveBusinessOrderRows(businessOrders, 'sales')"],
]
const requiredCompanyAccountCommandSnippets = [
  ['company account list command', 'pub async fn get_company_accounts'],
  ['company account create command', 'pub async fn create_company_account'],
  ['company account update command', 'pub async fn update_company_account'],
  ['company account delete command', 'pub async fn delete_company_account'],
]
const requiredCompanyAccountStoreSnippets = [
  ['company account fetch action', 'fetchCompanyAccounts: async'],
  ['company account create action', 'createCompanyAccount: async'],
  ['company account update action', 'updateCompanyAccount: async'],
  ['company account delete action', 'deleteCompanyAccount: async'],
]
const requiredCompanyAccountPageSnippets = [
  ['company account store binding', "from '../../stores/companyAccountStore'"],
  ['company account live scope', "kind === 'accountArchive'"],
  ['company account row mapping', 'mapLiveCompanyAccountRows(companyAccounts)'],
  ['company account editor state', 'const [showCompanyAccountDialog, setShowCompanyAccountDialog] = useState(false)'],
  ['company account save binding', 'createCompanyAccount({'],
]

const requiredSocialSecurityCommandSnippets = [
  ['social security table schema', 'CREATE TABLE IF NOT EXISTS social_security_records'],
  ['social security list command', 'pub async fn get_social_security_records'],
  ['social security create command', 'pub async fn create_social_security_record'],
  ['social security update command', 'pub async fn update_social_security_record'],
]

const requiredSocialSecurityPageSnippets = [
  ['social security api list binding', 'socialSecurityApi.getSocialSecurityRecords({ companyId: selectedCompanyId, period: currentPeriodLabel })'],
  ['social security api create binding', 'socialSecurityApi.createSocialSecurityRecord(securityInput)'],
  ['social security api update binding', 'socialSecurityApi.updateSocialSecurityRecord({'],
  ['social security row mapper', 'mapLiveSocialSecurityRows(socialSecurityRecords)'],
]

const requiredSpecialDeductionCommandSnippets = [
  ['special deduction table schema', 'CREATE TABLE IF NOT EXISTS special_deduction_records'],
  ['special deduction list command', 'pub async fn get_special_deduction_records'],
  ['special deduction create command', 'pub async fn create_special_deduction_record'],
  ['special deduction update command', 'pub async fn update_special_deduction_record'],
]

const requiredSpecialDeductionPageSnippets = [
  ['special deduction api list binding', 'specialDeductionApi.getSpecialDeductionRecords({ companyId: selectedCompanyId, period: currentPeriodLabel })'],
  ['special deduction api create binding', 'specialDeductionApi.createSpecialDeductionRecord(deductionInput)'],
  ['special deduction api update binding', 'specialDeductionApi.updateSpecialDeductionRecord({'],
  ['special deduction row mapper', 'mapLiveSpecialDeductionRows(specialDeductionRecords)'],
]

const requiredWithholdingPageSnippets = [
  ['withholding local data boundary', "const usesLiveWithholdingTaxData = Boolean(isTauri && selectedCompanyId && kind === 'withholdingTaxReport')"],
  ['withholding row mapper', 'mapLiveWithholdingTaxRows(payrollRecords, employees, socialSecurityRecords, specialDeductionRecords)'],
  ['withholding summary mapper', 'summarizeLiveWithholdingTax(payrollRecords, employees, socialSecurityRecords, specialDeductionRecords)'],
]

const requiredSocialSecurityTaxPageSnippets = [
  ['social security tax local data boundary', "const usesLiveSocialSecurityTaxData = Boolean(isTauri && selectedCompanyId && kind === 'socialSecurityTaxReport')"],
  ['social security tax row mapper', 'mapLiveSocialSecurityTaxRows(socialSecurityRecords)'],
  ['social security tax summary mapper', 'summarizeLiveSocialSecurityTax(socialSecurityRecords)'],
]

const requiredIncomeTaxPageSnippets = [
  ['income tax report loader', "if (kind === 'incomeStatementReport' || kind === 'incomeQuarterReport' || kind === 'incomeTaxReport')"],
  ['income tax row mapper', 'mapLiveIncomeTaxRows(liveReports.incomeStatement)'],
  ['income tax summary mapper', 'summarizeLiveIncomeTax(liveReports.incomeStatement)'],
]

const requiredVatTaxPageSnippets = [
  ['vat tax local data boundary', "const usesLiveVatTaxData = Boolean(isTauri && selectedCompanyId && kind === 'vatTaxReport')"],
  ['vat tax invoice fetch', 'if (!usesLiveVatTaxData || !selectedCompanyId) return'],
  ['vat tax row mapper', 'mapLiveVatTaxRows(invoices)'],
  ['vat tax summary mapper', 'summarizeLiveVatTax(invoices)'],
]

const requiredBankTransactionCommandSnippets = [
  ['bank transaction table schema', 'CREATE TABLE IF NOT EXISTS bank_transactions'],
  ['bank transaction list command', 'pub async fn get_bank_transactions'],
  ['bank transaction create command', 'pub async fn create_bank_transaction'],
  ['bank transaction update command', 'pub async fn update_bank_transaction'],
]

const requiredBankTransactionPageSnippets = [
  ['bank transaction api list binding', 'bankTransactionApi.getBankTransactions({ companyId: selectedCompanyId, period: currentPeriodLabel })'],
  ['bank transaction api create binding', 'bankTransactionApi.createBankTransaction({'],
  ['bank transaction api update binding', 'bankTransactionApi.updateBankTransaction({'],
  ['bank transaction edit state', 'const [editingBankTransactionId, setEditingBankTransactionId] = useState<string | null>(null)'],
  ['bank transaction edit row binding', "if ((kind === 'billList' || kind === 'bankStatement') && isTauri && selectedCompanyId)"],
  ['bank transaction row mapper', 'mapLiveBankTransactionRows(bankTransactions, kind, bankTransactionTagIds, businessTags)'],
]

const requiredDocumentRecordCommandSnippets = [
  ['document record table schema', 'CREATE TABLE IF NOT EXISTS document_records'],
  ['document record list command', 'pub async fn get_document_records'],
  ['document record create command', 'pub async fn create_document_record'],
  ['document record update command', 'pub async fn update_document_record'],
]

const requiredDocumentRecordPageSnippets = [
  ['document record api list binding', 'documentRecordApi.getDocumentRecords({ companyId: selectedCompanyId, period: currentPeriodLabel })'],
  ['document record api create binding', 'documentRecordApi.createDocumentRecord({'],
  ['document record api update binding', 'documentRecordApi.updateDocumentRecord({'],
  ['document record edit state', 'const [editingDocumentRecordId, setEditingDocumentRecordId] = useState<string | null>(null)'],
  ['document record edit row binding', "if (['documentRegister', 'expenseReimbursement', 'receipt'].includes(kind) && isTauri && selectedCompanyId)"],
  ['document record row mapper', 'mapLiveDocumentRecordRows(documentRecords)'],
]

const requiredExpenseReimbursementPageSnippets = [
  ['expense reimbursement document source', "const usesLiveExpenseReimbursementData = Boolean(isTauri && selectedCompanyId && kind === 'expenseReimbursement')"],
  ['expense reimbursement row mapper', 'mapLiveExpenseReimbursementRows(documentRecords)'],
  ['expense reimbursement summary mapper', 'summarizeLiveExpenseReimbursements(documentRecords)'],
]

const requiredReceiptPageSnippets = [
  ['receipt local data scope', "const usesLiveReceiptData = Boolean(isTauri && selectedCompanyId && kind === 'receipt')"],
  ['receipt document record source', 'mapLiveReceiptRows(documentRecords)'],
  ['receipt summary source', 'summarizeLiveReceipts(documentRecords)'],
]
const requiredReconciliationPageSnippets = [
  ['bank reconciliation local scope', "const usesLiveBankReconciliationRecordData = Boolean(isTauri && selectedCompanyId && kind === 'bankReconciliation')"],
  ['bank reconciliation list request', 'bankReconciliationApi.getBankReconciliationRecords'],
  ['bank reconciliation row mapper', 'mapLiveBankReconciliationRows(bankReconciliationRecords)'],
  ['settlement records live scope', "['receivableSettlement', 'payableSettlement', 'receivablePayableAging'].includes(kind)"],
  ['settlement records list request', 'settlementRecordApi.getSettlementRecords'],
  ['receivable settlement row mapper', "mapLiveSettlementRecordRows(settlementRecords, 'receivable')"],
  ['payable settlement row mapper', "mapLiveSettlementRecordRows(settlementRecords, 'payable')"],
  ['aging row mapper', 'mapLiveSettlementAgingRows(settlementRecords)'],
]
const requiredSettlementRecordCommandSnippets = [
  ['settlement record list command', 'pub async fn get_settlement_records'],
  ['settlement record create command', 'pub async fn create_settlement_record'],
  ['settlement record update command', 'pub async fn update_settlement_record'],
]
const requiredBankReconciliationCommandSnippets = [
  ['bank reconciliation list command', 'pub async fn get_bank_reconciliation_records'],
  ['bank reconciliation create command', 'pub async fn create_bank_reconciliation_record'],
  ['bank reconciliation update command', 'pub async fn update_bank_reconciliation_record'],
]

const requiredAccountTransferPageSnippets = [
  ['account transfer table schema', 'CREATE TABLE IF NOT EXISTS account_transfers'],
  ['account transfer list command', 'pub async fn get_account_transfers'],
  ['account transfer create command', 'pub async fn create_account_transfer'],
  ['account transfer update command', 'pub async fn update_account_transfer'],
  ['account transfer api list binding', 'accountTransferApi.getAccountTransfers({ companyId: selectedCompanyId, period: currentPeriodLabel })'],
  ['account transfer api create binding', 'accountTransferApi.createAccountTransfer({'],
  ['account transfer api update binding', 'accountTransferApi.updateAccountTransfer({'],
  ['account transfer edit row binding', "if (kind === 'transfer' && isTauri && selectedCompanyId)"],
  ['account transfer edit state', 'const [editingAccountTransferId, setEditingAccountTransferId] = useState<string | null>(null)'],
  ['account transfer row mapper', 'mapLiveAccountTransferRows(accountTransfers)'],
]

const requiredFixedAssetCommandSnippets = [
  ['fixed asset table schema', 'CREATE TABLE IF NOT EXISTS fixed_assets'],
  ['fixed asset list command', 'pub async fn get_fixed_assets'],
  ['fixed asset create command', 'pub async fn create_fixed_asset'],
  ['fixed asset update command', 'pub async fn update_fixed_asset'],
]

const requiredFixedAssetPageSnippets = [
  ['fixed asset api list binding', 'fixedAssetApi.getFixedAssets({ companyId: selectedCompanyId, period: currentPeriodLabel })'],
  ['fixed asset api create binding', 'fixedAssetApi.createFixedAsset({'],
  ['fixed asset api update binding', 'fixedAssetApi.updateFixedAsset({'],
  ['fixed asset edit state', 'const [editingFixedAssetId, setEditingFixedAssetId] = useState<string | null>(null)'],
  ['fixed asset edit row binding', "if (kind === 'depreciation' && isTauri && selectedCompanyId)"],
  ['fixed asset row mapper', 'mapLiveFixedAssetRows(fixedAssets)'],
  ['fixed asset category suggestion', "list={field === 'category' ? 'asset-category-options'"],
  ['fixed asset category default', 'assetCategories.find((category) => category.is_enabled === 1)'],
]

const requiredInventoryMovementCommandSnippets = [
  ['inventory movement table schema', 'CREATE TABLE IF NOT EXISTS inventory_movements'],
  ['inventory movement list command', 'pub async fn get_inventory_movements'],
  ['inventory movement create command', 'pub async fn create_inventory_movement'],
  ['inventory movement update command', 'pub async fn update_inventory_movement'],
]

const requiredInventoryMovementPageSnippets = [
  ['inventory movement api list binding', 'inventoryMovementApi.getInventoryMovements({ companyId: selectedCompanyId, period: currentPeriodLabel })'],
  ['inventory movement api create binding', 'inventoryMovementApi.createInventoryMovement({'],
  ['inventory movement api update binding', 'inventoryMovementApi.updateInventoryMovement({'],
  ['inventory movement edit state', 'const [editingInventoryMovementId, setEditingInventoryMovementId] = useState<string | null>(null)'],
  ['inventory movement edit row binding', "if (kind === 'inventoryMovement' && isTauri && selectedCompanyId)"],
  ['inventory movement row mapper', 'mapLiveInventoryMovementRows(inventoryMovements)'],
  ['cost carryover live scope', "const usesLiveCostCarryoverData = Boolean(isTauri && selectedCompanyId && kind === 'costCarryover')"],
  ['cost carryover list request', 'costCarryoverApi.getCostCarryoverRecords'],
  ['cost carryover row mapper', 'mapLiveCostCarryoverRows(costCarryoverRecords)'],
]
const requiredCostCarryoverCommandSnippets = [
  ['cost carryover list command', 'pub async fn get_cost_carryover_records'],
  ['cost carryover create command', 'pub async fn create_cost_carryover_record'],
  ['cost carryover update command', 'pub async fn update_cost_carryover_record'],
]

const requiredInventoryItemCommandSnippets = [
  ['inventory item table schema', 'CREATE TABLE IF NOT EXISTS inventory_items'],
  ['inventory item list command', 'pub async fn get_inventory_items'],
  ['inventory item create command', 'pub async fn create_inventory_item'],
  ['inventory item update command', 'pub async fn update_inventory_item'],
]

const requiredInventoryItemPageSnippets = [
  ['inventory item api list binding', 'inventoryItemApi.getInventoryItems({ companyId: selectedCompanyId })'],
  ['inventory item api create binding', 'inventoryItemApi.createInventoryItem(itemInput)'],
  ['inventory item api update binding', 'inventoryItemApi.updateInventoryItem({'],
  ['inventory item edit state', 'const [editingInventoryItemId, setEditingInventoryItemId] = useState<string | null>(null)'],
  ['inventory item row mapper', 'mapLiveInventoryItemRows(inventoryItems)'],
]

const requiredUnitCommandSnippets = [
  ['unit table schema', 'CREATE TABLE IF NOT EXISTS measurement_units'],
  ['unit list command', 'pub async fn get_measurement_units'],
  ['unit create command', 'pub async fn create_measurement_unit'],
  ['unit update command', 'pub async fn update_measurement_unit'],
]

const requiredUnitPageSnippets = [
  ['unit api list binding', 'measurementUnitApi.getMeasurementUnits({ companyId: selectedCompanyId })'],
  ['unit api create binding', 'measurementUnitApi.createMeasurementUnit(unitInput)'],
  ['unit api update binding', 'measurementUnitApi.updateMeasurementUnit({'],
  ['unit edit state', 'const [editingMeasurementUnitId, setEditingMeasurementUnitId] = useState<string | null>(null)'],
  ['unit row mapper', 'mapLiveMeasurementUnitRows(measurementUnits)'],
]

function verify(source, checks, sourceName) {
  return checks
    .filter(([, snippet]) => !source.includes(snippet))
    .map(([label, snippet]) => `${sourceName}: ${label} missing snippet: ${snippet}`)
}

const errors = [
  ...verify(adapterSource, requiredAdapterSnippets, 'live module adapter'),
  ...verify(pageSource, requiredPageSnippets, 'business module page'),
  ...verify(localFileRegistrySource, requiredLocalFileRegistrySnippets, 'local file registry'),
  ...verify(taxWorkspaceSource, requiredTaxWorkspaceSnippets, 'tax workspace'),
  ...verify(welcomeSource, requiredWelcomeSnippets, 'welcome page'),
  ...verify(companyStoreSource, requiredCompanyPersistenceSnippets.slice(0, 2), 'company store'),
  ...verify(companyCommandSource, requiredCompanyPersistenceSnippets.slice(2, 3), 'company commands'),
  ...verify(databaseSource, requiredCompanyPersistenceSnippets.slice(3), 'database schema'),
  ...verify(agencyModuleSource, requiredAgencyModuleSnippets, 'agency module page'),
  ...verify(agencyCommandSource, requiredAgencyFeeEntryCommandSnippets, 'agency commands'),
  ...verify(apiSource, requiredAgencyFeeEntryApiSnippets, 'api bindings'),
  ...verify(agencyModuleSource, requiredAgencyFeeEntryPageSnippets, 'agency fee entry page'),
  ...verify(agencyCommandSource, requiredAgencyCollaborationEntryCommandSnippets, 'agency commands'),
  ...verify(apiSource, requiredAgencyCollaborationEntryApiSnippets, 'api bindings'),
  ...verify(agencyModuleSource, requiredAgencyCollaborationEntryPageSnippets, 'agency collaboration entry page'),
  ...verify(agencyModuleSource, requiredAgencyAuthorizationEntryPageSnippets, 'agency authorization entry page'),
  ...verify(agencyModuleSource, requiredAgencyServiceContractEntryPageSnippets, 'agency service contract entry page'),
  ...verify(apiSource, requiredAgencyBatchTaskApiSnippets, 'agency batch task api bindings'),
  ...verify(agencyCommandSource, requiredAgencyBatchTaskCommandSnippets, 'agency batch task commands'),
  ...verify(agencyModuleSource, requiredAgencyBatchTaskPageSnippets, 'agency batch task page'),
  ...verify(welcomeSource, requiredWelcomeImportHandoffSnippets, 'welcome company import handoff'),
  ...verify(pageSource, requiredMeasurementUnitEntryPageSnippets, 'measurement unit entry page'),
  ...verify(pageSource, requiredInventoryItemEntryPageSnippets, 'inventory item entry page'),
  ...verify(pageSource, requiredSocialSecurityEntryPageSnippets, 'social security entry page'),
  ...verify(pageSource, requiredInvoiceEntryPageSnippets, 'invoice entry page'),
  ...verify(pageSource, requiredInvoiceEditPageSnippets, 'invoice edit page'),
  ...verify(pageSource, requiredVoucherEntryPageSnippets, 'voucher entry page'),
  ...verify(appSource, requiredAppSnippets, 'application routes'),
  ...verify(shellSource, requiredShellSnippets, 'application shell'),
  ...verify(dashboardSource, requiredDashboardSnippets, 'company dashboard'),
  ...verify(backupCommandSource, requiredBackupCommandSnippets, 'backup commands'),
  ...verify(pageSource, requiredBackupPageSnippets, 'backup module page'),
  ...verify(databaseSource, requiredEmployeeCommandSnippets.slice(0, 1), 'database schema'),
  ...verify(employeeCommandSource, requiredEmployeeCommandSnippets.slice(1), 'employee commands'),
  ...verify(pageSource, requiredEmployeePageSnippets, 'employee module page'),
  ...verify(databaseSource, requiredPayrollCommandSnippets.slice(0, 1), 'database schema'),
  ...verify(payrollCommandSource, requiredPayrollCommandSnippets.slice(1), 'payroll commands'),
  ...verify(pageSource, requiredPayrollPageSnippets, 'payroll module page'),
  ...verify(settlementRuleStoreSource, requiredSettlementRuleEntrySnippets, 'settlement rule store'),
  ...verify(pageSource, requiredSettlementRulePageSnippets, 'settlement rule module page'),
  ...verify(pageSource, requiredCurrencyEntryPageSnippets, 'currency module page'),
  ...verify(templateCommandSource, requiredCommonDigestCommandSnippets, 'common digest commands'),
  ...verify(pageSource, requiredCommonDigestEntryPageSnippets, 'common digest module page'),
  ...verify(templateCommandSource, requiredVoucherTemplateCommandSnippets, 'voucher template commands'),
  ...verify(templateStoreSource, requiredVoucherTemplateEntryStoreSnippets, 'voucher template store'),
  ...verify(pageSource, requiredVoucherTemplateEntryPageSnippets, 'voucher template module page'),
  ...verify(pageSource, requiredAdapterAuthorizationEntryPageSnippets, 'adapter authorization module page'),
  ...verify(readFileSync('src/stores/reportTemplateStore.ts', 'utf8'), requiredReportFormulaEntryStoreSnippets, 'report formula store'),
  ...verify(pageSource, requiredReportFormulaEntryPageSnippets, 'report formula module page'),
  ...verify(auxiliaryStoreSource, requiredAuxiliaryArchiveStoreSnippets, 'auxiliary archive store'),
  ...verify(auxiliaryCommandSource, requiredAuxiliaryArchiveCommandSnippets, 'auxiliary archive commands'),
  ...verify(pageSource, requiredAuxiliaryArchivePageSnippets, 'auxiliary archive module page'),
  ...verify(voucherEntryRowSource, requiredVoucherEntryAuxiliarySnippets, 'voucher entry auxiliary selector'),
  ...verify(databaseSource, [['matching rule schema', 'CREATE TABLE IF NOT EXISTS matching_rules']], 'database schema'),
  ...verify(matchingRuleCommandSource, requiredMatchingRuleCommandSnippets, 'matching rule commands'),
  ...verify(matchingRuleStoreSource, requiredMatchingRuleStoreSnippets, 'matching rule store'),
  ...verify(pageSource, requiredMatchingRulePageSnippets, 'matching rule module page'),
  ...verify(databaseSource, [['asset category schema', 'CREATE TABLE IF NOT EXISTS asset_categories']], 'database schema'),
  ...verify(assetCategoryCommandSource, requiredAssetCategoryCommandSnippets, 'asset category commands'),
  ...verify(assetCategoryStoreSource, requiredAssetCategoryStoreSnippets, 'asset category store'),
  ...verify(pageSource, requiredAssetCategoryPageSnippets, 'asset category module page'),
  ...verify(databaseSource, [['business tag schema', 'CREATE TABLE IF NOT EXISTS business_tags']], 'database schema'),
...verify(databaseSource, [['invoice tag schema', 'CREATE TABLE IF NOT EXISTS invoice_tags']], 'database schema'),
  ...verify(databaseSource, [['voucher tag schema', 'CREATE TABLE IF NOT EXISTS voucher_tags']], 'database schema'),
  ...verify(databaseSource, [['bank transaction tag schema', 'CREATE TABLE IF NOT EXISTS bank_transaction_tags']], 'database schema'),
  ...verify(databaseSource, [['business order schema', 'CREATE TABLE IF NOT EXISTS business_orders']], 'database schema'),
  ...verify(businessTagCommandSource, requiredBusinessTagCommandSnippets, 'business tag commands'),
  ...verify(businessTagStoreSource, requiredBusinessTagStoreSnippets, 'business tag store'),
  ...verify(pageSource, requiredBusinessTagPageSnippets, 'business tag module page'),
  ...verify(businessOrderCommandSource, requiredBusinessOrderCommandSnippets, 'business order commands'),
  ...verify(pageSource, requiredBusinessOrderPageSnippets, 'business order module page'),
  ...verify(databaseSource, [['company account schema', 'CREATE TABLE IF NOT EXISTS company_accounts']], 'database schema'),
  ...verify(companyAccountCommandSource, requiredCompanyAccountCommandSnippets, 'company account commands'),
  ...verify(companyAccountStoreSource, requiredCompanyAccountStoreSnippets, 'company account store'),
  ...verify(pageSource, requiredCompanyAccountPageSnippets, 'company account module page'),
  ...verify(databaseSource, requiredSocialSecurityCommandSnippets.slice(0, 1), 'database schema'),
  ...verify(socialSecurityCommandSource, requiredSocialSecurityCommandSnippets.slice(1), 'social security commands'),
  ...verify(pageSource, requiredSocialSecurityPageSnippets, 'social security module page'),
  ...verify(databaseSource, requiredSpecialDeductionCommandSnippets.slice(0, 1), 'database schema'),
  ...verify(specialDeductionCommandSource, requiredSpecialDeductionCommandSnippets.slice(1), 'special deduction commands'),
  ...verify(pageSource, requiredSpecialDeductionPageSnippets, 'special deduction module page'),
  ...verify(pageSource, requiredWithholdingPageSnippets, 'withholding tax module page'),
  ...verify(pageSource, requiredSocialSecurityTaxPageSnippets, 'social security tax module page'),
  ...verify(pageSource, requiredIncomeTaxPageSnippets, 'income tax module page'),
  ...verify(pageSource, requiredVatTaxPageSnippets, 'vat tax module page'),
  ...verify(databaseSource, requiredBankTransactionCommandSnippets.slice(0, 1), 'database schema'),
  ...verify(bankTransactionCommandSource, requiredBankTransactionCommandSnippets.slice(1), 'bank transaction commands'),
  ...verify(pageSource, requiredBankTransactionPageSnippets, 'bank transaction module page'),
  ...verify(databaseSource, requiredDocumentRecordCommandSnippets.slice(0, 1), 'database schema'),
  ...verify(documentRecordCommandSource, requiredDocumentRecordCommandSnippets.slice(1), 'document record commands'),
  ...verify(pageSource, requiredDocumentRecordPageSnippets, 'document register module page'),
  ...verify(pageSource, requiredExpenseReimbursementPageSnippets, 'expense reimbursement module page'),
  ...verify(pageSource, requiredReceiptPageSnippets, 'receipt module page'),
  ...verify(databaseSource, [['settlement record schema', 'CREATE TABLE IF NOT EXISTS settlement_records']], 'database schema'),
  ...verify(settlementRecordCommandSource, requiredSettlementRecordCommandSnippets, 'settlement record commands'),
  ...verify(databaseSource, [['bank reconciliation schema', 'CREATE TABLE IF NOT EXISTS bank_reconciliation_records']], 'database schema'),
  ...verify(bankReconciliationCommandSource, requiredBankReconciliationCommandSnippets, 'bank reconciliation commands'),
  ...verify(pageSource, requiredReconciliationPageSnippets, 'reconciliation module page'),
  ...verify(databaseSource, requiredAccountTransferPageSnippets.slice(0, 1), 'database schema'),
  ...verify(accountTransferCommandSource, requiredAccountTransferPageSnippets.slice(1, 4), 'account transfer commands'),
  ...verify(pageSource, requiredAccountTransferPageSnippets.slice(4), 'account transfer module page'),
  ...verify(databaseSource, requiredFixedAssetCommandSnippets.slice(0, 1), 'database schema'),
  ...verify(fixedAssetCommandSource, requiredFixedAssetCommandSnippets.slice(1), 'fixed asset commands'),
  ...verify(pageSource, requiredFixedAssetPageSnippets, 'fixed asset module page'),
  ...verify(databaseSource, requiredInventoryMovementCommandSnippets.slice(0, 1), 'database schema'),
  ...verify(inventoryMovementCommandSource, requiredInventoryMovementCommandSnippets.slice(1), 'inventory movement commands'),
  ...verify(pageSource, requiredInventoryMovementPageSnippets, 'inventory movement module page'),
  ...verify(databaseSource, [['cost carryover schema', 'CREATE TABLE IF NOT EXISTS cost_carryover_records']], 'database schema'),
  ...verify(costCarryoverCommandSource, requiredCostCarryoverCommandSnippets, 'cost carryover commands'),
  ...verify(databaseSource, requiredStructuredAiSuggestionSchemaSnippets, 'structured AI suggestion schema'),
  ...verify(automationCommandSource, requiredStructuredAiSuggestionCommandSnippets, 'structured AI suggestion commands'),
  ...verify(databaseSource, requiredAiSuggestionVoucherLinkSchemaSnippets, 'AI suggestion voucher link schema'),
  ...verify(voucherCommandSource, requiredAiSuggestionVoucherLinkCommandSnippets, 'AI suggestion voucher link commands'),
  ...verify(apiSource, requiredStructuredAiSuggestionApiSnippets, 'structured AI suggestion API'),
  ...verify(adapterSource, requiredStructuredAiSuggestionAdapterSnippets, 'structured AI suggestion adapter'),
  ...verify(adapterSource, requiredMultiColumnLedgerAdapterSnippets, 'multi-column ledger adapter'),
  ...verify(adapterSource, requiredIncomeQuarterAdapterSnippets, 'income quarter adapter'),
  ...verify(adapterSource, requiredCashFlowQuarterAdapterSnippets, 'cash flow quarter adapter'),
  ...verify(adapterSource, requiredEquityChangeAdapterSnippets, 'equity change adapter'),
  ...verify(adapterSource, requiredDeclarationCalendarAdapterSnippets, 'declaration calendar adapter'),
  ...verify(databaseSource, requiredDeclarationReceiptSchemaSnippets, 'declaration receipt schema'),
  ...verify(automationCommandSource, requiredDeclarationReceiptCommandSnippets, 'declaration receipt commands'),
  ...verify(adapterSource, requiredNonTaxRevenueAdapterSnippets, 'non-tax revenue adapter'),
  ...verify(databaseSource, requiredStampTaxSchemaSnippets, 'stamp tax schema'),
  ...verify(documentRecordCommandSource, requiredStampTaxCommandSnippets, 'stamp tax document commands'),
  ...verify(periodCommandSource, requiredCashFlowQuarterCommandSnippets, 'cash flow quarter commands'),
  ...verify(pageSource, requiredStructuredAiSuggestionPageSnippets, 'structured AI suggestion module page'),
  ...verify(pageSource, requiredAiSuggestionVoucherLinkPageSnippets, 'AI suggestion voucher link module page'),
  ...verify(voucherCommandSource, requiredAiSuggestionVoucherUnlinkCommandSnippets, 'AI suggestion voucher unlink commands'),
  ...verify(pageSource, requiredAiSuggestionVoucherNavigationPageSnippets, 'AI suggestion voucher navigation module page'),
  ...verify(pageSource, requiredMultiColumnLedgerPageSnippets, 'multi-column ledger module page'),
  ...verify(pageSource, requiredIncomeQuarterPageSnippets, 'income quarter module page'),
  ...verify(pageSource, requiredCashFlowQuarterPageSnippets, 'cash flow quarter module page'),
  ...verify(pageSource, requiredEquityChangePageSnippets, 'equity change module page'),
  ...verify(pageSource, requiredDeclarationCalendarPageSnippets, 'declaration calendar module page'),
  ...verify(pageSource, requiredNonTaxRevenuePageSnippets, 'non-tax revenue module page'),
  ...verify(pageSource, requiredTaxTaskConfirmationPageSnippets, 'local tax task confirmation'),
  ...verify(pageSource, requiredDeclarationReceiptPageSnippets, 'declaration receipt module page'),
  ...verify(pageSource, requiredTaxInitPageSnippets, 'tax initialization module page'),
  ...verify(pageSource, requiredStampTaxPageSnippets, 'stamp tax module page'),
  ...verify(databaseSource, requiredInventoryItemCommandSnippets.slice(0, 1), 'database schema'),
  ...verify(inventoryItemCommandSource, requiredInventoryItemCommandSnippets.slice(1), 'inventory item commands'),
  ...verify(pageSource, requiredInventoryItemPageSnippets, 'inventory item module page'),
  ...verify(databaseSource, requiredUnitCommandSnippets.slice(0, 1), 'database schema'),
  ...verify(unitCommandSource, requiredUnitCommandSnippets.slice(1), 'unit commands'),
  ...verify(pageSource, requiredUnitPageSnippets, 'unit module page'),
]

const agencyPrintButtonCount = (agencyModuleSource.match(/label=\"打印\"/g) ?? []).length
if (agencyPrintButtonCount !== 1) {
  errors.push(`agency module page: expected one print toolbar button, found ${agencyPrintButtonCount}`)
}

if (errors.length > 0) {
  console.error('Live data adapter verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Live data adapter verification passed:')
console.log(JSON.stringify({
  modules: ['outputInvoice', 'inputInvoice', 'voucher', 'riskCheck', 'closingTasks', 'invoiceVoucherMatching', 'ledgerReport', 'accountSummaryReport', 'trialBalanceReport', 'generalLedgerReport', 'subsidiaryLedgerReport', 'auxiliaryLedgerReport', 'auxiliaryBalanceReport', 'balanceSheetReport', 'incomeStatementReport', 'cashFlowReport', 'financialReport', 'companyInfo', 'initialBalance', 'subjectSettings', 'customerArchive', 'supplierArchive', 'otherContactArchive', 'projectArchive', 'departmentArchive', 'periodManagement', 'historyVoucher', 'historyBalance', 'historyGeneralLedger', 'historySubsidiaryLedger', 'settlementRules', 'currencySettings', 'commonDigests', 'voucherTemplateSettings', 'reportFormulaSettings', 'taxAdapterSettings', 'bankAdapterSettings', 'auditLog', 'auxiliaryCategories', 'auxiliaryItems', 'voucherRecycle', 'declarationReceipt', 'taxInit', 'taxReport', 'aiJobQueue', 'aiRecognitionResults', 'aiVoucherSuggestions', 'financeTaxReport'],
  scope: 'selected company and accounting period',
  browserFallback: 'existing mock rows',
}, null, 2))

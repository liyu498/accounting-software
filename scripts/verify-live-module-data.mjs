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
  ['company bank account row mapper', 'export function mapLiveCompanyBankAccountRows'],
  ['company bank account summary mapper', 'export function summarizeLiveCompanyBankAccounts'],
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
  ['company bank account mapping', 'mapLiveCompanyBankAccountRows(selectedCompany)'],
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
  ['import center live rows', "if (kind === 'importCenter' && usesLiveImportData)"],
  ['import center audit fetch', "kind === 'auditLog' || kind === 'exportCenter' || kind === 'importCenter'"],
  ['module import file ref', 'const importFileRef = useRef<HTMLInputElement>(null)'],
  ['module import capability guard', "const supportsFileImport = /导入|采集|上传/.test(config.importLabel)"],
  ['module import file selection', 'importFileRef.current?.click()'],
  ['module import file audit', '`${title}-${file.name}`'],
  ['module import hidden input', 'ref={importFileRef}'],
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
  ['tax workspace table binding', 'visibleDeclarationRows.map((row) =>'],
  ['tax workspace operation audit state', 'const [operationAuditLogs, setOperationAuditLogs] = useState<OperationAuditLog[]>([])'],
  ['tax workspace period scoped audits', 'const scopedOperationAuditLogs = useMemo(() => operationAuditLogs.filter((log) => log.objectRef?.includes(currentPeriod))'],
  ['tax workspace live risk rows', 'const visibleRiskRows = useMemo<RiskRow[]>(() => {'],
  ['tax workspace live rule logs', 'const visibleRuleLogs = useMemo<RuleLog[]>(() => {'],
  ['tax workspace rules log binding', '<TaxRulesLogPanel riskRows={visibleRiskRows} logs={visibleRuleLogs} onRiskLink={handleRiskLink} />'],
  ['tax workspace export binding', 'buildTaxDeclarationPackageHtml(exportedAt, visibleDeclarationRows, taxPackageMetadata, visibleRiskRows, visibleRuleLogs)'],
  ['tax workspace html export audit', "action: '导出申报包'"],
  ['tax workspace pdf export audit', "action: '导出申报包 PDF'"],
  ['tax workspace print export audit', "action: '打印申报包'"],
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
  ['agency fee collection data source', 'agencyApi.getFeeCollections()'],
  ['agency collaboration data source', 'agencyApi.getCollaborationItems()'],
  ['agency fee collection mapper', 'function mapFeeCollectionRow(item: AgencyFeeCollection)'],
  ['agency collaboration mapper', 'function mapCollaborationItemRow(item: AgencyCollaborationItem)'],
  ['agency live tab selection', "activeTab === '收费管理'"],
  ['agency contract archive row mapper', 'function mapAgencyContractArchiveRow(item: AgencyServiceContract)'],
  ['agency contract archive live tab', "activeTab === '归档记录'"],
  ['agency service package row mapper', 'function mapAgencyServicePackageRows(items: AgencyServiceContract[])'],
  ['agency service package live tab', "activeTab === '服务套餐'"],
  ['agency service contract tab consolidation', "tabs: ['服务合同', '收费管理', '客户协同', '服务套餐', '归档记录']"],
  ['agency overview data source', 'agencyApi.getOverview()'],
  ['agency overview state', 'setAgencyOverview(response.data ?? null)'],
  ['agency overview live scope', "kind === 'dataStats'"],
  ['agency overview row mapper', 'function mapAgencyOverviewRows(overview: AgencyOperationOverview, activeTab: string)'],
  ['agency overview summary mapper', 'function summarizeAgencyOverview(overview: AgencyOperationOverview)'],
  ['agency authorization data source', 'agencyApi.getAuthorizations()'],
  ['agency authorization row mapper', 'function mapAgencyAuthorizationRow(item: AdapterAuthorization)'],
  ['agency authorization tab filter', 'function agencyAuthorizationAdapterType(activeTab: string)'],
  ['agency authorization expiry filter', 'function isAuthorizationExpiryReminder(expiresAt: string | null)'],
  ['agency authorization live scope', "kind === 'authorizationCenter'"],
  ['agency batch task data source', 'agencyApi.getBatchTasks()'],
  ['agency batch task create binding', 'agencyApi.createBatchTasks('],
  ['agency batch task row mapper', 'function mapAgencyBatchTaskRow(item: AgencyBatchTask)'],
  ['agency batch task tab filter', 'function filterAgencyBatchTaskRows(rows: AgencyRow[], activeTab: string)'],
  ['agency batch tab consolidation', "tabs: ['操作任务', '批量采集', '批量生成', '批量结账', '批量申报', '申报回执', '审批记录']"],
  ['agency batch task live scope', "kind === 'batchOps'"],
  ['agency health check data source', 'agencyApi.getHealthChecks()'],
  ['agency health check row mapper', 'function mapAgencyHealthCheckRow(item: AgencyHealthCheckItem)'],
  ['agency health check live scope', "kind === 'healthCheck'"],
  ['agency automation data source', 'agencyApi.getAutomationJobs()'],
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
  ['agency batch task period binding', 'agencyApi.createBatchTasks({ period: agencyPeriodLabel, operator: \'admin\' })'],
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
  ['payroll current period filter', 'AND p.period = ?'],
]

const requiredPayrollPageSnippets = [
  ['payroll api list binding', 'payrollApi.getPayrollRecords({ companyId: selectedCompanyId, period: currentPeriodLabel })'],
  ['payroll api create binding', 'payrollApi.createPayrollRecord({'],
  ['payroll row mapper', 'mapLivePayrollRows(payrollRecords)'],
  ['payroll summary mapper', 'summarizeLivePayroll(payrollRecords)'],
]

const requiredSocialSecurityCommandSnippets = [
  ['social security table schema', 'CREATE TABLE IF NOT EXISTS social_security_records'],
  ['social security list command', 'pub async fn get_social_security_records'],
  ['social security create command', 'pub async fn create_social_security_record'],
]

const requiredSocialSecurityPageSnippets = [
  ['social security api list binding', 'socialSecurityApi.getSocialSecurityRecords({ companyId: selectedCompanyId, period: currentPeriodLabel })'],
  ['social security api create binding', 'socialSecurityApi.createSocialSecurityRecord({'],
  ['social security row mapper', 'mapLiveSocialSecurityRows(socialSecurityRecords)'],
]

const requiredSpecialDeductionCommandSnippets = [
  ['special deduction table schema', 'CREATE TABLE IF NOT EXISTS special_deduction_records'],
  ['special deduction list command', 'pub async fn get_special_deduction_records'],
  ['special deduction create command', 'pub async fn create_special_deduction_record'],
]

const requiredSpecialDeductionPageSnippets = [
  ['special deduction api list binding', 'specialDeductionApi.getSpecialDeductionRecords({ companyId: selectedCompanyId, period: currentPeriodLabel })'],
  ['special deduction api create binding', 'specialDeductionApi.createSpecialDeductionRecord({'],
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
  ['income tax report loader', "if (kind === 'incomeStatementReport' || kind === 'incomeTaxReport')"],
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
]

const requiredBankTransactionPageSnippets = [
  ['bank transaction api list binding', 'bankTransactionApi.getBankTransactions({ companyId: selectedCompanyId, period: currentPeriodLabel })'],
  ['bank transaction api create binding', 'bankTransactionApi.createBankTransaction({'],
  ['bank transaction row mapper', 'mapLiveBankTransactionRows(bankTransactions, kind)'],
]

const requiredDocumentRecordCommandSnippets = [
  ['document record table schema', 'CREATE TABLE IF NOT EXISTS document_records'],
  ['document record list command', 'pub async fn get_document_records'],
  ['document record create command', 'pub async fn create_document_record'],
]

const requiredDocumentRecordPageSnippets = [
  ['document record api list binding', 'documentRecordApi.getDocumentRecords({ companyId: selectedCompanyId, period: currentPeriodLabel })'],
  ['document record api create binding', 'documentRecordApi.createDocumentRecord({'],
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
  ['bank reconciliation local scope', "const usesLiveReconciliationData = Boolean(isTauri && selectedCompanyId && ['bankReconciliation', 'receivableSettlement', 'payableSettlement', 'receivablePayableAging'].includes(kind))"],
  ['bank reconciliation row mapper', 'mapLiveBankReconciliationRows(bankTransactions)'],
  ['receivable settlement row mapper', 'mapLiveSettlementRows(invoices, \'output\')'],
  ['payable settlement row mapper', 'mapLiveSettlementRows(invoices, \'input\')'],
  ['aging row mapper', 'mapLiveAgingRows(invoices)'],
]

const requiredOrderViewPageSnippets = [
  ['purchase management invoice source', "const usesLivePurchaseManagementData = Boolean(isTauri && selectedCompanyId && kind === 'purchaseManagement')"],
  ['sales management invoice source', "const usesLiveSalesManagementData = Boolean(isTauri && selectedCompanyId && kind === 'salesManagement')"],
  ['purchase order row mapper', "mapLivePurchaseManagementRows(invoices)"],
  ['sales order row mapper', "mapLiveSalesManagementRows(invoices)"],
]

const requiredAccountTransferPageSnippets = [
  ['account transfer table schema', 'CREATE TABLE IF NOT EXISTS account_transfers'],
  ['account transfer list command', 'pub async fn get_account_transfers'],
  ['account transfer create command', 'pub async fn create_account_transfer'],
  ['account transfer api list binding', 'accountTransferApi.getAccountTransfers({ companyId: selectedCompanyId, period: currentPeriodLabel })'],
  ['account transfer api create binding', 'accountTransferApi.createAccountTransfer({'],
  ['account transfer row mapper', 'mapLiveAccountTransferRows(accountTransfers)'],
]

const requiredFixedAssetCommandSnippets = [
  ['fixed asset table schema', 'CREATE TABLE IF NOT EXISTS fixed_assets'],
  ['fixed asset list command', 'pub async fn get_fixed_assets'],
  ['fixed asset create command', 'pub async fn create_fixed_asset'],
]

const requiredFixedAssetPageSnippets = [
  ['fixed asset api list binding', 'fixedAssetApi.getFixedAssets({ companyId: selectedCompanyId, period: currentPeriodLabel })'],
  ['fixed asset api create binding', 'fixedAssetApi.createFixedAsset({'],
  ['fixed asset row mapper', 'mapLiveFixedAssetRows(fixedAssets)'],
]

const requiredInventoryMovementCommandSnippets = [
  ['inventory movement table schema', 'CREATE TABLE IF NOT EXISTS inventory_movements'],
  ['inventory movement list command', 'pub async fn get_inventory_movements'],
  ['inventory movement create command', 'pub async fn create_inventory_movement'],
]

const requiredInventoryMovementPageSnippets = [
  ['inventory movement api list binding', 'inventoryMovementApi.getInventoryMovements({ companyId: selectedCompanyId, period: currentPeriodLabel })'],
  ['inventory movement api create binding', 'inventoryMovementApi.createInventoryMovement({'],
  ['inventory movement row mapper', 'mapLiveInventoryMovementRows(inventoryMovements)'],
  ['cost carryover local source', 'mapLiveCostCarryoverRows(inventoryMovements)'],
]

const requiredInventoryItemCommandSnippets = [
  ['inventory item table schema', 'CREATE TABLE IF NOT EXISTS inventory_items'],
  ['inventory item list command', 'pub async fn get_inventory_items'],
  ['inventory item create command', 'pub async fn create_inventory_item'],
]

const requiredInventoryItemPageSnippets = [
  ['inventory item api list binding', 'inventoryItemApi.getInventoryItems({ companyId: selectedCompanyId })'],
  ['inventory item api create binding', 'inventoryItemApi.createInventoryItem({'],
  ['inventory item row mapper', 'mapLiveInventoryItemRows(inventoryItems)'],
]

const requiredUnitCommandSnippets = [
  ['unit table schema', 'CREATE TABLE IF NOT EXISTS measurement_units'],
  ['unit list command', 'pub async fn get_measurement_units'],
  ['unit create command', 'pub async fn create_measurement_unit'],
]

const requiredUnitPageSnippets = [
  ['unit api list binding', 'measurementUnitApi.getMeasurementUnits({ companyId: selectedCompanyId })'],
  ['unit api create binding', 'measurementUnitApi.createMeasurementUnit({'],
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
  ...verify(pageSource, requiredReconciliationPageSnippets, 'reconciliation module page'),
  ...verify(pageSource, requiredOrderViewPageSnippets, 'purchase and sales module pages'),
  ...verify(databaseSource, requiredAccountTransferPageSnippets.slice(0, 1), 'database schema'),
  ...verify(accountTransferCommandSource, requiredAccountTransferPageSnippets.slice(1, 3), 'account transfer commands'),
  ...verify(pageSource, requiredAccountTransferPageSnippets.slice(3), 'account transfer module page'),
  ...verify(databaseSource, requiredFixedAssetCommandSnippets.slice(0, 1), 'database schema'),
  ...verify(fixedAssetCommandSource, requiredFixedAssetCommandSnippets.slice(1), 'fixed asset commands'),
  ...verify(pageSource, requiredFixedAssetPageSnippets, 'fixed asset module page'),
  ...verify(databaseSource, requiredInventoryMovementCommandSnippets.slice(0, 1), 'database schema'),
  ...verify(inventoryMovementCommandSource, requiredInventoryMovementCommandSnippets.slice(1), 'inventory movement commands'),
  ...verify(pageSource, requiredInventoryMovementPageSnippets, 'inventory movement module page'),
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

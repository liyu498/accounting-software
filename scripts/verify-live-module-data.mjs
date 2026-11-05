import { existsSync, readFileSync, readdirSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8");

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx|js|jsx)$/.test(entry.name) ? [path] : [];
  });
}

const appSource = read("src/App.tsx");
const registrySource = read("src/pages/operations/businessModuleRegistry.ts");
const rustEntrySource = read("src-tauri/src/lib.rs");

const companyAccountWorkspaceSource = existsSync(
  "src/pages/operations/CompanyAccountWorkspace.tsx",
)
  ? read("src/pages/operations/CompanyAccountWorkspace.tsx")
  : "";
const contractLedgerWorkspaceSource = existsSync(
  "src/pages/operations/ContractLedgerWorkspace.tsx",
)
  ? read("src/pages/operations/ContractLedgerWorkspace.tsx")
  : "";
const businessTagWorkspaceSource = existsSync(
  "src/pages/operations/BusinessTagWorkspace.tsx",
)
  ? read("src/pages/operations/BusinessTagWorkspace.tsx")
  : "";
const voucherRecycleWorkspaceSource = existsSync(
  "src/pages/operations/VoucherRecycleWorkspace.tsx",
)
  ? read("src/pages/operations/VoucherRecycleWorkspace.tsx")
  : "";
const companyInfoWorkspaceSource = existsSync(
  "src/pages/operations/CompanyInfoWorkspace.tsx",
)
  ? read("src/pages/operations/CompanyInfoWorkspace.tsx")
  : "";
const auditLogWorkspaceSource = existsSync(
  "src/pages/operations/AuditLogWorkspace.tsx",
)
  ? read("src/pages/operations/AuditLogWorkspace.tsx")
  : "";
const backupRestoreWorkspaceSource = existsSync(
  "src/pages/operations/BackupRestoreWorkspace.tsx",
)
  ? read("src/pages/operations/BackupRestoreWorkspace.tsx")
  : "";
const printTemplateWorkspaceSource = existsSync(
  "src/pages/operations/PrintTemplateWorkspace.tsx",
)
  ? read("src/pages/operations/PrintTemplateWorkspace.tsx")
  : "";
const voucherWorkspaceSource = existsSync(
  "src/pages/operations/VoucherWorkspace.tsx",
)
  ? read("src/pages/operations/VoucherWorkspace.tsx")
  : "";
const voucherDetailWorkspaceSource = existsSync(
  "src/pages/operations/VoucherDetailWorkspace.tsx",
)
  ? read("src/pages/operations/VoucherDetailWorkspace.tsx")
  : "";
const riskCheckWorkspaceSource = existsSync(
  "src/pages/operations/RiskCheckWorkspace.tsx",
)
  ? read("src/pages/operations/RiskCheckWorkspace.tsx")
  : "";
const invoiceVoucherMatchingWorkspaceSource = existsSync(
  "src/pages/operations/InvoiceVoucherMatchingWorkspace.tsx",
)
  ? read("src/pages/operations/InvoiceVoucherMatchingWorkspace.tsx")
  : "";
const agingWorkspaceSource = existsSync(
  "src/pages/operations/AgingWorkspace.tsx",
)
  ? read("src/pages/operations/AgingWorkspace.tsx")
  : "";
const counterpartyReportWorkspaceSource = existsSync(
  "src/pages/operations/CounterpartyReportWorkspace.tsx",
)
  ? read("src/pages/operations/CounterpartyReportWorkspace.tsx")
  : "";
const operatingAnalysisWorkspaceSource = existsSync(
  "src/pages/operations/OperatingAnalysisWorkspace.tsx",
)
  ? read("src/pages/operations/OperatingAnalysisWorkspace.tsx")
  : "";
const ledgerReportWorkspaceSource = existsSync(
  "src/pages/operations/LedgerReportWorkspace.tsx",
)
  ? read("src/pages/operations/LedgerReportWorkspace.tsx")
  : "";
const ledgerDetailWorkspaceSource = existsSync(
  "src/pages/operations/LedgerDetailWorkspace.tsx",
)
  ? read("src/pages/operations/LedgerDetailWorkspace.tsx")
  : "";
const financialStatementWorkspaceSource = existsSync(
  "src/pages/operations/FinancialStatementWorkspace.tsx",
)
  ? read("src/pages/operations/FinancialStatementWorkspace.tsx")
  : "";
const closingTasksWorkspaceSource = existsSync(
  "src/pages/operations/ClosingTasksWorkspace.tsx",
)
  ? read("src/pages/operations/ClosingTasksWorkspace.tsx")
  : "";
const declarationCalendarWorkspaceSource = existsSync(
  "src/pages/tax/DeclarationCalendarWorkspace.tsx",
)
  ? read("src/pages/tax/DeclarationCalendarWorkspace.tsx")
  : "";
const taxReportWorkspaceSource = existsSync(
  "src/pages/tax/TaxReportWorkspace.tsx",
)
  ? read("src/pages/tax/TaxReportWorkspace.tsx")
  : "";
const aiOperationsWorkspaceSource = existsSync(
  "src/pages/operations/AiOperationsWorkspace.tsx",
)
  ? read("src/pages/operations/AiOperationsWorkspace.tsx")
  : "";
const fileCenterWorkspaceSource = existsSync(
  "src/pages/operations/FileCenterWorkspace.tsx",
)
  ? read("src/pages/operations/FileCenterWorkspace.tsx")
  : "";
const documentBusinessWorkspaceSource = existsSync(
  "src/pages/operations/DocumentBusinessWorkspace.tsx",
)
  ? read("src/pages/operations/DocumentBusinessWorkspace.tsx")
  : "";
const billListWorkspaceSource = existsSync(
  "src/pages/operations/BillListWorkspace.tsx",
)
  ? read("src/pages/operations/BillListWorkspace.tsx")
  : "";
const initializationWorkspaceSource = existsSync(
  "src/pages/operations/InitializationWorkspace.tsx",
)
  ? read("src/pages/operations/InitializationWorkspace.tsx")
  : "";
const historyMigrationWorkspaceSource = existsSync(
  "src/pages/operations/HistoryMigrationWorkspace.tsx",
)
  ? read("src/pages/operations/HistoryMigrationWorkspace.tsx")
  : "";
const voucherEntryWorkspaceSource = existsSync(
  "src/pages/operations/VoucherEntryWorkspace.tsx",
)
  ? read("src/pages/operations/VoucherEntryWorkspace.tsx")
  : "";
const systemHubWorkspaceSource = existsSync(
  "src/pages/operations/SystemHubWorkspace.tsx",
)
  ? read("src/pages/operations/SystemHubWorkspace.tsx")
  : "";

const requiredCompanyAccountWorkspaceSnippets = [
  ["store binding", "from '../../stores/companyAccountStore'"],
  ["list refresh", "fetchCompanyAccounts(companyId)"],
  ["create action", "createCompanyAccount(input)"],
  ["update action", "updateCompanyAccount(editorAccount.id, input)"],
  [
    "preview persistence",
    "const previewStorageKey = 'accounting-preview-company-accounts-v2'",
  ],
];
const requiredContractLedgerWorkspaceSnippets = [
  [
    "list refresh",
    "documentRecordApi.getDocumentRecords({ companyId, period })",
  ],
  ["create action", "documentRecordApi.createDocumentRecord(input)"],
  [
    "update action",
    "documentRecordApi.updateDocumentRecord({ ...input, id: editingRecord.id })",
  ],
  ["workflow boundary", "合同台账不替代合同审批或税务申报确认"],
];
const requiredBusinessTagWorkspaceSnippets = [
  ["store binding", "from '../../stores/businessTagStore'"],
  ["list refresh", "fetchBusinessTags(companyId)"],
  ["create action", "createBusinessTag(input)"],
  ["update action", "updateBusinessTag(editorTag.id, input)"],
  [
    "preview persistence",
    'from "../../lib/browserPreviewBusinessTags.js"',
  ],
];
const requiredVoucherRecycleWorkspaceSnippets = [
  ["list refresh", "getDeletedVouchers(companyId)"],
  ["restore action", "restoreVoucher(voucher.id, companyId)"],
  ["shared store error surface", "storeError &&"],
];
const requiredCompanyInfoWorkspaceSnippets = [
  ["company refresh", "fetchCompanies()"],
  ["company update", "updateCompany(selectedCompanyId, input)"],
  ["credential boundary", "不会保存税局、个税或工商密码"],
];
const requiredAuditLogWorkspaceSnippets = [
  ["audit query", "automationApi.getOperationAuditLogs"],
  ["company scope", "companyId: selectedCompanyId"],
  ["immutable boundary", "不提供新增、修改、删除或覆盖历史记录"],
];
const requiredBackupRestoreWorkspaceSnippets = [
  ["backup list", "backupApi.listLocalBackups"],
  ["backup create", "backupApi.createLocalBackup"],
  ["backup verify", "backupApi.verifyLocalBackup"],
  ["restore scheduling", "backupApi.scheduleLocalBackupRestore"],
  ["restart-safe boundary", "下次启动、数据库连接建立前"],
];
const requiredPrintTemplateWorkspaceSnippets = [
  ["controlled source", "fixedPrintTemplatePreviews"],
  ["release boundary", "随应用版本受控发布"],
];
const requiredVoucherWorkspaceSnippets = [
  [
    "scoped query",
    "queryVouchers({ company_id: companyId, period_id: periodId",
  ],
  ["approval action", "approveVoucher(voucher.id, companyId)"],
  ["batch approval", "batchApprove(selectedIds, companyId)"],
  ["closed period boundary", "已结账账期不允许反审核"],
];
const requiredVoucherDetailWorkspaceSnippets = [
  ["voucher lookup", "getVoucher(voucherId, companyId)"],
  ["entry lookup", "getVoucherEntries(nextVoucher.id)"],
  ["log lookup", "getVoucherLogs(nextVoucher.id)"],
];
const requiredRiskCheckWorkspaceSnippets = [
  [
    "invoice query",
    "fetchInvoices({ company_id: companyId, period_id: periodId })",
  ],
  [
    "voucher query",
    "queryVouchers({ company_id: companyId, period_id: periodId, page: 1, page_size: 100 })",
  ],
  ["risk mapper", "mapLiveRiskCheckRows(vouchers, invoices)"],
  ["write boundary", "风险页不会直接改写会计数据"],
];
const requiredInvoiceVoucherMatchingWorkspaceSnippets = [
  [
    "invoice query",
    "fetchInvoices({ company_id: companyId, period_id: periodId })",
  ],
  [
    "voucher query",
    "queryVouchers({ company_id: companyId, period_id: periodId, page: 1, page_size: 100 })",
  ],
  [
    "matching action",
    "matchInvoiceToVoucher(selectedInvoiceId, selectedVoucherId, companyId)",
  ],
];
const requiredAgingWorkspaceSnippets = [
  [
    "receivable query",
    "settlementRecordApi.getSettlementRecords({ companyId, period: periodLabel, settlementType: 'receivable' })",
  ],
  [
    "payable query",
    "settlementRecordApi.getSettlementRecords({ companyId, period: periodLabel, settlementType: 'payable' })",
  ],
];
const requiredCounterpartyReportWorkspaceSnippets = [
  ["settlement query", "settlementRecordApi.getSettlementRecords({ companyId, period: periodLabel, settlementType: mode })"],
  ["summary workflow", "buildCounterpartySummary(records, mode)"],
  ["detail workflow", "buildCounterpartyDetail(records, mode)"],
  ["read-only boundary", "报表页不直接修改业务记录"],
];
const requiredOperatingAnalysisWorkspaceSnippets = [
  ["balance sheet query", "getBalanceSheet(periodId)"],
  ["income statement query", "getIncomeStatement(periodId)"],
  ["status analysis", "buildOperatingStatus(balanceSheet)"],
  ["performance analysis", "buildOperatingPerformance(incomeStatement)"],
  ["read-only boundary", "如需修正，请回到凭证或报表公式处理"],
];
const requiredLedgerReportWorkspaceSnippets = [
  ["trial balance query", "fetchTrialBalance(periodId)"],
  ["general ledger query", "getGeneralLedger(periodId)"],
  ["read-only boundary", "账簿页仅查询当前账套与账期"],
];
const requiredLedgerDetailWorkspaceSnippets = [
  [
    "subsidiary ledger query",
    "getSubsidiaryLedger(periodId, selectedAccountCode)",
  ],
  [
    "auxiliary ledger query",
    "fetchAuxiliaryLedger({ auxiliary_item_id: selectedItemId, company_id: selectedCompanyId, period_id: periodId })",
  ],
  [
    "auxiliary balance query",
    "fetchAuxiliaryBalance(selectedCategoryId, periodId, selectedCompanyId)",
  ],
];
const requiredFinancialStatementWorkspaceSnippets = [
  ["balance sheet query", "getBalanceSheet(periodId)"],
  ["quarter period scope", "quarterPeriods(periods, periodId)"],
  ["income statement query", "incomePeriodIds.map((id) => getIncomeStatement(id))"],
  ["cash flow query", "cashFlowPeriodIds.map((id) => getCashFlowStatement(id))"],
  ["quarter income aggregation", "aggregateIncomeQuarter(nextIncomeStatements)"],
  ["quarter cash flow aggregation", "aggregateCashFlowQuarter(nextCashFlowStatements)"],
  ["read-only boundary", "报表页仅查询当前账套与账期"],
];
const requiredClosingTasksWorkspaceSnippets = [
  [
    "voucher query",
    "queryVouchers({ company_id: companyId, period_id: periodId",
  ],
  ["trial balance query", "fetchTrialBalance(periodId)"],
  ["balance sheet query", "getBalanceSheet(periodId)"],
  ["close action", "closePeriod(periodId)"],
  ["controlled boundary", "不会自动结账"],
];
const requiredDeclarationCalendarWorkspaceSnippets = [
  ["task query", "automationApi.getTaxDeclarationTasks"],
  ["browser period", "loadBrowserPreviewOpenPeriod"],
  ["external boundary", "不会登录税局、提交申报或发起扣款"],
];
const requiredTaxReportWorkspaceSnippets = [
  [
    "task query",
    "automationApi.getTaxDeclarationTasks({ companyId: selectedCompanyId, period: periodLabel })",
  ],
  ["confirmation action", "automationApi.confirmTaxDeclarationTask"],
  ["external boundary", "不会向电子税务局提交申报或发起扣款"],
];
const requiredAiOperationsWorkspaceSnippets = [
  [
    "job query",
    "automationApi.getAutomationJobs({ companyId: selectedCompanyId, period: periodLabel })",
  ],
  ["job create", "automationApi.createAutomationJob({"],
  ["review action", "automationApi.updateAutomationJobStatus({"],
  ["provider query", "automationApi.getAiProviderConfigs({"],
  ["provider configuration", "automationApi.upsertAiProviderConfig({"],
  ["recognition execution", "automationApi.runAiRecognitionJob({"],
  ["training rule store", "useMatchingRuleStore"],
  ["credential boundary", "凭据不写入数据库"],
  ["disclosure boundary", "用户逐次确认后发送所选文件"],
  ["posting boundary", "不会自动生成或入账凭证"],
];
const requiredFileCenterWorkspaceSnippets = [
  ["attachment registration", "recordLocalAttachment"],
  ["attachment association", "updateLocalAttachmentAssociation"],
  ["import registration", "recordLocalImportJob"],
  ["download jobs", "useExportJobs"],
  ["audit records", "useAuditLogs"],
  ["upload boundary", "文件不会被静默上传或替换"],
];
const requiredDocumentBusinessWorkspaceSnippets = [
  [
    "document query",
    "documentRecordApi.getDocumentRecords({ companyId, period })",
  ],
  ["document create", "documentRecordApi.createDocumentRecord(input)"],
  [
    "document update",
    "documentRecordApi.updateDocumentRecord({ ...input, id: editingRecord.id })",
  ],
  ["posting boundary", "不自动生成或过账凭证"],
];
const requiredBillListWorkspaceSnippets = [
  [
    "bill query",
    "bankTransactionApi.getBankTransactions({ companyId, period })",
  ],
  [
    "bill create",
    "bankTransactionApi.createBankTransaction({ ...input, period })",
  ],
  [
    "bill update",
    "bankTransactionApi.updateBankTransaction({ ...input, id: editingRecord.id })",
  ],
  ["bank boundary", "不登录银行、不下载回单、不自动生成或过账凭证"],
];
const requiredInitializationWorkspaceSnippets = [
  ["initial balance save", "saveInitialBalance({ period_id: periodId"],
  ["initial balance validation", "validateInitialBalances(periodId)"],
  ["initial balance finalize", "finalizeInitialBalances(periodId)"],
  [
    "tax task query",
    "automationApi.getTaxDeclarationTasks({ companyId, period: periodLabel })",
  ],
  ["tax task save", "automationApi.upsertTaxDeclarationTask({"],
];
const requiredHistoryMigrationWorkspaceSnippets = [
  [
    "voucher query",
    "queryVouchers({ company_id: selectedCompanyId, period_id: currentPeriodId",
  ],
  ["trial balance query", "fetchTrialBalance(currentPeriodId)"],
  ["general ledger query", "getGeneralLedger(currentPeriodId)"],
  [
    "subsidiary ledger query",
    "getSubsidiaryLedger(currentPeriodId, fallbackAccountCode)",
  ],
  ["overwrite boundary", "不会覆盖当前账期"],
];
const requiredVoucherEntryWorkspaceSnippets = [
  [
    "scoped voucher number",
    "getNextVoucherNumber(currentPeriodId, selectedCompanyId)",
  ],
  ["voucher lookup", "getVoucher(id, selectedCompanyId)"],
  ["voucher create", "addVoucher({ company_id: selectedCompanyId"],
  ["voucher update", "updateVoucher({ id: loadedVoucher.id"],
  ["posting boundary", "不会自动审核、过账或修改已结账账期凭证"],
];
const requiredSystemHubWorkspaceSnippets = [
  [
    "todo query",
    "companyTodoApi.getAll({ companyId, period: currentPeriodLabel })",
  ],
  ["todo create", "companyTodoApi.create({"],
  ["todo complete", "companyTodoApi.complete({ id: todo.id, companyId })"],
  ["message boundary", "不会发送短信、邮件或外部消息"],
  ["template query", "fetchReportTemplateWorkspace(companyId)"],
];

const dedicatedRouteBindings = [
  ["accountArchive", "CompanyAccountWorkspace"],
  ["contractLedger", "ContractLedgerWorkspace"],
  ["tagArchive", "BusinessTagWorkspace"],
  ["receivableSummaryReport", "ReceivableSummaryWorkspace"],
  ["receivableDetailReport", "ReceivableDetailWorkspace"],
  ["payableSummaryReport", "PayableSummaryWorkspace"],
  ["payableDetailReport", "PayableDetailWorkspace"],
  ["operatingStatusReport", "OperatingStatusWorkspace"],
  ["operatingPerformanceReport", "OperatingPerformanceWorkspace"],
];

const dedicatedChecks = [
  [
    "company account workspace",
    companyAccountWorkspaceSource,
    requiredCompanyAccountWorkspaceSnippets,
  ],
  [
    "contract ledger workspace",
    contractLedgerWorkspaceSource,
    requiredContractLedgerWorkspaceSnippets,
  ],
  [
    "business tag workspace",
    businessTagWorkspaceSource,
    requiredBusinessTagWorkspaceSnippets,
  ],
  [
    "voucher recycle workspace",
    voucherRecycleWorkspaceSource,
    requiredVoucherRecycleWorkspaceSnippets,
  ],
  [
    "company information workspace",
    companyInfoWorkspaceSource,
    requiredCompanyInfoWorkspaceSnippets,
  ],
  [
    "audit log workspace",
    auditLogWorkspaceSource,
    requiredAuditLogWorkspaceSnippets,
  ],
  [
    "backup restoration workspace",
    backupRestoreWorkspaceSource,
    requiredBackupRestoreWorkspaceSnippets,
  ],
  [
    "print template workspace",
    printTemplateWorkspaceSource,
    requiredPrintTemplateWorkspaceSnippets,
  ],
  [
    "voucher workspace",
    voucherWorkspaceSource,
    requiredVoucherWorkspaceSnippets,
  ],
  [
    "voucher detail workspace",
    voucherDetailWorkspaceSource,
    requiredVoucherDetailWorkspaceSnippets,
  ],
  [
    "risk check workspace",
    riskCheckWorkspaceSource,
    requiredRiskCheckWorkspaceSnippets,
  ],
  [
    "invoice voucher matching workspace",
    invoiceVoucherMatchingWorkspaceSource,
    requiredInvoiceVoucherMatchingWorkspaceSnippets,
  ],
  ["aging workspace", agingWorkspaceSource, requiredAgingWorkspaceSnippets],
  ["counterparty report workspace", counterpartyReportWorkspaceSource, requiredCounterpartyReportWorkspaceSnippets],
  ["operating analysis workspace", operatingAnalysisWorkspaceSource, requiredOperatingAnalysisWorkspaceSnippets],
  [
    "ledger report workspace",
    ledgerReportWorkspaceSource,
    requiredLedgerReportWorkspaceSnippets,
  ],
  [
    "ledger detail workspace",
    ledgerDetailWorkspaceSource,
    requiredLedgerDetailWorkspaceSnippets,
  ],
  [
    "financial statement workspace",
    financialStatementWorkspaceSource,
    requiredFinancialStatementWorkspaceSnippets,
  ],
  [
    "closing tasks workspace",
    closingTasksWorkspaceSource,
    requiredClosingTasksWorkspaceSnippets,
  ],
  [
    "declaration calendar workspace",
    declarationCalendarWorkspaceSource,
    requiredDeclarationCalendarWorkspaceSnippets,
  ],
  [
    "tax report workspace",
    taxReportWorkspaceSource,
    requiredTaxReportWorkspaceSnippets,
  ],
  [
    "AI operations workspace",
    aiOperationsWorkspaceSource,
    requiredAiOperationsWorkspaceSnippets,
  ],
  [
    "file center workspace",
    fileCenterWorkspaceSource,
    requiredFileCenterWorkspaceSnippets,
  ],
  [
    "document business workspace",
    documentBusinessWorkspaceSource,
    requiredDocumentBusinessWorkspaceSnippets,
  ],
  [
    "bill list workspace",
    billListWorkspaceSource,
    requiredBillListWorkspaceSnippets,
  ],
  [
    "initialization workspace",
    initializationWorkspaceSource,
    requiredInitializationWorkspaceSnippets,
  ],
  [
    "history migration workspace",
    historyMigrationWorkspaceSource,
    requiredHistoryMigrationWorkspaceSnippets,
  ],
  [
    "voucher entry workspace",
    voucherEntryWorkspaceSource,
    requiredVoucherEntryWorkspaceSnippets,
  ],
  [
    "system hub workspace",
    systemHubWorkspaceSource,
    requiredSystemHubWorkspaceSnippets,
  ],
];

function normalizeContractSource(value) {
  return value
    .replace(/["']/g, "'")
    .replace(/\s+/g, "")
    .replace(/,([}\]])/g, "$1")
    .replace(/,\)/g, ")");
}

function includesContract(source, contract) {
  return normalizeContractSource(source).includes(
    normalizeContractSource(contract),
  );
}

function verifySnippets(label, source, requirements) {
  if (!source) return [`${label}: source file is missing`];
  return requirements
    .filter(([, snippet]) => !includesContract(source, snippet))
    .map(([name, snippet]) => `${label}: ${name} missing snippet: ${snippet}`);
}

function modulePath(importPath) {
  return importPath.startsWith("./") ? `src/${importPath.slice(2)}.tsx` : "";
}

const lazyWorkspaceFiles = [
  ...new Set(
    [
      ...appSource.matchAll(
        /const\s+\w+\s*=\s*lazy\(\(\)\s*=>\s*import\(['"]([^'"]+)['"]/gs,
      ),
    ]
      .map((match) => modulePath(match[1]))
      .filter((file) => /^src\/pages\/(operations|tax|agency)\//.test(file)),
  ),
].sort();

const delegatedWorkspaceImports = new Map([
  [
    "src/pages/operations/PayableSettlementWorkspace.tsx",
    "from './SettlementWorkspace'",
  ],
  [
    "src/pages/operations/ReceivableSettlementWorkspace.tsx",
    "from './SettlementWorkspace'",
  ],
  [
    "src/pages/operations/PurchaseManagementWorkspace.tsx",
    "from './BusinessOrderWorkspace'",
  ],
  [
    "src/pages/operations/SalesManagementWorkspace.tsx",
    "from './BusinessOrderWorkspace'",
  ],
]);
const fixedReferenceWorkspaces = new Map([
  [
    "src/pages/operations/PrintTemplateWorkspace.tsx",
    "fixedPrintTemplatePreviews",
  ],
]);
const liveBindingMarkers = [
  "from '../../lib/api'",
  "from '../../stores/",
  "window.localStorage",
  "recordLocalAttachment",
  "recordLocalImportJob",
  "loadBrowserPreviewOpenPeriod",
];

const workspaceBindingErrors = lazyWorkspaceFiles.flatMap((file) => {
  if (!existsSync(file)) return [`routed workspace source is missing: ${file}`];
  const source = read(file);
  const delegatedImport = delegatedWorkspaceImports.get(file);
  if (delegatedImport)
    return includesContract(source, delegatedImport)
      ? []
      : [`${file}: delegated live workspace import is missing`];
  const fixedReference = fixedReferenceWorkspaces.get(file);
  if (fixedReference)
    return includesContract(source, fixedReference)
      ? []
      : [`${file}: controlled reference data source is missing`];
  return liveBindingMarkers.some((marker) => includesContract(source, marker))
    ? []
    : [
        `${file}: no API, store, persistent preview, or local file registry binding found`,
      ];
});

const invokeSources = sourceFiles("src").map(read);
const invokedCommands = [
  ...new Set(
    invokeSources.flatMap((source) =>
      [...source.matchAll(/invoke[^\(]*\(\s*['"]([^'"]+)['"]/g)].map(
        (match) => match[1],
      ),
    ),
  ),
].sort();
const handlerBlock =
  rustEntrySource.match(/generate_handler!\s*\[([\s\S]*?)\]\);/)?.[1] || "";
const registeredCommands = new Set(
  [...handlerBlock.matchAll(/commands::[\w:]+::(\w+)/g)].map(
    (match) => match[1],
  ),
);
const commandAttributePattern =
  /#\[tauri::command\]\s*(?:(?:\/\/\/[^\n]*|#\[[^\]\n]+\])\s*)*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+([A-Za-z_]\w*)/g;
const attributedCommands = new Set(
  readdirSync("src-tauri/src/commands")
    .filter((file) => file.endsWith(".rs"))
    .flatMap((file) => [
      ...read(`src-tauri/src/commands/${file}`).matchAll(commandAttributePattern),
    ])
    .map((match) => match[1]),
);
const unregisteredCommands = invokedCommands.filter(
  (command) => !registeredCommands.has(command),
);
const uninvokedRegisteredCommands = [...registeredCommands]
  .filter((command) => !invokedCommands.includes(command))
  .sort();
const unregisteredCommandAnnotations = [...attributedCommands]
  .filter((command) => !registeredCommands.has(command))
  .sort();
const registeredCommandsWithoutAnnotations = [...registeredCommands]
  .filter((command) => !attributedCommands.has(command))
  .sort();

const errors = [
  ...(existsSync("src/pages/operations/BusinessModulePage.tsx")
    ? ["retired generic BusinessModulePage.tsx still exists"]
    : []),
  ...(appSource.includes("BusinessModulePage")
    ? ["application still references the retired generic business page"]
    : []),
  ...(lazyWorkspaceFiles.length !== 63
    ? [
        `routed operational workspace file count must remain 63, received ${lazyWorkspaceFiles.length}`,
      ]
    : []),
  ...(invokedCommands.length < 200
    ? [
        `front-end command coverage unexpectedly dropped to ${invokedCommands.length}`,
      ]
    : []),
  ...dedicatedChecks.flatMap(([label, source, requirements]) =>
    verifySnippets(label, source, requirements),
  ),
  ...dedicatedRouteBindings.flatMap(([kind, component]) => [
    ...(registrySource.includes(`'${kind}',`)
      ? []
      : [`business module kind is missing: ${kind}`]),
    ...(appSource.includes(`<${component} />`)
      ? []
      : [`dedicated route component is missing: ${component}`]),
  ]),
  ...workspaceBindingErrors,
  ...unregisteredCommands.map(
    (command) =>
      `front-end invoke command is not registered in Rust: ${command}`,
  ),
  ...uninvokedRegisteredCommands.map(
    (command) =>
      `registered Rust command is not invoked by the front end: ${command}`,
  ),
  ...unregisteredCommandAnnotations.map(
    (command) => `Rust command attribute is not registered by Tauri: ${command}`,
  ),
  ...registeredCommandsWithoutAnnotations.map(
    (command) => `registered Tauri command has no command attribute: ${command}`,
  ),
];

if (errors.length > 0) {
  console.error("Live data verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Live data verification passed:");
console.log(
  JSON.stringify(
    {
      routedWorkspaceFiles: lazyWorkspaceFiles.length,
      dedicatedWorkspaceContracts: dedicatedChecks.length,
      delegatedWorkspaceFiles: delegatedWorkspaceImports.size,
      controlledReferenceWorkspaces: fixedReferenceWorkspaces.size,
      frontendInvokeCommands: invokedCommands.length,
      registeredRustCommands: registeredCommands.size,
      attributedRustCommands: attributedCommands.size,
      unregisteredInvokeCommands: unregisteredCommands.length,
      uninvokedRegisteredCommands: uninvokedRegisteredCommands.length,
      unregisteredCommandAnnotations: unregisteredCommandAnnotations.length,
      registeredCommandsWithoutAnnotations:
        registeredCommandsWithoutAnnotations.length,
      legacyGenericWorkspacePresent: false,
    },
    null,
    2,
  ),
);

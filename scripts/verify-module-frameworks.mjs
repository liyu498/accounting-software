import { existsSync, readFileSync } from 'node:fs'

const read = (file) => readFileSync(file, 'utf8').replace(/\r\n?/g, '\n')
const appSource = read('src/App.tsx')
const shellSource = read('src/components/layout/AppShell.tsx')
const registrySource = read('src/pages/operations/businessModuleRegistry.ts')
const agencySource = read('src/pages/agency/AgencyModulePage.tsx')
const agencyNavSource = read('src/pages/agency/agencyNav.tsx')

const unique = (values) => [...new Set(values)]
const routePaths = [...appSource.matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1])
const auditableRoutePaths = routePaths.filter((path) => path !== '*')
const lazyImports = new Map(
  [...appSource.matchAll(/const\s+(\w+)\s*=\s*lazy\(\(\)\s*=>\s*import\(['"]([^'"]+)['"]\)/gs)]
    .map((match) => [match[1], match[2]]),
)

const dedicatedBusinessModuleRoutes = [
  { kind: 'companyInfo', path: '/settings/company-info', component: 'CompanyInfoWorkspace', file: 'src/pages/operations/CompanyInfoWorkspace.tsx' },
  { kind: 'auditLog', path: '/settings/audit-log', component: 'AuditLogWorkspace', file: 'src/pages/operations/AuditLogWorkspace.tsx' },
  { kind: 'backupRestore', path: '/settings/backup-restore', component: 'BackupRestoreWorkspace', file: 'src/pages/operations/BackupRestoreWorkspace.tsx' },
  { kind: 'declarationCalendar', path: '/tax/calendar', component: 'DeclarationCalendarWorkspace', file: 'src/pages/tax/DeclarationCalendarWorkspace.tsx' },
  { kind: 'printTemplateSettings', path: '/settings/print-templates', component: 'PrintTemplateWorkspace', file: 'src/pages/operations/PrintTemplateWorkspace.tsx' },
  { kind: 'voucher', path: '/vouchers', component: 'VoucherWorkspace', file: 'src/pages/operations/VoucherWorkspace.tsx' },
  { kind: 'voucherDetail', path: '/vouchers/detail/:id', component: 'VoucherDetailWorkspace', file: 'src/pages/operations/VoucherDetailWorkspace.tsx' },
  { kind: 'riskCheck', path: '/risk-check', component: 'RiskCheckWorkspace', file: 'src/pages/operations/RiskCheckWorkspace.tsx' },
  { kind: 'invoiceVoucherMatching', path: '/matching', component: 'InvoiceVoucherMatchingWorkspace', file: 'src/pages/operations/InvoiceVoucherMatchingWorkspace.tsx' },
  { kind: 'receivablePayableAging', path: '/aging', component: 'AgingWorkspace', file: 'src/pages/operations/AgingWorkspace.tsx' },
  { kind: 'receivableSummaryReport', path: '/reports/receivable-summary', component: 'ReceivableSummaryWorkspace', file: 'src/pages/operations/CounterpartyReportWorkspace.tsx' },
  { kind: 'receivableDetailReport', path: '/reports/receivable-detail', component: 'ReceivableDetailWorkspace', file: 'src/pages/operations/CounterpartyReportWorkspace.tsx' },
  { kind: 'payableSummaryReport', path: '/reports/payable-summary', component: 'PayableSummaryWorkspace', file: 'src/pages/operations/CounterpartyReportWorkspace.tsx' },
  { kind: 'payableDetailReport', path: '/reports/payable-detail', component: 'PayableDetailWorkspace', file: 'src/pages/operations/CounterpartyReportWorkspace.tsx' },
  { kind: 'operatingStatusReport', path: '/reports/operating-status', component: 'OperatingStatusWorkspace', file: 'src/pages/operations/OperatingAnalysisWorkspace.tsx' },
  { kind: 'operatingPerformanceReport', path: '/reports/operating-performance', component: 'OperatingPerformanceWorkspace', file: 'src/pages/operations/OperatingAnalysisWorkspace.tsx' },
  { kind: 'closingTasks', path: '/period-closing', component: 'ClosingTasksWorkspace', file: 'src/pages/operations/ClosingTasksWorkspace.tsx' },
  { kind: 'voucherRecycle', path: '/settings/voucher-recycle', component: 'VoucherRecycleWorkspace', file: 'src/pages/operations/VoucherRecycleWorkspace.tsx' },
  { kind: 'tagArchive', path: '/settings/tags', component: 'BusinessTagWorkspace', file: 'src/pages/operations/BusinessTagWorkspace.tsx' },
  { kind: 'contractLedger', path: '/settings/contracts', component: 'ContractLedgerWorkspace', file: 'src/pages/operations/ContractLedgerWorkspace.tsx' },
  { kind: 'accountArchive', path: '/settings/accounts', component: 'CompanyAccountWorkspace', file: 'src/pages/operations/CompanyAccountWorkspace.tsx' },
  { kind: 'customerArchive', path: '/settings/customers', component: 'CustomerArchiveWorkspace', file: 'src/pages/operations/ArchiveProfileWorkspace.tsx' },
  { kind: 'supplierArchive', path: '/settings/suppliers', component: 'SupplierArchiveWorkspace', file: 'src/pages/operations/ArchiveProfileWorkspace.tsx' },
  { kind: 'otherContactArchive', path: '/settings/other-contacts', component: 'OtherContactArchiveWorkspace', file: 'src/pages/operations/ArchiveProfileWorkspace.tsx' },
  { kind: 'projectArchive', path: '/settings/projects', component: 'ProjectArchiveWorkspace', file: 'src/pages/operations/ArchiveProfileWorkspace.tsx' },
  { kind: 'departmentArchive', path: '/settings/departments', component: 'DepartmentArchiveWorkspace', file: 'src/pages/operations/ArchiveProfileWorkspace.tsx' },
  { kind: 'taxAdapterSettings', path: '/settings/tax-adapters', component: 'TaxAdapterWorkspace', file: 'src/pages/operations/AdapterAuthorizationWorkspace.tsx' },
  { kind: 'bankAdapterSettings', path: '/settings/bank-adapters', component: 'BankAdapterWorkspace', file: 'src/pages/operations/AdapterAuthorizationWorkspace.tsx' },
  { kind: 'reportFormulaSettings', path: '/settings/report-formulas', component: 'ReportFormulaWorkspace', file: 'src/pages/operations/ReportFormulaWorkspace.tsx' },
  { kind: 'invoiceMatchingRules', path: '/settings/invoice-rules', component: 'InvoiceMatchingRuleWorkspace', file: 'src/pages/operations/MatchingRuleWorkspace.tsx' },
  { kind: 'billMatchingRules', path: '/settings/bill-rules', component: 'BillMatchingRuleWorkspace', file: 'src/pages/operations/MatchingRuleWorkspace.tsx' },
  { kind: 'cashFlowMapping', path: '/settings/cash-flow-mapping', component: 'CashFlowMappingWorkspace', file: 'src/pages/operations/MatchingRuleWorkspace.tsx' },
  { kind: 'equityChangeMapping', path: '/settings/equity-change-mapping', component: 'EquityChangeMappingWorkspace', file: 'src/pages/operations/MatchingRuleWorkspace.tsx' },
  { kind: 'settlementRules', path: '/settings/settlement-rules', component: 'SettlementRuleWorkspace', file: 'src/pages/operations/SettlementRuleWorkspace.tsx' },
  { kind: 'auxiliaryCategories', path: '/settings/auxiliary-categories', component: 'AuxiliaryCategoryWorkspace', file: 'src/pages/operations/AuxiliaryWorkspace.tsx' },
  { kind: 'auxiliaryItems', path: '/settings/auxiliary-items', component: 'AuxiliaryItemWorkspace', file: 'src/pages/operations/AuxiliaryWorkspace.tsx' },
  { kind: 'currencySettings', path: '/settings/currencies', component: 'CurrencyWorkspace', file: 'src/pages/operations/CurrencyWorkspace.tsx' },
  { kind: 'commonDigests', path: '/settings/common-digests', component: 'CommonDigestWorkspace', file: 'src/pages/operations/TemplateSettingsWorkspace.tsx' },
  { kind: 'voucherTemplateSettings', path: '/settings/voucher-templates', component: 'VoucherTemplateWorkspace', file: 'src/pages/operations/TemplateSettingsWorkspace.tsx' },
  { kind: 'periodManagement', path: '/settings/period-management', component: 'PeriodManagementWorkspace', file: 'src/pages/operations/PeriodManagementWorkspace.tsx' },
  { kind: 'assetCategory', path: '/settings/asset-categories', component: 'AssetCategoryWorkspace', file: 'src/pages/operations/AssetCategoryWorkspace.tsx' },
  { kind: 'subjectSettings', path: '/settings/account-codes', component: 'AccountCodeWorkspace', file: 'src/pages/operations/AccountCodeWorkspace.tsx' },
  { kind: 'depreciation', path: '/depreciation', component: 'FixedAssetWorkspace', file: 'src/pages/operations/FixedAssetWorkspace.tsx' },
  { kind: 'inventorySettings', path: '/inventory', component: 'InventoryMasterWorkspace', file: 'src/pages/operations/InventoryMasterWorkspace.tsx' },
  { kind: 'inventoryOpening', path: '/inventory/opening', component: 'InventoryOpeningWorkspace', file: 'src/pages/operations/InventoryOpeningWorkspace.tsx' },
  { kind: 'inventoryStocktake', path: '/inventory/stocktakes', component: 'InventoryStocktakeWorkspace', file: 'src/pages/operations/InventoryStocktakeWorkspace.tsx' },
  { kind: 'unitSettings', path: '/units', component: 'MeasurementUnitWorkspace', file: 'src/pages/operations/MeasurementUnitWorkspace.tsx' },
  { kind: 'costCarryover', path: '/cost-carryover', component: 'CostCarryoverWorkspace', file: 'src/pages/operations/CostCarryoverWorkspace.tsx' },
  { kind: 'inventoryMovement', path: '/inventory/movements', component: 'InventoryMovementWorkspace', file: 'src/pages/operations/InventoryMovementWorkspace.tsx' },
  { kind: 'transfer', path: '/transfers', component: 'AccountTransferWorkspace', file: 'src/pages/operations/AccountTransferWorkspace.tsx' },
  { kind: 'receivableSettlement', path: '/settlement/receivable', component: 'ReceivableSettlementWorkspace', file: 'src/pages/operations/ReceivableSettlementWorkspace.tsx' },
  { kind: 'payableSettlement', path: '/settlement/payable', component: 'PayableSettlementWorkspace', file: 'src/pages/operations/PayableSettlementWorkspace.tsx' },
  { kind: 'purchaseManagement', path: '/purchase', component: 'PurchaseManagementWorkspace', file: 'src/pages/operations/PurchaseManagementWorkspace.tsx' },
  { kind: 'salesManagement', path: '/sales', component: 'SalesManagementWorkspace', file: 'src/pages/operations/SalesManagementWorkspace.tsx' },
  { kind: 'documentRegister', path: '/documents', component: 'DocumentRegisterWorkspace', file: 'src/pages/operations/DocumentRegisterWorkspace.tsx' },
  { kind: 'bankReconciliation', path: '/bank/reconciliation', component: 'BankReconciliationWorkspace', file: 'src/pages/operations/BankReconciliationWorkspace.tsx' },
  { kind: 'bankStatement', path: '/bank', component: 'BankStatementWorkspace', file: 'src/pages/operations/BankStatementWorkspace.tsx' },
  { kind: 'billList', path: '/bills', component: 'BillListWorkspace', file: 'src/pages/operations/BillListWorkspace.tsx' },
  { kind: 'notificationCenter', path: '/notifications', component: 'NotificationCenterWorkspace', file: 'src/pages/operations/SystemHubWorkspace.tsx' },
  { kind: 'settingsData', path: '/settings', component: 'SettingsOverviewWorkspace', file: 'src/pages/operations/SystemHubWorkspace.tsx' },
  { kind: 'initialBalance', path: '/settings/initial-balances', component: 'InitialBalanceWorkspace', file: 'src/pages/operations/InitializationWorkspace.tsx' },
  { kind: 'taxInit', path: '/settings/tax-init', component: 'TaxInitializationWorkspace', file: 'src/pages/operations/InitializationWorkspace.tsx' },
  { kind: 'historyVoucher', path: '/settings/history-vouchers', component: 'HistoryVoucherWorkspace', file: 'src/pages/operations/HistoryMigrationWorkspace.tsx' },
  { kind: 'historyBalance', path: '/settings/history-balances', component: 'HistoryBalanceWorkspace', file: 'src/pages/operations/HistoryMigrationWorkspace.tsx' },
  { kind: 'historyGeneralLedger', path: '/settings/history-general-ledger', component: 'HistoryGeneralLedgerWorkspace', file: 'src/pages/operations/HistoryMigrationWorkspace.tsx' },
  { kind: 'historySubsidiaryLedger', path: '/settings/history-subsidiary-ledger', component: 'HistorySubsidiaryLedgerWorkspace', file: 'src/pages/operations/HistoryMigrationWorkspace.tsx' },
  { kind: 'voucherCreate', path: '/vouchers/new', component: 'VoucherCreateWorkspace', file: 'src/pages/operations/VoucherEntryWorkspace.tsx' },
  { kind: 'voucherEdit', path: '/vouchers/edit/:id', component: 'VoucherEditWorkspace', file: 'src/pages/operations/VoucherEntryWorkspace.tsx' },
  { kind: 'outputInvoice', path: '/invoices/output', component: 'OutputInvoiceWorkspace', file: 'src/pages/operations/OutputInvoiceWorkspace.tsx' },
  { kind: 'inputInvoice', path: '/invoices/input', component: 'InputInvoiceWorkspace', file: 'src/pages/operations/InputInvoiceWorkspace.tsx' },
  { kind: 'employee', path: '/employees', component: 'EmployeeWorkspace', file: 'src/pages/operations/EmployeeWorkspace.tsx' },
  { kind: 'payroll', path: '/payroll', component: 'PayrollWorkspace', file: 'src/pages/operations/PayrollWorkspace.tsx' },
  { kind: 'socialSecurity', path: '/social-security', component: 'SocialSecurityWorkspace', file: 'src/pages/operations/SocialSecurityWorkspace.tsx' },
  { kind: 'specialDeduction', path: '/special-deductions', component: 'SpecialDeductionWorkspace', file: 'src/pages/operations/SpecialDeductionWorkspace.tsx' },
  { kind: 'aiJobQueue', path: '/ai/jobs', component: 'AiJobQueueWorkspace', file: 'src/pages/operations/AiOperationsWorkspace.tsx' },
  { kind: 'aiRecognitionResults', path: '/ai/recognition', component: 'AiRecognitionWorkspace', file: 'src/pages/operations/AiOperationsWorkspace.tsx' },
  { kind: 'aiVoucherSuggestions', path: '/ai/suggestions', component: 'AiVoucherSuggestionWorkspace', file: 'src/pages/operations/AiOperationsWorkspace.tsx' },
  { kind: 'aiRuleTraining', path: '/ai/rules', component: 'AiRuleTrainingWorkspace', file: 'src/pages/operations/AiOperationsWorkspace.tsx' },
]
const routedWorkspaceComponents = unique([...appSource.matchAll(/<(\w+Workspace)\b/g)].map((match) => match[1]))

const moduleRegistryBlock = registrySource.match(/export const businessModuleKinds = \[([\s\S]*?)\n\] as const/)?.[1] || ''
const moduleKinds = unique([...moduleRegistryBlock.matchAll(/['"]([A-Za-z0-9]+)['"]/g)].map((match) => match[1]))

const agencyUnionBlock = agencySource.match(/export type AgencyModuleKind\s*=([\s\S]*?)\n\ninterface AgencyModulePageProps/)?.[1] || ''
const agencyKinds = unique([...agencyUnionBlock.matchAll(/['"]([A-Za-z0-9]+)['"]/g)].map((match) => match[1]))
const agencyConfigBlock = agencySource.match(/const configs: Record<AgencyModuleKind, AgencyConfig> = \{([\s\S]*?)\n\}/)?.[1] || ''
const agencyConfigKinds = unique([...agencyConfigBlock.matchAll(/^  ([A-Za-z0-9]+): \{/gm)].map((match) => match[1]))
const agencyRouteKinds = unique([...appSource.matchAll(/agencyPage\(['"]([A-Za-z0-9]+)['"]\)/g)].map((match) => match[1]))
const agencyNavPaths = unique([...agencyNavSource.matchAll(/path:\s*['"]([^'"]+)['"]/g)].map((match) => match[1]))
const shellNavPaths = unique([...shellSource.matchAll(/(?:path:\s*|to=)['"]([^'"]+)['"]/g)].map((match) => match[1]).filter((path) => path.startsWith('/')))

function modulePath(importPath) {
  return importPath.startsWith('./') ? `src/${importPath.slice(2)}.tsx` : ''
}

function routeExists(path) {
  if (routePaths.includes(path)) return true
  return routePaths.some((route) => route.includes(':') && new RegExp(`^${route.replace(/:[^/]+/g, '[^/]+')}$`).test(path))
}

const dedicatedRouteKinds = unique([
  ...dedicatedBusinessModuleRoutes.map((route) => route.kind),
])
const dedicatedRouteErrors = dedicatedBusinessModuleRoutes.flatMap((route) => {
  const source = existsSync(route.file) ? read(route.file) : ''
  const expectedImportPath = `./${route.file.replace(/^src\//, '').replace(/\.tsx$/, '')}`
  return [
    ...(moduleKinds.includes(route.kind) ? [] : [`dedicated route kind '${route.kind}' is missing from ModuleKind`]),
    ...(routePaths.includes(route.path) && appSource.includes(`<${route.component}`)
      ? []
      : [`dedicated route '${route.path}' must render ${route.component}`]),
    ...(lazyImports.get(route.component) === expectedImportPath
      ? []
      : [`dedicated route component '${route.component}' must import ${route.file}`]),
    ...(source.includes(`export function ${route.component}(`)
      ? []
      : [`dedicated module workspace '${route.kind}' must export ${route.component}`]),
  ]
})

const missingLazyFiles = [...lazyImports.entries()]
  .map(([component, importPath]) => ({ component, file: modulePath(importPath) }))
  .filter(({ file }) => !file || !existsSync(file))
const unroutedWorkspaceBindings = [...lazyImports.keys()]
  .filter((component) => component.endsWith('Workspace') && !routedWorkspaceComponents.includes(component))
const unresolvedWorkspaceRoutes = routedWorkspaceComponents.filter((component) => !lazyImports.has(component))
const missingAgencyKinds = agencyKinds.filter((kind) => !agencyConfigKinds.includes(kind) || !agencyRouteKinds.includes(kind))
const extraAgencyKinds = unique([...agencyConfigKinds, ...agencyRouteKinds]).filter((kind) => !agencyKinds.includes(kind))
const navWithoutRoute = shellNavPaths.filter((path) => !routeExists(path))
const agencyNavWithoutRoute = agencyNavPaths.filter((path) => !routeExists(path))

const errors = [
  ...(existsSync('src/pages/operations/BusinessModulePage.tsx') ? ['retired generic BusinessModulePage.tsx still exists'] : []),
  ...(appSource.includes('BusinessModulePage') ? ['application still references the retired generic business page'] : []),
  ...(existsSync('src/pages/operations/businessModuleConfig.ts') ? ['retired generic businessModuleConfig.ts still exists'] : []),
  ...(moduleKinds.length !== 107 ? [`ModuleKind count must remain 107, received ${moduleKinds.length}`] : []),
  ...(dedicatedRouteKinds.length !== dedicatedBusinessModuleRoutes.length ? ['dedicated business module route kinds contain duplicates'] : []),
  ...dedicatedRouteErrors,
  ...(agencyKinds.length !== 9 ? [`AgencyModuleKind count must remain 9, received ${agencyKinds.length}`] : []),
  ...(agencyConfigKinds.length !== 9 ? [`agency config count must remain 9, received ${agencyConfigKinds.length}`] : []),
  ...(agencyRouteKinds.length !== 9 ? [`agency route count must remain 9, received ${agencyRouteKinds.length}`] : []),
  ...missingAgencyKinds.map((kind) => `agency kind '${kind}' is not configured and routed`),
  ...extraAgencyKinds.map((kind) => `agency kind '${kind}' is configured or routed without a union member`),
  ...missingLazyFiles.map(({ component, file }) => `${component} lazy import target does not exist: ${file}`),
  ...unroutedWorkspaceBindings.map((component) => `lazy workspace '${component}' is never routed`),
  ...unresolvedWorkspaceRoutes.map((component) => `workspace route '${component}' has no lazy binding`),
  ...navWithoutRoute.map((path) => `sidebar path '${path}' has no route`),
  ...agencyNavWithoutRoute.map((path) => `agency navigation path '${path}' has no route`),
  ...(auditableRoutePaths.length !== 137 ? [`application route count must remain 137, received ${auditableRoutePaths.length}`] : []),
  ...(new Set(auditableRoutePaths).size !== auditableRoutePaths.length ? ['application route paths contain duplicates'] : []),
  ...(shellSource.includes('handleSmsAction') || shellSource.includes('>\n              短信\n') ? ['SMS shortcut must remain removed'] : []),
  ...(shellSource.includes('to="/downloads"') ? ['duplicate account-header download shortcut must remain removed'] : []),
  ...(shellSource.includes("label: 'AI做账工作台'") ? ['duplicate AI bookkeeping navigation entry must remain removed'] : []),
  ...(!shellSource.includes("label: 'AI自动化'") ? ['AI automation navigation group is missing'] : []),
]

if (errors.length > 0) {
  console.error('Module framework verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Module framework verification passed:')
console.log(JSON.stringify({
  businessRoutes: moduleKinds.length,
  genericBusinessRoutes: 0,
  dedicatedBusinessRoutes: moduleKinds.length,
  moduleRegistryEntries: moduleKinds.length,
  shellNavPaths: shellNavPaths.length,
  agencyRoutes: agencyRouteKinds.length,
  agencyModuleKindUnion: agencyKinds.length,
  agencyModuleConfigs: agencyConfigKinds.length,
  agencyNavPaths: agencyNavPaths.length,
  lazyWorkspaceFiles: lazyImports.size,
  appRoutes: auditableRoutePaths.length,
}, null, 2))

import { readFileSync } from 'node:fs'

const appSource = readFileSync('src/App.tsx', 'utf8')
const shellSource = readFileSync('src/components/layout/AppShell.tsx', 'utf8')
const businessSource = readFileSync('src/pages/operations/BusinessModulePage.tsx', 'utf8')
const agencyNavSource = readFileSync('src/pages/agency/agencyNav.tsx', 'utf8')
const agencySource = readFileSync('src/pages/agency/AgencyModulePage.tsx', 'utf8')

const unique = (values) => [...new Set(values)]

const routeKinds = unique([...appSource.matchAll(/businessPage\('([^']+)'/g)].map((match) => match[1]))
const agencyRouteKinds = unique([...appSource.matchAll(/agencyPage\('([^']+)'/g)].map((match) => match[1]))
const unionBlock = businessSource.match(/type ModuleKind =([\s\S]*?)\n\ninterface/)?.[1] ?? ''
const unionKinds = unique([...unionBlock.matchAll(/'([^']+)'/g)].map((match) => match[1]))
const configBlock = businessSource.match(/const moduleConfigs: Record<ModuleKind, ModuleConfig> = \{([\s\S]*?)\n\}/)?.[1] ?? ''
const configKinds = unique([...configBlock.matchAll(/^  ([A-Za-z0-9]+): \{\n    keywordPlaceholder:/gm)].map((match) => match[1]))
const agencyUnionBlock = agencySource.match(/export type AgencyModuleKind =([\s\S]*?)\n\ninterface/)?.[1] ?? ''
const agencyUnionKinds = unique([...agencyUnionBlock.matchAll(/'([^']+)'/g)].map((match) => match[1]))
const agencyConfigBlock = agencySource.match(/const configs: Record<AgencyModuleKind, AgencyConfig> = \{([\s\S]*?)\n\}/)?.[1] ?? ''
const agencyConfigKinds = unique([...agencyConfigBlock.matchAll(/^  ([A-Za-z0-9]+): \{\n    title:/gm)].map((match) => match[1]))

const routePaths = unique([...appSource.matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1])).filter((path) => path !== '*')
const shellPaths = unique([...shellSource.matchAll(/path: '([^']+)'/g)].map((match) => match[1]))
const agencyNavPaths = unique([...agencyNavSource.matchAll(/path: '([^']+)'/g)].map((match) => match[1]))

const missingUnion = routeKinds.filter((kind) => !unionKinds.includes(kind))
const missingConfig = routeKinds.filter((kind) => !configKinds.includes(kind))
const unusedUnion = unionKinds.filter((kind) => !routeKinds.includes(kind))
const unusedConfig = configKinds.filter((kind) => !routeKinds.includes(kind))
const navWithoutRoute = shellPaths.filter((path) => !routePaths.includes(path))
const missingAgencyUnion = agencyRouteKinds.filter((kind) => !agencyUnionKinds.includes(kind))
const missingAgencyConfig = agencyRouteKinds.filter((kind) => !agencyConfigKinds.includes(kind))
const unusedAgencyUnion = agencyUnionKinds.filter((kind) => !agencyRouteKinds.includes(kind))
const agencyNavWithoutRoute = agencyNavPaths.filter((path) => !routePaths.includes(path))
const duplicateAccountRoute = '<Route path="/agency/accounts" element={agencyPage(\'accountManagement\')} />'
const accountRedirectRoute = '<Route path="/agency/accounts" element={<Navigate to="/" replace />} />'

const summary = {
  businessRoutes: routeKinds.length,
  moduleKindUnion: unionKinds.length,
  moduleConfigs: configKinds.length,
  shellNavPaths: shellPaths.length,
  agencyRoutes: agencyRouteKinds.length,
  agencyModuleKindUnion: agencyUnionKinds.length,
  agencyModuleConfigs: agencyConfigKinds.length,
  agencyNavPaths: agencyNavPaths.length,
  appRoutes: routePaths.length,
}

const errors = [
  ...missingUnion.map((kind) => `businessPage kind '${kind}' is missing from ModuleKind`),
  ...missingConfig.map((kind) => `businessPage kind '${kind}' is missing from moduleConfigs`),
  ...unusedUnion.map((kind) => `ModuleKind '${kind}' is not used by any business route`),
  ...unusedConfig.map((kind) => `moduleConfigs kind '${kind}' is not used by any business route`),
  ...navWithoutRoute.map((path) => `sidebar path '${path}' has no matching <Route>`),
  ...missingAgencyUnion.map((kind) => `agencyPage kind '${kind}' is missing from AgencyModuleKind`),
  ...missingAgencyConfig.map((kind) => `agencyPage kind '${kind}' is missing from agency configs`),
  ...unusedAgencyUnion.map((kind) => `AgencyModuleKind '${kind}' is not used by any agency route`),
  ...agencyNavWithoutRoute.map((path) => `agency nav path '${path}' has no matching <Route>`),
  ...(agencyRouteKinds.includes('accountManagement') ? ['duplicate agency account-management page is still routed'] : []),
  ...(agencyUnionKinds.includes('accountManagement') ? ['duplicate accountManagement kind is still declared'] : []),
  ...(agencyConfigKinds.includes('accountManagement') ? ['duplicate accountManagement config is still declared'] : []),
  ...(agencyNavSource.includes("path: '/agency/accounts'") ? ['duplicate account-management item is still in agency navigation'] : []),
  ...(appSource.includes(duplicateAccountRoute) ? ['agency accounts route still renders the duplicate page'] : []),
  ...(!appSource.includes(accountRedirectRoute) ? ['agency accounts route must redirect to the home account-management workspace'] : []),
  ...(shellSource.includes('>\n              短信\n') ? ['SMS shortcut must not be rendered in the account shell'] : []),
  ...(shellSource.includes('handleSmsAction') ? ['SMS shell action must be removed'] : []),
  ...(!shellSource.includes("label: 'AI做账工作台'") ? ['AI accounting navigation must be named as a workbench'] : []),
  ...(!shellSource.includes("label: '自动化与规则'") ? ['AI automation navigation must clarify its rule and queue scope'] : []),
  ...(!shellSource.includes('z-[80]') ? ['theme menu must render above the account header overlay'] : []),
  ...(businessSource.includes('支持导出和打印') ? ['business list headers must not use one generic export/print hint'] : []),
  ...(!businessSource.includes('getModuleListMeta') ? ['business list metadata must be derived per module domain'] : []),
  ...(!businessSource.includes('进项抵扣与认证清单') ? ['input invoice list must have its own operating title'] : []),
  ...(!businessSource.includes('人员档案与参保资料清单') ? ['employee list must have its own operating title'] : []),
  ...(!businessSource.includes('进项抵扣处理流程') ? ['input invoices must render a dedicated deduction workflow'] : []),
  ...(!businessSource.includes('人员档案资料核验') ? ['employee registry must render a dedicated document verification workflow'] : []),
  ...(!businessSource.includes('openInputInvoiceEditor') ? ['input invoice workflow must open the dedicated invoice editor'] : []),
  ...(!businessSource.includes('openEmployeeEditor') ? ['employee workflow must open the dedicated employee editor'] : []),
  ...(!businessSource.includes('工资核算与凭证准备') ? ['payroll must render a dedicated payroll workflow'] : []),
  ...(!businessSource.includes('社保公积金核对流程') ? ['social security must render a dedicated reconciliation workflow'] : []),
  ...(!businessSource.includes('资金流水匹配处理') ? ['banking modules must render a dedicated matching workflow'] : []),
  ...(!businessSource.includes('openPayrollEditor') ? ['payroll workflow must open the dedicated payroll editor'] : []),
  ...(!businessSource.includes('openBankTransactionEditor') ? ['bank workflow must open the dedicated transaction editor'] : []),
  ...(!businessSource.includes('采购履约与入账准备') ? ['purchase management must render a dedicated fulfillment workflow'] : []),
  ...(!businessSource.includes('销售开票与收款准备') ? ['sales management must render a dedicated fulfillment workflow'] : []),
  ...(!businessSource.includes('费用报销审批与付款准备') ? ['expense reimbursement must render a dedicated workflow'] : []),
  ...(!businessSource.includes('原始单据归档与入账准备') ? ['document registration must render a dedicated workflow'] : []),
  ...(!businessSource.includes('openBusinessOrderEditor') ? ['order workflow must open the dedicated order editor'] : []),
  ...(!businessSource.includes('openDocumentRecordEditor') ? ['document workflow must open the dedicated document editor'] : []),
  ...(!businessSource.includes('资产折旧与凭证准备') ? ['fixed assets must render a dedicated depreciation workflow'] : []),
  ...(!businessSource.includes('存货收发与成本结转') ? ['inventory modules must render a dedicated inventory workflow'] : []),
  ...(!businessSource.includes('月末成本结转复核') ? ['cost carryover must render a dedicated closing workflow'] : []),
  ...(!businessSource.includes('openFixedAssetEditor') ? ['asset workflow must open the dedicated fixed asset editor'] : []),
  ...(!businessSource.includes('openInventoryMovementEditor') ? ['inventory workflow must open the dedicated inventory movement editor'] : []),
  ...(!businessSource.includes('银行对账与未达项处理') ? ['bank reconciliation must render a dedicated workflow'] : []),
  ...(!businessSource.includes('应收核销与回款复核') ? ['receivable settlement must render a dedicated workflow'] : []),
  ...(!businessSource.includes('应付核销与付款复核') ? ['payable settlement must render a dedicated workflow'] : []),
  ...(!businessSource.includes('往来账龄与风险处置') ? ['aging must render a dedicated workflow'] : []),
  ...(!businessSource.includes('期末结账与结转控制') ? ['closing tasks must render a dedicated workflow'] : []),
  ...(!businessSource.includes('openBankReconciliationEditor') ? ['bank reconciliation workflow must open the dedicated editor'] : []),
  ...(!businessSource.includes('openSettlementRecordEditor') ? ['settlement workflow must open the dedicated editor'] : []),
]

if (errors.length > 0) {
  console.error('Module framework verification failed:')
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  console.error(JSON.stringify(summary, null, 2))
  process.exit(1)
}

console.log('Module framework verification passed:')
console.log(JSON.stringify(summary, null, 2))

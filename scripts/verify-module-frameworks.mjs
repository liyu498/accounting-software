import { readFileSync } from 'node:fs'

const appSource = readFileSync('src/App.tsx', 'utf8')
const shellSource = readFileSync('src/components/layout/AppShell.tsx', 'utf8')
const businessSource = readFileSync('src/pages/operations/BusinessModulePage.tsx', 'utf8')
const roleManagerSource = readFileSync('src/pages/settings/RoleManager.tsx', 'utf8')
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
  ...(!businessSource.includes('AI 队列与建议处理清单') ? ['AI modules must have their own list context'] : []),
  ...(!businessSource.includes('资料采集与批次核验清单') ? ['collection modules must have their own list context'] : []),
  ...(!businessSource.includes('账套配置与控制清单') ? ['account controls must have their own list context'] : []),
  ...(!businessSource.includes('税务申报与缴款处理清单') ? ['tax modules must have their own list context'] : []),
  ...(!businessSource.includes('getModuleDetailMeta') ? ['business detail dialogs must be derived per module domain'] : []),
  ...(!businessSource.includes('发票业务明细') ? ['invoice detail dialogs must have a dedicated title'] : []),
  ...(!businessSource.includes('人员档案明细') ? ['employee detail dialogs must have a dedicated title'] : []),
  ...(!businessSource.includes('税务申报事项明细') ? ['tax detail dialogs must have a dedicated title'] : []),
  ...(!businessSource.includes('getModuleTableMeta') ? ['business table columns must be derived per module domain'] : []),
  ...(!businessSource.includes('会计凭证') ? ['invoice tables must label their voucher relation'] : []),
  ...(!businessSource.includes('资料附件') ? ['personnel tables must label their document relation'] : []),
  ...(!businessSource.includes('申报包') ? ['tax tables must label their declaration relation'] : []),
  ...(!businessSource.includes('getModuleTabs') ? ['workspace tabs must be derived per module domain'] : []),
  ...(!businessSource.includes("'开票汇总'") ? ['output invoices must have invoice-specific workspace tabs'] : []),
  ...(!businessSource.includes("'工资项明细'") ? ['payroll must have payroll-specific workspace tabs'] : []),
  ...(!businessSource.includes("'回执缴款'") ? ['tax modules must have tax-specific workspace tabs'] : []),
  ...(!businessSource.includes("'人工确认'") ? ['AI modules must have AI-specific workspace tabs'] : []),
  ...(!businessSource.includes('setActiveTab') ? ['workspace tabs must be selectable'] : []),
  ...(!businessSource.includes('activeTab === tab') ? ['workspace tabs must expose the active module view'] : []),
  ...(!businessSource.includes('filterRowsByWorkspaceTab') ? ['workspace tabs must apply module data filters'] : []),
  ...(!businessSource.includes('附件、影像或回单') ? ['attachment workspace tabs must filter related records'] : []),
  ...(!businessSource.includes('凭证、申报包或草稿') ? ['voucher workspace tabs must filter related records'] : []),
  ...(!businessSource.includes('getWorkspaceTabContext') ? ['workspace tabs must provide domain-specific context'] : []),
  ...(!businessSource.includes('开票汇总取数') ? ['invoice summary tabs must show invoice-specific context'] : []),
  ...(!businessSource.includes('申报包与回执边界') ? ['tax workspace tabs must show declaration-specific context'] : []),
  ...(!businessSource.includes('AI人工确认范围') ? ['AI workspace tabs must show review-specific context'] : []),
  ...(!agencySource.includes('getAgencyDetailMeta') ? ['agency detail dialogs must be derived per module domain'] : []),
  ...(!agencySource.includes('客户账套明细') ? ['client workspaces must have a dedicated detail title'] : []),
  ...(!agencySource.includes('授权记录明细') ? ['authorization workspaces must have a dedicated detail title'] : []),
  ...(!agencySource.includes('批量任务明细') ? ['batch workspaces must have a dedicated detail title'] : []),
  ...(!agencySource.includes('getAgencyToolbarMeta') ? ['agency toolbars must be derived per module domain'] : []),
  ...(!agencySource.includes("refreshLabel: '重新体检'") ? ['health checks must have a dedicated toolbar action'] : []),
  ...(!agencySource.includes("refreshLabel: '刷新统计'") ? ['statistics must have a dedicated toolbar action'] : []),
  ...(!agencySource.includes("refreshLabel: '刷新文件'") ? ['download center must have a dedicated toolbar action'] : []),
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
  ...(!businessSource.includes('AI任务编排与人工确认') ? ['ai job queue must render a dedicated orchestration workflow'] : []),
  ...(!businessSource.includes('识别字段复核与回链处理') ? ['ai recognition must render a dedicated review workflow'] : []),
  ...(!businessSource.includes('凭证建议核验与草稿流转') ? ['ai voucher suggestions must render a dedicated confirmation workflow'] : []),
  ...(!businessSource.includes('AI规则训练与版本审核') ? ['ai rule training must render a dedicated governance workflow'] : []),
  ...(!businessSource.includes('openAiVoucherSuggestionEditor') ? ['ai voucher workflow must open the dedicated suggestion editor'] : []),
  ...(!businessSource.includes('账簿取数与凭证穿透') ? ['ledger family must render a dedicated retrieval workflow'] : []),
  ...(!businessSource.includes('财务报表取数与勾稽复核') ? ['financial statement family must render a dedicated reconciliation workflow'] : []),
  ...(!businessSource.includes('reviewLedgerReports') ? ['ledger workflow must register a reconciliation review'] : []),
  ...(!businessSource.includes('reviewFinancialStatements') ? ['financial workflow must register a statement review'] : []),
  ...(!businessSource.includes('企业税务资料与授权维护') ? ['company information must render a dedicated registration workflow'] : []),
  ...(!businessSource.includes('期初余额试算与启用控制') ? ['initial balance must render a dedicated balance workflow'] : []),
  ...(!businessSource.includes('科目核算口径与报表映射') ? ['subject settings must render a dedicated accounting policy workflow'] : []),
  ...(!businessSource.includes('辅助档案完整性与业务引用') ? ['auxiliary archives must render a dedicated validation workflow'] : []),
  ...(!businessSource.includes('申报认定与日历控制') ? ['tax initialization and calendar must render a dedicated workflow'] : []),
  ...(!businessSource.includes('税务取数与申报包控制') ? ['tax report family must render a dedicated workflow'] : []),
  ...(!businessSource.includes('申报回执与缴款归档') ? ['declaration receipts must render a dedicated archive workflow'] : []),
  ...(!businessSource.includes('reviewTaxTaskData') ? ['tax workflow must register a source review'] : []),
  ...(!businessSource.includes('openTaxReceiptWorkflow') ? ['receipt workflow must open the dedicated receipt editor'] : []),
  ...(!businessSource.includes('附件来源与归档完整性') ? ['attachment center must render a dedicated archive workflow'] : []),
  ...(!businessSource.includes('导入批次解析与字段映射') ? ['import center must render a dedicated mapping workflow'] : []),
  ...(!businessSource.includes('导出文件留痕与下载控制') ? ['export center must render a dedicated download workflow'] : []),
  ...(!businessSource.includes('账套备份与恢复前校验') ? ['backup restore must render a dedicated recovery workflow'] : []),
  ...(!businessSource.includes('reviewImportArchiveData') ? ['archive workflow must register a review'] : []),
  ...(!businessSource.includes('自动匹配规则与优先级控制') ? ['matching rules must render a dedicated governance workflow'] : []),
  ...(!businessSource.includes('凭证与报表模板版本控制') ? ['templates must render a dedicated version workflow'] : []),
  ...(!businessSource.includes('外部适配授权与脱敏边界') ? ['adapter settings must render a dedicated authorization workflow'] : []),
  ...(!businessSource.includes('reviewRuleTemplateGovernance') ? ['rule and template workflow must register a review'] : []),
  ...(!businessSource.includes('历史账迁移与差异追溯') ? ['history migration must render a dedicated reconciliation workflow'] : []),
  ...(!businessSource.includes('风险检查与处置闭环') ? ['risk check must render a dedicated remediation workflow'] : []),
  ...(!businessSource.includes('操作审计追溯与高风险留痕') ? ['audit log must render a dedicated evidence workflow'] : []),
  ...(!businessSource.includes('删除凭证恢复与销毁控制') ? ['voucher recycle must render a dedicated retention workflow'] : []),
  ...(!businessSource.includes('reviewControlEvidence') ? ['control workflow must register a review'] : []),
  ...(!businessSource.includes('销项开票与凭证确认流程') ? ['output invoices must render a dedicated workflow'] : []),
  ...(!businessSource.includes('合同履约与印花税核验') ? ['contract ledgers must render a dedicated workflow'] : []),
  ...(!businessSource.includes('发票凭证关联与差异复核') ? ['invoice voucher matching must render a dedicated workflow'] : []),
  ...(!businessSource.includes('票据到期与背书用途核验') ? ['receipt ledger must render a dedicated workflow'] : []),
  ...(!businessSource.includes('账户资金调拨与手续费核验') ? ['account transfer must render a dedicated workflow'] : []),
  ...(!businessSource.includes('专项附加扣除确认与个税取数') ? ['special deductions must render a dedicated workflow'] : []),
  ...(!businessSource.includes('账户币别与计量口径维护') ? ['account unit currency settings must render a dedicated workflow'] : []),
  ...(!businessSource.includes('资产类别与辅助核算维度控制') ? ['asset and auxiliary settings must render a dedicated workflow'] : []),
  ...(!businessSource.includes('打印模板版本与输出校验') ? ['print templates must render a dedicated workflow'] : []),
  ...(!businessSource.includes('账期锁定与反结账审批') ? ['period management must render a dedicated workflow'] : []),
  ...(!businessSource.includes('reviewFoundationConfiguration') ? ['foundation workflow must register a review'] : []),
  ...(!businessSource.includes('账套设置导航与生效范围') ? ['settings overview must render a dedicated workflow'] : []),
  ...(!roleManagerSource.includes('机构角色与成员授权') ? ['role manager must expose an agency authorization workspace'] : []),
  ...(!roleManagerSource.includes('PREVIEW_ROLES') ? ['role manager must provide browser preview role data'] : []),
  ...(!roleManagerSource.includes('权限矩阵') ? ['role manager must render a permission matrix view'] : []),
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

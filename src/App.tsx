import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import type { ComponentProps } from 'react'
import { useAuthStore } from './stores/authStore'
import { LoginPage } from './pages/LoginPage'
import { Dashboard } from './pages/Dashboard'
import { Welcome } from './pages/Welcome'
import { AIBookkeeping } from './pages/AIBookkeeping'
import { AppShell } from './components/layout/AppShell'
import { ToastProvider } from './components/ui/Toast'
import { BusinessModulePage } from './pages/operations/BusinessModulePage'
import { TaxWorkspace } from './pages/tax/TaxWorkspace'
import { AgencyModulePage, type AgencyModuleKind } from './pages/agency/AgencyModulePage'
import { AgencyLayout } from './pages/agency/AgencyLayout'

// Protected route wrapper
interface ProtectedRouteProps {
  children: React.ReactNode
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

// Auth route wrapper - redirects to welcome if already logged in
interface AuthRouteProps {
  children: React.ReactNode
}

function AuthRoute({ children }: AuthRouteProps) {
  const { isAuthenticated } = useAuthStore()

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

// App layout with sidebar (for company pages)
function AppLayout() {
  return <AppShell><Outlet /></AppShell>
}

const businessPage = (kind: ComponentProps<typeof BusinessModulePage>['kind'], title: string, description: string) => (
  <BusinessModulePage kind={kind} title={title} description={description} />
)
const agencyPage = (kind: AgencyModuleKind) => <AgencyModulePage kind={kind} />

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route
            path="/login"
            element={
              <AuthRoute>
                <LoginPage />
              </AuthRoute>
            }
          />

          {/* Welcome page - no sidebar, standalone layout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Welcome />
              </ProtectedRoute>
            }
          />

          {/* Protected routes with app shell (company pages) */}
          <Route
            element={
              <ProtectedRoute>
                <AgencyLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/agency/clients" element={agencyPage('clients')} />
            <Route path="/agency/accounts" element={agencyPage('accountManagement')} />
            <Route path="/agency/service-contracts" element={agencyPage('serviceContracts')} />
            <Route path="/agency/fees" element={agencyPage('feeCollection')} />
            <Route path="/agency/fee-collection" element={agencyPage('feeCollection')} />
            <Route path="/agency/collaboration" element={agencyPage('customerCollaboration')} />
            <Route path="/agency/customer-collaboration" element={agencyPage('customerCollaboration')} />
            <Route path="/agency/tickets" element={agencyPage('deliveryTickets')} />
            <Route path="/agency/batch-tax" element={agencyPage('batchTax')} />
            <Route path="/agency/data-stats" element={agencyPage('dataStats')} />
            <Route path="/agency/batch-ops" element={agencyPage('batchOps')} />
            <Route path="/agency/invoice-management" element={agencyPage('invoiceManagement')} />
            <Route path="/agency/health-check" element={agencyPage('healthCheck')} />
            <Route path="/agency/automation" element={agencyPage('automation')} />
            <Route path="/agency/settings" element={agencyPage('agencySettings')} />
          </Route>

          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/ai" element={<AIBookkeeping />} />
            <Route path="/notifications" element={businessPage('notificationCenter', '通知待办', '集中处理资料采集、AI确认、凭证异常、报表重算和申报截止提醒。')} />
            <Route path="/settings" element={businessPage('settingsData', '设置总览', '维护企业资料、期初、历史账簿、基础档案、匹配规则和权限。')} />

            {/* AI automation - AI 自动化框架 */}
            <Route path="/ai/jobs" element={businessPage('aiJobQueue', 'AI任务队列', '跟踪 OCR、流水分类、凭证建议、风险解释等 AI 异步任务状态。')} />
            <Route path="/ai/recognition" element={businessPage('aiRecognitionResults', '识别结果', '复核发票、流水、单据和附件的 AI 结构化识别结果与置信度。')} />
            <Route path="/ai/suggestions" element={businessPage('aiVoucherSuggestions', '凭证建议', '管理 AI 生成的凭证草稿、借贷分录、置信度、风险和人工确认状态。')} />
            <Route path="/ai/rules" element={businessPage('aiRuleTraining', '规则训练', '维护 AI 推荐规则、训练样本、命中率、版本和人工审核状态。')} />

            {/* Collection and file centers - 资料采集与文件中心 */}
            <Route path="/collection" element={<Navigate to="/invoices/output" replace />} />
            <Route path="/collection/invoices" element={<Navigate to="/invoices/output" replace />} />
            <Route path="/collection/bank" element={<Navigate to="/bills" replace />} />
            <Route path="/attachments" element={businessPage('attachmentCenter', '附件中心', '管理发票、回单、合同、申报回执和导出归档文件的关联与留痕。')} />
            <Route path="/imports" element={businessPage('importCenter', '导入历史', '统一查看 Excel、CSV、OFD、PDF 等导入批次、错误清单和处理结果。')} />
            <Route path="/downloads" element={businessPage('exportCenter', '下载中心', '统一管理 Excel、PDF、ZIP 导出任务、文件哈希、下载状态和归档期限。')} />

            {/* Business Processing - 业务处理 */}
            <Route path="/invoices/output" element={businessPage('outputInvoice', '销项发票', '管理销项发票、开票数据、税额汇总、凭证生成和导出。')} />
            <Route path="/invoices/selection" element={<Navigate to="/invoices/input" replace />} />
            <Route path="/invoices/input" element={businessPage('inputInvoice', '进项发票', '管理进项发票、税额抵扣、发票影像、供应商匹配和凭证草稿。')} />
            <Route path="/bills" element={businessPage('billList', '账单一览', '导入和匹配银行流水、回单、摘要分类、凭证草稿和附件。')} />
            <Route path="/bank" element={businessPage('billList', '银行账单', '处理银行流水、对账、回单归档、AI 分类和凭证生成。')} />
            <Route path="/receipts" element={businessPage('receipt', '票据', '登记承兑汇票、到期、背书、贴现和凭证联动。')} />
            <Route path="/documents" element={businessPage('documentRegister', '单据登记', '登记非发票业务单据、费用报销、采购入库和附件来源。')} />
            <Route path="/transfers" element={businessPage('transfer', '账户转账', '登记内部账户转账、手续费、回单和转账凭证。')} />
            <Route path="/employees" element={businessPage('employee', '人员登记', '维护员工档案、证件、部门、岗位和个税社保基础信息。')} />
            <Route path="/payroll" element={businessPage('payroll', '薪酬表', '导入和计算工资、个税、实发金额、工资凭证和申报数据。')} />
            <Route path="/social-security" element={businessPage('socialSecurity', '社保公积金', '维护社保公积金明细、单位个人部分、工资差异和凭证。')} />
            <Route path="/special-deductions" element={businessPage('specialDeduction', '专项附加扣除', '管理员工专项附加扣除、个税测算来源和异常资料。')} />
            <Route path="/depreciation" element={businessPage('depreciation', '折旧摊销', '维护固定资产折旧、摊销、清理、凭证和明细表导出。')} />
            <Route path="/inventory" element={businessPage('inventorySettings', '存货设置', '维护存货档案、规格型号、税率、默认科目和成本结转基础资料。')} />
            <Route path="/inventory/movements" element={businessPage('inventoryMovement', '出入库单', '登记采购入库、销售出库、其他出入库，联动发票、成本结转和凭证生成。')} />
            <Route path="/cost-carryover" element={businessPage('costCarryover', '成本结转', '按出库、存货计价和结转规则生成成本结转明细与凭证。')} />
            <Route path="/units" element={businessPage('unitSettings', '计量单位', '维护计量单位、换算组、精度和存货数量口径。')} />

            {/* Finance - 财务 */}
            <Route path="/vouchers" element={businessPage('voucher', '会计凭证', '管理凭证新增、审核、反审核、打印、导出、红冲、断号整理和批量处理。')} />
            <Route path="/vouchers/detail/:id" element={businessPage('voucher', '会计凭证详情', '查看凭证来源、分录、附件、审核日志、打印和导出。')} />
            <Route path="/bank/reconciliation" element={businessPage('bankReconciliation', '银行对账', '核对银行流水和账面凭证，管理未达账项、差异和对账回执。')} />
            <Route path="/aging" element={businessPage('receivablePayableAging', '往来账龄', '按客户、供应商和往来科目计算账龄、逾期金额和风险提示。')} />
            <Route path="/matching" element={businessPage('invoiceVoucherMatching', '票据凭证匹配', '核对发票、票据、流水与凭证之间的匹配关系、差异和置信度。')} />
            <Route path="/period-closing" element={businessPage('closingTasks', '期末结转', '执行增值税、附加税、折旧摊销、成本、所得税、损益和本年利润结转。')} />
            <Route path="/risk-check" element={businessPage('riskCheck', '风险检查', '执行凭证、发票、工资、报表、税表和结账前风险校验。')} />
            <Route path="/reports/trial-balance" element={businessPage('ledgerReport', '科目余额表', '按科目、辅助核算和期间展示期初、本期、累计和期末余额。')} />
            <Route path="/reports/account-summary" element={businessPage('ledgerReport', '科目汇总表', '按科目汇总本期借贷发生额，支持凭证穿透、导出和打印。')} />
            <Route path="/reports/general-ledger" element={businessPage('ledgerReport', '总账', '按科目展示月度汇总、方向、余额和凭证来源。')} />
            <Route path="/reports/subsidiary-ledger" element={businessPage('ledgerReport', '明细账', '按科目展示逐笔凭证明细、摘要、借贷方、方向和余额。')} />
            <Route path="/reports/auxiliary-ledger" element={businessPage('ledgerReport', '辅助核算账', '按客户、供应商、项目、部门、人员等辅助维度展示明细账。')} />
            <Route path="/reports/auxiliary-balance" element={businessPage('ledgerReport', '辅助余额表', '按辅助核算维度展示期初、本期、累计和期末余额。')} />
            <Route path="/reports/multi-column-ledger" element={businessPage('ledgerReport', '多栏账', '按费用、收入和成本类科目展示多栏式明细账。')} />

            {/* Reports - 报表 */}
            <Route path="/reports/balance-sheet" element={businessPage('financialReport', '资产负债表', '按会计准则生成资产、负债和所有者权益报表，支持取数说明和重分类。')} />
            <Route path="/reports/income-statement" element={businessPage('financialReport', '利润表', '生成月报利润表，支持本月、本年累计、公式说明、导出和打印。')} />
            <Route path="/reports/income-quarter" element={businessPage('financialReport', '利润表季报', '生成企业所得税申报使用的季度利润表和取数快照。')} />
            <Route path="/reports/cash-flow" element={businessPage('financialReport', '现金流量表', '生成现金流量表主表，支持项目映射、凭证穿透和导出。')} />
            <Route path="/reports/cash-flow-quarter" element={businessPage('financialReport', '现金流量表季报', '生成季度现金流量表和财报报送数据。')} />
            <Route path="/reports/equity-change" element={businessPage('financialReport', '所有者权益变动表', '生成所有者权益变动表，支持项目明细和报送快照。')} />

            {/* Tax Reports - 税务申报 */}
            <Route path="/tax/workspace" element={<TaxWorkspace />} />
            <Route path="/tax/calendar" element={businessPage('declarationCalendar', '申报日历', '按税种和所属期跟踪截止日期、负责人、取数状态、风险和下一步动作。')} />
            <Route path="/tax/vat" element={businessPage('taxReport', '增值税及附加', '生成增值税、附加税申报表，展示发票取数、留抵、抵扣和差异。')} />
            <Route path="/tax/withholding" element={businessPage('taxReport', '扣缴所得税', '根据薪酬表和专项附加扣除生成个税扣缴申报数据。')} />
            <Route path="/tax/stamp" element={businessPage('taxReport', '印花税', '根据合同、单据和业务台账生成印花税应税明细。')} />
            <Route path="/tax/income" element={businessPage('taxReport', '企业所得税', '生成企业所得税预缴、汇算取数和纳税调整说明。')} />
            <Route path="/tax/social-security" element={businessPage('taxReport', '社保费', '生成社保费申报清单，核对人员、基数、单位和个人部分。')} />
            <Route path="/tax/finance-report" element={businessPage('taxReport', '财报报送', '生成财报报送清单、取数快照、PDF/Excel 和申报附件。')} />
            <Route path="/tax/non-tax" element={businessPage('taxReport', '非税收入', '维护非税收入申报事项、缴费状态和回执归档。')} />
            <Route path="/tax/receipts" element={businessPage('declarationReceipt', '回执缴款书', '管理申报回执、缴款书、扣款状态、附件归档和异常留痕。')} />

            {/* Settings Sub-pages - 设置子页面 */}
            <Route path="/settings/company-info" element={businessPage('companyInfo', '企业信息', '维护纳税人识别号、税种认定、开户行、联系人和申报基础资料。')} />
            <Route path="/settings/initial-balances" element={businessPage('initialBalance', '期初余额', '录入科目和辅助核算期初余额，校验借贷平衡。')} />
            <Route path="/settings/tax-init" element={businessPage('taxInit', '申报初始化', '维护税种、申报周期、申报账号、税局 adapter 参数和申报口径。')} />
            <Route path="/settings/history-vouchers" element={businessPage('documentRegister', '历史凭证', '导入和查看历史凭证，支持断号检查、附件和科目映射。')} />
            <Route path="/settings/history-balances" element={businessPage('ledgerReport', '历史科目余额表', '导入历史科目余额表，形成期初和对账依据。')} />
            <Route path="/settings/history-general-ledger" element={businessPage('ledgerReport', '历史总账', '导入历史总账，支持科目映射和余额校验。')} />
            <Route path="/settings/history-subsidiary-ledger" element={businessPage('ledgerReport', '历史明细账', '导入历史明细账，支持凭证和科目穿透。')} />
            <Route path="/settings/accounts" element={businessPage('accountArchive', '账户登记', '维护银行账户、现金账户、第三方支付账户和默认科目。')} />
            <Route path="/settings/customers" element={businessPage('customerArchive', '客户', '维护客户编码、名称、税号、开户行、银行账号和默认科目。')} />
            <Route path="/settings/contracts" element={businessPage('contractLedger', '合同台账', '维护客户和供应商合同、应税合同、发票关联、印花税取数和附件归档。')} />
            <Route path="/settings/customers-contracts" element={businessPage('contractLedger', '客户与合同', '维护客户、合同和应税合同台账。')} />
            <Route path="/settings/suppliers" element={businessPage('supplierArchive', '供应商', '维护供应商编码、税号、银行账号、别名和默认科目。')} />
            <Route path="/settings/other-contacts" element={businessPage('otherContactArchive', '其他往来', '维护员工、股东、个人和其他往来辅助资料。')} />
            <Route path="/settings/projects" element={businessPage('projectArchive', '项目', '维护项目档案、项目辅助核算和默认科目。')} />
            <Route path="/settings/departments" element={businessPage('departmentArchive', '部门', '维护部门档案、部门核算和人员归属。')} />
            <Route path="/settings/tags" element={businessPage('tagArchive', '标签', '维护凭证、发票、流水和单据的业务标签。')} />
            <Route path="/settings/account-codes" element={businessPage('subjectSettings', '科目', '维护会计科目、辅助核算、余额方向和报表映射。')} />
            <Route path="/settings/asset-categories" element={businessPage('assetCategory', '资产类别', '维护资产类别、折旧年限、残值率和默认科目。')} />
            <Route path="/settings/invoice-rules" element={businessPage('invoiceMatchingRules', '发票自动匹配规则', '维护发票到科目、客户供应商、税率和凭证模板的自动匹配规则。')} />
            <Route path="/settings/bill-rules" element={businessPage('billMatchingRules', '账单自动匹配规则', '维护银行流水摘要、对方户名、金额区间和凭证模板规则。')} />
            <Route path="/settings/voucher-recycle" element={businessPage('voucherRecycle', '会计凭证回收箱', '查看已删除凭证、恢复、彻底删除和审计日志。')} />
            <Route path="/settings/auxiliary-categories" element={businessPage('auxiliaryCategories', '辅助核算类别', '维护客户、供应商、项目、部门、人员等辅助核算类别。')} />
            <Route path="/settings/auxiliary-items" element={businessPage('auxiliaryItems', '辅助核算项目', '维护各类辅助核算明细资料。')} />
            <Route path="/settings/common-digests" element={businessPage('commonDigests', '常用摘要', '维护凭证摘要模板和 AI 摘要推荐词库。')} />
            <Route path="/settings/voucher-templates" element={businessPage('voucherTemplateSettings', '凭证模板', '维护发票、流水、单据和 AI 建议生成凭证时使用的借贷科目模板。')} />
            <Route path="/settings/report-formulas" element={businessPage('reportFormulaSettings', '报表公式', '维护财务报表取数公式、重分类规则、公式版本和校验说明。')} />
            <Route path="/settings/cash-flow-mapping" element={businessPage('cashFlowMapping', '现金流量映射', '维护银行流水、凭证科目和现金流量表项目之间的映射规则。')} />
            <Route path="/settings/settlement-rules" element={businessPage('settlementRules', '结转规则', '维护期末结转、损益结转、税费计提和折旧摊销规则。')} />
            <Route path="/settings/currencies" element={businessPage('currencySettings', '币别管理', '维护币别、汇率、外币核算和折算规则。')} />
            <Route path="/settings/roles" element={businessPage('roleSettings', '权限管理', '维护角色、菜单权限、操作权限和审计范围。')} />
            <Route path="/settings/print-templates" element={businessPage('printTemplateSettings', '打印模板', '维护凭证纸、报表、申报包和附件归档的打印/PDF 模板版本。')} />
            <Route path="/settings/tax-adapters" element={businessPage('taxAdapterSettings', '税局接口配置', '维护合法税局 adapter 的地区、税种、授权状态、回执能力和提交边界。')} />
            <Route path="/settings/bank-adapters" element={businessPage('bankAdapterSettings', '银行接口配置', '维护银行流水采集、回单、对账能力和直连预留参数。')} />
            <Route path="/settings/period-management" element={businessPage('periodManagement', '结账管理', '管理账期结账、锁定、反结账申请、归档状态和高风险审批。')} />
            <Route path="/settings/audit-log" element={businessPage('auditLog', '审计日志', '集中查看导入导出、凭证、结账、申报和高风险操作留痕。')} />
            <Route path="/settings/backup-restore" element={businessPage('backupRestore', '备份恢复', '管理账套数据库、附件目录和迁移包的备份、校验和恢复记录。')} />
          </Route>

          {/* Voucher edit routes use the redesigned operating surface. */}
          <Route
            path="/vouchers/new"
            element={
              <ProtectedRoute>
                {businessPage('voucher', '新增会计凭证', '按竞品风格录入凭证表头、分录、辅助核算、附件和来源单据。')}
              </ProtectedRoute>
            }
          />
          <Route
            path="/vouchers/edit/:id"
            element={
              <ProtectedRoute>
                {businessPage('voucher', '编辑会计凭证', '按竞品风格维护凭证分录、审核状态、附件和操作日志。')}
              </ProtectedRoute>
            }
          />

          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}

export default App

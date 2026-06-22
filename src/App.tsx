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
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/ai" element={<AIBookkeeping />} />
            <Route path="/settings" element={businessPage('settingsData', '设置总览', '维护企业资料、期初、历史账簿、基础档案、匹配规则和权限。')} />

            {/* Business Processing - 业务处理 */}
            <Route path="/invoices/output" element={businessPage('outputInvoice', '销项发票', '管理销项发票、开票数据、税额汇总、凭证生成和导出。')} />
            <Route path="/invoices/selection" element={businessPage('invoiceSelection', '发票勾选', '维护进项发票勾选认证、抵扣用途、异常税率和凭证匹配。')} />
            <Route path="/invoices/input" element={businessPage('inputInvoice', '进项发票', '管理进项发票、税额抵扣、发票影像、供应商匹配和凭证草稿。')} />
            <Route path="/bills" element={businessPage('billList', '账单一览', '导入和匹配银行流水、回单、摘要分类、凭证草稿和附件。')} />
            <Route path="/bank" element={businessPage('billList', '银行账单', '处理银行流水采集、对账、回单归档、AI 分类和凭证生成。')} />
            <Route path="/receipts" element={businessPage('receipt', '票据', '登记承兑汇票、到期、背书、贴现和凭证联动。')} />
            <Route path="/documents" element={businessPage('documentRegister', '单据登记', '登记非发票业务单据、费用报销、采购入库和附件来源。')} />
            <Route path="/transfers" element={businessPage('transfer', '账户转账', '登记内部账户转账、手续费、回单和转账凭证。')} />
            <Route path="/employees" element={businessPage('employee', '人员登记', '维护员工档案、证件、部门、岗位和个税社保基础信息。')} />
            <Route path="/payroll" element={businessPage('payroll', '薪酬表', '导入和计算工资、个税、实发金额、工资凭证和申报数据。')} />
            <Route path="/social-security" element={businessPage('socialSecurity', '社保公积金', '维护社保公积金明细、单位个人部分、工资差异和凭证。')} />
            <Route path="/special-deductions" element={businessPage('specialDeduction', '专项附加扣除', '管理员工专项附加扣除、个税测算来源和异常资料。')} />
            <Route path="/depreciation" element={businessPage('depreciation', '折旧摊销', '维护固定资产折旧、摊销、清理、凭证和明细表导出。')} />
            <Route path="/inventory" element={businessPage('inventorySettings', '存货设置', '维护存货档案、规格型号、税率、默认科目和成本结转基础资料。')} />
            <Route path="/units" element={businessPage('unitSettings', '计量单位', '维护计量单位、换算组、精度和存货数量口径。')} />

            {/* Finance - 财务 */}
            <Route path="/vouchers" element={businessPage('voucher', '会计凭证', '管理凭证新增、审核、反审核、打印、导出、红冲、断号整理和批量处理。')} />
            <Route path="/vouchers/detail/:id" element={businessPage('voucher', '会计凭证详情', '查看凭证来源、分录、附件、审核日志、打印和导出。')} />
            <Route path="/period-closing" element={businessPage('riskCheck', '期末结转', '执行增值税、附加税、折旧摊销、成本、所得税、损益和本年利润结转。')} />
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
            <Route path="/tax/vat" element={businessPage('taxReport', '增值税及附加', '生成增值税、附加税申报表，展示发票取数、留抵、抵扣和差异。')} />
            <Route path="/tax/withholding" element={businessPage('taxReport', '扣缴所得税', '根据薪酬表和专项附加扣除生成个税扣缴申报数据。')} />
            <Route path="/tax/stamp" element={businessPage('taxReport', '印花税', '根据合同、单据和业务台账生成印花税应税明细。')} />
            <Route path="/tax/income" element={businessPage('taxReport', '企业所得税', '生成企业所得税预缴、汇算取数和纳税调整说明。')} />
            <Route path="/tax/social-security" element={businessPage('taxReport', '社保费', '生成社保费申报清单，核对人员、基数、单位和个人部分。')} />
            <Route path="/tax/finance-report" element={businessPage('taxReport', '财报报送', '生成财报报送清单、取数快照、PDF/Excel 和申报附件。')} />
            <Route path="/tax/non-tax" element={businessPage('taxReport', '非税收入', '维护非税收入申报事项、缴费状态和回执归档。')} />

            {/* Settings Sub-pages - 设置子页面 */}
            <Route path="/settings/company-info" element={businessPage('settingsData', '企业信息', '维护纳税人识别号、税种认定、开户行、联系人和申报基础资料。')} />
            <Route path="/settings/initial-balances" element={businessPage('settingsData', '期初余额', '录入科目和辅助核算期初余额，校验借贷平衡。')} />
            <Route path="/settings/tax-init" element={businessPage('settingsData', '申报初始化', '维护税种、申报周期、申报账号、税局 adapter 参数和申报口径。')} />
            <Route path="/settings/history-vouchers" element={businessPage('documentRegister', '历史凭证', '导入和查看历史凭证，支持断号检查、附件和科目映射。')} />
            <Route path="/settings/history-balances" element={businessPage('ledgerReport', '历史科目余额表', '导入历史科目余额表，形成期初和对账依据。')} />
            <Route path="/settings/history-general-ledger" element={businessPage('ledgerReport', '历史总账', '导入历史总账，支持科目映射和余额校验。')} />
            <Route path="/settings/history-subsidiary-ledger" element={businessPage('ledgerReport', '历史明细账', '导入历史明细账，支持凭证和科目穿透。')} />
            <Route path="/settings/accounts" element={businessPage('settingsData', '账户登记', '维护银行账户、现金账户、第三方支付账户和默认科目。')} />
            <Route path="/settings/customers" element={businessPage('settingsData', '客户', '维护客户编码、名称、税号、开户行、银行账号和默认科目。')} />
            <Route path="/settings/customers-contracts" element={businessPage('settingsData', '客户与合同', '维护客户、合同和应税合同台账。')} />
            <Route path="/settings/suppliers" element={businessPage('settingsData', '供应商', '维护供应商编码、税号、银行账号、别名和默认科目。')} />
            <Route path="/settings/other-contacts" element={businessPage('settingsData', '其他往来', '维护员工、股东、个人和其他往来辅助资料。')} />
            <Route path="/settings/projects" element={businessPage('settingsData', '项目', '维护项目档案、项目辅助核算和默认科目。')} />
            <Route path="/settings/departments" element={businessPage('settingsData', '部门', '维护部门档案、部门核算和人员归属。')} />
            <Route path="/settings/tags" element={businessPage('settingsData', '标签', '维护凭证、发票、流水和单据的业务标签。')} />
            <Route path="/settings/account-codes" element={businessPage('settingsData', '科目', '维护会计科目、辅助核算、余额方向和报表映射。')} />
            <Route path="/settings/asset-categories" element={businessPage('settingsData', '资产类别', '维护资产类别、折旧年限、残值率和默认科目。')} />
            <Route path="/settings/invoice-rules" element={businessPage('matchingRules', '发票自动匹配规则', '维护发票到科目、客户供应商、税率和凭证模板的自动匹配规则。')} />
            <Route path="/settings/bill-rules" element={businessPage('matchingRules', '账单自动匹配规则', '维护银行流水摘要、对方户名、金额区间和凭证模板规则。')} />
            <Route path="/settings/voucher-recycle" element={businessPage('documentRegister', '会计凭证回收箱', '查看已删除凭证、恢复、彻底删除和审计日志。')} />
            <Route path="/settings/auxiliary-categories" element={businessPage('settingsData', '辅助核算类别', '维护客户、供应商、项目、部门、人员等辅助核算类别。')} />
            <Route path="/settings/auxiliary-items" element={businessPage('settingsData', '辅助核算项目', '维护各类辅助核算明细资料。')} />
            <Route path="/settings/common-digests" element={businessPage('settingsData', '常用摘要', '维护凭证摘要模板和 AI 摘要推荐词库。')} />
            <Route path="/settings/settlement-rules" element={businessPage('matchingRules', '结转规则', '维护期末结转、损益结转、税费计提和折旧摊销规则。')} />
            <Route path="/settings/currencies" element={businessPage('settingsData', '币别管理', '维护币别、汇率、外币核算和折算规则。')} />
            <Route path="/settings/roles" element={businessPage('settingsData', '权限管理', '维护角色、菜单权限、操作权限和审计范围。')} />
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

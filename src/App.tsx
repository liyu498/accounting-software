import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { LoginPage } from './pages/LoginPage'
import { Dashboard } from './pages/Dashboard'
import { Welcome } from './pages/Welcome'
import { VoucherList } from './pages/VoucherList'
import { VoucherEditor } from './pages/VoucherEditor'
import { VoucherDetail } from './pages/VoucherDetail'
import { OutputInvoices } from './pages/invoices/OutputInvoices'
import { InputInvoices } from './pages/invoices/InputInvoices'
import { InventoryList } from './pages/InventoryList'
import { BankReconciliation } from './pages/BankReconciliation'
import { AIBookkeeping } from './pages/AIBookkeeping'
import { Settings } from './pages/Settings'
import { AppShell } from './components/layout/AppShell'
import { ToastProvider } from './components/ui/Toast'
import { GeneralLedger } from './pages/reports/GeneralLedger'
import { SubsidiaryLedger } from './pages/reports/SubsidiaryLedger'
import { TrialBalance } from './pages/reports/TrialBalance'
import { AccountSummary } from './pages/reports/AccountSummary'
import { BalanceSheet } from './pages/reports/BalanceSheet'
import { IncomeStatement } from './pages/reports/IncomeStatement'
import { CashFlowStatement } from './pages/reports/CashFlowStatement'
import { EquityChange } from './pages/reports/EquityChange'
import { PeriodClosing } from './pages/reports/PeriodClosing'
import { CustomerContracts } from './pages/settings/CustomerContracts'
import { CompanyInfo } from './pages/settings/CompanyInfo'
import { VoucherRecycle } from './pages/settings/VoucherRecycle'
import { InitialBalances } from './pages/settings/InitialBalances'
import { ImportHistory } from './pages/settings/ImportHistory'
import { AccountRegistration } from './pages/settings/AccountRegistration'
import { Suppliers } from './pages/settings/Suppliers'
import { OtherContacts } from './pages/settings/OtherContacts'
import { AccountCodes } from './pages/settings/AccountCodes'
import { AuxiliaryCategories } from './pages/settings/AuxiliaryCategories'
import { AuxiliaryItems } from './pages/settings/AuxiliaryItems'
import { AuxiliaryLedger } from './pages/reports/AuxiliaryLedger'
import { AuxiliaryBalance } from './pages/reports/AuxiliaryBalance'
import { MultiColumnLedger } from './pages/reports/MultiColumnLedger'
import { CommonDigests } from './pages/settings/CommonDigests'
import { SettlementRules } from './pages/settings/SettlementRules'
import { CurrencyManager } from './pages/settings/CurrencyManager'
import { RoleManager } from './pages/settings/RoleManager'

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

// Placeholder for coming soon features
function ComingSoon({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🚧</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{name}</h2>
        <p className="text-gray-500">功能开发中，敬请期待...</p>
      </div>
    </div>
  )
}

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
            <Route path="/settings" element={<Settings />} />

            {/* Business Processing - 业务处理 */}
            <Route path="/invoices/output" element={<OutputInvoices />} />
            <Route path="/invoices/input" element={<InputInvoices />} />
            <Route path="/inventory" element={<InventoryList />} />
            <Route path="/bank" element={<BankReconciliation />} />

            {/* Finance - 财务 */}
            <Route path="/vouchers" element={<VoucherList />} />
            <Route path="/vouchers/detail/:id" element={<VoucherDetail />} />
            <Route path="/period-closing" element={<PeriodClosing />} />
            <Route path="/reports/trial-balance" element={<TrialBalance />} />
            <Route path="/reports/account-summary" element={<AccountSummary />} />
            <Route path="/reports/general-ledger" element={<GeneralLedger />} />
            <Route path="/reports/subsidiary-ledger" element={<SubsidiaryLedger />} />
            <Route path="/reports/auxiliary-ledger" element={<AuxiliaryLedger />} />
            <Route path="/reports/auxiliary-balance" element={<AuxiliaryBalance />} />
            <Route path="/reports/multi-column-ledger" element={<MultiColumnLedger />} />

            {/* Reports - 报表 */}
            <Route path="/reports/balance-sheet" element={<BalanceSheet />} />
            <Route path="/reports/income-statement" element={<IncomeStatement />} />
            <Route path="/reports/cash-flow" element={<CashFlowStatement />} />
            <Route path="/reports/equity-change" element={<EquityChange />} />

            {/* Tax Reports - 税务报表 (预留) */}
            <Route path="/tax/vat" element={<ComingSoon name="增值税" />} />
            <Route path="/tax/stamp" element={<ComingSoon name="印花税" />} />
            <Route path="/tax/income" element={<ComingSoon name="企业所得税" />} />
            <Route path="/tax/finance-report" element={<ComingSoon name="财报" />} />
            <Route path="/tax/non-tax" element={<ComingSoon name="非税收入" />} />

            {/* Settings Sub-pages - 设置子页面 */}
            <Route path="/settings/company-info" element={<CompanyInfo />} />
            <Route path="/settings/initial-balances" element={<InitialBalances />} />
            <Route path="/settings/import-history" element={<ImportHistory />} />
            <Route path="/settings/accounts" element={<AccountRegistration />} />
            <Route path="/settings/customers-contracts" element={<CustomerContracts />} />
            <Route path="/settings/suppliers" element={<Suppliers />} />
            <Route path="/settings/other-contacts" element={<OtherContacts />} />
            <Route path="/settings/account-codes" element={<AccountCodes />} />
            <Route path="/settings/voucher-recycle" element={<VoucherRecycle />} />
            <Route path="/settings/auxiliary-categories" element={<AuxiliaryCategories />} />
            <Route path="/settings/auxiliary-items" element={<AuxiliaryItems />} />
            <Route path="/settings/common-digests" element={<CommonDigests />} />
            <Route path="/settings/settlement-rules" element={<SettlementRules />} />
            <Route path="/settings/currencies" element={<CurrencyManager />} />
            <Route path="/settings/roles" element={<RoleManager />} />
          </Route>

          {/* Fullscreen voucher editor — outside AppShell */}
          <Route
            path="/vouchers/new"
            element={
              <ProtectedRoute>
                <VoucherEditor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vouchers/edit/:id"
            element={
              <ProtectedRoute>
                <VoucherEditor />
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

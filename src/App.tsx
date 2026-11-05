import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { useAuthStore } from './stores/authStore'
import { LoginPage } from './pages/LoginPage'
import { Dashboard } from './pages/Dashboard'
import { Welcome } from './pages/Welcome'
import { AppShell } from './components/layout/AppShell'
import { ToastProvider } from './components/ui/Toast'
import type { AgencyModuleKind } from './pages/agency/AgencyModulePage'
import { AgencyLayout } from './pages/agency/AgencyLayout'
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
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

const DeclarationCalendarWorkspace = lazy(() => import('./pages/tax/DeclarationCalendarWorkspace').then(({ DeclarationCalendarWorkspace }) => ({ default: DeclarationCalendarWorkspace })))
const BankReconciliationWorkspace = lazy(() =>
  import('./pages/operations/BankReconciliationWorkspace').then(({ BankReconciliationWorkspace }) => ({
    default: BankReconciliationWorkspace
  }))
)
const BankStatementWorkspace = lazy(() => import('./pages/operations/BankStatementWorkspace').then(({ BankStatementWorkspace }) => ({ default: BankStatementWorkspace })))
const DocumentRegisterWorkspace = lazy(() => import('./pages/operations/DocumentRegisterWorkspace').then(({ DocumentRegisterWorkspace }) => ({ default: DocumentRegisterWorkspace })))
const BillListWorkspace = lazy(() => import('./pages/operations/BillListWorkspace').then(({ BillListWorkspace }) => ({ default: BillListWorkspace })))
const NotificationCenterWorkspace = lazy(() => import('./pages/operations/SystemHubWorkspace').then(({ NotificationCenterWorkspace }) => ({ default: NotificationCenterWorkspace })))
const SettingsOverviewWorkspace = lazy(() => import('./pages/operations/SystemHubWorkspace').then(({ SettingsOverviewWorkspace }) => ({ default: SettingsOverviewWorkspace })))
const InitialBalanceWorkspace = lazy(() => import('./pages/operations/InitializationWorkspace').then(({ InitialBalanceWorkspace }) => ({ default: InitialBalanceWorkspace })))
const TaxInitializationWorkspace = lazy(() => import('./pages/operations/InitializationWorkspace').then(({ TaxInitializationWorkspace }) => ({ default: TaxInitializationWorkspace })))
const HistoryVoucherWorkspace = lazy(() => import('./pages/operations/HistoryMigrationWorkspace').then(({ HistoryVoucherWorkspace }) => ({ default: HistoryVoucherWorkspace })))
const HistoryBalanceWorkspace = lazy(() => import('./pages/operations/HistoryMigrationWorkspace').then(({ HistoryBalanceWorkspace }) => ({ default: HistoryBalanceWorkspace })))
const HistoryGeneralLedgerWorkspace = lazy(() => import('./pages/operations/HistoryMigrationWorkspace').then(({ HistoryGeneralLedgerWorkspace }) => ({ default: HistoryGeneralLedgerWorkspace })))
const HistorySubsidiaryLedgerWorkspace = lazy(() => import('./pages/operations/HistoryMigrationWorkspace').then(({ HistorySubsidiaryLedgerWorkspace }) => ({ default: HistorySubsidiaryLedgerWorkspace })))
const VoucherCreateWorkspace = lazy(() => import('./pages/operations/VoucherEntryWorkspace').then(({ VoucherCreateWorkspace }) => ({ default: VoucherCreateWorkspace })))
const VoucherEditWorkspace = lazy(() => import('./pages/operations/VoucherEntryWorkspace').then(({ VoucherEditWorkspace }) => ({ default: VoucherEditWorkspace })))
const ContractLedgerWorkspace = lazy(() => import('./pages/operations/ContractLedgerWorkspace').then(({ ContractLedgerWorkspace }) => ({ default: ContractLedgerWorkspace })))
const BusinessTagWorkspace = lazy(() => import('./pages/operations/BusinessTagWorkspace').then(({ BusinessTagWorkspace }) => ({ default: BusinessTagWorkspace })))
const VoucherRecycleWorkspace = lazy(() => import('./pages/operations/VoucherRecycleWorkspace').then(({ VoucherRecycleWorkspace }) => ({ default: VoucherRecycleWorkspace })))
const CompanyInfoWorkspace = lazy(() => import('./pages/operations/CompanyInfoWorkspace').then(({ CompanyInfoWorkspace }) => ({ default: CompanyInfoWorkspace })))
const AuditLogWorkspace = lazy(() => import('./pages/operations/AuditLogWorkspace').then(({ AuditLogWorkspace }) => ({ default: AuditLogWorkspace })))
const BackupRestoreWorkspace = lazy(() => import('./pages/operations/BackupRestoreWorkspace').then(({ BackupRestoreWorkspace }) => ({ default: BackupRestoreWorkspace })))
const PrintTemplateWorkspace = lazy(() => import('./pages/operations/PrintTemplateWorkspace').then(({ PrintTemplateWorkspace }) => ({ default: PrintTemplateWorkspace })))
const VoucherWorkspace = lazy(() => import('./pages/operations/VoucherWorkspace').then(({ VoucherWorkspace }) => ({ default: VoucherWorkspace })))
const ClosingTasksWorkspace = lazy(() => import('./pages/operations/ClosingTasksWorkspace').then(({ ClosingTasksWorkspace }) => ({ default: ClosingTasksWorkspace })))
const VoucherDetailWorkspace = lazy(() => import('./pages/operations/VoucherDetailWorkspace').then(({ VoucherDetailWorkspace }) => ({ default: VoucherDetailWorkspace })))
const RiskCheckWorkspace = lazy(() => import('./pages/operations/RiskCheckWorkspace').then(({ RiskCheckWorkspace }) => ({ default: RiskCheckWorkspace })))
const InvoiceVoucherMatchingWorkspace = lazy(() => import('./pages/operations/InvoiceVoucherMatchingWorkspace').then(({ InvoiceVoucherMatchingWorkspace }) => ({ default: InvoiceVoucherMatchingWorkspace })))
const AgingWorkspace = lazy(() => import('./pages/operations/AgingWorkspace').then(({ AgingWorkspace }) => ({ default: AgingWorkspace })))
const LedgerOverviewWorkspace = lazy(() => import('./pages/operations/LedgerReportWorkspace').then(({ LedgerOverviewWorkspace }) => ({ default: LedgerOverviewWorkspace })))
const TrialBalanceWorkspace = lazy(() => import('./pages/operations/LedgerReportWorkspace').then(({ TrialBalanceWorkspace }) => ({ default: TrialBalanceWorkspace })))
const AccountSummaryWorkspace = lazy(() => import('./pages/operations/LedgerReportWorkspace').then(({ AccountSummaryWorkspace }) => ({ default: AccountSummaryWorkspace })))
const GeneralLedgerWorkspace = lazy(() => import('./pages/operations/LedgerReportWorkspace').then(({ GeneralLedgerWorkspace }) => ({ default: GeneralLedgerWorkspace })))
const MultiColumnLedgerWorkspace = lazy(() => import('./pages/operations/LedgerReportWorkspace').then(({ MultiColumnLedgerWorkspace }) => ({ default: MultiColumnLedgerWorkspace })))
const SubsidiaryLedgerWorkspace = lazy(() => import('./pages/operations/LedgerDetailWorkspace').then(({ SubsidiaryLedgerWorkspace }) => ({ default: SubsidiaryLedgerWorkspace })))
const AuxiliaryLedgerWorkspace = lazy(() => import('./pages/operations/LedgerDetailWorkspace').then(({ AuxiliaryLedgerWorkspace }) => ({ default: AuxiliaryLedgerWorkspace })))
const AuxiliaryBalanceWorkspace = lazy(() => import('./pages/operations/LedgerDetailWorkspace').then(({ AuxiliaryBalanceWorkspace }) => ({ default: AuxiliaryBalanceWorkspace })))
const FinancialOverviewWorkspace = lazy(() => import('./pages/operations/FinancialStatementWorkspace').then(({ FinancialOverviewWorkspace }) => ({ default: FinancialOverviewWorkspace })))
const BalanceSheetWorkspace = lazy(() => import('./pages/operations/FinancialStatementWorkspace').then(({ BalanceSheetWorkspace }) => ({ default: BalanceSheetWorkspace })))
const IncomeStatementWorkspace = lazy(() => import('./pages/operations/FinancialStatementWorkspace').then(({ IncomeStatementWorkspace }) => ({ default: IncomeStatementWorkspace })))
const IncomeQuarterWorkspace = lazy(() => import('./pages/operations/FinancialStatementWorkspace').then(({ IncomeQuarterWorkspace }) => ({ default: IncomeQuarterWorkspace })))
const CashFlowWorkspace = lazy(() => import('./pages/operations/FinancialStatementWorkspace').then(({ CashFlowWorkspace }) => ({ default: CashFlowWorkspace })))
const CashFlowQuarterWorkspace = lazy(() => import('./pages/operations/FinancialStatementWorkspace').then(({ CashFlowQuarterWorkspace }) => ({ default: CashFlowQuarterWorkspace })))
const EquityChangeWorkspace = lazy(() => import('./pages/operations/FinancialStatementWorkspace').then(({ EquityChangeWorkspace }) => ({ default: EquityChangeWorkspace })))
const TaxReportOverviewWorkspace = lazy(() => import('./pages/tax/TaxReportWorkspace').then(({ TaxReportOverviewWorkspace }) => ({ default: TaxReportOverviewWorkspace })))
const VatTaxReportWorkspace = lazy(() => import('./pages/tax/TaxReportWorkspace').then(({ VatTaxReportWorkspace }) => ({ default: VatTaxReportWorkspace })))
const WithholdingTaxReportWorkspace = lazy(() => import('./pages/tax/TaxReportWorkspace').then(({ WithholdingTaxReportWorkspace }) => ({ default: WithholdingTaxReportWorkspace })))
const StampTaxReportWorkspace = lazy(() => import('./pages/tax/TaxReportWorkspace').then(({ StampTaxReportWorkspace }) => ({ default: StampTaxReportWorkspace })))
const IncomeTaxReportWorkspace = lazy(() => import('./pages/tax/TaxReportWorkspace').then(({ IncomeTaxReportWorkspace }) => ({ default: IncomeTaxReportWorkspace })))
const SocialSecurityTaxReportWorkspace = lazy(() => import('./pages/tax/TaxReportWorkspace').then(({ SocialSecurityTaxReportWorkspace }) => ({ default: SocialSecurityTaxReportWorkspace })))
const FinanceTaxReportWorkspace = lazy(() => import('./pages/tax/TaxReportWorkspace').then(({ FinanceTaxReportWorkspace }) => ({ default: FinanceTaxReportWorkspace })))
const NonTaxRevenueReportWorkspace = lazy(() => import('./pages/tax/TaxReportWorkspace').then(({ NonTaxRevenueReportWorkspace }) => ({ default: NonTaxRevenueReportWorkspace })))
const DeclarationReceiptWorkspace = lazy(() => import('./pages/tax/TaxReportWorkspace').then(({ DeclarationReceiptWorkspace }) => ({ default: DeclarationReceiptWorkspace })))
const AiJobQueueWorkspace = lazy(() => import('./pages/operations/AiOperationsWorkspace').then(({ AiJobQueueWorkspace }) => ({ default: AiJobQueueWorkspace })))
const AiRecognitionWorkspace = lazy(() => import('./pages/operations/AiOperationsWorkspace').then(({ AiRecognitionWorkspace }) => ({ default: AiRecognitionWorkspace })))
const AiVoucherSuggestionWorkspace = lazy(() => import('./pages/operations/AiOperationsWorkspace').then(({ AiVoucherSuggestionWorkspace }) => ({ default: AiVoucherSuggestionWorkspace })))
const AiRuleTrainingWorkspace = lazy(() => import('./pages/operations/AiOperationsWorkspace').then(({ AiRuleTrainingWorkspace }) => ({ default: AiRuleTrainingWorkspace })))
const AttachmentCenterWorkspace = lazy(() => import('./pages/operations/FileCenterWorkspace').then(({ AttachmentCenterWorkspace }) => ({ default: AttachmentCenterWorkspace })))
const ImportHistoryWorkspace = lazy(() => import('./pages/operations/FileCenterWorkspace').then(({ ImportHistoryWorkspace }) => ({ default: ImportHistoryWorkspace })))
const DownloadCenterWorkspace = lazy(() => import('./pages/operations/FileCenterWorkspace').then(({ DownloadCenterWorkspace }) => ({ default: DownloadCenterWorkspace })))
const ReceiptWorkspace = lazy(() => import('./pages/operations/DocumentBusinessWorkspace').then(({ ReceiptWorkspace }) => ({ default: ReceiptWorkspace })))
const ExpenseReimbursementWorkspace = lazy(() => import('./pages/operations/DocumentBusinessWorkspace').then(({ ExpenseReimbursementWorkspace }) => ({ default: ExpenseReimbursementWorkspace })))
const PurchaseManagementWorkspace = lazy(() =>
  import('./pages/operations/PurchaseManagementWorkspace').then(({ PurchaseManagementWorkspace }) => ({
    default: PurchaseManagementWorkspace
  }))
)
const SalesManagementWorkspace = lazy(() => import('./pages/operations/SalesManagementWorkspace').then(({ SalesManagementWorkspace }) => ({ default: SalesManagementWorkspace })))
const ReceivableSettlementWorkspace = lazy(() =>
  import('./pages/operations/ReceivableSettlementWorkspace').then(({ ReceivableSettlementWorkspace }) => ({
    default: ReceivableSettlementWorkspace
  }))
)
const PayableSettlementWorkspace = lazy(() =>
  import('./pages/operations/PayableSettlementWorkspace').then(({ PayableSettlementWorkspace }) => ({
    default: PayableSettlementWorkspace
  }))
)
const ReceivableSummaryWorkspace = lazy(() => import('./pages/operations/CounterpartyReportWorkspace').then(({ ReceivableSummaryWorkspace }) => ({ default: ReceivableSummaryWorkspace })))
const ReceivableDetailWorkspace = lazy(() => import('./pages/operations/CounterpartyReportWorkspace').then(({ ReceivableDetailWorkspace }) => ({ default: ReceivableDetailWorkspace })))
const PayableSummaryWorkspace = lazy(() => import('./pages/operations/CounterpartyReportWorkspace').then(({ PayableSummaryWorkspace }) => ({ default: PayableSummaryWorkspace })))
const PayableDetailWorkspace = lazy(() => import('./pages/operations/CounterpartyReportWorkspace').then(({ PayableDetailWorkspace }) => ({ default: PayableDetailWorkspace })))
const OperatingStatusWorkspace = lazy(() => import('./pages/operations/OperatingAnalysisWorkspace').then(({ OperatingStatusWorkspace }) => ({ default: OperatingStatusWorkspace })))
const OperatingPerformanceWorkspace = lazy(() => import('./pages/operations/OperatingAnalysisWorkspace').then(({ OperatingPerformanceWorkspace }) => ({ default: OperatingPerformanceWorkspace })))
const AccountTransferWorkspace = lazy(() => import('./pages/operations/AccountTransferWorkspace').then(({ AccountTransferWorkspace }) => ({ default: AccountTransferWorkspace })))
const InventoryMovementWorkspace = lazy(() =>
  import('./pages/operations/InventoryMovementWorkspace').then(({ InventoryMovementWorkspace }) => ({
    default: InventoryMovementWorkspace
  }))
)
const CostCarryoverWorkspace = lazy(() => import('./pages/operations/CostCarryoverWorkspace').then(({ CostCarryoverWorkspace }) => ({ default: CostCarryoverWorkspace })))
const FixedAssetWorkspace = lazy(() => import('./pages/operations/FixedAssetWorkspace').then(({ FixedAssetWorkspace }) => ({ default: FixedAssetWorkspace })))
const InventoryMasterWorkspace = lazy(() => import('./pages/operations/InventoryMasterWorkspace').then(({ InventoryMasterWorkspace }) => ({ default: InventoryMasterWorkspace })))
const InventoryOpeningWorkspace = lazy(() => import('./pages/operations/InventoryOpeningWorkspace').then(({ InventoryOpeningWorkspace }) => ({ default: InventoryOpeningWorkspace })))
const InventoryStocktakeWorkspace = lazy(() => import('./pages/operations/InventoryStocktakeWorkspace').then(({ InventoryStocktakeWorkspace }) => ({ default: InventoryStocktakeWorkspace })))
const MeasurementUnitWorkspace = lazy(() => import('./pages/operations/MeasurementUnitWorkspace').then(({ MeasurementUnitWorkspace }) => ({ default: MeasurementUnitWorkspace })))
const AccountCodeWorkspace = lazy(() => import('./pages/operations/AccountCodeWorkspace').then(({ AccountCodeWorkspace }) => ({ default: AccountCodeWorkspace })))
const AssetCategoryWorkspace = lazy(() => import('./pages/operations/AssetCategoryWorkspace').then(({ AssetCategoryWorkspace }) => ({ default: AssetCategoryWorkspace })))
const PeriodManagementWorkspace = lazy(() => import('./pages/operations/PeriodManagementWorkspace').then(({ PeriodManagementWorkspace }) => ({ default: PeriodManagementWorkspace })))
const CurrencyWorkspace = lazy(() => import('./pages/operations/CurrencyWorkspace').then(({ CurrencyWorkspace }) => ({ default: CurrencyWorkspace })))
const AuxiliaryCategoryWorkspace = lazy(() => import('./pages/operations/AuxiliaryWorkspace').then(({ AuxiliaryCategoryWorkspace }) => ({ default: AuxiliaryCategoryWorkspace })))
const AuxiliaryItemWorkspace = lazy(() => import('./pages/operations/AuxiliaryWorkspace').then(({ AuxiliaryItemWorkspace }) => ({ default: AuxiliaryItemWorkspace })))
const SettlementRuleWorkspace = lazy(() => import('./pages/operations/SettlementRuleWorkspace').then(({ SettlementRuleWorkspace }) => ({ default: SettlementRuleWorkspace })))
const InvoiceMatchingRuleWorkspace = lazy(() => import('./pages/operations/MatchingRuleWorkspace').then(({ InvoiceMatchingRuleWorkspace }) => ({ default: InvoiceMatchingRuleWorkspace })))
const BillMatchingRuleWorkspace = lazy(() => import('./pages/operations/MatchingRuleWorkspace').then(({ BillMatchingRuleWorkspace }) => ({ default: BillMatchingRuleWorkspace })))
const CashFlowMappingWorkspace = lazy(() => import('./pages/operations/MatchingRuleWorkspace').then(({ CashFlowMappingWorkspace }) => ({ default: CashFlowMappingWorkspace })))
const EquityChangeMappingWorkspace = lazy(() => import('./pages/operations/MatchingRuleWorkspace').then(({ EquityChangeMappingWorkspace }) => ({ default: EquityChangeMappingWorkspace })))
const ReportFormulaWorkspace = lazy(() => import('./pages/operations/ReportFormulaWorkspace').then(({ ReportFormulaWorkspace }) => ({ default: ReportFormulaWorkspace })))
const TaxAdapterWorkspace = lazy(() => import('./pages/operations/AdapterAuthorizationWorkspace').then(({ TaxAdapterWorkspace }) => ({ default: TaxAdapterWorkspace })))
const BankAdapterWorkspace = lazy(() => import('./pages/operations/AdapterAuthorizationWorkspace').then(({ BankAdapterWorkspace }) => ({ default: BankAdapterWorkspace })))
const CustomerArchiveWorkspace = lazy(() => import('./pages/operations/ArchiveProfileWorkspace').then(({ CustomerArchiveWorkspace }) => ({ default: CustomerArchiveWorkspace })))
const SupplierArchiveWorkspace = lazy(() => import('./pages/operations/ArchiveProfileWorkspace').then(({ SupplierArchiveWorkspace }) => ({ default: SupplierArchiveWorkspace })))
const OtherContactArchiveWorkspace = lazy(() => import('./pages/operations/ArchiveProfileWorkspace').then(({ OtherContactArchiveWorkspace }) => ({ default: OtherContactArchiveWorkspace })))
const ProjectArchiveWorkspace = lazy(() => import('./pages/operations/ArchiveProfileWorkspace').then(({ ProjectArchiveWorkspace }) => ({ default: ProjectArchiveWorkspace })))
const DepartmentArchiveWorkspace = lazy(() => import('./pages/operations/ArchiveProfileWorkspace').then(({ DepartmentArchiveWorkspace }) => ({ default: DepartmentArchiveWorkspace })))
const CompanyAccountWorkspace = lazy(() => import('./pages/operations/CompanyAccountWorkspace').then(({ CompanyAccountWorkspace }) => ({ default: CompanyAccountWorkspace })))
const CommonDigestWorkspace = lazy(() => import('./pages/operations/TemplateSettingsWorkspace').then(({ CommonDigestWorkspace }) => ({ default: CommonDigestWorkspace })))
const VoucherTemplateWorkspace = lazy(() => import('./pages/operations/TemplateSettingsWorkspace').then(({ VoucherTemplateWorkspace }) => ({ default: VoucherTemplateWorkspace })))
const OutputInvoiceWorkspace = lazy(() => import('./pages/operations/OutputInvoiceWorkspace').then(({ OutputInvoiceWorkspace }) => ({ default: OutputInvoiceWorkspace })))
const InputInvoiceWorkspace = lazy(() => import('./pages/operations/InputInvoiceWorkspace').then(({ InputInvoiceWorkspace }) => ({ default: InputInvoiceWorkspace })))
const EmployeeWorkspace = lazy(() => import('./pages/operations/EmployeeWorkspace').then(({ EmployeeWorkspace }) => ({ default: EmployeeWorkspace })))
const PayrollWorkspace = lazy(() => import('./pages/operations/PayrollWorkspace').then(({ PayrollWorkspace }) => ({ default: PayrollWorkspace })))
const SocialSecurityWorkspace = lazy(() => import('./pages/operations/SocialSecurityWorkspace').then(({ SocialSecurityWorkspace }) => ({ default: SocialSecurityWorkspace })))
const SpecialDeductionWorkspace = lazy(() => import('./pages/operations/SpecialDeductionWorkspace').then(({ SpecialDeductionWorkspace }) => ({ default: SpecialDeductionWorkspace })))
const TaxWorkspace = lazy(() =>
  import('./pages/tax/TaxWorkspace').then(({ TaxWorkspace }) => ({
    default: TaxWorkspace
  }))
)
const AgencyModulePage = lazy(() =>
  import('./pages/agency/AgencyModulePage').then(({ AgencyModulePage }) => ({
    default: AgencyModulePage
  }))
)

const agencyPage = (kind: AgencyModuleKind) => <AgencyModulePage kind={kind} />

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="min-h-screen bg-slate-50 dark:bg-[#0d0d0d]" role="status">
              <span className="sr-only">正在加载</span>
            </div>
          }
        >
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
              <Route path="/agency/accounts" element={<Navigate to="/" replace />} />
              <Route path="/agency/authorizations" element={agencyPage('authorizationCenter')} />
              <Route path="/agency/service-contracts" element={agencyPage('serviceContracts')} />
              <Route path="/agency/fees" element={<Navigate to="/agency/service-contracts" replace />} />
              <Route path="/agency/fee-collection" element={<Navigate to="/agency/service-contracts" replace />} />
              <Route path="/agency/collaboration" element={<Navigate to="/agency/service-contracts" replace />} />
              <Route path="/agency/customer-collaboration" element={<Navigate to="/agency/service-contracts" replace />} />
              <Route path="/agency/batch-tax" element={<Navigate to="/agency/batch-ops" replace />} />
              <Route path="/agency/declaration-receipts" element={<Navigate to="/agency/batch-ops" replace />} />
              <Route path="/agency/approvals" element={<Navigate to="/agency/batch-ops" replace />} />
              <Route path="/agency/downloads" element={agencyPage('downloadCenter')} />
              <Route path="/agency/data-stats" element={agencyPage('dataStats')} />
              <Route path="/agency/batch-ops" element={agencyPage('batchOps')} />
              <Route path="/agency/invoice-management" element={agencyPage('invoiceManagement')} />
              <Route path="/agency/health-check" element={agencyPage('healthCheck')} />
              <Route path="/agency/automation" element={agencyPage('automation')} />
              <Route path="/agency/permissions" element={<RoleManager scope="agency" />} />
              <Route path="/agency/settings" element={<Navigate to="/agency/service-contracts" replace />} />
            </Route>

            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/ai" element={<Navigate to="/ai/jobs" replace />} />
              <Route path="/notifications" element={<NotificationCenterWorkspace />} />
              <Route path="/settings" element={<SettingsOverviewWorkspace />} />

              {/* AI automation - AI 自动化框架 */}
              <Route path="/ai/jobs" element={<AiJobQueueWorkspace />} />
              <Route path="/ai/recognition" element={<AiRecognitionWorkspace />} />
              <Route path="/ai/suggestions" element={<AiVoucherSuggestionWorkspace />} />
              <Route path="/ai/rules" element={<AiRuleTrainingWorkspace />} />

              {/* Collection and file centers - 资料采集与文件中心 */}
              <Route path="/collection" element={<Navigate to="/invoices/output" replace />} />
              <Route path="/collection/invoices" element={<Navigate to="/invoices/output" replace />} />
              <Route path="/collection/bank" element={<Navigate to="/bank" replace />} />
              <Route path="/attachments" element={<AttachmentCenterWorkspace />} />
              <Route path="/imports" element={<ImportHistoryWorkspace />} />
              <Route path="/downloads" element={<DownloadCenterWorkspace />} />

              {/* Business Processing - 业务处理 */}
              <Route path="/invoices/output" element={<OutputInvoiceWorkspace />} />
              <Route path="/invoices/selection" element={<Navigate to="/invoices/input" replace />} />
              <Route path="/invoices/input" element={<InputInvoiceWorkspace />} />
              <Route path="/bills" element={<BillListWorkspace />} />
              <Route path="/bank" element={<BankStatementWorkspace />} />
              <Route path="/receipts" element={<ReceiptWorkspace />} />
              <Route path="/documents" element={<DocumentRegisterWorkspace />} />
              <Route path="/expenses/reimbursements" element={<ExpenseReimbursementWorkspace />} />
              <Route path="/purchase" element={<PurchaseManagementWorkspace />} />
              <Route path="/sales" element={<SalesManagementWorkspace />} />
              <Route path="/transfers" element={<AccountTransferWorkspace />} />
              <Route path="/employees" element={<EmployeeWorkspace />} />
              <Route path="/payroll" element={<PayrollWorkspace />} />
              <Route path="/social-security" element={<SocialSecurityWorkspace />} />
              <Route path="/special-deductions" element={<SpecialDeductionWorkspace />} />
              <Route path="/depreciation" element={<FixedAssetWorkspace />} />
              <Route path="/inventory" element={<InventoryMasterWorkspace />} />
              <Route path="/inventory/opening" element={<InventoryOpeningWorkspace />} />
              <Route path="/inventory/stocktakes" element={<InventoryStocktakeWorkspace />} />
              <Route path="/inventory/movements" element={<InventoryMovementWorkspace />} />
              <Route path="/cost-carryover" element={<CostCarryoverWorkspace />} />
              <Route path="/units" element={<MeasurementUnitWorkspace />} />

              {/* Finance - 财务 */}
              <Route path="/vouchers" element={<VoucherWorkspace />} />
              <Route path="/vouchers/detail/:id" element={<VoucherDetailWorkspace />} />
              <Route path="/bank/reconciliation" element={<BankReconciliationWorkspace />} />
              <Route path="/settlement/receivable" element={<ReceivableSettlementWorkspace />} />
              <Route path="/settlement/payable" element={<PayableSettlementWorkspace />} />
              <Route path="/aging" element={<AgingWorkspace />} />
              <Route path="/matching" element={<InvoiceVoucherMatchingWorkspace />} />
              <Route path="/period-closing" element={<ClosingTasksWorkspace />} />
              <Route path="/risk-check" element={<RiskCheckWorkspace />} />
              <Route path="/reports/ledgers" element={<LedgerOverviewWorkspace />} />
              <Route path="/reports/trial-balance" element={<TrialBalanceWorkspace />} />
              <Route path="/reports/account-summary" element={<AccountSummaryWorkspace />} />
              <Route path="/reports/general-ledger" element={<GeneralLedgerWorkspace />} />
              <Route path="/reports/subsidiary-ledger" element={<SubsidiaryLedgerWorkspace />} />
              <Route path="/reports/auxiliary-ledger" element={<AuxiliaryLedgerWorkspace />} />
              <Route path="/reports/auxiliary-balance" element={<AuxiliaryBalanceWorkspace />} />
              <Route path="/reports/multi-column-ledger" element={<MultiColumnLedgerWorkspace />} />

              {/* Reports - 报表 */}
              <Route path="/reports" element={<FinancialOverviewWorkspace />} />
              <Route path="/reports/balance-sheet" element={<BalanceSheetWorkspace />} />
              <Route path="/reports/income-statement" element={<IncomeStatementWorkspace />} />
              <Route path="/reports/income-quarter" element={<IncomeQuarterWorkspace />} />
              <Route path="/reports/cash-flow" element={<CashFlowWorkspace />} />
              <Route path="/reports/cash-flow-quarter" element={<CashFlowQuarterWorkspace />} />
              <Route path="/reports/equity-change" element={<EquityChangeWorkspace />} />
              <Route path="/reports/receivable-summary" element={<ReceivableSummaryWorkspace />} />
              <Route path="/reports/receivable-detail" element={<ReceivableDetailWorkspace />} />
              <Route path="/reports/payable-summary" element={<PayableSummaryWorkspace />} />
              <Route path="/reports/payable-detail" element={<PayableDetailWorkspace />} />
              <Route path="/reports/operating-status" element={<OperatingStatusWorkspace />} />
              <Route path="/reports/operating-performance" element={<OperatingPerformanceWorkspace />} />

              {/* Tax Reports - 税务申报 */}
              <Route path="/tax/workspace" element={<TaxWorkspace />} />
              <Route path="/tax/calendar" element={<DeclarationCalendarWorkspace />} />
              <Route path="/tax/reports" element={<TaxReportOverviewWorkspace />} />
              <Route path="/tax/vat" element={<VatTaxReportWorkspace />} />
              <Route path="/tax/withholding" element={<WithholdingTaxReportWorkspace />} />
              <Route path="/tax/stamp" element={<StampTaxReportWorkspace />} />
              <Route path="/tax/income" element={<IncomeTaxReportWorkspace />} />
              <Route path="/tax/social-security" element={<SocialSecurityTaxReportWorkspace />} />
              <Route path="/tax/finance-report" element={<FinanceTaxReportWorkspace />} />
              <Route path="/tax/non-tax" element={<NonTaxRevenueReportWorkspace />} />
              <Route path="/tax/receipts" element={<DeclarationReceiptWorkspace />} />

              {/* Settings Sub-pages - 设置子页面 */}
              <Route path="/settings/company-info" element={<CompanyInfoWorkspace />} />
              <Route path="/settings/initial-balances" element={<InitialBalanceWorkspace />} />
              <Route path="/settings/tax-init" element={<TaxInitializationWorkspace />} />
              <Route path="/settings/history-vouchers" element={<HistoryVoucherWorkspace />} />
              <Route path="/settings/history-balances" element={<HistoryBalanceWorkspace />} />
              <Route path="/settings/history-general-ledger" element={<HistoryGeneralLedgerWorkspace />} />
              <Route path="/settings/history-subsidiary-ledger" element={<HistorySubsidiaryLedgerWorkspace />} />
              <Route path="/settings/accounts" element={<CompanyAccountWorkspace />} />
              <Route path="/settings/customers" element={<CustomerArchiveWorkspace />} />
              <Route path="/settings/contracts" element={<ContractLedgerWorkspace />} />
              <Route path="/settings/customers-contracts" element={<Navigate to="/agency/service-contracts" replace />} />
              <Route path="/settings/suppliers" element={<SupplierArchiveWorkspace />} />
              <Route path="/settings/other-contacts" element={<OtherContactArchiveWorkspace />} />
              <Route path="/settings/projects" element={<ProjectArchiveWorkspace />} />
              <Route path="/settings/departments" element={<DepartmentArchiveWorkspace />} />
              <Route path="/settings/tags" element={<BusinessTagWorkspace />} />
              <Route path="/settings/account-codes" element={<AccountCodeWorkspace />} />
              <Route path="/settings/asset-categories" element={<AssetCategoryWorkspace />} />
              <Route path="/settings/invoice-rules" element={<InvoiceMatchingRuleWorkspace />} />
              <Route path="/settings/bill-rules" element={<BillMatchingRuleWorkspace />} />
              <Route path="/settings/voucher-recycle" element={<VoucherRecycleWorkspace />} />
              <Route path="/settings/auxiliary-categories" element={<AuxiliaryCategoryWorkspace />} />
              <Route path="/settings/auxiliary-items" element={<AuxiliaryItemWorkspace />} />
              <Route path="/settings/common-digests" element={<CommonDigestWorkspace />} />
              <Route path="/settings/voucher-templates" element={<VoucherTemplateWorkspace />} />
              <Route path="/settings/report-formulas" element={<ReportFormulaWorkspace />} />
              <Route path="/settings/cash-flow-mapping" element={<CashFlowMappingWorkspace />} />
              <Route path="/settings/equity-change-mapping" element={<EquityChangeMappingWorkspace />} />
              <Route path="/settings/settlement-rules" element={<SettlementRuleWorkspace />} />
              <Route path="/settings/currencies" element={<CurrencyWorkspace />} />
              <Route path="/settings/roles" element={<Navigate to="/agency/permissions" replace />} />
              <Route path="/settings/print-templates" element={<PrintTemplateWorkspace />} />
              <Route path="/settings/tax-adapters" element={<TaxAdapterWorkspace />} />
              <Route path="/settings/bank-adapters" element={<BankAdapterWorkspace />} />
              <Route path="/settings/period-management" element={<PeriodManagementWorkspace />} />
              <Route path="/settings/audit-log" element={<AuditLogWorkspace />} />
              <Route path="/settings/backup-restore" element={<BackupRestoreWorkspace />} />
            </Route>

            {/* Voucher edit routes use the redesigned operating surface. */}
            <Route path="/vouchers/new" element={<ProtectedRoute><VoucherCreateWorkspace /></ProtectedRoute>} />
            <Route path="/vouchers/edit/:id" element={<ProtectedRoute><VoucherEditWorkspace /></ProtectedRoute>} />

            {/* Catch all - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
  )
}

export default App

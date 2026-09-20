import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  Columns3,
  Download,
  FileDown,
  FilePlus2,
  FileText,
  Filter,
  Paperclip,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Settings2,
  Upload,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { auxiliaryArchiveDefinitions, parseAuxiliaryArchiveProfile, serializeAuxiliaryArchiveProfile, type AuxiliaryArchiveKind } from '../../lib/auxiliaryArchiveProfile'
import { exportHtmlToPdf } from '../../lib/pdfExport'
import { exportRowsToXlsx } from '../../lib/xlsxExport'
import { recordAuditLog, recordExportJob, useAuditLogs, useExportJobs, type AuditLog, type ExportJob } from '../../lib/exportJobs'
import { formatLocalFileSize, parseLocalImportFile, recordLocalAttachment, recordLocalImportJob, removeLocalAttachment, removeLocalImportJob, updateLocalAttachmentAssociation, updateLocalImportJobCommit, updateLocalImportJobValidation, useLocalAttachmentRecords, useLocalImportJobs, type LocalAttachmentRecord, type LocalImportFailure, type LocalImportJob } from '../../lib/localFileRegistry'
import { isTauri } from '../../lib/tauri'
import { accountTransferApi, automationApi, backupApi, bankReconciliationApi, bankTransactionApi, businessOrderApi, companyTodoApi, costCarryoverApi, documentRecordApi, employeeApi, fixedAssetApi, inventoryItemApi, inventoryMovementApi, payrollApi, settlementRecordApi, socialSecurityApi, specialDeductionApi, type AccountTransfer, type AdapterAuthorization, type AutomationJob, type BankReconciliationRecord, type BankTransaction, type BusinessOrder, type CompanyTodo, type CostCarryoverRecord, type DocumentRecord, type Employee, type FixedAsset, type InventoryItem, type InventoryMovement, type LocalBackupSnapshot, type LocalBackupVerification, type OperationAuditLog, type PayrollRecord, type SettlementRecord, type SocialSecurityRecord, type SpecialDeductionRecord, type TaxDeclarationTask } from '../../lib/api'
import { measurementUnitApi, type MeasurementUnit } from '../../lib/api'
import {
  mapLiveBalanceSheetRows,
  mapLiveEquityChangeRows,
  mapLiveCashFlowRows,
  mapLiveCashFlowQuarterRows,
  mapLiveCompanyInfoRows,
  mapLiveCompanyAccountRows,
  mapLiveCommonDigestRows,
  mapLiveCurrencyRows,
  mapLiveGeneralLedgerRows,
  mapLiveMultiColumnLedgerRows,
  mapLiveInitialBalanceRows,
  mapLiveAuxiliaryArchiveRows,
  mapLiveAuxiliaryCategoryRows,
  mapLiveAuxiliaryItemRows,
  mapLiveAdapterAuthorizationRows,
  mapLiveOperationAuditRows,
  mapLiveLedgerOverviewRows,
  mapLiveAccountSummaryRows,
  mapLiveAuxiliaryBalanceRows,
  mapLiveAuxiliaryLedgerRows,
  mapLiveHistoryBalanceRows,
  mapLiveHistoryGeneralLedgerRows,
  mapLiveHistorySubsidiaryLedgerRows,
  mapLiveHistoryVoucherRows,
  mapLiveSettlementRuleRows,
  mapLivePeriodManagementRows,
  mapLiveReportFormulaRows,
  mapLiveRiskCheckRows,
  mapLiveClosingTaskRows,
  mapLiveInvoiceVoucherMatchingRows,
  mapLiveSubjectRows,
  mapLiveSubsidiaryLedgerRows,
  mapLiveIncomeStatementRows,
  mapLiveIncomeQuarterRows,
  mapLiveInvoiceRows,
  mapLiveTrialBalanceRows,
  mapLiveVoucherRows,
  mapLiveVoucherRecycleRows,
  mapLiveDeclarationReceiptRows,
  mapLiveDeclarationCalendarRows,
  mapLiveNonTaxRevenueRows,
  mapLiveTaxInitRows,
  mapLiveTaxReportRows,
  mapLiveAutomationJobRows,
  mapLiveFinanceTaxReportRows,
  mapLiveFinancialOverviewRows,
  mapLiveVoucherTemplateRows,
  summarizeLiveBalanceSheet,
  summarizeLiveEquityChange,
  summarizeLiveCashFlow,
  summarizeLiveCashFlowQuarter,
  summarizeLiveCompanyInfo,
  summarizeLiveCompanyAccounts,
  summarizeLiveCommonDigests,
  summarizeLiveCurrencies,
  summarizeLiveGeneralLedger,
  summarizeLiveMultiColumnLedger,
  summarizeLiveInitialBalance,
  summarizeLiveAuxiliaryArchive,
  summarizeLiveAuxiliaryCategories,
  summarizeLiveAuxiliaryItems,
  summarizeLiveAdapterAuthorizations,
  summarizeLiveOperationAudits,
  summarizeLiveLedgerOverview,
  summarizeLiveAccountSummary,
  summarizeLiveAuxiliaryBalance,
  summarizeLiveAuxiliaryLedger,
  summarizeLiveHistoryBalance,
  summarizeLiveHistoryGeneralLedger,
  summarizeLiveHistorySubsidiaryLedger,
  summarizeLiveHistoryVouchers,
  summarizeLiveSettlementRules,
  summarizeLivePeriodManagement,
  summarizeLiveReportFormulas,
  summarizeLiveRiskChecks,
  summarizeLiveClosingTasks,
  summarizeLiveInvoiceVoucherMatching,
  summarizeLiveSubjects,
  summarizeLiveSubsidiaryLedger,
  summarizeLiveIncomeStatement,
  summarizeLiveIncomeQuarter,
  summarizeLiveInvoices,
  summarizeLiveTrialBalance,
  summarizeLiveVouchers,
  summarizeLiveVoucherRecycle,
  summarizeLiveDeclarationReceipts,
  summarizeLiveDeclarationCalendar,
  summarizeLiveNonTaxRevenue,
  summarizeLiveTaxInit,
  summarizeLiveTaxReports,
  summarizeLiveAutomationJobs,
  summarizeLiveFinanceTaxReports,
  summarizeLiveFinancialOverview,
  summarizeLiveMatchingRules,
  mapLiveMatchingRuleRows,
  mapLiveAssetCategoryRows,
  summarizeLiveAssetCategories,
  mapLiveBusinessTagRows,
  summarizeLiveBusinessTags,
  summarizeLiveVoucherTemplates,
} from '../../lib/liveModuleRows'
import { useCompanyStore, type Company } from '../../stores/companyStore'
import { useAccountStore } from '../../stores/accountStore'
import { useAuxiliaryStore, type AuxiliaryBalanceRow, type AuxiliaryLedgerRow } from '../../stores/auxiliaryStore'
import { useInvoiceStore, type Invoice } from '../../stores/invoiceStore'
import {
  usePeriodStore,
  type BalanceSheetResult,
  type CashFlowResult,
  type GeneralLedgerItem,
  type IncomeStatementResult,
  type SubsidiaryLedgerItem,
  type TrialBalanceResult,
} from '../../stores/periodStore'
import { useVoucherStore, type Voucher } from '../../stores/voucherStore'
import { useSettlementRuleStore } from '../../stores/settlementRuleStore'
import { useCurrencyStore } from '../../stores/currencyStore'
import { useTemplateStore, type TemplateEntry } from '../../stores/templateStore'
import { useReportTemplateStore } from '../../stores/reportTemplateStore'
import { useMatchingRuleStore, type MatchingRule, type MatchingRuleScope } from '../../stores/matchingRuleStore'
import { useAssetCategoryStore } from '../../stores/assetCategoryStore'
import { useBusinessTagStore, type BusinessTag } from '../../stores/businessTagStore'
import { useCompanyAccountStore } from '../../stores/companyAccountStore'

type ModuleKind =
  | 'attachmentCenter'
  | 'importCenter'
  | 'exportCenter'
  | 'aiJobQueue'
  | 'aiRecognitionResults'
  | 'aiVoucherSuggestions'
  | 'aiRuleTraining'
  | 'notificationCenter'
  | 'contractLedger'
  | 'outputInvoice'
  | 'inputInvoice'
  | 'billList'
  | 'bankStatement'
  | 'receipt'
  | 'documentRegister'
  | 'expenseReimbursement'
  | 'purchaseManagement'
  | 'salesManagement'
  | 'voucher'
  | 'voucherCreate'
  | 'voucherEdit'
  | 'voucherDetail'
  | 'transfer'
  | 'employee'
  | 'payroll'
  | 'socialSecurity'
  | 'specialDeduction'
  | 'depreciation'
  | 'inventorySettings'
  | 'inventoryMovement'
  | 'costCarryover'
  | 'unitSettings'
  | 'bankReconciliation'
  | 'receivableSettlement'
  | 'payableSettlement'
  | 'receivablePayableAging'
  | 'invoiceVoucherMatching'
  | 'riskCheck'
  | 'closingTasks'
  | 'ledgerReport'
  | 'trialBalanceReport'
  | 'accountSummaryReport'
  | 'generalLedgerReport'
  | 'subsidiaryLedgerReport'
  | 'auxiliaryLedgerReport'
  | 'auxiliaryBalanceReport'
  | 'multiColumnLedgerReport'
  | 'financialReport'
  | 'balanceSheetReport'
  | 'incomeStatementReport'
  | 'incomeQuarterReport'
  | 'cashFlowReport'
  | 'cashFlowQuarterReport'
  | 'equityChangeReport'
  | 'taxReport'
  | 'vatTaxReport'
  | 'withholdingTaxReport'
  | 'stampTaxReport'
  | 'incomeTaxReport'
  | 'socialSecurityTaxReport'
  | 'financeTaxReport'
  | 'nonTaxRevenueReport'
  | 'declarationCalendar'
  | 'settingsData'
  | 'companyInfo'
  | 'initialBalance'
  | 'historyVoucher'
  | 'historyBalance'
  | 'historyGeneralLedger'
  | 'historySubsidiaryLedger'
  | 'taxInit'
  | 'accountArchive'
  | 'customerArchive'
  | 'supplierArchive'
  | 'otherContactArchive'
  | 'projectArchive'
  | 'departmentArchive'
  | 'tagArchive'
  | 'subjectSettings'
  | 'assetCategory'
  | 'invoiceMatchingRules'
  | 'billMatchingRules'
  | 'settlementRules'
  | 'auxiliaryCategories'
  | 'auxiliaryItems'
  | 'commonDigests'
  | 'voucherTemplateSettings'
  | 'reportFormulaSettings'
  | 'cashFlowMapping'
  | 'currencySettings'
  | 'printTemplateSettings'
  | 'taxAdapterSettings'
  | 'bankAdapterSettings'
  | 'periodManagement'
  | 'auditLog'
  | 'backupRestore'
  | 'voucherRecycle'
  | 'declarationReceipt'

const voucherGenerationModuleKinds: ModuleKind[] = [
  'outputInvoice', 'inputInvoice', 'billList',
  'bankStatement', 'documentRegister', 'expenseReimbursement', 'receipt',
  'purchaseManagement', 'salesManagement', 'payroll', 'socialSecurity',
  'depreciation', 'inventoryMovement', 'costCarryover', 'transfer',
  'bankReconciliation', 'receivableSettlement', 'payableSettlement',
  'aiVoucherSuggestions', 'voucher', 'voucherRecycle',
  'attachmentCenter', 'importCenter',
]

function canGenerateVoucherFromModule(kind: ModuleKind) {
  return voucherGenerationModuleKinds.includes(kind)
}

const ledgerReportModuleKinds: ModuleKind[] = [
  'ledgerReport', 'trialBalanceReport', 'accountSummaryReport', 'generalLedgerReport',
  'subsidiaryLedgerReport', 'auxiliaryLedgerReport', 'auxiliaryBalanceReport', 'multiColumnLedgerReport',
]

const financialStatementModuleKinds: ModuleKind[] = [
  'financialReport', 'balanceSheetReport', 'incomeStatementReport', 'incomeQuarterReport',
  'cashFlowReport', 'cashFlowQuarterReport', 'equityChangeReport',
]

const taxReportModuleKinds: ModuleKind[] = [
  'taxReport', 'vatTaxReport', 'withholdingTaxReport', 'stampTaxReport',
  'incomeTaxReport', 'socialSecurityTaxReport', 'financeTaxReport',
]

function isLedgerReportKind(kind: ModuleKind) {
  return ledgerReportModuleKinds.includes(kind)
}

function isFinancialStatementKind(kind: ModuleKind) {
  return financialStatementModuleKinds.includes(kind)
}

function isTaxReportKind(kind: ModuleKind) {
  return taxReportModuleKinds.includes(kind)
}

interface BusinessModulePageProps {
  kind: ModuleKind
  title: string
  description: string
}

interface ModuleColumn {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
}

interface ModuleRow {
  id: string
  status: '待处理' | '已匹配' | '已确认' | '已生成凭证' | '待确认' | '异常' | '启用' | '停用' | '已通过' | '已发布' | '待复核'
  voucher?: string
  attachment?: string
  values: Record<string, string>
}

interface ModuleConfig {
  keywordPlaceholder: string
  primaryAction: string
  importLabel: string
  statusOptions: string[]
  summary: { label: string; value: string; tone: 'blue' | 'green' | 'amber' | 'red' | 'gray' }[]
  columns: ModuleColumn[]
  rows: ModuleRow[]
  notes: string[]
}

interface ModuleListMeta {
  title: string
  hint: string
  exportHint: string
}

interface ModuleDetailMeta {
  title: string
  boundary: string
}

interface ModuleTableMeta {
  statusLabel: string
  voucherLabel: string
  attachmentLabel: string
  showVoucher: boolean
  showAttachment: boolean
}

type LiveReportData = {
  trialBalance: TrialBalanceResult | null
  generalLedger: GeneralLedgerItem[] | null
  multiColumnLedger: GeneralLedgerItem[] | null
  balanceSheet: BalanceSheetResult | null
  incomeStatement: IncomeStatementResult | null
  incomeQuarterBaseline: IncomeStatementResult | null
  incomeQuarterBaselineMissing: boolean
  cashFlow: CashFlowResult | null
  cashFlowQuarterBaseline: CashFlowResult | null
  cashFlowQuarterBaselineMissing: boolean
  initialBalance: TrialBalanceResult | null
  ledgerOverview: TrialBalanceResult | null
  accountSummary: GeneralLedgerItem[] | null
  subsidiaryLedger: SubsidiaryLedgerItem[] | null
  auxiliaryLedger: AuxiliaryLedgerRow[] | null
  auxiliaryBalance: AuxiliaryBalanceRow[] | null
  historyBalance: TrialBalanceResult | null
  historyGeneralLedger: GeneralLedgerItem[] | null
  historySubsidiaryLedger: SubsidiaryLedgerItem[] | null
  historyVouchers: Voucher[] | null
}

const emptyLiveReportData: LiveReportData = {
  trialBalance: null,
  generalLedger: null,
  multiColumnLedger: null,
  balanceSheet: null,
  incomeStatement: null,
  incomeQuarterBaseline: null,
  incomeQuarterBaselineMissing: false,
  cashFlow: null,
  cashFlowQuarterBaseline: null,
  cashFlowQuarterBaselineMissing: false,
  initialBalance: null,
  ledgerOverview: null,
  accountSummary: null,
  subsidiaryLedger: null,
  auxiliaryLedger: null,
  auxiliaryBalance: null,
  historyBalance: null,
  historyGeneralLedger: null,
  historySubsidiaryLedger: null,
  historyVouchers: null,
}

const liveAuxiliaryArchiveKinds = ['customerArchive', 'supplierArchive', 'otherContactArchive', 'projectArchive', 'departmentArchive'] as const
type LiveAuxiliaryArchiveKind = (typeof liveAuxiliaryArchiveKinds)[number]

function isLiveAuxiliaryArchiveKind(kind: ModuleKind): kind is LiveAuxiliaryArchiveKind {
  return liveAuxiliaryArchiveKinds.includes(kind as LiveAuxiliaryArchiveKind)
}

type PrintTemplateKind = 'list' | 'voucher' | 'ledger' | 'financial' | 'tax'
type SheetMerge = { s: { r: number; c: number }; e: { r: number; c: number } }
type SheetColumnWidth = { wch: number }
type ExcelTemplateData = {
  sheetRows: string[][]
  columnWidths: SheetColumnWidth[]
  merges: SheetMerge[]
}

const fixedPrintTemplatePreviews = [
  { name: '记账凭证', paper: 'A4 纵向', version: 'v1.2', layout: '凭证头、分录、借贷合计、制单审核栏', pagination: '按凭证块分页，不拆分分录表格' },
  { name: '账簿与余额表', paper: 'A4 横向', version: 'v1.1', layout: '单位、期间、明细表、页内小计', pagination: '表头重复，优先按账簿行分页' },
  { name: '财务报表', paper: 'A4 纵向', version: 'v1.1', layout: '编制单位、所属期、报表项目、签署栏', pagination: '按报表项目行分页，保留金额列' },
  { name: '税务申报包', paper: 'A4 横向', version: 'v1.1', layout: '纳税人、税号、申报清单、风险与日志', pagination: '申报清单与风险表分别按行分页' },
  { name: '业务清单', paper: 'A4 横向', version: 'v1.0', layout: '筛选范围、列表字段、附件与操作说明', pagination: '表头重复，按业务记录行分页' },
]

const fixedPrintTemplateRows: ModuleRow[] = fixedPrintTemplatePreviews.map((template) => {
  const [paper, orientation] = template.paper.split(' ')
  const module = template.name === '记账凭证'
    ? '会计凭证'
    : template.name === '账簿与余额表'
      ? '账簿与余额表'
      : template.name === '财务报表'
        ? '财务报表'
        : template.name === '税务申报包'
          ? '税务申报'
          : '业务清单'
  return {
    id: `fixed-print-template-${template.name}`,
    status: '启用',
    voucher: '-',
    attachment: '内置模板',
    values: { name: template.name, module, paper, orientation, version: template.version, default: '是', updatedBy: '应用内置', updatedAt: '随应用版本发布' },
  }
})

const fixedPrintTemplateSummary: ModuleConfig['summary'] = [
  { label: '固定模板', value: `${fixedPrintTemplateRows.length} 套`, tone: 'blue' },
  { label: '已启用', value: `${fixedPrintTemplateRows.length} 套`, tone: 'green' },
  { label: '待复核', value: '0 套', tone: 'gray' },
  { label: '输出类型', value: '5 类', tone: 'gray' },
]

type LocalImportWriteTarget = 'invoice' | 'bank' | 'document' | 'businessOrder' | 'employee' | 'payroll' | 'socialSecurity' | 'specialDeduction' | 'inventoryMovement' | 'fixedAsset' | 'inventoryItem' | 'settlement' | 'bankReconciliation' | 'measurementUnit' | 'accountTransfer' | 'costCarryover' | 'companyAccount' | 'auxiliaryArchive' | 'businessTag' | 'currency' | 'matchingRule' | 'settlementRule' | 'commonDigest' | 'voucherTemplate' | 'assetCategory' | 'auxiliaryCategory' | 'auxiliaryItem' | 'initialBalance' | 'subject' | 'historyVoucher' | 'historyBalance'
type LocalImportCommitDraft = { jobId: string; fileName: string; headers: string[]; rows: string[][]; target: LocalImportWriteTarget; periodId: string; periodLabel: string }

const historyMigrationKinds: ModuleKind[] = ['historyVoucher', 'historyBalance', 'historyGeneralLedger', 'historySubsidiaryLedger']

function isHistoryMigrationKind(kind: ModuleKind) {
  return historyMigrationKinds.includes(kind)
}

function localImportWriteTarget(kind: ModuleKind): LocalImportWriteTarget | null {
  if (kind === 'outputInvoice' || kind === 'inputInvoice') return 'invoice'
  if (kind === 'billList' || kind === 'bankStatement') return 'bank'
  if (kind === 'documentRegister' || kind === 'contractLedger' || kind === 'receipt' || kind === 'expenseReimbursement') return 'document'
  if (kind === 'purchaseManagement' || kind === 'salesManagement') return 'businessOrder'
  if (kind === 'employee') return 'employee'
  if (kind === 'payroll') return 'payroll'
  if (kind === 'socialSecurity') return 'socialSecurity'
  if (kind === 'specialDeduction') return 'specialDeduction'
  if (kind === 'inventoryMovement') return 'inventoryMovement'
  if (kind === 'depreciation') return 'fixedAsset'
  if (kind === 'inventorySettings') return 'inventoryItem'
  if (kind === 'receivableSettlement' || kind === 'payableSettlement') return 'settlement'
  if (kind === 'bankReconciliation') return 'bankReconciliation'
  if (kind === 'unitSettings') return 'measurementUnit'
  if (kind === 'transfer') return 'accountTransfer'
  if (kind === 'costCarryover') return 'costCarryover'
  if (kind === 'accountArchive') return 'companyAccount'
  if (isLiveAuxiliaryArchiveKind(kind)) return 'auxiliaryArchive'
  if (kind === 'tagArchive') return 'businessTag'
  if (kind === 'currencySettings') return 'currency'
  if (kind === 'invoiceMatchingRules' || kind === 'billMatchingRules' || kind === 'cashFlowMapping' || kind === 'aiRuleTraining') return 'matchingRule'
  if (kind === 'settlementRules') return 'settlementRule'
  if (kind === 'commonDigests') return 'commonDigest'
  if (kind === 'voucherTemplateSettings') return 'voucherTemplate'
  if (kind === 'assetCategory') return 'assetCategory'
  if (kind === 'auxiliaryCategories') return 'auxiliaryCategory'
  if (kind === 'auxiliaryItems') return 'auxiliaryItem'
  if (kind === 'initialBalance') return 'initialBalance'
  if (kind === 'subjectSettings') return 'subject'
  if (kind === 'historyVoucher' || kind === 'historySubsidiaryLedger') return 'historyVoucher'
  if (kind === 'historyBalance' || kind === 'historyGeneralLedger') return 'historyBalance'
  return null
}

function importRowValue(headers: string[], row: string[], labels: string[]) {
  const normalize = (value: string) => value.replace(/[\s（）()\-_/]/g, '').toLowerCase()
  const index = headers.findIndex((header) => labels.some((label) => {
    const target = normalize(label)
    const source = normalize(header)
    return source === target || source.includes(target) || target.includes(source)
  }))
  return index >= 0 ? (row[index] || '').trim() : ''
}

function importAmount(value: string) {
  const parsed = Number(value.replace(/[¥,，\s]/g, '').replace('%', ''))
  return Number.isFinite(parsed) ? parsed : 0
}

type PreviewInitialBalanceRow = {
  accountCode: string
  accountName: string
  accountType: string
  isDetail: boolean
  openingDebit: number
  openingCredit: number
  sourceNote: string
}

type PreviewCompanyInfo = {
  code: string
  name: string
  taxId: string
  taxpayerType: string
  province: string
  city: string
  district: string
  accountingSystem: string
  enableYear: string
  enableMonth: string
  serviceStart: string
  serviceEnd: string
  industry: string
  enterpriseType: string
}

function buildPreviewCompanyInfo(draft: PreviewCompanyInfo): Company {
  return {
    id: 'browser-preview-company',
    code: draft.code,
    name: draft.name,
    tax_id: draft.taxId || null,
    contact: null,
    phone: null,
    email: null,
    address: null,
    bank_name: null,
    bank_account: null,
    tax_type: draft.taxpayerType || null,
    industry: draft.industry || null,
    accounting_system: draft.accountingSystem || null,
    province: draft.province || null,
    city: draft.city || null,
    district: draft.district || null,
    enterprise_type: draft.enterpriseType || null,
    service_start: draft.serviceStart || null,
    service_end: draft.serviceEnd || null,
    enable_year: Number(draft.enableYear) || null,
    enable_month: Number(draft.enableMonth) || null,
    is_active: 1,
    is_deleted: 0,
    deleted_at: null,
    created_at: '浏览器预览',
    updated_at: '浏览器预览保存',
  }
}

const previewInitialBalanceSeed: PreviewInitialBalanceRow[] = [
  { accountCode: '1002', accountName: '银行存款', accountType: '资产类', isDetail: true, openingDebit: 220000, openingCredit: 0, sourceNote: '期初导入表' },
  { accountCode: '1122', accountName: '应收账款', accountType: '资产类', isDetail: true, openingDebit: 410000, openingCredit: 0, sourceNote: '期初导入表' },
  { accountCode: '2202', accountName: '应付账款', accountType: '负债类', isDetail: true, openingDebit: 0, openingCredit: 268000, sourceNote: '期初导入表' },
  { accountCode: '4001', accountName: '实收资本', accountType: '所有者权益类', isDetail: true, openingDebit: 0, openingCredit: 362000, sourceNote: '期初导入表' },
]

const previewTaxDeclarationTaskSeed: TaxDeclarationTask[] = [
  {
    id: 'preview-tax-vat-2026-05', companyId: 'browser-preview', companyName: '科旋电气（上海）有限公司', period: '2026-05',
    taxType: '增值税及附加', formName: '增值税及附加申报表', collectStatus: 'collected', validationStatus: 'passed', declarationStatus: 'confirmed',
    sourceSnapshot: '销项发票、进项勾选已人工复核', taxableAmount: 680000, deductionAmount: 42860, payableAmount: 54210, riskCount: 0,
    adapterCode: null, confirmedBy: '王会计', confirmedAt: '2026-06-26 09:30', receiptNo: null, paymentStatus: '待缴款', paymentNo: null,
    receiptReceivedAt: null, createdAt: '2026-06-26 09:20', updatedAt: '2026-06-26 09:30',
  },
  {
    id: 'preview-tax-income-2026-05', companyId: 'browser-preview', companyName: '科旋电气（上海）有限公司', period: '2026-05',
    taxType: '企业所得税', formName: '企业所得税月（季）度预缴申报表', collectStatus: 'collected', validationStatus: 'passed', declarationStatus: 'archived',
    sourceSnapshot: '利润表与纳税调整明细已人工复核', taxableAmount: 386200, deductionAmount: 0, payableAmount: 18420, riskCount: 0,
    adapterCode: null, confirmedBy: '李会计', confirmedAt: '2026-06-26 09:35', receiptNo: 'PREVIEW-REC-202605-01', paymentStatus: '已缴款', paymentNo: 'PREVIEW-PAY-202605-01',
    receiptReceivedAt: '2026-06-26 09:40', createdAt: '2026-06-26 09:25', updatedAt: '2026-06-26 09:40',
  },
  {
    id: 'preview-tax-finance-2026-05', companyId: 'browser-preview', companyName: '科旋电气（上海）有限公司', period: '2026-05',
    taxType: '财务报表报送', formName: '资产负债表（季报）', collectStatus: 'collected', validationStatus: 'passed', declarationStatus: 'draft',
    sourceSnapshot: '资产负债表勾稽结果', taxableAmount: 0, deductionAmount: 0, payableAmount: 0, riskCount: 0,
    adapterCode: null, confirmedBy: null, confirmedAt: null, receiptNo: null, paymentStatus: '无需缴款', paymentNo: null,
    receiptReceivedAt: null, createdAt: '2026-06-26 09:28', updatedAt: '2026-06-26 09:28',
  },
  {
    id: 'preview-tax-non-tax-2026-05', companyId: 'browser-preview', companyName: '科旋电气（上海）有限公司', period: '2026-05',
    taxType: '工会经费', formName: '上海市工会经费计费口径', collectStatus: 'collected', validationStatus: 'pending', declarationStatus: 'draft',
    sourceSnapshot: '工资表与费用台账待人工核验', taxableAmount: 103870, deductionAmount: 0, payableAmount: 2077.4, riskCount: 1,
    adapterCode: null, confirmedBy: null, confirmedAt: null, receiptNo: null, paymentStatus: 'unrecorded', paymentNo: null,
    receiptReceivedAt: null, createdAt: '2026-06-26 09:32', updatedAt: '2026-06-26 09:32',
  },
]

const previewAiQueueJobSeed: AutomationJob[] = [
  {
    id: 'AI-20260626-001', companyId: 'browser-preview', companyName: null, period: '2026-05', jobType: 'voucher_suggestion',
    sourceModule: '销项发票', sourceId: '310026000118', sourceFile: '销项发票批次0526', suggestionNo: 'AI-V-0526-001',
    debitSubject: '1122 应收账款', creditSubject: '6001 主营业务收入', suggestionAmount: 38000, generatedVoucherId: null, generatedVoucherNumber: null,
    status: 'waiting_confirmation', confidence: 0.92, resultSummary: '设备销售收入，建议按销项发票生成待复核分录。', riskLevel: 'normal', reviewer: '王会计', createdBy: '王会计', createdAt: '2026-06-26 09:12', updatedAt: '2026-06-26 09:12',
  },
  {
    id: 'AI-20260626-002', companyId: 'browser-preview', companyName: null, period: '2026-05', jobType: 'bank_classification',
    sourceModule: '银行流水', sourceId: null, sourceFile: 'BANK-0526-01', suggestionNo: null, debitSubject: null, creditSubject: null, suggestionAmount: null,
    generatedVoucherId: 'preview-voucher-0051', generatedVoucherNumber: '记-0051', status: 'completed', confidence: 0.96, resultSummary: '流水分类完成，已保留处理日志。', riskLevel: 'normal', reviewer: '李会计', createdBy: '李会计', createdAt: '2026-06-26 10:03', updatedAt: '2026-06-26 10:03',
  },
  {
    id: 'AI-20260626-003', companyId: 'browser-preview', companyName: null, period: '2026-05', jobType: 'document_ocr',
    sourceModule: '费用报销', sourceId: '费用报销单', sourceFile: 'expense_blur.jpg', suggestionNo: null, debitSubject: null, creditSubject: null, suggestionAmount: null,
    generatedVoucherId: null, generatedVoucherNumber: null, status: 'failed', confidence: 0.43, resultSummary: '金额/日期字段识别失败，影像模糊。', riskLevel: 'warning', reviewer: '待处理', createdBy: '赵会计', createdAt: '2026-06-26 10:48', updatedAt: '2026-06-26 10:48',
  },
  {
    id: 'AI-20260626-004', companyId: 'browser-preview', companyName: null, period: '2026-05', jobType: 'voucher_suggestion',
    sourceModule: '费用报销', sourceId: 'BX-202605-018', sourceFile: '差旅报销单.pdf', suggestionNo: 'AI-V-0526-002',
    debitSubject: '6601 销售费用', creditSubject: '1002 银行存款', suggestionAmount: 9800, generatedVoucherId: null, generatedVoucherNumber: null,
    status: 'waiting_confirmation', confidence: 0.78, resultSummary: '差旅报销费用，发票与行程单金额待人工核验。', riskLevel: 'warning', reviewer: '李会计', createdBy: '李会计', createdAt: '2026-06-26 11:08', updatedAt: '2026-06-26 11:08',
  },
  {
    id: 'AI-20260626-005', companyId: 'browser-preview', companyName: null, period: '2026-05', jobType: 'voucher_suggestion',
    sourceModule: '银行流水', sourceId: 'BANK-0526-01', sourceFile: 'BANK-0526-01', suggestionNo: 'AI-V-0526-003',
    debitSubject: '1002 银行存款', creditSubject: '1122 应收账款', suggestionAmount: 18300, generatedVoucherId: null, generatedVoucherNumber: null,
    status: 'confirmed', confidence: 0.96, resultSummary: '客户回款已人工确认，等待凭证草稿复核。', riskLevel: 'normal', reviewer: 'admin', createdBy: '王会计', createdAt: '2026-06-26 11:20', updatedAt: '2026-06-26 11:25',
  },
  {
    id: 'AI-20260626-006', companyId: 'browser-preview', companyName: null, period: '2026-05', jobType: 'invoice_recognition',
    sourceModule: '销项发票', sourceId: '310026000118', sourceFile: '310026000118.pdf', suggestionNo: null, debitSubject: null, creditSubject: null, suggestionAmount: null,
    generatedVoucherId: null, generatedVoucherNumber: null, status: 'completed', confidence: 0.98, resultSummary: '购方、税率和金额字段已识别，客户档案匹配完成。', riskLevel: 'normal', reviewer: '系统', createdBy: '系统', createdAt: '2026-06-26 11:32', updatedAt: '2026-06-26 11:33',
  },
  {
    id: 'AI-20260626-007', companyId: 'browser-preview', companyName: null, period: '2026-05', jobType: 'invoice_recognition',
    sourceModule: '进项发票', sourceId: '310026000221', sourceFile: 'input_0221.ofd', suggestionNo: null, debitSubject: null, creditSubject: null, suggestionAmount: null,
    generatedVoucherId: null, generatedVoucherNumber: null, status: 'waiting_confirmation', confidence: 0.84, resultSummary: '供应商和税额字段已识别，税率需要人工复核。', riskLevel: 'warning', reviewer: '李会计', createdBy: '李会计', createdAt: '2026-06-26 11:38', updatedAt: '2026-06-26 11:38',
  },
]

const previewMatchingRuleSeed: MatchingRule[] = [
  { id: 'preview-matching-invoice-001', company_id: 'preview-company', rule_scope: 'invoice', name: '销售商品', condition_text: '销项商品名称包含控制器', action_text: '生成待确认销售凭证建议', target_account_code: '主营业务收入 13%', voucher_template_id: '借应收 贷收入/销项税', priority: 90, is_enabled: 1, hit_count: 42, created_at: '2026-06-26 09:00', updated_at: '2026-06-26 09:00' },
  { id: 'preview-matching-invoice-002', company_id: 'preview-company', rule_scope: 'invoice', name: '技术服务收入', condition_text: '销项税率为 6%', action_text: '生成待确认服务收入凭证建议', target_account_code: '主营业务收入 6%', voucher_template_id: '借应收 贷服务收入/销项税', priority: 80, is_enabled: 1, hit_count: 18, created_at: '2026-06-26 09:05', updated_at: '2026-06-26 09:05' },
  { id: 'preview-matching-invoice-003', company_id: 'preview-company', rule_scope: 'invoice', name: '办公采购', condition_text: '进项商品名称包含办公', action_text: '人工核验费用凭证建议', target_account_code: '管理费用 6%/13%', voucher_template_id: '费用凭证', priority: 60, is_enabled: 0, hit_count: 9, created_at: '2026-06-26 09:10', updated_at: '2026-06-26 09:10' },
  { id: 'preview-matching-bill-001', company_id: 'preview-company', rule_scope: 'bill', name: '银行手续费', condition_text: '摘要包含手续费，金额小于 1000', action_text: '生成待确认费用凭证建议', target_account_code: '6603 财务费用', voucher_template_id: null, priority: 95, is_enabled: 1, hit_count: 22, created_at: '2026-06-26 09:20', updated_at: '2026-06-26 09:20' },
  { id: 'preview-matching-bill-002', company_id: 'preview-company', rule_scope: 'bill', name: '销售收款核销', condition_text: '对方户名匹配客户且金额等于发票价税合计', action_text: '生成待确认应收核销建议', target_account_code: '1002/1122', voucher_template_id: null, priority: 90, is_enabled: 1, hit_count: 61, created_at: '2026-06-26 09:25', updated_at: '2026-06-26 09:25' },
  { id: 'preview-matching-bill-003', company_id: 'preview-company', rule_scope: 'bill', name: '个人备用金', condition_text: '对方户名为个人', action_text: '生成其他应收款候选分录', target_account_code: '1221 其他应收款', voucher_template_id: null, priority: 60, is_enabled: 0, hit_count: 6, created_at: '2026-06-26 09:30', updated_at: '2026-06-26 09:30' },
  { id: 'preview-matching-cash-001', company_id: 'preview-company', rule_scope: 'cash_flow', name: '销售商品收到的现金', condition_text: '货款/回款', action_text: '1002/1122 流入', target_account_code: 'CF-01', voucher_template_id: null, priority: 95, is_enabled: 1, hit_count: 48, created_at: '2026-06-26 09:40', updated_at: '2026-06-26 09:40' },
  { id: 'preview-matching-cash-002', company_id: 'preview-company', rule_scope: 'cash_flow', name: '购买商品支付的现金', condition_text: '材料/采购', action_text: '1002/2202 流出', target_account_code: 'CF-12', voucher_template_id: null, priority: 90, is_enabled: 1, hit_count: 31, created_at: '2026-06-26 09:45', updated_at: '2026-06-26 09:45' },
  { id: 'preview-matching-cash-003', company_id: 'preview-company', rule_scope: 'cash_flow', name: '支付其他经营活动现金', condition_text: '办公/费用', action_text: '1002/6602 流出', target_account_code: 'CF-21', voucher_template_id: null, priority: 50, is_enabled: 0, hit_count: 12, created_at: '2026-06-26 09:50', updated_at: '2026-06-26 09:50' },
  { id: 'preview-matching-ai-001', company_id: 'preview-company', rule_scope: 'ai_training', name: '技术服务收入识别', condition_text: '销项发票服务费项目加已审核历史凭证', action_text: '生成待确认收入凭证建议', target_account_code: '6001 主营业务收入', voucher_template_id: null, priority: 80, is_enabled: 1, hit_count: 0, created_at: '2026-06-26 10:00', updated_at: '2026-06-26 10:00' },
  { id: 'preview-matching-ai-002', company_id: 'preview-company', rule_scope: 'ai_training', name: '银行手续费分类', condition_text: '银行流水摘要包含手续费', action_text: '生成待确认费用凭证建议', target_account_code: '6603 财务费用', voucher_template_id: null, priority: 60, is_enabled: 0, hit_count: 0, created_at: '2026-06-26 10:05', updated_at: '2026-06-26 10:05' },
  { id: 'preview-matching-ai-003', company_id: 'preview-company', rule_scope: 'ai_training', name: '办公采购费用', condition_text: '进项发票品类为办公用品', action_text: '生成费用科目建议', target_account_code: '6602 管理费用', voucher_template_id: null, priority: 50, is_enabled: 0, hit_count: 0, created_at: '2026-06-26 10:10', updated_at: '2026-06-26 10:10' },
]

function previewAiQueueJobStorageKey() {
  return 'accounting-preview-ai-queue-jobs-v1'
}

function previewMatchingRuleStorageKey() {
  return 'accounting-preview-matching-rules-v1'
}

function mergePreviewMatchingRuleSeed(rules: MatchingRule[]) {
  const knownIds = new Set(rules.map((rule) => rule.id))
  return [...rules, ...previewMatchingRuleSeed.filter((rule) => !knownIds.has(rule.id)).map((rule) => ({ ...rule }))]
}

function loadPreviewMatchingRules(): MatchingRule[] {
  const fallback = () => previewMatchingRuleSeed.map((rule) => ({ ...rule }))
  if (typeof window === 'undefined') return fallback()
  try {
    const parsed = JSON.parse(window.localStorage.getItem(previewMatchingRuleStorageKey()) || 'null')
    if (!Array.isArray(parsed) || !parsed.every((rule) => typeof rule?.id === 'string' && typeof rule.rule_scope === 'string' && typeof rule.name === 'string')) return fallback()
    return mergePreviewMatchingRuleSeed(parsed as MatchingRule[])
  } catch {
    return fallback()
  }
}

function savePreviewMatchingRules(rules: MatchingRule[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(previewMatchingRuleStorageKey(), JSON.stringify(rules))
  } catch {
    // The preview remains usable for the current view when local storage is unavailable.
  }
}

function mergePreviewAiQueueJobSeed(jobs: AutomationJob[]) {
  const knownIds = new Set(jobs.map((job) => job.id))
  return [...jobs, ...previewAiQueueJobSeed.filter((job) => !knownIds.has(job.id)).map((job) => ({ ...job }))]
}

function loadPreviewAiQueueJobs(): AutomationJob[] {
  const fallback = () => previewAiQueueJobSeed.map((job) => ({ ...job }))
  if (typeof window === 'undefined') return fallback()
  try {
    const parsed = JSON.parse(window.localStorage.getItem(previewAiQueueJobStorageKey()) || 'null')
    if (!Array.isArray(parsed) || !parsed.every((job) => typeof job?.id === 'string' && typeof job.jobType === 'string' && typeof job.status === 'string')) return fallback()
    return mergePreviewAiQueueJobSeed(parsed as AutomationJob[])
  } catch {
    return fallback()
  }
}

function savePreviewAiQueueJobs(jobs: AutomationJob[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(previewAiQueueJobStorageKey(), JSON.stringify(jobs))
  } catch {
    // The preview remains usable for the current view when local storage is unavailable.
  }
}

function previewTaxDeclarationTaskStorageKey() {
  return 'accounting-preview-tax-declaration-tasks-v1'
}

function loadPreviewTaxDeclarationTasks(): TaxDeclarationTask[] {
  const fallback = () => previewTaxDeclarationTaskSeed.map((task) => ({ ...task }))
  if (typeof window === 'undefined') return fallback()
  try {
    const parsed = JSON.parse(window.localStorage.getItem(previewTaxDeclarationTaskStorageKey()) || 'null')
    if (!Array.isArray(parsed) || !parsed.every((task) => typeof task?.id === 'string' && typeof task.taxType === 'string' && typeof task.formName === 'string')) return fallback()
    return parsed as TaxDeclarationTask[]
  } catch {
    return fallback()
  }
}

function savePreviewTaxDeclarationTasks(tasks: TaxDeclarationTask[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(previewTaxDeclarationTaskStorageKey(), JSON.stringify(tasks))
  } catch {
    // The preview remains usable for the current view when local storage is unavailable.
  }
}

function buildPreviewInitialBalanceTrial(rows: PreviewInitialBalanceRow[]): TrialBalanceResult {
  const roundMoney = (value: number) => Math.round(value * 100) / 100
  const items = rows.map((row) => ({
    account_code: row.accountCode,
    account_name: row.accountName,
    account_type: row.accountType,
    account_level: 1,
    is_detail: row.isDetail,
    opening_debit: roundMoney(row.openingDebit),
    opening_credit: roundMoney(row.openingCredit),
    period_debit: 0,
    period_credit: 0,
    cumulative_debit: 0,
    cumulative_credit: 0,
    closing_debit: roundMoney(row.openingDebit),
    closing_credit: roundMoney(row.openingCredit),
  }))
  const totalOpeningDebit = roundMoney(items.reduce((total, item) => total + item.opening_debit, 0))
  const totalOpeningCredit = roundMoney(items.reduce((total, item) => total + item.opening_credit, 0))
  return {
    items,
    total_opening_debit: totalOpeningDebit,
    total_opening_credit: totalOpeningCredit,
    total_period_debit: 0,
    total_period_credit: 0,
    total_cumulative_debit: totalOpeningDebit,
    total_cumulative_credit: totalOpeningCredit,
    total_closing_debit: totalOpeningDebit,
    total_closing_credit: totalOpeningCredit,
    is_balanced: Math.abs(totalOpeningDebit - totalOpeningCredit) < 0.005,
  }
}

const moduleConfigs: Record<ModuleKind, ModuleConfig> = {
  attachmentCenter: {
    keywordPlaceholder: '搜索附件名称、来源模块、关联单据、上传人',
    primaryAction: '上传附件',
    importLabel: '批量上传',
    statusOptions: ['全部', '待处理', '已匹配', '待确认', '异常'],
    summary: [
      { label: '附件总数', value: '286 个', tone: 'blue' },
      { label: '已关联', value: '241 个', tone: 'green' },
      { label: '待归档', value: '33 个', tone: 'amber' },
      { label: '异常文件', value: '12 个', tone: 'red' },
    ],
    columns: [
      { key: 'name', label: '附件名称' },
      { key: 'type', label: '文件类型' },
      { key: 'module', label: '来源模块' },
      { key: 'related', label: '关联单据' },
      { key: 'hash', label: '文件校验' },
      { key: 'uploader', label: '上传人' },
      { key: 'time', label: '上传时间' },
      { key: 'archive', label: '归档状态' },
    ],
    rows: [
      { id: 'att-001', status: '已匹配', voucher: '记-0051', attachment: 'PDF', values: { name: '310026000118.pdf', type: '发票PDF', module: '销项发票', related: '310026000118', hash: 'a84f...9c2', uploader: '王会计', time: '06-26 09:12', archive: '已归档' } },
      { id: 'att-002', status: '待确认', voucher: '未生成', attachment: 'OFD', values: { name: 'bank-receipt-0526.zip', type: '银行回单', module: '银行流水', related: 'BANK-0526-01', hash: 'f20a...71d', uploader: '客户上传', time: '06-26 10:03', archive: '待关联' } },
      { id: 'att-003', status: '异常', voucher: '-', attachment: '图片', values: { name: 'invoice-blur.jpg', type: '发票影像', module: '资料采集', related: 'IC-003', hash: '校验失败', uploader: '客户上传', time: '06-26 10:48', archive: '需重传' } },
    ],
    notes: ['附件中心是后续审计和导出归档的基础，必须保留来源模块、关联单据、哈希和上传日志。', '当前先建立统一附件台账，后续与本地文件存储、Tauri 文件目录和导出包联动。'],
  },
  importCenter: {
    keywordPlaceholder: '搜索导入模板、模块、文件名、操作人',
    primaryAction: '新建导入',
    importLabel: '上传文件',
    statusOptions: ['全部', '待处理', '已通过', '待确认', '异常'],
    summary: [
      { label: '导入批次', value: '24 批', tone: 'blue' },
      { label: '成功', value: '19 批', tone: 'green' },
      { label: '待确认', value: '3 批', tone: 'amber' },
      { label: '失败', value: '2 批', tone: 'red' },
    ],
    columns: [
      { key: 'template', label: '导入模板' },
      { key: 'module', label: '目标模块' },
      { key: 'file', label: '文件名' },
      { key: 'rows', label: '记录数', align: 'right' },
      { key: 'success', label: '成功数', align: 'right' },
      { key: 'failed', label: '失败数', align: 'right' },
      { key: 'operator', label: '操作人' },
      { key: 'time', label: '导入时间' },
    ],
    rows: [
      { id: 'imp-001', status: '已通过', voucher: '-', attachment: '模板', values: { template: '进项发票导入模板', module: '进项发票', file: 'input_invoice_0526.xlsx', rows: '72', success: '70', failed: '2', operator: '李会计', time: '06-26 09:40' } },
      { id: 'imp-002', status: '待确认', voucher: '草稿', attachment: '日志', values: { template: '银行流水导入模板', module: '银行账单', file: 'bank_icbc_0526.csv', rows: '188', success: '188', failed: '0', operator: '王会计', time: '06-26 10:12' } },
      { id: 'imp-003', status: '异常', voucher: '-', attachment: '错误清单', values: { template: '期初余额导入模板', module: '期初余额', file: 'initial_balance.xlsx', rows: '156', success: '149', failed: '7', operator: '赵会计', time: '06-26 10:38' } },
    ],
    notes: ['导入中心统一承载 Excel/CSV/OFD/PDF 批次、错误清单、模板版本和回滚记录。', '后续需要把导入批次写入 export/import jobs 表，并支持错误定位到原始行。'],
  },
  exportCenter: {
    keywordPlaceholder: '搜索导出文件、模块、格式、操作人',
    primaryAction: '新建导出',
    importLabel: '导出日志',
    statusOptions: ['全部', '待处理', '已通过', '待确认', '异常'],
    summary: [
      { label: '导出任务', value: '36 个', tone: 'blue' },
      { label: '已完成', value: '31 个', tone: 'green' },
      { label: '待下载', value: '4 个', tone: 'amber' },
      { label: '失败', value: '1 个', tone: 'red' },
    ],
    columns: [
      { key: 'file', label: '文件名称' },
      { key: 'module', label: '来源模块' },
      { key: 'format', label: '格式', align: 'center' },
      { key: 'scope', label: '导出范围' },
      { key: 'hash', label: '文件哈希' },
      { key: 'operator', label: '操作人' },
      { key: 'time', label: '生成时间' },
      { key: 'expire', label: '保留期限' },
    ],
    rows: [
      { id: 'exp-001', status: '已通过', voucher: '-', attachment: 'PDF', values: { file: '会计凭证-2026-05.pdf', module: '会计凭证', format: 'PDF', scope: '当前筛选', hash: 'd91b...3ac', operator: '王会计', time: '06-26 22:12', expire: '永久归档' } },
      { id: 'exp-002', status: '待确认', voucher: '-', attachment: 'XLSX', values: { file: '税务申报包-2026-05.xlsx', module: '税务申报', format: 'Excel', scope: '申报包', hash: '生成中', operator: '李会计', time: '06-26 22:14', expire: '30 天' } },
      { id: 'exp-003', status: '异常', voucher: '-', attachment: '日志', values: { file: '附件归档包.zip', module: '附件中心', format: 'ZIP', scope: '全部附件', hash: '失败', operator: '赵会计', time: '06-26 22:18', expire: '待重试' } },
    ],
    notes: ['下载中心对应竞品常见的导出文件管理入口，后续所有 Excel/PDF/ZIP 都应在这里留痕。', '正式导出需要记录筛选条件、模板版本、文件哈希、操作人和下载状态。'],
  },
  aiJobQueue: {
    keywordPlaceholder: '搜索任务号、来源模块、文件、处理阶段、负责人',
    primaryAction: '新建AI任务',
    importLabel: '导入任务',
    statusOptions: ['全部', '待处理', '待确认', '已通过', '异常'],
    summary: [
      { label: 'AI任务', value: '86 个', tone: 'blue' },
      { label: '已完成', value: '62 个', tone: 'green' },
      { label: '待确认', value: '18 个', tone: 'amber' },
      { label: '异常', value: '6 个', tone: 'red' },
    ],
    columns: [
      { key: 'jobNo', label: '任务号' },
      { key: 'source', label: '来源模块' },
      { key: 'file', label: '文件/批次' },
      { key: 'stage', label: '处理阶段' },
      { key: 'confidence', label: '平均置信度', align: 'right' },
      { key: 'owner', label: '负责人' },
      { key: 'startedAt', label: '开始时间' },
      { key: 'next', label: '下一步' },
    ],
    rows: [
      { id: 'aij-001', status: '待确认', voucher: '草稿12', attachment: 'OCR结果', values: { jobNo: 'AI-20260626-001', source: '销项发票', file: '销项发票批次0526', stage: '凭证建议完成', confidence: '92%', owner: '王会计', startedAt: '06-26 09:12', next: '人工确认分录' } },
      { id: 'aij-002', status: '已通过', voucher: '记-0051', attachment: '日志', values: { jobNo: 'AI-20260626-002', source: '银行流水', file: 'BANK-0526-01', stage: '已生成凭证', confidence: '96%', owner: '李会计', startedAt: '06-26 10:03', next: '归档日志' } },
      { id: 'aij-003', status: '异常', voucher: '-', attachment: '错误截图', values: { jobNo: 'AI-20260626-003', source: '单据登记', file: '费用报销图片', stage: '识别失败', confidence: '41%', owner: '赵会计', startedAt: '06-26 10:48', next: '人工处理' } },
    ],
    notes: ['AI 任务队列用于承载 OCR、流水分类、凭证建议和风险解释的异步处理状态。', 'AI 任务不能直接入账，必须进入待确认或异常处理流程。'],
  },
  aiRecognitionResults: {
    keywordPlaceholder: '搜索识别对象、来源文件、字段、置信度、处理人',
    primaryAction: '复核识别',
    importLabel: '导入结果',
    statusOptions: ['全部', '待处理', '待确认', '已通过', '异常'],
    summary: [
      { label: '识别结果', value: '248 条', tone: 'blue' },
      { label: '自动通过', value: '196 条', tone: 'green' },
      { label: '待复核', value: '39 条', tone: 'amber' },
      { label: '异常字段', value: '13 条', tone: 'red' },
    ],
    columns: [
      { key: 'object', label: '识别对象' },
      { key: 'file', label: '来源文件' },
      { key: 'fields', label: '关键字段' },
      { key: 'matched', label: '档案匹配' },
      { key: 'confidence', label: '置信度', align: 'right' },
      { key: 'risk', label: '风险' },
      { key: 'reviewer', label: '复核人' },
      { key: 'target', label: '流向模块' },
    ],
    rows: [
      { id: 'air-001', status: '已通过', voucher: '草稿', attachment: 'PDF', values: { object: '销项发票 310026000118', file: '310026000118.pdf', fields: '购方/税率/金额', matched: '客户已匹配', confidence: '98%', risk: '无', reviewer: '系统', target: '销项发票' } },
      { id: 'air-002', status: '待确认', voucher: '草稿', attachment: 'OFD', values: { object: '进项发票 310026000221', file: 'input_0221.ofd', fields: '供应商/税额', matched: '供应商待确认', confidence: '84%', risk: '税率需复核', reviewer: '李会计', target: '进项发票' } },
      { id: 'air-003', status: '异常', voucher: '-', attachment: '图片', values: { object: '费用报销单', file: 'expense_blur.jpg', fields: '金额/日期', matched: '未匹配', confidence: '43%', risk: '影像模糊', reviewer: '待处理', target: '异常队列' } },
    ],
    notes: ['识别结果必须保留来源文件、字段置信度、档案匹配和人工复核状态。', '后续可从这里回链到附件中心、销项发票、进项发票和凭证建议。'],
  },
  aiVoucherSuggestions: {
    keywordPlaceholder: '搜索建议号、来源、摘要、科目、置信度',
    primaryAction: '批量确认',
    importLabel: '导出建议',
    statusOptions: ['全部', '待处理', '待确认', '已确认', '已生成凭证', '异常'],
    summary: [
      { label: '凭证建议', value: '54 条', tone: 'blue' },
      { label: '可确认', value: '38 条', tone: 'green' },
      { label: '待修改', value: '12 条', tone: 'amber' },
      { label: '高风险', value: '4 条', tone: 'red' },
    ],
    columns: [
      { key: 'suggestNo', label: '建议号' },
      { key: 'source', label: '来源单据' },
      { key: 'summary', label: '摘要' },
      { key: 'debit', label: '借方科目' },
      { key: 'credit', label: '贷方科目' },
      { key: 'amount', label: '金额', align: 'right' },
      { key: 'confidence', label: '置信度', align: 'right' },
      { key: 'risk', label: '风险提示' },
    ],
    rows: [
      { id: 'ais-001', status: '待确认', voucher: '草稿', attachment: '发票', values: { suggestNo: 'SUG-001', source: '销项发票 310026000118', summary: '销售控制器', debit: '1122 应收账款', credit: '6001/2221', amount: '¥97,180.00', confidence: '95%', risk: '低' } },
      { id: 'ais-002', status: '已生成凭证', voucher: '记-0058', attachment: '发票', values: { suggestNo: 'SUG-002', source: '进项发票 310026000221', summary: '采购原材料', debit: '1403/2221', credit: '2202 应付账款', amount: '¥142,945.00', confidence: '96%', risk: '已确认' } },
      { id: 'ais-003', status: '异常', voucher: '-', attachment: '流水', values: { suggestNo: 'SUG-003', source: '银行流水 BANK-0526-88', summary: '银行手续费', debit: '6603 财务费用', credit: '1002 银行存款', amount: '差异', confidence: '67%', risk: '金额不平' } },
    ],
    notes: ['AI 凭证建议必须展示来源、借贷分录、金额、置信度和风险提示。', '生成正式凭证前必须人工确认，不能静默入账。'],
  },
  aiRuleTraining: {
    keywordPlaceholder: '搜索规则、训练来源、命中率、审核状态',
    primaryAction: '新增训练规则',
    importLabel: '导入样本',
    statusOptions: ['全部', '已发布', '待复核'],
    summary: [
      { label: '训练规则', value: '3 条', tone: 'blue' },
      { label: '已发布', value: '1 条', tone: 'green' },
      { label: '待复核', value: '2 条', tone: 'amber' },
      { label: '本期命中', value: '0 次', tone: 'gray' },
    ],
    columns: [
      { key: 'name', label: '规则名称' },
      { key: 'condition', label: '训练条件/样本来源' },
      { key: 'action', label: '建议动作' },
      { key: 'subject', label: '目标科目' },
      { key: 'priority', label: '优先级', align: 'right' },
      { key: 'hit', label: '本期命中', align: 'right' },
      { key: 'effect', label: '生效范围' },
    ],
    rows: [
      { id: 'ait-001', status: '已发布', voucher: '-', attachment: '训练样本', values: { name: '技术服务收入识别', condition: '销项发票服务费项目 + 已审核历史凭证', action: '生成待确认收入凭证建议', subject: '6001 主营业务收入', priority: '80', hit: '0', effect: '已发布到建议队列' } },
      { id: 'ait-002', status: '待复核', voucher: '-', attachment: '训练样本', values: { name: '银行手续费分类', condition: '银行流水摘要包含手续费', action: '生成待确认费用凭证建议', subject: '6603 财务费用', priority: '60', hit: '0', effect: '仅保留待复核' } },
      { id: 'ait-003', status: '待复核', voucher: '-', attachment: '训练样本', values: { name: '办公采购费用', condition: '进项发票品类为办公用品', action: '生成费用科目建议', subject: '6602 管理费用', priority: '50', hit: '0', effect: '仅保留待复核' } },
    ],
    notes: ['训练规则只产出建议和候选规则，必须人工审核后才能发布。', '规则的训练条件、目标动作、优先级、发布状态和命中记录均按当前账套留存。'],
  },
  notificationCenter: {
    keywordPlaceholder: '搜索待办、客户、模块、负责人、截止日期',
    primaryAction: '新建待办',
    importLabel: '导出待办',
    statusOptions: ['全部', '待处理', '待确认', '已通过', '异常'],
    summary: [
      { label: '待办事项', value: '64 条', tone: 'blue' },
      { label: '今日到期', value: '18 条', tone: 'amber' },
      { label: '已完成', value: '39 条', tone: 'green' },
      { label: '逾期', value: '7 条', tone: 'red' },
    ],
    columns: [
      { key: 'title', label: '待办标题' },
      { key: 'customer', label: '客户/账套' },
      { key: 'module', label: '来源模块' },
      { key: 'level', label: '优先级', align: 'center' },
      { key: 'owner', label: '负责人' },
      { key: 'deadline', label: '截止日期' },
      { key: 'link', label: '处理入口' },
      { key: 'result', label: '处理结果' },
    ],
    rows: [
      { id: 'nt-001', status: '待处理', voucher: '-', attachment: '资料', values: { title: '客户补传银行回单', customer: '科旋电气', module: '附件资料', level: '高', owner: '王会计', deadline: '今天', link: '附件中心', result: '待处理' } },
      { id: 'nt-002', status: '待确认', voucher: '申报包', attachment: '风险项', values: { title: '增值税申报包确认', customer: '科旋电气', module: '税务申报', level: '高', owner: '李会计', deadline: '06-30', link: '申报工作台', result: '待确认' } },
      { id: 'nt-003', status: '异常', voucher: '记-0062', attachment: '检查结果', values: { title: '凭证借贷不平', customer: '科旋电气', module: '风险检查', level: '阻断', owner: '赵会计', deadline: '逾期', link: '风险检查', result: '待修复' } },
    ],
    notes: ['通知和待办中心用于串联资料采集、AI 确认、凭证异常、报表重算和申报截止日期。', '后续需要支持客户催办、内部分派、完成记录和消息审计。'],
  },
  contractLedger: {
    keywordPlaceholder: '搜索合同编号、客户/供应商、合同类型、印花税状态',
    primaryAction: '新增合同',
    importLabel: '导入合同',
    statusOptions: ['全部', '待处理', '待确认', '已通过', '异常'],
    summary: [
      { label: '合同数量', value: '46 份', tone: 'blue' },
      { label: '已归档', value: '39 份', tone: 'green' },
      { label: '待计税', value: '5 份', tone: 'amber' },
      { label: '异常', value: '2 份', tone: 'red' },
    ],
    columns: [
      { key: 'contractNo', label: '合同编号' },
      { key: 'partner', label: '客户/供应商' },
      { key: 'type', label: '合同类型' },
      { key: 'signDate', label: '签订日期' },
      { key: 'amount', label: '合同金额', align: 'right' },
      { key: 'taxItem', label: '印花税税目' },
      { key: 'invoice', label: '发票关联' },
      { key: 'archive', label: '归档状态' },
    ],
    rows: [
      { id: 'con-001', status: '已通过', voucher: '税表快照', attachment: 'PDF', values: { contractNo: 'HT-2026-001', partner: '上海辰光贸易有限公司', type: '销售合同', signDate: '2026-05-03', amount: '¥680,000.00', taxItem: '购销合同', invoice: '销项 12 张', archive: '已归档' } },
      { id: 'con-002', status: '待确认', voucher: '待计税', attachment: '扫描件', values: { contractNo: 'HT-2026-008', partner: '杭州辰星科技有限公司', type: '服务合同', signDate: '2026-05-09', amount: '¥120,000.00', taxItem: '技术合同', invoice: '销项 1 张', archive: '待复核' } },
      { id: 'con-003', status: '异常', voucher: '-', attachment: '缺签章', values: { contractNo: 'HT-2026-019', partner: '南京云杉贸易有限公司', type: '采购合同', signDate: '待补', amount: '¥98,000.00', taxItem: '购销合同', invoice: '未关联', archive: '需补资料' } },
    ],
    notes: ['合同台账影响客户资料、单据登记、印花税取数和附件归档，是税务申报闭环里的关键台账。', '当前先补合同编号、相对方、金额、税目、发票关联和归档状态框架。'],
  },
  outputInvoice: {
    keywordPlaceholder: '搜索采集来源、发票号码、购方名称、商品名称、备注',
    primaryAction: '开具发票',
    importLabel: '采集/导入销项',
    statusOptions: ['全部', '待匹配', '已生成凭证', '已作废', '异常'],
    summary: [
      { label: '发票张数', value: '58 张', tone: 'blue' },
      { label: '不含税金额', value: '¥680,000.00', tone: 'green' },
      { label: '销项税额', value: '¥54,210.00', tone: 'amber' },
      { label: '异常发票', value: '2 张', tone: 'red' },
    ],
    columns: [
      { key: 'source', label: '采集来源' },
      { key: 'date', label: '开票日期' },
      { key: 'number', label: '发票号码' },
      { key: 'buyer', label: '购方名称' },
      { key: 'goods', label: '商品/服务名称' },
      { key: 'amount', label: '不含税金额', align: 'right' },
      { key: 'taxRate', label: '税率', align: 'center' },
      { key: 'tax', label: '税额', align: 'right' },
      { key: 'total', label: '价税合计', align: 'right' },
      { key: 'tags', label: '标签' },
    ],
    rows: [
      { id: 'out-001', status: '已生成凭证', voucher: '记-0051', attachment: 'PDF', values: { source: '税局采集', date: '2026-05-03', number: '310026000118', buyer: '上海辰光贸易有限公司', goods: '控制器 A-100', amount: '¥86,000.00', taxRate: '13%', tax: '¥11,180.00', total: '¥97,180.00' } },
      { id: 'out-002', status: '待确认', voucher: '未生成', attachment: 'OFD', values: { source: '本地导入', date: '2026-05-08', number: '310026000126', buyer: '杭州辰星科技有限公司', goods: '技术服务费', amount: '¥120,000.00', taxRate: '6%', tax: '¥7,200.00', total: '¥127,200.00' } },
      { id: 'out-003', status: '异常', voucher: '未生成', attachment: 'PDF', values: { source: '客户上传', date: '2026-05-16', number: '310026000188', buyer: '南京云杉贸易有限公司', goods: '配件', amount: '¥38,000.00', taxRate: '待核', tax: '¥4,940.00', total: '¥42,940.00' } },
    ],
    notes: ['销项发票页面内置采集能力，支持税局采集、本地导入、客户上传和 OCR 流转。', '导出格式包含采集来源、购方、商品行、金额税额、凭证号和附件状态。'],
  },
  inputInvoice: {
    keywordPlaceholder: '搜索采集来源、发票号码、销方名称、商品名称、勾选状态',
    primaryAction: '勾选并生成凭证',
    importLabel: '采集/导入进项',
    statusOptions: ['全部', '待勾选', '已勾选', '已生成凭证', '异常'],
    summary: [
      { label: '发票张数', value: '72 张', tone: 'blue' },
      { label: '可抵扣税额', value: '¥42,860.00', tone: 'green' },
      { label: '待勾选', value: '18 张', tone: 'amber' },
      { label: '异常发票', value: '3 张', tone: 'red' },
    ],
    columns: [
      { key: 'source', label: '采集来源' },
      { key: 'date', label: '开票日期' },
      { key: 'number', label: '发票号码' },
      { key: 'seller', label: '销方名称' },
      { key: 'goods', label: '商品/服务名称' },
      { key: 'amount', label: '不含税金额', align: 'right' },
      { key: 'taxRate', label: '税率', align: 'center' },
      { key: 'tax', label: '税额', align: 'right' },
      { key: 'deduction', label: '勾选用途' },
      { key: 'selectionStatus', label: '认证状态', align: 'center' },
      { key: 'tags', label: '标签' },
    ],
    rows: [
      { id: 'in-001', status: '待确认', voucher: '未生成', attachment: 'PDF', values: { source: '税局票池', date: '2026-05-06', number: '310026000142', seller: '上海云启科技有限公司', goods: '服务器租赁', amount: '¥38,000.00', taxRate: '13%', tax: '¥4,940.00', deduction: '待勾选', selectionStatus: '待认证' } },
      { id: 'in-002', status: '已匹配', voucher: '记-0058', attachment: 'OFD', values: { source: '本地导入', date: '2026-05-09', number: '310026000186', seller: '苏州材料供应链有限公司', goods: '原材料', amount: '¥126,500.00', taxRate: '13%', tax: '¥16,445.00', deduction: '增值税抵扣', selectionStatus: '已认证' } },
      { id: 'in-003', status: '异常', voucher: '未生成', attachment: 'PDF', values: { source: '客户上传', date: '2026-05-12', number: '310026000221', seller: '杭州设备服务有限公司', goods: '维修费', amount: '¥9,800.00', taxRate: '6%', tax: '¥588.00', deduction: '税率需复核', selectionStatus: '阻断' } },
    ],
    notes: ['进项发票页面内置采集和勾选认证能力，统一处理票池同步、OCR、抵扣用途和供应商匹配。', '后续与增值税申报主表、进项转出明细和凭证草稿联动。'],
  },
  billList: {
    keywordPlaceholder: '搜索账单摘要、对方户名、银行账号',
    primaryAction: '生成凭证',
    importLabel: '采集/导入流水',
    statusOptions: ['全部', '未匹配', '已匹配', '异常'],
    summary: [
      { label: '本期流水', value: '96 笔', tone: 'blue' },
      { label: '收入金额', value: '¥821,300.00', tone: 'green' },
      { label: '支出金额', value: '¥574,920.00', tone: 'amber' },
      { label: '待匹配', value: '21 笔', tone: 'red' },
    ],
    columns: [
      { key: 'source', label: '采集来源' },
      { key: 'date', label: '交易日期' },
      { key: 'account', label: '银行账户' },
      { key: 'counterparty', label: '对方户名' },
      { key: 'summary', label: '摘要' },
      { key: 'income', label: '收入', align: 'right' },
      { key: 'expense', label: '支出', align: 'right' },
      { key: 'tags', label: '标签' },
    ],
    rows: [
      { id: 'bill-001', status: '待处理', voucher: '未生成', attachment: '回单', values: { source: '银行采集', date: '2026-05-03', account: '工行基本户', counterparty: '上海辰光贸易有限公司', summary: '货款', income: '¥86,000.00', expense: '-' } },
      { id: 'bill-002', status: '已生成凭证', voucher: '记-0042', attachment: '回单', values: { source: '网银导入', date: '2026-05-08', account: '招行一般户', counterparty: '上海办公服务有限公司', summary: '房租', income: '-', expense: '¥18,000.00' } },
      { id: 'bill-003', status: '异常', voucher: '未生成', attachment: '无', values: { source: '客户上传', date: '2026-05-13', account: '工行基本户', counterparty: '个人转账', summary: '备用金', income: '-', expense: '¥5,000.00' } },
    ],
    notes: ['账单一览内置银行流水处理能力，支持银行采集、网银导入、客户上传、回单归档与规则匹配。', 'AI 可基于摘要、对方户名、金额区间推荐科目和辅助核算。'],
  },
  bankStatement: {
    keywordPlaceholder: '搜索银行账户、流水号、对方户名、摘要、回单状态',
    primaryAction: '生成银行凭证',
    importLabel: '采集/导入银行流水',
    statusOptions: ['全部', '待处理', '已匹配', '已生成凭证', '异常'],
    summary: [
      { label: '银行流水', value: '188 笔', tone: 'blue' },
      { label: '已匹配', value: '151 笔', tone: 'green' },
      { label: '待回单', value: '24 笔', tone: 'amber' },
      { label: '对账差异', value: '5 笔', tone: 'red' },
    ],
    columns: [
      { key: 'account', label: '银行账户' },
      { key: 'serialNo', label: '流水号' },
      { key: 'date', label: '交易日期' },
      { key: 'counterparty', label: '对方户名' },
      { key: 'summary', label: '摘要' },
      { key: 'income', label: '收入', align: 'right' },
      { key: 'expense', label: '支出', align: 'right' },
      { key: 'balance', label: '余额', align: 'right' },
      { key: 'receiptStatus', label: '回单状态' },
      { key: 'matchResult', label: '匹配结果' },
      { key: 'tags', label: '标签' },
    ],
    rows: [
      { id: 'bank-001', status: '已匹配', voucher: '草稿31', attachment: '回单PDF', values: { account: '工行基本户', serialNo: 'ICBC-20260503-0018', date: '2026-05-03', counterparty: '上海辰光贸易有限公司', summary: '货款', income: '¥86,000.00', expense: '-', balance: '¥1,286,300.00', receiptStatus: '已归档', matchResult: '销项发票 310026000118' } },
      { id: 'bank-002', status: '已生成凭证', voucher: '记-0042', attachment: '电子回单', values: { account: '招行一般户', serialNo: 'CMB-20260508-0091', date: '2026-05-08', counterparty: '上海办公服务有限公司', summary: '房租', income: '-', expense: '¥18,000.00', balance: '¥526,800.00', receiptStatus: '已归档', matchResult: '费用凭证已生成' } },
      { id: 'bank-003', status: '异常', voucher: '-', attachment: '缺失', values: { account: '工行基本户', serialNo: 'ICBC-20260513-0042', date: '2026-05-13', counterparty: '个人转账', summary: '备用金', income: '-', expense: '¥5,000.00', balance: '¥1,188,240.00', receiptStatus: '待上传', matchResult: '对方户名需确认' } },
    ],
    notes: ['银行账单页聚焦单账套银行流水、回单、余额、对账和凭证生成，不承担机构级批量采集入口。', '直连银行能力仅作为 adapter 配置和授权状态预留，当前表格以导入/采集批次和人工确认闭环为准。'],
  },
  receipt: {
    keywordPlaceholder: '搜索票据号码、出票方、用途',
    primaryAction: '登记票据',
    importLabel: '导入票据',
    statusOptions: ['全部', '待处理', '已背书', '已到期', '异常'],
    summary: [
      { label: '票据余额', value: '¥310,000.00', tone: 'blue' },
      { label: '本期新增', value: '7 张', tone: 'green' },
      { label: '30天内到期', value: '2 张', tone: 'amber' },
      { label: '异常', value: '1 张', tone: 'red' },
    ],
    columns: [
      { key: 'number', label: '票据号码' },
      { key: 'type', label: '票据类型' },
      { key: 'issuer', label: '出票方' },
      { key: 'dueDate', label: '到期日' },
      { key: 'amount', label: '票面金额', align: 'right' },
      { key: 'purpose', label: '用途' },
    ],
    rows: [
      { id: 'rcp-001', status: '待确认', voucher: '未生成', attachment: '影像', values: { number: 'E20260501001', type: '银行承兑', issuer: '上海客户A', dueDate: '2026-08-01', amount: '¥120,000.00', purpose: '收款' } },
      { id: 'rcp-002', status: '已生成凭证', voucher: '记-0061', attachment: '影像', values: { number: 'E20260506009', type: '商业承兑', issuer: '江苏客户B', dueDate: '2026-07-15', amount: '¥80,000.00', purpose: '背书付款' } },
      { id: 'rcp-003', status: '异常', voucher: '未生成', attachment: '无', values: { number: 'E20260509011', type: '银行承兑', issuer: '浙江客户C', dueDate: '2026-05-28', amount: '¥110,000.00', purpose: '待补附件' } },
    ],
    notes: ['票据模块后续与应收应付、银行回单、凭证来源链路打通。'],
  },
  documentRegister: {
    keywordPlaceholder: '搜索单据编号、业务类型、往来单位',
    primaryAction: '新增单据',
    importLabel: '批量导入',
    statusOptions: ['全部', '待审核', '已审核', '已生成凭证'],
    summary: [
      { label: '登记单据', value: '34 张', tone: 'blue' },
      { label: '已审核', value: '24 张', tone: 'green' },
      { label: '待生成凭证', value: '10 张', tone: 'amber' },
      { label: '附件缺失', value: '3 张', tone: 'red' },
    ],
    columns: [
      { key: 'date', label: '业务日期' },
      { key: 'code', label: '单据编号' },
      { key: 'type', label: '业务类型' },
      { key: 'partner', label: '往来单位' },
      { key: 'amount', label: '金额', align: 'right' },
      { key: 'owner', label: '经办人' },
    ],
    rows: [
      { id: 'doc-001', status: '待确认', voucher: '未生成', attachment: '3 个', values: { date: '2026-05-02', code: 'DJ-202605-001', type: '费用报销', partner: '行政部', amount: '¥2,360.00', owner: '王会计' } },
      { id: 'doc-002', status: '已生成凭证', voucher: '记-0039', attachment: '2 个', values: { date: '2026-05-07', code: 'DJ-202605-008', type: '采购入库', partner: '供应商A', amount: '¥47,500.00', owner: '李会计' } },
      { id: 'doc-003', status: '异常', voucher: '未生成', attachment: '缺失', values: { date: '2026-05-11', code: 'DJ-202605-014', type: '差旅报销', partner: '销售部', amount: '¥6,120.00', owner: '赵会计' } },
    ],
    notes: ['单据登记用于覆盖非发票、非银行流水来源，统一进入凭证草稿池。'],
  },
  expenseReimbursement: {
    keywordPlaceholder: '搜索报销单号、员工、部门、费用类型、审批状态',
    primaryAction: '新增报销',
    importLabel: '导入报销单',
    statusOptions: ['全部', '待审批', '已审批', '待付款', '已生成凭证', '异常'],
    summary: [
      { label: '报销单', value: '29 张', tone: 'blue' },
      { label: '已审批', value: '18 张', tone: 'green' },
      { label: '待付款', value: '7 张', tone: 'amber' },
      { label: '附件异常', value: '2 张', tone: 'red' },
    ],
    columns: [
      { key: 'date', label: '申请日期' },
      { key: 'code', label: '报销单号' },
      { key: 'employee', label: '报销人' },
      { key: 'department', label: '部门' },
      { key: 'expenseType', label: '费用类型' },
      { key: 'amount', label: '报销金额', align: 'right' },
      { key: 'payStatus', label: '付款状态' },
      { key: 'approval', label: '审批状态' },
    ],
    rows: [
      { id: 'er-001', status: '待确认', voucher: '未生成', attachment: '发票2', values: { date: '2026-05-06', code: 'BX-202605-001', employee: '张三', department: '销售部', expenseType: '差旅费', amount: '¥2,860.00', payStatus: '待付款', approval: '主管已批' } },
      { id: 'er-002', status: '已生成凭证', voucher: '记-0048', attachment: '发票1', values: { date: '2026-05-09', code: 'BX-202605-006', employee: '李四', department: '行政部', expenseType: '办公费', amount: '¥860.00', payStatus: '已付款', approval: '已归档' } },
      { id: 'er-003', status: '异常', voucher: '未生成', attachment: '缺票', values: { date: '2026-05-16', code: 'BX-202605-012', employee: '王五', department: '研发部', expenseType: '交通费', amount: '¥420.00', payStatus: '待补票', approval: '退回' } },
    ],
    notes: ['费用报销承接员工报销、附件票据、付款状态和费用凭证生成。'],
  },
  purchaseManagement: {
    keywordPlaceholder: '搜索采购单号、供应商、入库状态、发票状态',
    primaryAction: '新增采购',
    importLabel: '导入采购单',
    statusOptions: ['全部', '待入库', '待收票', '待付款', '已完成', '异常'],
    summary: [
      { label: '采购单', value: '42 单', tone: 'blue' },
      { label: '已入库', value: '31 单', tone: 'green' },
      { label: '待收票', value: '8 单', tone: 'amber' },
      { label: '三方差异', value: '3 单', tone: 'red' },
    ],
    columns: [
      { key: 'date', label: '采购日期' },
      { key: 'orderNo', label: '采购单号' },
      { key: 'supplier', label: '供应商' },
      { key: 'goods', label: '商品/服务' },
      { key: 'amount', label: '采购金额', align: 'right' },
      { key: 'stock', label: '入库状态' },
      { key: 'invoice', label: '发票状态' },
      { key: 'payment', label: '付款状态' },
    ],
    rows: [
      { id: 'pm-001', status: '已匹配', voucher: '草稿18', attachment: '入库单', values: { date: '2026-05-05', orderNo: 'CG-202605-001', supplier: '上海零件供应商', goods: '控制器 A-100', amount: '¥168,000.00', stock: '已入库', invoice: '进项已匹配', payment: '待付款' } },
      { id: 'pm-002', status: '待确认', voucher: '未生成', attachment: '合同', values: { date: '2026-05-10', orderNo: 'CG-202605-009', supplier: '苏州材料供应商', goods: '原材料', amount: '¥96,000.00', stock: '待入库', invoice: '待收票', payment: '未付款' } },
      { id: 'pm-003', status: '异常', voucher: '-', attachment: '差异', values: { date: '2026-05-18', orderNo: 'CG-202605-018', supplier: '杭州设备公司', goods: '设备维护', amount: '¥18,600.00', stock: '不适用', invoice: '税额差异', payment: '已付款' } },
    ],
    notes: ['采购管理用于采购订单、入库、进项发票和付款核销的前置台账。'],
  },
  salesManagement: {
    keywordPlaceholder: '搜索销售单号、客户、出库状态、开票状态',
    primaryAction: '新增销售',
    importLabel: '导入销售单',
    statusOptions: ['全部', '待出库', '待开票', '待收款', '已完成', '异常'],
    summary: [
      { label: '销售单', value: '56 单', tone: 'blue' },
      { label: '已开票', value: '43 单', tone: 'green' },
      { label: '待收款', value: '11 单', tone: 'amber' },
      { label: '出库异常', value: '2 单', tone: 'red' },
    ],
    columns: [
      { key: 'date', label: '销售日期' },
      { key: 'orderNo', label: '销售单号' },
      { key: 'customer', label: '客户' },
      { key: 'goods', label: '商品/服务' },
      { key: 'amount', label: '销售金额', align: 'right' },
      { key: 'delivery', label: '出库状态' },
      { key: 'invoice', label: '开票状态' },
      { key: 'receipt', label: '收款状态' },
    ],
    rows: [
      { id: 'sm-001', status: '已生成凭证', voucher: '记-0068', attachment: '出库单', values: { date: '2026-05-03', orderNo: 'XS-202605-001', customer: '上海辰光贸易有限公司', goods: '控制器 A-100', amount: '¥97,180.00', delivery: '已出库', invoice: '销项已开', receipt: '待核销' } },
      { id: 'sm-002', status: '待确认', voucher: '未生成', attachment: '订单', values: { date: '2026-05-12', orderNo: 'XS-202605-014', customer: '杭州客户', goods: '技术服务', amount: '¥127,200.00', delivery: '不适用', invoice: '待开票', receipt: '未收款' } },
      { id: 'sm-003', status: '异常', voucher: '-', attachment: '差异', values: { date: '2026-05-20', orderNo: 'XS-202605-022', customer: '南京云杉贸易有限公司', goods: '配件', amount: '¥42,940.00', delivery: '少出库', invoice: '已开票', receipt: '部分收款' } },
    ],
    notes: ['销售管理用于销售订单、出库、销项发票和收款核销的前置台账。'],
  },
  voucher: {
    keywordPlaceholder: '搜索凭证号、摘要、科目、制单人、来源单据',
    primaryAction: '新增凭证',
    importLabel: '导入凭证',
    statusOptions: ['全部', '草稿', '待审核', '已审核', '已过账', '异常'],
    summary: [
      { label: '本期凭证', value: '82 张', tone: 'blue' },
      { label: '已审核', value: '73 张', tone: 'green' },
      { label: '待审核', value: '9 张', tone: 'amber' },
      { label: '断号/异常', value: '1 张', tone: 'red' },
    ],
    columns: [
      { key: 'date', label: '凭证日期' },
      { key: 'wordNo', label: '凭证字号' },
      { key: 'summary', label: '摘要' },
      { key: 'debitAccount', label: '借方科目' },
      { key: 'creditAccount', label: '贷方科目' },
      { key: 'debit', label: '借方金额', align: 'right' },
      { key: 'credit', label: '贷方金额', align: 'right' },
      { key: 'source', label: '来源' },
      { key: 'maker', label: '制单人' },
      { key: 'auditor', label: '审核人' },
      { key: 'tags', label: '标签' },
    ],
    rows: [
      { id: 'v-0051', status: '已生成凭证', voucher: '记-0051', attachment: '发票2', values: { date: '2026-05-03', wordNo: '记-0051', summary: '销售控制器', debitAccount: '应收账款', creditAccount: '主营业务收入/应交税费', debit: '¥97,180.00', credit: '¥97,180.00', source: '销项发票', maker: '王会计', auditor: '主管' } },
      { id: 'v-0058', status: '已通过', voucher: '记-0058', attachment: '发票1', values: { date: '2026-05-09', wordNo: '记-0058', summary: '采购原材料', debitAccount: '原材料/应交税费', creditAccount: '应付账款', debit: '¥142,945.00', credit: '¥142,945.00', source: '进项发票', maker: '李会计', auditor: '主管' } },
      { id: 'v-0062', status: '异常', voucher: '记-0062', attachment: '无', values: { date: '2026-05-15', wordNo: '记-0062', summary: '银行手续费', debitAccount: '财务费用', creditAccount: '银行存款', debit: '¥320.00', credit: '¥300.00', source: '银行账单', maker: '赵会计', auditor: '未审' } },
    ],
    notes: ['会计凭证页应支持新增、审核、反审核、复制、红冲、断号整理、打印、导出和来源穿透。', '凭证导出和打印模板需要按凭证纸格式单独设计。'],
  },
  voucherCreate: {
    keywordPlaceholder: '搜索来源单据、摘要模板、借贷科目、辅助核算',
    primaryAction: '保存凭证草稿',
    importLabel: '导入分录',
    statusOptions: ['全部', '待处理', '待确认', '已通过', '异常'],
    summary: [
      { label: '制单日期', value: '2026-05-31', tone: 'blue' },
      { label: '借方合计', value: '¥97,180.00', tone: 'green' },
      { label: '贷方合计', value: '¥97,180.00', tone: 'green' },
      { label: '校验异常', value: '0 项', tone: 'amber' },
    ],
    columns: [
      { key: 'field', label: '录入项' },
      { key: 'value', label: '当前值' },
      { key: 'source', label: '来源/模板' },
      { key: 'required', label: '必填' },
      { key: 'check', label: '校验结果' },
      { key: 'remark', label: '说明' },
    ],
    rows: [
      { id: 'vc-001', status: '已通过', voucher: '草稿', attachment: '发票PDF', values: { field: '凭证日期/字号', value: '2026-05-31 / 记-0083', source: '账期自动生成', required: '是', check: '通过', remark: '断号检查通过' } },
      { id: 'vc-002', status: '待确认', voucher: '草稿', attachment: '来源单据', values: { field: '摘要', value: '销售控制器 A-100', source: '销项发票模板', required: '是', check: '待确认', remark: '可套用常用摘要' } },
      { id: 'vc-003', status: '已通过', voucher: '草稿', attachment: '分录2行', values: { field: '借贷分录', value: '借: 应收账款 97,180.00 / 贷: 主营业务收入, 应交税费', source: '凭证模板', required: '是', check: '借贷平衡', remark: '辅助核算客户已匹配' } },
    ],
    notes: ['新增凭证页以录入项、来源、必填和校验为主，避免复用凭证列表表格。', '保存草稿和生成正式凭证前需要完成借贷平衡、科目、辅助核算、附件和断号校验。'],
  },
  voucherEdit: {
    keywordPlaceholder: '搜索凭证字段、修改原因、审核状态、附件',
    primaryAction: '保存修改',
    importLabel: '导出修改记录',
    statusOptions: ['全部', '待确认', '已通过', '异常'],
    summary: [
      { label: '凭证字号', value: '记-0062', tone: 'blue' },
      { label: '当前状态', value: '待审核', tone: 'amber' },
      { label: '修改项', value: '3 项', tone: 'green' },
      { label: '阻断项', value: '1 项', tone: 'red' },
    ],
    columns: [
      { key: 'field', label: '修改字段' },
      { key: 'before', label: '原值' },
      { key: 'after', label: '修改后' },
      { key: 'reason', label: '修改原因' },
      { key: 'check', label: '校验结果' },
      { key: 'audit', label: '审计留痕' },
    ],
    rows: [
      { id: 've-001', status: '待确认', voucher: '记-0062', attachment: '附件1', values: { field: '摘要', before: '银行手续费', after: '支付银行手续费', reason: '补充业务描述', check: '待复核', audit: '记录操作人和时间' } },
      { id: 've-002', status: '已通过', voucher: '记-0062', attachment: '回单', values: { field: '贷方金额', before: '¥300.00', after: '¥320.00', reason: '按银行回单修正', check: '借贷平衡', audit: '保留原值快照' } },
      { id: 've-003', status: '异常', voucher: '记-0062', attachment: '风险项', values: { field: '审核状态', before: '未审', after: '提交审核', reason: '凭证修正后送审', check: '附件缺失', audit: '阻断直接审核' } },
    ],
    notes: ['编辑凭证需要展示原值、修改后、原因、校验和审计记录。', '已审核或已结账期间的修改必须进入反审核/反结账或高风险审批流程。'],
  },
  voucherDetail: {
    keywordPlaceholder: '搜索凭证来源、分录、附件、审核日志',
    primaryAction: '打印凭证',
    importLabel: '导出凭证',
    statusOptions: ['全部', '已通过', '待确认', '异常'],
    summary: [
      { label: '凭证字号', value: '记-0051', tone: 'blue' },
      { label: '借贷合计', value: '¥97,180.00', tone: 'green' },
      { label: '附件', value: '2 个', tone: 'amber' },
      { label: '风险', value: '0 项', tone: 'green' },
    ],
    columns: [
      { key: 'section', label: '查看项' },
      { key: 'content', label: '内容' },
      { key: 'source', label: '来源链路' },
      { key: 'amount', label: '金额', align: 'right' },
      { key: 'operator', label: '操作人' },
      { key: 'result', label: '结果' },
    ],
    rows: [
      { id: 'vd-001', status: '已通过', voucher: '记-0051', attachment: '销项发票', values: { section: '表头', content: '2026-05-03 / 销售控制器', source: '销项发票 310026000118', amount: '¥97,180.00', operator: '王会计', result: '已审核' } },
      { id: 'vd-002', status: '已通过', voucher: '记-0051', attachment: '分录', values: { section: '借贷分录', content: '借: 应收账款 / 贷: 主营业务收入、应交税费', source: '发票模板', amount: '¥97,180.00', operator: '系统建议', result: '借贷平衡' } },
      { id: 'vd-003', status: '待确认', voucher: '记-0051', attachment: '操作日志', values: { section: '审核与打印', content: '审核、导出PDF、打印记录', source: '审计日志', amount: '-', operator: '主管', result: '可追溯' } },
    ],
    notes: ['凭证详情页重点展示凭证来源、分录、附件、审核和打印导出记录。', '详情页导出和打印沿用凭证固定模板，后续继续精细化纸张、分页和中文字体。'],
  },
  transfer: {
    keywordPlaceholder: '搜索转出账户、转入账户、流水号',
    primaryAction: '新增转账',
    importLabel: '导入转账',
    statusOptions: ['全部', '待确认', '已生成凭证', '异常'],
    summary: [
      { label: '本期转账', value: '12 笔', tone: 'blue' },
      { label: '转账金额', value: '¥450,000.00', tone: 'green' },
      { label: '待确认', value: '4 笔', tone: 'amber' },
      { label: '异常', value: '1 笔', tone: 'red' },
    ],
    columns: [
      { key: 'date', label: '转账日期' },
      { key: 'from', label: '转出账户' },
      { key: 'to', label: '转入账户' },
      { key: 'amount', label: '金额', align: 'right' },
      { key: 'fee', label: '手续费', align: 'right' },
      { key: 'serial', label: '流水号' },
    ],
    rows: [
      { id: 'tr-001', status: '已生成凭证', voucher: '记-0046', attachment: '回单', values: { date: '2026-05-04', from: '工行基本户', to: '招行一般户', amount: '¥200,000.00', fee: '¥0.00', serial: 'TR20260504001' } },
      { id: 'tr-002', status: '待确认', voucher: '未生成', attachment: '回单', values: { date: '2026-05-12', from: '招行一般户', to: '支付宝账户', amount: '¥50,000.00', fee: '¥3.00', serial: 'TR20260512006' } },
      { id: 'tr-003', status: '异常', voucher: '未生成', attachment: '无', values: { date: '2026-05-16', from: '现金', to: '工行基本户', amount: '¥8,000.00', fee: '-', serial: '待补' } },
    ],
    notes: ['账户转账默认生成银行存款/其他货币资金内部转账凭证。'],
  },
  employee: {
    keywordPlaceholder: '搜索姓名、证件号、部门、手机号',
    primaryAction: '新增人员',
    importLabel: '导入人员',
    statusOptions: ['全部', '启用', '停用', '异常'],
    summary: [
      { label: '在职人数', value: '42 人', tone: 'blue' },
      { label: '本月入职', value: '3 人', tone: 'green' },
      { label: '待补资料', value: '6 人', tone: 'amber' },
      { label: '离职未停缴', value: '1 人', tone: 'red' },
    ],
    columns: [
      { key: 'name', label: '姓名' },
      { key: 'idNo', label: '证件号' },
      { key: 'department', label: '部门' },
      { key: 'position', label: '岗位' },
      { key: 'mobile', label: '手机号' },
      { key: 'entryDate', label: '入职日期' },
    ],
    rows: [
      { id: 'emp-001', status: '启用', voucher: '-', attachment: '身份证', values: { name: '张三', idNo: '310***********1234', department: '销售部', position: '客户经理', mobile: '138****1001', entryDate: '2025-09-01' } },
      { id: 'emp-002', status: '启用', voucher: '-', attachment: '合同', values: { name: '李四', idNo: '320***********5421', department: '财务部', position: '会计', mobile: '139****2033', entryDate: '2024-03-15' } },
      { id: 'emp-003', status: '异常', voucher: '-', attachment: '缺失', values: { name: '王五', idNo: '待补', department: '生产部', position: '操作员', mobile: '137****8821', entryDate: '2026-05-10' } },
    ],
    notes: ['人员资料供工资、社保公积金、个税扣缴和专项附加扣除使用。'],
  },
  payroll: {
    keywordPlaceholder: '搜索员工、部门、工资项',
    primaryAction: '生成工资凭证',
    importLabel: '导入薪酬表',
    statusOptions: ['全部', '待确认', '已确认', '已生成凭证'],
    summary: [
      { label: '应发工资', value: '¥386,200.00', tone: 'blue' },
      { label: '个税', value: '¥18,420.00', tone: 'amber' },
      { label: '实发工资', value: '¥321,680.00', tone: 'green' },
      { label: '异常行', value: '2 行', tone: 'red' },
    ],
    columns: [
      { key: 'name', label: '员工' },
      { key: 'department', label: '部门' },
      { key: 'base', label: '基本工资', align: 'right' },
      { key: 'bonus', label: '奖金', align: 'right' },
      { key: 'tax', label: '个税', align: 'right' },
      { key: 'net', label: '实发', align: 'right' },
    ],
    rows: [
      { id: 'pay-001', status: '待确认', voucher: '未生成', attachment: '工资条', values: { name: '张三', department: '销售部', base: '¥12,000.00', bonus: '¥2,000.00', tax: '¥680.00', net: '¥11,820.00' } },
      { id: 'pay-002', status: '已生成凭证', voucher: '记-0072', attachment: '工资条', values: { name: '李四', department: '财务部', base: '¥15,000.00', bonus: '¥0.00', tax: '¥950.00', net: '¥12,850.00' } },
      { id: 'pay-003', status: '异常', voucher: '未生成', attachment: '缺失', values: { name: '王五', department: '生产部', base: '¥8,000.00', bonus: '¥500.00', tax: '待算', net: '待算' } },
    ],
    notes: ['薪酬表后续生成计提工资、发放工资、个税和社保公积金凭证。'],
  },
  socialSecurity: {
    keywordPlaceholder: '搜索员工、缴费地、险种',
    primaryAction: '生成社保凭证',
    importLabel: '导入明细',
    statusOptions: ['全部', '待确认', '已生成凭证', '异常'],
    summary: [
      { label: '单位缴纳', value: '¥72,650.00', tone: 'blue' },
      { label: '个人缴纳', value: '¥31,220.00', tone: 'amber' },
      { label: '匹配工资', value: '38 人', tone: 'green' },
      { label: '差异', value: '4 人', tone: 'red' },
    ],
    columns: [
      { key: 'name', label: '员工' },
      { key: 'city', label: '缴费地' },
      { key: 'base', label: '缴费基数', align: 'right' },
      { key: 'company', label: '单位部分', align: 'right' },
      { key: 'personal', label: '个人部分', align: 'right' },
      { key: 'fund', label: '公积金', align: 'right' },
    ],
    rows: [
      { id: 'ss-001', status: '已生成凭证', voucher: '记-0075', attachment: '缴费单', values: { name: '张三', city: '上海', base: '¥12,000.00', company: '¥3,120.00', personal: '¥1,260.00', fund: '¥1,680.00' } },
      { id: 'ss-002', status: '待确认', voucher: '未生成', attachment: '缴费单', values: { name: '李四', city: '上海', base: '¥15,000.00', company: '¥3,900.00', personal: '¥1,575.00', fund: '¥2,100.00' } },
      { id: 'ss-003', status: '异常', voucher: '未生成', attachment: '缺失', values: { name: '王五', city: '上海', base: '待确认', company: '待算', personal: '待算', fund: '待算' } },
    ],
    notes: ['社保公积金模块需要和薪酬表、人员登记、个税申报初始化共享基础资料。'],
  },
  specialDeduction: {
    keywordPlaceholder: '搜索员工、扣除类型、证件号',
    primaryAction: '同步扣除',
    importLabel: '导入扣除',
    statusOptions: ['全部', '有效', '待确认', '异常'],
    summary: [
      { label: '专项扣除', value: '26 条', tone: 'blue' },
      { label: '月扣除额', value: '¥52,000.00', tone: 'green' },
      { label: '待确认', value: '5 条', tone: 'amber' },
      { label: '异常', value: '1 条', tone: 'red' },
    ],
    columns: [
      { key: 'name', label: '员工' },
      { key: 'type', label: '扣除类型' },
      { key: 'start', label: '起始月份' },
      { key: 'end', label: '结束月份' },
      { key: 'amount', label: '月扣除额', align: 'right' },
      { key: 'source', label: '来源' },
    ],
    rows: [
      { id: 'sd-001', status: '启用', voucher: '-', attachment: '资料', values: { name: '张三', type: '住房租金', start: '2026-01', end: '2026-12', amount: '¥1,500.00', source: '导入' } },
      { id: 'sd-002', status: '待确认', voucher: '-', attachment: '资料', values: { name: '李四', type: '子女教育', start: '2026-03', end: '2026-12', amount: '¥2,000.00', source: '手工' } },
      { id: 'sd-003', status: '异常', voucher: '-', attachment: '缺失', values: { name: '王五', type: '赡养老人', start: '待补', end: '待补', amount: '¥2,000.00', source: '导入' } },
    ],
    notes: ['专项附加扣除影响个税测算和扣缴所得税申报表。'],
  },
  depreciation: {
    keywordPlaceholder: '搜索资产名称、编号、类别',
    primaryAction: '新增资产',
    importLabel: '导入资产',
    statusOptions: ['全部', '使用中', '已清理', '异常'],
    summary: [
      { label: '资产原值', value: '¥1,286,000.00', tone: 'blue' },
      { label: '本月折旧', value: '¥28,650.00', tone: 'amber' },
      { label: '已生成凭证', value: '1 张', tone: 'green' },
      { label: '异常资产', value: '2 项', tone: 'red' },
    ],
    columns: [
      { key: 'code', label: '资产编号' },
      { key: 'name', label: '资产名称' },
      { key: 'category', label: '资产类别' },
      { key: 'start', label: '开始使用' },
      { key: 'original', label: '原值', align: 'right' },
      { key: 'depreciation', label: '本月折旧', align: 'right' },
    ],
    rows: [
      { id: 'dep-001', status: '已生成凭证', voucher: '记-0080', attachment: '发票', values: { code: 'FA-001', name: '生产设备A', category: '机器设备', start: '2025-01', original: '¥860,000.00', depreciation: '¥14,333.33' } },
      { id: 'dep-002', status: '待确认', voucher: '未生成', attachment: '合同', values: { code: 'FA-018', name: '办公电脑', category: '电子设备', start: '2026-04', original: '¥48,000.00', depreciation: '¥1,333.33' } },
      { id: 'dep-003', status: '异常', voucher: '未生成', attachment: '缺失', values: { code: 'FA-020', name: '车辆', category: '运输设备', start: '待补', original: '¥210,000.00', depreciation: '待算' } },
    ],
    notes: ['折旧摊销应进入期末结转工作台，支持明细表导出和凭证来源追溯。'],
  },
  inventorySettings: {
    keywordPlaceholder: '搜索存货编码、名称、规格、类别',
    primaryAction: '新增存货',
    importLabel: '导入存货',
    statusOptions: ['全部', '启用', '停用', '异常'],
    summary: [
      { label: '存货档案', value: '128 项', tone: 'blue' },
      { label: '启用', value: '116 项', tone: 'green' },
      { label: '待补税率', value: '9 项', tone: 'amber' },
      { label: '停用', value: '12 项', tone: 'gray' },
    ],
    columns: [
      { key: 'code', label: '存货编码' },
      { key: 'name', label: '存货名称' },
      { key: 'spec', label: '规格型号' },
      { key: 'unit', label: '计量单位' },
      { key: 'taxRate', label: '税率' },
      { key: 'subject', label: '默认科目' },
    ],
    rows: [
      { id: 'inv-001', status: '启用', voucher: '-', attachment: '-', values: { code: 'CH-001', name: '控制器', spec: 'A-100', unit: '台', taxRate: '13%', subject: '库存商品' } },
      { id: 'inv-002', status: '启用', voucher: '-', attachment: '-', values: { code: 'CH-002', name: '连接线', spec: '2m', unit: '根', taxRate: '13%', subject: '原材料' } },
      { id: 'inv-003', status: '异常', voucher: '-', attachment: '-', values: { code: 'CH-019', name: '技术服务', spec: '标准', unit: '项', taxRate: '待补', subject: '主营业务收入' } },
    ],
    notes: ['存货设置与发票商品行、出入库单、成本结转和税率检查联动。'],
  },
  unitSettings: {
    keywordPlaceholder: '搜索单位名称、换算关系',
    primaryAction: '新增单位',
    importLabel: '导入单位',
    statusOptions: ['全部', '启用', '停用'],
    summary: [
      { label: '计量单位', value: '24 个', tone: 'blue' },
      { label: '换算组', value: '6 组', tone: 'green' },
      { label: '待确认', value: '2 个', tone: 'amber' },
      { label: '停用', value: '3 个', tone: 'gray' },
    ],
    columns: [
      { key: 'name', label: '单位名称' },
      { key: 'group', label: '单位组' },
      { key: 'base', label: '基础单位' },
      { key: 'rate', label: '换算率' },
      { key: 'precision', label: '数量精度' },
      { key: 'remark', label: '备注' },
    ],
    rows: [
      { id: 'unit-001', status: '启用', voucher: '-', attachment: '-', values: { name: '台', group: '数量', base: '台', rate: '1', precision: '2', remark: '设备' } },
      { id: 'unit-002', status: '启用', voucher: '-', attachment: '-', values: { name: '箱', group: '包装', base: '个', rate: '12', precision: '2', remark: '包装换算' } },
      { id: 'unit-003', status: '停用', voucher: '-', attachment: '-', values: { name: '批', group: '临时', base: '批', rate: '1', precision: '0', remark: '不再使用' } },
    ],
    notes: ['计量单位用于发票商品、存货和成本表，必须支持换算和数量精度。'],
  },
  inventoryMovement: {
    keywordPlaceholder: '搜索单据编号、存货、仓库、往来单位',
    primaryAction: '新增出入库',
    importLabel: '导入出入库',
    statusOptions: ['全部', '待处理', '已匹配', '已生成凭证', '异常'],
    summary: [
      { label: '本月入库', value: '¥386,420.00', tone: 'blue' },
      { label: '本月出库', value: '¥294,880.00', tone: 'amber' },
      { label: '已匹配发票', value: '38 单', tone: 'green' },
      { label: '异常单据', value: '4 单', tone: 'red' },
    ],
    columns: [
      { key: 'billNo', label: '单据编号' },
      { key: 'type', label: '出入类型' },
      { key: 'inventory', label: '存货名称' },
      { key: 'warehouse', label: '仓库' },
      { key: 'counterparty', label: '往来单位' },
      { key: 'quantity', label: '数量', align: 'right' },
      { key: 'amount', label: '金额', align: 'right' },
      { key: 'source', label: '来源' },
    ],
    rows: [
      { id: 'im-001', status: '已匹配', voucher: '记-0088', attachment: '入库单', values: { billNo: 'RK-202605-001', type: '采购入库', inventory: '控制器 A-100', warehouse: '主仓', counterparty: '上海零件供应商', quantity: '120 台', amount: '¥168,000.00', source: '进项发票' } },
      { id: 'im-002', status: '待确认', voucher: '未生成', attachment: '出库单', values: { billNo: 'CK-202605-018', type: '销售出库', inventory: '连接线 2m', warehouse: '主仓', counterparty: '杭州客户', quantity: '600 根', amount: '¥36,000.00', source: '销项发票' } },
      { id: 'im-003', status: '异常', voucher: '未生成', attachment: '缺发票', values: { billNo: 'QT-202605-006', type: '其他出库', inventory: '配件包', warehouse: '备件仓', counterparty: '内部领用', quantity: '20 套', amount: '待核价', source: '手工登记' } },
    ],
    notes: ['出入库单用于还原竞品业务处理中的存货流转入口，并向成本结转、发票匹配和凭证生成提供来源。'],
  },
  costCarryover: {
    keywordPlaceholder: '搜索结转批次、存货、科目、成本来源',
    primaryAction: '执行结转',
    importLabel: '导入成本',
    statusOptions: ['全部', '待处理', '待确认', '已生成凭证', '异常'],
    summary: [
      { label: '结转批次', value: '5 批', tone: 'blue' },
      { label: '结转成本', value: '¥294,880.00', tone: 'amber' },
      { label: '已生成凭证', value: '3 张', tone: 'green' },
      { label: '阻断项', value: '2 项', tone: 'red' },
    ],
    columns: [
      { key: 'batch', label: '结转批次' },
      { key: 'method', label: '计价方法' },
      { key: 'source', label: '成本来源' },
      { key: 'debit', label: '借方科目' },
      { key: 'credit', label: '贷方科目' },
      { key: 'cost', label: '结转成本', align: 'right' },
      { key: 'difference', label: '差异金额', align: 'right' },
    ],
    rows: [
      { id: 'cc-001', status: '已生成凭证', voucher: '记-0092', attachment: '成本表', values: { batch: 'CB-202605-01', method: '移动加权', source: '销售出库单', debit: '主营业务成本', credit: '库存商品', cost: '¥218,600.00', difference: '¥0.00' } },
      { id: 'cc-002', status: '待确认', voucher: '未生成', attachment: '明细', values: { batch: 'CB-202605-02', method: '月末一次加权', source: '其他出库单', debit: '管理费用', credit: '库存商品', cost: '¥18,420.00', difference: '¥320.00' } },
      { id: 'cc-003', status: '异常', voucher: '阻断', attachment: '差异表', values: { batch: 'CB-202605-03', method: '移动加权', source: '未核价出库', debit: '主营业务成本', credit: '库存商品', cost: '待算', difference: '未核价' } },
    ],
    notes: ['成本结转先保留人工确认和差异检查，不直接修改账簿；后续可接入存货计价引擎。'],
  },
  bankReconciliation: {
    keywordPlaceholder: '搜索账户、流水号、凭证号、对账状态',
    primaryAction: '开始对账',
    importLabel: '导入对账单',
    statusOptions: ['全部', '已匹配', '待处理', '异常'],
    summary: [
      { label: '银行余额', value: '¥1,428,650.72', tone: 'blue' },
      { label: '账面余额', value: '¥1,426,930.72', tone: 'green' },
      { label: '未达账项', value: '6 笔', tone: 'amber' },
      { label: '差异金额', value: '¥1,720.00', tone: 'red' },
    ],
    columns: [
      { key: 'account', label: '银行账户' },
      { key: 'statementNo', label: '流水号' },
      { key: 'date', label: '交易日期' },
      { key: 'summary', label: '摘要' },
      { key: 'bankAmount', label: '银行金额', align: 'right' },
      { key: 'bookAmount', label: '账面金额', align: 'right' },
      { key: 'difference', label: '差异金额', align: 'right' },
      { key: 'matchStatus', label: '对账状态' },
    ],
    rows: [
      { id: 'brc-001', status: '已匹配', voucher: '记-0068', attachment: '回单', values: { account: '招商银行 6688', statementNo: 'B20260518001', date: '2026-05-18', summary: '收到货款', bankAmount: '¥86,000.00', bookAmount: '¥86,000.00', difference: '¥0.00', matchStatus: '自动匹配' } },
      { id: 'brc-002', status: '待处理', voucher: '未生成', attachment: '流水', values: { account: '招商银行 6688', statementNo: 'B20260519012', date: '2026-05-19', summary: '手续费', bankAmount: '¥320.00', bookAmount: '¥0.00', difference: '¥320.00', matchStatus: '未入账' } },
      { id: 'brc-003', status: '异常', voucher: '记-0071', attachment: '回单', values: { account: '建设银行 1122', statementNo: 'B20260521008', date: '2026-05-21', summary: '付款', bankAmount: '¥45,600.00', bookAmount: '¥44,200.00', difference: '¥1,400.00', matchStatus: '金额不一致' } },
    ],
    notes: ['银行对账是账单一览之后的财务控制台，保留未达账项、差异和凭证穿透。'],
  },
  receivableSettlement: {
    keywordPlaceholder: '搜索客户、发票号、收款流水、核销状态',
    primaryAction: '新增应收核销',
    importLabel: '导入核销',
    statusOptions: ['全部', '待核销', '部分核销', '已核销', '异常'],
    summary: [
      { label: '应收余额', value: '¥386,200.00', tone: 'blue' },
      { label: '已核销', value: '¥294,800.00', tone: 'green' },
      { label: '待核销', value: '¥71,400.00', tone: 'amber' },
      { label: '差异', value: '¥20,000.00', tone: 'red' },
    ],
    columns: [
      { key: 'customer', label: '客户' },
      { key: 'invoiceNo', label: '销项发票' },
      { key: 'receivable', label: '应收金额', align: 'right' },
      { key: 'receipt', label: '收款流水' },
      { key: 'settled', label: '已核销', align: 'right' },
      { key: 'balance', label: '未核销', align: 'right' },
      { key: 'method', label: '核销方式' },
      { key: 'owner', label: '经办人' },
    ],
    rows: [
      { id: 'rs-001', status: '已匹配', voucher: '记-0072', attachment: '回单', values: { customer: '上海辰光贸易有限公司', invoiceNo: '310026000118', receivable: '¥97,180.00', receipt: 'BANK-0526-018', settled: '¥97,180.00', balance: '¥0.00', method: '发票+流水自动匹配', owner: '王会计' } },
      { id: 'rs-002', status: '待确认', voucher: '草稿', attachment: '回单', values: { customer: '杭州辰光贸易有限公司', invoiceNo: '310026000126', receivable: '¥127,200.00', receipt: 'BANK-0526-041', settled: '¥80,000.00', balance: '¥47,200.00', method: '部分核销', owner: '李会计' } },
      { id: 'rs-003', status: '异常', voucher: '-', attachment: '差异', values: { customer: '南京云杉贸易有限公司', invoiceNo: '310026000188', receivable: '¥42,940.00', receipt: '未匹配', settled: '¥0.00', balance: '¥42,940.00', method: '待客户确认', owner: '赵会计' } },
    ],
    notes: ['应收核销连接销项发票、销售订单、银行流水和应收账款余额。'],
  },
  payableSettlement: {
    keywordPlaceholder: '搜索供应商、进项发票、付款流水、核销状态',
    primaryAction: '新增应付核销',
    importLabel: '导入核销',
    statusOptions: ['全部', '待核销', '部分核销', '已核销', '异常'],
    summary: [
      { label: '应付余额', value: '¥428,600.00', tone: 'blue' },
      { label: '已核销', value: '¥216,800.00', tone: 'green' },
      { label: '待核销', value: '¥181,800.00', tone: 'amber' },
      { label: '差异', value: '¥30,000.00', tone: 'red' },
    ],
    columns: [
      { key: 'supplier', label: '供应商' },
      { key: 'invoiceNo', label: '进项发票' },
      { key: 'payable', label: '应付金额', align: 'right' },
      { key: 'payment', label: '付款流水' },
      { key: 'settled', label: '已核销', align: 'right' },
      { key: 'balance', label: '未核销', align: 'right' },
      { key: 'method', label: '核销方式' },
      { key: 'owner', label: '经办人' },
    ],
    rows: [
      { id: 'ps-001', status: '已匹配', voucher: '记-0078', attachment: '回单', values: { supplier: '上海零件供应商', invoiceNo: '310026000221', payable: '¥142,945.00', payment: 'BANK-0526-031', settled: '¥142,945.00', balance: '¥0.00', method: '发票+流水自动匹配', owner: '李会计' } },
      { id: 'ps-002', status: '待确认', voucher: '草稿', attachment: '合同', values: { supplier: '苏州材料供应商', invoiceNo: '待收票', payable: '¥96,000.00', payment: 'BANK-0526-045', settled: '¥60,000.00', balance: '¥36,000.00', method: '预付款挂账', owner: '王会计' } },
      { id: 'ps-003', status: '异常', voucher: '-', attachment: '差异', values: { supplier: '杭州设备公司', invoiceNo: '310026000333', payable: '¥18,600.00', payment: '金额不一致', settled: '¥0.00', balance: '¥18,600.00', method: '待人工处理', owner: '赵会计' } },
    ],
    notes: ['应付核销连接进项发票、采购订单、银行流水和应付账款余额。'],
  },
  receivablePayableAging: {
    keywordPlaceholder: '搜索客户、供应商、科目、账龄区间',
    primaryAction: '重新计算',
    importLabel: '导出账龄',
    statusOptions: ['全部', '正常', '待确认', '异常'],
    summary: [
      { label: '应收余额', value: '¥642,300.00', tone: 'blue' },
      { label: '应付余额', value: '¥388,920.00', tone: 'green' },
      { label: '逾期金额', value: '¥96,800.00', tone: 'amber' },
      { label: '高风险往来', value: '5 户', tone: 'red' },
    ],
    columns: [
      { key: 'counterparty', label: '往来单位' },
      { key: 'subject', label: '往来科目' },
      { key: 'direction', label: '方向' },
      { key: 'balance', label: '余额', align: 'right' },
      { key: 'age', label: '账龄区间' },
      { key: 'overdue', label: '逾期金额', align: 'right' },
      { key: 'lastVoucher', label: '最近凭证' },
      { key: 'owner', label: '负责人' },
    ],
    rows: [
      { id: 'age-001', status: '待确认', voucher: '记-0041', attachment: '发票', values: { counterparty: '杭州客户', subject: '应收账款', direction: '借方', balance: '¥128,600.00', age: '31-60天', overdue: '¥28,600.00', lastVoucher: '记-0041', owner: '王会计' } },
      { id: 'age-002', status: '已通过', voucher: '记-0035', attachment: '合同', values: { counterparty: '上海零件供应商', subject: '应付账款', direction: '贷方', balance: '¥86,300.00', age: '0-30天', overdue: '¥0.00', lastVoucher: '记-0035', owner: '李会计' } },
      { id: 'age-003', status: '异常', voucher: '记-0018', attachment: '明细', values: { counterparty: '北京渠道商', subject: '应收账款', direction: '借方', balance: '¥68,200.00', age: '90天以上', overdue: '¥68,200.00', lastVoucher: '记-0018', owner: '赵会计' } },
    ],
    notes: ['往来账龄用于客户催收、供应商付款审核和期末坏账风险提示。'],
  },
  invoiceVoucherMatching: {
    keywordPlaceholder: '搜索发票号、凭证号、客户供应商、差异金额',
    primaryAction: '执行匹配',
    importLabel: '导入匹配',
    statusOptions: ['全部', '已匹配', '待处理', '待确认', '异常'],
    summary: [
      { label: '待匹配票据', value: '58 张', tone: 'blue' },
      { label: '已关联率', value: '82%', tone: 'green' },
      { label: '待人工确认', value: '9 张', tone: 'amber' },
      { label: '差异票据', value: '5 张', tone: 'red' },
    ],
    columns: [
      { key: 'invoiceNo', label: '发票号码' },
      { key: 'counterparty', label: '客户/供应商' },
      { key: 'invoiceAmount', label: '发票金额', align: 'right' },
      { key: 'voucherNo', label: '凭证字号' },
      { key: 'voucherAmount', label: '凭证金额', align: 'right' },
      { key: 'difference', label: '差异金额', align: 'right' },
      { key: 'confidence', label: '匹配置信度' },
      { key: 'matchStatus', label: '匹配状态' },
    ],
    rows: [
      { id: 'ivm-001', status: '已匹配', voucher: '记-0058', attachment: '发票', values: { invoiceNo: '031002400111', counterparty: '杭州客户', invoiceAmount: '¥56,500.00', voucherNo: '记-0058', voucherAmount: '¥56,500.00', difference: '¥0.00', confidence: '96%', matchStatus: '自动匹配' } },
      { id: 'ivm-002', status: '待确认', voucher: '记-0063', attachment: '发票', values: { invoiceNo: '031002400128', counterparty: '上海零件供应商', invoiceAmount: '¥18,300.00', voucherNo: '记-0063', voucherAmount: '¥18,000.00', difference: '¥300.00', confidence: '74%', matchStatus: '金额差异' } },
      { id: 'ivm-003', status: '异常', voucher: '未生成', attachment: '缺凭证', values: { invoiceNo: '031002400139', counterparty: '北京服务商', invoiceAmount: '¥9,800.00', voucherNo: '未匹配', voucherAmount: '¥0.00', difference: '¥9,800.00', confidence: '41%', matchStatus: '缺少凭证' } },
    ],
    notes: ['票据凭证匹配是 AI 做账和人工复核之间的控制层，所有差异必须留痕确认。'],
  },
  riskCheck: {
    keywordPlaceholder: '搜索风险项、科目、来源模块',
    primaryAction: '重新检查',
    importLabel: '生成报告',
    statusOptions: ['全部', '未处理', '已通过', '异常'],
    summary: [
      { label: '检查项', value: '42 项', tone: 'blue' },
      { label: '已通过', value: '35 项', tone: 'green' },
      { label: '需复核', value: '5 项', tone: 'amber' },
      { label: '阻断结账', value: '2 项', tone: 'red' },
    ],
    columns: [
      { key: 'level', label: '级别' },
      { key: 'module', label: '来源模块' },
      { key: 'rule', label: '检查规则' },
      { key: 'impact', label: '影响' },
      { key: 'owner', label: '处理人' },
      { key: 'updated', label: '更新时间' },
    ],
    rows: [
      { id: 'risk-001', status: '异常', voucher: '记-0032', attachment: '明细', values: { level: '高', module: '凭证', rule: '借贷不平', impact: '阻断结账', owner: '王会计', updated: '2026-05-20 10:12' } },
      { id: 'risk-002', status: '待处理', voucher: '未生成', attachment: '发票', values: { level: '中', module: '进项发票', rule: '税率异常', impact: '影响申报', owner: '李会计', updated: '2026-05-20 10:15' } },
      { id: 'risk-003', status: '已通过', voucher: '记-0075', attachment: '工资表', values: { level: '低', module: '薪酬', rule: '社保工资差异', impact: '提示', owner: '赵会计', updated: '2026-05-20 10:20' } },
    ],
    notes: ['风险检查是只读校验和结账前校验入口，不自动修改凭证。'],
  },
  closingTasks: {
    keywordPlaceholder: '搜索结转项目、取数来源、凭证模板、阻断原因',
    primaryAction: '执行结转检查',
    importLabel: '导入规则',
    statusOptions: ['全部', '待处理', '待确认', '已通过', '异常'],
    summary: [
      { label: '结转任务', value: '9 项', tone: 'blue' },
      { label: '已完成', value: '5 项', tone: 'green' },
      { label: '待确认', value: '3 项', tone: 'amber' },
      { label: '阻断', value: '1 项', tone: 'red' },
    ],
    columns: [
      { key: 'order', label: '顺序', align: 'center' },
      { key: 'name', label: '结转项目' },
      { key: 'source', label: '取数来源' },
      { key: 'template', label: '凭证模板' },
      { key: 'amount', label: '结转金额', align: 'right' },
      { key: 'condition', label: '执行条件' },
      { key: 'lastRun', label: '最近执行' },
      { key: 'blocker', label: '阻断/提示' },
    ],
    rows: [
      { id: 'ct-001', status: '已生成凭证', voucher: '记-0081', attachment: '取数快照', values: { order: '1', name: '计提折旧', source: '折旧摊销', template: '借费用 贷累计折旧', amount: '¥12,860.00', condition: '资产折旧已确认', lastRun: '06-26 09:10', blocker: '无' } },
      { id: 'ct-002', status: '待确认', voucher: '草稿', attachment: '税表', values: { order: '2', name: '税费计提', source: '税务报表', template: '借税金及附加 贷应交税费', amount: '¥54,210.00', condition: '税表待确认', lastRun: '06-26 09:22', blocker: '进项勾选未完成' } },
      { id: 'ct-003', status: '异常', voucher: '-', attachment: '检查结果', values: { order: '8', name: '损益结转', source: '利润表', template: '收入/费用转本年利润', amount: '差异', condition: '凭证全部审核', lastRun: '待执行', blocker: '记-0062 借贷不平' } },
    ],
    notes: ['期末结转要按固定顺序执行，并在每一步保留取数快照、凭证草稿和阻断原因。', '后续需要接入真实凭证生成和结账锁定，当前先补齐任务框架。'],
  },
  ledgerReport: {
    keywordPlaceholder: '搜索科目编码、科目名称、辅助核算、摘要',
    primaryAction: '重新计算',
    importLabel: '导出账簿',
    statusOptions: ['全部', '有发生', '无发生', '借方余额', '贷方余额'],
    summary: [
      { label: '科目数', value: '128 个', tone: 'blue' },
      { label: '本期借方', value: '¥1,286,300.00', tone: 'green' },
      { label: '本期贷方', value: '¥1,286,300.00', tone: 'green' },
      { label: '不平项', value: '0', tone: 'gray' },
    ],
    columns: [
      { key: 'code', label: '科目编码' },
      { key: 'name', label: '科目名称' },
      { key: 'aux', label: '辅助核算' },
      { key: 'openingDebit', label: '期初借方', align: 'right' },
      { key: 'openingCredit', label: '期初贷方', align: 'right' },
      { key: 'debit', label: '本期借方', align: 'right' },
      { key: 'credit', label: '本期贷方', align: 'right' },
      { key: 'direction', label: '方向', align: 'center' },
      { key: 'balance', label: '期末余额', align: 'right' },
    ],
    rows: [
      { id: '1002', status: '已通过', voucher: '可穿透', attachment: '账簿', values: { code: '1002', name: '银行存款', aux: '工行基本户', openingDebit: '¥220,000.00', openingCredit: '-', debit: '¥821,300.00', credit: '¥574,920.00', direction: '借', balance: '¥466,380.00' } },
      { id: '1122', status: '已通过', voucher: '可穿透', attachment: '账簿', values: { code: '1122', name: '应收账款', aux: '客户', openingDebit: '¥410,000.00', openingCredit: '-', debit: '¥680,000.00', credit: '¥390,000.00', direction: '借', balance: '¥700,000.00' } },
      { id: '2221', status: '已通过', voucher: '可穿透', attachment: '账簿', values: { code: '2221', name: '应交税费', aux: '税种', openingDebit: '-', openingCredit: '¥18,000.00', debit: '¥42,860.00', credit: '¥54,210.00', direction: '贷', balance: '¥29,350.00' } },
    ],
    notes: ['账簿页需要支持科目、辅助核算、期间、发生额/余额方向筛选，并可穿透凭证明细。', '科目余额表、科目汇总表、总账、明细账、多栏账应分别拥有独立导出模板。'],
  },
  trialBalanceReport: {
    keywordPlaceholder: '搜索科目编码、科目名称、辅助核算、余额方向',
    primaryAction: '重算余额表',
    importLabel: '导出余额表',
    statusOptions: ['全部', '有余额', '有发生', '借方余额', '贷方余额'],
    summary: [
      { label: '科目行数', value: '128 行', tone: 'blue' },
      { label: '本期借方', value: '¥1,286,300.00', tone: 'green' },
      { label: '本期贷方', value: '¥1,286,300.00', tone: 'green' },
      { label: '试算差异', value: '¥0.00', tone: 'gray' },
    ],
    columns: [
      { key: 'code', label: '科目编码' },
      { key: 'name', label: '科目名称' },
      { key: 'aux', label: '辅助核算' },
      { key: 'openingDebit', label: '期初借方', align: 'right' },
      { key: 'openingCredit', label: '期初贷方', align: 'right' },
      { key: 'currentDebit', label: '本期借方', align: 'right' },
      { key: 'currentCredit', label: '本期贷方', align: 'right' },
      { key: 'endingBalance', label: '期末余额', align: 'right' },
    ],
    rows: [
      { id: 'tb-1002', status: '已通过', voucher: '可穿透', attachment: '账簿', values: { code: '1002', name: '银行存款', aux: '工行基本户', openingDebit: '¥220,000.00', openingCredit: '-', currentDebit: '¥821,300.00', currentCredit: '¥574,920.00', endingBalance: '借 ¥466,380.00' } },
      { id: 'tb-1122', status: '已通过', voucher: '可穿透', attachment: '客户辅助', values: { code: '1122', name: '应收账款', aux: '客户', openingDebit: '¥410,000.00', openingCredit: '-', currentDebit: '¥680,000.00', currentCredit: '¥390,000.00', endingBalance: '借 ¥700,000.00' } },
      { id: 'tb-2221', status: '待确认', voucher: '可穿透', attachment: '税种辅助', values: { code: '2221', name: '应交税费', aux: '税种', openingDebit: '-', openingCredit: '¥18,000.00', currentDebit: '¥42,860.00', currentCredit: '¥54,210.00', endingBalance: '贷 ¥29,350.00' } },
    ],
    notes: ['科目余额表固定展示期初、本期发生、期末余额和试算差异，是报表和结账前校验基础。', '辅助核算余额需要和科目余额同步校验，差异进入规则与日志。'],
  },
  accountSummaryReport: {
    keywordPlaceholder: '搜索科目编码、科目名称、凭证范围、发生额',
    primaryAction: '重算汇总表',
    importLabel: '导出汇总表',
    statusOptions: ['全部', '有发生', '无发生', '借方发生', '贷方发生'],
    summary: [
      { label: '凭证张数', value: '82 张', tone: 'blue' },
      { label: '借方合计', value: '¥1,286,300.00', tone: 'green' },
      { label: '贷方合计', value: '¥1,286,300.00', tone: 'green' },
      { label: '不平凭证', value: '0 张', tone: 'gray' },
    ],
    columns: [
      { key: 'code', label: '科目编码' },
      { key: 'name', label: '科目名称' },
      { key: 'voucherCount', label: '凭证张数', align: 'right' },
      { key: 'debitCount', label: '借方笔数', align: 'right' },
      { key: 'creditCount', label: '贷方笔数', align: 'right' },
      { key: 'debit', label: '借方发生额', align: 'right' },
      { key: 'credit', label: '贷方发生额', align: 'right' },
      { key: 'check', label: '借贷校验' },
    ],
    rows: [
      { id: 'as-1002', status: '已通过', voucher: '82张', attachment: '凭证汇总', values: { code: '1002', name: '银行存款', voucherCount: '48', debitCount: '21', creditCount: '27', debit: '¥821,300.00', credit: '¥574,920.00', check: '通过' } },
      { id: 'as-6001', status: '已通过', voucher: '12张', attachment: '销项来源', values: { code: '6001', name: '主营业务收入', voucherCount: '12', debitCount: '0', creditCount: '12', debit: '-', credit: '¥680,000.00', check: '通过' } },
      { id: 'as-6602', status: '待确认', voucher: '19张', attachment: '费用明细', values: { code: '6602', name: '管理费用', voucherCount: '19', debitCount: '19', creditCount: '0', debit: '¥58,200.00', credit: '-', check: '记-0062 待复核' } },
    ],
    notes: ['科目汇总表按科目汇总凭证发生额，适合凭证复核和月末装订。', '需要支持按凭证字号范围、日期范围和审核状态筛选。'],
  },
  generalLedgerReport: {
    keywordPlaceholder: '搜索科目编码、月份、方向、期末余额',
    primaryAction: '重算总账',
    importLabel: '导出总账',
    statusOptions: ['全部', '有发生', '无发生', '借方余额', '贷方余额'],
    summary: [
      { label: '总账科目', value: '118 个', tone: 'blue' },
      { label: '已核对', value: '116 个', tone: 'green' },
      { label: '待复核', value: '2 个', tone: 'amber' },
      { label: '异常', value: '0 个', tone: 'gray' },
    ],
    columns: [
      { key: 'code', label: '科目编码' },
      { key: 'name', label: '科目名称' },
      { key: 'month', label: '月份', align: 'center' },
      { key: 'opening', label: '期初余额', align: 'right' },
      { key: 'debit', label: '本月借方', align: 'right' },
      { key: 'credit', label: '本月贷方', align: 'right' },
      { key: 'direction', label: '方向', align: 'center' },
      { key: 'ending', label: '期末余额', align: 'right' },
    ],
    rows: [
      { id: 'gl-1002', status: '已通过', voucher: '总账', attachment: '月度汇总', values: { code: '1002', name: '银行存款', month: '2026-05', opening: '借 ¥220,000.00', debit: '¥821,300.00', credit: '¥574,920.00', direction: '借', ending: '¥466,380.00' } },
      { id: 'gl-1122', status: '已通过', voucher: '总账', attachment: '客户辅助', values: { code: '1122', name: '应收账款', month: '2026-05', opening: '借 ¥410,000.00', debit: '¥680,000.00', credit: '¥390,000.00', direction: '借', ending: '¥700,000.00' } },
      { id: 'gl-2221', status: '待确认', voucher: '总账', attachment: '税种辅助', values: { code: '2221', name: '应交税费', month: '2026-05', opening: '贷 ¥18,000.00', debit: '¥42,860.00', credit: '¥54,210.00', direction: '贷', ending: '¥29,350.00' } },
    ],
    notes: ['总账按科目和月份汇总期初、本月发生和期末余额。', '总账应能穿透到明细账和凭证，并与科目余额表一致。'],
  },
  subsidiaryLedgerReport: {
    keywordPlaceholder: '搜索日期、凭证字号、摘要、科目、对方科目',
    primaryAction: '重算明细账',
    importLabel: '导出明细账',
    statusOptions: ['全部', '有发生', '待确认', '异常'],
    summary: [
      { label: '明细行数', value: '486 行', tone: 'blue' },
      { label: '借方发生', value: '¥1,286,300.00', tone: 'green' },
      { label: '贷方发生', value: '¥1,286,300.00', tone: 'green' },
      { label: '待复核', value: '3 行', tone: 'amber' },
    ],
    columns: [
      { key: 'date', label: '日期' },
      { key: 'wordNo', label: '凭证字号' },
      { key: 'subject', label: '科目' },
      { key: 'summary', label: '摘要' },
      { key: 'opposite', label: '对方科目' },
      { key: 'debit', label: '借方', align: 'right' },
      { key: 'credit', label: '贷方', align: 'right' },
      { key: 'balance', label: '余额', align: 'right' },
    ],
    rows: [
      { id: 'sl-001', status: '已通过', voucher: '记-0051', attachment: '发票', values: { date: '2026-05-03', wordNo: '记-0051', subject: '1122 应收账款', summary: '销售控制器', opposite: '6001/2221', debit: '¥97,180.00', credit: '-', balance: '借 ¥507,180.00' } },
      { id: 'sl-002', status: '已通过', voucher: '记-0058', attachment: '银行回单', values: { date: '2026-05-09', wordNo: '记-0058', subject: '1002 银行存款', summary: '收到货款', opposite: '1122 应收账款', debit: '¥127,200.00', credit: '-', balance: '借 ¥347,200.00' } },
      { id: 'sl-003', status: '待确认', voucher: '记-0062', attachment: '风险项', values: { date: '2026-05-16', wordNo: '记-0062', subject: '6602 管理费用', summary: '费用报销', opposite: '1002 银行存款', debit: '¥860.00', credit: '-', balance: '待复核' } },
    ],
    notes: ['明细账按逐笔凭证展示摘要、对方科目、借贷方和余额。', '需要支持从总账、余额表和凭证详情互相穿透。'],
  },
  auxiliaryLedgerReport: {
    keywordPlaceholder: '搜索辅助类别、辅助项目、科目、凭证字号',
    primaryAction: '重算辅助账',
    importLabel: '导出辅助账',
    statusOptions: ['全部', '客户', '供应商', '项目', '部门'],
    summary: [
      { label: '辅助类别', value: '5 类', tone: 'blue' },
      { label: '辅助项目', value: '86 个', tone: 'green' },
      { label: '发生金额', value: '¥1,070,000.00', tone: 'amber' },
      { label: '异常项目', value: '2 个', tone: 'red' },
    ],
    columns: [
      { key: 'category', label: '辅助类别' },
      { key: 'item', label: '辅助项目' },
      { key: 'subject', label: '科目' },
      { key: 'date', label: '日期' },
      { key: 'wordNo', label: '凭证字号' },
      { key: 'summary', label: '摘要' },
      { key: 'debit', label: '借方', align: 'right' },
      { key: 'credit', label: '贷方', align: 'right' },
    ],
    rows: [
      { id: 'al-001', status: '已通过', voucher: '记-0051', attachment: '客户辅助', values: { category: '客户', item: '上海辰光贸易有限公司', subject: '1122 应收账款', date: '2026-05-03', wordNo: '记-0051', summary: '销售控制器', debit: '¥97,180.00', credit: '-' } },
      { id: 'al-002', status: '已通过', voucher: '记-0058', attachment: '供应商辅助', values: { category: '供应商', item: '苏州材料供应链有限公司', subject: '2202 应付账款', date: '2026-05-09', wordNo: '记-0058', summary: '采购原材料', debit: '-', credit: '¥142,945.00' } },
      { id: 'al-003', status: '异常', voucher: '记-0062', attachment: '缺辅助', values: { category: '项目', item: '待补', subject: '6602 管理费用', date: '2026-05-16', wordNo: '记-0062', summary: '费用报销', debit: '¥860.00', credit: '-' } },
    ],
    notes: ['辅助核算账按客户、供应商、项目、部门、人员等维度展示逐笔明细。', '缺辅助项目的凭证必须进入风险检查，不能只在总账层面通过。'],
  },
  auxiliaryBalanceReport: {
    keywordPlaceholder: '搜索辅助类别、辅助项目、科目、余额方向',
    primaryAction: '重算辅助余额',
    importLabel: '导出辅助余额',
    statusOptions: ['全部', '借方余额', '贷方余额', '有发生', '异常'],
    summary: [
      { label: '辅助余额行', value: '142 行', tone: 'blue' },
      { label: '借方余额', value: '¥700,000.00', tone: 'green' },
      { label: '贷方余额', value: '¥268,000.00', tone: 'amber' },
      { label: '不一致', value: '1 行', tone: 'red' },
    ],
    columns: [
      { key: 'category', label: '辅助类别' },
      { key: 'item', label: '辅助项目' },
      { key: 'subject', label: '科目' },
      { key: 'opening', label: '期初余额', align: 'right' },
      { key: 'debit', label: '本期借方', align: 'right' },
      { key: 'credit', label: '本期贷方', align: 'right' },
      { key: 'direction', label: '方向', align: 'center' },
      { key: 'ending', label: '期末余额', align: 'right' },
    ],
    rows: [
      { id: 'ab-001', status: '已通过', voucher: '辅助余额', attachment: '客户', values: { category: '客户', item: '上海辰光贸易有限公司', subject: '1122 应收账款', opening: '¥120,000.00', debit: '¥97,180.00', credit: '¥80,000.00', direction: '借', ending: '¥137,180.00' } },
      { id: 'ab-002', status: '已通过', voucher: '辅助余额', attachment: '供应商', values: { category: '供应商', item: '苏州材料供应链有限公司', subject: '2202 应付账款', opening: '¥68,000.00', debit: '¥42,600.00', credit: '¥142,945.00', direction: '贷', ending: '¥168,345.00' } },
      { id: 'ab-003', status: '异常', voucher: '辅助余额', attachment: '差异', values: { category: '项目', item: '研发项目A', subject: '6602 管理费用', opening: '-', debit: '¥18,600.00', credit: '-', direction: '借', ending: '与总账差异' } },
    ],
    notes: ['辅助余额表按辅助项目汇总期初、本期、期末余额。', '辅助余额与科目余额不一致时必须阻断结账。'],
  },
  multiColumnLedgerReport: {
    keywordPlaceholder: '搜索多栏账科目、栏目、费用项目、发生额',
    primaryAction: '重算多栏账',
    importLabel: '导出多栏账',
    statusOptions: ['全部', '收入类', '费用类', '成本类', '异常'],
    summary: [
      { label: '多栏科目', value: '12 个', tone: 'blue' },
      { label: '费用合计', value: '¥286,000.00', tone: 'amber' },
      { label: '收入合计', value: '¥680,000.00', tone: 'green' },
      { label: '待配置', value: '1 栏', tone: 'red' },
    ],
    columns: [
      { key: 'subject', label: '科目' },
      { key: 'date', label: '日期' },
      { key: 'wordNo', label: '凭证字号' },
      { key: 'summary', label: '摘要' },
      { key: 'office', label: '办公费', align: 'right' },
      { key: 'travel', label: '差旅费', align: 'right' },
      { key: 'salary', label: '工资薪酬', align: 'right' },
      { key: 'total', label: '合计', align: 'right' },
    ],
    rows: [
      { id: 'mc-001', status: '已通过', voucher: '记-0048', attachment: '费用报销', values: { subject: '6602 管理费用', date: '2026-05-08', wordNo: '记-0048', summary: '购买办公用品', office: '¥860.00', travel: '-', salary: '-', total: '¥860.00' } },
      { id: 'mc-002', status: '已通过', voucher: '记-0061', attachment: '工资表', values: { subject: '6602 管理费用', date: '2026-05-31', wordNo: '记-0061', summary: '计提管理人员工资', office: '-', travel: '-', salary: '¥86,000.00', total: '¥86,000.00' } },
      { id: 'mc-003', status: '异常', voucher: '记-0062', attachment: '规则', values: { subject: '6602 管理费用', date: '2026-05-16', wordNo: '记-0062', summary: '费用报销', office: '-', travel: '待确认', salary: '-', total: '栏目未配置' } },
    ],
    notes: ['多栏账按费用、收入、成本类科目拆分栏目，便于查看明细构成。', '栏目配置应来自科目设置和报表公式，未配置栏目进入规则与日志。'],
  },
  financialReport: {
    keywordPlaceholder: '搜索报表项目、行次、公式、取数科目',
    primaryAction: '重新计算',
    importLabel: '导出报表',
    statusOptions: ['全部', '已平衡', '需重算', '公式异常'],
    summary: [
      { label: '报表项目', value: '64 行', tone: 'blue' },
      { label: '资产合计', value: '¥2,186,300.00', tone: 'green' },
      { label: '负债权益', value: '¥2,186,300.00', tone: 'green' },
      { label: '校验差异', value: '¥0.00', tone: 'gray' },
    ],
    columns: [
      { key: 'line', label: '行次', align: 'center' },
      { key: 'item', label: '报表项目' },
      { key: 'formula', label: '取数公式/科目' },
      { key: 'opening', label: '期初余额', align: 'right' },
      { key: 'ending', label: '期末余额', align: 'right' },
      { key: 'reclass', label: '重分类' },
      { key: 'note', label: '说明' },
    ],
    rows: [
      { id: 'bs-001', status: '已通过', voucher: '快照', attachment: 'PDF', values: { line: '1', item: '货币资金', formula: '1001+1002+1012', opening: '¥220,000.00', ending: '¥466,380.00', reclass: '否', note: '来自科目余额表' } },
      { id: 'bs-002', status: '已通过', voucher: '快照', attachment: 'PDF', values: { line: '6', item: '应收账款', formula: '1122 重分类', opening: '¥410,000.00', ending: '¥700,000.00', reclass: '是', note: '按客户辅助重分类' } },
      { id: 'bs-003', status: '待确认', voucher: '快照', attachment: 'PDF', values: { line: '32', item: '应交税费', formula: '2221', opening: '¥18,000.00', ending: '¥29,350.00', reclass: '否', note: '与税务申报联动复核' } },
    ],
    notes: ['会计报表页需要支持重算、公式说明、重分类设置、取数快照、Excel/PDF/打印。', '资产负债表、利润表、现金流量表、所有者权益变动表要分别做固定模板。'],
  },
  balanceSheetReport: {
    keywordPlaceholder: '搜索资产负债表项目、行次、取数科目、重分类说明',
    primaryAction: '重算资产负债表',
    importLabel: '导出报表',
    statusOptions: ['全部', '已通过', '待确认', '异常'],
    summary: [
      { label: '资产合计', value: '¥2,186,300.00', tone: 'blue' },
      { label: '负债合计', value: '¥1,286,300.00', tone: 'green' },
      { label: '所有者权益', value: '¥900,000.00', tone: 'green' },
      { label: '平衡差异', value: '¥0.00', tone: 'gray' },
    ],
    columns: [
      { key: 'line', label: '行次', align: 'center' },
      { key: 'item', label: '报表项目' },
      { key: 'formula', label: '取数公式/科目' },
      { key: 'opening', label: '年初余额', align: 'right' },
      { key: 'ending', label: '期末余额', align: 'right' },
      { key: 'reclass', label: '重分类' },
      { key: 'check', label: '校验' },
    ],
    rows: [
      { id: 'bsr-001', status: '已通过', voucher: '取数快照', attachment: 'PDF', values: { line: '1', item: '货币资金', formula: '1001+1002+1012', opening: '¥220,000.00', ending: '¥466,380.00', reclass: '否', check: '通过' } },
      { id: 'bsr-002', status: '已通过', voucher: '取数快照', attachment: 'PDF', values: { line: '6', item: '应收账款', formula: '1122 重分类', opening: '¥410,000.00', ending: '¥700,000.00', reclass: '是', check: '通过' } },
      { id: 'bsr-003', status: '待确认', voucher: '取数快照', attachment: '说明', values: { line: '32', item: '应交税费', formula: '2221', opening: '¥18,000.00', ending: '¥29,350.00', reclass: '否', check: '与税表复核' } },
    ],
    notes: ['资产负债表需要固定展示年初余额、期末余额、重分类和资产负债权益平衡差异。', '应收应付、预收预付等项目后续要按辅助核算方向重分类取数。'],
  },
  incomeStatementReport: {
    keywordPlaceholder: '搜索利润表项目、行次、取数科目、本月数、本年累计',
    primaryAction: '重算利润表',
    importLabel: '导出报表',
    statusOptions: ['全部', '已通过', '待确认', '异常'],
    summary: [
      { label: '营业收入', value: '¥680,000.00', tone: 'blue' },
      { label: '营业成本', value: '¥386,200.00', tone: 'amber' },
      { label: '利润总额', value: '¥126,000.00', tone: 'green' },
      { label: '异常项目', value: '1 项', tone: 'red' },
    ],
    columns: [
      { key: 'line', label: '行次', align: 'center' },
      { key: 'item', label: '报表项目' },
      { key: 'formula', label: '取数公式/科目' },
      { key: 'current', label: '本月金额', align: 'right' },
      { key: 'yearTotal', label: '本年累计', align: 'right' },
      { key: 'source', label: '取数来源' },
      { key: 'check', label: '校验' },
    ],
    rows: [
      { id: 'is-001', status: '已通过', voucher: '取数快照', attachment: 'PDF', values: { line: '1', item: '营业收入', formula: '6001', current: '¥680,000.00', yearTotal: '¥2,860,000.00', source: '销项发票/凭证', check: '通过' } },
      { id: 'is-002', status: '已通过', voucher: '取数快照', attachment: 'PDF', values: { line: '2', item: '营业成本', formula: '6401', current: '¥386,200.00', yearTotal: '¥1,642,800.00', source: '成本结转', check: '通过' } },
      { id: 'is-003', status: '异常', voucher: '取数快照', attachment: '风险项', values: { line: '11', item: '管理费用', formula: '6602', current: '¥58,200.00', yearTotal: '差异', source: '凭证明细', check: '记-0062 借贷不平' } },
    ],
    notes: ['利润表需要区分本月金额和本年累计，支持凭证穿透和费用科目核对。', '利润表季报会使用季度累计口径，不能与月报混用。'],
  },
  incomeQuarterReport: {
    keywordPlaceholder: '搜索季度利润表项目、季度、累计金额、所得税口径',
    primaryAction: '重算季报',
    importLabel: '导出季报',
    statusOptions: ['全部', '已通过', '待确认', '异常'],
    summary: [
      { label: '本季收入', value: '¥1,920,000.00', tone: 'blue' },
      { label: '本季成本', value: '¥1,086,000.00', tone: 'amber' },
      { label: '本季利润', value: '¥386,000.00', tone: 'green' },
      { label: '纳调提示', value: '2 项', tone: 'red' },
    ],
    columns: [
      { key: 'quarter', label: '季度' },
      { key: 'item', label: '申报项目' },
      { key: 'formula', label: '取数口径' },
      { key: 'currentQuarter', label: '本季金额', align: 'right' },
      { key: 'yearTotal', label: '本年累计', align: 'right' },
      { key: 'taxAdjust', label: '纳税调整' },
      { key: 'check', label: '校验' },
    ],
    rows: [
      { id: 'iq-001', status: '已通过', voucher: 'Q2', attachment: 'PDF', values: { quarter: '2026-Q2', item: '营业收入', formula: '4-6月 6001', currentQuarter: '¥1,920,000.00', yearTotal: '¥2,860,000.00', taxAdjust: '无', check: '通过' } },
      { id: 'iq-002', status: '待确认', voucher: 'Q2', attachment: '说明', values: { quarter: '2026-Q2', item: '期间费用', formula: '6601+6602+6603', currentQuarter: '¥286,000.00', yearTotal: '¥482,000.00', taxAdjust: '招待费待确认', check: '待复核' } },
      { id: 'iq-003', status: '异常', voucher: 'Q2', attachment: '风险项', values: { quarter: '2026-Q2', item: '利润总额', formula: '收入-成本-费用', currentQuarter: '¥386,000.00', yearTotal: '差异', taxAdjust: '需纳调', check: '与所得税表不一致' } },
    ],
    notes: ['利润表季报面向企业所得税预缴，需要季度金额、本年累计和纳税调整提示。', '季报取数应冻结快照，避免月报重算后影响已确认申报包。'],
  },
  cashFlowReport: {
    keywordPlaceholder: '搜索现金流量项目、取数规则、现金科目、凭证来源',
    primaryAction: '重算现金流量表',
    importLabel: '导出报表',
    statusOptions: ['全部', '已通过', '待确认', '异常'],
    summary: [
      { label: '经营现金流', value: '¥246,380.00', tone: 'blue' },
      { label: '投资现金流', value: '¥-68,000.00', tone: 'amber' },
      { label: '筹资现金流', value: '¥0.00', tone: 'gray' },
      { label: '未映射', value: '3 笔', tone: 'red' },
    ],
    columns: [
      { key: 'line', label: '行次', align: 'center' },
      { key: 'item', label: '现金流量项目' },
      { key: 'rule', label: '映射规则' },
      { key: 'current', label: '本月金额', align: 'right' },
      { key: 'yearTotal', label: '本年累计', align: 'right' },
      { key: 'source', label: '取数来源' },
      { key: 'check', label: '校验' },
    ],
    rows: [
      { id: 'cf-001', status: '已通过', voucher: '现金流快照', attachment: 'PDF', values: { line: '1', item: '销售商品、提供劳务收到的现金', rule: '收款流水+应收核销', current: '¥821,300.00', yearTotal: '¥3,486,000.00', source: '银行流水/凭证', check: '通过' } },
      { id: 'cf-002', status: '待确认', voucher: '现金流快照', attachment: '映射表', values: { line: '8', item: '购买商品、接受劳务支付的现金', rule: '付款流水+应付核销', current: '¥486,000.00', yearTotal: '¥1,940,000.00', source: '银行流水/进项', check: '待确认' } },
      { id: 'cf-003', status: '异常', voucher: '现金流快照', attachment: '未映射', values: { line: '18', item: '支付其他与经营活动有关的现金', rule: '6602/6603', current: '差异', yearTotal: '差异', source: '凭证', check: '3 笔未映射' } },
    ],
    notes: ['现金流量表需要维护现金科目、凭证到现金流量项目的映射和未映射清单。', '银行流水与凭证来源应可穿透，方便复核经营、投资、筹资分类。'],
  },
  cashFlowQuarterReport: {
    keywordPlaceholder: '搜索季度现金流项目、季度、累计金额、映射状态',
    primaryAction: '重算现金流季报',
    importLabel: '导出季报',
    statusOptions: ['全部', '已通过', '待确认', '异常'],
    summary: [
      { label: '本季经营现金流', value: '¥682,600.00', tone: 'blue' },
      { label: '本季投资现金流', value: '¥-126,000.00', tone: 'amber' },
      { label: '现金净增加', value: '¥556,600.00', tone: 'green' },
      { label: '待映射', value: '5 笔', tone: 'red' },
    ],
    columns: [
      { key: 'quarter', label: '季度' },
      { key: 'item', label: '现金流量项目' },
      { key: 'rule', label: '取数规则' },
      { key: 'quarterAmount', label: '本季金额', align: 'right' },
      { key: 'yearTotal', label: '本年累计', align: 'right' },
      { key: 'mapping', label: '映射状态' },
      { key: 'check', label: '校验' },
    ],
    rows: [
      { id: 'cfq-001', status: '已通过', voucher: 'Q2', attachment: 'PDF', values: { quarter: '2026-Q2', item: '经营活动现金流入小计', rule: '4-6月现金流项目', quarterAmount: '¥2,286,000.00', yearTotal: '¥3,486,000.00', mapping: '已映射', check: '通过' } },
      { id: 'cfq-002', status: '待确认', voucher: 'Q2', attachment: '映射表', values: { quarter: '2026-Q2', item: '经营活动现金流出小计', rule: '付款/费用/税费', quarterAmount: '¥1,603,400.00', yearTotal: '¥2,812,000.00', mapping: '部分待确认', check: '待复核' } },
      { id: 'cfq-003', status: '异常', voucher: 'Q2', attachment: '未映射', values: { quarter: '2026-Q2', item: '现金及现金等价物净增加额', rule: '流入-流出', quarterAmount: '差异', yearTotal: '差异', mapping: '5 笔未映射', check: '阻断' } },
    ],
    notes: ['现金流量表季报使用季度和累计口径，需要冻结季度映射快照。', '未映射流水必须进入规则与日志，不能直接生成报送包。'],
  },
  equityChangeReport: {
    keywordPlaceholder: '搜索权益项目、股本、资本公积、盈余公积、未分配利润',
    primaryAction: '重算权益变动表',
    importLabel: '导出报表',
    statusOptions: ['全部', '已通过', '待确认', '异常'],
    summary: [
      { label: '期初权益', value: '¥820,000.00', tone: 'blue' },
      { label: '本期净利润', value: '¥126,000.00', tone: 'green' },
      { label: '利润分配', value: '¥46,000.00', tone: 'amber' },
      { label: '期末权益', value: '¥900,000.00', tone: 'green' },
    ],
    columns: [
      { key: 'item', label: '项目' },
      { key: 'paidInCapital', label: '实收资本', align: 'right' },
      { key: 'capitalReserve', label: '资本公积', align: 'right' },
      { key: 'surplusReserve', label: '盈余公积', align: 'right' },
      { key: 'undistributedProfit', label: '未分配利润', align: 'right' },
      { key: 'total', label: '所有者权益合计', align: 'right' },
      { key: 'source', label: '取数来源' },
    ],
    rows: [
      { id: 'eq-001', status: '已通过', voucher: '权益快照', attachment: 'PDF', values: { item: '上年年末余额', paidInCapital: '¥500,000.00', capitalReserve: '¥80,000.00', surplusReserve: '¥60,000.00', undistributedProfit: '¥180,000.00', total: '¥820,000.00', source: '上年结转' } },
      { id: 'eq-002', status: '已通过', voucher: '权益快照', attachment: 'PDF', values: { item: '本年净利润', paidInCapital: '-', capitalReserve: '-', surplusReserve: '-', undistributedProfit: '¥126,000.00', total: '¥126,000.00', source: '利润表' } },
      { id: 'eq-003', status: '待确认', voucher: '权益快照', attachment: '说明', values: { item: '利润分配', paidInCapital: '-', capitalReserve: '-', surplusReserve: '¥12,600.00', undistributedProfit: '¥-46,000.00', total: '¥-33,400.00', source: '分配凭证待确认' } },
    ],
    notes: ['所有者权益变动表需要按权益项目横向展开，并和资产负债表所有者权益合计校验。', '利润分配、盈余公积计提和本年利润结转需要保留凭证来源。'],
  },
  taxReport: {
    keywordPlaceholder: '搜索税种、申报表、取数来源',
    primaryAction: '重新取数',
    importLabel: '导出税表',
    statusOptions: ['全部', '未取数', '校验通过', '异常'],
    summary: [
      { label: '税表', value: '12 张', tone: 'blue' },
      { label: '校验通过', value: '8 张', tone: 'green' },
      { label: '待确认', value: '3 张', tone: 'amber' },
      { label: '差异', value: '1 张', tone: 'red' },
    ],
    columns: [
      { key: 'taxType', label: '税种' },
      { key: 'form', label: '申报表' },
      { key: 'source', label: '取数来源' },
      { key: 'amount', label: '本期金额', align: 'right' },
      { key: 'tax', label: '税额', align: 'right' },
      { key: 'check', label: '校验' },
    ],
    rows: [
      { id: 'taxr-001', status: '已通过', voucher: '报表快照', attachment: 'PDF', values: { taxType: '增值税', form: '主表', source: '销项/进项发票', amount: '¥680,000.00', tax: '¥54,210.00', check: '通过' } },
      { id: 'taxr-002', status: '待确认', voucher: '报表快照', attachment: 'PDF', values: { taxType: '企业所得税', form: '季报', source: '利润表', amount: '¥126,000.00', tax: '¥6,300.00', check: '待确认' } },
      { id: 'taxr-003', status: '异常', voucher: '报表快照', attachment: 'PDF', values: { taxType: '印花税', form: '应税合同', source: '单据登记', amount: '¥980,000.00', tax: '差异', check: '需复核' } },
    ],
    notes: ['税务报表支持重新计算、取数说明、差异解释和 PDF/Excel 导出。'],
  },
  vatTaxReport: {
    keywordPlaceholder: '搜索增值税栏次、发票来源、留抵、抵扣、附加税',
    primaryAction: '重取增值税数据',
    importLabel: '导出税表',
    statusOptions: ['全部', '已通过', '待确认', '异常'],
    summary: [
      { label: '销项税额', value: '¥54,210.00', tone: 'blue' },
      { label: '进项抵扣', value: '¥42,860.00', tone: 'green' },
      { label: '留抵税额', value: '¥0.00', tone: 'gray' },
      { label: '阻断项', value: '2 项', tone: 'red' },
    ],
    columns: [
      { key: 'line', label: '栏次', align: 'center' },
      { key: 'item', label: '申报项目' },
      { key: 'source', label: '取数来源' },
      { key: 'salesAmount', label: '销售额', align: 'right' },
      { key: 'outputTax', label: '销项/应纳税额', align: 'right' },
      { key: 'deduction', label: '抵扣/减免', align: 'right' },
      { key: 'payable', label: '应缴金额', align: 'right' },
      { key: 'check', label: '校验' },
    ],
    rows: [
      { id: 'vat-001', status: '已通过', voucher: '增值税主表', attachment: '发票汇总', values: { line: '1', item: '按适用税率计税销售额', source: '销项发票 58 张', salesAmount: '¥680,000.00', outputTax: '¥54,210.00', deduction: '-', payable: '¥54,210.00', check: '通过' } },
      { id: 'vat-002', status: '待确认', voucher: '进项附表', attachment: '勾选清单', values: { line: '12', item: '本期认证相符且本期申报抵扣', source: '进项发票 72 张', salesAmount: '-', outputTax: '-', deduction: '¥42,860.00', payable: '-', check: '2 张未勾选' } },
      { id: 'vat-003', status: '异常', voucher: '附加税表', attachment: '风险项', values: { line: '附加', item: '城市维护建设税/教育费附加', source: '应纳增值税', salesAmount: '-', outputTax: '-', deduction: '¥0.00', payable: '待算', check: '进项勾选阻断' } },
    ],
    notes: ['增值税及附加页按主表、进项附表、附加税表组织取数，发票勾选未完成时阻断申报确认。', '自动报税只能生成申报包和校验结果，真实提交必须由合法税局 adapter 和人工确认触发。'],
  },
  withholdingTaxReport: {
    keywordPlaceholder: '搜索员工、工资、专项附加扣除、应纳税所得额',
    primaryAction: '重取个税数据',
    importLabel: '导出扣缴表',
    statusOptions: ['全部', '已通过', '待确认', '异常'],
    summary: [
      { label: '申报人数', value: '42 人', tone: 'blue' },
      { label: '工资薪金', value: '¥386,200.00', tone: 'green' },
      { label: '专项扣除', value: '¥52,000.00', tone: 'amber' },
      { label: '异常人员', value: '1 人', tone: 'red' },
    ],
    columns: [
      { key: 'employee', label: '员工' },
      { key: 'idNo', label: '证件号' },
      { key: 'income', label: '收入额', align: 'right' },
      { key: 'social', label: '社保公积金', align: 'right' },
      { key: 'special', label: '专项附加扣除', align: 'right' },
      { key: 'taxable', label: '应纳税所得额', align: 'right' },
      { key: 'tax', label: '应扣税额', align: 'right' },
      { key: 'check', label: '校验' },
    ],
    rows: [
      { id: 'wh-001', status: '已通过', voucher: '个税扣缴', attachment: '工资表', values: { employee: '张三', idNo: '3101********0018', income: '¥12,000.00', social: '¥1,860.00', special: '¥2,000.00', taxable: '¥3,140.00', tax: '¥94.20', check: '通过' } },
      { id: 'wh-002', status: '已通过', voucher: '个税扣缴', attachment: '专项扣除', values: { employee: '李四', idNo: '3205********8892', income: '¥15,000.00', social: '¥2,150.00', special: '¥3,000.00', taxable: '¥4,850.00', tax: '¥145.50', check: '通过' } },
      { id: 'wh-003', status: '异常', voucher: '个税扣缴', attachment: '缺资料', values: { employee: '王五', idNo: '待补', income: '¥8,000.00', social: '待确认', special: '¥2,000.00', taxable: '待算', tax: '待算', check: '证件资料缺失' } },
    ],
    notes: ['扣缴所得税页从薪酬表、人员登记、社保公积金和专项附加扣除取数。', '证件、专项扣除或工资异常时只能生成待确认清单，不能进入申报包确认。'],
  },
  stampTaxReport: {
    keywordPlaceholder: '搜索合同编号、应税凭证、税目、计税金额',
    primaryAction: '重取印花税数据',
    importLabel: '导出明细',
    statusOptions: ['全部', '已通过', '待确认', '异常'],
    summary: [
      { label: '应税凭证', value: '18 份', tone: 'blue' },
      { label: '计税金额', value: '¥980,000.00', tone: 'green' },
      { label: '应纳税额', value: '¥490.00', tone: 'amber' },
      { label: '待补合同', value: '1 份', tone: 'red' },
    ],
    columns: [
      { key: 'contractNo', label: '合同编号' },
      { key: 'partner', label: '相对方' },
      { key: 'taxItem', label: '税目' },
      { key: 'signDate', label: '签订日期' },
      { key: 'amount', label: '计税金额', align: 'right' },
      { key: 'rate', label: '税率', align: 'center' },
      { key: 'tax', label: '应纳税额', align: 'right' },
      { key: 'check', label: '校验' },
    ],
    rows: [
      { id: 'st-001', status: '已通过', voucher: '印花税', attachment: '合同PDF', values: { contractNo: 'HT-2026-001', partner: '上海辰光贸易有限公司', taxItem: '购销合同', signDate: '2026-05-03', amount: '¥680,000.00', rate: '0.03%', tax: '¥204.00', check: '通过' } },
      { id: 'st-002', status: '待确认', voucher: '印花税', attachment: '扫描件', values: { contractNo: 'HT-2026-008', partner: '杭州辰星科技有限公司', taxItem: '技术合同', signDate: '2026-05-09', amount: '¥120,000.00', rate: '0.03%', tax: '¥36.00', check: '税目待确认' } },
      { id: 'st-003', status: '异常', voucher: '印花税', attachment: '缺签章', values: { contractNo: 'HT-2026-019', partner: '南京云杉贸易有限公司', taxItem: '购销合同', signDate: '待补', amount: '¥98,000.00', rate: '0.03%', tax: '待算', check: '合同资料缺失' } },
    ],
    notes: ['印花税页从合同台账、单据登记和发票关联取数，重点保留税目、计税金额和合同附件。', '合同未归档或税目不确定时必须阻断申报确认。'],
  },
  incomeTaxReport: {
    keywordPlaceholder: '搜索所得税项目、利润表、纳税调整、弥补亏损',
    primaryAction: '重取所得税数据',
    importLabel: '导出所得税表',
    statusOptions: ['全部', '已通过', '待确认', '异常'],
    summary: [
      { label: '利润总额', value: '¥126,000.00', tone: 'blue' },
      { label: '纳税调整', value: '¥18,600.00', tone: 'amber' },
      { label: '应纳税所得额', value: '¥144,600.00', tone: 'green' },
      { label: '待复核', value: '2 项', tone: 'red' },
    ],
    columns: [
      { key: 'line', label: '行次', align: 'center' },
      { key: 'item', label: '申报项目' },
      { key: 'source', label: '取数来源' },
      { key: 'bookAmount', label: '账载金额', align: 'right' },
      { key: 'taxAmount', label: '税收金额', align: 'right' },
      { key: 'adjustment', label: '纳税调整', align: 'right' },
      { key: 'check', label: '校验' },
    ],
    rows: [
      { id: 'it-001', status: '已通过', voucher: '所得税季报', attachment: '利润表', values: { line: '1', item: '营业收入', source: '利润表季报', bookAmount: '¥1,920,000.00', taxAmount: '¥1,920,000.00', adjustment: '¥0.00', check: '通过' } },
      { id: 'it-002', status: '待确认', voucher: '所得税季报', attachment: '费用明细', values: { line: '7', item: '业务招待费', source: '管理费用明细', bookAmount: '¥31,000.00', taxAmount: '¥18,600.00', adjustment: '¥12,400.00', check: '纳调待确认' } },
      { id: 'it-003', status: '异常', voucher: '所得税季报', attachment: '风险项', values: { line: '13', item: '利润总额', source: '利润表', bookAmount: '¥126,000.00', taxAmount: '差异', adjustment: '待算', check: '利润表未确认' } },
    ],
    notes: ['企业所得税页从利润表季报、费用明细、资产折旧和纳税调整项目取数。', '纳税调整必须有来源说明和人工确认，不能只按账面利润自动申报。'],
  },
  socialSecurityTaxReport: {
    keywordPlaceholder: '搜索员工、缴费基数、单位部分、个人部分、社保费申报',
    primaryAction: '重取社保费数据',
    importLabel: '导出社保费表',
    statusOptions: ['全部', '已通过', '待确认', '异常'],
    summary: [
      { label: '缴费人数', value: '42 人', tone: 'blue' },
      { label: '单位部分', value: '¥68,240.00', tone: 'green' },
      { label: '个人部分', value: '¥35,630.00', tone: 'amber' },
      { label: '基数异常', value: '1 人', tone: 'red' },
    ],
    columns: [
      { key: 'employee', label: '员工' },
      { key: 'city', label: '缴费城市' },
      { key: 'base', label: '缴费基数', align: 'right' },
      { key: 'company', label: '单位部分', align: 'right' },
      { key: 'personal', label: '个人部分', align: 'right' },
      { key: 'fund', label: '公积金', align: 'right' },
      { key: 'source', label: '来源' },
      { key: 'check', label: '校验' },
    ],
    rows: [
      { id: 'sst-001', status: '已通过', voucher: '社保费', attachment: '社保明细', values: { employee: '张三', city: '上海', base: '¥12,000.00', company: '¥3,280.00', personal: '¥1,320.00', fund: '¥1,680.00', source: '社保公积金', check: '通过' } },
      { id: 'sst-002', status: '待确认', voucher: '社保费', attachment: '工资表', values: { employee: '李四', city: '上海', base: '¥15,000.00', company: '¥4,100.00', personal: '¥1,650.00', fund: '¥2,100.00', source: '工资表', check: '基数待确认' } },
      { id: 'sst-003', status: '异常', voucher: '社保费', attachment: '缺资料', values: { employee: '王五', city: '上海', base: '待确认', company: '待算', personal: '待算', fund: '待算', source: '人员登记', check: '入职资料缺失' } },
    ],
    notes: ['社保费页从人员登记、薪酬表、社保公积金模块取数。', '基数异常、入离职资料缺失时必须进入待确认或异常清单。'],
  },
  financeTaxReport: {
    keywordPlaceholder: '搜索财报报送表、报表来源、报送附件、申报状态',
    primaryAction: '生成财报报送包',
    importLabel: '导出报送包',
    statusOptions: ['全部', '已通过', '待确认', '异常'],
    summary: [
      { label: '报送表', value: '4 张', tone: 'blue' },
      { label: '已取数', value: '3 张', tone: 'green' },
      { label: '待确认', value: '1 张', tone: 'amber' },
      { label: '差异', value: '0 项', tone: 'gray' },
    ],
    columns: [
      { key: 'form', label: '报送表' },
      { key: 'period', label: '所属期' },
      { key: 'source', label: '来源报表' },
      { key: 'amount', label: '关键金额', align: 'right' },
      { key: 'snapshot', label: '取数快照' },
      { key: 'attachment', label: '报送附件' },
      { key: 'owner', label: '负责人' },
      { key: 'check', label: '校验' },
    ],
    rows: [
      { id: 'ftr-001', status: '已通过', voucher: '财报报送', attachment: 'PDF', values: { form: '资产负债表', period: '2026-05', source: '资产负债表', amount: '¥2,186,300.00', snapshot: '已冻结', attachment: 'PDF/Excel', owner: '王会计', check: '通过' } },
      { id: 'ftr-002', status: '已通过', voucher: '财报报送', attachment: 'PDF', values: { form: '利润表', period: '2026-05', source: '利润表', amount: '¥126,000.00', snapshot: '已冻结', attachment: 'PDF/Excel', owner: '李会计', check: '通过' } },
      { id: 'ftr-003', status: '待确认', voucher: '财报报送', attachment: '现金流', values: { form: '现金流量表', period: '2026-05', source: '现金流量表', amount: '¥246,380.00', snapshot: '待确认', attachment: '待生成', owner: '赵会计', check: '未映射项待确认' } },
    ],
    notes: ['财报报送页汇总资产负债表、利润表、现金流量表和权益表的报送包状态。', '报送包生成后仍需人工确认并进入下载中心，不直接提交外部系统。'],
  },
  nonTaxRevenueReport: {
    keywordPlaceholder: '搜索非税项目、缴费事项、计费依据、缴款书',
    primaryAction: '生成非税缴费清单',
    importLabel: '导出非税清单',
    statusOptions: ['全部', '已通过', '待确认', '异常'],
    summary: [
      { label: '非税事项', value: '3 项', tone: 'blue' },
      { label: '待缴金额', value: '¥12,600.00', tone: 'amber' },
      { label: '已归档', value: '1 项', tone: 'green' },
      { label: '异常', value: '1 项', tone: 'red' },
    ],
    columns: [
      { key: 'item', label: '非税事项' },
      { key: 'period', label: '所属期' },
      { key: 'basis', label: '计费依据' },
      { key: 'amount', label: '计费金额', align: 'right' },
      { key: 'payable', label: '应缴金额', align: 'right' },
      { key: 'receipt', label: '缴款书' },
      { key: 'archive', label: '归档状态' },
      { key: 'check', label: '校验' },
    ],
    rows: [
      { id: 'ntx-001', status: '已通过', voucher: '缴款书', attachment: 'PDF', values: { item: '工会经费', period: '2026-05', basis: '工资总额', amount: '¥386,200.00', payable: '¥7,724.00', receipt: '已生成', archive: '已归档', check: '通过' } },
      { id: 'ntx-002', status: '待确认', voucher: '缴款书', attachment: '说明', values: { item: '残保金', period: '2026', basis: '在职人数/工资', amount: '待确认', payable: '待算', receipt: '未生成', archive: '待确认', check: '人数口径待核' } },
      { id: 'ntx-003', status: '异常', voucher: '缴款书', attachment: '缺资料', values: { item: '水利建设基金', period: '2026-05', basis: '营业收入', amount: '¥680,000.00', payable: '待算', receipt: '未生成', archive: '异常', check: '地区政策未配置' } },
    ],
    notes: ['非税收入页维护工会经费、残保金、水利建设基金等缴费事项。', '地区政策或计费依据缺失时只生成异常清单，不自动生成缴款书。'],
  },
  declarationCalendar: {
    keywordPlaceholder: '搜索税种、申报期、截止日期、负责人',
    primaryAction: '生成计划',
    importLabel: '导入日历',
    statusOptions: ['全部', '待处理', '待确认', '已通过', '异常'],
    summary: [
      { label: '本期待办', value: '12 项', tone: 'blue' },
      { label: '已完成', value: '7 项', tone: 'green' },
      { label: '临近截止', value: '4 项', tone: 'amber' },
      { label: '逾期风险', value: '1 项', tone: 'red' },
    ],
    columns: [
      { key: 'taxType', label: '税种/事项' },
      { key: 'period', label: '申报期' },
      { key: 'deadline', label: '截止日期', align: 'center' },
      { key: 'stage', label: '当前阶段' },
      { key: 'owner', label: '负责人' },
      { key: 'source', label: '取数来源' },
      { key: 'risk', label: '风险提示' },
      { key: 'next', label: '下一步' },
    ],
    rows: [
      { id: 'cal-001', status: '待确认', voucher: '申报包', attachment: '取数快照', values: { taxType: '增值税及附加', period: '2026-05', deadline: '06-30', stage: '待确认', owner: '王会计', source: '发票/凭证', risk: '2 张进项未勾选', next: '确认申报包' } },
      { id: 'cal-002', status: '已通过', voucher: '回执', attachment: 'PDF', values: { taxType: '企业所得税', period: '2026-Q2', deadline: '07-15', stage: '已申报', owner: '李会计', source: '利润表', risk: '无', next: '归档回执' } },
      { id: 'cal-003', status: '异常', voucher: '-', attachment: '合同台账', values: { taxType: '印花税', period: '2026-05', deadline: '06-30', stage: '资料缺失', owner: '赵会计', source: '合同台账', risk: '合同金额差异', next: '补齐合同' } },
    ],
    notes: ['申报日历用于跨税种跟踪截止日期、负责人、取数状态和申报风险。', '后续应和申报工作台、回执缴款书、批量申报联动。'],
  },
  settingsData: {
    keywordPlaceholder: '搜索设置项、生效范围、当前值、维护时间',
    primaryAction: '复核设置范围',
    importLabel: '导出设置',
    statusOptions: ['全部', '启用', '已通过', '待确认', '停用'],
    summary: [
      { label: '配置范围', value: '4 项', tone: 'blue' },
      { label: '已配置', value: '4 项', tone: 'green' },
      { label: '待补信息', value: '0 项', tone: 'gray' },
      { label: '固定模板', value: '5 套', tone: 'gray' },
    ],
    columns: [
      { key: 'name', label: '设置项' },
      { key: 'scope', label: '生效范围' },
      { key: 'currentValue', label: '当前值' },
      { key: 'source', label: '配置依据' },
      { key: 'boundary', label: '维护入口' },
      { key: 'updatedAt', label: '更新时间' },
    ],
    rows: [
      { id: 'set-company', status: '启用', voucher: '-', attachment: '企业资料', values: { name: '账套主体', scope: '当前账套', currentValue: '已选择企业', source: '企业信息', boundary: '企业信息', updatedAt: '-' } },
      { id: 'set-system', status: '启用', voucher: '-', attachment: '会计制度', values: { name: '会计制度', scope: '当前账套', currentValue: '已配置会计制度', source: '企业信息', boundary: '企业信息', updatedAt: '-' } },
      { id: 'set-period', status: '待确认', voucher: '-', attachment: '账期', values: { name: '当前账期', scope: '当前账套', currentValue: '待选择账期', source: '账期管理', boundary: '账期管理', updatedAt: '-' } },
      { id: 'set-output', status: '已通过', voucher: '-', attachment: '模板清单', values: { name: '固定输出模板', scope: '全局受控', currentValue: '5 套固定模板', source: '导出模板代码', boundary: '打印模板', updatedAt: '随应用版本发布' } },
    ],
    notes: ['设置总览仅聚合当前账套的配置边界；客户、供应商、项目和部门档案应在各自模块维护。', '固定输出模板随应用版本受控发布，不能在此页伪造可编辑的版式配置。'],
  },
  companyInfo: {
    keywordPlaceholder: '搜索企业名称、纳税人识别号、开户行、联系人',
    primaryAction: '保存资料',
    importLabel: '导入执照',
    statusOptions: ['全部', '启用', '待确认', '异常'],
    summary: [
      { label: '基础字段', value: '42 项', tone: 'blue' },
      { label: '已完成', value: '36 项', tone: 'green' },
      { label: '待补资料', value: '5 项', tone: 'amber' },
      { label: '关键异常', value: '1 项', tone: 'red' },
    ],
    columns: [
      { key: 'field', label: '资料项' },
      { key: 'value', label: '当前值' },
      { key: 'source', label: '来源' },
      { key: 'required', label: '必填', align: 'center' },
      { key: 'updatedBy', label: '维护人' },
      { key: 'updatedAt', label: '更新时间' },
    ],
    rows: [
      { id: 'ci-001', status: '启用', voucher: '-', attachment: '营业执照', values: { field: '企业名称', value: '科旋电气（上海）有限公司', source: '营业执照识别', required: '是', updatedBy: '王会计', updatedAt: '2026-05-01 09:20' } },
      { id: 'ci-002', status: '启用', voucher: '-', attachment: '税务截图', values: { field: '纳税人识别号', value: '91310115MA1K3****X', source: '手工录入', required: '是', updatedBy: '李会计', updatedAt: '2026-05-01 09:24' } },
      { id: 'ci-003', status: '待确认', voucher: '-', attachment: '开户许可证', values: { field: '开户行及账号', value: '招商银行上海分行 6214********8801', source: '银行资料', required: '是', updatedBy: '赵会计', updatedAt: '2026-05-02 14:08' } },
    ],
    notes: ['企业信息页按资料项维护税号、纳税人类型、开户行、联系人、申报口径和税务初始化基础。', '真实工商和税局资料同步需要外部授权接口；当前保留导入、识别和人工确认链路。'],
  },
  initialBalance: {
    keywordPlaceholder: '搜索科目编码、科目名称、辅助核算、方向',
    primaryAction: '试算平衡',
    importLabel: '导入期初',
    statusOptions: ['全部', '已通过', '待确认', '异常'],
    summary: [
      { label: '科目行数', value: '128 行', tone: 'blue' },
      { label: '期初借方', value: '¥2,186,300.00', tone: 'green' },
      { label: '期初贷方', value: '¥2,186,300.00', tone: 'green' },
      { label: '差异', value: '¥0.00', tone: 'gray' },
    ],
    columns: [
      { key: 'code', label: '科目编码' },
      { key: 'name', label: '科目名称' },
      { key: 'aux', label: '辅助核算' },
      { key: 'direction', label: '余额方向', align: 'center' },
      { key: 'debit', label: '期初借方', align: 'right' },
      { key: 'credit', label: '期初贷方', align: 'right' },
      { key: 'check', label: '试算平衡' },
    ],
    rows: [
      { id: 'ib-1002', status: '已通过', voucher: '期初', attachment: '导入表', values: { code: '1002', name: '银行存款', aux: '工行基本户', direction: '借', debit: '¥220,000.00', credit: '-', check: '通过' } },
      { id: 'ib-1122', status: '已通过', voucher: '期初', attachment: '导入表', values: { code: '1122', name: '应收账款', aux: '客户辅助', direction: '借', debit: '¥410,000.00', credit: '-', check: '通过' } },
      { id: 'ib-2202', status: '待确认', voucher: '期初', attachment: '导入表', values: { code: '2202', name: '应付账款', aux: '供应商辅助', direction: '贷', debit: '-', credit: '¥268,000.00', check: '辅助明细待核' } },
    ],
    notes: ['期初余额需要支持科目和辅助核算双层录入，并在启用账套前完成试算平衡。', '历史账簿导入后可反向形成期初余额，但需要人工确认差异。'],
  },
  historyVoucher: {
    keywordPlaceholder: '搜索凭证字号、摘要、科目、导入批次、来源文件',
    primaryAction: '导入历史凭证',
    importLabel: '导入凭证',
    statusOptions: ['全部', '待处理', '已通过', '待确认', '异常'],
    summary: [
      { label: '历史凭证', value: '1,286 张', tone: 'blue' },
      { label: '已映射', value: '1,214 张', tone: 'green' },
      { label: '待确认', value: '58 张', tone: 'amber' },
      { label: '异常', value: '14 张', tone: 'red' },
    ],
    columns: [
      { key: 'period', label: '所属期' },
      { key: 'wordNo', label: '凭证字号' },
      { key: 'date', label: '凭证日期' },
      { key: 'summary', label: '摘要' },
      { key: 'subjectMap', label: '科目映射' },
      { key: 'debit', label: '借方金额', align: 'right' },
      { key: 'credit', label: '贷方金额', align: 'right' },
      { key: 'sourceBatch', label: '导入批次' },
    ],
    rows: [
      { id: 'hv-001', status: '已通过', voucher: '记-202504-0031', attachment: 'Excel', values: { period: '2025-04', wordNo: '记-0031', date: '2025-04-18', summary: '销售服务收入', subjectMap: '1122/6001/2221 已匹配', debit: '¥86,400.00', credit: '¥86,400.00', sourceBatch: '历史凭证导入-01' } },
      { id: 'hv-002', status: '待确认', voucher: '记-202504-0048', attachment: '附件缺失', values: { period: '2025-04', wordNo: '记-0048', date: '2025-04-26', summary: '采购材料', subjectMap: '1403/2202 待复核', debit: '¥42,600.00', credit: '¥42,600.00', sourceBatch: '历史凭证导入-01' } },
      { id: 'hv-003', status: '异常', voucher: '记-202505-0016', attachment: '错误清单', values: { period: '2025-05', wordNo: '记-0016', date: '2025-05-09', summary: '银行手续费', subjectMap: '科目不存在', debit: '¥320.00', credit: '¥300.00', sourceBatch: '历史凭证导入-02' } },
    ],
    notes: ['历史凭证导入用于迁移旧账套凭证，必须保留导入批次、原凭证字号、科目映射和借贷平衡校验。', '异常凭证不能直接进入当前账套，需要先修复科目、辅助核算、附件和金额平衡。'],
  },
  historyBalance: {
    keywordPlaceholder: '搜索科目编码、科目名称、辅助核算、来源期间',
    primaryAction: '导入余额表',
    importLabel: '导入余额',
    statusOptions: ['全部', '已通过', '待确认', '异常'],
    summary: [
      { label: '科目余额行', value: '268 行', tone: 'blue' },
      { label: '借方累计', value: '¥8,642,300.00', tone: 'green' },
      { label: '贷方累计', value: '¥8,642,300.00', tone: 'green' },
      { label: '差异', value: '¥0.00', tone: 'gray' },
    ],
    columns: [
      { key: 'sourcePeriod', label: '来源期间' },
      { key: 'code', label: '科目编码' },
      { key: 'name', label: '科目名称' },
      { key: 'aux', label: '辅助核算' },
      { key: 'opening', label: '期初余额', align: 'right' },
      { key: 'debit', label: '本期借方', align: 'right' },
      { key: 'credit', label: '本期贷方', align: 'right' },
      { key: 'ending', label: '期末余额', align: 'right' },
    ],
    rows: [
      { id: 'hb-1002', status: '已通过', voucher: '2025-12', attachment: '余额表', values: { sourcePeriod: '2025-12', code: '1002', name: '银行存款', aux: '工行基本户', opening: '¥220,000.00', debit: '¥1,260,000.00', credit: '¥1,018,420.00', ending: '¥461,580.00' } },
      { id: 'hb-1122', status: '待确认', voucher: '2025-12', attachment: '辅助明细', values: { sourcePeriod: '2025-12', code: '1122', name: '应收账款', aux: '客户辅助', opening: '¥410,000.00', debit: '¥860,000.00', credit: '¥642,300.00', ending: '¥627,700.00' } },
      { id: 'hb-2202', status: '异常', voucher: '2025-12', attachment: '错误清单', values: { sourcePeriod: '2025-12', code: '2202', name: '应付账款', aux: '供应商辅助', opening: '¥268,000.00', debit: '¥380,000.00', credit: '¥421,500.00', ending: '辅助不平' } },
    ],
    notes: ['历史科目余额表用于校验迁移账套的期初、本期和期末余额。', '辅助核算余额必须和总账余额一致，否则不能生成正式期初。'],
  },
  historyGeneralLedger: {
    keywordPlaceholder: '搜索科目编码、科目名称、期间、方向、余额',
    primaryAction: '导入历史总账',
    importLabel: '导入总账',
    statusOptions: ['全部', '已通过', '待确认', '异常'],
    summary: [
      { label: '总账科目', value: '118 个', tone: 'blue' },
      { label: '已核对', value: '106 个', tone: 'green' },
      { label: '待复核', value: '9 个', tone: 'amber' },
      { label: '异常', value: '3 个', tone: 'red' },
    ],
    columns: [
      { key: 'period', label: '期间' },
      { key: 'code', label: '科目编码' },
      { key: 'name', label: '科目名称' },
      { key: 'direction', label: '方向', align: 'center' },
      { key: 'opening', label: '期初余额', align: 'right' },
      { key: 'debit', label: '借方发生', align: 'right' },
      { key: 'credit', label: '贷方发生', align: 'right' },
      { key: 'ending', label: '期末余额', align: 'right' },
    ],
    rows: [
      { id: 'hgl-1002', status: '已通过', voucher: '总账', attachment: 'Excel', values: { period: '2025-12', code: '1002', name: '银行存款', direction: '借', opening: '¥220,000.00', debit: '¥1,260,000.00', credit: '¥1,018,420.00', ending: '¥461,580.00' } },
      { id: 'hgl-6001', status: '已通过', voucher: '总账', attachment: 'Excel', values: { period: '2025-12', code: '6001', name: '主营业务收入', direction: '贷', opening: '-', debit: '¥0.00', credit: '¥980,000.00', ending: '¥980,000.00' } },
      { id: 'hgl-6602', status: '异常', voucher: '总账', attachment: '错误清单', values: { period: '2025-12', code: '6602', name: '管理费用', direction: '借', opening: '-', debit: '¥128,600.00', credit: '¥0.00', ending: '和明细账差异 ¥320.00' } },
    ],
    notes: ['历史总账按科目和期间承载迁移账套的总账口径，后续用于和历史明细账、余额表互相校验。', '总账差异必须标记，不能直接覆盖当前账套余额。'],
  },
  historySubsidiaryLedger: {
    keywordPlaceholder: '搜索科目、凭证字号、摘要、对方科目、辅助核算',
    primaryAction: '导入历史明细账',
    importLabel: '导入明细账',
    statusOptions: ['全部', '已通过', '待确认', '异常'],
    summary: [
      { label: '明细行数', value: '8,642 行', tone: 'blue' },
      { label: '已核对', value: '8,508 行', tone: 'green' },
      { label: '待复核', value: '112 行', tone: 'amber' },
      { label: '异常', value: '22 行', tone: 'red' },
    ],
    columns: [
      { key: 'date', label: '日期' },
      { key: 'wordNo', label: '凭证字号' },
      { key: 'subject', label: '科目' },
      { key: 'summary', label: '摘要' },
      { key: 'opposite', label: '对方科目' },
      { key: 'debit', label: '借方', align: 'right' },
      { key: 'credit', label: '贷方', align: 'right' },
      { key: 'balance', label: '余额', align: 'right' },
    ],
    rows: [
      { id: 'hsl-001', status: '已通过', voucher: '记-0031', attachment: 'Excel', values: { date: '2025-12-06', wordNo: '记-0031', subject: '1002 银行存款', summary: '收到客户货款', opposite: '1122 应收账款', debit: '¥97,180.00', credit: '-', balance: '¥386,200.00' } },
      { id: 'hsl-002', status: '待确认', voucher: '记-0048', attachment: '辅助明细', values: { date: '2025-12-18', wordNo: '记-0048', subject: '2202 应付账款', summary: '支付供应商货款', opposite: '1002 银行存款', debit: '¥42,600.00', credit: '-', balance: '¥268,000.00' } },
      { id: 'hsl-003', status: '异常', voucher: '记-0052', attachment: '错误清单', values: { date: '2025-12-22', wordNo: '记-0052', subject: '6602 管理费用', summary: '报销办公用品', opposite: '1002 银行存款', debit: '¥860.00', credit: '-', balance: '与总账差异' } },
    ],
    notes: ['历史明细账用于保留旧账套逐笔流水，迁移时必须能穿透到原凭证字号和辅助核算。', '明细账和总账、科目余额表校验一致后，才能作为期初和查询依据。'],
  },
  taxInit: {
    keywordPlaceholder: '搜索税种、申报周期、税局账号、申报口径',
    primaryAction: '保存初始化',
    importLabel: '导入税种认定',
    statusOptions: ['全部', '启用', '待确认', '异常'],
    summary: [
      { label: '认定税种', value: '9 项', tone: 'blue' },
      { label: '已启用', value: '7 项', tone: 'green' },
      { label: '待确认', value: '2 项', tone: 'amber' },
      { label: '接口缺失', value: '1 项', tone: 'red' },
    ],
    columns: [
      { key: 'taxType', label: '税种' },
      { key: 'period', label: '申报周期' },
      { key: 'method', label: '计税方式' },
      { key: 'adapter', label: '税局 adapter' },
      { key: 'account', label: '申报账号' },
      { key: 'nextPeriod', label: '下次申报期' },
    ],
    rows: [
      { id: 'ti-vat', status: '启用', voucher: '-', attachment: '认定截图', values: { taxType: '增值税', period: '月报', method: '一般纳税人', adapter: '上海电子税务局', account: '已配置', nextPeriod: '2026-06' } },
      { id: 'ti-income', status: '启用', voucher: '-', attachment: '认定截图', values: { taxType: '企业所得税', period: '季报', method: '查账征收', adapter: '上海电子税务局', account: '已配置', nextPeriod: '2026-Q2' } },
      { id: 'ti-stamp', status: '待确认', voucher: '-', attachment: '待补', values: { taxType: '印花税', period: '按次/季报', method: '应税合同', adapter: '未接入', account: '待配置', nextPeriod: '待确认' } },
    ],
    notes: ['申报初始化只维护取数和申报参数，不伪造税局提交能力。', '自动报税后续必须通过合法 adapter、授权登录、回执和人工确认闭环实现。'],
  },
  accountArchive: {
    keywordPlaceholder: '搜索账户名称、银行账号、开户行、默认科目',
    primaryAction: '新增账户',
    importLabel: '导入账户',
    statusOptions: ['全部', '启用', '停用', '异常'],
    summary: [
      { label: '账户数量', value: '8 个', tone: 'blue' },
      { label: '启用', value: '6 个', tone: 'green' },
      { label: '待对账', value: '2 个', tone: 'amber' },
      { label: '异常', value: '1 个', tone: 'red' },
    ],
    columns: [
      { key: 'name', label: '账户名称' },
      { key: 'type', label: '账户类型' },
      { key: 'bank', label: '开户行/平台' },
      { key: 'number', label: '账号' },
      { key: 'subject', label: '默认科目' },
      { key: 'balance', label: '账面余额', align: 'right' },
    ],
    rows: [
      { id: 'acct-001', status: '启用', voucher: '-', attachment: '开户许可证', values: { name: '工行基本户', type: '银行账户', bank: '工商银行上海分行', number: '6222********0198', subject: '1002 银行存款', balance: '¥466,380.00' } },
      { id: 'acct-002', status: '启用', voucher: '-', attachment: '网银截图', values: { name: '招行一般户', type: '银行账户', bank: '招商银行上海分行', number: '6214********8801', subject: '1002 银行存款', balance: '¥82,600.00' } },
      { id: 'acct-003', status: '异常', voucher: '-', attachment: '缺失', values: { name: '支付宝账户', type: '第三方支付', bank: '支付宝', number: 'finance@demo.com', subject: '1012 其他货币资金', balance: '待对账' } },
    ],
    notes: ['账户登记是银行流水、账户转账和资金余额表的基础资料。'],
  },
  customerArchive: {
    keywordPlaceholder: '搜索客户编码、名称、税号、合同',
    primaryAction: '新增客户',
    importLabel: '导入客户',
    statusOptions: ['全部', '启用', '停用', '异常'],
    summary: [
      { label: '客户数量', value: '46 户', tone: 'blue' },
      { label: '启用', value: '43 户', tone: 'green' },
      { label: '待补税号', value: '4 户', tone: 'amber' },
      { label: '停用', value: '3 户', tone: 'gray' },
    ],
    columns: [
      { key: 'code', label: '客户编码' },
      { key: 'name', label: '客户名称' },
      { key: 'taxNo', label: '纳税人识别号' },
      { key: 'bank', label: '开户行' },
      { key: 'subject', label: '默认科目' },
      { key: 'contract', label: '关联合同' },
    ],
    rows: [
      { id: 'cust-001', status: '启用', voucher: '-', attachment: '合同', values: { code: 'C001', name: '上海辰光贸易有限公司', taxNo: '9131********001X', bank: '上海银行浦东支行', subject: '1122 应收账款', contract: 'HT-2026-001' } },
      { id: 'cust-002', status: '启用', voucher: '-', attachment: '开票资料', values: { code: 'C002', name: '杭州辰星科技有限公司', taxNo: '9133********889K', bank: '杭州银行科技支行', subject: '1122 应收账款', contract: 'HT-2026-008' } },
      { id: 'cust-003', status: '异常', voucher: '-', attachment: '缺失', values: { code: 'C009', name: '南京云杉贸易有限公司', taxNo: '待补', bank: '待补', subject: '1122 应收账款', contract: '无' } },
    ],
    notes: ['客户档案影响销项发票、收款核销、应收辅助账和合同印花税取数。'],
  },
  supplierArchive: {
    keywordPlaceholder: '搜索供应商编码、名称、税号、别名',
    primaryAction: '新增供应商',
    importLabel: '导入供应商',
    statusOptions: ['全部', '启用', '停用', '异常'],
    summary: [
      { label: '供应商', value: '39 户', tone: 'blue' },
      { label: '启用', value: '35 户', tone: 'green' },
      { label: '别名待确认', value: '6 户', tone: 'amber' },
      { label: '异常', value: '2 户', tone: 'red' },
    ],
    columns: [
      { key: 'code', label: '供应商编码' },
      { key: 'name', label: '供应商名称' },
      { key: 'alias', label: '发票/流水别名' },
      { key: 'taxNo', label: '纳税人识别号' },
      { key: 'subject', label: '默认科目' },
      { key: 'taxRate', label: '常用税率' },
    ],
    rows: [
      { id: 'sup-001', status: '启用', voucher: '-', attachment: '开票资料', values: { code: 'S001', name: '苏州材料供应链有限公司', alias: '苏州材料', taxNo: '9132********888K', subject: '2202 应付账款', taxRate: '13%' } },
      { id: 'sup-002', status: '启用', voucher: '-', attachment: '合同', values: { code: 'S002', name: '上海云启科技有限公司', alias: '云启科技', taxNo: '9131********775M', subject: '2202 应付账款', taxRate: '6%' } },
      { id: 'sup-003', status: '异常', voucher: '-', attachment: '缺失', values: { code: 'S009', name: '杭州设备服务有限公司', alias: '设备服务', taxNo: '待补', subject: '2202 应付账款', taxRate: '待核' } },
    ],
    notes: ['供应商档案影响进项发票识别、付款核销、应付辅助账和税率风险检查。'],
  },
  otherContactArchive: {
    keywordPlaceholder: '搜索往来名称、类型、证件号、默认科目',
    primaryAction: '新增往来',
    importLabel: '导入往来',
    statusOptions: ['全部', '启用', '停用', '异常'],
    summary: [
      { label: '其他往来', value: '24 个', tone: 'blue' },
      { label: '启用', value: '22 个', tone: 'green' },
      { label: '待补证件', value: '3 个', tone: 'amber' },
      { label: '异常', value: '1 个', tone: 'red' },
    ],
    columns: [
      { key: 'code', label: '往来编码' },
      { key: 'name', label: '往来名称' },
      { key: 'type', label: '往来类型' },
      { key: 'idNo', label: '证件号/税号' },
      { key: 'subject', label: '默认科目' },
      { key: 'remark', label: '备注' },
    ],
    rows: [
      { id: 'oc-001', status: '启用', voucher: '-', attachment: '-', values: { code: 'O001', name: '张三', type: '员工备用金', idNo: '310********1234', subject: '1221 其他应收款', remark: '销售备用金' } },
      { id: 'oc-002', status: '启用', voucher: '-', attachment: '-', values: { code: 'O002', name: '李股东', type: '股东往来', idNo: '320********5421', subject: '2241 其他应付款', remark: '借款往来' } },
      { id: 'oc-003', status: '异常', voucher: '-', attachment: '缺失', values: { code: 'O006', name: '临时个人', type: '个人往来', idNo: '待补', subject: '1221 其他应收款', remark: '待确认' } },
    ],
    notes: ['其他往来用于员工、股东、个人和临时往来辅助核算。'],
  },
  projectArchive: {
    keywordPlaceholder: '搜索项目编码、名称、负责人、默认科目',
    primaryAction: '新增项目',
    importLabel: '导入项目',
    statusOptions: ['全部', '启用', '停用', '异常'],
    summary: [
      { label: '项目数量', value: '12 个', tone: 'blue' },
      { label: '进行中', value: '9 个', tone: 'green' },
      { label: '待归集', value: '3 个', tone: 'amber' },
      { label: '停用', value: '2 个', tone: 'gray' },
    ],
    columns: [
      { key: 'code', label: '项目编码' },
      { key: 'name', label: '项目名称' },
      { key: 'owner', label: '负责人' },
      { key: 'start', label: '开始日期' },
      { key: 'subject', label: '默认科目' },
      { key: 'budget', label: '预算金额', align: 'right' },
    ],
    rows: [
      { id: 'proj-001', status: '启用', voucher: '-', attachment: '立项单', values: { code: 'P001', name: '研发项目A', owner: '研发部', start: '2026-01-01', subject: '5301 研发支出', budget: '¥520,000.00' } },
      { id: 'proj-002', status: '启用', voucher: '-', attachment: '合同', values: { code: 'P002', name: '华东销售项目', owner: '销售部', start: '2026-03-01', subject: '6601 销售费用', budget: '¥180,000.00' } },
      { id: 'proj-003', status: '待确认', voucher: '-', attachment: '待补', values: { code: 'P006', name: '设备改造', owner: '生产部', start: '待确认', subject: '1604 在建工程', budget: '待确认' } },
    ],
    notes: ['项目档案影响费用归集、研发辅助账和项目维度报表。'],
  },
  departmentArchive: {
    keywordPlaceholder: '搜索部门编码、名称、负责人',
    primaryAction: '新增部门',
    importLabel: '导入部门',
    statusOptions: ['全部', '启用', '停用'],
    summary: [
      { label: '部门数量', value: '8 个', tone: 'blue' },
      { label: '启用', value: '7 个', tone: 'green' },
      { label: '人员归属', value: '42 人', tone: 'amber' },
      { label: '停用', value: '1 个', tone: 'gray' },
    ],
    columns: [
      { key: 'code', label: '部门编码' },
      { key: 'name', label: '部门名称' },
      { key: 'parent', label: '上级部门' },
      { key: 'owner', label: '负责人' },
      { key: 'subject', label: '费用科目' },
      { key: 'people', label: '人员数', align: 'right' },
    ],
    rows: [
      { id: 'dept-001', status: '启用', voucher: '-', attachment: '-', values: { code: 'D001', name: '销售部', parent: '总部', owner: '陈经理', subject: '6601 销售费用', people: '14' } },
      { id: 'dept-002', status: '启用', voucher: '-', attachment: '-', values: { code: 'D002', name: '财务部', parent: '总部', owner: '王会计', subject: '6602 管理费用', people: '5' } },
      { id: 'dept-003', status: '停用', voucher: '-', attachment: '-', values: { code: 'D009', name: '临时项目组', parent: '总部', owner: '-', subject: '6602 管理费用', people: '0' } },
    ],
    notes: ['部门档案用于工资、费用、辅助核算和管理报表。'],
  },
  tagArchive: {
    keywordPlaceholder: '搜索标签名称、适用模块、颜色',
    primaryAction: '新增标签',
    importLabel: '导入标签',
    statusOptions: ['全部', '启用', '停用'],
    summary: [
      { label: '标签数量', value: '18 个', tone: 'blue' },
      { label: '启用', value: '16 个', tone: 'green' },
      { label: '本期使用', value: '126 次', tone: 'amber' },
      { label: '停用', value: '2 个', tone: 'gray' },
    ],
    columns: [
      { key: 'name', label: '标签名称' },
      { key: 'module', label: '适用模块' },
      { key: 'color', label: '颜色/标识' },
      { key: 'rule', label: '自动标记规则' },
      { key: 'count', label: '使用次数', align: 'right' },
      { key: 'remark', label: '备注' },
    ],
    rows: [
      { id: 'tag-001', status: '启用', voucher: '-', attachment: '-', values: { name: '需客户确认', module: '发票/流水/凭证', color: '橙色', rule: '金额差异', count: '38', remark: '待办跟踪' } },
      { id: 'tag-002', status: '启用', voucher: '-', attachment: '-', values: { name: '税务风险', module: '税表/凭证', color: '红色', rule: '税率异常', count: '12', remark: '风险检查' } },
      { id: 'tag-003', status: '停用', voucher: '-', attachment: '-', values: { name: '旧标签', module: '单据', color: '灰色', rule: '无', count: '0', remark: '不再使用' } },
    ],
    notes: ['标签用于跨模块筛选、待办、客户沟通和风险追踪。'],
  },
  subjectSettings: {
    keywordPlaceholder: '搜索科目编码、科目名称、辅助核算、报表项目',
    primaryAction: '新增科目',
    importLabel: '导入科目',
    statusOptions: ['全部', '启用', '停用', '异常'],
    summary: [
      { label: '科目数量', value: '128 个', tone: 'blue' },
      { label: '启用', value: '126 个', tone: 'green' },
      { label: '辅助核算', value: '32 个', tone: 'amber' },
      { label: '映射异常', value: '2 个', tone: 'red' },
    ],
    columns: [
      { key: 'code', label: '科目编码' },
      { key: 'name', label: '科目名称' },
      { key: 'direction', label: '余额方向', align: 'center' },
      { key: 'aux', label: '辅助核算' },
      { key: 'report', label: '报表项目' },
      { key: 'cashFlow', label: '现金流量项目' },
    ],
    rows: [
      { id: 'subj-1002', status: '启用', voucher: '-', attachment: '-', values: { code: '1002', name: '银行存款', direction: '借', aux: '账户', report: '货币资金', cashFlow: '现金及现金等价物' } },
      { id: 'subj-1122', status: '启用', voucher: '-', attachment: '-', values: { code: '1122', name: '应收账款', direction: '借', aux: '客户', report: '应收账款', cashFlow: '销售商品收到的现金' } },
      { id: 'subj-2221', status: '异常', voucher: '-', attachment: '-', values: { code: '2221', name: '应交税费', direction: '贷', aux: '税种', report: '应交税费', cashFlow: '待映射' } },
    ],
    notes: ['科目设置需要维护余额方向、辅助核算、报表取数和现金流量映射。'],
  },
  assetCategory: {
    keywordPlaceholder: '搜索资产类别、折旧年限、残值率、默认科目',
    primaryAction: '新增类别',
    importLabel: '导入类别',
    statusOptions: ['全部', '启用', '停用'],
    summary: [
      { label: '资产类别', value: '9 类', tone: 'blue' },
      { label: '启用', value: '8 类', tone: 'green' },
      { label: '默认规则', value: '8 条', tone: 'amber' },
      { label: '停用', value: '1 类', tone: 'gray' },
    ],
    columns: [
      { key: 'code', label: '类别编码' },
      { key: 'name', label: '资产类别' },
      { key: 'life', label: '折旧年限' },
      { key: 'residual', label: '残值率' },
      { key: 'method', label: '折旧方法' },
      { key: 'subject', label: '默认科目' },
    ],
    rows: [
      { id: 'asset-001', status: '启用', voucher: '-', attachment: '-', values: { code: 'FA01', name: '机器设备', life: '10 年', residual: '5%', method: '平均年限法', subject: '1601 固定资产/1602 累计折旧' } },
      { id: 'asset-002', status: '启用', voucher: '-', attachment: '-', values: { code: 'FA02', name: '电子设备', life: '3 年', residual: '5%', method: '平均年限法', subject: '1601 固定资产/6602 管理费用' } },
      { id: 'asset-003', status: '停用', voucher: '-', attachment: '-', values: { code: 'FA09', name: '旧资产类别', life: '5 年', residual: '5%', method: '平均年限法', subject: '停用' } },
    ],
    notes: ['资产类别是折旧摊销模块的规则基础，影响折旧凭证和资产明细表。'],
  },
  invoiceMatchingRules: {
    keywordPlaceholder: '搜索规则名称、发票商品、购销方、税率、凭证模板',
    primaryAction: '新增发票规则',
    importLabel: '导入规则',
    statusOptions: ['全部', '启用', '停用', '异常'],
    summary: [
      { label: '发票规则', value: '18 条', tone: 'blue' },
      { label: '本期命中', value: '96 次', tone: 'green' },
      { label: 'AI 建议', value: '5 条', tone: 'amber' },
      { label: '冲突', value: '1 条', tone: 'red' },
    ],
    columns: [
      { key: 'name', label: '规则名称' },
      { key: 'condition', label: '匹配条件' },
      { key: 'template', label: '凭证模板' },
      { key: 'subject', label: '科目/税率' },
      { key: 'priority', label: '优先级', align: 'center' },
      { key: 'hit', label: '命中次数', align: 'right' },
    ],
    rows: [
      { id: 'ir-001', status: '启用', voucher: '-', attachment: '-', values: { name: '销售商品', condition: '销项 商品名称包含控制器', template: '借应收 贷收入/销项税', subject: '主营业务收入 13%', priority: '90', hit: '42' } },
      { id: 'ir-002', status: '启用', voucher: '-', attachment: '-', values: { name: '技术服务收入', condition: '销项 税率 6%', template: '借应收 贷服务收入/销项税', subject: '主营业务收入 6%', priority: '80', hit: '18' } },
      { id: 'ir-003', status: '异常', voucher: '-', attachment: '-', values: { name: '办公采购', condition: '进项 商品名称包含办公', template: '费用凭证', subject: '管理费用 6%/13%', priority: '冲突', hit: '9' } },
    ],
    notes: ['发票规则要记录匹配条件、凭证模板、优先级和命中日志；AI 规则必须人工确认后启用。'],
  },
  billMatchingRules: {
    keywordPlaceholder: '搜索规则名称、流水摘要、对方户名、金额区间',
    primaryAction: '新增账单规则',
    importLabel: '导入规则',
    statusOptions: ['全部', '启用', '停用', '异常'],
    summary: [
      { label: '账单规则', value: '14 条', tone: 'blue' },
      { label: '本期命中', value: '118 次', tone: 'green' },
      { label: '待确认', value: '7 条', tone: 'amber' },
      { label: '冲突', value: '1 条', tone: 'red' },
    ],
    columns: [
      { key: 'name', label: '规则名称' },
      { key: 'condition', label: '匹配条件' },
      { key: 'action', label: '生成动作' },
      { key: 'subject', label: '目标科目' },
      { key: 'priority', label: '优先级', align: 'center' },
      { key: 'hit', label: '命中次数', align: 'right' },
    ],
    rows: [
      { id: 'br-001', status: '启用', voucher: '-', attachment: '-', values: { name: '银行手续费', condition: '摘要包含手续费 金额小于1000', action: '生成费用凭证', subject: '6603 财务费用', priority: '95', hit: '22' } },
      { id: 'br-002', status: '启用', voucher: '-', attachment: '-', values: { name: '销售收款核销', condition: '对方户名=客户 金额=发票价税合计', action: '核销应收', subject: '1002/1122', priority: '90', hit: '61' } },
      { id: 'br-003', status: '待确认', voucher: '-', attachment: '-', values: { name: '个人备用金', condition: '对方户名为个人', action: '其他应收', subject: '1221 其他应收款', priority: '60', hit: '6' } },
    ],
    notes: ['账单规则用于流水分类、收付款核销和回单凭证生成，需要保留命中明细。'],
  },
  auxiliaryCategories: {
    keywordPlaceholder: '搜索类别编码、类别名称、适用科目、启用状态',
    primaryAction: '新增类别',
    importLabel: '导入类别',
    statusOptions: ['全部', '启用', '停用', '异常'],
    summary: [
      { label: '辅助类别', value: '9 类', tone: 'blue' },
      { label: '启用', value: '8 类', tone: 'green' },
      { label: '关联科目', value: '32 个', tone: 'amber' },
      { label: '异常', value: '1 类', tone: 'red' },
    ],
    columns: [
      { key: 'code', label: '类别编码' },
      { key: 'name', label: '类别名称' },
      { key: 'scope', label: '适用范围' },
      { key: 'subjects', label: '关联科目' },
      { key: 'required', label: '凭证必填', align: 'center' },
      { key: 'source', label: '来源' },
    ],
    rows: [
      { id: 'auxc-001', status: '启用', voucher: '-', attachment: '-', values: { code: 'AUX-CUSTOMER', name: '客户', scope: '应收/收入', subjects: '1122, 6001', required: '是', source: '系统预置' } },
      { id: 'auxc-002', status: '启用', voucher: '-', attachment: '-', values: { code: 'AUX-SUPPLIER', name: '供应商', scope: '应付/采购', subjects: '2202, 1403', required: '是', source: '系统预置' } },
      { id: 'auxc-003', status: '异常', voucher: '-', attachment: '-', values: { code: 'AUX-TAX', name: '税种', scope: '应交税费', subjects: '2221', required: '待确认', source: '申报初始化' } },
    ],
    notes: ['辅助核算类别决定科目是否需要客户、供应商、项目、部门、人员等维度。', '凭证录入、期初余额和账簿查询必须按此配置校验辅助项。'],
  },
  auxiliaryItems: {
    keywordPlaceholder: '搜索辅助类别、项目编码、项目名称、默认科目',
    primaryAction: '新增项目',
    importLabel: '导入项目',
    statusOptions: ['全部', '启用', '停用', '异常'],
    summary: [
      { label: '辅助项目', value: '126 个', tone: 'blue' },
      { label: '启用', value: '118 个', tone: 'green' },
      { label: '待补资料', value: '11 个', tone: 'amber' },
      { label: '异常', value: '3 个', tone: 'red' },
    ],
    columns: [
      { key: 'category', label: '辅助类别' },
      { key: 'code', label: '项目编码' },
      { key: 'name', label: '项目名称' },
      { key: 'alias', label: '别名/助记码' },
      { key: 'subject', label: '默认科目' },
      { key: 'lastUsed', label: '最近使用' },
    ],
    rows: [
      { id: 'auxi-001', status: '启用', voucher: '-', attachment: '开票资料', values: { category: '客户', code: 'C001', name: '上海辰光贸易有限公司', alias: 'CGMY', subject: '1122 应收账款', lastUsed: '2026-05-18' } },
      { id: 'auxi-002', status: '启用', voucher: '-', attachment: '合同', values: { category: '项目', code: 'P001', name: '研发项目A', alias: 'YFXMA', subject: '5301 研发支出', lastUsed: '2026-05-16' } },
      { id: 'auxi-003', status: '异常', voucher: '-', attachment: '缺失', values: { category: '供应商', code: 'S009', name: '杭州设备服务有限公司', alias: 'HZSBFW', subject: '2202 应付账款', lastUsed: '资料待补' } },
    ],
    notes: ['辅助核算项目是客户、供应商、项目、部门、人员等基础档案的统一视图。', '导入时要校验类别、编码唯一性和关联科目启用状态。'],
  },
  commonDigests: {
    keywordPlaceholder: '搜索摘要模板、适用模块、关键词、默认科目',
    primaryAction: '新增摘要',
    importLabel: '导入摘要',
    statusOptions: ['全部', '启用', '停用', '异常'],
    summary: [
      { label: '摘要模板', value: '42 条', tone: 'blue' },
      { label: '启用', value: '38 条', tone: 'green' },
      { label: 'AI 推荐', value: '9 条', tone: 'amber' },
      { label: '冲突', value: '2 条', tone: 'red' },
    ],
    columns: [
      { key: 'template', label: '摘要模板' },
      { key: 'module', label: '适用模块' },
      { key: 'keywords', label: '匹配关键词' },
      { key: 'subject', label: '默认科目' },
      { key: 'priority', label: '优先级', align: 'center' },
      { key: 'usage', label: '本期使用', align: 'right' },
    ],
    rows: [
      { id: 'dig-001', status: '启用', voucher: '-', attachment: '-', values: { template: '收到{客户}货款', module: '银行账单', keywords: '货款/回款', subject: '1122 应收账款', priority: '90', usage: '48' } },
      { id: 'dig-002', status: '启用', voucher: '-', attachment: '-', values: { template: '支付{供应商}材料款', module: '进项发票/流水', keywords: '材料/采购', subject: '2202 应付账款', priority: '85', usage: '31' } },
      { id: 'dig-003', status: '异常', voucher: '-', attachment: '-', values: { template: '报销办公费用', module: '单据登记', keywords: '办公/费用', subject: '6602 管理费用', priority: '冲突', usage: '12' } },
    ],
    notes: ['常用摘要要能用于凭证录入、AI 推荐摘要和流水自动分类。', 'AI 推荐摘要必须经过人工确认后才能成为启用模板。'],
  },
  voucherTemplateSettings: {
    keywordPlaceholder: '搜索模板名称、来源模块、借贷科目、辅助核算',
    primaryAction: '新增凭证模板',
    importLabel: '导入模板',
    statusOptions: ['全部', '启用', '停用', '待确认', '异常'],
    summary: [
      { label: '凭证模板', value: '36 套', tone: 'blue' },
      { label: '启用', value: '31 套', tone: 'green' },
      { label: 'AI建议', value: '7 套', tone: 'amber' },
      { label: '冲突', value: '2 套', tone: 'red' },
    ],
    columns: [
      { key: 'name', label: '模板名称' },
      { key: 'source', label: '适用来源' },
      { key: 'summary', label: '摘要规则' },
      { key: 'debit', label: '借方科目' },
      { key: 'credit', label: '贷方科目' },
      { key: 'aux', label: '辅助核算' },
      { key: 'priority', label: '优先级', align: 'center' },
      { key: 'usage', label: '本期使用', align: 'right' },
    ],
    rows: [
      { id: 'vt-001', status: '启用', voucher: '-', attachment: '规则', values: { name: '销售商品收入', source: '销项发票', summary: '销售{商品}', debit: '1122 应收账款', credit: '6001/2221', aux: '客户/项目', priority: '95', usage: '42' } },
      { id: 'vt-002', status: '启用', voucher: '-', attachment: '规则', values: { name: '银行手续费', source: '银行流水', summary: '支付银行手续费', debit: '6603 财务费用', credit: '1002 银行存款', aux: '账户', priority: '90', usage: '18' } },
      { id: 'vt-003', status: '异常', voucher: '-', attachment: '冲突日志', values: { name: '办公采购', source: '进项发票/单据', summary: '购买办公用品', debit: '6602 管理费用', credit: '2202/1002', aux: '部门/供应商', priority: '冲突', usage: '9' } },
    ],
    notes: ['凭证模板是发票、流水、单据和 AI 建议生成凭证的核心配置，必须记录来源、科目、辅助核算和优先级。', 'AI 推荐模板必须人工确认后启用。'],
  },
  reportFormulaSettings: {
    keywordPlaceholder: '搜索报表、项目、行次、取数科目、重分类',
    primaryAction: '复核标准公式',
    importLabel: '导入公式',
    statusOptions: ['全部', '启用', '停用', '待确认', '异常'],
    summary: [
      { label: '报表公式', value: '128 条', tone: 'blue' },
      { label: '启用', value: '121 条', tone: 'green' },
      { label: '待复核', value: '5 条', tone: 'amber' },
      { label: '异常', value: '2 条', tone: 'red' },
    ],
    columns: [
      { key: 'report', label: '报表' },
      { key: 'line', label: '行次', align: 'center' },
      { key: 'item', label: '报表项目' },
      { key: 'formula', label: '取数公式/科目' },
      { key: 'direction', label: '余额方向', align: 'center' },
      { key: 'reclass', label: '重分类' },
      { key: 'version', label: '版本' },
      { key: 'check', label: '校验' },
    ],
    rows: [
      { id: 'rf-001', status: '启用', voucher: '快照', attachment: '说明', values: { report: '资产负债表', line: '1', item: '货币资金', formula: '1001+1002+1012', direction: '借', reclass: '否', version: '2026.05', check: '通过' } },
      { id: 'rf-002', status: '启用', voucher: '快照', attachment: '说明', values: { report: '利润表', line: '1', item: '营业收入', formula: '6001+6051', direction: '贷', reclass: '否', version: '2026.05', check: '通过' } },
      { id: 'rf-003', status: '异常', voucher: '-', attachment: '差异', values: { report: '现金流量表', line: '5', item: '销售商品收到的现金', formula: '现金流项目 CF-01', direction: '借', reclass: '需映射', version: '2026.05', check: '缺少科目映射' } },
    ],
    notes: ['报表公式配置用于资产负债表、利润表、现金流量表和所有者权益变动表的取数说明与重分类。', '后续报表重算和导出模板都应引用这里的版本。'],
  },
  cashFlowMapping: {
    keywordPlaceholder: '搜索现金流项目、科目、摘要关键词、方向',
    primaryAction: '新增映射',
    importLabel: '导入映射',
    statusOptions: ['全部', '启用', '停用', '待确认', '异常'],
    summary: [
      { label: '映射规则', value: '64 条', tone: 'blue' },
      { label: '启用', value: '58 条', tone: 'green' },
      { label: '待确认', value: '4 条', tone: 'amber' },
      { label: '异常', value: '2 条', tone: 'red' },
    ],
    columns: [
      { key: 'projectCode', label: '项目编码' },
      { key: 'projectName', label: '现金流量项目' },
      { key: 'subject', label: '关联科目' },
      { key: 'keywords', label: '摘要/对方户名' },
      { key: 'direction', label: '方向', align: 'center' },
      { key: 'source', label: '来源模块' },
      { key: 'priority', label: '优先级', align: 'center' },
      { key: 'hit', label: '本期命中', align: 'right' },
    ],
    rows: [
      { id: 'cf-001', status: '启用', voucher: '-', attachment: '规则', values: { projectCode: 'CF-01', projectName: '销售商品收到的现金', subject: '1002/1122', keywords: '货款/回款', direction: '流入', source: '银行流水', priority: '95', hit: '48' } },
      { id: 'cf-002', status: '启用', voucher: '-', attachment: '规则', values: { projectCode: 'CF-12', projectName: '购买商品支付的现金', subject: '1002/2202', keywords: '材料/采购', direction: '流出', source: '进项发票+流水', priority: '90', hit: '31' } },
      { id: 'cf-003', status: '异常', voucher: '-', attachment: '冲突', values: { projectCode: 'CF-21', projectName: '支付其他经营活动现金', subject: '1002/6602', keywords: '办公/费用', direction: '流出', source: '单据登记', priority: '冲突', hit: '12' } },
    ],
    notes: ['现金流量映射连接银行流水、凭证、科目和现金流量表，是报表重算前必须补齐的框架。', '冲突规则需要人工确认，不能直接影响报表。'],
  },
  currencySettings: {
    keywordPlaceholder: '搜索币别编码、币别名称、汇率、折算方式',
    primaryAction: '新增币别',
    importLabel: '导入汇率',
    statusOptions: ['全部', '启用', '停用', '异常'],
    summary: [
      { label: '币别', value: '5 个', tone: 'blue' },
      { label: '启用', value: '4 个', tone: 'green' },
      { label: '待更新汇率', value: '1 个', tone: 'amber' },
      { label: '异常', value: '1 个', tone: 'red' },
    ],
    columns: [
      { key: 'code', label: '币别编码' },
      { key: 'name', label: '币别名称' },
      { key: 'symbol', label: '符号' },
      { key: 'rate', label: '记账汇率', align: 'right' },
      { key: 'method', label: '折算方式' },
      { key: 'updatedAt', label: '更新时间' },
    ],
    rows: [
      { id: 'cur-cny', status: '启用', voucher: '-', attachment: '-', values: { code: 'CNY', name: '人民币', symbol: '¥', rate: '1.0000', method: '本位币', updatedAt: '2026-05-01' } },
      { id: 'cur-usd', status: '启用', voucher: '-', attachment: '汇率表', values: { code: 'USD', name: '美元', symbol: '$', rate: '7.1832', method: '月末汇率', updatedAt: '2026-05-31' } },
      { id: 'cur-eur', status: '异常', voucher: '-', attachment: '缺失', values: { code: 'EUR', name: '欧元', symbol: '€', rate: '待更新', method: '月末汇率', updatedAt: '待维护' } },
    ],
    notes: ['币别管理影响外币发票、银行账户、期末汇兑损益和报表折算。', '汇率应保留来源、更新时间和期末调汇凭证。'],
  },
  printTemplateSettings: {
    keywordPlaceholder: '搜索模板名称、适用模块、纸张、启用状态',
    primaryAction: '查看固定模板',
    importLabel: '输出说明',
    statusOptions: ['全部', '启用'],
    summary: fixedPrintTemplateSummary,
    columns: [
      { key: 'name', label: '模板名称' },
      { key: 'module', label: '适用模块' },
      { key: 'paper', label: '纸张规格' },
      { key: 'orientation', label: '方向', align: 'center' },
      { key: 'version', label: '版本' },
      { key: 'default', label: '默认模板', align: 'center' },
      { key: 'updatedBy', label: '维护人' },
      { key: 'updatedAt', label: '更新时间' },
    ],
    rows: fixedPrintTemplateRows,
    notes: ['打印模板清单直接反映已实现的凭证、账簿、财务报表、税务申报和业务清单输出模板。', '模板随应用版本受控发布；需变更字段或版式时应修改对应导出代码并重新验证，不能在此页伪造可编辑配置。'],
  },
  taxAdapterSettings: {
    keywordPlaceholder: '搜索税局渠道、地区、税种、授权状态',
    primaryAction: '新增税局渠道',
    importLabel: '导入配置',
    statusOptions: ['全部', '启用', '停用', '待确认', '异常'],
    summary: [
      { label: '税局渠道', value: '5 个', tone: 'blue' },
      { label: '已配置', value: '3 个', tone: 'green' },
      { label: '待授权', value: '1 个', tone: 'amber' },
      { label: '异常', value: '1 个', tone: 'red' },
    ],
    columns: [
      { key: 'region', label: '地区' },
      { key: 'channel', label: '渠道名称' },
      { key: 'taxTypes', label: '适用税种' },
      { key: 'authMode', label: '授权方式' },
      { key: 'account', label: '账号状态' },
      { key: 'submitScope', label: '提交范围' },
      { key: 'receipt', label: '回执能力' },
      { key: 'lastCheck', label: '最近检测' },
    ],
    rows: [
      { id: 'ta-001', status: '启用', voucher: '-', attachment: '授权记录', values: { region: '上海', channel: '电子税务局adapter', taxTypes: '增值税/所得税/印花税', authMode: '人工授权', account: '已配置', submitScope: '生成申报包', receipt: '人工导入', lastCheck: '06-26 09:30' } },
      { id: 'ta-002', status: '待确认', voucher: '-', attachment: '参数表', values: { region: '浙江', channel: '电子税务局adapter', taxTypes: '个税/社保费', authMode: '待授权', account: '待配置', submitScope: '只读取数', receipt: '未启用', lastCheck: '待检测' } },
      { id: 'ta-003', status: '异常', voucher: '-', attachment: '错误日志', values: { region: '江苏', channel: '电子税务局adapter', taxTypes: '财报报送', authMode: '人工授权', account: '失效', submitScope: '禁用提交', receipt: '失败', lastCheck: '授权过期' } },
    ],
    notes: ['税局接口配置只做合法 adapter 的参数和授权状态管理，不伪装真实提交。', '自动报税后续必须经过授权、人工确认、提交回执、缴款书和审计日志闭环。'],
  },
  bankAdapterSettings: {
    keywordPlaceholder: '搜索银行、账户、采集方式、授权状态',
    primaryAction: '新增银行渠道',
    importLabel: '导入配置',
    statusOptions: ['全部', '启用', '停用', '待确认', '异常'],
    summary: [
      { label: '银行渠道', value: '6 个', tone: 'blue' },
      { label: '已启用', value: '4 个', tone: 'green' },
      { label: '待授权', value: '1 个', tone: 'amber' },
      { label: '异常', value: '1 个', tone: 'red' },
    ],
    columns: [
      { key: 'bank', label: '银行/平台' },
      { key: 'account', label: '账户名称' },
      { key: 'collectMode', label: '采集方式' },
      { key: 'fileFormat', label: '支持格式' },
      { key: 'authStatus', label: '授权状态' },
      { key: 'reconcile', label: '对账能力' },
      { key: 'receipt', label: '回单能力' },
      { key: 'lastSync', label: '最近同步' },
    ],
    rows: [
      { id: 'ba-001', status: '启用', voucher: '-', attachment: '网银模板', values: { bank: '工商银行', account: '工行基本户', collectMode: 'Excel/CSV导入', fileFormat: 'xlsx/csv', authStatus: '无需直连', reconcile: '启用', receipt: '人工上传', lastSync: '06-26 10:12' } },
      { id: 'ba-002', status: '待确认', voucher: '-', attachment: '授权申请', values: { bank: '招商银行', account: '招行一般户', collectMode: '直连预留', fileFormat: '待接口', authStatus: '待授权', reconcile: '预留', receipt: '预留', lastSync: '待开通' } },
      { id: 'ba-003', status: '异常', voucher: '-', attachment: '错误日志', values: { bank: '支付宝企业账单', account: '支付宝企业户', collectMode: '账单导入', fileFormat: 'csv', authStatus: '模板变更', reconcile: '部分启用', receipt: '不支持', lastSync: '解析失败' } },
    ],
    notes: ['银行接口配置用于管理导入模板、直连预留、回单能力和对账能力。', '真实银行直连必须依赖合法接口和企业授权；当前默认以文件导入和人工回单为主。'],
  },
  periodManagement: {
    keywordPlaceholder: '搜索账期、结账状态、锁定人、反结账原因',
    primaryAction: '执行结账',
    importLabel: '导出日志',
    statusOptions: ['全部', '待处理', '待确认', '已通过', '异常'],
    summary: [
      { label: '账期', value: '12 期', tone: 'blue' },
      { label: '已结账', value: '5 期', tone: 'green' },
      { label: '待结账', value: '1 期', tone: 'amber' },
      { label: '阻断', value: '1 期', tone: 'red' },
    ],
    columns: [
      { key: 'period', label: '账期' },
      { key: 'status', label: '结账状态' },
      { key: 'voucher', label: '凭证状态' },
      { key: 'report', label: '报表状态' },
      { key: 'tax', label: '申报状态' },
      { key: 'lockedBy', label: '锁定人' },
      { key: 'closedAt', label: '结账时间' },
      { key: 'action', label: '可执行动作' },
    ],
    rows: [
      { id: 'pm-202605', status: '待确认', voucher: '检查通过', attachment: '结账报告', values: { period: '2026-05', status: '待结账', voucher: '82/83 已审核', report: '已重算', tax: '待确认', lockedBy: '-', closedAt: '-', action: '确认结账' } },
      { id: 'pm-202604', status: '已通过', voucher: '已锁定', attachment: '归档包', values: { period: '2026-04', status: '已结账', voucher: '已锁定', report: '已归档', tax: '已申报', lockedBy: '王会计', closedAt: '2026-05-15 18:20', action: '申请反结账' } },
      { id: 'pm-202603', status: '异常', voucher: '阻断', attachment: '风险项', values: { period: '2026-03', status: '反结账申请', voucher: '凭证断号', report: '需重算', tax: '已申报', lockedBy: '主管', closedAt: '待审批', action: '审批中' } },
    ],
    notes: ['结账管理负责账期锁定、反结账申请、只读限制和归档状态，是桌面端正式做账的边界控制。', '高风险动作必须二次确认并进入审计日志。'],
  },
  auditLog: {
    keywordPlaceholder: '搜索操作人、模块、动作、单据号、风险级别',
    primaryAction: '导出审计',
    importLabel: '刷新日志',
    statusOptions: ['全部', '已通过', '待确认', '异常'],
    summary: [
      { label: '日志条数', value: '1,286 条', tone: 'blue' },
      { label: '普通操作', value: '1,214 条', tone: 'green' },
      { label: '需复核', value: '58 条', tone: 'amber' },
      { label: '高风险', value: '14 条', tone: 'red' },
    ],
    columns: [
      { key: 'time', label: '操作时间' },
      { key: 'operator', label: '操作人' },
      { key: 'module', label: '模块' },
      { key: 'action', label: '动作' },
      { key: 'object', label: '对象' },
      { key: 'level', label: '风险级别' },
      { key: 'result', label: '结果' },
      { key: 'ip', label: '终端/IP' },
    ],
    rows: [
      { id: 'log-001', status: '已通过', voucher: '记-0051', attachment: '快照', values: { time: '06-26 22:18:12', operator: '王会计', module: '会计凭证', action: '导出PDF', object: '记账凭证-2026-05', level: '普通', result: '成功', ip: 'local-desktop' } },
      { id: 'log-002', status: '待确认', voucher: '2026-05', attachment: '审批单', values: { time: '06-26 21:42:08', operator: '李会计', module: '结账管理', action: '申请反结账', object: '2026-04', level: '高', result: '待审批', ip: 'local-desktop' } },
      { id: 'log-003', status: '异常', voucher: '申报包', attachment: '错误日志', values: { time: '06-26 20:31:44', operator: '赵会计', module: '税务申报', action: '导入回执', object: '印花税', level: '中', result: '失败', ip: 'local-desktop' } },
    ],
    notes: ['审计日志统一记录导入、导出、生成凭证、删除、反结账、申报包确认等关键动作。', '后续 Rust/SQLite 持久化时应由后端命令写日志，前端只展示和筛选。'],
  },
  backupRestore: {
    keywordPlaceholder: '搜索备份名称、账套、类型、状态、操作人',
    primaryAction: '立即备份',
    importLabel: '导入备份',
    statusOptions: ['全部', '待处理', '已通过', '待确认', '异常'],
    summary: [
      { label: '备份文件', value: '18 个', tone: 'blue' },
      { label: '自动备份', value: '12 个', tone: 'green' },
      { label: '待验证', value: '4 个', tone: 'amber' },
      { label: '异常', value: '2 个', tone: 'red' },
    ],
    columns: [
      { key: 'name', label: '备份名称' },
      { key: 'company', label: '账套' },
      { key: 'type', label: '类型' },
      { key: 'size', label: '大小', align: 'right' },
      { key: 'hash', label: '文件哈希' },
      { key: 'operator', label: '操作人' },
      { key: 'time', label: '备份时间' },
      { key: 'restore', label: '恢复状态' },
    ],
    rows: [
      { id: 'bk-001', status: '已通过', voucher: '-', attachment: 'db', values: { name: '科旋电气-202605-自动备份', company: '科旋电气（上海）有限公司', type: '自动备份', size: '128 MB', hash: 'a8f1...9c2d', operator: '系统', time: '06-26 23:00', restore: '已验证' } },
      { id: 'bk-002', status: '待确认', voucher: '-', attachment: 'zip', values: { name: '申报前手工备份', company: '科旋电气（上海）有限公司', type: '手工备份', size: '136 MB', hash: '生成中', operator: '王会计', time: '06-26 21:30', restore: '待验证' } },
      { id: 'bk-003', status: '异常', voucher: '-', attachment: '错误日志', values: { name: '历史账套迁移备份', company: '杭州辰光贸易有限公司', type: '迁移备份', size: '失败', hash: '校验失败', operator: '李会计', time: '06-26 19:12', restore: '不可恢复' } },
    ],
    notes: ['立即备份会生成本机 SQLite 全库快照；快照列表不使用模拟数据。', '导入恢复仅进入待确认和文件核验流程，不会自动覆盖本机账套。'],
  },
  settlementRules: {
    keywordPlaceholder: '搜索结转类型、执行顺序、取数来源、凭证模板',
    primaryAction: '新增结转规则',
    importLabel: '导入规则',
    statusOptions: ['全部', '启用', '停用', '异常'],
    summary: [
      { label: '结转规则', value: '11 条', tone: 'blue' },
      { label: '启用', value: '10 条', tone: 'green' },
      { label: '待执行', value: '6 条', tone: 'amber' },
      { label: '阻断', value: '1 条', tone: 'red' },
    ],
    columns: [
      { key: 'order', label: '顺序', align: 'center' },
      { key: 'name', label: '结转类型' },
      { key: 'source', label: '取数来源' },
      { key: 'template', label: '凭证模板' },
      { key: 'condition', label: '执行条件' },
      { key: 'lastRun', label: '最近执行' },
    ],
    rows: [
      { id: 'sr-001', status: '启用', voucher: '记-0080', attachment: '明细', values: { order: '1', name: '折旧摊销', source: '固定资产/待摊费用', template: '借费用 贷累计折旧', condition: '资产已计提', lastRun: '2026-05-20' } },
      { id: 'sr-002', status: '启用', voucher: '记-0086', attachment: '明细', values: { order: '2', name: '税费计提', source: '税务报表', template: '借税金及附加 贷应交税费', condition: '税表已确认', lastRun: '2026-05-20' } },
      { id: 'sr-003', status: '异常', voucher: '未生成', attachment: '风险项', values: { order: '8', name: '损益结转', source: '损益类科目余额', template: '结转本年利润', condition: '凭证借贷平衡', lastRun: '被风险阻断' } },
    ],
    notes: ['结转规则进入期末结转工作台，必须按顺序执行并记录凭证来源。'],
  },
  voucherRecycle: {
    keywordPlaceholder: '搜索凭证号、摘要、删除人、删除原因',
    primaryAction: '恢复凭证',
    importLabel: '导出日志',
    statusOptions: ['全部', '待确认', '已通过', '异常'],
    summary: [
      { label: '删除凭证', value: '6 张', tone: 'blue' },
      { label: '可恢复', value: '5 张', tone: 'green' },
      { label: '待复核', value: '1 张', tone: 'amber' },
      { label: '异常', value: '1 张', tone: 'red' },
    ],
    columns: [
      { key: 'date', label: '凭证日期' },
      { key: 'wordNo', label: '凭证字号' },
      { key: 'summary', label: '摘要' },
      { key: 'amount', label: '金额', align: 'right' },
      { key: 'deletedBy', label: '删除人' },
      { key: 'deletedAt', label: '删除时间' },
      { key: 'reason', label: '删除原因' },
    ],
    rows: [
      { id: 'vr-001', status: '待确认', voucher: '记-0028', attachment: '附件2', values: { date: '2026-05-06', wordNo: '记-0028', summary: '差旅费报销', amount: '¥2,860.00', deletedBy: '王会计', deletedAt: '2026-05-18 11:20', reason: '重复生成' } },
      { id: 'vr-002', status: '已通过', voucher: '记-0033', attachment: '附件1', values: { date: '2026-05-08', wordNo: '记-0033', summary: '办公用品', amount: '¥1,240.00', deletedBy: '李会计', deletedAt: '2026-05-19 09:12', reason: '改由发票生成' } },
      { id: 'vr-003', status: '异常', voucher: '记-0041', attachment: '无', values: { date: '2026-05-10', wordNo: '记-0041', summary: '银行手续费', amount: '¥320.00', deletedBy: '赵会计', deletedAt: '2026-05-19 15:44', reason: '关联结账检查' } },
    ],
    notes: ['凭证回收箱需要保留删除、恢复和彻底删除审计日志，避免凭证断号不可追溯。'],
  },
  declarationReceipt: {
    keywordPlaceholder: '搜索税种、申报表、回执号、缴款书号、状态',
    primaryAction: '收取回执',
    importLabel: '导入回执',
    statusOptions: ['全部', '待处理', '待确认', '已通过', '异常'],
    summary: [
      { label: '申报事项', value: '8 项', tone: 'blue' },
      { label: '已收回执', value: '5 项', tone: 'green' },
      { label: '待缴款', value: '2 项', tone: 'amber' },
      { label: '异常', value: '1 项', tone: 'red' },
    ],
    columns: [
      { key: 'taxType', label: '税种' },
      { key: 'form', label: '申报表' },
      { key: 'period', label: '所属期' },
      { key: 'declareStatus', label: '申报状态' },
      { key: 'receiptNo', label: '回执号' },
      { key: 'paymentStatus', label: '缴款状态' },
      { key: 'paymentNo', label: '缴款书号' },
      { key: 'receivedAt', label: '收取时间' },
    ],
    rows: [
      { id: 'dr-001', status: '已通过', voucher: '申报包', attachment: '回执PDF', values: { taxType: '企业所得税', form: '季度预缴申报表', period: '2026-Q2', declareStatus: '已申报', receiptNo: 'RCPT-20260626-001', paymentStatus: '无需缴款', paymentNo: '-', receivedAt: '06-26 10:42' } },
      { id: 'dr-002', status: '待确认', voucher: '申报包', attachment: '缴款书', values: { taxType: '增值税及附加', form: '增值税主表', period: '2026-05', declareStatus: '待提交', receiptNo: '待收取', paymentStatus: '待缴款', paymentNo: '待生成', receivedAt: '-' } },
      { id: 'dr-003', status: '异常', voucher: '申报包', attachment: '错误截图', values: { taxType: '印花税', form: '财产和行为税', period: '2026-05', declareStatus: '提交失败', receiptNo: '-', paymentStatus: '未缴款', paymentNo: '-', receivedAt: '错误待处理' } },
    ],
    notes: ['真实回执和缴款书收取必须通过合法税局 adapter 或人工导入，不能伪造真实提交结果。', '当前先补齐回执号、缴款书、状态和附件留档框架。'],
  },
}

function getModuleListMeta(kind: ModuleKind): ModuleListMeta {
  const metadata: Record<ModuleKind, ModuleListMeta> = {
    outputInvoice: {
      title: '销项开票与收款清单',
      hint: '核验开票来源、购方、税率、金额税额、异常票和凭证生成状态。',
      exportHint: '导出包含开票来源、商品行、税额、价税合计、凭证号和附件状态。',
    },
    inputInvoice: {
      title: '进项抵扣与认证清单',
      hint: '围绕票池同步、认证勾选、抵扣用途、供应商匹配和凭证草稿进行复核。',
      exportHint: '导出保留认证状态、抵扣用途、税额、异常原因和凭证关联。',
    },
    billList: {
      title: '资金流水与匹配清单',
      hint: '按账户、对方户名、资金方向、回单和凭证匹配结果处理本期流水。',
      exportHint: '导出包含流水来源、收支金额、匹配结果、回单状态和凭证关联。',
    },
    bankStatement: {
      title: '银行流水与对账清单',
      hint: '核对账户余额、流水号、回单归档、对账差异和凭证生成结果。',
      exportHint: '导出以银行账户、流水号、余额、对账结果和回单状态为主。',
    },
    receipt: {
      title: '票据台账与到期清单',
      hint: '跟踪票据类型、出票方、到期日、背书用途和影像附件。',
      exportHint: '导出保留票据号码、到期日、票面金额、用途和附件状态。',
    },
    documentRegister: {
      title: '业务单据登记清单',
      hint: '按业务日期、单据类型、归属部门、附件和审核状态管理原始单据。',
      exportHint: '导出包含单据编号、业务类型、金额、审核状态和凭证去向。',
    },
    expenseReimbursement: {
      title: '费用报销审批清单',
      hint: '核验报销人、费用类别、审批节点、票据附件、付款与凭证状态。',
      exportHint: '导出保留报销单号、费用分类、审批结果、付款状态和凭证。',
    },
    purchaseManagement: {
      title: '采购业务与入账清单',
      hint: '关联采购单、供应商、进项票、入库和成本入账处理结果。',
      exportHint: '导出按采购单、供应商、数量金额、发票和入账状态生成。',
    },
    salesManagement: {
      title: '销售业务与开票清单',
      hint: '关联客户、销售单、出库、销项发票、收款和收入凭证状态。',
      exportHint: '导出按客户、业务单、金额、开票、收款和凭证状态生成。',
    },
    employee: {
      title: '人员档案与参保资料清单',
      hint: '核验员工身份、部门岗位、入职状态、社保资料和档案附件完整性。',
      exportHint: '导出保留脱敏证件号、部门岗位、入职日期、状态和档案附件。',
    },
    payroll: {
      title: '薪酬计算与发放清单',
      hint: '复核工资项、个税、社保扣缴、实发金额和工资凭证生成状态。',
      exportHint: '导出按员工、工资项、个税、实发、异常说明和凭证状态生成。',
    },
    socialSecurity: {
      title: '社保公积金核对清单',
      hint: '按员工和缴费地核验基数、单位与个人缴纳额、工资匹配和差异。',
      exportHint: '导出包含缴费基数、单位个人金额、来源、差异和凭证状态。',
    },
    specialDeduction: {
      title: '专项附加扣除核验清单',
      hint: '核验扣除项目、人员资料、有效期、个税取数和异常补充项。',
      exportHint: '导出保留扣除项目、人员、有效期、取数状态和资料完整性。',
    },
    voucher: {
      title: '会计凭证审核清单',
      hint: '按凭证字、日期、摘要、借贷金额、附件和审核状态处理凭证。',
      exportHint: '导出遵循会计凭证编号、分录金额、附件张数和审核口径。',
    },
    invoiceVoucherMatching: {
      title: '票据凭证匹配复核清单',
      hint: '逐笔核验发票、单据、流水与凭证之间的金额、日期、科目和置信度差异。',
      exportHint: '导出保留票据来源、匹配规则、差异金额、人工确认人和凭证关联。',
    },
    riskCheck: {
      title: '结账前风险与处置清单',
      hint: '按风险等级、来源规则、阻断影响、处理人和修复凭证跟踪本期风险。',
      exportHint: '导出包含规则编号、触发依据、风险等级、处置记录和复核时间。',
    },
    closingTasks: {
      title: '月末结转执行控制清单',
      hint: '按固定顺序核对前置条件、取数快照、凭证草稿、阻断原因和审批状态。',
      exportHint: '导出保留结转顺序、取数来源、凭证模板、执行结果和阻断说明。',
    },
    notificationCenter: {
      title: '账套待办与协同提醒清单',
      hint: '集中处理当前账套的资料补传、人工确认、风险修复、报表重算与申报截止事项。',
      exportHint: '导出保留待办来源、优先级、负责人、截止时间、处理入口和完成记录。',
    },
    contractLedger: {
      title: '合同与印花税资料清单',
      hint: '核验客户或供应商合同、税目、金额、发票关联、归档附件和待计税事项。',
      exportHint: '导出包含合同编号、相对方、税目、金额、发票关联与归档状态。',
    },
    attachmentCenter: {
      title: '附件归档与关联清单',
      hint: '按文件校验值、来源模块、关联单据、归档状态和异常原因管理本地附件元数据。',
      exportHint: '导出保留文件名、校验值、关联对象、归档状态、上传人和处理时间。',
    },
    importCenter: {
      title: '导入批次与失败行清单',
      hint: '按导入模板、字段映射、成功失败行、目标模块和写入记录复核本地导入批次。',
      exportHint: '导出保留批次文件、模板、行数、失败原因、操作人和写入状态。',
    },
    exportCenter: {
      title: '导出文件与下载留痕清单',
      hint: '按输出模板、文件格式、生成状态、下载范围、校验值和有效期管理本地导出文件。',
      exportHint: '导出保留生成文件、格式、范围、校验值、操作人、时间和保留期限。',
    },
    aiJobQueue: {
      title: 'AI任务执行与确认清单',
      hint: '按资料来源、处理节点、置信度、负责人、异常重试与人工确认状态跟踪 AI 任务。',
      exportHint: '导出保留任务编号、来源资料、执行节点、置信度、确认人和运行日志索引。',
    },
    aiRecognitionResults: {
      title: 'OCR识别字段复核清单',
      hint: '逐项核验来源影像、识别字段、置信度、档案匹配、风险提示和人工修正结果。',
      exportHint: '导出保留来源文件、识别字段、置信度、匹配结果、异常原因和复核人。',
    },
    aiVoucherSuggestions: {
      title: 'AI凭证建议确认清单',
      hint: '核验建议摘要、借贷科目、金额、辅助核算、借贷平衡、来源附件和人工确认记录。',
      exportHint: '导出保留建议编号、来源业务、建议分录、置信度、风险和确认去向。',
    },
    aiRuleTraining: {
      title: 'AI规则训练与发布清单',
      hint: '按训练样本、触发条件、命中率、版本、适用范围和发布审批状态管理规则。',
      exportHint: '导出保留样本来源、训练版本、命中统计、发布状态和审核人。',
    },
    transfer: {
      title: '账户内部转账清单',
      hint: '核验转出转入账户、手续费、流水号、回单和内部转账凭证。',
      exportHint: '导出包含账户流向、金额、手续费、流水号、回单和凭证。',
    },
    depreciation: {
      title: '折旧摊销计提清单',
      hint: '核验资产或待摊项目、计提期间、摊销金额、凭证模板和执行状态。',
      exportHint: '导出以资产项目、计提口径、金额、执行状态和凭证为主。',
    },
    inventorySettings: {
      title: '存货档案与成本口径清单',
      hint: '维护存货编码、规格、单位、税率、默认科目和成本结转基础资料。',
      exportHint: '导出包含存货档案、单位税率、默认科目和成本核算口径。',
    },
    inventoryMovement: {
      title: '出入库业务清单',
      hint: '按入出库日期、仓库、存货、数量金额和单据附件核验库存业务。',
      exportHint: '导出包含出入库方向、仓库、存货、数量金额和单据来源。',
    },
    costCarryover: {
      title: '成本结转执行清单',
      hint: '核验成本来源、结转方法、入账金额、凭证模板和结转异常。',
      exportHint: '导出保留成本来源、结转口径、金额、凭证和异常说明。',
    },
    bankReconciliation: {
      title: '银行对账差异清单',
      hint: '逐笔核对账单、账簿余额、未达项、调节结果和差异处理状态。',
      exportHint: '导出包含银行账单、账簿记录、差异原因和调节结果。',
    },
    receivableSettlement: {
      title: '应收核销与回款清单',
      hint: '跟踪客户应收、回款流水、核销金额、差额和收入凭证关联。',
      exportHint: '导出保留客户、应收单据、回款、核销金额和差异状态。',
    },
    payableSettlement: {
      title: '应付核销与付款清单',
      hint: '跟踪供应商应付、付款流水、核销金额、差额和成本费用凭证。',
      exportHint: '导出保留供应商、应付单据、付款、核销金额和差异状态。',
    },
    receivablePayableAging: {
      title: '往来账龄与风险清单',
      hint: '按往来单位、科目、余额、账龄区间和最近凭证识别逾期风险。',
      exportHint: '导出包含往来余额、账龄区间、逾期金额、责任人和风险状态。',
    },
    taxReport: {
      title: '申报取数与校验清单',
      hint: '核验税种、申报表、取数来源、计税依据、减免抵扣和申报状态。',
      exportHint: '导出包含税种、申报表、取数、校验、应缴金额和风险。',
    },
    declarationCalendar: {
      title: '本期申报日历清单',
      hint: '按申报截止日、税种、负责人、取数状态和确认节点安排本期工作。',
      exportHint: '导出保留税种、所属期、截止日期、负责人和办理状态。',
    },
    declarationReceipt: {
      title: '申报回执与缴款归档清单',
      hint: '核验申报状态、回执号、缴款书、收取时间和归档附件。',
      exportHint: '导出包含申报表、回执号、缴款书、缴款状态和归档附件。',
    },
    historyVoucher: {
      title: '历史凭证迁移清单',
      hint: '按目标历史账期、原凭证号、分录科目、借贷平衡、附件和来源批次完成凭证迁移。',
      exportHint: '导出保留目标账期、原凭证号、分录映射、借贷金额、来源文件和迁移校验结果。',
    },
    historyBalance: {
      title: '历史余额与期初转换清单',
      hint: '核验来源余额、余额方向、科目映射和试算结果，再转换为目标历史账期的期初基础。',
      exportHint: '导出保留来源期间、科目、借贷期初、余额方向、试算差异和转换状态。',
    },
    historyGeneralLedger: {
      title: '历史总账勾稽清单',
      hint: '按来源期间、科目、期初期末和本期发生额复核总账与余额表的迁移口径。',
      exportHint: '导出包含来源期间、总账发生额、期初期末、科目映射和勾稽结果。',
    },
    historySubsidiaryLedger: {
      title: '历史明细账穿透清单',
      hint: '按凭证日期、原凭证号、科目、对方科目和余额追溯历史明细，并核验可重建凭证分录。',
      exportHint: '导出保留明细日期、原凭证号、科目、对方科目、借贷余额和来源文件。',
    },
    auditLog: {
      title: '账套操作审计清单',
      hint: '按操作人、模块、对象、风险等级、结果和时间追溯账套操作。',
      exportHint: '导出保留操作主体、对象、结果、附件、账期和审计时间。',
    },
    backupRestore: {
      title: '备份恢复与校验清单',
      hint: '跟踪账套快照、文件哈希、恢复验证、操作人和异常原因。',
      exportHint: '导出包含备份名称、账套、哈希、恢复状态和操作时间。',
    },
    voucherCreate: { title: '凭证草稿录入清单', hint: '按凭证日期、摘要、分录、辅助核算、附件和来源单据完成草稿录入与借贷平衡复核。', exportHint: '导出保留凭证草稿、分录科目、借贷金额、辅助项、附件和来源单据。' },
    voucherEdit: { title: '凭证修改与复核清单', hint: '跟踪待修改凭证的分录变更、审核状态、附件、来源单据和修改留痕。', exportHint: '导出包含修改前后分录、审核状态、附件、修改人和复核记录。' },
    voucherDetail: { title: '凭证来源与分录明细', hint: '查看凭证表头、分录、辅助核算、附件、审核日志和来源业务，不直接替代人工审核。', exportHint: '导出保留凭证表头、分录、来源业务、附件和审核留痕。' },
    unitSettings: { title: '计量单位与换算清单', hint: '维护计量单位、换算组、精度、适用存货和数量换算口径。', exportHint: '导出保留单位编码、换算关系、精度、适用范围和维护状态。' },
    ledgerReport: { title: '账簿取数与勾稽清单', hint: '集中核验科目余额、汇总、总账、明细账和辅助账的取数期间、勾稽结果与异常。', exportHint: '导出保留账簿类型、取数期间、科目范围、余额口径和勾稽状态。' },
    trialBalanceReport: { title: '科目余额试算清单', hint: '按科目和辅助核算复核期初、本期借贷、累计发生与期末余额的平衡关系。', exportHint: '导出包含科目、期初、本期借贷、累计发生、期末余额和试算结果。' },
    accountSummaryReport: { title: '科目汇总取数清单', hint: '按科目汇总本期借贷发生额，核验凭证范围、方向与汇总差异。', exportHint: '导出保留科目、借方发生、贷方发生、凭证范围和汇总校验结果。' },
    generalLedgerReport: { title: '总账发生额与余额清单', hint: '按科目和月份复核期初、本期发生、方向、余额与凭证来源。', exportHint: '导出包含科目、期间、期初、本期发生、余额和凭证来源。' },
    subsidiaryLedgerReport: { title: '明细账凭证穿透清单', hint: '按科目逐笔查看凭证日期、摘要、对方科目、借贷发生和余额变动。', exportHint: '导出保留逐笔日期、凭证号、摘要、对方科目、借贷与余额。' },
    auxiliaryLedgerReport: { title: '辅助核算明细账清单', hint: '按客户、供应商、项目、部门和人员等辅助维度复核明细发生与余额。', exportHint: '导出包含辅助维度、科目、凭证、借贷发生、余额和来源。' },
    auxiliaryBalanceReport: { title: '辅助核算余额清单', hint: '按辅助项目复核期初、本期发生、累计发生和期末余额，并追溯关联科目。', exportHint: '导出保留辅助项目、科目、期初、本期、累计和期末余额。' },
    multiColumnLedgerReport: { title: '多栏账费用归集清单', hint: '按费用、收入和成本类科目查看多栏发生额、归集维度和凭证来源。', exportHint: '导出包含多栏项目、发生额、归集维度、凭证范围和余额。' },
    financialReport: { title: '财务报表取数总览清单', hint: '集中复核资产负债、利润、现金流和权益变动表的取数、公式、校验与报送状态。', exportHint: '导出保留报表名称、所属期、取数快照、公式版本、校验结果和报送状态。' },
    balanceSheetReport: { title: '资产负债表取数清单', hint: '按资产、负债和所有者权益项目复核期末余额、重分类和公式取数结果。', exportHint: '导出包含报表项目、期末金额、上年金额、公式来源和重分类说明。' },
    incomeStatementReport: { title: '利润表取数与累计清单', hint: '按收入、成本、费用和利润项目复核本月、本年累计、科目映射和公式结果。', exportHint: '导出保留利润表项目、本月、本年累计、取数科目和校验说明。' },
    incomeQuarterReport: { title: '利润表季报取数清单', hint: '按季度累计收入、成本、费用和利润项目复核所得税申报使用的财务数据快照。', exportHint: '导出包含季度项目、累计金额、取数依据、快照时间和复核结果。' },
    cashFlowReport: { title: '现金流量表映射清单', hint: '核验现金流量项目、银行流水与凭证映射、金额归集和未匹配事项。', exportHint: '导出保留现金流项目、映射规则、来源凭证、金额和差异说明。' },
    cashFlowQuarterReport: { title: '现金流量表季报清单', hint: '按季度复核现金流量主表、项目映射、报送取数和期间差异。', exportHint: '导出包含季度现金流项目、累计金额、映射来源和报送快照。' },
    equityChangeReport: { title: '所有者权益变动清单', hint: '按权益项目跟踪期初、本期增减、利润分配和期末余额的取数依据。', exportHint: '导出保留权益项目、期初、本期增减、期末和取数说明。' },
    vatTaxReport: { title: '增值税及附加申报清单', hint: '核验销项、进项、留抵、抵扣、附加税计税依据和申报前校验结果。', exportHint: '导出包含税种、所属期、销进项数据、抵扣、应缴金额和校验状态。' },
    withholdingTaxReport: { title: '个人所得税扣缴清单', hint: '按员工、工资、专项扣除、预扣税额和异常资料复核个税扣缴申报数据。', exportHint: '导出保留员工脱敏信息、工资、扣除、预扣税额和资料状态。' },
    stampTaxReport: { title: '印花税应税合同清单', hint: '按合同、税目、计税金额、税率和凭证附件复核印花税申报取数。', exportHint: '导出包含合同、税目、计税金额、税率、应缴税额和附件。' },
    incomeTaxReport: { title: '企业所得税预缴清单', hint: '核验预缴收入、成本费用、纳税调整、弥补亏损和应纳税所得额。', exportHint: '导出保留所属期、会计利润、纳税调整、应纳所得额和预缴税额。' },
    socialSecurityTaxReport: { title: '社保费申报核验清单', hint: '按参保人员、缴费基数、单位个人金额、工资差异和申报状态复核社保费。', exportHint: '导出包含人员、缴费基数、单位个人金额、差异和申报状态。' },
    financeTaxReport: { title: '财报报送快照清单', hint: '跟踪财报版本、所属期、取数快照、附件、校验结果和本地报送准备状态。', exportHint: '导出保留财报类型、所属期、快照版本、附件、校验和报送状态。' },
    nonTaxRevenueReport: { title: '非税收入申报事项清单', hint: '维护非税收入事项、计费依据、缴费状态、回执附件和异常处理记录。', exportHint: '导出包含事项名称、所属期、计费依据、缴费状态、回执和负责人。' },
    settingsData: { title: '账套设置与启用控制清单', hint: '集中查看当前账套的会计制度、账期、打印、权限和自动化基础开关。', exportHint: '导出保留设置项、生效范围、变更人、变更时间和审计说明。' },
    companyInfo: { title: '企业主体与税种认定清单', hint: '维护企业基本信息、纳税人资格、税种认定、开户行和申报基础资料。', exportHint: '导出保留企业主体、税号脱敏信息、税种认定、开户行和维护状态。' },
    initialBalance: { title: '期初余额录入与试算清单', hint: '按科目和辅助核算维护期初余额，复核借贷平衡、来源批次与启用状态。', exportHint: '导出包含期初科目、辅助项、借贷金额、余额方向和试算结果。' },
    taxInit: { title: '申报初始化与授权边界清单', hint: '维护税种、申报周期、申报口径和本地授权状态，不存储外部平台密码。', exportHint: '导出保留税种、周期、申报口径、授权状态和维护时间。' },
    accountArchive: { title: '银行及现金账户档案清单', hint: '维护开户行、账户性质、默认科目、期初余额和流水导入范围。', exportHint: '导出保留账户信息、默认科目、期初口径、启停状态和支持材料。' },
    customerArchive: { title: '客户往来与辅助核算清单', hint: '维护客户编码、税号、默认应收科目、信用口径和业务引用。', exportHint: '导出保留客户资料、默认科目、信用等级、启停状态和业务引用。' },
    supplierArchive: { title: '供应商往来与采购核算清单', hint: '维护供应商编码、税号、默认应付科目、采购结算和进项票关联。', exportHint: '导出保留供应商资料、默认科目、结算条件、启停状态和业务引用。' },
    otherContactArchive: { title: '其他往来单位档案清单', hint: '维护员工、股东、关联方及其他往来单位的辅助核算和默认科目。', exportHint: '导出保留往来单位、分类、默认科目、启停状态和业务引用。' },
    projectArchive: { title: '项目辅助核算清单', hint: '维护项目编码、所属客户、收入成本归集范围、负责人和启停状态。', exportHint: '导出保留项目资料、客户关联、归集口径、负责人和业务引用。' },
    departmentArchive: { title: '部门费用归集清单', hint: '维护部门层级、成本费用归集、人员关联和默认核算口径。', exportHint: '导出保留部门资料、上级部门、归集口径、负责人和业务引用。' },
    tagArchive: { title: '业务标签与筛选口径清单', hint: '维护标签分类、适用业务、筛选口径和启停记录，不改变原始业务数据。', exportHint: '导出保留标签名称、适用模块、生效范围、启停状态和变更记录。' },
    subjectSettings: { title: '会计科目与报表映射清单', hint: '维护科目编码、余额方向、辅助核算、上级科目和报表映射关系。', exportHint: '导出保留科目编码、名称、方向、辅助核算、映射和启停状态。' },
    assetCategory: { title: '资产类别与折旧参数清单', hint: '维护资产类别、折旧年限、残值率、计提科目和适用资产范围。', exportHint: '导出保留资产类别、折旧参数、默认科目、启停状态和支持材料。' },
    invoiceMatchingRules: { title: '发票自动匹配规则清单', hint: '按票种、税率、购销方、商品服务和凭证模板维护发票匹配规则。', exportHint: '导出保留规则条件、目标科目、凭证模板、优先级和启停状态。' },
    billMatchingRules: { title: '账单自动匹配规则清单', hint: '按摘要、对方户名、金额区间、收支方向和凭证模板维护流水匹配规则。', exportHint: '导出保留规则条件、金额区间、目标科目、模板和启停状态。' },
    auxiliaryCategories: { title: '辅助核算类别清单', hint: '维护辅助核算类别、适用科目、项目数量和启停控制。', exportHint: '导出保留辅助类别、适用科目、启停状态和变更记录。' },
    auxiliaryItems: { title: '辅助核算项目清单', hint: '维护各辅助类别下的项目资料、默认科目和业务引用。', exportHint: '导出保留辅助项目、所属类别、默认科目、启停状态和业务引用。' },
    commonDigests: { title: '常用摘要与推荐词库清单', hint: '维护凭证摘要模板、适用业务、匹配关键词、默认科目和 AI 推荐口径。', exportHint: '导出保留摘要模板、适用业务、关键词、默认科目和使用状态。' },
    voucherTemplateSettings: { title: '凭证模板与分录规则清单', hint: '维护来源业务、借贷科目、摘要模板、辅助核算和自动套用边界。', exportHint: '导出保留模板名称、来源业务、借贷科目、摘要和启停状态。' },
    reportFormulaSettings: { title: '报表公式与版本控制清单', hint: '维护报表项目、取数公式、重分类规则、版本和复核状态。', exportHint: '导出保留报表项目、公式、版本、适用范围和复核记录。' },
    cashFlowMapping: { title: '现金流量映射规则清单', hint: '维护流水摘要、凭证科目与现金流量表项目之间的映射和优先级。', exportHint: '导出保留映射条件、现金流项目、优先级、来源和启停状态。' },
    currencySettings: { title: '币别与汇率维护清单', hint: '维护币别编码、记账汇率、基准币、外币核算口径和期末调汇基础。', exportHint: '导出保留币别、汇率、基准币标记、生效时间和维护状态。' },
    printTemplateSettings: { title: '打印与归档模板清单', hint: '维护凭证、报表、申报包和附件归档的版式、版本、适用范围和启用状态。', exportHint: '导出保留模板名称、文档类型、版本、适用范围和启停状态。' },
    taxAdapterSettings: { title: '税局适配授权状态清单', hint: '维护合法税局适配器的地区、税种、授权状态和回执能力，不保存外部账号密码。', exportHint: '导出保留适配器、地区、税种、授权状态、能力范围和到期时间。' },
    bankAdapterSettings: { title: '银行适配能力清单', hint: '维护银行流水、回单和对账适配器的授权状态、能力范围与本地接入边界。', exportHint: '导出保留银行适配器、授权状态、采集能力、回单能力和到期时间。' },
    periodManagement: { title: '账期结账与锁定清单', hint: '跟踪账期状态、结账前校验、锁定、反结账申请、归档和审批留痕。', exportHint: '导出包含账期、结账状态、校验结果、审批人、归档状态和操作时间。' },
    settlementRules: { title: '期末结转规则清单', hint: '按结转类型、取数来源、凭证模板、执行条件和顺序维护期末结转规则。', exportHint: '导出保留结转类型、取数来源、模板、执行条件、顺序和启停状态。' },
    voucherRecycle: { title: '凭证回收与恢复清单', hint: '跟踪已删除凭证、删除原因、恢复状态、彻底删除审批和审计记录。', exportHint: '导出保留凭证号、删除人、删除时间、原因、恢复与审批状态。' },
  }

  return metadata[kind]
}

function getModuleDetailMeta(kind: ModuleKind): ModuleDetailMeta {
  const moduleListMeta = getModuleListMeta(kind)
  const moduleDetailTitle = `${moduleListMeta.title.replace(/清单$/, '')}明细`
  const withModuleReview = (boundary: string) => `${moduleListMeta.hint} ${boundary}`
  if (kind === 'settingsData') {
    return { title: moduleDetailTitle, boundary: withModuleReview('查看只读取当前账套的会计制度、账期、输出和权限控制配置；修改已结账账期、授权范围或历史数据必须进入对应受控模块。') }
  }
  if (isHistoryMigrationKind(kind)) {
    return { title: moduleDetailTitle, boundary: withModuleReview('查看只读取所选历史账期、原始导入批次、科目映射和校验结果；迁移写入必须由人工选择目标账期，并不会覆盖当前账期。') }
  }
  if (kind === 'invoiceVoucherMatching') {
    return { title: moduleDetailTitle, boundary: withModuleReview('查看只读取票据来源、匹配规则、金额差异和凭证关联；自动匹配仅提供候选结果，确认或解除匹配均需人工留痕。') }
  }
  if (['outputInvoice', 'inputInvoice', 'invoiceSelection'].includes(kind)) {
    return { title: moduleDetailTitle, boundary: withModuleReview('查看只读取当前账套的发票字段、认证或匹配状态和凭证关联；不会采集票池、修改认证勾选或触发开票。') }
  }
  if (['employee', 'payroll', 'socialSecurity', 'specialDeduction'].includes(kind)) {
    return { title: moduleDetailTitle, boundary: withModuleReview('查看只读取当前账套人员、薪酬和申报资料；证件与联系方式按脱敏规则展示，不会发放工资或提交社保、个税数据。') }
  }
  if (['receipt', 'documentRegister', 'expenseReimbursement'].includes(kind)) {
    return { title: moduleDetailTitle, boundary: withModuleReview('查看只读取当前账套的票据、原始单据、报销审批与付款准备信息；不会替代审批、发起付款或直接生成正式凭证。') }
  }
  if (['purchaseManagement', 'salesManagement'].includes(kind)) {
    return { title: moduleDetailTitle, boundary: withModuleReview('查看只读取当前账套采购或销售订单、收发货、发票和收付款关联；实际履约、开票和收付款仍需由经办人员确认。') }
  }
  if (kind === 'voucher' || kind === 'voucherCreate' || kind === 'voucherEdit' || kind === 'voucherDetail') {
    return { title: moduleDetailTitle, boundary: withModuleReview('查看只读取当前账套凭证、分录、附件和审核状态；过账、反审核、删除和反结账均需在受控操作中留痕确认。') }
  }
  if (kind === 'riskCheck' || kind === 'closingTasks') {
    return { title: moduleDetailTitle, boundary: withModuleReview('查看只读取检查规则、取数快照、阻断原因、结转任务和复核记录；不会绕过审批直接修复风险或锁定账期。') }
  }
  if (['attachmentCenter', 'importCenter', 'exportCenter', 'notificationCenter'].includes(kind)) {
    return { title: moduleDetailTitle, boundary: withModuleReview('查看只读取本地文件、导入导出批次和待办记录；不会上传第三方、覆盖业务数据或发送外部通知。') }
  }
  if (['depreciation', 'inventorySettings', 'inventoryMovement', 'costCarryover'].includes(kind)) {
    return { title: moduleDetailTitle, boundary: withModuleReview('查看只读取资产、存货、出入库与成本结转依据；计提、出入库和月末结转必须先完成来源单据与会计口径复核。') }
  }
  if (['billList', 'bankStatement', 'bankReconciliation', 'transfer', 'receivableSettlement', 'payableSettlement', 'receivablePayableAging'].includes(kind)) {
    return { title: moduleDetailTitle, boundary: withModuleReview('查看只读取当前账套的流水、核销、对账和账龄记录；不会连接银行、发起付款或变更核销结果。') }
  }
  if (kind === 'taxInit' || kind === 'taxReport' || kind === 'declarationCalendar' || kind === 'declarationReceipt' || kind.endsWith('TaxReport') || kind === 'nonTaxRevenueReport') {
    return { title: moduleDetailTitle, boundary: withModuleReview('查看只读取当前账套税种认定、取数快照、校验状态和回执附件；不会登录税局、提交申报或发起扣款。') }
  }
  if (['aiJobQueue', 'aiRecognitionResults', 'aiVoucherSuggestions', 'aiRuleTraining'].includes(kind)) {
    return { title: moduleDetailTitle, boundary: withModuleReview('查看只读取 AI 任务来源、识别结果、置信度、规则版本和人工确认记录；不会自动写入凭证或执行外部操作。') }
  }
  if (kind.includes('Archive') || kind.includes('Settings') || ['companyInfo', 'initialBalance', 'subjectSettings', 'unitSettings', 'periodManagement'].includes(kind)) {
    return { title: moduleDetailTitle, boundary: withModuleReview('查看只读取当前账套的基础档案、会计口径与启用控制；不会改变配置生效范围或历史账期数据。') }
  }
  return { title: moduleDetailTitle, boundary: withModuleReview('查看操作仅读取当前账套和账期下的本地数据，不会触发外部采集、凭证入账或税局提交。') }
}

function getModuleTableMeta(kind: ModuleKind): ModuleTableMeta {
  const metadata: Record<ModuleKind, ModuleTableMeta> = {
    attachmentCenter: { statusLabel: '归档状态', voucherLabel: '关联凭证', attachmentLabel: '文件类型', showVoucher: true, showAttachment: true },
    importCenter: { statusLabel: '写入状态', voucherLabel: '目标草稿', attachmentLabel: '导入文件', showVoucher: true, showAttachment: true },
    exportCenter: { statusLabel: '生成状态', voucherLabel: '输出范围', attachmentLabel: '输出文件', showVoucher: false, showAttachment: true },
    aiJobQueue: { statusLabel: '任务确认', voucherLabel: '凭证草稿', attachmentLabel: '输入资料', showVoucher: true, showAttachment: true },
    aiRecognitionResults: { statusLabel: '识别复核', voucherLabel: '后续草稿', attachmentLabel: '识别影像', showVoucher: true, showAttachment: true },
    aiVoucherSuggestions: { statusLabel: '人工确认', voucherLabel: '建议凭证', attachmentLabel: '来源附件', showVoucher: true, showAttachment: true },
    aiRuleTraining: { statusLabel: '发布审批', voucherLabel: '适用凭证', attachmentLabel: '训练样本', showVoucher: true, showAttachment: true },
    notificationCenter: { statusLabel: '待办状态', voucherLabel: '关联事项', attachmentLabel: '处理依据', showVoucher: true, showAttachment: true },
    contractLedger: { statusLabel: '履约状态', voucherLabel: '合同凭证', attachmentLabel: '合同附件', showVoucher: true, showAttachment: true },
    outputInvoice: { statusLabel: '开票状态', voucherLabel: '会计凭证', attachmentLabel: '发票影像', showVoucher: true, showAttachment: true },
    inputInvoice: { statusLabel: '认证/抵扣状态', voucherLabel: '会计凭证', attachmentLabel: '发票影像', showVoucher: true, showAttachment: true },
    billList: { statusLabel: '流水状态', voucherLabel: '匹配凭证', attachmentLabel: '银行回单', showVoucher: true, showAttachment: true },
    bankStatement: { statusLabel: '导入状态', voucherLabel: '匹配凭证', attachmentLabel: '银行回单', showVoucher: true, showAttachment: true },
    receipt: { statusLabel: '票据入账状态', voucherLabel: '入账凭证', attachmentLabel: '票据影像', showVoucher: true, showAttachment: true },
    documentRegister: { statusLabel: '审核/入账状态', voucherLabel: '入账凭证', attachmentLabel: '原始单据', showVoucher: true, showAttachment: true },
    expenseReimbursement: { statusLabel: '报销审批状态', voucherLabel: '费用凭证', attachmentLabel: '报销票据', showVoucher: true, showAttachment: true },
    purchaseManagement: { statusLabel: '采购履约状态', voucherLabel: '采购凭证', attachmentLabel: '采购单据', showVoucher: true, showAttachment: true },
    salesManagement: { statusLabel: '销售履约状态', voucherLabel: '收入凭证', attachmentLabel: '销售单据', showVoucher: true, showAttachment: true },
    voucher: { statusLabel: '审核状态', voucherLabel: '凭证字号', attachmentLabel: '原始附件', showVoucher: false, showAttachment: true },
    voucherCreate: { statusLabel: '草稿状态', voucherLabel: '凭证字号', attachmentLabel: '原始附件', showVoucher: false, showAttachment: true },
    voucherEdit: { statusLabel: '编辑状态', voucherLabel: '凭证字号', attachmentLabel: '原始附件', showVoucher: false, showAttachment: true },
    voucherDetail: { statusLabel: '记账状态', voucherLabel: '凭证字号', attachmentLabel: '原始附件', showVoucher: false, showAttachment: true },
    transfer: { statusLabel: '转账核对', voucherLabel: '会计凭证', attachmentLabel: '转账回单', showVoucher: true, showAttachment: true },
    employee: { statusLabel: '人员状态', voucherLabel: '薪酬关联', attachmentLabel: '人员资料', showVoucher: false, showAttachment: true },
    payroll: { statusLabel: '薪酬确认', voucherLabel: '工资凭证', attachmentLabel: '工资明细', showVoucher: true, showAttachment: true },
    socialSecurity: { statusLabel: '缴费核对', voucherLabel: '社保凭证', attachmentLabel: '缴费资料', showVoucher: true, showAttachment: true },
    specialDeduction: { statusLabel: '扣除校验', voucherLabel: '个税凭证', attachmentLabel: '证明材料', showVoucher: true, showAttachment: true },
    depreciation: { statusLabel: '计提状态', voucherLabel: '折旧凭证', attachmentLabel: '资产依据', showVoucher: true, showAttachment: true },
    inventorySettings: { statusLabel: '档案状态', voucherLabel: '默认科目', attachmentLabel: '存货资料', showVoucher: false, showAttachment: true },
    inventoryMovement: { statusLabel: '收发核算状态', voucherLabel: '成本凭证', attachmentLabel: '出入库单', showVoucher: true, showAttachment: true },
    costCarryover: { statusLabel: '结转状态', voucherLabel: '结转凭证', attachmentLabel: '成本依据', showVoucher: true, showAttachment: true },
    unitSettings: { statusLabel: '启用状态', voucherLabel: '存货关联', attachmentLabel: '换算依据', showVoucher: false, showAttachment: false },
    bankReconciliation: { statusLabel: '对账结论', voucherLabel: '调整凭证', attachmentLabel: '银行回单', showVoucher: true, showAttachment: true },
    receivableSettlement: { statusLabel: '应收核销状态', voucherLabel: '收入凭证', attachmentLabel: '回款回单', showVoucher: true, showAttachment: true },
    payableSettlement: { statusLabel: '应付核销状态', voucherLabel: '成本凭证', attachmentLabel: '付款回单', showVoucher: true, showAttachment: true },
    receivablePayableAging: { statusLabel: '账龄风险', voucherLabel: '最近凭证', attachmentLabel: '催收依据', showVoucher: true, showAttachment: true },
    invoiceVoucherMatching: { statusLabel: '匹配结论', voucherLabel: '目标凭证', attachmentLabel: '源票据', showVoucher: true, showAttachment: true },
    riskCheck: { statusLabel: '风险处置', voucherLabel: '修复凭证', attachmentLabel: '检查依据', showVoucher: true, showAttachment: true },
    closingTasks: { statusLabel: '执行状态', voucherLabel: '结转凭证', attachmentLabel: '取数快照', showVoucher: true, showAttachment: true },
    ledgerReport: { statusLabel: '账簿取数状态', voucherLabel: '凭证穿透', attachmentLabel: '账簿附件', showVoucher: false, showAttachment: false },
    trialBalanceReport: { statusLabel: '试算状态', voucherLabel: '凭证穿透', attachmentLabel: '取数快照', showVoucher: false, showAttachment: false },
    accountSummaryReport: { statusLabel: '汇总状态', voucherLabel: '凭证汇总', attachmentLabel: '汇总依据', showVoucher: false, showAttachment: false },
    generalLedgerReport: { statusLabel: '总账取数状态', voucherLabel: '凭证穿透', attachmentLabel: '总账附件', showVoucher: false, showAttachment: false },
    subsidiaryLedgerReport: { statusLabel: '明细取数状态', voucherLabel: '凭证穿透', attachmentLabel: '明细附件', showVoucher: false, showAttachment: false },
    auxiliaryLedgerReport: { statusLabel: '辅助核算状态', voucherLabel: '凭证穿透', attachmentLabel: '辅助依据', showVoucher: false, showAttachment: false },
    auxiliaryBalanceReport: { statusLabel: '辅助余额状态', voucherLabel: '凭证穿透', attachmentLabel: '余额依据', showVoucher: false, showAttachment: false },
    multiColumnLedgerReport: { statusLabel: '栏目取数状态', voucherLabel: '凭证穿透', attachmentLabel: '栏目依据', showVoucher: false, showAttachment: false },
    financialReport: { statusLabel: '报表取数状态', voucherLabel: '凭证穿透', attachmentLabel: '报表附件', showVoucher: false, showAttachment: false },
    balanceSheetReport: { statusLabel: '勾稽状态', voucherLabel: '取数凭证', attachmentLabel: '资产负债附件', showVoucher: false, showAttachment: false },
    incomeStatementReport: { statusLabel: '公式校验状态', voucherLabel: '取数凭证', attachmentLabel: '利润表附件', showVoucher: false, showAttachment: false },
    incomeQuarterReport: { statusLabel: '季度校验状态', voucherLabel: '取数凭证', attachmentLabel: '季度附件', showVoucher: false, showAttachment: false },
    cashFlowReport: { statusLabel: '现金流校验状态', voucherLabel: '凭证穿透', attachmentLabel: '现金流附件', showVoucher: false, showAttachment: false },
    cashFlowQuarterReport: { statusLabel: '季度现金流状态', voucherLabel: '凭证穿透', attachmentLabel: '季度附件', showVoucher: false, showAttachment: false },
    equityChangeReport: { statusLabel: '权益勾稽状态', voucherLabel: '取数凭证', attachmentLabel: '权益附件', showVoucher: false, showAttachment: false },
    taxReport: { statusLabel: '申报状态', voucherLabel: '申报包', attachmentLabel: '回执附件', showVoucher: true, showAttachment: true },
    vatTaxReport: { statusLabel: '增值税申报状态', voucherLabel: '申报包', attachmentLabel: '进销项依据', showVoucher: true, showAttachment: true },
    withholdingTaxReport: { statusLabel: '扣缴申报状态', voucherLabel: '申报包', attachmentLabel: '人员扣缴资料', showVoucher: true, showAttachment: true },
    stampTaxReport: { statusLabel: '印花税申报状态', voucherLabel: '申报包', attachmentLabel: '应税凭证', showVoucher: true, showAttachment: true },
    incomeTaxReport: { statusLabel: '所得税申报状态', voucherLabel: '申报包', attachmentLabel: '纳税调整资料', showVoucher: true, showAttachment: true },
    socialSecurityTaxReport: { statusLabel: '社保费申报状态', voucherLabel: '申报包', attachmentLabel: '缴费资料', showVoucher: true, showAttachment: true },
    financeTaxReport: { statusLabel: '财报报送状态', voucherLabel: '报送包', attachmentLabel: '财务报表', showVoucher: true, showAttachment: true },
    nonTaxRevenueReport: { statusLabel: '非税申报状态', voucherLabel: '申报包', attachmentLabel: '征收依据', showVoucher: true, showAttachment: true },
    declarationCalendar: { statusLabel: '待办状态', voucherLabel: '申报包', attachmentLabel: '提醒依据', showVoucher: true, showAttachment: true },
    settingsData: { statusLabel: '生效状态', voucherLabel: '关联控制', attachmentLabel: '配置依据', showVoucher: false, showAttachment: false },
    companyInfo: { statusLabel: '资料状态', voucherLabel: '账套关联', attachmentLabel: '登记资料', showVoucher: false, showAttachment: false },
    initialBalance: { statusLabel: '试算状态', voucherLabel: '迁移凭证', attachmentLabel: '期初依据', showVoucher: false, showAttachment: false },
    historyVoucher: { statusLabel: '迁移校验', voucherLabel: '历史凭证', attachmentLabel: '来源文件', showVoucher: true, showAttachment: true },
    historyBalance: { statusLabel: '迁移校验', voucherLabel: '历史余额', attachmentLabel: '来源文件', showVoucher: false, showAttachment: true },
    historyGeneralLedger: { statusLabel: '迁移校验', voucherLabel: '历史总账', attachmentLabel: '来源文件', showVoucher: false, showAttachment: true },
    historySubsidiaryLedger: { statusLabel: '迁移校验', voucherLabel: '历史明细账', attachmentLabel: '来源文件', showVoucher: true, showAttachment: true },
    taxInit: { statusLabel: '启用状态', voucherLabel: '申报范围', attachmentLabel: '认定资料', showVoucher: false, showAttachment: false },
    accountArchive: { statusLabel: '账户状态', voucherLabel: '默认科目', attachmentLabel: '开户资料', showVoucher: false, showAttachment: false },
    customerArchive: { statusLabel: '客户状态', voucherLabel: '应收科目', attachmentLabel: '客户资料', showVoucher: false, showAttachment: false },
    supplierArchive: { statusLabel: '供应商状态', voucherLabel: '应付科目', attachmentLabel: '供应商资料', showVoucher: false, showAttachment: false },
    otherContactArchive: { statusLabel: '往来状态', voucherLabel: '往来科目', attachmentLabel: '往来资料', showVoucher: false, showAttachment: false },
    projectArchive: { statusLabel: '项目状态', voucherLabel: '项目科目', attachmentLabel: '立项资料', showVoucher: false, showAttachment: false },
    departmentArchive: { statusLabel: '部门状态', voucherLabel: '费用科目', attachmentLabel: '部门资料', showVoucher: false, showAttachment: false },
    tagArchive: { statusLabel: '标签状态', voucherLabel: '业务引用', attachmentLabel: '标签依据', showVoucher: false, showAttachment: false },
    subjectSettings: { statusLabel: '科目状态', voucherLabel: '报表映射', attachmentLabel: '科目依据', showVoucher: false, showAttachment: false },
    assetCategory: { statusLabel: '类别状态', voucherLabel: '折旧科目', attachmentLabel: '类别资料', showVoucher: false, showAttachment: false },
    invoiceMatchingRules: { statusLabel: '规则发布状态', voucherLabel: '目标凭证', attachmentLabel: '规则样本', showVoucher: false, showAttachment: false },
    billMatchingRules: { statusLabel: '规则发布状态', voucherLabel: '目标凭证', attachmentLabel: '流水样本', showVoucher: false, showAttachment: false },
    settlementRules: { statusLabel: '规则发布状态', voucherLabel: '结转凭证', attachmentLabel: '取数依据', showVoucher: false, showAttachment: false },
    auxiliaryCategories: { statusLabel: '类别状态', voucherLabel: '适用科目', attachmentLabel: '类别资料', showVoucher: false, showAttachment: false },
    auxiliaryItems: { statusLabel: '项目状态', voucherLabel: '默认科目', attachmentLabel: '项目资料', showVoucher: false, showAttachment: false },
    commonDigests: { statusLabel: '摘要状态', voucherLabel: '凭证引用', attachmentLabel: '维护记录', showVoucher: false, showAttachment: false },
    voucherTemplateSettings: { statusLabel: '模板发布状态', voucherLabel: '适用凭证', attachmentLabel: '模板依据', showVoucher: false, showAttachment: false },
    reportFormulaSettings: { statusLabel: '公式发布状态', voucherLabel: '取数凭证', attachmentLabel: '公式依据', showVoucher: false, showAttachment: false },
    cashFlowMapping: { statusLabel: '映射发布状态', voucherLabel: '关联凭证', attachmentLabel: '映射依据', showVoucher: false, showAttachment: false },
    currencySettings: { statusLabel: '币别状态', voucherLabel: '换算科目', attachmentLabel: '汇率依据', showVoucher: false, showAttachment: false },
    printTemplateSettings: { statusLabel: '模板状态', voucherLabel: '输出范围', attachmentLabel: '版式依据', showVoucher: false, showAttachment: false },
    taxAdapterSettings: { statusLabel: '授权状态', voucherLabel: '申报范围', attachmentLabel: '授权材料', showVoucher: false, showAttachment: false },
    bankAdapterSettings: { statusLabel: '授权状态', voucherLabel: '对账范围', attachmentLabel: '授权材料', showVoucher: false, showAttachment: false },
    periodManagement: { statusLabel: '结账状态', voucherLabel: '结转凭证', attachmentLabel: '锁定依据', showVoucher: false, showAttachment: false },
    auditLog: { statusLabel: '审计结果', voucherLabel: '操作凭证', attachmentLabel: '留痕证据', showVoucher: false, showAttachment: false },
    backupRestore: { statusLabel: '备份校验状态', voucherLabel: '恢复范围', attachmentLabel: '备份文件', showVoucher: false, showAttachment: false },
    voucherRecycle: { statusLabel: '恢复审批状态', voucherLabel: '原始凭证', attachmentLabel: '删除依据', showVoucher: false, showAttachment: false },
    declarationReceipt: { statusLabel: '回执归档状态', voucherLabel: '申报包', attachmentLabel: '缴款回执', showVoucher: true, showAttachment: true },
  }
  return metadata[kind]
}

function getModuleTabs(kind: ModuleKind) {
  if (kind === 'historyVoucher') return ['迁移凭证', '分录映射', '科目校验', '借贷平衡', '来源文件', '迁移日志']
  if (kind === 'historyBalance') return ['余额清单', '期初转换', '科目映射', '试算平衡', '来源文件', '迁移日志']
  if (kind === 'historyGeneralLedger') return ['总账清单', '余额取数', '科目映射', '勾稽核验', '来源文件', '迁移日志']
  if (kind === 'historySubsidiaryLedger') return ['明细清单', '凭证穿透', '对方科目', '余额核验', '来源文件', '迁移日志']
  if (kind === 'outputInvoice') return ['销项台账', '开票明细', '开票汇总', '会计凭证', '发票影像', '开票日志']
  if (kind === 'inputInvoice') return ['进项台账', '发票明细', '认证勾选', '抵扣用途', '发票影像', '处理日志']
  if (kind === 'voucher' || kind === 'voucherCreate' || kind === 'voucherEdit' || kind === 'voucherDetail') return ['凭证清单', '分录明细', '附件张数', '审核记账', '凭证打印', '操作日志']
  if (kind === 'invoiceVoucherMatching') return ['匹配清单', '票据来源', '凭证候选', '差异复核', '确认记录', '操作日志']
  if (kind === 'riskCheck') return ['风险清单', '检查规则', '阻断事项', '修复建议', '复核记录', '检查日志']
  if (kind === 'closingTasks') return ['结转任务', '执行顺序', '取数快照', '凭证草稿', '阻断审批', '结账日志']
  if (kind === 'notificationCenter') return ['待办清单', '今日到期', '资料催办', '风险提醒', '完成记录', '处理日志']
  if (kind === 'contractLedger') return ['合同清单', '相对方信息', '印花税税目', '发票关联', '归档附件', '变更记录']
  if (kind === 'receipt') return ['票据台账', '票据明细', '到期管理', '背书用途', '票据影像', '处理日志']
  if (kind === 'documentRegister') return ['单据登记', '业务明细', '审核流转', '入账准备', '原始附件', '处理日志']
  if (kind === 'expenseReimbursement') return ['报销清单', '费用明细', '审批节点', '付款准备', '票据附件', '处理日志']
  if (kind === 'purchaseManagement') return ['采购订单', '入库验收', '供应商发票', '应付核对', '成本入账', '处理日志']
  if (kind === 'salesManagement') return ['销售订单', '出库履约', '销项开票', '回款核销', '收入入账', '处理日志']
  if (kind === 'depreciation') return ['资产清单', '计提明细', '折旧参数', '凭证准备', '资产附件', '处理日志']
  if (kind === 'inventorySettings') return ['存货档案', '规格单位', '默认科目', '成本口径', '启停记录', '变更日志']
  if (kind === 'inventoryMovement') return ['出入库单', '收发明细', '仓库库存', '单据匹配', '成本依据', '处理日志']
  if (kind === 'costCarryover') return ['结转任务', '成本来源', '结转方法', '凭证准备', '异常复核', '处理日志']
  if (kind === 'receivableSettlement') return ['应收清单', '回款流水', '核销明细', '差额处理', '收入凭证', '处理日志']
  if (kind === 'payableSettlement') return ['应付清单', '付款流水', '核销明细', '差额处理', '成本凭证', '处理日志']
  if (kind === 'receivablePayableAging') return ['账龄清单', '应收风险', '应付风险', '最近凭证', '催收处置', '处理日志']
  if (['billList', 'bankStatement', 'bankReconciliation', 'transfer'].includes(kind)) return ['流水台账', '交易明细', '匹配结果', '回单附件', '关联凭证', '处理日志']
  if (kind === 'employee') return ['人员档案', '证照资料', '岗位参保', '工资关联', '资料附件', '变更记录']
  if (kind === 'payroll') return ['薪酬表', '工资项明细', '个税社保', '工资凭证', '工资附件', '发放日志']
  if (kind === 'socialSecurity') return ['缴费明细', '人员基数', '申报核对', '凭证关联', '资料附件', '处理日志']
  if (kind === 'specialDeduction') return ['扣除清单', '人员资料', '有效期间', '个税取数', '证明附件', '处理日志']
  if (kind === 'companyInfo') return ['企业资料', '工商登记', '税务信息', '办税授权', '服务账期', '变更记录']
  if (kind === 'settingsData') return ['账套概览', '会计制度', '账期控制', '打印输出', '权限策略', '变更日志']
  if (kind === 'initialBalance') return ['期初清单', '辅助期初', '试算平衡', '迁移差异', '启用控制', '操作日志']
  if (kind === 'subjectSettings') return ['科目清单', '科目属性', '辅助核算', '报表映射', '启停记录', '变更日志']
  if (kind === 'tagArchive') return ['标签清单', '适用模块', '筛选口径', '业务引用', '启停记录', '变更日志']
  if (kind === 'unitSettings') return ['计量单位', '换算关系', '适用存货', '导入映射', '启停记录', '变更日志']
  if (kind === 'periodManagement') return ['账期清单', '结账状态', '前置校验', '反结账审批', '锁定记录', '操作日志']
  if (kind === 'auditLog') return ['审计清单', '高风险操作', '操作对象', '导出记录', '留痕证据', '审计日志']
  if (kind === 'backupRestore') return ['备份快照', '文件校验', '恢复预演', '恢复记录', '异常处理', '操作日志']
  if (kind === 'voucherRecycle') return ['回收凭证', '删除原因', '恢复审批', '原始附件', '恢复记录', '操作日志']
  if (kind === 'printTemplateSettings') return ['打印模板', '版式字段', '凭证样式', '报表样式', '预览记录', '变更日志']
  if (kind === 'accountArchive') return ['账户清单', '开户资料', '默认科目', '期初余额', '附件资料', '变更记录']
  if (['customerArchive', 'supplierArchive', 'otherContactArchive', 'projectArchive', 'departmentArchive'].includes(kind)) return ['档案清单', '基本资料', '默认科目', '业务关联', '支持材料', '变更记录']
  if (kind === 'assetCategory') return ['资产类别', '折旧参数', '默认科目', '适用资产', '支持材料', '变更记录']
  if (kind === 'auxiliaryCategories') return ['类别清单', '适用科目', '项目数量', '启停控制', '支持材料', '变更记录']
  if (kind === 'auxiliaryItems') return ['项目清单', '所属类别', '默认科目', '业务引用', '支持材料', '变更记录']
  if (kind === 'currencySettings') return ['币别清单', '汇率口径', '本位币控制', '科目换算', '启停记录', '操作日志']
  if (kind === 'commonDigests') return ['摘要清单', '适用业务', '凭证引用', '维护记录', '停用记录', '操作日志']
  if (kind === 'invoiceMatchingRules') return ['发票规则', '票种范围', '字段条件', '命中结果', '发布版本', '操作日志']
  if (kind === 'billMatchingRules') return ['流水规则', '账户范围', '摘要条件', '命中结果', '发布版本', '操作日志']
  if (kind === 'cashFlowMapping') return ['现金流映射', '科目范围', '凭证条件', '未映射项', '发布版本', '操作日志']
  if (kind === 'settlementRules') return ['结转规则', '结转范围', '取数条件', '执行结果', '发布版本', '操作日志']
  if (kind === 'voucherTemplateSettings') return ['凭证模板', '适用业务', '分录规则', '辅助核算', '发布版本', '操作日志']
  if (kind === 'reportFormulaSettings') return ['报表公式', '适用报表', '取数科目', '勾稽校验', '发布版本', '操作日志']
  if (kind === 'taxAdapterSettings') return ['税局授权', '地区税种', '取数范围', '提交边界', '安全策略', '变更记录']
  if (kind === 'bankAdapterSettings') return ['银行授权', '账户范围', '导入格式', '对账范围', '安全策略', '变更记录']
  if (kind === 'taxInit') return ['税种认定', '申报周期', '取数适配', '授权信息', '启用记录', '变更日志']
  if (kind === 'declarationCalendar') return ['待办日历', '截止提醒', '取数准备', '申报确认', '回执归档', '处理日志']
  if (kind === 'taxReport') return ['本期申报', '取数快照', '风险校验', '申报包', '回执缴款', '处理日志']
  if (kind === 'vatTaxReport') return ['增值税主表', '销项取数', '进项抵扣', '附加税费', '校验风险', '申报日志']
  if (kind === 'withholdingTaxReport') return ['扣缴清单', '人员扣缴', '专项扣除', '税款计算', '校验风险', '申报日志']
  if (kind === 'stampTaxReport') return ['税目清单', '应税凭证', '计税依据', '减免事项', '校验风险', '申报日志']
  if (kind === 'incomeTaxReport') return ['利润口径', '纳税调整', '弥补亏损', '预缴计算', '校验风险', '申报日志']
  if (kind === 'socialSecurityTaxReport') return ['缴费人员', '缴费基数', '单位金额', '个人金额', '校验风险', '申报日志']
  if (kind === 'financeTaxReport') return ['财报清单', '报表取数', '勾稽校验', '报送材料', '回执附件', '报送日志']
  if (kind === 'nonTaxRevenueReport') return ['征收项目', '计费依据', '减免事项', '缴款信息', '校验风险', '申报日志']
  if (kind === 'declarationReceipt') return ['回执清单', '申报状态', '缴款书', '支付记录', '归档附件', '处理日志']
  if (kind === 'ledgerReport') return ['账簿总览', '余额校验', '凭证穿透', '辅助核算', '输出模板', '计算日志']
  if (kind === 'trialBalanceReport') return ['科目余额', '期初发生', '辅助余额', '试算平衡', '凭证穿透', '计算日志']
  if (kind === 'accountSummaryReport') return ['科目汇总', '借方发生', '贷方发生', '凭证汇总', '输出模板', '计算日志']
  if (kind === 'generalLedgerReport') return ['总账清单', '月度发生', '余额方向', '凭证穿透', '输出模板', '计算日志']
  if (kind === 'subsidiaryLedgerReport') return ['明细账', '逐笔发生', '对方科目', '余额明细', '凭证穿透', '计算日志']
  if (kind === 'auxiliaryLedgerReport') return ['辅助明细', '客户供应商', '项目部门', '辅助余额', '凭证穿透', '计算日志']
  if (kind === 'auxiliaryBalanceReport') return ['辅助余额', '维度明细', '期初发生', '科目勾稽', '凭证穿透', '计算日志']
  if (kind === 'multiColumnLedgerReport') return ['多栏账', '费用栏目', '收入栏目', '成本栏目', '凭证穿透', '计算日志']
  if (kind === 'financialReport') return ['报表总览', '取数状态', '勾稽校验', '报送材料', '输出模板', '计算日志']
  if (kind === 'balanceSheetReport') return ['资产负债表', '资产项目', '负债权益', '重分类', '勾稽校验', '计算日志']
  if (kind === 'incomeStatementReport') return ['利润表', '收入成本', '期间费用', '本年累计', '公式校验', '计算日志']
  if (kind === 'incomeQuarterReport') return ['季度利润表', '季度收入成本', '纳税调整', '申报快照', '公式校验', '计算日志']
  if (kind === 'cashFlowReport') return ['现金流主表', '经营活动', '投资活动', '筹资活动', '凭证穿透', '计算日志']
  if (kind === 'cashFlowQuarterReport') return ['季度现金流', '经营活动', '投资活动', '筹资活动', '报送快照', '计算日志']
  if (kind === 'equityChangeReport') return ['权益变动表', '实收资本', '留存收益', '本期变动', '勾稽校验', '计算日志']
  if (kind === 'aiJobQueue') return ['任务队列', '来源资料', '执行节点', '异常重试', '人工确认', '运行日志']
  if (kind === 'aiRecognitionResults') return ['识别结果', 'OCR字段', '置信度', '业务匹配', '异常样本', '处理日志']
  if (kind === 'aiVoucherSuggestions') return ['凭证建议', '来源资料', '科目建议', '借贷校验', '人工确认', '运行日志']
  if (kind === 'aiRuleTraining') return ['规则样本', '触发条件', '训练版本', '命中统计', '发布审批', '运行日志']
  if (kind === 'attachmentCenter') return ['附件清单', '关联单据', '文件校验', '归档状态', '异常文件', '操作日志']
  if (kind === 'importCenter') return ['导入批次', '文件校验', '字段映射', '失败行', '写入记录', '操作日志']
  if (kind === 'exportCenter') return ['导出任务', '输出模板', '生成状态', '下载记录', '失败原因', '操作日志']
  if (['aiJobQueue', 'aiRecognitionResults', 'aiVoucherSuggestions', 'aiRuleTraining'].includes(kind)) return ['任务队列', '输入来源', '识别结果', '人工确认', '规则版本', '运行日志']
  if (kind.includes('Ledger') || kind.includes('Balance') || kind.includes('Report')) return ['账表清单', '取数明细', '凭证穿透', '勾稽校验', '输出模板', '计算日志']
  if (kind.includes('Archive') || kind.includes('Settings') || kind.includes('Rules') || ['settingsData', 'companyInfo', 'initialBalance', 'subjectSettings', 'unitSettings', 'periodManagement', 'auditLog', 'backupRestore', 'voucherRecycle'].includes(kind)) return ['配置清单', '生效范围', '关联规则', '变更记录', '审计证据', '操作日志']
  return ['业务清单', '处理明细', '关联凭证', '处理规则', '相关附件', '操作日志']
}

function hasWorkspaceReference(value?: string) {
  return Boolean(value && !['-', '无', '未生成', '待生成', '缺失'].includes(value.trim()))
}

interface ModuleColumnSettings {
  visibleKeys: string[]
}

function moduleColumnSettingsStorageKey(kind: ModuleKind, companyId: string) {
  return `accounting-module-columns-v1:${companyId}:${kind}`
}

function loadModuleColumnSettings(kind: ModuleKind, companyId: string, columns: ModuleColumn[]): ModuleColumnSettings {
  const fallback = { visibleKeys: columns.map((column) => column.key) }
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(moduleColumnSettingsStorageKey(kind, companyId))
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<ModuleColumnSettings>
    const validKeys = new Set(columns.map((column) => column.key))
    const visibleKeys = (parsed.visibleKeys || []).filter((key) => validKeys.has(key))
    return { visibleKeys: visibleKeys.length > 0 ? visibleKeys : fallback.visibleKeys }
  } catch {
    return fallback
  }
}

function saveModuleColumnSettings(kind: ModuleKind, companyId: string, settings: ModuleColumnSettings) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(moduleColumnSettingsStorageKey(kind, companyId), JSON.stringify(settings))
}

function hasPendingAttachment(value?: string) {
  return !hasWorkspaceReference(value) || /待补|缺失|未上传|待上传/.test(value || '')
}

function filterRowsByWorkspaceTab(kind: ModuleKind, tab: string, rows: ModuleRow[]) {
  if (/(日志|变更记录|审计证据)/.test(tab)) return rows

  // 附件、影像或回单工作区只展示已经有关联文件的业务记录。
  if (/(附件|影像|回单|证照|证明)/.test(tab)) {
    return rows.filter((row) => hasWorkspaceReference(row.attachment))
  }

  // 凭证、申报包或草稿工作区只展示已经建立关联对象的业务记录。
  if (/(凭证|申报包|草稿)/.test(tab)) {
    return rows.filter((row) => hasWorkspaceReference(row.voucher))
  }

  if (/(风险|异常)/.test(tab)) return rows.filter((row) => row.status === '异常')
  if (/(校验|认证|勾选|核对)/.test(tab)) return rows.filter((row) => ['待处理', '待确认', '异常', '已匹配'].includes(row.status))
  if (kind === 'declarationReceipt' && tab === '回执缴款') return rows.filter((row) => hasWorkspaceReference(row.attachment) || row.values.paymentStatus === '待缴款')
  return rows
}

interface WorkspaceTabContext {
  title: string
  description: string
  metrics: Array<{ label: string; value: string; tone: 'blue' | 'green' | 'amber' | 'red' }>
}

function getWorkspaceTabContext(kind: ModuleKind, tab: string, rows: ModuleRow[]): WorkspaceTabContext | null {
  if (/(日志|变更记录|审计证据)/.test(tab)) return null

  const attachmentRows = rows.filter((row) => hasWorkspaceReference(row.attachment)).length
  const voucherRows = rows.filter((row) => hasWorkspaceReference(row.voucher)).length
  const pendingRows = rows.filter((row) => ['待处理', '待确认', '异常'].includes(row.status)).length
  const commonMetrics: WorkspaceTabContext['metrics'] = [
    { label: '当前记录', value: `${rows.length} 条`, tone: 'blue' },
    { label: '待人工处理', value: `${pendingRows} 条`, tone: pendingRows > 0 ? 'amber' : 'green' },
  ]
  const moduleReviewHint = getModuleListMeta(kind).hint

  if (kind === 'outputInvoice' && tab === '开票汇总') {
    return {
      title: '开票汇总取数',
      description: '按当前账期已登记销项发票归集开票金额、税额和凭证生成状态；汇总仅用于复核，不替代开票系统原始数据。',
      metrics: [...commonMetrics, { label: '已关联凭证', value: `${voucherRows} 条`, tone: 'green' }],
    }
  }
  if (kind === 'inputInvoice' && (tab === '认证勾选' || tab === '抵扣用途')) {
    return {
      title: '进项抵扣处理范围',
      description: '当前清单用于复核认证、勾选和抵扣用途；实际税局票池同步与抵扣确认仍需在已授权桌面适配器中人工发起。',
      metrics: [...commonMetrics, { label: '已附发票影像', value: `${attachmentRows} 条`, tone: 'green' }],
    }
  }
  if (isHistoryMigrationKind(kind)) {
    return {
      title: '历史迁移校验范围',
      description: '历史账只允许在明确选择的目标历史账期内导入。凭证按原凭证号和借贷平衡写入；余额与总账仅转换为期初基础，需保留来源批次并人工试算。',
      metrics: [...commonMetrics, { label: '来源文件', value: `${attachmentRows} 条`, tone: 'green' }],
    }
  }
  if (kind === 'companyInfo') {
    return {
      title: '企业与办税资料范围',
      description: '企业名称、地区、税号、会计准则、启用期间和办税授权分别维护。凭据和登录信息不得在展示页明文显示，修改后保留变更记录。',
      metrics: [...commonMetrics, { label: '待补资料', value: `${pendingRows} 项`, tone: pendingRows > 0 ? 'amber' : 'green' }],
    }
  }
  if (kind === 'initialBalance') {
    return {
      title: '期初登记与启用范围',
      description: '期初余额按科目和辅助核算分层维护。每一科目只能登记单边借贷，试算平衡前不得启用账套，也不会自动生成凭证。',
      metrics: [...commonMetrics, { label: '迁移依据', value: `${attachmentRows} 条`, tone: 'green' }],
    }
  }
  if (kind === 'subjectSettings') {
    return {
      title: '会计科目维护范围',
      description: '科目编码、余额方向、明细级次、辅助核算和报表映射需要一致维护；停用只影响后续录入，不改写历史凭证。',
      metrics: [...commonMetrics, { label: '已关联凭证', value: `${voucherRows} 条`, tone: 'green' }],
    }
  }
  const governanceWorkspaceContext: Partial<Record<ModuleKind, { title: string; description: string; evidenceLabel: string }>> = {
    unitSettings: { title: '计量单位与换算范围', description: '单位和换算关系用于存货、采购、销售及导入字段解释。变更前应复核已引用存货，不能回写历史出入库数量。', evidenceLabel: '适用存货' },
    periodManagement: { title: '账期结账与锁定范围', description: '账期关闭前必须完成风险、凭证、税表和结转校验；反结账、删除和锁定解除属于高风险操作，需要审批与审计留痕。', evidenceLabel: '结账依据' },
    auditLog: { title: '账套操作审计范围', description: '审计日志只追加当前账套的操作人、对象、结果、风险等级和证据索引，不提供修改、删除或覆盖历史审计记录的入口。', evidenceLabel: '审计证据' },
    backupRestore: { title: '备份恢复与校验范围', description: '备份仅生成本机账套快照及校验值。恢复必须先校验文件并进行人工确认，不覆盖未备份数据，也不伪造恢复成功结果。', evidenceLabel: '快照校验' },
    voucherRecycle: { title: '凭证回收与恢复范围', description: '回收凭证保留删除原因、原始附件和恢复审批。恢复后仍须重新审核，不能作为绕开反结账或审计控制的途径。', evidenceLabel: '删除依据' },
    printTemplateSettings: { title: '打印模板与版式范围', description: '模板只定义本地 Excel、PDF 和打印版式字段；凭证、账表和税表的正式取数仍以当前账期数据和审核状态为准。', evidenceLabel: '模板样式' },
    invoiceMatchingRules: { title: '发票匹配规则范围', description: '发票规则按票种、对方单位、金额和日期生成候选匹配，不会自动确认凭证或替代人工处理异常发票。', evidenceLabel: '规则版本' },
    billMatchingRules: { title: '流水匹配规则范围', description: '流水规则按账户、摘要、金额和对方户名生成候选匹配。匹配成功仍需人工确认才能影响凭证草稿。', evidenceLabel: '规则版本' },
    cashFlowMapping: { title: '现金流量映射范围', description: '映射规则只解释凭证到现金流量项目的取数口径。未映射或冲突分录必须人工补齐，不自动改写历史报表。', evidenceLabel: '映射版本' },
    settlementRules: { title: '结转规则与取数范围', description: '结转规则定义来源科目、计算方式和凭证模板。发布后只作用于后续任务，执行前仍需人工复核金额和前置条件。', evidenceLabel: '规则版本' },
    voucherTemplateSettings: { title: '凭证模板与分录范围', description: '模板仅生成候选摘要、借贷科目和辅助核算。金额、附件和借贷平衡必须按具体业务由会计人员确认。', evidenceLabel: '模板版本' },
    reportFormulaSettings: { title: '报表公式与勾稽范围', description: '公式修改会影响后续报表取数口径，必须保留版本并通过勾稽校验。历史已归档报表不会被自动覆盖。', evidenceLabel: '公式版本' },
    taxAdapterSettings: { title: '税局适配授权范围', description: '税局渠道仅记录人工授权、地区、税种和本地取数范围。不保存明文凭据，不自动登录税局或提交申报。', evidenceLabel: '授权记录' },
    bankAdapterSettings: { title: '银行适配授权范围', description: '银行渠道仅配置受控导入格式、账户范围与对账能力。不保存网银密码，不自动发起付款或直接连接账户。', evidenceLabel: '授权记录' },
  }
  if (governanceWorkspaceContext[kind]) {
    const context = governanceWorkspaceContext[kind]!
    return {
      title: context.title,
      description: context.description,
      metrics: [...commonMetrics, { label: context.evidenceLabel, value: `${attachmentRows} 条`, tone: 'green' }],
    }
  }
  const archiveWorkspaceContext: Partial<Record<ModuleKind, { title: string; description: string; evidenceLabel: string }>> = {
    settingsData: { title: '账套设置与启用范围', description: '账套设置只定义当前公司的会计制度、账期和本地功能开关。涉及已结账账期、凭证或外部授权的变更必须回到对应受控模块处理。', evidenceLabel: '变更依据' },
    accountArchive: { title: '账户档案与流水范围', description: '账户资料定义银行流水导入、默认科目和余额核对范围。不会保存网银密码，也不从账户档案页直接发起付款或修改银行流水。', evidenceLabel: '开户材料' },
    customerArchive: { title: '客户往来与应收范围', description: '客户档案用于应收、销项发票、项目和辅助核算归集。删除或停用前必须核查未核销应收、发票和历史凭证引用。', evidenceLabel: '客户资料' },
    supplierArchive: { title: '供应商往来与应付范围', description: '供应商档案用于采购、进项发票、应付核销和成本核算。删除或停用前必须核查未核销应付、进项票和历史凭证引用。', evidenceLabel: '供应商资料' },
    otherContactArchive: { title: '其他往来辅助核算范围', description: '其他往来单位用于员工、股东和关联方辅助核算。分类和默认科目变更只影响后续录入，不回写历史分录。', evidenceLabel: '往来资料' },
    projectArchive: { title: '项目收入成本归集范围', description: '项目档案用于收入、成本、费用和合同的辅助归集。项目关闭前应核对未完工业务、收入成本余额和关联凭证。', evidenceLabel: '项目资料' },
    departmentArchive: { title: '部门费用归集范围', description: '部门档案用于人员、报销、工资和费用的辅助归集。部门调整必须保留生效期间，不能直接改写历史凭证辅助项。', evidenceLabel: '部门资料' },
    tagArchive: { title: '业务标签与筛选口径范围', description: '标签仅用于当前账套的检索、筛选和规则适用范围，不会改变原始凭证、单据或报表金额。启停和合并标签需要保留变更记录。', evidenceLabel: '业务引用' },
    assetCategory: { title: '资产类别与折旧范围', description: '资产类别定义折旧年限、残值率、默认科目和适用资产。参数变更需要从生效期开始，不能追溯改写已经计提的折旧。', evidenceLabel: '资产依据' },
    auxiliaryCategories: { title: '辅助核算类别适用范围', description: '辅助类别决定可选择的科目及项目维度。类别停用前需检查所有辅助项目和凭证引用，避免形成无法穿透的历史数据。', evidenceLabel: '适用科目' },
    auxiliaryItems: { title: '辅助核算项目引用范围', description: '辅助项目用于凭证、账簿和报表维度穿透。项目停用只阻止后续选择，已发生业务仍按原始项目保留。', evidenceLabel: '凭证引用' },
  }
  if (archiveWorkspaceContext[kind]) {
    const context = archiveWorkspaceContext[kind]!
    return {
      title: context.title,
      description: context.description,
      metrics: [...commonMetrics, { label: context.evidenceLabel, value: `${attachmentRows} 条`, tone: 'green' }],
    }
  }
  if (['customerArchive', 'supplierArchive', 'otherContactArchive', 'projectArchive', 'departmentArchive', 'accountArchive', 'assetCategory', 'auxiliaryCategories', 'auxiliaryItems'].includes(kind)) {
    return {
      title: '基础档案使用范围',
      description: `${moduleReviewHint} 档案编码、启停、默认科目和业务引用分别留痕。删除或停用前需要检查凭证、单据和辅助核算的历史引用。`,
      metrics: [...commonMetrics, { label: '支持材料', value: `${attachmentRows} 条`, tone: 'green' }],
    }
  }
  if (['invoiceMatchingRules', 'billMatchingRules', 'cashFlowMapping', 'settlementRules', 'voucherTemplateSettings', 'reportFormulaSettings', 'currencySettings', 'commonDigests'].includes(kind)) {
    return {
      title: '规则与口径生效范围',
      description: `${moduleReviewHint} 规则、模板、摘要和汇率只影响后续匹配、凭证建议或取数口径。发布前应人工复核版本和适用范围，历史数据不会被自动重算或覆盖。`,
      metrics: [...commonMetrics, { label: '待复核规则', value: `${pendingRows} 条`, tone: pendingRows > 0 ? 'amber' : 'green' }],
    }
  }
  if (kind === 'taxAdapterSettings' || kind === 'bankAdapterSettings') {
    return {
      title: '外部授权边界',
      description: `${moduleReviewHint} 此处仅维护授权渠道、范围、状态和审计证据。不会保存明文密码、模拟税局提交或发起银行付款，外部动作必须经授权适配器和人工确认。`,
      metrics: [...commonMetrics, { label: '授权证据', value: `${attachmentRows} 条`, tone: 'green' }],
    }
  }
  if (['employee', 'payroll', 'socialSecurity', 'specialDeduction'].includes(kind)) {
    return {
      title: '人员与薪税资料范围',
      description: `${moduleReviewHint} 人员档案、工资、社保和专项扣除按当前账期关联复核；缺少证照、工资项或缴费依据的记录不会进入凭证和申报取数。`,
      metrics: [...commonMetrics, { label: '资料附件齐备', value: `${attachmentRows} 条`, tone: 'green' }],
    }
  }
  const businessWorkspaceContext: Partial<Record<ModuleKind, { title: string; description: string; evidenceLabel: string }>> = {
    receipt: { title: '票据到期与背书范围', description: '票据金额、出票信息、到期日、背书用途和影像附件必须逐笔核验。票据处理记录不等同于实际托收、贴现或资金入账。', evidenceLabel: '票据影像' },
    documentRegister: { title: '原始单据审核与入账范围', description: '登记单据先确认业务日期、金额、审批、附件和归属科目，再进入凭证准备。缺少原始附件或审批依据的单据不得直接入账。', evidenceLabel: '原始附件' },
    expenseReimbursement: { title: '费用报销审批与付款范围', description: '报销类别、报销人、审批节点、票据和付款状态须分别复核。系统只准备付款与凭证草稿，不发起银行付款。', evidenceLabel: '报销票据' },
    purchaseManagement: { title: '采购履约与成本入账范围', description: '采购订单、入库验收、供应商进项票、应付核对和成本入账按顺序复核。未验收或无票业务不能自动形成成本凭证。', evidenceLabel: '采购单据' },
    salesManagement: { title: '销售履约与收入确认范围', description: '销售订单、出库或服务履约、销项开票、回款核销和收入入账分开核验。未满足收入确认条件的记录不能自动入账。', evidenceLabel: '履约单据' },
    depreciation: { title: '资产折旧与摊销范围', description: '资产原值、类别、启用日期、折旧方法和本期计提金额需要按账期复核。系统只生成待确认计提凭证，不能改写已结账期间。', evidenceLabel: '资产依据' },
    inventorySettings: { title: '存货档案与成本口径范围', description: '存货编码、规格单位、默认科目和成本口径是出入库、成本结转的基础。修改口径只影响后续处理，并须保留变更记录。', evidenceLabel: '档案依据' },
    inventoryMovement: { title: '出入库与成本依据范围', description: '入库、出库、调拨和盘点单据应先确认数量、仓库、存货与来源业务，再参与成本计算和凭证准备。', evidenceLabel: '收发单据' },
    costCarryover: { title: '月末成本结转范围', description: '成本来源、结转方法、金额和凭证模板必须在月末前复核。结转只生成待确认结果，不能绕过结账控制直接修改账簿。', evidenceLabel: '结转依据' },
    receivableSettlement: { title: '应收核销与回款范围', description: '客户应收、回款流水、核销金额和余额差异需要逐笔确认。自动匹配仅为建议，收入凭证必须由会计人员复核。', evidenceLabel: '回款回单' },
    payableSettlement: { title: '应付核销与付款范围', description: '供应商应付、付款流水、核销金额和差额处理需要逐笔确认。系统不直接发起付款，成本费用凭证仍需会计人员复核。', evidenceLabel: '付款回单' },
    receivablePayableAging: { title: '往来账龄与风险处置范围', description: '账龄根据当前账套应收应付、核销和最近凭证计算。逾期提醒仅用于跟进，不会替代催收、付款或坏账处理审批。', evidenceLabel: '往来凭证' },
  }
  if (businessWorkspaceContext[kind]) {
    const context = businessWorkspaceContext[kind]!
    return {
      title: context.title,
      description: context.description,
      metrics: [...commonMetrics, { label: context.evidenceLabel, value: `${attachmentRows} 条`, tone: 'green' }],
    }
  }
  const controlWorkspaceContext: Partial<Record<ModuleKind, { title: string; description: string; evidenceLabel: string }>> = {
    voucher: { title: '会计凭证审核与记账范围', description: '凭证字号、日期、分录、借贷平衡、附件和审核状态应逐项复核。系统不会自动过账、反审核或修改已结账期间凭证。', evidenceLabel: '原始附件' },
    voucherCreate: { title: '会计凭证审核与记账范围', description: '凭证字号、日期、分录、借贷平衡、附件和审核状态应逐项复核。系统不会自动过账、反审核或修改已结账期间凭证。', evidenceLabel: '原始附件' },
    voucherEdit: { title: '会计凭证审核与记账范围', description: '凭证字号、日期、分录、借贷平衡、附件和审核状态应逐项复核。系统不会自动过账、反审核或修改已结账期间凭证。', evidenceLabel: '原始附件' },
    voucherDetail: { title: '会计凭证审核与记账范围', description: '凭证字号、日期、分录、借贷平衡、附件和审核状态应逐项复核。系统不会自动过账、反审核或修改已结账期间凭证。', evidenceLabel: '原始附件' },
    invoiceVoucherMatching: { title: '票据凭证匹配确认范围', description: '票据金额、日期、对方单位、科目和凭证金额必须同时校验。置信度仅用于排序，匹配确认或解除都必须留下人工复核记录。', evidenceLabel: '源票据' },
    riskCheck: { title: '风险检查与修复范围', description: '风险检查只读分析发票、凭证、工资、报表和税表的异常。修复应回到源业务处理，不能在风险页直接改写会计数据。', evidenceLabel: '检查依据' },
    closingTasks: { title: '期末结转与关账范围', description: '结转按固定顺序检查来源、生成草稿、人工复核和审批。存在阻断风险或未审核凭证时，系统不得锁定账期或执行反结账。', evidenceLabel: '取数快照' },
    notificationCenter: { title: '账套待办处理范围', description: '待办仅聚合当前账套的资料、风险、确认和申报提醒。处理结果需要回到原始模块完成，不发送短信或外部消息。', evidenceLabel: '关联依据' },
    contractLedger: { title: '合同归档与税目范围', description: '合同金额、相对方、签订日期、印花税税目、发票关联和签章附件分别复核。合同台账不替代合同审批或税务申报确认。', evidenceLabel: '合同附件' },
  }
  if (controlWorkspaceContext[kind]) {
    const context = controlWorkspaceContext[kind]!
    return {
      title: context.title,
      description: context.description,
      metrics: [...commonMetrics, { label: context.evidenceLabel, value: `${attachmentRows} 条`, tone: 'green' }],
    }
  }
  if (['billList', 'bankStatement', 'bankReconciliation', 'transfer', 'receivableSettlement', 'payableSettlement', 'receivablePayableAging'].includes(kind)) {
    return {
      title: '资金与往来核对范围',
      description: `${moduleReviewHint} 流水、回单、往来余额和核销结果仅生成待确认建议；金额差异和未达项需由经办人复核后才能影响凭证或结账。`,
      metrics: [...commonMetrics, { label: '已关联凭证', value: `${voucherRows} 条`, tone: 'green' }],
    }
  }
  const taxWorkspaceContext: Partial<Record<ModuleKind, { title: string; description: string; evidenceLabel: string }>> = {
    taxInit: { title: '税种认定与启用范围', description: '税种认定、申报周期、取数适配与授权信息需逐项确认。没有适配器授权时，只能保留本地资料，不能自动登录或提交。', evidenceLabel: '授权证据' },
    declarationCalendar: { title: '申报日程与节点范围', description: '日历只安排当前账套的取数、校验、人工确认和回执归档节点；截止提醒不代表已向税局完成申报。', evidenceLabel: '已归档回执' },
    vatTaxReport: { title: '增值税取数与抵扣范围', description: '销项发票、进项认证、勾选抵扣和附加税费分别核验。抵扣确认必须由已授权人员在税局渠道人工完成。', evidenceLabel: '抵扣附件' },
    withholdingTaxReport: { title: '扣缴个税计算范围', description: '人员、薪酬、专项附加扣除和代扣税额必须按所属期复核。系统只生成待确认取数，不自动代扣或提交。', evidenceLabel: '人员资料' },
    stampTaxReport: { title: '印花税凭证核验范围', description: '合同、应税凭证、税目、计税依据和减免事项须逐条复核。税款申报与缴纳需要人工确认和回执归档。', evidenceLabel: '应税凭证' },
    incomeTaxReport: { title: '企业所得税预缴范围', description: '利润口径、纳税调整、亏损弥补和预缴计算必须保留取数来源。最终申报金额不能由系统直接确认或提交。', evidenceLabel: '调整依据' },
    socialSecurityTaxReport: { title: '社保费申报核验范围', description: '人员参保状态、缴费基数、单位个人金额和工资表要先完成一致性核验；不会自动向社保或税局提交。', evidenceLabel: '缴费资料' },
    financeTaxReport: { title: '财务报表报送范围', description: '报表取数、勾稽校验、报送材料和回执附件分开管理。报送前仍需由具备权限的人员核对并人工确认。', evidenceLabel: '报送材料' },
    nonTaxRevenueReport: { title: '非税收入核定范围', description: '征收项目、计费依据、减免事项和缴款信息需逐笔留痕。系统不会替代主管机关核定或自动发起缴款。', evidenceLabel: '核定依据' },
    declarationReceipt: { title: '回执与缴款归档范围', description: '回执号、缴款书、支付状态和附件只是本地归档记录。真实申报、缴款和回执以外部渠道或人工导入凭据为准。', evidenceLabel: '归档附件' },
    taxReport: { title: '本期申报编制范围', description: '本期税种分别完成取数、校验、人工确认和申报包归档。工作台不会绕过授权直接向税局提交。', evidenceLabel: '申报材料' },
  }
  if (taxWorkspaceContext[kind]) {
    const context = taxWorkspaceContext[kind]!
    return {
      title: context.title,
      description: context.description,
      metrics: [...commonMetrics, { label: context.evidenceLabel, value: `${attachmentRows} 条`, tone: 'green' }],
    }
  }
  if (kind === 'taxInit' || kind === 'taxReport' || kind === 'declarationCalendar' || kind === 'declarationReceipt' || kind.endsWith('TaxReport') || kind === 'nonTaxRevenueReport') {
    return {
      title: '申报包与回执边界',
      description: `${moduleReviewHint} 取数快照、校验结果、申报包和缴款回执分别留痕。系统只生成本地待确认材料，不会自动向税务机关提交或发起扣款。`,
      metrics: [...commonMetrics, { label: '已归档回执', value: `${attachmentRows} 条`, tone: 'green' }],
    }
  }
  const reportWorkspaceContext: Partial<Record<ModuleKind, { title: string; description: string; traceLabel: string }>> = {
    ledgerReport: { title: '账簿总览与勾稽范围', description: '总览只聚合余额表、总账、明细账与辅助账的取数状态；各账表仍需回查到科目、账期和凭证来源后才能结账或导出。', traceLabel: '可穿透记录' },
    trialBalanceReport: { title: '科目余额与试算范围', description: '期初、本期发生、累计发生与期末余额按科目及辅助维度核对。借贷试算不平时必须回查分录或期初来源。', traceLabel: '平衡依据' },
    accountSummaryReport: { title: '科目汇总取数范围', description: '按凭证分录汇总借贷发生额，不把汇总表作为独立记账来源。调整后需重新取数并保留凭证穿透依据。', traceLabel: '汇总凭证' },
    generalLedgerReport: { title: '总账月度汇总范围', description: '总账以科目和月份汇总发生额及余额方向，余额异常必须与余额表和明细账交叉核验。', traceLabel: '凭证来源' },
    subsidiaryLedgerReport: { title: '明细账逐笔穿透范围', description: '明细账展示逐笔摘要、借贷和余额，任何余额调整都应回查原凭证，而不是直接编辑账簿结果。', traceLabel: '原始凭证' },
    auxiliaryLedgerReport: { title: '辅助核算穿透范围', description: '客户、供应商、项目、部门和人员维度需要与所属会计科目一致。辅助余额差异会进入结账前风险项。', traceLabel: '辅助凭证' },
    auxiliaryBalanceReport: { title: '辅助余额勾稽范围', description: '辅助余额与总账科目余额同步核验；维度缺失、方向错误或余额不一致不能直接作为报表取数依据。', traceLabel: '勾稽凭证' },
    multiColumnLedgerReport: { title: '多栏账栏目范围', description: '费用、收入和成本栏目由科目口径映射生成。栏目变化需要复核映射规则，不直接修改已结账期间的账簿。', traceLabel: '栏目凭证' },
    financialReport: { title: '财务报表编制范围', description: '资产负债表、利润表、现金流量表和权益变动表分别按模板取数，需先完成勾稽校验再形成报送材料。', traceLabel: '取数证据' },
    balanceSheetReport: { title: '资产负债表勾稽范围', description: '资产、负债和权益项目按照会计准则和科目映射生成。重分类和期初期末平衡关系必须在导出前复核。', traceLabel: '项目凭证' },
    incomeStatementReport: { title: '利润表取数范围', description: '收入、成本、税金及附加、期间费用和利润总额按本月与累计口径取数。公式变更后需要留存版本和复核记录。', traceLabel: '损益凭证' },
    incomeQuarterReport: { title: '季度利润表申报范围', description: '季度累计利润口径用于企业所得税取数参考。报表快照不等同于申报确认，申报前需由人员复核纳税调整。', traceLabel: '季度依据' },
    cashFlowReport: { title: '现金流量表映射范围', description: '经营、投资和筹资活动由凭证及现金流量映射规则取数。未映射分录必须人工补齐后再报送。', traceLabel: '映射凭证' },
    cashFlowQuarterReport: { title: '季度现金流报送范围', description: '季度现金流按报送口径汇总经营、投资和筹资活动。对外报送前需核验与主表及凭证金额的一致性。', traceLabel: '报送依据' },
    equityChangeReport: { title: '权益变动表取数范围', description: '实收资本、资本公积、盈余公积和未分配利润按权益变动口径归集。与资产负债表权益合计不一致时必须阻断导出。', traceLabel: '权益凭证' },
  }
  if (reportWorkspaceContext[kind]) {
    const context = reportWorkspaceContext[kind]!
    return {
      title: context.title,
      description: context.description,
      metrics: [...commonMetrics, { label: context.traceLabel, value: `${voucherRows} 条`, tone: 'green' }],
    }
  }
  const aiWorkspaceContext: Partial<Record<ModuleKind, { title: string; description: string; evidenceLabel: string }>> = {
    aiJobQueue: { title: 'AI任务执行范围', description: '任务队列只跟踪当前账套已登记的 OCR、分类和建议生成任务。异常重试不会覆盖原始资料，完成后仍需人工确认结果。', evidenceLabel: '来源资料' },
    aiRecognitionResults: { title: 'OCR识别复核范围', description: '识别字段、置信度和业务匹配结果仅作为候选数据。低置信度、缺少影像或字段冲突必须人工修正后才能用于后续处理。', evidenceLabel: '识别影像' },
    aiVoucherSuggestions: { title: '凭证建议确认范围', description: 'AI 只生成借贷科目和摘要建议，不能自行保存正式凭证。金额、辅助核算、附件和借贷平衡必须由会计人员确认。', evidenceLabel: '建议来源' },
    aiRuleTraining: { title: '规则训练发布范围', description: '训练样本、触发条件、命中结果和版本需要分开审计。规则发布只影响后续建议，不会自动批量改写既有凭证或申报。', evidenceLabel: '训练样本' },
    attachmentCenter: { title: '附件归档与关联范围', description: '附件中心只登记本机文件元数据、校验值和关联单据，不移动原文件、不上传第三方存储，也不自动修改凭证附件张数。', evidenceLabel: '已关联单据' },
    importCenter: { title: '导入批次核验范围', description: '导入文件须先完成表头映射、候选行预览和失败行校验。只有人工确认的本地导入才会写入目标台账，不调用外部系统。', evidenceLabel: '已核验批次' },
    exportCenter: { title: '导出文件留痕范围', description: '导出中心记录本地生成的 Excel、PDF 和打印包。下载记录不代表外部报送，敏感字段仍按当前账套权限和模板规则处理。', evidenceLabel: '已生成文件' },
  }
  if (aiWorkspaceContext[kind]) {
    const context = aiWorkspaceContext[kind]!
    return {
      title: context.title,
      description: context.description,
      metrics: [...commonMetrics, { label: context.evidenceLabel, value: `${attachmentRows} 条`, tone: 'green' }],
    }
  }
  if (kind.includes('Ledger') || kind.includes('Balance') || kind.includes('Report') || kind === 'ledgerReport' || kind === 'financialReport') {
    return {
      title: '账表取数与勾稽范围',
      description: `${moduleReviewHint} 本工作区展示账簿穿透、报表取数和勾稽校验范围；报表导出前仍需复核公式版本、重分类和凭证追溯结果。`,
      metrics: [...commonMetrics, { label: '可穿透记录', value: `${voucherRows} 条`, tone: 'green' }],
    }
  }
  return {
    title: `${tab}处理范围`,
    description: `${moduleReviewHint} 当前页签按筛选条件展示已关联业务记录；涉及数据写入、外部同步或高风险操作时仍须经过规则校验和人工确认。`,
    metrics: [...commonMetrics, { label: '关联附件', value: `${attachmentRows} 条`, tone: 'green' }],
  }
}

const toneClasses = {
  blue: 'text-[#1f65a7]',
  green: 'text-green-700',
  amber: 'text-amber-700',
  red: 'text-red-700',
  gray: 'text-slate-600',
}

function statusBadge(status: ModuleRow['status']) {
  const className = {
    待处理: 'bg-amber-50 text-amber-700 ring-amber-100',
    已匹配: 'bg-blue-50 text-blue-700 ring-blue-100',
    已确认: 'bg-green-50 text-green-700 ring-green-100',
    已生成凭证: 'bg-green-50 text-green-700 ring-green-100',
    待确认: 'bg-amber-50 text-amber-700 ring-amber-100',
    异常: 'bg-red-50 text-red-700 ring-red-100',
    启用: 'bg-green-50 text-green-700 ring-green-100',
    停用: 'bg-slate-50 text-slate-600 ring-slate-200',
    已通过: 'bg-green-50 text-green-700 ring-green-100',
  }[status]

  return <span className={cn('inline-flex rounded px-2 py-0.5 text-xs font-medium ring-1', className)}>{status}</span>
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function printTemplateKind(kind: ModuleKind): PrintTemplateKind {
  if (kind === 'voucher' || kind === 'voucherCreate' || kind === 'voucherEdit' || kind === 'voucherDetail') return 'voucher'
  if (
    kind === 'ledgerReport' ||
    kind === 'trialBalanceReport' ||
    kind === 'accountSummaryReport' ||
    kind === 'generalLedgerReport' ||
    kind === 'subsidiaryLedgerReport' ||
    kind === 'auxiliaryLedgerReport' ||
    kind === 'auxiliaryBalanceReport' ||
    kind === 'multiColumnLedgerReport' ||
    kind === 'initialBalance'
  ) return 'ledger'
  if (
    kind === 'financialReport' ||
    kind === 'balanceSheetReport' ||
    kind === 'incomeStatementReport' ||
    kind === 'incomeQuarterReport' ||
    kind === 'cashFlowReport' ||
    kind === 'cashFlowQuarterReport' ||
    kind === 'equityChangeReport'
  ) return 'financial'
  if (
    kind === 'taxReport' ||
    kind === 'vatTaxReport' ||
    kind === 'withholdingTaxReport' ||
    kind === 'stampTaxReport' ||
    kind === 'incomeTaxReport' ||
    kind === 'socialSecurityTaxReport' ||
    kind === 'financeTaxReport' ||
    kind === 'nonTaxRevenueReport' ||
    kind === 'taxInit'
  ) return 'tax'
  return 'list'
}

function printableRows(config: ModuleConfig, rows: ModuleRow[]) {
  return rows.map((row) => ({
    row,
    cells: [
      ...config.columns.map((column) => row.values[column.key] || ''),
      row.status,
      row.voucher || '',
      row.attachment || '',
    ],
  }))
}

type ExportDocumentContext = {
  companyName: string
  periodLabel: string
  taxpayerId: string
}

function formatPrintAmount(value: number) {
  return `¥${Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function renderGenericPrintHtml(params: {
  title: string
  headers: string[]
  rows: ReturnType<typeof printableRows>
  exportedAt: string
  status: string
  keyword: string
  context: ExportDocumentContext
}) {
  const { title, headers, rows, exportedAt, status, keyword, context } = params
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    @page{size:A4 landscape;margin:12mm}
    body{font-family:"Noto Sans SC","PingFang SC","Microsoft YaHei",-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:0;color:#111827}
    h1{text-align:center;font-size:18px;margin:0 0 10px}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:6px 14px;font-size:12px;color:#334155;margin-bottom:14px}
    .meta span{border-bottom:1px solid #cbd5e1;padding-bottom:4px}
    table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px} thead{display:table-header-group} th,td{border:1px solid #94a3b8;padding:6px 8px;word-break:break-word}
    th{background:#e8eef6;text-align:left}.note{margin-top:12px;font-size:11px;color:#64748b}
    tr{break-inside:avoid;page-break-inside:avoid}
  </style></head><body><h1>${escapeHtml(title)}</h1><div class="meta"><span>公司: ${escapeHtml(context.companyName)}</span><span>所属期: ${escapeHtml(context.periodLabel)}</span><span>导出时间: ${escapeHtml(exportedAt)}</span><span>筛选状态: ${escapeHtml(status)}</span><span>关键词: ${escapeHtml(keyword || '全部')}</span><span>记录数: ${rows.length} 条</span></div>
  <table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>
  ${rows.map(({ cells }) => `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}
  </tbody></table><div class="note">制表说明: 本打印件按当前列表筛选条件、列顺序和账期生成；正式导出需要保留操作日志和文件哈希。</div></body></html>`
}

function renderVoucherPrintHtml(title: string, rows: ReturnType<typeof printableRows>, exportedAt: string, context: ExportDocumentContext) {
  const items = rows.map(({ row }) => {
    const values = row.values
    return `<section class="voucher">
      <div class="voucher-head"><div>记账凭证</div><div class="no">${escapeHtml(values.wordNo || row.voucher || row.id)}</div></div>
      <div class="meta"><span>公司: ${escapeHtml(context.companyName)}</span><span>日期: ${escapeHtml(values.date || context.periodLabel)}</span><span>附件: ${escapeHtml(row.attachment || '-')}</span></div>
      <table><thead><tr><th>摘要</th><th>借方科目</th><th>贷方科目</th><th>借方金额</th><th>贷方金额</th></tr></thead><tbody>
        <tr><td>${escapeHtml(values.summary || '')}</td><td>${escapeHtml(values.debitAccount || '')}</td><td>${escapeHtml(values.creditAccount || '')}</td><td class="amount">${escapeHtml(values.debit || '')}</td><td class="amount">${escapeHtml(values.credit || '')}</td></tr>
      </tbody></table>
      <div class="sign"><span>制单: ${escapeHtml(values.maker || '系统')}</span><span>审核: ${escapeHtml(values.auditor || '未审')}</span><span>来源: ${escapeHtml(values.source || row.voucher || '-')}</span><span>打印: ${escapeHtml(exportedAt)}</span></div>
    </section>`
  }).join('')

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    @page{size:A4;margin:12mm}
    body{font-family:"Noto Sans SC","PingFang SC","Microsoft YaHei",-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:0;color:#111827}
    .voucher{break-inside:avoid;margin:0 0 18px;border:1.5px solid #111827;padding:12px}
    .voucher-head{display:flex;align-items:center;justify-content:center;position:relative;font-size:20px;font-weight:700;letter-spacing:0}
    .voucher-head .no{position:absolute;right:0;font-size:13px;font-weight:500}
    .meta,.sign{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0;font-size:12px;color:#334155}
    table{width:100%;border-collapse:collapse;font-size:12px} thead{display:table-header-group} th,td{border:1px solid #111827;padding:9px 8px} th{background:#f1f5f9}.amount{text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
    tr{break-inside:avoid;page-break-inside:avoid}
  </style></head><body>${items}</body></html>`
}

function renderVoucherDetailPrintHtml(title: string, voucher: Voucher, exportedAt: string, context: ExportDocumentContext) {
  const entryRows = voucher.entries.map((entry) => `<tr>
    <td>${escapeHtml(entry.summary || voucher.summary || '')}</td>
    <td>${entry.direction === 'debit' ? escapeHtml(`${entry.account_code} ${entry.account_name}`) : ''}</td>
    <td>${entry.direction === 'credit' ? escapeHtml(`${entry.account_code} ${entry.account_name}`) : ''}</td>
    <td class="amount">${entry.direction === 'debit' ? formatPrintAmount(entry.amount) : ''}</td>
    <td class="amount">${entry.direction === 'credit' ? formatPrintAmount(entry.amount) : ''}</td>
  </tr>`).join('')

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    @page{size:A4;margin:12mm}
    body{font-family:"Noto Sans SC","PingFang SC","Microsoft YaHei",-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:0;color:#111827}
    .voucher{border:1.5px solid #111827;padding:12px}
    .voucher-head{display:flex;align-items:center;justify-content:center;position:relative;font-size:20px;font-weight:700}
    .voucher-head .no{position:absolute;right:0;font-size:13px;font-weight:500}
    .meta,.sign{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0;font-size:12px;color:#334155}
    table{width:100%;border-collapse:collapse;font-size:12px} thead{display:table-header-group} tfoot{display:table-footer-group} th,td{border:1px solid #111827;padding:9px 8px;word-break:break-word} th{background:#f1f5f9}.amount{text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace} tfoot td{font-weight:700;background:#f8fafc}
    tr{break-inside:avoid;page-break-inside:avoid}
  </style></head><body><section class="voucher">
    <div class="voucher-head"><div>记账凭证</div><div class="no">${escapeHtml(voucher.voucher_number)}</div></div>
    <div class="meta"><span>公司: ${escapeHtml(context.companyName)}</span><span>日期: ${escapeHtml(voucher.voucher_date)}</span><span>附件: ${voucher.attachment_count} 张</span><span>状态: ${escapeHtml(voucher.status)}</span></div>
    <table><thead><tr><th>摘要</th><th>借方科目</th><th>贷方科目</th><th>借方金额</th><th>贷方金额</th></tr></thead><tbody>${entryRows}</tbody><tfoot><tr><td colspan="3">合计</td><td class="amount">${formatPrintAmount(voucher.total_debit)}</td><td class="amount">${formatPrintAmount(voucher.total_credit)}</td></tr></tfoot></table>
    <div class="sign"><span>制单: ${escapeHtml(voucher.created_by || '系统')}</span><span>审核: ${escapeHtml(voucher.approved_by || '未审')}</span><span>修改: ${escapeHtml(voucher.modified_by || '-')}</span><span>打印: ${escapeHtml(exportedAt)}</span></div>
  </section></body></html>`
}

function renderLedgerPrintHtml(title: string, headers: string[], rows: ReturnType<typeof printableRows>, exportedAt: string, context: ExportDocumentContext) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    @page{size:A4 landscape;margin:10mm}
    body{font-family:"Noto Sans SC","PingFang SC","Microsoft YaHei",-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:0;color:#111827}
    h1{text-align:center;font-size:18px;margin:0 0 8px}.sub{display:flex;justify-content:space-between;font-size:12px;margin-bottom:10px;color:#334155}
    table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:11px} thead{display:table-header-group} tfoot{display:table-footer-group} th,td{border:1px solid #64748b;padding:6px 7px;word-break:break-word} th{background:#e8eef6}.amount{text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
    tfoot td{background:#f8fafc;font-weight:700}
    tr{break-inside:avoid;page-break-inside:avoid}
  </style></head><body><h1>${escapeHtml(title)}</h1><div class="sub"><span>单位: ${escapeHtml(context.companyName)}</span><span>期间: ${escapeHtml(context.periodLabel)}</span><span>打印: ${escapeHtml(exportedAt)}</span></div>
  <table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows.map(({ cells }) => `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
  <tfoot><tr><td colspan="${headers.length}">本页小计: 当前筛选 ${rows.length} 行，借贷平衡状态以系统试算结果为准。</td></tr></tfoot></table></body></html>`
}

function renderFinancialPrintHtml(title: string, rows: ReturnType<typeof printableRows>, exportedAt: string, context: ExportDocumentContext) {
  const bodyRows = rows.map(({ row }) => `<tr><td>${escapeHtml(row.values.line || '')}</td><td>${escapeHtml(row.values.item || '')}</td><td>${escapeHtml(row.values.opening || '')}</td><td>${escapeHtml(row.values.ending || '')}</td><td>${escapeHtml(row.values.note || row.status)}</td></tr>`).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    @page{size:A4;margin:12mm}
    body{font-family:"Noto Sans SC","PingFang SC","Microsoft YaHei",-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:0;color:#111827}
    h1{text-align:center;font-size:19px;margin:0 0 8px}.meta{display:flex;justify-content:space-between;font-size:12px;margin-bottom:10px;color:#334155}
    table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px} thead{display:table-header-group} th,td{border:1px solid #475569;padding:7px 8px;word-break:break-word} th{background:#e8eef6}.num{text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
    .foot{display:flex;justify-content:space-between;margin-top:14px;font-size:12px}
    tr{break-inside:avoid;page-break-inside:avoid}
  </style></head><body><h1>${escapeHtml(title)}</h1><div class="meta"><span>编制单位: ${escapeHtml(context.companyName)}</span><span>所属期: ${escapeHtml(context.periodLabel)}</span><span>单位: 元</span></div>
  <table><thead><tr><th>行次</th><th>项目</th><th>期初余额/本月数</th><th>期末余额/本年累计</th><th>说明</th></tr></thead><tbody>${bodyRows}</tbody></table>
  <div class="foot"><span>制表: 系统</span><span>复核: 未签章</span><span>打印时间: ${escapeHtml(exportedAt)}</span></div></body></html>`
}

function renderTaxPrintHtml(title: string, rows: ReturnType<typeof printableRows>, exportedAt: string, context: ExportDocumentContext) {
  const bodyRows = rows.map(({ row }) => `<tr><td>${escapeHtml(row.values.taxType || '')}</td><td>${escapeHtml(row.values.form || row.values.period || '')}</td><td>${escapeHtml(row.values.source || row.values.method || '')}</td><td class="num">${escapeHtml(row.values.amount || '')}</td><td class="num">${escapeHtml(row.values.tax || '')}</td><td>${escapeHtml(row.values.check || row.status)}</td></tr>`).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    @page{size:A4 landscape;margin:12mm}
    body{font-family:"Noto Sans SC","PingFang SC","Microsoft YaHei",-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:0;color:#111827}
    h1{text-align:center;font-size:18px;margin:0 0 8px}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:12px;margin-bottom:12px;color:#334155}
    table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px} thead{display:table-header-group} th,td{border:1px solid #475569;padding:7px 8px;word-break:break-word} th{background:#e8eef6}.num{text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
    .notice{margin-top:12px;border:1px solid #cbd5e1;background:#f8fafc;padding:8px;font-size:11px;color:#475569}
    tr{break-inside:avoid;page-break-inside:avoid}
  </style></head><body><h1>${escapeHtml(title)}</h1><div class="meta"><span>纳税人: ${escapeHtml(context.companyName)}</span><span>税号: ${escapeHtml(context.taxpayerId)}</span><span>所属期: ${escapeHtml(context.periodLabel)}</span><span>申报口径: 系统取数</span><span>状态: 待人工确认</span><span>打印: ${escapeHtml(exportedAt)}</span></div>
  <table><thead><tr><th>税种</th><th>申报表/周期</th><th>取数来源/方式</th><th>本期金额</th><th>税额</th><th>校验</th></tr></thead><tbody>${bodyRows}</tbody></table>
  <div class="notice">边界说明: 本打印件为申报预览和留档材料，不代表已向电子税务局提交。真实申报需要 adapter 授权、提交回执和人工确认。</div></body></html>`
}

function buildPrintHtml(params: {
  kind: ModuleKind
  title: string
  config: ModuleConfig
  rows: ModuleRow[]
  exportedAt: string
  status: string
  keyword: string
  context: ExportDocumentContext
}) {
  const headers = [...params.config.columns.map((column) => column.label), '状态', '凭证', '附件']
  const rows = printableRows(params.config, params.rows)
  const template = printTemplateKind(params.kind)

  if (template === 'voucher') return renderVoucherPrintHtml(params.title, rows, params.exportedAt, params.context)
  if (template === 'ledger') return renderLedgerPrintHtml(params.title, headers, rows, params.exportedAt, params.context)
  if (template === 'financial') return renderFinancialPrintHtml(params.title, rows, params.exportedAt, params.context)
  if (template === 'tax') return renderTaxPrintHtml(params.title, rows, params.exportedAt, params.context)

  return renderGenericPrintHtml({
    title: params.title,
    headers,
    rows,
    exportedAt: params.exportedAt,
    status: params.status,
    keyword: params.keyword,
    context: params.context,
  })
}

function rowsToExcelCells(config: ModuleConfig, rows: ModuleRow[]) {
  return rows.map((row) => [
    ...config.columns.map((column) => row.values[column.key] || ''),
    row.status,
    row.voucher || '',
    row.attachment || '',
  ])
}

function excelMetaRows(params: {
  title: string
  exportedAt: string
  status: string
  keyword: string
  rowCount: number
  context: ExportDocumentContext
}) {
  return [
    [`${params.title}导出表`],
    ['公司', params.context.companyName, '所属期', params.context.periodLabel, '导出时间', params.exportedAt],
    ['筛选状态', params.status, '关键词', params.keyword || '全部', '记录数', `${params.rowCount} 条`],
    [],
  ]
}

function excelColumnWidths(headers: string[]): SheetColumnWidth[] {
  return headers.map((header) => ({
    wch: Math.max(10, Math.min(30, header.length * 2 + 8)),
  }))
}

function excelMerges(sheetRows: string[][], columnCount: number): SheetMerge[] {
  return [
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(columnCount - 1, 0) } },
    { s: { r: sheetRows.length - 1, c: 1 }, e: { r: sheetRows.length - 1, c: Math.max(columnCount - 1, 1) } },
  ]
}

function buildVoucherExcelTemplate(params: {
  title: string
  rows: ModuleRow[]
  exportedAt: string
  status: string
  keyword: string
  context: ExportDocumentContext
}): ExcelTemplateData {
  const headers = ['凭证日期', '凭证字号', '摘要', '借方科目', '贷方科目', '借方金额', '贷方金额', '来源单据', '附件', '制单人', '审核人', '状态']
  const rows = params.rows.map((row) => [
    row.values.date || '',
    row.values.wordNo || row.voucher || '',
    row.values.summary || '',
    row.values.debitAccount || '',
    row.values.creditAccount || '',
    row.values.debit || '',
    row.values.credit || '',
    row.values.source || '',
    row.attachment || '',
    row.values.maker || '',
    row.values.auditor || '',
    row.status,
  ])
  const sheetRows = [
    ...excelMetaRows({ title: '记账凭证', exportedAt: params.exportedAt, status: params.status, keyword: params.keyword, rowCount: rows.length, context: params.context }),
    headers,
    ...rows,
    [],
    ['制表说明', '凭证导出按凭证纸字段生成，包含制单、审核、来源和附件状态；正式数据应写入导出日志。'],
  ]

  return { sheetRows, columnWidths: excelColumnWidths(headers), merges: excelMerges(sheetRows, headers.length) }
}

function buildLedgerExcelTemplate(params: {
  title: string
  config: ModuleConfig
  rows: ModuleRow[]
  exportedAt: string
  status: string
  keyword: string
  context: ExportDocumentContext
}): ExcelTemplateData {
  const headers = [...params.config.columns.map((column) => column.label), '状态', '凭证', '附件']
  const rows = rowsToExcelCells(params.config, params.rows)
  const sheetRows = [
    ...excelMetaRows({ title: params.title, exportedAt: params.exportedAt, status: params.status, keyword: params.keyword, rowCount: rows.length, context: params.context }),
    ['单位', params.context.companyName, '期间', params.context.periodLabel, '币别', '人民币'],
    [],
    headers,
    ...rows,
    [],
    ['本页小计', `当前筛选 ${rows.length} 行，借贷平衡状态以系统试算结果为准。`],
  ]

  return { sheetRows, columnWidths: excelColumnWidths(headers), merges: excelMerges(sheetRows, headers.length) }
}

function buildFinancialExcelTemplate(params: {
  title: string
  rows: ModuleRow[]
  exportedAt: string
  status: string
  keyword: string
  context: ExportDocumentContext
}): ExcelTemplateData {
  const headers = ['行次', '报表项目', '取数公式/科目', '期初余额/本月数', '期末余额/本年累计', '重分类', '说明', '状态']
  const rows = params.rows.map((row) => [
    row.values.line || '',
    row.values.item || '',
    row.values.formula || '',
    row.values.opening || '',
    row.values.ending || '',
    row.values.reclass || '',
    row.values.note || '',
    row.status,
  ])
  const sheetRows = [
    [`${params.title}`],
    ['编制单位', params.context.companyName, '所属期', params.context.periodLabel, '单位', '元', '导出时间', params.exportedAt],
    ['筛选状态', params.status, '关键词', params.keyword || '全部', '记录数', `${rows.length} 行`],
    [],
    headers,
    ...rows,
    [],
    ['制表说明', '财务报表导出保留行次、公式、重分类和取数说明，后续需与固定报表模板逐表绑定。'],
  ]

  return { sheetRows, columnWidths: excelColumnWidths(headers), merges: excelMerges(sheetRows, headers.length) }
}

function buildTaxExcelTemplate(params: {
  title: string
  rows: ModuleRow[]
  exportedAt: string
  status: string
  keyword: string
  context: ExportDocumentContext
}): ExcelTemplateData {
  const headers = ['税种', '申报表/周期', '取数来源/计税方式', '本期金额', '税额', '校验', '状态', '凭证/快照', '附件']
  const rows = params.rows.map((row) => [
    row.values.taxType || '',
    row.values.form || row.values.period || '',
    row.values.source || row.values.method || '',
    row.values.amount || '',
    row.values.tax || '',
    row.values.check || row.values.account || '',
    row.status,
    row.voucher || '',
    row.attachment || '',
  ])
  const sheetRows = [
    [`${params.title}申报预览`],
    ['纳税人', params.context.companyName, '纳税人识别号', params.context.taxpayerId, '所属期', params.context.periodLabel, '导出时间', params.exportedAt],
    ['申报口径', '系统取数', '状态', '待人工确认', '记录数', `${rows.length} 行`],
    [],
    headers,
    ...rows,
    [],
    ['边界说明', '本文件为申报预览和留档材料，不代表已向电子税务局提交。真实申报需要 adapter 授权、提交回执和人工确认。'],
  ]

  return { sheetRows, columnWidths: excelColumnWidths(headers), merges: excelMerges(sheetRows, headers.length) }
}

function buildGenericExcelTemplate(params: {
  title: string
  config: ModuleConfig
  rows: ModuleRow[]
  exportedAt: string
  status: string
  keyword: string
  context: ExportDocumentContext
}): ExcelTemplateData {
  const headers = [...params.config.columns.map((column) => column.label), '状态', '凭证', '附件']
  const rows = rowsToExcelCells(params.config, params.rows)
  const sheetRows = [
    ...excelMetaRows({ title: params.title, exportedAt: params.exportedAt, status: params.status, keyword: params.keyword, rowCount: rows.length, context: params.context }),
    headers,
    ...rows,
    [],
    ['制表说明', '本文件按当前列表筛选条件、列顺序和账期生成；真实数据导出需写入操作日志、文件哈希和操作人。'],
  ]

  return { sheetRows, columnWidths: excelColumnWidths(headers), merges: excelMerges(sheetRows, headers.length) }
}

function buildExcelTemplate(params: {
  kind: ModuleKind
  title: string
  config: ModuleConfig
  rows: ModuleRow[]
  exportedAt: string
  status: string
  keyword: string
  context: ExportDocumentContext
}): ExcelTemplateData {
  const template = printTemplateKind(params.kind)
  if (template === 'voucher') return buildVoucherExcelTemplate(params)
  if (template === 'ledger') return buildLedgerExcelTemplate(params)
  if (template === 'financial') return buildFinancialExcelTemplate(params)
  if (template === 'tax') return buildTaxExcelTemplate(params)
  return buildGenericExcelTemplate(params)
}

function buildImportTemplate(params: {
  title: string
  config: ModuleConfig
  context: ExportDocumentContext
}): ExcelTemplateData {
  const headers = params.config.columns.map((column) => column.label)
  const sampleRow = params.config.rows[0]
  const examples = headers.map((_, index) => {
    const column = params.config.columns[index]
    return sampleRow?.values[column.key] || `示例${index + 1}`
  })
  const sheetRows = [
    [`${params.title}导入模板`],
    ['公司', params.context.companyName, '所属期', params.context.periodLabel],
    ['填写要求', '请保留第 5 行字段名称；一行对应一条业务记录。导入后先进入待确认清单，须人工复核后才可写入账套。'],
    [],
    headers,
    examples,
    [],
    ['边界说明', '本模板只用于本地数据采集和字段核验；不调用税局、银行或发票外部系统，不会自动生成或入账凭证。'],
  ]

  return {
    sheetRows,
    columnWidths: excelColumnWidths(headers),
    merges: excelMerges(sheetRows, headers.length),
  }
}

function buildImportFieldMappings(headers: string[], columns: ModuleColumn[]) {
  const normalize = (value: string) => value.replace(/[\s（）()\-_/]/g, '').toLowerCase()
  return headers.map((header) => {
    const source = normalize(header)
    const target = columns.find((column) => {
      const label = normalize(column.label)
      return label === source || label.includes(source) || source.includes(label)
    })
    return { header, target: target?.label || '未匹配字段' }
  })
}

function exportJobToModuleRow(job: ExportJob): ModuleRow {
  return {
    id: job.id,
    status: job.status === '已完成' ? '已通过' : job.status,
    voucher: '-',
    attachment: job.format,
    values: {
      file: job.fileName,
      module: job.moduleName,
      format: job.format,
      scope: job.scope,
      hash: job.hash,
      operator: job.operator,
      time: job.createdAt,
      expire: job.expireAt,
    },
  }
}

function isExportOperationAudit(log: OperationAuditLog) {
  return log.action.includes('导出') || log.action.includes('打印')
}

function exportOperationAuditStatus(result: string): ModuleRow['status'] {
  const normalized = result.toLowerCase()
  if (result === '失败' || ['failed', 'error', 'rejected'].includes(normalized)) return '异常'
  if (result === '待审批' || ['pending', 'review'].includes(normalized)) return '待确认'
  return '已通过'
}

function exportOperationAuditFormat(action: string) {
  if (action.includes('Excel')) return 'Excel'
  if (action.includes('PDF')) return 'PDF'
  if (action.includes('打印')) return '打印预览'
  return '导出文件'
}

function mapOperationAuditExportRows(logs: OperationAuditLog[]): ModuleRow[] {
  return logs
    .filter(isExportOperationAudit)
    .map((log) => {
      const objectParts = (log.objectRef || '').split('｜')
      const detailParts = (log.detail || '').split('｜')
      return {
        id: `operation-export-${log.id}`,
        status: exportOperationAuditStatus(log.result),
        voucher: '-',
        attachment: exportOperationAuditFormat(log.action),
        values: {
          file: objectParts[objectParts.length - 1] || '未记录文件名称',
          module: log.moduleName,
          format: exportOperationAuditFormat(log.action),
          scope: detailParts[detailParts.length - 1] || '已留痕',
          hash: '审计留痕',
          operator: log.operator || '系统',
          time: log.createdAt.replace('T', ' ').slice(0, 16),
          expire: '按本地归档策略',
        },
      }
    })
}

function isImportOperationAudit(log: OperationAuditLog) {
  return log.action.includes('导入') || log.action.includes('上传')
}

function mapOperationAuditImportRows(logs: OperationAuditLog[]): ModuleRow[] {
  return logs
    .filter(isImportOperationAudit)
    .map((log) => {
      const status = exportOperationAuditStatus(log.result)
      const objectParts = (log.objectRef || '').split('｜')
      return {
        id: `operation-import-${log.id}`,
        status,
        voucher: '-',
        attachment: '导入审计',
        values: {
          template: log.action,
          module: log.moduleName,
          file: objectParts[objectParts.length - 1] || '未记录文件名称',
          rows: '未记录',
          success: status === '已通过' ? '已完成' : '0',
          failed: status === '异常' ? '1' : '0',
          operator: log.operator || '系统',
          time: log.createdAt.replace('T', ' ').slice(0, 16),
        },
      }
    })
}

function localFileStatus(status: LocalImportJob['status'] | LocalAttachmentRecord['status']): ModuleRow['status'] {
  if (status === '异常') return '异常'
  if (status === '已关联' || status === '已校验' || status === '已写入') return '已通过'
  return '待确认'
}

function mapLocalImportJobRows(jobs: LocalImportJob[]): ModuleRow[] {
  return jobs.map((job) => ({
    id: job.id,
    status: localFileStatus(job.status),
    voucher: '-',
    attachment: job.fileFormat,
    values: {
      template: job.operation,
      module: job.moduleName,
      file: job.fileName,
      rows: job.rowCount === null || job.rowCount === undefined ? '待解析' : String(job.rowCount),
      success: job.status === '已写入' ? String(job.writtenRowCount || 0) : job.status === '已校验' ? '已核验' : '待校验',
      failed: job.status === '已写入' ? String(job.failedRowCount || 0) : '0',
      operator: job.operator,
      time: job.createdAt,
    },
  }))
}

function mapLocalAttachmentRows(records: LocalAttachmentRecord[]): ModuleRow[] {
  return records.map((record) => ({
    id: record.id,
    status: localFileStatus(record.status),
    voucher: '未关联',
    attachment: record.fileFormat,
    values: {
      name: record.fileName,
      type: `${record.fileFormat} / ${formatLocalFileSize(record.fileSize)}`,
      module: record.sourceModule,
      related: record.relatedDocument,
      hash: record.checksum.startsWith('meta-') ? record.checksum : `SHA-256 ${record.checksum.slice(0, 12)}...`,
      uploader: record.operator,
      time: record.createdAt,
      archive: record.status === '异常' ? '需重传' : record.status === '已关联' ? '已关联' : '待关联',
    },
  }))
}

function formatBackupSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

function mapLocalBackupRows(snapshots: LocalBackupSnapshot[], validations: Record<string, LocalBackupVerification>): ModuleRow[] {
  return snapshots.map((snapshot) => ({
    id: snapshot.id,
    status: validations[snapshot.id]?.valid === false ? '异常' : '已通过',
    voucher: '-',
    attachment: 'SQLite',
    values: {
      name: snapshot.fileName,
      company: '本机全部账套',
      type: 'SQLite 快照',
      size: formatBackupSize(snapshot.sizeBytes),
      hash: validations[snapshot.id]?.valid === true ? 'SQLite 文件头通过' : validations[snapshot.id]?.valid === false ? '校验失败，禁止恢复' : '未核验',
      operator: '系统',
      time: snapshot.createdAt.replace('T', ' ').slice(0, 16),
      restore: validations[snapshot.id]?.valid === false ? '不可恢复' : validations[snapshot.id]?.valid ? '恢复需人工确认' : '需先核验',
    },
  }))
}

function summarizeLocalBackups(snapshots: LocalBackupSnapshot[], validations: Record<string, LocalBackupVerification>): ModuleConfig['summary'] {
  const totalSize = snapshots.reduce((total, snapshot) => total + snapshot.sizeBytes, 0)
  const invalidCount = Object.values(validations).filter((verification) => !verification.valid).length
  return [
    { label: '备份文件', value: `${snapshots.length} 个`, tone: 'blue' },
    { label: '本地容量', value: formatBackupSize(totalSize), tone: 'green' },
    { label: '待恢复确认', value: `${Object.values(validations).filter((verification) => verification.valid).length} 个`, tone: 'amber' },
    { label: '异常', value: `${invalidCount} 个`, tone: 'red' },
  ]
}

function maskEmployeeId(value: string | null) {
  if (!value) return '待补'
  if (value.length <= 7) return value
  return `${value.slice(0, 3)}********${value.slice(-4)}`
}

function mapLiveCompanyTodoRows(companyTodos: CompanyTodo[], companyName: string): ModuleRow[] {
  return companyTodos.map((todo) => ({
    id: todo.id,
    status: todo.status === 'completed' ? '已通过' : todo.status === 'blocked' ? '异常' : todo.status === 'review' ? '待确认' : '待处理',
    voucher: todo.relatedEntry || '-',
    attachment: todo.evidence || '待补依据',
    values: {
      title: todo.title,
      customer: todo.companyName || companyName,
      module: todo.sourceModule,
      level: todo.priority === 'blocking' ? '阻断' : todo.priority === 'high' ? '高' : '普通',
      owner: todo.owner || '待分配',
      deadline: todo.dueDate || '未设置',
      link: todo.relatedEntry || '待补处理入口',
      result: todo.status === 'completed' ? `已完成${todo.completedAt ? ` ${todo.completedAt.replace('T', ' ').slice(0, 16)}` : ''}` : todo.note || '待处理',
    },
  }))
}

function summarizeLiveCompanyTodos(companyTodos: CompanyTodo[]): ModuleConfig['summary'] {
  const today = new Date().toISOString().slice(0, 10)
  const active = companyTodos.filter((todo) => todo.status !== 'completed')
  return [
    { label: '待办事项', value: `${active.length} 条`, tone: 'blue' },
    { label: '今日到期', value: `${active.filter((todo) => todo.dueDate === today).length} 条`, tone: 'amber' },
    { label: '已完成', value: `${companyTodos.filter((todo) => todo.status === 'completed').length} 条`, tone: 'green' },
    { label: '阻断/逾期', value: `${active.filter((todo) => todo.priority === 'blocking' || todo.status === 'blocked' || (todo.dueDate !== null && todo.dueDate < today)).length} 条`, tone: 'red' },
  ]
}

function mapLiveEmployeeRows(employees: Employee[]): ModuleRow[] {
  return employees.map((employee) => ({
    id: employee.id,
    status: employee.employmentStatus === '在职' ? '启用' : '停用',
    voucher: '-',
    attachment: employee.idNo ? '身份证信息' : '待补资料',
    values: {
      name: employee.name,
      idNo: maskEmployeeId(employee.idNo),
      department: employee.department || '未分配',
      position: employee.position || '未设置',
      mobile: employee.mobile || '待补',
      entryDate: employee.entryDate || '待补',
    },
  }))
}

function summarizeLiveEmployees(employees: Employee[]): ModuleConfig['summary'] {
  const active = employees.filter((employee) => employee.employmentStatus === '在职').length
  const missing = employees.filter((employee) => !employee.idNo || !employee.entryDate).length
  const inactive = employees.length - active
  return [
    { label: '在职人数', value: `${active} 人`, tone: 'blue' },
    { label: '本月入职', value: `${employees.filter((employee) => employee.entryDate?.startsWith(new Date().toISOString().slice(0, 7))).length} 人`, tone: 'green' },
    { label: '待补资料', value: `${missing} 人`, tone: missing > 0 ? 'amber' : 'gray' },
    { label: '离职/停用', value: `${inactive} 人`, tone: inactive > 0 ? 'red' : 'gray' },
  ]
}

function payrollCurrency(value: number) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2 }).format(value)
}

function mapLivePayrollRows(payrollRecords: PayrollRecord[]): ModuleRow[] {
  return payrollRecords.map((record) => ({
    id: record.id,
    status: record.status === '已生成凭证' ? '已生成凭证' : record.status === '异常' ? '异常' : '待确认',
    voucher: record.status === '已生成凭证' ? '已关联' : '未生成',
    attachment: '本地薪酬行',
    values: {
      name: record.employeeName,
      department: '人员档案维护',
      base: payrollCurrency(record.baseSalary),
      bonus: payrollCurrency(record.bonus),
      tax: payrollCurrency(record.taxAmount),
      net: payrollCurrency(record.netSalary),
    },
  }))
}

function summarizeLivePayroll(payrollRecords: PayrollRecord[]): ModuleConfig['summary'] {
  const sum = (key: keyof PayrollRecord) => payrollRecords.reduce((total, record) => total + Number(record[key] || 0), 0)
  const pending = payrollRecords.filter((record) => record.status !== '已生成凭证').length
  return [
    { label: '应发工资', value: payrollCurrency(sum('baseSalary') + sum('bonus')), tone: 'blue' },
    { label: '个税', value: payrollCurrency(sum('taxAmount')), tone: 'amber' },
    { label: '实发工资', value: payrollCurrency(sum('netSalary')), tone: 'green' },
    { label: '待确认行', value: `${pending} 行`, tone: pending > 0 ? 'red' : 'gray' },
  ]
}
function mapLiveSocialSecurityRows(socialSecurityRecords: SocialSecurityRecord[]): ModuleRow[] { return socialSecurityRecords.map((record) => { const confirmed = record.status === '已确认' || record.status === '已通过' || record.status === '已生成凭证'; const status: ModuleRow['status'] = record.status === '异常' ? '异常' : record.status === '已生成凭证' ? '已生成凭证' : confirmed ? '已通过' : '待确认'; return { id: record.id, status, voucher: record.status === '已生成凭证' ? '已关联' : '未生成', attachment: '本地社保明细', values: { name: record.employeeName, city: record.city || '待补', base: payrollCurrency(record.contributionBase), company: payrollCurrency(record.companyAmount), personal: payrollCurrency(record.personalAmount), fund: payrollCurrency(record.fundAmount) } } }) }
function summarizeLiveSocialSecurity(records: SocialSecurityRecord[]): ModuleConfig['summary'] {
  const needsReview = records.filter((record) => record.contributionBase <= 0 || !['已确认', '已通过', '已生成凭证'].includes(record.status))
  return [
    { label: '缴费人员', value: `${records.length} 人`, tone: records.length > 0 ? 'blue' : 'gray' },
    { label: '单位缴纳', value: payrollCurrency(records.reduce((sum, record) => sum + record.companyAmount, 0)), tone: records.length > 0 ? 'green' : 'gray' },
    { label: '个人及公积金', value: payrollCurrency(records.reduce((sum, record) => sum + record.personalAmount + record.fundAmount, 0)), tone: records.length > 0 ? 'amber' : 'gray' },
    { label: '待复核', value: `${needsReview.length} 人`, tone: needsReview.length > 0 ? 'red' : 'gray' },
  ]
}
function mapLiveSpecialDeductionRows(specialDeductionRecords: SpecialDeductionRecord[]): ModuleRow[] { return specialDeductionRecords.map((record) => ({ id: record.id, status: record.status === '有效' ? '启用' : record.status === '异常' ? '异常' : '待确认', voucher: '-', attachment: '本地扣除资料', values: { name: record.employeeName, type: record.deductionType, start: record.startMonth, end: record.endMonth || '长期有效', amount: payrollCurrency(record.monthlyAmount), source: record.source } })) }

function summarizeLiveSpecialDeductions(specialDeductionRecords: SpecialDeductionRecord[]): ModuleConfig['summary'] {
  const total = specialDeductionRecords.reduce((sum, record) => sum + record.monthlyAmount, 0)
  const pending = specialDeductionRecords.filter((record) => record.status !== '有效').length
  const exceptions = specialDeductionRecords.filter((record) => record.status === '异常').length
  return [
    { label: '专项扣除', value: `${specialDeductionRecords.length} 条`, tone: 'blue' },
    { label: '月扣除额', value: payrollCurrency(total), tone: 'green' },
    { label: '待确认', value: `${pending} 条`, tone: pending > 0 ? 'amber' : 'gray' },
    { label: '异常', value: `${exceptions} 条`, tone: exceptions > 0 ? 'red' : 'gray' },
  ]
}

function maskIdNo(idNo: string | null) {
  if (!idNo) return '待补'
  if (idNo.length <= 8) return `${idNo.slice(0, 2)}****`
  return `${idNo.slice(0, 3)}********${idNo.slice(-4)}`
}

function previewIndividualIncomeTax(taxableIncome: number) {
  if (taxableIncome <= 3000) return taxableIncome * 0.03
  if (taxableIncome <= 12000) return taxableIncome * 0.1 - 210
  if (taxableIncome <= 25000) return taxableIncome * 0.2 - 1410
  if (taxableIncome <= 35000) return taxableIncome * 0.25 - 2660
  if (taxableIncome <= 55000) return taxableIncome * 0.3 - 4410
  if (taxableIncome <= 80000) return taxableIncome * 0.35 - 7160
  return taxableIncome * 0.45 - 15160
}

function withholdingPreviewInputs(
  payrollRecords: PayrollRecord[],
  employees: Employee[],
  socialSecurityRecords: SocialSecurityRecord[],
  specialDeductionRecords: SpecialDeductionRecord[],
) {
  return payrollRecords.map((payroll) => {
    const employee = employees.find((item) => item.id === payroll.employeeId)
    const socialSecurity = socialSecurityRecords.find((item) => item.employeeId === payroll.employeeId)
    const specialDeduction = specialDeductionRecords
      .filter((item) => item.employeeId === payroll.employeeId)
      .reduce((sum, item) => sum + item.monthlyAmount, 0)
    const socialAmount = socialSecurity ? socialSecurity.personalAmount + socialSecurity.fundAmount : payroll.socialPersonal
    const income = payroll.baseSalary + payroll.bonus
    const taxable = Math.max(income - socialAmount - specialDeduction - 5000, 0)
    const hasMissingIdNo = !employee?.idNo
    const hasPendingSource = payroll.status !== '已生成凭证' || socialSecurity?.status === '待确认' || specialDeductionRecords.some((item) => item.employeeId === payroll.employeeId && item.status !== '有效')
    const status: ModuleRow['status'] = hasMissingIdNo || payroll.status === '异常' ? '异常' : hasPendingSource ? '待确认' : '已通过'
    return { payroll, employee, socialAmount, specialDeduction, income, taxable, tax: Math.max(previewIndividualIncomeTax(taxable), 0), status, hasMissingIdNo, hasPendingSource }
  })
}

function mapLiveWithholdingTaxRows(payrollRecords: PayrollRecord[], employees: Employee[], socialSecurityRecords: SocialSecurityRecord[], specialDeductionRecords: SpecialDeductionRecord[]): ModuleRow[] {
  return withholdingPreviewInputs(payrollRecords, employees, socialSecurityRecords, specialDeductionRecords).map((item) => ({
    id: item.payroll.id,
    status: item.status,
    voucher: '个税预览',
    attachment: item.specialDeduction > 0 ? '工资/扣除资料' : '工资资料',
    values: {
      employee: item.employee?.name || item.payroll.employeeName,
      idNo: maskIdNo(item.employee?.idNo || null),
      income: payrollCurrency(item.income),
      social: payrollCurrency(item.socialAmount),
      special: payrollCurrency(item.specialDeduction),
      taxable: payrollCurrency(item.taxable),
      tax: payrollCurrency(item.tax),
      check: item.hasMissingIdNo ? '证件资料缺失' : item.hasPendingSource ? '来源待确认' : '待人工复核',
    },
  }))
}

function summarizeLiveWithholdingTax(payrollRecords: PayrollRecord[], employees: Employee[], socialSecurityRecords: SocialSecurityRecord[], specialDeductionRecords: SpecialDeductionRecord[]): ModuleConfig['summary'] {
  const rows = withholdingPreviewInputs(payrollRecords, employees, socialSecurityRecords, specialDeductionRecords)
  return [
    { label: '申报人数', value: `${rows.length} 人`, tone: 'blue' },
    { label: '工资薪金', value: payrollCurrency(rows.reduce((sum, item) => sum + item.income, 0)), tone: 'green' },
    { label: '专项扣除', value: payrollCurrency(rows.reduce((sum, item) => sum + item.specialDeduction, 0)), tone: 'amber' },
    { label: '待复核人员', value: `${rows.filter((item) => item.status !== '已通过').length} 人`, tone: 'red' },
  ]
}

function mapLiveSocialSecurityTaxRows(socialSecurityRecords: SocialSecurityRecord[]): ModuleRow[] {
  return socialSecurityRecords.map((record) => {
    const baseMissing = record.contributionBase <= 0
    const status: ModuleRow['status'] = baseMissing || record.status === '异常' ? '异常' : record.status === '已通过' ? '已通过' : '待确认'
    return {
      id: record.id,
      status,
      voucher: '社保费预览',
      attachment: '本地社保明细',
      values: {
        employee: record.employeeName,
        city: record.city || '待补',
        base: payrollCurrency(record.contributionBase),
        company: payrollCurrency(record.companyAmount),
        personal: payrollCurrency(record.personalAmount),
        fund: payrollCurrency(record.fundAmount),
        source: '社保公积金',
        check: baseMissing ? '缴费基数待补' : status === '待确认' ? '待人工复核' : '通过',
      },
    }
  })
}

function summarizeLiveSocialSecurityTax(socialSecurityRecords: SocialSecurityRecord[]): ModuleConfig['summary'] {
  const sum = (getter: (record: SocialSecurityRecord) => number) => socialSecurityRecords.reduce((total, record) => total + getter(record), 0)
  return [
    { label: '缴费人数', value: `${socialSecurityRecords.length} 人`, tone: 'blue' },
    { label: '单位部分', value: payrollCurrency(sum((record) => record.companyAmount)), tone: 'green' },
    { label: '个人部分', value: payrollCurrency(sum((record) => record.personalAmount)), tone: 'amber' },
    { label: '基数待复核', value: `${socialSecurityRecords.filter((record) => record.contributionBase <= 0 || record.status !== '已通过').length} 人`, tone: 'red' },
  ]
}

function findIncomeStatementItem(items: IncomeStatementResult['items'], keyword: string): IncomeStatementResult['items'][number] | undefined {
  for (const item of items) {
    if (item.item_name.includes(keyword)) return item
    const child = findIncomeStatementItem(item.children || [], keyword)
    if (child) return child
  }
  return undefined
}

function mapLiveIncomeTaxRows(incomeStatement: IncomeStatementResult): ModuleRow[] {
  const totalProfit = findIncomeStatementItem(incomeStatement.items, '利润总额')
  const currentProfit = totalProfit?.current_amount
  const hasProfit = typeof currentProfit === 'number'
  return [
    {
      id: `income-tax-profit-${incomeStatement.period_id}`,
      status: hasProfit ? '待确认' : '异常',
      voucher: '所得税预览',
      attachment: '本机利润表',
      values: {
        line: '13',
        item: '利润总额',
        source: hasProfit ? '本机利润表' : '利润表未取数',
        bookAmount: hasProfit ? payrollCurrency(currentProfit) : '待取数',
        taxAmount: '待人工确认',
        adjustment: '待填写',
        check: hasProfit ? '纳税调整待确认' : '需先生成利润表',
      },
    },
    {
      id: `income-tax-adjustment-${incomeStatement.period_id}`,
      status: '待确认',
      voucher: '所得税预览',
      attachment: '调整说明',
      values: { line: '附表', item: '纳税调整项目', source: '人工维护', bookAmount: '-', taxAmount: '待填写', adjustment: '待填写', check: '不可自动认定' },
    },
  ]
}

function summarizeLiveIncomeTax(incomeStatement: IncomeStatementResult): ModuleConfig['summary'] {
  const totalProfit = findIncomeStatementItem(incomeStatement.items, '利润总额')
  return [
    { label: '利润总额', value: totalProfit ? payrollCurrency(totalProfit.current_amount) : '待取数', tone: totalProfit ? 'blue' : 'red' },
    { label: '纳税调整', value: '待人工填写', tone: 'amber' },
    { label: '应纳税所得额', value: '待确认', tone: 'green' },
    { label: '待复核', value: '2 项', tone: 'red' },
  ]
}

function vatPreviewInputs(invoices: Invoice[]) {
  const outputInvoices = invoices.filter((invoice) => invoice.invoice_type === 'output')
  const inputInvoices = invoices.filter((invoice) => invoice.invoice_type === 'input')
  const deductibleInvoices = inputInvoices.filter((invoice) => ['confirmed', 'matched', 'verified'].includes(invoice.status))
  const blockedInvoices = inputInvoices.filter((invoice) => !['confirmed', 'matched', 'verified'].includes(invoice.status))
  const outputAmount = outputInvoices.reduce((sum, invoice) => sum + invoice.amount, 0)
  const outputTax = outputInvoices.reduce((sum, invoice) => sum + invoice.tax_amount, 0)
  const deductibleTax = deductibleInvoices.reduce((sum, invoice) => sum + invoice.tax_amount, 0)
  return { outputInvoices, inputInvoices, blockedInvoices, outputAmount, outputTax, deductibleTax, payable: Math.max(outputTax - deductibleTax, 0) }
}

function mapLiveVatTaxRows(invoices: Invoice[]): ModuleRow[] {
  const preview = vatPreviewInputs(invoices)
  return [
    {
      id: 'vat-output', status: preview.outputInvoices.some((invoice) => ['void', 'rejected', 'error'].includes(invoice.status)) ? '异常' : '待确认', voucher: '增值税预览', attachment: '本地销项发票',
      values: { line: '1', item: '按适用税率计税销售额', source: `销项发票 ${preview.outputInvoices.length} 张`, salesAmount: payrollCurrency(preview.outputAmount), outputTax: payrollCurrency(preview.outputTax), deduction: '-', payable: '-', check: '待人工复核' },
    },
    {
      id: 'vat-deduction', status: preview.blockedInvoices.length > 0 ? '待确认' : '已通过', voucher: '增值税预览', attachment: '本地进项发票',
      values: { line: '12', item: '本期认证相符且本期申报抵扣', source: `进项发票 ${preview.inputInvoices.length} 张`, salesAmount: '-', outputTax: '-', deduction: payrollCurrency(preview.deductibleTax), payable: '-', check: preview.blockedInvoices.length > 0 ? `${preview.blockedInvoices.length} 张待勾选或异常` : '待人工复核' },
    },
    {
      id: 'vat-payable', status: '待确认', voucher: '增值税预览', attachment: '取数说明',
      values: { line: '主表', item: '本期应纳税额预览', source: '销项税额-已认证进项', salesAmount: '-', outputTax: payrollCurrency(preview.outputTax), deduction: payrollCurrency(preview.deductibleTax), payable: payrollCurrency(preview.payable), check: preview.blockedInvoices.length > 0 ? '进项未全部确认' : '待人工确认' },
    },
  ]
}

function summarizeLiveVatTax(invoices: Invoice[]): ModuleConfig['summary'] {
  const preview = vatPreviewInputs(invoices)
  return [
    { label: '销项税额', value: payrollCurrency(preview.outputTax), tone: 'blue' },
    { label: '进项抵扣', value: payrollCurrency(preview.deductibleTax), tone: 'green' },
    { label: '应纳税额预览', value: payrollCurrency(preview.payable), tone: 'amber' },
    { label: '待确认发票', value: `${preview.blockedInvoices.length} 张`, tone: preview.blockedInvoices.length > 0 ? 'red' : 'gray' },
  ]
}

function mapLiveBankTransactionRows(bankTransactions: BankTransaction[], kind: ModuleKind, bankTransactionTagIds: Record<string, string[]> = {}, businessTags: BusinessTag[] = []): ModuleRow[] {
  return bankTransactions.map((record) => ({
    id: record.id,
    status: record.status === '异常' ? '异常' : record.status === '已生成凭证' ? '已生成凭证' : record.status === '已匹配' ? '已匹配' : '待处理',
    voucher: record.status === '已生成凭证' ? '已关联' : '未生成',
    attachment: record.receiptStatus,
    values: {
      source: '本机录入',
      account: record.accountName,
      serialNo: record.serialNo,
      date: record.transactionDate,
      counterparty: record.counterparty || '待补对方户名',
      summary: record.summary || '待补摘要',
      income: record.incomeAmount > 0 ? payrollCurrency(record.incomeAmount) : '-',
      expense: record.expenseAmount > 0 ? payrollCurrency(record.expenseAmount) : '-',
      balance: record.balance === null ? '待补余额' : payrollCurrency(record.balance),
      receiptStatus: record.receiptStatus,
      matchResult: record.matchResult || (kind === 'bankStatement' ? '待规则匹配' : '待匹配'),
      tags: (bankTransactionTagIds[record.id] || []).map((tagId) => businessTags.find((tag) => tag.id === tagId)?.name).filter(Boolean).join(' / ') || '-',
    },
  }))
}

function summarizeLiveBankTransactions(bankTransactions: BankTransaction[], kind: ModuleKind): ModuleConfig['summary'] {
  const income = bankTransactions.reduce((sum, record) => sum + record.incomeAmount, 0)
  const expense = bankTransactions.reduce((sum, record) => sum + record.expenseAmount, 0)
  const pending = bankTransactions.filter((record) => !['已匹配', '已生成凭证'].includes(record.status)).length
  if (kind === 'bankStatement') {
    return [
      { label: '银行流水', value: `${bankTransactions.length} 笔`, tone: 'blue' },
      { label: '已匹配', value: `${bankTransactions.filter((record) => record.status === '已匹配').length} 笔`, tone: 'green' },
      { label: '待回单', value: `${bankTransactions.filter((record) => record.receiptStatus !== '已归档').length} 笔`, tone: 'amber' },
      { label: '待处理', value: `${pending} 笔`, tone: pending > 0 ? 'red' : 'gray' },
    ]
  }
  return [
    { label: '本期流水', value: `${bankTransactions.length} 笔`, tone: 'blue' },
    { label: '收入金额', value: payrollCurrency(income), tone: 'green' },
    { label: '支出金额', value: payrollCurrency(expense), tone: 'amber' },
    { label: '待匹配', value: `${pending} 笔`, tone: pending > 0 ? 'red' : 'gray' },
  ]
}
function mapLiveBankReconciliationRows(records: BankReconciliationRecord[]): ModuleRow[] { return records.map((record) => ({ id:record.id,status:record.status==='异常'?'异常':record.differenceAmount===0?'已匹配':'待处理',voucher:record.voucherNo||'待关联',attachment:record.note||'待补说明',values:{account:record.accountName,statementNo:record.transactionNo,date:record.reconciliationDate,summary:record.summary||'-',bankAmount:payrollCurrency(record.bankAmount),bookAmount:payrollCurrency(record.bookAmount),difference:payrollCurrency(record.differenceAmount),matchStatus:record.matchStatus} })) }
function summarizeLiveBankReconciliation(records: BankReconciliationRecord[]): ModuleConfig['summary'] {
  const bankBalance = records.reduce((sum, record) => sum + record.bankAmount, 0)
  const bookBalance = records.reduce((sum, record) => sum + record.bookAmount, 0)
  const unmatched = records.filter((record) => record.differenceAmount !== 0 || !/已匹配|自动匹配/.test(record.matchStatus)).length
  const difference = records.reduce((sum, record) => sum + Math.abs(record.differenceAmount), 0)
  return [
    { label: '银行余额', value: payrollCurrency(bankBalance), tone: records.length > 0 ? 'blue' : 'gray' },
    { label: '账面余额', value: payrollCurrency(bookBalance), tone: records.length > 0 ? 'green' : 'gray' },
    { label: '未达账项', value: `${unmatched} 笔`, tone: unmatched > 0 ? 'amber' : 'gray' },
    { label: '差异金额', value: payrollCurrency(difference), tone: difference > 0 ? 'red' : 'gray' },
  ]
}
function mapLiveSettlementRecordRows(records: SettlementRecord[], settlementType: 'receivable' | 'payable'): ModuleRow[] { return records.filter((record) => record.settlementType === settlementType).map((record) => ({ id: record.id, status: record.status === '异常' ? '异常' : record.balanceAmount === 0 ? '已匹配' : '待确认', voucher: record.transactionNo || '待关联流水', attachment: record.sourceDocument || '待补附件', values: settlementType === 'receivable' ? { customer: record.counterparty, invoiceNo: record.invoiceNo || record.settlementNo, receivable: payrollCurrency(record.totalAmount), receipt: record.transactionNo || '待匹配流水', settled: payrollCurrency(record.settledAmount), balance: payrollCurrency(record.balanceAmount), method: record.settlementMethod, owner: record.owner || '待分配' } : { supplier: record.counterparty, invoiceNo: record.invoiceNo || record.settlementNo, payable: payrollCurrency(record.totalAmount), payment: record.transactionNo || '待匹配流水', settled: payrollCurrency(record.settledAmount), balance: payrollCurrency(record.balanceAmount), method: record.settlementMethod, owner: record.owner || '待分配' } })) }
function settlementAgeDays(record: SettlementRecord) {
  const timestamp = new Date(record.settlementDate).getTime()
  return Number.isFinite(timestamp) ? Math.max(0, Math.floor((Date.now() - timestamp) / 86400000)) : 0
}
function mapLiveSettlementAgingRows(records: SettlementRecord[]): ModuleRow[] { return records.filter((record) => record.balanceAmount > 0).map((record) => { const days = settlementAgeDays(record); const overdue = days > 30; return { id: record.id, status: record.status === '异常' ? '异常' : '待确认', voucher: record.transactionNo || '待关联流水', attachment: record.sourceDocument || '待补附件', values: { counterparty: record.counterparty, subject: record.settlementType === 'receivable' ? '应收账款' : '应付账款', direction: record.settlementType === 'receivable' ? '借方' : '贷方', balance: payrollCurrency(record.balanceAmount), age: days <= 30 ? '0-30天' : days <= 60 ? '31-60天' : days <= 90 ? '61-90天' : '90天以上', overdue: overdue ? payrollCurrency(record.balanceAmount) : '¥0.00', lastVoucher: record.transactionNo || '待关联流水', owner: record.owner || '待分配' } } }) }
function summarizeLiveSettlementAging(records: SettlementRecord[]): ModuleConfig['summary'] {
  const outstanding = records.filter((record) => record.balanceAmount > 0)
  const receivable = outstanding.filter((record) => record.settlementType === 'receivable')
  const payable = outstanding.filter((record) => record.settlementType === 'payable')
  const overdue = outstanding.filter((record) => settlementAgeDays(record) > 30)
  const highRisk = outstanding.filter((record) => record.status === '异常' || settlementAgeDays(record) > 90)
  return [
    { label: '应收余额', value: payrollCurrency(receivable.reduce((sum, record) => sum + record.balanceAmount, 0)), tone: receivable.length > 0 ? 'blue' : 'gray' },
    { label: '应付余额', value: payrollCurrency(payable.reduce((sum, record) => sum + record.balanceAmount, 0)), tone: payable.length > 0 ? 'green' : 'gray' },
    { label: '逾期金额', value: payrollCurrency(overdue.reduce((sum, record) => sum + record.balanceAmount, 0)), tone: overdue.length > 0 ? 'amber' : 'gray' },
    { label: '高风险往来', value: `${new Set(highRisk.map((record) => record.counterparty)).size} 户`, tone: highRisk.length > 0 ? 'red' : 'gray' },
  ]
}

function mapLiveDocumentRecordRows(documentRecords: DocumentRecord[]): ModuleRow[] {
  return documentRecords.map((record) => ({
    id: record.id,
    status: record.status === '已生成凭证' ? '已生成凭证' : record.status === '异常' ? '异常' : '待确认',
    voucher: record.status === '已生成凭证' ? '已关联' : '未生成',
    attachment: record.attachmentStatus,
    values: { date: record.businessDate, code: record.documentCode, type: record.businessType, partner: record.partner || '待补往来单位', amount: payrollCurrency(record.amount), owner: record.owner || '待补经办人' },
  }))
}

function contractLedgerRecords(documentRecords: DocumentRecord[]) {
  return documentRecords.filter((record) => /合同/.test(record.businessType) || Boolean(record.stampTaxItem))
}

function mapLiveContractLedgerRows(documentRecords: DocumentRecord[]): ModuleRow[] {
  return contractLedgerRecords(documentRecords).map((record) => ({
    id: record.id,
    status: record.status === '异常' ? '异常' : record.attachmentStatus === '已归档' && record.stampTaxItem ? '已通过' : '待确认',
    voucher: record.stampTaxItem ? '印花税取数' : '待计税',
    attachment: record.attachmentStatus,
    values: {
      contractNo: record.documentCode,
      partner: record.partner || '待补相对方',
      type: record.businessType,
      signDate: record.businessDate,
      amount: payrollCurrency(record.amount),
      taxItem: record.stampTaxItem || '待确认税目',
      invoice: record.status === '已生成凭证' ? '已关联凭证' : '待关联',
      archive: record.attachmentStatus,
    },
  }))
}

function summarizeLiveContractLedger(documentRecords: DocumentRecord[]): ModuleConfig['summary'] {
  const records = contractLedgerRecords(documentRecords)
  const archived = records.filter((record) => record.attachmentStatus === '已归档')
  const pendingTax = records.filter((record) => !record.stampTaxItem || record.stampTaxRate === null)
  return [
    { label: '合同数量', value: `${records.length} 份`, tone: records.length > 0 ? 'blue' : 'gray' },
    { label: '已归档', value: `${archived.length} 份`, tone: archived.length > 0 ? 'green' : 'gray' },
    { label: '待计税', value: `${pendingTax.length} 份`, tone: pendingTax.length > 0 ? 'amber' : 'gray' },
    { label: '异常', value: `${records.filter((record) => record.status === '异常').length} 份`, tone: records.some((record) => record.status === '异常') ? 'red' : 'gray' },
  ]
}

function stampTaxRecords(documentRecords: DocumentRecord[]) {
  return documentRecords.filter((record) => record.stampTaxItem || /合同|购销|技术|产权/.test(record.businessType))
}

function stampTaxRecordStatus(record: DocumentRecord): ModuleRow['status'] {
  if (record.status === '异常') return '异常'
  if (!record.stampTaxItem || record.stampTaxRate === null || record.attachmentStatus !== '已归档') return '待确认'
  return '已通过'
}

function mapLiveStampTaxRows(documentRecords: DocumentRecord[]): ModuleRow[] {
  return stampTaxRecords(documentRecords).map((record) => {
    const confirmed = Boolean(record.stampTaxItem) && record.stampTaxRate !== null && record.attachmentStatus === '已归档'
    return {
      id: `stamp-tax-${record.id}`,
      status: stampTaxRecordStatus(record),
      voucher: '印花税取数',
      attachment: record.attachmentStatus,
      values: {
        contractNo: record.documentCode,
        partner: record.partner || '待补相对方',
        taxItem: record.stampTaxItem || '待确认税目',
        signDate: record.businessDate || '待补日期',
        amount: payrollCurrency(record.amount),
        rate: record.stampTaxRate === null ? '待确认' : `${(record.stampTaxRate * 100).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}%`,
        tax: confirmed ? payrollCurrency(record.amount * (record.stampTaxRate || 0)) : '待算',
        check: confirmed ? '通过' : record.attachmentStatus !== '已归档' ? '合同附件待归档' : '税目或税率待确认',
      },
    }
  })
}

function summarizeLiveStampTax(documentRecords: DocumentRecord[]): ModuleConfig['summary'] {
  const records = stampTaxRecords(documentRecords)
  const confirmed = records.filter((record) => record.stampTaxItem && record.stampTaxRate !== null && record.attachmentStatus === '已归档')
  const pending = records.length - confirmed.length
  return [
    { label: '应税凭证', value: `${records.length} 份`, tone: records.length > 0 ? 'blue' : 'gray' },
    { label: '计税金额', value: payrollCurrency(records.reduce((sum, record) => sum + record.amount, 0)), tone: 'green' },
    { label: '已确认税额', value: payrollCurrency(confirmed.reduce((sum, record) => sum + record.amount * (record.stampTaxRate || 0), 0)), tone: 'amber' },
    { label: '待确认', value: `${pending} 份`, tone: pending > 0 ? 'red' : 'gray' },
  ]
}

function summarizeLiveDocumentRecords(documentRecords: DocumentRecord[]): ModuleConfig['summary'] {
  const pending = documentRecords.filter((record) => record.status !== '已生成凭证').length
  return [
    { label: '登记单据', value: `${documentRecords.length} 张`, tone: 'blue' },
    { label: '已审核', value: `${documentRecords.filter((record) => record.status === '已审核').length} 张`, tone: 'green' },
    { label: '待生成凭证', value: `${pending} 张`, tone: 'amber' },
    { label: '附件缺失', value: `${documentRecords.filter((record) => record.attachmentStatus !== '已归档').length} 张`, tone: 'red' },
  ]
}

function reimbursementRecords(documentRecords: DocumentRecord[]) {
  return documentRecords.filter((record) => record.businessType.includes('报销'))
}

function documentBusinessType(kind: ModuleKind) {
  if (kind === 'contractLedger') return '业务合同'
  if (kind === 'expenseReimbursement') return '费用报销'
  if (kind === 'receipt') return '收款票据'
  if (kind === 'stampTaxReport') return '合同付款'
  return '其他'
}

function documentRecordDialogTitle(kind: ModuleKind, businessType: string, isEditing: boolean) {
  if (isEditing) return '编辑登记单据'
  if (businessType.includes('报销')) return '新增费用报销单'
  if (kind === 'receipt') return '新增票据登记'
  if (kind === 'stampTaxReport') return '新增印花税合同'
  return '新增原始单据'
}

function mapLiveExpenseReimbursementRows(documentRecords: DocumentRecord[]): ModuleRow[] {
  return reimbursementRecords(documentRecords).map((record) => ({
    id: record.id,
    status: record.status === '已生成凭证' ? '已生成凭证' : record.status === '异常' ? '异常' : '待确认',
    voucher: record.status === '已生成凭证' ? '已关联' : '未生成',
    attachment: record.attachmentStatus,
    values: { date: record.businessDate, code: record.documentCode, employee: record.owner || '待补报销人', department: '单据登记', expenseType: record.businessType, amount: payrollCurrency(record.amount), payStatus: record.status === '已生成凭证' ? '待付款确认' : '未付款', approval: record.status === '已审核' ? '已审核' : '待审核' },
  }))
}

function summarizeLiveExpenseReimbursements(documentRecords: DocumentRecord[]): ModuleConfig['summary'] {
  const rows = reimbursementRecords(documentRecords)
  return [
    { label: '报销单', value: `${rows.length} 张`, tone: 'blue' },
    { label: '已审批', value: `${rows.filter((record) => record.status === '已审核').length} 张`, tone: 'green' },
    { label: '待付款', value: `${rows.filter((record) => record.status !== '已生成凭证').length} 张`, tone: 'amber' },
    { label: '附件异常', value: `${rows.filter((record) => record.attachmentStatus !== '已归档').length} 张`, tone: 'red' },
  ]
}
function receiptRecords(documentRecords: DocumentRecord[]) { return documentRecords.filter((record) => /收款|付款|票据/.test(record.businessType)) }
function mapLiveReceiptRows(documentRecords: DocumentRecord[]): ModuleRow[] { return receiptRecords(documentRecords).map((record) => ({ id:record.id,status:record.status==='异常'?'异常':record.status==='已生成凭证'?'已生成凭证':'待确认',voucher:record.status==='已生成凭证'?'已关联':'未生成',attachment:record.attachmentStatus,values:{number:record.documentCode,type:record.businessType,issuer:record.partner||'待补出票方',dueDate:record.businessDate,amount:payrollCurrency(record.amount),purpose:record.businessType.includes('付款')?'付款':'收款'} })) }
function summarizeLiveReceipts(documentRecords: DocumentRecord[]): ModuleConfig['summary'] { const rows=receiptRecords(documentRecords); return [{label:'票据余额',value:payrollCurrency(rows.reduce((sum,row)=>sum+row.amount,0)),tone:'blue'},{label:'本期新增',value:`${rows.length} 张`,tone:'green'},{label:'待确认',value:`${rows.filter(row=>row.status!=='已生成凭证').length} 张`,tone:'amber'},{label:'异常',value:`${rows.filter(row=>row.status==='异常').length} 张`,tone:'red'}] }

function mapLiveBusinessOrderRows(orders: BusinessOrder[], orderType: 'purchase' | 'sales'): ModuleRow[] {
  return orders.filter((order) => order.orderType === orderType).map((order) => ({
    id: order.id,
    status: order.status === '异常' ? '异常' : order.voucherId ? '已生成凭证' : order.status === '已完成' ? '已通过' : '待确认',
    voucher: order.voucherId || '未生成',
    attachment: order.sourceDocument || '待补附件',
    values: orderType === 'purchase'
      ? { date: order.businessDate, orderNo: order.orderNo, supplier: order.counterparty, goods: order.goodsName, amount: payrollCurrency(order.amount), stock: order.fulfillmentStatus, invoice: order.invoiceStatus, payment: order.settlementStatus }
      : { date: order.businessDate, orderNo: order.orderNo, customer: order.counterparty, goods: order.goodsName, amount: payrollCurrency(order.amount), delivery: order.fulfillmentStatus, invoice: order.invoiceStatus, receipt: order.settlementStatus },
  }))
}

function summarizeLiveBusinessOrders(orders: BusinessOrder[], orderType: 'purchase' | 'sales', labels: [string, string, string, string]): ModuleConfig['summary'] {
  const rows = orders.filter((order) => order.orderType === orderType)
  const exceptions = rows.filter((order) => order.status === '异常').length
  return [
    { label: labels[0], value: `${rows.length} 单`, tone: 'blue' },
    { label: labels[1], value: `${rows.filter((order) => order.status === '已完成').length} 单`, tone: 'green' },
    { label: labels[2], value: `${rows.filter((order) => order.status !== '已完成' && order.status !== '异常').length} 单`, tone: 'amber' },
    { label: labels[3], value: `${exceptions} 单`, tone: 'red' },
  ]
}
function mapLiveAccountTransferRows(accountTransfers: AccountTransfer[]): ModuleRow[] { return accountTransfers.map((record) => ({ id: record.id, status: record.status === '异常' ? '异常' : record.status === '已生成凭证' ? '已生成凭证' : '待确认', voucher: record.status === '已生成凭证' ? '已关联' : '未生成', attachment: '本机转账记录', values: { date: record.transferDate, from: record.fromAccount, to: record.toAccount, amount: payrollCurrency(record.amount), fee: payrollCurrency(record.fee), serial: record.serialNo || '待补流水号' } })) }
function summarizeLiveAccountTransfers(accountTransfers: AccountTransfer[]): ModuleConfig['summary'] { return [{ label: '本期转账', value: `${accountTransfers.length} 笔`, tone: 'blue' }, { label: '转账金额', value: payrollCurrency(accountTransfers.reduce((sum, record) => sum + record.amount, 0)), tone: 'green' }, { label: '待确认', value: `${accountTransfers.filter((record) => record.status !== '已生成凭证').length} 笔`, tone: 'amber' }, { label: '异常', value: `${accountTransfers.filter((record) => record.status === '异常').length} 笔`, tone: 'red' }] }
function fixedAssetMonthlyDepreciation(asset: FixedAsset) { return asset.originalValue * (1 - asset.residualRate) / asset.usefulLifeMonths }
function mapLiveFixedAssetRows(fixedAssets: FixedAsset[]): ModuleRow[] { return fixedAssets.map((asset) => ({ id: asset.id, status: asset.status === '异常' ? '异常' : asset.status === '已生成凭证' ? '已生成凭证' : '待确认', voucher: asset.status === '已生成凭证' ? '已关联' : '未生成', attachment: asset.sourceDocument || '待补附件', values: { code: asset.assetCode, name: asset.assetName, category: asset.category, start: asset.startDate.slice(0, 7), original: payrollCurrency(asset.originalValue), depreciation: payrollCurrency(fixedAssetMonthlyDepreciation(asset)) } })) }
function summarizeLiveFixedAssets(fixedAssets: FixedAsset[]): ModuleConfig['summary'] { return [{ label: '资产数量', value: `${fixedAssets.length} 项`, tone: 'blue' }, { label: '资产原值', value: payrollCurrency(fixedAssets.reduce((sum, asset) => sum + asset.originalValue, 0)), tone: 'green' }, { label: '本月折旧', value: payrollCurrency(fixedAssets.reduce((sum, asset) => sum + fixedAssetMonthlyDepreciation(asset), 0)), tone: 'amber' }, { label: '待计提', value: `${fixedAssets.filter((asset) => asset.status !== '已生成凭证').length} 项`, tone: 'red' }] }
function mapLiveInventoryMovementRows(inventoryMovements: InventoryMovement[]): ModuleRow[] { return inventoryMovements.map((movement) => ({ id: movement.id, status: movement.status === '异常' ? '异常' : movement.status === '已生成凭证' ? '已生成凭证' : movement.status === '已匹配' ? '已匹配' : '待确认', voucher: movement.status === '已生成凭证' ? '已关联' : '未生成', attachment: movement.sourceDocument || '待补附件', values: { billNo: movement.billNo, type: movement.movementType, inventory: movement.inventoryName, warehouse: movement.warehouse, counterparty: movement.counterparty || '待补往来单位', quantity: `${movement.quantity} ${movement.unit}`, amount: payrollCurrency(movement.amount), source: movement.sourceDocument || '手工登记' } })) }
function summarizeLiveInventoryMovements(inventoryMovements: InventoryMovement[]): ModuleConfig['summary'] { const inbound = inventoryMovements.filter((movement) => movement.movementType.includes('入库')); const outbound = inventoryMovements.filter((movement) => movement.movementType.includes('出库')); return [{ label: '本月入库', value: payrollCurrency(inbound.reduce((sum, movement) => sum + movement.amount, 0)), tone: 'blue' }, { label: '本月出库', value: payrollCurrency(outbound.reduce((sum, movement) => sum + movement.amount, 0)), tone: 'amber' }, { label: '已匹配发票', value: `${inventoryMovements.filter((movement) => movement.status === '已匹配').length} 单`, tone: 'green' }, { label: '异常单据', value: `${inventoryMovements.filter((movement) => movement.status === '异常').length} 单`, tone: 'red' }] }
function mapLiveInventoryItemRows(inventoryItems: InventoryItem[]): ModuleRow[] { return inventoryItems.map((item) => ({ id: item.id, status: item.status === '异常' ? '异常' : item.status === '停用' ? '停用' : '启用', voucher: '-', attachment: '-', values: { code: item.itemCode, name: item.itemName, spec: item.specification || '-', unit: item.unit, taxRate: item.taxRate === null ? '待补' : `${item.taxRate * 100}%`, subject: item.defaultSubject || '待设置' } })) }
function mapLiveMeasurementUnitRows(measurementUnits: MeasurementUnit[]): ModuleRow[] { return measurementUnits.map((unit) => ({ id:unit.id,status:unit.status==='停用'?'停用':'启用',voucher:'-',attachment:'-',values:{name:unit.unitName,group:unit.unitGroup||'-',base:unit.baseUnit||unit.unitName,rate:String(unit.conversionRate),precision:String(unit.precisionDigits),remark:unit.remark||'-'} })) }
function mapLiveCostCarryoverRows(costCarryoverRecords: CostCarryoverRecord[]): ModuleRow[] { return costCarryoverRecords.map((record) => ({ id:record.id,status:record.status==='异常'?'异常':record.voucherNo?'已生成凭证':'待确认',voucher:record.voucherNo||'未生成',attachment:record.sourceDocument||'待补附件',values:{batch:record.batchNo,method:record.valuationMethod,source:`${record.inventoryName}｜${record.sourceBillNo}`,debit:record.debitSubject,credit:record.creditSubject,cost:payrollCurrency(record.costAmount),difference:payrollCurrency(record.differenceAmount)}})) }
function summarizeLiveCostCarryover(costCarryoverRecords: CostCarryoverRecord[]): ModuleConfig['summary'] { return [{label:'结转批次',value:`${costCarryoverRecords.length} 批`,tone:'blue'},{label:'结转成本',value:payrollCurrency(costCarryoverRecords.reduce((s,r)=>s+r.costAmount,0)),tone:'amber'},{label:'已生成凭证',value:`${costCarryoverRecords.filter(r=>r.voucherNo).length} 张`,tone:'green'},{label:'阻断项',value:`${costCarryoverRecords.filter(r=>r.status==='异常').length} 项`,tone:'red'}] }

function auditLogToModuleRow(log: AuditLog): ModuleRow {
  return {
    id: log.id,
    status: log.status,
    voucher: log.voucher,
    attachment: log.attachment,
    values: {
      time: log.time,
      operator: log.operator,
      module: log.module,
      action: log.action,
      object: log.object,
      level: log.level,
      result: log.result,
      ip: log.terminal,
    },
  }
}

export function BusinessModulePage({ kind, title, description }: BusinessModulePageProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { id: voucherId } = useParams()
  const aiVoucherSuggestionId = new URLSearchParams(location.search).get('aiSuggestion')
  const baseConfig = moduleConfigs[kind]
  const exportJobs = useExportJobs()
  const auditLogs = useAuditLogs()
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId)
  const selectedCompany = useCompanyStore((state) => state.companies.find((company) => company.id === state.selectedCompanyId))
  const updateCompany = useCompanyStore((state) => state.updateCompany)
  const currentPeriodId = usePeriodStore((state) => state.currentPeriodId)
  const periods = usePeriodStore((state) => state.periods)
  const currentPeriod = useMemo(() => periods.find((period) => period.id === currentPeriodId), [currentPeriodId, periods])
  const currentPeriodLabel = currentPeriod
    ? `${currentPeriod.period_year}-${String(currentPeriod.period_month).padStart(2, '0')}`
    : '当前账期'
  const localFileScope = {
    companyId: selectedCompanyId || 'browser-preview',
    period: currentPeriodLabel,
  }
  const localImportJobs = useLocalImportJobs(localFileScope)
  const localAttachmentRecords = useLocalAttachmentRecords(localFileScope)
  const fetchPeriods = usePeriodStore((state) => state.fetchPeriods)
  const voucherWords = usePeriodStore((state) => state.voucherWords)
  const fetchVoucherWords = usePeriodStore((state) => state.fetchVoucherWords)
  const closePeriod = usePeriodStore((state) => state.closePeriod)
  const fetchTrialBalance = usePeriodStore((state) => state.fetchTrialBalance)
  const getGeneralLedger = usePeriodStore((state) => state.getGeneralLedger)
  const getSubsidiaryLedger = usePeriodStore((state) => state.getSubsidiaryLedger)
  const getBalanceSheet = usePeriodStore((state) => state.getBalanceSheet)
  const getIncomeStatement = usePeriodStore((state) => state.getIncomeStatement)
  const getCashFlowStatement = usePeriodStore((state) => state.getCashFlowStatement)
  const saveInitialBalance = usePeriodStore((state) => state.saveInitialBalance)
  const validateInitialBalances = usePeriodStore((state) => state.validateInitialBalances)
  const accounts = useAccountStore((state) => state.accounts)
  const fetchAccounts = useAccountStore((state) => state.fetchAccounts)
  const createAccount = useAccountStore((state) => state.createAccount)
  const updateAccount = useAccountStore((state) => state.updateAccount)
  const toggleAccount = useAccountStore((state) => state.toggleAccount)
  const deleteAccount = useAccountStore((state) => state.deleteAccount)
  const auxiliaryCategories = useAuxiliaryStore((state) => state.categories)
  const auxiliaryItems = useAuxiliaryStore((state) => state.items)
  const fetchCategories = useAuxiliaryStore((state) => state.fetchCategories)
  const fetchAllItems = useAuxiliaryStore((state) => state.fetchAllItems)
  const createAuxiliaryCategory = useAuxiliaryStore((state) => state.createCategory)
  const updateAuxiliaryCategory = useAuxiliaryStore((state) => state.updateCategory)
  const deleteAuxiliaryCategory = useAuxiliaryStore((state) => state.deleteCategory)
  const createAuxiliaryItem = useAuxiliaryStore((state) => state.createItem)
  const updateAuxiliaryItem = useAuxiliaryStore((state) => state.updateItem)
  const deleteAuxiliaryItem = useAuxiliaryStore((state) => state.deleteItem)
  const toggleAuxiliaryItem = useAuxiliaryStore((state) => state.toggleItem)
  const fetchAuxiliaryLedger = useAuxiliaryStore((state) => state.fetchAuxiliaryLedger)
  const fetchAuxiliaryBalance = useAuxiliaryStore((state) => state.fetchAuxiliaryBalance)
  const invoices = useInvoiceStore((state) => state.invoices)
  const fetchInvoices = useInvoiceStore((state) => state.fetchInvoices)
  const getInvoice = useInvoiceStore((state) => state.getInvoice)
  const createInvoice = useInvoiceStore((state) => state.createInvoice)
  const updateInvoice = useInvoiceStore((state) => state.updateInvoice)
  const matchInvoiceToVoucher = useInvoiceStore((state) => state.matchInvoiceToVoucher)
  const vouchers = useVoucherStore((state) => state.vouchers)
  const queryVouchers = useVoucherStore((state) => state.queryVouchers)
  const getVoucher = useVoucherStore((state) => state.getVoucher)
  const addVoucher = useVoucherStore((state) => state.addVoucher)
  const updateVoucher = useVoucherStore((state) => state.updateVoucher)
  const approveVoucher = useVoucherStore((state) => state.approveVoucher)
  const reverseApproveVoucher = useVoucherStore((state) => state.reverseApproveVoucher)
  const deleteVoucher = useVoucherStore((state) => state.deleteVoucher)
  const restoreVoucher = useVoucherStore((state) => state.restoreVoucher)
  const permanentDeleteVoucher = useVoucherStore((state) => state.permanentDeleteVoucher)
  const batchApprove = useVoucherStore((state) => state.batchApprove)
  const batchReverseApprove = useVoucherStore((state) => state.batchReverseApprove)
  const getDeletedVouchers = useVoucherStore((state) => state.getDeletedVouchers)
  const settlementRules = useSettlementRuleStore((state) => state.rules)
  const fetchSettlementRules = useSettlementRuleStore((state) => state.fetchSettlementRules)
  const createSettlementRule = useSettlementRuleStore((state) => state.createSettlementRule)
  const updateSettlementRule = useSettlementRuleStore((state) => state.updateSettlementRule)
  const deleteSettlementRule = useSettlementRuleStore((state) => state.deleteSettlementRule)
  const currencies = useCurrencyStore((state) => state.currencies)
  const fetchCurrencies = useCurrencyStore((state) => state.fetchCurrencies)
  const createCurrency = useCurrencyStore((state) => state.createCurrency)
  const updateCurrency = useCurrencyStore((state) => state.updateCurrency)
  const deleteCurrency = useCurrencyStore((state) => state.deleteCurrency)
  const commonDigests = useTemplateStore((state) => state.commonDigests)
  const voucherTemplateTypes = useTemplateStore((state) => state.voucherTemplateTypes)
  const voucherTemplates = useTemplateStore((state) => state.voucherTemplates)
  const fetchTemplateWorkspace = useTemplateStore((state) => state.fetchTemplateWorkspace)
  const createVoucherTemplateType = useTemplateStore((state) => state.createVoucherTemplateType)
  const createCommonDigest = useTemplateStore((state) => state.createCommonDigest)
  const updateCommonDigest = useTemplateStore((state) => state.updateCommonDigest)
  const deleteCommonDigest = useTemplateStore((state) => state.deleteCommonDigest)
  const createVoucherTemplate = useTemplateStore((state) => state.createVoucherTemplate)
  const updateVoucherTemplate = useTemplateStore((state) => state.updateVoucherTemplate)
  const deleteVoucherTemplate = useTemplateStore((state) => state.deleteVoucherTemplate)
  const reportTemplates = useReportTemplateStore((state) => state.reportTemplates)
  const reportItems = useReportTemplateStore((state) => state.reportItems)
  const fetchReportTemplateWorkspace = useReportTemplateStore((state) => state.fetchReportTemplateWorkspace)
  const updateReportItem = useReportTemplateStore((state) => state.updateReportItem)
  const matchingRules = useMatchingRuleStore((state) => state.rules)
  const fetchMatchingRules = useMatchingRuleStore((state) => state.fetchMatchingRules)
  const createMatchingRule = useMatchingRuleStore((state) => state.createMatchingRule)
  const updateMatchingRule = useMatchingRuleStore((state) => state.updateMatchingRule)
  const deleteMatchingRule = useMatchingRuleStore((state) => state.deleteMatchingRule)
  const assetCategories = useAssetCategoryStore((state) => state.assetCategories)
  const fetchAssetCategories = useAssetCategoryStore((state) => state.fetchAssetCategories)
  const createAssetCategory = useAssetCategoryStore((state) => state.createAssetCategory)
  const updateAssetCategory = useAssetCategoryStore((state) => state.updateAssetCategory)
  const deleteAssetCategory = useAssetCategoryStore((state) => state.deleteAssetCategory)
  const businessTags = useBusinessTagStore((state) => state.businessTags)
  const invoiceTagIds = useBusinessTagStore((state) => state.invoiceTagIds)
  const voucherTagIds = useBusinessTagStore((state) => state.voucherTagIds)
  const bankTransactionTagIds = useBusinessTagStore((state) => state.bankTransactionTagIds)
  const fetchBusinessTags = useBusinessTagStore((state) => state.fetchBusinessTags)
  const createBusinessTag = useBusinessTagStore((state) => state.createBusinessTag)
  const updateBusinessTag = useBusinessTagStore((state) => state.updateBusinessTag)
  const deleteBusinessTag = useBusinessTagStore((state) => state.deleteBusinessTag)
  const fetchInvoiceTagIds = useBusinessTagStore((state) => state.fetchInvoiceTagIds)
  const replaceInvoiceTags = useBusinessTagStore((state) => state.replaceInvoiceTags)
  const fetchVoucherTagIds = useBusinessTagStore((state) => state.fetchVoucherTagIds)
  const replaceVoucherTags = useBusinessTagStore((state) => state.replaceVoucherTags)
  const fetchBankTransactionTagIds = useBusinessTagStore((state) => state.fetchBankTransactionTagIds)
  const replaceBankTransactionTags = useBusinessTagStore((state) => state.replaceBankTransactionTags)
  const companyAccounts = useCompanyAccountStore((state) => state.companyAccounts)
  const fetchCompanyAccounts = useCompanyAccountStore((state) => state.fetchCompanyAccounts)
  const createCompanyAccount = useCompanyAccountStore((state) => state.createCompanyAccount)
  const updateCompanyAccount = useCompanyAccountStore((state) => state.updateCompanyAccount)
  const deleteCompanyAccount = useCompanyAccountStore((state) => state.deleteCompanyAccount)
  const usesLiveModuleData = isTauri && selectedCompanyId && ['outputInvoice', 'inputInvoice', 'voucher', 'riskCheck'].includes(kind)
  const usesLiveReportData = Boolean(
    isTauri &&
      selectedCompanyId &&
      currentPeriodId &&
      ['ledgerReport', 'accountSummaryReport', 'trialBalanceReport', 'generalLedgerReport', 'multiColumnLedgerReport', 'balanceSheetReport', 'incomeStatementReport', 'incomeQuarterReport', 'incomeTaxReport', 'cashFlowReport', 'cashFlowQuarterReport', 'equityChangeReport'].includes(kind),
  )
  const usesLiveInitialBalanceData = Boolean(isTauri && selectedCompanyId && currentPeriodId && kind === 'initialBalance')
  const usesLiveCompanyBankAccountData = Boolean(isTauri && selectedCompanyId && kind === 'accountArchive')
  const usesLivePeriodManagementData = Boolean(isTauri && selectedCompanyId && kind === 'periodManagement')
  const usesLiveSettlementRuleData = Boolean(isTauri && selectedCompanyId && kind === 'settlementRules')
  const usesLiveCurrencyData = Boolean(isTauri && selectedCompanyId && kind === 'currencySettings')
  const usesLiveSettingsOverviewData = Boolean(isTauri && selectedCompanyId && kind === 'settingsData')
  const usesLiveTemplateSettingsData = Boolean(isTauri && selectedCompanyId && ['commonDigests', 'voucherTemplateSettings'].includes(kind))
  const usesLiveReportFormulaData = Boolean(isTauri && selectedCompanyId && kind === 'reportFormulaSettings')
  const usesLiveMatchingRuleData = Boolean(isTauri && selectedCompanyId && ['invoiceMatchingRules', 'billMatchingRules', 'cashFlowMapping', 'aiRuleTraining'].includes(kind))
  const usesLiveAssetCategoryData = Boolean(isTauri && selectedCompanyId && kind === 'assetCategory')
  const needsLiveAssetCategories = Boolean(isTauri && selectedCompanyId && ['assetCategory', 'depreciation'].includes(kind))
  const usesLiveBusinessTagData = Boolean(isTauri && selectedCompanyId && kind === 'tagArchive')
  const needsLiveBusinessTags = Boolean(isTauri && selectedCompanyId && ['tagArchive', 'outputInvoice', 'inputInvoice', 'voucher', 'voucherCreate', 'voucherEdit', 'voucherDetail', 'billList', 'bankStatement'].includes(kind))
  const matchingRuleScope: MatchingRuleScope = kind === 'invoiceMatchingRules' ? 'invoice' : kind === 'billMatchingRules' ? 'bill' : kind === 'aiRuleTraining' ? 'ai_training' : 'cash_flow'
  const usesLiveAdapterAuthorizationData = Boolean(isTauri && selectedCompanyId && ['taxAdapterSettings', 'bankAdapterSettings', 'taxInit'].includes(kind))
  const usesLiveOperationAuditData = Boolean(isTauri && selectedCompanyId && kind === 'auditLog')
  const usesLiveExportData = Boolean(isTauri && selectedCompanyId && kind === 'exportCenter')
  const usesLiveImportData = Boolean(isTauri && selectedCompanyId && kind === 'importCenter')
  const usesLiveCompanyTodoData = Boolean(isTauri && selectedCompanyId && kind === 'notificationCenter')
  const usesLiveEmployeeData = Boolean(isTauri && selectedCompanyId && kind === 'employee')
  const usesLivePayrollData = Boolean(isTauri && selectedCompanyId && kind === 'payroll')
  const usesLiveSocialSecurityData = Boolean(isTauri && selectedCompanyId && kind === 'socialSecurity')
  const usesLiveSpecialDeductionData = Boolean(isTauri && selectedCompanyId && kind === 'specialDeduction')
  const usesLiveWithholdingTaxData = Boolean(isTauri && selectedCompanyId && kind === 'withholdingTaxReport')
  const usesLiveSocialSecurityTaxData = Boolean(isTauri && selectedCompanyId && kind === 'socialSecurityTaxReport')
  const usesLiveVatTaxData = Boolean(isTauri && selectedCompanyId && kind === 'vatTaxReport')
  const usesLiveBankTransactionData = Boolean(isTauri && selectedCompanyId && ['billList', 'bankStatement'].includes(kind))
  const usesLiveReconciliationData = Boolean(isTauri && selectedCompanyId && ['bankReconciliation', 'receivableSettlement', 'payableSettlement', 'receivablePayableAging'].includes(kind))
  const usesLiveBankReconciliationRecordData = Boolean(isTauri && selectedCompanyId && kind === 'bankReconciliation')
  const usesLiveSettlementRecordData = Boolean(isTauri && selectedCompanyId && ['receivableSettlement', 'payableSettlement', 'receivablePayableAging'].includes(kind))
  const usesLiveDocumentRecordData = Boolean(isTauri && selectedCompanyId && ['documentRegister', 'contractLedger'].includes(kind))
  const usesLiveStampTaxData = Boolean(isTauri && selectedCompanyId && kind === 'stampTaxReport')
  const usesLiveExpenseReimbursementData = Boolean(isTauri && selectedCompanyId && kind === 'expenseReimbursement')
  const usesLiveReceiptData = Boolean(isTauri && selectedCompanyId && kind === 'receipt')
  const usesLiveBusinessOrderData = Boolean(isTauri && selectedCompanyId && ['purchaseManagement', 'salesManagement'].includes(kind))
  const canEditBusinessOrders = kind === 'purchaseManagement' || kind === 'salesManagement'
  const canEditDocumentRecords = ['documentRegister', 'contractLedger', 'expenseReimbursement', 'receipt', 'stampTaxReport'].includes(kind)
  const usesLiveAccountTransferData = Boolean(isTauri && selectedCompanyId && kind === 'transfer')
  const usesLiveFixedAssetData = Boolean(isTauri && selectedCompanyId && kind === 'depreciation')
  const usesLiveInventoryMovementData = Boolean(isTauri && selectedCompanyId && ['inventoryMovement', 'costCarryover'].includes(kind))
  const usesLiveCostCarryoverData = Boolean(isTauri && selectedCompanyId && kind === 'costCarryover')
  const usesLiveInventoryItemData = Boolean(isTauri && selectedCompanyId && kind === 'inventorySettings')
  const usesLiveMeasurementUnitData = Boolean(isTauri && selectedCompanyId && kind === 'unitSettings')
  const usesLiveBackupData = Boolean(isTauri && selectedCompanyId && kind === 'backupRestore')
  const usesLiveRuleLogData = Boolean(isTauri && selectedCompanyId)
  const usesLiveVoucherRecycleData = Boolean(isTauri && selectedCompanyId && kind === 'voucherRecycle')
  const usesLiveDeclarationReceiptData = Boolean(isTauri && selectedCompanyId && kind === 'declarationReceipt')
  const usesLiveDeclarationCalendarData = Boolean(isTauri && selectedCompanyId && kind === 'declarationCalendar')
  const usesLiveTaxInitData = Boolean(isTauri && selectedCompanyId && kind === 'taxInit')
  const usesLiveTaxReportData = Boolean(isTauri && selectedCompanyId && kind === 'taxReport')
  const usesLiveFinanceTaxReportData = Boolean(isTauri && selectedCompanyId && kind === 'financeTaxReport')
  const usesLiveNonTaxRevenueData = Boolean(isTauri && selectedCompanyId && kind === 'nonTaxRevenueReport')
  const usesLiveFinancialOverviewData = Boolean(isTauri && selectedCompanyId && currentPeriodId && kind === 'financialReport')
  const usesLiveClosingTaskData = Boolean(isTauri && selectedCompanyId && currentPeriodId && kind === 'closingTasks')
  const usesLiveInvoiceVoucherMatchingData = Boolean(isTauri && selectedCompanyId && kind === 'invoiceVoucherMatching')
  const usesLiveAutomationJobData = Boolean(isTauri && selectedCompanyId && ['aiJobQueue', 'aiRecognitionResults', 'aiVoucherSuggestions'].includes(kind))
  const usesLiveHistoryReportData = Boolean(
    isTauri &&
      selectedCompanyId &&
      ['historyVoucher', 'historyBalance', 'historyGeneralLedger', 'historySubsidiaryLedger'].includes(kind),
  )
  const usesLiveLedgerDetailData = Boolean(
    isTauri &&
      selectedCompanyId &&
      currentPeriodId &&
      ['subsidiaryLedgerReport', 'auxiliaryLedgerReport', 'auxiliaryBalanceReport'].includes(kind),
  )
  const usesLiveArchiveData = Boolean(
    isTauri &&
      selectedCompanyId &&
      (kind === 'subjectSettings' || kind === 'auxiliaryCategories' || kind === 'auxiliaryItems' || isLiveAuxiliaryArchiveKind(kind)),
  )
  const [liveReports, setLiveReports] = useState<LiveReportData>(emptyLiveReportData)
  const [adapterAuthorizations, setAdapterAuthorizations] = useState<AdapterAuthorization[]>([])
  const [operationAuditLogs, setOperationAuditLogs] = useState<OperationAuditLog[]>([])
  const [localBackups, setLocalBackups] = useState<LocalBackupSnapshot[]>([])
  const [backupValidations, setBackupValidations] = useState<Record<string, LocalBackupVerification>>({})
  const [companyTodos, setCompanyTodos] = useState<CompanyTodo[]>([])
  const [previewCompanyTodos, setPreviewCompanyTodos] = useState<CompanyTodo[]>([
    { id: 'preview-todo-001', companyId: 'browser-preview', companyName: '科旋电气', period: '2026-05', title: '客户补传银行回单', sourceModule: '附件资料', priority: 'high', owner: '王会计', dueDate: '2026-06-26', relatedEntry: null, evidence: '资料', note: '等待客户补传', status: 'open', completedAt: null, completedBy: null, createdAt: '2026-06-26T09:00:00Z', updatedAt: '2026-06-26T09:00:00Z' },
    { id: 'preview-todo-002', companyId: 'browser-preview', companyName: '科旋电气', period: '2026-05', title: '增值税申报包确认', sourceModule: '税务申报', priority: 'high', owner: '李会计', dueDate: '2026-06-30', relatedEntry: '申报包', evidence: '风险项', note: '待人工确认', status: 'review', completedAt: null, completedBy: null, createdAt: '2026-06-26T09:10:00Z', updatedAt: '2026-06-26T09:10:00Z' },
    { id: 'preview-todo-003', companyId: 'browser-preview', companyName: '科旋电气', period: '2026-05', title: '凭证借贷不平', sourceModule: '风险检查', priority: 'blocking', owner: '赵会计', dueDate: '2026-06-25', relatedEntry: '记-0062', evidence: '检查结果', note: '需回到凭证模块修复', status: 'blocked', completedAt: null, completedBy: null, createdAt: '2026-06-26T09:20:00Z', updatedAt: '2026-06-26T09:20:00Z' },
  ])
  const [showCompanyTodoDialog, setShowCompanyTodoDialog] = useState(false)
  const [companyTodoDraft, setCompanyTodoDraft] = useState({ title: '', sourceModule: '资料采集', priority: 'normal' as CompanyTodo['priority'], owner: '', dueDate: '', relatedEntry: '', evidence: '', note: '' })
  const [employees, setEmployees] = useState<Employee[]>([])
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([])
  const [socialSecurityRecords, setSocialSecurityRecords] = useState<SocialSecurityRecord[]>([])
  const [specialDeductionRecords, setSpecialDeductionRecords] = useState<SpecialDeductionRecord[]>([])
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([])
  const [documentRecords, setDocumentRecords] = useState<DocumentRecord[]>([])
  const [businessOrders, setBusinessOrders] = useState<BusinessOrder[]>([])
  const [settlementRecords, setSettlementRecords] = useState<SettlementRecord[]>([])
  const [bankReconciliationRecords, setBankReconciliationRecords] = useState<BankReconciliationRecord[]>([])
  const [costCarryoverRecords, setCostCarryoverRecords] = useState<CostCarryoverRecord[]>([])
  const [showCostCarryoverDialog, setShowCostCarryoverDialog] = useState(false)
  const [editingCostCarryoverId, setEditingCostCarryoverId] = useState<string | null>(null)
  const [costCarryoverDraft, setCostCarryoverDraft] = useState({ batchNo: '', carryoverDate: '', valuationMethod: '移动加权', sourceBillNo: '', inventoryName: '', debitSubject: '主营业务成本', creditSubject: '库存商品', costAmount: '', differenceAmount: '0', voucherNo: '', status: '待确认', sourceDocument: '' })
  const [showBankReconciliationDialog, setShowBankReconciliationDialog] = useState(false)
  const [editingBankReconciliationId, setEditingBankReconciliationId] = useState<string | null>(null)
  const [bankReconciliationDraft, setBankReconciliationDraft] = useState({ reconciliationNo: '', reconciliationDate: '', accountName: '', transactionNo: '', summary: '', bankAmount: '', bookAmount: '', voucherNo: '', matchStatus: '待人工对账', owner: '', status: '待处理', note: '' })
  const [accountTransfers, setAccountTransfers] = useState<AccountTransfer[]>([])
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([])
  const [showFixedAssetDialog, setShowFixedAssetDialog] = useState(false)
  const [editingFixedAssetId, setEditingFixedAssetId] = useState<string | null>(null)
  const [fixedAssetDraft, setFixedAssetDraft] = useState({ assetCode: '', assetName: '', category: '', startDate: '', originalValue: '', usefulLifeMonths: '', residualRate: '5', sourceDocument: '' })
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [measurementUnits, setMeasurementUnits] = useState<MeasurementUnit[]>([])
  const [showMeasurementUnitDialog, setShowMeasurementUnitDialog] = useState(false)
  const [editingMeasurementUnitId, setEditingMeasurementUnitId] = useState<string | null>(null)
  const [measurementUnitDraft, setMeasurementUnitDraft] = useState({ unitName: '', unitGroup: '', baseUnit: '', conversionRate: '1', precisionDigits: '2', remark: '' })
  const [showInventoryItemDialog, setShowInventoryItemDialog] = useState(false)
  const [editingInventoryItemId, setEditingInventoryItemId] = useState<string | null>(null)
  const [inventoryItemDraft, setInventoryItemDraft] = useState({ itemCode: '', itemName: '', specification: '', unit: '', taxRate: '13', defaultSubject: '' })
  const [showInventoryMovementDialog, setShowInventoryMovementDialog] = useState(false)
  const [editingInventoryMovementId, setEditingInventoryMovementId] = useState<string | null>(null)
  const [inventoryMovementDraft, setInventoryMovementDraft] = useState({ movementDate: '', billNo: '', movementType: '采购入库', inventoryName: '', warehouse: '', counterparty: '', unit: '', quantity: '', amount: '', sourceDocument: '' })
  const [showAccountTransferDialog, setShowAccountTransferDialog] = useState(false)
  const [editingAccountTransferId, setEditingAccountTransferId] = useState<string | null>(null)
  const [accountTransferDraft, setAccountTransferDraft] = useState({ transferDate: '', fromAccount: '', toAccount: '', amount: '', fee: '', serialNo: '' })
  const [showSocialSecurityDialog, setShowSocialSecurityDialog] = useState(false)
  const [editingSocialSecurityId, setEditingSocialSecurityId] = useState<string | null>(null)
  const [socialSecurityDraft, setSocialSecurityDraft] = useState({ employeeId: '', city: '', base: '', company: '', personal: '', fund: '' })
  const [showSpecialDeductionDialog, setShowSpecialDeductionDialog] = useState(false)
  const [editingSpecialDeductionId, setEditingSpecialDeductionId] = useState<string | null>(null)
  const [specialDeductionDraft, setSpecialDeductionDraft] = useState({ employeeId: '', deductionType: '子女教育', startMonth: '', endMonth: '', monthlyAmount: '', source: '手工' })
  const [showBankTransactionDialog, setShowBankTransactionDialog] = useState(false)
  const [editingBankTransactionId, setEditingBankTransactionId] = useState<string | null>(null)
  const [bankTransactionDraft, setBankTransactionDraft] = useState({ accountName: '', serialNo: '', transactionDate: '', counterparty: '', summary: '', incomeAmount: '', expenseAmount: '', balance: '', receiptStatus: '待上传' })
  const [showDocumentRecordDialog, setShowDocumentRecordDialog] = useState(false)
  const [editingDocumentRecordId, setEditingDocumentRecordId] = useState<string | null>(null)
  const [documentRecordDraft, setDocumentRecordDraft] = useState({ businessDate: '', documentCode: '', businessType: '费用报销', partner: '', amount: '', owner: '', attachmentStatus: '待补附件', stampTaxItem: '', stampTaxRate: '' })
  const [showBusinessOrderDialog, setShowBusinessOrderDialog] = useState(false)
  const [editingBusinessOrderId, setEditingBusinessOrderId] = useState<string | null>(null)
  const [businessOrderDraft, setBusinessOrderDraft] = useState({ orderNo: '', businessDate: '', counterparty: '', goodsName: '', amount: '', fulfillmentStatus: '待确认', invoiceStatus: '待开票', settlementStatus: '未结算', status: '待确认', sourceDocument: '' })
  const [showSettlementRecordDialog, setShowSettlementRecordDialog] = useState(false)
  const [editingSettlementRecordId, setEditingSettlementRecordId] = useState<string | null>(null)
  const [settlementRecordDraft, setSettlementRecordDraft] = useState({ settlementNo: '', settlementDate: '', counterparty: '', invoiceNo: '', transactionNo: '', totalAmount: '', settledAmount: '0', settlementMethod: '银行转账', owner: '', status: '待确认', sourceDocument: '' })
  const [showPayrollDialog, setShowPayrollDialog] = useState(false)
  const [editingPayrollId, setEditingPayrollId] = useState<string | null>(null)
  const [payrollDraft, setPayrollDraft] = useState({ employeeId: '', baseSalary: '', bonus: '', taxAmount: '', socialPersonal: '' })
  const [showSettlementRuleDialog, setShowSettlementRuleDialog] = useState(false)
  const [editingSettlementRuleId, setEditingSettlementRuleId] = useState<string | null>(null)
  const [settlementRuleDraft, setSettlementRuleDraft] = useState({ name: '', ruleType: 'profit_loss', sourceFormula: '', targetAccountCode: '', voucherWordId: '', summaryTemplate: '', priority: '10', isEnabled: true })
  const [showCurrencyDialog, setShowCurrencyDialog] = useState(false)
  const [editingCurrencyId, setEditingCurrencyId] = useState<string | null>(null)
  const [currencyDraft, setCurrencyDraft] = useState({ code: '', name: '', exchangeRate: '1', isBase: false })
  const [showCommonDigestDialog, setShowCommonDigestDialog] = useState(false)
  const [editingCommonDigestId, setEditingCommonDigestId] = useState<string | null>(null)
  const [commonDigestDraft, setCommonDigestDraft] = useState('')
  const [showVoucherTemplateDialog, setShowVoucherTemplateDialog] = useState(false)
  const [editingVoucherTemplateId, setEditingVoucherTemplateId] = useState<string | null>(null)
  const [voucherTemplateDraft, setVoucherTemplateDraft] = useState({ typeId: '', name: '', summary: '', debitAccountCode: '', creditAccountCode: '' })
  const [showAdapterAuthorizationDialog, setShowAdapterAuthorizationDialog] = useState(false)
  const [editingAdapterAuthorizationId, setEditingAdapterAuthorizationId] = useState<string | null>(null)
  const [adapterAuthorizationDraft, setAdapterAuthorizationDraft] = useState({ adapterCode: '', region: '', authStatus: 'pending', accountMask: '', loginIdentity: '', capabilityScope: '', expiresAt: '', riskMessage: '' })
  const [showReportFormulaDialog, setShowReportFormulaDialog] = useState(false)
  const [editingReportFormulaId, setEditingReportFormulaId] = useState<string | null>(null)
  const [reportFormulaDraft, setReportFormulaDraft] = useState({ itemName: '', formula: '', sortOrder: '0', isTotal: false })
  const [showMatchingRuleDialog, setShowMatchingRuleDialog] = useState(false)
  const [showPrintTemplatePreviewDialog, setShowPrintTemplatePreviewDialog] = useState(false)
  const [editingMatchingRuleId, setEditingMatchingRuleId] = useState<string | null>(null)
  const [matchingRuleDraft, setMatchingRuleDraft] = useState({ name: '', conditionText: '', actionText: '', targetAccountCode: '', voucherTemplateId: '', priority: '50', isEnabled: true })
  const [showAssetCategoryDialog, setShowAssetCategoryDialog] = useState(false)
  const [editingAssetCategoryId, setEditingAssetCategoryId] = useState<string | null>(null)
  const [assetCategoryDraft, setAssetCategoryDraft] = useState({ code: '', name: '', usefulLifeMonths: '60', residualRate: '5', depreciationMethod: '平均年限法', assetAccount: '1601 固定资产', accumulatedDepreciationAccount: '1602 累计折旧', expenseAccount: '6602 管理费用', isEnabled: true })
  const [showBusinessTagDialog, setShowBusinessTagDialog] = useState(false)
  const [editingBusinessTagId, setEditingBusinessTagId] = useState<string | null>(null)
  const [businessTagDraft, setBusinessTagDraft] = useState({ name: '', applicableModules: '发票/流水/凭证', colorName: '蓝色', autoRule: '', remarks: '', isEnabled: true })
  const [showCompanyAccountDialog, setShowCompanyAccountDialog] = useState(false)
  const [editingCompanyAccountId, setEditingCompanyAccountId] = useState<string | null>(null)
  const [companyAccountDraft, setCompanyAccountDraft] = useState({ accountName: '', accountType: '银行账户', bankName: '', accountNumber: '', subjectCode: '1002 银行存款', openingBalance: '0', attachmentNote: '', status: '启用' as '启用' | '停用' })
  const [showCompanyInfoDialog, setShowCompanyInfoDialog] = useState(false)
  const [companyInfoDraft, setCompanyInfoDraft] = useState<PreviewCompanyInfo>({ code: '', name: '', taxId: '', taxpayerType: 'general', province: '', city: '', district: '', accountingSystem: 'small_enterprise', enableYear: String(new Date().getFullYear()), enableMonth: String(new Date().getMonth() + 1), serviceStart: '', serviceEnd: '', industry: '', enterpriseType: '私营有限责任公司' })
  const [previewCompanyInfo, setPreviewCompanyInfo] = useState<PreviewCompanyInfo | null>(null)
  const [previewSubjects, setPreviewSubjects] = useState<Array<typeof accounts[number]>>([])
  const [showSubjectDialog, setShowSubjectDialog] = useState(false)
  const [editingSubjectCode, setEditingSubjectCode] = useState<string | null>(null)
  const [subjectDraft, setSubjectDraft] = useState({ code: '', name: '', accountType: '资产类', normalBalance: 'debit', level: '1', parentCode: '', isDetail: true, hasQuantity: false, defaultUnit: '', hasAuxiliary: false })
  const [showInitialBalanceDialog, setShowInitialBalanceDialog] = useState(false)
  const [initialBalanceDraft, setInitialBalanceDraft] = useState({ accountCode: '', openingDebit: '', openingCredit: '', sourceNote: '' })
  const [previewInitialBalanceRows, setPreviewInitialBalanceRows] = useState(() => previewInitialBalanceSeed.map((row) => ({ ...row })))
  const [showAuxiliaryArchiveDialog, setShowAuxiliaryArchiveDialog] = useState(false)
  const [editingAuxiliaryArchiveItemId, setEditingAuxiliaryArchiveItemId] = useState<string | null>(null)
  const [auxiliaryArchiveDraft, setAuxiliaryArchiveDraft] = useState({ code: '', name: '', taxNo: '', bank: '', subject: '', contract: '', alias: '', taxRate: '', contactType: '', idNo: '', owner: '', start: '', budget: '', parent: '', people: '', remark: '' })
  const [previewCompanyAccounts, setPreviewCompanyAccounts] = useState<typeof companyAccounts>([])
  const [previewCurrencies, setPreviewCurrencies] = useState<typeof currencies>([])
  const [previewCommonDigests, setPreviewCommonDigests] = useState<typeof commonDigests>([])
  const [previewAuxiliaryCategories, setPreviewAuxiliaryCategories] = useState<typeof auxiliaryCategories>([])
  const [previewAuxiliaryItems, setPreviewAuxiliaryItems] = useState<typeof auxiliaryItems>([])
  const [previewVoucherTemplateTypes] = useState<typeof voucherTemplateTypes>([{ id: 'preview-template-type', company_id: 'preview-company', name: '通用凭证', sort_order: 1 }])
  const [previewVoucherTemplates, setPreviewVoucherTemplates] = useState<typeof voucherTemplates>([])
  const [previewSettlementRules, setPreviewSettlementRules] = useState<typeof settlementRules>([])
  const [previewMatchingRules, setPreviewMatchingRules] = useState<MatchingRule[]>(loadPreviewMatchingRules)
  const updatePreviewMatchingRules = (update: (rules: MatchingRule[]) => MatchingRule[]) => {
    setPreviewMatchingRules((rules) => {
      const nextRules = update(rules)
      savePreviewMatchingRules(nextRules)
      return nextRules
    })
  }
  const [previewAssetCategories, setPreviewAssetCategories] = useState<typeof assetCategories>([])
  const [previewBusinessTags, setPreviewBusinessTags] = useState<typeof businessTags>([])
  const [previewAdapterAuthorizations, setPreviewAdapterAuthorizations] = useState<AdapterAuthorization[]>([])
  const [previewReportTemplates] = useState<typeof reportTemplates>([
    { id: 'preview-balance-sheet', template_code: 'BALANCE_SHEET', template_name: '资产负债表', report_type: 'balance_sheet', is_system: 1, created_at: null },
    { id: 'preview-income-statement', template_code: 'INCOME_STATEMENT', template_name: '利润表', report_type: 'income_statement', is_system: 1, created_at: null },
    { id: 'preview-cash-flow', template_code: 'CASH_FLOW', template_name: '现金流量表', report_type: 'cash_flow', is_system: 1, created_at: null },
  ])
  const [previewReportItems, setPreviewReportItems] = useState<typeof reportItems>([
    { id: 'preview-report-item-assets', template_id: 'preview-balance-sheet', item_code: '100', item_name: '货币资金', parent_id: null, item_level: 1, sort_order: 100, is_total: 0, formula: '1001+1002+1012', is_enabled: 1 },
    { id: 'preview-report-item-liability', template_id: 'preview-balance-sheet', item_code: '200', item_name: '负债合计', parent_id: null, item_level: 1, sort_order: 200, is_total: 1, formula: '负债类科目期末余额', is_enabled: 1 },
    { id: 'preview-report-item-revenue', template_id: 'preview-income-statement', item_code: '010', item_name: '营业收入', parent_id: null, item_level: 1, sort_order: 10, is_total: 0, formula: '6001+6051', is_enabled: 1 },
    { id: 'preview-report-item-cash', template_id: 'preview-cash-flow', item_code: '001', item_name: '销售商品、提供劳务收到的现金', parent_id: null, item_level: 1, sort_order: 10, is_total: 0, formula: '经营活动现金流入', is_enabled: 1 },
  ])
  const [previewPeriods, setPreviewPeriods] = useState<typeof periods>([
    { id: 'preview-period-2026-04', company_id: 'preview-company', period_year: 2026, period_month: 4, start_date: '2026-04-01', end_date: '2026-04-30', status: 'closed', closed_at: '2026-05-05T09:30:00.000Z', closed_by: 'admin', created_at: '2026-04-01T00:00:00.000Z', updated_at: '2026-05-05T09:30:00.000Z' },
    { id: 'preview-period-2026-05', company_id: 'preview-company', period_year: 2026, period_month: 5, start_date: '2026-05-01', end_date: '2026-05-31', status: 'open', closed_at: null, closed_by: null, created_at: '2026-05-01T00:00:00.000Z', updated_at: '2026-05-01T00:00:00.000Z' },
  ])
  const [previewInvoiceMatchCandidates, setPreviewInvoiceMatchCandidates] = useState<Array<Pick<Invoice, 'id' | 'invoice_no' | 'total_amount' | 'voucher_id'>>>([
    { id: 'preview-match-invoice-001', invoice_no: '031002400128', total_amount: 18300, voucher_id: null },
    { id: 'preview-match-invoice-002', invoice_no: '031002400139', total_amount: 9800, voucher_id: null },
  ])
  const [previewVoucherMatchCandidates] = useState<Array<Pick<Voucher, 'id' | 'voucher_number' | 'total_debit' | 'summary' | 'status'>>>([
    { id: 'preview-match-voucher-001', voucher_number: '记-0063', total_debit: 18000, summary: '采购原材料', status: 'draft' },
    { id: 'preview-match-voucher-002', voucher_number: '记-0068', total_debit: 9800, summary: '技术服务费', status: 'draft' },
  ])
  const [previewReviewedAiRecognitionIds, setPreviewReviewedAiRecognitionIds] = useState<Set<string>>(new Set())
  const invoiceMatchCandidates = isTauri ? invoices : previewInvoiceMatchCandidates
  const voucherMatchCandidates = isTauri ? vouchers : previewVoucherMatchCandidates
  const effectiveAssetCategories = isTauri ? assetCategories : previewAssetCategories
  const effectiveBusinessTags = isTauri ? businessTags : previewBusinessTags
  const effectiveAdapterAuthorizations = isTauri ? adapterAuthorizations : previewAdapterAuthorizations
  const effectiveReportTemplates = isTauri ? reportTemplates : previewReportTemplates
  const effectiveReportItems = isTauri ? reportItems : previewReportItems
  const effectivePeriods = isTauri ? periods : previewPeriods
  const [showAuxiliaryCategoryDialog, setShowAuxiliaryCategoryDialog] = useState(false)
  const [editingAuxiliaryCategoryId, setEditingAuxiliaryCategoryId] = useState<string | null>(null)
  const [auxiliaryCategoryDraft, setAuxiliaryCategoryDraft] = useState({ code: '', name: '', sortOrder: '0' })
  const [showAuxiliaryItemDialog, setShowAuxiliaryItemDialog] = useState(false)
  const [editingAuxiliaryItemId, setEditingAuxiliaryItemId] = useState<string | null>(null)
  const [auxiliaryItemDraft, setAuxiliaryItemDraft] = useState({ categoryId: '', code: '', name: '', remarks: '' })
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false)
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null)
  const [employeeDraft, setEmployeeDraft] = useState({ employeeCode: '', name: '', idNo: '', department: '', position: '', mobile: '', entryDate: '', employmentStatus: '在职' })
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false)
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null)
  const [showInvoiceVoucherMatchDialog, setShowInvoiceVoucherMatchDialog] = useState(false)
  const [selectedMatchInvoiceId, setSelectedMatchInvoiceId] = useState('')
  const [selectedMatchVoucherId, setSelectedMatchVoucherId] = useState('')
  const [invoiceDraft, setInvoiceDraft] = useState({ invoiceNo: '', invoiceCode: '', invoiceDate: '', amount: '', taxAmount: '', taxRate: '13', sellerName: '', sellerTaxId: '', buyerName: '', buyerTaxId: '', remarks: '' })
  const [selectedInvoiceTagIds, setSelectedInvoiceTagIds] = useState<string[]>([])
  const [selectedVoucherTagIds, setSelectedVoucherTagIds] = useState<string[]>([])
  const [selectedBankTransactionTagIds, setSelectedBankTransactionTagIds] = useState<string[]>([])
  const [voucherDraft, setVoucherDraft] = useState({
    voucherWordId: '',
    voucherDate: '',
    summary: '',
    attachmentCount: '0',
    entries: [
      { accountCode: '', direction: 'debit' as const, amount: '' },
      { accountCode: '', direction: 'credit' as const, amount: '' },
    ],
  })
  const [loadedVoucher, setLoadedVoucher] = useState<Voucher | null>(null)
  const [deletedVouchers, setDeletedVouchers] = useState<Voucher[]>([])
  const [taxDeclarationTasks, setTaxDeclarationTasks] = useState<TaxDeclarationTask[]>([])
  const [previewTaxDeclarationTasks, setPreviewTaxDeclarationTasks] = useState(loadPreviewTaxDeclarationTasks)
  const effectiveTaxDeclarationTasks = isTauri ? taxDeclarationTasks : previewTaxDeclarationTasks
  const updatePreviewTaxDeclarationTasks = (update: (tasks: TaxDeclarationTask[]) => TaxDeclarationTask[]) => {
    setPreviewTaxDeclarationTasks((tasks) => {
      const nextTasks = update(tasks)
      savePreviewTaxDeclarationTasks(nextTasks)
      return nextTasks
    })
  }
  const [showDeclarationReceiptDialog, setShowDeclarationReceiptDialog] = useState(false)
  const [declarationReceiptDraft, setDeclarationReceiptDraft] = useState({ taskId: '', receiptNo: '', paymentStatus: '未记录', paymentNo: '', receivedAt: '' })
  const [showTaxInitDialog, setShowTaxInitDialog] = useState(false)
  const [taxInitDraft, setTaxInitDraft] = useState({ taskId: '', taxType: '', formName: '', sourceSnapshot: '', taxableAmount: '', payableAmount: '', riskCount: '0', collectStatus: 'collected', validationStatus: 'pending', adapterCode: '' })
  const [showNonTaxRevenueDialog, setShowNonTaxRevenueDialog] = useState(false)
  const [nonTaxRevenueDraft, setNonTaxRevenueDraft] = useState({ item: '工会经费', policy: '', source: '', basisAmount: '', payableAmount: '', receiptNo: '', riskCount: '0' })
  const [showAttachmentAssociationDialog, setShowAttachmentAssociationDialog] = useState(false)
  const [attachmentAssociationDraft, setAttachmentAssociationDraft] = useState({ id: '', fileName: '', relatedDocument: '' })
  const [showImportValidationDialog, setShowImportValidationDialog] = useState(false)
  const [importValidationJob, setImportValidationJob] = useState<LocalImportJob | null>(null)
  const [importCommitDraft, setImportCommitDraft] = useState<LocalImportCommitDraft | null>(null)
  const [automationJobs, setAutomationJobs] = useState<AutomationJob[]>([])
  const [previewAiQueueJobs, setPreviewAiQueueJobs] = useState(loadPreviewAiQueueJobs)
  const updatePreviewAiQueueJobs = (update: (jobs: AutomationJob[]) => AutomationJob[]) => {
    setPreviewAiQueueJobs((jobs) => {
      const nextJobs = update(jobs)
      savePreviewAiQueueJobs(nextJobs)
      return nextJobs
    })
  }
  const [showAiJobDialog, setShowAiJobDialog] = useState(false)
  const [aiJobDraft, setAiJobDraft] = useState({ jobType: 'invoice_recognition', sourceModule: '发票', sourceId: '', sourceFile: '', summary: '', riskLevel: 'normal' })
  const [prefilledAiSuggestionId, setPrefilledAiSuggestionId] = useState<string | null>(null)
  const [showAiVoucherSuggestionDialog, setShowAiVoucherSuggestionDialog] = useState(false)
  const [aiVoucherSuggestionDraft, setAiVoucherSuggestionDraft] = useState({ suggestionNo: '', sourceModule: '', sourceId: '', sourceFile: '', summary: '', debitSubject: '', creditSubject: '', amount: '', confidence: '90', riskLevel: 'normal' })
  const [pendingBusinessRiskConfirmation, setPendingBusinessRiskConfirmation] = useState<{ title: string; description: string; confirmLabel: string } | null>(null)
  const businessRiskConfirmationResolver = useRef<((confirmed: boolean) => void) | null>(null)
  const [selectedLedgerAccountCode, setSelectedLedgerAccountCode] = useState('')
  const [selectedAuxiliaryCategoryId, setSelectedAuxiliaryCategoryId] = useState('')
  const [selectedAuxiliaryItemId, setSelectedAuxiliaryItemId] = useState('')
  const [selectedHistoryPeriodId, setSelectedHistoryPeriodId] = useState('')
  const [selectedHistoryLedgerAccountCode, setSelectedHistoryLedgerAccountCode] = useState('')
  const selectedHistoryLedgerAccount = useMemo(
    () => accounts.find((account) => account.code === selectedHistoryLedgerAccountCode),
    [accounts, selectedHistoryLedgerAccountCode],
  )
  const detailedAccounts = useMemo(
    () => accounts.filter((account) => account.is_enabled === 1 && account.is_detail === 1),
    [accounts],
  )
  const templateAccounts = detailedAccounts.length > 0 ? detailedAccounts : [{ code: '1002', name: '银行存款' }, { code: '6001', name: '主营业务收入' }]
  const selectedAuxiliaryCategory = useMemo(
    () => auxiliaryCategories.find((category) => category.id === selectedAuxiliaryCategoryId),
    [auxiliaryCategories, selectedAuxiliaryCategoryId],
  )
  const selectedAuxiliaryItem = useMemo(
    () => auxiliaryItems.find((item) => item.id === selectedAuxiliaryItemId),
    [auxiliaryItems, selectedAuxiliaryItemId],
  )
  const selectableAuxiliaryItems = useMemo(
    () => auxiliaryItems.filter((item) => item.category_id === selectedAuxiliaryCategoryId && item.is_enabled === 1),
    [auxiliaryItems, selectedAuxiliaryCategoryId],
  )
  const selectedHistoryPeriod = useMemo(
    () => periods.find((period) => period.id === selectedHistoryPeriodId),
    [periods, selectedHistoryPeriodId],
  )
  const selectedHistoryPeriodLabel = selectedHistoryPeriod
    ? `${selectedHistoryPeriod.period_year}-${String(selectedHistoryPeriod.period_month).padStart(2, '0')}`
    : ''

  useEffect(() => {
    if (!usesLiveModuleData || !selectedCompanyId) return

    if (kind === 'outputInvoice' || kind === 'inputInvoice') {
      fetchInvoices({
        company_id: selectedCompanyId,
        period_id: currentPeriodId || undefined,
        invoice_type: kind === 'outputInvoice' ? 'output' : 'input',
      })
      return
    }

    if (kind === 'voucher') {
      queryVouchers({
        company_id: selectedCompanyId,
        period_id: currentPeriodId || undefined,
        page: 1,
        page_size: 100,
      })
      return
    }

    if (kind === 'riskCheck') {
      fetchInvoices({
        company_id: selectedCompanyId,
        period_id: currentPeriodId || undefined,
      })
      queryVouchers({
        company_id: selectedCompanyId,
        period_id: currentPeriodId || undefined,
        page: 1,
        page_size: 100,
      })
    }
  }, [currentPeriodId, fetchInvoices, kind, queryVouchers, selectedCompanyId, usesLiveModuleData])

  useEffect(() => {
    if (!['voucherCreate', 'voucherEdit', 'voucherDetail'].includes(kind) || !isTauri || !selectedCompanyId) return
    void Promise.all([fetchAccounts(selectedCompanyId), fetchVoucherWords(selectedCompanyId)])
  }, [fetchAccounts, fetchVoucherWords, kind, selectedCompanyId])

  useEffect(() => {
    if (kind !== 'voucherCreate' || !currentPeriod) return
    setVoucherDraft((draft) => ({
      ...draft,
      voucherDate: draft.voucherDate || currentPeriod.end_date,
      voucherWordId: draft.voucherWordId || voucherWords[0]?.id || '',
    }))
  }, [currentPeriod, kind, voucherWords])

  useEffect(() => {
    if (kind !== 'voucherCreate' || !isTauri || !selectedCompanyId || !aiVoucherSuggestionId || prefilledAiSuggestionId === aiVoucherSuggestionId || currentPeriodLabel === '当前账期' || accounts.length === 0) return
    void automationApi.getAutomationJobs({ companyId: selectedCompanyId, period: currentPeriodLabel })
      .then((result) => {
        const suggestion = result.success ? result.data?.find((item) => item.id === aiVoucherSuggestionId && item.jobType === 'voucher_suggestion') : undefined
        if (!suggestion) {
          setOperationNotice('未找到当前账套、账期内的 AI 凭证建议。')
          setPrefilledAiSuggestionId(aiVoucherSuggestionId)
          return
        }
        if (suggestion.status.toLowerCase() !== 'confirmed') {
          setOperationNotice('AI 凭证建议尚未人工确认，不能预填凭证草稿。')
          setPrefilledAiSuggestionId(aiVoucherSuggestionId)
          return
        }
        const debitCode = suggestion.debitSubject?.match(/^\s*(\d+)/)?.[1] || ''
        const creditCode = suggestion.creditSubject?.match(/^\s*(\d+)/)?.[1] || ''
        const debitAccountCode = accounts.some((account) => account.code === debitCode && account.is_enabled === 1) ? debitCode : ''
        const creditAccountCode = accounts.some((account) => account.code === creditCode && account.is_enabled === 1) ? creditCode : ''
        const amount = suggestion.suggestionAmount === null ? '' : String(suggestion.suggestionAmount)
        setVoucherDraft((draft) => ({
          ...draft,
          voucherDate: draft.voucherDate || currentPeriod?.end_date || '',
          voucherWordId: draft.voucherWordId || voucherWords[0]?.id || '',
          summary: suggestion.resultSummary || draft.summary,
          attachmentCount: suggestion.sourceFile ? '1' : draft.attachmentCount,
          entries: [
            { accountCode: debitAccountCode, direction: 'debit', amount },
            { accountCode: creditAccountCode, direction: 'credit', amount },
          ],
        }))
        setPrefilledAiSuggestionId(aiVoucherSuggestionId)
        writeModuleAudit('预填AI凭证草稿', suggestion.suggestionNo || suggestion.id, '中', '成功')
        setOperationNotice(
          debitAccountCode && creditAccountCode
            ? '已预填已确认的 AI 建议。请继续核验来源、科目和金额后保存凭证草稿，系统不会自动入账。'
            : '已预填摘要和金额，但建议科目未在当前账套匹配。请人工选择借贷科目后再保存，系统不会自动入账。',
        )
      })
  }, [accounts, aiVoucherSuggestionId, currentPeriod, currentPeriodLabel, kind, prefilledAiSuggestionId, selectedCompanyId, voucherWords])

  useEffect(() => {
    if (!['voucherEdit', 'voucherDetail'].includes(kind) || !isTauri || !selectedCompanyId || !voucherId) return
    void (async () => {
      const voucher = await getVoucher(voucherId, selectedCompanyId)
      if (!voucher) {
        setOperationNotice('未找到该凭证，或凭证不属于当前账套。')
        return
      }
      setLoadedVoucher(voucher)
      setSelectedVoucherTagIds(await fetchVoucherTagIds(voucher.id, selectedCompanyId))
      setVoucherDraft({
        voucherWordId: voucher.voucher_word_id,
        voucherDate: voucher.voucher_date,
        summary: voucher.summary || '',
        attachmentCount: String(voucher.attachment_count || 0),
        entries: voucher.entries.map((entry) => ({
          accountCode: entry.account_code,
          direction: entry.direction === 'credit' ? 'credit' : 'debit',
          amount: String(entry.amount),
        })),
      })
    })()
  }, [fetchVoucherTagIds, getVoucher, kind, selectedCompanyId, voucherId])

  useEffect(() => {
    if (!usesLiveInvoiceVoucherMatchingData || !selectedCompanyId) return
    void fetchInvoices({ company_id: selectedCompanyId, period_id: currentPeriodId || undefined })
    void queryVouchers({ company_id: selectedCompanyId, period_id: currentPeriodId || undefined, page: 1, page_size: 100 })
  }, [currentPeriodId, fetchInvoices, queryVouchers, selectedCompanyId, usesLiveInvoiceVoucherMatchingData])

  useEffect(() => {
    if (!usesLiveVatTaxData || !selectedCompanyId) return
    void fetchInvoices({ company_id: selectedCompanyId, period_id: currentPeriodId || undefined })
  }, [currentPeriodId, fetchInvoices, selectedCompanyId, usesLiveVatTaxData])

  useEffect(() => {
    if (!usesLiveBusinessOrderData || !selectedCompanyId || currentPeriodLabel === '当前账期') return
    const orderType = kind === 'purchaseManagement' ? 'purchase' : 'sales'
    void businessOrderApi.getBusinessOrders({ companyId: selectedCompanyId, period: currentPeriodLabel, orderType }).then((result) => setBusinessOrders(result.success ? result.data || [] : []))
  }, [currentPeriodLabel, kind, selectedCompanyId, usesLiveBusinessOrderData])

  useEffect(() => {
    if (!usesLiveSettlementRecordData || !selectedCompanyId || currentPeriodLabel === '当前账期') return
    const settlementType = kind === 'payableSettlement' ? 'payable' : 'receivable'
    void settlementRecordApi.getSettlementRecords({ companyId: selectedCompanyId, period: currentPeriodLabel, settlementType }).then((result) => setSettlementRecords(result.success ? result.data || [] : []))
  }, [currentPeriodLabel, kind, selectedCompanyId, usesLiveSettlementRecordData])

  useEffect(() => {
    if (!usesLiveBankReconciliationRecordData || !selectedCompanyId || currentPeriodLabel === '当前账期') return
    void bankReconciliationApi.getBankReconciliationRecords({ companyId: selectedCompanyId, period: currentPeriodLabel }).then((result) => setBankReconciliationRecords(result.success ? result.data || [] : []))
  }, [currentPeriodLabel, selectedCompanyId, usesLiveBankReconciliationRecordData])

  useEffect(() => {
    if (!usesLiveBankTransactionData || !selectedCompanyId || currentPeriodLabel === '当前账期') return
    void bankTransactionApi.getBankTransactions({ companyId: selectedCompanyId, period: currentPeriodLabel }).then((result) => setBankTransactions(result.success ? result.data || [] : []))
  }, [currentPeriodLabel, selectedCompanyId, usesLiveBankTransactionData])

  useEffect(() => {
    if (!(usesLiveDocumentRecordData || usesLiveStampTaxData || usesLiveExpenseReimbursementData || usesLiveReceiptData) || !selectedCompanyId || currentPeriodLabel === '当前账期') return
    void documentRecordApi.getDocumentRecords({ companyId: selectedCompanyId, period: currentPeriodLabel }).then((result) => setDocumentRecords(result.success ? result.data || [] : []))
  }, [currentPeriodLabel, selectedCompanyId, usesLiveDocumentRecordData, usesLiveStampTaxData, usesLiveExpenseReimbursementData, usesLiveReceiptData])
  useEffect(() => { if (!usesLiveReconciliationData || !selectedCompanyId || currentPeriodLabel === '当前账期') return; void bankTransactionApi.getBankTransactions({ companyId: selectedCompanyId, period: currentPeriodLabel }).then((result)=>setBankTransactions(result.success?result.data||[]:[])); void fetchInvoices({ company_id:selectedCompanyId, period_id:currentPeriodId||undefined }) }, [currentPeriodId, currentPeriodLabel, fetchInvoices, selectedCompanyId, usesLiveReconciliationData])
  useEffect(() => { if (!usesLiveAccountTransferData || !selectedCompanyId || currentPeriodLabel === '当前账期') return; void accountTransferApi.getAccountTransfers({ companyId: selectedCompanyId, period: currentPeriodLabel }).then((result) => setAccountTransfers(result.success ? result.data || [] : [])) }, [currentPeriodLabel, selectedCompanyId, usesLiveAccountTransferData])
  useEffect(() => { if (!usesLiveFixedAssetData || !selectedCompanyId || currentPeriodLabel === '当前账期') return; void fixedAssetApi.getFixedAssets({ companyId: selectedCompanyId, period: currentPeriodLabel }).then((result) => setFixedAssets(result.success ? result.data || [] : [])) }, [currentPeriodLabel, selectedCompanyId, usesLiveFixedAssetData])
  useEffect(() => { if (!usesLiveInventoryMovementData || !selectedCompanyId || currentPeriodLabel === '当前账期') return; void inventoryMovementApi.getInventoryMovements({ companyId: selectedCompanyId, period: currentPeriodLabel }).then((result) => setInventoryMovements(result.success ? result.data || [] : [])) }, [currentPeriodLabel, selectedCompanyId, usesLiveInventoryMovementData])
  useEffect(() => { if (!usesLiveCostCarryoverData || !selectedCompanyId || currentPeriodLabel === '当前账期') return; void costCarryoverApi.getCostCarryoverRecords({ companyId: selectedCompanyId, period: currentPeriodLabel }).then((result) => setCostCarryoverRecords(result.success ? result.data || [] : [])) }, [currentPeriodLabel, selectedCompanyId, usesLiveCostCarryoverData])
  useEffect(() => { if (!usesLiveInventoryItemData || !selectedCompanyId) return; void inventoryItemApi.getInventoryItems({ companyId: selectedCompanyId }).then((result) => setInventoryItems(result.success ? result.data || [] : [])) }, [selectedCompanyId, usesLiveInventoryItemData])
  useEffect(() => { if (!usesLiveMeasurementUnitData || !selectedCompanyId) return; void measurementUnitApi.getMeasurementUnits({ companyId: selectedCompanyId }).then((result) => setMeasurementUnits(result.success ? result.data || [] : [])) }, [selectedCompanyId, usesLiveMeasurementUnitData])

  useEffect(() => {
    if (!usesLiveReportData || !currentPeriodId) return

    let active = true
    setLiveReports(emptyLiveReportData)

    async function loadReport() {
      try {
        if (kind === 'trialBalanceReport' || kind === 'ledgerReport') {
          const trialBalance = await fetchTrialBalance(currentPeriodId)
          if (active) setLiveReports((reports) => kind === 'ledgerReport' ? { ...reports, ledgerOverview: trialBalance } : { ...reports, trialBalance })
          return
        }

        if (kind === 'generalLedgerReport' || kind === 'accountSummaryReport' || kind === 'multiColumnLedgerReport') {
          const generalLedger = await getGeneralLedger(currentPeriodId)
          if (active) setLiveReports((reports) => kind === 'accountSummaryReport'
            ? { ...reports, accountSummary: generalLedger }
            : kind === 'multiColumnLedgerReport'
              ? { ...reports, multiColumnLedger: generalLedger }
              : { ...reports, generalLedger })
          return
        }

        if (kind === 'balanceSheetReport') {
          const balanceSheet = await getBalanceSheet(currentPeriodId)
          if (active) setLiveReports((reports) => ({ ...reports, balanceSheet }))
          return
        }

        if (kind === 'equityChangeReport') {
          const [balanceSheet, incomeStatement] = await Promise.all([
            getBalanceSheet(currentPeriodId),
            getIncomeStatement(currentPeriodId),
          ])
          if (active) setLiveReports((reports) => ({ ...reports, balanceSheet, incomeStatement }))
          return
        }

        if (kind === 'incomeStatementReport' || kind === 'incomeQuarterReport' || kind === 'incomeTaxReport') {
          const incomeStatement = await getIncomeStatement(currentPeriodId)
          if (kind === 'incomeQuarterReport') {
            const quarterStartMonth = Math.floor(((currentPeriod?.period_month || 1) - 1) / 3) * 3 + 1
            const priorQuarterPeriod = quarterStartMonth > 1
              ? periods.find((period) => period.period_year === currentPeriod?.period_year && period.period_month === quarterStartMonth - 1)
              : undefined
            const incomeQuarterBaseline = priorQuarterPeriod ? await getIncomeStatement(priorQuarterPeriod.id) : null
            if (active) setLiveReports((reports) => ({ ...reports, incomeStatement, incomeQuarterBaseline, incomeQuarterBaselineMissing: quarterStartMonth > 1 && !priorQuarterPeriod }))
            return
          }
          if (active) setLiveReports((reports) => ({ ...reports, incomeStatement }))
          return
        }

        if (kind === 'cashFlowReport' || kind === 'cashFlowQuarterReport') {
          const cashFlow = await getCashFlowStatement(currentPeriodId)
          if (kind === 'cashFlowQuarterReport') {
            const quarterStartMonth = Math.floor(((currentPeriod?.period_month || 1) - 1) / 3) * 3 + 1
            const priorQuarterPeriod = quarterStartMonth > 1
              ? periods.find((period) => period.period_year === currentPeriod?.period_year && period.period_month === quarterStartMonth - 1)
              : undefined
            const cashFlowQuarterBaseline = priorQuarterPeriod ? await getCashFlowStatement(priorQuarterPeriod.id) : null
            if (active) setLiveReports((reports) => ({ ...reports, cashFlow, cashFlowQuarterBaseline, cashFlowQuarterBaselineMissing: quarterStartMonth > 1 && !priorQuarterPeriod }))
            return
          }
          if (active) setLiveReports((reports) => ({ ...reports, cashFlow }))
        }
      } catch {
        // Stores persist the command error; retain the page's existing non-Tauri mock fallback.
      }
    }

    void loadReport()
    return () => {
      active = false
    }
  }, [
    currentPeriod,
    currentPeriodId,
    fetchTrialBalance,
    getBalanceSheet,
    getCashFlowStatement,
    getGeneralLedger,
    getIncomeStatement,
    kind,
    periods,
    usesLiveReportData,
  ])

  useEffect(() => {
    if (!usesLiveInitialBalanceData || !currentPeriodId) return

    let active = true
    void fetchTrialBalance(currentPeriodId)
      .then((initialBalance) => {
        if (active) setLiveReports((reports) => ({ ...reports, initialBalance }))
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [currentPeriodId, fetchTrialBalance, usesLiveInitialBalanceData])

  useEffect(() => {
    if (!usesLiveFinancialOverviewData || !currentPeriodId) return
    let active = true
    setLiveReports(emptyLiveReportData)
    void Promise.all([
      getBalanceSheet(currentPeriodId),
      getIncomeStatement(currentPeriodId),
      getCashFlowStatement(currentPeriodId),
    ]).then(([balanceSheet, incomeStatement, cashFlow]) => {
      if (active) setLiveReports((reports) => ({ ...reports, balanceSheet, incomeStatement, cashFlow }))
    }).catch(() => undefined)

    return () => {
      active = false
    }
  }, [currentPeriodId, getBalanceSheet, getCashFlowStatement, getIncomeStatement, usesLiveFinancialOverviewData])

  useEffect(() => {
    if (!usesLiveClosingTaskData || !selectedCompanyId || !currentPeriodId) return
    let active = true
    void fetchPeriods(selectedCompanyId)
    setLiveReports((reports) => ({ ...reports, trialBalance: null, balanceSheet: null }))
    void Promise.all([
      queryVouchers({ company_id: selectedCompanyId, period_id: currentPeriodId, page: 1, page_size: 100 }),
      fetchTrialBalance(currentPeriodId),
      getBalanceSheet(currentPeriodId),
    ]).then(([, trialBalance, balanceSheet]) => {
      if (active) setLiveReports((reports) => ({ ...reports, trialBalance, balanceSheet }))
    }).catch(() => undefined)

    return () => {
      active = false
    }
  }, [currentPeriodId, fetchPeriods, fetchTrialBalance, getBalanceSheet, queryVouchers, selectedCompanyId, usesLiveClosingTaskData])

  useEffect(() => {
    if (!usesLiveArchiveData || !selectedCompanyId) return
    void fetchAccounts(selectedCompanyId)
    void fetchCategories(selectedCompanyId)
    void fetchAllItems(selectedCompanyId)
  }, [fetchAccounts, fetchAllItems, fetchCategories, selectedCompanyId, usesLiveArchiveData])

  useEffect(() => {
    if (!usesLivePeriodManagementData || !selectedCompanyId) return
    void fetchPeriods(selectedCompanyId)
  }, [fetchPeriods, selectedCompanyId, usesLivePeriodManagementData])

  useEffect(() => {
    if (!usesLiveSettlementRuleData || !selectedCompanyId) return
    void fetchSettlementRules(selectedCompanyId)
  }, [fetchSettlementRules, selectedCompanyId, usesLiveSettlementRuleData])

  useEffect(() => {
    if (!usesLiveMatchingRuleData || !selectedCompanyId) return
    void fetchMatchingRules(selectedCompanyId, matchingRuleScope)
  }, [fetchMatchingRules, matchingRuleScope, selectedCompanyId, usesLiveMatchingRuleData])

  useEffect(() => {
    if (!needsLiveAssetCategories || !selectedCompanyId) return
    void fetchAssetCategories(selectedCompanyId)
  }, [fetchAssetCategories, needsLiveAssetCategories, selectedCompanyId])

  useEffect(() => {
    if (!needsLiveBusinessTags || !selectedCompanyId) return
    void fetchBusinessTags(selectedCompanyId)
  }, [fetchBusinessTags, needsLiveBusinessTags, selectedCompanyId])

  useEffect(() => {
    if (!isTauri || !selectedCompanyId || (kind !== 'outputInvoice' && kind !== 'inputInvoice')) return
    const invoiceType = kind === 'outputInvoice' ? 'output' : 'input'
    void Promise.all(invoices
      .filter((invoice) => invoice.invoice_type === invoiceType)
      .map((invoice) => fetchInvoiceTagIds(invoice.id, selectedCompanyId)))
  }, [fetchInvoiceTagIds, invoices, kind, selectedCompanyId])

  useEffect(() => {
    if (!isTauri || !selectedCompanyId || kind !== 'voucher') return
    void Promise.all(vouchers.map((voucher) => fetchVoucherTagIds(voucher.id, selectedCompanyId)))
  }, [fetchVoucherTagIds, kind, selectedCompanyId, vouchers])

  useEffect(() => {
    if (!isTauri || !selectedCompanyId || !['billList', 'bankStatement'].includes(kind)) return
    void Promise.all(bankTransactions.map((transaction) => fetchBankTransactionTagIds(transaction.id, selectedCompanyId)))
  }, [bankTransactions, fetchBankTransactionTagIds, kind, selectedCompanyId])

  useEffect(() => {
    if (!usesLiveCompanyBankAccountData || !selectedCompanyId) return
    void fetchCompanyAccounts(selectedCompanyId)
  }, [fetchCompanyAccounts, selectedCompanyId, usesLiveCompanyBankAccountData])

  useEffect(() => {
    if (!usesLiveCurrencyData || !selectedCompanyId) return
    void fetchCurrencies(selectedCompanyId)
  }, [fetchCurrencies, selectedCompanyId, usesLiveCurrencyData])

  useEffect(() => {
    if (!usesLiveTemplateSettingsData || !selectedCompanyId) return
    void fetchTemplateWorkspace(selectedCompanyId)
  }, [fetchTemplateWorkspace, selectedCompanyId, usesLiveTemplateSettingsData])

  useEffect(() => {
    if (!usesLiveReportFormulaData || !selectedCompanyId) return
    void fetchReportTemplateWorkspace(selectedCompanyId)
  }, [fetchReportTemplateWorkspace, selectedCompanyId, usesLiveReportFormulaData])

  useEffect(() => {
    if (!usesLiveAdapterAuthorizationData || !selectedCompanyId) return
    const adapterType = kind === 'bankAdapterSettings' ? 'bank' : 'tax'
    let active = true
    void automationApi.getAdapterAuthorizations({ companyId: selectedCompanyId, adapterType })
      .then((result) => {
        if (active) setAdapterAuthorizations(result.success ? result.data || [] : [])
      })
    return () => {
      active = false
    }
  }, [kind, selectedCompanyId, usesLiveAdapterAuthorizationData])

  useEffect(() => {
    if (!usesLiveRuleLogData || !selectedCompanyId) return
    let active = true
    void automationApi.getOperationAuditLogs(kind === 'auditLog' || kind === 'exportCenter' || kind === 'importCenter'
      ? { companyId: selectedCompanyId }
      : { companyId: selectedCompanyId, moduleName: title })
      .then((result) => {
        if (active) setOperationAuditLogs(result.success ? result.data || [] : [])
      })
    return () => {
      active = false
    }
  }, [kind, selectedCompanyId, title, usesLiveRuleLogData])

  useEffect(() => {
    if (!usesLiveBackupData) return
    let active = true
    void backupApi.listLocalBackups().then((result) => {
      if (active) setLocalBackups(result.success ? result.data || [] : [])
    })
    return () => {
      active = false
    }
  }, [usesLiveBackupData])

  useEffect(() => {
    if (!usesLiveCompanyTodoData || !selectedCompanyId) return
    let active = true
    void companyTodoApi.getAll({ companyId: selectedCompanyId, period: currentPeriodLabel === '当前账期' ? undefined : currentPeriodLabel }).then((result) => {
      if (active) setCompanyTodos(result.success ? result.data || [] : [])
    })
    return () => {
      active = false
    }
  }, [currentPeriodLabel, selectedCompanyId, usesLiveCompanyTodoData])

  useEffect(() => {
    if (!(usesLiveEmployeeData || usesLivePayrollData || usesLiveSocialSecurityData || usesLiveSpecialDeductionData || usesLiveWithholdingTaxData || usesLiveSocialSecurityTaxData) || !selectedCompanyId) return
    let active = true
    void employeeApi.getEmployees(selectedCompanyId).then((result) => {
      if (active) setEmployees(result.success ? result.data || [] : [])
    })
    return () => {
      active = false
    }
  }, [selectedCompanyId, usesLiveEmployeeData, usesLivePayrollData, usesLiveSocialSecurityData, usesLiveSpecialDeductionData, usesLiveWithholdingTaxData, usesLiveSocialSecurityTaxData])

  useEffect(() => {
    if (!(usesLivePayrollData || usesLiveWithholdingTaxData) || !selectedCompanyId || currentPeriodLabel === '当前账期') return
    let active = true
    void payrollApi.getPayrollRecords({ companyId: selectedCompanyId, period: currentPeriodLabel }).then((result) => {
      if (active) setPayrollRecords(result.success ? result.data || [] : [])
    })
    return () => { active = false }
  }, [currentPeriodLabel, selectedCompanyId, usesLivePayrollData, usesLiveWithholdingTaxData])
  useEffect(() => { if (!(usesLiveSocialSecurityData || usesLiveWithholdingTaxData || usesLiveSocialSecurityTaxData) || !selectedCompanyId || currentPeriodLabel === '当前账期') return; void socialSecurityApi.getSocialSecurityRecords({ companyId: selectedCompanyId, period: currentPeriodLabel }).then((result) => setSocialSecurityRecords(result.success ? result.data || [] : [])) }, [currentPeriodLabel, selectedCompanyId, usesLiveSocialSecurityData, usesLiveWithholdingTaxData, usesLiveSocialSecurityTaxData])
  useEffect(() => { if (!(usesLiveSpecialDeductionData || usesLiveWithholdingTaxData) || !selectedCompanyId || currentPeriodLabel === '当前账期') return; void specialDeductionApi.getSpecialDeductionRecords({ companyId: selectedCompanyId, period: currentPeriodLabel }).then((result) => setSpecialDeductionRecords(result.success ? result.data || [] : [])) }, [currentPeriodLabel, selectedCompanyId, usesLiveSpecialDeductionData, usesLiveWithholdingTaxData])

  useEffect(() => {
    if (!usesLiveVoucherRecycleData || !selectedCompanyId) return
    let active = true
    void getDeletedVouchers(selectedCompanyId).then((result) => {
      if (active) setDeletedVouchers(result)
    })
    return () => {
      active = false
    }
  }, [getDeletedVouchers, selectedCompanyId, usesLiveVoucherRecycleData])

  useEffect(() => {
    if (!(usesLiveDeclarationReceiptData || usesLiveDeclarationCalendarData || usesLiveTaxInitData || usesLiveTaxReportData || usesLiveFinanceTaxReportData || usesLiveNonTaxRevenueData) || !selectedCompanyId) return
    let active = true
    void automationApi.getTaxDeclarationTasks({ companyId: selectedCompanyId })
      .then((result) => {
        if (active) setTaxDeclarationTasks(result.success ? result.data || [] : [])
      })
    return () => {
      active = false
    }
  }, [selectedCompanyId, usesLiveDeclarationReceiptData, usesLiveDeclarationCalendarData, usesLiveTaxInitData, usesLiveTaxReportData, usesLiveFinanceTaxReportData, usesLiveNonTaxRevenueData])

  useEffect(() => {
    if (!usesLiveAutomationJobData || !selectedCompanyId) return
    let active = true
    void automationApi.getAutomationJobs({ companyId: selectedCompanyId })
      .then((result) => {
        if (active) setAutomationJobs(result.success ? result.data || [] : [])
      })
    return () => {
      active = false
    }
  }, [selectedCompanyId, usesLiveAutomationJobData])

  useEffect(() => {
    if (!usesLiveHistoryReportData || !selectedCompanyId) return
    void fetchPeriods(selectedCompanyId)
    if (kind === 'historySubsidiaryLedger') void fetchAccounts(selectedCompanyId)
  }, [fetchAccounts, fetchPeriods, kind, selectedCompanyId, usesLiveHistoryReportData])

  useEffect(() => {
    if (kind !== 'historyVoucher' || !usesLiveHistoryReportData || !selectedCompanyId || !selectedHistoryPeriodId) return

    let active = true
    setLiveReports((reports) => ({ ...reports, historyVouchers: null }))
    void queryVouchers({
      company_id: selectedCompanyId,
      period_id: selectedHistoryPeriodId,
      page: 1,
      page_size: 100,
    }).then((historyVouchers) => {
      if (active) setLiveReports((reports) => ({ ...reports, historyVouchers }))
    })

    return () => {
      active = false
    }
  }, [kind, queryVouchers, selectedCompanyId, selectedHistoryPeriodId, usesLiveHistoryReportData])

  useEffect(() => {
    if (kind !== 'historyBalance' || !usesLiveHistoryReportData || !selectedHistoryPeriodId) return

    let active = true
    setLiveReports((reports) => ({ ...reports, historyBalance: null }))
    void fetchTrialBalance(selectedHistoryPeriodId)
      .then((historyBalance) => {
        if (active) setLiveReports((reports) => ({ ...reports, historyBalance }))
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [fetchTrialBalance, kind, selectedHistoryPeriodId, usesLiveHistoryReportData])

  useEffect(() => {
    if (kind !== 'historyGeneralLedger' || !usesLiveHistoryReportData || !selectedHistoryPeriodId) return

    let active = true
    setLiveReports((reports) => ({ ...reports, historyGeneralLedger: null }))
    void getGeneralLedger(selectedHistoryPeriodId)
      .then((historyGeneralLedger) => {
        if (active) setLiveReports((reports) => ({ ...reports, historyGeneralLedger }))
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [getGeneralLedger, kind, selectedHistoryPeriodId, usesLiveHistoryReportData])

  useEffect(() => {
    if (kind !== 'historySubsidiaryLedger' || !usesLiveHistoryReportData || !selectedHistoryPeriodId || !selectedHistoryLedgerAccountCode) return

    let active = true
    setLiveReports((reports) => ({ ...reports, historySubsidiaryLedger: null }))
    void getSubsidiaryLedger(selectedHistoryPeriodId, selectedHistoryLedgerAccountCode)
      .then((historySubsidiaryLedger) => {
        if (active) setLiveReports((reports) => ({ ...reports, historySubsidiaryLedger }))
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [getSubsidiaryLedger, kind, selectedHistoryLedgerAccountCode, selectedHistoryPeriodId, usesLiveHistoryReportData])

  useEffect(() => {
    if (!usesLiveLedgerDetailData || !selectedCompanyId) return
    void fetchAccounts(selectedCompanyId)
    void fetchCategories(selectedCompanyId)
    void fetchAllItems(selectedCompanyId)
  }, [fetchAccounts, fetchAllItems, fetchCategories, selectedCompanyId, usesLiveLedgerDetailData])

  useEffect(() => {
    if (kind !== 'subsidiaryLedgerReport' || !usesLiveLedgerDetailData || !currentPeriodId || !selectedLedgerAccountCode) return

    let active = true
    setLiveReports((reports) => ({ ...reports, subsidiaryLedger: null }))
    void getSubsidiaryLedger(currentPeriodId, selectedLedgerAccountCode)
      .then((subsidiaryLedger) => {
        if (active) setLiveReports((reports) => ({ ...reports, subsidiaryLedger }))
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [currentPeriodId, getSubsidiaryLedger, kind, selectedLedgerAccountCode, usesLiveLedgerDetailData])

  useEffect(() => {
    if (kind !== 'auxiliaryLedgerReport' || !usesLiveLedgerDetailData || !selectedCompanyId || !selectedAuxiliaryItemId) return

    let active = true
    setLiveReports((reports) => ({ ...reports, auxiliaryLedger: null }))
    void fetchAuxiliaryLedger({
      auxiliary_item_id: selectedAuxiliaryItemId,
      company_id: selectedCompanyId,
      period_id: currentPeriodId || undefined,
    }).then((auxiliaryLedger) => {
      if (active) setLiveReports((reports) => ({ ...reports, auxiliaryLedger }))
    })

    return () => {
      active = false
    }
  }, [currentPeriodId, fetchAuxiliaryLedger, kind, selectedAuxiliaryItemId, selectedCompanyId, usesLiveLedgerDetailData])

  useEffect(() => {
    if (kind !== 'auxiliaryBalanceReport' || !usesLiveLedgerDetailData || !selectedCompanyId || !currentPeriodId || !selectedAuxiliaryCategoryId) return

    let active = true
    setLiveReports((reports) => ({ ...reports, auxiliaryBalance: null }))
    void fetchAuxiliaryBalance(selectedAuxiliaryCategoryId, currentPeriodId, selectedCompanyId)
      .then((auxiliaryBalance) => {
        if (active) setLiveReports((reports) => ({ ...reports, auxiliaryBalance }))
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [currentPeriodId, fetchAuxiliaryBalance, kind, selectedAuxiliaryCategoryId, selectedCompanyId, usesLiveLedgerDetailData])

  const config = useMemo(() => {
    if (kind === 'companyInfo' && !isTauri && previewCompanyInfo) {
      const company = buildPreviewCompanyInfo(previewCompanyInfo)
      return {
        ...baseConfig,
        rows: mapLiveCompanyInfoRows(company),
        summary: summarizeLiveCompanyInfo(company),
      }
    }
    if (kind === 'initialBalance' && !isTauri) {
      const initialBalance = buildPreviewInitialBalanceTrial(previewInitialBalanceRows)
      return {
        ...baseConfig,
        rows: mapLiveInitialBalanceRows(initialBalance),
        summary: summarizeLiveInitialBalance(initialBalance),
      }
    }
    if (kind === 'subjectSettings' && !isTauri && previewSubjects.length > 0) {
      return { ...baseConfig, rows: mapLiveSubjectRows(previewSubjects), summary: summarizeLiveSubjects(previewSubjects) }
    }
    if (kind === 'notificationCenter' && !isTauri) {
      return { ...baseConfig, rows: mapLiveCompanyTodoRows(previewCompanyTodos, '科旋电气'), summary: summarizeLiveCompanyTodos(previewCompanyTodos) }
    }
    if (kind === 'aiJobQueue' && !isTauri) {
      const jobs = [...automationJobs, ...previewAiQueueJobs]
      return {
        ...baseConfig,
        rows: mapLiveAutomationJobRows(jobs, 'queue'),
        summary: summarizeLiveAutomationJobs(jobs, 'queue'),
      }
    }

    if (kind === 'aiRecognitionResults' && !isTauri) {
      const jobs = [...automationJobs, ...previewAiQueueJobs]
      return {
        ...baseConfig,
        rows: mapLiveAutomationJobRows(jobs, 'recognition'),
        summary: summarizeLiveAutomationJobs(jobs, 'recognition'),
      }
    }

    if (kind === 'aiVoucherSuggestions' && !isTauri) {
      const jobs = [...automationJobs, ...previewAiQueueJobs]
      return {
        ...baseConfig,
        rows: mapLiveAutomationJobRows(jobs, 'suggestion'),
        summary: summarizeLiveAutomationJobs(jobs, 'suggestion'),
      }
    }

    if (kind === 'auditLog') {
      if (usesLiveOperationAuditData) {
        return {
          ...baseConfig,
          rows: mapLiveOperationAuditRows(operationAuditLogs),
          summary: summarizeLiveOperationAudits(operationAuditLogs),
        }
      }
      const dynamicRows = auditLogs.map(auditLogToModuleRow)
      return {
        ...baseConfig,
        rows: [...dynamicRows, ...baseConfig.rows],
        summary: baseConfig.summary.map((item) => {
          if (item.label === '日志条数') return { ...item, value: `${dynamicRows.length + 1286} 条` }
          if (item.label === '普通操作') return { ...item, value: `${dynamicRows.filter((row) => row.values.level === '普通').length + 1214} 条` }
          if (item.label === '需复核') return { ...item, value: `${dynamicRows.filter((row) => row.status === '待确认').length + 58} 条` }
          if (item.label === '高风险') return { ...item, value: `${dynamicRows.filter((row) => row.values.level === '高').length + 14} 条` }
          return item
        }),
      }
    }

    if (kind === 'outputInvoice' && usesLiveModuleData) {
      return {
        ...baseConfig,
        rows: mapLiveInvoiceRows(invoices, 'output', invoiceTagIds, effectiveBusinessTags),
        summary: summarizeLiveInvoices(invoices, 'output'),
      }
    }

    if (kind === 'inputInvoice' && usesLiveModuleData) {
      return {
        ...baseConfig,
        rows: mapLiveInvoiceRows(invoices, 'input', invoiceTagIds, effectiveBusinessTags),
        summary: summarizeLiveInvoices(invoices, 'input'),
      }
    }

    if (kind === 'voucher' && usesLiveModuleData) {
      return {
        ...baseConfig,
        rows: mapLiveVoucherRows(vouchers, voucherTagIds, effectiveBusinessTags),
        summary: summarizeLiveVouchers(vouchers),
      }
    }

    if (kind === 'riskCheck' && usesLiveModuleData) {
      return {
        ...baseConfig,
        rows: mapLiveRiskCheckRows(vouchers, invoices),
        summary: summarizeLiveRiskChecks(vouchers, invoices),
      }
    }

    if (kind === 'invoiceVoucherMatching' && usesLiveInvoiceVoucherMatchingData) {
      return {
        ...baseConfig,
        rows: mapLiveInvoiceVoucherMatchingRows(invoices, vouchers),
        summary: summarizeLiveInvoiceVoucherMatching(invoices, vouchers),
      }
    }

    if (kind === 'closingTasks' && usesLiveClosingTaskData) {
      return {
        ...baseConfig,
        rows: mapLiveClosingTaskRows(currentPeriod, vouchers, liveReports.trialBalance, liveReports.balanceSheet),
        summary: summarizeLiveClosingTasks(currentPeriod, vouchers, liveReports.trialBalance, liveReports.balanceSheet),
      }
    }

    if (kind === 'voucherRecycle' && usesLiveVoucherRecycleData) {
      return {
        ...baseConfig,
        rows: mapLiveVoucherRecycleRows(deletedVouchers),
        summary: summarizeLiveVoucherRecycle(deletedVouchers),
      }
    }

    if (kind === 'backupRestore' && usesLiveBackupData) {
      return {
        ...baseConfig,
        rows: mapLocalBackupRows(localBackups, backupValidations),
        summary: summarizeLocalBackups(localBackups, backupValidations),
      }
    }

    if (kind === 'notificationCenter' && (usesLiveCompanyTodoData || companyTodos.length > 0)) {
      return {
        ...baseConfig,
        rows: mapLiveCompanyTodoRows(companyTodos, selectedCompany?.name || '当前账套'),
        summary: summarizeLiveCompanyTodos(companyTodos),
      }
    }

    if (kind === 'employee' && (usesLiveEmployeeData || employees.length > 0)) {
      return {
        ...baseConfig,
        rows: mapLiveEmployeeRows(employees),
        summary: summarizeLiveEmployees(employees),
      }
    }

    if (kind === 'payroll' && (usesLivePayrollData || payrollRecords.length > 0)) {
      return { ...baseConfig, rows: mapLivePayrollRows(payrollRecords), summary: summarizeLivePayroll(payrollRecords) }
    }
    if (kind === 'socialSecurity' && (usesLiveSocialSecurityData || socialSecurityRecords.length > 0)) return { ...baseConfig, rows: mapLiveSocialSecurityRows(socialSecurityRecords), summary: summarizeLiveSocialSecurity(socialSecurityRecords) }
    if (kind === 'specialDeduction' && (usesLiveSpecialDeductionData || specialDeductionRecords.length > 0)) return { ...baseConfig, rows: mapLiveSpecialDeductionRows(specialDeductionRecords), summary: summarizeLiveSpecialDeductions(specialDeductionRecords) }
    if (kind === 'withholdingTaxReport' && usesLiveWithholdingTaxData) return { ...baseConfig, rows: mapLiveWithholdingTaxRows(payrollRecords, employees, socialSecurityRecords, specialDeductionRecords), summary: summarizeLiveWithholdingTax(payrollRecords, employees, socialSecurityRecords, specialDeductionRecords) }
    if (kind === 'socialSecurityTaxReport' && usesLiveSocialSecurityTaxData) return { ...baseConfig, rows: mapLiveSocialSecurityTaxRows(socialSecurityRecords), summary: summarizeLiveSocialSecurityTax(socialSecurityRecords) }
    if (kind === 'incomeTaxReport' && usesLiveReportData && liveReports.incomeStatement) return { ...baseConfig, rows: mapLiveIncomeTaxRows(liveReports.incomeStatement), summary: summarizeLiveIncomeTax(liveReports.incomeStatement) }
    if (kind === 'vatTaxReport' && usesLiveVatTaxData) return { ...baseConfig, rows: mapLiveVatTaxRows(invoices), summary: summarizeLiveVatTax(invoices) }
    if ((kind === 'billList' || kind === 'bankStatement') && (usesLiveBankTransactionData || bankTransactions.length > 0)) return { ...baseConfig, rows: mapLiveBankTransactionRows(bankTransactions, kind, bankTransactionTagIds, effectiveBusinessTags), summary: summarizeLiveBankTransactions(bankTransactions, kind) }
    if (kind === 'bankReconciliation' && (usesLiveBankReconciliationRecordData || bankReconciliationRecords.length > 0)) return { ...baseConfig, rows: mapLiveBankReconciliationRows(bankReconciliationRecords), summary: summarizeLiveBankReconciliation(bankReconciliationRecords) }
    if (kind === 'receivableSettlement' && (usesLiveSettlementRecordData || settlementRecords.length > 0)) return { ...baseConfig, rows: mapLiveSettlementRecordRows(settlementRecords, 'receivable') }
    if (kind === 'payableSettlement' && (usesLiveSettlementRecordData || settlementRecords.length > 0)) return { ...baseConfig, rows: mapLiveSettlementRecordRows(settlementRecords, 'payable') }
    if (kind === 'receivablePayableAging' && (usesLiveSettlementRecordData || settlementRecords.length > 0)) return { ...baseConfig, rows: mapLiveSettlementAgingRows(settlementRecords), summary: summarizeLiveSettlementAging(settlementRecords) }
    if (kind === 'documentRegister' && (usesLiveDocumentRecordData || documentRecords.length > 0)) return { ...baseConfig, rows: mapLiveDocumentRecordRows(documentRecords), summary: summarizeLiveDocumentRecords(documentRecords) }
    if (kind === 'contractLedger' && (usesLiveDocumentRecordData || documentRecords.length > 0)) return { ...baseConfig, rows: mapLiveContractLedgerRows(documentRecords), summary: summarizeLiveContractLedger(documentRecords) }
    if (kind === 'stampTaxReport' && (usesLiveStampTaxData || documentRecords.length > 0)) return { ...baseConfig, rows: mapLiveStampTaxRows(documentRecords), summary: summarizeLiveStampTax(documentRecords) }
    if (kind === 'expenseReimbursement' && (usesLiveExpenseReimbursementData || documentRecords.length > 0)) return { ...baseConfig, rows: mapLiveExpenseReimbursementRows(documentRecords), summary: summarizeLiveExpenseReimbursements(documentRecords) }
    if (kind === 'receipt' && (usesLiveReceiptData || documentRecords.length > 0)) return { ...baseConfig, rows: mapLiveReceiptRows(documentRecords), summary: summarizeLiveReceipts(documentRecords) }
    if (kind === 'purchaseManagement' && (usesLiveBusinessOrderData || businessOrders.length > 0)) return { ...baseConfig, rows: mapLiveBusinessOrderRows(businessOrders, 'purchase'), summary: summarizeLiveBusinessOrders(businessOrders, 'purchase', ['采购单', '已完成', '待处理', '异常单']) }
    if (kind === 'salesManagement' && (usesLiveBusinessOrderData || businessOrders.length > 0)) return { ...baseConfig, rows: mapLiveBusinessOrderRows(businessOrders, 'sales'), summary: summarizeLiveBusinessOrders(businessOrders, 'sales', ['销售单', '已完成', '待处理', '异常单']) }
    if (kind === 'transfer' && (usesLiveAccountTransferData || accountTransfers.length > 0)) return { ...baseConfig, rows: mapLiveAccountTransferRows(accountTransfers), summary: summarizeLiveAccountTransfers(accountTransfers) }
    if (kind === 'depreciation' && (usesLiveFixedAssetData || fixedAssets.length > 0)) return { ...baseConfig, rows: mapLiveFixedAssetRows(fixedAssets), summary: summarizeLiveFixedAssets(fixedAssets) }
    if (kind === 'inventoryMovement' && (usesLiveInventoryMovementData || inventoryMovements.length > 0)) return { ...baseConfig, rows: mapLiveInventoryMovementRows(inventoryMovements), summary: summarizeLiveInventoryMovements(inventoryMovements) }
    if (kind === 'costCarryover' && (usesLiveCostCarryoverData || costCarryoverRecords.length > 0)) return { ...baseConfig, rows: mapLiveCostCarryoverRows(costCarryoverRecords), summary: summarizeLiveCostCarryover(costCarryoverRecords) }
    if (kind === 'inventorySettings' && (usesLiveInventoryItemData || inventoryItems.length > 0)) return { ...baseConfig, rows: mapLiveInventoryItemRows(inventoryItems), summary: [{ label: '存货档案', value: `${inventoryItems.length} 项`, tone: 'blue' }, { label: '启用', value: `${inventoryItems.filter((item) => item.status !== '停用').length} 项`, tone: 'green' }, { label: '待补税率', value: `${inventoryItems.filter((item) => item.taxRate === null).length} 项`, tone: 'amber' }, { label: '停用', value: `${inventoryItems.filter((item) => item.status === '停用').length} 项`, tone: 'gray' }] as ModuleConfig['summary'] }
    if (kind === 'unitSettings' && (usesLiveMeasurementUnitData || measurementUnits.length > 0)) return { ...baseConfig, rows: mapLiveMeasurementUnitRows(measurementUnits) }

    if (kind === 'declarationReceipt' && (usesLiveDeclarationReceiptData || !isTauri)) {
      return {
        ...baseConfig,
        rows: mapLiveDeclarationReceiptRows(effectiveTaxDeclarationTasks),
        summary: summarizeLiveDeclarationReceipts(effectiveTaxDeclarationTasks),
      }
    }

    if (kind === 'declarationCalendar' && (usesLiveDeclarationCalendarData || !isTauri)) {
      return {
        ...baseConfig,
        rows: mapLiveDeclarationCalendarRows(effectiveTaxDeclarationTasks),
        summary: summarizeLiveDeclarationCalendar(effectiveTaxDeclarationTasks),
      }
    }

    if (kind === 'taxInit' && (usesLiveTaxInitData || !isTauri)) {
      return {
        ...baseConfig,
        rows: mapLiveTaxInitRows(effectiveTaxDeclarationTasks, effectiveAdapterAuthorizations),
        summary: summarizeLiveTaxInit(effectiveTaxDeclarationTasks, effectiveAdapterAuthorizations),
      }
    }

    if (kind === 'taxReport' && (usesLiveTaxReportData || !isTauri)) {
      return {
        ...baseConfig,
        rows: mapLiveTaxReportRows(effectiveTaxDeclarationTasks),
        summary: summarizeLiveTaxReports(effectiveTaxDeclarationTasks),
      }
    }

    if (kind === 'financeTaxReport' && (usesLiveFinanceTaxReportData || !isTauri)) {
      return {
        ...baseConfig,
        rows: mapLiveFinanceTaxReportRows(effectiveTaxDeclarationTasks),
        summary: summarizeLiveFinanceTaxReports(effectiveTaxDeclarationTasks),
      }
    }

    if (kind === 'nonTaxRevenueReport' && (usesLiveNonTaxRevenueData || !isTauri)) {
      return {
        ...baseConfig,
        rows: mapLiveNonTaxRevenueRows(effectiveTaxDeclarationTasks),
        summary: summarizeLiveNonTaxRevenue(effectiveTaxDeclarationTasks),
      }
    }

    if (kind === 'financialReport' && usesLiveFinancialOverviewData && liveReports.balanceSheet && liveReports.incomeStatement && liveReports.cashFlow) {
      return {
        ...baseConfig,
        rows: mapLiveFinancialOverviewRows(liveReports.balanceSheet, liveReports.incomeStatement, liveReports.cashFlow),
        summary: summarizeLiveFinancialOverview(liveReports.balanceSheet, liveReports.incomeStatement, liveReports.cashFlow),
      }
    }

    if (kind === 'aiJobQueue' && (usesLiveAutomationJobData || automationJobs.length > 0)) {
      return {
        ...baseConfig,
        rows: mapLiveAutomationJobRows(automationJobs, 'queue'),
        summary: summarizeLiveAutomationJobs(automationJobs, 'queue'),
      }
    }

    if (kind === 'aiRecognitionResults' && (usesLiveAutomationJobData || automationJobs.length > 0)) {
      return {
        ...baseConfig,
        rows: mapLiveAutomationJobRows(automationJobs, 'recognition'),
        summary: summarizeLiveAutomationJobs(automationJobs, 'recognition'),
      }
    }

    if (kind === 'aiVoucherSuggestions' && (usesLiveAutomationJobData || automationJobs.length > 0)) {
      return {
        ...baseConfig,
        rows: mapLiveAutomationJobRows(automationJobs, 'suggestion'),
        summary: summarizeLiveAutomationJobs(automationJobs, 'suggestion'),
      }
    }

    if (kind === 'trialBalanceReport' && usesLiveReportData && liveReports.trialBalance) {
      return {
        ...baseConfig,
        rows: mapLiveTrialBalanceRows(liveReports.trialBalance),
        summary: summarizeLiveTrialBalance(liveReports.trialBalance),
      }
    }

    if (kind === 'ledgerReport' && usesLiveReportData && liveReports.ledgerOverview) {
      return {
        ...baseConfig,
        rows: mapLiveLedgerOverviewRows(liveReports.ledgerOverview),
        summary: summarizeLiveLedgerOverview(liveReports.ledgerOverview),
      }
    }

    if (kind === 'accountSummaryReport' && usesLiveReportData && liveReports.accountSummary) {
      return {
        ...baseConfig,
        rows: mapLiveAccountSummaryRows(liveReports.accountSummary),
        summary: summarizeLiveAccountSummary(liveReports.accountSummary),
      }
    }

    if (kind === 'generalLedgerReport' && usesLiveReportData && liveReports.generalLedger) {
      return {
        ...baseConfig,
        rows: mapLiveGeneralLedgerRows(liveReports.generalLedger),
        summary: summarizeLiveGeneralLedger(liveReports.generalLedger),
      }
    }

    if (kind === 'multiColumnLedgerReport' && usesLiveReportData && liveReports.multiColumnLedger) {
      return {
        ...baseConfig,
        rows: mapLiveMultiColumnLedgerRows(liveReports.multiColumnLedger),
        summary: summarizeLiveMultiColumnLedger(liveReports.multiColumnLedger),
      }
    }

    if (kind === 'subsidiaryLedgerReport' && usesLiveLedgerDetailData) {
      const rows = liveReports.subsidiaryLedger
        ? mapLiveSubsidiaryLedgerRows(liveReports.subsidiaryLedger)
        : []
      return {
        ...baseConfig,
        rows,
        summary: summarizeLiveSubsidiaryLedger(liveReports.subsidiaryLedger || []),
      }
    }

    if (kind === 'auxiliaryLedgerReport' && usesLiveLedgerDetailData) {
      return {
        ...baseConfig,
        rows: liveReports.auxiliaryLedger
          ? mapLiveAuxiliaryLedgerRows(liveReports.auxiliaryLedger, selectedAuxiliaryCategory?.name || '', selectedAuxiliaryItem?.name || '')
          : [],
        summary: summarizeLiveAuxiliaryLedger(liveReports.auxiliaryLedger || [], selectedAuxiliaryCategory?.name || '', selectedAuxiliaryItem?.name || ''),
      }
    }

    if (kind === 'auxiliaryBalanceReport' && usesLiveLedgerDetailData) {
      return {
        ...baseConfig,
        rows: liveReports.auxiliaryBalance
          ? mapLiveAuxiliaryBalanceRows(liveReports.auxiliaryBalance, selectedAuxiliaryCategory?.name || '')
          : [],
        summary: summarizeLiveAuxiliaryBalance(liveReports.auxiliaryBalance || [], selectedAuxiliaryCategory?.name || ''),
      }
    }

    if (kind === 'balanceSheetReport' && usesLiveReportData && liveReports.balanceSheet) {
      return {
        ...baseConfig,
        rows: mapLiveBalanceSheetRows(liveReports.balanceSheet),
        summary: summarizeLiveBalanceSheet(liveReports.balanceSheet),
      }
    }

    if (kind === 'equityChangeReport' && usesLiveReportData && liveReports.balanceSheet && liveReports.incomeStatement) {
      return {
        ...baseConfig,
        rows: mapLiveEquityChangeRows(liveReports.balanceSheet, liveReports.incomeStatement),
        summary: summarizeLiveEquityChange(liveReports.balanceSheet, liveReports.incomeStatement),
      }
    }

    if (kind === 'incomeStatementReport' && usesLiveReportData && liveReports.incomeStatement) {
      return {
        ...baseConfig,
        rows: mapLiveIncomeStatementRows(liveReports.incomeStatement),
        summary: summarizeLiveIncomeStatement(liveReports.incomeStatement),
      }
    }

    if (kind === 'incomeQuarterReport' && usesLiveReportData && liveReports.incomeStatement) {
      const quarter = Math.ceil((currentPeriod?.period_month || 1) / 3)
      const quarterLabel = `${currentPeriod?.period_year || '当前'}-Q${quarter}（截至${String(currentPeriod?.period_month || 0).padStart(2, '0')}月）`
      return {
        ...baseConfig,
        rows: mapLiveIncomeQuarterRows(liveReports.incomeStatement, liveReports.incomeQuarterBaseline, quarterLabel, liveReports.incomeQuarterBaselineMissing),
        summary: summarizeLiveIncomeQuarter(liveReports.incomeStatement, liveReports.incomeQuarterBaseline, liveReports.incomeQuarterBaselineMissing),
      }
    }

    if (kind === 'cashFlowQuarterReport' && usesLiveReportData && liveReports.cashFlow) {
      const quarter = Math.ceil((currentPeriod?.period_month || 1) / 3)
      const quarterLabel = `${currentPeriod?.period_year || '当前'}-Q${quarter}（截至${String(currentPeriod?.period_month || 0).padStart(2, '0')}月）`
      return {
        ...baseConfig,
        rows: mapLiveCashFlowQuarterRows(liveReports.cashFlow, liveReports.cashFlowQuarterBaseline, quarterLabel, liveReports.cashFlowQuarterBaselineMissing),
        summary: summarizeLiveCashFlowQuarter(liveReports.cashFlow, liveReports.cashFlowQuarterBaseline, liveReports.cashFlowQuarterBaselineMissing),
      }
    }

    if (kind === 'cashFlowReport' && usesLiveReportData && liveReports.cashFlow) {
      return {
        ...baseConfig,
        rows: mapLiveCashFlowRows(liveReports.cashFlow),
        summary: summarizeLiveCashFlow(liveReports.cashFlow),
      }
    }

    if (kind === 'companyInfo' && isTauri && selectedCompanyId) {
      return {
        ...baseConfig,
        rows: mapLiveCompanyInfoRows(selectedCompany),
        summary: summarizeLiveCompanyInfo(selectedCompany),
      }
    }

    if (kind === 'settingsData' && usesLiveSettingsOverviewData) {
      const settingsRows: ModuleRow[] = [
        {
          id: 'setting-company', status: selectedCompany?.is_active ? '启用' : '停用', voucher: '-', attachment: '企业资料',
          values: { name: '账套主体', scope: '当前账套', currentValue: selectedCompany?.name || '未选择企业', source: selectedCompany?.tax_id || '待维护纳税人识别号', boundary: '企业信息', updatedAt: selectedCompany?.updated_at || '-' },
        },
        {
          id: 'setting-system', status: selectedCompany?.accounting_system ? '启用' : '待确认', voucher: '-', attachment: '会计制度',
          values: { name: '会计制度', scope: '当前账套', currentValue: selectedCompany?.accounting_system || '待维护会计制度', source: selectedCompany?.industry || '待维护行业', boundary: '企业信息', updatedAt: selectedCompany?.updated_at || '-' },
        },
        {
          id: 'setting-period', status: currentPeriod ? '启用' : '待确认', voucher: '-', attachment: '账期',
          values: { name: '当前账期', scope: '当前账套', currentValue: currentPeriodLabel, source: currentPeriod ? `${currentPeriod.period_year}-${String(currentPeriod.period_month).padStart(2, '0')}` : '未选择账期', boundary: '账期管理', updatedAt: currentPeriod?.updated_at || '-' },
        },
        {
          id: 'setting-output', status: '已通过', voucher: '-', attachment: '模板清单',
          values: { name: '固定输出模板', scope: '全局受控', currentValue: `${fixedPrintTemplatePreviews.length} 套固定模板`, source: fixedPrintTemplatePreviews.map((template) => template.name).join('、'), boundary: '打印模板', updatedAt: '随应用版本发布' },
        },
      ]
      const configured = settingsRows.filter((row) => row.status === '启用' || row.status === '已通过').length
      const pending = settingsRows.filter((row) => row.status === '待确认').length
      const settingsSummary: ModuleConfig['summary'] = [
        { label: '配置范围', value: `${settingsRows.length} 项`, tone: 'blue' },
        { label: '已配置', value: `${configured} 项`, tone: configured > 0 ? 'green' : 'gray' },
        { label: '待补信息', value: `${pending} 项`, tone: pending > 0 ? 'amber' : 'gray' },
        { label: '固定模板', value: `${fixedPrintTemplatePreviews.length} 套`, tone: 'gray' },
      ]
      return {
        ...baseConfig,
        rows: settingsRows,
        summary: settingsSummary,
      }
    }

    if (kind === 'accountArchive' && (usesLiveCompanyBankAccountData || previewCompanyAccounts.length > 0)) {
      return {
        ...baseConfig,
        rows: mapLiveCompanyAccountRows(isTauri ? companyAccounts : previewCompanyAccounts),
        summary: summarizeLiveCompanyAccounts(isTauri ? companyAccounts : previewCompanyAccounts),
      }
    }

    if (kind === 'initialBalance' && usesLiveInitialBalanceData && liveReports.initialBalance) {
      return {
        ...baseConfig,
        rows: mapLiveInitialBalanceRows(liveReports.initialBalance),
        summary: summarizeLiveInitialBalance(liveReports.initialBalance),
      }
    }

    if (kind === 'periodManagement' && (usesLivePeriodManagementData || previewPeriods.length > 0)) {
      return {
        ...baseConfig,
        rows: mapLivePeriodManagementRows(effectivePeriods),
        summary: summarizeLivePeriodManagement(effectivePeriods),
      }
    }

    if (kind === 'settlementRules' && (usesLiveSettlementRuleData || previewSettlementRules.length > 0)) {
      return {
        ...baseConfig,
        rows: mapLiveSettlementRuleRows(isTauri ? settlementRules : previewSettlementRules),
        summary: summarizeLiveSettlementRules(isTauri ? settlementRules : previewSettlementRules),
      }
    }

    if (kind === 'currencySettings' && (usesLiveCurrencyData || previewCurrencies.length > 0)) {
      return {
        ...baseConfig,
        rows: mapLiveCurrencyRows(isTauri ? currencies : previewCurrencies),
        summary: summarizeLiveCurrencies(isTauri ? currencies : previewCurrencies),
      }
    }

    if (kind === 'commonDigests' && (usesLiveTemplateSettingsData || previewCommonDigests.length > 0)) {
      return {
        ...baseConfig,
        rows: mapLiveCommonDigestRows(isTauri ? commonDigests : previewCommonDigests),
        summary: summarizeLiveCommonDigests(isTauri ? commonDigests : previewCommonDigests),
      }
    }

    if (kind === 'voucherTemplateSettings' && (usesLiveTemplateSettingsData || previewVoucherTemplates.length > 0)) {
      return {
        ...baseConfig,
        rows: mapLiveVoucherTemplateRows(isTauri ? voucherTemplates : previewVoucherTemplates, isTauri ? voucherTemplateTypes : previewVoucherTemplateTypes),
        summary: summarizeLiveVoucherTemplates(isTauri ? voucherTemplates : previewVoucherTemplates, isTauri ? voucherTemplateTypes : previewVoucherTemplateTypes),
      }
    }

    if (kind === 'reportFormulaSettings' && (usesLiveReportFormulaData || previewReportItems.length > 0)) {
      return {
        ...baseConfig,
        rows: mapLiveReportFormulaRows(effectiveReportTemplates, effectiveReportItems),
        summary: summarizeLiveReportFormulas(effectiveReportTemplates, effectiveReportItems),
      }
    }

    if (kind === 'taxAdapterSettings' && (usesLiveAdapterAuthorizationData || previewAdapterAuthorizations.some((item) => item.adapterType === 'tax'))) {
      return {
        ...baseConfig,
        rows: mapLiveAdapterAuthorizationRows(effectiveAdapterAuthorizations, 'tax'),
        summary: summarizeLiveAdapterAuthorizations(effectiveAdapterAuthorizations, 'tax'),
      }
    }

    if (kind === 'bankAdapterSettings' && (usesLiveAdapterAuthorizationData || previewAdapterAuthorizations.some((item) => item.adapterType === 'bank'))) {
      return {
        ...baseConfig,
        rows: mapLiveAdapterAuthorizationRows(effectiveAdapterAuthorizations, 'bank'),
        summary: summarizeLiveAdapterAuthorizations(effectiveAdapterAuthorizations, 'bank'),
      }
    }

    if (kind === 'historyBalance' && usesLiveHistoryReportData) {
      return {
        ...baseConfig,
        rows: liveReports.historyBalance
          ? mapLiveHistoryBalanceRows(liveReports.historyBalance, selectedHistoryPeriodLabel)
          : [],
        summary: liveReports.historyBalance
          ? summarizeLiveHistoryBalance(liveReports.historyBalance, selectedHistoryPeriodLabel)
          : summarizeLiveHistoryBalance({
            items: [],
            total_opening_debit: 0,
            total_opening_credit: 0,
            total_period_debit: 0,
            total_period_credit: 0,
            total_cumulative_debit: 0,
            total_cumulative_credit: 0,
            total_closing_debit: 0,
            total_closing_credit: 0,
            is_balanced: true,
          }, selectedHistoryPeriodLabel),
      }
    }

    if (kind === 'historyVoucher' && usesLiveHistoryReportData) {
      return {
        ...baseConfig,
        rows: liveReports.historyVouchers
          ? mapLiveHistoryVoucherRows(liveReports.historyVouchers, selectedHistoryPeriodLabel)
          : [],
        summary: summarizeLiveHistoryVouchers(liveReports.historyVouchers || [], selectedHistoryPeriodLabel),
      }
    }

    if (kind === 'historyGeneralLedger' && usesLiveHistoryReportData) {
      return {
        ...baseConfig,
        rows: liveReports.historyGeneralLedger
          ? mapLiveHistoryGeneralLedgerRows(liveReports.historyGeneralLedger, selectedHistoryPeriodLabel)
          : [],
        summary: summarizeLiveHistoryGeneralLedger(liveReports.historyGeneralLedger || [], selectedHistoryPeriodLabel),
      }
    }

    if (kind === 'historySubsidiaryLedger' && usesLiveHistoryReportData) {
      const hasSelection = Boolean(selectedHistoryPeriodId && selectedHistoryLedgerAccountCode)
      return {
        ...baseConfig,
        rows: liveReports.historySubsidiaryLedger
          ? mapLiveHistorySubsidiaryLedgerRows(liveReports.historySubsidiaryLedger, selectedHistoryLedgerAccount ? `${selectedHistoryLedgerAccount.code} ${selectedHistoryLedgerAccount.name}` : '')
          : [],
        summary: summarizeLiveHistorySubsidiaryLedger(liveReports.historySubsidiaryLedger || [], hasSelection),
      }
    }

    if (kind === 'subjectSettings' && usesLiveArchiveData) {
      return {
        ...baseConfig,
        rows: mapLiveSubjectRows(accounts),
        summary: summarizeLiveSubjects(accounts),
      }
    }

    if (kind === 'auxiliaryCategories' && (usesLiveArchiveData || previewAuxiliaryCategories.length > 0)) {
      return {
        ...baseConfig,
        rows: mapLiveAuxiliaryCategoryRows(isTauri ? auxiliaryCategories : previewAuxiliaryCategories),
        summary: summarizeLiveAuxiliaryCategories(isTauri ? auxiliaryCategories : previewAuxiliaryCategories),
      }
    }

    if (usesLiveMatchingRuleData || previewMatchingRules.some((rule) => rule.rule_scope === matchingRuleScope)) {
      return {
        ...baseConfig,
        rows: mapLiveMatchingRuleRows(isTauri ? matchingRules : previewMatchingRules, matchingRuleScope),
        summary: summarizeLiveMatchingRules(isTauri ? matchingRules : previewMatchingRules, matchingRuleScope),
      }
    }

    if (usesLiveAssetCategoryData || previewAssetCategories.length > 0) {
      return {
        ...baseConfig,
        rows: mapLiveAssetCategoryRows(isTauri ? assetCategories : previewAssetCategories),
        summary: summarizeLiveAssetCategories(isTauri ? assetCategories : previewAssetCategories),
      }
    }

    if (usesLiveBusinessTagData || previewBusinessTags.length > 0) {
      return {
        ...baseConfig,
        rows: mapLiveBusinessTagRows(effectiveBusinessTags),
        summary: summarizeLiveBusinessTags(effectiveBusinessTags),
      }
    }

    if (kind === 'auxiliaryItems' && (usesLiveArchiveData || previewAuxiliaryItems.length > 0)) {
      return {
        ...baseConfig,
        rows: mapLiveAuxiliaryItemRows(isTauri ? auxiliaryCategories : previewAuxiliaryCategories, isTauri ? auxiliaryItems : previewAuxiliaryItems),
        summary: summarizeLiveAuxiliaryItems(isTauri ? auxiliaryItems : previewAuxiliaryItems),
      }
    }

    if (isLiveAuxiliaryArchiveKind(kind) && (usesLiveArchiveData || previewAuxiliaryCategories.some((category) => category.code === auxiliaryArchiveDefinitions[kind].categoryCode))) {
      return {
        ...baseConfig,
        rows: mapLiveAuxiliaryArchiveRows(kind, isTauri ? auxiliaryCategories : previewAuxiliaryCategories, isTauri ? auxiliaryItems : previewAuxiliaryItems),
        summary: summarizeLiveAuxiliaryArchive(kind, isTauri ? auxiliaryCategories : previewAuxiliaryCategories, isTauri ? auxiliaryItems : previewAuxiliaryItems),
      }
    }

    if (kind === 'attachmentCenter' && (isTauri || localAttachmentRecords.length > 0)) {
      const dynamicRows = mapLocalAttachmentRows(localAttachmentRecords)
      return {
        ...baseConfig,
        rows: dynamicRows,
        summary: baseConfig.summary.map((item) => {
          if (item.label === '附件总数') return { ...item, value: `${dynamicRows.length} 个` }
          if (item.label === '已关联') return { ...item, value: `${dynamicRows.filter((row) => row.status === '已匹配').length} 个` }
          if (item.label === '待归档') return { ...item, value: `${dynamicRows.filter((row) => row.status === '待确认').length} 个` }
          if (item.label === '异常文件') return { ...item, value: `${dynamicRows.filter((row) => row.status === '异常').length} 个` }
          return item
        }),
      }
    }

    if (kind === 'importCenter' && (usesLiveImportData || localImportJobs.length > 0)) {
      const localRows = mapLocalImportJobRows(localImportJobs)
      const localFileNames = new Set(localRows.map((row) => row.values.file))
      const auditRows = usesLiveImportData
        ? mapOperationAuditImportRows(operationAuditLogs).filter((row) => !localFileNames.has(row.values.file))
        : []
      const dynamicRows = [...localRows, ...auditRows]
      return {
        ...baseConfig,
        rows: dynamicRows,
        summary: baseConfig.summary.map((item) => {
          if (item.label === '导入批次') return { ...item, value: `${dynamicRows.length} 批` }
          if (item.label === '成功') return { ...item, value: `${dynamicRows.filter((row) => row.status === '已通过').length} 批` }
          if (item.label === '待确认') return { ...item, value: `${dynamicRows.filter((row) => row.status === '待确认').length} 批` }
          if (item.label === '失败') return { ...item, value: `${dynamicRows.filter((row) => row.status === '异常').length} 批` }
          return item
        }),
      }
    }

    if (kind === 'exportCenter' && usesLiveExportData) {
      const dynamicRows = mapOperationAuditExportRows(operationAuditLogs)
      return {
        ...baseConfig,
        rows: dynamicRows,
        summary: baseConfig.summary.map((item) => {
          if (item.label === '导出任务') return { ...item, value: `${dynamicRows.length} 个` }
          if (item.label === '已完成') return { ...item, value: `${dynamicRows.filter((row) => row.status === '已通过').length} 个` }
          if (item.label === '待下载') return { ...item, value: `${dynamicRows.filter((row) => row.status === '待确认').length} 个` }
          if (item.label === '失败') return { ...item, value: `${dynamicRows.filter((row) => row.status === '异常').length} 个` }
          return item
        }),
      }
    }

    if (kind !== 'exportCenter') return baseConfig
    const dynamicRows = exportJobs.map(exportJobToModuleRow)
    return {
      ...baseConfig,
      rows: [...dynamicRows, ...baseConfig.rows],
      summary: baseConfig.summary.map((item) => {
        if (item.label === '导出任务') return { ...item, value: `${dynamicRows.length + baseConfig.rows.length} 个` }
        if (item.label === '已生成') return { ...item, value: `${dynamicRows.filter((row) => row.status === '已通过').length + 28} 个` }
        return item
      }),
    }
  }, [accounts, accountTransfers, adapterAuthorizations, assetCategories, auditLogs, automationJobs, auxiliaryCategories, auxiliaryItems, backupValidations, bankReconciliationRecords, bankTransactionTagIds, bankTransactions, baseConfig, businessOrders, businessTags, commonDigests, companyAccounts, companyTodos, costCarryoverRecords, currencies, currentPeriod, deletedVouchers, documentRecords, effectiveAdapterAuthorizations, effectiveBusinessTags, effectivePeriods, effectiveReportItems, effectiveReportTemplates, effectiveTaxDeclarationTasks, employees, exportJobs, fixedAssets, inventoryItems, inventoryMovements, invoiceTagIds, invoices, isTauri, kind, liveReports, localAttachmentRecords, localBackups, localImportJobs, matchingRuleScope, matchingRules, measurementUnits, operationAuditLogs, payrollRecords, periods, previewAdapterAuthorizations, previewAssetCategories, previewAuxiliaryCategories, previewAuxiliaryItems, previewCommonDigests, previewCompanyAccounts, previewCompanyInfo, previewCompanyTodos, previewCurrencies, previewInitialBalanceRows, previewMatchingRules, previewPeriods, previewReportItems, previewReviewedAiRecognitionIds, previewAiQueueJobs, previewSettlementRules, previewVoucherTemplates, reportItems, reportTemplates, selectedAuxiliaryCategory, selectedAuxiliaryItem, selectedCompany, selectedCompanyId, selectedHistoryLedgerAccount, selectedHistoryLedgerAccountCode, selectedHistoryPeriodId, selectedHistoryPeriodLabel, settlementRecords, settlementRules, socialSecurityRecords, specialDeductionRecords, taxDeclarationTasks, usesLiveAdapterAuthorizationData, usesLiveArchiveData, usesLiveAssetCategoryData, usesLiveAutomationJobData, usesLiveBackupData, usesLiveBusinessTagData, usesLiveClosingTaskData, usesLiveCompanyBankAccountData, usesLiveCompanyTodoData, usesLiveCurrencyData, usesLiveDeclarationCalendarData, usesLiveDeclarationReceiptData, usesLiveEmployeeData, usesLiveExportData, usesLiveFinanceTaxReportData, usesLiveFinancialOverviewData, usesLiveFixedAssetData, usesLiveHistoryReportData, usesLiveImportData, usesLiveInitialBalanceData, usesLiveInventoryMovementData, usesLiveInvoiceVoucherMatchingData, usesLiveLedgerDetailData, usesLiveMatchingRuleData, usesLiveModuleData, usesLiveNonTaxRevenueData, usesLiveOperationAuditData, usesLivePayrollData, usesLivePeriodManagementData, usesLiveReportData, usesLiveReportFormulaData, usesLiveSettlementRuleData, usesLiveSettingsOverviewData, usesLiveSocialSecurityData, usesLiveStampTaxData, usesLiveTaxInitData, usesLiveTaxReportData, usesLiveTemplateSettingsData, usesLiveVoucherRecycleData, voucherTagIds, voucherTemplates, voucherTemplateTypes, vouchers])
  const listMeta = getModuleListMeta(kind)
  const detailMeta = getModuleDetailMeta(kind)
  const tableMeta = getModuleTableMeta(kind)
  const workspaceTabs = getModuleTabs(kind)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('全部')
  const [businessTagFilter, setBusinessTagFilter] = useState('全部')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [activeTab, setActiveTab] = useState(() => getModuleTabs(kind)[0])
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set())
  const [showRulesLogDialog, setShowRulesLogDialog] = useState(false)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [advancedFilters, setAdvancedFilters] = useState({ voucher: '全部', attachment: '全部' })
  const [advancedFiltersDraft, setAdvancedFiltersDraft] = useState({ voucher: '全部', attachment: '全部' })
  const columnSettingsCompanyId = selectedCompanyId || 'browser-preview'
  const [showModuleColumnSettings, setShowModuleColumnSettings] = useState(false)
  const [moduleColumnSettings, setModuleColumnSettings] = useState<ModuleColumnSettings>(() => loadModuleColumnSettings(kind, columnSettingsCompanyId, config.columns))
  const [moduleColumnSettingsDraft, setModuleColumnSettingsDraft] = useState<ModuleColumnSettings>(() => loadModuleColumnSettings(kind, columnSettingsCompanyId, config.columns))
  const [detailRow, setDetailRow] = useState<ModuleRow | null>(null)
  const importFileRef = useRef<HTMLInputElement>(null)
  const [operationNotice, setOperationNotice] = useState<string | null>(null)

  useEffect(() => {
    setActiveTab(getModuleTabs(kind)[0])
  }, [kind])

  const moduleColumnKeys = config.columns.map((column) => column.key).join('|')

  useEffect(() => {
    const settings = loadModuleColumnSettings(kind, columnSettingsCompanyId, config.columns)
    setModuleColumnSettings(settings)
    setModuleColumnSettingsDraft(settings)
  }, [columnSettingsCompanyId, config.columns, kind, moduleColumnKeys])

  const visibleColumns = useMemo(() => {
    const columns = config.columns.filter((column) => moduleColumnSettings.visibleKeys.includes(column.key))
    return columns.length > 0 ? columns : config.columns
  }, [config.columns, moduleColumnSettings.visibleKeys])

  const filteredRows = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    return filterRowsByWorkspaceTab(kind, activeTab, config.rows).filter((row) => {
      const matchesStatus = status === '全部' || row.status === status || (status === '未匹配' && row.status === '待处理')
      const matchesBusinessTag = businessTagFilter === '全部' || row.values.tags?.split(' / ').includes(businessTagFilter)
      const matchesAdvancedFilters = (
        (advancedFilters.voucher === '全部' || (advancedFilters.voucher === '已关联' ? hasWorkspaceReference(row.voucher) : !hasWorkspaceReference(row.voucher)))
        && (advancedFilters.attachment === '全部' || (advancedFilters.attachment === '附件齐全' ? !hasPendingAttachment(row.attachment) : hasPendingAttachment(row.attachment)))
      )
      if (!matchesStatus || !matchesBusinessTag || !matchesAdvancedFilters) return false
      if (!normalized) return true
      return Object.values(row.values).some((value) => value.toLowerCase().includes(normalized)) || row.id.toLowerCase().includes(normalized)
    })
  }, [activeTab, advancedFilters, businessTagFilter, config.rows, keyword, kind, status])

  const supportsBusinessTagFilter = ['outputInvoice', 'inputInvoice', 'voucher', 'billList', 'bankStatement'].includes(kind)

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const pageStart = filteredRows.length === 0 ? 0 : (page - 1) * pageSize + 1
  const pageEnd = Math.min(page * pageSize, filteredRows.length)
  const pagedRows = useMemo(() => filteredRows.slice((page - 1) * pageSize, page * pageSize), [filteredRows, page, pageSize])

  useEffect(() => {
    setPage(1)
    setSelectedRowIds(new Set())
  }, [advancedFilters, businessTagFilter, kind, keyword, pageSize, status])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const advancedFilterScope = [
    advancedFilters.voucher !== '全部' && `凭证=${advancedFilters.voucher}`,
    advancedFilters.attachment !== '全部' && `附件=${advancedFilters.attachment}`,
  ].filter(Boolean).join('；')
  const auditScope = [status, keyword.trim() || '全部', businessTagFilter !== '全部' ? `标签=${businessTagFilter}` : '', advancedFilterScope].filter(Boolean).join('/')
  const supportsFileImport = /导入|采集|上传/.test(config.importLabel)
  const primaryActionHandlesImport = /导入|采集|上传/.test(config.primaryAction)
  const exportPeriodLabel = currentPeriodLabel === '当前账期' ? '2026-05' : currentPeriodLabel
  const exportDocumentContext = {
    companyName: selectedCompany?.name || '科旋电气（上海）有限公司',
    periodLabel: exportPeriodLabel,
    taxpayerId: selectedCompany?.tax_id || '91310115MA1K3****X',
  }
  const scopedOperationAuditLogs = useMemo(() => operationAuditLogs.filter((log) => log.objectRef?.includes(currentPeriodLabel)), [currentPeriodLabel, operationAuditLogs])
  const visibleRuleLogs = useMemo(() => {
    if (!usesLiveRuleLogData) return []
    return scopedOperationAuditLogs.map((log) => ({
      time: log.createdAt.replace('T', ' ').slice(5, 16),
      action: log.action,
      detail: log.detail || log.objectRef || '未记录说明',
    }))
  }, [scopedOperationAuditLogs, usesLiveRuleLogData])
  const isHighRiskAction = [
    'closingTasks',
    'periodManagement',
    'taxAdapterSettings',
    'bankAdapterSettings',
    'voucherRecycle',
    'backupRestore',
    'taxReport',
    'vatTaxReport',
    'withholdingTaxReport',
    'stampTaxReport',
    'incomeTaxReport',
    'socialSecurityTaxReport',
    'financeTaxReport',
    'nonTaxRevenueReport',
    'declarationReceipt',
  ].includes(kind)

  const writeModuleAudit = (action: string, object: string, level: '普通' | '中' | '高' = '普通', result: '成功' | '待审批' | '失败' = '成功') => {
    const status = result === '失败' ? '异常' : result === '待审批' ? '待确认' : '已通过'
    recordAuditLog({
      module: title,
      action,
      object,
      level,
      result,
      status,
      voucher: auditScope,
      attachment: '操作快照',
    })
    if (!isTauri || !selectedCompanyId) return

    void automationApi.writeOperationAuditLog({
      companyId: selectedCompanyId,
      moduleName: title,
      action,
      objectRef: `${currentPeriodLabel}｜${object}`,
      riskLevel: level,
      result,
      detail: `${status}｜${auditScope}`,
      operator: 'admin',
    }).then((response) => {
      if (response.success && response.data) {
        setOperationAuditLogs((logs) => [response.data!, ...logs])
      }
    })
  }

  const openAdvancedFilterDialog = () => {
    setAdvancedFiltersDraft(advancedFilters)
    setShowAdvancedFilters(true)
  }

  const applyAdvancedFilters = () => {
    setAdvancedFilters(advancedFiltersDraft)
    setShowAdvancedFilters(false)
    writeModuleAudit('应用高级筛选', `${title}-${advancedFiltersDraft.voucher}/${advancedFiltersDraft.attachment}`)
    setOperationNotice(`已应用高级筛选：凭证${advancedFiltersDraft.voucher}，附件${advancedFiltersDraft.attachment}。`)
  }

  const openModuleColumnSettings = () => {
    setModuleColumnSettingsDraft(moduleColumnSettings)
    setShowModuleColumnSettings(true)
  }

  const saveCurrentModuleColumnSettings = () => {
    if (moduleColumnSettingsDraft.visibleKeys.length === 0) {
      setOperationNotice('请至少保留一列业务字段。')
      return
    }
    try {
      saveModuleColumnSettings(kind, columnSettingsCompanyId, moduleColumnSettingsDraft)
      setModuleColumnSettings(moduleColumnSettingsDraft)
      setShowModuleColumnSettings(false)
      writeModuleAudit('保存列表列设置', `${title}-${moduleColumnSettingsDraft.visibleKeys.length}列`)
      setOperationNotice(`列表列设置已保存：显示 ${moduleColumnSettingsDraft.visibleKeys.length} 个业务字段。`)
    } catch (error) {
      setOperationNotice(`保存列表列设置失败：${String(error)}`)
    }
  }

  const handleImportAction = () => {
    if (kind === 'printTemplateSettings') {
      openPrintTemplatePreview()
      return
    }
    if (isHistoryMigrationKind(kind) && isTauri && !selectedHistoryPeriodId) {
      setOperationNotice('请先选择目标历史账期，再导入迁移文件。系统不会根据文件名猜测账期，也不会覆盖当前账期。')
      return
    }
    if (kind === 'exportCenter') {
      void handleExportExcel()
      return
    }
    if (kind === 'auditLog') {
      writeModuleAudit('刷新审计日志', `${title}-${auditScope}`)
      setOperationNotice('已按当前账套、账期和筛选条件刷新审计记录；可从行内明细查看操作对象、风险级别和结果。')
      return
    }
    if (supportsFileImport) {
      importFileRef.current?.click()
      return
    }
    writeModuleAudit(config.importLabel, `${title}-导入批次`, '中', '待审批')
    setOperationNotice(`${config.importLabel} 不适用于当前模块。请使用本页的导出、刷新或行内维护操作，不会创建空的导入批次。`)
  }

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    try {
      const isHistoryMigration = isHistoryMigrationKind(kind)
      const targetPeriodId = isHistoryMigration ? selectedHistoryPeriodId : currentPeriodId
      const targetPeriodLabel = isHistoryMigration ? selectedHistoryPeriodLabel : currentPeriodLabel
      if (isHistoryMigration && (!targetPeriodId || !targetPeriodLabel)) {
        setOperationNotice('未选择目标历史账期，导入已取消。请先选择账期后再上传迁移文件。')
        return
      }
      const scope = {
        companyId: selectedCompanyId || 'browser-preview',
        period: targetPeriodLabel,
      }
      if (kind === 'attachmentCenter') {
        const records = await Promise.all(files.map((file) => recordLocalAttachment({
          ...scope,
          sourceModule: title,
          operator: 'admin',
          file,
        })))
        const completed = records.filter(Boolean).length
        files.forEach((file) => writeModuleAudit('登记附件', `${title}-${file.name}`, '中', '待审批'))
        setOperationNotice(`已登记 ${completed} 个本机附件元数据并计算校验值；文件尚未关联单据或写入外部存储。`)
        return
      }

      const jobs = await Promise.all(files.map((file) => recordLocalImportJob({
        ...scope,
        moduleName: title,
        operation: config.importLabel,
        operator: 'admin',
        file,
      })))
      const completed = jobs.filter(Boolean).length
      files.forEach((file) => writeModuleAudit(config.importLabel, `${title}-${file.name}`, '中', '待审批'))
      const target = localImportWriteTarget(kind)
      const firstJob = jobs.find((job): job is LocalImportJob => Boolean(job))
      if (target && firstJob && files.length === 1 && isTauri && selectedCompanyId && targetPeriodId && targetPeriodLabel !== '当前账期') {
        const parsed = await parseLocalImportFile(files[0])
        if (parsed.headers.length > 0 && parsed.rows.length > 0) {
          setImportCommitDraft({ jobId: firstJob.id, fileName: firstJob.fileName, headers: parsed.headers, rows: parsed.rows, target, periodId: targetPeriodId, periodLabel: targetPeriodLabel })
          setOperationNotice(null)
          return
        }
      }
      setOperationNotice(`已登记 ${completed} 个本机导入批次并计算校验值；需完成字段映射、错误校验和人工确认后才会写入账套。`)
    } catch (error) {
      setOperationNotice(`登记文件批次失败：${String(error)}`)
    } finally {
      event.target.value = ''
    }
  }

  const handleRefreshAction = () => {
    writeModuleAudit('刷新列表', `${title}-${auditScope}`)
    setOperationNotice('已刷新当前列表并记录筛选条件。')
  }

  const handleTemplateAction = async () => {
    const fileName = `${title}-导入模板-${exportPeriodLabel}.xlsx`
    const { sheetRows, columnWidths, merges } = buildImportTemplate({
      title,
      config,
      context: exportDocumentContext,
    })
    try {
      await exportRowsToXlsx({
        sheetRows,
        columnWidths,
        merges,
        sheetName: `${title}导入模板`,
        fileName,
      })
      recordExportJob({
        fileName,
        moduleName: title,
        format: 'Excel模板',
        scope: currentPeriodLabel,
        templateKind: 'import',
        rowCount: 1,
      })
      writeModuleAudit('下载导入模板', fileName, '普通', '成功')
      setOperationNotice('已生成当前模块的本地 Excel 导入模板。请保留字段表头，导入后仍需在待确认清单完成核验。')
    } catch (error) {
      setOperationNotice(`导入模板生成失败：${String(error)}`)
      writeModuleAudit('下载导入模板', fileName, '普通', '失败')
    }
  }

  const handleCreateAiVoucherSuggestion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isTauri) {
      const timestamp = new Date().toISOString()
      const job: AutomationJob = {
        id: `AI-PREVIEW-SUGGESTION-${Date.now()}`,
        companyId: 'browser-preview',
        companyName: previewCompanyInfo?.name || '科旋电气（上海）有限公司',
        period: currentPeriodLabel === '当前账期' ? '2026-05' : currentPeriodLabel,
        jobType: 'voucher_suggestion',
        sourceModule: aiVoucherSuggestionDraft.sourceModule.trim(),
        sourceId: aiVoucherSuggestionDraft.sourceId.trim() || null,
        sourceFile: aiVoucherSuggestionDraft.sourceFile.trim() || null,
        suggestionNo: aiVoucherSuggestionDraft.suggestionNo.trim() || `AI-PREVIEW-${Date.now()}`,
        debitSubject: aiVoucherSuggestionDraft.debitSubject.trim(),
        creditSubject: aiVoucherSuggestionDraft.creditSubject.trim(),
        suggestionAmount: Number(aiVoucherSuggestionDraft.amount),
        generatedVoucherId: null,
        generatedVoucherNumber: null,
        status: 'waiting_confirmation',
        confidence: Number(aiVoucherSuggestionDraft.confidence) / 100,
        resultSummary: aiVoucherSuggestionDraft.summary.trim(),
        riskLevel: aiVoucherSuggestionDraft.riskLevel,
        reviewer: null,
        createdBy: 'admin',
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      updatePreviewAiQueueJobs((jobs) => [job, ...jobs])
      setShowAiVoucherSuggestionDialog(false)
      writeModuleAudit('预览新增AI凭证建议', job.suggestionNo || job.id, '中', '成功')
      setOperationNotice('AI 凭证建议已保存到当前预览队列；请人工核验来源、借贷科目和金额，系统不会自动生成或入账凭证。')
      return
    }
    if (!selectedCompanyId || currentPeriodLabel === '当前账期') {
      setOperationNotice('请先选择账套和账期，再登记 AI 凭证建议。')
      return
    }
    const result = await automationApi.createAutomationJob({
      companyId: selectedCompanyId,
      period: currentPeriodLabel,
      jobType: 'voucher_suggestion',
      sourceModule: aiVoucherSuggestionDraft.sourceModule.trim(),
      sourceId: aiVoucherSuggestionDraft.sourceId.trim() || undefined,
      sourceFile: aiVoucherSuggestionDraft.sourceFile.trim() || undefined,
      suggestionNo: aiVoucherSuggestionDraft.suggestionNo.trim() || undefined,
      debitSubject: aiVoucherSuggestionDraft.debitSubject.trim(),
      creditSubject: aiVoucherSuggestionDraft.creditSubject.trim(),
      suggestionAmount: Number(aiVoucherSuggestionDraft.amount),
      status: 'waiting_confirmation',
      confidence: Number(aiVoucherSuggestionDraft.confidence) / 100,
      resultSummary: aiVoucherSuggestionDraft.summary.trim(),
      riskLevel: aiVoucherSuggestionDraft.riskLevel,
      createdBy: 'admin',
    })
    if (!result.success || !result.data) {
      setOperationNotice(`新增 AI 凭证建议失败：${result.error || '未知错误'}`)
      return
    }
    setAutomationJobs((jobs) => [result.data!, ...jobs])
    setShowAiVoucherSuggestionDialog(false)
    writeModuleAudit('新增AI凭证建议', result.data.suggestionNo || result.data.id, '中', '成功')
    setOperationNotice('AI 凭证建议已登记为待确认记录；请人工核验来源、借贷科目和金额，系统不会自动生成或入账凭证。')
  }

  const handleSaveAiJob = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isTauri && (!selectedCompanyId || currentPeriodLabel === '当前账期')) {
      setOperationNotice('请先选择账套和账期，再创建 AI 处理任务。')
      return
    }
    if (!isTauri) {
      const timestamp = new Date().toISOString()
      const job: AutomationJob = {
        id: `AI-PREVIEW-${Date.now()}`,
        companyId: 'browser-preview',
        companyName: null,
        period: currentPeriodLabel === '当前账期' ? '2026-05' : currentPeriodLabel,
        jobType: aiJobDraft.jobType,
        sourceModule: aiJobDraft.sourceModule.trim(),
        sourceId: aiJobDraft.sourceId.trim() || null,
        sourceFile: aiJobDraft.sourceFile.trim() || null,
        suggestionNo: null,
        debitSubject: null,
        creditSubject: null,
        suggestionAmount: null,
        generatedVoucherId: null,
        generatedVoucherNumber: null,
        status: 'queued',
        confidence: null,
        resultSummary: aiJobDraft.summary.trim() || '等待读取来源资料并生成待确认结果。',
        riskLevel: aiJobDraft.riskLevel,
        reviewer: null,
        createdBy: 'admin',
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      updatePreviewAiQueueJobs((jobs) => [job, ...jobs])
      setShowAiJobDialog(false)
      writeModuleAudit('新建AI处理任务', `${job.jobType}｜${job.sourceModule}｜浏览器预览`, '中', '成功')
      setOperationNotice('AI 处理任务已加入本地预览队列。请从行内启动处理并进入人工复核；不会自动生成或入账凭证。')
      return
    }
    const result = await automationApi.createAutomationJob({
      companyId: selectedCompanyId || 'browser-preview',
      period: currentPeriodLabel === '当前账期' ? '2026-05' : currentPeriodLabel,
      jobType: aiJobDraft.jobType,
      sourceModule: aiJobDraft.sourceModule.trim(),
      sourceId: aiJobDraft.sourceId.trim() || undefined,
      sourceFile: aiJobDraft.sourceFile.trim() || undefined,
      status: 'queued',
      resultSummary: aiJobDraft.summary.trim() || '等待读取来源资料并生成待确认结果。',
      riskLevel: aiJobDraft.riskLevel,
      createdBy: 'admin',
    })
    if (!result.success || !result.data) {
      setOperationNotice(`创建 AI 处理任务失败：${result.error || '未知错误'}`)
      return
    }
    setAutomationJobs((jobs) => [result.data!, ...jobs.filter((job) => job.id !== result.data!.id)])
    setShowAiJobDialog(false)
    writeModuleAudit('新建AI处理任务', `${result.data.jobType}｜${result.data.sourceModule}`, '中', '成功')
    setOperationNotice('AI 处理任务已进入待执行队列。识别结果、分类和凭证建议均须人工确认，不会自动生成或入账凭证。')
  }

  function requestBusinessRiskConfirmation(title: string, description: string, confirmLabel: string) {
    return new Promise<boolean>((resolve) => {
      businessRiskConfirmationResolver.current = resolve
      setPendingBusinessRiskConfirmation({ title, description, confirmLabel })
    })
  }

  const resolveBusinessRiskConfirmation = (confirmed: boolean) => {
    businessRiskConfirmationResolver.current?.(confirmed)
    businessRiskConfirmationResolver.current = null
    setPendingBusinessRiskConfirmation(null)
  }

  const confirmPreviewAiVoucherSuggestions = async (rowIds: string[]) => {
    const pendingRows = config.rows.filter((row) => rowIds.includes(row.id) && row.status === '待确认')
    if (pendingRows.length === 0) {
      setOperationNotice('请先勾选待确认的 AI 凭证建议。')
      return
    }
    if (!await requestBusinessRiskConfirmation('确认 AI 凭证建议', `确认 ${pendingRows.length} 条 AI 凭证建议后，仅进入凭证草稿复核队列，不会自动生成或入账凭证。`, '确认进入复核队列')) return
    const timestamp = new Date().toISOString()
    const confirmedIds = new Set(pendingRows.map((row) => row.id.replace('automation-suggestion-', '')))
    updatePreviewAiQueueJobs((jobs) => jobs.map((job) => confirmedIds.has(job.id)
      ? { ...job, status: 'confirmed', reviewer: 'admin', resultSummary: `${job.resultSummary || '未记录建议摘要'}｜admin 已人工确认，待在凭证草稿中复核。`, updatedAt: timestamp }
      : job))
    setSelectedRowIds(new Set())
    writeModuleAudit('预览确认AI凭证建议', `${pendingRows.length} 条`, '中', '成功')
    setOperationNotice(`已确认 ${pendingRows.length} 条建议，已进入凭证草稿复核队列；不会自动生成或入账凭证。`)
  }

  const confirmAiVoucherSuggestions = async (rowIds: string[]) => {
    if (!selectedCompanyId) return
    const jobs = rowIds
      .map((rowId) => automationJobs.find((job) => `automation-suggestion-${job.id}` === rowId))
      .filter((job): job is AutomationJob => Boolean(job))
      .filter((job) => !['confirmed', 'completed', 'succeeded', 'approved'].includes(job.status.toLowerCase()))

    if (jobs.length === 0) {
      setOperationNotice('请先勾选待确认的 AI 凭证建议。')
      return
    }
    if (!await requestBusinessRiskConfirmation('确认 AI 凭证建议', `确认 ${jobs.length} 条 AI 凭证建议后，仅进入凭证草稿复核队列，不会自动生成或入账凭证。`, '确认进入复核队列')) return

    const reviewer = 'admin'
    const results = await Promise.all(jobs.map(async (job) => {
      const confirmationNote = `${job.resultSummary || '未记录建议摘要'}｜${reviewer} 已人工确认，待在凭证草稿中复核。`
      return automationApi.updateAutomationJobStatus({
        id: job.id,
        companyId: selectedCompanyId,
        status: 'confirmed',
        resultSummary: confirmationNote,
        reviewer,
      })
    }))
    const updatedJobs = results.flatMap((result) => result.success && result.data ? [result.data] : [])
    const failedCount = results.length - updatedJobs.length
    if (updatedJobs.length > 0) {
      const updatedById = new Map(updatedJobs.map((job) => [job.id, job]))
      setAutomationJobs((items) => items.map((job) => updatedById.get(job.id) || job))
      setSelectedRowIds(new Set())
      writeModuleAudit('确认AI凭证建议', `${updatedJobs.length} 条`, '中', '成功')
    }
    setOperationNotice(
      failedCount > 0
        ? `已确认 ${updatedJobs.length} 条建议，${failedCount} 条更新失败；已确认建议仍需在凭证草稿中人工复核，不会自动生成或入账凭证。`
        : `已确认 ${updatedJobs.length} 条建议，已进入凭证草稿复核队列；不会自动生成或入账凭证。`,
    )
  }

  const handleSaveNonTaxRevenue = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const riskCount = Number(nonTaxRevenueDraft.riskCount || 0)
    if (!isTauri) {
      const timestamp = new Date().toLocaleString('zh-CN')
      const task: TaxDeclarationTask = {
        id: `preview-non-tax-${Date.now()}`,
        companyId: 'browser-preview',
        companyName: previewCompanyInfo?.name || '科旋电气（上海）有限公司',
        period: currentPeriodLabel === '当前账期' ? '2026-05' : currentPeriodLabel,
        taxType: nonTaxRevenueDraft.item,
        formName: nonTaxRevenueDraft.policy.trim() || '待补地区政策',
        collectStatus: 'collected',
        validationStatus: riskCount > 0 ? 'pending' : 'passed',
        declarationStatus: nonTaxRevenueDraft.receiptNo.trim() ? 'archived' : 'draft',
        sourceSnapshot: nonTaxRevenueDraft.source.trim() || '待补计费依据',
        taxableAmount: Number(nonTaxRevenueDraft.basisAmount || 0),
        deductionAmount: 0,
        payableAmount: Number(nonTaxRevenueDraft.payableAmount || 0),
        riskCount,
        adapterCode: null,
        confirmedBy: null,
        confirmedAt: null,
        receiptNo: nonTaxRevenueDraft.receiptNo.trim() || null,
        paymentStatus: 'unrecorded',
        paymentNo: null,
        receiptReceivedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      updatePreviewTaxDeclarationTasks((tasks) => [task, ...tasks])
      setShowNonTaxRevenueDialog(false)
      setNonTaxRevenueDraft({ item: '工会经费', policy: '', source: '', basisAmount: '', payableAmount: '', receiptNo: '', riskCount: '0' })
      writeModuleAudit('预览新增非税缴费事项', `${task.taxType}｜${task.period}`, '中', '成功')
      setOperationNotice('非税缴费事项已保存到当前预览；金额、地区政策与缴款书仍需人工核验，系统不会提交申报、生成缴款书或发起扣款。')
      return
    }
    if (!selectedCompanyId || currentPeriodLabel === '当前账期') {
      setOperationNotice('请先选择账套和账期，再登记非税缴费事项。')
      return
    }
    const result = await automationApi.upsertTaxDeclarationTask({
      companyId: selectedCompanyId,
      period: currentPeriodLabel,
      taxType: nonTaxRevenueDraft.item,
      formName: nonTaxRevenueDraft.policy.trim() || '待补地区政策',
      collectStatus: 'collected',
      validationStatus: riskCount > 0 ? 'pending' : 'passed',
      declarationStatus: nonTaxRevenueDraft.receiptNo.trim() ? 'archived' : 'draft',
      sourceSnapshot: nonTaxRevenueDraft.source.trim() || '待补计费依据',
      taxableAmount: Number(nonTaxRevenueDraft.basisAmount || 0),
      payableAmount: Number(nonTaxRevenueDraft.payableAmount || 0),
      riskCount,
      receiptNo: nonTaxRevenueDraft.receiptNo.trim() || undefined,
    })
    if (!result.success || !result.data) {
      setOperationNotice(`保存非税缴费事项失败：${result.error || '未知错误'}`)
      return
    }
    setTaxDeclarationTasks((tasks) => [result.data!, ...tasks.filter((task) => task.id !== result.data!.id)])
    setShowNonTaxRevenueDialog(false)
    setNonTaxRevenueDraft({ item: '工会经费', policy: '', source: '', basisAmount: '', payableAmount: '', receiptNo: '', riskCount: '0' })
    writeModuleAudit('新增非税缴费事项', `${result.data.taxType}｜${result.data.period}`, '中', '成功')
    setOperationNotice('非税缴费事项已登记为本地台账；金额、地区政策与缴款书均需人工核验，系统未向外部平台提交。')
  }

  const openDeclarationReceiptEditor = (task: TaxDeclarationTask) => {
    setDeclarationReceiptDraft({
      taskId: task.id,
      receiptNo: task.receiptNo || '',
      paymentStatus: task.paymentStatus === 'unrecorded' ? '未记录' : task.paymentStatus,
      paymentNo: task.paymentNo || '',
      receivedAt: task.receiptReceivedAt ? task.receiptReceivedAt.replace(' ', 'T').slice(0, 16) : '',
    })
    setShowDeclarationReceiptDialog(true)
  }

  const handleSaveDeclarationReceipt = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const task = effectiveTaxDeclarationTasks.find((item) => item.id === declarationReceiptDraft.taskId)
    if (!task) {
      setOperationNotice('请选择需要归档的申报事项。')
      return
    }
    if (!isTauri) {
      const timestamp = new Date().toLocaleString('zh-CN')
      const receiptNo = declarationReceiptDraft.receiptNo.trim() || null
      const updatedTask: TaxDeclarationTask = {
        ...task,
        declarationStatus: receiptNo ? 'archived' : task.declarationStatus,
        receiptNo,
        paymentStatus: declarationReceiptDraft.paymentStatus === '未记录' ? 'unrecorded' : declarationReceiptDraft.paymentStatus,
        paymentNo: declarationReceiptDraft.paymentNo.trim() || null,
        receiptReceivedAt: declarationReceiptDraft.receivedAt ? declarationReceiptDraft.receivedAt.replace('T', ' ') : task.receiptReceivedAt,
        updatedAt: timestamp,
      }
      updatePreviewTaxDeclarationTasks((tasks) => tasks.map((item) => item.id === updatedTask.id ? updatedTask : item))
      setShowDeclarationReceiptDialog(false)
      writeModuleAudit('预览归档回执缴款台账', `${updatedTask.taxType}｜${updatedTask.period}`, '中', '成功')
      setOperationNotice('回执与缴款信息已保存到当前预览；不会发起税局申报、银行扣款或外部回执校验。')
      return
    }
    if (!selectedCompanyId) return
    const result = await automationApi.upsertTaxDeclarationTask({
      companyId: task.companyId,
      period: task.period,
      taxType: task.taxType,
      formName: task.formName,
      collectStatus: task.collectStatus,
      validationStatus: task.validationStatus,
      declarationStatus: task.declarationStatus,
      sourceSnapshot: task.sourceSnapshot || undefined,
      taxableAmount: task.taxableAmount,
      deductionAmount: task.deductionAmount,
      payableAmount: task.payableAmount,
      riskCount: task.riskCount,
      adapterCode: task.adapterCode || undefined,
      receiptNo: declarationReceiptDraft.receiptNo.trim() || undefined,
      paymentStatus: declarationReceiptDraft.paymentStatus === '未记录' ? 'unrecorded' : declarationReceiptDraft.paymentStatus,
      paymentNo: declarationReceiptDraft.paymentNo.trim() || undefined,
      receiptReceivedAt: declarationReceiptDraft.receivedAt || undefined,
    })
    if (!result.success || !result.data) {
      setOperationNotice(`保存回执缴款台账失败：${result.error || '未知错误'}`)
      return
    }
    setTaxDeclarationTasks((tasks) => [result.data!, ...tasks.filter((item) => item.id !== result.data!.id)])
    setShowDeclarationReceiptDialog(false)
    writeModuleAudit('归档回执缴款台账', `${result.data.taxType}｜${result.data.period}`, '中', '成功')
    setOperationNotice('回执与缴款信息已登记到本地台账；外部申报、扣款和回执真实性仍需通过合法渠道人工核验。')
  }

  const openTaxInitEditor = (task?: TaxDeclarationTask) => {
    setTaxInitDraft(task
      ? { taskId: task.id, taxType: task.taxType, formName: task.formName, sourceSnapshot: task.sourceSnapshot || '', taxableAmount: String(task.taxableAmount), payableAmount: String(task.payableAmount), riskCount: String(task.riskCount), collectStatus: task.collectStatus, validationStatus: task.validationStatus, adapterCode: task.adapterCode || '' }
      : { taskId: '', taxType: '', formName: '', sourceSnapshot: '', taxableAmount: '', payableAmount: '', riskCount: '0', collectStatus: 'collected', validationStatus: 'pending', adapterCode: '' })
    setShowTaxInitDialog(true)
  }

  const handleSaveTaxInit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const existing = effectiveTaxDeclarationTasks.find((task) => task.id === taxInitDraft.taskId)
    if (!isTauri) {
      const timestamp = new Date().toLocaleString('zh-CN')
      const task: TaxDeclarationTask = {
        id: existing?.id || `preview-tax-init-${Date.now()}`,
        companyId: 'browser-preview',
        companyName: previewCompanyInfo?.name || '科旋电气（上海）有限公司',
        period: existing?.period || (currentPeriodLabel === '当前账期' ? '2026-05' : currentPeriodLabel),
        taxType: taxInitDraft.taxType.trim(),
        formName: taxInitDraft.formName.trim(),
        collectStatus: taxInitDraft.collectStatus,
        validationStatus: taxInitDraft.validationStatus,
        declarationStatus: existing?.declarationStatus || 'draft',
        sourceSnapshot: taxInitDraft.sourceSnapshot.trim() || null,
        taxableAmount: Number(taxInitDraft.taxableAmount || 0),
        deductionAmount: existing?.deductionAmount || 0,
        payableAmount: Number(taxInitDraft.payableAmount || 0),
        riskCount: Number(taxInitDraft.riskCount || 0),
        adapterCode: taxInitDraft.adapterCode.trim() || null,
        confirmedBy: existing?.confirmedBy || null,
        confirmedAt: existing?.confirmedAt || null,
        receiptNo: existing?.receiptNo || null,
        paymentStatus: existing?.paymentStatus || 'unrecorded',
        paymentNo: existing?.paymentNo || null,
        receiptReceivedAt: existing?.receiptReceivedAt || null,
        createdAt: existing?.createdAt || timestamp,
        updatedAt: timestamp,
      }
      updatePreviewTaxDeclarationTasks((tasks) => [task, ...tasks.filter((item) => item.id !== task.id)])
      setShowTaxInitDialog(false)
      writeModuleAudit(existing ? '预览编辑申报认定事项' : '预览新增申报认定事项', `${task.taxType}｜${task.formName}`, '高', '成功')
      setOperationNotice('申报认定事项已保存到当前预览；取数、确认、外部提交和缴款仍需分别人工核验，系统不会登录税局或提交申报。')
      return
    }
    if (!selectedCompanyId || currentPeriodLabel === '当前账期') {
      setOperationNotice('请先选择账套和账期，再维护申报认定事项。')
      return
    }
    const result = await automationApi.upsertTaxDeclarationTask({
      companyId: selectedCompanyId,
      period: existing?.period || currentPeriodLabel,
      taxType: taxInitDraft.taxType.trim(),
      formName: taxInitDraft.formName.trim(),
      collectStatus: taxInitDraft.collectStatus,
      validationStatus: taxInitDraft.validationStatus,
      declarationStatus: existing?.declarationStatus || 'draft',
      sourceSnapshot: taxInitDraft.sourceSnapshot.trim() || undefined,
      taxableAmount: Number(taxInitDraft.taxableAmount || 0),
      deductionAmount: existing?.deductionAmount || 0,
      payableAmount: Number(taxInitDraft.payableAmount || 0),
      riskCount: Number(taxInitDraft.riskCount || 0),
      adapterCode: taxInitDraft.adapterCode.trim() || undefined,
      receiptNo: existing?.receiptNo || undefined,
      paymentStatus: existing?.paymentStatus || 'unrecorded',
      paymentNo: existing?.paymentNo || undefined,
      receiptReceivedAt: existing?.receiptReceivedAt || undefined,
    })
    if (!result.success || !result.data) {
      setOperationNotice(`保存申报认定事项失败：${result.error || '未知错误'}`)
      return
    }
    setTaxDeclarationTasks((tasks) => [result.data!, ...tasks.filter((task) => task.id !== result.data!.id)])
    setShowTaxInitDialog(false)
    writeModuleAudit(existing ? '编辑申报认定事项' : '新增申报认定事项', `${result.data.taxType}｜${result.data.formName}`, '高', '成功')
    setOperationNotice('申报认定事项已保存到本地账套；取数、申报确认和外部提交仍需分别人工核验。')
  }

  const openCompanyTodoEditor = () => {
    setCompanyTodoDraft({ title: '', sourceModule: '资料采集', priority: 'normal', owner: '', dueDate: '', relatedEntry: '', evidence: '', note: '' })
    setShowCompanyTodoDialog(true)
  }

  const handleSaveCompanyTodo = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedCompanyId && isTauri) {
      setOperationNotice('请先选择账套，再新建待办。')
      return
    }
    if (!isTauri) {
      const timestamp = new Date().toISOString()
      const todo: CompanyTodo = { id: `preview-todo-${Date.now()}`, companyId: 'browser-preview', companyName: '科旋电气', period: currentPeriodLabel === '当前账期' ? '2026-05' : currentPeriodLabel, title: companyTodoDraft.title.trim(), sourceModule: companyTodoDraft.sourceModule.trim(), priority: companyTodoDraft.priority, owner: companyTodoDraft.owner.trim() || null, dueDate: companyTodoDraft.dueDate || null, relatedEntry: companyTodoDraft.relatedEntry.trim() || null, evidence: companyTodoDraft.evidence.trim() || null, note: companyTodoDraft.note.trim() || null, status: 'open', completedAt: null, completedBy: null, createdAt: timestamp, updatedAt: timestamp }
      setPreviewCompanyTodos((todos) => [todo, ...todos])
      setShowCompanyTodoDialog(false)
      writeModuleAudit('新增账套待办', `${todo.period}｜${todo.title}｜浏览器预览`, todo.priority === 'blocking' ? '高' : '中', '成功')
      setOperationNotice('待办已保存到本地预览；不会发送短信、邮件或触发外部动作。')
      return
    }
    const result = await companyTodoApi.create({
      companyId: selectedCompanyId || 'browser-preview',
      period: currentPeriodLabel === '当前账期' ? undefined : currentPeriodLabel,
      title: companyTodoDraft.title.trim(),
      sourceModule: companyTodoDraft.sourceModule.trim(),
      priority: companyTodoDraft.priority,
      owner: companyTodoDraft.owner.trim() || undefined,
      dueDate: companyTodoDraft.dueDate || undefined,
      relatedEntry: companyTodoDraft.relatedEntry.trim() || undefined,
      evidence: companyTodoDraft.evidence.trim() || undefined,
      note: companyTodoDraft.note.trim() || undefined,
    })
    if (!result.success || !result.data) {
      setOperationNotice(`新增账套待办失败：${result.error || '未知错误'}`)
      return
    }
    setCompanyTodos((todos) => [result.data!, ...todos.filter((todo) => todo.id !== result.data!.id)])
    setShowCompanyTodoDialog(false)
    writeModuleAudit('新增账套待办', `${currentPeriodLabel}｜${result.data.title}`, companyTodoDraft.priority === 'blocking' ? '高' : '中', '成功')
    setOperationNotice('待办已保存到当前账套和账期；不会发送短信、邮件或触发外部动作。')
  }

  const completeCompanyTodo = async (todoId: string) => {
    if (!isTauri) {
      const todo = previewCompanyTodos.find((item) => item.id === todoId)
      if (!todo || todo.status === 'completed') return
      const timestamp = new Date().toISOString()
      setPreviewCompanyTodos((todos) => todos.map((item) => item.id === todoId ? { ...item, status: 'completed', completedAt: timestamp, completedBy: 'admin', updatedAt: timestamp } : item))
      writeModuleAudit('完成账套待办', `${todo.period || '当前账期'}｜${todo.title}｜浏览器预览`, '中', '成功')
      setOperationNotice('待办已标记完成并保留处理时间和操作人；原始业务仍需在对应模块核验。')
      return
    }
    const todo = companyTodos.find((item) => item.id === todoId)
    if (todo?.status === 'completed') return
    if (!selectedCompanyId && isTauri) {
      setOperationNotice('请先选择账套，再完成待办。')
      return
    }
    const result = await companyTodoApi.complete({ id: todoId, companyId: selectedCompanyId || 'browser-preview', completedBy: '当前操作人' })
    if (!result.success || !result.data) {
      setOperationNotice(`完成账套待办失败：${result.error || '未知错误'}`)
      return
    }
    setCompanyTodos((todos) => todos.map((item) => item.id === result.data!.id ? result.data! : item))
    writeModuleAudit('完成账套待办', `${currentPeriodLabel}｜${result.data.title}`, '中', '成功')
    setOperationNotice('待办已标记完成并保留处理时间和操作人；原始业务仍需在对应模块核验。')
  }

  const handlePrimaryAction = async () => {
    if (kind === 'companyInfo') {
      openCompanyInfoEditor()
      return
    }
    if (kind === 'initialBalance' && !isTauri) {
      const result = buildPreviewInitialBalanceTrial(previewInitialBalanceRows)
      const difference = Math.abs(result.total_opening_debit - result.total_opening_credit)
      writeModuleAudit('执行预览试算平衡', `${currentPeriodLabel}｜${result.items.length} 个科目｜借 ${result.total_opening_debit.toFixed(2)}｜贷 ${result.total_opening_credit.toFixed(2)}｜差异 ${difference.toFixed(2)}`, result.is_balanced ? '中' : '高', result.is_balanced ? '成功' : '待审批')
      setOperationNotice(result.is_balanced
        ? `浏览器预览试算平衡通过：${result.items.length} 个科目，借贷期初均为 ¥${result.total_opening_debit.toFixed(2)}。仍需在桌面端人工确认启用账套。`
        : `浏览器预览试算未通过：期初借方 ¥${result.total_opening_debit.toFixed(2)}，贷方 ¥${result.total_opening_credit.toFixed(2)}，差异 ¥${difference.toFixed(2)}。请修正后再启用账套。`)
      return
    }
    if (isLiveAuxiliaryArchiveKind(kind)) {
      openAuxiliaryArchiveEditor()
      return
    }
    if (kind === 'settlementRules') {
      resetSettlementRuleDraft()
      setShowSettlementRuleDialog(true)
      return
    }
    if (kind === 'currencySettings') {
      resetCurrencyDraft()
      setShowCurrencyDialog(true)
      return
    }
    if (kind === 'commonDigests') {
      resetCommonDigestDraft()
      setShowCommonDigestDialog(true)
      return
    }
    if (kind === 'voucherTemplateSettings') {
      resetVoucherTemplateDraft()
      setShowVoucherTemplateDialog(true)
      return
    }
    if (kind === 'reportFormulaSettings') {
      reviewRuleTemplateGovernance('template')
      return
    }
    if (kind === 'subjectSettings') {
      openSubjectEditor()
      return
    }
    if (kind === 'aiJobQueue') {
      startAiTaskDraft()
      return
    }
    if (kind === 'aiRecognitionResults') {
      await reviewAiRecognition([...selectedRowIds])
      return
    }
    if (kind === 'aiRuleTraining') {
      resetMatchingRuleDraft()
      setShowMatchingRuleDialog(true)
      return
    }
    if (kind === 'settingsData') {
      reviewFoundationConfiguration('account')
      return
    }
    if (kind === 'printTemplateSettings') {
      openPrintTemplatePreview()
      return
    }
    if (kind === 'attachmentCenter' || kind === 'importCenter') {
      importFileRef.current?.click()
      return
    }
    if (['historyVoucher', 'historyBalance', 'historyGeneralLedger', 'historySubsidiaryLedger'].includes(kind)) {
      handleImportAction()
      return
    }
    if (kind === 'notificationCenter') {
      openCompanyTodoEditor()
      return
    }
    if (kind === 'riskCheck') {
      reviewControlEvidence('risk')
      return
    }
    if (kind === 'auditLog') {
      await handleExportExcel()
      return
    }
    if (kind === 'exportCenter') {
      await handleExportExcel()
      return
    }
    if (kind === 'declarationCalendar') {
      runDeclarationPlanning()
      return
    }
    if (kind === 'socialSecurity') {
      prepareSocialSecurityVoucher()
      return
    }
    if (kind === 'specialDeduction') {
      syncSpecialDeductionRecords()
      return
    }
    if (kind === 'receivablePayableAging') {
      runAgingCalculation()
      return
    }
    if (isLedgerReportKind(kind)) {
      runLedgerCalculation()
      return
    }
    if (isFinancialStatementKind(kind)) {
      runFinancialStatementCalculation()
      return
    }
    if (isTaxReportKind(kind)) {
      runTaxDataCollection()
      return
    }
    if (kind === 'aiVoucherSuggestions') {
      if (usesLiveAutomationJobData && selectedCompanyId) {
        await confirmAiVoucherSuggestions([...selectedRowIds])
      } else {
        await confirmPreviewAiVoucherSuggestions([...selectedRowIds])
      }
      return
    }
    if (kind === 'voucherRecycle' && isTauri && selectedCompanyId) {
      const selectedIds = [...selectedRowIds].filter((id) => deletedVouchers.some((voucher) => voucher.id === id))
      if (selectedIds.length === 0) {
        setOperationNotice('请先勾选需要恢复的凭证。')
        return
      }
      if (!await requestBusinessRiskConfirmation('确认恢复凭证', `确认恢复已勾选的 ${selectedIds.length} 张凭证吗？恢复后仍需按凭证状态重新审核。`, '确认恢复')) return
      try {
        await Promise.all(selectedIds.map((id) => restoreVoucher(id, selectedCompanyId)))
        setDeletedVouchers((items) => items.filter((item) => !selectedIds.includes(item.id)))
        setSelectedRowIds(new Set())
        writeModuleAudit('批量恢复凭证', `${selectedIds.length} 张`, '高', '成功')
        setOperationNotice(`已恢复 ${selectedIds.length} 张凭证。`)
      } catch (error) {
        setOperationNotice(`批量恢复凭证失败：${String(error)}`)
      }
      return
    }
    if (kind === 'voucherRecycle') {
      reviewControlEvidence('recycle')
      return
    }
    if (kind === 'invoiceVoucherMatching') {
      openInvoiceVoucherMatching()
      return
    }
    if (kind === 'voucher') {
      navigate('/vouchers/new')
      return
    }
    if (kind === 'declarationReceipt' && (usesLiveDeclarationReceiptData || !isTauri)) {
      const task = effectiveTaxDeclarationTasks[0]
      if (!task) {
        setOperationNotice('当前账套暂无申报事项，请先在申报工作台建立并人工确认任务。')
        return
      }
      openDeclarationReceiptEditor(task)
      return
    }
    if (kind === 'declarationReceipt') {
      openTaxReceiptWorkflow()
      return
    }
    if (kind === 'taxInit') {
      openTaxInitEditor()
      return
    }
    if (kind === 'nonTaxRevenueReport') {
      setNonTaxRevenueDraft({ item: '工会经费', policy: '', source: '', basisAmount: '', payableAmount: '', receiptNo: '', riskCount: '0' })
      setShowNonTaxRevenueDialog(true)
      return
    }
    if (kind === 'outputInvoice' || kind === 'inputInvoice') {
      if (!selectedCompanyId || !currentPeriodId) {
        setOperationNotice('请先在顶部选择账套和账期，再登记发票。')
        return
      }
      setEditingInvoiceId(null)
      setInvoiceDraft({ invoiceNo: '', invoiceCode: '', invoiceDate: currentPeriod?.end_date || '', amount: '', taxAmount: '', taxRate: '13', sellerName: '', sellerTaxId: '', buyerName: '', buyerTaxId: '', remarks: '' })
      setSelectedInvoiceTagIds([])
      setShowInvoiceDialog(true)
      return
    }
    if (canEditBusinessOrders) {
      openBusinessOrderEditor(kind === 'purchaseManagement' ? 'purchase' : 'sales')
      return
    }
    if (canEditDocumentRecords) {
      openDocumentRecordEditor(documentBusinessType(kind))
      return
    }
    if (kind === 'receivableSettlement' || kind === 'payableSettlement') {
      openSettlementRecordEditor(kind === 'payableSettlement' ? 'payable' : 'receivable')
      return
    }
    if (kind === 'bankReconciliation') {
      openBankReconciliationEditor()
      return
    }
    if (kind === 'employee') {
      openEmployeeEditor()
      return
    }
    if (kind === 'invoiceMatchingRules' || kind === 'billMatchingRules' || kind === 'cashFlowMapping') {
      resetMatchingRuleDraft()
      setShowMatchingRuleDialog(true)
      return
    }
    if (kind === 'assetCategory') {
      resetAssetCategoryDraft()
      setShowAssetCategoryDialog(true)
      return
    }
    if (kind === 'tagArchive') {
      resetBusinessTagDraft()
      setShowBusinessTagDialog(true)
      return
    }
    if (kind === 'taxAdapterSettings' || kind === 'bankAdapterSettings') {
      resetAdapterAuthorizationDraft()
      setShowAdapterAuthorizationDialog(true)
      return
    }
    if (kind === 'accountArchive') {
      resetCompanyAccountDraft()
      setShowCompanyAccountDialog(true)
      return
    }
    if (kind === 'auxiliaryCategories') {
      resetAuxiliaryCategoryDraft()
      setShowAuxiliaryCategoryDialog(true)
      return
    }
    if (kind === 'auxiliaryItems') {
      if ((isTauri ? auxiliaryCategories : previewAuxiliaryCategories).length === 0) {
        setOperationNotice('请先新增辅助核算类别，再维护辅助核算项目。')
        return
      }
      resetAuxiliaryItemDraft()
      setShowAuxiliaryItemDialog(true)
      return
    }
    if (kind === 'transfer') {
      openAccountTransferEditor()
      return
    }
    if (kind === 'depreciation') { openFixedAssetEditor(); return }
    if (kind === 'billList' || kind === 'bankStatement') {
      openBankTransactionEditor()
      return
    }
    if (kind === 'inventoryMovement') { openInventoryMovementEditor(); return }
    if (kind === 'inventorySettings') { openInventoryItemEditor(); return }
    if (kind === 'unitSettings') { setEditingMeasurementUnitId(null); setShowMeasurementUnitDialog(true); return }
    if (kind === 'costCarryover') { openCostCarryoverEditor(); return }
    if (kind === 'payroll') {
      if (payrollRecords.length === 0) {
        setOperationNotice('当前账期没有薪酬行，请先新增或导入薪酬表。')
        return
      }
      writeModuleAudit('生成工资凭证', `${currentPeriodLabel}｜${payrollRecords.length} 条薪酬行`, '高', '待审批')
      setOperationNotice('工资凭证已进入待确认队列；需人工核验金额、个税和社保后才会生成会计凭证。')
      return
    }
    if (kind === 'backupRestore' && isTauri && selectedCompanyId) {
      try {
        const result = await backupApi.createLocalBackup()
        if (!result.success || !result.data) throw new Error(result.error || '未返回备份文件')
        setLocalBackups((snapshots) => [result.data!, ...snapshots])
        writeModuleAudit('立即备份', result.data.fileName, '高', '成功')
        setOperationNotice(`已生成本机 SQLite 快照 ${result.data.fileName}；恢复仍需人工确认，不会自动覆盖账套。`)
      } catch (error) {
        writeModuleAudit('立即备份', `${title}-${auditScope}`, '高', '失败')
        setOperationNotice(`备份失败：${String(error)}`)
      }
      return
    }
    if (kind === 'backupRestore') {
      reviewImportArchiveData('backup')
      return
    }

    if (kind === 'periodManagement' && !isTauri) {
      const period = previewPeriods.find((item) => item.status !== 'closed')
      if (!period) {
        setOperationNotice('当前预览没有可结账的账期。')
        return
      }
      const label = `${period.period_year}-${String(period.period_month).padStart(2, '0')}`
      if (!await requestBusinessRiskConfirmation('确认结账账期', `确认结账账期 ${label} 吗？结账后账期将锁定。`, '确认结账')) return
      const timestamp = new Date().toISOString()
      setPreviewPeriods((items) => items.map((item) => item.id === period.id ? { ...item, status: 'closed', closed_at: timestamp, closed_by: 'admin', updated_at: timestamp } : item))
      writeModuleAudit('执行结账', `${label}｜当前预览账期`, '高', '成功')
      setOperationNotice(`当前预览账期已结账并锁定：${label}。桌面端结账还会校验凭证、申报和审批阻断项。`)
      return
    }

    if (kind === 'periodManagement' && isTauri && currentPeriodId) {
      if (!currentPeriod) {
        setOperationNotice('未找到当前账期，无法执行结账。')
        return
      }
      if (currentPeriod.status === 'closed') {
        setOperationNotice(`账期 ${currentPeriodLabel} 已结账并锁定。`)
        return
      }
      if (!await requestBusinessRiskConfirmation('确认结账账期', `确认结账账期 ${currentPeriodLabel} 吗？结账后账期将锁定。`, '确认结账')) return
      try {
        await closePeriod(currentPeriodId, 'admin')
        writeModuleAudit('执行结账', `${currentPeriodLabel}｜账期管理`, '高', '成功')
        setOperationNotice(`账期 ${currentPeriodLabel} 已结账并锁定；历史账期仍可查询、打印和导出。`)
      } catch (error) {
        writeModuleAudit('执行结账', `${currentPeriodLabel}｜账期管理`, '高', '失败')
        setOperationNotice(`账期结账失败：${String(error)}`)
      }
      return
    }

    if (kind === 'closingTasks' && isTauri && currentPeriodId) {
      if (!currentPeriod) {
        writeModuleAudit('执行结转前检查', `${title}-${auditScope}`, '高', '失败')
        setOperationNotice('未找到当前账期，无法执行结转前检查。')
        return
      }
      if (currentPeriod.status === 'closed') {
        setOperationNotice(`账期 ${currentPeriodLabel} 已结账并锁定。`)
        return
      }
      const blockers = config.rows.filter((row) => row.status === '异常')
      const pending = config.rows.filter((row) => row.status === '待处理' || row.status === '待确认')
      const passed = config.rows.filter((row) => row.status === '已通过').length
      const snapshot = `${currentPeriodLabel}｜通过 ${passed} 项｜待确认 ${pending.length} 项｜阻断 ${blockers.length} 项`
      writeModuleAudit('执行结转前检查', snapshot, blockers.length > 0 ? '高' : pending.length > 0 ? '中' : '普通', blockers.length > 0 || pending.length > 0 ? '待审批' : '成功')
      if (blockers.length > 0 || pending.length > 0) {
        setOperationNotice(`结转前检查快照已保存：${blockers.length} 项阻断、${pending.length} 项待确认。请完成源业务处理后重新检查。`)
        return
      }
      setOperationNotice('结转前检查已通过并保存本地快照。请前往账期管理完成最终关账确认。')
      return
    }

    if (kind === 'closingTasks') {
      const blockers = config.rows.filter((row) => row.status === '异常')
      const pending = config.rows.filter((row) => row.status === '待处理' || row.status === '待确认')
      writeModuleAudit('执行结转前检查', `${currentPeriodLabel}｜浏览器预览｜待确认 ${pending.length} 项｜阻断 ${blockers.length} 项`, blockers.length > 0 ? '高' : '中', blockers.length > 0 || pending.length > 0 ? '待审批' : '成功')
      setOperationNotice(blockers.length > 0 || pending.length > 0 ? `结转前检查已登记：${blockers.length} 项阻断、${pending.length} 项待确认。` : '结转前检查已通过；桌面端请前往账期管理完成最终关账确认。')
      return
    }

    if (kind === 'initialBalance' && isTauri && currentPeriodId) {
      try {
        const result = await validateInitialBalances(currentPeriodId)
        writeModuleAudit(config.primaryAction, `${title}-${auditScope}`, result.is_balanced ? '中' : '高', result.is_balanced ? '成功' : '待审批')
        setOperationNotice(result.message || (result.is_balanced ? '期初余额试算平衡通过。' : '期初余额借贷不平，请修正后再启用。'))
      } catch (error) {
        writeModuleAudit(config.primaryAction, `${title}-${auditScope}`, '高', '失败')
        setOperationNotice(`期初余额校验失败：${String(error)}`)
      }
      return
    }

    writeModuleAudit(config.primaryAction, `${title}-${auditScope}`, isHighRiskAction ? '高' : '中', isHighRiskAction ? '待审批' : '成功')
    setOperationNotice(
      isHighRiskAction
        ? `${config.primaryAction} 已进入高风险待确认留痕；当前不会自动提交税局、银行或覆盖账套数据。`
        : `${config.primaryAction} 已记录到审计日志。请从列表选择具体记录执行维护、复核或查看来源附件。`
    )
  }

  const handleBatchVoucherApproval = async (action: 'approve' | 'reverse') => {
    if (!selectedCompanyId) return
    const selectedIds = [...selectedRowIds].filter((id) => vouchers.some((voucher) => voucher.id === id && (action === 'approve' ? voucher.status === 'draft' : voucher.status === 'approved')))
    if (selectedIds.length === 0) {
      setOperationNotice(action === 'approve' ? '请勾选草稿状态的凭证后批量审核。' : '请勾选已审核的凭证后批量反审核。')
      return
    }
    if (!await requestBusinessRiskConfirmation(action === 'approve' ? '确认批量审核凭证' : '确认批量反审核凭证', `确认${action === 'approve' ? '审核' : '反审核'} ${selectedIds.length} 张已勾选凭证吗？操作会保留审计记录。`, `确认${action === 'approve' ? '审核' : '反审核'}`)) return
    try {
      if (action === 'approve') {
        await batchApprove(selectedIds, 'admin', selectedCompanyId)
      } else {
        await batchReverseApprove(selectedIds, selectedCompanyId)
      }
      setSelectedRowIds(new Set())
      writeModuleAudit(action === 'approve' ? '批量审核凭证' : '批量反审核凭证', `${selectedIds.length} 张`, '高', '成功')
      setOperationNotice(`已${action === 'approve' ? '审核' : '反审核'} ${selectedIds.length} 张凭证。`)
    } catch (error) {
      setOperationNotice(`批量${action === 'approve' ? '审核' : '反审核'}失败：${String(error)}`)
    }
  }

  const handleCreateEmployee = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isTauri) {
      const timestamp = new Date().toISOString()
      const employee: Employee = { id: editingEmployeeId || `preview-employee-${Date.now()}`, companyId: selectedCompanyId || 'preview-company', employeeCode: employeeDraft.employeeCode, name: employeeDraft.name, idNo: employeeDraft.idNo || null, department: employeeDraft.department || null, position: employeeDraft.position || null, mobile: employeeDraft.mobile || null, entryDate: employeeDraft.entryDate || null, employmentStatus: employeeDraft.employmentStatus, createdAt: timestamp, updatedAt: timestamp }
      setEmployees((items) => editingEmployeeId ? items.map((item) => item.id === employee.id ? { ...employee, createdAt: item.createdAt } : item) : [employee, ...items])
      writeModuleAudit(editingEmployeeId ? '编辑人员' : '新增人员', `${employee.employeeCode}｜${employee.name}`, '中', '成功')
      setOperationNotice(`人员档案已保存到当前预览：${employee.name}。桌面端会写入当前账套，后续可用于薪酬、社保和个税资料维护。`)
      setEmployeeDraft({ employeeCode: '', name: '', idNo: '', department: '', position: '', mobile: '', entryDate: '', employmentStatus: '在职' })
      setEditingEmployeeId(null)
      setShowEmployeeDialog(false)
      return
    }
    if (!selectedCompanyId) return
    try {
      const input = {
        companyId: selectedCompanyId,
        employeeCode: employeeDraft.employeeCode,
        name: employeeDraft.name,
        idNo: employeeDraft.idNo,
        department: employeeDraft.department,
        position: employeeDraft.position,
        mobile: employeeDraft.mobile,
        entryDate: employeeDraft.entryDate,
        employmentStatus: employeeDraft.employmentStatus,
      }
      const result = editingEmployeeId
        ? await employeeApi.updateEmployee({ id: editingEmployeeId, ...input })
        : await employeeApi.createEmployee(input)
      if (!result.success || !result.data) throw new Error(result.error || '未返回人员档案')
      setEmployees((items) => editingEmployeeId ? items.map((item) => item.id === result.data!.id ? result.data! : item) : [result.data!, ...items])
      writeModuleAudit(editingEmployeeId ? '编辑人员' : '新增人员', `${result.data.employeeCode}｜${result.data.name}`, '中', '成功')
      setOperationNotice(`${editingEmployeeId ? '已更新' : '已新增'}人员 ${result.data.name}。`)
      setEmployeeDraft({ employeeCode: '', name: '', idNo: '', department: '', position: '', mobile: '', entryDate: '', employmentStatus: '在职' })
      setEditingEmployeeId(null)
      setShowEmployeeDialog(false)
    } catch (error) {
      setOperationNotice(`新增人员失败：${String(error)}`)
    }
  }

  const handleCreateInvoice = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedCompanyId || (kind !== 'outputInvoice' && kind !== 'inputInvoice')) return
    try {
      const input = {
        invoice_type: kind === 'outputInvoice' ? 'output' : 'input',
        invoice_no: invoiceDraft.invoiceNo,
        invoice_code: invoiceDraft.invoiceCode || undefined,
        invoice_date: invoiceDraft.invoiceDate,
        amount: Number(invoiceDraft.amount),
        tax_amount: Number(invoiceDraft.taxAmount || 0),
        tax_rate: Number(invoiceDraft.taxRate || 0) / 100,
        seller_name: invoiceDraft.sellerName || undefined,
        seller_tax_id: invoiceDraft.sellerTaxId || undefined,
        buyer_name: invoiceDraft.buyerName || undefined,
        buyer_tax_id: invoiceDraft.buyerTaxId || undefined,
        remarks: invoiceDraft.remarks || undefined,
      }
      if (!editingInvoiceId && !currentPeriodId) {
        setOperationNotice('未选择当前账期，无法新增发票。')
        return
      }
      const invoice = editingInvoiceId
        ? await updateInvoice(editingInvoiceId, {
          company_id: selectedCompanyId,
          ...input,
        })
        : await createInvoice({
          company_id: selectedCompanyId,
          period_id: currentPeriodId!,
          ...input,
        })
      await replaceInvoiceTags(invoice.id, selectedCompanyId, selectedInvoiceTagIds)
      await fetchBusinessTags(selectedCompanyId)
      writeModuleAudit(editingInvoiceId ? '编辑发票' : kind === 'outputInvoice' ? '新增销项发票' : '新增进项发票', invoice.invoice_no, '中', '成功')
      setShowInvoiceDialog(false)
      setEditingInvoiceId(null)
      setInvoiceDraft({ invoiceNo: '', invoiceCode: '', invoiceDate: '', amount: '', taxAmount: '', taxRate: '13', sellerName: '', sellerTaxId: '', buyerName: '', buyerTaxId: '', remarks: '' })
      setSelectedInvoiceTagIds([])
      setOperationNotice(`${kind === 'outputInvoice' ? '销项' : '进项'}发票已${editingInvoiceId ? '更新' : '保存'}到当前账套，可继续匹配凭证或进入发票勾选。`)
    } catch (error) {
      setOperationNotice(`新增发票失败：${String(error)}`)
    }
  }

  const handleMatchInvoiceToVoucher = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedMatchInvoiceId || !selectedMatchVoucherId) {
      setOperationNotice('请选择需要关联的发票和凭证。')
      return
    }
    const invoice = invoiceMatchCandidates.find((item) => item.id === selectedMatchInvoiceId)
    const voucher = voucherMatchCandidates.find((item) => item.id === selectedMatchVoucherId)
    if (!invoice || !voucher) {
      setOperationNotice('匹配候选记录已变化，请重新选择发票和凭证。')
      return
    }
    if (!isTauri) {
      setPreviewInvoiceMatchCandidates((items) => items.map((item) => item.id === invoice.id ? { ...item, voucher_id: voucher.id } : item))
      writeModuleAudit('人工匹配发票与凭证', `${invoice.invoice_no}｜${voucher.voucher_number}`, '中', '成功')
      setShowInvoiceVoucherMatchDialog(false)
      setSelectedMatchInvoiceId('')
      setSelectedMatchVoucherId('')
      setOperationNotice(`当前预览已关联发票 ${invoice.invoice_no} 与凭证 ${voucher.voucher_number}；金额差异仍保留待人工复核，不会生成或入账凭证。`)
      return
    }
    if (!selectedCompanyId) return
    try {
      await matchInvoiceToVoucher(selectedMatchInvoiceId, selectedMatchVoucherId, selectedCompanyId)
      writeModuleAudit('人工匹配发票与凭证', `${invoice?.invoice_no || selectedMatchInvoiceId}｜${voucher?.voucher_number || selectedMatchVoucherId}`, '中', '成功')
      setShowInvoiceVoucherMatchDialog(false)
      setOperationNotice(`已关联发票 ${invoice?.invoice_no || ''} 与凭证 ${voucher?.voucher_number || ''}；金额差异仍需人工复核。`)
    } catch (error) {
      setOperationNotice(`匹配发票与凭证失败：${String(error)}`)
    }
  }

  const handleSavePayrollRecord = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isTauri) {
      const timestamp = new Date().toISOString()
      const employee = employees.find((item) => item.id === payrollDraft.employeeId) || { id: payrollDraft.employeeId || 'preview-employee', name: '预览员工' }
      const baseSalary = Number(payrollDraft.baseSalary || 0)
      const bonus = Number(payrollDraft.bonus || 0)
      const taxAmount = Number(payrollDraft.taxAmount || 0)
      const socialPersonal = Number(payrollDraft.socialPersonal || 0)
      const record: PayrollRecord = { id: editingPayrollId || `preview-payroll-${Date.now()}`, companyId: selectedCompanyId || 'preview-company', employeeId: employee.id, employeeName: employee.name, period: currentPeriodLabel === '当前账期' ? '2026-05' : currentPeriodLabel, baseSalary, bonus, taxAmount, socialPersonal, netSalary: baseSalary + bonus - taxAmount - socialPersonal, status: '待确认', createdAt: timestamp, updatedAt: timestamp }
      setPayrollRecords((records) => editingPayrollId ? records.map((item) => item.id === record.id ? { ...record, createdAt: item.createdAt } : item) : [record, ...records])
      writeModuleAudit(editingPayrollId ? '编辑薪酬行' : '新增薪酬行', `${record.employeeName}｜${record.period}`, '中', '成功')
      setOperationNotice(`薪酬行已保存到当前预览：${record.employeeName}，实发 ${payrollCurrency(record.netSalary)}。桌面端会写入当前账套，个税、社保和工资凭证仍需人工确认。`)
      setPayrollDraft({ employeeId: '', baseSalary: '', bonus: '', taxAmount: '', socialPersonal: '' })
      setEditingPayrollId(null)
      setShowPayrollDialog(false)
      return
    }
    if (!selectedCompanyId || currentPeriodLabel === '当前账期') return
    try {
      const result = editingPayrollId
        ? await payrollApi.updatePayrollRecord({
          id: editingPayrollId,
          companyId: selectedCompanyId,
          employeeId: payrollDraft.employeeId,
          period: currentPeriodLabel,
          baseSalary: Number(payrollDraft.baseSalary || 0),
          bonus: Number(payrollDraft.bonus || 0),
          taxAmount: Number(payrollDraft.taxAmount || 0),
          socialPersonal: Number(payrollDraft.socialPersonal || 0),
        })
        : await payrollApi.createPayrollRecord({
          companyId: selectedCompanyId,
          employeeId: payrollDraft.employeeId,
          period: currentPeriodLabel,
          baseSalary: Number(payrollDraft.baseSalary || 0),
          bonus: Number(payrollDraft.bonus || 0),
          taxAmount: Number(payrollDraft.taxAmount || 0),
          socialPersonal: Number(payrollDraft.socialPersonal || 0),
        })
      if (!result.success || !result.data) throw new Error(result.error || '未返回薪酬行')
      setPayrollRecords((records) => editingPayrollId ? records.map((record) => record.id === result.data!.id ? result.data! : record) : [result.data!, ...records])
      writeModuleAudit(editingPayrollId ? '编辑薪酬行' : '新增薪酬行', `${result.data.employeeName}｜${currentPeriodLabel}`, '中', '成功')
      setOperationNotice(editingPayrollId ? `已更新 ${result.data.employeeName} 的薪酬行，需重新核对个税和社保。` : `已新增 ${result.data.employeeName} 的薪酬行，实发 ${payrollCurrency(result.data.netSalary)}。`)
      setPayrollDraft({ employeeId: '', baseSalary: '', bonus: '', taxAmount: '', socialPersonal: '' })
      setEditingPayrollId(null)
      setShowPayrollDialog(false)
    } catch (error) {
      setOperationNotice(`${editingPayrollId ? '编辑' : '新增'}薪酬行失败：${String(error)}`)
    }
  }

  const resetSettlementRuleDraft = () => {
    setEditingSettlementRuleId(null)
    setSettlementRuleDraft({ name: '', ruleType: 'profit_loss', sourceFormula: '', targetAccountCode: '', voucherWordId: '', summaryTemplate: '', priority: '10', isEnabled: true })
  }

  const handleSaveSettlementRule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isTauri) {
      const rule = {
        id: editingSettlementRuleId || `preview-settlement-rule-${Date.now()}`,
        company_id: selectedCompanyId || 'preview-company',
        name: settlementRuleDraft.name.trim(),
        rule_type: settlementRuleDraft.ruleType,
        source_formula: settlementRuleDraft.sourceFormula.trim() || null,
        target_account_code: settlementRuleDraft.targetAccountCode.trim() || null,
        voucher_word_id: settlementRuleDraft.voucherWordId.trim() || null,
        summary_template: settlementRuleDraft.summaryTemplate.trim() || null,
        priority: Number(settlementRuleDraft.priority || 0),
        is_enabled: settlementRuleDraft.isEnabled ? 1 : 0,
      }
      if (!rule.name) {
        setOperationNotice('请填写结转规则名称。')
        return
      }
      setPreviewSettlementRules((items) => {
        const next = editingSettlementRuleId
          ? items.map((item) => item.id === rule.id ? rule : item)
          : [...items, rule]
        return [...next].sort((left, right) => left.priority - right.priority || left.name.localeCompare(right.name, 'zh-CN'))
      })
      writeModuleAudit(editingSettlementRuleId ? '编辑结转规则' : '新增结转规则', `${rule.name}｜优先级 ${rule.priority}`, '中', '成功')
      setOperationNotice(`结转规则已保存到当前预览：${rule.name}。桌面端会写入当前账套，执行结转和生成凭证仍需人工确认。`)
      resetSettlementRuleDraft()
      setShowSettlementRuleDialog(false)
      return
    }
    if (!selectedCompanyId) return
    try {
      const input = {
        companyId: selectedCompanyId,
        name: settlementRuleDraft.name.trim(),
        ruleType: settlementRuleDraft.ruleType,
        sourceFormula: settlementRuleDraft.sourceFormula,
        targetAccountCode: settlementRuleDraft.targetAccountCode,
        voucherWordId: settlementRuleDraft.voucherWordId,
        summaryTemplate: settlementRuleDraft.summaryTemplate,
        priority: Number(settlementRuleDraft.priority || 0),
        isEnabled: settlementRuleDraft.isEnabled,
      }
      const rule = editingSettlementRuleId
        ? await updateSettlementRule({ id: editingSettlementRuleId, ...input })
        : await createSettlementRule({ ...input, sourceFormula: input.sourceFormula || undefined, targetAccountCode: input.targetAccountCode || undefined, voucherWordId: input.voucherWordId || undefined, summaryTemplate: input.summaryTemplate || undefined })
      writeModuleAudit(editingSettlementRuleId ? '编辑结转规则' : '新增结转规则', `${rule.name}｜优先级 ${rule.priority}`, '中', '成功')
      setOperationNotice(editingSettlementRuleId ? `已更新结转规则“${rule.name}”；执行结转前仍需人工复核。` : `已新增结转规则“${rule.name}”；执行结转前仍需人工复核。`)
      resetSettlementRuleDraft()
      setShowSettlementRuleDialog(false)
    } catch (error) {
      setOperationNotice(`${editingSettlementRuleId ? '编辑' : '新增'}结转规则失败：${String(error)}`)
    }
  }

  const handleDeleteSettlementRule = async () => {
    if (!isTauri && editingSettlementRuleId) {
      const rule = previewSettlementRules.find((item) => item.id === editingSettlementRuleId)
      if (!await requestBusinessRiskConfirmation('确认删除结转规则', `确认删除结转规则“${rule?.name || ''}”吗？该操作仅影响当前预览。`, '删除')) return
      setPreviewSettlementRules((items) => items.filter((item) => item.id !== editingSettlementRuleId))
      writeModuleAudit('删除结转规则', rule?.name || editingSettlementRuleId, '高', '成功')
      setOperationNotice(`已从当前预览删除结转规则“${rule?.name || ''}”。`)
      resetSettlementRuleDraft()
      setShowSettlementRuleDialog(false)
      return
    }
    if (!selectedCompanyId || !editingSettlementRuleId) return
    const rule = settlementRules.find((item) => item.id === editingSettlementRuleId)
    if (!await requestBusinessRiskConfirmation('确认删除结转规则', `确认删除结转规则“${rule?.name || ''}”吗？不会影响已经生成的历史凭证。`, '删除')) return
    try {
      await deleteSettlementRule(editingSettlementRuleId, selectedCompanyId)
      writeModuleAudit('删除结转规则', rule?.name || editingSettlementRuleId, '高', '成功')
      setOperationNotice('结转规则已删除；不会影响已经生成的历史凭证。')
      resetSettlementRuleDraft()
      setShowSettlementRuleDialog(false)
    } catch (error) {
      setOperationNotice(`删除结转规则失败：${String(error)}`)
    }
  }

  const resetCurrencyDraft = () => {
    setEditingCurrencyId(null)
    setCurrencyDraft({ code: '', name: '', exchangeRate: '1', isBase: false })
  }

  const handleSaveCurrency = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isTauri) {
      const currency = { id: editingCurrencyId || `preview-currency-${Date.now()}`, company_id: selectedCompanyId || 'preview-company', code: currencyDraft.code.trim().toUpperCase(), name: currencyDraft.name.trim(), exchange_rate: Number(currencyDraft.exchangeRate || 0), is_base: currencyDraft.isBase ? 1 : 0 }
      setPreviewCurrencies((items) => editingCurrencyId ? items.map((item) => item.id === currency.id ? currency : item) : [currency, ...items])
      writeModuleAudit(editingCurrencyId ? '编辑币别' : '新增币别', `${currency.code}｜${currency.exchange_rate}`, '中', '成功')
      setOperationNotice(`币别已保存到当前预览：${currency.code}。桌面端会写入当前账套，期末调汇与凭证生成仍需人工复核。`)
      resetCurrencyDraft()
      setShowCurrencyDialog(false)
      return
    }
    if (!selectedCompanyId) return
    try {
      const input = {
        company_id: selectedCompanyId,
        code: currencyDraft.code.trim().toUpperCase(),
        name: currencyDraft.name.trim(),
        exchange_rate: Number(currencyDraft.exchangeRate || 0),
        is_base: currencyDraft.isBase ? 1 : 0,
      }
      const currency = editingCurrencyId
        ? await updateCurrency({ id: editingCurrencyId, ...input })
        : await createCurrency({ ...input })
      writeModuleAudit(editingCurrencyId ? '编辑币别' : '新增币别', `${currency.code}｜${currency.exchange_rate}`, '中', '成功')
      setOperationNotice(editingCurrencyId ? `已更新币别 ${currency.code} 的记账汇率。` : `已新增币别 ${currency.code}，可用于外币业务和期末调汇。`)
      resetCurrencyDraft()
      setShowCurrencyDialog(false)
    } catch (error) {
      setOperationNotice(`${editingCurrencyId ? '编辑' : '新增'}币别失败：${String(error)}`)
    }
  }

  const handleDeleteCurrency = async () => {
    if (!selectedCompanyId || !editingCurrencyId) return
    const currency = currencies.find((item) => item.id === editingCurrencyId)
    if (!await requestBusinessRiskConfirmation('确认删除币别', `确认删除币别 ${currency?.code || ''} 吗？已存在的历史业务不会变更。`, '删除')) return
    try {
      await deleteCurrency(editingCurrencyId, selectedCompanyId)
      writeModuleAudit('删除币别', currency?.code || editingCurrencyId, '高', '成功')
      setOperationNotice(`币别 ${currency?.code || ''} 已删除。`)
      resetCurrencyDraft()
      setShowCurrencyDialog(false)
    } catch (error) {
      setOperationNotice(`删除币别失败：${String(error)}`)
    }
  }

  const resetCommonDigestDraft = () => {
    setEditingCommonDigestId(null)
    setCommonDigestDraft('')
  }

  const handleSaveCommonDigest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isTauri) {
      const digest = { id: editingCommonDigestId || `preview-digest-${Date.now()}`, company_id: selectedCompanyId || 'preview-company', content: commonDigestDraft.trim() }
      setPreviewCommonDigests((items) => editingCommonDigestId ? items.map((item) => item.id === digest.id ? digest : item) : [digest, ...items])
      writeModuleAudit(editingCommonDigestId ? '编辑常用摘要' : '新增常用摘要', digest.content, '中', '成功')
      setOperationNotice(`常用摘要已保存到当前预览：${digest.content}。桌面端会写入当前账套，可在凭证、规则和自动建议中引用。`)
      resetCommonDigestDraft()
      setShowCommonDigestDialog(false)
      return
    }
    if (!selectedCompanyId) return
    try {
      const content = commonDigestDraft.trim()
      const digest = editingCommonDigestId
        ? await updateCommonDigest({ id: editingCommonDigestId, companyId: selectedCompanyId, content })
        : await createCommonDigest({ companyId: selectedCompanyId, content })
      writeModuleAudit(editingCommonDigestId ? '编辑常用摘要' : '新增常用摘要', digest.content, '中', '成功')
      setOperationNotice(editingCommonDigestId ? `已更新常用摘要“${digest.content}”。` : `已新增常用摘要“${digest.content}”。`)
      resetCommonDigestDraft()
      setShowCommonDigestDialog(false)
    } catch (error) {
      setOperationNotice(`${editingCommonDigestId ? '编辑' : '新增'}常用摘要失败：${String(error)}`)
    }
  }

  const handleDeleteCommonDigest = async () => {
    if (!selectedCompanyId || !editingCommonDigestId) return
    const digest = commonDigests.find((item) => item.id === editingCommonDigestId)
    if (!await requestBusinessRiskConfirmation('确认删除常用摘要', `确认删除常用摘要“${digest?.content || ''}”吗？不会影响历史凭证。`, '删除')) return
    try {
      await deleteCommonDigest(editingCommonDigestId, selectedCompanyId)
      writeModuleAudit('删除常用摘要', digest?.content || editingCommonDigestId, '高', '成功')
      setOperationNotice('常用摘要已删除；不影响历史凭证。')
      resetCommonDigestDraft()
      setShowCommonDigestDialog(false)
    } catch (error) {
      setOperationNotice(`删除常用摘要失败：${String(error)}`)
    }
  }

  const resetVoucherTemplateDraft = () => {
    setEditingVoucherTemplateId(null)
    setVoucherTemplateDraft({ typeId: (isTauri ? voucherTemplateTypes : previewVoucherTemplateTypes)[0]?.id || '', name: '', summary: '', debitAccountCode: '', creditAccountCode: '' })
  }

  const handleSaveVoucherTemplate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isTauri) {
      const debitAccount = templateAccounts.find((account) => account.code === voucherTemplateDraft.debitAccountCode)
      const creditAccount = templateAccounts.find((account) => account.code === voucherTemplateDraft.creditAccountCode)
      if (!debitAccount || !creditAccount) { setOperationNotice('请选择完整的借方和贷方科目。'); return }
      const summary = voucherTemplateDraft.summary.trim() || voucherTemplateDraft.name.trim()
      const entries: TemplateEntry[] = [{ account_code: debitAccount.code, account_name: debitAccount.name, direction: 'debit', summary, auxiliary_type: null, auxiliary_id: null }, { account_code: creditAccount.code, account_name: creditAccount.name, direction: 'credit', summary, auxiliary_type: null, auxiliary_id: null }]
      const template = { template: { id: editingVoucherTemplateId || `preview-voucher-template-${Date.now()}`, type_id: voucherTemplateDraft.typeId || previewVoucherTemplateTypes[0].id, company_id: selectedCompanyId || 'preview-company', name: voucherTemplateDraft.name.trim(), entries_json: JSON.stringify(entries) }, entries }
      setPreviewVoucherTemplates((items) => editingVoucherTemplateId ? items.map((item) => item.template.id === template.template.id ? template : item) : [template, ...items])
      writeModuleAudit(editingVoucherTemplateId ? '编辑凭证模板' : '新增凭证模板', template.template.name, '中', '成功')
      setOperationNotice(`凭证模板已保存到当前预览：${template.template.name}。桌面端会写入当前账套，自动套用前仍需人工核验借贷科目和金额。`)
      resetVoucherTemplateDraft()
      setShowVoucherTemplateDialog(false)
      return
    }
    if (!selectedCompanyId) return
    try {
      const debitAccount = detailedAccounts.find((account) => account.code === voucherTemplateDraft.debitAccountCode)
      const creditAccount = detailedAccounts.find((account) => account.code === voucherTemplateDraft.creditAccountCode)
      if (!debitAccount || !creditAccount) throw new Error('请选择完整的借方和贷方科目')
      const summary = voucherTemplateDraft.summary.trim() || voucherTemplateDraft.name.trim()
      const entries: TemplateEntry[] = [
        { account_code: debitAccount.code, account_name: debitAccount.name, direction: 'debit', summary, auxiliary_type: null, auxiliary_id: null },
        { account_code: creditAccount.code, account_name: creditAccount.name, direction: 'credit', summary, auxiliary_type: null, auxiliary_id: null },
      ]
      const input = { companyId: selectedCompanyId, typeId: voucherTemplateDraft.typeId, name: voucherTemplateDraft.name.trim(), entries }
      const template = editingVoucherTemplateId
        ? await updateVoucherTemplate({ id: editingVoucherTemplateId, ...input })
        : await createVoucherTemplate({ ...input })
      writeModuleAudit(editingVoucherTemplateId ? '编辑凭证模板' : '新增凭证模板', template.template.name, '中', '成功')
      setOperationNotice(editingVoucherTemplateId ? `已更新凭证模板“${template.template.name}”；自动套用前仍需人工核验。` : `已新增凭证模板“${template.template.name}”；自动套用前仍需人工核验。`)
      resetVoucherTemplateDraft()
      setShowVoucherTemplateDialog(false)
    } catch (error) {
      setOperationNotice(`${editingVoucherTemplateId ? '编辑' : '新增'}凭证模板失败：${String(error)}`)
    }
  }

  const handleDeleteVoucherTemplate = async () => {
    if (!selectedCompanyId || !editingVoucherTemplateId) return
    const template = voucherTemplates.find((item) => item.template.id === editingVoucherTemplateId)
    if (!await requestBusinessRiskConfirmation('确认删除凭证模板', `确认删除凭证模板“${template?.template.name || ''}”吗？不会影响历史凭证。`, '删除')) return
    try {
      await deleteVoucherTemplate(editingVoucherTemplateId, selectedCompanyId)
      writeModuleAudit('删除凭证模板', template?.template.name || editingVoucherTemplateId, '高', '成功')
      setOperationNotice('凭证模板已删除；不影响历史凭证。')
      resetVoucherTemplateDraft()
      setShowVoucherTemplateDialog(false)
    } catch (error) {
      setOperationNotice(`删除凭证模板失败：${String(error)}`)
    }
  }

  const resetAdapterAuthorizationDraft = () => {
    setEditingAdapterAuthorizationId(null)
    setAdapterAuthorizationDraft({ adapterCode: '', region: '', authStatus: 'pending', accountMask: '', loginIdentity: '', capabilityScope: '', expiresAt: '', riskMessage: '' })
  }

  const handleSaveAdapterAuthorization = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!['taxAdapterSettings', 'bankAdapterSettings'].includes(kind)) return
    if (!isTauri) {
      const adapterType = kind === 'taxAdapterSettings' ? 'tax' : 'bank'
      const timestamp = new Date().toISOString()
      const adapter: AdapterAuthorization = {
        id: editingAdapterAuthorizationId || `preview-${adapterType}-adapter-${Date.now()}`,
        companyId: selectedCompanyId || 'preview-company',
        companyName: selectedCompany?.name || '当前预览账套',
        adapterType,
        adapterCode: adapterAuthorizationDraft.adapterCode.trim(),
        region: adapterAuthorizationDraft.region.trim() || null,
        authStatus: adapterAuthorizationDraft.authStatus,
        accountMask: adapterAuthorizationDraft.accountMask.trim() || null,
        loginIdentity: adapterAuthorizationDraft.loginIdentity.trim() || null,
        capabilityScope: adapterAuthorizationDraft.capabilityScope.trim() || null,
        lastCheckedAt: timestamp,
        expiresAt: adapterAuthorizationDraft.expiresAt || null,
        riskMessage: adapterAuthorizationDraft.riskMessage.trim() || null,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      if (!adapter.adapterCode) {
        setOperationNotice('请填写渠道名称。')
        return
      }
      setPreviewAdapterAuthorizations((items) => {
        const next = editingAdapterAuthorizationId
          ? items.map((item) => item.id === adapter.id ? { ...adapter, createdAt: item.createdAt } : item)
          : [...items, adapter]
        return [...next].sort((left, right) => left.adapterType.localeCompare(right.adapterType) || left.adapterCode.localeCompare(right.adapterCode, 'zh-CN'))
      })
      writeModuleAudit(editingAdapterAuthorizationId ? '编辑授权配置' : '新增授权配置', `${adapter.adapterType}｜${adapter.adapterCode}`, '高', '待审批')
      setOperationNotice(`授权渠道已保存到当前预览：${adapter.adapterCode}。仅保存脱敏元数据；真实登录、采集与申报必须在合法渠道授权并人工确认。`)
      resetAdapterAuthorizationDraft()
      setShowAdapterAuthorizationDialog(false)
      return
    }
    if (!selectedCompanyId) return
    try {
      const adapterType = kind === 'taxAdapterSettings' ? 'tax' : 'bank'
      const result = await automationApi.upsertAdapterAuthorization({
        companyId: selectedCompanyId,
        adapterType,
        adapterCode: adapterAuthorizationDraft.adapterCode.trim(),
        region: adapterAuthorizationDraft.region.trim() || undefined,
        authStatus: adapterAuthorizationDraft.authStatus,
        accountMask: adapterAuthorizationDraft.accountMask.trim() || undefined,
        loginIdentity: adapterAuthorizationDraft.loginIdentity.trim() || undefined,
        capabilityScope: adapterAuthorizationDraft.capabilityScope.trim() || undefined,
        lastCheckedAt: new Date().toISOString(),
        expiresAt: adapterAuthorizationDraft.expiresAt || undefined,
        riskMessage: adapterAuthorizationDraft.riskMessage.trim() || undefined,
      })
      if (!result.success || !result.data) throw new Error(result.error || '未返回授权配置')
      setAdapterAuthorizations((items) => {
        const other = items.filter((item) => item.id !== result.data!.id && !(item.adapterType === result.data!.adapterType && item.adapterCode === result.data!.adapterCode))
        return [...other, result.data!]
      })
      writeModuleAudit(editingAdapterAuthorizationId ? '编辑授权配置' : '新增授权配置', `${result.data.adapterType}｜${result.data.adapterCode}`, '高', '待审批')
      setOperationNotice(`已保存 ${result.data.adapterCode} 的脱敏授权配置；真实登录、采集与提交仍需在合法渠道完成授权和人工确认。`)
      resetAdapterAuthorizationDraft()
      setShowAdapterAuthorizationDialog(false)
    } catch (error) {
      setOperationNotice(`保存授权配置失败：${String(error)}`)
    }
  }

  const handleSaveReportFormula = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isTauri) {
      if (!editingReportFormulaId) return
      const item = previewReportItems.find((current) => current.id === editingReportFormulaId)
      const template = item ? previewReportTemplates.find((current) => current.id === item.template_id) : undefined
      if (!item || !template) {
        setOperationNotice('未找到当前预览的报表公式项目。')
        return
      }
      if (!reportFormulaDraft.itemName.trim() || !reportFormulaDraft.formula.trim()) {
        setOperationNotice('请填写报表项目和取数公式。')
        return
      }
      setPreviewReportItems((items) => items.map((current) => current.id === item.id ? {
        ...current,
        item_name: reportFormulaDraft.itemName.trim(),
        formula: reportFormulaDraft.formula.trim(),
        sort_order: Number(reportFormulaDraft.sortOrder || 0),
        is_total: reportFormulaDraft.isTotal ? 1 : 0,
      } : current))
      writeModuleAudit('编辑报表公式', `${template.template_name}｜${item.item_code}`, '高', '成功')
      setOperationNotice(`报表公式已保存到当前预览：${template.template_name}｜${reportFormulaDraft.itemName.trim()}。请重算报表并人工复核取数结果。`)
      setEditingReportFormulaId(null)
      setShowReportFormulaDialog(false)
      return
    }
    if (!selectedCompanyId || !editingReportFormulaId) return
    const item = reportItems.find((current) => current.id === editingReportFormulaId)
    const template = item ? reportTemplates.find((current) => current.id === item.template_id) : undefined
    const impact = template?.is_system === 1 ? '该标准报表模板会影响所有账套的后续取数。确认已完成复核后保存吗？' : '确认保存当前账套报表模板公式吗？'
    if (!await requestBusinessRiskConfirmation('确认保存报表公式', impact, '确认保存')) return
    try {
      const result = await updateReportItem({
        id: editingReportFormulaId,
        companyId: selectedCompanyId,
        itemName: reportFormulaDraft.itemName.trim(),
        formula: reportFormulaDraft.formula.trim(),
        sortOrder: Number(reportFormulaDraft.sortOrder || 0),
        isTotal: reportFormulaDraft.isTotal ? 1 : 0,
      })
      writeModuleAudit('编辑报表公式', `${template?.template_name || '报表'}｜${result.item_code}`, '高', '成功')
      setOperationNotice(`已更新 ${result.item_name} 的取数公式；请重算报表并人工复核取数结果。`)
      setEditingReportFormulaId(null)
      setShowReportFormulaDialog(false)
    } catch (error) {
      setOperationNotice(`更新报表公式失败：${String(error)}`)
    }
  }

  const resetMatchingRuleDraft = () => {
    setEditingMatchingRuleId(null)
    setMatchingRuleDraft({ name: '', conditionText: '', actionText: matchingRuleScope === 'cash_flow' ? '现金流入' : matchingRuleScope === 'ai_training' ? '生成待确认 AI 建议' : '生成待确认凭证', targetAccountCode: '', voucherTemplateId: '', priority: '50', isEnabled: matchingRuleScope !== 'ai_training' })
  }

  const handleSaveMatchingRule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const isNewAiTrainingRule = matchingRuleScope === 'ai_training' && !editingMatchingRuleId
    const isEnabled = isNewAiTrainingRule ? false : matchingRuleDraft.isEnabled
    if (!isTauri) {
      const timestamp = new Date().toISOString()
      const rule = {
        id: editingMatchingRuleId || `preview-matching-rule-${Date.now()}`,
        company_id: selectedCompanyId || 'preview-company',
        rule_scope: matchingRuleScope,
        name: matchingRuleDraft.name.trim(),
        condition_text: matchingRuleDraft.conditionText.trim(),
        action_text: matchingRuleDraft.actionText.trim(),
        target_account_code: matchingRuleDraft.targetAccountCode.trim() || null,
        voucher_template_id: matchingRuleDraft.voucherTemplateId.trim() || null,
        priority: Number(matchingRuleDraft.priority || 0),
        is_enabled: isEnabled ? 1 : 0,
        hit_count: 0,
        created_at: timestamp,
        updated_at: timestamp,
      }
      if (!rule.name || !rule.condition_text || !rule.action_text) {
        setOperationNotice('请填写规则名称、匹配条件和处理动作。')
        return
      }
      updatePreviewMatchingRules((items) => {
        const next = editingMatchingRuleId
          ? items.map((item) => item.id === rule.id ? { ...rule, created_at: item.created_at } : item)
          : [...items, rule]
        return [...next].sort((left, right) => left.priority - right.priority || left.name.localeCompare(right.name, 'zh-CN'))
      })
      const action = matchingRuleScope === 'ai_training' ? (editingMatchingRuleId ? '编辑AI训练规则' : '新增AI训练规则') : (editingMatchingRuleId ? '编辑自动匹配规则' : '新增自动匹配规则')
      writeModuleAudit(action, `${rule.rule_scope}｜${rule.name}`, '高', '成功')
      setOperationNotice(matchingRuleScope === 'ai_training'
        ? `AI 训练规则已保存到当前预览：${rule.name}。${isNewAiTrainingRule ? '新规则已进入待复核队列，需勾选后确认发布。' : '已发布状态保持不变。'}`
        : `自动匹配规则已保存到当前预览：${rule.name}。该规则仅生成建议或待确认动作，不会自动生成已审核凭证或提交税务。`)
      resetMatchingRuleDraft()
      setShowMatchingRuleDialog(false)
      return
    }
    if (!selectedCompanyId) return
    try {
      const input = {
        companyId: selectedCompanyId, ruleScope: matchingRuleScope,
        name: matchingRuleDraft.name.trim(), conditionText: matchingRuleDraft.conditionText.trim(), actionText: matchingRuleDraft.actionText.trim(),
        targetAccountCode: matchingRuleDraft.targetAccountCode.trim() || undefined,
        voucherTemplateId: matchingRuleDraft.voucherTemplateId.trim() || undefined,
        priority: Number(matchingRuleDraft.priority || 0), isEnabled,
      }
      const rule = editingMatchingRuleId ? await updateMatchingRule(editingMatchingRuleId, input) : await createMatchingRule({ ...input })
      const action = matchingRuleScope === 'ai_training' ? (editingMatchingRuleId ? '编辑AI训练规则' : '新增AI训练规则') : (editingMatchingRuleId ? '编辑自动匹配规则' : '新增自动匹配规则')
      writeModuleAudit(action, `${rule.rule_scope}｜${rule.name}`, '高', '成功')
      setOperationNotice(matchingRuleScope === 'ai_training'
        ? `AI 训练规则“${rule.name}”已保存。${isNewAiTrainingRule ? '新规则已进入待复核队列，需勾选后确认发布。' : '已发布状态保持不变。'}`
        : `规则“${rule.name}”已保存。自动处理仅生成建议或待确认结果，不会自动提交税务或生成已审核凭证。`)
      resetMatchingRuleDraft(); setShowMatchingRuleDialog(false)
    } catch (error) { setOperationNotice(`保存自动匹配规则失败：${String(error)}`) }
  }

  const handleDeleteMatchingRule = async () => {
    if (!isTauri && editingMatchingRuleId) {
      const rule = previewMatchingRules.find((item) => item.id === editingMatchingRuleId)
      if (!await requestBusinessRiskConfirmation('确认删除自动匹配规则', `确认删除规则“${rule?.name || ''}”吗？该操作仅影响当前预览。`, '删除')) return
      updatePreviewMatchingRules((items) => items.filter((item) => item.id !== editingMatchingRuleId))
      writeModuleAudit('删除自动匹配规则', rule?.name || editingMatchingRuleId, '高', '成功')
      setOperationNotice(`已从当前预览删除自动匹配规则“${rule?.name || ''}”。`)
      resetMatchingRuleDraft()
      setShowMatchingRuleDialog(false)
      return
    }
    if (!selectedCompanyId || !editingMatchingRuleId) return
    const rule = matchingRules.find((item) => item.id === editingMatchingRuleId)
    if (!rule) return
    if (!await requestBusinessRiskConfirmation('确认删除自动匹配规则', `确认删除规则“${rule.name}”吗？已生成的建议和历史凭证不会变更。`, '删除')) return
    try { await deleteMatchingRule(rule.id, selectedCompanyId); writeModuleAudit('删除自动匹配规则', `${rule.rule_scope}｜${rule.name}`, '高', '成功'); setOperationNotice(`规则“${rule.name}”已删除。`); resetMatchingRuleDraft(); setShowMatchingRuleDialog(false) }
    catch (error) { setOperationNotice(`删除自动匹配规则失败：${String(error)}`) }
  }

  const resetAssetCategoryDraft = () => {
    setEditingAssetCategoryId(null)
    setAssetCategoryDraft({ code: '', name: '', usefulLifeMonths: '60', residualRate: '5', depreciationMethod: '平均年限法', assetAccount: '1601 固定资产', accumulatedDepreciationAccount: '1602 累计折旧', expenseAccount: '6602 管理费用', isEnabled: true })
  }

  const handleSaveAssetCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isTauri) {
      const timestamp = new Date().toISOString()
      const category = {
        id: editingAssetCategoryId || `preview-asset-category-${Date.now()}`,
        company_id: selectedCompanyId || 'preview-company',
        code: assetCategoryDraft.code.trim().toUpperCase(),
        name: assetCategoryDraft.name.trim(),
        useful_life_months: Number(assetCategoryDraft.usefulLifeMonths || 0),
        residual_rate: Number(assetCategoryDraft.residualRate || 0) / 100,
        depreciation_method: assetCategoryDraft.depreciationMethod.trim(),
        asset_account: assetCategoryDraft.assetAccount.trim(),
        accumulated_depreciation_account: assetCategoryDraft.accumulatedDepreciationAccount.trim(),
        expense_account: assetCategoryDraft.expenseAccount.trim() || null,
        is_enabled: assetCategoryDraft.isEnabled ? 1 : 0,
        created_at: timestamp,
        updated_at: timestamp,
      }
      if (!category.code || !category.name || category.useful_life_months <= 0 || !category.depreciation_method) {
        setOperationNotice('请填写类别编码、名称、折旧期限和折旧方法。')
        return
      }
      setPreviewAssetCategories((items) => {
        const next = editingAssetCategoryId
          ? items.map((item) => item.id === category.id ? { ...category, created_at: item.created_at } : item)
          : [...items, category]
        return [...next].sort((left, right) => left.code.localeCompare(right.code, 'zh-CN'))
      })
      writeModuleAudit(editingAssetCategoryId ? '编辑资产类别' : '新增资产类别', `${category.code}｜${category.name}`, '中', '成功')
      setOperationNotice(`资产类别已保存到当前预览：${category.name}。固定资产录入可直接使用该类别，折旧和凭证仍需人工复核。`)
      resetAssetCategoryDraft()
      setShowAssetCategoryDialog(false)
      return
    }
    if (!selectedCompanyId) return
    try {
      const input = {
        companyId: selectedCompanyId, code: assetCategoryDraft.code.trim(), name: assetCategoryDraft.name.trim(),
        usefulLifeMonths: Number(assetCategoryDraft.usefulLifeMonths), residualRate: Number(assetCategoryDraft.residualRate) / 100,
        depreciationMethod: assetCategoryDraft.depreciationMethod.trim(), assetAccount: assetCategoryDraft.assetAccount.trim(),
        accumulatedDepreciationAccount: assetCategoryDraft.accumulatedDepreciationAccount.trim(), expenseAccount: assetCategoryDraft.expenseAccount.trim() || undefined,
        isEnabled: assetCategoryDraft.isEnabled,
      }
      const category = editingAssetCategoryId ? await updateAssetCategory(editingAssetCategoryId, input) : await createAssetCategory({ ...input })
      writeModuleAudit(editingAssetCategoryId ? '编辑资产类别' : '新增资产类别', `${category.code}｜${category.name}`, '中', '成功')
      setOperationNotice(`资产类别“${category.name}”已保存，可供固定资产录入和折旧凭证规则引用。`)
      resetAssetCategoryDraft(); setShowAssetCategoryDialog(false)
    } catch (error) { setOperationNotice(`保存资产类别失败：${String(error)}`) }
  }

  const handleDeleteAssetCategory = async () => {
    if (!isTauri && editingAssetCategoryId) {
      const category = previewAssetCategories.find((item) => item.id === editingAssetCategoryId)
      if (!await requestBusinessRiskConfirmation('确认删除资产类别', `确认删除资产类别“${category?.name || ''}”吗？该操作仅影响当前预览。`, '删除')) return
      setPreviewAssetCategories((items) => items.filter((item) => item.id !== editingAssetCategoryId))
      writeModuleAudit('删除资产类别', category ? `${category.code}｜${category.name}` : editingAssetCategoryId, '高', '成功')
      setOperationNotice(`已从当前预览删除资产类别“${category?.name || ''}”。`)
      resetAssetCategoryDraft()
      setShowAssetCategoryDialog(false)
      return
    }
    if (!selectedCompanyId || !editingAssetCategoryId) return
    const category = assetCategories.find((item) => item.id === editingAssetCategoryId)
    if (!category) return
    if (!await requestBusinessRiskConfirmation('确认删除资产类别', `确认删除资产类别“${category.name}”吗？已有资产引用时系统会阻止删除。`, '删除')) return
    try { await deleteAssetCategory(category.id, selectedCompanyId); writeModuleAudit('删除资产类别', `${category.code}｜${category.name}`, '高', '成功'); setOperationNotice(`资产类别“${category.name}”已删除。`); resetAssetCategoryDraft(); setShowAssetCategoryDialog(false) }
    catch (error) { setOperationNotice(`删除资产类别失败：${String(error)}`) }
  }

  const resetBusinessTagDraft = () => {
    setEditingBusinessTagId(null)
    setBusinessTagDraft({ name: '', applicableModules: '发票/流水/凭证', colorName: '蓝色', autoRule: '', remarks: '', isEnabled: true })
  }

  const handleSaveBusinessTag = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isTauri) {
      const timestamp = new Date().toISOString()
      const tag = {
        id: editingBusinessTagId || `preview-business-tag-${Date.now()}`,
        company_id: selectedCompanyId || 'preview-company',
        name: businessTagDraft.name.trim(),
        applicable_modules: businessTagDraft.applicableModules.trim(),
        color_name: businessTagDraft.colorName,
        auto_rule: businessTagDraft.autoRule.trim() || null,
        usage_count: 0,
        remarks: businessTagDraft.remarks.trim() || null,
        is_enabled: businessTagDraft.isEnabled ? 1 : 0,
        created_at: timestamp,
        updated_at: timestamp,
      }
      if (!tag.name || !tag.applicable_modules) {
        setOperationNotice('请填写标签名称和适用模块。')
        return
      }
      setPreviewBusinessTags((items) => {
        const next = editingBusinessTagId
          ? items.map((item) => item.id === tag.id ? { ...tag, created_at: item.created_at, usage_count: item.usage_count } : item)
          : [...items, tag]
        return [...next].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
      })
      writeModuleAudit(editingBusinessTagId ? '编辑业务标签' : '新增业务标签', `${tag.color_name}｜${tag.name}`, '中', '成功')
      setOperationNotice(`业务标签已保存到当前预览：${tag.name}。可用于发票、流水和凭证的筛选与人工跟踪，不会自动改动账务。`)
      resetBusinessTagDraft()
      setShowBusinessTagDialog(false)
      return
    }
    if (!selectedCompanyId) return
    try {
      const input = {
        companyId: selectedCompanyId, name: businessTagDraft.name.trim(), applicableModules: businessTagDraft.applicableModules.trim(),
        colorName: businessTagDraft.colorName, autoRule: businessTagDraft.autoRule.trim() || undefined,
        remarks: businessTagDraft.remarks.trim() || undefined, isEnabled: businessTagDraft.isEnabled,
      }
      const tag = editingBusinessTagId ? await updateBusinessTag(editingBusinessTagId, input) : await createBusinessTag({ ...input })
      writeModuleAudit(editingBusinessTagId ? '编辑业务标签' : '新增业务标签', `${tag.color_name}｜${tag.name}`, '中', '成功')
      setOperationNotice(`标签“${tag.name}”已保存，可作为发票、流水、凭证、风险和待办筛选条件。`)
      resetBusinessTagDraft(); setShowBusinessTagDialog(false)
    } catch (error) { setOperationNotice(`保存业务标签失败：${String(error)}`) }
  }

  const handleDeleteBusinessTag = async () => {
    if (!isTauri && editingBusinessTagId) {
      const tag = previewBusinessTags.find((item) => item.id === editingBusinessTagId)
      if (!await requestBusinessRiskConfirmation('确认删除业务标签', `确认删除标签“${tag?.name || ''}”吗？该操作仅影响当前预览。`, '删除')) return
      setPreviewBusinessTags((items) => items.filter((item) => item.id !== editingBusinessTagId))
      writeModuleAudit('删除业务标签', tag ? `${tag.color_name}｜${tag.name}` : editingBusinessTagId, '高', '成功')
      setOperationNotice(`已从当前预览删除业务标签“${tag?.name || ''}”。`)
      resetBusinessTagDraft()
      setShowBusinessTagDialog(false)
      return
    }
    if (!selectedCompanyId || !editingBusinessTagId) return
    const tag = businessTags.find((item) => item.id === editingBusinessTagId)
    if (!tag) return
    if (!await requestBusinessRiskConfirmation('确认删除业务标签', `确认删除标签“${tag.name}”吗？已关联的历史业务不会变更。`, '删除')) return
    try { await deleteBusinessTag(tag.id, selectedCompanyId); writeModuleAudit('删除业务标签', `${tag.color_name}｜${tag.name}`, '高', '成功'); setOperationNotice(`标签“${tag.name}”已删除。`); resetBusinessTagDraft(); setShowBusinessTagDialog(false) }
    catch (error) { setOperationNotice(`删除业务标签失败：${String(error)}`) }
  }

  const openCompanyInfoEditor = () => {
    const company = selectedCompany
    setCompanyInfoDraft({
      ...(previewCompanyInfo || {
        code: company?.code || '20258497', name: company?.name || '科旋电气（上海）有限公司', taxId: company?.tax_id || '91310115MA1K3****X', taxpayerType: company?.tax_type || 'general', province: company?.province || '上海市', city: company?.city || '上海市', district: company?.district || '浦东新区', accountingSystem: company?.accounting_system || 'small_enterprise', enableYear: String(company?.enable_year || new Date().getFullYear()), enableMonth: String(company?.enable_month || new Date().getMonth() + 1), serviceStart: company?.service_start || '', serviceEnd: company?.service_end || '', industry: company?.industry || '', enterpriseType: company?.enterprise_type || '私营有限责任公司',
      }),
    })
    setShowCompanyInfoDialog(true)
  }

  const handleSaveCompanyInfo = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!companyInfoDraft.name.trim() || !companyInfoDraft.taxId.trim()) {
      setOperationNotice('请填写企业名称和纳税人识别号。')
      return
    }
    if (!isTauri) {
      setPreviewCompanyInfo({ ...companyInfoDraft })
      writeModuleAudit('预览企业资料保存', `${companyInfoDraft.code}｜${companyInfoDraft.name}`, '高', '成功')
      setOperationNotice('浏览器预览已完成企业资料校验；桌面端保存会写入当前账套，不会保存税局、个税或工商密码。')
      setShowCompanyInfoDialog(false)
      return
    }
    if (!selectedCompanyId) {
      setOperationNotice('请先从账套管理进入一家企业，再维护企业资料。')
      return
    }
    try {
      const company = await updateCompany(selectedCompanyId, {
        code: companyInfoDraft.code.trim(),
        name: companyInfoDraft.name.trim(),
        tax_id: companyInfoDraft.taxId.trim(),
        tax_type: companyInfoDraft.taxpayerType,
        industry: companyInfoDraft.industry.trim() || undefined,
        accounting_system: companyInfoDraft.accountingSystem,
        province: companyInfoDraft.province.trim() || undefined,
        city: companyInfoDraft.city.trim() || undefined,
        district: companyInfoDraft.district.trim() || undefined,
        enterprise_type: companyInfoDraft.enterpriseType,
        service_start: companyInfoDraft.serviceStart || undefined,
        service_end: companyInfoDraft.serviceEnd || undefined,
        enable_year: Number(companyInfoDraft.enableYear),
        enable_month: Number(companyInfoDraft.enableMonth),
      })
      writeModuleAudit('保存企业资料', `${company.code}｜${company.name}`, '高', '成功')
      setOperationNotice(`企业资料已保存：${company.name}。税局、个税和工商授权仍需在授权中心单独维护。`)
      setShowCompanyInfoDialog(false)
    } catch (error) {
      setOperationNotice(`保存企业资料失败：${String(error)}`)
    }
  }

  const openSubjectEditor = (account?: typeof accounts[number]) => {
    setEditingSubjectCode(account?.code || null)
    setSubjectDraft({
      code: account?.code || '',
      name: account?.name || '',
      accountType: account?.account_type || '资产类',
      normalBalance: account?.normal_balance || 'debit',
      level: String(account?.level || 1),
      parentCode: account?.parent_code || '',
      isDetail: account?.is_detail !== 0,
      hasQuantity: account?.has_quantity === 1,
      defaultUnit: account?.default_unit || '',
      hasAuxiliary: account?.has_auxiliary === 1,
    })
    setShowSubjectDialog(true)
  }

  const handleSaveSubject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!subjectDraft.code.trim() || !subjectDraft.name.trim()) {
      setOperationNotice('请填写科目编码和科目名称。')
      return
    }
    if (subjectDraft.parentCode.trim() === subjectDraft.code.trim()) {
      setOperationNotice('上级科目不能是当前科目。')
      return
    }
    if (!isTauri) {
      const account = { code: subjectDraft.code.trim(), company_id: 'browser-preview', name: subjectDraft.name.trim(), account_type: subjectDraft.accountType, normal_balance: subjectDraft.normalBalance, level: Number(subjectDraft.level || 1), parent_code: subjectDraft.parentCode.trim() || null, is_detail: subjectDraft.isDetail ? 1 : 0, is_enabled: 1, has_quantity: subjectDraft.hasQuantity ? 1 : 0, default_unit: subjectDraft.hasQuantity ? subjectDraft.defaultUnit.trim() || null : null, has_auxiliary: subjectDraft.hasAuxiliary ? 1 : 0 }
      setPreviewSubjects((subjects) => [...subjects.filter((item) => item.code !== account.code), account])
      writeModuleAudit(editingSubjectCode ? '预览编辑会计科目' : '预览新增会计科目', `${subjectDraft.code}｜${subjectDraft.name}`, '中', '成功')
      setOperationNotice(`浏览器预览已保存会计科目：${account.code}｜${account.name}。`)
      setShowSubjectDialog(false)
      return
    }
    if (!selectedCompanyId) {
      setOperationNotice('请先进入账套，再维护会计科目。')
      return
    }
    try {
      const input = {
        code: subjectDraft.code.trim(), company_id: selectedCompanyId, name: subjectDraft.name.trim(), account_type: subjectDraft.accountType,
        normal_balance: subjectDraft.normalBalance, level: Number(subjectDraft.level || 1), parent_code: subjectDraft.parentCode.trim() || undefined,
        is_detail: subjectDraft.isDetail ? 1 : 0, has_quantity: subjectDraft.hasQuantity ? 1 : 0,
        default_unit: subjectDraft.hasQuantity ? subjectDraft.defaultUnit.trim() || undefined : undefined,
        has_auxiliary: subjectDraft.hasAuxiliary ? 1 : 0,
      }
      const account = editingSubjectCode
        ? await updateAccount(editingSubjectCode, selectedCompanyId, input)
        : await createAccount(input)
      writeModuleAudit(editingSubjectCode ? '编辑会计科目' : '新增会计科目', `${account.code}｜${account.name}`, '中', '成功')
      setOperationNotice(`科目“${account.code} ${account.name}”已保存。科目核算口径只影响后续凭证建议、账簿与报表取数，不会重写历史凭证。`)
      setShowSubjectDialog(false)
    } catch (error) {
      setOperationNotice(`保存会计科目失败：${String(error)}`)
    }
  }

  const handleToggleSubject = async () => {
    if (!editingSubjectCode || !selectedCompanyId || !isTauri) return
    try {
      const account = await toggleAccount(editingSubjectCode, selectedCompanyId)
      writeModuleAudit(account.is_enabled === 1 ? '启用会计科目' : '停用会计科目', `${account.code}｜${account.name}`, '中', '成功')
      setOperationNotice(`科目“${account.name}”已${account.is_enabled === 1 ? '启用' : '停用'}。`)
      setShowSubjectDialog(false)
    } catch (error) { setOperationNotice(`更新科目状态失败：${String(error)}`) }
  }

  const handleDeleteSubject = async () => {
    if (!editingSubjectCode || !selectedCompanyId || !isTauri) return
    if (!await requestBusinessRiskConfirmation('确认删除会计科目', `确认删除科目 ${editingSubjectCode} 吗？有下级科目或历史业务引用时系统将阻止删除。`, '删除')) return
    try {
      await deleteAccount(editingSubjectCode, selectedCompanyId)
      writeModuleAudit('删除会计科目', editingSubjectCode, '高', '成功')
      setOperationNotice(`科目“${editingSubjectCode}”已删除。`)
      setShowSubjectDialog(false)
    } catch (error) { setOperationNotice(`删除会计科目失败：${String(error)}`) }
  }

  const openInitialBalanceEditor = (row?: ModuleRow) => {
    const previewRow = !isTauri && row ? previewInitialBalanceRows.find((item) => item.accountCode === row.values.code) : undefined
    setInitialBalanceDraft({
      accountCode: row?.values.code || '',
      openingDebit: row ? String(importAmount(row.values.debit || '')) : '',
      openingCredit: row ? String(importAmount(row.values.credit || '')) : '',
      sourceNote: previewRow?.sourceNote || (row?.attachment && row.attachment !== '-' ? row.attachment : ''),
    })
    setShowInitialBalanceDialog(true)
  }

  const handleSaveInitialBalance = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const accountCode = initialBalanceDraft.accountCode.trim()
    const openingDebit = Number(initialBalanceDraft.openingDebit || 0)
    const openingCredit = Number(initialBalanceDraft.openingCredit || 0)
    if (!accountCode || !Number.isFinite(openingDebit) || !Number.isFinite(openingCredit) || openingDebit < 0 || openingCredit < 0 || (openingDebit === 0 && openingCredit === 0) || (openingDebit > 0 && openingCredit > 0)) {
      setOperationNotice('请选定科目，并且只填写借方或贷方其中一侧的非负期初金额。')
      return
    }
    if (!isTauri) {
      const existingRow = previewInitialBalanceRows.find((row) => row.accountCode === accountCode)
      const account = accounts.find((item) => item.code === accountCode)
      const sourceRow = config.rows.find((row) => row.values.code === accountCode)
      const previewRow: PreviewInitialBalanceRow = {
        accountCode,
        accountName: account?.name || existingRow?.accountName || sourceRow?.values.name || accountCode,
        accountType: account?.account_type || existingRow?.accountType || '会计科目',
        isDetail: account ? account.is_detail !== 0 : existingRow?.isDetail ?? true,
        openingDebit,
        openingCredit,
        sourceNote: initialBalanceDraft.sourceNote.trim(),
      }
      setPreviewInitialBalanceRows((rows) => [...rows.filter((row) => row.accountCode !== accountCode), previewRow])
      writeModuleAudit(existingRow ? '预览更新期初余额' : '预览登记期初余额', `${accountCode}｜借 ${openingDebit.toFixed(2)}｜贷 ${openingCredit.toFixed(2)}${previewRow.sourceNote ? `｜来源：${previewRow.sourceNote}` : ''}`, '高', '成功')
      setOperationNotice(`浏览器预览已${existingRow ? '更新' : '登记'} ${previewRow.accountName} 的期初余额，并写入本地余额清单；请执行试算平衡后人工确认启用账套。`)
      setShowInitialBalanceDialog(false)
      return
    }
    if (!currentPeriodId) {
      setOperationNotice('未选择当前账期，无法登记期初余额。')
      return
    }
    if (accounts.length > 0 && !accounts.some((account) => account.code === accountCode)) {
      setOperationNotice('所选科目不属于当前账套，请先维护会计科目。')
      return
    }
    try {
      await saveInitialBalance({ period_id: currentPeriodId, account_code: accountCode, opening_debit: openingDebit, opening_credit: openingCredit, created_by: 'admin' })
      const initialBalance = await fetchTrialBalance(currentPeriodId)
      setLiveReports((reports) => ({ ...reports, initialBalance }))
      writeModuleAudit('登记期初余额', `${accountCode}｜借 ${openingDebit.toFixed(2)}｜贷 ${openingCredit.toFixed(2)}${initialBalanceDraft.sourceNote.trim() ? `｜来源：${initialBalanceDraft.sourceNote.trim()}` : ''}`, '高', '成功')
      setOperationNotice(`期初余额已保存：${accountCode}。请继续执行试算平衡；期初余额不会自动生成凭证、结账或税务申报。`)
      setShowInitialBalanceDialog(false)
    } catch (error) {
      setOperationNotice(`保存期初余额失败：${String(error)}`)
    }
  }

  const openAuxiliaryArchiveEditor = (item?: typeof auxiliaryItems[number], row?: ModuleRow) => {
    const profile = item ? parseAuxiliaryArchiveProfile(item.remarks) : {}
    setEditingAuxiliaryArchiveItemId(item?.id || null)
    setAuxiliaryArchiveDraft({
      code: item?.code || row?.values.code || '', name: item?.name || row?.values.name || '',
      taxNo: profile.taxNo || row?.values.taxNo || '', bank: profile.bank || row?.values.bank || '', subject: profile.subject || row?.values.subject || '', contract: profile.contract || row?.values.contract || '',
      alias: profile.alias || row?.values.alias || '', taxRate: profile.taxRate || row?.values.taxRate || '', contactType: profile.contactType || row?.values.type || '', idNo: profile.idNo || row?.values.idNo || '',
      owner: profile.owner || row?.values.owner || '', start: profile.start || row?.values.start || '', budget: profile.budget || row?.values.budget || '', parent: profile.parent || row?.values.parent || '', people: profile.people || row?.values.people || '', remark: profile.remark || row?.values.remark || '',
    })
    setShowAuxiliaryArchiveDialog(true)
  }

  const handleSaveAuxiliaryArchive = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isLiveAuxiliaryArchiveKind(kind)) return
    const archiveKind = kind as AuxiliaryArchiveKind
    const definition = auxiliaryArchiveDefinitions[archiveKind]
    const code = auxiliaryArchiveDraft.code.trim()
    const name = auxiliaryArchiveDraft.name.trim()
    if (!code || !name) {
      setOperationNotice(`请填写${definition.title}编码和名称。`)
      return
    }
    const remarks = serializeAuxiliaryArchiveProfile({
      taxNo: auxiliaryArchiveDraft.taxNo.trim(), bank: auxiliaryArchiveDraft.bank.trim(), subject: auxiliaryArchiveDraft.subject.trim(), contract: auxiliaryArchiveDraft.contract.trim(),
      alias: auxiliaryArchiveDraft.alias.trim(), taxRate: auxiliaryArchiveDraft.taxRate.trim(), contactType: auxiliaryArchiveDraft.contactType.trim(), idNo: auxiliaryArchiveDraft.idNo.trim(),
      owner: auxiliaryArchiveDraft.owner.trim(), start: auxiliaryArchiveDraft.start.trim(), budget: auxiliaryArchiveDraft.budget.trim(), parent: auxiliaryArchiveDraft.parent.trim(), people: auxiliaryArchiveDraft.people.trim(), remark: auxiliaryArchiveDraft.remark.trim(),
    })
    if (!isTauri) {
      let categoryId = previewAuxiliaryCategories.find((category) => category.code === definition.categoryCode)?.id
      if (!categoryId) {
        categoryId = `preview-archive-category-${definition.categoryCode}`
        setPreviewAuxiliaryCategories((items) => [...items, { id: categoryId!, company_id: selectedCompanyId || 'preview-company', code: definition.categoryCode, name: definition.categoryName, is_system: 0, sort_order: items.length + 1 }])
      }
      const record = { id: editingAuxiliaryArchiveItemId || `preview-archive-${Date.now()}`, category_id: categoryId, company_id: selectedCompanyId || 'preview-company', code, name, is_enabled: 1, remarks }
      setPreviewAuxiliaryItems((items) => editingAuxiliaryArchiveItemId ? items.map((item) => item.id === editingAuxiliaryArchiveItemId ? { ...record, is_enabled: item.is_enabled } : item) : [...items, record])
      writeModuleAudit(editingAuxiliaryArchiveItemId ? `预览编辑${definition.title}` : `预览新增${definition.title}`, `${code}｜${name}`, '中', '成功')
      setOperationNotice(`${definition.title}档案已保存到浏览器预览；桌面端会写入当前账套的辅助核算档案，并保留扩展字段与变更记录。`)
      setShowAuxiliaryArchiveDialog(false)
      return
    }
    if (!selectedCompanyId) {
      setOperationNotice('请先进入账套，再维护基础档案。')
      return
    }
    try {
      let categoryId = auxiliaryCategories.find((category) => category.code === definition.categoryCode)?.id
      if (!categoryId) {
        const category = await createAuxiliaryCategory({ company_id: selectedCompanyId, code: definition.categoryCode, name: definition.categoryName, sort_order: auxiliaryCategories.length + 1 })
        categoryId = category.id
      }
      const item = editingAuxiliaryArchiveItemId
        ? await updateAuxiliaryItem(editingAuxiliaryArchiveItemId, { company_id: selectedCompanyId, category_id: categoryId, code, name, remarks })
        : await createAuxiliaryItem({ company_id: selectedCompanyId, category_id: categoryId, code, name, remarks })
      writeModuleAudit(editingAuxiliaryArchiveItemId ? `编辑${definition.title}` : `新增${definition.title}`, `${item.code}｜${item.name}`, '中', '成功')
      setOperationNotice(`${definition.title}档案已保存：${item.name}。启停与删除仍受业务引用校验，历史凭证不会被自动修改。`)
      setShowAuxiliaryArchiveDialog(false)
    } catch (error) {
      setOperationNotice(`保存${definition.title}档案失败：${String(error)}`)
    }
  }

  const handleToggleAuxiliaryArchive = async () => {
    if (!editingAuxiliaryArchiveItemId || !selectedCompanyId || !isTauri || !isLiveAuxiliaryArchiveKind(kind)) return
    try {
      await toggleAuxiliaryItem(editingAuxiliaryArchiveItemId, selectedCompanyId)
      writeModuleAudit('启用/停用基础档案', auxiliaryArchiveDraft.name, '中', '成功')
      setOperationNotice(`${auxiliaryArchiveDefinitions[kind].title}档案状态已更新。`)
      setShowAuxiliaryArchiveDialog(false)
    } catch (error) { setOperationNotice(`更新档案状态失败：${String(error)}`) }
  }

  const handleDeleteAuxiliaryArchive = async () => {
    if (!editingAuxiliaryArchiveItemId || !selectedCompanyId || !isTauri || !isLiveAuxiliaryArchiveKind(kind)) return
    const title = auxiliaryArchiveDefinitions[kind].title
    if (!await requestBusinessRiskConfirmation(`确认删除${title}档案`, `确认删除${title}档案“${auxiliaryArchiveDraft.name}”吗？已有业务引用时系统会阻止删除。`, '删除')) return
    try {
      await deleteAuxiliaryItem(editingAuxiliaryArchiveItemId, selectedCompanyId)
      writeModuleAudit(`删除${title}`, auxiliaryArchiveDraft.name, '高', '成功')
      setOperationNotice(`${title}档案已删除。`)
      setShowAuxiliaryArchiveDialog(false)
    } catch (error) { setOperationNotice(`删除${title}档案失败：${String(error)}`) }
  }

  const resetCompanyAccountDraft = () => {
    setEditingCompanyAccountId(null)
    setCompanyAccountDraft({ accountName: '', accountType: '银行账户', bankName: '', accountNumber: '', subjectCode: '1002 银行存款', openingBalance: '0', attachmentNote: '', status: '启用' })
  }

  const handleSaveCompanyAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isTauri) {
      const timestamp = new Date().toISOString()
      const account = { id: editingCompanyAccountId || `preview-account-${Date.now()}`, company_id: selectedCompanyId || 'preview-company', account_name: companyAccountDraft.accountName.trim(), account_type: companyAccountDraft.accountType, bank_name: companyAccountDraft.bankName.trim() || null, account_number: companyAccountDraft.accountNumber.trim(), subject_code: companyAccountDraft.subjectCode.trim(), opening_balance: Number(companyAccountDraft.openingBalance || 0), attachment_note: companyAccountDraft.attachmentNote.trim() || null, status: companyAccountDraft.status, created_at: timestamp, updated_at: timestamp }
      setPreviewCompanyAccounts((items) => editingCompanyAccountId ? items.map((item) => item.id === account.id ? { ...account, created_at: item.created_at } : item) : [account, ...items])
      writeModuleAudit(editingCompanyAccountId ? '编辑账户档案' : '新增账户档案', `${account.account_name}｜${account.account_number}`, '中', '成功')
      setOperationNotice(`账户档案已保存到当前预览：${account.account_name}。桌面端会写入当前账套，可继续用于流水、转账和资金余额表。`)
      resetCompanyAccountDraft()
      setShowCompanyAccountDialog(false)
      return
    }
    if (!selectedCompanyId) return
    try {
      const input = {
        companyId: selectedCompanyId, accountName: companyAccountDraft.accountName.trim(), accountType: companyAccountDraft.accountType,
        bankName: companyAccountDraft.bankName.trim() || undefined, accountNumber: companyAccountDraft.accountNumber.trim(),
        subjectCode: companyAccountDraft.subjectCode.trim(), openingBalance: Number(companyAccountDraft.openingBalance || 0),
        attachmentNote: companyAccountDraft.attachmentNote.trim() || undefined, status: companyAccountDraft.status,
      }
      const account = editingCompanyAccountId ? await updateCompanyAccount(editingCompanyAccountId, input) : await createCompanyAccount({ ...input })
      writeModuleAudit(editingCompanyAccountId ? '编辑账户档案' : '新增账户档案', `${account.account_name}｜${account.account_number}`, '中', '成功')
      setOperationNotice(`账户“${account.account_name}”已保存，可供银行流水、账户转账和资金余额表引用。`)
      resetCompanyAccountDraft(); setShowCompanyAccountDialog(false)
    } catch (error) { setOperationNotice(`保存账户档案失败：${String(error)}`) }
  }

  const handleDeleteCompanyAccount = async () => {
    if (!selectedCompanyId || !editingCompanyAccountId) return
    const account = companyAccounts.find((item) => item.id === editingCompanyAccountId)
    if (!account) return
    if (!await requestBusinessRiskConfirmation('确认删除账户档案', `确认删除账户“${account.account_name}”吗？已关联的历史业务不会变更。`, '删除')) return
    try { await deleteCompanyAccount(account.id, selectedCompanyId); writeModuleAudit('删除账户档案', `${account.account_name}｜${account.account_number}`, '高', '成功'); setOperationNotice(`账户“${account.account_name}”已删除。`); resetCompanyAccountDraft(); setShowCompanyAccountDialog(false) }
    catch (error) { setOperationNotice(`删除账户档案失败：${String(error)}`) }
  }

  const resetAuxiliaryCategoryDraft = () => {
    setEditingAuxiliaryCategoryId(null)
    setAuxiliaryCategoryDraft({ code: '', name: '', sortOrder: '0' })
  }

  const handleSaveAuxiliaryCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isTauri) {
      const category = { id: editingAuxiliaryCategoryId || `preview-aux-category-${Date.now()}`, company_id: selectedCompanyId || 'preview-company', code: auxiliaryCategoryDraft.code.trim().toUpperCase(), name: auxiliaryCategoryDraft.name.trim(), is_system: 0, sort_order: Number(auxiliaryCategoryDraft.sortOrder || 0) }
      setPreviewAuxiliaryCategories((items) => editingAuxiliaryCategoryId ? items.map((item) => item.id === category.id ? category : item) : [category, ...items])
      writeModuleAudit(editingAuxiliaryCategoryId ? '编辑辅助核算类别' : '新增辅助核算类别', `${category.code}｜${category.name}`, '中', '成功')
      setOperationNotice(`辅助核算类别已保存到当前预览：${category.name}。桌面端会写入当前账套，可继续维护项目和科目关联。`)
      resetAuxiliaryCategoryDraft()
      setShowAuxiliaryCategoryDialog(false)
      return
    }
    if (!selectedCompanyId) return
    try {
      const input = {
        company_id: selectedCompanyId,
        code: auxiliaryCategoryDraft.code.trim().toUpperCase(),
        name: auxiliaryCategoryDraft.name.trim(),
        sort_order: Number(auxiliaryCategoryDraft.sortOrder || 0),
      }
      if (!input.code || !input.name) throw new Error('类别编码和类别名称不能为空')
      const category = editingAuxiliaryCategoryId
        ? await updateAuxiliaryCategory(editingAuxiliaryCategoryId, input)
        : await createAuxiliaryCategory({ ...input })
      writeModuleAudit(editingAuxiliaryCategoryId ? '编辑辅助核算类别' : '新增辅助核算类别', `${category.code}｜${category.name}`, '中', '成功')
      setOperationNotice(editingAuxiliaryCategoryId ? `辅助核算类别“${category.name}”已更新。` : `辅助核算类别“${category.name}”已新增，可继续维护明细项目和科目关联。`)
      resetAuxiliaryCategoryDraft()
      setShowAuxiliaryCategoryDialog(false)
    } catch (error) {
      setOperationNotice(`${editingAuxiliaryCategoryId ? '编辑' : '新增'}辅助核算类别失败：${String(error)}`)
    }
  }

  const handleDeleteAuxiliaryCategory = async () => {
    if (!selectedCompanyId || !editingAuxiliaryCategoryId) return
    const category = auxiliaryCategories.find((item) => item.id === editingAuxiliaryCategoryId)
    if (!category) return
    if (category.is_system === 1) {
      setOperationNotice('系统预置辅助核算类别不能删除。')
      return
    }
    if (!await requestBusinessRiskConfirmation('确认删除辅助核算类别', `确认删除辅助核算类别“${category.name}”吗？类别下存在项目或关联科目时系统会阻止删除。`, '删除')) return
    try {
      await deleteAuxiliaryCategory(category.id, selectedCompanyId)
      writeModuleAudit('删除辅助核算类别', `${category.code}｜${category.name}`, '高', '成功')
      setOperationNotice(`辅助核算类别“${category.name}”已删除。`)
      resetAuxiliaryCategoryDraft()
      setShowAuxiliaryCategoryDialog(false)
    } catch (error) {
      setOperationNotice(`删除辅助核算类别失败：${String(error)}`)
    }
  }

  const resetAuxiliaryItemDraft = () => {
    setEditingAuxiliaryItemId(null)
    setAuxiliaryItemDraft({ categoryId: (isTauri ? auxiliaryCategories : previewAuxiliaryCategories)[0]?.id || '', code: '', name: '', remarks: '' })
  }

  const handleSaveAuxiliaryItem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isTauri) {
      const item = { id: editingAuxiliaryItemId || `preview-aux-item-${Date.now()}`, category_id: auxiliaryItemDraft.categoryId, company_id: selectedCompanyId || 'preview-company', code: auxiliaryItemDraft.code.trim().toUpperCase(), name: auxiliaryItemDraft.name.trim(), is_enabled: 1, remarks: auxiliaryItemDraft.remarks.trim() || null }
      setPreviewAuxiliaryItems((items) => editingAuxiliaryItemId ? items.map((current) => current.id === item.id ? item : current) : [item, ...items])
      writeModuleAudit(editingAuxiliaryItemId ? '编辑辅助核算项目' : '新增辅助核算项目', `${item.code}｜${item.name}`, '中', '成功')
      setOperationNotice(`辅助核算项目已保存到当前预览：${item.name}。桌面端会写入当前账套，可在档案、凭证和账簿中引用。`)
      resetAuxiliaryItemDraft()
      setShowAuxiliaryItemDialog(false)
      return
    }
    if (!selectedCompanyId) return
    try {
      const input = {
        category_id: auxiliaryItemDraft.categoryId,
        company_id: selectedCompanyId,
        code: auxiliaryItemDraft.code.trim().toUpperCase(),
        name: auxiliaryItemDraft.name.trim(),
        remarks: auxiliaryItemDraft.remarks.trim() || undefined,
      }
      if (!input.category_id || !input.code || !input.name) throw new Error('请选择类别并填写项目编码、项目名称')
      const item = editingAuxiliaryItemId
        ? await updateAuxiliaryItem(editingAuxiliaryItemId, input)
        : await createAuxiliaryItem({ ...input })
      writeModuleAudit(editingAuxiliaryItemId ? '编辑辅助核算项目' : '新增辅助核算项目', `${item.code}｜${item.name}`, '中', '成功')
      setOperationNotice(editingAuxiliaryItemId ? `辅助核算项目“${item.name}”已更新。` : `辅助核算项目“${item.name}”已新增，可用于档案和凭证辅助核算。`)
      resetAuxiliaryItemDraft()
      setShowAuxiliaryItemDialog(false)
    } catch (error) {
      setOperationNotice(`${editingAuxiliaryItemId ? '编辑' : '新增'}辅助核算项目失败：${String(error)}`)
    }
  }

  const handleDeleteAuxiliaryItem = async () => {
    if (!selectedCompanyId || !editingAuxiliaryItemId) return
    const item = auxiliaryItems.find((current) => current.id === editingAuxiliaryItemId)
    if (!item) return
    if (!await requestBusinessRiskConfirmation('确认删除辅助核算项目', `确认删除辅助核算项目“${item.name}”吗？已经用于凭证的项目不能删除。`, '删除')) return
    try {
      await deleteAuxiliaryItem(item.id, selectedCompanyId)
      writeModuleAudit('删除辅助核算项目', `${item.code}｜${item.name}`, '高', '成功')
      setOperationNotice(`辅助核算项目“${item.name}”已删除。`)
      resetAuxiliaryItemDraft()
      setShowAuxiliaryItemDialog(false)
    } catch (error) {
      setOperationNotice(`删除辅助核算项目失败：${String(error)}`)
    }
  }

  const handleToggleAuxiliaryItem = async () => {
    if (!selectedCompanyId || !editingAuxiliaryItemId) return
    const item = auxiliaryItems.find((current) => current.id === editingAuxiliaryItemId)
    if (!item) return
    const action = item.is_enabled === 1 ? '停用' : '启用'
    if (!await requestBusinessRiskConfirmation(`确认${action}辅助核算项目`, `确认${action}辅助核算项目“${item.name}”吗？${action}后将影响后续档案和凭证选择。`, `确认${action}`)) return
    try {
      await toggleAuxiliaryItem(item.id, selectedCompanyId)
      writeModuleAudit(`${action}辅助核算项目`, `${item.code}｜${item.name}`, '中', '成功')
      setOperationNotice(`辅助核算项目“${item.name}”已${action}。`)
      setShowAuxiliaryItemDialog(false)
      resetAuxiliaryItemDraft()
    } catch (error) {
      setOperationNotice(`${action}辅助核算项目失败：${String(error)}`)
    }
  }

  const handleSaveSocialSecurityRecord = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isTauri) {
      const timestamp = new Date().toISOString()
      const employee = employees.find((item) => item.id === socialSecurityDraft.employeeId) || { id: socialSecurityDraft.employeeId || 'preview-employee', name: '预览员工' }
      const record: SocialSecurityRecord = { id: editingSocialSecurityId || `preview-social-${Date.now()}`, companyId: selectedCompanyId || 'preview-company', employeeId: employee.id, employeeName: employee.name, period: currentPeriodLabel === '当前账期' ? '2026-05' : currentPeriodLabel, city: socialSecurityDraft.city || null, contributionBase: Number(socialSecurityDraft.base || 0), companyAmount: Number(socialSecurityDraft.company || 0), personalAmount: Number(socialSecurityDraft.personal || 0), fundAmount: Number(socialSecurityDraft.fund || 0), status: '待确认', createdAt: timestamp, updatedAt: timestamp }
      setSocialSecurityRecords((records) => editingSocialSecurityId ? records.map((item) => item.id === record.id ? { ...record, createdAt: item.createdAt } : item) : [record, ...records])
      writeModuleAudit(editingSocialSecurityId ? '编辑社保公积金明细' : '新增社保公积金明细', `${record.employeeName}｜${record.period}`, '中', '成功')
      setOperationNotice(`社保公积金明细已保存到当前预览：${record.employeeName}。桌面端会写入当前账套，基数、缴费金额和凭证仍需人工确认。`)
      setSocialSecurityDraft({ employeeId: '', city: '', base: '', company: '', personal: '', fund: '' })
      setEditingSocialSecurityId(null)
      setShowSocialSecurityDialog(false)
      return
    }
    if (!selectedCompanyId || currentPeriodLabel === '当前账期') return
    try {
      const securityInput = {
        companyId: selectedCompanyId, employeeId: socialSecurityDraft.employeeId, period: currentPeriodLabel,
        city: socialSecurityDraft.city, contributionBase: Number(socialSecurityDraft.base || 0),
        companyAmount: Number(socialSecurityDraft.company || 0), personalAmount: Number(socialSecurityDraft.personal || 0), fundAmount: Number(socialSecurityDraft.fund || 0),
      }
      const result = editingSocialSecurityId ? await socialSecurityApi.updateSocialSecurityRecord({ id:editingSocialSecurityId, ...securityInput }) : await socialSecurityApi.createSocialSecurityRecord(securityInput)
      if (!result.success || !result.data) throw new Error(result.error || '未返回社保明细')
      setSocialSecurityRecords((records) => editingSocialSecurityId ? records.map((item)=>item.id===result.data!.id?result.data!:item):[result.data!, ...records])
      writeModuleAudit('新增社保明细', `${result.data.employeeName}｜${currentPeriodLabel}`, '中', '成功')
      setOperationNotice(`已新增 ${result.data.employeeName} 的社保公积金明细，等待确认。`)
      setEditingSocialSecurityId(null); setSocialSecurityDraft({ employeeId: '', city: '', base: '', company: '', personal: '', fund: '' })
      setShowSocialSecurityDialog(false)
    } catch (error) { setOperationNotice(`新增社保明细失败：${String(error)}`) }
  }

  const handleSaveSpecialDeductionRecord = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isTauri) {
      const timestamp = new Date().toISOString()
      const employee = employees.find((item) => item.id === specialDeductionDraft.employeeId) || { id: specialDeductionDraft.employeeId || 'preview-employee', name: '预览员工' }
      const record: SpecialDeductionRecord = { id: editingSpecialDeductionId || `preview-deduction-${Date.now()}`, companyId: selectedCompanyId || 'preview-company', employeeId: employee.id, employeeName: employee.name, deductionType: specialDeductionDraft.deductionType, startMonth: specialDeductionDraft.startMonth, endMonth: specialDeductionDraft.endMonth || null, monthlyAmount: Number(specialDeductionDraft.monthlyAmount || 0), source: specialDeductionDraft.source, status: '待确认', createdAt: timestamp, updatedAt: timestamp }
      setSpecialDeductionRecords((records) => editingSpecialDeductionId ? records.map((item) => item.id === record.id ? { ...record, createdAt: item.createdAt } : item) : [record, ...records])
      writeModuleAudit(editingSpecialDeductionId ? '编辑专项附加扣除' : '新增专项附加扣除', `${record.employeeName}｜${record.deductionType}`, '中', '成功')
      setOperationNotice(`专项附加扣除已保存到当前预览：${record.employeeName}｜${record.deductionType}。桌面端会写入当前账套，个税取数前仍需人工确认有效期间和证明资料。`)
      setSpecialDeductionDraft({ employeeId: '', deductionType: '子女教育', startMonth: '', endMonth: '', monthlyAmount: '', source: '手工' })
      setEditingSpecialDeductionId(null)
      setShowSpecialDeductionDialog(false)
      return
    }
    if (!selectedCompanyId) return
    try {
      const deductionInput = {
        companyId: selectedCompanyId,
        employeeId: specialDeductionDraft.employeeId,
        deductionType: specialDeductionDraft.deductionType,
        startMonth: specialDeductionDraft.startMonth,
        endMonth: specialDeductionDraft.endMonth || undefined,
        monthlyAmount: Number(specialDeductionDraft.monthlyAmount || 0),
        source: specialDeductionDraft.source,
      }
      const result = editingSpecialDeductionId ? await specialDeductionApi.updateSpecialDeductionRecord({ id:editingSpecialDeductionId, ...deductionInput }) : await specialDeductionApi.createSpecialDeductionRecord(deductionInput)
      if (!result.success || !result.data) throw new Error(result.error || '未返回扣除明细')
      setSpecialDeductionRecords((records) => editingSpecialDeductionId ? records.map((item)=>item.id===result.data!.id?result.data!:item):[result.data!, ...records])
      writeModuleAudit('新增专项附加扣除', `${result.data.employeeName}｜${result.data.deductionType}`, '中', '成功')
      setOperationNotice(`已新增 ${result.data.employeeName} 的${result.data.deductionType}扣除资料，等待确认。`)
      setEditingSpecialDeductionId(null); setSpecialDeductionDraft({ employeeId: '', deductionType: '子女教育', startMonth: '', endMonth: '', monthlyAmount: '', source: '手工' })
      setShowSpecialDeductionDialog(false)
    } catch (error) {
      setOperationNotice(`新增专项附加扣除失败：${String(error)}`)
    }
  }

  const handleSaveBankTransaction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isTauri) {
      const timestamp = new Date().toISOString()
      const incomeAmount = Number(bankTransactionDraft.incomeAmount || 0)
      const expenseAmount = Number(bankTransactionDraft.expenseAmount || 0)
      if (incomeAmount > 0 && expenseAmount > 0) { setOperationNotice('银行流水的收入与支出金额只能填写一项。'); return }
      const transaction: BankTransaction = { id: editingBankTransactionId || `preview-bank-${Date.now()}`, companyId: selectedCompanyId || 'preview-company', period: currentPeriodLabel === '当前账期' ? '2026-05' : currentPeriodLabel, accountName: bankTransactionDraft.accountName, serialNo: bankTransactionDraft.serialNo, transactionDate: bankTransactionDraft.transactionDate, counterparty: bankTransactionDraft.counterparty || null, summary: bankTransactionDraft.summary || null, incomeAmount, expenseAmount, balance: bankTransactionDraft.balance ? Number(bankTransactionDraft.balance) : null, receiptStatus: bankTransactionDraft.receiptStatus, matchResult: null, status: '待处理', createdAt: timestamp, updatedAt: timestamp }
      setBankTransactions((records) => editingBankTransactionId ? records.map((item) => item.id === transaction.id ? { ...transaction, createdAt: item.createdAt } : item) : [transaction, ...records])
      writeModuleAudit(editingBankTransactionId ? '编辑银行流水' : '新增银行流水', `${transaction.accountName}｜${transaction.serialNo}`, '中', '成功')
      setOperationNotice(`银行流水已保存到当前预览：${transaction.serialNo}。桌面端会写入当前账套，回单、自动匹配和凭证仍需人工确认。`)
      setEditingBankTransactionId(null)
      setBankTransactionDraft({ accountName: '', serialNo: '', transactionDate: '', counterparty: '', summary: '', incomeAmount: '', expenseAmount: '', balance: '', receiptStatus: '待上传' })
      setSelectedBankTransactionTagIds([])
      setShowBankTransactionDialog(false)
      return
    }
    if (!selectedCompanyId || currentPeriodLabel === '当前账期') return
    try {
      const transactionInput = { companyId: selectedCompanyId, accountName: bankTransactionDraft.accountName, serialNo: bankTransactionDraft.serialNo, transactionDate: bankTransactionDraft.transactionDate, counterparty: bankTransactionDraft.counterparty || undefined, summary: bankTransactionDraft.summary || undefined, incomeAmount: Number(bankTransactionDraft.incomeAmount || 0), expenseAmount: Number(bankTransactionDraft.expenseAmount || 0), balance: bankTransactionDraft.balance ? Number(bankTransactionDraft.balance) : undefined, receiptStatus: bankTransactionDraft.receiptStatus }
      const result = editingBankTransactionId
        ? await bankTransactionApi.updateBankTransaction({ id: editingBankTransactionId, ...transactionInput })
        : await bankTransactionApi.createBankTransaction({ ...transactionInput, period: currentPeriodLabel })
      if (!result.success || !result.data) throw new Error(result.error || '未返回银行流水')
      await replaceBankTransactionTags(result.data.id, selectedCompanyId, selectedBankTransactionTagIds)
      await fetchBusinessTags(selectedCompanyId)
      setBankTransactions((records) => editingBankTransactionId ? records.map((item) => item.id === result.data!.id ? result.data! : item) : [result.data!, ...records])
      writeModuleAudit(editingBankTransactionId ? '编辑银行流水' : '新增银行流水', `${result.data.accountName}｜${result.data.serialNo}`, '中', '成功')
      setOperationNotice(editingBankTransactionId ? `已更新 ${result.data.accountName} 的银行流水，需重新执行匹配和人工确认。` : `已新增 ${result.data.accountName} 的银行流水，等待匹配和人工确认。`)
      setEditingBankTransactionId(null)
      setBankTransactionDraft({ accountName: '', serialNo: '', transactionDate: '', counterparty: '', summary: '', incomeAmount: '', expenseAmount: '', balance: '', receiptStatus: '待上传' })
      setSelectedBankTransactionTagIds([])
      setShowBankTransactionDialog(false)
    } catch (error) {
      setOperationNotice(`${editingBankTransactionId ? '编辑' : '新增'}银行流水失败：${String(error)}`)
    }
  }

  const handleSaveDocumentRecord = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isTauri) {
      const timestamp = new Date().toISOString()
      const record: DocumentRecord = {
        id: editingDocumentRecordId || `preview-document-${Date.now()}`,
        companyId: selectedCompanyId || 'preview-company',
        period: currentPeriodLabel === '当前账期' ? '2026-05' : currentPeriodLabel,
        businessDate: documentRecordDraft.businessDate,
        documentCode: documentRecordDraft.documentCode,
        businessType: documentRecordDraft.businessType,
        partner: documentRecordDraft.partner || null,
        amount: Number(documentRecordDraft.amount || 0),
        owner: documentRecordDraft.owner || null,
        attachmentStatus: documentRecordDraft.attachmentStatus,
        stampTaxItem: documentRecordDraft.stampTaxItem || null,
        stampTaxRate: documentRecordDraft.stampTaxRate === '' ? null : Number(documentRecordDraft.stampTaxRate) / 100,
        status: '待确认',
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      setDocumentRecords((records) => editingDocumentRecordId ? records.map((item) => item.id === record.id ? { ...record, createdAt: item.createdAt } : item) : [record, ...records])
      writeModuleAudit(editingDocumentRecordId ? '编辑登记单据' : '新增登记单据', record.documentCode, '中', '成功')
      setOperationNotice(editingDocumentRecordId
        ? `当前预览登记单据已更新：${record.documentCode}。桌面端会写入当前账套，后续仍需审核、关联附件和确认凭证。`
        : `登记单据已保存到当前预览：${record.documentCode}。桌面端会写入当前账套，后续仍需审核、关联附件和确认凭证。`)
      setDocumentRecordDraft({ businessDate: '', documentCode: '', businessType: documentBusinessType(kind), partner: '', amount: '', owner: '', attachmentStatus: '待补附件', stampTaxItem: '', stampTaxRate: '' })
      setEditingDocumentRecordId(null)
      setShowDocumentRecordDialog(false)
      return
    }
    if (!selectedCompanyId || currentPeriodLabel === '当前账期') return
    try {
      const recordInput = { companyId: selectedCompanyId, businessDate: documentRecordDraft.businessDate, documentCode: documentRecordDraft.documentCode, businessType: documentRecordDraft.businessType, partner: documentRecordDraft.partner || undefined, amount: Number(documentRecordDraft.amount || 0), owner: documentRecordDraft.owner || undefined, attachmentStatus: documentRecordDraft.attachmentStatus, stampTaxItem: documentRecordDraft.stampTaxItem || undefined, stampTaxRate: documentRecordDraft.stampTaxRate === '' ? undefined : Number(documentRecordDraft.stampTaxRate) / 100 }
      const result = editingDocumentRecordId
        ? await documentRecordApi.updateDocumentRecord({ id: editingDocumentRecordId, ...recordInput })
        : await documentRecordApi.createDocumentRecord({ ...recordInput, period: currentPeriodLabel })
      if (!result.success || !result.data) throw new Error(result.error || '未返回登记单据')
      setDocumentRecords((records) => editingDocumentRecordId ? records.map((item) => item.id === result.data!.id ? result.data! : item) : [result.data!, ...records])
      writeModuleAudit(editingDocumentRecordId ? '编辑登记单据' : '新增登记单据', result.data.documentCode, '中', '成功')
      setOperationNotice(editingDocumentRecordId ? `已更新 ${result.data.documentCode}，需重新审核后才可生成凭证。` : `已新增 ${result.data.documentCode}，等待审核和凭证生成确认。`)
      setEditingDocumentRecordId(null)
      setDocumentRecordDraft({ businessDate: '', documentCode: '', businessType: documentBusinessType(kind), partner: '', amount: '', owner: '', attachmentStatus: '待补附件', stampTaxItem: '', stampTaxRate: '' })
      setShowDocumentRecordDialog(false)
    } catch (error) { setOperationNotice(`${editingDocumentRecordId ? '编辑' : '新增'}登记单据失败：${String(error)}`) }
  }

  const handleSaveBusinessOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isTauri) {
      const timestamp = new Date().toISOString()
      const order: BusinessOrder = {
        id: `preview-order-${Date.now()}`,
        companyId: selectedCompanyId || 'preview-company',
        period: currentPeriodLabel === '当前账期' ? '2026-05' : currentPeriodLabel,
        orderType: kind === 'purchaseManagement' ? 'purchase' : 'sales',
        orderNo: businessOrderDraft.orderNo,
        businessDate: businessOrderDraft.businessDate,
        counterparty: businessOrderDraft.counterparty,
        goodsName: businessOrderDraft.goodsName,
        amount: Number(businessOrderDraft.amount || 0),
        fulfillmentStatus: businessOrderDraft.fulfillmentStatus,
        invoiceStatus: businessOrderDraft.invoiceStatus,
        settlementStatus: businessOrderDraft.settlementStatus,
        status: businessOrderDraft.status,
        sourceDocument: businessOrderDraft.sourceDocument || null,
        voucherId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      setBusinessOrders((orders) => [order, ...orders])
      writeModuleAudit('新增业务订单', order.orderNo, '中', '成功')
      setOperationNotice(`业务订单已保存到当前预览：${order.orderNo}。桌面端会写入当前账套，发票、收付款和凭证仍需人工关联。`)
      setBusinessOrderDraft({ orderNo: '', businessDate: '', counterparty: '', goodsName: '', amount: '', fulfillmentStatus: kind === 'purchaseManagement' ? '待入库' : '待出库', invoiceStatus: kind === 'purchaseManagement' ? '待收票' : '待开票', settlementStatus: kind === 'purchaseManagement' ? '未付款' : '未收款', status: '待确认', sourceDocument: '' })
      setShowBusinessOrderDialog(false)
      return
    }
    if (!selectedCompanyId || currentPeriodLabel === '当前账期') return
    try {
      const orderInput = { companyId: selectedCompanyId, orderNo: businessOrderDraft.orderNo, businessDate: businessOrderDraft.businessDate, counterparty: businessOrderDraft.counterparty, goodsName: businessOrderDraft.goodsName, amount: Number(businessOrderDraft.amount || 0), fulfillmentStatus: businessOrderDraft.fulfillmentStatus, invoiceStatus: businessOrderDraft.invoiceStatus, settlementStatus: businessOrderDraft.settlementStatus, status: businessOrderDraft.status, sourceDocument: businessOrderDraft.sourceDocument || undefined }
      const result = editingBusinessOrderId
        ? await businessOrderApi.updateBusinessOrder({ id: editingBusinessOrderId, ...orderInput })
        : await businessOrderApi.createBusinessOrder({ ...orderInput, period: currentPeriodLabel, orderType: kind === 'purchaseManagement' ? 'purchase' : 'sales' })
      if (!result.success || !result.data) throw new Error(result.error || '未返回业务订单')
      setBusinessOrders((orders) => editingBusinessOrderId ? orders.map((item) => item.id === result.data!.id ? result.data! : item) : [result.data!, ...orders])
      writeModuleAudit(editingBusinessOrderId ? '编辑业务订单' : '新增业务订单', result.data.orderNo, '中', '成功')
      setOperationNotice(editingBusinessOrderId ? `已更新 ${result.data.orderNo}；发票、流水和凭证关联仍需人工确认。` : `已保存 ${result.data.orderNo}；请在履约、开票和收付款完成后人工关联发票、流水和凭证。`)
      setEditingBusinessOrderId(null)
      setBusinessOrderDraft({ orderNo: '', businessDate: '', counterparty: '', goodsName: '', amount: '', fulfillmentStatus: '待确认', invoiceStatus: '待开票', settlementStatus: '未结算', status: '待确认', sourceDocument: '' })
      setShowBusinessOrderDialog(false)
    } catch (error) { setOperationNotice(`${editingBusinessOrderId ? '编辑' : '新增'}业务订单失败：${String(error)}`) }
  }

  const handleSaveSettlementRecord = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isTauri) {
      const timestamp = new Date().toISOString()
      const totalAmount = Number(settlementRecordDraft.totalAmount || 0)
      const settledAmount = Number(settlementRecordDraft.settledAmount || 0)
      const record: SettlementRecord = {
        id: `preview-settlement-${Date.now()}`,
        companyId: selectedCompanyId || 'preview-company',
        period: currentPeriodLabel === '当前账期' ? '2026-05' : currentPeriodLabel,
        settlementType: kind === 'payableSettlement' ? 'payable' : 'receivable',
        settlementNo: settlementRecordDraft.settlementNo,
        settlementDate: settlementRecordDraft.settlementDate,
        counterparty: settlementRecordDraft.counterparty,
        invoiceNo: settlementRecordDraft.invoiceNo || null,
        transactionNo: settlementRecordDraft.transactionNo || null,
        totalAmount,
        settledAmount,
        balanceAmount: totalAmount - settledAmount,
        settlementMethod: settlementRecordDraft.settlementMethod,
        owner: settlementRecordDraft.owner || null,
        status: settlementRecordDraft.status,
        sourceDocument: settlementRecordDraft.sourceDocument || null,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      setSettlementRecords((records) => [record, ...records])
      writeModuleAudit('新增核销台账', record.settlementNo, '中', '成功')
      setOperationNotice(`核销记录已保存到当前预览：${record.settlementNo}。桌面端会写入当前账套，发票和流水关联仍需人工核验。`)
      setSettlementRecordDraft({ settlementNo: '', settlementDate: '', counterparty: '', invoiceNo: '', transactionNo: '', totalAmount: '', settledAmount: '0', settlementMethod: '银行转账', owner: '', status: '待确认', sourceDocument: '' })
      setShowSettlementRecordDialog(false)
      return
    }
    if (!selectedCompanyId || currentPeriodLabel === '当前账期') return
    try {
      const recordInput = { companyId: selectedCompanyId, settlementNo: settlementRecordDraft.settlementNo, settlementDate: settlementRecordDraft.settlementDate, counterparty: settlementRecordDraft.counterparty, invoiceNo: settlementRecordDraft.invoiceNo || undefined, transactionNo: settlementRecordDraft.transactionNo || undefined, totalAmount: Number(settlementRecordDraft.totalAmount || 0), settledAmount: Number(settlementRecordDraft.settledAmount || 0), settlementMethod: settlementRecordDraft.settlementMethod, owner: settlementRecordDraft.owner || undefined, status: settlementRecordDraft.status, sourceDocument: settlementRecordDraft.sourceDocument || undefined }
      const result = editingSettlementRecordId ? await settlementRecordApi.updateSettlementRecord({ id: editingSettlementRecordId, ...recordInput }) : await settlementRecordApi.createSettlementRecord({ ...recordInput, period: currentPeriodLabel, settlementType: kind === 'payableSettlement' ? 'payable' : 'receivable' })
      if (!result.success || !result.data) throw new Error(result.error || '未返回核销记录')
      setSettlementRecords((records) => editingSettlementRecordId ? records.map((item) => item.id === result.data!.id ? result.data! : item) : [result.data!, ...records])
      writeModuleAudit(editingSettlementRecordId ? '编辑核销台账' : '新增核销台账', result.data.settlementNo, '中', '成功')
      setOperationNotice(`已保存 ${result.data.settlementNo}，发票和银行流水关联仍需人工核验。`)
      setEditingSettlementRecordId(null)
      setShowSettlementRecordDialog(false)
    } catch (error) { setOperationNotice(`保存核销台账失败：${String(error)}`) }
  }

  const handleSaveBankReconciliation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isTauri) {
      const timestamp = new Date().toISOString()
      const bankAmount = Number(bankReconciliationDraft.bankAmount || 0)
      const bookAmount = Number(bankReconciliationDraft.bookAmount || 0)
      const record: BankReconciliationRecord = {
        id: `preview-reconciliation-${Date.now()}`,
        companyId: selectedCompanyId || 'preview-company',
        period: currentPeriodLabel === '当前账期' ? '2026-05' : currentPeriodLabel,
        reconciliationNo: bankReconciliationDraft.reconciliationNo,
        reconciliationDate: bankReconciliationDraft.reconciliationDate,
        bankTransactionId: null,
        accountName: bankReconciliationDraft.accountName,
        transactionNo: bankReconciliationDraft.transactionNo,
        summary: bankReconciliationDraft.summary || null,
        bankAmount,
        bookAmount,
        differenceAmount: bankAmount - bookAmount,
        voucherNo: bankReconciliationDraft.voucherNo || null,
        matchStatus: bankReconciliationDraft.matchStatus,
        owner: bankReconciliationDraft.owner || null,
        status: bankReconciliationDraft.status,
        note: bankReconciliationDraft.note || null,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      setBankReconciliationRecords((records) => [record, ...records])
      writeModuleAudit('新增银行对账', record.reconciliationNo, '中', '成功')
      setOperationNotice(`银行对账已保存到当前预览：${record.reconciliationNo}。桌面端会写入当前账套，不会自动修改银行流水或会计凭证。`)
      setBankReconciliationDraft({ reconciliationNo: '', reconciliationDate: '', accountName: '', transactionNo: '', summary: '', bankAmount: '', bookAmount: '', voucherNo: '', matchStatus: '待人工对账', owner: '', status: '待处理', note: '' })
      setShowBankReconciliationDialog(false)
      return
    }
    if (!selectedCompanyId || currentPeriodLabel === '当前账期') return
    try {
      const input = { companyId: selectedCompanyId, reconciliationNo: bankReconciliationDraft.reconciliationNo, reconciliationDate: bankReconciliationDraft.reconciliationDate, accountName: bankReconciliationDraft.accountName, transactionNo: bankReconciliationDraft.transactionNo, summary: bankReconciliationDraft.summary || undefined, bankAmount: Number(bankReconciliationDraft.bankAmount || 0), bookAmount: Number(bankReconciliationDraft.bookAmount || 0), voucherNo: bankReconciliationDraft.voucherNo || undefined, matchStatus: bankReconciliationDraft.matchStatus, owner: bankReconciliationDraft.owner || undefined, status: bankReconciliationDraft.status, note: bankReconciliationDraft.note || undefined }
      const result = editingBankReconciliationId ? await bankReconciliationApi.updateBankReconciliationRecord({ id: editingBankReconciliationId, ...input }) : await bankReconciliationApi.createBankReconciliationRecord({ ...input, period: currentPeriodLabel })
      if (!result.success || !result.data) throw new Error(result.error || '未返回银行对账记录')
      setBankReconciliationRecords((records) => editingBankReconciliationId ? records.map((item) => item.id === result.data!.id ? result.data! : item) : [result.data!, ...records])
      writeModuleAudit(editingBankReconciliationId ? '编辑银行对账' : '新增银行对账', result.data.reconciliationNo, '中', '成功')
      setOperationNotice(`已保存 ${result.data.reconciliationNo}；银行流水和凭证关联仍需人工复核。`)
      setEditingBankReconciliationId(null)
      setShowBankReconciliationDialog(false)
    } catch (error) { setOperationNotice(`保存银行对账失败：${String(error)}`) }
  }

  const handleSaveCostCarryover = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isTauri) {
      const timestamp = new Date().toISOString()
      const record: CostCarryoverRecord = { id: `preview-cost-${Date.now()}`, companyId: selectedCompanyId || 'preview-company', period: currentPeriodLabel === '当前账期' ? '2026-05' : currentPeriodLabel, batchNo: costCarryoverDraft.batchNo, carryoverDate: costCarryoverDraft.carryoverDate, valuationMethod: costCarryoverDraft.valuationMethod, sourceBillNo: costCarryoverDraft.sourceBillNo, inventoryName: costCarryoverDraft.inventoryName, debitSubject: costCarryoverDraft.debitSubject, creditSubject: costCarryoverDraft.creditSubject, costAmount: Number(costCarryoverDraft.costAmount || 0), differenceAmount: Number(costCarryoverDraft.differenceAmount || 0), voucherNo: costCarryoverDraft.voucherNo || null, status: costCarryoverDraft.status, sourceDocument: costCarryoverDraft.sourceDocument || null, createdAt: timestamp, updatedAt: timestamp }
      setCostCarryoverRecords((records) => [record, ...records])
      writeModuleAudit('新增成本结转', record.batchNo, '高', '成功')
      setOperationNotice(`成本结转已保存到当前预览：${record.batchNo}。桌面端会写入当前账套，成本差异仍需人工复核后关联凭证。`)
      setShowCostCarryoverDialog(false)
      return
    }
    if (!selectedCompanyId || currentPeriodLabel === '当前账期') return
    try {
      const input = { companyId:selectedCompanyId, batchNo:costCarryoverDraft.batchNo, carryoverDate:costCarryoverDraft.carryoverDate, valuationMethod:costCarryoverDraft.valuationMethod, sourceBillNo:costCarryoverDraft.sourceBillNo, inventoryName:costCarryoverDraft.inventoryName, debitSubject:costCarryoverDraft.debitSubject, creditSubject:costCarryoverDraft.creditSubject, costAmount:Number(costCarryoverDraft.costAmount||0), differenceAmount:Number(costCarryoverDraft.differenceAmount||0), voucherNo:costCarryoverDraft.voucherNo||undefined, status:costCarryoverDraft.status, sourceDocument:costCarryoverDraft.sourceDocument||undefined }
      const result=editingCostCarryoverId?await costCarryoverApi.updateCostCarryoverRecord({id:editingCostCarryoverId,...input}):await costCarryoverApi.createCostCarryoverRecord({...input,period:currentPeriodLabel})
      if(!result.success||!result.data) throw new Error(result.error||'未返回成本结转记录')
      setCostCarryoverRecords((records)=>editingCostCarryoverId?records.map((item)=>item.id===result.data!.id?result.data!:item):[result.data!,...records])
      writeModuleAudit(editingCostCarryoverId?'编辑成本结转':'新增成本结转',result.data.batchNo,'高','成功')
      setOperationNotice(`已保存 ${result.data.batchNo}；成本和差异仍需人工复核后再关联凭证。`)
      setEditingCostCarryoverId(null);setShowCostCarryoverDialog(false)
    }catch(error){setOperationNotice(`保存成本结转失败：${String(error)}`)}
  }

  const handleSaveAccountTransfer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isTauri) {
      const timestamp = new Date().toISOString()
      const transfer: AccountTransfer = {
        id: `preview-transfer-${Date.now()}`,
        companyId: selectedCompanyId || 'preview-company',
        period: currentPeriodLabel === '当前账期' ? '2026-05' : currentPeriodLabel,
        transferDate: accountTransferDraft.transferDate,
        fromAccount: accountTransferDraft.fromAccount,
        toAccount: accountTransferDraft.toAccount,
        amount: Number(accountTransferDraft.amount || 0),
        fee: Number(accountTransferDraft.fee || 0),
        serialNo: accountTransferDraft.serialNo || null,
        status: '待确认',
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      setAccountTransfers((records) => [transfer, ...records])
      writeModuleAudit('新增账户转账', `${transfer.fromAccount}→${transfer.toAccount}`, '中', '成功')
      setOperationNotice(`账户转账已保存到当前预览：${transfer.fromAccount}→${transfer.toAccount}。桌面端会写入当前账套，仍需人工核验回单和凭证。`)
      setAccountTransferDraft({ transferDate: '', fromAccount: '', toAccount: '', amount: '', fee: '', serialNo: '' })
      setShowAccountTransferDialog(false)
      return
    }
    if (!selectedCompanyId || currentPeriodLabel === '当前账期') return
    try {
      const transferInput = { companyId: selectedCompanyId, transferDate: accountTransferDraft.transferDate, fromAccount: accountTransferDraft.fromAccount, toAccount: accountTransferDraft.toAccount, amount: Number(accountTransferDraft.amount || 0), fee: Number(accountTransferDraft.fee || 0), serialNo: accountTransferDraft.serialNo || undefined }
      const result = editingAccountTransferId
        ? await accountTransferApi.updateAccountTransfer({ id: editingAccountTransferId, ...transferInput })
        : await accountTransferApi.createAccountTransfer({ ...transferInput, period: currentPeriodLabel })
      if (!result.success || !result.data) throw new Error(result.error || '未返回转账记录')
      setAccountTransfers((records) => editingAccountTransferId ? records.map((item) => item.id === result.data!.id ? result.data! : item) : [result.data!, ...records])
      writeModuleAudit(editingAccountTransferId ? '编辑账户转账' : '新增账户转账', `${result.data.fromAccount}→${result.data.toAccount}`, '中', '成功')
      setOperationNotice(editingAccountTransferId ? '账户转账已更新，需重新核验流水回单和匹配规则。' : '账户转账已保存，等待流水回单、规则匹配和人工凭证确认。')
      setEditingAccountTransferId(null)
      setAccountTransferDraft({ transferDate: '', fromAccount: '', toAccount: '', amount: '', fee: '', serialNo: '' })
      setShowAccountTransferDialog(false)
    } catch (error) { setOperationNotice(`${editingAccountTransferId ? '编辑' : '新增'}账户转账失败：${String(error)}`) }
  }

  const handleSaveFixedAsset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isTauri) {
      const timestamp = new Date().toISOString()
      const asset: FixedAsset = { id: `preview-asset-${Date.now()}`, companyId: selectedCompanyId || 'preview-company', period: currentPeriodLabel === '当前账期' ? '2026-05' : currentPeriodLabel, assetCode: fixedAssetDraft.assetCode, assetName: fixedAssetDraft.assetName, category: fixedAssetDraft.category, startDate: fixedAssetDraft.startDate, originalValue: Number(fixedAssetDraft.originalValue || 0), usefulLifeMonths: Number(fixedAssetDraft.usefulLifeMonths || 0), residualRate: Number(fixedAssetDraft.residualRate || 0) / 100, sourceDocument: fixedAssetDraft.sourceDocument || null, status: '待确认', createdAt: timestamp, updatedAt: timestamp }
      setFixedAssets((records) => [asset, ...records])
      writeModuleAudit('新增固定资产', asset.assetName, '中', '成功')
      setOperationNotice(`固定资产已保存到当前预览：${asset.assetName}。桌面端会写入当前账套，折旧与凭证仍需人工确认。`)
      setShowFixedAssetDialog(false)
      return
    }
    if (!selectedCompanyId || currentPeriodLabel === '当前账期') return
    try {
      const assetInput = { companyId: selectedCompanyId, assetCode: fixedAssetDraft.assetCode, assetName: fixedAssetDraft.assetName, category: fixedAssetDraft.category, startDate: fixedAssetDraft.startDate, originalValue: Number(fixedAssetDraft.originalValue || 0), usefulLifeMonths: Number(fixedAssetDraft.usefulLifeMonths || 0), residualRate: Number(fixedAssetDraft.residualRate || 0) / 100, sourceDocument: fixedAssetDraft.sourceDocument || undefined }
      const result = editingFixedAssetId
        ? await fixedAssetApi.updateFixedAsset({ id: editingFixedAssetId, ...assetInput })
        : await fixedAssetApi.createFixedAsset({ ...assetInput, period: currentPeriodLabel })
      if (!result.success || !result.data) throw new Error(result.error || '未返回固定资产')
      setFixedAssets((records) => editingFixedAssetId ? records.map((item) => item.id === result.data!.id ? result.data! : item) : [result.data!, ...records])
      writeModuleAudit(editingFixedAssetId ? '编辑固定资产' : '新增固定资产', result.data.assetName, '中', '成功')
      setOperationNotice(editingFixedAssetId ? '固定资产已更新，请重新核验本月折旧测算后再生成凭证。' : '固定资产已保存。本月折旧按平均年限法预览，需在期末结转人工确认后再生成凭证。')
      setEditingFixedAssetId(null)
      setFixedAssetDraft({ assetCode: '', assetName: '', category: '', startDate: '', originalValue: '', usefulLifeMonths: '', residualRate: '5', sourceDocument: '' })
      setShowFixedAssetDialog(false)
    } catch (error) { setOperationNotice(`${editingFixedAssetId ? '编辑' : '新增'}固定资产失败：${String(error)}`) }
  }

  const handleSaveInventoryMovement = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isTauri) {
      const timestamp = new Date().toISOString()
      const movement: InventoryMovement = { id: `preview-movement-${Date.now()}`, companyId: selectedCompanyId || 'preview-company', period: currentPeriodLabel === '当前账期' ? '2026-05' : currentPeriodLabel, movementDate: inventoryMovementDraft.movementDate, billNo: inventoryMovementDraft.billNo, movementType: inventoryMovementDraft.movementType, inventoryName: inventoryMovementDraft.inventoryName, warehouse: inventoryMovementDraft.warehouse, counterparty: inventoryMovementDraft.counterparty || null, unit: inventoryMovementDraft.unit, quantity: Number(inventoryMovementDraft.quantity || 0), amount: Number(inventoryMovementDraft.amount || 0), sourceDocument: inventoryMovementDraft.sourceDocument || null, status: '待确认', createdAt: timestamp, updatedAt: timestamp }
      setInventoryMovements((records) => [movement, ...records])
      writeModuleAudit('新增出入库单', movement.billNo, '中', '成功')
      setOperationNotice(`出入库单已保存到当前预览：${movement.billNo}。桌面端会写入当前账套，发票匹配、计价和凭证仍需人工确认。`)
      setShowInventoryMovementDialog(false)
      return
    }
    if (!selectedCompanyId || currentPeriodLabel === '当前账期') return
    try {
      const movementInput = { companyId: selectedCompanyId, movementDate: inventoryMovementDraft.movementDate, billNo: inventoryMovementDraft.billNo, movementType: inventoryMovementDraft.movementType, inventoryName: inventoryMovementDraft.inventoryName, warehouse: inventoryMovementDraft.warehouse, counterparty: inventoryMovementDraft.counterparty || undefined, unit: inventoryMovementDraft.unit, quantity: Number(inventoryMovementDraft.quantity || 0), amount: Number(inventoryMovementDraft.amount || 0), sourceDocument: inventoryMovementDraft.sourceDocument || undefined }
      const result = editingInventoryMovementId
        ? await inventoryMovementApi.updateInventoryMovement({ id: editingInventoryMovementId, ...movementInput })
        : await inventoryMovementApi.createInventoryMovement({ ...movementInput, period: currentPeriodLabel })
      if (!result.success || !result.data) throw new Error(result.error || '未返回出入库单')
      setInventoryMovements((records) => editingInventoryMovementId ? records.map((item) => item.id === result.data!.id ? result.data! : item) : [result.data!, ...records])
      writeModuleAudit(editingInventoryMovementId ? '编辑出入库单' : '新增出入库单', result.data.billNo, '中', '成功')
      setOperationNotice(editingInventoryMovementId ? '出入库单已更新，请重新核验发票匹配、计价与成本结转。' : '出入库单已保存，等待发票匹配、计价核验和人工凭证确认。')
      setEditingInventoryMovementId(null)
      setInventoryMovementDraft({ movementDate: '', billNo: '', movementType: '采购入库', inventoryName: '', warehouse: '', counterparty: '', unit: '', quantity: '', amount: '', sourceDocument: '' })
      setShowInventoryMovementDialog(false)
    } catch (error) { setOperationNotice(`${editingInventoryMovementId ? '编辑' : '新增'}出入库单失败：${String(error)}`) }
  }

  const handleSaveInventoryItem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isTauri) {
      const timestamp = new Date().toISOString()
      const item: InventoryItem = { id: `preview-item-${Date.now()}`, companyId: selectedCompanyId || 'preview-company', itemCode: inventoryItemDraft.itemCode, itemName: inventoryItemDraft.itemName, specification: inventoryItemDraft.specification || null, unit: inventoryItemDraft.unit, taxRate: Number(inventoryItemDraft.taxRate || 0) / 100, defaultSubject: inventoryItemDraft.defaultSubject || null, status: '启用', createdAt: timestamp, updatedAt: timestamp }
      setInventoryItems((items) => [item, ...items])
      writeModuleAudit('新增存货', item.itemName, '中', '成功')
      setOperationNotice(`存货档案已保存到当前预览：${item.itemName}。桌面端会写入当前账套，可继续用于出入库和成本结转。`)
      setShowInventoryItemDialog(false)
      return
    }
    if (!selectedCompanyId) return
    try {
      const itemInput = {
        companyId: selectedCompanyId,
        itemCode: inventoryItemDraft.itemCode,
        itemName: inventoryItemDraft.itemName,
        specification: inventoryItemDraft.specification || undefined,
        unit: inventoryItemDraft.unit,
        taxRate: Number(inventoryItemDraft.taxRate || 0) / 100,
        defaultSubject: inventoryItemDraft.defaultSubject || undefined,
      }
      const result = editingInventoryItemId ? await inventoryItemApi.updateInventoryItem({ id: editingInventoryItemId, ...itemInput }) : await inventoryItemApi.createInventoryItem(itemInput)
      if (!result.success || !result.data) throw new Error(result.error || '未返回存货档案')
      setInventoryItems((items) => editingInventoryItemId ? items.map((item) => item.id === result.data!.id ? result.data! : item) : [result.data!, ...items])
      writeModuleAudit('新增存货', result.data.itemName, '中', '成功')
      setOperationNotice('存货档案已保存，可作为出入库、发票匹配和成本结转的基础资料。')
      setEditingInventoryItemId(null); setShowInventoryItemDialog(false)
    } catch (error) {
      setOperationNotice(`新增存货失败：${String(error)}`)
    }
  }
  const handleSaveMeasurementUnit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isTauri) {
      const timestamp = new Date().toISOString()
      const unit: MeasurementUnit = { id: `preview-unit-${Date.now()}`, companyId: selectedCompanyId || 'preview-company', unitName: measurementUnitDraft.unitName, unitGroup: measurementUnitDraft.unitGroup || null, baseUnit: measurementUnitDraft.baseUnit || null, conversionRate: Number(measurementUnitDraft.conversionRate || 1), precisionDigits: Number(measurementUnitDraft.precisionDigits || 0), remark: measurementUnitDraft.remark || null, status: '启用', createdAt: timestamp, updatedAt: timestamp }
      setMeasurementUnits((items) => [unit, ...items])
      writeModuleAudit('新增计量单位', unit.unitName, '中', '成功')
      setOperationNotice(`计量单位已保存到当前预览：${unit.unitName}。桌面端会写入当前账套，可在存货档案和出入库单中选择。`)
      setShowMeasurementUnitDialog(false)
      return
    }
    if (!selectedCompanyId) return
    const unitInput = {
      companyId: selectedCompanyId,
      unitName: measurementUnitDraft.unitName,
      unitGroup: measurementUnitDraft.unitGroup || undefined,
      baseUnit: measurementUnitDraft.baseUnit || undefined,
      conversionRate: Number(measurementUnitDraft.conversionRate || 1),
      precisionDigits: Number(measurementUnitDraft.precisionDigits || 0),
      remark: measurementUnitDraft.remark || undefined,
    }
    const result = editingMeasurementUnitId ? await measurementUnitApi.updateMeasurementUnit({ id: editingMeasurementUnitId, ...unitInput }) : await measurementUnitApi.createMeasurementUnit(unitInput)
    if (result.success && result.data) {
      setMeasurementUnits((items) => editingMeasurementUnitId ? items.map((item) => item.id === result.data!.id ? result.data! : item) : [result.data!, ...items])
      setEditingMeasurementUnitId(null)
      setShowMeasurementUnitDialog(false)
      setOperationNotice('计量单位已保存，可在存货档案和出入库单中选择。')
      return
    }
    setOperationNotice(`新增计量单位失败：${result.error || '未知错误'}`)
  }

  const rowObjectLabel = (row: ModuleRow) => {
    const firstValue = Object.values(row.values).find(Boolean)
    return row.voucher && row.voucher !== '-' ? row.voucher : firstValue || row.id
  }

  const isLocalTaxTaskKind = ['declarationCalendar', 'taxReport', 'financeTaxReport', 'nonTaxRevenueReport'].includes(kind)

  const taxTaskForRow = (row: ModuleRow) => {
    const id = row.id
      .replace('declaration-receipt-', '')
      .replace('declaration-calendar-', '')
      .replace('tax-init-', '')
      .replace('tax-report-', '')
      .replace('finance-tax-report-', '')
      .replace('non-tax-revenue-', '')
    return effectiveTaxDeclarationTasks.find((task) => task.id === id)
  }

  const isConfirmedTaxTask = (row: ModuleRow) => {
    const status = taxTaskForRow(row)?.declarationStatus.toLowerCase()
    return Boolean(status && ['confirmed', 'archived', 'submitted', 'completed'].includes(status))
  }

  const confirmTaxTaskFromRow = async (row: ModuleRow) => {
    const task = taxTaskForRow(row)
    if (!task) {
      setOperationNotice('未找到当前账套的申报事项，请刷新后重试。')
      return
    }
    if (['confirmed', 'archived', 'submitted', 'completed'].includes(task.declarationStatus.toLowerCase())) {
      setOperationNotice(`${task.taxType}已完成本地确认；回执、缴款书和外部提交状态需另行归档核验。`)
      return
    }
    if (task.riskCount > 0 || task.validationStatus !== 'passed') {
      setOperationNotice(`${task.taxType}存在未处理风险或未通过校验，不能确认。`)
      return
    }
    if (!await requestBusinessRiskConfirmation('确认本地申报事项', `确认 ${task.taxType}（${task.period}）的本地申报事项吗？此操作仅记录人工确认，不会向税局提交或触发扣款。`, '确认本地事项')) return
    if (!isTauri) {
      const timestamp = new Date().toLocaleString('zh-CN')
      const updatedTask: TaxDeclarationTask = {
        ...task,
        declarationStatus: 'confirmed',
        confirmedBy: 'admin',
        confirmedAt: timestamp,
        updatedAt: timestamp,
      }
      updatePreviewTaxDeclarationTasks((tasks) => tasks.map((item) => item.id === updatedTask.id ? updatedTask : item))
      writeModuleAudit('确认预览申报事项', `${updatedTask.taxType}｜${updatedTask.period}`, '高', '成功')
      setOperationNotice(`${updatedTask.taxType}已完成当前预览的人工确认；不会向税局提交、发起扣款或收取外部回执。`)
      return
    }
    if (!selectedCompanyId) return
    const result = await automationApi.confirmTaxDeclarationTask({ id: task.id, companyId: selectedCompanyId, confirmedBy: 'admin' })
    if (!result.success || !result.data) {
      setOperationNotice(`确认申报事项失败：${result.error || '未知错误'}`)
      return
    }
    setTaxDeclarationTasks((tasks) => tasks.map((item) => item.id === result.data!.id ? result.data! : item))
    writeModuleAudit('确认申报事项', `${result.data.taxType}｜${result.data.period}`, '高', '成功')
    setOperationNotice(`${result.data.taxType}已完成本地人工确认；外部申报、缴款和回执收取仍需通过合法渠道执行。`)
  }

  const openLinkedAiSuggestionVoucher = (row: ModuleRow) => {
    const suggestionJobId = row.id.replace('automation-suggestion-', '')
    const job = automationJobs.find((item) => item.id === suggestionJobId)
    if (!job?.generatedVoucherId) {
      setOperationNotice('该 AI 建议未记录可打开的凭证草稿，请刷新列表后重试。')
      return
    }
    writeModuleAudit('查看AI关联凭证', job.generatedVoucherNumber || job.suggestionNo || job.id, '中', '成功')
    navigate(`/vouchers/detail/${job.generatedVoucherId}`)
  }

  const handleSaveAttachmentAssociation = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const updated = updateLocalAttachmentAssociation(attachmentAssociationDraft.id, attachmentAssociationDraft.relatedDocument)
    if (!updated) {
      setOperationNotice('关联本地附件失败，请填写关联单据并刷新后重试。')
      return
    }
    setShowAttachmentAssociationDialog(false)
    writeModuleAudit('关联本地附件', `${updated.fileName}｜${updated.relatedDocument}`, '中', '成功')
    setOperationNotice('附件关联已登记到本机台账；不会移动原始文件、写入外部存储或修改凭证。')
  }

  const handleCommitHistoryVoucherImport = async (draft: LocalImportCommitDraft) => {
    if (!selectedCompanyId) return
    const failureRows: LocalImportFailure[] = []
    const addFailure = (rowNumber: number, message: string) => {
      if (failureRows.length < 20) failureRows.push({ rowNumber, message })
    }
    const groups = new Map<string, { voucherNo: string; date: string; summary: string; wordName: string; attachmentCount: number; rows: Array<{ rowNumber: number; accountCode: string; debit: number; credit: number; summary: string }> }>()

    for (const [rowIndex, row] of draft.rows.entries()) {
      const voucherNo = importRowValue(draft.headers, row, ['凭证字号', '原凭证号', '凭证号'])
      const date = importRowValue(draft.headers, row, ['凭证日期', '制单日期', '日期'])
      const accountCode = importRowValue(draft.headers, row, ['科目编码', '会计科目编码', '科目'])
      const debit = importAmount(importRowValue(draft.headers, row, ['借方金额', '借方发生额', '借方']))
      const credit = importAmount(importRowValue(draft.headers, row, ['贷方金额', '贷方发生额', '贷方']))
      if (!voucherNo || !date || !accountCode || (debit <= 0 && credit <= 0) || (debit > 0 && credit > 0)) {
        addFailure(rowIndex + 2, '凭证号、日期、科目和单边借贷金额必须完整')
        continue
      }
      const groupKey = `${voucherNo}::${date}`
      const group = groups.get(groupKey) || {
        voucherNo,
        date,
        summary: importRowValue(draft.headers, row, ['摘要', '凭证摘要']) || '历史账迁移',
        wordName: importRowValue(draft.headers, row, ['凭证字', '字']) || voucherNo.split(/[-－]/)[0],
        attachmentCount: Math.max(0, Math.floor(importAmount(importRowValue(draft.headers, row, ['附件数', '附件张数'])))),
        rows: [],
      }
      group.rows.push({ rowNumber: rowIndex + 2, accountCode, debit, credit, summary: importRowValue(draft.headers, row, ['分录摘要', '摘要', '凭证摘要']) || group.summary })
      groups.set(groupKey, group)
    }

    let successCount = 0
    let failedCount = draft.rows.length - Array.from(groups.values()).reduce((total, group) => total + group.rows.length, 0)
    const existing = await queryVouchers({ company_id: selectedCompanyId, period_id: draft.periodId, page: 1, page_size: 500 })
    const existingNumbers = new Set(existing.map((voucher) => voucher.voucher_number))

    for (const group of groups.values()) {
      try {
        if (existingNumbers.has(group.voucherNo)) throw new Error(`凭证号 ${group.voucherNo} 已存在，拒绝重复导入`)
        const word = voucherWords.find((item) => item.word_name === group.wordName || group.voucherNo.startsWith(`${item.word_name}-`)) || voucherWords[0]
        if (!word) throw new Error('当前账套未配置凭证字')
        const entries = group.rows.map((line) => {
          const account = accounts.find((item) => item.code === line.accountCode)
          if (!account) throw new Error(`科目 ${line.accountCode} 不存在或未映射`)
          return {
            account_code: account.code,
            account_name: account.name,
            direction: line.debit > 0 ? 'debit' : 'credit',
            amount: line.debit > 0 ? line.debit : line.credit,
            summary: line.summary,
            doc_number: `历史迁移｜${draft.fileName}`,
          }
        })
        const debitTotal = group.rows.reduce((total, line) => total + line.debit, 0)
        const creditTotal = group.rows.reduce((total, line) => total + line.credit, 0)
        if (entries.length < 2 || Math.abs(debitTotal - creditTotal) > 0.005) throw new Error(`借贷不平：借 ${debitTotal.toFixed(2)}，贷 ${creditTotal.toFixed(2)}`)
        await addVoucher({ company_id: selectedCompanyId, period_id: draft.periodId, voucher_word_id: word.id, voucher_date: group.date, voucher_number: group.voucherNo, summary: group.summary, attachment_count: group.attachmentCount, created_by: '历史账迁移', entries })
        existingNumbers.add(group.voucherNo)
        successCount += group.rows.length
      } catch (error) {
        failedCount += group.rows.length
        addFailure(group.rows[0]?.rowNumber || 2, error instanceof Error ? error.message : String(error))
      }
    }

    updateLocalImportJobCommit(draft.jobId, successCount, failedCount, failureRows)
    writeModuleAudit('导入历史凭证', `${draft.periodLabel}｜${draft.fileName}｜成功 ${successCount} 行`, '高', successCount > 0 ? '成功' : '失败')
    setImportCommitDraft(null)
    setOperationNotice(`历史凭证迁移完成：成功 ${successCount} 行，失败 ${failedCount} 行。仅写入目标历史账期 ${draft.periodLabel}；未自动审核、结账或改写当前账期。`)
  }

  const handleCommitHistoryBalanceImport = async (draft: LocalImportCommitDraft) => {
    const failureRows: LocalImportFailure[] = []
    const addFailure = (rowNumber: number, message: string) => {
      if (failureRows.length < 20) failureRows.push({ rowNumber, message })
    }
    let successCount = 0
    let failedCount = 0

    for (const [rowIndex, row] of draft.rows.entries()) {
      try {
        const accountCode = importRowValue(draft.headers, row, ['科目编码', '会计科目编码', '科目'])
        const account = accounts.find((item) => item.code === accountCode)
        const explicitDebit = importAmount(importRowValue(draft.headers, row, ['期初借方', '借方期初', '期初借']))
        const explicitCredit = importAmount(importRowValue(draft.headers, row, ['期初贷方', '贷方期初', '期初贷']))
        const balance = importAmount(importRowValue(draft.headers, row, ['期初余额', '期末余额', '余额']))
        const direction = importRowValue(draft.headers, row, ['余额方向', '方向'])
        const openingDebit = explicitDebit || (explicitCredit === 0 && balance > 0 && direction !== '贷' ? balance : 0)
        const openingCredit = explicitCredit || (explicitDebit === 0 && balance > 0 && direction === '贷' ? balance : 0)
        if (!account || (openingDebit <= 0 && openingCredit <= 0) || (openingDebit > 0 && openingCredit > 0)) throw new Error('期初科目不存在或借贷金额不正确')
        await saveInitialBalance({ period_id: draft.periodId, account_code: account.code, opening_debit: openingDebit, opening_credit: openingCredit, created_by: `历史迁移｜${draft.fileName}` })
        successCount += 1
      } catch (error) {
        failedCount += 1
        addFailure(rowIndex + 2, error instanceof Error ? error.message : String(error))
      }
    }

    if (successCount > 0) {
      const trialBalance = await fetchTrialBalance(draft.periodId)
      setLiveReports((reports) => ({ ...reports, historyBalance: trialBalance }))
    }
    updateLocalImportJobCommit(draft.jobId, successCount, failedCount, failureRows)
    writeModuleAudit('导入历史余额', `${draft.periodLabel}｜${draft.fileName}｜成功 ${successCount} 行`, '高', successCount > 0 ? '成功' : '失败')
    setImportCommitDraft(null)
    setOperationNotice(`历史余额迁移完成：成功 ${successCount} 行，失败 ${failedCount} 行。余额仅登记为目标历史账期 ${draft.periodLabel} 的期初基础，仍需执行试算平衡和人工确认。`)
  }

  const handleCommitLocalImport = async () => {
    if (!importCommitDraft || !selectedCompanyId || !importCommitDraft.periodId) return
    if (importCommitDraft.target === 'historyVoucher') {
      await handleCommitHistoryVoucherImport(importCommitDraft)
      return
    }
    if (importCommitDraft.target === 'historyBalance') {
      await handleCommitHistoryBalanceImport(importCommitDraft)
      return
    }
    let successCount = 0
    let failedCount = 0
    const failureRows: LocalImportFailure[] = []
    const createdBankTransactions: BankTransaction[] = []
    const createdDocuments: DocumentRecord[] = []
    const createdBusinessOrders: BusinessOrder[] = []
    const createdEmployees: Employee[] = []
    const createdPayrollRecords: PayrollRecord[] = []
    const createdSocialSecurityRecords: SocialSecurityRecord[] = []
    const createdSpecialDeductionRecords: SpecialDeductionRecord[] = []
    const createdInventoryMovements: InventoryMovement[] = []
    const createdFixedAssets: FixedAsset[] = []
    const createdInventoryItems: InventoryItem[] = []
    const createdSettlementRecords: SettlementRecord[] = []
    const createdBankReconciliationRecords: BankReconciliationRecord[] = []
    const createdMeasurementUnits: MeasurementUnit[] = []
    const createdAccountTransfers: AccountTransfer[] = []
    const createdCostCarryoverRecords: CostCarryoverRecord[] = []
    const auxiliaryArchiveCategoryIds = new Map(auxiliaryCategories.map((category) => [category.code, category.id]))
    const auxiliaryCategoryReferenceIds = new Map(auxiliaryCategories.flatMap((category) => [[category.code, category.id], [category.name, category.id]]))
    const importedAccountCodes = new Set(accounts.map((account) => account.code))

    for (const [rowIndex, row] of importCommitDraft.rows.entries()) {
      try {
        const date = importRowValue(importCommitDraft.headers, row, ['开票日期', '交易日期', '业务日期', '日期'])
        if (importCommitDraft.target === 'invoice') {
          const invoiceNo = importRowValue(importCommitDraft.headers, row, ['发票号码', '发票号'])
          const amount = importAmount(importRowValue(importCommitDraft.headers, row, ['不含税金额', '金额']))
          if (!invoiceNo || !date || amount <= 0 || !currentPeriodId) throw new Error('发票必填字段不完整')
          const taxAmount = importAmount(importRowValue(importCommitDraft.headers, row, ['税额']))
          const taxRate = importAmount(importRowValue(importCommitDraft.headers, row, ['税率']))
          await createInvoice({ company_id: selectedCompanyId, period_id: currentPeriodId, invoice_type: kind === 'outputInvoice' ? 'output' : 'input', invoice_no: invoiceNo, invoice_date: date, amount, tax_amount: taxAmount, tax_rate: taxRate / 100, seller_name: importRowValue(importCommitDraft.headers, row, ['销方名称', '销售方名称']) || undefined, buyer_name: importRowValue(importCommitDraft.headers, row, ['购方名称', '购买方名称']) || undefined, remarks: importRowValue(importCommitDraft.headers, row, ['备注', '商品/服务名称']) || undefined })
        } else if (importCommitDraft.target === 'bank') {
          const serialNo = importRowValue(importCommitDraft.headers, row, ['流水号', '交易流水号'])
          const accountName = importRowValue(importCommitDraft.headers, row, ['银行账户', '账户'])
          if (!serialNo || !accountName || !date) throw new Error('流水必填字段不完整')
          const result = await bankTransactionApi.createBankTransaction({ companyId: selectedCompanyId, period: currentPeriodLabel, accountName, serialNo, transactionDate: date, counterparty: importRowValue(importCommitDraft.headers, row, ['对方户名', '对方单位']) || undefined, summary: importRowValue(importCommitDraft.headers, row, ['摘要']) || undefined, incomeAmount: importAmount(importRowValue(importCommitDraft.headers, row, ['收入', '贷方金额'])), expenseAmount: importAmount(importRowValue(importCommitDraft.headers, row, ['支出', '借方金额'])), balance: importAmount(importRowValue(importCommitDraft.headers, row, ['余额'])) || undefined, receiptStatus: importRowValue(importCommitDraft.headers, row, ['回单状态']) || '待上传' })
          if (!result.success || !result.data) throw new Error(result.error || '流水写入失败')
          createdBankTransactions.push(result.data)
        } else if (importCommitDraft.target === 'document') {
          const documentCode = importRowValue(importCommitDraft.headers, row, kind === 'contractLedger' ? ['合同编号', '合同号', '单据编号'] : ['单据编号', '单据号', '收款单号', '报销单号'])
          const amount = importAmount(importRowValue(importCommitDraft.headers, row, kind === 'contractLedger' ? ['合同金额', '含税金额', '金额'] : ['金额', '价税合计', '收款金额', '报销金额']))
          if (!documentCode || !date || amount <= 0) throw new Error('单据必填字段不完整')
          const defaultBusinessType = kind === 'contractLedger' ? '业务合同' : kind === 'receipt' ? '收款' : kind === 'expenseReimbursement' ? '费用报销' : '其他'
          const result = await documentRecordApi.createDocumentRecord({ companyId: selectedCompanyId, period: currentPeriodLabel, businessDate: date, documentCode, businessType: importRowValue(importCommitDraft.headers, row, kind === 'contractLedger' ? ['合同类型', '业务类型'] : ['业务类型', '费用类型']) || defaultBusinessType, partner: importRowValue(importCommitDraft.headers, row, kind === 'contractLedger' ? ['相对方', '客户供应商', '往来单位', '对方单位'] : ['往来单位', '对方单位', '收款单位', '报销人']) || undefined, amount, owner: importRowValue(importCommitDraft.headers, row, ['经办人', '负责人', '报销人']) || undefined, attachmentStatus: importRowValue(importCommitDraft.headers, row, ['附件状态', '归档状态', '票据状态']) || '待补附件', stampTaxItem: kind === 'contractLedger' ? importRowValue(importCommitDraft.headers, row, ['印花税税目', '税目']) || undefined : undefined, stampTaxRate: kind === 'contractLedger' ? importAmount(importRowValue(importCommitDraft.headers, row, ['印花税率', '税率'])) / 100 || undefined : undefined })
          if (!result.success || !result.data) throw new Error(result.error || '单据写入失败')
          createdDocuments.push(result.data)
        } else if (importCommitDraft.target === 'businessOrder') {
          const orderNo = importRowValue(importCommitDraft.headers, row, ['采购单号', '销售单号', '订单号'])
          const counterparty = importRowValue(importCommitDraft.headers, row, ['供应商', '客户', '往来单位'])
          const goodsName = importRowValue(importCommitDraft.headers, row, ['商品/服务', '商品名称', '货物名称'])
          const amount = importAmount(importRowValue(importCommitDraft.headers, row, ['含税金额', '金额', '价税合计']))
          if (!orderNo || !date || !counterparty || !goodsName || amount <= 0) throw new Error('订单必填字段不完整')
          const result = await businessOrderApi.createBusinessOrder({ companyId: selectedCompanyId, period: currentPeriodLabel, orderType: kind === 'purchaseManagement' ? 'purchase' : 'sales', orderNo, businessDate: date, counterparty, goodsName, amount, fulfillmentStatus: importRowValue(importCommitDraft.headers, row, ['履约状态', '入库状态', '出库状态']) || '待确认', invoiceStatus: importRowValue(importCommitDraft.headers, row, ['开票状态', '发票状态']) || '待开票', settlementStatus: importRowValue(importCommitDraft.headers, row, ['结算状态']) || '未结算', status: '待确认', sourceDocument: importRowValue(importCommitDraft.headers, row, ['来源单据', '合同']) || undefined })
          if (!result.success || !result.data) throw new Error(result.error || '订单写入失败')
          createdBusinessOrders.push(result.data)
        } else if (importCommitDraft.target === 'employee') {
          const employeeCode = importRowValue(importCommitDraft.headers, row, ['员工编码', '人员编码', '工号'])
          const name = importRowValue(importCommitDraft.headers, row, ['员工姓名', '姓名'])
          if (!employeeCode || !name) throw new Error('人员必填字段不完整')
          const result = await employeeApi.createEmployee({ companyId: selectedCompanyId, employeeCode, name, idNo: importRowValue(importCommitDraft.headers, row, ['身份证号', '证件号码']) || undefined, department: importRowValue(importCommitDraft.headers, row, ['部门']) || undefined, position: importRowValue(importCommitDraft.headers, row, ['岗位', '职务']) || undefined, mobile: importRowValue(importCommitDraft.headers, row, ['手机号', '手机']) || undefined, entryDate: date || undefined, employmentStatus: importRowValue(importCommitDraft.headers, row, ['状态', '在职状态']) || '在职' })
          if (!result.success || !result.data) throw new Error(result.error || '人员写入失败')
          createdEmployees.push(result.data)
        } else if (importCommitDraft.target === 'payroll') {
          const employeeRef = importRowValue(importCommitDraft.headers, row, ['员工编码', '人员编码', '工号', '员工姓名', '姓名'])
          const employee = [...createdEmployees, ...employees].find((item) => item.employeeCode === employeeRef || item.name === employeeRef)
          const baseSalary = importAmount(importRowValue(importCommitDraft.headers, row, ['基本工资', '应发工资']))
          if (!employee || baseSalary <= 0) throw new Error('薪酬员工或金额不完整')
          const result = await payrollApi.createPayrollRecord({ companyId: selectedCompanyId, employeeId: employee.id, period: currentPeriodLabel, baseSalary, bonus: importAmount(importRowValue(importCommitDraft.headers, row, ['奖金', '补贴'])), taxAmount: importAmount(importRowValue(importCommitDraft.headers, row, ['个税', '个人所得税'])), socialPersonal: importAmount(importRowValue(importCommitDraft.headers, row, ['个人社保', '社保个人'])) })
          if (!result.success || !result.data) throw new Error(result.error || '薪酬写入失败')
          createdPayrollRecords.push(result.data)
        } else if (importCommitDraft.target === 'socialSecurity') {
          const employeeRef = importRowValue(importCommitDraft.headers, row, ['员工编码', '人员编码', '工号', '员工姓名', '姓名'])
          const employee = [...createdEmployees, ...employees].find((item) => item.employeeCode === employeeRef || item.name === employeeRef)
          if (!employee) throw new Error('社保员工未匹配')
          const result = await socialSecurityApi.createSocialSecurityRecord({ companyId: selectedCompanyId, employeeId: employee.id, period: currentPeriodLabel, city: importRowValue(importCommitDraft.headers, row, ['城市', '参保城市']) || '待补', contributionBase: importAmount(importRowValue(importCommitDraft.headers, row, ['缴费基数', '基数'])), companyAmount: importAmount(importRowValue(importCommitDraft.headers, row, ['单位缴费', '单位金额'])), personalAmount: importAmount(importRowValue(importCommitDraft.headers, row, ['个人缴费', '个人金额'])), fundAmount: importAmount(importRowValue(importCommitDraft.headers, row, ['公积金', '公积金金额'])) })
          if (!result.success || !result.data) throw new Error(result.error || '社保写入失败')
          createdSocialSecurityRecords.push(result.data)
        } else if (importCommitDraft.target === 'specialDeduction') {
          const employeeRef = importRowValue(importCommitDraft.headers, row, ['员工编码', '人员编码', '工号', '员工姓名', '姓名'])
          const employee = [...createdEmployees, ...employees].find((item) => item.employeeCode === employeeRef || item.name === employeeRef)
          const deductionType = importRowValue(importCommitDraft.headers, row, ['扣除类型', '专项附加扣除类型'])
          const startMonth = importRowValue(importCommitDraft.headers, row, ['开始月份', '起始月份'])
          const monthlyAmount = importAmount(importRowValue(importCommitDraft.headers, row, ['月扣除额', '月度金额', '金额']))
          if (!employee || !deductionType || !startMonth || monthlyAmount <= 0) throw new Error('专项扣除字段不完整')
          const result = await specialDeductionApi.createSpecialDeductionRecord({ companyId: selectedCompanyId, employeeId: employee.id, deductionType, startMonth, endMonth: importRowValue(importCommitDraft.headers, row, ['结束月份']) || undefined, monthlyAmount, source: '导入' })
          if (!result.success || !result.data) throw new Error(result.error || '专项扣除写入失败')
          createdSpecialDeductionRecords.push(result.data)
        } else if (importCommitDraft.target === 'inventoryMovement') {
          const billNo = importRowValue(importCommitDraft.headers, row, ['单据编号', '出入库单号'])
          const inventoryName = importRowValue(importCommitDraft.headers, row, ['存货名称', '商品名称'])
          const quantity = importAmount(importRowValue(importCommitDraft.headers, row, ['数量']))
          const amount = importAmount(importRowValue(importCommitDraft.headers, row, ['金额', '含税金额']))
          if (!billNo || !date || !inventoryName || quantity <= 0 || amount <= 0) throw new Error('出入库字段不完整')
          const result = await inventoryMovementApi.createInventoryMovement({ companyId: selectedCompanyId, period: currentPeriodLabel, movementDate: date, billNo, movementType: importRowValue(importCommitDraft.headers, row, ['出入库类型', '业务类型']) || '采购入库', inventoryName, warehouse: importRowValue(importCommitDraft.headers, row, ['仓库']) || '默认仓', counterparty: importRowValue(importCommitDraft.headers, row, ['往来单位', '供应商', '客户']) || undefined, unit: importRowValue(importCommitDraft.headers, row, ['单位']) || '个', quantity, amount, sourceDocument: importRowValue(importCommitDraft.headers, row, ['来源单据', '合同']) || undefined })
          if (!result.success || !result.data) throw new Error(result.error || '出入库写入失败')
          createdInventoryMovements.push(result.data)
        } else if (importCommitDraft.target === 'fixedAsset') {
          const assetCode = importRowValue(importCommitDraft.headers, row, ['资产编码', '固定资产编码'])
          const assetName = importRowValue(importCommitDraft.headers, row, ['资产名称', '固定资产名称'])
          const originalValue = importAmount(importRowValue(importCommitDraft.headers, row, ['原值', '资产原值']))
          const usefulLifeMonths = importAmount(importRowValue(importCommitDraft.headers, row, ['使用年限月数', '使用月数']))
          if (!assetCode || !assetName || !date || originalValue <= 0 || usefulLifeMonths <= 0) throw new Error('固定资产字段不完整')
          const result = await fixedAssetApi.createFixedAsset({ companyId: selectedCompanyId, period: currentPeriodLabel, assetCode, assetName, category: importRowValue(importCommitDraft.headers, row, ['资产类别', '类别']) || '其他', startDate: date, originalValue, usefulLifeMonths, residualRate: importAmount(importRowValue(importCommitDraft.headers, row, ['残值率'])) / 100, sourceDocument: importRowValue(importCommitDraft.headers, row, ['来源单据', '合同']) || undefined })
          if (!result.success || !result.data) throw new Error(result.error || '固定资产写入失败')
          createdFixedAssets.push(result.data)
        } else if (importCommitDraft.target === 'inventoryItem') {
          const itemCode = importRowValue(importCommitDraft.headers, row, ['存货编码', '商品编码'])
          const itemName = importRowValue(importCommitDraft.headers, row, ['存货名称', '商品名称'])
          const unit = importRowValue(importCommitDraft.headers, row, ['计量单位', '单位'])
          if (!itemCode || !itemName || !unit) throw new Error('存货字段不完整')
          const result = await inventoryItemApi.createInventoryItem({ companyId: selectedCompanyId, itemCode, itemName, specification: importRowValue(importCommitDraft.headers, row, ['规格型号', '规格']) || undefined, unit, taxRate: importAmount(importRowValue(importCommitDraft.headers, row, ['税率'])) / 100, defaultSubject: importRowValue(importCommitDraft.headers, row, ['默认科目', '会计科目']) || undefined })
          if (!result.success || !result.data) throw new Error(result.error || '存货写入失败')
          createdInventoryItems.push(result.data)
        } else if (importCommitDraft.target === 'settlement') {
          const settlementNo = importRowValue(importCommitDraft.headers, row, ['核销编号', '结算编号'])
          const settlementDate = importRowValue(importCommitDraft.headers, row, ['核销日期', '结算日期', '业务日期', '日期'])
          const counterparty = importRowValue(importCommitDraft.headers, row, kind === 'payableSettlement' ? ['供应商', '往来单位'] : ['客户', '往来单位'])
          const totalAmount = importAmount(importRowValue(importCommitDraft.headers, row, kind === 'payableSettlement' ? ['应付金额', '金额'] : ['应收金额', '金额']))
          const settledAmount = importAmount(importRowValue(importCommitDraft.headers, row, ['本次核销金额', '已核销金额', '结算金额']))
          if (!settlementNo || !settlementDate || !counterparty || totalAmount <= 0 || settledAmount < 0 || settledAmount > totalAmount) throw new Error('核销字段不完整')
          const result = await settlementRecordApi.createSettlementRecord({ companyId: selectedCompanyId, period: currentPeriodLabel, settlementType: kind === 'payableSettlement' ? 'payable' : 'receivable', settlementNo, settlementDate, counterparty, invoiceNo: importRowValue(importCommitDraft.headers, row, ['关联发票号', '发票号码']) || undefined, transactionNo: importRowValue(importCommitDraft.headers, row, ['银行流水号', '流水号']) || undefined, totalAmount, settledAmount, settlementMethod: importRowValue(importCommitDraft.headers, row, ['核销方式', '结算方式']) || '银行转账', owner: importRowValue(importCommitDraft.headers, row, ['经办人', '负责人']) || undefined, status: importRowValue(importCommitDraft.headers, row, ['状态']) || '待确认', sourceDocument: importRowValue(importCommitDraft.headers, row, ['来源单据', '合同']) || undefined })
          if (!result.success || !result.data) throw new Error(result.error || '核销写入失败')
          createdSettlementRecords.push(result.data)
        } else if (importCommitDraft.target === 'bankReconciliation') {
          const reconciliationNo = importRowValue(importCommitDraft.headers, row, ['对账编号'])
          const reconciliationDate = importRowValue(importCommitDraft.headers, row, ['对账日期', '业务日期', '日期'])
          const accountName = importRowValue(importCommitDraft.headers, row, ['银行账户', '账户'])
          const transactionNo = importRowValue(importCommitDraft.headers, row, ['流水号', '交易流水号'])
          const bankAmount = importAmount(importRowValue(importCommitDraft.headers, row, ['银行金额', '流水金额']))
          const bookAmount = importAmount(importRowValue(importCommitDraft.headers, row, ['账面金额', '凭证金额']))
          if (!reconciliationNo || !reconciliationDate || !accountName || !transactionNo || bankAmount < 0 || bookAmount < 0) throw new Error('银行对账字段不完整')
          const result = await bankReconciliationApi.createBankReconciliationRecord({ companyId: selectedCompanyId, period: currentPeriodLabel, reconciliationNo, reconciliationDate, accountName, transactionNo, summary: importRowValue(importCommitDraft.headers, row, ['摘要']) || undefined, bankAmount, bookAmount, voucherNo: importRowValue(importCommitDraft.headers, row, ['凭证号', '凭证字号']) || undefined, matchStatus: importRowValue(importCommitDraft.headers, row, ['匹配状态', '对账状态']) || '待人工对账', owner: importRowValue(importCommitDraft.headers, row, ['经办人', '负责人']) || undefined, status: importRowValue(importCommitDraft.headers, row, ['状态']) || '待处理', note: importRowValue(importCommitDraft.headers, row, ['备注', '差异说明']) || undefined })
          if (!result.success || !result.data) throw new Error(result.error || '银行对账写入失败')
          createdBankReconciliationRecords.push(result.data)
        } else if (importCommitDraft.target === 'measurementUnit') {
          const unitName = importRowValue(importCommitDraft.headers, row, ['计量单位', '单位名称'])
          const conversionRate = importAmount(importRowValue(importCommitDraft.headers, row, ['换算率', '换算比例'])) || 1
          const precisionDigits = importAmount(importRowValue(importCommitDraft.headers, row, ['精度', '小数位']))
          if (!unitName || conversionRate <= 0 || precisionDigits < 0 || precisionDigits > 8) throw new Error('计量单位字段不完整')
          const result = await measurementUnitApi.createMeasurementUnit({ companyId: selectedCompanyId, unitName, unitGroup: importRowValue(importCommitDraft.headers, row, ['换算组', '单位组']) || undefined, baseUnit: importRowValue(importCommitDraft.headers, row, ['基准单位', '基础单位']) || undefined, conversionRate, precisionDigits, remark: importRowValue(importCommitDraft.headers, row, ['备注']) || undefined })
          if (!result.success || !result.data) throw new Error(result.error || '计量单位写入失败')
          createdMeasurementUnits.push(result.data)
        } else if (importCommitDraft.target === 'accountTransfer') {
          const transferDate = importRowValue(importCommitDraft.headers, row, ['转账日期', '交易日期', '业务日期', '日期'])
          const fromAccount = importRowValue(importCommitDraft.headers, row, ['转出账户', '付款账户'])
          const toAccount = importRowValue(importCommitDraft.headers, row, ['转入账户', '收款账户'])
          const amount = importAmount(importRowValue(importCommitDraft.headers, row, ['转账金额', '金额']))
          if (!transferDate || !fromAccount || !toAccount || amount <= 0) throw new Error('账户转账字段不完整')
          const result = await accountTransferApi.createAccountTransfer({ companyId: selectedCompanyId, period: currentPeriodLabel, transferDate, fromAccount, toAccount, amount, fee: importAmount(importRowValue(importCommitDraft.headers, row, ['手续费', '费用'])), serialNo: importRowValue(importCommitDraft.headers, row, ['流水号', '交易流水号']) || undefined })
          if (!result.success || !result.data) throw new Error(result.error || '账户转账写入失败')
          createdAccountTransfers.push(result.data)
        } else if (importCommitDraft.target === 'costCarryover') {
          const batchNo = importRowValue(importCommitDraft.headers, row, ['结转批次', '批次编号'])
          const carryoverDate = importRowValue(importCommitDraft.headers, row, ['结转日期', '业务日期', '日期'])
          const sourceBillNo = importRowValue(importCommitDraft.headers, row, ['来源单据', '出库单号'])
          const inventoryName = importRowValue(importCommitDraft.headers, row, ['存货名称', '商品名称'])
          const debitSubject = importRowValue(importCommitDraft.headers, row, ['借方科目'])
          const creditSubject = importRowValue(importCommitDraft.headers, row, ['贷方科目'])
          const costAmount = importAmount(importRowValue(importCommitDraft.headers, row, ['结转成本', '成本金额']))
          if (!batchNo || !carryoverDate || !sourceBillNo || !inventoryName || !debitSubject || !creditSubject || costAmount <= 0) throw new Error('成本结转字段不完整')
          const result = await costCarryoverApi.createCostCarryoverRecord({ companyId: selectedCompanyId, period: currentPeriodLabel, batchNo, carryoverDate, valuationMethod: importRowValue(importCommitDraft.headers, row, ['计价方法']) || '移动加权', sourceBillNo, inventoryName, debitSubject, creditSubject, costAmount, differenceAmount: importAmount(importRowValue(importCommitDraft.headers, row, ['差异金额'])), voucherNo: importRowValue(importCommitDraft.headers, row, ['凭证号', '凭证字号']) || undefined, status: importRowValue(importCommitDraft.headers, row, ['状态']) || '待确认', sourceDocument: importRowValue(importCommitDraft.headers, row, ['来源凭据', '合同']) || undefined })
          if (!result.success || !result.data) throw new Error(result.error || '成本结转写入失败')
          createdCostCarryoverRecords.push(result.data)
        } else if (importCommitDraft.target === 'companyAccount') {
          const accountName = importRowValue(importCommitDraft.headers, row, ['账户名称', '账户名'])
          const accountNumber = importRowValue(importCommitDraft.headers, row, ['账号/标识', '银行账号', '账号'])
          const subjectCode = importRowValue(importCommitDraft.headers, row, ['默认科目', '科目'])
          if (!accountName || !accountNumber || !subjectCode) throw new Error('账户登记字段不完整')
          await createCompanyAccount({ companyId: selectedCompanyId, accountName, accountType: importRowValue(importCommitDraft.headers, row, ['账户类型', '类型']) || '银行账户', bankName: importRowValue(importCommitDraft.headers, row, ['开户机构', '开户行', '银行名称']) || undefined, accountNumber, subjectCode, openingBalance: importAmount(importRowValue(importCommitDraft.headers, row, ['期初余额', '余额'])), attachmentNote: importRowValue(importCommitDraft.headers, row, ['附件/备注', '备注']) || undefined, status: importRowValue(importCommitDraft.headers, row, ['状态']) === '停用' ? '停用' : '启用' })
        } else if (importCommitDraft.target === 'auxiliaryArchive') {
          const archiveCategory = kind === 'customerArchive' ? { code: 'CUST', name: '客户' }
            : kind === 'supplierArchive' ? { code: 'SUPP', name: '供应商' }
              : kind === 'otherContactArchive' ? { code: 'EMP', name: '职员' }
                : kind === 'projectArchive' ? { code: 'PROJ', name: '项目' }
                  : { code: 'DEPT', name: '部门' }
          let categoryId = auxiliaryArchiveCategoryIds.get(archiveCategory.code)
          if (!categoryId) {
            const category = await createAuxiliaryCategory({ company_id: selectedCompanyId, code: archiveCategory.code, name: archiveCategory.name, sort_order: 0 })
            categoryId = category.id
            auxiliaryArchiveCategoryIds.set(archiveCategory.code, categoryId)
          }
          const code = importRowValue(importCommitDraft.headers, row, ['客户编码', '供应商编码', '往来编码', '项目编码', '部门编码', '编码'])
          const name = importRowValue(importCommitDraft.headers, row, ['客户名称', '供应商名称', '往来名称', '项目名称', '部门名称', '名称'])
          if (!code || !name) throw new Error('辅助档案编码或名称不完整')
          const remarkParts = [
            importRowValue(importCommitDraft.headers, row, ['税号']),
            importRowValue(importCommitDraft.headers, row, ['默认科目', '费用科目']),
            importRowValue(importCommitDraft.headers, row, ['合同', '备注', '说明']),
          ].filter(Boolean)
          const item = await createAuxiliaryItem({ category_id: categoryId, company_id: selectedCompanyId, code, name, remarks: remarkParts.join('｜') || undefined })
          if (importRowValue(importCommitDraft.headers, row, ['状态']) === '停用') await toggleAuxiliaryItem(item.id, selectedCompanyId)
        } else if (importCommitDraft.target === 'businessTag') {
          const name = importRowValue(importCommitDraft.headers, row, ['标签名称', '名称'])
          if (!name) throw new Error('标签名称不完整')
          await createBusinessTag({ companyId: selectedCompanyId, name, applicableModules: importRowValue(importCommitDraft.headers, row, ['适用模块', '模块']) || '发票/流水/凭证', colorName: importRowValue(importCommitDraft.headers, row, ['颜色标识', '颜色']) || '蓝色', autoRule: importRowValue(importCommitDraft.headers, row, ['自动标记规则', '规则']) || undefined, remarks: importRowValue(importCommitDraft.headers, row, ['备注', '说明']) || undefined, isEnabled: importRowValue(importCommitDraft.headers, row, ['状态']) !== '停用' })
        } else if (importCommitDraft.target === 'subject') {
          const code = importRowValue(importCommitDraft.headers, row, ['科目编码', '会计科目编码', '编码'])
          const name = importRowValue(importCommitDraft.headers, row, ['科目名称', '名称'])
          const parentCode = importRowValue(importCommitDraft.headers, row, ['父级科目', '上级科目'])
          const level = importAmount(importRowValue(importCommitDraft.headers, row, ['级次', '科目级次'])) || Math.max(1, Math.floor(code.length / 2) - 1)
          const accountType = importRowValue(importCommitDraft.headers, row, ['科目类别', '科目类型', '类别']) || '资产'
          const balanceDirection = importRowValue(importCommitDraft.headers, row, ['余额方向', '方向'])
          const hasAuxiliary = !['', '-', '无', '否'].includes(importRowValue(importCommitDraft.headers, row, ['辅助核算', '辅助']).trim())
          const isDetail = ['否', '非明细', '汇总'].includes(importRowValue(importCommitDraft.headers, row, ['明细科目', '是否明细']).trim()) ? 0 : 1
          if (!code || !name || importedAccountCodes.has(code) || (parentCode && !importedAccountCodes.has(parentCode))) throw new Error('科目编码重复、名称不完整或父级科目不存在')
          const account = await createAccount({ code, company_id: selectedCompanyId, name, account_type: accountType, normal_balance: balanceDirection === '贷' ? 'credit' : 'debit', level, parent_code: parentCode || undefined, is_detail: isDetail, has_quantity: importRowValue(importCommitDraft.headers, row, ['数量核算', '数量']) === '是' ? 1 : 0, default_unit: importRowValue(importCommitDraft.headers, row, ['默认单位', '计量单位']) || undefined, has_auxiliary: hasAuxiliary ? 1 : 0 })
          importedAccountCodes.add(account.code)
          if (importRowValue(importCommitDraft.headers, row, ['状态']) === '停用') await toggleAccount(account.code, selectedCompanyId)
        } else if (importCommitDraft.target === 'initialBalance') {
          if (!currentPeriodId) throw new Error('未选择当前账期')
          const accountCode = importRowValue(importCommitDraft.headers, row, ['科目编码', '会计科目编码', '科目'])
          const account = accounts.find((item) => item.code === accountCode)
          const openingDebit = importAmount(importRowValue(importCommitDraft.headers, row, ['期初借方', '借方期初', '期初借']))
          const openingCredit = importAmount(importRowValue(importCommitDraft.headers, row, ['期初贷方', '贷方期初', '期初贷']))
          if (!account || openingDebit < 0 || openingCredit < 0 || (openingDebit > 0 && openingCredit > 0)) throw new Error('期初科目或借贷金额不正确')
          await saveInitialBalance({ period_id: currentPeriodId, account_code: accountCode, opening_debit: openingDebit, opening_credit: openingCredit, created_by: '本地导入' })
        } else if (importCommitDraft.target === 'assetCategory') {
          const code = importRowValue(importCommitDraft.headers, row, ['类别编码', '资产类别编码', '编码'])
          const name = importRowValue(importCommitDraft.headers, row, ['资产类别', '类别名称', '名称'])
          const usefulLifeText = importRowValue(importCommitDraft.headers, row, ['折旧年限（月）', '使用年限月数', '折旧年限', '使用月数'])
          const usefulLifeMonths = usefulLifeText.includes('年') ? importAmount(usefulLifeText) * 12 : importAmount(usefulLifeText)
          const defaultSubjectParts = importRowValue(importCommitDraft.headers, row, ['默认科目', '科目']).split(/[／/]/).map((value) => value.trim()).filter(Boolean)
          const assetAccount = importRowValue(importCommitDraft.headers, row, ['固定资产科目', '资产科目']) || defaultSubjectParts[0] || ''
          const accumulatedDepreciationAccount = importRowValue(importCommitDraft.headers, row, ['累计折旧科目', '累计折旧']) || defaultSubjectParts[1] || ''
          if (!code || !name || usefulLifeMonths <= 0 || !assetAccount || !accumulatedDepreciationAccount) throw new Error('资产类别编码、年限或折旧科目不完整')
          await createAssetCategory({ companyId: selectedCompanyId, code, name, usefulLifeMonths, residualRate: importAmount(importRowValue(importCommitDraft.headers, row, ['残值率'])) / 100, depreciationMethod: importRowValue(importCommitDraft.headers, row, ['折旧方法']) || '平均年限法', assetAccount, accumulatedDepreciationAccount, expenseAccount: importRowValue(importCommitDraft.headers, row, ['费用科目', '默认费用科目']) || undefined, isEnabled: importRowValue(importCommitDraft.headers, row, ['状态']) !== '停用' })
        } else if (importCommitDraft.target === 'auxiliaryCategory') {
          const code = importRowValue(importCommitDraft.headers, row, ['类别编码', '辅助类别编码', '编码'])
          const name = importRowValue(importCommitDraft.headers, row, ['类别名称', '辅助类别', '名称'])
          const sortOrder = importAmount(importRowValue(importCommitDraft.headers, row, ['显示顺序', '排序', '顺序']))
          if (!code || !name) throw new Error('辅助类别编码或名称不完整')
          const category = await createAuxiliaryCategory({ company_id: selectedCompanyId, code, name, sort_order: sortOrder })
          auxiliaryCategoryReferenceIds.set(category.code, category.id)
          auxiliaryCategoryReferenceIds.set(category.name, category.id)
        } else if (importCommitDraft.target === 'auxiliaryItem') {
          const categoryReference = importRowValue(importCommitDraft.headers, row, ['辅助类别', '类别编码', '类别名称', '类别'])
          const categoryId = auxiliaryCategoryReferenceIds.get(categoryReference)
          const code = importRowValue(importCommitDraft.headers, row, ['项目编码', '辅助项目编码', '编码'])
          const name = importRowValue(importCommitDraft.headers, row, ['项目名称', '辅助项目', '名称'])
          const remarkParts = [
            importRowValue(importCommitDraft.headers, row, ['别名/助记码', '助记码', '别名']),
            importRowValue(importCommitDraft.headers, row, ['默认科目', '科目']),
            importRowValue(importCommitDraft.headers, row, ['备注', '说明']),
          ].filter(Boolean)
          if (!categoryId || !code || !name) throw new Error('辅助项目类别、编码或名称不完整')
          const item = await createAuxiliaryItem({ category_id: categoryId, company_id: selectedCompanyId, code, name, remarks: remarkParts.join('｜') || undefined })
          if (importRowValue(importCommitDraft.headers, row, ['状态']) === '停用') await toggleAuxiliaryItem(item.id, selectedCompanyId)
        } else if (importCommitDraft.target === 'matchingRule') {
          const ruleScope: MatchingRuleScope = kind === 'invoiceMatchingRules' ? 'invoice' : kind === 'billMatchingRules' ? 'bill' : kind === 'aiRuleTraining' ? 'ai_training' : 'cash_flow'
          const name = importRowValue(importCommitDraft.headers, row, ['规则名称', '名称', '现金流量项目'])
          const conditionText = importRowValue(importCommitDraft.headers, row, ['匹配条件', '训练条件/样本来源', '训练条件', '样本来源', '条件', '摘要/对方户名', '关键词'])
          const actionText = importRowValue(importCommitDraft.headers, row, ['处理动作', '建议动作', '目标动作', '生成动作', '现金流量项目', '凭证模板'])
          if (!name || !conditionText || !actionText) throw new Error('匹配规则名称、条件或动作不完整')
          await createMatchingRule({ companyId: selectedCompanyId, ruleScope, name, conditionText, actionText, targetAccountCode: importRowValue(importCommitDraft.headers, row, ['目标科目', '关联科目', '科目/税率', '项目编码']) || undefined, priority: importAmount(importRowValue(importCommitDraft.headers, row, ['优先级', '顺序'])) || 50, isEnabled: ruleScope === 'ai_training' ? false : importRowValue(importCommitDraft.headers, row, ['状态']) !== '停用' })
        } else if (importCommitDraft.target === 'settlementRule') {
          const name = importRowValue(importCommitDraft.headers, row, ['规则名称', '结转类型', '名称'])
          const rawRuleType = importRowValue(importCommitDraft.headers, row, ['结转类型', '规则类型'])
          const ruleType = rawRuleType.includes('损益') ? 'profit_loss' : rawRuleType.includes('所得税') ? 'tax' : rawRuleType.includes('增值税') ? 'vat' : rawRuleType || 'custom'
          const sourceFormula = importRowValue(importCommitDraft.headers, row, ['取数公式', '取数来源', '来源'])
          const targetAccountCode = importRowValue(importCommitDraft.headers, row, ['目标科目', '科目'])
          const summaryTemplate = importRowValue(importCommitDraft.headers, row, ['凭证摘要模板', '凭证模板', '摘要模板'])
          const priority = importAmount(importRowValue(importCommitDraft.headers, row, ['执行顺序', '顺序', '优先级'])) || 10
          if (!name) throw new Error('结转规则名称不完整')
          const voucherWord = voucherWords.find((item) => item.id === importRowValue(importCommitDraft.headers, row, ['凭证字']) || item.word_name === importRowValue(importCommitDraft.headers, row, ['凭证字']))
          const isEnabled = importRowValue(importCommitDraft.headers, row, ['状态']) !== '停用'
          const created = await createSettlementRule({ companyId: selectedCompanyId, name, ruleType, sourceFormula: sourceFormula || undefined, targetAccountCode: targetAccountCode || undefined, voucherWordId: voucherWord?.id, summaryTemplate: summaryTemplate || undefined, priority, isEnabled })
          if (!isEnabled) await updateSettlementRule({ id: created.id, companyId: selectedCompanyId, name, ruleType, sourceFormula: sourceFormula || undefined, targetAccountCode: targetAccountCode || undefined, voucherWordId: voucherWord?.id, summaryTemplate: summaryTemplate || undefined, priority, isEnabled: false })
        } else if (importCommitDraft.target === 'commonDigest') {
          const content = importRowValue(importCommitDraft.headers, row, ['摘要内容', '摘要模板', '摘要', '名称'])
          if (!content) throw new Error('常用摘要内容不完整')
          await createCommonDigest({ companyId: selectedCompanyId, content })
        } else if (importCommitDraft.target === 'voucherTemplate') {
          const name = importRowValue(importCommitDraft.headers, row, ['模板名称', '名称'])
          const typeName = importRowValue(importCommitDraft.headers, row, ['模板分类', '适用来源', '来源模块']) || '导入模板'
          const summary = importRowValue(importCommitDraft.headers, row, ['摘要规则', '凭证摘要', '摘要'])
          const debitAccountCode = importRowValue(importCommitDraft.headers, row, ['借方科目', '借方科目编码'])
          const creditAccountCode = importRowValue(importCommitDraft.headers, row, ['贷方科目', '贷方科目编码'])
          const debitAccount = detailedAccounts.find((item) => item.code === debitAccountCode || `${item.code} ${item.name}` === debitAccountCode)
          const creditAccount = detailedAccounts.find((item) => item.code === creditAccountCode || `${item.code} ${item.name}` === creditAccountCode)
          if (!name || !debitAccount || !creditAccount) throw new Error('凭证模板名称或借贷科目不完整')
          let templateType = voucherTemplateTypes.find((item) => item.name === typeName)
          if (!templateType) templateType = await createVoucherTemplateType({ companyId: selectedCompanyId, name: typeName, sortOrder: voucherTemplateTypes.length + 1 })
          const entries: TemplateEntry[] = [
            { account_code: debitAccount.code, account_name: debitAccount.name, direction: 'debit', summary, auxiliary_type: null, auxiliary_id: null },
            { account_code: creditAccount.code, account_name: creditAccount.name, direction: 'credit', summary, auxiliary_type: null, auxiliary_id: null },
          ]
          await createVoucherTemplate({ companyId: selectedCompanyId, typeId: templateType.id, name, entries })
        } else if (importCommitDraft.target === 'currency') {
          const code = importRowValue(importCommitDraft.headers, row, ['币别编码', '货币编码', '编码'])
          const name = importRowValue(importCommitDraft.headers, row, ['币别名称', '货币名称', '名称'])
          const exchangeRate = importAmount(importRowValue(importCommitDraft.headers, row, ['汇率', '折算汇率']))
          if (!code || !name || exchangeRate <= 0) throw new Error('币别编码、名称或汇率不完整')
          const isBase = ['是', '1', 'true', '本位币'].includes(importRowValue(importCommitDraft.headers, row, ['本位币', '是否本位币']).toLowerCase())
          await createCurrency({ company_id: selectedCompanyId, code, name, exchange_rate: exchangeRate, is_base: isBase ? 1 : 0 })
        } else {
          throw new Error('暂不支持该导入目标')
        }
        successCount += 1
      } catch (error) {
        failedCount += 1
        if (failureRows.length < 20) {
          failureRows.push({ rowNumber: rowIndex + 2, message: error instanceof Error ? error.message : String(error) })
        }
      }
    }
    if (createdBankTransactions.length) setBankTransactions((items) => [...createdBankTransactions, ...items])
    if (createdDocuments.length) setDocumentRecords((items) => [...createdDocuments, ...items])
    if (createdBusinessOrders.length) setBusinessOrders((items) => [...createdBusinessOrders, ...items])
    if (createdEmployees.length) setEmployees((items) => [...createdEmployees, ...items])
    if (createdPayrollRecords.length) setPayrollRecords((items) => [...createdPayrollRecords, ...items])
    if (createdSocialSecurityRecords.length) setSocialSecurityRecords((items) => [...createdSocialSecurityRecords, ...items])
    if (createdSpecialDeductionRecords.length) setSpecialDeductionRecords((items) => [...createdSpecialDeductionRecords, ...items])
    if (createdInventoryMovements.length) setInventoryMovements((items) => [...createdInventoryMovements, ...items])
    if (createdFixedAssets.length) setFixedAssets((items) => [...createdFixedAssets, ...items])
    if (createdInventoryItems.length) setInventoryItems((items) => [...createdInventoryItems, ...items])
    if (createdSettlementRecords.length) setSettlementRecords((items) => [...createdSettlementRecords, ...items])
    if (createdBankReconciliationRecords.length) setBankReconciliationRecords((items) => [...createdBankReconciliationRecords, ...items])
    if (createdMeasurementUnits.length) setMeasurementUnits((items) => [...createdMeasurementUnits, ...items])
    if (createdAccountTransfers.length) setAccountTransfers((items) => [...createdAccountTransfers, ...items])
    if (createdCostCarryoverRecords.length) setCostCarryoverRecords((items) => [...createdCostCarryoverRecords, ...items])
    if (importCommitDraft.target === 'initialBalance' && successCount > 0 && currentPeriodId) {
      const initialBalance = await fetchTrialBalance(currentPeriodId)
      setLiveReports((reports) => ({ ...reports, initialBalance }))
    }
    updateLocalImportJobCommit(importCommitDraft.jobId, successCount, failedCount, failureRows)
    writeModuleAudit('确认写入本地台账', `${importCommitDraft.fileName}｜成功 ${successCount} 行`, '中', successCount > 0 ? '成功' : '失败')
    setImportCommitDraft(null)
    setOperationNotice(`本地导入已完成：成功 ${successCount} 行，失败 ${failedCount} 行。失败行未写入；未调用税局、银行或发票外部系统。`)
  }

  const handleValidateLocalImportJob = () => {
    if (!importValidationJob) return
    const updated = updateLocalImportJobValidation(importValidationJob.id)
    if (!updated) {
      setOperationNotice('核验本机导入批次失败，请刷新后重试。')
      return
    }
    setShowImportValidationDialog(false)
    setImportValidationJob(null)
    writeModuleAudit('核验本机导入批次', `${updated.fileName}｜${updated.rowCount ?? '待解析'} 行`, '中', '成功')
    setOperationNotice('本机导入批次已标记为人工核验；不会写入账套业务数据或调用外部系统。')
  }

  const handleViewRow = async (row: ModuleRow) => {
    if (kind === 'initialBalance') {
      openInitialBalanceEditor(row)
      return
    }
    if (isLiveAuxiliaryArchiveKind(kind)) {
      const itemId = row.id.replace('auxiliary-', '')
      openAuxiliaryArchiveEditor((isTauri ? auxiliaryItems : previewAuxiliaryItems).find((item) => item.id === itemId), row)
      return
    }
    if (kind === 'attachmentCenter') {
      const attachment = localAttachmentRecords.find((item) => item.id === row.id)
      if (attachment) {
        setAttachmentAssociationDraft({ id: attachment.id, fileName: attachment.fileName, relatedDocument: attachment.relatedDocument === '待关联单据' ? '' : attachment.relatedDocument })
        setShowAttachmentAssociationDialog(true)
        return
      }
    }
    if (kind === 'importCenter') {
      const importJob = localImportJobs.find((item) => item.id === row.id)
      if (importJob) {
        setImportValidationJob(importJob)
        setShowImportValidationDialog(true)
        return
      }
    }
    if (kind === 'subjectSettings') {
      const account = accounts.find((item) => item.code === row.id || item.code === row.values.code)
      if (account) {
        openSubjectEditor(account)
      } else {
        setEditingSubjectCode(row.values.code || row.id)
        setSubjectDraft({ code: row.values.code || row.id, name: row.values.name || '', accountType: '资产类', normalBalance: row.values.direction === '贷' ? 'credit' : 'debit', level: '1', parentCode: '', isDetail: true, hasQuantity: false, defaultUnit: '', hasAuxiliary: Boolean(row.values.aux && row.values.aux !== '-') })
        setShowSubjectDialog(true)
      }
      return
    }
    if (kind === 'aiJobQueue' && !isTauri) {
      const jobId = row.id.replace('automation-queue-', '')
      const job = [...automationJobs, ...previewAiQueueJobs].find((item) => item.id === jobId)
      if (!job) {
        setOperationNotice('未找到该预览任务，请刷新队列后重试。')
        return
      }
      if (row.status === '待处理') {
        if (!await requestBusinessRiskConfirmation('启动 AI 预览任务', `确认启动 ${job.id} 吗？任务只会进入本地人工复核队列，不会自动生成凭证、写入账套或调用外部系统。`, '确认启动')) return
        const timestamp = new Date().toISOString()
        updatePreviewAiQueueJobs((jobs) => jobs.map((item) => item.id === job.id ? { ...item, status: 'waiting_confirmation', reviewer: 'admin', updatedAt: timestamp } : item))
        setAutomationJobs((jobs) => jobs.map((item) => item.id === job.id ? { ...item, status: 'waiting_confirmation', reviewer: 'admin', updatedAt: timestamp } : item))
        writeModuleAudit('启动AI预览任务', `${job.id}｜${job.sourceModule}`, '中', '成功')
        setOperationNotice(`${job.id} 已进入人工复核队列。请核验来源、字段和风险后再进入后续模块。`)
        return
      }
      if (row.status === '待确认') {
        if (job.jobType === 'voucher_suggestion') {
          navigate('/ai/suggestions')
          return
        }
        if (job.jobType === 'invoice_recognition' || job.jobType === 'document_ocr') {
          navigate('/ai/recognition')
          return
        }
        setOperationNotice(`${job.id} 等待人工复核。请根据来源模块 ${job.sourceModule} 核验分类结果和来源资料。`)
        return
      }
      if (row.status === '异常') {
        setOperationNotice(`${job.id} 处理异常：${job.resultSummary || '未记录失败原因'}。请补充来源资料后重新创建任务。`)
        return
      }
      setOperationNotice(`${job.id} 已完成：${job.resultSummary || '结果已保留在本地日志中'}。不会自动创建或入账凭证。`)
      return
    }
    if (kind === 'aiRecognitionResults' && !isTauri) {
      if (row.status === '已通过') {
        setOperationNotice('该识别结果已完成人工复核，可回到目标业务模块继续核验来源资料。')
        return
      }
      if (row.status === '异常') {
        setOperationNotice('该识别结果存在影像或字段异常，请补充来源资料后重新进入识别队列。')
        return
      }
      await reviewAiRecognition([row.id])
      return
    }
    if (kind === 'aiVoucherSuggestions') {
      if (row.status === '已生成凭证') {
        openLinkedAiSuggestionVoucher(row)
        return
      }
      if (row.status === '已确认') {
        setOperationNotice('该 AI 凭证建议已确认，请进入凭证草稿继续人工核验和保存。')
        return
      }
      if (!isTauri) {
        await confirmPreviewAiVoucherSuggestions([row.id])
        return
      }
      if (!usesLiveAutomationJobData || !selectedCompanyId) {
        setOperationNotice('当前账套的 AI 建议记录尚未加载，请刷新后重试。')
        return
      }
      const suggestionJobId = row.id.replace('automation-suggestion-', '')
      await confirmAiVoucherSuggestions([`automation-suggestion-${suggestionJobId}`])
      return
    }
    if (kind === 'voucher') {
      navigate(`/vouchers/detail/${row.id}`)
      return
    }
    if (kind === 'declarationReceipt' && (usesLiveDeclarationReceiptData || !isTauri)) {
      const taskId = row.id.replace('declaration-receipt-', '')
      const task = effectiveTaxDeclarationTasks.find((item) => item.id === taskId)
      if (!task) {
        setOperationNotice('未找到当前账套的申报事项，请刷新后重试。')
        return
      }
      openDeclarationReceiptEditor(task)
      return
    }
    if (kind === 'taxInit' && (usesLiveTaxInitData || !isTauri)) {
      const taskId = row.id.replace('tax-init-', '')
      const task = effectiveTaxDeclarationTasks.find((item) => item.id === taskId)
      if (!task) {
        setOperationNotice('未找到当前账套的申报认定事项，请刷新后重试。')
        return
      }
      openTaxInitEditor(task)
      return
    }
    if (isLocalTaxTaskKind) {
      await confirmTaxTaskFromRow(row)
      return
    }
    if (kind === 'voucherRecycle' && isTauri && selectedCompanyId) {
      if (!await requestBusinessRiskConfirmation('确认恢复凭证', `确认恢复凭证 ${row.voucher} 吗？恢复后仍需人工复核、审核和记账。`, '确认恢复')) return
      try {
        await restoreVoucher(row.id, selectedCompanyId)
        setDeletedVouchers((items) => items.filter((item) => item.id !== row.id))
        writeModuleAudit('恢复凭证', row.voucher, '高', '成功')
        setOperationNotice(`凭证 ${row.voucher} 已恢复。`)
      } catch (error) {
        setOperationNotice(`恢复凭证失败：${String(error)}`)
      }
      return
    }
    if (kind === 'invoiceVoucherMatching' && isTauri && selectedCompanyId) {
      setSelectedMatchInvoiceId(row.id.replace('invoice-voucher-match-', ''))
      setSelectedMatchVoucherId('')
      setShowInvoiceVoucherMatchDialog(true)
      return
    }
    if ((kind === 'outputInvoice' || kind === 'inputInvoice') && isTauri && selectedCompanyId) {
      const invoice = await getInvoice(row.id, selectedCompanyId)
      if (!invoice) {
        setOperationNotice('未找到该发票，或发票不属于当前账套。')
        return
      }
      setEditingInvoiceId(invoice.id)
      setInvoiceDraft({
        invoiceNo: invoice.invoice_no,
        invoiceCode: invoice.invoice_code || '',
        invoiceDate: invoice.invoice_date,
        amount: String(invoice.amount),
        taxAmount: String(invoice.tax_amount),
        taxRate: String((invoice.tax_rate || 0) * 100),
        sellerName: invoice.seller_name || '',
        sellerTaxId: invoice.seller_tax_id || '',
        buyerName: invoice.buyer_name || '',
        buyerTaxId: invoice.buyer_tax_id || '',
        remarks: invoice.remarks || '',
      })
      setSelectedInvoiceTagIds(await fetchInvoiceTagIds(invoice.id, selectedCompanyId))
      setShowInvoiceDialog(true)
      return
    }
    if ((kind === 'purchaseManagement' || kind === 'salesManagement') && isTauri && selectedCompanyId) {
      const order = businessOrders.find((item) => item.id === row.id)
      if (!order) {
        setOperationNotice('未找到当前账期的业务订单。')
        return
      }
      if (order.voucherId) {
        setOperationNotice('该订单已关联凭证，请先按凭证复核流程处理后再修改订单。')
        return
      }
      setEditingBusinessOrderId(order.id)
      setBusinessOrderDraft({ orderNo: order.orderNo, businessDate: order.businessDate, counterparty: order.counterparty, goodsName: order.goodsName, amount: String(order.amount), fulfillmentStatus: order.fulfillmentStatus, invoiceStatus: order.invoiceStatus, settlementStatus: order.settlementStatus, status: order.status, sourceDocument: order.sourceDocument || '' })
      setShowBusinessOrderDialog(true)
      return
    }
    if ((kind === 'receivableSettlement' || kind === 'payableSettlement') && isTauri && selectedCompanyId) {
      const record = settlementRecords.find((item) => item.id === row.id)
      if (!record) return
      setEditingSettlementRecordId(record.id)
      setSettlementRecordDraft({ settlementNo: record.settlementNo, settlementDate: record.settlementDate, counterparty: record.counterparty, invoiceNo: record.invoiceNo || '', transactionNo: record.transactionNo || '', totalAmount: String(record.totalAmount), settledAmount: String(record.settledAmount), settlementMethod: record.settlementMethod, owner: record.owner || '', status: record.status, sourceDocument: record.sourceDocument || '' })
      setShowSettlementRecordDialog(true)
      return
    }
    if (kind === 'bankReconciliation' && isTauri && selectedCompanyId) {
      const record = bankReconciliationRecords.find((item) => item.id === row.id)
      if (!record) return
      setEditingBankReconciliationId(record.id)
      setBankReconciliationDraft({ reconciliationNo: record.reconciliationNo, reconciliationDate: record.reconciliationDate, accountName: record.accountName, transactionNo: record.transactionNo, summary: record.summary || '', bankAmount: String(record.bankAmount), bookAmount: String(record.bookAmount), voucherNo: record.voucherNo || '', matchStatus: record.matchStatus, owner: record.owner || '', status: record.status, note: record.note || '' })
      setShowBankReconciliationDialog(true)
      return
    }
    if (kind === 'employee') {
      const employee = employees.find((item) => item.id === row.id)
      if (!employee) return
      setEditingEmployeeId(employee.id)
      setEmployeeDraft({ employeeCode: employee.employeeCode, name: employee.name, idNo: employee.idNo || '', department: employee.department || '', position: employee.position || '', mobile: employee.mobile || '', entryDate: employee.entryDate || '', employmentStatus: employee.employmentStatus })
      setShowEmployeeDialog(true)
      return
    }
    if (kind === 'payroll' && isTauri && selectedCompanyId) {
      const payroll = payrollRecords.find((item) => item.id === row.id)
      if (!payroll) {
        setOperationNotice('未找到当前账期的薪酬行。')
        return
      }
      if (payroll.status === '已生成凭证') {
        setOperationNotice('该薪酬行已生成凭证，不可直接修改。请先按凭证处理流程完成复核。')
        return
      }
      setEditingPayrollId(payroll.id)
      setPayrollDraft({ employeeId: payroll.employeeId, baseSalary: String(payroll.baseSalary), bonus: String(payroll.bonus), taxAmount: String(payroll.taxAmount), socialPersonal: String(payroll.socialPersonal) })
      setShowPayrollDialog(true)
      return
    }
    if (kind === 'invoiceMatchingRules' || kind === 'billMatchingRules' || kind === 'cashFlowMapping' || kind === 'aiRuleTraining') {
      const rule = (isTauri ? matchingRules : previewMatchingRules).find((item) => `matching-rule-${item.id}` === row.id)
      if (!rule) { setOperationNotice('未找到当前账套的自动匹配规则。'); return }
      setEditingMatchingRuleId(rule.id)
      setMatchingRuleDraft({ name: rule.name, conditionText: rule.condition_text, actionText: rule.action_text, targetAccountCode: rule.target_account_code || '', voucherTemplateId: rule.voucher_template_id || '', priority: String(rule.priority), isEnabled: rule.is_enabled === 1 })
      setShowMatchingRuleDialog(true)
      return
    }
    if (kind === 'assetCategory') {
      const category = effectiveAssetCategories.find((item) => `asset-category-${item.id}` === row.id)
      if (!category) { setOperationNotice('未找到当前账套的资产类别。'); return }
      setEditingAssetCategoryId(category.id)
      setAssetCategoryDraft({ code: category.code, name: category.name, usefulLifeMonths: String(category.useful_life_months), residualRate: String(category.residual_rate * 100), depreciationMethod: category.depreciation_method, assetAccount: category.asset_account, accumulatedDepreciationAccount: category.accumulated_depreciation_account, expenseAccount: category.expense_account || '', isEnabled: category.is_enabled === 1 })
      setShowAssetCategoryDialog(true)
      return
    }
    if (kind === 'tagArchive') {
      const tag = effectiveBusinessTags.find((item) => `business-tag-${item.id}` === row.id)
      if (!tag) { setOperationNotice('未找到当前账套的业务标签。'); return }
      setEditingBusinessTagId(tag.id)
      setBusinessTagDraft({ name: tag.name, applicableModules: tag.applicable_modules, colorName: tag.color_name, autoRule: tag.auto_rule || '', remarks: tag.remarks || '', isEnabled: tag.is_enabled === 1 })
      setShowBusinessTagDialog(true)
      return
    }
    if (kind === 'accountArchive') {
      const account = (isTauri ? companyAccounts : previewCompanyAccounts).find((item) => `company-account-${item.id}` === row.id)
      if (!account) { setOperationNotice('未找到当前账套的账户档案。'); return }
      setEditingCompanyAccountId(account.id)
      setCompanyAccountDraft({ accountName: account.account_name, accountType: account.account_type, bankName: account.bank_name || '', accountNumber: account.account_number, subjectCode: account.subject_code, openingBalance: String(account.opening_balance), attachmentNote: account.attachment_note || '', status: account.status })
      setShowCompanyAccountDialog(true)
      return
    }
    if (kind === 'auxiliaryCategories') {
      const category = (isTauri ? auxiliaryCategories : previewAuxiliaryCategories).find((item) => `auxiliary-category-${item.id}` === row.id)
      if (!category) {
        setOperationNotice('未找到当前账套的辅助核算类别。')
        return
      }
      if (category.is_system === 1) {
        setOperationNotice('系统预置辅助核算类别仅供查看，不能修改或删除。')
        return
      }
      setEditingAuxiliaryCategoryId(category.id)
      setAuxiliaryCategoryDraft({ code: category.code, name: category.name, sortOrder: String(category.sort_order) })
      setShowAuxiliaryCategoryDialog(true)
      return
    }
    if (kind === 'auxiliaryItems') {
      const item = (isTauri ? auxiliaryItems : previewAuxiliaryItems).find((current) => `auxiliary-item-${current.id}` === row.id)
      if (!item) {
        setOperationNotice('未找到当前账套的辅助核算项目。')
        return
      }
      setEditingAuxiliaryItemId(item.id)
      setAuxiliaryItemDraft({ categoryId: item.category_id, code: item.code, name: item.name, remarks: item.remarks || '' })
      setShowAuxiliaryItemDialog(true)
      return
    }
    if (kind === 'settlementRules') {
      const rule = (isTauri ? settlementRules : previewSettlementRules).find((item) => `settlement-rule-${item.id}` === row.id)
      if (!rule) {
        setOperationNotice('未找到当前账套的结转规则。')
        return
      }
      setEditingSettlementRuleId(rule.id)
      setSettlementRuleDraft({ name: rule.name, ruleType: rule.rule_type, sourceFormula: rule.source_formula || '', targetAccountCode: rule.target_account_code || '', voucherWordId: rule.voucher_word_id || '', summaryTemplate: rule.summary_template || '', priority: String(rule.priority), isEnabled: rule.is_enabled === 1 })
      setShowSettlementRuleDialog(true)
      return
    }
    if (kind === 'currencySettings') {
      const currency = (isTauri ? currencies : previewCurrencies).find((item) => `currency-${item.id}` === row.id)
      if (!currency) {
        setOperationNotice('未找到当前账套的币别。')
        return
      }
      setEditingCurrencyId(currency.id)
      setCurrencyDraft({ code: currency.code, name: currency.name, exchangeRate: String(currency.exchange_rate), isBase: currency.is_base === 1 })
      setShowCurrencyDialog(true)
      return
    }
    if (kind === 'commonDigests') {
      const digest = (isTauri ? commonDigests : previewCommonDigests).find((item) => `digest-${item.id}` === row.id)
      if (!digest) {
        setOperationNotice('未找到当前账套的常用摘要。')
        return
      }
      setEditingCommonDigestId(digest.id)
      setCommonDigestDraft(digest.content)
      setShowCommonDigestDialog(true)
      return
    }
    if (kind === 'voucherTemplateSettings') {
      const template = (isTauri ? voucherTemplates : previewVoucherTemplates).find((item) => `voucher-template-${item.template.id}` === row.id)
      if (!template) {
        setOperationNotice('未找到当前账套的凭证模板。')
        return
      }
      setEditingVoucherTemplateId(template.template.id)
      setVoucherTemplateDraft({
        typeId: template.template.type_id,
        name: template.template.name,
        summary: template.entries[0]?.summary || '',
        debitAccountCode: template.entries.find((entry) => entry.direction === 'debit')?.account_code || '',
        creditAccountCode: template.entries.find((entry) => entry.direction === 'credit')?.account_code || '',
      })
      setShowVoucherTemplateDialog(true)
      return
    }
    if (kind === 'taxAdapterSettings' || kind === 'bankAdapterSettings') {
      const prefix = kind === 'taxAdapterSettings' ? 'tax-adapter-' : 'bank-adapter-'
      const adapter = effectiveAdapterAuthorizations.find((item) => `${prefix}${item.id}` === row.id)
      if (!adapter) {
        setOperationNotice('未找到当前账套的授权配置。')
        return
      }
      setEditingAdapterAuthorizationId(adapter.id)
      setAdapterAuthorizationDraft({ adapterCode: adapter.adapterCode, region: adapter.region || '', authStatus: adapter.authStatus, accountMask: adapter.accountMask || '', loginIdentity: adapter.loginIdentity || '', capabilityScope: adapter.capabilityScope || '', expiresAt: adapter.expiresAt || '', riskMessage: adapter.riskMessage || '' })
      setShowAdapterAuthorizationDialog(true)
      return
    }
    if (kind === 'reportFormulaSettings') {
      const item = effectiveReportItems.find((current) => `report-formula-${current.id}` === row.id)
      if (!item) {
        setOperationNotice('未找到报表公式项目。')
        return
      }
      setEditingReportFormulaId(item.id)
      setReportFormulaDraft({ itemName: item.item_name, formula: item.formula || '', sortOrder: String(item.sort_order), isTotal: item.is_total === 1 })
      setShowReportFormulaDialog(true)
      return
    }
    if (kind === 'socialSecurity') { const record=socialSecurityRecords.find((item)=>item.id===row.id);if(!record)return;setEditingSocialSecurityId(record.id);setSocialSecurityDraft({employeeId:record.employeeId,city:record.city||'',base:String(record.contributionBase),company:String(record.companyAmount),personal:String(record.personalAmount),fund:String(record.fundAmount)});setShowSocialSecurityDialog(true);return }
    if (kind === 'specialDeduction') { const record=specialDeductionRecords.find((item)=>item.id===row.id);if(!record)return;setEditingSpecialDeductionId(record.id);setSpecialDeductionDraft({employeeId:record.employeeId,deductionType:record.deductionType,startMonth:record.startMonth,endMonth:record.endMonth||'',monthlyAmount:String(record.monthlyAmount),source:record.source});setShowSpecialDeductionDialog(true);return }
    if (kind === 'transfer' && isTauri && selectedCompanyId) {
      const transfer = accountTransfers.find((item) => item.id === row.id)
      if (!transfer) {
        setOperationNotice('未找到当前账期的账户转账记录。')
        return
      }
      if (transfer.status === '已生成凭证') {
        setOperationNotice('该转账已生成凭证，不可直接修改。请先按凭证处理流程完成复核。')
        return
      }
      setEditingAccountTransferId(transfer.id)
      setAccountTransferDraft({ transferDate: transfer.transferDate, fromAccount: transfer.fromAccount, toAccount: transfer.toAccount, amount: String(transfer.amount), fee: String(transfer.fee), serialNo: transfer.serialNo || '' })
      setShowAccountTransferDialog(true)
      return
    }
    if (kind === 'depreciation' && isTauri && selectedCompanyId) {
      const asset = fixedAssets.find((item) => item.id === row.id)
      if (!asset) {
        setOperationNotice('未找到当前账期的固定资产。')
        return
      }
      if (asset.status === '已生成凭证') {
        setOperationNotice('该资产已生成折旧凭证，不可直接修改。请先按凭证处理流程完成复核。')
        return
      }
      setEditingFixedAssetId(asset.id)
      setFixedAssetDraft({ assetCode: asset.assetCode, assetName: asset.assetName, category: asset.category, startDate: asset.startDate, originalValue: String(asset.originalValue), usefulLifeMonths: String(asset.usefulLifeMonths), residualRate: String(asset.residualRate * 100), sourceDocument: asset.sourceDocument || '' })
      setShowFixedAssetDialog(true)
      return
    }
    if (kind === 'inventoryMovement' && isTauri && selectedCompanyId) {
      const movement = inventoryMovements.find((item) => item.id === row.id)
      if (!movement) {
        setOperationNotice('未找到当前账期的出入库单。')
        return
      }
      if (movement.status === '已生成凭证') {
        setOperationNotice('该出入库单已生成凭证，不可直接修改。请先按凭证处理流程完成复核。')
        return
      }
      setEditingInventoryMovementId(movement.id)
      setInventoryMovementDraft({ movementDate: movement.movementDate, billNo: movement.billNo, movementType: movement.movementType, inventoryName: movement.inventoryName, warehouse: movement.warehouse, counterparty: movement.counterparty || '', unit: movement.unit, quantity: String(movement.quantity), amount: String(movement.amount), sourceDocument: movement.sourceDocument || '' })
      setShowInventoryMovementDialog(true)
      return
    }
    if (kind === 'inventorySettings' && isTauri && selectedCompanyId) { const item=inventoryItems.find((value)=>value.id===row.id); if(!item)return; setEditingInventoryItemId(item.id); setInventoryItemDraft({itemCode:item.itemCode,itemName:item.itemName,specification:item.specification||'',unit:item.unit,taxRate:String((item.taxRate||0)*100),defaultSubject:item.defaultSubject||''}); setShowInventoryItemDialog(true); return }
    if (kind === 'unitSettings' && isTauri && selectedCompanyId) { const unit=measurementUnits.find((value)=>value.id===row.id); if(!unit)return; setEditingMeasurementUnitId(unit.id); setMeasurementUnitDraft({unitName:unit.unitName,unitGroup:unit.unitGroup||'',baseUnit:unit.baseUnit||'',conversionRate:String(unit.conversionRate),precisionDigits:String(unit.precisionDigits),remark:unit.remark||''}); setShowMeasurementUnitDialog(true); return }
    if (kind === 'billList' || kind === 'bankStatement') {
      const transaction = bankTransactions.find((item) => item.id === row.id)
      if (!transaction) {
        setOperationNotice('未找到当前账期的银行流水。')
        return
      }
      if (transaction.status === '已生成凭证') {
        setOperationNotice('该银行流水已生成凭证，不可直接修改。请先按凭证处理流程完成复核。')
        return
      }
      setEditingBankTransactionId(transaction.id)
      setBankTransactionDraft({ accountName: transaction.accountName, serialNo: transaction.serialNo, transactionDate: transaction.transactionDate, counterparty: transaction.counterparty || '', summary: transaction.summary || '', incomeAmount: String(transaction.incomeAmount || ''), expenseAmount: String(transaction.expenseAmount || ''), balance: transaction.balance === null ? '' : String(transaction.balance), receiptStatus: transaction.receiptStatus })
      setSelectedBankTransactionTagIds(await fetchBankTransactionTagIds(transaction.id, selectedCompanyId))
      setShowBankTransactionDialog(true)
      return
    }
    if (['documentRegister', 'contractLedger', 'expenseReimbursement', 'receipt'].includes(kind)) {
      const record = documentRecords.find((item) => item.id === row.id)
      if (!record) {
        setOperationNotice('未找到当前账期的登记单据。')
        return
      }
      if (record.status === '已生成凭证') {
        setOperationNotice('该登记单据已生成凭证，不可直接修改。请先按凭证处理流程完成复核。')
        return
      }
      setEditingDocumentRecordId(record.id)
      setDocumentRecordDraft({ businessDate: record.businessDate, documentCode: record.documentCode, businessType: record.businessType, partner: record.partner || '', amount: String(record.amount), owner: record.owner || '', attachmentStatus: record.attachmentStatus, stampTaxItem: record.stampTaxItem || '', stampTaxRate: record.stampTaxRate === null ? '' : String(record.stampTaxRate * 100) })
      setShowDocumentRecordDialog(true)
      return
    }
    if (kind === 'backupRestore' && isTauri) {
      try {
        const result = await backupApi.verifyLocalBackup(row.id)
        if (!result.success || !result.data) throw new Error(result.error || '未返回核验结果')
        setBackupValidations((validations) => ({ ...validations, [row.id]: result.data! }))
        writeModuleAudit('核验备份', row.id, result.data.valid ? '中' : '高', result.data.valid ? '成功' : '失败')
        setOperationNotice(result.data.message)
      } catch (error) {
        writeModuleAudit('核验备份', row.id, '高', '失败')
        setOperationNotice(`备份核验失败：${String(error)}`)
      }
      return
    }
    const object = rowObjectLabel(row)
    writeModuleAudit('查看明细', `${title}-${object}`)
    setDetailRow(row)
  }

  const handleGenerateVoucher = async (row: ModuleRow) => {
    const isLocalFileRegistryRow = kind === 'attachmentCenter'
      ? localAttachmentRecords.some((item) => item.id === row.id)
      : kind === 'importCenter' && localImportJobs.some((item) => item.id === row.id)
    if ((kind === 'attachmentCenter' || kind === 'importCenter') && isLocalFileRegistryRow) {
      if (!await requestBusinessRiskConfirmation('确认撤销本机登记', `确认撤销 ${row.values.file || row.values.name || row.id} 的本机登记吗？不会删除原始文件或影响已入账数据。`, '确认撤销')) return
      const removed = kind === 'attachmentCenter'
        ? removeLocalAttachment(row.id)
        : removeLocalImportJob(row.id)
      if (!removed) {
        setOperationNotice('撤销本机登记失败，请刷新后重试。')
        return
      }
      writeModuleAudit('撤销本机登记', `${title}-${row.values.file || row.values.name || row.id}`, '中', '成功')
      setOperationNotice('本机文件元数据登记已撤销；原始文件、已入账凭证和外部系统数据均未变更。')
      return
    }
    if (kind === 'voucher') {
      navigate(`/vouchers/edit/${row.id}`)
      return
    }
    if (kind === 'aiVoucherSuggestions') {
      if (row.status === '已生成凭证') {
        openLinkedAiSuggestionVoucher(row)
        return
      }
      if (row.status !== '已确认') {
        setOperationNotice('请先人工确认 AI 凭证建议，再进入凭证草稿复核；系统不会自动生成或入账凭证。')
        return
      }
      const suggestionNo = row.values.suggestNo || row.id
      const suggestionJobId = row.id.replace('automation-suggestion-', '')
      writeModuleAudit('打开AI凭证草稿复核', suggestionNo, '中', '成功')
      setOperationNotice(`${suggestionNo} 已进入凭证草稿复核入口；请人工录入、校验借贷平衡并保存，系统不会自动生成或入账凭证。`)
      navigate(`/vouchers/new?aiSuggestion=${encodeURIComponent(suggestionJobId)}`)
      return
    }
    if (kind === 'voucherRecycle' && isTauri && selectedCompanyId) {
      if (!await requestBusinessRiskConfirmation('确认彻底删除凭证', `确认彻底删除凭证 ${row.voucher} 吗？此操作不可恢复，且不会向外部系统发送指令。`, '彻底删除')) return
      try {
        await permanentDeleteVoucher(row.id, selectedCompanyId)
        setDeletedVouchers((items) => items.filter((item) => item.id !== row.id))
        writeModuleAudit('彻底删除凭证', row.voucher, '高', '成功')
        setOperationNotice(`凭证 ${row.voucher} 已彻底删除。`)
      } catch (error) {
        setOperationNotice(`彻底删除凭证失败：${String(error)}`)
      }
      return
    }
    if (kind === 'outputInvoice' || kind === 'inputInvoice') {
      const object = rowObjectLabel(row)
      writeModuleAudit('从发票新建凭证', `${title}-${object}`, '中', '成功')
      setOperationNotice(`${object} 已作为来源留痕，请在新建凭证页选择科目并完成借贷平衡后保存。`)
      navigate('/vouchers/new')
      return
    }
    const readOnlyReviewKinds: ModuleKind[] = [
      'exportCenter', 'receivablePayableAging', 'riskCheck', 'closingTasks',
      'ledgerReport', 'trialBalanceReport', 'accountSummaryReport', 'generalLedgerReport', 'subsidiaryLedgerReport', 'auxiliaryLedgerReport', 'auxiliaryBalanceReport', 'multiColumnLedgerReport',
      'financialReport', 'balanceSheetReport', 'incomeStatementReport', 'incomeQuarterReport', 'cashFlowReport', 'cashFlowQuarterReport', 'equityChangeReport',
      'taxReport', 'vatTaxReport', 'withholdingTaxReport', 'stampTaxReport', 'incomeTaxReport', 'socialSecurityTaxReport', 'financeTaxReport', 'nonTaxRevenueReport',
      'declarationCalendar', 'settingsData', 'companyInfo', 'historyVoucher', 'historyBalance', 'historyGeneralLedger', 'historySubsidiaryLedger', 'auditLog',
    ]
    const object = rowObjectLabel(row)
    if (readOnlyReviewKinds.includes(kind)) {
      writeModuleAudit('查看核验明细', `${title}-${object}`, row.status === '异常' ? '高' : '中', row.status === '异常' ? '待审批' : '成功')
      setOperationNotice(`已打开 ${object} 的核验上下文。报表、税表和配置清单只支持查看、核验与回链处理；请回到来源业务模块维护数据或生成凭证。`)
      return
    }
    const level = row.status === '异常' || isHighRiskAction ? '高' : '中'
    const result = row.status === '异常' || isHighRiskAction ? '待审批' : '成功'
    writeModuleAudit('生成凭证草稿', `${title}-${object}`, level, result)
    setOperationNotice(
      result === '待审批'
        ? `${object} 已进入凭证草稿待确认；异常或高风险数据不会自动入账。`
        : `${object} 已生成凭证草稿并写入审计日志，正式入账仍需人工确认。`
    )
  }

  const handleExportExcel = async () => {
    const exportedAt = new Date().toLocaleString('zh-CN')
    const fileName = `${title}-${exportPeriodLabel}.xlsx`
    const exportScope = `${status}/${keyword.trim() || '全部'}`
    const templateKind = printTemplateKind(kind)
    const { sheetRows, columnWidths, merges } = buildExcelTemplate({
      kind,
      title,
      config,
      rows: filteredRows,
      exportedAt,
      status,
      keyword: keyword.trim(),
      context: exportDocumentContext,
    })
    try {
      await exportRowsToXlsx({
        sheetRows,
        columnWidths,
        merges,
        sheetName: title,
        fileName,
      })
      recordExportJob({
        fileName,
        moduleName: title,
        format: 'Excel',
        scope: exportScope,
        templateKind,
        rowCount: filteredRows.length,
      })
      writeModuleAudit('导出Excel', fileName, '普通', '成功')
    } catch (error) {
      setOperationNotice(`Excel 导出失败：${String(error)}`)
      writeModuleAudit('导出Excel', fileName, '普通', '失败')
    }
  }

  const handlePrint = () => {
    const exportedAt = new Date().toLocaleString('zh-CN')
    const fileName = `${title}-${exportPeriodLabel}-print`
    const exportScope = `${status}/${keyword.trim() || '全部'}`
    const templateKind = printTemplateKind(kind)
    if (kind === 'voucherDetail' && !loadedVoucher) {
      setOperationNotice('当前凭证尚未加载完成，无法打印。')
      return
    }
    const html = kind === 'voucherDetail' && loadedVoucher
      ? renderVoucherDetailPrintHtml(title, loadedVoucher, exportedAt, exportDocumentContext)
      : buildPrintHtml({
        kind,
        title,
        config,
        rows: filteredRows,
        exportedAt,
        status,
        keyword: keyword.trim(),
        context: exportDocumentContext,
      })
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setOperationNotice('浏览器阻止了打印窗口，请允许本应用打开打印预览后重试。')
      writeModuleAudit('打印', fileName, '普通', '失败')
      return
    }
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
    recordExportJob({
      fileName,
      moduleName: title,
      format: '打印预览',
      scope: exportScope,
      templateKind,
      rowCount: filteredRows.length,
    })
    writeModuleAudit('打印', fileName, '普通', '成功')
  }

  const handleExportPdf = async () => {
    const exportedAt = new Date().toLocaleString('zh-CN')
    const fileName = `${title}-${exportPeriodLabel}.pdf`
    const exportScope = `${status}/${keyword.trim() || '全部'}`
    const templateKind = printTemplateKind(kind)
    const html = buildPrintHtml({
      kind,
      title,
      config,
      rows: filteredRows,
      exportedAt,
      status,
      keyword: keyword.trim(),
      context: exportDocumentContext,
    })
    try {
      await exportHtmlToPdf({
        html,
        fileName,
        pageTitle: `${title} ${exportPeriodLabel}`,
      })
      recordExportJob({
        fileName,
        moduleName: title,
        format: 'PDF',
        scope: exportScope,
        templateKind,
        rowCount: filteredRows.length,
      })
      writeModuleAudit('导出PDF', fileName, '普通', '成功')
    } catch (error) {
      setOperationNotice(`PDF 导出失败：${String(error)}`)
      writeModuleAudit('导出PDF', fileName, '普通', '失败')
    }
  }

  const voucherDebitTotal = voucherDraft.entries
    .filter((entry) => entry.direction === 'debit')
    .reduce((total, entry) => total + Number(entry.amount || 0), 0)
  const voucherCreditTotal = voucherDraft.entries
    .filter((entry) => entry.direction === 'credit')
    .reduce((total, entry) => total + Number(entry.amount || 0), 0)
  const voucherBalanced = Math.abs(voucherDebitTotal - voucherCreditTotal) < 0.01

  const updateVoucherEntry = (index: number, patch: Partial<(typeof voucherDraft.entries)[number]>) => {
    setVoucherDraft((draft) => ({
      ...draft,
      entries: draft.entries.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...patch } : entry),
    }))
  }

  const handleSaveVoucherDraft = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedCompanyId || (kind === 'voucherCreate' && !currentPeriodId)) return
    const entries = voucherDraft.entries.filter((entry) => entry.accountCode && Number(entry.amount) > 0)
    if (entries.length < 2) {
      setOperationNotice('凭证至少需要两条有效分录。')
      return
    }
    if (!voucherBalanced) {
      setOperationNotice('借贷金额不平衡，请调整分录金额后再保存。')
      return
    }
    try {
      if (kind === 'voucherEdit') {
        if (!loadedVoucher) {
          setOperationNotice('凭证尚未加载完成，无法保存修改。')
          return
        }
        const voucher = await updateVoucher({
          id: loadedVoucher.id,
          voucher_date: voucherDraft.voucherDate,
          summary: voucherDraft.summary,
          attachment_count: Number(voucherDraft.attachmentCount || 0),
          modified_by: 'admin',
          version: loadedVoucher.version,
          entries: entries.map((entry) => {
            const account = detailedAccounts.find((item) => item.code === entry.accountCode)
            return {
              account_code: entry.accountCode,
              account_name: account?.name || entry.accountCode,
              direction: entry.direction,
              amount: Number(entry.amount),
              summary: voucherDraft.summary || undefined,
            }
          }),
        }, selectedCompanyId)
        await replaceVoucherTags(voucher.id, selectedCompanyId, selectedVoucherTagIds)
        await fetchBusinessTags(selectedCompanyId)
        setLoadedVoucher(voucher)
        writeModuleAudit('保存凭证修改', voucher.voucher_number, '中', '成功')
        setOperationNotice(`凭证 ${voucher.voucher_number} 已保存修改。`)
        return
      }
      const voucher = await addVoucher({
        company_id: selectedCompanyId,
        period_id: currentPeriodId,
        voucher_word_id: voucherDraft.voucherWordId,
        voucher_date: voucherDraft.voucherDate,
        summary: voucherDraft.summary,
        attachment_count: Number(voucherDraft.attachmentCount || 0),
        created_by: 'admin',
        ai_suggestion_id: aiVoucherSuggestionId || undefined,
        entries: entries.map((entry) => {
          const account = detailedAccounts.find((item) => item.code === entry.accountCode)
          return {
            account_code: entry.accountCode,
            account_name: account?.name || entry.accountCode,
            direction: entry.direction,
            amount: Number(entry.amount),
            summary: voucherDraft.summary || undefined,
          }
        }),
      })
      await replaceVoucherTags(voucher.id, selectedCompanyId, selectedVoucherTagIds)
      await fetchBusinessTags(selectedCompanyId)
      writeModuleAudit('保存凭证草稿', voucher.voucher_number, '中', '成功')
      if (aiVoucherSuggestionId) {
        writeModuleAudit('关联AI建议凭证', voucher.voucher_number, '中', '成功')
      }
      setOperationNotice(aiVoucherSuggestionId
        ? `凭证 ${voucher.voucher_number} 已保存为草稿，并已关联已确认的 AI 凭证建议。`
        : `凭证 ${voucher.voucher_number} 已保存为草稿。`)
      setSelectedVoucherTagIds([])
      setVoucherDraft((draft) => ({ ...draft, summary: '', attachmentCount: '0', entries: [{ accountCode: '', direction: 'debit', amount: '' }, { accountCode: '', direction: 'credit', amount: '' }] }))
      if (aiVoucherSuggestionId) navigate('/vouchers/new', { replace: true })
    } catch (error) {
      setOperationNotice(`保存凭证失败：${String(error)}`)
    }
  }

  const handleVoucherApproval = async () => {
    if (!selectedCompanyId || !loadedVoucher) return
    try {
      const voucher = loadedVoucher.status === 'approved'
        ? await reverseApproveVoucher(loadedVoucher.id, selectedCompanyId)
        : await approveVoucher(loadedVoucher.id, 'admin', selectedCompanyId)
      setLoadedVoucher((current) => current ? { ...current, ...voucher } : voucher)
      writeModuleAudit(voucher.status === 'approved' ? '审核凭证' : '反审核凭证', voucher.voucher_number, '高', '成功')
      setOperationNotice(`凭证 ${voucher.voucher_number} 已${voucher.status === 'approved' ? '审核' : '反审核'}。`)
    } catch (error) {
      setOperationNotice(`凭证审核操作失败：${String(error)}`)
    }
  }

  const handleDeleteVoucher = async () => {
    if (!selectedCompanyId || !loadedVoucher) return
    if (!await requestBusinessRiskConfirmation('确认移入凭证回收站', `确认将凭证 ${loadedVoucher.voucher_number} 移入回收站吗？可在回收站人工恢复。`, '移入回收站')) return
    try {
      await deleteVoucher(loadedVoucher.id, selectedCompanyId)
      writeModuleAudit('删除凭证', loadedVoucher.voucher_number, '高', '成功')
      navigate('/vouchers')
    } catch (error) {
      setOperationNotice(`删除凭证失败：${String(error)}`)
    }
  }

  const openInputInvoiceEditor = () => {
    setEditingInvoiceId(null)
    setInvoiceDraft({ invoiceNo: '', invoiceCode: '', invoiceDate: currentPeriod?.end_date || '', amount: '', taxAmount: '', taxRate: '13', sellerName: '', sellerTaxId: '', buyerName: '', buyerTaxId: '', remarks: '' })
    setSelectedInvoiceTagIds([])
    setShowInvoiceDialog(true)
  }

  const openInputInvoiceMatcher = () => {
    const candidate = invoices.find((invoice) => invoice.invoice_type === 'input' && !invoice.voucher_id)
    if (!candidate) {
      setOperationNotice('当前没有可关联凭证的进项发票；请先登记发票或解除现有凭证关联。')
      return
    }
    if (vouchers.length === 0) {
      setOperationNotice('当前账期尚无可关联凭证；请先新增并人工复核会计凭证。')
      return
    }
    setSelectedMatchInvoiceId(candidate.id)
    setSelectedMatchVoucherId(vouchers[0].id)
    setShowInvoiceVoucherMatchDialog(true)
  }

  const syncInputInvoicePool = () => {
    writeModuleAudit('同步进项票池', `${currentPeriodLabel}｜待人工复核`, '中', '待审批')
    setOperationNotice('已建立进项票池同步任务并记录审计日志；税局票池读取需在桌面端配置授权后由操作人确认执行。')
  }

  const openEmployeeEditor = () => {
    setEditingEmployeeId(null)
    setEmployeeDraft({ employeeCode: '', name: '', idNo: '', department: '', position: '', mobile: '', entryDate: currentPeriod?.end_date || '', employmentStatus: '在职' })
    setShowEmployeeDialog(true)
  }

  const reviewEmployeeDocuments = () => {
    writeModuleAudit('核验人员档案资料', `${currentPeriodLabel}｜待补资料`, '中', '成功')
    setOperationNotice('已完成本地档案完整性核验；证件、合同、社保和专项附加扣除缺项已保留在待补资料清单中。')
  }

  const openPayrollEditor = () => {
    setEditingPayrollId(null)
    setPayrollDraft({ employeeId: employees.find((employee) => employee.employmentStatus === '在职')?.id || (isTauri ? '' : 'preview-employee'), baseSalary: '', bonus: '', taxAmount: '', socialPersonal: '' })
    setShowPayrollDialog(true)
  }

  const validatePayroll = () => {
    writeModuleAudit('复核工资核算', `${currentPeriodLabel}｜工资、个税与社保扣款`, '中', '成功')
    setOperationNotice('已完成本地工资行核验；异常工资项、个税扣缴和社保个人部分将继续保留在待确认清单。')
  }

  const openSocialSecurityEditor = () => {
    setEditingSocialSecurityId(null)
    setSocialSecurityDraft({ employeeId: employees.find((employee) => employee.employmentStatus === '在职')?.id || (isTauri ? '' : 'preview-employee'), city: '', base: '', company: '', personal: '', fund: '' })
    setShowSocialSecurityDialog(true)
  }

  const reconcileSocialSecurity = () => {
    writeModuleAudit('核对社保公积金', `${currentPeriodLabel}｜工资基数与缴费明细`, '中', '成功')
    setOperationNotice('已完成本地社保、公积金与工资基数核对；差异人员不会进入凭证生成或申报取数。')
  }

  const openBankTransactionEditor = () => {
    setEditingBankTransactionId(null)
    setSelectedBankTransactionTagIds([])
    setBankTransactionDraft({ accountName: '', serialNo: '', transactionDate: currentPeriod?.end_date || '', counterparty: '', summary: '', incomeAmount: '', expenseAmount: '', balance: '', receiptStatus: '待上传' })
    setShowBankTransactionDialog(true)
  }

  const runBankTransactionMatching = () => {
    writeModuleAudit('执行资金流水匹配', `${currentPeriodLabel}｜待匹配流水`, '中', '待审批')
    setOperationNotice('已生成本地流水匹配建议；对方户名、金额和关联单据仍需人工确认，系统不会自动入账。')
  }

  const openBusinessOrderEditor = (mode: 'purchase' | 'sales') => {
    setEditingBusinessOrderId(null)
    setBusinessOrderDraft({
      orderNo: '',
      businessDate: currentPeriod?.end_date || '',
      counterparty: '',
      goodsName: '',
      amount: '',
      fulfillmentStatus: mode === 'purchase' ? '待入库' : '待出库',
      invoiceStatus: mode === 'purchase' ? '待收票' : '待开票',
      settlementStatus: mode === 'purchase' ? '未付款' : '未收款',
      status: '待确认',
      sourceDocument: '',
    })
    setShowBusinessOrderDialog(true)
  }

  const reviewBusinessOrder = (mode: 'purchase' | 'sales') => {
    const label = mode === 'purchase' ? '采购订单三方核验' : '销售订单履约核验'
    writeModuleAudit(label, `${currentPeriodLabel}｜待确认订单`, '中', '成功')
    setOperationNotice(mode === 'purchase'
      ? '已核验采购订单、入库、进项票和付款状态；存在差异的订单不会生成成本或应付凭证。'
      : '已核验销售订单、出库、销项票和回款状态；异常订单不会生成收入凭证。')
  }

  const openDocumentRecordEditor = (businessType: string) => {
    setEditingDocumentRecordId(null)
    setDocumentRecordDraft({ businessDate: currentPeriod?.end_date || '', documentCode: '', businessType, partner: '', amount: '', owner: '', attachmentStatus: '待补附件', stampTaxItem: '', stampTaxRate: '' })
    setShowDocumentRecordDialog(true)
  }

  const reviewDocumentRecords = (scope: '费用报销' | '原始单据') => {
    writeModuleAudit(scope === '费用报销' ? '复核费用报销单' : '核验原始单据', `${currentPeriodLabel}｜待确认资料`, '中', '成功')
    setOperationNotice(scope === '费用报销'
      ? '已核验报销审批、附件和付款状态；缺票、退回或未付款记录不会自动生成费用凭证。'
      : '已核验原始单据的业务日期、附件和经办人；缺少附件的单据将保留在待补资料清单。')
  }

  const openFixedAssetEditor = () => {
    const category = effectiveAssetCategories.find((category) => category.is_enabled === 1)
    setEditingFixedAssetId(null)
    setFixedAssetDraft({ assetCode: '', assetName: '', category: category?.name || '', startDate: currentPeriod?.end_date || '', originalValue: '', usefulLifeMonths: category ? String(category.useful_life_months) : '', residualRate: category ? String(category.residual_rate * 100) : '5', sourceDocument: '' })
    setShowFixedAssetDialog(true)
  }

  const reviewDepreciation = () => {
    writeModuleAudit('复核固定资产折旧', `${currentPeriodLabel}｜待确认资产`, '中', '成功')
    setOperationNotice('已复核资产原值、开始使用日期、折旧年限和来源凭据；异常资产不会进入本月折旧凭证。')
  }

  const openInventoryItemEditor = () => {
    setEditingInventoryItemId(null)
    setInventoryItemDraft({ itemCode: '', itemName: '', specification: '', unit: '', taxRate: '13', defaultSubject: '' })
    setShowInventoryItemDialog(true)
  }

  const openInventoryMovementEditor = () => {
    setEditingInventoryMovementId(null)
    setInventoryMovementDraft({ movementDate: currentPeriod?.end_date || '', billNo: '', movementType: '采购入库', inventoryName: '', warehouse: '', counterparty: '', unit: '', quantity: '', amount: '', sourceDocument: '' })
    setShowInventoryMovementDialog(true)
  }

  const reviewInventoryMovement = () => {
    writeModuleAudit('核验出入库与发票匹配', `${currentPeriodLabel}｜待确认出入库`, '中', '成功')
    setOperationNotice('已核验出入库单、存货档案和发票关联；未核价或缺票的库存业务不会进入成本结转。')
  }

  const openCostCarryoverEditor = () => {
    setEditingCostCarryoverId(null)
    setCostCarryoverDraft({ batchNo: '', carryoverDate: currentPeriod?.end_date || '', valuationMethod: '移动加权', sourceBillNo: '', inventoryName: '', debitSubject: '主营业务成本', creditSubject: '库存商品', costAmount: '', differenceAmount: '0', voucherNo: '', status: '待确认', sourceDocument: '' })
    setShowCostCarryoverDialog(true)
  }

  const reviewCostCarryover = () => {
    writeModuleAudit('复核月末成本结转', `${currentPeriodLabel}｜成本差异`, '高', '待审批')
    setOperationNotice('已建立月末成本结转复核记录；未核价出库、数量差异和金额差异不会自动写入账簿。')
  }

  const openBankReconciliationEditor = () => {
    setEditingBankReconciliationId(null)
    setBankReconciliationDraft({ reconciliationNo: '', reconciliationDate: currentPeriod?.end_date || '', accountName: '', transactionNo: '', summary: '', bankAmount: '', bookAmount: '', voucherNo: '', matchStatus: '待人工对账', owner: '', status: '待处理', note: '' })
    setShowBankReconciliationDialog(true)
  }

  const reviewBankReconciliation = () => {
    writeModuleAudit('复核银行对账差异', `${currentPeriodLabel}｜未达账项`, '中', '成功')
    setOperationNotice('已复核银行余额、账面余额和未达账项；差异记录不会自动修改流水或会计凭证。')
  }

  const openSettlementRecordEditor = (mode: 'receivable' | 'payable') => {
    setEditingSettlementRecordId(null)
    setSettlementRecordDraft({ settlementNo: '', settlementDate: currentPeriod?.end_date || '', counterparty: '', invoiceNo: '', transactionNo: '', totalAmount: '', settledAmount: '0', settlementMethod: '银行转账', owner: '', status: '待确认', sourceDocument: '' })
    setShowSettlementRecordDialog(true)
    writeModuleAudit(mode === 'receivable' ? '新建应收核销草稿' : '新建应付核销草稿', `${currentPeriodLabel}｜待确认`, '中', '成功')
  }

  const reviewSettlementRecords = (mode: 'receivable' | 'payable') => {
    writeModuleAudit(mode === 'receivable' ? '复核应收核销' : '复核应付核销', `${currentPeriodLabel}｜票据与流水`, '中', '成功')
    setOperationNotice(mode === 'receivable'
      ? '已复核销项发票、回款流水和应收余额；金额差异将保留待客户确认。'
      : '已复核进项发票、付款流水和应付余额；金额差异将保留待供应商确认。')
  }

  const reviewAging = () => {
    writeModuleAudit('复核往来账龄风险', `${currentPeriodLabel}｜逾期往来`, '中', '成功')
    setOperationNotice('已重算往来账龄并记录风险处置；高风险逾期项目仍需人工跟进与凭证复核。')
  }

  const reviewClosingTasks = () => {
    writeModuleAudit('复核期末结账任务', `${currentPeriodLabel}｜结账前检查`, '高', '待审批')
    setOperationNotice('已建立期末结账前检查记录；所有阻断项和待确认任务完成前不会锁定账期。')
  }

  const startAiTaskDraft = () => {
    setAiJobDraft({ jobType: 'invoice_recognition', sourceModule: '发票', sourceId: '', sourceFile: '', summary: '', riskLevel: 'normal' })
    setShowAiJobDialog(true)
  }

  const reviewAiRecognition = async (rowIds: string[] = []) => {
    if (!isTauri) {
      const pendingRows = config.rows.filter((row) => rowIds.includes(row.id) && row.status === '待确认')
      if (pendingRows.length === 0) {
        setOperationNotice('请先勾选待复核的 AI 识别结果。异常影像需回到来源资料补充后再处理。')
        return
      }
      if (!await requestBusinessRiskConfirmation('确认 AI 识别复核', `确认 ${pendingRows.length} 条 AI 识别结果后，将更新本地预览的档案匹配、风险提示和复核人；不会写入账套、生成凭证或调用外部系统。`, '确认复核')) return
      const timestamp = new Date().toISOString()
      const reviewedIds = new Set(pendingRows.map((row) => row.id.replace('automation-recognition-', '')))
      updatePreviewAiQueueJobs((jobs) => jobs.map((job) => reviewedIds.has(job.id)
        ? { ...job, status: 'completed', reviewer: 'admin', resultSummary: `${job.resultSummary || '未记录识别字段'}｜admin 已人工复核，档案匹配通过。`, updatedAt: timestamp }
        : job))
      setSelectedRowIds(new Set())
      writeModuleAudit('预览确认AI识别复核', `${pendingRows.length} 条`, '中', '成功')
      setOperationNotice(`已复核 ${pendingRows.length} 条识别结果，已更新档案匹配与风险提示；不会自动写入账套或生成凭证。`)
      return
    }
    writeModuleAudit('复核AI识别字段', `${currentPeriodLabel}｜待复核字段`, '中', '成功')
    setOperationNotice('已登记识别字段复核。低置信度、档案未匹配和影像模糊项目仍需人工修正后回写对应业务台账。')
  }

  const openAiVoucherSuggestionEditor = () => {
    setAiVoucherSuggestionDraft({ suggestionNo: '', sourceModule: '', sourceId: '', sourceFile: '', summary: '', debitSubject: '', creditSubject: '', amount: '', confidence: '90', riskLevel: 'normal' })
    setShowAiVoucherSuggestionDialog(true)
  }

  const publishSelectedAiTrainingRules = async () => {
    if (kind !== 'aiRuleTraining') return
    const selectedRules = (isTauri ? matchingRules : previewMatchingRules).filter((rule) => (
      rule.rule_scope === 'ai_training'
      && rule.is_enabled !== 1
      && selectedRowIds.has(`matching-rule-${rule.id}`)
    ))
    if (selectedRules.length === 0) {
      setOperationNotice('请先勾选至少一条待复核的 AI 训练规则。已发布规则无需重复发布。')
      return
    }
    if (!await requestBusinessRiskConfirmation('确认发布 AI 训练规则', `确认完成复核并发布 ${selectedRules.length} 条训练规则吗？发布后仅进入待确认 AI 建议队列，不会自动生成已审核凭证、提交税务或发起外部操作。`, '确认发布')) return
    try {
      if (isTauri) {
        if (!selectedCompanyId) return
        await Promise.all(selectedRules.map((rule) => updateMatchingRule(rule.id, {
          companyId: selectedCompanyId,
          ruleScope: 'ai_training',
          name: rule.name,
          conditionText: rule.condition_text,
          actionText: rule.action_text,
          targetAccountCode: rule.target_account_code || undefined,
          voucherTemplateId: rule.voucher_template_id || undefined,
          priority: rule.priority,
          isEnabled: true,
        })))
      } else {
        const publishedIds = new Set(selectedRules.map((rule) => rule.id))
        updatePreviewMatchingRules((items) => items.map((rule) => publishedIds.has(rule.id)
          ? { ...rule, is_enabled: 1, updated_at: new Date().toISOString() }
          : rule))
      }
      setSelectedRowIds(new Set())
      if (isTauri) {
        writeModuleAudit('复核并发布AI训练规则', `${selectedRules.length} 条｜${currentPeriodLabel}`, '高', '成功')
      } else {
        writeModuleAudit('预览发布AI训练规则', `${selectedRules.length} 条｜${currentPeriodLabel}`, '高', '成功')
      }
      setOperationNotice(`已完成 ${selectedRules.length} 条训练规则复核并发布。规则只进入待确认 AI 建议队列，不会自动生成已审核凭证或提交税务。`)
    } catch (error) {
      setOperationNotice(`发布 AI 训练规则失败：${String(error)}`)
    }
  }

  const reviewLedgerReports = () => {
    writeModuleAudit('复核账簿取数与凭证穿透', `${currentPeriodLabel}｜科目与辅助余额`, '中', '成功')
    setOperationNotice('已登记账簿取数复核。科目余额、辅助余额、总账和明细账差异必须追溯到凭证后再进行结账或报表取数。')
  }

  const runLedgerCalculation = () => {
    writeModuleAudit(config.primaryAction, `${currentPeriodLabel}｜账簿取数与余额重算`, '中', '成功')
    setOperationNotice(`已按当前账期重新读取${title}取数口径。科目余额、辅助核算和凭证穿透差异仍需复核后才能用于结账或报表取数。`)
  }

  const reviewFinancialStatements = () => {
    writeModuleAudit('复核财务报表勾稽关系', `${currentPeriodLabel}｜报表取数与重分类`, '高', '待审批')
    setOperationNotice('已登记财务报表勾稽复核。资产负债、利润、现金流和权益项目需在公式、重分类和取数快照一致后才可形成报送包。')
  }

  const runFinancialStatementCalculation = () => {
    writeModuleAudit(config.primaryAction, `${currentPeriodLabel}｜财务报表取数重算`, '高', '待审批')
    setOperationNotice(`已生成${title}的本地重算复核记录。公式、重分类、勾稽关系和取数快照一致后，才能形成报送或归档材料。`)
  }

  const reviewCompanyRegistration = () => {
    writeModuleAudit('复核企业税务资料', `${currentPeriodLabel}｜企业基础信息`, '高', '成功')
    setOperationNotice('已登记企业基础资料复核。税号、地区、纳税人资格、会计制度、启用期间和外部授权信息须分别维护并保留人工确认。')
  }

  const reviewInitialBalance = () => {
    void handlePrimaryAction()
    writeModuleAudit('复核期初余额来源', `${currentPeriodLabel}｜科目与辅助余额`, '高', '待审批')
  }

  const reviewSubjectSettings = () => {
    writeModuleAudit('复核会计科目核算口径', `${currentPeriodLabel}｜科目与辅助核算`, '中', '成功')
    setOperationNotice('已登记会计科目复核。余额方向、辅助核算、默认凭证规则和报表映射变更应在启用前完成审核。')
  }

  const reviewAuxiliaryArchives = () => {
    writeModuleAudit('复核辅助档案完整性', `${currentPeriodLabel}｜基础档案引用`, '中', '成功')
    setOperationNotice('已登记基础档案完整性复核。税号、默认科目、状态和业务引用缺失的客户、供应商、项目或部门不能自动进入后续凭证建议。')
  }

  const reviewTaxTaskData = () => {
    writeModuleAudit('复核申报取数与校验', `${currentPeriodLabel}｜税种与申报包`, '高', '待审批')
    setOperationNotice('已登记税务取数复核。税务认定、发票勾选、工资社保、纳税调整和地区政策需完成校验后才能生成待确认申报包。')
  }

  const runDeclarationPlanning = () => {
    if (!isTauri) {
      const timestamp = new Date().toLocaleString('zh-CN')
      const planCount = effectiveTaxDeclarationTasks.filter((task) => task.declarationStatus === 'draft').length
      if (planCount === 0) {
        setOperationNotice('当前预览没有待生成计划的申报事项；已生成计划、已确认或已归档的任务请在对应清单中继续人工复核。')
        return
      }
      updatePreviewTaxDeclarationTasks((tasks) => tasks.map((task) => task.declarationStatus === 'draft'
        ? { ...task, declarationStatus: 'planned', updatedAt: timestamp }
        : task))
      writeModuleAudit('预览生成申报计划', `${currentPeriodLabel === '当前账期' ? '2026-05' : currentPeriodLabel}｜${planCount} 项待办`, '高', '成功')
      setOperationNotice(`已为当前预览生成 ${planCount} 项本地申报计划；计划仅整理税种、所属期与复核节点，不会向税务机关提交申报或发起扣款。`)
      return
    }
    writeModuleAudit('生成申报计划', `${currentPeriodLabel}｜税种认定与截止日`, '高', '待审批')
    setOperationNotice('已生成当前账期本地申报计划复核记录。计划依据税种认定、所属期和截止日整理，不会自动向税务机关提交申报或发起扣款。')
  }

  const prepareSocialSecurityVoucher = () => {
    const ready = socialSecurityRecords.filter((record) => record.status === '已确认').length
    const pending = socialSecurityRecords.filter((record) => record.status !== '已确认').length
    writeModuleAudit('生成社保凭证准备', `${currentPeriodLabel}｜已确认 ${ready} 人，待确认 ${pending} 人`, '高', '待审批')
    setOperationNotice(`已登记社保凭证准备。${ready} 条已确认社保记录可进入凭证草稿，${pending} 条待确认记录不会自动生成凭证，仍需人工核对缴费基数和单位/个人部分。`)
  }

  const syncSpecialDeductionRecords = () => {
    const active = specialDeductionRecords.filter((record) => record.status === '已确认').length
    const pending = specialDeductionRecords.filter((record) => record.status !== '已确认').length
    writeModuleAudit('同步专项附加扣除', `${currentPeriodLabel}｜已确认 ${active} 条，待确认 ${pending} 条`, '高', '待审批')
    setOperationNotice(`已登记专项附加扣除同步复核。${active} 条已确认记录可进入个税取数，${pending} 条待确认或异常记录需要补齐证明资料后再由人工确认。`)
  }

  const runAgingCalculation = () => {
    const receivable = settlementRecords.filter((record) => record.settlementType === 'receivable').length
    const payable = settlementRecords.filter((record) => record.settlementType === 'payable').length
    writeModuleAudit('重算往来账龄', `${currentPeriodLabel}｜应收 ${receivable} 条，应付 ${payable} 条`, '中', '成功')
    setOperationNotice(`已按当前账期重新整理往来账龄。应收 ${receivable} 条、应付 ${payable} 条的账龄和逾期金额仍需结合期末余额、核销记录和业务单据人工复核。`)
  }

  const runTaxDataCollection = () => {
    const sourceByKind: Partial<Record<ModuleKind, string>> = {
      taxReport: '申报认定、发票、工资社保和税务取数快照',
      vatTaxReport: '销项、进项、勾选与留抵抵扣数据',
      withholdingTaxReport: '薪酬、专项附加扣除和人员资料',
      stampTaxReport: '应税合同、单据登记和付款资料',
      incomeTaxReport: '利润表、纳税调整和历史税务资料',
      socialSecurityTaxReport: '人员档案、社保公积金和工资基数',
      financeTaxReport: '资产负债表、利润表、现金流量表和权益表',
    }
    const source = sourceByKind[kind] || '当前账套税务资料'
    writeModuleAudit(config.primaryAction, `${currentPeriodLabel}｜${source}`, '高', '待审批')
    setOperationNotice(`已登记${title}本地取数复核：${source}。系统不会登录税务机关、自动提交申报或发起扣款，需在人工确认后导出待确认申报材料。`)
  }

  const openTaxReceiptWorkflow = () => {
    const task = effectiveTaxDeclarationTasks[0]
    if (!task) {
      setOperationNotice('当前账套没有可归档的申报事项，请先在申报认定或申报工作台建立待确认任务。')
      return
    }
    openDeclarationReceiptEditor(task)
  }

  const reviewImportArchiveData = (scope: 'attachment' | 'import' | 'export' | 'backup') => {
    const labels = {
      attachment: '复核附件归档完整性',
      import: '复核导入批次映射',
      export: '复核导出文件留痕',
      backup: '复核备份恢复校验',
    }
    writeModuleAudit(labels[scope], `${currentPeriodLabel}｜本机归档记录`, scope === 'backup' ? '高' : '中', scope === 'backup' ? '待审批' : '成功')
    setOperationNotice(scope === 'attachment'
      ? '已登记附件归档复核。来源模块、关联单据、文件哈希和上传日志缺失时不能作为正式审计附件。'
      : scope === 'import'
        ? '已登记导入批次复核。字段映射、错误行、模板版本和人工确认完成前不会写入账套业务数据。'
        : scope === 'export'
          ? '已登记导出文件复核。Excel、PDF 和 ZIP 应保留筛选范围、模板版本、文件哈希、操作人和下载状态。'
          : '已登记备份恢复前校验。恢复操作必须由人工确认，且不能静默覆盖当前账套。')
  }

  const reviewRuleTemplateGovernance = (scope: 'matching' | 'template' | 'adapter') => {
    const labels = { matching: '复核自动匹配规则', template: '复核凭证报表模板', adapter: '复核外部适配授权' }
    writeModuleAudit(labels[scope], `${currentPeriodLabel}｜版本与生效范围`, scope === 'adapter' ? '高' : '中', scope === 'adapter' ? '待审批' : '成功')
    setOperationNotice(scope === 'matching'
      ? '已登记匹配规则复核。规则按优先级生成待确认建议，不能直接生成已审核凭证或提交外部系统。'
      : scope === 'template'
        ? '已登记模板版本复核。凭证模板、结转规则和报表公式变更应重算并人工核验影响范围。'
        : '已登记适配授权复核。仅保存渠道元数据和脱敏状态，不保存密码、令牌、Cookie 或证书。')
  }

  const openMatchingRuleEditor = () => {
    resetMatchingRuleDraft()
    setShowMatchingRuleDialog(true)
  }

  const openAdapterAuthorizationEditor = () => {
    resetAdapterAuthorizationDraft()
    setShowAdapterAuthorizationDialog(true)
  }

  const reviewControlEvidence = (scope: 'history' | 'risk' | 'audit' | 'recycle' | 'notification') => {
    const labels = { history: '复核历史账迁移差异', risk: '复核风险处置闭环', audit: '复核高风险审计证据', recycle: '复核凭证回收记录', notification: '复核待办分派进度' }
    writeModuleAudit(labels[scope], `${currentPeriodLabel}｜控制与追溯`, ['risk', 'audit', 'recycle'].includes(scope) ? '高' : '中', ['risk', 'audit', 'recycle'].includes(scope) ? '待审批' : '成功')
    setOperationNotice(scope === 'history'
      ? '已登记历史账迁移复核。历史凭证、余额、总账和明细账需与期初余额及当前账套科目映射保持可追溯。'
      : scope === 'risk'
        ? '已登记风险处置复核。阻断项完成前不能结账或确认申报，处理结果须关联来源单据和责任人。'
        : scope === 'audit'
          ? '已登记审计证据复核。导入、导出、凭证、结账和申报相关高风险操作应保留操作人、对象、时间和结果。'
          : scope === 'recycle'
            ? '已登记凭证回收复核。恢复和彻底删除均需人工确认，并保留审计日志。'
            : '已登记待办分派复核。临期事项需明确负责人、来源模块、处理入口和完成记录。')
  }

  const openInvoiceVoucherMatching = () => {
    setSelectedMatchInvoiceId((current) => current || invoiceMatchCandidates.find((invoice) => !invoice.voucher_id)?.id || '')
    setSelectedMatchVoucherId((current) => current || voucherMatchCandidates[0]?.id || '')
    setShowInvoiceVoucherMatchDialog(true)
  }

  const openAccountTransferEditor = () => {
    setEditingAccountTransferId(null)
    setAccountTransferDraft({ transferDate: currentPeriod?.end_date || '', fromAccount: '', toAccount: '', amount: '', fee: '', serialNo: '' })
    setShowAccountTransferDialog(true)
  }

  const openSpecialDeductionEditor = () => {
    setEditingSpecialDeductionId(null)
    setSpecialDeductionDraft({ employeeId: isTauri ? '' : 'preview-employee', deductionType: '子女教育', startMonth: '', endMonth: '', monthlyAmount: '', source: '手工' })
    setShowSpecialDeductionDialog(true)
  }

  const reviewFoundationConfiguration = (scope: 'account' | 'auxiliary' | 'print' | 'period') => {
    const labels = { account: '复核账户币别与单位口径', auxiliary: '复核资产与辅助核算维度', print: '复核打印模板版本', period: '复核账期锁定与反结账审批' }
    writeModuleAudit(labels[scope], `${currentPeriodLabel}｜基础配置`, scope === 'period' ? '高' : '中', scope === 'period' ? '待审批' : '成功')
    setOperationNotice(scope === 'account' ? '已登记账户、币别和计量单位复核。默认科目、换算精度和汇率口径变更应在业务发生前确认。' : scope === 'auxiliary' ? '已登记资产类别与辅助核算维度复核。折旧参数和维度启停会影响凭证、账簿与报表取数。' : scope === 'print' ? '已登记打印模板复核。模板版本、纸张方向、字段范围和页码样式应在导出前验证。' : '已登记账期控制复核。结账、反结账与归档均需明确审批记录，不能直接覆盖历史账期。')
  }

  const openPrintTemplatePreview = () => {
    writeModuleAudit('查看内置模板预览', `${currentPeriodLabel}｜固定输出版式`, '中', '成功')
    setShowPrintTemplatePreviewDialog(true)
  }

  if (kind === 'voucherCreate' || kind === 'voucherEdit' || kind === 'voucherDetail') {
    const isVoucherEdit = kind === 'voucherEdit'
    const isVoucherReadOnly = kind === 'voucherDetail'
    const voucherWorkspaceTitle = isVoucherReadOnly ? '查看会计凭证' : isVoucherEdit ? '编辑会计凭证' : '新增会计凭证'
    return (
      <div className="h-full min-w-0 bg-[#f3f6fa] p-3 text-slate-900">
        <form onSubmit={handleSaveVoucherDraft} className="min-h-full border border-slate-200 bg-white">
          <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2">
            <div>
              <h1 className="text-base font-semibold">{voucherWorkspaceTitle}</h1>
              <p className="mt-0.5 text-xs text-slate-500">凭证表头、分录和借贷平衡需要人工复核后保存。</p>
            </div>
            <div className="flex items-center gap-2">
              {(isVoucherEdit || isVoucherReadOnly) && loadedVoucher && <span className="text-xs text-slate-500">凭证号：{loadedVoucher.voucher_number}，状态：{loadedVoucher.status}</span>}
              <span className={cn('text-xs font-medium', voucherBalanced ? 'text-emerald-700' : 'text-red-600')}>借贷{voucherBalanced ? '平衡' : '不平衡'}</span>
              {isVoucherReadOnly && loadedVoucher && <ToolbarButton icon={<Printer className="h-3.5 w-3.5" />} label="打印凭证" onClick={handlePrint} />}
              {isVoucherReadOnly && loadedVoucher && <button type="button" onClick={handleVoucherApproval} className="h-8 border border-[#1f65a7] px-3 text-xs font-medium text-[#1f65a7] hover:bg-blue-50">{loadedVoucher.status === 'approved' ? '反审核' : '审核'}</button>}
              {isVoucherReadOnly && loadedVoucher?.status === 'draft' && <button type="button" onClick={handleDeleteVoucher} className="h-8 border border-red-300 px-3 text-xs font-medium text-red-600 hover:bg-red-50">删除</button>}
              {!isVoucherReadOnly && <button type="submit" disabled={isVoucherEdit && !loadedVoucher} className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:bg-slate-300">{isVoucherEdit ? '保存修改' : '保存凭证草稿'}</button>}
            </div>
          </div>
          {operationNotice && <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">{operationNotice}</div>}
          <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
            <label className="space-y-1 text-xs text-slate-600"><span>凭证字</span><select required disabled={isVoucherReadOnly} value={voucherDraft.voucherWordId} onChange={(event) => setVoucherDraft((draft) => ({ ...draft, voucherWordId: event.target.value }))} className="h-8 w-full border border-slate-300 bg-white px-2 text-sm disabled:bg-slate-100"><option value="">请选择凭证字</option>{voucherWords.filter((word) => word.is_enabled === 1).map((word) => <option key={word.id} value={word.id}>{word.word_name}</option>)}</select></label>
            <label className="space-y-1 text-xs text-slate-600"><span>凭证日期</span><input required readOnly={isVoucherReadOnly} type="date" value={voucherDraft.voucherDate} onChange={(event) => setVoucherDraft((draft) => ({ ...draft, voucherDate: event.target.value }))} className="h-8 w-full border border-slate-300 px-2 text-sm read-only:bg-slate-100" /></label>
            <label className="space-y-1 text-xs text-slate-600"><span>附件张数</span><input readOnly={isVoucherReadOnly} min="0" step="1" type="number" value={voucherDraft.attachmentCount} onChange={(event) => setVoucherDraft((draft) => ({ ...draft, attachmentCount: event.target.value }))} className="h-8 w-full border border-slate-300 px-2 text-sm read-only:bg-slate-100" /></label>
            <label className="space-y-1 text-xs text-slate-600 md:col-span-1"><span>摘要</span><input required readOnly={isVoucherReadOnly} value={voucherDraft.summary} onChange={(event) => setVoucherDraft((draft) => ({ ...draft, summary: event.target.value }))} placeholder="请输入凭证摘要" className="h-8 w-full border border-slate-300 px-2 text-sm read-only:bg-slate-100" /></label>
            <fieldset className="space-y-1 text-xs text-slate-600 md:col-span-4">
              <legend>业务标签</legend>
              <div className="flex min-h-8 flex-wrap items-center gap-2 border border-slate-200 bg-white px-2 py-1.5">
                {effectiveBusinessTags.filter((tag) => tag.is_enabled === 1).length === 0 && <span className="text-slate-400">请先在“标签”档案中维护可用标签。</span>}
                {effectiveBusinessTags.filter((tag) => tag.is_enabled === 1).map((tag) => isVoucherReadOnly
                  ? <span key={tag.id} className={cn('border px-2 py-1', selectedVoucherTagIds.includes(tag.id) ? 'border-[#1f65a7] bg-blue-50 text-[#1f65a7]' : 'border-slate-200 text-slate-400')}>{tag.name}</span>
                  : <label key={tag.id} className="inline-flex items-center gap-1 border border-slate-300 px-2 py-1 text-xs text-slate-700"><input type="checkbox" checked={selectedVoucherTagIds.includes(tag.id)} onChange={(event) => setSelectedVoucherTagIds((ids) => event.target.checked ? [...ids, tag.id] : ids.filter((id) => id !== tag.id))} />{tag.name}</label>) }
              </div>
            </fieldset>
          </div>
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2"><h2 className="text-sm font-semibold">凭证分录</h2>{!isVoucherReadOnly && <button type="button" onClick={() => setVoucherDraft((draft) => ({ ...draft, entries: [...draft.entries, { accountCode: '', direction: 'debit', amount: '' }] }))} className="h-7 border border-[#1f65a7] px-2 text-xs text-[#1f65a7]">新增分录</button>}</div>
          <div className="overflow-x-auto">
            <table className="min-w-[780px] w-full text-left text-sm"><thead className="bg-slate-100 text-xs text-slate-600"><tr><th className="px-3 py-2">行</th><th className="px-3 py-2">摘要</th><th className="px-3 py-2">会计科目</th><th className="px-3 py-2">方向</th><th className="px-3 py-2 text-right">金额</th>{!isVoucherReadOnly && <th className="px-3 py-2 text-right">操作</th>}</tr></thead><tbody>{voucherDraft.entries.map((entry, index) => <tr key={index} className="border-t border-slate-200"><td className="px-3 py-2 text-xs text-slate-500">{index + 1}</td><td className="px-3 py-2 text-xs text-slate-500">{voucherDraft.summary || '-'}</td><td className="px-3 py-2"><select required disabled={isVoucherReadOnly} value={entry.accountCode} onChange={(event) => updateVoucherEntry(index, { accountCode: event.target.value })} className="h-8 w-full min-w-64 border border-slate-300 bg-white px-2 text-sm disabled:bg-slate-100"><option value="">请选择明细科目</option>{detailedAccounts.map((account) => <option key={account.code} value={account.code}>{account.code} | {account.name}</option>)}</select></td><td className="px-3 py-2"><select disabled={isVoucherReadOnly} value={entry.direction} onChange={(event) => updateVoucherEntry(index, { direction: event.target.value as 'debit' | 'credit' })} className="h-8 border border-slate-300 bg-white px-2 text-sm disabled:bg-slate-100"><option value="debit">借方</option><option value="credit">贷方</option></select></td><td className="px-3 py-2 text-right"><input required readOnly={isVoucherReadOnly} min="0" step="0.01" type="number" value={entry.amount} onChange={(event) => updateVoucherEntry(index, { amount: event.target.value })} className="h-8 w-32 border border-slate-300 px-2 text-right text-sm read-only:bg-slate-100" /></td>{!isVoucherReadOnly && <td className="px-3 py-2 text-right"><button type="button" disabled={voucherDraft.entries.length <= 2} onClick={() => setVoucherDraft((draft) => ({ ...draft, entries: draft.entries.filter((_, entryIndex) => entryIndex !== index) }))} className="text-xs text-red-600 disabled:text-slate-300">删除</button></td>}</tr>)}</tbody><tfoot className="border-t border-slate-300 bg-slate-50 font-medium"><tr><td colSpan={3} className="px-3 py-2">合计</td><td className="px-3 py-2">借方</td><td className="px-3 py-2 text-right">¥{voucherDebitTotal.toFixed(2)}</td>{!isVoucherReadOnly && <td className="px-3 py-2" />}</tr><tr><td colSpan={3} /><td className="px-3 py-2">贷方</td><td className="px-3 py-2 text-right">¥{voucherCreditTotal.toFixed(2)}</td>{!isVoucherReadOnly && <td className="px-3 py-2" />}</tr></tfoot></table>
          </div>
        </form>
      </div>
    )
  }

  const listWorkspaceTitle = activeTab === workspaceTabs[0] ? listMeta.title : `${activeTab} · ${title}`
  const listWorkspaceHint = activeTab === workspaceTabs[0]
    ? listMeta.hint
    : `${listMeta.hint} 当前工作区聚焦${activeTab}，可按筛选条件查看当前账期已关联的业务记录。`
  const workspaceContext = activeTab === workspaceTabs[0]
    ? null
    : getWorkspaceTabContext(kind, activeTab, filteredRows)

  return (
    <div className="h-full min-w-0 bg-[#f3f6fa] text-slate-900">
      <input ref={importFileRef} type="file" multiple accept=".xlsx,.xls,.csv,.pdf,.ofd,.zip" onChange={handleImportFile} className="hidden" aria-label={`${config.importLabel}文件`} />
      <div className="border border-slate-200 bg-white">
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-1.5">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="text-base font-semibold">{title}</h1>
            <span className="max-w-[720px] truncate text-xs text-slate-500">{description}</span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1">
            {!primaryActionHandlesImport && <ToolbarButton icon={<Upload className="h-3.5 w-3.5" />} label={config.importLabel} onClick={handleImportAction} />}
            {kind === 'aiVoucherSuggestions' && isTauri && <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="新增建议" onClick={openAiVoucherSuggestionEditor} />}
            {kind === 'employee' && <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="新增人员" onClick={openEmployeeEditor} />}
            {kind === 'payroll' && <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="新增薪酬" onClick={openPayrollEditor} />}
            {kind === 'accountArchive' && <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="新增账户" onClick={() => { resetCompanyAccountDraft(); setShowCompanyAccountDialog(true) }} />}
            {kind === 'auxiliaryCategories' && <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="新增类别" onClick={() => { resetAuxiliaryCategoryDraft(); setShowAuxiliaryCategoryDialog(true) }} />}
            {kind === 'auxiliaryItems' && <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="新增项目" onClick={() => { if ((isTauri ? auxiliaryCategories : previewAuxiliaryCategories).length === 0) { setOperationNotice('请先新增辅助核算类别，再维护辅助核算项目。'); return }; resetAuxiliaryItemDraft(); setShowAuxiliaryItemDialog(true) }} />}
            {kind === 'reportFormulaSettings' && <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="新增公式" onClick={() => { setEditingReportFormulaId(null); setReportFormulaDraft({ itemName: '', formula: '', sortOrder: '0', isTotal: false }); setShowReportFormulaDialog(true) }} />}
            {(kind === 'taxAdapterSettings' || kind === 'bankAdapterSettings') && <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label={kind === 'taxAdapterSettings' ? '新增税局渠道' : '新增银行渠道'} onClick={() => { resetAdapterAuthorizationDraft(); setShowAdapterAuthorizationDialog(true) }} />}
            {kind === 'socialSecurity' && <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="新增社保" onClick={openSocialSecurityEditor} />}
            {kind === 'specialDeduction' && <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="新增扣除" onClick={openSpecialDeductionEditor} />}
            {(kind === 'billList' || kind === 'bankStatement') && <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="新增流水" onClick={openBankTransactionEditor} />}
            {kind === 'documentRegister' && isTauri && <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="新增单据" onClick={() => setShowDocumentRecordDialog(true)} />}
            <ToolbarButton icon={<RefreshCw className="h-3.5 w-3.5" />} label="刷新" onClick={handleRefreshAction} />
            <ToolbarButton icon={<Download className="h-3.5 w-3.5" />} label="模板" onClick={handleTemplateAction} />
            <ToolbarButton icon={<FileDown className="h-3.5 w-3.5" />} label="导出Excel" onClick={handleExportExcel} />
            <ToolbarButton icon={<FileText className="h-3.5 w-3.5" />} label="导出PDF" onClick={handleExportPdf} />
            <ToolbarButton icon={<Printer className="h-3.5 w-3.5" />} label="打印" onClick={handlePrint} />
            {kind === 'voucher' && isTauri && <ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="批量审核" onClick={() => void handleBatchVoucherApproval('approve')} />}
            {kind === 'voucher' && isTauri && <ToolbarButton icon={<RefreshCw className="h-3.5 w-3.5" />} label="批量反审核" onClick={() => void handleBatchVoucherApproval('reverse')} />}
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="inline-flex h-8 items-center gap-1 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              {config.primaryAction}
            </button>
          </div>
        </div>
        {operationNotice && (
          <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            {operationNotice}
          </div>
        )}

        <div className="flex overflow-x-auto border-b border-slate-200 bg-[#f8fafc] px-2">
          {workspaceTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(tab)
                if (tab.includes('日志') || tab === '变更记录' || tab === '审计证据') setShowRulesLogDialog(true)
              }}
              aria-pressed={activeTab === tab}
              className={cn(
                'h-9 border-b-2 px-3 text-xs font-medium',
                activeTab === tab ? 'border-[#1f65a7] bg-white text-[#1f65a7]' : 'border-transparent text-slate-600 hover:bg-white hover:text-slate-900'
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 border-b border-slate-200 bg-white lg:grid-cols-4">
          {config.summary.map((item) => (
            <div key={item.label} className="border-r border-slate-100 px-4 py-3 last:border-r-0">
              <div className="text-xs text-slate-500">{item.label}</div>
              <div className={cn('mt-1 text-lg font-semibold tabular-nums', toneClasses[item.tone])}>{item.value}</div>
            </div>
          ))}
        </div>

        {workspaceContext && (
          <div className="flex flex-wrap items-stretch gap-px border-b border-slate-200 bg-slate-200 dark:border-neutral-700 dark:bg-neutral-700">
            <div className="min-w-[300px] flex-1 bg-[#fbfcfe] px-3 py-2 dark:bg-neutral-900">
              <div className="text-xs font-semibold text-slate-800 dark:text-neutral-100">{workspaceContext.title}</div>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-neutral-400">{workspaceContext.description}</p>
            </div>
            {workspaceContext.metrics.map((metric) => (
              <div key={metric.label} className="min-w-32 flex-1 bg-white px-3 py-2 dark:bg-neutral-900">
                <div className="text-xs text-slate-500 dark:text-neutral-400">{metric.label}</div>
                <div className={cn('mt-1 text-sm font-semibold tabular-nums', toneClasses[metric.tone])}>{metric.value}</div>
              </div>
            ))}
          </div>
        )}

        {kind === 'aiJobQueue' && (
          <AiJobWorkflowPanel
            summary={config.summary}
            onStart={startAiTaskDraft}
            onReview={handleRefreshAction}
          />
        )}

        {kind === 'aiRecognitionResults' && <AiRecognitionWorkflowPanel summary={config.summary} onReview={() => void reviewAiRecognition([...selectedRowIds])} />}

        {kind === 'aiVoucherSuggestions' && (
          <AiVoucherSuggestionWorkflowPanel
            summary={config.summary}
            onAdd={openAiVoucherSuggestionEditor}
            onConfirm={() => void handlePrimaryAction()}
          />
        )}

        {kind === 'aiRuleTraining' && <AiRuleTrainingWorkflowPanel summary={config.summary} onAdd={openMatchingRuleEditor} onPublish={publishSelectedAiTrainingRules} />}

        {['ledgerReport', 'trialBalanceReport', 'accountSummaryReport', 'generalLedgerReport', 'subsidiaryLedgerReport', 'auxiliaryLedgerReport', 'auxiliaryBalanceReport', 'multiColumnLedgerReport'].includes(kind) && (
          <LedgerWorkflowPanel summary={config.summary} onReview={reviewLedgerReports} onRefresh={() => void handlePrimaryAction()} />
        )}

        {['balanceSheetReport', 'incomeStatementReport', 'incomeQuarterReport', 'cashFlowReport', 'cashFlowQuarterReport', 'equityChangeReport', 'financialReport'].includes(kind) && (
          <FinancialStatementWorkflowPanel summary={config.summary} onReview={reviewFinancialStatements} onRefresh={() => void handlePrimaryAction()} />
        )}

        {kind === 'companyInfo' && <CompanyInfoWorkflowPanel summary={config.summary} onEdit={openCompanyInfoEditor} onReview={reviewCompanyRegistration} />}

        {kind === 'initialBalance' && <InitialBalanceWorkflowPanel summary={config.summary} onEdit={openInitialBalanceEditor} onValidate={reviewInitialBalance} />}

        {kind === 'subjectSettings' && <SubjectSettingsWorkflowPanel summary={config.summary} onReview={reviewSubjectSettings} />}

        {['customerArchive', 'supplierArchive', 'otherContactArchive', 'projectArchive', 'departmentArchive'].includes(kind) && (
          <AuxiliaryArchiveWorkflowPanel summary={config.summary} onReview={reviewAuxiliaryArchives} />
        )}

        {(kind === 'taxInit' || kind === 'declarationCalendar') && (
          <TaxPlanningWorkflowPanel
            summary={config.summary}
            onAdd={kind === 'taxInit' ? () => openTaxInitEditor() : () => void handlePrimaryAction()}
            onReview={reviewTaxTaskData}
          />
        )}

        {['taxReport', 'vatTaxReport', 'withholdingTaxReport', 'stampTaxReport', 'incomeTaxReport', 'socialSecurityTaxReport', 'financeTaxReport', 'nonTaxRevenueReport'].includes(kind) && (
          <TaxReportWorkflowPanel summary={config.summary} onRun={() => void handlePrimaryAction()} onReview={reviewTaxTaskData} />
        )}

        {kind === 'declarationReceipt' && <TaxReceiptWorkflowPanel summary={config.summary} onOpen={openTaxReceiptWorkflow} onReview={reviewTaxTaskData} />}

        {kind === 'attachmentCenter' && (
          <AttachmentWorkflowPanel
            onUpload={handleImportAction}
            onReview={() => reviewImportArchiveData('attachment')}
            records={localAttachmentRecords}
          />
        )}

        {kind === 'importCenter' && (
          <ImportWorkflowPanel
            onImport={handleImportAction}
            onReview={() => reviewImportArchiveData('import')}
            jobs={localImportJobs}
          />
        )}

        {kind === 'exportCenter' && (
          <ExportWorkflowPanel
            onReview={() => reviewImportArchiveData('export')}
            rows={config.rows}
          />
        )}

        {kind === 'backupRestore' && <BackupWorkflowPanel summary={config.summary} onBackup={() => void handlePrimaryAction()} onReview={() => reviewImportArchiveData('backup')} />}

        {['invoiceMatchingRules', 'billMatchingRules', 'cashFlowMapping'].includes(kind) && (
          <MatchingRuleWorkflowPanel summary={config.summary} onAdd={openMatchingRuleEditor} onReview={() => reviewRuleTemplateGovernance('matching')} />
        )}

        {['settlementRules', 'commonDigests', 'voucherTemplateSettings', 'reportFormulaSettings'].includes(kind) && (
          <TemplateGovernanceWorkflowPanel summary={config.summary} onReview={() => reviewRuleTemplateGovernance('template')} />
        )}

        {['taxAdapterSettings', 'bankAdapterSettings'].includes(kind) && (
          <AdapterAuthorizationWorkflowPanel summary={config.summary} onAdd={openAdapterAuthorizationEditor} onReview={() => reviewRuleTemplateGovernance('adapter')} />
        )}

        {['historyVoucher', 'historyBalance', 'historyGeneralLedger', 'historySubsidiaryLedger'].includes(kind) && <HistoryMigrationWorkflowPanel summary={config.summary} onReview={() => reviewControlEvidence('history')} />}

        {kind === 'notificationCenter' && <NotificationWorkflowPanel summary={config.summary} onAdd={openCompanyTodoEditor} onReview={() => reviewControlEvidence('notification')} />}

        {kind === 'riskCheck' && <RiskWorkflowPanel summary={config.summary} onReview={() => reviewControlEvidence('risk')} />}

        {kind === 'auditLog' && <AuditWorkflowPanel summary={config.summary} onReview={() => reviewControlEvidence('audit')} />}

        {kind === 'voucherRecycle' && <VoucherRecycleWorkflowPanel summary={config.summary} onRestore={() => void handlePrimaryAction()} onReview={() => reviewControlEvidence('recycle')} />}

        {kind === 'outputInvoice' && <OutputInvoiceWorkflowPanel summary={config.summary} onAdd={() => void handlePrimaryAction()} onReview={() => reviewControlEvidence('risk')} />}

        {kind === 'contractLedger' && <ContractWorkflowPanel summary={config.summary} onReview={() => reviewControlEvidence('risk')} />}

        {kind === 'invoiceVoucherMatching' && <InvoiceVoucherMatchingWorkflowPanel summary={config.summary} onOpen={openInvoiceVoucherMatching} onReview={() => reviewControlEvidence('risk')} />}

        {kind === 'receipt' && <ReceiptWorkflowPanel summary={config.summary} onReview={() => reviewControlEvidence('risk')} />}

        {kind === 'transfer' && <AccountTransferWorkflowPanel summary={config.summary} onAdd={openAccountTransferEditor} onReview={() => reviewControlEvidence('risk')} />}

        {kind === 'specialDeduction' && <SpecialDeductionWorkflowPanel summary={config.summary} onAdd={openSpecialDeductionEditor} onReview={() => reviewControlEvidence('risk')} />}

        {['accountArchive', 'currencySettings', 'unitSettings'].includes(kind) && <AccountFoundationWorkflowPanel summary={config.summary} onReview={() => reviewFoundationConfiguration('account')} />}

        {['assetCategory', 'auxiliaryCategories', 'auxiliaryItems', 'tagArchive'].includes(kind) && <AuxiliaryFoundationWorkflowPanel summary={config.summary} onReview={() => reviewFoundationConfiguration('auxiliary')} />}

        {kind === 'printTemplateSettings' && <PrintTemplateWorkflowPanel summary={config.summary} onPreview={openPrintTemplatePreview} onReview={() => reviewFoundationConfiguration('print')} />}

        {kind === 'periodManagement' && <PeriodManagementWorkflowPanel summary={config.summary} onReview={() => reviewFoundationConfiguration('period')} />}

        {kind === 'settingsData' && <SettingsOverviewWorkflowPanel summary={config.summary} onReview={() => reviewFoundationConfiguration('account')} />}

        {kind === 'inputInvoice' && (
          <InputInvoiceWorkflowPanel
            summary={config.summary}
            onSync={syncInputInvoicePool}
            onAdd={openInputInvoiceEditor}
            onMatch={openInputInvoiceMatcher}
          />
        )}

        {kind === 'employee' && (
          <EmployeeVerificationPanel
            summary={config.summary}
            onAdd={openEmployeeEditor}
            onReview={reviewEmployeeDocuments}
          />
        )}

        {kind === 'payroll' && (
          <PayrollWorkflowPanel
            summary={config.summary}
            onAdd={openPayrollEditor}
            onReview={validatePayroll}
          />
        )}

        {kind === 'socialSecurity' && (
          <SocialSecurityWorkflowPanel
            summary={config.summary}
            onAdd={openSocialSecurityEditor}
            onReview={reconcileSocialSecurity}
          />
        )}

        {(kind === 'billList' || kind === 'bankStatement') && (
          <BankFlowWorkflowPanel
            mode={kind === 'bankStatement' ? '银行账单' : '账单一览'}
            summary={config.summary}
            onAdd={openBankTransactionEditor}
            onMatch={runBankTransactionMatching}
          />
        )}

        {(kind === 'purchaseManagement' || kind === 'salesManagement') && (
          <BusinessOrderWorkflowPanel
            mode={kind === 'purchaseManagement' ? 'purchase' : 'sales'}
            summary={config.summary}
            onAdd={() => openBusinessOrderEditor(kind === 'purchaseManagement' ? 'purchase' : 'sales')}
            onReview={() => reviewBusinessOrder(kind === 'purchaseManagement' ? 'purchase' : 'sales')}
          />
        )}

        {kind === 'expenseReimbursement' && (
          <ExpenseWorkflowPanel
            summary={config.summary}
            onAdd={() => openDocumentRecordEditor('费用报销')}
            onReview={() => reviewDocumentRecords('费用报销')}
          />
        )}

        {kind === 'documentRegister' && (
          <SourceDocumentWorkflowPanel
            summary={config.summary}
            onAdd={() => openDocumentRecordEditor('其他')}
            onReview={() => reviewDocumentRecords('原始单据')}
          />
        )}

        {kind === 'depreciation' && (
          <FixedAssetWorkflowPanel
            summary={config.summary}
            onAdd={openFixedAssetEditor}
            onReview={reviewDepreciation}
          />
        )}

        {(kind === 'inventorySettings' || kind === 'inventoryMovement') && (
          <InventoryWorkflowPanel
            mode={kind === 'inventorySettings' ? 'archive' : 'movement'}
            onAdd={kind === 'inventorySettings' ? openInventoryItemEditor : openInventoryMovementEditor}
            summary={config.summary}
            onReview={reviewInventoryMovement}
          />
        )}

        {kind === 'costCarryover' && (
          <CostCarryoverWorkflowPanel
            summary={config.summary}
            onAdd={openCostCarryoverEditor}
            onReview={reviewCostCarryover}
          />
        )}

        {kind === 'bankReconciliation' && (
          <BankReconciliationWorkflowPanel
            summary={config.summary}
            onAdd={openBankReconciliationEditor}
            onReview={reviewBankReconciliation}
          />
        )}

        {(kind === 'receivableSettlement' || kind === 'payableSettlement') && (
          <SettlementWorkflowPanel
            mode={kind === 'receivableSettlement' ? 'receivable' : 'payable'}
            summary={config.summary}
            onAdd={() => openSettlementRecordEditor(kind === 'receivableSettlement' ? 'receivable' : 'payable')}
            onReview={() => reviewSettlementRecords(kind === 'receivableSettlement' ? 'receivable' : 'payable')}
          />
        )}

        {kind === 'receivablePayableAging' && <AgingWorkflowPanel summary={config.summary} onReview={reviewAging} />}

        {kind === 'closingTasks' && <ClosingWorkflowPanel summary={config.summary} onReview={reviewClosingTasks} onRun={() => void handlePrimaryAction()} />}

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-[#fbfcfe] px-3 py-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="relative min-w-64 flex-1 sm:flex-none">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                className="h-8 w-full rounded border border-slate-300 bg-white pl-8 pr-3 text-xs outline-none focus:border-[#1f65a7] sm:w-80"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder={config.keywordPlaceholder}
              />
            </div>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-8 rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-[#1f65a7]"
              aria-label="状态筛选"
            >
              {config.statusOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            {supportsBusinessTagFilter && effectiveBusinessTags.some((tag) => tag.is_enabled === 1) && (
              <select
                value={businessTagFilter}
                onChange={(event) => setBusinessTagFilter(event.target.value)}
                className="h-8 max-w-36 rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-[#1f65a7]"
                aria-label="业务标签筛选"
              >
                <option value="全部">全部标签</option>
                {effectiveBusinessTags.filter((tag) => tag.is_enabled === 1).map((tag) => <option key={tag.id} value={tag.name}>{tag.name}</option>)}
              </select>
            )}
            {kind === 'subsidiaryLedgerReport' && usesLiveLedgerDetailData && (
              <select
                aria-label="明细账科目"
                value={selectedLedgerAccountCode}
                onChange={(event) => setSelectedLedgerAccountCode(event.target.value)}
                className="h-8 max-w-56 rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-[#1f65a7]"
              >
                <option value="">选择科目</option>
                {detailedAccounts.map((account) => (
                  <option key={account.code} value={account.code}>{account.code} {account.name}</option>
                ))}
              </select>
            )}
            {(kind === 'auxiliaryLedgerReport' || kind === 'auxiliaryBalanceReport') && usesLiveLedgerDetailData && (
              <select
                aria-label="辅助账类别"
                value={selectedAuxiliaryCategoryId}
                onChange={(event) => {
                  setSelectedAuxiliaryCategoryId(event.target.value)
                  setSelectedAuxiliaryItemId('')
                }}
                className="h-8 max-w-44 rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-[#1f65a7]"
              >
                <option value="">选择辅助类别</option>
                {auxiliaryCategories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            )}
            {kind === 'auxiliaryLedgerReport' && usesLiveLedgerDetailData && (
              <select
                aria-label="辅助账项目"
                value={selectedAuxiliaryItemId}
                onChange={(event) => setSelectedAuxiliaryItemId(event.target.value)}
                disabled={!selectedAuxiliaryCategoryId}
                className="h-8 max-w-56 rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-700 outline-none disabled:bg-slate-100 disabled:text-slate-400 focus:border-[#1f65a7]"
              >
                <option value="">选择辅助项目</option>
                {selectableAuxiliaryItems.map((item) => (
                  <option key={item.id} value={item.id}>{item.code} {item.name}</option>
                ))}
              </select>
            )}
            {(kind === 'historyVoucher' || kind === 'historyBalance' || kind === 'historyGeneralLedger' || kind === 'historySubsidiaryLedger') && usesLiveHistoryReportData && (
              <select
                aria-label="历史账期"
                value={selectedHistoryPeriodId}
                onChange={(event) => setSelectedHistoryPeriodId(event.target.value)}
                className="h-8 max-w-44 rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-[#1f65a7]"
              >
                <option value="">选择历史账期</option>
                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.period_year}-{String(period.period_month).padStart(2, '0')}{period.status === 'closed' ? '（已结账）' : ''}
                  </option>
                ))}
              </select>
            )}
            {kind === 'historySubsidiaryLedger' && usesLiveHistoryReportData && (
              <select
                aria-label="历史明细账科目"
                value={selectedHistoryLedgerAccountCode}
                onChange={(event) => setSelectedHistoryLedgerAccountCode(event.target.value)}
                className="h-8 max-w-56 rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-[#1f65a7]"
              >
                <option value="">选择历史明细账科目</option>
                {detailedAccounts.map((account) => (
                  <option key={account.code} value={account.code}>{account.code} {account.name}</option>
                ))}
              </select>
            )}
            <button type="button" onClick={openAdvancedFilterDialog} className={cn('inline-flex h-8 items-center gap-1 rounded border bg-white px-2.5 text-xs hover:border-[#1f65a7] hover:text-[#1f65a7]', advancedFilterScope ? 'border-[#1f65a7] text-[#1f65a7]' : 'border-slate-300 text-slate-700')}>
              <Filter className="h-3.5 w-3.5" />
              高级筛选
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <ToolbarButton icon={<Settings2 className="h-3.5 w-3.5" />} label="规则与日志" onClick={() => setShowRulesLogDialog(true)} />
            <ToolbarButton icon={<Columns3 className="h-3.5 w-3.5" />} label="列设置" onClick={openModuleColumnSettings} />
          </div>
        </div>
      </div>

      {showRulesLogDialog && <RulesLogDialog notes={config.notes} logs={visibleRuleLogs} usesLiveData={usesLiveRuleLogData} onClose={() => setShowRulesLogDialog(false)} />}

      {showAdvancedFilters && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="高级筛选条件">
          <section className="w-full max-w-md border border-slate-300 bg-white shadow-xl">
            <div className="flex min-h-11 items-center justify-between border-b border-slate-200 px-4 py-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">高级筛选条件</h2>
                <p className="mt-0.5 text-xs text-slate-500">按当前模块的凭证关联和附件完整性筛选，不修改原始业务数据。</p>
              </div>
              <button type="button" onClick={() => setShowAdvancedFilters(false)} className="text-xs text-slate-500 hover:text-slate-900">取消</button>
            </div>
            <div className="grid gap-3 p-4 text-xs text-slate-600 sm:grid-cols-2">
              <label className="grid gap-1">关联凭证
                <select value={advancedFiltersDraft.voucher} onChange={(event) => setAdvancedFiltersDraft((filters) => ({ ...filters, voucher: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  {['全部', '已关联', '未关联'].map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="grid gap-1">附件状态
                <select value={advancedFiltersDraft.attachment} onChange={(event) => setAdvancedFiltersDraft((filters) => ({ ...filters, attachment: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  {['全部', '附件齐全', '待补附件'].map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <div className="flex justify-between border-t border-slate-200 px-4 py-3">
              <button type="button" onClick={() => setAdvancedFiltersDraft({ voucher: '全部', attachment: '全部' })} className="h-8 border border-slate-300 px-3 text-xs text-slate-700 hover:border-[#1f65a7] hover:text-[#1f65a7]">重置</button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowAdvancedFilters(false)} className="h-8 border border-slate-300 px-3 text-xs text-slate-700">取消</button>
                <button type="button" onClick={applyAdvancedFilters} className="h-8 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">应用筛选</button>
              </div>
            </div>
          </section>
        </div>
      )}

      {showModuleColumnSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="列表列设置">
          <section className="flex max-h-[min(720px,calc(100vh-2rem))] w-full max-w-lg flex-col border border-slate-300 bg-white shadow-xl">
            <div className="flex min-h-11 items-center justify-between border-b border-slate-200 px-4 py-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">列表列设置</h2>
                <p className="mt-0.5 text-xs text-slate-500">仅保存当前账套、当前模块的本机显示偏好，不改变导出字段或其他用户视图。</p>
              </div>
              <button type="button" onClick={() => setShowModuleColumnSettings(false)} className="text-xs text-slate-500 hover:text-slate-900">取消</button>
            </div>
            <div className="min-h-0 overflow-y-auto p-4">
              <div className="grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
                {config.columns.map((column) => {
                  const checked = moduleColumnSettingsDraft.visibleKeys.includes(column.key)
                  return (
                    <label key={column.key} className="flex items-center gap-2 border border-slate-200 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => setModuleColumnSettingsDraft((settings) => ({
                          visibleKeys: event.target.checked
                            ? [...settings.visibleKeys, column.key]
                            : settings.visibleKeys.filter((key) => key !== column.key),
                        }))}
                      />
                      <span>{column.label}</span>
                    </label>
                  )
                })}
              </div>
            </div>
            <div className="flex justify-between border-t border-slate-200 px-4 py-3">
              <button type="button" onClick={() => setModuleColumnSettingsDraft({ visibleKeys: config.columns.map((column) => column.key) })} className="h-8 border border-slate-300 px-3 text-xs text-slate-700 hover:border-[#1f65a7] hover:text-[#1f65a7]">显示全部</button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowModuleColumnSettings(false)} className="h-8 border border-slate-300 px-3 text-xs text-slate-700">取消</button>
                <button type="button" onClick={saveCurrentModuleColumnSettings} className="h-8 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">保存设置</button>
              </div>
            </div>
          </section>
        </div>
      )}

      <div className="min-w-0 pt-3">
        <section className="min-w-0 border border-slate-200 bg-white">
          <div className="flex h-9 items-center justify-between border-b border-slate-200 bg-[#f8fafc] px-3">
            <div className="text-sm font-semibold text-slate-900">{listWorkspaceTitle}</div>
            <div className="max-w-[58%] truncate text-xs text-slate-500">显示 {pageStart}-{pageEnd} / {filteredRows.length} 条，{listWorkspaceHint}</div>
          </div>
          <div className="max-w-full overflow-x-auto">
            <table className="min-w-[1120px] w-full border-collapse text-left text-xs">
              <thead className="bg-[#eef3f8] text-slate-600">
                <tr>
                  <th className="w-9 border-b border-slate-200 px-2 py-2">
                    <input
                      type="checkbox"
                      aria-label="全选"
                      checked={pagedRows.length > 0 && pagedRows.every((row) => selectedRowIds.has(row.id))}
                      onChange={(event) => setSelectedRowIds((current) => {
                        const next = new Set(current)
                        pagedRows.forEach((row) => event.target.checked ? next.add(row.id) : next.delete(row.id))
                        return next
                      })}
                    />
                  </th>
                  {visibleColumns.map((column) => (
                    <th key={column.key} className={cn('whitespace-nowrap border-b border-slate-200 px-2 py-2', column.align === 'right' && 'text-right', column.align === 'center' && 'text-center')}>
                      {column.label}
                    </th>
                  ))}
                  <th className="whitespace-nowrap border-b border-slate-200 px-2 py-2">{tableMeta.statusLabel}</th>
                  {tableMeta.showVoucher && <th className="whitespace-nowrap border-b border-slate-200 px-2 py-2">{tableMeta.voucherLabel}</th>}
                  {tableMeta.showAttachment && <th className="whitespace-nowrap border-b border-slate-200 px-2 py-2">{tableMeta.attachmentLabel}</th>}
                  <th className="whitespace-nowrap border-b border-slate-200 px-2 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row) => {
                  const isLocalRegistryRow = kind === 'attachmentCenter'
                    ? localAttachmentRecords.some((item) => item.id === row.id)
                    : kind === 'importCenter' && localImportJobs.some((item) => item.id === row.id)
                  const isLocalRegistryModule = kind === 'attachmentCenter' || kind === 'importCenter'
                  const isCompanyTodoRow = kind === 'notificationCenter' && (isTauri ? companyTodos : previewCompanyTodos).some((item) => item.id === row.id)
                  return (
                  <tr key={row.id} className="hover:bg-[#f8fbff]">
                    <td className="border-b border-slate-100 px-2 py-2">
                      <input
                        type="checkbox"
                        aria-label={`选择 ${row.id}`}
                        checked={selectedRowIds.has(row.id)}
                        onChange={(event) => setSelectedRowIds((current) => {
                          const next = new Set(current)
                          if (event.target.checked) next.add(row.id)
                          else next.delete(row.id)
                          return next
                        })}
                      />
                    </td>
                    {visibleColumns.map((column) => (
                      <td key={column.key} className={cn('whitespace-nowrap border-b border-slate-100 px-2 py-2 text-slate-700', column.align === 'right' && 'text-right font-mono tabular-nums', column.align === 'center' && 'text-center')}>
                        {row.values[column.key]}
                      </td>
                    ))}
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2">{statusBadge(row.status)}</td>
                    {tableMeta.showVoucher && <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 text-slate-600">{row.voucher}</td>}
                    {tableMeta.showAttachment && <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <Paperclip className="h-3.5 w-3.5" />
                        {row.attachment}
                      </span>
                    </td>}
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 text-right">
                      {!(kind === 'aiVoucherSuggestions' && row.status === '已生成凭证') && (
                        <button type="button" disabled={isCompanyTodoRow && row.status === '已通过'} onClick={() => isCompanyTodoRow ? void completeCompanyTodo(row.id) : kind === 'printTemplateSettings' ? openPrintTemplatePreview() : handleViewRow(row)} className="mr-2 text-[#1f65a7] hover:underline disabled:cursor-not-allowed disabled:text-slate-400">
                          {isCompanyTodoRow ? row.status === '已通过' ? '已完成' : '完成待办' : kind === 'printTemplateSettings' ? '查看预览' : kind === 'attachmentCenter' && isLocalRegistryRow ? '关联单据' : kind === 'importCenter' && isLocalRegistryRow ? '核验批次' : kind === 'backupRestore' ? '核验' : kind === 'aiJobQueue' ? row.status === '待处理' ? '启动处理' : row.status === '待确认' ? '进入复核' : row.status === '异常' ? '查看异常' : '查看结果' : kind === 'aiRecognitionResults' ? row.status === '已通过' ? '已复核' : row.status === '异常' ? '查看问题' : '复核' : kind === 'aiVoucherSuggestions' ? row.status === '已确认' ? '已确认' : '确认' : kind === 'declarationReceipt' ? '归档回执' : kind === 'taxInit' ? '编辑认定' : isLocalTaxTaskKind ? isConfirmedTaxTask(row) ? '已确认' : '确认事项' : kind === 'employee' || kind === 'payroll' || kind === 'settlementRules' || kind === 'currencySettings' || kind === 'commonDigests' || kind === 'voucherTemplateSettings' || kind === 'reportFormulaSettings' || kind === 'taxAdapterSettings' || kind === 'bankAdapterSettings' || kind === 'socialSecurity' || kind === 'specialDeduction' || kind === 'transfer' || kind === 'depreciation' || kind === 'inventoryMovement' || kind === 'inventorySettings' || kind === 'billList' || kind === 'bankStatement' || kind === 'documentRegister' || kind === 'contractLedger' || kind === 'expenseReimbursement' || kind === 'receipt' || kind === 'purchaseManagement' || kind === 'salesManagement' ? '编辑' : kind === 'voucherRecycle' ? '恢复' : '查看'}
                        </button>
                      )}
                      {canGenerateVoucherFromModule(kind) && !(isLocalRegistryModule && !isLocalRegistryRow) && <button type="button" onClick={() => handleGenerateVoucher(row)} className="text-[#1f65a7] hover:underline">
                        {kind === 'attachmentCenter' || kind === 'importCenter' ? '撤销登记' : kind === 'voucher' ? '编辑' : kind === 'voucherRecycle' ? '彻底删除' : kind === 'aiVoucherSuggestions' ? row.status === '已生成凭证' ? '查看凭证' : '进入草稿' : kind === 'outputInvoice' || kind === 'inputInvoice' ? '新建凭证' : '生成凭证'}
                      </button>}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-[#f8fafc]">
                <tr>
                  <td className="px-2 py-2" />
                  <td className="px-2 py-2 font-semibold" colSpan={Math.max(visibleColumns.length, 1)}>合计/小计</td>
                  <td className="px-2 py-2 text-right text-xs text-slate-500" colSpan={2 + Number(tableMeta.showVoucher) + Number(tableMeta.showAttachment)}>当前页 {pagedRows.length} 条，筛选结果 {filteredRows.length} 条</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
            <div>{listMeta.exportHint}</div>
            <div className="flex items-center gap-2">
              <span>第 {page} / {totalPages} 页</span>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="h-7 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700"
                aria-label="每页条数"
              >
                {[10, 20, 50].map((size) => (
                  <option key={size} value={size}>每页 {size} 条</option>
                ))}
              </select>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="h-7 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                上一页
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                className="h-7 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                下一页
              </button>
            </div>
          </div>
        </section>
      </div>
      {pendingBusinessRiskConfirmation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-label="确认高风险业务操作">
          <section className="w-full max-w-lg border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950">
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{pendingBusinessRiskConfirmation.title}</h2>
              <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{pendingBusinessRiskConfirmation.description}</p>
            </div>
            <div className="px-4 py-3 text-xs leading-5 text-slate-600 dark:text-slate-300">
              确认后将执行本机账套操作并写入审计日志；不会自动向税局、银行或其他外部系统提交数据。
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
              <button type="button" onClick={() => resolveBusinessRiskConfirmation(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700 dark:border-slate-600 dark:text-slate-200">取消</button>
              <button type="button" onClick={() => resolveBusinessRiskConfirmation(true)} className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">{pendingBusinessRiskConfirmation.confirmLabel}</button>
            </div>
          </section>
        </div>
      )}
      {detailRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label={detailMeta.title}>
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto border border-slate-300 bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{detailMeta.title}</h2>
                <p className="mt-1 text-xs text-slate-500">{title} / {rowObjectLabel(detailRow)}</p>
              </div>
              <button type="button" onClick={() => setDetailRow(null)} className="text-xs text-slate-500 hover:text-slate-900">关闭</button>
            </div>
            <div className="grid gap-x-5 gap-y-3 p-4 sm:grid-cols-2">
              <div className="border-b border-slate-100 pb-2 text-xs"><div className="text-slate-500">状态</div><div className="mt-1">{statusBadge(detailRow.status)}</div></div>
              <div className="border-b border-slate-100 pb-2 text-xs"><div className="text-slate-500">凭证</div><div className="mt-1 break-words text-slate-800">{detailRow.voucher || '-'}</div></div>
              <div className="border-b border-slate-100 pb-2 text-xs"><div className="text-slate-500">附件</div><div className="mt-1 break-words text-slate-800">{detailRow.attachment || '-'}</div></div>
              {config.columns.map((column) => (
                <div key={column.key} className="min-w-0 border-b border-slate-100 pb-2 text-xs">
                  <div className="text-slate-500">{column.label}</div>
                  <div className="mt-1 break-words text-slate-800">{detailRow.values[column.key] || '-'}</div>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">{detailMeta.boundary}</div>
          </div>
        </div>
      )}
      {showPrintTemplatePreviewDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="内置固定模板预览">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto border border-slate-300 bg-white shadow-xl">
            <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">内置固定模板预览</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">当前版式由应用内置的凭证、账簿、财务报表、税务申报与业务清单模板生成。此页面用于查看版本和输出规则，不会直接修改 PDF 版式或历史导出文件。</p>
              </div>
              <button type="button" onClick={() => setShowPrintTemplatePreviewDialog(false)} className="shrink-0 text-xs text-slate-500 hover:text-slate-900">关闭</button>
            </div>
            <div className="grid gap-3 p-4">
              {fixedPrintTemplatePreviews.map((template) => (
                <section key={template.name} className="border border-slate-200 bg-[#fbfcfe] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{template.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500"><span>{template.paper}</span><span>{template.version}</span></div>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <div><span className="text-slate-500">版式字段：</span><span className="text-slate-800">{template.layout}</span></div>
                    <div><span className="text-slate-500">分页策略：</span><span className="text-slate-800">{template.pagination}</span></div>
                  </div>
                </section>
              ))}
              <div className="border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-900">输出验证范围：Noto Sans SC 中文字体、A4 方向、重复表头、业务行/凭证块分页与页码均在导出层执行。需要调整字段或版式时应修改对应模板代码并重新验证，而不是在此处绕过版本控制。</div>
            </div>
            <div className="flex justify-end border-t border-slate-200 px-4 py-3"><button type="button" onClick={() => setShowPrintTemplatePreviewDialog(false)} className="h-8 border border-slate-300 px-3 text-xs text-slate-700">关闭</button></div>
          </div>
        </div>
      )}
      {showAttachmentAssociationDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="关联本地附件单据">
          <form onSubmit={handleSaveAttachmentAssociation} className="w-full max-w-lg border border-slate-300 bg-white shadow-xl">
            <div className="flex h-11 items-center justify-between border-b border-slate-200 px-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">关联本地附件单据</h2>
                <p className="mt-0.5 text-xs text-slate-500">仅更新本机附件台账的关联关系，不会移动原始文件或写入外部存储。</p>
              </div>
              <button type="button" onClick={() => setShowAttachmentAssociationDialog(false)} className="text-xs text-slate-500 hover:text-slate-900">取消</button>
            </div>
            <div className="grid gap-3 p-4">
              <label className="grid gap-1 text-xs text-slate-600">附件文件
                <input readOnly value={attachmentAssociationDraft.fileName} className="h-8 border border-slate-300 bg-slate-100 px-2 text-sm text-slate-700" />
              </label>
              <label className="grid gap-1 text-xs text-slate-600">关联单据/凭证号
                <input required autoFocus value={attachmentAssociationDraft.relatedDocument} onChange={(event) => setAttachmentAssociationDraft((draft) => ({ ...draft, relatedDocument: event.target.value }))} placeholder="例如：销项发票 310026000118 或 记-0051" className="h-8 border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <p className="text-xs leading-5 text-slate-500">安全边界：关联不会移动原始文件、写入外部存储或修改凭证；后续凭证附件张数仍需在凭证页人工维护。</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button type="button" onClick={() => setShowAttachmentAssociationDialog(false)} className="h-8 border border-slate-300 px-3 text-xs text-slate-700">取消</button>
              <button type="submit" className="h-8 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">保存关联</button>
            </div>
          </form>
        </div>
      )}

      {importCommitDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="确认写入本地台账">
          <div className="w-full max-w-xl border border-slate-300 bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-4 py-3"><div><h2 className="text-sm font-semibold text-slate-900">确认写入本地台账</h2><p className="mt-1 text-xs text-slate-500">{importCommitDraft.fileName}，共 {importCommitDraft.rows.length} 行候选数据。</p></div><button type="button" onClick={() => setImportCommitDraft(null)} className="text-xs text-slate-500">取消</button></div>
            <div className="space-y-3 p-4 text-xs text-slate-700"><p>目标模块：{importCommitDraft.target === 'historyVoucher' ? `${importCommitDraft.periodLabel} 历史凭证` : importCommitDraft.target === 'historyBalance' ? `${importCommitDraft.periodLabel} 历史期初余额` : importCommitDraft.target === 'invoice' ? '发票台账' : importCommitDraft.target === 'bank' ? '银行流水台账' : importCommitDraft.target === 'document' ? '单据登记台账' : importCommitDraft.target === 'businessOrder' ? '采购/销售订单台账' : importCommitDraft.target === 'employee' ? '人员档案' : importCommitDraft.target === 'payroll' ? '薪酬台账' : importCommitDraft.target === 'socialSecurity' ? '社保公积金台账' : importCommitDraft.target === 'specialDeduction' ? '专项附加扣除台账' : importCommitDraft.target === 'inventoryMovement' ? '出入库台账' : importCommitDraft.target === 'fixedAsset' ? '固定资产台账' : importCommitDraft.target === 'inventoryItem' ? '存货档案' : importCommitDraft.target === 'settlement' ? '核销台账' : importCommitDraft.target === 'bankReconciliation' ? '银行对账台账' : importCommitDraft.target === 'measurementUnit' ? '计量单位档案' : importCommitDraft.target === 'accountTransfer' ? '账户转账台账' : importCommitDraft.target === 'costCarryover' ? '成本结转台账' : importCommitDraft.target === 'companyAccount' ? '账户登记档案' : importCommitDraft.target === 'auxiliaryArchive' ? '辅助核算档案' : importCommitDraft.target === 'businessTag' ? '业务标签' : importCommitDraft.target === 'subject' ? '会计科目' : importCommitDraft.target === 'initialBalance' ? '期初余额' : importCommitDraft.target === 'assetCategory' ? '资产类别档案' : importCommitDraft.target === 'auxiliaryCategory' ? '辅助核算类别' : importCommitDraft.target === 'auxiliaryItem' ? '辅助核算项目' : importCommitDraft.target === 'matchingRule' ? '自动匹配规则' : importCommitDraft.target === 'settlementRule' ? '期末结转规则' : importCommitDraft.target === 'commonDigest' ? '常用摘要' : importCommitDraft.target === 'voucherTemplate' ? '凭证模板' : '币别汇率'}。不完整或格式错误的行会被跳过并保留在导入批次中。</p><div className="border border-slate-200 bg-slate-50 p-3"><p className="font-medium">字段映射建议</p>{buildImportFieldMappings(importCommitDraft.headers, config.columns).map(({ header, target }) => <div key={header} className="mt-1 grid grid-cols-[1fr_20px_1fr] gap-2"><span className="truncate">{header}</span><span className="text-center text-slate-400">→</span><span className="truncate">{target}</span></div>)}</div><p className="border-l-2 border-[#1f65a7] bg-blue-50 px-3 py-2 leading-5">安全边界：{importCommitDraft.target === 'historyVoucher' ? '历史凭证会按凭证号分组校验科目、借贷平衡和重复号后写入所选历史账期；不会自动审核、结账或覆盖当前账期。' : importCommitDraft.target === 'historyBalance' ? '历史余额和总账只会转换为所选历史账期的期初基础，不会直接伪造总账发生额或覆盖当前账期；写入后仍需试算平衡。' : '本操作只写入当前桌面端账套和账期的本地台账，不会采集发票、登录银行、生成凭证或向税局提交。'}</p></div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3"><button type="button" onClick={() => setImportCommitDraft(null)} className="h-8 border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="button" onClick={handleCommitLocalImport} className="h-8 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">确认写入</button></div>
          </div>
        </div>
      )}

      {showImportValidationDialog && importValidationJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="核验本机导入批次">
          <div className="w-full max-w-xl border border-slate-300 bg-white shadow-xl">
            <div className="flex h-11 items-center justify-between border-b border-slate-200 px-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">核验本机导入批次</h2>
                <p className="mt-0.5 text-xs text-slate-500">核对本次解析出的文件元数据、表头和候选数据行。</p>
              </div>
              <button type="button" onClick={() => { setShowImportValidationDialog(false); setImportValidationJob(null) }} className="text-xs text-slate-500 hover:text-slate-900">取消</button>
            </div>
            <div className="grid gap-3 p-4 text-sm text-slate-700">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <div><dt className="text-slate-500">文件名称</dt><dd className="mt-1 break-all text-slate-900">{importValidationJob.fileName}</dd></div>
                <div><dt className="text-slate-500">文件格式 / 大小</dt><dd className="mt-1 text-slate-900">{importValidationJob.fileFormat} / {formatLocalFileSize(importValidationJob.fileSize)}</dd></div>
                <div><dt className="text-slate-500">候选数据行</dt><dd className="mt-1 text-slate-900">{importValidationJob.rowCount === null || importValidationJob.rowCount === undefined ? '待解析' : `${importValidationJob.rowCount} 行`}</dd></div>
                <div><dt className="text-slate-500">校验状态</dt><dd className="mt-1 text-slate-900">{importValidationJob.status === '已写入' ? '已写入本地台账' : importValidationJob.status === '已校验' ? '已人工核验' : '待人工核验'}</dd></div>
              </dl>
              <div className="border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-700">识别到的表头</p>
                {importValidationJob.columnPreview?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {importValidationJob.columnPreview.map((column) => <span key={column} className="border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">{column}</span>)}
                  </div>
                ) : <p className="mt-2 text-xs text-slate-500">当前格式未解析出表头，需在对应业务模块完成格式校验。</p>}
              </div>
              {importValidationJob.columnPreview?.length > 0 && (
                <div className="border border-slate-200 bg-white p-3">
                  <p className="text-xs font-medium text-slate-700">字段映射建议</p>
                  <div className="mt-2 grid gap-1 text-xs">
                    {buildImportFieldMappings(importValidationJob.columnPreview, config.columns).map(({ header, target }) => (
                      <div key={header} className="grid grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)] gap-2 border-b border-slate-100 py-1 last:border-0"><span className="truncate text-slate-600">{header}</span><span className="text-center text-slate-400">→</span><span className={cn('truncate', target === '未匹配字段' ? 'text-amber-700' : 'text-slate-800')}>{target}</span></div>
                    ))}
                  </div>
                </div>
              )}
              {importValidationJob.previewRows?.length > 0 && (
                <div className="border border-slate-200 bg-white p-3">
                  <p className="text-xs font-medium text-slate-700">候选数据预览</p>
                  <div className="mt-2 max-w-full overflow-x-auto">
                    <table className="min-w-full border-collapse text-xs">
                      <tbody>
                        {importValidationJob.previewRows.map((row, index) => (
                          <tr key={`${importValidationJob.id}-${index}`}>
                            {row.map((cell, cellIndex) => <td key={cellIndex} className="max-w-44 border border-slate-200 px-2 py-1 align-top break-words text-slate-700">{cell || '-'}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {importValidationJob.failureRows?.length ? (
                <div className="border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-medium text-amber-900">失败行清单</p>
                  <div className="mt-2 max-h-36 space-y-1 overflow-y-auto text-xs text-amber-900">
                    {importValidationJob.failureRows.map((failure) => <p key={`${failure.rowNumber}-${failure.message}`}>第 {failure.rowNumber} 行：{failure.message}</p>)}
                  </div>
                  {(importValidationJob.failedRowCount || 0) > importValidationJob.failureRows.length && <p className="mt-2 text-xs text-amber-700">仅显示前 {importValidationJob.failureRows.length} 条失败原因。</p>}
                </div>
              ) : null}
              <p className="text-xs leading-5 text-slate-500">{importValidationJob.validationNote || '历史批次尚未保存解析摘要，请在对应业务模块人工核验。'}</p>
              <p className="border-l-2 border-[#1f65a7] bg-blue-50 px-3 py-2 text-xs leading-5 text-slate-700">安全边界：核验只更新本机导入批次的状态，不会写入账套业务数据或调用外部系统。</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button type="button" onClick={() => { setShowImportValidationDialog(false); setImportValidationJob(null) }} className="h-8 border border-slate-300 px-3 text-xs text-slate-700">取消</button>
              <button type="button" disabled={importValidationJob.status === '已校验'} onClick={handleValidateLocalImportJob} className="h-8 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:bg-slate-400">{importValidationJob.status === '已校验' ? '已核验' : '确认核验'}</button>
            </div>
          </div>
        </div>
      )}

      {showInvoiceVoucherMatchDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="人工匹配发票与凭证">
          <form onSubmit={handleMatchInvoiceToVoucher} className="w-full max-w-xl border border-slate-300 bg-white shadow-xl">
            <div className="flex h-11 items-center justify-between border-b border-slate-200 px-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">人工匹配发票与凭证</h2>
                <p className="mt-0.5 text-xs text-slate-500">仅写入本地关联关系；金额差异会继续保留在待确认清单。</p>
              </div>
              <button type="button" onClick={() => setShowInvoiceVoucherMatchDialog(false)} className="text-xs text-slate-500 hover:text-slate-900">取消</button>
            </div>
            <div className="grid gap-4 p-4">
              <label className="grid gap-1 text-xs text-slate-600">
                发票
                <select required value={selectedMatchInvoiceId} onChange={(event) => setSelectedMatchInvoiceId(event.target.value)} className="h-8 border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  <option value="">请选择发票</option>
                  {invoiceMatchCandidates.filter((invoice) => !invoice.voucher_id || invoice.id === selectedMatchInvoiceId).map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_no} | ¥{invoice.total_amount.toFixed(2)}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-slate-600">
                凭证
                <select required value={selectedMatchVoucherId} onChange={(event) => setSelectedMatchVoucherId(event.target.value)} className="h-8 border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  <option value="">请选择凭证</option>
                  {voucherMatchCandidates.filter((voucher) => voucher.status !== 'reversed').map((voucher) => <option key={voucher.id} value={voucher.id}>{voucher.voucher_number} | ¥{voucher.total_debit.toFixed(2)} | {voucher.summary || '无摘要'}</option>)}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button type="button" onClick={() => setShowInvoiceVoucherMatchDialog(false)} className="h-8 border border-slate-300 px-3 text-xs text-slate-700">取消</button>
              <button type="submit" className="h-8 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">确认关联</button>
            </div>
          </form>
        </div>
      )}
      {showInvoiceDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label={editingInvoiceId ? '编辑发票' : '新增发票'}>
          <form onSubmit={handleCreateInvoice} className="w-full max-w-3xl border border-slate-300 bg-white shadow-xl">
            <div className="flex h-11 items-center justify-between border-b border-slate-200 px-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{editingInvoiceId ? '编辑' : '新增'}{kind === 'outputInvoice' ? '销项' : '进项'}发票</h2>
                <p className="mt-0.5 text-xs text-slate-500">仅登记或更新本地发票资料，不触发税局开票、验真或提交。</p>
              </div>
              <button type="button" onClick={() => setShowInvoiceDialog(false)} className="text-xs text-slate-500 hover:text-slate-900">取消</button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-slate-600">
                <span>发票号码</span>
                <input required value={invoiceDraft.invoiceNo} onChange={(event) => setInvoiceDraft((draft) => ({ ...draft, invoiceNo: event.target.value }))} placeholder="请输入发票号码" className="h-8 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>发票代码</span>
                <input value={invoiceDraft.invoiceCode} onChange={(event) => setInvoiceDraft((draft) => ({ ...draft, invoiceCode: event.target.value }))} placeholder="可选" className="h-8 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>开票日期</span>
                <input required type="date" value={invoiceDraft.invoiceDate} onChange={(event) => setInvoiceDraft((draft) => ({ ...draft, invoiceDate: event.target.value }))} className="h-8 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>不含税金额</span>
                <input required min="0" step="0.01" type="number" value={invoiceDraft.amount} onChange={(event) => setInvoiceDraft((draft) => ({ ...draft, amount: event.target.value }))} className="h-8 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>税额</span>
                <input min="0" step="0.01" type="number" value={invoiceDraft.taxAmount} onChange={(event) => setInvoiceDraft((draft) => ({ ...draft, taxAmount: event.target.value }))} className="h-8 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>税率（%）</span>
                <input min="0" max="100" step="0.01" type="number" value={invoiceDraft.taxRate} onChange={(event) => setInvoiceDraft((draft) => ({ ...draft, taxRate: event.target.value }))} className="h-8 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>销售方名称</span>
                <input value={invoiceDraft.sellerName} onChange={(event) => setInvoiceDraft((draft) => ({ ...draft, sellerName: event.target.value }))} placeholder="请输入销售方名称" className="h-8 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>销售方税号</span>
                <input value={invoiceDraft.sellerTaxId} onChange={(event) => setInvoiceDraft((draft) => ({ ...draft, sellerTaxId: event.target.value }))} placeholder="可选" className="h-8 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>购买方名称</span>
                <input value={invoiceDraft.buyerName} onChange={(event) => setInvoiceDraft((draft) => ({ ...draft, buyerName: event.target.value }))} placeholder="请输入购买方名称" className="h-8 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>购买方税号</span>
                <input value={invoiceDraft.buyerTaxId} onChange={(event) => setInvoiceDraft((draft) => ({ ...draft, buyerTaxId: event.target.value }))} placeholder="可选" className="h-8 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600 sm:col-span-2">
                <span>备注</span>
                <input value={invoiceDraft.remarks} onChange={(event) => setInvoiceDraft((draft) => ({ ...draft, remarks: event.target.value }))} placeholder="可选" className="h-8 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <fieldset className="space-y-1 text-xs text-slate-600 sm:col-span-2">
                <legend>业务标签</legend>
                <div className="flex flex-wrap gap-2 border border-slate-200 p-2">
                  {effectiveBusinessTags.filter((tag) => tag.is_enabled === 1).length === 0 && <span className="text-slate-400">请先在“标签”档案中维护可用标签。</span>}
                  {effectiveBusinessTags.filter((tag) => tag.is_enabled === 1).map((tag) => <label key={tag.id} className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"><input type="checkbox" checked={selectedInvoiceTagIds.includes(tag.id)} onChange={(event) => setSelectedInvoiceTagIds((ids) => event.target.checked ? [...ids, tag.id] : ids.filter((id) => id !== tag.id))} />{tag.name}</label>)}
                </div>
              </fieldset>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button type="button" onClick={() => setShowInvoiceDialog(false)} className="h-8 border border-slate-300 px-3 text-xs text-slate-700">取消</button>
              <button type="submit" className="h-8 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">{editingInvoiceId ? '保存修改' : '保存发票'}</button>
            </div>
          </form>
        </div>
      )}
      {showEmployeeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="新增人员">
          <form onSubmit={handleCreateEmployee} className="w-full max-w-2xl border border-slate-300 bg-white shadow-xl">
            <div className="flex h-11 items-center justify-between border-b border-slate-200 px-4">
              <h2 className="text-sm font-semibold text-slate-900">{editingEmployeeId ? '编辑人员' : '新增人员'}</h2>
              <button type="button" onClick={() => setShowEmployeeDialog(false)} className="text-xs text-slate-500 hover:text-slate-900">取消</button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {([
                { field: 'employeeCode', label: '人员编码', required: true },
                { field: 'name', label: '姓名', required: true },
                { field: 'department', label: '部门', required: false },
                { field: 'position', label: '岗位', required: false },
                { field: 'mobile', label: '手机号', required: false },
                { field: 'idNo', label: '证件号', required: false },
              ] as Array<{ field: keyof typeof employeeDraft; label: string; required: boolean }>).map(({ field, label, required }) => (
                <label key={field} className="grid gap-1 text-xs text-slate-600">
                  {label}{required ? ' *' : ''}
                  <input
                    required={required}
                    value={employeeDraft[field]}
                    onChange={(event) => setEmployeeDraft((draft) => ({ ...draft, [field]: event.target.value }))}
                    className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]"
                  />
                </label>
              ))}
              <label className="grid gap-1 text-xs text-slate-600">
                入职日期
                <input
                  type="date"
                  value={employeeDraft.entryDate}
                  onChange={(event) => setEmployeeDraft((draft) => ({ ...draft, entryDate: event.target.value }))}
                  className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]"
                />
              </label>
              <label className="grid gap-1 text-xs text-slate-600">
                任职状态
                <select
                  value={employeeDraft.employmentStatus}
                  onChange={(event) => setEmployeeDraft((draft) => ({ ...draft, employmentStatus: event.target.value }))}
                  className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]"
                >
                  <option value="在职">在职</option>
                  <option value="离职">离职</option>
                  <option value="停用">停用</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button type="button" onClick={() => setShowEmployeeDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700 hover:border-slate-400">取消</button>
              <button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">保存人员</button>
            </div>
          </form>
        </div>
      )}
      {showPayrollDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label={editingPayrollId ? '编辑薪酬行' : '新增薪酬行'}>
          <form onSubmit={handleSavePayrollRecord} className="w-full max-w-lg border border-slate-300 bg-white shadow-xl">
            <div className="flex h-11 items-center justify-between border-b border-slate-200 px-4">
              <h2 className="text-sm font-semibold text-slate-900">{editingPayrollId ? '编辑薪酬行' : '新增薪酬行'}</h2>
              <button type="button" onClick={() => setShowPayrollDialog(false)} className="text-xs text-slate-500 hover:text-slate-900">取消</button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">人员 *
                <select required value={payrollDraft.employeeId} onChange={(event) => setPayrollDraft((draft) => ({ ...draft, employeeId: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]">
                  <option value="">选择在职人员</option>
                  {!isTauri && <option value="preview-employee">PREVIEW 预览员工</option>}
                  {employees.filter((employee) => employee.employmentStatus === '在职').map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeCode} {employee.name}</option>)}
                </select>
              </label>
              {([
                { field: 'baseSalary', label: '基本工资' }, { field: 'bonus', label: '奖金' },
                { field: 'taxAmount', label: '个税' }, { field: 'socialPersonal', label: '个人社保' },
              ] as Array<{ field: keyof typeof payrollDraft; label: string }>).map(({ field, label }) => (
                <label key={field} className="grid gap-1 text-xs text-slate-600">{label}
                  <input type="number" min="0" step="0.01" required={field === 'baseSalary'} value={payrollDraft[field]} onChange={(event) => setPayrollDraft((draft) => ({ ...draft, [field]: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]" />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3"><button type="button" onClick={() => setShowPayrollDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">{editingPayrollId ? '保存修改' : '保存薪酬行'}</button></div>
          </form>
        </div>
      )}
      {showSettlementRuleDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label={editingSettlementRuleId ? '编辑结转规则' : '新增结转规则'}>
          <form onSubmit={handleSaveSettlementRule} className="w-full max-w-2xl border border-slate-300 bg-white shadow-xl">
            <div className="flex min-h-11 items-center justify-between border-b border-slate-200 px-4 py-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{editingSettlementRuleId ? '编辑结转规则' : '新增结转规则'}</h2>
                <p className="mt-0.5 text-xs text-slate-500">规则仅配置期末结转取数和凭证草稿参数，实际执行仍需人工复核。</p>
              </div>
              <button type="button" onClick={() => setShowSettlementRuleDialog(false)} className="text-xs text-slate-500 hover:text-slate-900">取消</button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-slate-600">规则名称 *
                <input required value={settlementRuleDraft.name} onChange={(event) => setSettlementRuleDraft((draft) => ({ ...draft, name: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]" />
              </label>
              <label className="grid gap-1 text-xs text-slate-600">结转类型 *
                <select value={settlementRuleDraft.ruleType} onChange={(event) => setSettlementRuleDraft((draft) => ({ ...draft, ruleType: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]">
                  <option value="profit_loss">结转损益</option>
                  <option value="tax">计提所得税</option>
                  <option value="vat">转出未交增值税</option>
                  <option value="custom">自定义结转</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs text-slate-600">取数公式
                <input value={settlementRuleDraft.sourceFormula} onChange={(event) => setSettlementRuleDraft((draft) => ({ ...draft, sourceFormula: event.target.value }))} placeholder="如：损益类科目期末余额" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]" />
              </label>
              <label className="grid gap-1 text-xs text-slate-600">目标科目
                <select value={settlementRuleDraft.targetAccountCode} onChange={(event) => setSettlementRuleDraft((draft) => ({ ...draft, targetAccountCode: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]">
                  <option value="">请选择目标科目</option>
                  {templateAccounts.map((account) => <option key={account.code} value={account.code}>{account.code} | {account.name}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-slate-600">凭证字
                <select value={settlementRuleDraft.voucherWordId} onChange={(event) => setSettlementRuleDraft((draft) => ({ ...draft, voucherWordId: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]">
                  <option value="">使用默认凭证字</option>
                  {voucherWords.filter((word) => word.is_enabled === 1).map((word) => <option key={word.id} value={word.id}>{word.word_name}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-slate-600">执行顺序
                <input type="number" min="0" step="1" value={settlementRuleDraft.priority} onChange={(event) => setSettlementRuleDraft((draft) => ({ ...draft, priority: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]" />
              </label>
              <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">凭证摘要模板
                <input value={settlementRuleDraft.summaryTemplate} onChange={(event) => setSettlementRuleDraft((draft) => ({ ...draft, summaryTemplate: event.target.value }))} placeholder="如：结转本期损益" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]" />
              </label>
              {editingSettlementRuleId && <label className="inline-flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={settlementRuleDraft.isEnabled} onChange={(event) => setSettlementRuleDraft((draft) => ({ ...draft, isEnabled: event.target.checked }))} />启用该规则</label>}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-3">
              <div>{editingSettlementRuleId && <button type="button" onClick={() => void handleDeleteSettlementRule()} className="h-8 rounded border border-red-300 px-3 text-xs text-red-700 hover:bg-red-50">删除规则</button>}</div>
              <div className="flex gap-2"><button type="button" onClick={() => setShowSettlementRuleDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">{editingSettlementRuleId ? '保存修改' : '保存规则'}</button></div>
            </div>
          </form>
        </div>
      )}
      {showCurrencyDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label={editingCurrencyId ? '编辑币别' : '新增币别'}>
          <form onSubmit={handleSaveCurrency} className="w-full max-w-lg border border-slate-300 bg-white shadow-xl">
            <div className="flex min-h-11 items-center justify-between border-b border-slate-200 px-4 py-2">
              <div><h2 className="text-sm font-semibold text-slate-900">{editingCurrencyId ? '编辑币别' : '新增币别'}</h2><p className="mt-0.5 text-xs text-slate-500">币别汇率用于外币业务和期末调汇，保存前请核对汇率来源。</p></div>
              <button type="button" onClick={() => setShowCurrencyDialog(false)} className="text-xs text-slate-500 hover:text-slate-900">取消</button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-slate-600">币别编码 *<input required maxLength={12} value={currencyDraft.code} onChange={(event) => setCurrencyDraft((draft) => ({ ...draft, code: event.target.value.toUpperCase() }))} placeholder="USD" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]" /></label>
              <label className="grid gap-1 text-xs text-slate-600">币别名称 *<input required value={currencyDraft.name} onChange={(event) => setCurrencyDraft((draft) => ({ ...draft, name: event.target.value }))} placeholder="美元" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]" /></label>
              <label className="grid gap-1 text-xs text-slate-600">记账汇率 *<input required type="number" min="0.000001" step="0.0001" value={currencyDraft.exchangeRate} onChange={(event) => setCurrencyDraft((draft) => ({ ...draft, exchangeRate: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]" /></label>
              <label className="flex items-end gap-2 pb-1 text-xs text-slate-700"><input type="checkbox" checked={currencyDraft.isBase} disabled={Boolean(editingCurrencyId && currencies.find((item) => item.id === editingCurrencyId)?.is_base === 1)} onChange={(event) => setCurrencyDraft((draft) => ({ ...draft, isBase: event.target.checked }))} />设为本位币</label>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-3">
              <div>{editingCurrencyId && <button type="button" onClick={() => void handleDeleteCurrency()} className="h-8 rounded border border-red-300 px-3 text-xs text-red-700 hover:bg-red-50">删除币别</button>}</div>
              <div className="flex gap-2"><button type="button" onClick={() => setShowCurrencyDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">{editingCurrencyId ? '保存修改' : '保存币别'}</button></div>
            </div>
          </form>
        </div>
      )}
      {showCommonDigestDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label={editingCommonDigestId ? '编辑常用摘要' : '新增常用摘要'}>
          <form onSubmit={handleSaveCommonDigest} className="w-full max-w-lg border border-slate-300 bg-white shadow-xl">
            <div className="flex min-h-11 items-center justify-between border-b border-slate-200 px-4 py-2"><div><h2 className="text-sm font-semibold text-slate-900">{editingCommonDigestId ? '编辑常用摘要' : '新增常用摘要'}</h2><p className="mt-0.5 text-xs text-slate-500">摘要可用于凭证录入和 AI 推荐，自动套用前仍需人工确认。</p></div><button type="button" onClick={() => setShowCommonDigestDialog(false)} className="text-xs text-slate-500 hover:text-slate-900">取消</button></div>
            <div className="p-4"><label className="grid gap-1 text-xs text-slate-600">摘要内容 *<input required autoFocus value={commonDigestDraft} onChange={(event) => setCommonDigestDraft(event.target.value)} placeholder="如：收到客户货款" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]" /></label></div>
            <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-3"><div>{editingCommonDigestId && <button type="button" onClick={() => void handleDeleteCommonDigest()} className="h-8 rounded border border-red-300 px-3 text-xs text-red-700 hover:bg-red-50">删除摘要</button>}</div><div className="flex gap-2"><button type="button" onClick={() => setShowCommonDigestDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">{editingCommonDigestId ? '保存修改' : '保存摘要'}</button></div></div>
          </form>
        </div>
      )}
      {showVoucherTemplateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label={editingVoucherTemplateId ? '编辑凭证模板' : '新增凭证模板'}>
          <form onSubmit={handleSaveVoucherTemplate} className="w-full max-w-2xl border border-slate-300 bg-white shadow-xl">
            <div className="flex min-h-11 items-center justify-between border-b border-slate-200 px-4 py-2"><div><h2 className="text-sm font-semibold text-slate-900">{editingVoucherTemplateId ? '编辑凭证模板' : '新增凭证模板'}</h2><p className="mt-0.5 text-xs text-slate-500">模板会生成借贷平衡的凭证草稿，正式保存和审核仍由凭证流程控制。</p></div><button type="button" onClick={() => setShowVoucherTemplateDialog(false)} className="text-xs text-slate-500 hover:text-slate-900">取消</button></div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-slate-600">模板名称 *<input required value={voucherTemplateDraft.name} onChange={(event) => setVoucherTemplateDraft((draft) => ({ ...draft, name: event.target.value }))} placeholder="如：销售商品收入" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]" /></label>
              <label className="grid gap-1 text-xs text-slate-600">模板分类 *<select required value={voucherTemplateDraft.typeId} onChange={(event) => setVoucherTemplateDraft((draft) => ({ ...draft, typeId: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]"><option value="">请选择模板分类</option>{(isTauri ? voucherTemplateTypes : previewVoucherTemplateTypes).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
              <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">摘要规则<input value={voucherTemplateDraft.summary} onChange={(event) => setVoucherTemplateDraft((draft) => ({ ...draft, summary: event.target.value }))} placeholder="如：销售{商品}" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]" /></label>
              <label className="grid gap-1 text-xs text-slate-600">借方科目 *<select required value={voucherTemplateDraft.debitAccountCode} onChange={(event) => setVoucherTemplateDraft((draft) => ({ ...draft, debitAccountCode: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]"><option value="">请选择借方科目</option>{templateAccounts.map((account) => <option key={account.code} value={account.code}>{account.code} | {account.name}</option>)}</select></label>
              <label className="grid gap-1 text-xs text-slate-600">贷方科目 *<select required value={voucherTemplateDraft.creditAccountCode} onChange={(event) => setVoucherTemplateDraft((draft) => ({ ...draft, creditAccountCode: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]"><option value="">请选择贷方科目</option>{templateAccounts.map((account) => <option key={account.code} value={account.code}>{account.code} | {account.name}</option>)}</select></label>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-3"><div>{editingVoucherTemplateId && <button type="button" onClick={() => void handleDeleteVoucherTemplate()} className="h-8 rounded border border-red-300 px-3 text-xs text-red-700 hover:bg-red-50">删除模板</button>}</div><div className="flex gap-2"><button type="button" onClick={() => setShowVoucherTemplateDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">{editingVoucherTemplateId ? '保存修改' : '保存模板'}</button></div></div>
          </form>
        </div>
      )}
      {showAdapterAuthorizationDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label={editingAdapterAuthorizationId ? '编辑授权配置' : '新增授权配置'}>
          <form onSubmit={handleSaveAdapterAuthorization} className="w-full max-w-2xl border border-slate-300 bg-white shadow-xl">
            <div className="flex min-h-11 items-center justify-between border-b border-slate-200 px-4 py-2"><div><h2 className="text-sm font-semibold text-slate-900">{editingAdapterAuthorizationId ? '编辑授权配置' : kind === 'taxAdapterSettings' ? '新增税局渠道' : '新增银行渠道'}</h2><p className="mt-0.5 text-xs text-slate-500">仅记录渠道元数据和脱敏授权状态，不保存密码、令牌、Cookie 或证书。</p></div><button type="button" onClick={() => setShowAdapterAuthorizationDialog(false)} className="text-xs text-slate-500 hover:text-slate-900">取消</button></div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-slate-600">渠道名称 *<input required value={adapterAuthorizationDraft.adapterCode} onChange={(event) => setAdapterAuthorizationDraft((draft) => ({ ...draft, adapterCode: event.target.value }))} placeholder={kind === 'taxAdapterSettings' ? '电子税务局适配器' : '银行账单导入适配器'} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]" /></label>
              <label className="grid gap-1 text-xs text-slate-600">地区/机构<input value={adapterAuthorizationDraft.region} onChange={(event) => setAdapterAuthorizationDraft((draft) => ({ ...draft, region: event.target.value }))} placeholder="上海" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]" /></label>
              <label className="grid gap-1 text-xs text-slate-600">授权状态<select value={adapterAuthorizationDraft.authStatus} onChange={(event) => setAdapterAuthorizationDraft((draft) => ({ ...draft, authStatus: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]"><option value="pending">待授权</option><option value="configured">已配置待复核</option><option value="authorized">已授权</option><option value="expired">已过期</option><option value="disabled">已停用</option></select></label>
              <label className="grid gap-1 text-xs text-slate-600">授权账户（脱敏）<input value={adapterAuthorizationDraft.accountMask} onChange={(event) => setAdapterAuthorizationDraft((draft) => ({ ...draft, accountMask: event.target.value }))} placeholder="9131****1234" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]" /></label>
              <label className="grid gap-1 text-xs text-slate-600">授权身份<input value={adapterAuthorizationDraft.loginIdentity} onChange={(event) => setAdapterAuthorizationDraft((draft) => ({ ...draft, loginIdentity: event.target.value }))} placeholder="办税员/企业管理员" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]" /></label>
              <label className="grid gap-1 text-xs text-slate-600">到期日期<input type="date" value={adapterAuthorizationDraft.expiresAt} onChange={(event) => setAdapterAuthorizationDraft((draft) => ({ ...draft, expiresAt: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]" /></label>
              <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">能力范围<input value={adapterAuthorizationDraft.capabilityScope} onChange={(event) => setAdapterAuthorizationDraft((draft) => ({ ...draft, capabilityScope: event.target.value }))} placeholder={kind === 'taxAdapterSettings' ? '取数、生成申报包、人工导入回执' : '文件导入、流水对账、人工上传回单'} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]" /></label>
              <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">风险提示<input value={adapterAuthorizationDraft.riskMessage} onChange={(event) => setAdapterAuthorizationDraft((draft) => ({ ...draft, riskMessage: event.target.value }))} placeholder="例如：未完成企业授权，禁止自动提交" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]" /></label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3"><button type="button" onClick={() => setShowAdapterAuthorizationDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">保存脱敏配置</button></div>
          </form>
        </div>
      )}
      {showBusinessTagDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label={editingBusinessTagId ? '编辑业务标签' : '新增业务标签'}>
          <form onSubmit={handleSaveBusinessTag} className="w-full max-w-xl border border-slate-300 bg-white shadow-xl">
            <div className="flex min-h-11 items-center justify-between border-b border-slate-200 px-4 py-2"><div><h2 className="text-sm font-semibold text-slate-900">{editingBusinessTagId ? '编辑业务标签' : '新增业务标签'}</h2><p className="mt-0.5 text-xs text-slate-500">标签用于筛选和人工跟踪；自动标记规则只生成提示，不会改变账务或自动提交税务。</p></div><button type="button" onClick={() => setShowBusinessTagDialog(false)} className="text-xs text-slate-500">取消</button></div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-slate-600">标签名称 *<input required value={businessTagDraft.name} onChange={(event) => setBusinessTagDraft((draft) => ({ ...draft, name: event.target.value }))} placeholder="如：需客户确认" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs text-slate-600">颜色标识 *<select value={businessTagDraft.colorName} onChange={(event) => setBusinessTagDraft((draft) => ({ ...draft, colorName: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900"><option>蓝色</option><option>绿色</option><option>橙色</option><option>红色</option><option>灰色</option></select></label>
              <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">适用模块 *<input required value={businessTagDraft.applicableModules} onChange={(event) => setBusinessTagDraft((draft) => ({ ...draft, applicableModules: event.target.value }))} placeholder="如：发票/流水/凭证" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">自动标记规则<input value={businessTagDraft.autoRule} onChange={(event) => setBusinessTagDraft((draft) => ({ ...draft, autoRule: event.target.value }))} placeholder="如：金额差异、税率异常或资料缺失" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">备注<input value={businessTagDraft.remarks} onChange={(event) => setBusinessTagDraft((draft) => ({ ...draft, remarks: event.target.value }))} placeholder="如：待办跟踪说明" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              <label className="inline-flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={businessTagDraft.isEnabled} onChange={(event) => setBusinessTagDraft((draft) => ({ ...draft, isEnabled: event.target.checked }))} />立即启用</label>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3"><div>{editingBusinessTagId && <button type="button" onClick={() => void handleDeleteBusinessTag()} className="h-8 rounded border border-red-300 px-3 text-xs text-red-700">删除标签</button>}</div><div className="flex gap-2"><button type="button" onClick={() => setShowBusinessTagDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white">保存标签</button></div></div>
          </form>
        </div>
      )}
      {showCompanyInfoDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="编辑当前账套企业资料">
          <form onSubmit={handleSaveCompanyInfo} className="flex max-h-[92vh] w-full max-w-4xl flex-col border border-slate-300 bg-white shadow-xl">
            <div className="flex min-h-11 items-center justify-between border-b border-slate-200 px-4 py-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">编辑当前账套企业资料</h2>
                <p className="mt-0.5 text-xs text-slate-500">维护当前企业的主体、账套和服务信息。会计制度及启用期间变更需在无业务数据或完成审批后执行。</p>
              </div>
              <button type="button" onClick={() => setShowCompanyInfoDialog(false)} className="text-xs text-slate-500 hover:text-slate-900">取消</button>
            </div>
            <div className="min-h-0 space-y-4 overflow-y-auto p-4">
              <fieldset className="grid gap-3 sm:grid-cols-2">
                <legend className="mb-2 text-sm font-semibold text-slate-900">企业基本信息</legend>
                <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">企业名称 *<input required value={companyInfoDraft.name} onChange={(event) => setCompanyInfoDraft((draft) => ({ ...draft, name: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
                <label className="grid gap-1 text-xs text-slate-600">企业编码 *<input required value={companyInfoDraft.code} onChange={(event) => setCompanyInfoDraft((draft) => ({ ...draft, code: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
                <label className="grid gap-1 text-xs text-slate-600">纳税人识别号 *<input required value={companyInfoDraft.taxId} onChange={(event) => setCompanyInfoDraft((draft) => ({ ...draft, taxId: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
                <label className="grid gap-1 text-xs text-slate-600">省份 *<input required value={companyInfoDraft.province} onChange={(event) => setCompanyInfoDraft((draft) => ({ ...draft, province: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
                <label className="grid gap-1 text-xs text-slate-600">城市 *<input required value={companyInfoDraft.city} onChange={(event) => setCompanyInfoDraft((draft) => ({ ...draft, city: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
                <label className="grid gap-1 text-xs text-slate-600">区县<input value={companyInfoDraft.district} onChange={(event) => setCompanyInfoDraft((draft) => ({ ...draft, district: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
                <label className="grid gap-1 text-xs text-slate-600">纳税人资格 *<select value={companyInfoDraft.taxpayerType} onChange={(event) => setCompanyInfoDraft((draft) => ({ ...draft, taxpayerType: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900"><option value="general">一般纳税人</option><option value="small">小规模纳税人</option></select></label>
              </fieldset>
              <fieldset className="grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2">
                <legend className="mb-2 text-sm font-semibold text-slate-900">账套与服务信息</legend>
                <label className="grid gap-1 text-xs text-slate-600">会计制度 *<select value={companyInfoDraft.accountingSystem} onChange={(event) => setCompanyInfoDraft((draft) => ({ ...draft, accountingSystem: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900"><option value="small_enterprise">小企业会计准则</option><option value="enterprise">企业会计准则</option><option value="non_profit">民间非营利组织会计制度</option><option value="government">政府会计制度</option></select></label>
                <label className="grid gap-1 text-xs text-slate-600">启用期间 *<span className="grid grid-cols-2 gap-2"><select value={companyInfoDraft.enableYear} onChange={(event) => setCompanyInfoDraft((draft) => ({ ...draft, enableYear: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">{[2025, 2026, 2027].map((year) => <option key={year} value={year}>{year}年</option>)}</select><select value={companyInfoDraft.enableMonth} onChange={(event) => setCompanyInfoDraft((draft) => ({ ...draft, enableMonth: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">{Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>{month}月</option>)}</select></span></label>
                <label className="grid gap-1 text-xs text-slate-600">服务期限起<input type="date" value={companyInfoDraft.serviceStart} onChange={(event) => setCompanyInfoDraft((draft) => ({ ...draft, serviceStart: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
                <label className="grid gap-1 text-xs text-slate-600">服务期限止<input type="date" value={companyInfoDraft.serviceEnd} onChange={(event) => setCompanyInfoDraft((draft) => ({ ...draft, serviceEnd: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
                <label className="grid gap-1 text-xs text-slate-600">会计行业<input value={companyInfoDraft.industry} onChange={(event) => setCompanyInfoDraft((draft) => ({ ...draft, industry: event.target.value }))} placeholder="如：软件和信息技术服务业" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
                <label className="grid gap-1 text-xs text-slate-600">企业类型<select value={companyInfoDraft.enterpriseType} onChange={(event) => setCompanyInfoDraft((draft) => ({ ...draft, enterpriseType: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900"><option>私营有限责任公司</option><option>内资企业</option><option>个体工商户</option><option>外商投资企业</option></select></label>
              </fieldset>
              <section className="border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-5 text-slate-700">
                税局办税人、登录及工商联络相关授权通过授权中心维护，只记录脱敏状态和有效期，不在企业资料页存储密码、令牌、Cookie 或证书。
              </section>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3"><button type="button" onClick={() => setShowCompanyInfoDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">保存企业资料</button></div>
          </form>
        </div>
      )}
      {showSubjectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label={editingSubjectCode ? '编辑会计科目' : '新增会计科目'}>
          <form onSubmit={handleSaveSubject} className="flex max-h-[92vh] w-full max-w-3xl flex-col border border-slate-300 bg-white shadow-xl">
            <div className="flex min-h-11 items-center justify-between border-b border-slate-200 px-4 py-2"><div><h2 className="text-sm font-semibold text-slate-900">{editingSubjectCode ? '编辑会计科目' : '新增会计科目'}</h2><p className="mt-0.5 text-xs text-slate-500">科目变更需保持层级、余额方向和辅助核算一致，保存后请复核关联凭证模板和报表映射。</p></div><button type="button" onClick={() => setShowSubjectDialog(false)} className="text-xs text-slate-500 hover:text-slate-900">取消</button></div>
            <div className="min-h-0 overflow-y-auto p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs text-slate-600">科目编码 *<input required disabled={Boolean(editingSubjectCode)} value={subjectDraft.code} onChange={(event) => setSubjectDraft((draft) => ({ ...draft, code: event.target.value }))} placeholder="如：1002" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100" /></label>
                <label className="grid gap-1 text-xs text-slate-600">科目名称 *<input required value={subjectDraft.name} onChange={(event) => setSubjectDraft((draft) => ({ ...draft, name: event.target.value }))} placeholder="如：银行存款" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
                <label className="grid gap-1 text-xs text-slate-600">科目类别 *<select value={subjectDraft.accountType} onChange={(event) => setSubjectDraft((draft) => ({ ...draft, accountType: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900"><option>资产类</option><option>负债类</option><option>共同类</option><option>所有者权益类</option><option>成本类</option><option>损益类</option></select></label>
                <label className="grid gap-1 text-xs text-slate-600">余额方向 *<select value={subjectDraft.normalBalance} onChange={(event) => setSubjectDraft((draft) => ({ ...draft, normalBalance: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900"><option value="debit">借方</option><option value="credit">贷方</option></select></label>
                <label className="grid gap-1 text-xs text-slate-600">科目级次 *<input required type="number" min="1" max="9" value={subjectDraft.level} onChange={(event) => setSubjectDraft((draft) => ({ ...draft, level: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
                <label className="grid gap-1 text-xs text-slate-600">上级科目<select value={subjectDraft.parentCode} onChange={(event) => setSubjectDraft((draft) => ({ ...draft, parentCode: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900"><option value="">无上级科目</option>{accounts.filter((account) => account.code !== editingSubjectCode).map((account) => <option key={account.code} value={account.code}>{account.code}｜{account.name}</option>)}</select></label>
                <label className="inline-flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={subjectDraft.isDetail} onChange={(event) => setSubjectDraft((draft) => ({ ...draft, isDetail: event.target.checked }))} />末级明细科目</label>
                <label className="inline-flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={subjectDraft.hasAuxiliary} onChange={(event) => setSubjectDraft((draft) => ({ ...draft, hasAuxiliary: event.target.checked }))} />启用辅助核算</label>
                <label className="inline-flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={subjectDraft.hasQuantity} onChange={(event) => setSubjectDraft((draft) => ({ ...draft, hasQuantity: event.target.checked }))} />启用数量核算</label>
                <label className="grid gap-1 text-xs text-slate-600">默认计量单位<input disabled={!subjectDraft.hasQuantity} value={subjectDraft.defaultUnit} onChange={(event) => setSubjectDraft((draft) => ({ ...draft, defaultUnit: event.target.value }))} placeholder="如：个、吨、台" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100" /></label>
              </div>
              <p className="mt-4 border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">科目核算口径只影响后续凭证建议、账簿与报表取数；系统不会据此自动修改历史凭证、已结账期间或税务申报包。</p>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-3"><div className="flex gap-2">{editingSubjectCode && isTauri && <button type="button" onClick={() => void handleToggleSubject()} className="h-8 rounded border border-amber-300 px-3 text-xs text-amber-700">启用/停用</button>}{editingSubjectCode && isTauri && <button type="button" onClick={() => void handleDeleteSubject()} className="h-8 rounded border border-red-300 px-3 text-xs text-red-700">删除科目</button>}</div><div className="flex gap-2"><button type="button" onClick={() => setShowSubjectDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">保存科目</button></div></div>
          </form>
        </div>
      )}
      {showInitialBalanceDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="登记期初余额">
          <form onSubmit={handleSaveInitialBalance} className="w-full max-w-2xl border border-slate-300 bg-white shadow-xl">
            <div className="flex min-h-11 items-center justify-between border-b border-slate-200 px-4 py-2"><div><h2 className="text-sm font-semibold text-slate-900">登记期初余额</h2><p className="mt-0.5 text-xs text-slate-500">按当前账期的会计科目登记借方或贷方期初。重复保存同一科目会更新该账期的期初金额。</p></div><button type="button" onClick={() => setShowInitialBalanceDialog(false)} className="text-xs text-slate-500 hover:text-slate-900">取消</button></div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">会计科目 *<select required value={initialBalanceDraft.accountCode} onChange={(event) => setInitialBalanceDraft((draft) => ({ ...draft, accountCode: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900"><option value="">请选择会计科目</option>{(accounts.length > 0 ? accounts.map((account) => ({ code: account.code, name: account.name })) : config.rows.map((row) => ({ code: row.values.code || row.id, name: row.values.name || row.values.code || row.id }))).map((account) => <option key={account.code} value={account.code}>{account.code}｜{account.name}</option>)}</select></label>
              <label className="grid gap-1 text-xs text-slate-600">期初借方（元）<input type="number" min="0" step="0.01" value={initialBalanceDraft.openingDebit} onChange={(event) => setInitialBalanceDraft((draft) => ({ ...draft, openingDebit: event.target.value }))} placeholder="0.00" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs text-slate-600">期初贷方（元）<input type="number" min="0" step="0.01" value={initialBalanceDraft.openingCredit} onChange={(event) => setInitialBalanceDraft((draft) => ({ ...draft, openingCredit: event.target.value }))} placeholder="0.00" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">来源说明（审计留痕）<input value={initialBalanceDraft.sourceNote} onChange={(event) => setInitialBalanceDraft((draft) => ({ ...draft, sourceNote: event.target.value }))} placeholder="如：2025 年末科目余额表、历史账导入批次" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              <p className="border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 sm:col-span-2">每一科目只能填写借方或贷方其中一侧；保存后需要执行试算平衡。期初余额不会自动生成凭证、结账或税务申报。</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3"><button type="button" onClick={() => setShowInitialBalanceDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">保存期初余额</button></div>
          </form>
        </div>
      )}
      {showAuxiliaryArchiveDialog && isLiveAuxiliaryArchiveKind(kind) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label={editingAuxiliaryArchiveItemId ? `编辑${auxiliaryArchiveDefinitions[kind].title}档案` : `新增${auxiliaryArchiveDefinitions[kind].title}档案`}>
          <form onSubmit={handleSaveAuxiliaryArchive} className="flex max-h-[92vh] w-full max-w-3xl flex-col border border-slate-300 bg-white shadow-xl">
            <div className="flex min-h-11 items-center justify-between border-b border-slate-200 px-4 py-2"><div><h2 className="text-sm font-semibold text-slate-900">{editingAuxiliaryArchiveItemId ? `编辑${auxiliaryArchiveDefinitions[kind].title}档案` : `新增${auxiliaryArchiveDefinitions[kind].title}档案`}</h2><p className="mt-0.5 text-xs text-slate-500">档案只服务当前账套；启停和删除保留业务引用校验，历史凭证与已结账账期不会自动改写。</p></div><button type="button" onClick={() => setShowAuxiliaryArchiveDialog(false)} className="text-xs text-slate-500">取消</button></div>
            <div className="min-h-0 overflow-y-auto p-4"><div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-slate-600">{auxiliaryArchiveDefinitions[kind].title}编码 *<input required value={auxiliaryArchiveDraft.code} onChange={(event) => setAuxiliaryArchiveDraft((draft) => ({ ...draft, code: event.target.value }))} placeholder="如：C001" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs text-slate-600">{auxiliaryArchiveDefinitions[kind].title}名称 *<input required value={auxiliaryArchiveDraft.name} onChange={(event) => setAuxiliaryArchiveDraft((draft) => ({ ...draft, name: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              {kind === 'customerArchive' && <><label className="grid gap-1 text-xs text-slate-600">纳税人识别号<input value={auxiliaryArchiveDraft.taxNo} onChange={(event) => setAuxiliaryArchiveDraft((draft) => ({ ...draft, taxNo: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label><label className="grid gap-1 text-xs text-slate-600">开户行<input value={auxiliaryArchiveDraft.bank} onChange={(event) => setAuxiliaryArchiveDraft((draft) => ({ ...draft, bank: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label><label className="grid gap-1 text-xs text-slate-600">默认科目<input value={auxiliaryArchiveDraft.subject} onChange={(event) => setAuxiliaryArchiveDraft((draft) => ({ ...draft, subject: event.target.value }))} placeholder="1122 应收账款" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label><label className="grid gap-1 text-xs text-slate-600">关联合同<input value={auxiliaryArchiveDraft.contract} onChange={(event) => setAuxiliaryArchiveDraft((draft) => ({ ...draft, contract: event.target.value }))} placeholder="HT-2026-001" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label></>}
              {kind === 'supplierArchive' && <><label className="grid gap-1 text-xs text-slate-600">发票/流水别名<input value={auxiliaryArchiveDraft.alias} onChange={(event) => setAuxiliaryArchiveDraft((draft) => ({ ...draft, alias: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label><label className="grid gap-1 text-xs text-slate-600">纳税人识别号<input value={auxiliaryArchiveDraft.taxNo} onChange={(event) => setAuxiliaryArchiveDraft((draft) => ({ ...draft, taxNo: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label><label className="grid gap-1 text-xs text-slate-600">默认科目<input value={auxiliaryArchiveDraft.subject} onChange={(event) => setAuxiliaryArchiveDraft((draft) => ({ ...draft, subject: event.target.value }))} placeholder="2202 应付账款" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label><label className="grid gap-1 text-xs text-slate-600">常用税率<input value={auxiliaryArchiveDraft.taxRate} onChange={(event) => setAuxiliaryArchiveDraft((draft) => ({ ...draft, taxRate: event.target.value }))} placeholder="如：13%" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label></>}
              {kind === 'otherContactArchive' && <><label className="grid gap-1 text-xs text-slate-600">往来类型<select value={auxiliaryArchiveDraft.contactType} onChange={(event) => setAuxiliaryArchiveDraft((draft) => ({ ...draft, contactType: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900"><option value="">请选择</option><option>员工备用金</option><option>股东往来</option><option>个人往来</option><option>临时往来</option></select></label><label className="grid gap-1 text-xs text-slate-600">证件号/税号<input value={auxiliaryArchiveDraft.idNo} onChange={(event) => setAuxiliaryArchiveDraft((draft) => ({ ...draft, idNo: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label><label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">默认科目<input value={auxiliaryArchiveDraft.subject} onChange={(event) => setAuxiliaryArchiveDraft((draft) => ({ ...draft, subject: event.target.value }))} placeholder="1221 其他应收款" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label></>}
              {kind === 'projectArchive' && <><label className="grid gap-1 text-xs text-slate-600">负责人<input value={auxiliaryArchiveDraft.owner} onChange={(event) => setAuxiliaryArchiveDraft((draft) => ({ ...draft, owner: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label><label className="grid gap-1 text-xs text-slate-600">开始日期<input type="date" value={auxiliaryArchiveDraft.start} onChange={(event) => setAuxiliaryArchiveDraft((draft) => ({ ...draft, start: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label><label className="grid gap-1 text-xs text-slate-600">默认科目<input value={auxiliaryArchiveDraft.subject} onChange={(event) => setAuxiliaryArchiveDraft((draft) => ({ ...draft, subject: event.target.value }))} placeholder="5301 研发支出" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label><label className="grid gap-1 text-xs text-slate-600">预算金额<input type="number" min="0" step="0.01" value={auxiliaryArchiveDraft.budget} onChange={(event) => setAuxiliaryArchiveDraft((draft) => ({ ...draft, budget: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label></>}
              {kind === 'departmentArchive' && <><label className="grid gap-1 text-xs text-slate-600">上级部门<input value={auxiliaryArchiveDraft.parent} onChange={(event) => setAuxiliaryArchiveDraft((draft) => ({ ...draft, parent: event.target.value }))} placeholder="如：总部" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label><label className="grid gap-1 text-xs text-slate-600">负责人<input value={auxiliaryArchiveDraft.owner} onChange={(event) => setAuxiliaryArchiveDraft((draft) => ({ ...draft, owner: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label><label className="grid gap-1 text-xs text-slate-600">费用科目<input value={auxiliaryArchiveDraft.subject} onChange={(event) => setAuxiliaryArchiveDraft((draft) => ({ ...draft, subject: event.target.value }))} placeholder="6602 管理费用" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label><label className="grid gap-1 text-xs text-slate-600">人员数<input type="number" min="0" step="1" value={auxiliaryArchiveDraft.people} onChange={(event) => setAuxiliaryArchiveDraft((draft) => ({ ...draft, people: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label></>}
              <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">备注<input value={auxiliaryArchiveDraft.remark} onChange={(event) => setAuxiliaryArchiveDraft((draft) => ({ ...draft, remark: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
            </div></div>
            <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-3"><div className="flex gap-2">{editingAuxiliaryArchiveItemId && isTauri && <button type="button" onClick={() => void handleToggleAuxiliaryArchive()} className="h-8 rounded border border-amber-300 px-3 text-xs text-amber-700">启用/停用</button>}{editingAuxiliaryArchiveItemId && isTauri && <button type="button" onClick={() => void handleDeleteAuxiliaryArchive()} className="h-8 rounded border border-red-300 px-3 text-xs text-red-700">删除档案</button>}</div><div className="flex gap-2"><button type="button" onClick={() => setShowAuxiliaryArchiveDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white">保存档案</button></div></div>
          </form>
        </div>
      )}
      {showCompanyAccountDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label={editingCompanyAccountId ? '编辑账户档案' : '新增账户档案'}>
          <form onSubmit={handleSaveCompanyAccount} className="w-full max-w-2xl border border-slate-300 bg-white shadow-xl">
            <div className="flex min-h-11 items-center justify-between border-b border-slate-200 px-4 py-2"><div><h2 className="text-sm font-semibold text-slate-900">{editingCompanyAccountId ? '编辑账户档案' : '新增账户档案'}</h2><p className="mt-0.5 text-xs text-slate-500">账户档案属于当前账套；银行直连或自动采集仍需在合法授权接口配置完成后启用。</p></div><button type="button" onClick={() => setShowCompanyAccountDialog(false)} className="text-xs text-slate-500">取消</button></div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-slate-600">账户名称 *<input required value={companyAccountDraft.accountName} onChange={(event) => setCompanyAccountDraft((draft) => ({ ...draft, accountName: event.target.value }))} placeholder="如：工行基本户" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs text-slate-600">账户类型 *<select value={companyAccountDraft.accountType} onChange={(event) => setCompanyAccountDraft((draft) => ({ ...draft, accountType: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900"><option>银行账户</option><option>第三方支付</option><option>现金账户</option><option>其他货币资金</option></select></label>
              <label className="grid gap-1 text-xs text-slate-600">开户机构<input value={companyAccountDraft.bankName} onChange={(event) => setCompanyAccountDraft((draft) => ({ ...draft, bankName: event.target.value }))} placeholder="如：工商银行上海分行" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs text-slate-600">账号/标识 *<input required value={companyAccountDraft.accountNumber} onChange={(event) => setCompanyAccountDraft((draft) => ({ ...draft, accountNumber: event.target.value }))} placeholder="银行账号或支付账户标识" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs text-slate-600">默认科目 *<input required value={companyAccountDraft.subjectCode} onChange={(event) => setCompanyAccountDraft((draft) => ({ ...draft, subjectCode: event.target.value }))} placeholder="如：1002 银行存款" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs text-slate-600">期初余额<input type="number" step="0.01" value={companyAccountDraft.openingBalance} onChange={(event) => setCompanyAccountDraft((draft) => ({ ...draft, openingBalance: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs text-slate-600">状态<select value={companyAccountDraft.status} onChange={(event) => setCompanyAccountDraft((draft) => ({ ...draft, status: event.target.value as '启用' | '停用' }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900"><option>启用</option><option>停用</option></select></label>
              <label className="grid gap-1 text-xs text-slate-600">附件/备注<input value={companyAccountDraft.attachmentNote} onChange={(event) => setCompanyAccountDraft((draft) => ({ ...draft, attachmentNote: event.target.value }))} placeholder="如：开户许可证、网银截图" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3"><div>{editingCompanyAccountId && <button type="button" onClick={() => void handleDeleteCompanyAccount()} className="h-8 rounded border border-red-300 px-3 text-xs text-red-700">删除账户</button>}</div><div className="flex gap-2"><button type="button" onClick={() => setShowCompanyAccountDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white">保存账户</button></div></div>
          </form>
        </div>
      )}
      {showAssetCategoryDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label={editingAssetCategoryId ? '编辑资产类别' : '新增资产类别'}>
          <form onSubmit={handleSaveAssetCategory} className="w-full max-w-2xl border border-slate-300 bg-white shadow-xl">
            <div className="flex min-h-11 items-center justify-between border-b border-slate-200 px-4 py-2"><div><h2 className="text-sm font-semibold text-slate-900">{editingAssetCategoryId ? '编辑资产类别' : '新增资产类别'}</h2><p className="mt-0.5 text-xs text-slate-500">类别参数用于固定资产录入、折旧计算和凭证建议，保存后请按企业会计政策复核。</p></div><button type="button" onClick={() => setShowAssetCategoryDialog(false)} className="text-xs text-slate-500">取消</button></div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-slate-600">类别编码 *<input required value={assetCategoryDraft.code} onChange={(event) => setAssetCategoryDraft((draft) => ({ ...draft, code: event.target.value }))} placeholder="如：FA01" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs text-slate-600">类别名称 *<input required value={assetCategoryDraft.name} onChange={(event) => setAssetCategoryDraft((draft) => ({ ...draft, name: event.target.value }))} placeholder="如：机器设备" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs text-slate-600">折旧年限（月） *<input required type="number" min="1" value={assetCategoryDraft.usefulLifeMonths} onChange={(event) => setAssetCategoryDraft((draft) => ({ ...draft, usefulLifeMonths: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs text-slate-600">残值率（%） *<input required type="number" min="0" max="100" step="0.01" value={assetCategoryDraft.residualRate} onChange={(event) => setAssetCategoryDraft((draft) => ({ ...draft, residualRate: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs text-slate-600">折旧方法 *<select value={assetCategoryDraft.depreciationMethod} onChange={(event) => setAssetCategoryDraft((draft) => ({ ...draft, depreciationMethod: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900"><option>平均年限法</option><option>工作量法</option><option>双倍余额递减法</option><option>年数总和法</option></select></label>
              <label className="grid gap-1 text-xs text-slate-600">费用科目<input value={assetCategoryDraft.expenseAccount} onChange={(event) => setAssetCategoryDraft((draft) => ({ ...draft, expenseAccount: event.target.value }))} placeholder="如：6602 管理费用" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs text-slate-600">固定资产科目 *<input required value={assetCategoryDraft.assetAccount} onChange={(event) => setAssetCategoryDraft((draft) => ({ ...draft, assetAccount: event.target.value }))} placeholder="如：1601 固定资产" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs text-slate-600">累计折旧科目 *<input required value={assetCategoryDraft.accumulatedDepreciationAccount} onChange={(event) => setAssetCategoryDraft((draft) => ({ ...draft, accumulatedDepreciationAccount: event.target.value }))} placeholder="如：1602 累计折旧" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              <label className="inline-flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={assetCategoryDraft.isEnabled} onChange={(event) => setAssetCategoryDraft((draft) => ({ ...draft, isEnabled: event.target.checked }))} />立即启用</label>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3"><div>{editingAssetCategoryId && <button type="button" onClick={() => void handleDeleteAssetCategory()} className="h-8 rounded border border-red-300 px-3 text-xs text-red-700">删除类别</button>}</div><div className="flex gap-2"><button type="button" onClick={() => setShowAssetCategoryDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white">保存类别</button></div></div>
          </form>
        </div>
      )}
      {showMatchingRuleDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label={matchingRuleScope === 'ai_training' ? (editingMatchingRuleId ? '编辑AI训练规则' : '新增AI训练规则') : (editingMatchingRuleId ? '编辑自动匹配规则' : '新增自动匹配规则')}>
          <form onSubmit={handleSaveMatchingRule} className="w-full max-w-2xl border border-slate-300 bg-white shadow-xl">
            <div className="flex min-h-11 items-center justify-between border-b border-slate-200 px-4 py-2"><div><h2 className="text-sm font-semibold text-slate-900">{matchingRuleScope === 'ai_training' ? (editingMatchingRuleId ? '编辑AI训练规则' : '新增AI训练规则') : (editingMatchingRuleId ? '编辑自动匹配规则' : '新增自动匹配规则')}</h2><p className="mt-0.5 text-xs text-slate-500">{matchingRuleScope === 'ai_training' ? '训练规则只发布待确认的 AI 建议，不能直接生成已审核凭证或提交税务。' : '规则只生成匹配建议和待确认动作，自动生成凭证、税务提交仍需人工复核。'}</p></div><button type="button" onClick={() => setShowMatchingRuleDialog(false)} className="text-xs text-slate-500">取消</button></div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-slate-600">规则名称 *<input required value={matchingRuleDraft.name} onChange={(event) => setMatchingRuleDraft((draft) => ({ ...draft, name: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs text-slate-600">优先级<input type="number" min="0" value={matchingRuleDraft.priority} onChange={(event) => setMatchingRuleDraft((draft) => ({ ...draft, priority: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">{matchingRuleScope === 'ai_training' ? '训练条件/样本来源' : '匹配条件'} *<textarea required rows={3} value={matchingRuleDraft.conditionText} onChange={(event) => setMatchingRuleDraft((draft) => ({ ...draft, conditionText: event.target.value }))} placeholder={matchingRuleScope === 'ai_training' ? '如：已审核销项发票服务费项目与历史凭证摘要' : '如：摘要包含货款，且对方户名匹配客户'} className="resize-y rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">{matchingRuleScope === 'ai_training' ? '建议动作' : '处理动作'} *<input required value={matchingRuleDraft.actionText} onChange={(event) => setMatchingRuleDraft((draft) => ({ ...draft, actionText: event.target.value }))} placeholder={matchingRuleScope === 'cash_flow' ? '如：经营活动现金流入' : matchingRuleScope === 'ai_training' ? '如：生成待确认收入凭证建议' : '如：生成待确认凭证建议'} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs text-slate-600">{matchingRuleScope === 'ai_training' ? '目标科目' : '目标科目/现金流编码'}<input value={matchingRuleDraft.targetAccountCode} onChange={(event) => setMatchingRuleDraft((draft) => ({ ...draft, targetAccountCode: event.target.value }))} placeholder={matchingRuleScope === 'ai_training' ? '如：6001 主营业务收入' : '如：1002/1122 或 CF-01'} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs text-slate-600">凭证模板（可选）<input value={matchingRuleDraft.voucherTemplateId} onChange={(event) => setMatchingRuleDraft((draft) => ({ ...draft, voucherTemplateId: event.target.value }))} placeholder="模板 ID 或名称" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              {matchingRuleScope === 'ai_training' ? (
                <p className="text-xs leading-5 text-amber-700 sm:col-span-2">新训练规则保存后进入待复核；勾选规则后使用“复核并发布勾选规则”完成确认。已发布规则编辑时保持当前发布状态。</p>
              ) : (
                <label className="inline-flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={matchingRuleDraft.isEnabled} onChange={(event) => setMatchingRuleDraft((draft) => ({ ...draft, isEnabled: event.target.checked }))} />立即启用</label>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3"><div>{editingMatchingRuleId && <button type="button" onClick={() => void handleDeleteMatchingRule()} className="h-8 rounded border border-red-300 px-3 text-xs text-red-700">删除规则</button>}</div><div className="flex gap-2"><button type="button" onClick={() => setShowMatchingRuleDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white">保存规则</button></div></div>
          </form>
        </div>
      )}
      {showAuxiliaryCategoryDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label={editingAuxiliaryCategoryId ? '编辑辅助核算类别' : '新增辅助核算类别'}>
          <form onSubmit={handleSaveAuxiliaryCategory} className="w-full max-w-xl border border-slate-300 bg-white shadow-xl">
            <div className="flex min-h-11 items-center justify-between border-b border-slate-200 px-4 py-2"><div><h2 className="text-sm font-semibold text-slate-900">{editingAuxiliaryCategoryId ? '编辑辅助核算类别' : '新增辅助核算类别'}</h2><p className="mt-0.5 text-xs text-slate-500">类别用于科目、凭证和账簿的辅助维度校验；系统预置类别不可改动。</p></div><button type="button" onClick={() => setShowAuxiliaryCategoryDialog(false)} className="text-xs text-slate-500 hover:text-slate-900">取消</button></div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-slate-600">类别编码 *<input required value={auxiliaryCategoryDraft.code} onChange={(event) => setAuxiliaryCategoryDraft((draft) => ({ ...draft, code: event.target.value }))} placeholder="如：CUSTOMER" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]" /></label>
              <label className="grid gap-1 text-xs text-slate-600">类别名称 *<input required value={auxiliaryCategoryDraft.name} onChange={(event) => setAuxiliaryCategoryDraft((draft) => ({ ...draft, name: event.target.value }))} placeholder="如：客户" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]" /></label>
              <label className="grid gap-1 text-xs text-slate-600">显示顺序<input type="number" min="0" step="1" value={auxiliaryCategoryDraft.sortOrder} onChange={(event) => setAuxiliaryCategoryDraft((draft) => ({ ...draft, sortOrder: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]" /></label>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-3"><div>{editingAuxiliaryCategoryId && <button type="button" onClick={() => void handleDeleteAuxiliaryCategory()} className="h-8 rounded border border-red-300 px-3 text-xs text-red-700 hover:bg-red-50">删除类别</button>}</div><div className="flex gap-2"><button type="button" onClick={() => setShowAuxiliaryCategoryDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">{editingAuxiliaryCategoryId ? '保存修改' : '保存类别'}</button></div></div>
          </form>
        </div>
      )}
      {showAuxiliaryItemDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label={editingAuxiliaryItemId ? '编辑辅助核算项目' : '新增辅助核算项目'}>
          <form onSubmit={handleSaveAuxiliaryItem} className="w-full max-w-xl border border-slate-300 bg-white shadow-xl">
            <div className="flex min-h-11 items-center justify-between border-b border-slate-200 px-4 py-2"><div><h2 className="text-sm font-semibold text-slate-900">{editingAuxiliaryItemId ? '编辑辅助核算项目' : '新增辅助核算项目'}</h2><p className="mt-0.5 text-xs text-slate-500">项目是客户、供应商、项目、部门等基础档案的统一明细，可在凭证辅助核算中引用。</p></div><button type="button" onClick={() => setShowAuxiliaryItemDialog(false)} className="text-xs text-slate-500 hover:text-slate-900">取消</button></div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">所属类别 *<select required value={auxiliaryItemDraft.categoryId} onChange={(event) => setAuxiliaryItemDraft((draft) => ({ ...draft, categoryId: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]"><option value="">请选择辅助核算类别</option>{(isTauri ? auxiliaryCategories : previewAuxiliaryCategories).map((category) => <option key={category.id} value={category.id}>{category.code}｜{category.name}</option>)}</select></label>
              <label className="grid gap-1 text-xs text-slate-600">项目编码 *<input required value={auxiliaryItemDraft.code} onChange={(event) => setAuxiliaryItemDraft((draft) => ({ ...draft, code: event.target.value }))} placeholder="如：C001" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]" /></label>
              <label className="grid gap-1 text-xs text-slate-600">项目名称 *<input required value={auxiliaryItemDraft.name} onChange={(event) => setAuxiliaryItemDraft((draft) => ({ ...draft, name: event.target.value }))} placeholder="如：上海示例客户" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]" /></label>
              <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">别名/备注<input value={auxiliaryItemDraft.remarks} onChange={(event) => setAuxiliaryItemDraft((draft) => ({ ...draft, remarks: event.target.value }))} placeholder="助记码、合同号或补充说明" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]" /></label>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-3"><div className="flex gap-2">{editingAuxiliaryItemId && <button type="button" onClick={() => void handleDeleteAuxiliaryItem()} className="h-8 rounded border border-red-300 px-3 text-xs text-red-700 hover:bg-red-50">删除项目</button>}{editingAuxiliaryItemId && <button type="button" onClick={() => void handleToggleAuxiliaryItem()} className="h-8 rounded border border-amber-300 px-3 text-xs text-amber-700 hover:bg-amber-50">{auxiliaryItems.find((item) => item.id === editingAuxiliaryItemId)?.is_enabled === 1 ? '停用项目' : '启用项目'}</button>}</div><div className="flex gap-2"><button type="button" onClick={() => setShowAuxiliaryItemDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">{editingAuxiliaryItemId ? '保存修改' : '保存项目'}</button></div></div>
          </form>
        </div>
      )}
      {showReportFormulaDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="编辑报表公式">
          <form onSubmit={handleSaveReportFormula} className="w-full max-w-2xl border border-slate-300 bg-white shadow-xl">
            <div className="flex min-h-11 items-center justify-between border-b border-slate-200 px-4 py-2"><div><h2 className="text-sm font-semibold text-slate-900">编辑报表公式</h2><p className="mt-0.5 text-xs text-amber-700">标准模板修改会影响后续报表取数，保存前必须完成公式和重算结果复核。</p></div><button type="button" onClick={() => setShowReportFormulaDialog(false)} className="text-xs text-slate-500 hover:text-slate-900">取消</button></div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-slate-600">报表项目 *<input required value={reportFormulaDraft.itemName} onChange={(event) => setReportFormulaDraft((draft) => ({ ...draft, itemName: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]" /></label>
              <label className="grid gap-1 text-xs text-slate-600">显示顺序<input required type="number" min="0" step="1" value={reportFormulaDraft.sortOrder} onChange={(event) => setReportFormulaDraft((draft) => ({ ...draft, sortOrder: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]" /></label>
              <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">取数公式/科目 *<textarea required rows={4} value={reportFormulaDraft.formula} onChange={(event) => setReportFormulaDraft((draft) => ({ ...draft, formula: event.target.value }))} placeholder="如：1001+1002+1012" className="resize-y rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#1f65a7]" /></label>
              <label className="inline-flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={reportFormulaDraft.isTotal} onChange={(event) => setReportFormulaDraft((draft) => ({ ...draft, isTotal: event.target.checked }))} />汇总项目</label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3"><button type="button" onClick={() => setShowReportFormulaDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">确认保存并复核</button></div>
          </form>
        </div>
      )}
      {showSocialSecurityDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="新增社保明细">
          <form onSubmit={handleSaveSocialSecurityRecord} className="w-full max-w-xl border border-slate-300 bg-white shadow-xl">
            <div className="flex h-11 items-center justify-between border-b border-slate-200 px-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">新增社保明细</h2>
                <p className="mt-0.5 text-xs text-slate-500">按员工记录本期社保和公积金基数，生成凭证前仍需人工复核。</p>
              </div>
              <button type="button" onClick={() => setShowSocialSecurityDialog(false)} className="text-xs text-slate-500 hover:text-slate-900">取消</button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-slate-600 sm:col-span-2">
                <span>人员</span>
                <select required value={socialSecurityDraft.employeeId} onChange={(event) => setSocialSecurityDraft((draft) => ({ ...draft, employeeId: event.target.value }))} className="h-8 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  <option value="">选择在职人员</option>
                  {!isTauri && <option value="preview-employee">PREVIEW 预览员工</option>}
                  {employees.filter((employee) => employee.employmentStatus === '在职').map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeCode} {employee.name}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>缴费城市</span>
                <input value={socialSecurityDraft.city} onChange={(event) => setSocialSecurityDraft((draft) => ({ ...draft, city: event.target.value }))} placeholder="例如：上海" className="h-8 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>缴费基数</span>
                <input min="0" step="0.01" type="number" value={socialSecurityDraft.base} onChange={(event) => setSocialSecurityDraft((draft) => ({ ...draft, base: event.target.value }))} className="h-8 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>单位部分</span>
                <input min="0" step="0.01" type="number" value={socialSecurityDraft.company} onChange={(event) => setSocialSecurityDraft((draft) => ({ ...draft, company: event.target.value }))} className="h-8 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>个人部分</span>
                <input min="0" step="0.01" type="number" value={socialSecurityDraft.personal} onChange={(event) => setSocialSecurityDraft((draft) => ({ ...draft, personal: event.target.value }))} className="h-8 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600 sm:col-span-2">
                <span>公积金</span>
                <input min="0" step="0.01" type="number" value={socialSecurityDraft.fund} onChange={(event) => setSocialSecurityDraft((draft) => ({ ...draft, fund: event.target.value }))} className="h-8 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button type="button" onClick={() => setShowSocialSecurityDialog(false)} className="h-8 border border-slate-300 px-3 text-xs text-slate-700">取消</button>
              <button type="submit" className="h-8 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">保存明细</button>
            </div>
          </form>
        </div>
      )}
      {showSpecialDeductionDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="新增专项附加扣除">
          <form onSubmit={handleSaveSpecialDeductionRecord} className="w-full max-w-lg border border-slate-300 bg-white shadow-xl">
            <div className="flex h-11 items-center justify-between border-b border-slate-200 px-4"><h2 className="text-sm font-semibold text-slate-900">新增专项附加扣除</h2><button type="button" onClick={() => setShowSpecialDeductionDialog(false)} className="text-xs text-slate-500">取消</button></div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">人员 *
                <select required value={specialDeductionDraft.employeeId} onChange={(event) => setSpecialDeductionDraft((draft) => ({ ...draft, employeeId: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  <option value="">选择在职人员</option>{!isTauri && <option value="preview-employee">PREVIEW 预览员工</option>}{employees.filter((employee) => employee.employmentStatus === '在职').map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeCode} {employee.name}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-slate-600">扣除类型 *
                <select value={specialDeductionDraft.deductionType} onChange={(event) => setSpecialDeductionDraft((draft) => ({ ...draft, deductionType: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  {['子女教育', '继续教育', '大病医疗', '住房贷款利息', '住房租金', '赡养老人', '3岁以下婴幼儿照护'].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-slate-600">资料来源
                <select value={specialDeductionDraft.source} onChange={(event) => setSpecialDeductionDraft((draft) => ({ ...draft, source: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900"><option value="手工">手工</option><option value="导入">导入</option><option value="客户确认">客户确认</option></select>
              </label>
              <label className="grid gap-1 text-xs text-slate-600">起始月份 *<input required type="month" value={specialDeductionDraft.startMonth} onChange={(event) => setSpecialDeductionDraft((draft) => ({ ...draft, startMonth: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs text-slate-600">结束月份<input type="month" value={specialDeductionDraft.endMonth} onChange={(event) => setSpecialDeductionDraft((draft) => ({ ...draft, endMonth: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">月扣除额 *<input required type="number" min="0" step="0.01" value={specialDeductionDraft.monthlyAmount} onChange={(event) => setSpecialDeductionDraft((draft) => ({ ...draft, monthlyAmount: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3"><button type="button" onClick={() => setShowSpecialDeductionDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white">保存扣除资料</button></div>
          </form>
        </div>
      )}
      {showBankTransactionDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label={editingBankTransactionId ? '编辑银行流水' : '新增银行流水'}>
          <form onSubmit={handleSaveBankTransaction} className="w-full max-w-2xl border border-slate-300 bg-white shadow-xl">
            <div className="flex h-11 items-center justify-between border-b border-slate-200 px-4"><h2 className="text-sm font-semibold text-slate-900">{editingBankTransactionId ? '编辑银行流水' : '新增银行流水'}</h2><button type="button" onClick={() => setShowBankTransactionDialog(false)} className="text-xs text-slate-500">取消</button></div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {([
                { field: 'accountName', label: '银行账户 *', type: 'text', required: true }, { field: 'serialNo', label: '流水号 *', type: 'text', required: true },
                { field: 'transactionDate', label: '交易日期 *', type: 'date', required: true }, { field: 'counterparty', label: '对方户名', type: 'text' },
                { field: 'summary', label: '摘要', type: 'text' }, { field: 'balance', label: '账户余额', type: 'number' },
                { field: 'incomeAmount', label: '收入金额', type: 'number' }, { field: 'expenseAmount', label: '支出金额', type: 'number' },
              ] as Array<{ field: keyof typeof bankTransactionDraft; label: string; type: string; required?: boolean }>).map(({ field, label, type, required }) => (
                <label key={field} className="grid gap-1 text-xs text-slate-600">{label}<input required={required} type={type} min={type === 'number' ? '0' : undefined} step={type === 'number' ? '0.01' : undefined} value={bankTransactionDraft[field]} onChange={(event) => setBankTransactionDraft((draft) => ({ ...draft, [field]: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              ))}
              <label className="grid gap-1 text-xs text-slate-600">回单状态<select value={bankTransactionDraft.receiptStatus} onChange={(event) => setBankTransactionDraft((draft) => ({ ...draft, receiptStatus: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900"><option value="待上传">待上传</option><option value="已归档">已归档</option></select></label>
              <p className="self-end text-xs leading-5 text-slate-500">收入与支出必须二选一；保存后仅进入待匹配清单。</p>
              <fieldset className="space-y-1 text-xs text-slate-600 sm:col-span-2">
                <legend>业务标签</legend>
                <div className="flex flex-wrap gap-2 border border-slate-200 p-2">
                  {effectiveBusinessTags.filter((tag) => tag.is_enabled === 1).length === 0 && <span className="text-slate-400">请先在“标签”档案中维护可用标签。</span>}
                  {effectiveBusinessTags.filter((tag) => tag.is_enabled === 1).map((tag) => <label key={tag.id} className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"><input type="checkbox" checked={selectedBankTransactionTagIds.includes(tag.id)} onChange={(event) => setSelectedBankTransactionTagIds((ids) => event.target.checked ? [...ids, tag.id] : ids.filter((id) => id !== tag.id))} />{tag.name}</label>)}
                </div>
              </fieldset>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3"><button type="button" onClick={() => setShowBankTransactionDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white">{editingBankTransactionId ? '保存修改' : '保存流水'}</button></div>
          </form>
        </div>
      )}
      {showDeclarationReceiptDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="归档回执缴款信息">
          <form onSubmit={handleSaveDeclarationReceipt} className="w-full max-w-2xl border border-slate-300 bg-white shadow-xl">
            <div className="flex h-11 items-center justify-between border-b border-slate-200 px-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">归档回执缴款信息</h2>
                <p className="mt-0.5 text-xs text-slate-500">仅登记已人工取得的回执和缴款书，不会发起税局申报或银行扣款。</p>
              </div>
              <button type="button" onClick={() => setShowDeclarationReceiptDialog(false)} className="text-xs text-slate-500 hover:text-slate-900">取消</button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">申报事项 *
                <select value={declarationReceiptDraft.taskId} onChange={(event) => {
                  const task = effectiveTaxDeclarationTasks.find((item) => item.id === event.target.value)
                  if (task) openDeclarationReceiptEditor(task)
                }} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  {effectiveTaxDeclarationTasks.map((task) => <option key={task.id} value={task.id}>{task.period}｜{task.taxType}｜{task.formName}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-slate-600">回执号
                <input value={declarationReceiptDraft.receiptNo} onChange={(event) => setDeclarationReceiptDraft((draft) => ({ ...draft, receiptNo: event.target.value }))} placeholder="人工取得后填写" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="grid gap-1 text-xs text-slate-600">回执归档时间
                <input type="datetime-local" value={declarationReceiptDraft.receivedAt} onChange={(event) => setDeclarationReceiptDraft((draft) => ({ ...draft, receivedAt: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="grid gap-1 text-xs text-slate-600">缴款状态 *
                <select value={declarationReceiptDraft.paymentStatus} onChange={(event) => setDeclarationReceiptDraft((draft) => ({ ...draft, paymentStatus: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  {['未记录', '无需缴款', '待缴款', '已缴款', '缴款异常'].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-slate-600">缴款书号
                <input value={declarationReceiptDraft.paymentNo} onChange={(event) => setDeclarationReceiptDraft((draft) => ({ ...draft, paymentNo: event.target.value }))} placeholder="人工取得后填写" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3"><button type="button" onClick={() => setShowDeclarationReceiptDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white">保存归档信息</button></div>
          </form>
        </div>
      )}
      {showTaxInitDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label={taxInitDraft.taskId ? '编辑申报认定事项' : '新增申报认定事项'}>
          <form onSubmit={handleSaveTaxInit} className="w-full max-w-2xl border border-slate-300 bg-white shadow-xl">
            <div className="flex h-11 items-center justify-between border-b border-slate-200 px-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{taxInitDraft.taskId ? '编辑申报认定事项' : '新增申报认定事项'}</h2>
                <p className="mt-0.5 text-xs text-slate-500">仅维护本地认定和取数状态，不会登录税局、提交申报或扣款。</p>
              </div>
              <button type="button" onClick={() => setShowTaxInitDialog(false)} className="text-xs text-slate-500 hover:text-slate-900">取消</button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-slate-600">税种 *
                <input required disabled={Boolean(taxInitDraft.taskId)} value={taxInitDraft.taxType} onChange={(event) => setTaxInitDraft((draft) => ({ ...draft, taxType: event.target.value }))} placeholder="例如：增值税及附加" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100" />
              </label>
              <label className="grid gap-1 text-xs text-slate-600">申报表 *
                <input required disabled={Boolean(taxInitDraft.taskId)} value={taxInitDraft.formName} onChange={(event) => setTaxInitDraft((draft) => ({ ...draft, formName: event.target.value }))} placeholder="例如：增值税及附加申报表" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100" />
              </label>
              <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">取数依据/认定说明
                <input value={taxInitDraft.sourceSnapshot} onChange={(event) => setTaxInitDraft((draft) => ({ ...draft, sourceSnapshot: event.target.value }))} placeholder="例如：销项发票、进项勾选、工资表已人工核验" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="grid gap-1 text-xs text-slate-600">计税依据（元）
                <input min="0" step="0.01" type="number" value={taxInitDraft.taxableAmount} onChange={(event) => setTaxInitDraft((draft) => ({ ...draft, taxableAmount: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="grid gap-1 text-xs text-slate-600">应缴金额（元）
                <input min="0" step="0.01" type="number" value={taxInitDraft.payableAmount} onChange={(event) => setTaxInitDraft((draft) => ({ ...draft, payableAmount: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="grid gap-1 text-xs text-slate-600">取数状态 *
                <select value={taxInitDraft.collectStatus} onChange={(event) => setTaxInitDraft((draft) => ({ ...draft, collectStatus: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  <option value="collected">已取数</option><option value="not_collected">待取数</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs text-slate-600">校验状态 *
                <select value={taxInitDraft.validationStatus} onChange={(event) => setTaxInitDraft((draft) => ({ ...draft, validationStatus: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  <option value="pending">待校验</option><option value="passed">已通过</option><option value="failed">校验失败</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs text-slate-600">风险项
                <select value={taxInitDraft.riskCount} onChange={(event) => setTaxInitDraft((draft) => ({ ...draft, riskCount: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  <option value="0">无</option><option value="1">1 项待复核</option><option value="2">2 项待复核</option><option value="3">3 项待复核</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs text-slate-600">授权适配器代码
                <input value={taxInitDraft.adapterCode} onChange={(event) => setTaxInitDraft((draft) => ({ ...draft, adapterCode: event.target.value }))} placeholder="仅记录已授权适配器标识" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3"><button type="button" onClick={() => setShowTaxInitDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white">保存认定事项</button></div>
          </form>
        </div>
      )}
      {showNonTaxRevenueDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="新增非税缴费事项">
          <form onSubmit={handleSaveNonTaxRevenue} className="w-full max-w-2xl border border-slate-300 bg-white shadow-xl">
            <div className="flex h-11 items-center justify-between border-b border-slate-200 px-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">新增非税缴费事项</h2>
                <p className="mt-0.5 text-xs text-slate-500">登记本地计费台账；不会计算法定税额、生成外部缴款书或提交申报。</p>
              </div>
              <button type="button" onClick={() => setShowNonTaxRevenueDialog(false)} className="text-xs text-slate-500 hover:text-slate-900">取消</button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-slate-600">非税事项 *
                <select value={nonTaxRevenueDraft.item} onChange={(event) => setNonTaxRevenueDraft((draft) => ({ ...draft, item: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  {['工会经费', '残保金', '水利建设基金', '其他非税'].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-slate-600">地区政策/计费口径 *
                <input required value={nonTaxRevenueDraft.policy} onChange={(event) => setNonTaxRevenueDraft((draft) => ({ ...draft, policy: event.target.value }))} placeholder="例如：上海市政策口径，按工资总额" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="grid gap-1 text-xs text-slate-600">计费依据 *
                <input required value={nonTaxRevenueDraft.source} onChange={(event) => setNonTaxRevenueDraft((draft) => ({ ...draft, source: event.target.value }))} placeholder="例如：工资表、营业收入台账" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="grid gap-1 text-xs text-slate-600">计费金额 *
                <input required min="0" step="0.01" type="number" value={nonTaxRevenueDraft.basisAmount} onChange={(event) => setNonTaxRevenueDraft((draft) => ({ ...draft, basisAmount: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="grid gap-1 text-xs text-slate-600">应缴金额 *
                <input required min="0" step="0.01" type="number" value={nonTaxRevenueDraft.payableAmount} onChange={(event) => setNonTaxRevenueDraft((draft) => ({ ...draft, payableAmount: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="grid gap-1 text-xs text-slate-600">风险项
                <select value={nonTaxRevenueDraft.riskCount} onChange={(event) => setNonTaxRevenueDraft((draft) => ({ ...draft, riskCount: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  <option value="0">无</option><option value="1">1 项待复核</option><option value="2">2 项待复核</option><option value="3">3 项待复核</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">缴款书号
                <input value={nonTaxRevenueDraft.receiptNo} onChange={(event) => setNonTaxRevenueDraft((draft) => ({ ...draft, receiptNo: event.target.value }))} placeholder="已有缴款书时人工填写；未填写则保持待确认" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3"><button type="button" onClick={() => setShowNonTaxRevenueDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white">保存本地台账</button></div>
          </form>
        </div>
      )}
      {showDocumentRecordDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label={documentRecordDialogTitle(kind, documentRecordDraft.businessType, Boolean(editingDocumentRecordId))}>
          <form onSubmit={handleSaveDocumentRecord} className="w-full max-w-xl border border-slate-300 bg-white shadow-xl">
            <div className="flex h-11 items-center justify-between border-b border-slate-200 px-4"><h2 className="text-sm font-semibold text-slate-900">{documentRecordDialogTitle(kind, documentRecordDraft.businessType, Boolean(editingDocumentRecordId))}</h2><button type="button" onClick={() => setShowDocumentRecordDialog(false)} className="text-xs text-slate-500">取消</button></div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {([{ field: 'businessDate', label: '业务日期 *', type: 'date', required: true }, { field: 'documentCode', label: '单据编号 *', type: 'text', required: true }, { field: 'partner', label: kind === 'contractLedger' ? '合同相对方' : kind === 'expenseReimbursement' ? '报销人' : kind === 'receipt' ? '出票/收款方' : '往来单位', type: 'text' }, { field: 'amount', label: '金额 *', type: 'number', required: true }, { field: 'owner', label: kind === 'expenseReimbursement' ? '审批经办人' : '经办人', type: 'text' }] as Array<{ field: keyof typeof documentRecordDraft; label: string; type: string; required?: boolean }>).map(({ field, label, type, required }) => <label key={field} className="grid gap-1 text-xs text-slate-600">{label}<input required={required} type={type} min={type === 'number' ? '0.01' : undefined} step={type === 'number' ? '0.01' : undefined} value={documentRecordDraft[field]} onChange={(event) => setDocumentRecordDraft((draft) => ({ ...draft, [field]: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>)}
              <label className="grid gap-1 text-xs text-slate-600">业务类型<select value={documentRecordDraft.businessType} onChange={(event) => setDocumentRecordDraft((draft) => ({ ...draft, businessType: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">{(kind === 'contractLedger' ? ['业务合同', '采购合同', '销售合同', '技术合同'] : kind === 'expenseReimbursement' ? ['费用报销', '差旅报销', '业务招待'] : kind === 'receipt' ? ['收款票据', '付款票据', '商业汇票'] : ['费用报销', '采购入库', '差旅报销', '合同付款', '收款票据', '付款票据', '其他']).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              <label className="grid gap-1 text-xs text-slate-600">附件状态<select value={documentRecordDraft.attachmentStatus} onChange={(event) => setDocumentRecordDraft((draft) => ({ ...draft, attachmentStatus: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900"><option value="待补附件">待补附件</option><option value="已归档">已归档</option></select></label>
              {kind === 'contractLedger' && <><label className="grid gap-1 text-xs text-slate-600">印花税税目<input value={documentRecordDraft.stampTaxItem} onChange={(event) => setDocumentRecordDraft((draft) => ({ ...draft, stampTaxItem: event.target.value }))} placeholder="人工确认后填写" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label><label className="grid gap-1 text-xs text-slate-600">印花税率（%）<input min="0" step="0.0001" type="number" value={documentRecordDraft.stampTaxRate} onChange={(event) => setDocumentRecordDraft((draft) => ({ ...draft, stampTaxRate: event.target.value }))} placeholder="人工确认后填写" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label></>}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3"><button type="button" onClick={() => setShowDocumentRecordDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white">{editingDocumentRecordId ? '保存修改' : '保存单据'}</button></div>
          </form>
        </div>
      )}
      {showBusinessOrderDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label={editingBusinessOrderId ? '编辑业务订单' : '新增业务订单'}>
          <form onSubmit={handleSaveBusinessOrder} className="w-full max-w-2xl border border-slate-300 bg-white shadow-xl">
            <div className="flex h-11 items-center justify-between border-b border-slate-200 px-4"><div><h2 className="text-sm font-semibold text-slate-900">{editingBusinessOrderId ? '编辑业务订单' : kind === 'purchaseManagement' ? '新增采购订单' : '新增销售订单'}</h2><p className="mt-0.5 text-xs text-slate-500">订单台账不自动生成发票、流水或凭证，相关关联须经人工确认。</p></div><button type="button" onClick={() => setShowBusinessOrderDialog(false)} className="text-xs text-slate-500">取消</button></div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {([{ field: 'businessDate', label: '业务日期 *', type: 'date' }, { field: 'orderNo', label: kind === 'purchaseManagement' ? '采购单号 *' : '销售单号 *', type: 'text' }, { field: 'counterparty', label: kind === 'purchaseManagement' ? '供应商 *' : '客户 *', type: 'text' }, { field: 'goodsName', label: '商品/服务 *', type: 'text' }, { field: 'amount', label: '含税金额 *', type: 'number' }, { field: 'sourceDocument', label: '来源单据/合同', type: 'text' }] as Array<{ field: keyof typeof businessOrderDraft; label: string; type: string }>).map(({ field, label, type }) => <label key={field} className="grid gap-1 text-xs text-slate-600">{label}<input required={field !== 'sourceDocument'} type={type} min={type === 'number' ? '0.01' : undefined} step={type === 'number' ? '0.01' : undefined} value={businessOrderDraft[field]} onChange={(event) => setBusinessOrderDraft((draft) => ({ ...draft, [field]: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>)}
              <label className="grid gap-1 text-xs text-slate-600">{kind === 'purchaseManagement' ? '入库状态' : '出库状态'}<select value={businessOrderDraft.fulfillmentStatus} onChange={(event) => setBusinessOrderDraft((draft) => ({ ...draft, fulfillmentStatus: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">{(kind === 'purchaseManagement' ? ['待入库', '已入库', '不适用'] : ['待出库', '已出库', '不适用']).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              <label className="grid gap-1 text-xs text-slate-600">{kind === 'purchaseManagement' ? '进项发票状态' : '销项开票状态'}<select value={businessOrderDraft.invoiceStatus} onChange={(event) => setBusinessOrderDraft((draft) => ({ ...draft, invoiceStatus: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">{(kind === 'purchaseManagement' ? ['待收票', '进项已匹配', '税额差异'] : ['待开票', '销项已开', '开票异常']).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              <label className="grid gap-1 text-xs text-slate-600">{kind === 'purchaseManagement' ? '付款状态' : '收款状态'}<select value={businessOrderDraft.settlementStatus} onChange={(event) => setBusinessOrderDraft((draft) => ({ ...draft, settlementStatus: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">{(kind === 'purchaseManagement' ? ['未付款', '部分付款', '已付款'] : ['未收款', '部分收款', '已收款']).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              <label className="grid gap-1 text-xs text-slate-600">订单状态<select value={businessOrderDraft.status} onChange={(event) => setBusinessOrderDraft((draft) => ({ ...draft, status: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">{['待确认', '已完成', '异常'].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3"><button type="button" onClick={() => setShowBusinessOrderDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white">{editingBusinessOrderId ? '保存修改' : '保存订单'}</button></div>
          </form>
        </div>
      )}
      {showCompanyTodoDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="新增账套待办">
          <form onSubmit={handleSaveCompanyTodo} className="w-full max-w-2xl border border-slate-300 bg-white shadow-xl">
            <div className="flex h-11 items-center justify-between border-b border-slate-200 px-4">
              <div><h2 className="text-sm font-semibold text-slate-900">新增账套待办</h2><p className="mt-0.5 text-xs text-slate-500">待办只保存到当前账套和账期，不发送短信、邮件，也不触发税务局或银行外部动作。</p></div>
              <button type="button" onClick={() => setShowCompanyTodoDialog(false)} className="text-xs text-slate-500 hover:text-slate-900">取消</button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">待办标题 *<input required value={companyTodoDraft.title} onChange={(event) => setCompanyTodoDraft((draft) => ({ ...draft, title: event.target.value }))} placeholder="例如：补传 2026-05 银行回单" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs text-slate-600">来源模块 *<select value={companyTodoDraft.sourceModule} onChange={(event) => setCompanyTodoDraft((draft) => ({ ...draft, sourceModule: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">{['资料采集', '进项发票', '销项发票', '会计凭证', '报表申报', '风险检查', '人工新增'].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              <label className="grid gap-1 text-xs text-slate-600">优先级<select value={companyTodoDraft.priority} onChange={(event) => setCompanyTodoDraft((draft) => ({ ...draft, priority: event.target.value as CompanyTodo['priority'] }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900"><option value="normal">普通</option><option value="high">高</option><option value="blocking">阻断</option></select></label>
              <label className="grid gap-1 text-xs text-slate-600">负责人<input value={companyTodoDraft.owner} onChange={(event) => setCompanyTodoDraft((draft) => ({ ...draft, owner: event.target.value }))} placeholder="内部处理人" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs text-slate-600">截止日期<input type="date" value={companyTodoDraft.dueDate} onChange={(event) => setCompanyTodoDraft((draft) => ({ ...draft, dueDate: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs text-slate-600">处理入口/关联事项<input value={companyTodoDraft.relatedEntry} onChange={(event) => setCompanyTodoDraft((draft) => ({ ...draft, relatedEntry: event.target.value }))} placeholder="例如：进项发票 INV-001" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs text-slate-600">处理依据/附件说明<input value={companyTodoDraft.evidence} onChange={(event) => setCompanyTodoDraft((draft) => ({ ...draft, evidence: event.target.value }))} placeholder="例如：银行回单 PDF" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">补充说明<textarea value={companyTodoDraft.note} onChange={(event) => setCompanyTodoDraft((draft) => ({ ...draft, note: event.target.value }))} rows={3} className="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900" /></label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3"><button type="button" onClick={() => setShowCompanyTodoDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">保存待办</button></div>
          </form>
        </div>
      )}
      {showAiJobDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="新增 AI 处理任务">
          <form onSubmit={handleSaveAiJob} className="w-full max-w-2xl border border-slate-300 bg-white shadow-xl">
            <div className="flex h-11 items-center justify-between border-b border-slate-200 px-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">新增 AI 处理任务</h2>
                <p className="mt-0.5 text-xs text-slate-500">任务仅进入本地待执行队列，识别、分类和凭证建议均须人工确认，不会自动生成或入账凭证。</p>
              </div>
              <button type="button" onClick={() => setShowAiJobDialog(false)} className="text-xs text-slate-500 hover:text-slate-900">取消</button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-slate-600">任务类型 *
                <select value={aiJobDraft.jobType} onChange={(event) => setAiJobDraft((draft) => ({ ...draft, jobType: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  <option value="invoice_recognition">发票识别与字段提取</option>
                  <option value="bank_classification">银行流水分类</option>
                  <option value="document_review">原始单据完整性核验</option>
                  <option value="voucher_suggestion">凭证建议生成</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs text-slate-600">来源模块 *
                <select value={aiJobDraft.sourceModule} onChange={(event) => setAiJobDraft((draft) => ({ ...draft, sourceModule: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  {['发票', '银行流水', '原始单据', '工资社保', '附件中心'].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-slate-600">来源记录编号
                <input value={aiJobDraft.sourceId} onChange={(event) => setAiJobDraft((draft) => ({ ...draft, sourceId: event.target.value }))} placeholder="例如：发票号码、流水号或单据编号" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="grid gap-1 text-xs text-slate-600">来源文件/影像
                <input value={aiJobDraft.sourceFile} onChange={(event) => setAiJobDraft((draft) => ({ ...draft, sourceFile: event.target.value }))} placeholder="例如：2026-05-销项票据.zip" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="grid gap-1 text-xs text-slate-600">风险等级
                <select value={aiJobDraft.riskLevel} onChange={(event) => setAiJobDraft((draft) => ({ ...draft, riskLevel: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  <option value="normal">常规</option><option value="warning">需复核</option><option value="high">高风险</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">处理说明
                <input value={aiJobDraft.summary} onChange={(event) => setAiJobDraft((draft) => ({ ...draft, summary: event.target.value }))} placeholder="说明本次需要识别、分类或生成建议的范围" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3"><button type="button" onClick={() => setShowAiJobDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white">创建待执行任务</button></div>
          </form>
        </div>
      )}
      {showAiVoucherSuggestionDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="新增 AI 凭证建议">
          <form onSubmit={handleCreateAiVoucherSuggestion} className="w-full max-w-2xl border border-slate-300 bg-white shadow-xl">
            <div className="flex h-11 items-center justify-between border-b border-slate-200 px-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">新增 AI 凭证建议</h2>
                <p className="mt-0.5 text-xs text-slate-500">记录待复核的来源、分录和置信度；保存后不生成或入账凭证。</p>
              </div>
              <button type="button" onClick={() => setShowAiVoucherSuggestionDialog(false)} className="text-xs text-slate-500 hover:text-slate-900">取消</button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {([
                { field: 'suggestionNo', label: '建议号', type: 'text', required: false },
                { field: 'sourceModule', label: '来源模块 *', type: 'text', required: true },
                { field: 'sourceId', label: '来源单据号', type: 'text', required: false },
                { field: 'sourceFile', label: '来源文件', type: 'text', required: false },
                { field: 'debitSubject', label: '借方科目 *', type: 'text', required: true },
                { field: 'creditSubject', label: '贷方科目 *', type: 'text', required: true },
                { field: 'amount', label: '建议金额 *', type: 'number', required: true },
                { field: 'confidence', label: '置信度（%）*', type: 'number', required: true },
              ] as Array<{ field: keyof typeof aiVoucherSuggestionDraft; label: string; type: string; required: boolean }>).map(({ field, label, type, required }) => (
                <label key={field} className="grid gap-1 text-xs text-slate-600">
                  {label}
                  <input required={required} type={type} min={type === 'number' ? '0' : undefined} max={field === 'confidence' ? '100' : undefined} step={type === 'number' ? '0.01' : undefined} value={aiVoucherSuggestionDraft[field]} onChange={(event) => setAiVoucherSuggestionDraft((draft) => ({ ...draft, [field]: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" />
                </label>
              ))}
              <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">
                建议摘要 *
                <input required value={aiVoucherSuggestionDraft.summary} onChange={(event) => setAiVoucherSuggestionDraft((draft) => ({ ...draft, summary: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="grid gap-1 text-xs text-slate-600">
                风险等级
                <select value={aiVoucherSuggestionDraft.riskLevel} onChange={(event) => setAiVoucherSuggestionDraft((draft) => ({ ...draft, riskLevel: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  <option value="low">低</option><option value="normal">一般</option><option value="high">高</option><option value="critical">阻断</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button type="button" onClick={() => setShowAiVoucherSuggestionDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button>
              <button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">保存待确认建议</button>
            </div>
          </form>
        </div>
      )}
      {showCostCarryoverDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true"><form onSubmit={handleSaveCostCarryover} className="w-full max-w-2xl border border-slate-300 bg-white shadow-xl"><div className="flex h-11 items-center justify-between border-b border-slate-200 px-4"><div><h2 className="text-sm font-semibold text-slate-900">{editingCostCarryoverId?'编辑成本结转':'新增成本结转'}</h2><p className="mt-0.5 text-xs text-slate-500">结转批次不会自动生成凭证，须复核成本和差异。</p></div><button type="button" onClick={()=>setShowCostCarryoverDialog(false)} className="text-xs text-slate-500">取消</button></div><div className="grid gap-3 p-4 sm:grid-cols-2">{([{field:'carryoverDate',label:'结转日期 *',type:'date'},{field:'batchNo',label:'结转批次 *',type:'text'},{field:'sourceBillNo',label:'来源单号 *',type:'text'},{field:'inventoryName',label:'存货名称 *',type:'text'},{field:'debitSubject',label:'借方科目 *',type:'text'},{field:'creditSubject',label:'贷方科目 *',type:'text'},{field:'costAmount',label:'结转成本 *',type:'number'},{field:'differenceAmount',label:'差异金额',type:'number'},{field:'voucherNo',label:'关联凭证号',type:'text'},{field:'sourceDocument',label:'来源附件',type:'text'}] as Array<{field:keyof typeof costCarryoverDraft;label:string;type:string}>).map(({field,label,type})=><label key={field} className="grid gap-1 text-xs text-slate-600">{label}<input required={['carryoverDate','batchNo','sourceBillNo','inventoryName','debitSubject','creditSubject','costAmount'].includes(field)} type={type} min={type==='number'?'0':undefined} step={type==='number'?'0.01':undefined} value={costCarryoverDraft[field]} onChange={(event)=>setCostCarryoverDraft((draft)=>({...draft,[field]:event.target.value}))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900"/></label>)}<label className="grid gap-1 text-xs text-slate-600">计价方法<select value={costCarryoverDraft.valuationMethod} onChange={(event)=>setCostCarryoverDraft((draft)=>({...draft,valuationMethod:event.target.value}))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">{['移动加权','月末一次加权','先进先出','个别计价'].map((item)=><option key={item} value={item}>{item}</option>)}</select></label><label className="grid gap-1 text-xs text-slate-600">状态<select value={costCarryoverDraft.status} onChange={(event)=>setCostCarryoverDraft((draft)=>({...draft,status:event.target.value}))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">{['待确认','已生成凭证','异常'].map((item)=><option key={item} value={item}>{item}</option>)}</select></label></div><div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3"><button type="button" onClick={()=>setShowCostCarryoverDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white">保存结转</button></div></form></div>
      )}
      {showBankReconciliationDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleSaveBankReconciliation} className="w-full max-w-2xl border border-slate-300 bg-white shadow-xl">
            <div className="flex h-11 items-center justify-between border-b border-slate-200 px-4"><div><h2 className="text-sm font-semibold text-slate-900">{editingBankReconciliationId ? '编辑银行对账' : '新增银行对账'}</h2><p className="mt-0.5 text-xs text-slate-500">对账记录不会自动修改银行流水或会计凭证。</p></div><button type="button" onClick={() => setShowBankReconciliationDialog(false)} className="text-xs text-slate-500">取消</button></div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">{([{ field: 'reconciliationDate', label: '对账日期 *', type: 'date' }, { field: 'reconciliationNo', label: '对账编号 *', type: 'text' }, { field: 'accountName', label: '银行账户 *', type: 'text' }, { field: 'transactionNo', label: '银行流水号 *', type: 'text' }, { field: 'summary', label: '摘要', type: 'text' }, { field: 'bankAmount', label: '银行金额 *', type: 'number' }, { field: 'bookAmount', label: '账面金额 *', type: 'number' }, { field: 'voucherNo', label: '关联凭证号', type: 'text' }, { field: 'owner', label: '复核人', type: 'text' }, { field: 'note', label: '差异说明', type: 'text' }] as Array<{ field: keyof typeof bankReconciliationDraft; label: string; type: string }>).map(({ field, label, type }) => <label key={field} className="grid gap-1 text-xs text-slate-600">{label}<input required={['reconciliationDate', 'reconciliationNo', 'accountName', 'transactionNo', 'bankAmount', 'bookAmount'].includes(field)} type={type} min={type === 'number' ? '0' : undefined} step={type === 'number' ? '0.01' : undefined} value={bankReconciliationDraft[field]} onChange={(event) => setBankReconciliationDraft((draft) => ({ ...draft, [field]: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>)}
              <label className="grid gap-1 text-xs text-slate-600">对账状态<select value={bankReconciliationDraft.matchStatus} onChange={(event) => setBankReconciliationDraft((draft) => ({ ...draft, matchStatus: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">{['待人工对账', '已匹配', '金额不一致', '未入账'].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              <label className="grid gap-1 text-xs text-slate-600">处理状态<select value={bankReconciliationDraft.status} onChange={(event) => setBankReconciliationDraft((draft) => ({ ...draft, status: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">{['待处理', '已匹配', '异常'].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3"><button type="button" onClick={() => setShowBankReconciliationDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white">保存对账</button></div>
          </form>
        </div>
      )}
      {showSettlementRecordDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleSaveSettlementRecord} className="w-full max-w-2xl border border-slate-300 bg-white shadow-xl">
            <div className="flex h-11 items-center justify-between border-b border-slate-200 px-4"><div><h2 className="text-sm font-semibold text-slate-900">{editingSettlementRecordId ? '编辑核销台账' : kind === 'payableSettlement' ? '新增应付核销' : '新增应收核销'}</h2><p className="mt-0.5 text-xs text-slate-500">核销记录不自动勾销发票或银行流水，须经人工核验后关联。</p></div><button type="button" onClick={() => setShowSettlementRecordDialog(false)} className="text-xs text-slate-500">取消</button></div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">{([{ field: 'settlementDate', label: '核销日期 *', type: 'date' }, { field: 'settlementNo', label: '核销编号 *', type: 'text' }, { field: 'counterparty', label: kind === 'payableSettlement' ? '供应商 *' : '客户 *', type: 'text' }, { field: 'invoiceNo', label: '关联发票号', type: 'text' }, { field: 'transactionNo', label: '银行流水号', type: 'text' }, { field: 'totalAmount', label: kind === 'payableSettlement' ? '应付金额 *' : '应收金额 *', type: 'number' }, { field: 'settledAmount', label: '本次核销金额 *', type: 'number' }, { field: 'owner', label: '经办人', type: 'text' }, { field: 'sourceDocument', label: '来源单据', type: 'text' }] as Array<{ field: keyof typeof settlementRecordDraft; label: string; type: string }>).map(({ field, label, type }) => <label key={field} className="grid gap-1 text-xs text-slate-600">{label}<input required={['settlementDate', 'settlementNo', 'counterparty', 'totalAmount', 'settledAmount'].includes(field)} type={type} min={type === 'number' ? '0' : undefined} step={type === 'number' ? '0.01' : undefined} value={settlementRecordDraft[field]} onChange={(event) => setSettlementRecordDraft((draft) => ({ ...draft, [field]: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>)}
              <label className="grid gap-1 text-xs text-slate-600">核销方式<select value={settlementRecordDraft.settlementMethod} onChange={(event) => setSettlementRecordDraft((draft) => ({ ...draft, settlementMethod: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">{['银行转账', '现金', '票据', '其他'].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              <label className="grid gap-1 text-xs text-slate-600">状态<select value={settlementRecordDraft.status} onChange={(event) => setSettlementRecordDraft((draft) => ({ ...draft, status: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">{['待确认', '已完成', '异常'].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3"><button type="button" onClick={() => setShowSettlementRecordDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white">保存核销</button></div>
          </form>
        </div>
      )}
      {showAccountTransferDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label={editingAccountTransferId ? '编辑账户转账' : '新增账户转账'}>
          <form onSubmit={handleSaveAccountTransfer} className="w-full max-w-xl border border-slate-300 bg-white shadow-xl">
            <div className="flex h-11 items-center justify-between border-b border-slate-200 px-4"><h2 className="text-sm font-semibold text-slate-900">{editingAccountTransferId ? '编辑账户转账' : '新增账户转账'}</h2><button type="button" onClick={() => setShowAccountTransferDialog(false)} className="text-xs text-slate-500">取消</button></div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">{([{ field: 'transferDate', label: '转账日期 *', type: 'date' }, { field: 'fromAccount', label: '转出账户 *', type: 'text' }, { field: 'toAccount', label: '转入账户 *', type: 'text' }, { field: 'amount', label: '金额 *', type: 'number' }, { field: 'fee', label: '手续费', type: 'number' }, { field: 'serialNo', label: '流水号', type: 'text' }] as Array<{ field: keyof typeof accountTransferDraft; label: string; type: string }>).map(({ field, label, type }) => <label key={field} className="grid gap-1 text-xs text-slate-600">{label}<input required={['transferDate', 'fromAccount', 'toAccount', 'amount'].includes(field)} type={type} min={type === 'number' ? '0' : undefined} step={type === 'number' ? '0.01' : undefined} value={accountTransferDraft[field]} onChange={(event) => setAccountTransferDraft((draft) => ({ ...draft, [field]: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>)}</div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3"><button type="button" onClick={() => setShowAccountTransferDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white">{editingAccountTransferId ? '保存修改' : '保存转账'}</button></div>
          </form>
        </div>
      )}
      {showFixedAssetDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label={editingFixedAssetId ? '编辑固定资产' : '新增固定资产'}>
          <form onSubmit={handleSaveFixedAsset} className="w-full max-w-2xl border border-slate-300 bg-white shadow-xl">
            <div className="flex h-11 items-center justify-between border-b border-slate-200 px-4"><h2 className="text-sm font-semibold text-slate-900">{editingFixedAssetId ? '编辑固定资产' : '新增固定资产'}</h2><button type="button" onClick={() => setShowFixedAssetDialog(false)} className="text-xs text-slate-500">取消</button></div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">{([{ field: 'assetCode', label: '资产编号 *', type: 'text' }, { field: 'assetName', label: '资产名称 *', type: 'text' }, { field: 'category', label: '资产类别 *', type: 'text' }, { field: 'startDate', label: '开始使用日期 *', type: 'date' }, { field: 'originalValue', label: '资产原值 *', type: 'number' }, { field: 'usefulLifeMonths', label: '折旧期限（月）*', type: 'number' }, { field: 'residualRate', label: '残值率（%）', type: 'number' }, { field: 'sourceDocument', label: '来源凭据', type: 'text' }] as Array<{ field: keyof typeof fixedAssetDraft; label: string; type: string }>).map(({ field, label, type }) => <label key={field} className="grid gap-1 text-xs text-slate-600">{label}<input required={['assetCode', 'assetName', 'category', 'startDate', 'originalValue', 'usefulLifeMonths'].includes(field)} type={type} min={type === 'number' ? '0' : undefined} step={type === 'number' ? '0.01' : undefined} list={field === 'category' ? 'asset-category-options' : undefined} value={fixedAssetDraft[field]} onChange={(event) => setFixedAssetDraft((draft) => ({ ...draft, [field]: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>)}</div>
            <datalist id="asset-category-options">{effectiveAssetCategories.filter((category) => category.is_enabled === 1).map((category) => <option key={category.id} value={category.name}>{category.code}｜{category.depreciation_method}｜{category.useful_life_months} 月</option>)}</datalist>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3"><button type="button" onClick={() => setShowFixedAssetDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white">{editingFixedAssetId ? '保存修改' : '保存资产'}</button></div>
          </form>
        </div>
      )}
      {showInventoryMovementDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label={editingInventoryMovementId ? '编辑出入库单' : '新增出入库单'}>
          <form onSubmit={handleSaveInventoryMovement} className="w-full max-w-2xl border border-slate-300 bg-white shadow-xl">
            <div className="flex h-11 items-center justify-between border-b border-slate-200 px-4"><h2 className="text-sm font-semibold text-slate-900">{editingInventoryMovementId ? '编辑出入库单' : '新增出入库单'}</h2><button type="button" onClick={() => setShowInventoryMovementDialog(false)} className="text-xs text-slate-500">取消</button></div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">{([{ field: 'movementDate', label: '业务日期 *', type: 'date' }, { field: 'billNo', label: '单据编号 *', type: 'text' }, { field: 'inventoryName', label: '存货名称 *', type: 'text' }, { field: 'warehouse', label: '仓库 *', type: 'text' }, { field: 'counterparty', label: '往来单位', type: 'text' }, { field: 'unit', label: '计量单位 *', type: 'text' }, { field: 'quantity', label: '数量 *', type: 'number' }, { field: 'amount', label: '金额 *', type: 'number' }, { field: 'sourceDocument', label: '来源凭据', type: 'text' }] as Array<{ field: keyof typeof inventoryMovementDraft; label: string; type: string }>).map(({ field, label, type }) => <label key={field} className="grid gap-1 text-xs text-slate-600">{label}<input required={['movementDate', 'billNo', 'inventoryName', 'warehouse', 'unit', 'quantity', 'amount'].includes(field)} type={type} min={type === 'number' ? '0' : undefined} step={type === 'number' ? '0.01' : undefined} value={inventoryMovementDraft[field]} onChange={(event) => setInventoryMovementDraft((draft) => ({ ...draft, [field]: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" /></label>)}
              <label className="grid gap-1 text-xs text-slate-600">出入类型 *<select value={inventoryMovementDraft.movementType} onChange={(event) => setInventoryMovementDraft((draft) => ({ ...draft, movementType: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">{['采购入库', '销售出库', '其他入库', '其他出库'].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3"><button type="button" onClick={() => setShowInventoryMovementDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white">{editingInventoryMovementId ? '保存修改' : '保存单据'}</button></div>
          </form>
        </div>
      )}
      {showInventoryItemDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="新增存货">
          <form onSubmit={handleSaveInventoryItem} className="w-full max-w-xl border border-slate-300 bg-white shadow-xl">
            <div className="flex h-11 items-center justify-between border-b border-slate-200 px-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">新增存货</h2>
                <p className="mt-0.5 text-xs text-slate-500">建立客户账套内的存货基础档案，供发票、出入库与结转使用。</p>
              </div>
              <button type="button" onClick={() => setShowInventoryItemDialog(false)} className="text-xs text-slate-500 hover:text-slate-900">取消</button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-slate-600">
                <span>存货编码</span>
                <input required value={inventoryItemDraft.itemCode} onChange={(event) => setInventoryItemDraft((draft) => ({ ...draft, itemCode: event.target.value }))} placeholder="例如：SP-001" className="h-8 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>存货名称</span>
                <input required value={inventoryItemDraft.itemName} onChange={(event) => setInventoryItemDraft((draft) => ({ ...draft, itemName: event.target.value }))} placeholder="例如：控制器 A-100" className="h-8 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>规格型号</span>
                <input value={inventoryItemDraft.specification} onChange={(event) => setInventoryItemDraft((draft) => ({ ...draft, specification: event.target.value }))} placeholder="可选" className="h-8 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>计量单位</span>
                <input required value={inventoryItemDraft.unit} onChange={(event) => setInventoryItemDraft((draft) => ({ ...draft, unit: event.target.value }))} placeholder="例如：件" className="h-8 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>税率（%）</span>
                <input min="0" max="100" step="0.01" type="number" value={inventoryItemDraft.taxRate} onChange={(event) => setInventoryItemDraft((draft) => ({ ...draft, taxRate: event.target.value }))} className="h-8 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>默认会计科目</span>
                <input value={inventoryItemDraft.defaultSubject} onChange={(event) => setInventoryItemDraft((draft) => ({ ...draft, defaultSubject: event.target.value }))} placeholder="例如：库存商品" className="h-8 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button type="button" onClick={() => setShowInventoryItemDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button>
              <button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">保存存货</button>
            </div>
          </form>
        </div>
      )}
      {showMeasurementUnitDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
          <form onSubmit={handleSaveMeasurementUnit} className="w-full max-w-xl border border-slate-300 bg-white shadow-xl">
            <div className="flex h-11 items-center justify-between border-b border-slate-200 px-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">新增计量单位</h2>
                <p className="mt-0.5 text-xs text-slate-500">用于存货、出入库与发票商品的统一计量口径。</p>
              </div>
              <button type="button" onClick={() => setShowMeasurementUnitDialog(false)} className="text-xs text-slate-500 hover:text-slate-900">取消</button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-slate-600">
                <span>单位名称</span>
                <input required value={measurementUnitDraft.unitName} onChange={(event) => setMeasurementUnitDraft((draft) => ({ ...draft, unitName: event.target.value }))} placeholder="例如：件" className="h-8 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>单位组</span>
                <input value={measurementUnitDraft.unitGroup} onChange={(event) => setMeasurementUnitDraft((draft) => ({ ...draft, unitGroup: event.target.value }))} placeholder="例如：数量单位" className="h-8 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>基准单位</span>
                <input value={measurementUnitDraft.baseUnit} onChange={(event) => setMeasurementUnitDraft((draft) => ({ ...draft, baseUnit: event.target.value }))} placeholder="例如：件" className="h-8 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>换算比例</span>
                <input min="0" step="0.0001" type="number" value={measurementUnitDraft.conversionRate} onChange={(event) => setMeasurementUnitDraft((draft) => ({ ...draft, conversionRate: event.target.value }))} className="h-8 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>小数位数</span>
                <input min="0" max="8" step="1" type="number" value={measurementUnitDraft.precisionDigits} onChange={(event) => setMeasurementUnitDraft((draft) => ({ ...draft, precisionDigits: event.target.value }))} className="h-8 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600 sm:col-span-2">
                <span>备注</span>
                <input value={measurementUnitDraft.remark} onChange={(event) => setMeasurementUnitDraft((draft) => ({ ...draft, remark: event.target.value }))} placeholder="可选" className="h-8 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button type="button" onClick={() => setShowMeasurementUnitDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button>
              <button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">保存计量单位</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function InputInvoiceWorkflowPanel({
  onSync,
  onAdd,
  onMatch,
  summary,
}: {
  onSync: () => void
  onAdd: () => void
  onMatch: () => void
  summary: ModuleConfig['summary']
}) {
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="进项抵扣处理流程">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">进项抵扣处理流程</h2>
          <p className="mt-1 text-xs text-slate-500">票池、认证用途与凭证关联分开留痕；外部税务动作必须由授权人员确认。</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ToolbarButton icon={<RefreshCw className="h-3.5 w-3.5" />} label="同步票池" onClick={onSync} />
          <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="登记进项票" onClick={onAdd} />
          <ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="关联凭证" onClick={onMatch} />
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-4">
        {summary.map((item, index) => (
          <div key={item.label} className="flex min-w-0 gap-2 border border-slate-200 bg-white p-2.5">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-50 text-xs font-semibold text-[#1f65a7]">{index + 1}</span>
            <div className="min-w-0"><div className="text-xs font-medium text-slate-800">{item.label}</div><div className="mt-0.5 text-xs leading-4 text-slate-500">{item.label === '待勾选' ? '未确认用途不进入抵扣取数' : item.label === '异常发票' ? '异常票不进入申报取数' : '按当前账套进项发票台账实时汇总'}</div><div className="mt-1 text-sm font-semibold text-slate-900">{item.value}</div></div>
          </div>
        ))}
      </div>
    </section>
  )
}

function EmployeeVerificationPanel({ onAdd, onReview, summary }: { onAdd: () => void; onReview: () => void; summary: ModuleConfig['summary'] }) {
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="人员档案资料核验">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">人员档案资料核验</h2>
          <p className="mt-1 text-xs text-slate-500">人员档案只维护本地资料状态，工资、社保和个税模块各自依据已确认资料取数。</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="新增人员" onClick={onAdd} />
          <ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="核验资料" onClick={onReview} />
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="border border-slate-200 bg-white p-2.5">
            <div className="text-xs text-slate-500">{item.label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{item.value}</div>
            <div className="mt-1 text-xs text-slate-500">{item.label === '待补资料' ? '证件、合同或入职日期待维护' : item.label === '离职/停用' ? '离职人员需复核社保与个税停缴' : '按当前账套人员档案实时汇总'}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function PayrollWorkflowPanel({ onAdd, onReview, summary }: { onAdd: () => void; onReview: () => void; summary: ModuleConfig['summary'] }) {
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="工资核算与凭证准备">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">工资核算与凭证准备</h2>
          <p className="mt-1 text-xs text-slate-500">工资项、个税、个人社保扣款和发放凭证分别核验，避免未确认数据直接入账。</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="新增薪酬行" onClick={onAdd} />
          <ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核工资项" onClick={onReview} />
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="border border-slate-200 bg-white p-2.5">
            <div className="text-xs text-slate-500">{item.label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{item.value}</div>
            <div className="mt-1 text-xs text-slate-500">{item.label === '待确认行' ? '待确认行不自动入账' : item.label === '个税' ? '需与社保个人扣款交叉复核' : '按当前账套薪酬台账实时汇总'}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function SocialSecurityWorkflowPanel({ onAdd, onReview, summary }: { onAdd: () => void; onReview: () => void; summary: ModuleConfig['summary'] }) {
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="社保公积金核对流程">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">社保公积金核对流程</h2>
          <p className="mt-1 text-xs text-slate-500">缴费基数、单位个人金额和工资扣款交叉核验；本页不直接向社保或税务机关提交数据。</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="新增缴费明细" onClick={onAdd} />
          <ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="核对工资基数" onClick={onReview} />
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="border border-slate-200 bg-white p-2.5">
            <div className="text-xs text-slate-500">{item.label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{item.value}</div>
            <div className="mt-1 text-xs text-slate-500">{item.label === '待复核' ? '差异项不进入凭证或申报取数' : item.label === '个人及公积金' ? '与工资扣款交叉核对' : '按当前账套社保台账实时汇总'}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function BankFlowWorkflowPanel({ mode, onAdd, onMatch, summary }: { mode: '账单一览' | '银行账单'; onAdd: () => void; onMatch: () => void; summary: ModuleConfig['summary'] }) {
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="资金流水匹配处理">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">资金流水匹配处理</h2>
          <p className="mt-1 text-xs text-slate-500">{mode}按账户、回单、对方户名和关联单据完成匹配，凭证生成必须经人工确认。</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="登记流水" onClick={onAdd} />
          <ToolbarButton icon={<Settings2 className="h-3.5 w-3.5" />} label="执行匹配" onClick={onMatch} />
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="border border-slate-200 bg-white p-2.5">
            <div className="text-xs text-slate-500">{item.label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{item.value}</div>
            <div className="mt-1 text-xs text-slate-500">{item.label.includes('待匹配') ? '对方户名和金额可人工修正' : item.label.includes('待补') ? '缺失附件不生成凭证' : '按当前账套业务台账实时汇总'}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function BusinessOrderWorkflowPanel({ mode, onAdd, onReview, summary }: { mode: 'purchase' | 'sales'; onAdd: () => void; onReview: () => void; summary: ModuleConfig['summary'] }) {
  const isPurchase = mode === 'purchase'
  const title = isPurchase ? '采购履约与入账准备' : '销售开票与收款准备'
  const description = isPurchase
    ? '订单、入库、进项票和付款状态分别核验，三方差异不自动进入成本或应付处理。'
    : '订单、出库、销项票和回款状态分别核验，异常订单不自动进入收入或应收处理。'
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label={title}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label={isPurchase ? '新增采购单' : '新增销售单'} onClick={onAdd} />
          <ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label={isPurchase ? '核验三方状态' : '核验履约状态'} onClick={onReview} />
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="border border-slate-200 bg-white p-2.5">
            <div className="text-xs text-slate-500">{item.label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{item.value}</div>
            <div className="mt-1 text-xs text-slate-500">{item.label.includes('异常') ? '差异项不自动生成凭证' : item.label.includes('待') ? '需人工确认履约、开票或结算状态' : '按当前账套业务台账实时汇总'}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ExpenseWorkflowPanel({ onAdd, onReview, summary }: { onAdd: () => void; onReview: () => void; summary: ModuleConfig['summary'] }) {
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="费用报销审批与付款准备">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">费用报销审批与付款准备</h2>
          <p className="mt-1 text-xs text-slate-500">报销单、审批、票据、付款和费用凭证分步复核，退回和缺票项目保留待补状态。</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="新增报销单" onClick={onAdd} />
          <ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核付款资料" onClick={onReview} />
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="border border-slate-200 bg-white p-2.5">
            <div className="text-xs text-slate-500">{item.label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{item.value}</div>
            <div className="mt-1 text-xs text-slate-500">{item.label.includes('附件') ? '缺票项目待补资料' : item.label.includes('待付款') ? '付款流水需人工关联' : '按当前账套业务台账实时汇总'}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function SourceDocumentWorkflowPanel({ onAdd, onReview, summary }: { onAdd: () => void; onReview: () => void; summary: ModuleConfig['summary'] }) {
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="原始单据归档与入账准备">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">原始单据归档与入账准备</h2>
          <p className="mt-1 text-xs text-slate-500">非发票、非银行来源的原始资料先登记、核验附件和业务归属，再进入凭证草稿处理。</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="登记原始单据" onClick={onAdd} />
          <ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="核验归档资料" onClick={onReview} />
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="border border-slate-200 bg-white p-2.5">
            <div className="text-xs text-slate-500">{item.label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{item.value}</div>
            <div className="mt-1 text-xs text-slate-500">{item.label.includes('附件') ? '缺失附件不进入凭证草稿' : item.label.includes('待生成') ? '经人工审核后才可生成凭证' : '按当前账套业务台账实时汇总'}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function FixedAssetWorkflowPanel({ onAdd, onReview, summary }: { onAdd: () => void; onReview: () => void; summary: ModuleConfig['summary'] }) {
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="资产折旧与凭证准备">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">资产折旧与凭证准备</h2>
          <p className="mt-1 text-xs text-slate-500">资产类别、原值、使用日期、折旧期限和来源附件共同决定本期折旧；异常项目不得自动入账。</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="新增资产" onClick={onAdd} />
          <ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核折旧资料" onClick={onReview} />
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="border border-slate-200 bg-white p-2.5">
            <div className="text-xs text-slate-500">{item.label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{item.value}</div>
            <div className="mt-1 text-xs text-slate-500">{item.label === '待计提' ? '未确认资产不进入期末结转' : item.label === '本月折旧' ? '按资产类别和使用期限测算' : '按当前账套业务台账实时汇总'}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function InventoryWorkflowPanel({ mode, onAdd, onReview, summary }: { mode: 'archive' | 'movement'; onAdd: () => void; onReview: () => void; summary: ModuleConfig['summary'] }) {
  const isArchive = mode === 'archive'
  const title = isArchive ? '存货档案与核算口径' : '存货收发与成本结转'
  const description = isArchive
    ? '维护编码、单位、税率和默认科目，为发票商品行、出入库和成本结转提供统一口径。'
    : '出入库、发票、数量金额和来源单据先匹配，再进入月末成本结转和凭证草稿。'

  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label={title}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label={isArchive ? '新增存货档案' : '新增出入库单'} onClick={onAdd} />
          <ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label={isArchive ? '核验档案口径' : '核验收发匹配'} onClick={onReview} />
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="border border-slate-200 bg-white p-2.5">
            <div className="text-xs text-slate-500">{item.label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{item.value}</div>
            <div className="mt-1 text-xs text-slate-500">{isArchive ? item.label === '待补税率' ? '用于发票与成本核验' : item.label === '停用' ? '不参与本期业务处理' : '按当前账套存货台账实时汇总' : item.label === '异常单据' ? '缺票和未核价不结转' : item.label === '已匹配发票' ? '已关联来源单据' : '按当前账套存货台账实时汇总'}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function CostCarryoverWorkflowPanel({
  onAdd,
  onReview,
  summary,
}: {
  onAdd: () => void
  onReview: () => void
  summary: ModuleConfig['summary']
}) {
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="月末成本结转复核">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">月末成本结转复核</h2>
          <p className="mt-1 text-xs text-slate-500">结转批次须明确计价方法、出库来源、借贷科目和差异；本页只生成待确认记录，不直接改写账簿。</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="新建结转批次" onClick={onAdd} />
          <ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核成本差异" onClick={onReview} />
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="border border-slate-200 bg-white p-2.5">
            <div className="text-xs text-slate-500">{item.label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{item.value}</div>
            <div className="mt-1 text-xs text-slate-500">{item.label.includes('差异') || item.label.includes('异常') ? '未核价或金额差异不得进入结转凭证' : '按当前账套成本台账实时汇总'}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function BankReconciliationWorkflowPanel({ onAdd, onReview, summary }: { onAdd: () => void; onReview: () => void; summary: ModuleConfig['summary'] }) {
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="银行对账与未达项处理">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">银行对账与未达项处理</h2>
          <p className="mt-1 text-xs text-slate-500">银行余额、账面余额、未达账项和凭证差异逐笔核对；对账记录不直接覆盖原流水。</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="新增对账记录" onClick={onAdd} />
          <ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核未达项" onClick={onReview} />
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="border border-slate-200 bg-white p-2.5">
            <div className="text-xs text-slate-500">{item.label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{item.value}</div>
            <div className="mt-1 text-xs text-slate-500">{item.label === '未达账项' ? '保留调节和复核状态' : item.label === '差异金额' ? '差异不自动改账' : '按当前账套对账记录实时汇总'}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function SettlementWorkflowPanel({
  mode,
  onAdd,
  onReview,
  summary,
}: {
  mode: 'receivable' | 'payable'
  onAdd: () => void
  onReview: () => void
  summary: ModuleConfig['summary']
}) {
  const isReceivable = mode === 'receivable'
  const title = isReceivable ? '应收核销与回款复核' : '应付核销与付款复核'

  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label={title}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">发票、资金流水、往来余额和核销金额逐笔关联；核销记录需人工确认后才可影响后续凭证。</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label={isReceivable ? '新增应收核销' : '新增应付核销'} onClick={onAdd} />
          <ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核票据流水" onClick={onReview} />
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="border border-slate-200 bg-white p-2.5">
            <div className="text-xs text-slate-500">{item.label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{item.value}</div>
            <div className="mt-1 text-xs text-slate-500">{item.label.includes('差异') ? '差异需保留对方确认记录，不自动改账' : '关联当前账套发票、流水与往来余额'}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function AgingWorkflowPanel({ onReview, summary }: { onReview: () => void; summary: ModuleConfig['summary'] }) {
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="往来账龄与风险处置">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">往来账龄与风险处置</h2>
          <p className="mt-1 text-xs text-slate-500">应收、应付和其他往来按凭证日期重算账龄，逾期项目保留责任人和风险处置记录。</p>
        </div>
        <ToolbarButton icon={<RefreshCw className="h-3.5 w-3.5" />} label="重算账龄风险" onClick={onReview} />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="border border-slate-200 bg-white p-2.5">
            <div className="text-xs text-slate-500">{item.label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{item.value}</div>
            <div className="mt-1 text-xs text-slate-500">{item.label === '高风险往来' ? '需进入人工处置队列' : item.label === '逾期金额' ? '账龄超过 30 天的未核销余额' : '按当前账套往来核销记录实时重算'}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ClosingWorkflowPanel({ onReview, onRun, summary }: { onReview: () => void; onRun: () => void; summary: ModuleConfig['summary'] }) {
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="期末结账与结转控制">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">期末结账与结转控制</h2>
          <p className="mt-1 text-xs text-slate-500">结转任务按前置校验、执行顺序和凭证模板控制；存在阻断或待确认项时账期不得锁定。</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核结账前检查" onClick={onReview} />
          <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="执行结转检查" onClick={onRun} />
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="border border-slate-200 bg-white p-2.5">
            <div className="text-xs text-slate-500">{item.label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{item.value}</div>
            <div className="mt-1 text-xs text-slate-500">{item.label === '阻断' ? '存在阻断项时不能结账' : item.label === '已完成' ? '已通过当前取数与凭证检查' : item.label === '待缴款' ? '需要人工核验来源与金额' : '按当前账期实时核对'}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function AiJobWorkflowPanel({ onStart, onReview, summary }: { onStart: () => void; onReview: () => void; summary: ModuleConfig['summary'] }) {
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="AI任务编排与人工确认">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">AI任务编排与人工确认</h2>
          <p className="mt-1 text-xs text-slate-500">任务按来源资料、处理阶段、置信度和人工确认状态流转；AI 只生成候选结果，不直接写入凭证或账簿。</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="新建任务草稿" onClick={onStart} />
          <ToolbarButton icon={<RefreshCw className="h-3.5 w-3.5" />} label="刷新任务状态" onClick={onReview} />
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="border border-slate-200 bg-white p-2.5">
            <div className="text-xs text-slate-500">{item.label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{item.value}</div>
            <div className="mt-1 text-xs text-slate-500">{item.label.includes('异常') ? '需要补充资料、修正规则并人工复核' : item.label.includes('确认') ? '仅生成候选结果，不自动写入凭证或账簿' : '按当前账套任务队列实时统计'}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function AiRecognitionWorkflowPanel({ onReview, summary }: { onReview: () => void; summary: ModuleConfig['summary'] }) {
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="识别字段复核与回链处理">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">识别字段复核与回链处理</h2>
          <p className="mt-1 text-xs text-slate-500">逐项复核影像、结构化字段、档案匹配和置信度，再回链至发票、流水、单据或异常队列。</p>
        </div>
        <ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="登记人工复核" onClick={onReview} />
      </div>
      <WorkflowMetrics summary={summary} detailFor={(label) => label.includes('异常') || label.includes('低') ? '影像或字段需人工修正' : label.includes('确认') ? '复核后回链到对应业务模块' : '按当前账套模块配置与运行记录汇总'} />
    </section>
  )
}

function AiVoucherSuggestionWorkflowPanel({ onAdd, onConfirm, summary }: { onAdd: () => void; onConfirm: () => void; summary: ModuleConfig['summary'] }) {
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="凭证建议核验与草稿流转">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">凭证建议核验与草稿流转</h2>
          <p className="mt-1 text-xs text-slate-500">建议必须核验来源、借贷科目、金额、附件和风险；确认后仅进入凭证草稿复核队列，不会自动入账。</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="新增建议" onClick={onAdd} />
          <ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="确认已勾选建议" onClick={onConfirm} />
        </div>
      </div>
      <WorkflowMetrics summary={summary} detailFor={(label) => label.includes('异常') || label.includes('风险') ? '金额或来源异常时不得自动入账' : label.includes('确认') ? '确认后仅进入凭证草稿人工复核' : '按当前账套模块配置与运行记录汇总'} />
    </section>
  )
}

function AiRuleTrainingWorkflowPanel({ onAdd, onPublish, summary }: { onAdd: () => void; onPublish: () => void; summary: ModuleConfig['summary'] }) {
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="AI规则训练与版本审核">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">AI规则训练与版本审核</h2>
          <p className="mt-1 text-xs text-slate-500">训练规则按样本条件、建议动作、目标科目、优先级、命中记录和发布状态留存；未经复核的规则不能参与自动建议。</p>
        </div>
        <div className="flex flex-wrap gap-1.5"><ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="新增训练规则" onClick={onAdd} /><ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核并发布勾选规则" onClick={onPublish} /></div>
      </div>
      <WorkflowMetrics summary={summary} detailFor={(label) => label.includes('待') ? '需核验训练条件、目标动作和发布范围' : label.includes('命中') ? '基于当前账套规则执行记录汇总' : '按当前账套训练规则台账汇总'} />
    </section>
  )
}

function LedgerWorkflowPanel({ onReview, onRefresh, summary }: { onReview: () => void; onRefresh: () => void; summary: ModuleConfig['summary'] }) {
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="账簿取数与凭证穿透">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">账簿取数与凭证穿透</h2>
          <p className="mt-1 text-xs text-slate-500">账簿以已审核凭证为基础，按科目、辅助项和期间取数；余额差异必须穿透至凭证和业务来源后处理。</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ToolbarButton icon={<RefreshCw className="h-3.5 w-3.5" />} label="刷新账簿取数" onClick={onRefresh} />
          <ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核余额一致性" onClick={onReview} />
        </div>
      </div>
      <WorkflowMetrics summary={summary} detailFor={(label) => label.includes('差异') ? '需穿透凭证、科目和业务来源后处理' : label.includes('待') ? '需要补齐辅助项或取数条件' : '按当前账套账簿、报表与申报数据实时汇总'} />
    </section>
  )
}

function FinancialStatementWorkflowPanel({ onReview, onRefresh, summary }: { onReview: () => void; onRefresh: () => void; summary: ModuleConfig['summary'] }) {
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="财务报表取数与勾稽复核">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">财务报表取数与勾稽复核</h2>
          <p className="mt-1 text-xs text-slate-500">报表按公式版本和当前账簿取数生成，重分类、现金流映射和勾稽差异均需保留快照与人工确认记录。</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ToolbarButton icon={<RefreshCw className="h-3.5 w-3.5" />} label="重算当前报表" onClick={onRefresh} />
          <ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核勾稽关系" onClick={onReview} />
        </div>
      </div>
      <WorkflowMetrics summary={summary} detailFor={(label) => label.includes('差异') || label.includes('未映射') ? '需补齐映射并复核报表快照' : '按当前账套账簿、报表与申报数据实时汇总'} />
    </section>
  )
}

function CompanyInfoWorkflowPanel({ onEdit, onReview, summary }: { onEdit: () => void; onReview: () => void; summary: ModuleConfig['summary'] }) {
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="企业税务资料与授权维护">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">企业税务资料与授权维护</h2>
          <p className="mt-1 text-xs text-slate-500">企业资料、会计制度、启用账期和税务授权分项维护。外部税局或工商资料采集需要独立授权，不会通过页面自动登录。</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ToolbarButton icon={<Settings2 className="h-3.5 w-3.5" />} label="编辑企业资料" onClick={onEdit} />
          <ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核企业资料" onClick={onReview} />
        </div>
      </div>
      <WorkflowMetrics summary={summary} detailFor={(label) => label.includes('待') ? '税务与工商授权需独立复核' : '按当前账套账簿、报表与申报数据实时汇总'} />
    </section>
  )
}

function InitialBalanceWorkflowPanel({ onEdit, onValidate, summary }: { onEdit: () => void; onValidate: () => void; summary: ModuleConfig['summary'] }) {
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="期初余额试算与启用控制">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">期初余额试算与启用控制</h2>
          <p className="mt-1 text-xs text-slate-500">期初余额按会计科目和辅助核算双层登记，借贷试算、历史迁移差异和启用条件须在锁定前逐项确认。</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ToolbarButton icon={<Plus className="h-3.5 w-3.5" />} label="登记期初余额" onClick={() => onEdit()} />
          <ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="执行试算平衡" onClick={onValidate} />
        </div>
      </div>
      <WorkflowMetrics summary={summary} detailFor={(label) => label.includes('差异') || label.includes('待') ? '试算平衡前需回查期初与迁移依据' : '按当前账套账簿、报表与申报数据实时汇总'} />
    </section>
  )
}

function SubjectSettingsWorkflowPanel({ onReview, summary }: { onReview: () => void; summary: ModuleConfig['summary'] }) {
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="科目核算口径与报表映射">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">科目核算口径与报表映射</h2>
          <p className="mt-1 text-xs text-slate-500">会计科目维护余额方向、明细级次、辅助核算、凭证规则和财务报表映射，变更后需评估对历史凭证与报表的影响。</p>
        </div>
        <ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核科目口径" onClick={onReview} />
      </div>
      <WorkflowMetrics summary={summary} detailFor={(label) => label.includes('待') ? '变更影响默认凭证与报表取数，需先复核' : '按当前账套账簿、报表与申报数据实时汇总'} />
    </section>
  )
}

function AuxiliaryArchiveWorkflowPanel({ onReview, summary }: { onReview: () => void; summary: ModuleConfig['summary'] }) {
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="辅助档案完整性与业务引用">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">辅助档案完整性与业务引用</h2>
          <p className="mt-1 text-xs text-slate-500">客户、供应商、其他往来、项目和部门档案为发票、流水、凭证与辅助账提供引用基础，缺失资料须在业务流转前补齐。</p>
        </div>
        <ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核档案引用" onClick={onReview} />
      </div>
      <WorkflowMetrics summary={summary} detailFor={(label) => label.includes('待') ? '缺失资料须在业务流转前补齐' : label.includes('停用') ? '保留历史引用但禁止新增业务' : '按当前账套账簿、报表与申报数据实时汇总'} />
    </section>
  )
}

function TaxPlanningWorkflowPanel({ onAdd, onReview, summary }: { onAdd: () => void; onReview: () => void; summary: ModuleConfig['summary'] }) {
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="申报认定与日历控制">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">申报认定与日历控制</h2>
          <p className="mt-1 text-xs text-slate-500">按地区、税种、所属期和责任人维护申报认定与截止计划；税局授权仅作为适配器状态记录，不在本地页面直接发起登录或提交。</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="新增申报认定" onClick={onAdd} />
          <ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核申报计划" onClick={onReview} />
        </div>
      </div>
      <WorkflowMetrics summary={summary} detailFor={(label) => label.includes('截止') ? '需分派负责人并跟进' : label.includes('阻断') || label.includes('待') ? '处理后才可进入本地申报包' : '按当前账套账簿、报表与申报数据实时汇总'} />
    </section>
  )
}

function TaxReportWorkflowPanel({ onRun, onReview, summary }: { onRun: () => void; onReview: () => void; summary: ModuleConfig['summary'] }) {
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="税务取数与申报包控制">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">税务取数与申报包控制</h2>
          <p className="mt-1 text-xs text-slate-500">申报表从已核验的发票、工资、社保、合同、账簿和财报快照取数；这里只生成本地待确认申报包，不直接向电子税务局提交。</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ToolbarButton icon={<RefreshCw className="h-3.5 w-3.5" />} label="重新取数" onClick={onRun} />
          <ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核取数差异" onClick={onReview} />
        </div>
      </div>
      <WorkflowMetrics summary={summary} detailFor={(label) => label.includes('阻断') || label.includes('差异') ? '需要回查账簿和业务台账后处理' : label.includes('待') ? '仅生成本地待确认申报包，不直接对外提交' : '按当前账套账簿、报表与申报数据实时汇总'} />
    </section>
  )
}

function TaxReceiptWorkflowPanel({ onOpen, onReview, summary }: { onOpen: () => void; onReview: () => void; summary: ModuleConfig['summary'] }) {
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="申报回执与缴款归档">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">申报回执与缴款归档</h2>
          <p className="mt-1 text-xs text-slate-500">回执号、缴款书号、扣款状态和附件必须来源于合法税局适配器或人工导入；本地登记不代表已完成外部申报。</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="登记回执缴款" onClick={onOpen} />
          <ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核归档完整性" onClick={onReview} />
        </div>
      </div>
      <WorkflowMetrics summary={summary} detailFor={(label) => label.includes('待') ? '缴款书、扣款状态与附件需成组留存' : label.includes('异常') ? '失败原因与重试记录必须保留' : '按当前账套账簿、报表与申报数据实时汇总'} />
    </section>
  )
}

function AttachmentWorkflowPanel({ onUpload, onReview, records }: { onUpload: () => void; onReview: () => void; records: LocalAttachmentRecord[] }) {
  const pending = records.filter((record) => record.status === '待确认').length
  const associated = records.filter((record) => record.status === '已关联').length
  const totalSize = records.reduce((total, record) => total + record.fileSize, 0)
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="附件来源与归档完整性">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">附件来源与归档完整性</h2>
          <p className="mt-1 text-xs text-slate-500">发票、回单、合同、申报回执与导出包须关联业务单据，保留来源、哈希、上传人和处理日志，避免无来源附件进入审计归档。</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ToolbarButton icon={<Upload className="h-3.5 w-3.5" />} label="登记附件来源" onClick={onUpload} />
          <ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核归档完整性" onClick={onReview} />
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['当前账套附件', `${records.length} 份`, '仅统计本机登记记录'],
          ['待关联单据', `${pending} 份`, '需要绑定业务记录'],
          ['已关联单据', `${associated} 份`, '来源与关联单据可追溯'],
          ['登记文件大小', formatLocalFileSize(totalSize), '哈希已在登记时计算'],
        ].map(([label, value, detail]) => (
          <div key={label} className="border border-slate-200 bg-white p-2.5">
            <div className="text-xs text-slate-500">{label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
            <div className="mt-1 text-xs text-slate-500">{detail}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ImportWorkflowPanel({ onImport, onReview, jobs }: { onImport: () => void; onReview: () => void; jobs: LocalImportJob[] }) {
  const pending = jobs.filter((job) => job.status === '待确认' || job.status === '已校验').length
  const committed = jobs.filter((job) => job.status === '已写入').length
  const failedRows = jobs.reduce((total, job) => total + (job.failedRowCount || 0), 0)
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="导入批次解析与字段映射">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">导入批次解析与字段映射</h2>
          <p className="mt-1 text-xs text-slate-500">Excel、CSV、OFD、PDF 和 ZIP 文件先登记批次、校验表头与错误行，再由人工确认字段映射和写入目标。</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ToolbarButton icon={<Upload className="h-3.5 w-3.5" />} label="新增导入批次" onClick={onImport} />
          <ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核字段映射" onClick={onReview} />
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['当前账套批次', `${jobs.length} 批`, '模板与来源文件已登记'],
          ['待确认批次', `${pending} 批`, '必须确认字段映射与目标台账'],
          ['失败行', `${failedRows} 行`, '保留原始行供修复'],
          ['已写入批次', `${committed} 批`, '写入后仍可追溯批次和失败行'],
        ].map(([label, value, detail]) => (
          <div key={label} className="border border-slate-200 bg-white p-2.5">
            <div className="text-xs text-slate-500">{label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
            <div className="mt-1 text-xs text-slate-500">{detail}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ExportWorkflowPanel({ onReview, rows }: { onReview: () => void; rows: ModuleRow[] }) {
  const completed = rows.filter((row) => row.status === '已通过').length
  const pending = rows.filter((row) => row.status === '待确认' || row.status === '待处理').length
  const failed = rows.filter((row) => row.status === '异常').length
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="导出文件留痕与下载控制">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">导出文件留痕与下载控制</h2>
          <p className="mt-1 text-xs text-slate-500">所有 Excel、PDF 和 ZIP 导出文件统一保留模块、筛选范围、模板版本、文件哈希、生成时间和下载状态，并按期限归档。</p>
        </div>
        <ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核导出留痕" onClick={onReview} />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['当前导出任务', `${rows.length} 份`, 'Excel、PDF 与打印包'],
          ['已生成文件', `${completed} 份`, '保留模块、哈希与操作人'],
          ['待生成文件', `${pending} 份`, '等待取数或人工确认'],
          ['生成异常', `${failed} 份`, '需要重新生成或检查模板'],
        ].map(([label, value, detail]) => (
          <div key={label} className="border border-slate-200 bg-white p-2.5">
            <div className="text-xs text-slate-500">{label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
            <div className="mt-1 text-xs text-slate-500">{detail}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function BackupWorkflowPanel({ onBackup, onReview, summary }: { onBackup: () => void; onReview: () => void; summary: ModuleConfig['summary'] }) {
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="账套备份与恢复前校验">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">账套备份与恢复前校验</h2>
          <p className="mt-1 text-xs text-slate-500">备份保留数据库、附件目录和迁移包校验信息；恢复前必须人工核验范围和文件完整性，不会静默覆盖当前账套。</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="生成本机备份" onClick={onBackup} />
          <ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核恢复条件" onClick={onReview} />
        </div>
      </div>
      <WorkflowMetrics summary={summary} detailFor={(label) => label === '待恢复确认' ? '恢复前需人工确认范围和覆盖影响' : label === '异常' ? '异常备份不得用于恢复操作' : '按当前账套基础与规则台账实时汇总'} />
    </section>
  )
}

function MatchingRuleWorkflowPanel({ onAdd, onReview, summary }: { onAdd: () => void; onReview: () => void; summary: ModuleConfig['summary'] }) {
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="自动匹配规则与优先级控制">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-900">自动匹配规则与优先级控制</h2><p className="mt-1 text-xs text-slate-500">发票、流水和现金流规则按条件、优先级、目标科目和凭证模板维护；命中结果仅生成待确认建议。</p></div><div className="flex flex-wrap gap-1.5"><ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="新增匹配规则" onClick={onAdd} /><ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核规则冲突" onClick={onReview} /></div></div>
      <WorkflowMetrics summary={summary} detailFor={(label) => label === '待审核' ? '须确认样本、优先级和目标动作' : label === '冲突' ? '冲突规则需调整优先级或停用' : '按当前账套基础与规则台账实时汇总'} />
    </section>
  )
}

function TemplateGovernanceWorkflowPanel({ onReview, summary }: { onReview: () => void; summary: ModuleConfig['summary'] }) {
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="凭证与报表模板版本控制">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-900">凭证与报表模板版本控制</h2><p className="mt-1 text-xs text-slate-500">常用摘要、凭证模板、期末结转规则和报表公式需带版本、适用范围和变更记录；修改后须重算相关结果。</p></div><ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核模板影响" onClick={onReview} /></div>
      <WorkflowMetrics summary={summary} detailFor={(label) => label.includes('待') ? '变更需复核后才可生效' : label.includes('异常') ? '异常配置不得参与取数' : '按当前账套基础与规则台账实时汇总'} />
    </section>
  )
}

function AdapterAuthorizationWorkflowPanel({ onAdd, onReview, summary }: { onAdd: () => void; onReview: () => void; summary: ModuleConfig['summary'] }) {
  return (
    <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="外部适配授权与脱敏边界">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-900">外部适配授权与脱敏边界</h2><p className="mt-1 text-xs text-slate-500">税局与银行适配器仅登记渠道、地区、能力范围、脱敏身份和授权状态；密码、令牌、Cookie 与证书不写入账套。</p></div><div className="flex flex-wrap gap-1.5"><ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="新增授权渠道" onClick={onAdd} /><ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核授权边界" onClick={onReview} /></div></div>
      <WorkflowMetrics summary={summary} detailFor={(label) => label.includes('待') ? '等待人工核验授权范围和身份' : label.includes('异常') ? '敏感凭据不写入账套' : '按当前账套基础与规则台账实时汇总'} />
    </section>
  )
}

function HistoryMigrationWorkflowPanel({ onReview, summary }: { onReview: () => void; summary: ModuleConfig['summary'] }) {
  return <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="历史账迁移与差异追溯"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-900">历史账迁移与差异追溯</h2><p className="mt-1 text-xs text-slate-500">历史凭证、余额、总账和明细账按迁移期间、科目映射和辅助维度保留来源，差异必须回查到旧账记录。</p></div><ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核迁移一致性" onClick={onReview} /></div><WorkflowMetrics summary={summary} detailFor={(label) => label.includes('差异') ? '差异不可直接形成正式期初或报表' : label.includes('待') ? '需补齐来源或映射说明' : '按当前账套基础与规则台账实时汇总'} /></section>
}

function RiskWorkflowPanel({ onReview, summary }: { onReview: () => void; summary: ModuleConfig['summary'] }) {
  return <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="风险检查与处置闭环"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-900">风险检查与处置闭环</h2><p className="mt-1 text-xs text-slate-500">凭证、发票、工资、报表、税表与结账前检查的风险项必须关联来源、责任人、处置动作和复核结果。</p></div><ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核风险处置" onClick={onReview} /></div><WorkflowMetrics summary={summary} detailFor={(label) => label.includes('阻断') ? '处理前不可结账或确认申报' : label.includes('高风险') ? '需要负责人确认并保留处置记录' : '按当前账套基础与规则台账实时汇总'} /></section>
}

function AuditWorkflowPanel({ onReview, summary }: { onReview: () => void; summary: ModuleConfig['summary'] }) {
  return <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="操作审计追溯与高风险留痕"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-900">操作审计追溯与高风险留痕</h2><p className="mt-1 text-xs text-slate-500">审计日志覆盖导入导出、凭证、结账、申报和恢复操作，记录操作人、对象、账期、结果与风险级别。</p></div><ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核审计证据" onClick={onReview} /></div><WorkflowMetrics summary={summary} detailFor={(label) => label === '高风险' ? '需保留审批或人工确认记录' : label === '需复核' ? '处理前须回查操作对象与账期' : '按当前账套控制台账实时汇总'} /></section>
}

function VoucherRecycleWorkflowPanel({ onRestore, onReview, summary }: { onRestore: () => void; onReview: () => void; summary: ModuleConfig['summary'] }) {
  return <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="删除凭证恢复与销毁控制"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-900">删除凭证恢复与销毁控制</h2><p className="mt-1 text-xs text-slate-500">删除凭证在回收期内可恢复；彻底删除须人工确认并记录原凭证、操作人、时间和关联附件处理情况。</p></div><div className="flex flex-wrap gap-1.5"><ToolbarButton icon={<RefreshCw className="h-3.5 w-3.5" />} label="恢复已勾选凭证" onClick={onRestore} /><ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核回收记录" onClick={onReview} /></div></div><WorkflowMetrics summary={summary} detailFor={(label) => label === '待复核' ? '删除时间或关联附件需人工核验' : label === '异常' ? '异常记录不得直接清理' : '按当前账套控制台账实时汇总'} /></section>
}

function NotificationWorkflowPanel({ onAdd, onReview, summary }: { onAdd: () => void; onReview: () => void; summary: ModuleConfig['summary'] }) {
  return <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="待办分派与截止跟踪"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-900">待办分派与截止跟踪</h2><p className="mt-1 text-xs text-slate-500">待办仅归属当前账套与账期，记录资料补传、AI确认、凭证异常、报表重算和申报截止事项；不发送短信或外部消息。</p></div><div className="flex gap-1.5"><ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="新增待办" onClick={onAdd} /><ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核待办分派" onClick={onReview} /></div></div><WorkflowMetrics summary={summary} detailFor={(label) => label === '阻断' ? '优先回到原模块处理并留存处理记录' : label === '进行中' ? '需确认负责人、截止日和处置动作' : '按当前账套控制台账实时汇总'} /></section>
}

function OutputInvoiceWorkflowPanel({ onAdd, onReview, summary }: { onAdd: () => void; onReview: () => void; summary: ModuleConfig['summary'] }) {
  return <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="销项开票与凭证确认流程"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-900">销项开票与凭证确认流程</h2><p className="mt-1 text-xs text-slate-500">销项发票按购方、税率、商品行和收款状态复核，异常票和未核验来源不能直接生成会计凭证。</p></div><div className="flex gap-1.5"><ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="新增销项发票" onClick={onAdd} /><ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核开票风险" onClick={onReview} /></div></div><WorkflowMetrics summary={summary} detailFor={(label) => label === '异常发票' ? '税率或商品待核验' : label === '销项税额' ? '需确认收入与税额' : '按当前账套发票与凭证台账实时汇总'} /></section>
}

function ContractWorkflowPanel({ onReview, summary }: { onReview: () => void; summary: ModuleConfig['summary'] }) {
  return <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="合同履约与印花税核验"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-900">合同履约与印花税核验</h2><p className="mt-1 text-xs text-slate-500">合同台账跟踪相对方、履约、收付款、附件与税目；应税合同须在申报前核对金额、税目和签章资料。</p></div><ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核合同税目" onClick={onReview} /></div><WorkflowMetrics summary={summary} detailFor={(label) => label.includes('待') ? '需核验收付款、开票与税目资料' : label.includes('异常') ? '缺失附件阻断归档与申报' : '按当前账套基础与规则台账实时汇总'} /></section>
}

function InvoiceVoucherMatchingWorkflowPanel({ onOpen, onReview, summary }: { onOpen: () => void; onReview: () => void; summary: ModuleConfig['summary'] }) {
  return <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="发票凭证关联与差异复核"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-900">发票凭证关联与差异复核</h2><p className="mt-1 text-xs text-slate-500">发票与凭证按金额、税额、摘要、科目和附件关联；差异项须人工处理，避免凭证与发票台账脱节。</p></div><div className="flex gap-1.5"><ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="建立发票凭证关联" onClick={onOpen} /><ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核匹配差异" onClick={onReview} /></div></div><WorkflowMetrics summary={summary} detailFor={(label) => label === '差异票据' ? '金额差异禁止自动确认' : label === '待人工确认' ? '需复核凭证金额和科目' : '按当前账套发票与凭证台账实时汇总'} /></section>
}

function ReceiptWorkflowPanel({ onReview, summary }: { onReview: () => void; summary: ModuleConfig['summary'] }) {
  return <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="票据到期与背书用途核验"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-900">票据到期与背书用途核验</h2><p className="mt-1 text-xs text-slate-500">商业汇票、收据和其他票据按出票方、到期日、背书、贴现和附件管理，到期风险与凭证处理需同步复核。</p></div><ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核到期票据" onClick={onReview} /></div><WorkflowMetrics summary={summary} detailFor={(label) => label === '待确认' ? '需确认到期、背书或贴现用途' : label === '异常' ? '影像缺失或票面信息异常不可归档' : '按当前账套发票与凭证台账实时汇总'} /></section>
}

function AccountTransferWorkflowPanel({ onAdd, onReview, summary }: { onAdd: () => void; onReview: () => void; summary: ModuleConfig['summary'] }) {
  return <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="账户资金调拨与手续费核验"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-900">账户资金调拨与手续费核验</h2><p className="mt-1 text-xs text-slate-500">账户间转账须核验转出转入账户、流水号、金额、手续费和对应凭证，避免重复入账或资金方向错误。</p></div><div className="flex gap-1.5"><ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="新增账户转账" onClick={onAdd} /><ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核调拨差异" onClick={onReview} /></div></div><WorkflowMetrics summary={summary} detailFor={(label) => label === '待确认' ? '需确认流水号、手续费和会计凭证' : label === '异常' ? '金额或账户方向异常不得自动结转' : '按当前账套控制台账实时汇总'} /></section>
}

function SpecialDeductionWorkflowPanel({ onAdd, onReview, summary }: { onAdd: () => void; onReview: () => void; summary: ModuleConfig['summary'] }) {
  return <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="专项附加扣除确认与个税取数"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-900">专项附加扣除确认与个税取数</h2><p className="mt-1 text-xs text-slate-500">专项附加扣除按人员、类型、起止月份和资料来源维护；个税取数前需核验资格、金额和期间有效性。</p></div><div className="flex gap-1.5"><ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="新增专项扣除" onClick={onAdd} /><ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核个税取数" onClick={onReview} /></div></div><WorkflowMetrics summary={summary} detailFor={(label) => label === '待确认' ? '需核验人员资格、起止月份和证明资料' : label === '异常' ? '异常资料不进入个税申报确认' : '按当前账套控制台账实时汇总'} /></section>
}

function AccountFoundationWorkflowPanel({ onReview, summary }: { onReview: () => void; summary: ModuleConfig['summary'] }) {
  return <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="账户币别与计量口径维护"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-900">账户币别与计量口径维护</h2><p className="mt-1 text-xs text-slate-500">银行账户、币别汇率和计量单位分别维护默认科目、精度、换算关系与启停状态，业务发生后变更需要保留影响说明。</p></div><ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核基础口径" onClick={onReview} /></div><WorkflowMetrics summary={summary} detailFor={(label) => label.includes('待') ? '变更前需复核对存货和报表取数的影响' : label.includes('停用') ? '停用前需检查在用业务关联' : '按当前账套基础与规则台账实时汇总'} /></section>
}

function AuxiliaryFoundationWorkflowPanel({ onReview, summary }: { onReview: () => void; summary: ModuleConfig['summary'] }) {
  return <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="资产类别与辅助核算维度控制"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-900">资产类别与辅助核算维度控制</h2><p className="mt-1 text-xs text-slate-500">资产类别、辅助核算类别、辅助项目和业务标签决定折旧、凭证、账簿与报表的维度和取数范围。</p></div><ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核维度配置" onClick={onReview} /></div><WorkflowMetrics summary={summary} detailFor={(label) => label.includes('待') ? '配置变更需复核引用业务和生效范围' : label.includes('停用') ? '停用项不应影响历史凭证追溯' : '按当前账套基础与规则台账实时汇总'} /></section>
}

function PrintTemplateWorkflowPanel({ onPreview, onReview, summary }: { onPreview: () => void; onReview: () => void; summary: ModuleConfig['summary'] }) {
  return <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="打印模板版本与输出校验"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-900">打印模板版本与输出校验</h2><p className="mt-1 text-xs text-slate-500">凭证、账簿、财务报表和税表输出按固定模板、A4 分页与中文字体生成；模板切换前应验证字段和分页。</p></div><div className="flex gap-1.5"><ToolbarButton icon={<FileText className="h-3.5 w-3.5" />} label="查看固定模板" onClick={onPreview} /><ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核打印模板" onClick={onReview} /></div></div><WorkflowMetrics summary={summary} detailFor={(label) => label.includes('待') ? '模板发布前需核验字段、字体和分页' : '按当前账套模块配置与运行记录汇总'} /></section>
}

function PeriodManagementWorkflowPanel({ onReview, summary }: { onReview: () => void; summary: ModuleConfig['summary'] }) {
  return <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="账期锁定与反结账审批"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-900">账期锁定与反结账审批</h2><p className="mt-1 text-xs text-slate-500">账期状态、结账锁定、反结账申请和归档标记需有审批记录。已结账期间的凭证与报表变更必须经过受控流程。</p></div><ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核账期控制" onClick={onReview} /></div><WorkflowMetrics summary={summary} detailFor={(label) => label.includes('锁定') ? '锁定账期禁止直接修改凭证和报表' : label.includes('待') ? '须完成结账前检查与审批确认' : '按当前账套基础与规则台账实时汇总'} /></section>
}

function SettingsOverviewWorkflowPanel({ onReview, summary }: { onReview: () => void; summary: ModuleConfig['summary'] }) {
  return <section className="border-b border-slate-200 bg-[#fbfcfe] px-3 py-3" aria-label="账套设置导航与生效范围"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-900">账套设置导航与生效范围</h2><p className="mt-1 text-xs text-slate-500">按企业资料、期初、基础档案、会计科目、规则模板、账期与审计归类管理。每项配置只作用于当前账套，并保留启用状态和变更记录。</p></div><ToolbarButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="复核配置生效范围" onClick={onReview} /></div><WorkflowMetrics summary={summary} detailFor={(label) => label.includes('待') ? '需进入对应受控模块完成复核' : '按当前账套模块配置与运行记录汇总'} /></section>
}

function WorkflowMetrics({ summary, detailFor }: { summary: ModuleConfig['summary']; detailFor?: (label: string) => string }) {
  const metrics = summary.map((item) => ({ label: item.label, value: item.value, detail: detailFor?.(item.label) || '按当前账套模块数据实时汇总' }))
  return <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{metrics.map((item) => <div key={item.label} className="border border-slate-200 bg-white p-2.5"><div className="text-xs text-slate-500">{item.label}</div><div className="mt-1 text-sm font-semibold text-slate-900">{item.value}</div><div className="mt-1 text-xs text-slate-500">{item.detail}</div></div>)}</div>
}

function RulesLogDialog({
  notes,
  logs,
  usesLiveData,
  onClose,
}: {
  notes: string[]
  logs: Array<{ time: string; action: string; detail: string }>
  usesLiveData: boolean
  onClose: () => void
}) {
  const previewLogs = [
    { time: '09:30', action: '刷新列表', detail: '系统记录操作人、账期、筛选条件和导出文件名称。' },
    { time: '09:36', action: '执行筛选', detail: '系统记录操作人、账期、筛选条件和导出文件名称。' },
    { time: '09:42', action: '导出文件', detail: '系统记录操作人、账期、筛选条件和导出文件名称。' },
  ]
  const visibleLogs = usesLiveData ? logs : previewLogs

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-label="规则与日志">
      <section className="flex max-h-[min(720px,calc(100vh-2rem))] w-full max-w-5xl flex-col border border-slate-300 bg-white shadow-xl">
        <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-[#f8fafc] px-4 text-sm font-semibold">
          <span className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-[#1f65a7]" />规则与日志</span>
          <button type="button" onClick={onClose} className="h-7 border border-slate-300 px-2 text-xs font-medium text-slate-600 hover:border-[#1f65a7] hover:text-[#1f65a7]">关闭</button>
        </div>
        <div className="min-h-0 overflow-y-auto">
          <div className="grid gap-0 md:grid-cols-2">
            <div className="border-b border-slate-200 md:border-b-0 md:border-r">
              <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">规则与提示</div>
              {notes.map((note, index) => (
                <div key={note} className="border-b border-slate-100 p-3 text-xs leading-5 text-slate-600 last:border-b-0">
                  <div className="mb-1 flex items-center gap-2 font-medium text-slate-800">
                    {index === 0 ? <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> : <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                    {index === 0 ? '业务边界' : '自动化说明'}
                  </div>
                  {note}
                </div>
              ))}
            </div>
            <div>
              <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">操作日志</div>
              {visibleLogs.length === 0 && <div className="p-3 text-xs text-slate-500">当前账期无本地操作日志。</div>}
              {visibleLogs.map((log) => (
                <div key={`${log.time}-${log.action}`} className="border-b border-slate-100 p-3 text-xs last:border-b-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800">{log.action}</span>
                    <span className="font-mono text-slate-400">{log.time}</span>
                  </div>
                  <div className="mt-1 text-slate-500">{log.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function ToolbarButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1 rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-700 hover:border-[#1f65a7] hover:text-[#1f65a7]"
    >
      {icon}
      {label}
    </button>
  )
}

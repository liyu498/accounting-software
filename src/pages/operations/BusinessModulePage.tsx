import { useEffect, useMemo, useRef, useState } from 'react'
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
  Printer,
  RefreshCw,
  Search,
  Settings2,
  Upload,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { exportHtmlToPdf } from '../../lib/pdfExport'
import { exportRowsToXlsx } from '../../lib/xlsxExport'
import { recordAuditLog, recordExportJob, useAuditLogs, useExportJobs, type AuditLog, type ExportJob } from '../../lib/exportJobs'
import { isTauri } from '../../lib/tauri'
import { automationApi, backupApi, employeeApi, payrollApi, socialSecurityApi, specialDeductionApi, type AdapterAuthorization, type AutomationJob, type Employee, type LocalBackupSnapshot, type LocalBackupVerification, type OperationAuditLog, type PayrollRecord, type SocialSecurityRecord, type SpecialDeductionRecord, type TaxDeclarationTask } from '../../lib/api'
import {
  mapLiveBalanceSheetRows,
  mapLiveCashFlowRows,
  mapLiveCompanyInfoRows,
  mapLiveCompanyBankAccountRows,
  mapLiveCommonDigestRows,
  mapLiveCurrencyRows,
  mapLiveGeneralLedgerRows,
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
  mapLiveInvoiceRows,
  mapLiveTrialBalanceRows,
  mapLiveVoucherRows,
  mapLiveVoucherRecycleRows,
  mapLiveDeclarationReceiptRows,
  mapLiveTaxInitRows,
  mapLiveTaxReportRows,
  mapLiveAutomationJobRows,
  mapLiveFinanceTaxReportRows,
  mapLiveFinancialOverviewRows,
  mapLiveVoucherTemplateRows,
  summarizeLiveBalanceSheet,
  summarizeLiveCashFlow,
  summarizeLiveCompanyInfo,
  summarizeLiveCompanyBankAccounts,
  summarizeLiveCommonDigests,
  summarizeLiveCurrencies,
  summarizeLiveGeneralLedger,
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
  summarizeLiveInvoices,
  summarizeLiveTrialBalance,
  summarizeLiveVouchers,
  summarizeLiveVoucherRecycle,
  summarizeLiveDeclarationReceipts,
  summarizeLiveTaxInit,
  summarizeLiveTaxReports,
  summarizeLiveAutomationJobs,
  summarizeLiveFinanceTaxReports,
  summarizeLiveFinancialOverview,
  summarizeLiveVoucherTemplates,
} from '../../lib/liveModuleRows'
import { useCompanyStore } from '../../stores/companyStore'
import { useAccountStore } from '../../stores/accountStore'
import { useAuxiliaryStore, type AuxiliaryBalanceRow, type AuxiliaryLedgerRow } from '../../stores/auxiliaryStore'
import { useInvoiceStore } from '../../stores/invoiceStore'
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
import { useTemplateStore } from '../../stores/templateStore'
import { useReportTemplateStore } from '../../stores/reportTemplateStore'

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
  | 'customerContractLedger'
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
  status: '待处理' | '已匹配' | '已生成凭证' | '待确认' | '异常' | '启用' | '停用' | '已通过'
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

type LiveReportData = {
  trialBalance: TrialBalanceResult | null
  generalLedger: GeneralLedgerItem[] | null
  balanceSheet: BalanceSheetResult | null
  incomeStatement: IncomeStatementResult | null
  cashFlow: CashFlowResult | null
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
  balanceSheet: null,
  incomeStatement: null,
  cashFlow: null,
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
    statusOptions: ['全部', '待处理', '待确认', '已生成凭证', '异常'],
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
    statusOptions: ['全部', '启用', '停用', '待确认', '异常'],
    summary: [
      { label: '训练规则', value: '28 条', tone: 'blue' },
      { label: '已启用', value: '19 条', tone: 'green' },
      { label: '待确认', value: '7 条', tone: 'amber' },
      { label: '冲突', value: '2 条', tone: 'red' },
    ],
    columns: [
      { key: 'name', label: '规则名称' },
      { key: 'source', label: '训练来源' },
      { key: 'sample', label: '样本数', align: 'right' },
      { key: 'hitRate', label: '命中率', align: 'right' },
      { key: 'target', label: '目标动作' },
      { key: 'owner', label: '审核人' },
      { key: 'version', label: '版本' },
      { key: 'effect', label: '生效范围' },
    ],
    rows: [
      { id: 'ait-001', status: '启用', voucher: '-', attachment: '样本', values: { name: '技术服务收入识别', source: '销项发票+历史凭证', sample: '126', hitRate: '94%', target: '生成收入凭证', owner: '王会计', version: 'v1.3', effect: '当前账套' } },
      { id: 'ait-002', status: '待确认', voucher: '-', attachment: '样本', values: { name: '银行手续费分类', source: '银行流水', sample: '88', hitRate: '91%', target: '生成费用凭证', owner: '李会计', version: 'v1.0', effect: '当前账套' } },
      { id: 'ait-003', status: '异常', voucher: '-', attachment: '冲突', values: { name: '办公采购费用', source: '进项发票+单据', sample: '42', hitRate: '68%', target: '费用科目建议', owner: '待复核', version: 'v0.8', effect: '禁用' } },
    ],
    notes: ['规则训练只产出建议和候选规则，必须人工审核后才能启用。', '规则版本、样本来源和命中率后续要进入审计日志。'],
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
  customerContractLedger: {
    keywordPlaceholder: '搜索客户、合同编号、服务套餐、收费状态、协同事项',
    primaryAction: '新增客户合同',
    importLabel: '导入客户合同',
    statusOptions: ['全部', '启用', '停用', '待确认', '异常'],
    summary: [
      { label: '服务客户', value: '126 户', tone: 'blue' },
      { label: '有效合同', value: '118 份', tone: 'green' },
      { label: '待续费', value: '9 份', tone: 'amber' },
      { label: '异常授权', value: '3 户', tone: 'red' },
    ],
    columns: [
      { key: 'customerCode', label: '客户编码' },
      { key: 'customerName', label: '客户名称' },
      { key: 'contractNo', label: '合同编号' },
      { key: 'servicePackage', label: '服务套餐' },
      { key: 'period', label: '服务期限' },
      { key: 'fee', label: '服务费', align: 'right' },
      { key: 'billingStatus', label: '收费状态' },
      { key: 'collaboration', label: '协同/授权' },
    ],
    rows: [
      { id: 'ccl-001', status: '启用', voucher: '收款计划', attachment: '合同PDF', values: { customerCode: '01460', customerName: '科旋电气（上海）有限公司', contractNo: 'DL-2026-01460', servicePackage: '代理记账+申报', period: '2026-01 至 2026-12', fee: '¥18,000.00', billingStatus: '已收 6 期', collaboration: '税务授权有效' } },
      { id: 'ccl-002', status: '待确认', voucher: '待开票', attachment: '续费单', values: { customerCode: '02018', customerName: '上海云启科技有限公司', contractNo: 'DL-2026-02018', servicePackage: '记账+工资社保', period: '2026-05 至 2027-04', fee: '¥24,000.00', billingStatus: '待续费', collaboration: '资料待补' } },
      { id: 'ccl-003', status: '异常', voucher: '-', attachment: '授权截图', values: { customerCode: '03009', customerName: '杭州辰光贸易有限公司', contractNo: 'DL-2026-03009', servicePackage: '小规模基础包', period: '2025-07 至 2026-06', fee: '¥9,600.00', billingStatus: '欠费 1 期', collaboration: '税务授权失效' } },
    ],
    notes: ['客户与合同承载机构级客户服务关系，收费、授权、协同事项放在同一条合同链路里。', '服务套餐、客户协同和收费状态不再作为首页重复入口，统一从客户合同穿透。'],
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
    primaryAction: '计提折旧',
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
    primaryAction: '执行结转',
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
    keywordPlaceholder: '搜索编码、名称、助记码、税号',
    primaryAction: '新增资料',
    importLabel: '批量导入',
    statusOptions: ['全部', '启用', '停用'],
    summary: [
      { label: '资料数量', value: '86 条', tone: 'blue' },
      { label: '启用', value: '79 条', tone: 'green' },
      { label: '待补字段', value: '6 条', tone: 'amber' },
      { label: '停用', value: '7 条', tone: 'gray' },
    ],
    columns: [
      { key: 'code', label: '编码' },
      { key: 'name', label: '名称' },
      { key: 'shortName', label: '简称' },
      { key: 'mnemonic', label: '助记码' },
      { key: 'taxNo', label: '税号/证件号' },
      { key: 'account', label: '默认科目/账号' },
    ],
    rows: [
      { id: 'set-001', status: '启用', voucher: '-', attachment: '-', values: { code: 'C001', name: '上海辰光贸易有限公司', shortName: '辰光贸易', mnemonic: 'CGMY', taxNo: '9131**********001X', account: '应收账款' } },
      { id: 'set-002', status: '启用', voucher: '-', attachment: '-', values: { code: 'S006', name: '苏州材料供应链有限公司', shortName: '苏州材料', mnemonic: 'SZCL', taxNo: '9132**********888K', account: '应付账款' } },
      { id: 'set-003', status: '异常', voucher: '-', attachment: '-', values: { code: 'P003', name: '研发项目A', shortName: '项目A', mnemonic: 'YFXMA', taxNo: '-', account: '研发支出' } },
    ],
    notes: ['客户、供应商、其他往来、项目、部门、标签、资产类别可复用这套资料表格。'],
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
    primaryAction: '新增公式',
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
    primaryAction: '新增模板',
    importLabel: '导入模板',
    statusOptions: ['全部', '启用', '停用', '待确认', '异常'],
    summary: [
      { label: '打印模板', value: '18 套', tone: 'blue' },
      { label: '已启用', value: '14 套', tone: 'green' },
      { label: '待复核', value: '3 套', tone: 'amber' },
      { label: '异常', value: '1 套', tone: 'red' },
    ],
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
    rows: [
      { id: 'pt-001', status: '启用', voucher: '-', attachment: '预览PDF', values: { name: '记账凭证A4', module: '会计凭证', paper: 'A4', orientation: '纵向', version: 'v1.2', default: '是', updatedBy: '王会计', updatedAt: '06-26 22:10' } },
      { id: 'pt-002', status: '待确认', voucher: '-', attachment: '预览PDF', values: { name: '资产负债表A4', module: '财务报表', paper: 'A4', orientation: '横向', version: 'v1.0', default: '否', updatedBy: '李会计', updatedAt: '06-26 22:14' } },
      { id: 'pt-003', status: '异常', voucher: '-', attachment: '渲染日志', values: { name: '申报包留档模板', module: '税务申报', paper: 'A4', orientation: '纵向', version: 'v0.9', default: '否', updatedBy: '赵会计', updatedAt: '待修复' } },
    ],
    notes: ['打印模板配置用于统一凭证纸、A4、A5、B5 和申报包版式，后续细化模板时不再散落到各页面。', '正式版本需要记录模板版本、默认状态、预览文件和渲染验证日志。'],
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
    body{font-family:"Noto Sans SC","PingFang SC","Microsoft YaHei",-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:24px;color:#111827}
    h1{text-align:center;font-size:18px;margin:0 0 10px}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:6px 14px;font-size:12px;color:#334155;margin-bottom:14px}
    .meta span{border-bottom:1px solid #cbd5e1;padding-bottom:4px}
    table{width:100%;border-collapse:collapse;font-size:12px} th,td{border:1px solid #94a3b8;padding:6px 8px;white-space:nowrap}
    th{background:#e8eef6;text-align:left}.note{margin-top:12px;font-size:11px;color:#64748b}
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
    body{font-family:"Noto Sans SC","PingFang SC","Microsoft YaHei",-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:18px;color:#111827}
    .voucher{break-inside:avoid;margin:0 0 18px;border:1.5px solid #111827;padding:12px}
    .voucher-head{display:flex;align-items:center;justify-content:center;position:relative;font-size:20px;font-weight:700;letter-spacing:0}
    .voucher-head .no{position:absolute;right:0;font-size:13px;font-weight:500}
    .meta,.sign{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0;font-size:12px;color:#334155}
    table{width:100%;border-collapse:collapse;font-size:12px} th,td{border:1px solid #111827;padding:9px 8px} th{background:#f1f5f9}.amount{text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
  </style></head><body>${items}</body></html>`
}

function renderLedgerPrintHtml(title: string, headers: string[], rows: ReturnType<typeof printableRows>, exportedAt: string, context: ExportDocumentContext) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    body{font-family:"Noto Sans SC","PingFang SC","Microsoft YaHei",-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:20px;color:#111827}
    h1{text-align:center;font-size:18px;margin:0 0 8px}.sub{display:flex;justify-content:space-between;font-size:12px;margin-bottom:10px;color:#334155}
    table{width:100%;border-collapse:collapse;font-size:11px} th,td{border:1px solid #64748b;padding:6px 7px;white-space:nowrap} th{background:#e8eef6}.amount{text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
    tfoot td{background:#f8fafc;font-weight:700}
  </style></head><body><h1>${escapeHtml(title)}</h1><div class="sub"><span>单位: ${escapeHtml(context.companyName)}</span><span>期间: ${escapeHtml(context.periodLabel)}</span><span>打印: ${escapeHtml(exportedAt)}</span></div>
  <table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows.map(({ cells }) => `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
  <tfoot><tr><td colspan="${headers.length}">本页小计: 当前筛选 ${rows.length} 行，借贷平衡状态以系统试算结果为准。</td></tr></tfoot></table></body></html>`
}

function renderFinancialPrintHtml(title: string, rows: ReturnType<typeof printableRows>, exportedAt: string, context: ExportDocumentContext) {
  const bodyRows = rows.map(({ row }) => `<tr><td>${escapeHtml(row.values.line || '')}</td><td>${escapeHtml(row.values.item || '')}</td><td>${escapeHtml(row.values.opening || '')}</td><td>${escapeHtml(row.values.ending || '')}</td><td>${escapeHtml(row.values.note || row.status)}</td></tr>`).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    body{font-family:"Noto Sans SC","PingFang SC","Microsoft YaHei",-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:22px;color:#111827}
    h1{text-align:center;font-size:19px;margin:0 0 8px}.meta{display:flex;justify-content:space-between;font-size:12px;margin-bottom:10px;color:#334155}
    table{width:100%;border-collapse:collapse;font-size:12px} th,td{border:1px solid #475569;padding:7px 8px} th{background:#e8eef6}.num{text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
    .foot{display:flex;justify-content:space-between;margin-top:14px;font-size:12px}
  </style></head><body><h1>${escapeHtml(title)}</h1><div class="meta"><span>编制单位: ${escapeHtml(context.companyName)}</span><span>所属期: ${escapeHtml(context.periodLabel)}</span><span>单位: 元</span></div>
  <table><thead><tr><th>行次</th><th>项目</th><th>期初余额/本月数</th><th>期末余额/本年累计</th><th>说明</th></tr></thead><tbody>${bodyRows}</tbody></table>
  <div class="foot"><span>制表: 系统</span><span>复核: 未签章</span><span>打印时间: ${escapeHtml(exportedAt)}</span></div></body></html>`
}

function renderTaxPrintHtml(title: string, rows: ReturnType<typeof printableRows>, exportedAt: string, context: ExportDocumentContext) {
  const bodyRows = rows.map(({ row }) => `<tr><td>${escapeHtml(row.values.taxType || '')}</td><td>${escapeHtml(row.values.form || row.values.period || '')}</td><td>${escapeHtml(row.values.source || row.values.method || '')}</td><td class="num">${escapeHtml(row.values.amount || '')}</td><td class="num">${escapeHtml(row.values.tax || '')}</td><td>${escapeHtml(row.values.check || row.status)}</td></tr>`).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    body{font-family:"Noto Sans SC","PingFang SC","Microsoft YaHei",-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:22px;color:#111827}
    h1{text-align:center;font-size:18px;margin:0 0 8px}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:12px;margin-bottom:12px;color:#334155}
    table{width:100%;border-collapse:collapse;font-size:12px} th,td{border:1px solid #475569;padding:7px 8px} th{background:#e8eef6}.num{text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
    .notice{margin-top:12px;border:1px solid #cbd5e1;background:#f8fafc;padding:8px;font-size:11px;color:#475569}
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
function mapLiveSocialSecurityRows(socialSecurityRecords: SocialSecurityRecord[]): ModuleRow[] { return socialSecurityRecords.map((record) => ({ id: record.id, status: '待确认', voucher: '未生成', attachment: '本地社保明细', values: { name: record.employeeName, city: record.city || '待补', base: payrollCurrency(record.contributionBase), company: payrollCurrency(record.companyAmount), personal: payrollCurrency(record.personalAmount), fund: payrollCurrency(record.fundAmount) } })) }
function mapLiveSpecialDeductionRows(specialDeductionRecords: SpecialDeductionRecord[]): ModuleRow[] { return specialDeductionRecords.map((record) => ({ id: record.id, status: record.status === '有效' ? '启用' : record.status === '异常' ? '异常' : '待确认', voucher: '-', attachment: '本地扣除资料', values: { name: record.employeeName, type: record.deductionType, start: record.startMonth, end: record.endMonth || '长期有效', amount: payrollCurrency(record.monthlyAmount), source: record.source } })) }

function summarizeLiveSpecialDeductions(specialDeductionRecords: SpecialDeductionRecord[]): ModuleConfig['summary'] {
  const total = specialDeductionRecords.reduce((sum, record) => sum + record.monthlyAmount, 0)
  const pending = specialDeductionRecords.filter((record) => record.status !== '有效').length
  return [
    { label: '专项扣除', value: `${specialDeductionRecords.length} 条`, tone: 'blue' },
    { label: '月扣除额', value: payrollCurrency(total), tone: 'green' },
    { label: '待确认', value: `${pending} 条`, tone: pending > 0 ? 'amber' : 'gray' },
    { label: '异常', value: '0 条', tone: 'gray' },
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
  const baseConfig = moduleConfigs[kind]
  const exportJobs = useExportJobs()
  const auditLogs = useAuditLogs()
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId)
  const selectedCompany = useCompanyStore((state) => state.companies.find((company) => company.id === state.selectedCompanyId))
  const currentPeriodId = usePeriodStore((state) => state.currentPeriodId)
  const periods = usePeriodStore((state) => state.periods)
  const currentPeriod = useMemo(() => periods.find((period) => period.id === currentPeriodId), [currentPeriodId, periods])
  const currentPeriodLabel = currentPeriod
    ? `${currentPeriod.period_year}-${String(currentPeriod.period_month).padStart(2, '0')}`
    : '当前账期'
  const fetchPeriods = usePeriodStore((state) => state.fetchPeriods)
  const closePeriod = usePeriodStore((state) => state.closePeriod)
  const fetchTrialBalance = usePeriodStore((state) => state.fetchTrialBalance)
  const getGeneralLedger = usePeriodStore((state) => state.getGeneralLedger)
  const getSubsidiaryLedger = usePeriodStore((state) => state.getSubsidiaryLedger)
  const getBalanceSheet = usePeriodStore((state) => state.getBalanceSheet)
  const getIncomeStatement = usePeriodStore((state) => state.getIncomeStatement)
  const getCashFlowStatement = usePeriodStore((state) => state.getCashFlowStatement)
  const validateInitialBalances = usePeriodStore((state) => state.validateInitialBalances)
  const accounts = useAccountStore((state) => state.accounts)
  const fetchAccounts = useAccountStore((state) => state.fetchAccounts)
  const auxiliaryCategories = useAuxiliaryStore((state) => state.categories)
  const auxiliaryItems = useAuxiliaryStore((state) => state.items)
  const fetchCategories = useAuxiliaryStore((state) => state.fetchCategories)
  const fetchAllItems = useAuxiliaryStore((state) => state.fetchAllItems)
  const fetchAuxiliaryLedger = useAuxiliaryStore((state) => state.fetchAuxiliaryLedger)
  const fetchAuxiliaryBalance = useAuxiliaryStore((state) => state.fetchAuxiliaryBalance)
  const invoices = useInvoiceStore((state) => state.invoices)
  const fetchInvoices = useInvoiceStore((state) => state.fetchInvoices)
  const vouchers = useVoucherStore((state) => state.vouchers)
  const queryVouchers = useVoucherStore((state) => state.queryVouchers)
  const getDeletedVouchers = useVoucherStore((state) => state.getDeletedVouchers)
  const settlementRules = useSettlementRuleStore((state) => state.rules)
  const fetchSettlementRules = useSettlementRuleStore((state) => state.fetchSettlementRules)
  const currencies = useCurrencyStore((state) => state.currencies)
  const fetchCurrencies = useCurrencyStore((state) => state.fetchCurrencies)
  const commonDigests = useTemplateStore((state) => state.commonDigests)
  const voucherTemplateTypes = useTemplateStore((state) => state.voucherTemplateTypes)
  const voucherTemplates = useTemplateStore((state) => state.voucherTemplates)
  const fetchTemplateWorkspace = useTemplateStore((state) => state.fetchTemplateWorkspace)
  const reportTemplates = useReportTemplateStore((state) => state.reportTemplates)
  const reportItems = useReportTemplateStore((state) => state.reportItems)
  const fetchReportTemplateWorkspace = useReportTemplateStore((state) => state.fetchReportTemplateWorkspace)
  const usesLiveModuleData = isTauri && selectedCompanyId && ['outputInvoice', 'inputInvoice', 'voucher', 'riskCheck'].includes(kind)
  const usesLiveReportData = Boolean(
    isTauri &&
      selectedCompanyId &&
      currentPeriodId &&
      ['ledgerReport', 'accountSummaryReport', 'trialBalanceReport', 'generalLedgerReport', 'balanceSheetReport', 'incomeStatementReport', 'cashFlowReport'].includes(kind),
  )
  const usesLiveInitialBalanceData = Boolean(isTauri && selectedCompanyId && currentPeriodId && kind === 'initialBalance')
  const usesLiveCompanyBankAccountData = Boolean(isTauri && selectedCompanyId && kind === 'accountArchive')
  const usesLivePeriodManagementData = Boolean(isTauri && selectedCompanyId && kind === 'periodManagement')
  const usesLiveSettlementRuleData = Boolean(isTauri && selectedCompanyId && kind === 'settlementRules')
  const usesLiveCurrencyData = Boolean(isTauri && selectedCompanyId && kind === 'currencySettings')
  const usesLiveTemplateSettingsData = Boolean(isTauri && selectedCompanyId && ['commonDigests', 'voucherTemplateSettings'].includes(kind))
  const usesLiveReportFormulaData = Boolean(isTauri && selectedCompanyId && kind === 'reportFormulaSettings')
  const usesLiveAdapterAuthorizationData = Boolean(isTauri && selectedCompanyId && ['taxAdapterSettings', 'bankAdapterSettings', 'taxInit'].includes(kind))
  const usesLiveOperationAuditData = Boolean(isTauri && selectedCompanyId && kind === 'auditLog')
  const usesLiveExportData = Boolean(isTauri && selectedCompanyId && kind === 'exportCenter')
  const usesLiveImportData = Boolean(isTauri && selectedCompanyId && kind === 'importCenter')
  const usesLiveEmployeeData = Boolean(isTauri && selectedCompanyId && kind === 'employee')
  const usesLivePayrollData = Boolean(isTauri && selectedCompanyId && kind === 'payroll')
  const usesLiveSocialSecurityData = Boolean(isTauri && selectedCompanyId && kind === 'socialSecurity')
  const usesLiveSpecialDeductionData = Boolean(isTauri && selectedCompanyId && kind === 'specialDeduction')
  const usesLiveWithholdingTaxData = Boolean(isTauri && selectedCompanyId && kind === 'withholdingTaxReport')
  const usesLiveSocialSecurityTaxData = Boolean(isTauri && selectedCompanyId && kind === 'socialSecurityTaxReport')
  const usesLiveBackupData = Boolean(isTauri && selectedCompanyId && kind === 'backupRestore')
  const usesLiveRuleLogData = Boolean(isTauri && selectedCompanyId)
  const usesLiveVoucherRecycleData = Boolean(isTauri && selectedCompanyId && kind === 'voucherRecycle')
  const usesLiveDeclarationReceiptData = Boolean(isTauri && selectedCompanyId && kind === 'declarationReceipt')
  const usesLiveTaxInitData = Boolean(isTauri && selectedCompanyId && kind === 'taxInit')
  const usesLiveTaxReportData = Boolean(isTauri && selectedCompanyId && kind === 'taxReport')
  const usesLiveFinanceTaxReportData = Boolean(isTauri && selectedCompanyId && kind === 'financeTaxReport')
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
  const [employees, setEmployees] = useState<Employee[]>([])
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([])
  const [socialSecurityRecords, setSocialSecurityRecords] = useState<SocialSecurityRecord[]>([])
  const [specialDeductionRecords, setSpecialDeductionRecords] = useState<SpecialDeductionRecord[]>([])
  const [showSocialSecurityDialog, setShowSocialSecurityDialog] = useState(false)
  const [socialSecurityDraft, setSocialSecurityDraft] = useState({ employeeId: '', city: '', base: '', company: '', personal: '', fund: '' })
  const [showSpecialDeductionDialog, setShowSpecialDeductionDialog] = useState(false)
  const [specialDeductionDraft, setSpecialDeductionDraft] = useState({ employeeId: '', deductionType: '子女教育', startMonth: '', endMonth: '', monthlyAmount: '', source: '手工' })
  const [showPayrollDialog, setShowPayrollDialog] = useState(false)
  const [payrollDraft, setPayrollDraft] = useState({ employeeId: '', baseSalary: '', bonus: '', taxAmount: '', socialPersonal: '' })
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false)
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null)
  const [employeeDraft, setEmployeeDraft] = useState({ employeeCode: '', name: '', idNo: '', department: '', position: '', mobile: '', entryDate: '', employmentStatus: '在职' })
  const [deletedVouchers, setDeletedVouchers] = useState<Voucher[]>([])
  const [taxDeclarationTasks, setTaxDeclarationTasks] = useState<TaxDeclarationTask[]>([])
  const [automationJobs, setAutomationJobs] = useState<AutomationJob[]>([])
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
    if (!usesLiveInvoiceVoucherMatchingData || !selectedCompanyId) return
    void fetchInvoices({ company_id: selectedCompanyId, period_id: currentPeriodId || undefined })
    void queryVouchers({ company_id: selectedCompanyId, period_id: currentPeriodId || undefined, page: 1, page_size: 100 })
  }, [currentPeriodId, fetchInvoices, queryVouchers, selectedCompanyId, usesLiveInvoiceVoucherMatchingData])

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

        if (kind === 'generalLedgerReport' || kind === 'accountSummaryReport') {
          const generalLedger = await getGeneralLedger(currentPeriodId)
          if (active) setLiveReports((reports) => kind === 'accountSummaryReport' ? { ...reports, accountSummary: generalLedger } : { ...reports, generalLedger })
          return
        }

        if (kind === 'balanceSheetReport') {
          const balanceSheet = await getBalanceSheet(currentPeriodId)
          if (active) setLiveReports((reports) => ({ ...reports, balanceSheet }))
          return
        }

        if (kind === 'incomeStatementReport') {
          const incomeStatement = await getIncomeStatement(currentPeriodId)
          if (active) setLiveReports((reports) => ({ ...reports, incomeStatement }))
          return
        }

        if (kind === 'cashFlowReport') {
          const cashFlow = await getCashFlowStatement(currentPeriodId)
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
    currentPeriodId,
    fetchTrialBalance,
    getBalanceSheet,
    getCashFlowStatement,
    getGeneralLedger,
    getIncomeStatement,
    kind,
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
    if (!(usesLiveDeclarationReceiptData || usesLiveTaxInitData || usesLiveTaxReportData || usesLiveFinanceTaxReportData) || !selectedCompanyId) return
    let active = true
    void automationApi.getTaxDeclarationTasks({ companyId: selectedCompanyId })
      .then((result) => {
        if (active) setTaxDeclarationTasks(result.success ? result.data || [] : [])
      })
    return () => {
      active = false
    }
  }, [selectedCompanyId, usesLiveDeclarationReceiptData, usesLiveTaxInitData, usesLiveTaxReportData, usesLiveFinanceTaxReportData])

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
        rows: mapLiveInvoiceRows(invoices, 'output'),
        summary: summarizeLiveInvoices(invoices, 'output'),
      }
    }

    if (kind === 'inputInvoice' && usesLiveModuleData) {
      return {
        ...baseConfig,
        rows: mapLiveInvoiceRows(invoices, 'input'),
        summary: summarizeLiveInvoices(invoices, 'input'),
      }
    }

    if (kind === 'voucher' && usesLiveModuleData) {
      return {
        ...baseConfig,
        rows: mapLiveVoucherRows(vouchers),
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

    if (kind === 'employee' && usesLiveEmployeeData) {
      return {
        ...baseConfig,
        rows: mapLiveEmployeeRows(employees),
        summary: summarizeLiveEmployees(employees),
      }
    }

    if (kind === 'payroll' && usesLivePayrollData) {
      return { ...baseConfig, rows: mapLivePayrollRows(payrollRecords), summary: summarizeLivePayroll(payrollRecords) }
    }
    if (kind === 'socialSecurity' && usesLiveSocialSecurityData) return { ...baseConfig, rows: mapLiveSocialSecurityRows(socialSecurityRecords), summary: baseConfig.summary.map((item) => item.label === '参保人数' ? { ...item, value: `${socialSecurityRecords.length} 人` } : item) }
    if (kind === 'specialDeduction' && usesLiveSpecialDeductionData) return { ...baseConfig, rows: mapLiveSpecialDeductionRows(specialDeductionRecords), summary: summarizeLiveSpecialDeductions(specialDeductionRecords) }
    if (kind === 'withholdingTaxReport' && usesLiveWithholdingTaxData) return { ...baseConfig, rows: mapLiveWithholdingTaxRows(payrollRecords, employees, socialSecurityRecords, specialDeductionRecords), summary: summarizeLiveWithholdingTax(payrollRecords, employees, socialSecurityRecords, specialDeductionRecords) }
    if (kind === 'socialSecurityTaxReport' && usesLiveSocialSecurityTaxData) return { ...baseConfig, rows: mapLiveSocialSecurityTaxRows(socialSecurityRecords), summary: summarizeLiveSocialSecurityTax(socialSecurityRecords) }

    if (kind === 'declarationReceipt' && usesLiveDeclarationReceiptData) {
      return {
        ...baseConfig,
        rows: mapLiveDeclarationReceiptRows(taxDeclarationTasks),
        summary: summarizeLiveDeclarationReceipts(taxDeclarationTasks),
      }
    }

    if (kind === 'taxInit' && usesLiveTaxInitData) {
      return {
        ...baseConfig,
        rows: mapLiveTaxInitRows(taxDeclarationTasks, adapterAuthorizations),
        summary: summarizeLiveTaxInit(taxDeclarationTasks, adapterAuthorizations),
      }
    }

    if (kind === 'taxReport' && usesLiveTaxReportData) {
      return {
        ...baseConfig,
        rows: mapLiveTaxReportRows(taxDeclarationTasks),
        summary: summarizeLiveTaxReports(taxDeclarationTasks),
      }
    }

    if (kind === 'financeTaxReport' && usesLiveFinanceTaxReportData) {
      return {
        ...baseConfig,
        rows: mapLiveFinanceTaxReportRows(taxDeclarationTasks),
        summary: summarizeLiveFinanceTaxReports(taxDeclarationTasks),
      }
    }

    if (kind === 'financialReport' && usesLiveFinancialOverviewData && liveReports.balanceSheet && liveReports.incomeStatement && liveReports.cashFlow) {
      return {
        ...baseConfig,
        rows: mapLiveFinancialOverviewRows(liveReports.balanceSheet, liveReports.incomeStatement, liveReports.cashFlow),
        summary: summarizeLiveFinancialOverview(liveReports.balanceSheet, liveReports.incomeStatement, liveReports.cashFlow),
      }
    }

    if (kind === 'aiJobQueue' && usesLiveAutomationJobData) {
      return {
        ...baseConfig,
        rows: mapLiveAutomationJobRows(automationJobs, 'queue'),
        summary: summarizeLiveAutomationJobs(automationJobs, 'queue'),
      }
    }

    if (kind === 'aiRecognitionResults' && usesLiveAutomationJobData) {
      return {
        ...baseConfig,
        rows: mapLiveAutomationJobRows(automationJobs, 'recognition'),
        summary: summarizeLiveAutomationJobs(automationJobs, 'recognition'),
      }
    }

    if (kind === 'aiVoucherSuggestions' && usesLiveAutomationJobData) {
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

    if (kind === 'incomeStatementReport' && usesLiveReportData && liveReports.incomeStatement) {
      return {
        ...baseConfig,
        rows: mapLiveIncomeStatementRows(liveReports.incomeStatement),
        summary: summarizeLiveIncomeStatement(liveReports.incomeStatement),
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

    if (kind === 'accountArchive' && usesLiveCompanyBankAccountData) {
      return {
        ...baseConfig,
        rows: mapLiveCompanyBankAccountRows(selectedCompany),
        summary: summarizeLiveCompanyBankAccounts(selectedCompany),
      }
    }

    if (kind === 'initialBalance' && usesLiveInitialBalanceData && liveReports.initialBalance) {
      return {
        ...baseConfig,
        rows: mapLiveInitialBalanceRows(liveReports.initialBalance),
        summary: summarizeLiveInitialBalance(liveReports.initialBalance),
      }
    }

    if (kind === 'periodManagement' && usesLivePeriodManagementData) {
      return {
        ...baseConfig,
        rows: mapLivePeriodManagementRows(periods),
        summary: summarizeLivePeriodManagement(periods),
      }
    }

    if (kind === 'settlementRules' && usesLiveSettlementRuleData) {
      return {
        ...baseConfig,
        rows: mapLiveSettlementRuleRows(settlementRules),
        summary: summarizeLiveSettlementRules(settlementRules),
      }
    }

    if (kind === 'currencySettings' && usesLiveCurrencyData) {
      return {
        ...baseConfig,
        rows: mapLiveCurrencyRows(currencies),
        summary: summarizeLiveCurrencies(currencies),
      }
    }

    if (kind === 'commonDigests' && usesLiveTemplateSettingsData) {
      return {
        ...baseConfig,
        rows: mapLiveCommonDigestRows(commonDigests),
        summary: summarizeLiveCommonDigests(commonDigests),
      }
    }

    if (kind === 'voucherTemplateSettings' && usesLiveTemplateSettingsData) {
      return {
        ...baseConfig,
        rows: mapLiveVoucherTemplateRows(voucherTemplates, voucherTemplateTypes),
        summary: summarizeLiveVoucherTemplates(voucherTemplates, voucherTemplateTypes),
      }
    }

    if (kind === 'reportFormulaSettings' && usesLiveReportFormulaData) {
      return {
        ...baseConfig,
        rows: mapLiveReportFormulaRows(reportTemplates, reportItems),
        summary: summarizeLiveReportFormulas(reportTemplates, reportItems),
      }
    }

    if (kind === 'taxAdapterSettings' && usesLiveAdapterAuthorizationData) {
      return {
        ...baseConfig,
        rows: mapLiveAdapterAuthorizationRows(adapterAuthorizations, 'tax'),
        summary: summarizeLiveAdapterAuthorizations(adapterAuthorizations, 'tax'),
      }
    }

    if (kind === 'bankAdapterSettings' && usesLiveAdapterAuthorizationData) {
      return {
        ...baseConfig,
        rows: mapLiveAdapterAuthorizationRows(adapterAuthorizations, 'bank'),
        summary: summarizeLiveAdapterAuthorizations(adapterAuthorizations, 'bank'),
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

    if (kind === 'auxiliaryCategories' && usesLiveArchiveData) {
      return {
        ...baseConfig,
        rows: mapLiveAuxiliaryCategoryRows(auxiliaryCategories),
        summary: summarizeLiveAuxiliaryCategories(auxiliaryCategories),
      }
    }

    if (kind === 'auxiliaryItems' && usesLiveArchiveData) {
      return {
        ...baseConfig,
        rows: mapLiveAuxiliaryItemRows(auxiliaryCategories, auxiliaryItems),
        summary: summarizeLiveAuxiliaryItems(auxiliaryItems),
      }
    }

    if (usesLiveArchiveData && isLiveAuxiliaryArchiveKind(kind)) {
      return {
        ...baseConfig,
        rows: mapLiveAuxiliaryArchiveRows(kind, auxiliaryCategories, auxiliaryItems),
        summary: summarizeLiveAuxiliaryArchive(kind, auxiliaryCategories, auxiliaryItems),
      }
    }

    if (kind === 'importCenter' && usesLiveImportData) {
      const dynamicRows = mapOperationAuditImportRows(operationAuditLogs)
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
  }, [accounts, adapterAuthorizations, auditLogs, automationJobs, auxiliaryCategories, auxiliaryItems, backupValidations, baseConfig, commonDigests, currencies, currentPeriod, deletedVouchers, employees, exportJobs, invoices, kind, liveReports, localBackups, operationAuditLogs, payrollRecords, periods, reportItems, reportTemplates, selectedAuxiliaryCategory, selectedAuxiliaryItem, selectedCompany, selectedCompanyId, selectedHistoryLedgerAccount, selectedHistoryLedgerAccountCode, selectedHistoryPeriodId, selectedHistoryPeriodLabel, settlementRules, socialSecurityRecords, taxDeclarationTasks, usesLiveAdapterAuthorizationData, usesLiveArchiveData, usesLiveAutomationJobData, usesLiveBackupData, usesLiveClosingTaskData, usesLiveCompanyBankAccountData, usesLiveCurrencyData, usesLiveDeclarationReceiptData, usesLiveEmployeeData, usesLiveExportData, usesLiveFinanceTaxReportData, usesLiveFinancialOverviewData, usesLiveHistoryReportData, usesLiveImportData, usesLiveInitialBalanceData, usesLiveInvoiceVoucherMatchingData, usesLiveLedgerDetailData, usesLiveModuleData, usesLiveOperationAuditData, usesLivePayrollData, usesLivePeriodManagementData, usesLiveReportData, usesLiveReportFormulaData, usesLiveSettlementRuleData, usesLiveSocialSecurityData, usesLiveTaxInitData, usesLiveTaxReportData, usesLiveTemplateSettingsData, usesLiveVoucherRecycleData, voucherTemplates, voucherTemplateTypes, vouchers])
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('全部')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [showRulesLog, setShowRulesLog] = useState(false)
  const importFileRef = useRef<HTMLInputElement>(null)
  const [operationNotice, setOperationNotice] = useState<string | null>(null)

  const filteredRows = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    return config.rows.filter((row) => {
      const matchesStatus = status === '全部' || row.status === status || (status === '未匹配' && row.status === '待处理')
      if (!matchesStatus) return false
      if (!normalized) return true
      return Object.values(row.values).some((value) => value.toLowerCase().includes(normalized)) || row.id.toLowerCase().includes(normalized)
    })
  }, [config.rows, keyword, status])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const pageStart = filteredRows.length === 0 ? 0 : (page - 1) * pageSize + 1
  const pageEnd = Math.min(page * pageSize, filteredRows.length)
  const pagedRows = useMemo(() => filteredRows.slice((page - 1) * pageSize, page * pageSize), [filteredRows, page, pageSize])

  useEffect(() => {
    setPage(1)
  }, [kind, keyword, status, pageSize])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const auditScope = `${status}/${keyword.trim() || '全部'}`
  const supportsFileImport = /导入|采集|上传/.test(config.importLabel)
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

  const handleImportAction = () => {
    if (supportsFileImport) {
      importFileRef.current?.click()
      return
    }
    writeModuleAudit(config.importLabel, `${title}-导入批次`, '中', '待审批')
    setOperationNotice(`${config.importLabel} 已进入待确认留痕；后续接入文件选择、字段映射、错误清单和回滚记录。`)
  }

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    writeModuleAudit(config.importLabel, `${title}-${file.name}`, '中', '待审批')
    setOperationNotice(`${file.name} 已进入待确认导入批次；需完成字段映射、错误校验和人工确认后才会写入账套。`)
    event.target.value = ''
  }

  const handleRefreshAction = () => {
    writeModuleAudit('刷新列表', `${title}-${auditScope}`)
    setOperationNotice('已刷新当前列表并记录筛选条件。')
  }

  const handleTemplateAction = () => {
    writeModuleAudit('下载模板', `${title}-导入模板`)
    setOperationNotice('模板下载已记录；正式模板会继续绑定固定 Excel/PDF 版本和字段校验规则。')
  }

  const handlePrimaryAction = async () => {
    if (kind === 'employee' && isTauri && selectedCompanyId) {
      setEditingEmployeeId(null)
      setShowEmployeeDialog(true)
      return
    }
    if (kind === 'payroll' && isTauri && selectedCompanyId) {
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

    if (kind === 'closingTasks' && isTauri && currentPeriodId) {
      if (!currentPeriod) {
        writeModuleAudit(config.primaryAction, `${title}-${auditScope}`, '高', '失败')
        setOperationNotice('未找到当前账期，无法执行结账。')
        return
      }
      if (currentPeriod.status === 'closed') {
        setOperationNotice(`账期 ${currentPeriodLabel} 已结账并锁定。`)
        return
      }
      const blockers = config.rows.filter((row) => row.status === '异常')
      const pending = config.rows.filter((row) => row.status === '待处理' || row.status === '待确认')
      if (blockers.length > 0 || pending.length > 0) {
        writeModuleAudit(config.primaryAction, `${title}-${auditScope}`, '高', '待审批')
        setOperationNotice(`结账前检查未完成：${blockers.length} 项阻断、${pending.length} 项待确认。`)
        return
      }
      if (!window.confirm(`确认结账账期 ${currentPeriodLabel} 吗？结账后账期将锁定。`)) return

      try {
        await closePeriod(currentPeriodId, 'admin')
        writeModuleAudit(config.primaryAction, `${title}-${currentPeriodLabel}`, '高', '成功')
        setOperationNotice(`账期 ${currentPeriodLabel} 已结账并锁定。`)
      } catch (error) {
        writeModuleAudit(config.primaryAction, `${title}-${currentPeriodLabel}`, '高', '失败')
        setOperationNotice(`账期结账失败：${String(error)}`)
      }
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
        : `${config.primaryAction} 已记录到审计日志；后续会接入对应表单、规则校验和附件快照。`
    )
  }

  const handleCreateEmployee = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
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

  const handleCreatePayrollRecord = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedCompanyId || currentPeriodLabel === '当前账期') return
    try {
      const result = await payrollApi.createPayrollRecord({
        companyId: selectedCompanyId,
        employeeId: payrollDraft.employeeId,
        period: currentPeriodLabel,
        baseSalary: Number(payrollDraft.baseSalary || 0),
        bonus: Number(payrollDraft.bonus || 0),
        taxAmount: Number(payrollDraft.taxAmount || 0),
        socialPersonal: Number(payrollDraft.socialPersonal || 0),
      })
      if (!result.success || !result.data) throw new Error(result.error || '未返回薪酬行')
      setPayrollRecords((records) => [result.data!, ...records])
      writeModuleAudit('新增薪酬行', `${result.data.employeeName}｜${currentPeriodLabel}`, '中', '成功')
      setOperationNotice(`已新增 ${result.data.employeeName} 的薪酬行，实发 ${payrollCurrency(result.data.netSalary)}。`)
      setPayrollDraft({ employeeId: '', baseSalary: '', bonus: '', taxAmount: '', socialPersonal: '' })
      setShowPayrollDialog(false)
    } catch (error) {
      setOperationNotice(`新增薪酬行失败：${String(error)}`)
    }
  }

  const handleCreateSocialSecurityRecord = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedCompanyId || currentPeriodLabel === '当前账期') return
    try {
      const result = await socialSecurityApi.createSocialSecurityRecord({
        companyId: selectedCompanyId, employeeId: socialSecurityDraft.employeeId, period: currentPeriodLabel,
        city: socialSecurityDraft.city, contributionBase: Number(socialSecurityDraft.base || 0),
        companyAmount: Number(socialSecurityDraft.company || 0), personalAmount: Number(socialSecurityDraft.personal || 0), fundAmount: Number(socialSecurityDraft.fund || 0),
      })
      if (!result.success || !result.data) throw new Error(result.error || '未返回社保明细')
      setSocialSecurityRecords((records) => [result.data!, ...records])
      writeModuleAudit('新增社保明细', `${result.data.employeeName}｜${currentPeriodLabel}`, '中', '成功')
      setOperationNotice(`已新增 ${result.data.employeeName} 的社保公积金明细，等待确认。`)
      setSocialSecurityDraft({ employeeId: '', city: '', base: '', company: '', personal: '', fund: '' })
      setShowSocialSecurityDialog(false)
    } catch (error) { setOperationNotice(`新增社保明细失败：${String(error)}`) }
  }

  const handleCreateSpecialDeductionRecord = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedCompanyId) return
    try {
      const result = await specialDeductionApi.createSpecialDeductionRecord({
        companyId: selectedCompanyId,
        employeeId: specialDeductionDraft.employeeId,
        deductionType: specialDeductionDraft.deductionType,
        startMonth: specialDeductionDraft.startMonth,
        endMonth: specialDeductionDraft.endMonth || undefined,
        monthlyAmount: Number(specialDeductionDraft.monthlyAmount || 0),
        source: specialDeductionDraft.source,
      })
      if (!result.success || !result.data) throw new Error(result.error || '未返回扣除明细')
      setSpecialDeductionRecords((records) => [result.data!, ...records])
      writeModuleAudit('新增专项附加扣除', `${result.data.employeeName}｜${result.data.deductionType}`, '中', '成功')
      setOperationNotice(`已新增 ${result.data.employeeName} 的${result.data.deductionType}扣除资料，等待确认。`)
      setSpecialDeductionDraft({ employeeId: '', deductionType: '子女教育', startMonth: '', endMonth: '', monthlyAmount: '', source: '手工' })
      setShowSpecialDeductionDialog(false)
    } catch (error) {
      setOperationNotice(`新增专项附加扣除失败：${String(error)}`)
    }
  }

  const rowObjectLabel = (row: ModuleRow) => {
    const firstValue = Object.values(row.values).find(Boolean)
    return row.voucher && row.voucher !== '-' ? row.voucher : firstValue || row.id
  }

  const handleViewRow = async (row: ModuleRow) => {
    if (kind === 'employee' && isTauri) {
      const employee = employees.find((item) => item.id === row.id)
      if (!employee) return
      setEditingEmployeeId(employee.id)
      setEmployeeDraft({ employeeCode: employee.employeeCode, name: employee.name, idNo: employee.idNo || '', department: employee.department || '', position: employee.position || '', mobile: employee.mobile || '', entryDate: employee.entryDate || '', employmentStatus: employee.employmentStatus })
      setShowEmployeeDialog(true)
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
    setOperationNotice(`已打开 ${object} 的明细留痕；后续将接入附件、来源单据和操作快照。`)
  }

  const handleGenerateVoucher = (row: ModuleRow) => {
    const object = rowObjectLabel(row)
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
  }

  const handlePrint = () => {
    const exportedAt = new Date().toLocaleString('zh-CN')
    const fileName = `${title}-${exportPeriodLabel}-print`
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
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
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
  }

  const tabs = ['列表', '明细', '凭证草稿', '匹配规则', '附件', '操作日志']

  return (
    <div className="h-full min-w-0 bg-[#f3f6fa] text-slate-900">
      <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv,.pdf,.ofd,.zip" onChange={handleImportFile} className="hidden" aria-label={`${config.importLabel}文件`} />
      <div className="border border-slate-200 bg-white">
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-1.5">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="text-base font-semibold">{title}</h1>
            <span className="max-w-[720px] truncate text-xs text-slate-500">{description}</span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1">
            <ToolbarButton icon={<Upload className="h-3.5 w-3.5" />} label={config.importLabel} onClick={handleImportAction} />
            {kind === 'payroll' && isTauri && <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="新增薪酬" onClick={() => setShowPayrollDialog(true)} />}
            {kind === 'socialSecurity' && isTauri && <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="新增社保" onClick={() => setShowSocialSecurityDialog(true)} />}
            {kind === 'specialDeduction' && isTauri && <ToolbarButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="新增扣除" onClick={() => setShowSpecialDeductionDialog(true)} />}
            <ToolbarButton icon={<RefreshCw className="h-3.5 w-3.5" />} label="刷新" onClick={handleRefreshAction} />
            <ToolbarButton icon={<Download className="h-3.5 w-3.5" />} label="模板" onClick={handleTemplateAction} />
            <ToolbarButton icon={<FileDown className="h-3.5 w-3.5" />} label="导出Excel" onClick={handleExportExcel} />
            <ToolbarButton icon={<FileText className="h-3.5 w-3.5" />} label="导出PDF" onClick={handleExportPdf} />
            <ToolbarButton icon={<Printer className="h-3.5 w-3.5" />} label="打印" onClick={handlePrint} />
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
          {tabs.map((tab, index) => (
            <button
              key={tab}
              className={cn(
                'h-9 border-b-2 px-3 text-xs font-medium',
                index === 0 ? 'border-[#1f65a7] bg-white text-[#1f65a7]' : 'border-transparent text-slate-600 hover:bg-white hover:text-slate-900'
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
            <button className="inline-flex h-8 items-center gap-1 rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-700 hover:border-[#1f65a7] hover:text-[#1f65a7]">
              <Filter className="h-3.5 w-3.5" />
              高级筛选
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <ToolbarButton icon={<Settings2 className="h-3.5 w-3.5" />} label="规则与日志" onClick={() => setShowRulesLog((value) => !value)} />
            <ToolbarButton icon={<Columns3 className="h-3.5 w-3.5" />} label="列设置" />
          </div>
        </div>
      </div>

      {showRulesLog && <RulesLogPanel notes={config.notes} logs={visibleRuleLogs} usesLiveData={usesLiveRuleLogData} />}

      <div className="min-w-0 pt-3">
        <section className="min-w-0 border border-slate-200 bg-white">
          <div className="flex h-9 items-center justify-between border-b border-slate-200 bg-[#f8fafc] px-3">
            <div className="text-sm font-semibold text-slate-900">{title}列表</div>
            <div className="text-xs text-slate-500">显示 {pageStart}-{pageEnd} / {filteredRows.length} 条，支持导出和打印</div>
          </div>
          <div className="max-w-full overflow-x-auto">
            <table className="min-w-[1120px] w-full border-collapse text-left text-xs">
              <thead className="bg-[#eef3f8] text-slate-600">
                <tr>
                  <th className="w-9 border-b border-slate-200 px-2 py-2">
                    <input type="checkbox" aria-label="全选" />
                  </th>
                  {config.columns.map((column) => (
                    <th key={column.key} className={cn('whitespace-nowrap border-b border-slate-200 px-2 py-2', column.align === 'right' && 'text-right', column.align === 'center' && 'text-center')}>
                      {column.label}
                    </th>
                  ))}
                  <th className="whitespace-nowrap border-b border-slate-200 px-2 py-2">状态</th>
                  <th className="whitespace-nowrap border-b border-slate-200 px-2 py-2">凭证</th>
                  <th className="whitespace-nowrap border-b border-slate-200 px-2 py-2">附件</th>
                  <th className="whitespace-nowrap border-b border-slate-200 px-2 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row) => (
                  <tr key={row.id} className="hover:bg-[#f8fbff]">
                    <td className="border-b border-slate-100 px-2 py-2">
                      <input type="checkbox" aria-label={`选择 ${row.id}`} />
                    </td>
                    {config.columns.map((column) => (
                      <td key={column.key} className={cn('whitespace-nowrap border-b border-slate-100 px-2 py-2 text-slate-700', column.align === 'right' && 'text-right font-mono tabular-nums', column.align === 'center' && 'text-center')}>
                        {row.values[column.key]}
                      </td>
                    ))}
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2">{statusBadge(row.status)}</td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 text-slate-600">{row.voucher}</td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <Paperclip className="h-3.5 w-3.5" />
                        {row.attachment}
                      </span>
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 text-right">
                      <button type="button" onClick={() => handleViewRow(row)} className="mr-2 text-[#1f65a7] hover:underline">
                        {kind === 'backupRestore' ? '核验' : kind === 'employee' ? '编辑' : '查看'}
                      </button>
                      <button type="button" onClick={() => handleGenerateVoucher(row)} className="text-[#1f65a7] hover:underline">
                        生成凭证
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-[#f8fafc]">
                <tr>
                  <td className="px-2 py-2" />
                  <td className="px-2 py-2 font-semibold" colSpan={Math.max(config.columns.length - 1, 1)}>合计/小计</td>
                  <td className="px-2 py-2 text-right text-xs text-slate-500" colSpan={4}>当前页 {pagedRows.length} 条，筛选结果 {filteredRows.length} 条</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
            <div>导出文件按当前筛选、列顺序和金额格式生成；PDF 打印使用同一表格模板。</div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="新增薪酬行">
          <form onSubmit={handleCreatePayrollRecord} className="w-full max-w-lg border border-slate-300 bg-white shadow-xl">
            <div className="flex h-11 items-center justify-between border-b border-slate-200 px-4">
              <h2 className="text-sm font-semibold text-slate-900">新增薪酬行</h2>
              <button type="button" onClick={() => setShowPayrollDialog(false)} className="text-xs text-slate-500 hover:text-slate-900">取消</button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">人员 *
                <select required value={payrollDraft.employeeId} onChange={(event) => setPayrollDraft((draft) => ({ ...draft, employeeId: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7]">
                  <option value="">选择在职人员</option>
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
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3"><button type="button" onClick={() => setShowPayrollDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">保存薪酬行</button></div>
          </form>
        </div>
      )}
      {showSocialSecurityDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="新增社保明细">
          <form onSubmit={handleCreateSocialSecurityRecord} className="w-full max-w-lg border border-slate-300 bg-white shadow-xl"><div className="flex h-11 items-center justify-between border-b border-slate-200 px-4"><h2 className="text-sm font-semibold">新增社保明细</h2><button type="button" onClick={() => setShowSocialSecurityDialog(false)} className="text-xs text-slate-500">取消</button></div><div className="grid gap-3 p-4 sm:grid-cols-2"><label className="grid gap-1 text-xs sm:col-span-2">人员 *<select required value={socialSecurityDraft.employeeId} onChange={(event) => setSocialSecurityDraft((draft) => ({ ...draft, employeeId: event.target.value }))} className="h-8 border border-slate-300 px-2"><option value="">选择在职人员</option>{employees.filter((employee) => employee.employmentStatus === '在职').map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeCode} {employee.name}</option>)}</select></label>{([{ field: 'city', label: '缴费城市', type: 'text' }, { field: 'base', label: '缴费基数', type: 'number' }, { field: 'company', label: '单位部分', type: 'number' }, { field: 'personal', label: '个人部分', type: 'number' }, { field: 'fund', label: '公积金', type: 'number' }] as Array<{ field: keyof typeof socialSecurityDraft; label: string; type: string }>).map(({ field, label, type }) => <label key={field} className="grid gap-1 text-xs">{label}<input type={type} min={type === 'number' ? '0' : undefined} step={type === 'number' ? '0.01' : undefined} value={socialSecurityDraft[field]} onChange={(event) => setSocialSecurityDraft((draft) => ({ ...draft, [field]: event.target.value }))} className="h-8 border border-slate-300 px-2" /></label>)}</div><div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3"><button type="button" onClick={() => setShowSocialSecurityDialog(false)} className="h-8 border border-slate-300 px-3 text-xs">取消</button><button type="submit" className="h-8 bg-[#1f65a7] px-3 text-xs text-white">保存明细</button></div></form>
        </div>
      )}
      {showSpecialDeductionDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="新增专项附加扣除">
          <form onSubmit={handleCreateSpecialDeductionRecord} className="w-full max-w-lg border border-slate-300 bg-white shadow-xl">
            <div className="flex h-11 items-center justify-between border-b border-slate-200 px-4"><h2 className="text-sm font-semibold text-slate-900">新增专项附加扣除</h2><button type="button" onClick={() => setShowSpecialDeductionDialog(false)} className="text-xs text-slate-500">取消</button></div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">人员 *
                <select required value={specialDeductionDraft.employeeId} onChange={(event) => setSpecialDeductionDraft((draft) => ({ ...draft, employeeId: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  <option value="">选择在职人员</option>{employees.filter((employee) => employee.employmentStatus === '在职').map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeCode} {employee.name}</option>)}
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
    </div>
  )
}

function RulesLogPanel({
  notes,
  logs,
  usesLiveData,
}: {
  notes: string[]
  logs: Array<{ time: string; action: string; detail: string }>
  usesLiveData: boolean
}) {
  const previewLogs = [
    { time: '09:30', action: '刷新列表', detail: '系统记录操作人、账期、筛选条件和导出文件名称。' },
    { time: '09:36', action: '执行筛选', detail: '系统记录操作人、账期、筛选条件和导出文件名称。' },
    { time: '09:42', action: '导出文件', detail: '系统记录操作人、账期、筛选条件和导出文件名称。' },
  ]
  const visibleLogs = usesLiveData ? logs : previewLogs

  return (
    <section className="mt-3 border border-slate-200 bg-white">
      <div className="flex h-9 items-center gap-2 border-b border-slate-200 bg-[#f8fafc] px-3 text-sm font-semibold">
        <Settings2 className="h-4 w-4 text-[#1f65a7]" />
        规则与日志
      </div>
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
    </section>
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

import {
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Play,
  Printer,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  Upload,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { isTauri } from '../../lib/tauri'
import { exportHtmlToPdf } from '../../lib/pdfExport'
import { recordAuditLog, recordExportJob } from '../../lib/exportJobs'
import { exportRowsToXlsx } from '../../lib/xlsxExport'
import { automationApi, type OperationAuditLog, type TaxDeclarationTask } from '../../lib/api'
import { useCompanyStore } from '../../stores/companyStore'
import { usePeriodStore } from '../../stores/periodStore'

const declarationRows = [
  {
    id: 'VAT-202605',
    category: '增值税及附加',
    form: '增值税及附加税费申报表',
    period: '2026-05',
    collectStatus: '已取数',
    checkStatus: '待确认',
    declareStatus: '未申报',
    source: '销项发票 58 张 / 进项发票 72 张 / 凭证 82 张',
    sales: '680,000.00',
    deduction: '42,860.00',
    payable: '54,210.00',
    risk: '2 张进项未勾选',
    owner: '王会计',
    updated: '06-22 09:32',
  },
  {
    id: 'IIT-202605',
    category: '扣缴所得税',
    form: '个人所得税扣缴申报表',
    period: '2026-05',
    collectStatus: '已取数',
    checkStatus: '待确认',
    declareStatus: '未申报',
    source: '薪酬表 42 人 / 专项附加扣除 26 条',
    sales: '386,200.00',
    deduction: '52,000.00',
    payable: '18,420.00',
    risk: '1 人扣除资料不完整',
    owner: '李会计',
    updated: '06-22 09:35',
  },
  {
    id: 'CIT-Q2',
    category: '企业所得税',
    form: '企业所得税月季度预缴纳税申报表',
    period: '2026-Q2',
    collectStatus: '已取数',
    checkStatus: '校验通过',
    declareStatus: '待申报',
    source: '利润表 / 纳税调整 / 历史亏损',
    sales: '126,000.00',
    deduction: '0.00',
    payable: '6,300.00',
    risk: '无',
    owner: '赵会计',
    updated: '06-22 09:38',
  },
  {
    id: 'STAMP-202605',
    category: '印花税',
    form: '财产和行为税纳税申报表',
    period: '2026-05',
    collectStatus: '待补资料',
    checkStatus: '需复核',
    declareStatus: '未申报',
    source: '合同台账 / 单据登记',
    sales: '980,000.00',
    deduction: '0.00',
    payable: '490.00',
    risk: '合同金额与单据金额不一致',
    owner: '王会计',
    updated: '06-22 09:41',
  },
  {
    id: 'SSF-202605',
    category: '社保费',
    form: '社会保险费申报表',
    period: '2026-05',
    collectStatus: '已取数',
    checkStatus: '校验通过',
    declareStatus: '待申报',
    source: '人员登记 42 人 / 社保公积金明细',
    sales: '103,870.00',
    deduction: '0.00',
    payable: '103,870.00',
    risk: '无',
    owner: '李会计',
    updated: '06-22 09:43',
  },
]

type DeclarationRow = (typeof declarationRows)[number]
type RiskRow = [level: string, module: string, description: string, link: string]
type RuleLog = [time: string, action: string, detail: string]
type DeclarationDraft = {
  id: string
  category: string
  form: string
  period: string
  source: string
  taxableAmount: string
  deductionAmount: string
  payableAmount: string
  collectStatus: string
  validationStatus: string
  riskCount: string
}

type TaxInitializationImportCandidate = {
  rowNumber: number
  taxType: string
  formName: string
  period: string
  collectStatus: string
  validationStatus: string
  taxableAmount: number
  deductionAmount: number
  payableAmount: number
  riskCount: number
  sourceSnapshot: string
  adapterCode: string
}

const riskRows: RiskRow[] = [
  ['阻断', '增值税及附加', '进项发票未完成勾选，抵扣税额不能进入申报主表', '发票勾选'],
  ['提示', '扣缴所得税', '员工王五专项附加扣除缺少结束月份', '专项附加扣除'],
  ['复核', '印花税', '合同台账金额与单据登记金额差异 20,000.00', '单据登记'],
]

const logs: RuleLog[] = [
  ['09:30', '重新取数', '系统从发票、凭证、工资和账簿生成本期申报快照'],
  ['09:32', '风险校验', '发现 1 条阻断、2 条需复核事项'],
  ['09:38', '人工确认', '企业所得税和社保费标记为待申报'],
  ['09:43', '导出申报包', '生成 Excel、PDF、取数说明和操作日志'],
]

const tabs = ['申报清单', '增值税', '企业所得税', '扣缴所得税', '印花税', '社保费', '财报报送', '回执缴款书']

function parseMoney(value: string) {
  return Number(value.replace(/,/g, '')) || 0
}

function normalizeTaxValidationStatus(value: string) {
  return value === '校验通过' ? 'passed' : value === '需复核' ? 'review_required' : 'pending'
}

function normalizeTaxDeclarationStatus(value: string) {
  return value === '待申报' ? 'ready' : value === '已申报' ? 'submitted' : 'draft'
}

function displayTaxValidationStatus(value: string) {
  if (value === 'passed') return '校验通过'
  if (value === 'review_required') return '需复核'
  return '待确认'
}

function displayTaxDeclarationStatus(value: string) {
  if (value === 'submitted' || value === 'completed') return '已申报'
  if (value === 'ready' || value === 'confirmed') return '待申报'
  return '未申报'
}

function formatTaxNumber(value: number) {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function taxImportCellText(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return value === null || value === undefined ? '' : String(value).trim()
}

function normalizeTaxImportHeader(value: string) {
  return value.replace(/[（(].*?[）)]/g, '').replace(/[\s/]/g, '').trim()
}

function parseTaxImportMoney(value: string) {
  if (!value) return 0
  const parsed = Number(value.replace(/,/g, ''))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN
}

function normalizeImportedCollectStatus(value: string) {
  return ['已取数', '待补资料', '未取数'].includes(value) ? value : '未取数'
}

function normalizeImportedValidationStatus(value: string) {
  return ['校验通过', '需复核', '待确认'].includes(value) ? value : '待确认'
}

function mapTaxDeclarationTaskToRow(task: TaxDeclarationTask): DeclarationRow {
  return {
    id: task.id,
    category: task.taxType,
    form: task.formName,
    period: task.period,
    collectStatus: task.collectStatus || '未取数',
    checkStatus: displayTaxValidationStatus(task.validationStatus),
    declareStatus: displayTaxDeclarationStatus(task.declarationStatus),
    source: task.sourceSnapshot || '未记录取数来源',
    sales: formatTaxNumber(task.taxableAmount),
    deduction: formatTaxNumber(task.deductionAmount),
    payable: formatTaxNumber(task.payableAmount),
    risk: task.riskCount > 0 ? `${task.riskCount} 项待处理` : '无',
    owner: task.confirmedBy || '未记录',
    updated: task.updatedAt.replace('T', ' ').slice(5, 16),
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function buildTaxDeclarationPackageHtml(
  exportedAt: string,
  rows: DeclarationRow[],
  metadata: { companyName: string; taxId: string; period: string },
  risks: RiskRow[],
  operationLogs: RuleLog[],
) {
  const declarationBody = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.category)}</td>
      <td>${escapeHtml(row.form)}</td>
      <td>${escapeHtml(row.period)}</td>
      <td>${escapeHtml(row.collectStatus)}</td>
      <td>${escapeHtml(row.checkStatus)}</td>
      <td>${escapeHtml(row.declareStatus)}</td>
      <td>${escapeHtml(row.source)}</td>
      <td class="num">${escapeHtml(row.sales)}</td>
      <td class="num">${escapeHtml(row.deduction)}</td>
      <td class="num strong">${escapeHtml(row.payable)}</td>
      <td>${escapeHtml(row.risk)}</td>
      <td>${escapeHtml(row.owner)}</td>
    </tr>
  `).join('')
  const riskBody = risks.map(([level, module, desc, link]) => `
    <tr><td>${escapeHtml(level)}</td><td>${escapeHtml(module)}</td><td>${escapeHtml(desc)}</td><td>${escapeHtml(link)}</td></tr>
  `).join('')
  const logBody = operationLogs.map(([time, action, detail]) => `
    <tr><td>${escapeHtml(time)}</td><td>${escapeHtml(action)}</td><td>${escapeHtml(detail)}</td></tr>
  `).join('')

  return `<!doctype html><html><head><meta charset="utf-8"><title>税务申报包-${escapeHtml(metadata.period)}</title><style>
    @page{size:A4 landscape;margin:10mm}
    body{font-family:"Noto Sans SC","PingFang SC","Microsoft YaHei",-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:0;color:#111827}
    h1{text-align:center;font-size:20px;margin:0 0 8px} h2{font-size:15px;margin:18px 0 8px}
    .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:8px 16px;margin:10px 0 14px;font-size:12px;color:#334155}
    .meta span{border-bottom:1px solid #cbd5e1;padding-bottom:5px}
    table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:11px} thead{display:table-header-group} th,td{border:1px solid #64748b;padding:6px 7px;vertical-align:top;word-break:break-word}
    th{background:#e8eef6;text-align:left}.num{text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.strong{font-weight:700}
    .notice{margin-top:14px;border:1px solid #cbd5e1;background:#f8fafc;padding:9px;font-size:11px;line-height:1.7;color:#475569}
    .sign{display:flex;justify-content:space-between;margin-top:18px;font-size:12px;color:#334155}
    tr{break-inside:avoid;page-break-inside:avoid}
  </style></head><body>
    <h1>税务申报包</h1>
    <div class="meta">
      <span>纳税人: ${escapeHtml(metadata.companyName)}</span><span>纳税人识别号: ${escapeHtml(metadata.taxId)}</span><span>所属期: ${escapeHtml(metadata.period)}</span>
      <span>申报状态: 待人工确认</span><span>生成时间: ${escapeHtml(exportedAt)}</span><span>生成来源: 税务申报工作台</span>
    </div>
    <h2>一、申报清单</h2>
    <table><thead><tr><th>税种</th><th>申报表</th><th>所属期</th><th>取数状态</th><th>校验状态</th><th>申报状态</th><th>取数来源</th><th>计税依据</th><th>抵扣/减免</th><th>应缴金额</th><th>风险</th><th>负责人</th></tr></thead><tbody>${declarationBody}</tbody></table>
    <h2>二、风险与阻断</h2>
    <table><thead><tr><th>级别</th><th>税种/模块</th><th>风险说明</th><th>处理入口</th></tr></thead><tbody>${riskBody}</tbody></table>
    <h2>三、取数说明</h2>
    <table><tbody>
      <tr><td>销项税额</td><td>来自销项发票清单，按税率分组汇总。</td></tr>
      <tr><td>进项抵扣</td><td>来自已认证进项发票，未勾选发票不进入申报主表。</td></tr>
      <tr><td>企业所得税</td><td>来自利润表和纳税调整快照。</td></tr>
      <tr><td>工资个税</td><td>来自薪酬表、人员登记和专项附加扣除资料。</td></tr>
    </tbody></table>
    <h2>四、操作日志</h2>
    <table><thead><tr><th>时间</th><th>动作</th><th>说明</th></tr></thead><tbody>${logBody}</tbody></table>
    <div class="notice">边界说明: 本申报包为系统取数、校验、人工确认和留档材料，不代表已向电子税务局提交，也不代表已完成扣款或回执收取。真实申报必须通过合法税局 adapter、授权登录、提交回执和人工确认闭环。</div>
    <div class="sign"><span>制表: 系统</span><span>复核: 未签章</span><span>客户确认: 未签章</span></div>
  </body></html>`
}

function statusBadge(value: string) {
  const className =
    value === '校验通过' || value === '待申报' || value === '已取数'
      ? 'bg-green-50 text-green-700 ring-green-100'
      : value === '需复核' || value === '待确认' || value === '待补资料'
        ? 'bg-amber-50 text-amber-700 ring-amber-100'
        : 'bg-slate-50 text-slate-600 ring-slate-200'

  return <span className={cn('inline-flex rounded px-2 py-0.5 text-xs font-medium ring-1', className)}>{value}</span>
}

function riskBadge(value: string) {
  const cls = value === '无' ? 'text-slate-400' : value.includes('不一致') || value.includes('未勾选') ? 'text-red-600' : 'text-amber-600'
  return <span className={cn('text-xs font-medium', cls)}>{value}</span>
}

type TaxColumnKey = 'category' | 'form' | 'period' | 'collectStatus' | 'checkStatus' | 'declareStatus' | 'source' | 'sales' | 'deduction' | 'payable' | 'risk' | 'owner' | 'updated'
type TaxDeclarationColumn = {
  key: TaxColumnKey
  label: string
  align?: 'right'
  total?: boolean
  cell: (row: DeclarationRow) => ReactNode
}

const taxDeclarationColumns: readonly TaxDeclarationColumn[] = [
  { key: 'category', label: '税种', cell: (row: DeclarationRow) => <span className="whitespace-nowrap font-medium text-slate-900">{row.category}</span> },
  { key: 'form', label: '申报表', cell: (row: DeclarationRow) => <span className="whitespace-nowrap text-slate-700">{row.form}</span> },
  { key: 'period', label: '所属期', cell: (row: DeclarationRow) => <span className="whitespace-nowrap text-slate-600">{row.period}</span> },
  { key: 'collectStatus', label: '取数状态', cell: (row: DeclarationRow) => statusBadge(row.collectStatus) },
  { key: 'checkStatus', label: '校验状态', cell: (row: DeclarationRow) => statusBadge(row.checkStatus) },
  { key: 'declareStatus', label: '申报状态', cell: (row: DeclarationRow) => statusBadge(row.declareStatus) },
  { key: 'source', label: '取数来源', cell: (row: DeclarationRow) => <span className="block max-w-[260px] truncate text-slate-600">{row.source}</span> },
  { key: 'sales', label: '计税依据', align: 'right', total: true, cell: (row: DeclarationRow) => <span className="whitespace-nowrap font-mono text-slate-700">{row.sales}</span> },
  { key: 'deduction', label: '抵扣/减免', align: 'right', total: true, cell: (row: DeclarationRow) => <span className="whitespace-nowrap font-mono text-slate-700">{row.deduction}</span> },
  { key: 'payable', label: '应缴金额', align: 'right', total: true, cell: (row: DeclarationRow) => <span className="whitespace-nowrap font-mono font-semibold text-slate-900">{row.payable}</span> },
  { key: 'risk', label: '风险', cell: (row: DeclarationRow) => riskBadge(row.risk) },
  { key: 'owner', label: '负责人', cell: (row: DeclarationRow) => <span className="whitespace-nowrap text-slate-600">{row.owner}</span> },
  { key: 'updated', label: '更新时间', cell: (row: DeclarationRow) => <span className="whitespace-nowrap text-slate-500">{row.updated}</span> },
] as const
type TaxColumnSettings = {
  visibleKeys: TaxColumnKey[]
  density: 'standard' | 'compact'
  freezeKeyColumns: boolean
}

const taxColumnSettingsStoragePrefix = 'accounting_tax_workspace_columns_v1'

function defaultTaxColumnSettings(): TaxColumnSettings {
  return {
    visibleKeys: taxDeclarationColumns.map((column) => column.key),
    density: 'standard',
    freezeKeyColumns: true,
  }
}

function taxColumnSettingsStorageKey(companyId: string) {
  return `${taxColumnSettingsStoragePrefix}:${companyId}`
}

function loadTaxColumnSettings(companyId: string): TaxColumnSettings {
  const fallback = defaultTaxColumnSettings()
  try {
    const value = window.localStorage.getItem(taxColumnSettingsStorageKey(companyId))
    if (!value) return fallback
    const parsed = JSON.parse(value) as Partial<TaxColumnSettings>
    const knownKeys = new Set<TaxColumnKey>(taxDeclarationColumns.map((column) => column.key))
    const visibleKeys = Array.isArray(parsed.visibleKeys)
      ? parsed.visibleKeys.filter((key): key is TaxColumnKey => typeof key === 'string' && knownKeys.has(key as TaxColumnKey))
      : fallback.visibleKeys
    return {
      visibleKeys: visibleKeys.length > 0 ? visibleKeys : fallback.visibleKeys,
      density: parsed.density === 'compact' ? 'compact' : 'standard',
      freezeKeyColumns: parsed.freezeKeyColumns !== false,
    }
  } catch {
    return fallback
  }
}

function saveTaxColumnSettings(companyId: string, settings: TaxColumnSettings) {
  window.localStorage.setItem(taxColumnSettingsStorageKey(companyId), JSON.stringify(settings))
}

export function TaxWorkspace() {
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId)
  const companies = useCompanyStore((state) => state.companies)
  const companyId = selectedCompanyId ?? 'mock-1'
  const periods = usePeriodStore((state) => state.periods)
  const currentPeriodId = usePeriodStore((state) => state.currentPeriodId)
  const currentPeriodRecord = useMemo(() => periods.find((period) => period.id === currentPeriodId), [currentPeriodId, periods])
  const currentPeriodLabel = currentPeriodRecord
    ? `${currentPeriodRecord.period_year}-${String(currentPeriodRecord.period_month).padStart(2, '0')}`
    : '2026-05'
  const currentPeriod = currentPeriodLabel
  const selectedCompany = useMemo(() => companies.find((company) => company.id === selectedCompanyId), [companies, selectedCompanyId])
  const taxPackageMetadata = useMemo(() => ({
    companyName: selectedCompany?.name || '当前账套',
    taxId: selectedCompany?.tax_id || '未维护',
    period: currentPeriod,
  }), [currentPeriod, selectedCompany])
  const usesLiveTaxDeclarationData = Boolean(isTauri && selectedCompanyId && currentPeriodId)
  const [showRulesLog, setShowRulesLog] = useState(false)
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [taxColumnSettings, setTaxColumnSettings] = useState<TaxColumnSettings>(() => loadTaxColumnSettings(companyId))
  const [taxColumnSettingsDraft, setTaxColumnSettingsDraft] = useState<TaxColumnSettings>(() => loadTaxColumnSettings(companyId))
  const [operationNotice, setOperationNotice] = useState<string | null>(null)
  const [taxDeclarationTasks, setTaxDeclarationTasks] = useState<TaxDeclarationTask[]>([])
  const [backendTaskCount, setBackendTaskCount] = useState(0)
  const [backendAuditCount, setBackendAuditCount] = useState(0)
  const [operationAuditLogs, setOperationAuditLogs] = useState<OperationAuditLog[]>([])
  const [backendAdapterStatus, setBackendAdapterStatus] = useState('未配置')
  const [selectedDeclarationIds, setSelectedDeclarationIds] = useState<Set<string>>(new Set())
  const [pendingDeclarationConfirmation, setPendingDeclarationConfirmation] = useState<{ rows: DeclarationRow[]; action: string } | null>(null)
  const [activeTab, setActiveTab] = useState('申报清单')
  const [searchTerm, setSearchTerm] = useState('')
  const [declarationStatusFilter, setDeclarationStatusFilter] = useState('全部')
  const [validationStatusFilter, setValidationStatusFilter] = useState('全部')
  const [showDeclarationDetailDialog, setShowDeclarationDetailDialog] = useState(false)
  const [showTaxInitializationImportDialog, setShowTaxInitializationImportDialog] = useState(false)
  const [taxInitializationImportFileName, setTaxInitializationImportFileName] = useState('')
  const [taxInitializationImportPreview, setTaxInitializationImportPreview] = useState<TaxInitializationImportCandidate[]>([])
  const [taxInitializationImportErrors, setTaxInitializationImportErrors] = useState<string[]>([])
  const taxInitializationInputRef = useRef<HTMLInputElement>(null)
  const [declarationDraft, setDeclarationDraft] = useState<DeclarationDraft>({
    id: '', category: '', form: '', period: '', source: '', taxableAmount: '', deductionAmount: '', payableAmount: '', collectStatus: '已取数', validationStatus: '待确认', riskCount: '0',
  })

  useEffect(() => {
    const settings = loadTaxColumnSettings(companyId)
    setTaxColumnSettings(settings)
    setTaxColumnSettingsDraft(settings)
  }, [companyId])

  const visibleTaxColumns = useMemo(() => {
    const visible = new Set(taxColumnSettings.visibleKeys)
    return taxDeclarationColumns.filter((column) => visible.has(column.key))
  }, [taxColumnSettings.visibleKeys])

  useEffect(() => {
    let cancelled = false

    async function loadBackendState() {
      const [tasksResult, logsResult] = await Promise.all([
        automationApi.getTaxDeclarationTasks({ companyId, period: currentPeriod }),
        automationApi.getOperationAuditLogs({ companyId, moduleName: '税务申报工作台' }),
      ])
      const adaptersResult = await automationApi.getAdapterAuthorizations({ companyId, adapterType: 'tax' })
      if (cancelled) return
      if (tasksResult.success) {
        const tasks = tasksResult.data ?? []
        setBackendTaskCount(tasks.length)
        setTaxDeclarationTasks(tasks)
      }
      if (logsResult.success) {
        const auditLogs = logsResult.data ?? []
        setBackendAuditCount(auditLogs.filter((log) => log.objectRef?.includes(currentPeriod)).length)
        setOperationAuditLogs(auditLogs)
      }
      if (adaptersResult.success) {
        setBackendAdapterStatus(adaptersResult.data?.[0]?.authStatus ?? '未配置')
      }
    }

    void loadBackendState()
    return () => {
      cancelled = true
    }
  }, [companyId, currentPeriod])

  const visibleDeclarationRows = usesLiveTaxDeclarationData
    ? taxDeclarationTasks.map(mapTaxDeclarationTaskToRow)
    : declarationRows
  const currentRows = usesLiveTaxDeclarationData ? visibleDeclarationRows : declarationRows
  const filteredDeclarationRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    return currentRows.filter((row) => {
      const matchesTab = activeTab === '申报清单' || row.category.includes(activeTab)
      const matchesSearch = !normalizedSearch || [row.category, row.form, row.source, row.period].join(' ').toLowerCase().includes(normalizedSearch)
      const matchesDeclarationStatus = declarationStatusFilter === '全部' || row.declareStatus === declarationStatusFilter
      const matchesValidationStatus = validationStatusFilter === '全部' || row.checkStatus === validationStatusFilter
      return matchesTab && matchesSearch && matchesDeclarationStatus && matchesValidationStatus
    })
  }, [activeTab, currentRows, declarationStatusFilter, searchTerm, validationStatusFilter])
  const selectedDeclarationRows = filteredDeclarationRows.filter((row) => selectedDeclarationIds.has(row.id))
  const areAllDeclarationsSelected = filteredDeclarationRows.length > 0 && filteredDeclarationRows.every((row) => selectedDeclarationIds.has(row.id))
  const currentRowIdSignature = currentRows.map((row) => row.id).join('|')

  useEffect(() => {
    const validIds = new Set(currentRowIdSignature ? currentRowIdSignature.split('|') : [])
    setSelectedDeclarationIds((ids) => new Set([...ids].filter((id) => validIds.has(id))))
  }, [currentRowIdSignature])
  const scopedOperationAuditLogs = useMemo(() => operationAuditLogs.filter((log) => log.objectRef?.includes(currentPeriod)), [currentPeriod, operationAuditLogs])
  const visibleRiskRows = useMemo<RiskRow[]>(() => {
    if (!usesLiveTaxDeclarationData) return riskRows

    return visibleDeclarationRows
      .filter((row) => row.risk !== '无' || row.collectStatus === '待补资料' || row.checkStatus !== '校验通过')
      .map((row) => [
        row.collectStatus === '待补资料' || row.checkStatus !== '校验通过' ? '阻断' : '提示',
        row.category,
        row.risk === '无'
          ? `${row.collectStatus} / ${row.checkStatus}，需人工复核后再确认申报。`
          : row.risk,
        '申报清单',
      ] as RiskRow)
  }, [usesLiveTaxDeclarationData, visibleDeclarationRows])
  const visibleRuleLogs = useMemo<RuleLog[]>(() => {
    if (!usesLiveTaxDeclarationData) return logs

    return scopedOperationAuditLogs.map((log) => [
      log.createdAt.replace('T', ' ').slice(5, 16),
      log.action,
      log.detail || log.objectRef || '未记录说明',
    ])
  }, [scopedOperationAuditLogs, usesLiveTaxDeclarationData])
  const declarationMetrics = {
    total: visibleDeclarationRows.length,
    collected: visibleDeclarationRows.filter((row) => row.collectStatus === '已取数').length,
    validated: visibleDeclarationRows.filter((row) => row.checkStatus === '校验通过').length,
    pending: visibleDeclarationRows.filter((row) => row.checkStatus !== '校验通过' || row.declareStatus !== '已申报').length,
    blocked: visibleDeclarationRows.filter((row) => row.risk !== '无' || row.collectStatus === '待补资料').length,
    payable: visibleDeclarationRows.reduce((sum, row) => sum + parseMoney(row.payable), 0),
  }

  const reloadTaxDeclarationTasks = async () => {
    const result = await automationApi.getTaxDeclarationTasks({ companyId, period: currentPeriod })
    if (result.success) {
      const tasks = result.data ?? []
      setTaxDeclarationTasks(tasks)
      setBackendTaskCount(tasks.length)
    }
    return result
  }

  const persistDeclarationRow = async (row: DeclarationRow) => {
    const result = await automationApi.upsertTaxDeclarationTask({
      companyId,
      period: row.period,
      taxType: row.category,
      formName: row.form,
      collectStatus: row.collectStatus,
      validationStatus: normalizeTaxValidationStatus(row.checkStatus),
      declarationStatus: normalizeTaxDeclarationStatus(row.declareStatus),
      sourceSnapshot: row.source,
      taxableAmount: parseMoney(row.sales),
      deductionAmount: parseMoney(row.deduction),
      payableAmount: parseMoney(row.payable),
      riskCount: row.risk === '无' ? 0 : 1,
      adapterCode: 'local-preview',
    })
    if (result.success) {
      await reloadTaxDeclarationTasks()
    }
    return result
  }

  const writeTaxAudit = (input: Omit<Parameters<typeof recordAuditLog>[0], 'module' | 'voucher'>) => {
    recordAuditLog({
      module: '税务申报工作台',
      voucher: `${currentPeriod}/全部税种`,
      ...input,
    })
    void automationApi.writeOperationAuditLog({
      companyId,
      moduleName: '税务申报工作台',
      action: input.action,
      objectRef: `${currentPeriod}｜${input.object}`,
      riskLevel: input.level,
      result: input.result,
      detail: `${input.status}｜${input.attachment ?? '无附件'}`,
      operator: 'admin',
    }).then((response) => {
      if (response.success && response.data) {
        setBackendAuditCount((count) => count + 1)
        setOperationAuditLogs((logs) => [response.data!, ...logs])
      }
    })
  }

  const refreshDeclarationSnapshot = () => {
    if (currentRows.length === 0) {
      writeTaxAudit({
        action: '重新取数',
        object: `${currentPeriod}申报取数快照`,
        level: '中',
        result: '待审批',
        status: '待确认',
        attachment: '无本地申报任务',
      })
      setOperationNotice('当前账套尚无本地申报任务；未写入示例数据，需先通过合法采集或初始化流程生成真实任务。')
      return
    }

    void Promise.all(currentRows.map((row) => persistDeclarationRow(row))).then((results) => {
      const saved = results.filter((result) => result.success).length
      if (saved > 0) setBackendTaskCount(saved)
    })
    writeTaxAudit({
      action: '重新取数',
      object: `${currentPeriod}申报取数快照`,
      level: '普通',
      result: '成功',
      status: '已通过',
      attachment: '取数快照',
    })
    setOperationNotice('已重新生成本期申报取数快照，真实税局取数仍需合法 adapter 和授权。')
  }

  const runRiskCheck = () => {
    const blockerCount = visibleRiskRows.filter(([level]) => level === '阻断').length
    const reviewCount = visibleRiskRows.length - blockerCount
    writeTaxAudit({
      action: '风险检查',
      object: `${blockerCount}条阻断/${reviewCount}条需复核`,
      level: '中',
      result: '成功',
      status: '已通过',
      attachment: '风险清单',
    })
    setOperationNotice(`风险检查已记录：${blockerCount} 条阻断、${reviewCount} 条需复核，阻断项处理前不能提交。`)
  }

  function requestDeclarationConfirmation(rows: DeclarationRow[], action: string) {
    if (rows.length === 0) {
      setOperationNotice('当前账套尚无待确认申报任务；未向电子税务局提交，也未写入示例数据。')
      return
    }
    setPendingDeclarationConfirmation({ rows, action })
  }

  const confirmDeclaration = async (targetRows: DeclarationRow[], action: string) => {
    if (targetRows.length === 0) {
      setOperationNotice('当前账套尚无待确认申报任务；未向电子税务局提交，也未写入示例数据。')
      return
    }

    if (!usesLiveTaxDeclarationData) {
      setOperationNotice('浏览器预览只展示申报流程；请在桌面端选择账套和账期后执行本地确认。')
      return
    }

    const blockers = targetRows.filter((row) => row.risk !== '无' || row.checkStatus !== '校验通过' || row.collectStatus === '待补资料')
    const results = await Promise.all(targetRows.map((row) => persistDeclarationRow(row)))
    const saved = results.filter((result) => result.success).length
    if (saved > 0) setBackendTaskCount(saved)

    if (blockers.length > 0) {
      writeTaxAudit({
        action,
        object: `税务申报包-${currentPeriod} 阻断${blockers.length}项`,
        level: '高',
        result: '待审批',
        status: '待确认',
        attachment: '待提交',
      })
      setOperationNotice(`${action}已被本地规则阻断：${blockers.length} 个税种存在风险、资料待补或校验未通过；当前未向电子税务局提交，也未发起扣款。`)
      return
    }

    await Promise.all(results
      .map((result) => result.data)
      .filter((task) => task && task.validationStatus === 'passed' && task.riskCount === 0)
      .map((task) => automationApi.confirmTaxDeclarationTask({ id: task!.id, companyId, confirmedBy: 'admin' })))
    await reloadTaxDeclarationTasks()
    setSelectedDeclarationIds(new Set())
    writeTaxAudit({
      action,
      object: `税务申报包-${currentPeriod} 本地确认`,
      level: '高',
      result: '待审批',
      status: '待确认',
      attachment: '待提交',
    })
    setOperationNotice(`${action}已写入本地任务状态；真实税局提交、扣款和回执仍需合法 adapter 与人工审批。`)
  }

  const toggleDeclarationSelection = (id: string, checked: boolean) => {
    setSelectedDeclarationIds((ids) => {
      const next = new Set(ids)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleAllDeclarationSelection = (checked: boolean) => {
    setSelectedDeclarationIds(checked ? new Set(filteredDeclarationRows.map((row) => row.id)) : new Set())
  }

  const confirmSelectedDeclarations = async () => {
    if (selectedDeclarationRows.length === 0) {
      setOperationNotice('请先勾选需要确认的申报事项。')
      return
    }
    requestDeclarationConfirmation(selectedDeclarationRows, '批量确认申报')
  }

  const importInitialization = () => {
    taxInitializationInputRef.current?.click()
  }

  const handleTaxInitializationFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setOperationNotice('税务申报初始化仅支持导入本系统下载的 .xlsx 模板。')
      return
    }

    try {
      const { readSheet } = await import('read-excel-file/browser')
      const rawRows = await readSheet(file)
      const rows = rawRows.map((row) => row.map(taxImportCellText))
      const headerIndex = rows.findIndex((row) => row.some((cell) => normalizeTaxImportHeader(cell) === '税种') && row.some((cell) => normalizeTaxImportHeader(cell) === '申报表'))
      if (headerIndex < 0) throw new Error('未找到“税种、申报表”表头，请使用系统下载的初始化模板。')

      const headerMap = new Map(rows[headerIndex].map((header, index) => [normalizeTaxImportHeader(header), index]))
      const getCell = (row: string[], header: string) => row[headerMap.get(normalizeTaxImportHeader(header)) ?? -1] || ''
      const errors: string[] = []
      const candidates: TaxInitializationImportCandidate[] = []

      rows.slice(headerIndex + 1).forEach((row, index) => {
        const rowNumber = headerIndex + index + 2
        const taxType = getCell(row, '税种')
        const formName = getCell(row, '申报表')
        const period = getCell(row, '所属期')
        if (!taxType && !formName && !period) return
        if (['制表说明', '边界说明', '本页小计', '合计'].includes(taxType)) return
        if (!taxType || !formName || !period) {
          errors.push(`第 ${rowNumber} 行缺少税种、申报表或所属期。`)
          return
        }
        if (period !== currentPeriod) {
          errors.push(`第 ${rowNumber} 行所属期为 ${period}，与当前账期 ${currentPeriod} 不一致。`)
          return
        }
        const taxableAmount = parseTaxImportMoney(getCell(row, '计税依据'))
        const deductionAmount = parseTaxImportMoney(getCell(row, '抵扣减免'))
        const payableAmount = parseTaxImportMoney(getCell(row, '应缴金额'))
        if ([taxableAmount, deductionAmount, payableAmount].some((value) => Number.isNaN(value))) {
          errors.push(`第 ${rowNumber} 行金额必须是非负数字。`)
          return
        }
        const risk = getCell(row, '风险项')
        candidates.push({
          rowNumber,
          taxType,
          formName,
          period,
          collectStatus: normalizeImportedCollectStatus(getCell(row, '取数状态')),
          validationStatus: normalizeImportedValidationStatus(getCell(row, '校验状态')),
          taxableAmount,
          deductionAmount,
          payableAmount,
          riskCount: risk ? 1 : 0,
          sourceSnapshot: getCell(row, '取数依据人工复核说明'),
          adapterCode: getCell(row, '授权适配器代码'),
        })
      })
      if (candidates.length === 0) errors.push('模板中没有可导入的申报事项。')
      setTaxInitializationImportFileName(file.name)
      setTaxInitializationImportPreview(candidates)
      setTaxInitializationImportErrors(errors)
      setShowTaxInitializationImportDialog(true)
    } catch (error) {
      setOperationNotice(`解析税务申报初始化模板失败：${String(error)}`)
    }
  }

  const confirmTaxInitializationImport = async () => {
    if (!usesLiveTaxDeclarationData || !selectedCompanyId) {
      setOperationNotice('浏览器预览只展示模板解析；请在桌面端选择账套和账期后确认写入本地申报事项。')
      return
    }
    if (taxInitializationImportPreview.length === 0 || taxInitializationImportErrors.length > 0) {
      setOperationNotice('当前模板存在校验错误，修正后才能确认写入本地申报事项。')
      return
    }

    const results = await Promise.all(taxInitializationImportPreview.map((item) => automationApi.upsertTaxDeclarationTask({
      companyId,
      period: item.period,
      taxType: item.taxType,
      formName: item.formName,
      collectStatus: item.collectStatus,
      validationStatus: normalizeTaxValidationStatus(item.validationStatus),
      declarationStatus: 'draft',
      sourceSnapshot: item.sourceSnapshot || undefined,
      taxableAmount: item.taxableAmount,
      deductionAmount: item.deductionAmount,
      payableAmount: item.payableAmount,
      riskCount: item.riskCount,
      adapterCode: item.adapterCode || 'local-template',
    })))
    const saved = results.filter((result) => result.success).length
    if (saved !== taxInitializationImportPreview.length) {
      setOperationNotice(`仅写入 ${saved}/${taxInitializationImportPreview.length} 条本地申报事项，请检查失败项后重试。`)
      return
    }
    await reloadTaxDeclarationTasks()
    writeTaxAudit({
      action: '导入初始化',
      object: `税种认定/取数参数 ${saved} 条`,
      level: '中',
      result: '成功',
      status: '已通过',
      attachment: taxInitializationImportFileName,
    })
    setShowTaxInitializationImportDialog(false)
    setTaxInitializationImportPreview([])
    setTaxInitializationImportErrors([])
    setOperationNotice(`已确认写入 ${saved} 条本地申报事项；不会向税局提交申报、发起扣款或保存税局密码。`)
  }

  const downloadTaxTemplate = async () => {
    const fileName = `税务申报初始化模板-${currentPeriod}.xlsx`
    const templateHeaders = [
      '税种',
      '申报表',
      '所属期',
      '取数状态',
      '校验状态',
      '计税依据(元)',
      '抵扣/减免(元)',
      '应缴金额(元)',
      '风险项',
      '取数依据/人工复核说明',
      '授权适配器代码',
    ]
    const templateRows = currentRows.map((row) => [
      row.category,
      row.form,
      row.period,
      row.collectStatus,
      row.checkStatus,
      parseMoney(row.sales).toFixed(2),
      parseMoney(row.deduction).toFixed(2),
      parseMoney(row.payable).toFixed(2),
      row.risk === '无' ? '' : row.risk,
      row.source,
      '',
    ])

    try {
      await exportRowsToXlsx({
        fileName,
        sheetName: '税务申报初始化',
        columnWidths: [
          { wch: 16 }, { wch: 34 }, { wch: 13 }, { wch: 12 }, { wch: 12 }, { wch: 15 },
          { wch: 15 }, { wch: 15 }, { wch: 28 }, { wch: 42 }, { wch: 22 },
        ],
        merges: [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
          { s: { r: templateRows.length + 6, c: 1 }, e: { r: templateRows.length + 6, c: 10 } },
        ],
        sheetRows: [
          ['税务申报初始化模板'],
          ['账套名称', taxPackageMetadata.companyName, '纳税人识别号', taxPackageMetadata.taxId, '所属期', currentPeriod],
          ['模板用途', '本地税种认定、取数和校验参数维护'],
          [],
          templateHeaders,
          ...templateRows,
          [],
          ['制表说明', '仅用于本地税种认定和取数维护；不包含税局密码，不提交税局、不扣款。'],
        ],
      })
    } catch (error) {
      setOperationNotice(`下载税务申报初始化模板失败：${String(error)}`)
      return
    }

    writeTaxAudit({
      action: '下载模板',
      object: '税务申报初始化模板',
      level: '普通',
      result: '成功',
      status: '已通过',
      attachment: '模板版本',
    })
    recordExportJob({
      fileName,
      moduleName: '税务申报工作台',
      format: 'Excel模板',
      scope: `${currentPeriod}/初始化`,
      templateKind: 'tax',
      rowCount: templateRows.length,
    })
    setOperationNotice(`税务申报初始化模板已下载并写入下载中心，预填 ${templateRows.length} 条税种认定行；导入仍只维护本地数据，不会提交税局或扣款。`)
  }

  const openColumnSettings = () => {
    setTaxColumnSettingsDraft(taxColumnSettings)
    setShowColumnSettings(true)
  }

  const toggleTaxColumn = (key: TaxColumnKey, checked: boolean) => {
    setTaxColumnSettingsDraft((settings) => {
      const visibleKeys = checked
        ? [...settings.visibleKeys, key]
        : settings.visibleKeys.filter((item) => item !== key)
      return { ...settings, visibleKeys }
    })
  }

  const saveColumnSettings = () => {
    if (taxColumnSettingsDraft.visibleKeys.length === 0) {
      setOperationNotice('申报清单至少需要保留一个业务字段。')
      return
    }
    try {
      saveTaxColumnSettings(companyId, taxColumnSettingsDraft)
    } catch (error) {
      setOperationNotice(`保存列设置失败：${String(error)}`)
      return
    }
    setTaxColumnSettings(taxColumnSettingsDraft)
    writeTaxAudit({
      action: '列设置',
      object: '申报清单显示列',
      level: '普通',
      result: '成功',
      status: '已通过',
      attachment: `${taxColumnSettingsDraft.visibleKeys.length} 列 / ${taxColumnSettingsDraft.density === 'compact' ? '紧凑' : '标准'} / ${taxColumnSettingsDraft.freezeKeyColumns ? '冻结关键列' : '不冻结'}`,
    })
    setShowColumnSettings(false)
    setOperationNotice('申报清单列设置已保存到当前用户、当前账套。')
  }

  const viewDeclarationRow = (row: DeclarationRow) => {
    const task = taxDeclarationTasks.find((item) => item.id === row.id)
    setDeclarationDraft({
      id: task?.id ?? '',
      category: row.category,
      form: row.form,
      period: row.period,
      source: row.source,
      taxableAmount: String(parseMoney(row.sales)),
      deductionAmount: String(parseMoney(row.deduction)),
      payableAmount: String(parseMoney(row.payable)),
      collectStatus: row.collectStatus,
      validationStatus: row.checkStatus,
      riskCount: String(task?.riskCount ?? (row.risk === '无' ? 0 : 1)),
    })
    setShowDeclarationDetailDialog(true)
    writeTaxAudit({
      action: '查看申报明细',
      object: `${row.category}-${row.period}`,
      level: '普通',
      result: '成功',
      status: '已通过',
      attachment: row.form,
    })
    setOperationNotice(`${row.category} 本地申报事项明细已打开；保存仅更新本地取数和校验状态。`)
  }

  const saveDeclarationDetail = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!usesLiveTaxDeclarationData || !selectedCompanyId) {
      setOperationNotice('浏览器预览只展示申报事项；请在桌面端选择账套和账期后保存本地修改。')
      return
    }
    const task = taxDeclarationTasks.find((item) => item.id === declarationDraft.id)
    if (!task) {
      setOperationNotice('未找到对应的本地申报事项。请先在“申报初始化”维护税种认定后再编辑。')
      return
    }
    const result = await automationApi.upsertTaxDeclarationTask({
      companyId,
      period: task.period,
      taxType: task.taxType,
      formName: task.formName,
      collectStatus: declarationDraft.collectStatus,
      validationStatus: normalizeTaxValidationStatus(declarationDraft.validationStatus),
      declarationStatus: task.declarationStatus,
      sourceSnapshot: declarationDraft.source.trim() || undefined,
      taxableAmount: Number(declarationDraft.taxableAmount || 0),
      deductionAmount: Number(declarationDraft.deductionAmount || 0),
      payableAmount: Number(declarationDraft.payableAmount || 0),
      riskCount: Number(declarationDraft.riskCount || 0),
      adapterCode: task.adapterCode || undefined,
      receiptNo: task.receiptNo || undefined,
      paymentStatus: task.paymentStatus,
      paymentNo: task.paymentNo || undefined,
      receiptReceivedAt: task.receiptReceivedAt || undefined,
    })
    if (!result.success || !result.data) {
      setOperationNotice(`保存申报事项失败：${result.error || '未知错误'}`)
      return
    }
    setTaxDeclarationTasks((tasks) => [result.data!, ...tasks.filter((item) => item.id !== result.data!.id)])
    setShowDeclarationDetailDialog(false)
    writeTaxAudit({
      action: '编辑本地申报事项',
      object: `${result.data.taxType}-${result.data.period}`,
      level: result.data.riskCount > 0 ? '中' : '普通',
      result: '成功',
      status: result.data.riskCount > 0 ? '待确认' : '已通过',
      attachment: result.data.sourceSnapshot || '未填写取数依据',
    })
    setOperationNotice('本地申报事项已保存；税局提交、扣款和回执仍需合法 adapter 与人工审批。')
  }

  const fetchDeclarationRow = (row: DeclarationRow) => {
    const blocked = row.risk !== '无' || row.collectStatus === '待补资料'
    void persistDeclarationRow(row)
    writeTaxAudit({
      action: '单税种取数',
      object: `${row.category}-${row.period}`,
      level: blocked ? '中' : '普通',
      result: blocked ? '待审批' : '成功',
      status: blocked ? '待确认' : '已通过',
      attachment: row.source,
    })
    setOperationNotice(
      blocked
        ? `${row.category} 存在资料或风险项，已进入待确认；不会自动进入申报提交。`
        : `${row.category} 已重新取数并记录来源快照。`
    )
  }

  const handleRiskLink = (module: string, desc: string) => {
    writeTaxAudit({
      action: '处理风险入口',
      object: `${module}-${desc}`,
      level: desc.includes('阻断') || desc.includes('未完成') ? '高' : '中',
      result: '待审批',
      status: '待确认',
      attachment: '风险处理入口',
    })
    setOperationNotice(`${module} 风险处理已记录；当前只定位到处理入口，不自动修改发票、凭证或税表。`)
  }

  const exportTaxPackage = () => {
    const exportedAt = new Date().toLocaleString('zh-CN')
    const fileName = `税务申报包-${currentPeriod}.html`
    const html = buildTaxDeclarationPackageHtml(exportedAt, visibleDeclarationRows, taxPackageMetadata, visibleRiskRows, visibleRuleLogs)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    recordExportJob({
      fileName,
      moduleName: '税务申报工作台',
      format: '申报包HTML',
      scope: `${currentPeriod}/全部税种`,
      templateKind: 'tax',
      rowCount: visibleDeclarationRows.length,
    })
    writeTaxAudit({
      action: '导出申报包',
      object: fileName,
      level: visibleRiskRows.length > 0 ? '中' : '普通',
      result: '成功',
      status: '已通过',
      attachment: `${visibleDeclarationRows.length} 个税种 / ${visibleRiskRows.length} 项风险`,
    })
  }

  const printTaxPackage = () => {
    const exportedAt = new Date().toLocaleString('zh-CN')
    const fileName = `税务申报包-${currentPeriod}-print`
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setOperationNotice('浏览器阻止了打印窗口，请允许本应用打开打印预览后重试。')
      writeTaxAudit({
        action: '打印申报包',
        object: fileName,
        level: '中',
        result: '失败',
        status: '异常',
        attachment: '浏览器阻止了打印窗口',
      })
      return
    }
    printWindow.document.write(buildTaxDeclarationPackageHtml(exportedAt, visibleDeclarationRows, taxPackageMetadata, visibleRiskRows, visibleRuleLogs))
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
    recordExportJob({
      fileName,
      moduleName: '税务申报工作台',
      format: '打印预览',
      scope: `${currentPeriod}/全部税种`,
      templateKind: 'tax',
      rowCount: visibleDeclarationRows.length,
    })
    writeTaxAudit({
      action: '打印申报包',
      object: fileName,
      level: visibleRiskRows.length > 0 ? '中' : '普通',
      result: '成功',
      status: '已通过',
      attachment: `${visibleDeclarationRows.length} 个税种 / ${visibleRiskRows.length} 项风险`,
    })
  }

  const exportTaxPackagePdf = async () => {
    const exportedAt = new Date().toLocaleString('zh-CN')
    const fileName = `税务申报包-${currentPeriod}.pdf`
    try {
      await exportHtmlToPdf({
        html: buildTaxDeclarationPackageHtml(exportedAt, visibleDeclarationRows, taxPackageMetadata, visibleRiskRows, visibleRuleLogs),
        fileName,
        pageTitle: `税务申报包 ${currentPeriod}`,
      })
      recordExportJob({
        fileName,
        moduleName: '税务申报工作台',
        format: 'PDF',
        scope: `${currentPeriod}/全部税种`,
        templateKind: 'tax',
        rowCount: visibleDeclarationRows.length,
      })
      writeTaxAudit({
        action: '导出申报包 PDF',
        object: fileName,
        level: visibleRiskRows.length > 0 ? '中' : '普通',
        result: '成功',
        status: '已通过',
        attachment: `${visibleDeclarationRows.length} 个税种 / ${visibleRiskRows.length} 项风险`,
      })
    } catch (error) {
      setOperationNotice(`PDF 导出失败：${String(error)}`)
      writeTaxAudit({
        action: '导出申报包 PDF',
        object: fileName,
        level: visibleRiskRows.length > 0 ? '中' : '普通',
        result: '失败',
        status: '异常',
        attachment: String(error),
      })
    }
  }

  return (
    <div className="h-full min-w-0 bg-[#f3f6fa] text-slate-900">
      <div className="border border-slate-200 bg-white">
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-1.5">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="text-base font-semibold">税务申报</h1>
            <span className="rounded bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-green-100">已结账</span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1">
            <ToolbarButton icon={<RefreshCw className="h-3.5 w-3.5" />} label="重新取数" onClick={refreshDeclarationSnapshot} />
            <ToolbarButton icon={<ShieldAlert className="h-3.5 w-3.5" />} label="风险检查" onClick={runRiskCheck} />
            <ToolbarButton icon={<Download className="h-3.5 w-3.5" />} label="导出申报包" onClick={exportTaxPackage} />
            <ToolbarButton icon={<FileText className="h-3.5 w-3.5" />} label="导出PDF" onClick={exportTaxPackagePdf} />
            <ToolbarButton icon={<Printer className="h-3.5 w-3.5" />} label="打印申报包" onClick={printTaxPackage} />
            <span className="mx-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-500">本地任务 {backendTaskCount} · 审计 {backendAuditCount} · adapter {backendAdapterStatus}</span>
            <button
              type="button"
              onClick={() => requestDeclarationConfirmation(currentRows, '确认申报')}
              className="inline-flex h-8 items-center gap-1 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]"
            >
              <Play className="h-3.5 w-3.5" />
              确认申报
            </button>
          </div>
        </div>
        {operationNotice && (
          <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            {operationNotice}
          </div>
        )}

        <div className="flex overflow-x-auto border-b border-slate-200 bg-[#f8fafc] px-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(tab)
                setSelectedDeclarationIds(new Set())
              }}
              className={cn(
                'h-9 border-b-2 px-3 text-xs font-medium',
                activeTab === tab ? 'border-[#1f65a7] bg-white text-[#1f65a7]' : 'border-transparent text-slate-600 hover:bg-white hover:text-slate-900'
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 border-b border-slate-200 bg-white md:grid-cols-3 xl:grid-cols-6">
          {[
            ['应申报税种', `${declarationMetrics.total}`],
            ['已取数', `${declarationMetrics.collected}`],
            ['校验通过', `${declarationMetrics.validated}`],
            ['待确认', `${declarationMetrics.pending}`],
            ['阻断风险', `${declarationMetrics.blocked}`],
            ['预计应缴', formatTaxNumber(declarationMetrics.payable)],
          ].map(([label, value]) => (
            <div key={label} className="border-r border-slate-100 px-4 py-3 last:border-r-0">
              <div className="text-xs text-slate-500">{label}</div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{value}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-[#fbfcfe] px-3 py-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="relative min-w-64 flex-1 sm:flex-none">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="h-8 w-full rounded border border-slate-300 bg-white pl-8 pr-3 text-xs outline-none focus:border-[#1f65a7] sm:w-72" placeholder="搜索税种、申报表、取数来源" />
            </div>
            <label className="inline-flex h-8 items-center gap-1 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700"><span className="text-slate-400">申报状态</span><select aria-label="申报状态筛选" value={declarationStatusFilter} onChange={(event) => setDeclarationStatusFilter(event.target.value)} className="bg-transparent outline-none"><option>全部</option><option>未申报</option><option>待申报</option><option>已申报</option></select></label>
            <label className="inline-flex h-8 items-center gap-1 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700"><span className="text-slate-400">校验状态</span><select aria-label="校验状态筛选" value={validationStatusFilter} onChange={(event) => setValidationStatusFilter(event.target.value)} className="bg-transparent outline-none"><option>全部</option><option>待确认</option><option>校验通过</option><option>需复核</option></select></label>
          </div>
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <ToolbarButton icon={<Upload className="h-3.5 w-3.5" />} label="导入初始化" onClick={importInitialization} />
            <ToolbarButton icon={<FileSpreadsheet className="h-3.5 w-3.5" />} label="下载模板" onClick={downloadTaxTemplate} />
            <ToolbarButton icon={<FileCheck2 className="h-3.5 w-3.5" />} label={`批量确认${selectedDeclarationRows.length ? ` (${selectedDeclarationRows.length})` : ''}`} onClick={confirmSelectedDeclarations} />
            <ToolbarButton icon={<Settings2 className="h-3.5 w-3.5" />} label="规则与日志" onClick={() => setShowRulesLog((value) => !value)} />
            <ToolbarButton icon={<Settings2 className="h-3.5 w-3.5" />} label="列设置" onClick={openColumnSettings} />
          </div>
        </div>
      </div>

      {showRulesLog && <TaxRulesLogPanel riskRows={visibleRiskRows} logs={visibleRuleLogs} onRiskLink={handleRiskLink} />}

      <input ref={taxInitializationInputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={handleTaxInitializationFile} />

      {pendingDeclarationConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-label="确认本地申报事项">
          <section className="w-full max-w-lg border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950">
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">确认本地申报事项</h2>
              <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                将 {pendingDeclarationConfirmation.rows.length} 个税种标记为本地人工确认。不会向电子税务局提交申报或发起扣款。
              </p>
            </div>
            <div className="space-y-2 px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 leading-5 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
                确认前会重新校验风险、资料和取数状态；存在阻断项时仅写入待审批审计记录，不会完成本地确认。
              </div>
              <div>操作范围：{pendingDeclarationConfirmation.rows.map((row) => row.category).join('、')}</div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
              <button type="button" onClick={() => setPendingDeclarationConfirmation(null)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700 dark:border-slate-600 dark:text-slate-200">取消</button>
              <button type="button" onClick={() => { void confirmDeclaration(pendingDeclarationConfirmation.rows, pendingDeclarationConfirmation.action).finally(() => setPendingDeclarationConfirmation(null)) }} className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">确认本地申报</button>
            </div>
          </section>
        </div>
      )}

      {showColumnSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="申报清单列设置">
          <div className="w-full max-w-xl border border-slate-300 bg-white shadow-xl">
            <div className="flex min-h-11 items-center justify-between border-b border-slate-200 px-4 py-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">申报清单列设置</h2>
                <p className="mt-0.5 text-xs text-slate-500">仅保存当前用户、当前账套的本机显示偏好，不影响申报取数、导出或其他用户。</p>
              </div>
              <button type="button" onClick={() => setShowColumnSettings(false)} className="text-xs text-slate-500 hover:text-slate-900">取消</button>
            </div>
            <div className="space-y-4 p-4">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setTaxColumnSettingsDraft((settings) => ({ ...settings, visibleKeys: taxDeclarationColumns.map((column) => column.key) }))} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">显示全部</button>
                <button type="button" onClick={() => setTaxColumnSettingsDraft((settings) => ({ ...settings, visibleKeys: ['category', 'form', 'period', 'declareStatus', 'payable'] }))} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">仅保留关键列</button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {taxDeclarationColumns.map((column) => (
                  <label key={column.key} className="flex h-9 items-center gap-2 border border-slate-200 px-3 text-xs text-slate-700">
                    <input type="checkbox" checked={taxColumnSettingsDraft.visibleKeys.includes(column.key)} onChange={(event) => toggleTaxColumn(column.key, event.target.checked)} />
                    {column.label}
                  </label>
                ))}
              </div>
              <div className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs text-slate-600">列宽密度
                  <select value={taxColumnSettingsDraft.density} onChange={(event) => setTaxColumnSettingsDraft((settings) => ({ ...settings, density: event.target.value === 'compact' ? 'compact' : 'standard' }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">
                    <option value="standard">标准列宽</option>
                    <option value="compact">紧凑列宽</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 self-end pb-2 text-xs text-slate-700">
                  <input type="checkbox" checked={taxColumnSettingsDraft.freezeKeyColumns} onChange={(event) => setTaxColumnSettingsDraft((settings) => ({ ...settings, freezeKeyColumns: event.target.checked }))} />
                  冻结选择列与税种
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button type="button" onClick={() => setTaxColumnSettingsDraft(defaultTaxColumnSettings())} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">恢复默认</button>
              <button type="button" onClick={() => setShowColumnSettings(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button>
              <button type="button" onClick={saveColumnSettings} className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white">保存设置</button>
            </div>
          </div>
        </div>
      )}

      {showTaxInitializationImportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="导入税务申报初始化模板">
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col border border-slate-300 bg-white shadow-xl">
            <div className="flex min-h-11 items-center justify-between border-b border-slate-200 px-4 py-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">导入税务申报初始化模板</h2>
                <p className="mt-0.5 text-xs text-slate-500">{taxInitializationImportFileName}，先校验预览，确认后才写入当前账套的本地申报事项。</p>
              </div>
              <button type="button" onClick={() => setShowTaxInitializationImportDialog(false)} className="text-xs text-slate-500 hover:text-slate-900">取消</button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {taxInitializationImportErrors.length > 0 && (
                <div className="mb-3 border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <div className="font-medium">发现 {taxInitializationImportErrors.length} 项模板校验错误</div>
                  <ul className="mt-1 list-disc space-y-1 pl-4">{taxInitializationImportErrors.map((error) => <li key={error}>{error}</li>)}</ul>
                </div>
              )}
              <div className="mb-2 text-xs text-slate-500">待写入 {taxInitializationImportPreview.length} 条，仅支持当前账期 {currentPeriod}；风险项会以待复核本地事项保存。</div>
              <div className="overflow-x-auto border border-slate-200">
                <table className="min-w-[980px] w-full border-collapse text-left text-xs">
                  <thead className="bg-[#eef3f8] text-slate-600"><tr><th className="px-2 py-2">行号</th><th className="px-2 py-2">税种</th><th className="px-2 py-2">申报表</th><th className="px-2 py-2">取数状态</th><th className="px-2 py-2">校验状态</th><th className="px-2 py-2 text-right">计税依据</th><th className="px-2 py-2 text-right">抵扣/减免</th><th className="px-2 py-2 text-right">应缴金额</th><th className="px-2 py-2">风险</th></tr></thead>
                  <tbody>{taxInitializationImportPreview.map((item) => <tr key={`${item.rowNumber}-${item.taxType}`}><td className="border-t border-slate-100 px-2 py-2 text-slate-500">{item.rowNumber}</td><td className="border-t border-slate-100 px-2 py-2 font-medium">{item.taxType}</td><td className="border-t border-slate-100 px-2 py-2">{item.formName}</td><td className="border-t border-slate-100 px-2 py-2">{item.collectStatus}</td><td className="border-t border-slate-100 px-2 py-2">{item.validationStatus}</td><td className="border-t border-slate-100 px-2 py-2 text-right font-mono">{formatTaxNumber(item.taxableAmount)}</td><td className="border-t border-slate-100 px-2 py-2 text-right font-mono">{formatTaxNumber(item.deductionAmount)}</td><td className="border-t border-slate-100 px-2 py-2 text-right font-mono">{formatTaxNumber(item.payableAmount)}</td><td className="border-t border-slate-100 px-2 py-2">{item.riskCount > 0 ? '待复核' : '无'}</td></tr>)}</tbody>
                </table>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">安全边界：导入只写入本地税种认定、取数和校验参数，不会向税局提交申报、发起扣款或保存税局密码。</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button type="button" onClick={() => setShowTaxInitializationImportDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button>
              <button type="button" disabled={taxInitializationImportPreview.length === 0 || taxInitializationImportErrors.length > 0} onClick={() => void confirmTaxInitializationImport()} className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300">确认写入本地申报事项</button>
            </div>
          </div>
        </div>
      )}

      {showDeclarationDetailDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="编辑本地申报事项">
          <form onSubmit={saveDeclarationDetail} className="w-full max-w-2xl border border-slate-300 bg-white shadow-xl">
            <div className="flex min-h-11 items-center justify-between border-b border-slate-200 px-4 py-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">本地申报事项明细</h2>
                <p className="mt-0.5 text-xs text-slate-500">仅维护取数、校验和风险状态，不会向税局提交申报或发起扣款。</p>
              </div>
              <button type="button" onClick={() => setShowDeclarationDetailDialog(false)} className="text-xs text-slate-500 hover:text-slate-900">取消</button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-slate-600">税种
                <input disabled value={declarationDraft.category} className="h-8 rounded border border-slate-300 bg-slate-100 px-2 text-sm text-slate-700" />
              </label>
              <label className="grid gap-1 text-xs text-slate-600">申报表
                <input disabled value={declarationDraft.form} className="h-8 rounded border border-slate-300 bg-slate-100 px-2 text-sm text-slate-700" />
              </label>
              <label className="grid gap-1 text-xs text-slate-600">所属期
                <input disabled value={declarationDraft.period} className="h-8 rounded border border-slate-300 bg-slate-100 px-2 text-sm text-slate-700" />
              </label>
              <label className="grid gap-1 text-xs text-slate-600">取数状态
                <select value={declarationDraft.collectStatus} onChange={(event) => setDeclarationDraft((draft) => ({ ...draft, collectStatus: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  <option value="已取数">已取数</option><option value="待补资料">待补资料</option><option value="未取数">未取数</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">取数依据/人工复核说明
                <input value={declarationDraft.source} onChange={(event) => setDeclarationDraft((draft) => ({ ...draft, source: event.target.value }))} placeholder="例如：发票、工资表、合同台账已人工核验" className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="grid gap-1 text-xs text-slate-600">计税依据（元）
                <input min="0" step="0.01" type="number" value={declarationDraft.taxableAmount} onChange={(event) => setDeclarationDraft((draft) => ({ ...draft, taxableAmount: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="grid gap-1 text-xs text-slate-600">抵扣/减免（元）
                <input min="0" step="0.01" type="number" value={declarationDraft.deductionAmount} onChange={(event) => setDeclarationDraft((draft) => ({ ...draft, deductionAmount: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="grid gap-1 text-xs text-slate-600">应缴金额（元）
                <input min="0" step="0.01" type="number" value={declarationDraft.payableAmount} onChange={(event) => setDeclarationDraft((draft) => ({ ...draft, payableAmount: event.target.value }))} className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="grid gap-1 text-xs text-slate-600">校验状态
                <select value={declarationDraft.validationStatus} onChange={(event) => setDeclarationDraft((draft) => ({ ...draft, validationStatus: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  <option value="待确认">待确认</option><option value="校验通过">校验通过</option><option value="需复核">需复核</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs text-slate-600">风险项
                <select value={declarationDraft.riskCount} onChange={(event) => setDeclarationDraft((draft) => ({ ...draft, riskCount: event.target.value }))} className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  <option value="0">无</option><option value="1">1 项待处理</option><option value="2">2 项待处理</option><option value="3">3 项待处理</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3"><button type="button" onClick={() => setShowDeclarationDetailDialog(false)} className="h-8 rounded border border-slate-300 px-3 text-xs text-slate-700">取消</button><button type="submit" className="h-8 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white">保存本地事项</button></div>
          </form>
        </div>
      )}

      <div className="min-w-0 pt-3">
        <section className="min-w-0 border border-slate-200 bg-white">
          <div className="flex h-9 items-center justify-between border-b border-slate-200 bg-[#f8fafc] px-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FileCheck2 className="h-4 w-4 text-[#1f65a7]" />
              本期申报清单
            </div>
            <div className="text-xs text-slate-500">显示 {filteredDeclarationRows.length} / {visibleDeclarationRows.length} 条，金额单位: 元</div>
          </div>
          <div className="max-w-full overflow-x-auto">
            <table className={cn('w-full border-collapse text-left text-xs', taxColumnSettings.density === 'compact' ? 'min-w-[980px]' : 'min-w-[1240px]')}>
              <thead className="bg-[#eef3f8] text-slate-600">
                <tr>
                  <th className={cn('w-9 border-b border-slate-200 px-2 py-2', taxColumnSettings.freezeKeyColumns && 'sticky left-0 z-20 bg-[#eef3f8]')}>
                    <input type="checkbox" aria-label="全选" checked={areAllDeclarationsSelected} onChange={(event) => toggleAllDeclarationSelection(event.target.checked)} />
                  </th>
                  {visibleTaxColumns.map((column) => (
                    <th key={column.key} className={cn('whitespace-nowrap border-b border-slate-200 px-2 py-2', column.align === 'right' && 'text-right', column.key === 'category' && taxColumnSettings.freezeKeyColumns && 'sticky left-9 z-20 bg-[#eef3f8]')}>
                      {column.label}
                    </th>
                  ))}
                  <th className="border-b border-slate-200 px-2 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeclarationRows.map((row) => (
                  <tr key={row.id} className="hover:bg-[#f8fbff]">
                    <td className={cn('border-b border-slate-100 px-2 py-2', taxColumnSettings.freezeKeyColumns && 'sticky left-0 z-10 bg-white')}>
                      <input type="checkbox" aria-label={`选择 ${row.category}`} checked={selectedDeclarationIds.has(row.id)} onChange={(event) => toggleDeclarationSelection(row.id, event.target.checked)} />
                    </td>
                    {visibleTaxColumns.map((column) => (
                      <td key={column.key} className={cn('border-b border-slate-100 px-2 py-2', column.align === 'right' && 'text-right', column.key === 'category' && taxColumnSettings.freezeKeyColumns && 'sticky left-9 z-10 bg-white')}>
                        {column.cell(row)}
                      </td>
                    ))}
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 text-right">
                      <button type="button" onClick={() => viewDeclarationRow(row)} className="mr-2 text-[#1f65a7] hover:underline">查看</button>
                      <button type="button" onClick={() => fetchDeclarationRow(row)} className="text-[#1f65a7] hover:underline">取数</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-[#f8fafc] font-semibold">
                <tr>
                  <td className="px-2 py-2" />
                  {visibleTaxColumns.map((column, index) => (
                    <td key={column.key} className={cn('px-2 py-2', column.align === 'right' && 'text-right font-mono')}>
                      {index === 0 ? '合计' : column.total ? formatTaxNumber(filteredDeclarationRows.reduce((sum, row) => sum + parseMoney(row[column.key] as string), 0)) : ''}
                    </td>
                  ))}
                  <td className="px-2 py-2" />
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
            <div>真实税局提交、扣款、回执收取需要合法 adapter 接入；当前页面只做取数、校验、确认、导出和日志。</div>
            <div>第 1 / 1 页，每页 50 条</div>
          </div>
        </section>
      </div>
    </div>
  )
}

function TaxRulesLogPanel({
  riskRows,
  logs,
  onRiskLink,
}: {
  riskRows: RiskRow[]
  logs: RuleLog[]
  onRiskLink: (module: string, desc: string) => void
}) {
  return (
    <section className="mt-3 border border-slate-200 bg-white">
      <div className="flex h-9 items-center gap-2 border-b border-slate-200 bg-[#f8fafc] px-3 text-sm font-semibold">
        <Settings2 className="h-4 w-4 text-[#1f65a7]" />
        规则与日志
      </div>
      <div className="grid gap-0 lg:grid-cols-3">
        <div className="border-b border-slate-200 lg:border-b-0 lg:border-r">
          <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">风险与阻断</div>
          <div className="divide-y divide-slate-100">
            {riskRows.length === 0 && <div className="p-3 text-xs text-slate-500">当前账期无已落库风险。</div>}
            {riskRows.map(([level, module, desc, link]) => (
              <div key={desc} className="p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className={cn('rounded px-2 py-0.5 font-medium', level === '阻断' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700')}>{level}</span>
                  <button type="button" onClick={() => onRiskLink(module, desc)} className="text-[#1f65a7]">{link}</button>
                </div>
                <div className="mt-2 font-medium text-slate-800">{module}</div>
                <div className="mt-1 leading-5 text-slate-600">{desc}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="border-b border-slate-200 lg:border-b-0 lg:border-r">
          <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">取数说明</div>
          <div className="space-y-2 p-3 text-xs leading-5 text-slate-600">
            <div className="rounded bg-slate-50 p-2">销项税额来自销项发票清单，按税率分组汇总。</div>
            <div className="rounded bg-slate-50 p-2">进项抵扣来自已认证进项发票，未勾选发票不进入申报主表。</div>
            <div className="rounded bg-slate-50 p-2">企业所得税来自利润表和纳税调整快照。</div>
          </div>
        </div>
        <div>
          <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">操作日志</div>
          <div className="divide-y divide-slate-100">
            {logs.length === 0 && <div className="p-3 text-xs text-slate-500">当前账期无本地操作日志。</div>}
            {logs.map(([time, action, detail]) => (
              <div key={`${time}-${action}`} className="p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">{action}</span>
                  <span className="font-mono text-slate-400">{time}</span>
                </div>
                <div className="mt-1 leading-5 text-slate-600">{detail}</div>
              </div>
            ))}
          </div>
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

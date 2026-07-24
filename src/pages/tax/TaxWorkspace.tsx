import {
  ChevronDown,
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
import { useEffect, useMemo, useState } from 'react'
import { cn } from '../../lib/utils'
import { isTauri } from '../../lib/tauri'
import { exportHtmlToPdf } from '../../lib/pdfExport'
import { recordAuditLog, recordExportJob } from '../../lib/exportJobs'
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
    body{font-family:"Noto Sans SC","PingFang SC","Microsoft YaHei",-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:22px;color:#111827}
    h1{text-align:center;font-size:20px;margin:0 0 8px} h2{font-size:15px;margin:18px 0 8px}
    .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:8px 16px;margin:10px 0 14px;font-size:12px;color:#334155}
    .meta span{border-bottom:1px solid #cbd5e1;padding-bottom:5px}
    table{width:100%;border-collapse:collapse;font-size:11px} th,td{border:1px solid #64748b;padding:6px 7px;vertical-align:top}
    th{background:#e8eef6;text-align:left}.num{text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.strong{font-weight:700}
    .notice{margin-top:14px;border:1px solid #cbd5e1;background:#f8fafc;padding:9px;font-size:11px;line-height:1.7;color:#475569}
    .sign{display:flex;justify-content:space-between;margin-top:18px;font-size:12px;color:#334155}
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
  const [operationNotice, setOperationNotice] = useState<string | null>(null)
  const [taxDeclarationTasks, setTaxDeclarationTasks] = useState<TaxDeclarationTask[]>([])
  const [backendTaskCount, setBackendTaskCount] = useState(0)
  const [backendAuditCount, setBackendAuditCount] = useState(0)
  const [operationAuditLogs, setOperationAuditLogs] = useState<OperationAuditLog[]>([])
  const [backendAdapterStatus, setBackendAdapterStatus] = useState('未配置')
  const [selectedDeclarationIds, setSelectedDeclarationIds] = useState<Set<string>>(new Set())

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
  const selectedDeclarationRows = currentRows.filter((row) => selectedDeclarationIds.has(row.id))
  const areAllDeclarationsSelected = currentRows.length > 0 && selectedDeclarationIds.size === currentRows.length
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

  const confirmDeclaration = async (targetRows = currentRows, action = '确认申报') => {
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
    setSelectedDeclarationIds(checked ? new Set(currentRows.map((row) => row.id)) : new Set())
  }

  const confirmSelectedDeclarations = async () => {
    if (selectedDeclarationRows.length === 0) {
      setOperationNotice('请先勾选需要确认的申报事项。')
      return
    }
    if (!window.confirm(`确认将已勾选的 ${selectedDeclarationRows.length} 个税种写入本地申报确认吗？不会向税局提交或发起扣款。`)) return
    await confirmDeclaration(selectedDeclarationRows, '批量确认申报')
  }

  const importInitialization = () => {
    void automationApi.upsertAdapterAuthorization({
      companyId,
      adapterType: 'tax',
      adapterCode: 'local-preview',
      region: '上海',
      authStatus: 'pending',
      accountMask: '未保存明文账号',
      loginIdentity: '办税员/代理记账授权',
      capabilityScope: '税种取数/申报包生成/回执归档',
      riskMessage: '当前仅维护授权状态，不保存密码，不执行真实提交',
    }).then((response) => {
      if (response.success) setBackendAdapterStatus(response.data?.authStatus ?? 'pending')
    })
    writeTaxAudit({
      action: '导入初始化',
      object: '税种认定/期初留抵/申报参数',
      level: '中',
      result: '待审批',
      status: '待确认',
      attachment: '初始化导入批次',
    })
    setOperationNotice('导入初始化已进入待确认留痕；后续会接入模板校验、字段映射和回滚清单。')
  }

  const downloadTaxTemplate = () => {
    writeTaxAudit({
      action: '下载模板',
      object: '税务申报初始化模板',
      level: '普通',
      result: '成功',
      status: '已通过',
      attachment: '模板版本',
    })
    recordExportJob({
      fileName: `税务申报初始化模板-${currentPeriod}.xlsx`,
      moduleName: '税务申报工作台',
      format: 'Excel模板',
      scope: `${currentPeriod}/初始化`,
      templateKind: 'tax',
      rowCount: 0,
    })
    setOperationNotice('税务申报初始化模板已写入下载中心；正式模板会继续绑定税种、地区和申报口径校验。')
  }

  const openColumnSettings = () => {
    writeTaxAudit({
      action: '列设置',
      object: '申报清单显示列',
      level: '普通',
      result: '成功',
      status: '已通过',
      attachment: '页面配置',
    })
    setOperationNotice('列设置已记录；后续会接入用户级列宽、冻结列和显示字段保存。')
  }

  const viewDeclarationRow = (row: DeclarationRow) => {
    writeTaxAudit({
      action: '查看申报明细',
      object: `${row.category}-${row.period}`,
      level: '普通',
      result: '成功',
      status: '已通过',
      attachment: row.form,
    })
    setOperationNotice(`${row.category} 明细已打开留痕；后续会接入申报表主表、附表、取数公式和附件快照。`)
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
    if (!printWindow) return
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
              onClick={() => void confirmDeclaration()}
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
              <input className="h-8 w-full rounded border border-slate-300 bg-white pl-8 pr-3 text-xs outline-none focus:border-[#1f65a7] sm:w-72" placeholder="搜索税种、申报表、取数来源" />
            </div>
            <SelectLike label="申报状态" value="全部" />
            <SelectLike label="校验状态" value="全部" />
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

      <div className="min-w-0 pt-3">
        <section className="min-w-0 border border-slate-200 bg-white">
          <div className="flex h-9 items-center justify-between border-b border-slate-200 bg-[#f8fafc] px-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FileCheck2 className="h-4 w-4 text-[#1f65a7]" />
              本期申报清单
            </div>
            <div className="text-xs text-slate-500">显示 {visibleDeclarationRows.length} 条，金额单位: 元</div>
          </div>
          <div className="max-w-full overflow-x-auto">
            <table className="min-w-[1240px] w-full border-collapse text-left text-xs">
              <thead className="bg-[#eef3f8] text-slate-600">
                <tr>
                  <th className="w-9 border-b border-slate-200 px-2 py-2">
                    <input type="checkbox" aria-label="全选" checked={areAllDeclarationsSelected} onChange={(event) => toggleAllDeclarationSelection(event.target.checked)} />
                  </th>
                  <th className="border-b border-slate-200 px-2 py-2">税种</th>
                  <th className="border-b border-slate-200 px-2 py-2">申报表</th>
                  <th className="border-b border-slate-200 px-2 py-2">所属期</th>
                  <th className="border-b border-slate-200 px-2 py-2">取数状态</th>
                  <th className="border-b border-slate-200 px-2 py-2">校验状态</th>
                  <th className="border-b border-slate-200 px-2 py-2">申报状态</th>
                  <th className="border-b border-slate-200 px-2 py-2">取数来源</th>
                  <th className="border-b border-slate-200 px-2 py-2 text-right">计税依据</th>
                  <th className="border-b border-slate-200 px-2 py-2 text-right">抵扣/减免</th>
                  <th className="border-b border-slate-200 px-2 py-2 text-right">应缴金额</th>
                  <th className="border-b border-slate-200 px-2 py-2">风险</th>
                  <th className="border-b border-slate-200 px-2 py-2">负责人</th>
                  <th className="border-b border-slate-200 px-2 py-2">更新时间</th>
                  <th className="border-b border-slate-200 px-2 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {visibleDeclarationRows.map((row) => (
                  <tr key={row.id} className="hover:bg-[#f8fbff]">
                    <td className="border-b border-slate-100 px-2 py-2">
                      <input type="checkbox" aria-label={`选择 ${row.category}`} checked={selectedDeclarationIds.has(row.id)} onChange={(event) => toggleDeclarationSelection(row.id, event.target.checked)} />
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 font-medium text-slate-900">{row.category}</td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 text-slate-700">{row.form}</td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 text-slate-600">{row.period}</td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2">{statusBadge(row.collectStatus)}</td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2">{statusBadge(row.checkStatus)}</td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2">{statusBadge(row.declareStatus)}</td>
                    <td className="max-w-[260px] truncate border-b border-slate-100 px-2 py-2 text-slate-600">{row.source}</td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 text-right font-mono text-slate-700">{row.sales}</td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 text-right font-mono text-slate-700">{row.deduction}</td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 text-right font-mono font-semibold text-slate-900">{row.payable}</td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2">{riskBadge(row.risk)}</td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 text-slate-600">{row.owner}</td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 text-slate-500">{row.updated}</td>
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
                  <td className="px-2 py-2" colSpan={8}>合计</td>
                  <td className="px-2 py-2 text-right font-mono">{formatTaxNumber(visibleDeclarationRows.reduce((sum, row) => sum + parseMoney(row.deduction), 0))}</td>
                  <td className="px-2 py-2 text-right font-mono">{formatTaxNumber(declarationMetrics.payable)}</td>
                  <td className="px-2 py-2" colSpan={4} />
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

function SelectLike({ label, value }: { label: string; value: string }) {
  return (
    <button type="button" className="inline-flex h-8 items-center gap-2 rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-700 hover:border-[#1f65a7]">
      <span className="text-slate-400">{label}</span>
      <span>{value}</span>
      <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
    </button>
  )
}

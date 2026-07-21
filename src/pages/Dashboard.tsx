import { Link } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Bot,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileBarChart,
  FileCheck2,
  FileText,
  ReceiptText,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react'
import { recordAuditLog } from '../lib/exportJobs'
import { automationApi, type AutomationJob, type TaxDeclarationTask } from '../lib/api'
import { isTauri } from '../lib/tauri'
import { useCompanyStore } from '../stores/companyStore'
import { useInvoiceStore } from '../stores/invoiceStore'
import { usePeriodStore } from '../stores/periodStore'
import { useVoucherStore } from '../stores/voucherStore'

type DashboardCard = {
  label: string
  value: string
  sub: string
  icon: LucideIcon
  path: string
}

type DashboardTodo = {
  module: string
  text: string
  due: string
  path: string
}

type DashboardProgress = {
  name: string
  percent: number
  description: string
}

const browserStatusCards: DashboardCard[] = [
  { label: '销项发票', value: '58', sub: '已匹配 46 / 异常 2', icon: ReceiptText, path: '/invoices/output' },
  { label: '进项发票', value: '72', sub: '待确认 18 / 可抵扣 4.28万', icon: FileCheck2, path: '/invoices/input' },
  { label: '银行账单', value: '96', sub: '待生成凭证 21', icon: Banknote, path: '/bills' },
  { label: '会计凭证', value: '82', sub: '待审核 9 / 已审核 73', icon: FileText, path: '/vouchers' },
  { label: 'AI任务', value: '19', sub: '待确认草稿 12', icon: Bot, path: '/ai' },
  { label: '税务申报', value: '5', sub: '待确认 3 / 风险 1', icon: FileBarChart, path: '/tax/workspace' },
]

const browserTodoRows: DashboardTodo[] = [
  { module: '进项发票', text: '18 张进项发票待确认抵扣用途', due: '今天', path: '/invoices/input' },
  { module: '银行流水', text: '21 笔流水未匹配凭证规则', due: '今天', path: '/bills' },
  { module: '风险检查', text: '凭证、税率、工资社保存在 5 条需复核事项', due: '结账前', path: '/risk-check' },
  { module: '申报取数', text: '增值税及附加申报表待人工确认', due: '06-24', path: '/tax/workspace' },
]

const browserProgress: DashboardProgress[] = [
  { name: '资料采集', percent: 82, description: '发票、流水、工资、社保资料' },
  { name: 'AI识别', percent: 68, description: 'OCR、流水分类、规则建议' },
  { name: '凭证生成', percent: 74, description: '草稿、审核、附件追溯' },
  { name: '报表申报', percent: 55, description: '报表重算、税表取数、申报确认' },
]

function percentOf(completed: number, total: number) {
  return total > 0 ? Math.round((completed / total) * 100) : 0
}

function automationIsCompleted(job: AutomationJob) {
  return ['completed', 'confirmed'].includes(job.status.toLowerCase())
}

function automationNeedsReview(job: AutomationJob) {
  return ['queued', 'running', 'review', 'needs_review', 'awaiting_confirmation'].includes(job.status.toLowerCase())
}

function taxTaskStatus(task: TaxDeclarationTask) {
  if (task.declarationStatus === 'confirmed' || task.declarationStatus === 'submitted') return '已确认'
  if (task.validationStatus === 'passed') return '校验通过'
  if (task.riskCount > 0) return '需复核'
  return '待取数'
}

export function Dashboard() {
  const [operationNotice, setOperationNotice] = useState<string | null>(null)
  const [taxTasks, setTaxTasks] = useState<TaxDeclarationTask[]>([])
  const [automationJobs, setAutomationJobs] = useState<AutomationJob[]>([])
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId)
  const companies = useCompanyStore((state) => state.companies)
  const selectedCompany = useMemo(() => companies.find((company) => company.id === selectedCompanyId), [companies, selectedCompanyId])
  const invoices = useInvoiceStore((state) => state.invoices)
  const fetchInvoices = useInvoiceStore((state) => state.fetchInvoices)
  const vouchers = useVoucherStore((state) => state.vouchers)
  const queryVouchers = useVoucherStore((state) => state.queryVouchers)
  const periods = usePeriodStore((state) => state.periods)
  const currentPeriodId = usePeriodStore((state) => state.currentPeriodId)
  const fetchPeriods = usePeriodStore((state) => state.fetchPeriods)
  const currentPeriod = useMemo(() => periods.find((period) => period.id === currentPeriodId), [currentPeriodId, periods])
  const currentPeriodLabel = currentPeriod
    ? `${currentPeriod.period_year}-${String(currentPeriod.period_month).padStart(2, '0')}`
    : ''
  const usesLiveDashboardData = Boolean(isTauri && selectedCompanyId && currentPeriodId)

  const reloadDashboardData = useCallback(async () => {
    if (!isTauri || !selectedCompanyId) return
    if (!currentPeriodId) {
      await fetchPeriods(selectedCompanyId)
      return
    }

    const [taxResult, jobsResult] = await Promise.all([
      automationApi.getTaxDeclarationTasks({ companyId: selectedCompanyId, period: currentPeriodLabel }),
      automationApi.getAutomationJobs({ companyId: selectedCompanyId, period: currentPeriodLabel }),
      fetchInvoices({ company_id: selectedCompanyId, period_id: currentPeriodId }),
      queryVouchers({ company_id: selectedCompanyId, period_id: currentPeriodId, page: 1, page_size: 100 }),
    ])
    setTaxTasks(taxResult.success ? taxResult.data ?? [] : [])
    setAutomationJobs(jobsResult.success ? jobsResult.data ?? [] : [])
  }, [currentPeriodId, currentPeriodLabel, fetchInvoices, fetchPeriods, queryVouchers, selectedCompanyId])

  useEffect(() => {
    void reloadDashboardData()
  }, [reloadDashboardData])

  const outputInvoices = useMemo(() => invoices.filter((invoice) => invoice.invoice_type === 'output'), [invoices])
  const inputInvoices = useMemo(() => invoices.filter((invoice) => invoice.invoice_type === 'input'), [invoices])
  const matchedInvoices = useMemo(() => invoices.filter((invoice) => Boolean(invoice.voucher_id) || invoice.status === 'matched'), [invoices])
  const pendingVouchers = useMemo(() => vouchers.filter((voucher) => !['approved', 'posted'].includes(voucher.status.toLowerCase())), [vouchers])
  const unbalancedVouchers = useMemo(() => vouchers.filter((voucher) => voucher.total_debit !== voucher.total_credit), [vouchers])
  const pendingAutomationJobs = useMemo(() => automationJobs.filter(automationNeedsReview), [automationJobs])
  const completedAutomationJobs = useMemo(() => automationJobs.filter(automationIsCompleted), [automationJobs])
  const pendingTaxTasks = useMemo(() => taxTasks.filter((task) => taxTaskStatus(task) !== '已确认'), [taxTasks])

  const statusCards = useMemo<DashboardCard[]>(() => {
    if (!usesLiveDashboardData) return browserStatusCards
    return [
      { label: '销项发票', value: `${outputInvoices.length} 张`, sub: `已匹配 ${outputInvoices.filter((invoice) => invoice.voucher_id || invoice.status === 'matched').length} 张`, icon: ReceiptText, path: '/invoices/output' },
      { label: '进项发票', value: `${inputInvoices.length} 张`, sub: `未匹配 ${inputInvoices.filter((invoice) => !invoice.voucher_id && invoice.status !== 'matched').length} 张`, icon: FileCheck2, path: '/invoices/input' },
      { label: '银行账单', value: `${automationJobs.filter((job) => job.jobType === 'bank_collection').length} 项`, sub: `待处理 ${automationJobs.filter((job) => job.jobType === 'bank_collection' && automationNeedsReview(job)).length} 项`, icon: Banknote, path: '/bills' },
      { label: '会计凭证', value: `${vouchers.length} 张`, sub: `待审核 ${pendingVouchers.length} 张`, icon: FileText, path: '/vouchers' },
      { label: 'AI任务', value: `${automationJobs.length} 项`, sub: `待确认 ${pendingAutomationJobs.length} 项`, icon: Bot, path: '/ai' },
      { label: '税务申报', value: `${taxTasks.length} 项`, sub: `待确认 ${pendingTaxTasks.length} 项 / 风险 ${taxTasks.reduce((total, task) => total + task.riskCount, 0)} 项`, icon: FileBarChart, path: '/tax/workspace' },
    ]
  }, [automationJobs, inputInvoices, outputInvoices, pendingAutomationJobs.length, pendingTaxTasks.length, pendingVouchers.length, taxTasks, usesLiveDashboardData, vouchers.length])

  const todoRows = useMemo<DashboardTodo[]>(() => {
    if (!usesLiveDashboardData) return browserTodoRows
    const rows: DashboardTodo[] = []
    const pendingInputs = inputInvoices.filter((invoice) => !invoice.voucher_id && invoice.status !== 'matched').length
    if (pendingInputs > 0) rows.push({ module: '进项发票', text: `${pendingInputs} 张进项发票尚未匹配凭证`, due: '本期', path: '/invoices/input' })
    if (pendingAutomationJobs.length > 0) rows.push({ module: 'AI做账', text: `${pendingAutomationJobs.length} 项本地 AI 任务等待人工确认`, due: '本期', path: '/ai' })
    if (pendingVouchers.length > 0) rows.push({ module: '会计凭证', text: `${pendingVouchers.length} 张凭证尚未审核或过账`, due: '结账前', path: '/vouchers' })
    if (pendingTaxTasks.length > 0) rows.push({ module: '税务申报', text: `${pendingTaxTasks.length} 项税务任务尚未确认`, due: '本期', path: '/tax/workspace' })
    return rows
  }, [inputInvoices, pendingAutomationJobs.length, pendingTaxTasks.length, pendingVouchers.length, usesLiveDashboardData])

  const progress = useMemo<DashboardProgress[]>(() => {
    if (!usesLiveDashboardData) return browserProgress
    const invoiceTotal = invoices.length
    const recognized = automationJobs.filter((job) => job.jobType === 'document_ocr')
    return [
      { name: '资料采集', percent: percentOf(matchedInvoices.length, invoiceTotal), description: `发票已匹配 ${matchedInvoices.length}/${invoiceTotal}` },
      { name: 'AI识别', percent: percentOf(recognized.filter(automationIsCompleted).length, recognized.length), description: `OCR 任务已完成 ${recognized.filter(automationIsCompleted).length}/${recognized.length}` },
      { name: '凭证生成', percent: percentOf(vouchers.length - pendingVouchers.length, vouchers.length), description: `已审核或过账 ${vouchers.length - pendingVouchers.length}/${vouchers.length}` },
      { name: '报表申报', percent: percentOf(taxTasks.filter((task) => taxTaskStatus(task) === '已确认').length, taxTasks.length), description: `税务任务已确认 ${taxTasks.filter((task) => taxTaskStatus(task) === '已确认').length}/${taxTasks.length}` },
    ]
  }, [automationJobs, invoices.length, matchedInvoices.length, pendingVouchers.length, taxTasks, usesLiveDashboardData, vouchers.length])

  const taxCalendarRows = useMemo(() => {
    if (!usesLiveDashboardData) return [
      { period: '截止 06-24', name: '增值税及附加', status: '待确认' },
      { period: '截止 06-25', name: '扣缴所得税', status: '待取数' },
      { period: '截止 06-28', name: '社保费', status: '校验通过' },
    ]
    return taxTasks.slice(0, 3).map((task) => ({ period: `所属期 ${task.period}`, name: task.taxType, status: taxTaskStatus(task) }))
  }, [taxTasks, usesLiveDashboardData])

  const risks = useMemo(() => {
    if (!usesLiveDashboardData) return [
      { tone: 'red', icon: AlertTriangle, text: '1 张凭证借贷不平，阻断结账。' },
      { tone: 'amber', icon: ClipboardList, text: '2 张进项发票税率与商品分类不一致。' },
      { tone: 'green', icon: CheckCircle2, text: '工资表人数与社保人数校验通过。' },
    ]
    const rows: Array<{ tone: 'red' | 'amber' | 'green'; icon: LucideIcon; text: string }> = []
    if (unbalancedVouchers.length > 0) rows.push({ tone: 'red', icon: AlertTriangle, text: `${unbalancedVouchers.length} 张凭证借贷不平，阻断结账。` })
    const unmatchedInputs = inputInvoices.filter((invoice) => !invoice.voucher_id && invoice.status !== 'matched').length
    if (unmatchedInputs > 0) rows.push({ tone: 'amber', icon: ClipboardList, text: `${unmatchedInputs} 张进项发票尚未匹配凭证。` })
    const taxRisk = taxTasks.reduce((total, task) => total + task.riskCount, 0)
    if (taxRisk > 0) rows.push({ tone: 'amber', icon: ClipboardList, text: `${taxRisk} 项税务任务需要人工复核。` })
    if (rows.length === 0) rows.push({ tone: 'green', icon: CheckCircle2, text: invoices.length + vouchers.length + taxTasks.length + automationJobs.length > 0 ? '当前已落库数据未发现阻断风险。' : '当前账期尚无已落库的风险检查数据。' })
    return rows
  }, [automationJobs.length, inputInvoices, invoices.length, taxTasks, unbalancedVouchers.length, usesLiveDashboardData, vouchers.length])

  const handleRefreshProgress = () => {
    recordAuditLog({
      module: '账套工作台',
      action: '刷新业务处理进度',
      object: `${currentPeriodLabel || '未选择账期'}主链路看板`,
      level: '普通',
      result: '成功',
      status: '已通过',
      voucher: `${currentPeriodLabel || '未选择账期'}/工作台`,
      attachment: '进度快照',
    })
    void reloadDashboardData()
    setOperationNotice('已重新读取当前账套的本地发票、凭证、AI 队列和税务任务。')
  }

  const headline = usesLiveDashboardData
    ? `${selectedCompany?.name || '当前账套'} · ${currentPeriodLabel} 账期，集中处理资料、AI 做账、凭证、报表、结账和申报。`
    : '浏览器预览展示布局样例；桌面端将按当前账套和账期读取本地数据。'

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">账套工作台</h1>
          <p className="mt-1 text-sm text-slate-500">{headline}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/ai" className="inline-flex h-9 items-center gap-2 rounded border border-[#1f65a7] bg-white px-3 text-sm font-medium text-[#1f65a7] hover:bg-[#eef6ff]">
            <Bot className="h-4 w-4" />
            AI做账
          </Link>
          <Link to="/tax/workspace" className="inline-flex h-9 items-center gap-2 rounded bg-[#1f65a7] px-3 text-sm font-medium text-white hover:bg-[#174f82]">
            <FileCheck2 className="h-4 w-4" />
            申报工作台
          </Link>
        </div>
      </div>

      {operationNotice && <div className="border border-amber-200 bg-amber-50 px-4 py-2 text-xs leading-5 text-amber-800">{operationNotice}</div>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        {statusCards.map((item) => (
          <Link key={item.label} to={item.path} className="rounded border border-slate-200 bg-white p-3 hover:border-[#2d6fa8] hover:bg-[#f8fbff]">
            <div className="flex items-center justify-between"><span className="text-xs text-slate-500">{item.label}</span><item.icon className="h-4 w-4 text-[#2d6fa8]" /></div>
            <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{item.value}</div>
            <div className="mt-1 truncate text-xs text-slate-500">{item.sub}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <section className="rounded border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div><h2 className="font-semibold text-slate-900">业务处理进度</h2><p className="text-xs text-slate-500">按当前账套本地数据汇总采集、识别、凭证和申报主链路。</p></div>
            <button type="button" onClick={handleRefreshProgress} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"><RefreshCw className="h-3.5 w-3.5" />刷新</button>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2">
            {progress.map((item) => (
              <div key={item.name} className="rounded border border-slate-200 p-3">
                <div className="flex items-center justify-between text-sm"><span className="font-medium text-slate-900">{item.name}</span><span className="font-semibold text-[#1f65a7]">{item.percent}%</span></div>
                <div className="mt-2 h-2 rounded bg-slate-100"><div className="h-2 rounded bg-[#2d6fa8]" style={{ width: `${item.percent}%` }} /></div>
                <div className="mt-2 text-xs text-slate-500">{item.description}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-900">税务日历</div>
          <div className="space-y-2 p-4">
            {taxCalendarRows.length === 0 ? <div className="rounded bg-slate-50 px-3 py-4 text-xs text-slate-500">当前账期暂无已落库税务任务。</div> : taxCalendarRows.map((item) => (
              <div key={`${item.name}-${item.period}`} className="flex items-center justify-between rounded bg-slate-50 px-3 py-2">
                <div className="flex items-center gap-3"><CalendarDays className="h-4 w-4 text-[#2d6fa8]" /><div><div className="text-sm font-medium">{item.name}</div><div className="text-xs text-slate-500">{item.period}</div></div></div>
                <span className="rounded bg-white px-2 py-1 text-xs text-slate-600">{item.status}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <section className="rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-900">待办事项</div>
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="bg-[#f3f7fb] text-xs font-semibold text-slate-600"><tr><th className="px-4 py-3">模块</th><th className="px-4 py-3">事项</th><th className="px-4 py-3">期限</th><th className="px-4 py-3 text-right">操作</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {todoRows.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">当前账期暂无待处理的本地任务。</td></tr> : todoRows.map((item) => (
                  <tr key={`${item.module}-${item.text}`} className="hover:bg-[#f8fbff]"><td className="px-4 py-3 font-medium">{item.module}</td><td className="px-4 py-3 text-slate-600">{item.text}</td><td className="px-4 py-3 text-slate-500">{item.due}</td><td className="px-4 py-3 text-right"><Link to={item.path} className="inline-flex items-center gap-1 text-[#1f65a7]">处理<ArrowRight className="h-4 w-4" /></Link></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-900">风险提示</div>
          <div className="space-y-3 p-4 text-sm">
            {risks.map((risk) => <div key={risk.text} className={`flex gap-2 rounded border p-3 ${risk.tone === 'red' ? 'border-red-100 bg-red-50 text-red-700' : risk.tone === 'amber' ? 'border-amber-100 bg-amber-50 text-amber-700' : 'border-green-100 bg-green-50 text-green-700'}`}><risk.icon className="mt-0.5 h-4 w-4 shrink-0" /><span>{risk.text}</span></div>)}
          </div>
        </section>
      </div>
    </div>
  )
}

import { Activity, CircleAlert, FileBarChart2, Landmark, RefreshCw, Scale, TrendingUp, WalletCards } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { OperationalExportActions } from '../../components/operations/OperationalExportActions'
import { buildOperatingPerformance, buildOperatingStatus } from '../../lib/operatingReportWorkflow.js'
import { useCompanyStore } from '../../stores/companyStore'
import { usePeriodStore, type BalanceSheetResult, type IncomeStatementResult } from '../../stores/periodStore'

type OperatingView = 'status' | 'performance'
type StatusRow = { code: string; name: string; opening: number; ending: number; change: number; share: number; kind: string }
type PerformanceRow = { code: string; name: string; current: number; yearToDate: number; share: number; total: boolean }
type StatusReport = { metrics: { totalAssets: number; totalLiabilities: number; totalEquity: number; workingCapital: number; currentRatio: number; debtRatio: number; assetGrowth: number; balanced: boolean }; rows: StatusRow[] }
type PerformanceReport = { metrics: { revenue: number; cost: number; grossProfit: number; grossMargin: number; operatingProfit: number; operatingMargin: number; netProfit: number; netMargin: number; yearToDateProfit: number }; rows: PerformanceRow[] }

const emptyStatus: StatusReport = { metrics: { totalAssets: 0, totalLiabilities: 0, totalEquity: 0, workingCapital: 0, currentRatio: 0, debtRatio: 0, assetGrowth: 0, balanced: false }, rows: [] }
const emptyPerformance: PerformanceReport = { metrics: { revenue: 0, cost: 0, grossProfit: 0, grossMargin: 0, operatingProfit: 0, operatingMargin: 0, netProfit: 0, netMargin: 0, yearToDateProfit: 0 }, rows: [] }

function currency(value: number) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2 }).format(value)
}

function OperatingAnalysisWorkspace({ view }: { view: OperatingView }) {
  const navigate = useNavigate()
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId)
  const selectedCompany = useCompanyStore((state) => state.companies.find((company) => company.id === state.selectedCompanyId))
  const periods = usePeriodStore((state) => state.periods)
  const periodId = usePeriodStore((state) => state.currentPeriodId)
  const getBalanceSheet = usePeriodStore((state) => state.getBalanceSheet)
  const getIncomeStatement = usePeriodStore((state) => state.getIncomeStatement)
  const period = periods.find((item) => item.id === periodId)
  const periodLabel = period ? `${period.period_year}-${String(period.period_month).padStart(2, '0')}` : undefined
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetResult | null>(null)
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatementResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const title = view === 'status' ? '经营状况表' : '经营业绩表'

  const refresh = useCallback(async () => {
    if (!selectedCompanyId || !periodId) {
      setBalanceSheet(null)
      setIncomeStatement(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      if (view === 'status') {
        setBalanceSheet(await getBalanceSheet(periodId))
        setIncomeStatement(null)
      } else {
        setIncomeStatement(await getIncomeStatement(periodId))
        setBalanceSheet(null)
      }
      setNotice(null)
    } catch (error) {
      setNotice(`读取${title}失败：${String(error)}`)
    } finally {
      setLoading(false)
    }
  }, [getBalanceSheet, getIncomeStatement, periodId, selectedCompanyId, title, view])

  useEffect(() => { void refresh() }, [refresh])

  const status = useMemo(() => balanceSheet ? buildOperatingStatus(balanceSheet) as StatusReport : emptyStatus, [balanceSheet])
  const performance = useMemo(() => incomeStatement ? buildOperatingPerformance(incomeStatement) as PerformanceReport : emptyPerformance, [incomeStatement])
  const exportHeaders = view === 'status'
    ? ['项目编码', '结构项目', '类别', '期初余额', '期末余额', '本期变动', '资产占比']
    : ['项目编码', '业绩项目', '本月金额', '本年累计', '收入占比', '项目类型']
  const exportRows = view === 'status'
    ? status.rows.map((row) => [row.code, row.name, row.kind, currency(row.opening), currency(row.ending), currency(row.change), `${row.share}%`])
    : performance.rows.map((row) => [row.code, row.name, currency(row.current), currency(row.yearToDate), `${row.share}%`, row.total ? '汇总' : '明细'])
  const hasRows = view === 'status' ? status.rows.length > 0 : performance.rows.length > 0

  return <main className="min-h-full min-w-0 bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
    <section data-operational-export-root className="min-w-0 border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]">
      <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
        <div><div className="flex items-center gap-2"><FileBarChart2 className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" /><h1 className="text-base font-semibold">{title}</h1></div><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{view === 'status' ? '从资产负债结构观察偿债能力、营运资金和资本构成，呈现企业当前财务承载能力。' : '从收入、成本与利润结构观察经营产出和盈利质量，呈现本期与本年累计表现。'}</p></div>
        <div className="flex flex-wrap gap-2"><OperationalExportActions title={title} companyName={selectedCompany?.name} periodLabel={periodLabel} exportHeaders={exportHeaders} exportRows={exportRows} onNotice={setNotice} /><button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex h-8 items-center gap-1.5 border border-slate-300 px-3 text-xs hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />重新取数</button></div>
      </header>
      <nav className="flex gap-1 border-b border-slate-200 p-2 dark:border-slate-800" aria-label="经营分析"><button type="button" onClick={() => navigate('/reports/operating-status')} className={`h-8 border px-3 text-xs ${view === 'status' ? 'border-[#1f65a7] bg-[#1f65a7] text-white dark:border-sky-500 dark:bg-sky-500 dark:text-slate-950' : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}>经营状况表</button><button type="button" onClick={() => navigate('/reports/operating-performance')} className={`h-8 border px-3 text-xs ${view === 'performance' ? 'border-[#1f65a7] bg-[#1f65a7] text-white dark:border-sky-500 dark:bg-sky-500 dark:text-slate-950' : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}>经营业绩表</button></nav>
      {notice && <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">{notice}</div>}
      <div className="border-b border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">{selectedCompany?.name || '未选择账套'} · {periodLabel || '未选择账期'} · {view === 'status' ? '资产负债表口径' : '利润表口径'}</div>
      {view === 'status' ? <StatusMetrics report={status} /> : <PerformanceMetrics report={performance} />}
      {!selectedCompanyId || !periodId ? <Empty message="请选择账套和开放账期后查看经营分析。" /> : loading ? <Empty message={`正在读取${title}...`} /> : !hasRows ? <Empty message="当前账期没有可用于分析的报表项目，请先检查凭证和报表公式。" /> : view === 'status' ? <StatusTable rows={status.rows} totalAssets={status.metrics.totalAssets} /> : <PerformanceTable rows={performance.rows} />}
      <footer className="flex items-start gap-2 border-t border-slate-200 px-4 py-3 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400"><CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /><p>{view === 'status' ? '结构指标由资产负债表期末数计算，不包含授信额度、或有负债和表外事项。' : '业绩指标由利润表项目计算，不代替预算、税务口径或管理会计调整。'} 如需修正，请回到凭证或报表公式处理。</p></footer>
    </section>
  </main>
}

function StatusMetrics({ report }: { report: StatusReport }) {
  return <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800"><Metric icon={Landmark} label="资产总额" value={currency(report.metrics.totalAssets)} hint={`较期初 ${signedPercent(report.metrics.assetGrowth)}`} /><Metric icon={Scale} label="资产负债率" value={`${report.metrics.debtRatio}%`} hint={report.metrics.balanced ? '资产负债平衡' : '报表待复核'} tone={report.metrics.debtRatio > 70 ? 'rose' : 'sky'} /><Metric icon={WalletCards} label="营运资金" value={currency(report.metrics.workingCapital)} hint={`流动比率 ${report.metrics.currentRatio}`} tone={report.metrics.workingCapital < 0 ? 'rose' : 'emerald'} /><Metric icon={Activity} label="所有者权益" value={currency(report.metrics.totalEquity)} hint={`负债 ${currency(report.metrics.totalLiabilities)}`} /></div>
}

function PerformanceMetrics({ report }: { report: PerformanceReport }) {
  return <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800"><Metric icon={TrendingUp} label="营业收入" value={currency(report.metrics.revenue)} hint="本月收入" /><Metric icon={Activity} label="毛利润" value={currency(report.metrics.grossProfit)} hint={`毛利率 ${report.metrics.grossMargin}%`} tone={report.metrics.grossProfit < 0 ? 'rose' : 'emerald'} /><Metric icon={FileBarChart2} label="营业利润" value={currency(report.metrics.operatingProfit)} hint={`营业利润率 ${report.metrics.operatingMargin}%`} tone={report.metrics.operatingProfit < 0 ? 'rose' : 'sky'} /><Metric icon={Landmark} label="净利润" value={currency(report.metrics.netProfit)} hint={`净利率 ${report.metrics.netMargin}% · 累计 ${currency(report.metrics.yearToDateProfit)}`} tone={report.metrics.netProfit < 0 ? 'rose' : 'emerald'} /></div>
}

function StatusTable({ rows, totalAssets }: { rows: StatusRow[]; totalAssets: number }) {
  return <section><div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-800"><h2 className="text-sm font-semibold">资产与资本结构</h2><span className="text-xs text-slate-500 dark:text-slate-400">总资产 {currency(totalAssets)}</span></div><div className="hidden md:block"><table className="w-full table-fixed text-left text-xs"><thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400"><tr><th className="w-[12%] px-4 py-3 font-medium">编码</th><th className="w-[22%] px-4 py-3 font-medium">结构项目</th><th className="w-[10%] px-3 py-3 font-medium">类别</th><th className="w-[16%] px-3 py-3 text-right font-medium">期初余额</th><th className="w-[16%] px-3 py-3 text-right font-medium">期末余额</th><th className="w-[14%] px-3 py-3 text-right font-medium">本期变动</th><th className="w-[10%] px-4 py-3 text-right font-medium">占比</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{rows.map((row) => <tr key={row.code} className="hover:bg-slate-50 dark:hover:bg-slate-800/40"><td className="px-4 py-3 font-mono">{row.code}</td><td className="truncate px-4 py-3 font-medium" title={row.name}>{row.name}</td><td className="px-3 py-3">{row.kind}</td><Money value={row.opening} /><Money value={row.ending} strong /><Money value={row.change} tone /><td className="px-4 py-3 text-right tabular-nums">{row.share}%</td></tr>)}</tbody></table></div><MobileRows rows={rows.map((row) => ({ id: row.code, title: row.name, meta: `${row.kind} · ${row.code}`, values: [['期初余额', currency(row.opening)], ['期末余额', currency(row.ending)], ['本期变动', currency(row.change)], ['资产占比', `${row.share}%`]] }))} /></section>
}

function PerformanceTable({ rows }: { rows: PerformanceRow[] }) {
  return <section><div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-800"><h2 className="text-sm font-semibold">收入成本利润结构</h2><span className="text-xs text-slate-500 dark:text-slate-400">本月与本年累计</span></div><div className="hidden md:block"><table className="w-full table-fixed text-left text-xs"><thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400"><tr><th className="w-[12%] px-4 py-3 font-medium">编码</th><th className="w-[30%] px-4 py-3 font-medium">业绩项目</th><th className="w-[20%] px-3 py-3 text-right font-medium">本月金额</th><th className="w-[20%] px-3 py-3 text-right font-medium">本年累计</th><th className="w-[10%] px-3 py-3 text-right font-medium">收入占比</th><th className="w-[8%] px-4 py-3 text-center font-medium">类型</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{rows.map((row) => <tr key={row.code} className={`${row.total ? 'bg-slate-50/70 font-semibold dark:bg-slate-900/40' : ''}`}><td className="px-4 py-3 font-mono">{row.code}</td><td className="truncate px-4 py-3" title={row.name}>{row.name}</td><Money value={row.current} tone /><Money value={row.yearToDate} /><td className="px-3 py-3 text-right tabular-nums">{row.share}%</td><td className="px-4 py-3 text-center">{row.total ? '汇总' : '明细'}</td></tr>)}</tbody></table></div><MobileRows rows={rows.map((row) => ({ id: row.code, title: row.name, meta: `${row.total ? '汇总' : '明细'} · ${row.code}`, values: [['本月金额', currency(row.current)], ['本年累计', currency(row.yearToDate)], ['收入占比', `${row.share}%`]] }))} /></section>
}

function MobileRows({ rows }: { rows: Array<{ id: string; title: string; meta: string; values: string[][] }> }) {
  return <div className="grid gap-2 p-3 md:hidden">{rows.map((row) => <article key={row.id} className="border border-slate-200 p-3 dark:border-slate-800"><p className="text-sm font-semibold">{row.title}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{row.meta}</p><div className="mt-3 grid grid-cols-2 gap-3">{row.values.map(([label, value]) => <div key={label}><p className="text-xs text-slate-500 dark:text-slate-400">{label}</p><p className="mt-1 break-words text-xs tabular-nums">{value}</p></div>)}</div></article>)}</div>
}

function Metric({ icon: Icon, label, value, hint, tone = 'sky' }: { icon: typeof Activity; label: string; value: string; hint: string; tone?: 'sky' | 'emerald' | 'rose' }) {
  const color = { sky: 'text-sky-700 dark:text-sky-300', emerald: 'text-emerald-700 dark:text-emerald-300', rose: 'text-rose-700 dark:text-rose-300' }[tone]
  return <div className="px-4 py-3"><div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400"><span>{label}</span><Icon className="h-4 w-4" /></div><p className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{value}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p></div>
}

function Money({ value, strong = false, tone = false }: { value: number; strong?: boolean; tone?: boolean }) {
  return <td className={`px-3 py-3 text-right tabular-nums ${strong ? 'font-semibold' : ''} ${tone ? value < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-300' : ''}`}>{currency(value)}</td>
}

function signedPercent(value: number) { return `${value > 0 ? '+' : ''}${value}%` }
function Empty({ message }: { message: string }) { return <div className="flex min-h-48 items-center justify-center px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">{message}</div> }

export function OperatingStatusWorkspace() { return <OperatingAnalysisWorkspace view="status" /> }
export function OperatingPerformanceWorkspace() { return <OperatingAnalysisWorkspace view="performance" /> }

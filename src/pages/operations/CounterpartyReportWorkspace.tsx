import { ArrowRight, CircleAlert, FileSpreadsheet, RefreshCw, Search, UsersRound, WalletCards } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { OperationalExportActions } from '../../components/operations/OperationalExportActions'
import { OperationalPagination } from '../../components/operations/OperationalPagination'
import { settlementRecordApi, type SettlementRecord } from '../../lib/api'
import { loadBrowserPreviewOpenPeriod, previewPeriodLabel } from '../../lib/browserPreviewPeriod'
import { buildCounterpartyDetail, buildCounterpartySummary, summarizeCounterpartyReport } from '../../lib/counterpartyReportWorkflow.js'
import { paginateOperationalRows } from '../../lib/operationalPagination'
import { isTauri } from '../../lib/tauri'
import { useCompanyStore } from '../../stores/companyStore'
import { usePeriodStore } from '../../stores/periodStore'

type ReportMode = 'receivable' | 'payable'
type ReportView = 'summary' | 'detail'

type SummaryRow = {
  counterparty: string
  documentCount: number
  totalAmount: number
  settledAmount: number
  balanceAmount: number
  settlementRate: number
  latestDate: string
  owner: string
  openDocumentCount: number
}

const browserStorageKey = 'accounting-preview-settlement-data-v1'

const reportRoutes = [
  { path: '/reports/receivable-summary', label: '应收汇总表', mode: 'receivable', view: 'summary' },
  { path: '/reports/receivable-detail', label: '应收明细表', mode: 'receivable', view: 'detail' },
  { path: '/reports/payable-summary', label: '应付汇总表', mode: 'payable', view: 'summary' },
  { path: '/reports/payable-detail', label: '应付明细表', mode: 'payable', view: 'detail' },
] as const

function formatCurrency(value: number) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2 }).format(value)
}

function loadBrowserRecords(companyId: string, period: string, mode: ReportMode) {
  if (typeof window === 'undefined') return [] as SettlementRecord[]
  try {
    const parsed = JSON.parse(window.localStorage.getItem(browserStorageKey) || '[]') as SettlementRecord[]
    return Array.isArray(parsed)
      ? parsed.filter((record) => record.companyId === companyId && record.period === period && record.settlementType === mode)
      : []
  } catch {
    return []
  }
}

function CounterpartyReportWorkspace({ mode, view }: { mode: ReportMode; view: ReportView }) {
  const navigate = useNavigate()
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId)
  const selectedCompany = useCompanyStore((state) => state.companies.find((company) => company.id === state.selectedCompanyId))
  const periods = usePeriodStore((state) => state.periods)
  const currentPeriodId = usePeriodStore((state) => state.currentPeriodId)
  const companyId = selectedCompanyId || (isTauri ? null : 'browser-preview-company')
  const browserPeriod = useMemo(() => (isTauri ? undefined : loadBrowserPreviewOpenPeriod(companyId)), [companyId])
  const period = periods.find((candidate) => candidate.id === currentPeriodId) || browserPeriod
  const periodLabel = previewPeriodLabel(period)
  const [records, setRecords] = useState<SettlementRecord[]>([])
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const title = `${mode === 'receivable' ? '应收' : '应付'}${view === 'summary' ? '汇总表' : '明细表'}`
  const counterpartyLabel = mode === 'receivable' ? '客户' : '供应商'
  const settlementPath = mode === 'receivable' ? '/settlement/receivable' : '/settlement/payable'

  const refresh = useCallback(async () => {
    if (!companyId || !periodLabel) {
      setRecords([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      if (!isTauri) {
        setRecords(loadBrowserRecords(companyId, periodLabel, mode))
        setNotice(null)
        return
      }
      const result = await settlementRecordApi.getSettlementRecords({ companyId, period: periodLabel, settlementType: mode })
      if (!result.success) throw new Error(result.error || '读取往来台账失败')
      setRecords(result.data || [])
      setNotice(null)
    } catch (error) {
      setNotice(`读取${title}失败：${String(error)}`)
    } finally {
      setLoading(false)
    }
  }, [companyId, mode, periodLabel, title])

  useEffect(() => { void refresh() }, [refresh])

  const metrics = useMemo(() => summarizeCounterpartyReport(records, mode), [mode, records])
  const summaryRows = useMemo(() => buildCounterpartySummary(records, mode) as SummaryRow[], [mode, records])
  const detailRows = useMemo(() => buildCounterpartyDetail(records, mode) as SettlementRecord[], [mode, records])
  const filteredSummary = useMemo(() => {
    const query = keyword.trim().toLowerCase()
    return summaryRows.filter((row) => !query || `${row.counterparty} ${row.owner}`.toLowerCase().includes(query))
  }, [keyword, summaryRows])
  const filteredDetail = useMemo(() => {
    const query = keyword.trim().toLowerCase()
    return detailRows.filter((row) => {
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'open' ? row.balanceAmount > 0 : row.balanceAmount === 0)
      const searchable = [row.settlementNo, row.counterparty, row.invoiceNo, row.transactionNo, row.owner].filter(Boolean).join(' ').toLowerCase()
      return matchesStatus && (!query || searchable.includes(query))
    })
  }, [detailRows, keyword, statusFilter])
  const summaryPage = useMemo(() => paginateOperationalRows(filteredSummary, page, pageSize), [filteredSummary, page, pageSize])
  const detailPage = useMemo(() => paginateOperationalRows(filteredDetail, page, pageSize), [filteredDetail, page, pageSize])
  const paged = view === 'summary' ? summaryPage : detailPage
  const visibleCount = view === 'summary' ? filteredSummary.length : filteredDetail.length
  const exportHeaders = view === 'summary'
    ? [counterpartyLabel, '单据数', '发生额', '已核销', '期末余额', '核销率', '未清单据', '最近业务日', '负责人']
    : ['业务日期', '单据编号', counterpartyLabel, '发票号码', '流水编号', '发生额', '已核销', '余额', '状态']
  const exportRows = view === 'summary'
    ? filteredSummary.map((row) => [row.counterparty, String(row.documentCount), formatCurrency(row.totalAmount), formatCurrency(row.settledAmount), formatCurrency(row.balanceAmount), `${row.settlementRate}%`, String(row.openDocumentCount), row.latestDate, row.owner])
    : filteredDetail.map((row) => [row.settlementDate, row.settlementNo, row.counterparty, row.invoiceNo || '-', row.transactionNo || '-', formatCurrency(row.totalAmount), formatCurrency(row.settledAmount), formatCurrency(row.balanceAmount), row.status])

  return (
    <main className="min-h-full min-w-0 bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section data-operational-export-root className="min-w-0 border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]">
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" /><h1 className="text-base font-semibold">{title}</h1></div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {view === 'summary'
                ? `按${counterpartyLabel}汇总本期发生、核销和期末未清余额，定位重点往来单位。`
                : `逐笔核对${counterpartyLabel}单据、发票、银行流水及核销进度，追踪未清项目。`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions title={title} companyName={selectedCompany?.name} periodLabel={periodLabel} exportHeaders={exportHeaders} exportRows={exportRows} onNotice={setNotice} />
            <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex h-8 items-center gap-1.5 border border-slate-300 px-3 text-xs hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />刷新</button>
            <button type="button" onClick={() => navigate(settlementPath)} className="inline-flex h-8 items-center gap-1.5 bg-[#1f65a7] px-3 text-xs text-white hover:bg-[#174f84] dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400">核对台账<ArrowRight className="h-3.5 w-3.5" /></button>
          </div>
        </header>

        <nav className="flex flex-wrap gap-1 border-b border-slate-200 p-2 dark:border-slate-800" aria-label="往来报表">
          {reportRoutes.map((item) => (
            <button key={item.path} type="button" onClick={() => navigate(item.path)} className={`h-8 border px-3 text-xs ${item.mode === mode && item.view === view ? 'border-[#1f65a7] bg-[#1f65a7] text-white dark:border-sky-500 dark:bg-sky-500 dark:text-slate-950' : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}>{item.label}</button>
          ))}
        </nav>

        {notice && <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">{notice}</div>}

        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          <Metric label={`${counterpartyLabel}数`} value={`${metrics.counterpartyCount} 户`} />
          <Metric label="本期发生额" value={formatCurrency(metrics.totalAmount)} />
          <Metric label="已核销金额" value={formatCurrency(metrics.settledAmount)} tone="emerald" />
          <Metric label="期末未清余额" value={formatCurrency(metrics.balanceAmount)} tone={metrics.balanceAmount > 0 ? 'amber' : 'slate'} hint={`核销率 ${metrics.settlementRate}%`} />
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400">{selectedCompany?.name || '未选择账套'} · {periodLabel || '未选择账期'} · {metrics.documentCount} 笔单据</div>
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            {view === 'detail' && <select aria-label="核销状态" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }} className="h-8 border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-[#111827]"><option value="all">全部状态</option><option value="open">仅未清</option><option value="closed">已核销</option></select>}
            <label className="flex h-8 min-w-0 items-center gap-2 border border-slate-300 px-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400 sm:w-72"><Search className="h-3.5 w-3.5 shrink-0" /><input value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1) }} placeholder={`搜索${counterpartyLabel}、单号或负责人`} className="min-w-0 flex-1 bg-transparent text-slate-900 outline-none dark:text-slate-100" /></label>
          </div>
        </div>

        {!companyId || !periodLabel ? <EmptyState message="请选择账套和开放账期后查看往来报表。" /> : loading ? <EmptyState message={`正在读取${title}...`} /> : view === 'summary' ? (
          <SummaryTable rows={summaryPage.rows} counterpartyLabel={counterpartyLabel} />
        ) : (
          <DetailTable rows={detailPage.rows} counterpartyLabel={counterpartyLabel} />
        )}
        {!loading && companyId && periodLabel && visibleCount === 0 && <EmptyState message={`当前筛选下没有${mode === 'receivable' ? '应收' : '应付'}数据。`} />}
        {!loading && visibleCount > 0 && <OperationalPagination page={paged} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} />}
        <footer className="flex items-start gap-2 border-t border-slate-200 px-4 py-3 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400"><CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /><p>报表金额来自当前账期核销台账。余额、账龄或单据关联异常需回到核销台账处理，报表页不直接修改业务记录。</p></footer>
      </section>
    </main>
  )
}

function SummaryTable({ rows, counterpartyLabel }: { rows: SummaryRow[]; counterpartyLabel: string }) {
  return <section>
    <div className="hidden lg:block"><table className="w-full table-fixed text-left text-xs"><thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400"><tr><th className="w-[20%] px-4 py-3 font-medium">{counterpartyLabel}</th><th className="w-[8%] px-3 py-3 text-right font-medium">单据</th><th className="w-[13%] px-3 py-3 text-right font-medium">发生额</th><th className="w-[13%] px-3 py-3 text-right font-medium">已核销</th><th className="w-[13%] px-3 py-3 text-right font-medium">期末余额</th><th className="w-[10%] px-3 py-3 text-right font-medium">核销率</th><th className="w-[9%] px-3 py-3 text-right font-medium">未清</th><th className="w-[14%] px-4 py-3 font-medium">最近业务日</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{rows.map((row) => <tr key={row.counterparty} className="hover:bg-slate-50 dark:hover:bg-slate-800/40"><td className="truncate px-4 py-3 font-medium" title={row.counterparty}>{row.counterparty}<span className="mt-1 block text-slate-500 dark:text-slate-400">{row.owner}</span></td><td className="px-3 py-3 text-right tabular-nums">{row.documentCount}</td><Money value={row.totalAmount} /><Money value={row.settledAmount} /><Money value={row.balanceAmount} strong /><td className="px-3 py-3 text-right tabular-nums">{row.settlementRate}%</td><td className="px-3 py-3 text-right tabular-nums">{row.openDocumentCount}</td><td className="px-4 py-3">{row.latestDate || '-'}</td></tr>)}</tbody></table></div>
    <div className="grid gap-2 p-3 lg:hidden">{rows.map((row) => <article key={row.counterparty} className="border border-slate-200 p-3 dark:border-slate-800"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{row.counterparty}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{row.documentCount} 笔 · {row.owner}</p></div><span className="text-xs font-medium text-amber-600 dark:text-amber-400">未清 {formatCurrency(row.balanceAmount)}</span></div><div className="mt-3 grid grid-cols-2 gap-3"><Info label="发生额" value={formatCurrency(row.totalAmount)} /><Info label="已核销" value={formatCurrency(row.settledAmount)} /><Info label="核销率" value={`${row.settlementRate}%`} /><Info label="最近业务日" value={row.latestDate || '-'} /></div></article>)}</div>
  </section>
}

function DetailTable({ rows, counterpartyLabel }: { rows: SettlementRecord[]; counterpartyLabel: string }) {
  return <section>
    <div className="hidden lg:block"><table className="w-full table-fixed text-left text-xs"><thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400"><tr><th className="w-[10%] px-3 py-3 font-medium">日期</th><th className="w-[11%] px-3 py-3 font-medium">单据编号</th><th className="w-[17%] px-3 py-3 font-medium">{counterpartyLabel}</th><th className="w-[13%] px-3 py-3 font-medium">发票/流水</th><th className="w-[12%] px-3 py-3 text-right font-medium">发生额</th><th className="w-[12%] px-3 py-3 text-right font-medium">已核销</th><th className="w-[12%] px-3 py-3 text-right font-medium">余额</th><th className="w-[13%] px-3 py-3 font-medium">状态</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{rows.map((row) => <tr key={row.id} className="align-top hover:bg-slate-50 dark:hover:bg-slate-800/40"><td className="px-3 py-3">{row.settlementDate}</td><td className="truncate px-3 py-3 font-mono" title={row.settlementNo}>{row.settlementNo}</td><td className="truncate px-3 py-3 font-medium" title={row.counterparty}>{row.counterparty}<span className="mt-1 block text-slate-500 dark:text-slate-400">{row.owner || '-'}</span></td><td className="truncate px-3 py-3" title={`${row.invoiceNo || ''} ${row.transactionNo || ''}`}>{row.invoiceNo || '-'}<span className="mt-1 block text-slate-500 dark:text-slate-400">{row.transactionNo || '-'}</span></td><Money value={row.totalAmount} /><Money value={row.settledAmount} /><Money value={row.balanceAmount} strong /><td className="px-3 py-3"><span className={`inline-flex border px-2 py-0.5 ${row.balanceAmount > 0 ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300'}`}>{row.status}</span></td></tr>)}</tbody></table></div>
    <div className="grid gap-2 p-3 lg:hidden">{rows.map((row) => <article key={row.id} className="border border-slate-200 p-3 dark:border-slate-800"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{row.counterparty}</p><p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">{row.settlementNo} · {row.settlementDate}</p></div><span className="shrink-0 text-xs text-amber-600 dark:text-amber-400">余额 {formatCurrency(row.balanceAmount)}</span></div><div className="mt-3 grid grid-cols-2 gap-3"><Info label="发生额" value={formatCurrency(row.totalAmount)} /><Info label="已核销" value={formatCurrency(row.settledAmount)} /><Info label="发票号码" value={row.invoiceNo || '-'} /><Info label="流水编号" value={row.transactionNo || '-'} /></div></article>)}</div>
  </section>
}

function Money({ value, strong = false }: { value: number; strong?: boolean }) {
  return <td className={`px-3 py-3 text-right tabular-nums ${strong ? 'font-semibold' : ''}`}>{formatCurrency(value)}</td>
}

function Metric({ label, value, hint, tone = 'sky' }: { label: string; value: string; hint?: string; tone?: 'sky' | 'emerald' | 'amber' | 'slate' }) {
  const toneClass = { sky: 'text-sky-700 dark:text-sky-300', emerald: 'text-emerald-700 dark:text-emerald-300', amber: 'text-amber-700 dark:text-amber-300', slate: 'text-slate-800 dark:text-slate-100' }[tone]
  return <div className="px-4 py-3"><div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400"><span>{label}</span>{label.includes('户') || label.includes('数') ? <UsersRound className="h-4 w-4" /> : <WalletCards className="h-4 w-4" />}</div><p className={`mt-1 text-xl font-semibold tabular-nums ${toneClass}`}>{value}</p>{hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}</div>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-xs text-slate-500 dark:text-slate-400">{label}</p><p className="mt-1 break-words text-xs text-slate-800 dark:text-slate-100">{value}</p></div>
}

function EmptyState({ message }: { message: string }) {
  return <div className="flex min-h-40 items-center justify-center px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">{message}</div>
}

export function ReceivableSummaryWorkspace() { return <CounterpartyReportWorkspace mode="receivable" view="summary" /> }
export function ReceivableDetailWorkspace() { return <CounterpartyReportWorkspace mode="receivable" view="detail" /> }
export function PayableSummaryWorkspace() { return <CounterpartyReportWorkspace mode="payable" view="summary" /> }
export function PayableDetailWorkspace() { return <CounterpartyReportWorkspace mode="payable" view="detail" /> }

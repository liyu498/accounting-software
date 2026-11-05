import { BadgeCheck, Check, ClipboardCheck, CloudDownload, FilePlus2, FileText, History, Pencil, RefreshCw, Search, Trash2, Waypoints, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { OperationalExportActions } from '../../components/operations/OperationalExportActions'
import { OperationalPagination } from '../../components/operations/OperationalPagination'
import { InvoiceLineEditor, emptyInvoiceLineDraft, fallbackInvoiceLineDraft, invoiceLineDraftFromRecord, parseInvoiceLineDrafts, type InvoiceLineDraft } from '../../components/operations/InvoiceLineEditor'
import { automationApi, invoiceApi, type ExternalInvoiceSyncItem, type Invoice, type InvoiceTaxEvent, type InvoiceTaxEventType } from '../../lib/api'
import { paginateOperationalRows } from '../../lib/operationalPagination'
import { isTauri } from '../../lib/tauri'
import { buildVoucherSourcePath } from '../../lib/voucherSourceWorkflow.js'
import { useCompanyStore } from '../../stores/companyStore'
import { usePeriodStore } from '../../stores/periodStore'

type InvoiceTab = 'ledger' | 'pending' | 'verified' | 'exceptions'

type InvoiceDraft = {
  invoiceNo: string
  invoiceCode: string
  invoiceDate: string
  amount: string
  taxAmount: string
  taxRate: string
  sellerName: string
  sellerTaxId: string
  buyerName: string
  buyerTaxId: string
  remarks: string
}

const emptyInvoiceDraft: InvoiceDraft = {
  invoiceNo: '',
  invoiceCode: '',
  invoiceDate: '',
  amount: '',
  taxAmount: '',
  taxRate: '13',
  sellerName: '',
  sellerTaxId: '',
  buyerName: '',
  buyerTaxId: '',
  remarks: '',
}

const tabs: Array<{ id: InvoiceTab; label: string }> = [
  { id: 'ledger', label: '进项台账' },
  { id: 'pending', label: '待认证' },
  { id: 'verified', label: '已认证' },
  { id: 'exceptions', label: '异常票' },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(value)
}

function invoiceStatusLabel(status: Invoice['status']) {
  return {
    pending: '待认证',
    verified: '已认证',
    matched: '已匹配',
    rejected: '异常',
  }[status]
}

function InvoiceStatus({ status }: { status: Invoice['status'] }) {
  const classes = {
    pending: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300',
    verified: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300',
    matched: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-300',
    rejected: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300',
  }[status]

  return <span className={`inline-flex border px-2 py-0.5 text-xs ${classes}`}>{invoiceStatusLabel(status)}</span>
}

function workspacePanelClassName() {
  return 'border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]'
}

function draftFromInvoice(invoice: Invoice): InvoiceDraft {
  return {
    invoiceNo: invoice.invoiceNo,
    invoiceCode: invoice.invoiceCode || '',
    invoiceDate: invoice.invoiceDate,
    amount: String(invoice.amount),
    taxAmount: String(invoice.taxAmount),
    taxRate: String((invoice.taxRate || 0) * 100),
    sellerName: invoice.sellerName || '',
    sellerTaxId: invoice.sellerTaxId || '',
    buyerName: invoice.buyerName || '',
    buyerTaxId: invoice.buyerTaxId || '',
    remarks: invoice.remarks || '',
  }
}

export function InputInvoiceWorkspace() {
  const navigate = useNavigate()
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId)
  const selectedCompany = useCompanyStore((state) => state.companies.find((company) => company.id === state.selectedCompanyId))
  const companyId = selectedCompanyId || (isTauri ? null : 'browser-preview-company')
  const currentPeriodId = usePeriodStore((state) => state.currentPeriodId)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [activeTab, setActiveTab] = useState<InvoiceTab>('ledger')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [draft, setDraft] = useState<InvoiceDraft>(emptyInvoiceDraft)
  const [lineDrafts, setLineDrafts] = useState<InvoiceLineDraft[]>([emptyInvoiceLineDraft()])
  const [saving, setSaving] = useState(false)
  const [taxHistoryInvoice, setTaxHistoryInvoice] = useState<Invoice | null>(null)
  const [taxEvents, setTaxEvents] = useState<InvoiceTaxEvent[]>([])
  const [taxEventsLoading, setTaxEventsLoading] = useState(false)
  const [stagedInvoices, setStagedInvoices] = useState<ExternalInvoiceSyncItem[]>([])
  const [showStagedInvoices, setShowStagedInvoices] = useState(false)
  const [invoicePoolCursor, setInvoicePoolCursor] = useState<string | undefined>()
  const [syncingInvoicePool, setSyncingInvoicePool] = useState(false)
  const currentPeriod = usePeriodStore((state) => state.periods.find((period) => period.id === state.currentPeriodId))
  const periodLabel = currentPeriod ? `${currentPeriod.period_year}-${String(currentPeriod.period_month).padStart(2, '0')}` : ''

  const refresh = useCallback(async () => {
    if (!companyId) {
      setInvoices([])
      setLoading(false)
      return
    }
    setLoading(true)
    const result = await invoiceApi.getAll(companyId, 'input', currentPeriodId || undefined)
    if (result.success) {
      setInvoices(result.data || [])
      setNotice(null)
    } else {
      setNotice(`读取进项发票失败：${result.error || '未知错误'}`)
    }
    setLoading(false)
  }, [companyId, currentPeriodId])

  const refreshStagedInvoices = useCallback(async () => {
    if (!companyId) {
      setStagedInvoices([])
      return
    }
    const result = await automationApi.getExternalInvoiceSyncItems({ companyId, reviewStatus: 'pending_review' })
    if (result.success) setStagedInvoices(result.data || [])
    else setNotice(`读取票池待复核发票失败：${result.error || '未知错误'}`)
  }, [companyId])

  useEffect(() => {
    void refresh()
    void refreshStagedInvoices()
  }, [refresh, refreshStagedInvoices])

  const syncInvoicePool = async () => {
    if (!companyId || !periodLabel) {
      setNotice('请先选择账套和开放账期，再同步发票票池。')
      return
    }
    if (!isTauri) {
      setNotice('真实发票池同步仅支持桌面版；浏览器预览不会连接票池或生成正式发票。')
      return
    }
    const authorizations = await automationApi.getAdapterAuthorizations({ companyId, adapterType: 'invoice_pool' })
    const authorization = authorizations.success
      ? authorizations.data?.find((item) => item.authStatus === 'authorized' && /票池|发票|invoice/i.test(item.capabilityScope || ''))
      : undefined
    if (!authorization) {
      setNotice('没有已验证且具备发票同步能力的票池渠道，请先到“设置 > 授权中心”配置并验证。')
      return
    }
    const confirmed = window.confirm(`确认通过已验证渠道“${authorization.adapterCode}”同步 ${periodLabel} 进项发票？外部数据只进入待复核区，不会直接生成正式发票或凭证。`)
    if (!confirmed) return
    setSyncingInvoicePool(true)
    const result = await automationApi.syncExternalInvoicePool({
      companyId,
      authorizationId: authorization.id,
      period: periodLabel,
      sourceCursor: invoicePoolCursor,
      syncConfirmed: true,
    })
    setSyncingInvoicePool(false)
    if (!result.success || !result.data) {
      setNotice(`同步发票票池失败：${result.error || '未知错误'}`)
      return
    }
    setInvoicePoolCursor(result.data.nextCursor || undefined)
    setShowStagedInvoices(true)
    setNotice(`票池同步完成：待复核 ${result.data.stagedCount} 张，重复 ${result.data.duplicateCount} 张；未生成凭证。`)
    await refreshStagedInvoices()
  }

  const reviewStagedInvoice = async (item: ExternalInvoiceSyncItem, action: 'import' | 'reject') => {
    if (!companyId) return
    const confirmed = window.confirm(action === 'import'
      ? `确认将票池发票 ${item.invoiceNo} 导入为本地待认证发票？不会自动认证、抵扣或生成凭证。`
      : `确认驳回票池发票 ${item.invoiceNo}？`)
    if (!confirmed) return
    const result = action === 'import'
      ? await automationApi.importExternalInvoiceSyncItem({ companyId, itemId: item.id, reviewConfirmed: true, reviewNote: '进项发票工作台人工复核导入' })
      : await automationApi.rejectExternalInvoiceSyncItem({ companyId, itemId: item.id, reviewConfirmed: true, reviewNote: '进项发票工作台人工复核驳回' })
    if (!result.success) {
      setNotice(`${action === 'import' ? '导入' : '驳回'}票池发票失败：${result.error || '未知错误'}`)
      return
    }
    setNotice(action === 'import'
      ? `票池发票 ${item.invoiceNo} 已导入待认证台账；未自动认证、抵扣或生成凭证。`
      : `票池发票 ${item.invoiceNo} 已驳回并留痕。`)
    await Promise.all([refresh(), refreshStagedInvoices()])
  }

  const visibleInvoices = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    return invoices.filter((invoice) => {
      const inTab = activeTab === 'ledger'
        || (activeTab === 'pending' && invoice.status === 'pending')
        || (activeTab === 'verified' && ['verified', 'matched'].includes(invoice.status))
        || (activeTab === 'exceptions' && invoice.status === 'rejected')
      const text = [invoice.invoiceNo, invoice.invoiceCode, invoice.sellerName, invoice.sellerTaxId, invoice.remarks]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return inTab && (!normalizedKeyword || text.includes(normalizedKeyword))
    })
  }, [activeTab, invoices, keyword])
  const pagination = useMemo(() => paginateOperationalRows(visibleInvoices, page, pageSize), [page, pageSize, visibleInvoices])

  const metrics = useMemo(() => ({
    taxAmount: invoices.filter((invoice) => ['verified', 'matched'].includes(invoice.status)).reduce((total, invoice) => total + invoice.taxAmount, 0),
    pending: invoices.filter((invoice) => invoice.status === 'pending').length,
    exceptions: invoices.filter((invoice) => invoice.status === 'rejected').length,
  }), [invoices])

  const openCreate = () => {
    setEditingInvoice(null)
    setDraft({ ...emptyInvoiceDraft, buyerName: selectedCompany?.name || '' })
    setLineDrafts([emptyInvoiceLineDraft()])
    setShowEditor(true)
  }

  const openEdit = async (invoice: Invoice) => {
    if (!companyId) return
    setEditingInvoice(invoice)
    setDraft(draftFromInvoice(invoice))
    const result = await invoiceApi.getLines(invoice.id, companyId)
    setLineDrafts(result.success && result.data?.length ? result.data.map(invoiceLineDraftFromRecord) : [fallbackInvoiceLineDraft(invoice)])
    if (!result.success) setNotice(`读取发票明细失败：${result.error || '未知错误'}`)
    setShowEditor(true)
  }

  const saveInvoice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!companyId) {
      setNotice('请先选择账套，再维护进项发票。')
      return
    }
    const amount = Number(draft.amount)
    const taxAmount = Number(draft.taxAmount || 0)
    const taxRate = Number(draft.taxRate || 0)
    if (!draft.invoiceNo.trim() || !draft.invoiceDate || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(taxAmount) || taxAmount < 0 || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      setNotice('请填写发票号码、开票日期以及有效的金额、税额和税率。')
      return
    }
    const parsedLines = parseInvoiceLineDrafts(lineDrafts)
    if (parsedLines.error || !parsedLines.lines) {
      setNotice(parsedLines.error || '请补齐发票明细。')
      return
    }
    if (Math.round(parsedLines.amount * 100) !== Math.round(amount * 100) || Math.round(parsedLines.taxAmount * 100) !== Math.round(taxAmount * 100)) {
      setNotice('货物或服务明细的金额、税额必须分别与发票表头一致。')
      return
    }

    setSaving(true)
    const input = {
      companyId,
      periodId: currentPeriodId || undefined,
      invoiceType: 'input' as const,
      invoiceNo: draft.invoiceNo.trim(),
      invoiceCode: draft.invoiceCode.trim() || undefined,
      invoiceDate: draft.invoiceDate,
      amount,
      taxAmount,
      taxRate: taxRate / 100,
      sellerName: draft.sellerName.trim() || undefined,
      sellerTaxId: draft.sellerTaxId.trim() || undefined,
      buyerName: draft.buyerName.trim() || undefined,
      buyerTaxId: draft.buyerTaxId.trim() || undefined,
      remarks: draft.remarks.trim() || undefined,
      lines: parsedLines.lines,
    }
    const headerResult = editingInvoice
      ? await invoiceApi.updateWithLines(editingInvoice.id, { ...input, companyId }, parsedLines.lines)
      : await invoiceApi.create(input)

    if (!headerResult.success) {
      setSaving(false)
      setNotice(`${editingInvoice ? '更新' : '新增'}进项发票失败：${headerResult.error || '未知错误'}`)
      return
    }
    setSaving(false)
    setShowEditor(false)
    setNotice(editingInvoice ? '进项发票及明细已更新。' : '进项发票及明细已登记，待人工认证复核。')
    await refresh()
  }

  const markVerified = async (invoice: Invoice) => {
    if (!companyId) return
    const result = await invoiceApi.createTaxEvent(invoice.id, companyId, {
      eventType: 'certification_review_passed',
      deductionPeriod: periodLabel || undefined,
      deductibleTaxAmount: invoice.taxAmount,
      source: '人工认证复核',
      remarks: '本地复核记录，不代表税务机关认证、勾选或申报结果。',
    })
    if (!result.success) {
      setNotice(`登记认证复核失败：${result.error || '未知错误'}`)
      return
    }
    setNotice(`发票 ${invoice.invoiceNo} 已追加本地认证复核记录；未向税务机关提交。`)
    await refresh()
  }

  const openTaxHistory = async (invoice: Invoice) => {
    if (!companyId) return
    setTaxHistoryInvoice(invoice)
    setTaxEventsLoading(true)
    const result = await invoiceApi.getTaxEvents(invoice.id, companyId)
    setTaxEvents(result.success ? result.data || [] : [])
    setTaxEventsLoading(false)
    if (!result.success) setNotice(`读取认证与抵扣历史失败：${result.error || '未知错误'}`)
  }

  const saveTaxEvent = async (eventType: InvoiceTaxEventType, deductionPeriod: string, deductibleTaxAmount: number, source: string, remarks: string) => {
    if (!companyId || !taxHistoryInvoice) return false
    const result = await invoiceApi.createTaxEvent(taxHistoryInvoice.id, companyId, {
      eventType,
      deductionPeriod: deductionPeriod || undefined,
      deductibleTaxAmount,
      source,
      remarks: remarks || undefined,
    })
    if (!result.success) {
      setNotice(`登记进项税处理失败：${result.error || '未知错误'}`)
      return false
    }
    const history = await invoiceApi.getTaxEvents(taxHistoryInvoice.id, companyId)
    setTaxEvents(history.success ? history.data || [] : [])
    setNotice('进项税处理记录已追加并写入操作审计。')
    await refresh()
    return true
  }

  const deleteInvoice = async (invoice: Invoice) => {
    if (!companyId || invoice.status !== 'pending') return
    if (!window.confirm(`确认删除待认证进项发票 ${invoice.invoiceNo}？此操作会同步删除其明细。`)) return
    const result = await invoiceApi.delete(invoice.id, companyId)
    if (!result.success) {
      setNotice(`删除进项发票失败：${result.error || '未知错误'}`)
      return
    }
    setNotice(`待认证进项发票 ${invoice.invoiceNo} 已删除并写入操作审计。`)
    await refresh()
  }

  const renderActions = (invoice: Invoice) => (
    <div className="flex flex-wrap justify-end gap-2">
      {invoice.status === 'pending' && <button type="button" onClick={() => void markVerified(invoice)} className="inline-flex h-7 items-center gap-1 border border-emerald-300 px-2 text-xs text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"><BadgeCheck className="h-3.5 w-3.5" />标记认证</button>}
      {invoice.status === 'verified' && <button type="button" onClick={() => navigate(buildVoucherSourcePath({ kind: 'invoice', id: invoice.id }))} className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"><FileText className="h-3.5 w-3.5" />新建凭证</button>}
      <button type="button" onClick={() => void openTaxHistory(invoice)} className="inline-flex h-7 items-center gap-1 border border-slate-300 px-2 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><History className="h-3.5 w-3.5" />税务记录</button>
      <button type="button" onClick={() => navigate('/matching')} className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"><Waypoints className="h-3.5 w-3.5" />凭证匹配</button>
      {invoice.status === 'pending' && <button type="button" onClick={() => void openEdit(invoice)} className="inline-flex h-7 items-center gap-1 border border-slate-300 px-2 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><Pencil className="h-3.5 w-3.5" />编辑</button>}
      {invoice.status === 'pending' && <button type="button" aria-label="删除进项发票" title="删除待认证进项发票" onClick={() => void deleteInvoice(invoice)} className="inline-flex h-7 w-7 items-center justify-center border border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"><Trash2 className="h-3.5 w-3.5" /></button>}
    </div>
  )

  return (
    <main className="min-h-full bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section className={workspacePanelClassName()} data-operational-export-root>
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" /><h1 className="text-base font-semibold">进项发票认证与抵扣</h1></div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">围绕票池登记、人工认证复核、抵扣税额和凭证匹配处理进项票。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions title="进项发票清单" companyName={selectedCompany?.name} exportHeaders={['开票日期', '发票号码', '销售方', '不含税金额', '税额', '认证状态', '抵扣用途']} exportRows={visibleInvoices.map((invoice) => [invoice.invoiceDate, invoice.invoiceNo, invoice.sellerName || '待补销售方', formatCurrency(invoice.amount), formatCurrency(invoice.taxAmount), invoiceStatusLabel(invoice.status), invoice.remarks || '待设置'])} onNotice={setNotice} />
            <button type="button" onClick={() => void syncInvoicePool()} disabled={syncingInvoicePool} className="inline-flex h-8 items-center gap-1 border border-sky-300 px-3 text-xs text-sky-700 hover:bg-sky-50 disabled:opacity-60 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"><CloudDownload className="h-3.5 w-3.5" />{syncingInvoicePool ? '同步中...' : invoicePoolCursor ? '继续同步票池' : '同步票池'}</button>
            <button type="button" onClick={() => setShowStagedInvoices((value) => !value)} className="inline-flex h-8 items-center gap-1 border border-amber-300 px-3 text-xs text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/30"><ClipboardCheck className="h-3.5 w-3.5" />票池待复核 {stagedInvoices.length}</button>
            <button type="button" onClick={() => void refresh()} className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><RefreshCw className="h-3.5 w-3.5" />刷新</button>
            <button type="button" onClick={openCreate} className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]"><FilePlus2 className="h-3.5 w-3.5" />登记进项票</button>
          </div>
        </header>

        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          <Metric label="进项发票" value={`${invoices.length} 张`} />
          <Metric label="可抵扣税额" value={formatCurrency(metrics.taxAmount)} tone="text-emerald-600 dark:text-emerald-400" />
          <Metric label="待认证" value={`${metrics.pending} 张`} tone="text-amber-600 dark:text-amber-400" />
          <Metric label="异常票" value={`${metrics.exceptions} 张`} tone="text-rose-600 dark:text-rose-400" />
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap gap-1">
            {tabs.map((tab) => <button key={tab.id} type="button" onClick={() => { setActiveTab(tab.id); setPage(1) }} className={`h-8 border px-3 text-xs ${activeTab === tab.id ? 'border-[#1f65a7] bg-blue-50 text-[#174f82] dark:border-sky-500 dark:bg-sky-950/30 dark:text-sky-300' : 'border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>{tab.label}</button>)}
          </div>
          <label className="relative block w-full lg:w-80"><Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-400" /><input value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1) }} placeholder="搜索发票号码、销方或备注" className="h-8 w-full border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500" /></label>
        </div>

        {notice && <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200">{notice}</div>}
        {showStagedInvoices && (
          <section className="border-b border-amber-200 bg-amber-50/40 p-3 dark:border-amber-900/70 dark:bg-amber-950/10" aria-label="票池待复核">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">票池待复核</h2><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">逐张核对销方、号码、日期和金额后再导入；导入后仍为待认证发票。</p></div>
              <button type="button" onClick={() => setShowStagedInvoices(false)} className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">收起</button>
            </div>
            {stagedInvoices.length === 0 ? <p className="border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">当前没有待复核的票池发票。</p> : (
              <div className="grid gap-2 lg:grid-cols-2">
                {stagedInvoices.map((item) => (
                  <article key={item.id} className="border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-[#111827]">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-mono font-medium text-slate-900 dark:text-slate-100">{item.invoiceNo}</p><p className="mt-1 truncate text-slate-500 dark:text-slate-400">{item.sellerName || '未返回销售方'} · {item.invoiceDate}</p></div><span className="shrink-0 font-medium tabular-nums text-slate-900 dark:text-slate-100">{formatCurrency(item.totalAmount)}</span></div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-slate-500 dark:text-slate-400"><span>金额 {formatCurrency(item.amount)}</span><span>税额 {formatCurrency(item.taxAmount)}</span><span>币种 {item.currency}</span></div>
                    <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => void reviewStagedInvoice(item, 'reject')} className="inline-flex h-7 items-center gap-1 border border-rose-300 px-2 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"><X className="h-3.5 w-3.5" />驳回</button><button type="button" onClick={() => void reviewStagedInvoice(item, 'import')} className="inline-flex h-7 items-center gap-1 bg-[#1f65a7] px-2 text-white hover:bg-[#174f82]"><Check className="h-3.5 w-3.5" />复核并导入</button></div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
        {!companyId && <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">请选择账套后查看或登记进项发票。</div>}
        {companyId && loading && <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">正在读取进项发票...</div>}
        {companyId && !loading && <>
          <div className="hidden lg:block">
            <table className="w-full table-fixed text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400"><tr><th className="px-4 py-3 font-medium">开票日期</th><th className="px-4 py-3 font-medium">发票号码</th><th className="px-4 py-3 font-medium">销售方</th><th className="px-4 py-3 text-right font-medium">不含税金额</th><th className="px-4 py-3 text-right font-medium">税额</th><th className="px-4 py-3 font-medium">认证状态</th><th className="px-4 py-3 font-medium">抵扣用途</th><th className="px-4 py-3 text-right font-medium">操作</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{pagination.rows.map((invoice) => <tr key={invoice.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40"><td className="whitespace-nowrap px-4 py-3">{invoice.invoiceDate}</td><td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-200">{invoice.invoiceNo}</td><td className="max-w-52 truncate px-4 py-3">{invoice.sellerName || '待补销售方'}</td><td className="px-4 py-3 text-right tabular-nums">{formatCurrency(invoice.amount)}</td><td className="px-4 py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-300">{formatCurrency(invoice.taxAmount)}</td><td className="px-4 py-3"><InvoiceStatus status={invoice.status} /></td><td className="max-w-40 truncate px-4 py-3 text-slate-500 dark:text-slate-400">{invoice.remarks || '待设置'}</td><td className="px-4 py-3">{renderActions(invoice)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="space-y-2 p-3 lg:hidden">{pagination.rows.map((invoice) => <article key={invoice.id} className="border border-slate-200 p-3 dark:border-slate-800"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-sm font-medium">{invoice.invoiceNo}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{invoice.sellerName || '待补销售方'} · {invoice.invoiceDate}</p></div><InvoiceStatus status={invoice.status} /></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><Info label="不含税金额" value={formatCurrency(invoice.amount)} /><Info label="税额" value={formatCurrency(invoice.taxAmount)} /><Info label="税率" value={`${((invoice.taxRate || 0) * 100).toFixed(0)}%`} /><Info label="抵扣用途" value={invoice.remarks || '待设置'} /></div><div className="mt-3">{renderActions(invoice)}</div></article>)}</div>
          {visibleInvoices.length === 0 && <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">当前范围没有进项发票。</div>}
          <OperationalPagination page={pagination} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} />
        </>}
      </section>

      {showEditor && <InvoiceEditor draft={draft} lineDrafts={lineDrafts} editing={Boolean(editingInvoice)} saving={saving} onChange={setDraft} onLinesChange={setLineDrafts} onClose={() => setShowEditor(false)} onSubmit={saveInvoice} />}
      {taxHistoryInvoice && <TaxHistoryDialog invoice={taxHistoryInvoice} events={taxEvents} loading={taxEventsLoading} defaultPeriod={periodLabel} onClose={() => setTaxHistoryInvoice(null)} onSave={saveTaxEvent} />}
    </main>
  )
}

function Metric({ label, value, tone = 'text-slate-900 dark:text-slate-100' }: { label: string; value: string; tone?: string }) {
  return <div className="px-4 py-3"><p className="text-xs text-slate-500 dark:text-slate-400">{label}</p><p className={`mt-1 text-lg font-semibold tabular-nums ${tone}`}>{value}</p></div>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-slate-500 dark:text-slate-400">{label}</p><p className="mt-0.5 truncate text-slate-800 dark:text-slate-200">{value}</p></div>
}

function InvoiceEditor({ draft, lineDrafts, editing, saving, onChange, onLinesChange, onClose, onSubmit }: { draft: InvoiceDraft; lineDrafts: InvoiceLineDraft[]; editing: boolean; saving: boolean; onChange: (draft: InvoiceDraft) => void; onLinesChange: (drafts: InvoiceLineDraft[]) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const fields: Array<{ key: keyof InvoiceDraft; label: string; type?: string; required?: boolean; min?: string; step?: string; span?: boolean }> = [
    { key: 'invoiceNo', label: '发票号码', required: true }, { key: 'invoiceCode', label: '发票代码' }, { key: 'invoiceDate', label: '开票日期', type: 'date', required: true }, { key: 'amount', label: '不含税金额', type: 'number', required: true, min: '0.01', step: '0.01' }, { key: 'taxAmount', label: '税额', type: 'number', min: '0', step: '0.01' }, { key: 'taxRate', label: '税率（%）', type: 'number', min: '0', step: '0.01' }, { key: 'sellerName', label: '销售方名称' }, { key: 'sellerTaxId', label: '销售方税号' }, { key: 'buyerName', label: '购买方名称' }, { key: 'buyerTaxId', label: '购买方税号' }, { key: 'remarks', label: '抵扣用途/备注', span: true },
  ]
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-label="进项发票编辑"><form onSubmit={onSubmit} className="max-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-auto border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-[#111827]"><header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-800"><div><h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{editing ? '编辑进项发票' : '登记进项发票'}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">仅维护本地票据台账，不发起税局认证、抵扣或申报。</p></div><button type="button" onClick={onClose} className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">取消</button></header><div className="grid gap-3 p-4 sm:grid-cols-2">{fields.map((field) => <label key={field.key} className={`grid gap-1 text-xs text-slate-600 dark:text-slate-300 ${field.span ? 'sm:col-span-2' : ''}`}><span>{field.label}{field.required ? ' *' : ''}</span><input required={field.required} type={field.type || 'text'} min={field.min} step={field.step} value={draft[field.key]} onChange={(event) => onChange({ ...draft, [field.key]: event.target.value })} className="h-8 border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500" /></label>)}</div><InvoiceLineEditor drafts={lineDrafts} onChange={onLinesChange} headerAmount={draft.amount} headerTaxAmount={draft.taxAmount} disabled={saving} /><footer className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800"><button type="button" onClick={onClose} className="h-8 border border-slate-300 px-3 text-xs text-slate-700 dark:border-slate-700 dark:text-slate-200">取消</button><button disabled={saving} type="submit" className="h-8 bg-[#1f65a7] px-3 text-xs font-medium text-white disabled:opacity-60">{saving ? '保存中...' : editing ? '保存修改' : '登记发票'}</button></footer></form></div>
}

function taxEventLabel(type: InvoiceTaxEventType) {
  return { certification_review_passed: '认证复核通过', deduction_declared: '抵扣申报记录', deduction_transferred_out: '进项税额转出', not_deductible: '确认不抵扣' }[type]
}

function TaxHistoryDialog({ invoice, events, loading, defaultPeriod, onClose, onSave }: { invoice: Invoice; events: InvoiceTaxEvent[]; loading: boolean; defaultPeriod: string; onClose: () => void; onSave: (eventType: InvoiceTaxEventType, deductionPeriod: string, deductibleTaxAmount: number, source: string, remarks: string) => Promise<boolean> }) {
  const [eventType, setEventType] = useState<InvoiceTaxEventType>(invoice.status === 'pending' ? 'certification_review_passed' : 'deduction_declared')
  const [deductionPeriod, setDeductionPeriod] = useState(defaultPeriod)
  const [amount, setAmount] = useState(String(invoice.taxAmount))
  const [source, setSource] = useState('人工复核')
  const [remarks, setRemarks] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = Number(amount)
    if (!Number.isFinite(value) || value < 0 || value > invoice.taxAmount) return
    setSaving(true)
    const saved = await onSave(eventType, deductionPeriod, value, source.trim(), remarks.trim())
    setSaving(false)
    if (saved) setRemarks('')
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-label="进项税务记录"><div className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-auto border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-[#111827]"><header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-800"><div><h2 className="text-sm font-semibold">认证与抵扣历史 · {invoice.invoiceNo}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">追加式本地记录不可修改或删除，也不代表税务机关受理结果。</p></div><button type="button" onClick={onClose} className="text-xs text-slate-500">关闭</button></header><form onSubmit={submit} className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 dark:border-slate-800"><label className="grid gap-1 text-xs"><span>处理类型</span><select value={eventType} onChange={(event) => setEventType(event.target.value as InvoiceTaxEventType)} className="h-8 border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-[#0d1423]">{invoice.status === 'pending' ? <option value="certification_review_passed">认证复核通过</option> : <><option value="deduction_declared">抵扣申报记录</option><option value="deduction_transferred_out">进项税额转出</option><option value="not_deductible">确认不抵扣</option></>}</select></label><label className="grid gap-1 text-xs"><span>所属期</span><input type="month" value={deductionPeriod} onChange={(event) => setDeductionPeriod(event.target.value)} className="h-8 border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-[#0d1423]" /></label><label className="grid gap-1 text-xs"><span>本次税额</span><input required type="number" min="0" max={invoice.taxAmount} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="h-8 border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-[#0d1423]" /></label><label className="grid gap-1 text-xs"><span>来源</span><input required value={source} onChange={(event) => setSource(event.target.value)} className="h-8 border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-[#0d1423]" /></label><label className="grid gap-1 text-xs sm:col-span-2"><span>备注</span><input value={remarks} onChange={(event) => setRemarks(event.target.value)} className="h-8 border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-[#0d1423]" /></label><div className="sm:col-span-2 flex justify-end"><button disabled={saving} type="submit" className="h-8 bg-[#1f65a7] px-3 text-xs font-medium text-white disabled:opacity-60">{saving ? '保存中...' : '追加记录'}</button></div></form><div className="divide-y divide-slate-200 dark:divide-slate-800">{loading && <p className="p-4 text-xs text-slate-500">正在读取...</p>}{!loading && events.length === 0 && <p className="p-4 text-xs text-slate-500">暂无认证或抵扣历史。</p>}{events.map((event) => <article key={event.id} className="grid gap-1 px-4 py-3 text-xs sm:grid-cols-[10rem_7rem_1fr]"><div><p className="font-medium">{taxEventLabel(event.eventType)}</p><p className="mt-1 text-slate-500">{event.occurredAt.slice(0, 19).replace('T', ' ')}</p></div><div><p>{event.deductionPeriod || '未指定期间'}</p><p className="mt-1 tabular-nums">{formatCurrency(event.deductibleTaxAmount)}</p></div><div><p>{event.source} · {event.operator}</p><p className="mt-1 text-slate-500 dark:text-slate-400">{event.remarks || '无备注'}</p></div></article>)}</div></div></div>
}

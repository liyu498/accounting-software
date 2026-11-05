import { BadgeCheck, FileOutput, FilePlus2, FileText, Pencil, RefreshCw, Search, Trash2, Waypoints } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { OperationalExportActions } from '../../components/operations/OperationalExportActions'
import { OperationalPagination } from '../../components/operations/OperationalPagination'
import { InvoiceLineEditor, emptyInvoiceLineDraft, fallbackInvoiceLineDraft, invoiceLineDraftFromRecord, parseInvoiceLineDrafts, type InvoiceLineDraft } from '../../components/operations/InvoiceLineEditor'
import { invoiceApi, type Invoice } from '../../lib/api'
import { paginateOperationalRows } from '../../lib/operationalPagination'
import { isTauri } from '../../lib/tauri'
import { buildVoucherSourcePath } from '../../lib/voucherSourceWorkflow.js'
import { useCompanyStore } from '../../stores/companyStore'
import { usePeriodStore } from '../../stores/periodStore'

type OutputInvoiceTab = 'ledger' | 'review' | 'voucher' | 'exceptions'

type OutputInvoiceDraft = {
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

const emptyDraft: OutputInvoiceDraft = {
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

const tabs: Array<{ id: OutputInvoiceTab; label: string }> = [
  { id: 'ledger', label: '销项台账' },
  { id: 'review', label: '待复核' },
  { id: 'voucher', label: '凭证联动' },
  { id: 'exceptions', label: '作废/异常' },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2 }).format(value)
}

function statusLabel(status: Invoice['status']) {
  return {
    pending: '待复核',
    verified: '待生成凭证',
    matched: '已关联凭证',
    rejected: '作废/异常',
  }[status]
}

function StatusBadge({ status }: { status: Invoice['status'] }) {
  const classes = {
    pending: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300',
    verified: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-300',
    matched: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300',
    rejected: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300',
  }[status]

  return <span className={`inline-flex border px-2 py-0.5 text-xs ${classes}`}>{statusLabel(status)}</span>
}

function draftFromInvoice(invoice: Invoice): OutputInvoiceDraft {
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

export function OutputInvoiceWorkspace() {
  const navigate = useNavigate()
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId)
  const selectedCompany = useCompanyStore((state) => state.companies.find((company) => company.id === state.selectedCompanyId))
  const companyId = selectedCompanyId || (isTauri ? null : 'browser-preview-company')
  const currentPeriodId = usePeriodStore((state) => state.currentPeriodId)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [activeTab, setActiveTab] = useState<OutputInvoiceTab>('ledger')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [draft, setDraft] = useState<OutputInvoiceDraft>(emptyDraft)
  const [lineDrafts, setLineDrafts] = useState<InvoiceLineDraft[]>([emptyInvoiceLineDraft()])
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    if (!companyId) {
      setInvoices([])
      setLoading(false)
      return
    }
    setLoading(true)
    const result = await invoiceApi.getAll(companyId, 'output', currentPeriodId || undefined)
    if (result.success) {
      setInvoices(result.data || [])
      setNotice(null)
    } else {
      setNotice(`读取销项发票失败：${result.error || '未知错误'}`)
    }
    setLoading(false)
  }, [companyId, currentPeriodId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const visibleInvoices = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    return invoices.filter((invoice) => {
      const inTab = activeTab === 'ledger'
        || (activeTab === 'review' && ['pending', 'verified'].includes(invoice.status))
        || (activeTab === 'voucher' && invoice.status === 'matched')
        || (activeTab === 'exceptions' && invoice.status === 'rejected')
      const text = [invoice.invoiceNo, invoice.invoiceCode, invoice.buyerName, invoice.buyerTaxId, invoice.remarks]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return inTab && (!normalizedKeyword || text.includes(normalizedKeyword))
    })
  }, [activeTab, invoices, keyword])
  const pagination = useMemo(() => paginateOperationalRows(visibleInvoices, page, pageSize), [page, pageSize, visibleInvoices])

  const metrics = useMemo(() => ({
    amount: invoices.reduce((total, invoice) => total + invoice.amount, 0),
    taxAmount: invoices.reduce((total, invoice) => total + invoice.taxAmount, 0),
    toReview: invoices.filter((invoice) => ['pending', 'verified'].includes(invoice.status)).length,
    exceptions: invoices.filter((invoice) => invoice.status === 'rejected').length,
  }), [invoices])

  const openCreate = () => {
    setEditingInvoice(null)
    setDraft({ ...emptyDraft, sellerName: selectedCompany?.name || '' })
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
      setNotice('请先选择账套，再维护销项发票。')
      return
    }
    const amount = Number(draft.amount)
    const taxAmount = Number(draft.taxAmount || 0)
    const taxRate = Number(draft.taxRate || 0)
    if (!draft.invoiceNo.trim() || !draft.invoiceDate || !draft.buyerName.trim() || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(taxAmount) || taxAmount < 0 || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      setNotice('请填写发票号码、开票日期、购方名称以及有效的金额、税额和税率。')
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
      invoiceType: 'output' as const,
      invoiceNo: draft.invoiceNo.trim(),
      invoiceCode: draft.invoiceCode.trim() || undefined,
      invoiceDate: draft.invoiceDate,
      amount,
      taxAmount,
      taxRate: taxRate / 100,
      sellerName: draft.sellerName.trim() || undefined,
      sellerTaxId: draft.sellerTaxId.trim() || undefined,
      buyerName: draft.buyerName.trim(),
      buyerTaxId: draft.buyerTaxId.trim() || undefined,
      remarks: draft.remarks.trim() || undefined,
      lines: parsedLines.lines,
    }
    const headerResult = editingInvoice
      ? await invoiceApi.updateWithLines(editingInvoice.id, { ...input, companyId }, parsedLines.lines)
      : await invoiceApi.create(input)

    if (!headerResult.success) {
      setSaving(false)
      setNotice(`${editingInvoice ? '更新' : '新增'}销项发票失败：${headerResult.error || '未知错误'}`)
      return
    }
    setSaving(false)
    setShowEditor(false)
    setNotice(editingInvoice ? '销项发票及明细已更新。' : '销项发票及明细已登记，待人工复核收入和税额。')
    await refresh()
  }

  const markReviewed = async (invoice: Invoice) => {
    if (!companyId) return
    const result = await invoiceApi.reviewOutput(invoice.id, companyId)
    if (!result.success) {
      setNotice(`更新复核状态失败：${result.error || '未知错误'}`)
      return
    }
    setNotice(`销项发票 ${invoice.invoiceNo} 已完成本地收入与税额复核，下一步请人工生成凭证。`)
    await refresh()
  }

  const deleteInvoice = async (invoice: Invoice) => {
    if (!companyId || invoice.status !== 'pending') return
    if (!window.confirm(`确认删除待复核销项发票 ${invoice.invoiceNo}？此操作会同步删除其明细。`)) return
    const result = await invoiceApi.delete(invoice.id, companyId)
    if (!result.success) {
      setNotice(`删除销项发票失败：${result.error || '未知错误'}`)
      return
    }
    setNotice(`待复核销项发票 ${invoice.invoiceNo} 已删除并写入操作审计。`)
    await refresh()
  }

  const actions = (invoice: Invoice) => (
    <div className="flex flex-wrap justify-end gap-2">
      {invoice.status === 'pending' && <button type="button" onClick={() => void markReviewed(invoice)} className="inline-flex h-7 items-center gap-1 border border-emerald-300 px-2 text-xs text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"><BadgeCheck className="h-3.5 w-3.5" />完成复核</button>}
      {invoice.status === 'verified' && <button type="button" onClick={() => navigate(buildVoucherSourcePath({ kind: 'invoice', id: invoice.id }))} className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"><FileText className="h-3.5 w-3.5" />新建凭证</button>}
      {invoice.status === 'pending' && <button type="button" onClick={() => void openEdit(invoice)} className="inline-flex h-7 items-center gap-1 border border-slate-300 px-2 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><Pencil className="h-3.5 w-3.5" />编辑</button>}
      {invoice.status === 'pending' && <button type="button" aria-label="删除销项发票" title="删除待复核销项发票" onClick={() => void deleteInvoice(invoice)} className="inline-flex h-7 w-7 items-center justify-center border border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"><Trash2 className="h-3.5 w-3.5" /></button>}
    </div>
  )

  return (
    <main className="min-h-full bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section className="border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]" data-operational-export-root>
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2"><FileOutput className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" /><h1 className="text-base font-semibold">销项开票台账与收入凭证</h1></div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">维护购方、收入金额、销项税额和凭证联动状态；仅维护本地台账，不发起税局开票、红冲或申报。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions title="销项发票清单" companyName={selectedCompany?.name} exportHeaders={['开票日期', '发票号码', '购方名称', '不含税收入', '销项税额', '复核状态', '关联凭证']} exportRows={visibleInvoices.map((invoice) => [invoice.invoiceDate, invoice.invoiceNo, invoice.buyerName || '待补购方', formatCurrency(invoice.amount), formatCurrency(invoice.taxAmount), statusLabel(invoice.status), invoice.voucherId || '未关联'])} onNotice={setNotice} />
            <button type="button" onClick={() => void refresh()} className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><RefreshCw className="h-3.5 w-3.5" />刷新</button>
            <button type="button" onClick={openCreate} className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]"><FilePlus2 className="h-3.5 w-3.5" />登记销项票</button>
          </div>
        </header>

        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-5 dark:divide-slate-800 dark:border-slate-800">
          <Metric label="销项发票" value={`${invoices.length} 张`} />
          <Metric label="不含税收入" value={formatCurrency(metrics.amount)} tone="text-emerald-600 dark:text-emerald-400" />
          <Metric label="销项税额" value={formatCurrency(metrics.taxAmount)} tone="text-amber-600 dark:text-amber-400" />
          <Metric label="待复核/制证" value={`${metrics.toReview} 张`} tone="text-sky-700 dark:text-sky-300" />
          <Metric label="作废/异常" value={`${metrics.exceptions} 张`} tone="text-rose-600 dark:text-rose-400" />
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap gap-1">
            {tabs.map((tab) => <button key={tab.id} type="button" onClick={() => { setActiveTab(tab.id); setPage(1) }} className={`h-8 border px-3 text-xs ${activeTab === tab.id ? 'border-[#1f65a7] bg-blue-50 text-[#174f82] dark:border-sky-500 dark:bg-sky-950/30 dark:text-sky-300' : 'border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>{tab.label}</button>)}
          </div>
          <label className="relative block w-full lg:w-80"><Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-400" /><input value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1) }} placeholder="搜索发票号码、购方或业务备注" className="h-8 w-full border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500" /></label>
        </div>

        {notice && <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200">{notice}</div>}
        {!companyId && <Placeholder message="请选择账套后查看或登记销项发票。" />}
        {companyId && loading && <Placeholder message="正在读取销项发票..." />}
        {companyId && !loading && <>
          <div className="hidden lg:block">
            <table className="w-full table-fixed text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400"><tr><th className="px-4 py-3 font-medium">开票日期</th><th className="px-4 py-3 font-medium">发票号码</th><th className="px-4 py-3 font-medium">购方名称</th><th className="px-4 py-3 text-right font-medium">不含税收入</th><th className="px-4 py-3 text-right font-medium">销项税额</th><th className="px-4 py-3 font-medium">复核状态</th><th className="px-4 py-3 font-medium">关联凭证</th><th className="px-4 py-3 text-right font-medium">操作</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{pagination.rows.map((invoice) => <tr key={invoice.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40"><td className="whitespace-nowrap px-4 py-3">{invoice.invoiceDate}</td><td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-200">{invoice.invoiceNo}</td><td className="max-w-56 truncate px-4 py-3">{invoice.buyerName || '待补购方'}</td><td className="px-4 py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-300">{formatCurrency(invoice.amount)}</td><td className="px-4 py-3 text-right tabular-nums">{formatCurrency(invoice.taxAmount)}</td><td className="px-4 py-3"><StatusBadge status={invoice.status} /></td><td className="max-w-36 truncate px-4 py-3 text-slate-500 dark:text-slate-400">{invoice.voucherId || '未关联'}</td><td className="px-4 py-3">{actions(invoice)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="space-y-2 p-3 lg:hidden">{pagination.rows.map((invoice) => <article key={invoice.id} className="border border-slate-200 p-3 dark:border-slate-800"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-sm font-medium">{invoice.invoiceNo}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{invoice.buyerName || '待补购方'} · {invoice.invoiceDate}</p></div><StatusBadge status={invoice.status} /></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><Info label="不含税收入" value={formatCurrency(invoice.amount)} /><Info label="销项税额" value={formatCurrency(invoice.taxAmount)} /><Info label="税率" value={`${((invoice.taxRate || 0) * 100).toFixed(0)}%`} /><Info label="关联凭证" value={invoice.voucherId || '未关联'} /></div><div className="mt-3">{actions(invoice)}</div></article>)}</div>
          {visibleInvoices.length === 0 && <Placeholder message="当前范围没有销项发票。" />}
          <OperationalPagination page={pagination} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} />
        </>}
      </section>

      <section className="mt-3 grid gap-3 lg:grid-cols-2">
        <QuickLink icon={<Waypoints className="h-4 w-4" />} title="销售与收款" description="维护销售订单、出库与收款来源，再补齐对应销项发票的业务依据。" onClick={() => navigate('/sales')} />
        <QuickLink icon={<FileText className="h-4 w-4" />} title="会计凭证" description="复核销项收入和税额后，人工选择科目与分录生成凭证。" onClick={() => navigate('/vouchers/new')} />
      </section>

      {showEditor && <OutputInvoiceEditor draft={draft} lineDrafts={lineDrafts} editing={Boolean(editingInvoice)} saving={saving} onChange={setDraft} onLinesChange={setLineDrafts} onClose={() => setShowEditor(false)} onSubmit={saveInvoice} />}
    </main>
  )
}

function Metric({ label, value, tone = 'text-slate-900 dark:text-slate-100' }: { label: string; value: string; tone?: string }) {
  return <div className="px-4 py-3"><p className="text-xs text-slate-500 dark:text-slate-400">{label}</p><p className={`mt-1 text-lg font-semibold tabular-nums ${tone}`}>{value}</p></div>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-slate-500 dark:text-slate-400">{label}</p><p className="mt-0.5 truncate text-slate-800 dark:text-slate-200">{value}</p></div>
}

function Placeholder({ message }: { message: string }) {
  return <div className="p-7 text-center text-sm text-slate-500 dark:text-slate-400">{message}</div>
}

function QuickLink({ icon, title, description, onClick }: { icon: React.ReactNode; title: string; description: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex items-start gap-3 border border-slate-200 bg-white p-3 text-left hover:border-sky-300 hover:bg-sky-50 dark:border-slate-800 dark:bg-[#111827] dark:hover:border-sky-800 dark:hover:bg-sky-950/20"><span className="mt-0.5 text-[#1f65a7] dark:text-sky-400">{icon}</span><span><span className="block text-sm font-medium">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</span></span></button>
}

function OutputInvoiceEditor({ draft, lineDrafts, editing, saving, onChange, onLinesChange, onClose, onSubmit }: { draft: OutputInvoiceDraft; lineDrafts: InvoiceLineDraft[]; editing: boolean; saving: boolean; onChange: (draft: OutputInvoiceDraft) => void; onLinesChange: (drafts: InvoiceLineDraft[]) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const fields: Array<{ key: keyof OutputInvoiceDraft; label: string; type?: string; required?: boolean; min?: string; step?: string; span?: boolean }> = [
    { key: 'invoiceNo', label: '发票号码', required: true }, { key: 'invoiceCode', label: '发票代码' }, { key: 'invoiceDate', label: '开票日期', type: 'date', required: true }, { key: 'amount', label: '不含税收入', type: 'number', required: true, min: '0.01', step: '0.01' }, { key: 'taxAmount', label: '销项税额', type: 'number', min: '0', step: '0.01' }, { key: 'taxRate', label: '税率（%）', type: 'number', min: '0', step: '0.01' }, { key: 'buyerName', label: '购方名称', required: true }, { key: 'buyerTaxId', label: '购方税号' }, { key: 'sellerName', label: '销售方名称' }, { key: 'sellerTaxId', label: '销售方税号' }, { key: 'remarks', label: '货物/服务或业务备注', span: true },
  ]
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-label="销项发票编辑"><form onSubmit={onSubmit} className="max-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-auto border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-[#111827]"><header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-800"><div><h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{editing ? '编辑销项发票' : '登记销项发票'}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">仅维护本地收入台账；开票、红冲、申报须在合法外部流程中另行完成。</p></div><button type="button" onClick={onClose} className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">取消</button></header><div className="grid gap-3 p-4 sm:grid-cols-2">{fields.map((field) => <label key={field.key} className={`grid gap-1 text-xs text-slate-600 dark:text-slate-300 ${field.span ? 'sm:col-span-2' : ''}`}><span>{field.label}{field.required ? ' *' : ''}</span><input required={field.required} type={field.type || 'text'} min={field.min} step={field.step} value={draft[field.key]} onChange={(event) => onChange({ ...draft, [field.key]: event.target.value })} className="h-8 border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500" /></label>)}</div><InvoiceLineEditor drafts={lineDrafts} onChange={onLinesChange} headerAmount={draft.amount} headerTaxAmount={draft.taxAmount} disabled={saving} /><footer className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800"><button type="button" onClick={onClose} className="h-8 border border-slate-300 px-3 text-xs text-slate-700 dark:border-slate-700 dark:text-slate-200">取消</button><button disabled={saving} type="submit" className="h-8 bg-[#1f65a7] px-3 text-xs font-medium text-white disabled:opacity-60">{saving ? '保存中...' : editing ? '保存修改' : '登记销项票'}</button></footer></form></div>
}

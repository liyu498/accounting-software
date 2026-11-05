import { ArrowLeft, BadgeCheck, ClipboardList, Copy, FileDown, FilePenLine, FileText, MessageSquarePlus, Paperclip, Printer, RotateCcw, ShieldCheck, Trash2, Undo2, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { loadBrowserPreviewBusinessTags, loadBrowserPreviewVoucherTagIds } from '../../lib/browserPreviewBusinessTags.js'
import { copyLocalVoucherAttachmentAssociations, formatLocalFileSize, useLocalAttachmentRecords } from '../../lib/localFileRegistry'
import { exportHtmlToPdf, sanitizePrintableHtml } from '../../lib/pdfExport'
import { isTauri } from '../../lib/tauri'
import { filterVoucherAttachments } from '../../lib/voucherAttachmentWorkflow.js'
import { normalizeVoucherAnnotation } from '../../lib/voucherAnnotationWorkflow.js'
import { buildVoucherPrintHtml } from '../../lib/voucherPrint.js'
import { operationalExportFileBase } from '../../lib/operationalExport'
import { useBusinessTagStore, type BusinessTag } from '../../stores/businessTagStore'
import { useCompanyStore } from '../../stores/companyStore'
import { usePeriodStore } from '../../stores/periodStore'
import { useVoucherStore, type Voucher, type VoucherEntry, type VoucherLog } from '../../stores/voucherStore'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2 }).format(value)
}

function formatDateTime(value: string | null) {
  if (!value) return '未记录'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
}

function generatedAtLabel() {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date()).replace(/\//g, '-')
}

function statusLabel(status: string) {
  if (status === 'approved') return '已审核'
  if (status === 'reversed') return '已红冲'
  if (status === 'draft') return '待审核'
  return status || '未知'
}

function statusClass(status: string) {
  if (status === 'approved') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300'
  if (status === 'reversed') return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300'
  return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300'
}

function operationLabel(log: VoucherLog) {
  return log.operation_type === 'ANNOTATION' ? '批注' : log.operation_type
}

export function VoucherDetailWorkspace() {
  const navigate = useNavigate()
  const { id: voucherId = '' } = useParams()
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId)
  const selectedCompany = useCompanyStore((state) => state.companies.find((company) => company.id === state.selectedCompanyId))
  const periods = usePeriodStore((state) => state.periods)
  const companyId = selectedCompanyId || (isTauri ? null : 'browser-preview-company')
  const getVoucher = useVoucherStore((state) => state.getVoucher)
  const getVoucherEntries = useVoucherStore((state) => state.getVoucherEntries)
  const getVoucherLogs = useVoucherStore((state) => state.getVoucherLogs)
  const addVoucherAnnotation = useVoucherStore((state) => state.addVoucherAnnotation)
  const approveVoucher = useVoucherStore((state) => state.approveVoucher)
  const reverseApproveVoucher = useVoucherStore((state) => state.reverseApproveVoucher)
  const copyVoucher = useVoucherStore((state) => state.copyVoucher)
  const deleteVoucher = useVoucherStore((state) => state.deleteVoucher)
  const reverseVoucher = useVoucherStore((state) => state.reverseVoucher)
  const fetchBusinessTags = useBusinessTagStore((state) => state.fetchBusinessTags)
  const fetchVoucherTagIds = useBusinessTagStore((state) => state.fetchVoucherTagIds)
  const [voucher, setVoucher] = useState<Voucher | null>(null)
  const [entries, setEntries] = useState<VoucherEntry[]>([])
  const [logs, setLogs] = useState<VoucherLog[]>([])
  const [voucherTags, setVoucherTags] = useState<BusinessTag[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [printBusy, setPrintBusy] = useState<'pdf' | 'print' | null>(null)
  const [showAnnotationEditor, setShowAnnotationEditor] = useState(false)
  const [annotationDraft, setAnnotationDraft] = useState('')
  const attachmentRecords = useLocalAttachmentRecords({
    companyId: companyId || '未选择账套',
    period: voucher?.voucher_date.slice(0, 7) || '未选择账期',
  })
  const voucherAttachments = useMemo(
    () => filterVoucherAttachments(attachmentRecords, voucher?.id || ''),
    [attachmentRecords, voucher?.id],
  )

  const refresh = useCallback(async () => {
    if (!voucherId || !companyId) {
      setVoucher(null)
      setEntries([])
      setLogs([])
      setVoucherTags([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const nextVoucher = await getVoucher(voucherId, companyId)
      if (!nextVoucher) {
        setVoucher(null)
        setEntries([])
        setLogs([])
        setVoucherTags([])
        return
      }
      const [nextEntries, nextLogs, nextTagIds] = await Promise.all([
        isTauri ? getVoucherEntries(nextVoucher.id) : Promise.resolve(nextVoucher.entries),
        getVoucherLogs(nextVoucher.id),
        isTauri
          ? fetchVoucherTagIds(nextVoucher.id, companyId)
          : Promise.resolve(loadBrowserPreviewVoucherTagIds(nextVoucher.id, companyId)),
      ])
      let availableTags: BusinessTag[]
      if (isTauri) {
        await fetchBusinessTags(companyId)
        availableTags = useBusinessTagStore.getState().businessTags
      } else {
        availableTags = loadBrowserPreviewBusinessTags(companyId)
      }
      setVoucher(nextVoucher)
      setEntries(nextEntries)
      setLogs(nextLogs)
      setVoucherTags(nextTagIds.map((tagId) => availableTags.find((tag) => tag.id === tagId)).filter((tag): tag is BusinessTag => Boolean(tag)))
      setNotice(null)
    } catch (error) {
      setNotice(`读取凭证详情失败：${String(error)}`)
    } finally {
      setLoading(false)
    }
  }, [companyId, fetchBusinessTags, fetchVoucherTagIds, getVoucher, getVoucherEntries, getVoucherLogs, voucherId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const balanced = voucher ? Math.abs(voucher.total_debit - voucher.total_credit) < 0.005 : false
  const entryMetrics = useMemo(() => ({ debit: entries.filter((entry) => entry.direction === 'debit').reduce((sum, entry) => sum + entry.amount, 0), credit: entries.filter((entry) => entry.direction === 'credit').reduce((sum, entry) => sum + entry.amount, 0) }), [entries])
  const voucherPeriod = voucher ? periods.find((period) => period.id === voucher.period_id) : undefined
  const periodClosed = voucherPeriod?.status === 'closed'
  const canMutate = Boolean(voucher && companyId && !periodClosed && voucher.status !== 'reversed')

  const runVoucherAction = async <T,>(id: string, action: () => Promise<T>, successMessage: string) => {
    if (!voucher || !companyId) return null
    if (periodClosed) {
      setNotice('该凭证所属账期已结账，不能执行写入操作。')
      return null
    }
    setActionId(id)
    try {
      const result = await action()
      setNotice(successMessage)
      return result
    } catch (error) {
      setNotice(`操作失败：${String(error)}`)
      return null
    } finally {
      setActionId(null)
    }
  }

  const handleApprove = async () => {
    if (!voucher || !companyId || voucher.status !== 'draft') return
    const result = await runVoucherAction('approve', () => approveVoucher(voucher.id, companyId), `凭证 ${voucher.voucher_number} 已审核。`)
    if (result) await refresh()
  }

  const handleReverseApprove = async () => {
    if (!voucher || !companyId || voucher.status !== 'approved') return
    const result = await runVoucherAction('reverse-approve', () => reverseApproveVoucher(voucher.id, companyId), `凭证 ${voucher.voucher_number} 已反审核。`)
    if (result) await refresh()
  }

  const handleCopy = async () => {
    if (!voucher || !companyId) return
    const copied = await runVoucherAction('copy', async () => {
      const nextVoucher = await copyVoucher(voucher.id, companyId)
      await copyLocalVoucherAttachmentAssociations(
        { companyId, period: voucher.voucher_date.slice(0, 7) },
        voucher.id,
        nextVoucher.id,
      )
      return nextVoucher
    }, `已从 ${voucher.voucher_number} 复制一张草稿凭证，并保留业务标签和电子附件关联。`)
    if (copied) navigate(`/vouchers/edit/${copied.id}`)
  }

  const handleDelete = async () => {
    if (!voucher || !companyId || voucher.status !== 'draft') return
    if (!window.confirm(`确认删除草稿凭证 ${voucher.voucher_number} 吗？删除后可在凭证回收站恢复。`)) return
    const deleted = await runVoucherAction('delete', () => deleteVoucher(voucher.id, companyId), `草稿凭证 ${voucher.voucher_number} 已移入回收站。`)
    if (deleted !== null) navigate('/vouchers')
  }

  const handleReverse = async () => {
    if (!voucher || !companyId || voucher.status !== 'approved') return
    if (!window.confirm(`确认红冲凭证 ${voucher.voucher_number} 吗？系统会创建反向凭证并保留操作留痕。`)) return
    const reversed = await runVoucherAction('reverse', () => reverseVoucher(voucher.id, companyId), `已为 ${voucher.voucher_number} 创建红冲凭证。`)
    if (reversed) navigate(`/vouchers/detail/${reversed.id}`)
  }

  const handleAnnotation = async () => {
    if (!voucher || !companyId) return
    setActionId('annotation')
    try {
      const content = normalizeVoucherAnnotation(annotationDraft)
      await addVoucherAnnotation({
        voucherId: voucher.id,
        companyId,
        content,
      })
      setAnnotationDraft('')
      setShowAnnotationEditor(false)
      setLogs(await getVoucherLogs(voucher.id))
      setNotice(`已为凭证 ${voucher.voucher_number} 添加批注。`)
    } catch (error) {
      setNotice(`添加批注失败：${String(error)}`)
    } finally {
      setActionId(null)
    }
  }

  const currentPrintHtml = () => {
    if (!voucher) return null
    return buildVoucherPrintHtml({
      companyName: selectedCompany?.name || '浏览器预览账套',
      periodLabel: voucher.voucher_date.slice(0, 7),
      generatedAt: generatedAtLabel(),
      voucher,
      entries,
    })
  }

  const printVoucher = () => {
    const html = currentPrintHtml()
    if (!html || !voucher) return
    setPrintBusy('print')
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setNotice('浏览器阻止了打印窗口，请允许本应用打开打印预览后重试。')
      setPrintBusy(null)
      return
    }
    printWindow.document.write(sanitizePrintableHtml(html))
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
    setNotice(`已打开凭证 ${voucher.voucher_number} 的标准打印预览。`)
    setPrintBusy(null)
  }

  const exportVoucherPdf = async () => {
    const html = currentPrintHtml()
    if (!html || !voucher) return
    setPrintBusy('pdf')
    try {
      await exportHtmlToPdf({
        html,
        fileName: `${operationalExportFileBase(`凭证-${voucher.voucher_number}`, voucher.voucher_date)}.pdf`,
        pageTitle: `记账凭证 ${voucher.voucher_number}`,
      })
      setNotice(`凭证 ${voucher.voucher_number} 的 PDF 已生成。`)
    } catch (error) {
      setNotice(`凭证 PDF 生成失败：${String(error)}`)
    } finally {
      setPrintBusy(null)
    }
  }

  return <main className="min-h-full min-w-0 bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
    <section className="border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]">
      <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" /><h1 className="text-base font-semibold">会计凭证详情</h1></div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">核对凭证表头、分录、辅助项、附件、审计留痕，并完成凭证生命周期操作。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => navigate('/vouchers')} className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><ArrowLeft className="h-3.5 w-3.5" />返回清单</button>
          {voucher && <button type="button" disabled={printBusy !== null} onClick={printVoucher} className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><Printer className="h-3.5 w-3.5" />打印凭证</button>}
          {voucher && <button type="button" disabled={printBusy !== null} onClick={() => void exportVoucherPdf()} className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><FileDown className="h-3.5 w-3.5" />导出凭证PDF</button>}
          {voucher?.status === 'draft' && <button type="button" disabled={!canMutate} onClick={() => navigate(`/vouchers/edit/${voucher.id}`)} className="inline-flex h-8 items-center gap-1 border border-sky-300 px-3 text-xs text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"><FilePenLine className="h-3.5 w-3.5" />编辑草稿</button>}
          {voucher?.status === 'draft' && <button type="button" disabled={!canMutate || actionId !== null} onClick={() => void handleApprove()} className="inline-flex h-8 items-center gap-1 border border-emerald-300 px-3 text-xs text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"><BadgeCheck className="h-3.5 w-3.5" />审核</button>}
          {voucher?.status === 'approved' && <button type="button" disabled={!canMutate || actionId !== null} onClick={() => void handleReverseApprove()} className="inline-flex h-8 items-center gap-1 border border-amber-300 px-3 text-xs text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/30"><Undo2 className="h-3.5 w-3.5" />反审核</button>}
          {voucher && voucher.status !== 'reversed' && <button type="button" disabled={!canMutate || actionId !== null} onClick={() => void handleCopy()} className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><Copy className="h-3.5 w-3.5" />复制</button>}
          {voucher?.status === 'draft' && <button type="button" disabled={!canMutate || actionId !== null} onClick={() => void handleDelete()} className="inline-flex h-8 items-center gap-1 border border-rose-300 px-3 text-xs text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/30"><Trash2 className="h-3.5 w-3.5" />删除</button>}
          {voucher?.status === 'approved' && <button type="button" disabled={!canMutate || actionId !== null} onClick={() => void handleReverse()} className="inline-flex h-8 items-center gap-1 border border-rose-300 px-3 text-xs text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/30"><RotateCcw className="h-3.5 w-3.5" />红冲</button>}
          {voucher && <button type="button" disabled={actionId !== null} onClick={() => setShowAnnotationEditor((current) => !current)} className="inline-flex h-8 items-center gap-1 border border-sky-300 px-3 text-xs text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"><MessageSquarePlus className="h-3.5 w-3.5" />添加批注</button>}
        </div>
      </header>

      {!isTauri && <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200">浏览器预览的凭证操作仅写入本机预览数据；不会提交税局、银行或其他外部系统。</div>}
      {notice && <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">{notice}</div>}
      {showAnnotationEditor && voucher && <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-[#0d1423] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end"><label className="min-w-0 text-xs text-slate-600 dark:text-slate-300">凭证批注<textarea value={annotationDraft} onChange={(event) => setAnnotationDraft(event.target.value)} maxLength={500} rows={2} placeholder="记录复核意见、待补资料或处理说明" className="mt-1 w-full resize-y border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100 dark:focus:border-sky-500" /></label><div className="flex gap-2"><button type="button" onClick={() => { setShowAnnotationEditor(false); setAnnotationDraft('') }} className="h-8 border border-slate-300 px-3 text-xs text-slate-700 dark:border-slate-700 dark:text-slate-200">取消</button><button type="button" disabled={actionId === 'annotation'} onClick={() => void handleAnnotation()} className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white disabled:opacity-50 dark:bg-sky-600"><MessageSquarePlus className="h-3.5 w-3.5" />{actionId === 'annotation' ? '保存中' : '保存批注'}</button></div></div>}
      {loading && <Placeholder message="正在读取凭证详情..." />}
      {!loading && !companyId && <Placeholder message="请选择账套后查看凭证详情。" />}
      {!loading && companyId && !voucher && <Placeholder message="未找到该凭证，可能已删除或不属于当前账套。" />}
      {!loading && voucher && <>
        <div className="grid gap-3 border-b border-slate-200 p-3 lg:grid-cols-[minmax(0,1fr)_20rem] dark:border-slate-800"><div className="border border-slate-200 p-3 dark:border-slate-800"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-base font-semibold">{voucher.voucher_number}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">凭证日期 {voucher.voucher_date} · 账期 ID {voucher.period_id}</p></div><span className={`inline-flex border px-2 py-0.5 text-xs ${statusClass(voucher.status)}`}>{statusLabel(voucher.status)}</span></div><p className="mt-4 text-sm leading-6 text-slate-700 dark:text-slate-200">{voucher.summary || '未填写摘要'}</p><p className="mt-2 break-all text-xs text-slate-500 dark:text-slate-400">来源参考号：{voucher.reference_number || '未设置'}</p><div className="mt-3 flex min-w-0 flex-wrap items-center gap-1.5"><span className="mr-1 text-xs text-slate-500 dark:text-slate-400">业务标签</span>{voucherTags.length > 0 ? voucherTags.map((tag) => <span key={tag.id} className="max-w-full truncate border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-xs text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-300">{tag.name}</span>) : <span className="text-xs text-slate-400 dark:text-slate-500">未设置</span>}</div></div><div className="border border-slate-200 p-3 text-xs leading-5 dark:border-slate-800"><div className="flex items-center gap-1.5 font-medium"><ShieldCheck className="h-3.5 w-3.5 text-[#1f65a7] dark:text-sky-400" />核对结果</div><p className={`mt-2 font-medium ${balanced ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>借贷{balanced ? '平衡' : '不平衡'}</p><p className="mt-1 text-slate-500 dark:text-slate-400">{periodClosed ? '该凭证所属账期已结账，仅允许查看、打印和导出。' : '可在当前详情页按凭证状态执行编辑、审核、复制、删除、反审核或红冲。'}</p></div></div>

        <div className="grid gap-x-6 gap-y-3 border-b border-slate-200 px-4 py-3 sm:grid-cols-2 xl:grid-cols-3 dark:border-slate-800"><Info label="制单人" value={voucher.created_by || '未记录'} /><Info label="制单时间" value={formatDateTime(voucher.created_at)} /><Info label="最后修改" value={voucher.modified_by || '未修改'} /><Info label="修改时间" value={formatDateTime(voucher.modified_at)} /><Info label="审核人" value={voucher.approved_by || '未审核'} /><Info label="审核时间" value={formatDateTime(voucher.approved_at)} /></div>

        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800"><Metric icon={ClipboardList} label="分录行数" value={`${entries.length} 行`} /><Metric icon={FileText} label="借方合计" value={formatCurrency(entryMetrics.debit)} tone="text-sky-700 dark:text-sky-300" /><Metric icon={FileText} label="贷方合计" value={formatCurrency(entryMetrics.credit)} tone={balanced ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} /><Metric icon={Paperclip} label="原始附件" value={`${voucher.attachment_count || 0} 张`} /></div>

        <section className="border-b border-slate-200 dark:border-slate-800"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-800"><h2 className="text-sm font-semibold">电子附件</h2><span className="text-xs text-slate-500 dark:text-slate-400">已关联 {voucherAttachments.length} 个，本体保留在本机</span></div>{voucherAttachments.length > 0 ? <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">{voucherAttachments.map((attachment) => <article key={attachment.id} className="min-w-0 border border-slate-200 p-3 text-xs dark:border-slate-800"><p className="truncate font-medium" title={attachment.fileName}>{attachment.fileName}</p><p className="mt-1 text-slate-500 dark:text-slate-400">{attachment.fileFormat} · {formatLocalFileSize(attachment.fileSize)} · {attachment.status}</p><p className="mt-2 truncate font-mono text-[11px] text-slate-400 dark:text-slate-500" title={attachment.checksum}>校验值 {attachment.checksum.slice(0, 16)}...</p></article>)}</div> : <Placeholder message="当前凭证没有已关联的电子附件。" />}</section>

        <section className="border-b border-slate-200 dark:border-slate-800"><div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-800"><h2 className="text-sm font-semibold">凭证分录</h2><span className="text-xs text-slate-500 dark:text-slate-400">按行号展示当前凭证分录</span></div><div className="hidden lg:block"><table className="w-full table-fixed text-left text-xs"><thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400"><tr><th className="w-[7%] px-4 py-3 font-medium">行号</th><th className="w-[16%] px-4 py-3 font-medium">科目</th><th className="w-[27%] px-4 py-3 font-medium">摘要</th><th className="w-[10%] px-4 py-3 font-medium">方向</th><th className="w-[15%] px-4 py-3 text-right font-medium">金额</th><th className="w-[15%] px-4 py-3 font-medium">辅助核算</th><th className="w-[10%] px-4 py-3 font-medium">单据号</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{entries.map((entry) => <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40"><td className="px-4 py-3 tabular-nums">{entry.line_num}</td><td className="px-4 py-3"><p className="font-mono">{entry.account_code}</p><p className="mt-0.5 truncate text-slate-500 dark:text-slate-400" title={entry.account_name}>{entry.account_name}</p></td><td className="truncate px-4 py-3" title={entry.summary || ''}>{entry.summary || '—'}</td><td className="px-4 py-3">{entry.direction === 'debit' ? '借方' : '贷方'}</td><td className="px-4 py-3 text-right tabular-nums">{formatCurrency(entry.amount)}</td><td className="truncate px-4 py-3" title={entry.auxiliary_type || ''}>{entry.auxiliary_type || '—'}</td><td className="truncate px-4 py-3 font-mono" title={entry.doc_number || ''}>{entry.doc_number || '—'}</td></tr>)}</tbody></table></div><div className="space-y-2 p-3 lg:hidden">{entries.map((entry) => <article key={entry.id} className="border border-slate-200 p-3 dark:border-slate-800"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-mono text-sm font-medium">{entry.account_code}</p><p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400" title={entry.account_name}>{entry.account_name}</p></div><p className="shrink-0 text-sm font-medium tabular-nums">{formatCurrency(entry.amount)}</p></div><div className="mt-3 grid grid-cols-2 gap-3"><Info label="方向" value={entry.direction === 'debit' ? '借方' : '贷方'} /><Info label="辅助核算" value={entry.auxiliary_type || '—'} /></div><p className="mt-3 text-xs leading-5 text-slate-600 dark:text-slate-300">摘要：{entry.summary || '—'}</p></article>)}{entries.length === 0 && <div className="border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">当前凭证没有分录。</div>}</div></section>

        <section><div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-800"><h2 className="text-sm font-semibold">操作留痕</h2><span className="text-xs text-slate-500 dark:text-slate-400">批注和凭证生命周期操作均按时间留痕</span></div><div className="divide-y divide-slate-100 dark:divide-slate-800">{logs.map((log) => <div key={log.id} className="grid gap-2 px-4 py-3 text-xs sm:grid-cols-[10rem_minmax(0,1fr)_8rem]"><p className={`font-medium ${log.operation_type === 'ANNOTATION' ? 'text-sky-700 dark:text-sky-300' : ''}`}>{operationLabel(log)}</p><p className="break-words text-slate-600 dark:text-slate-300">{log.after_data || log.before_data || '未保留可展示的变更摘要'}</p><p className="text-slate-500 dark:text-slate-400">{formatDateTime(log.created_at)}</p></div>)}{logs.length === 0 && <Placeholder message="当前凭证没有可展示的操作日志或批注。" />}</div></section>
      </>}
    </section>
  </main>
}

function Metric({ icon: Icon, label, value, tone = 'text-slate-900 dark:text-slate-100' }: { icon: LucideIcon; label: string; value: string; tone?: string }) {
  return <div className="px-4 py-3"><div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400"><span>{label}</span><Icon className="h-4 w-4" /></div><p className={`mt-1 text-xl font-semibold tabular-nums ${tone}`}>{value}</p></div>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-xs text-slate-500 dark:text-slate-400">{label}</p><p className="mt-1 break-words text-xs leading-5 text-slate-800 dark:text-slate-100">{value}</p></div>
}

function Placeholder({ message }: { message: string }) {
  return <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">{message}</div>
}

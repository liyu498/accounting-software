import { BadgeCheck, Check, CircleAlert, Combine, Copy, FilePlus2, FileText, FileUp, ListChecks, MessageSquarePlus, RefreshCw, RotateCcw, Search, SlidersHorizontal, Trash2, Undo2, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { OperationalExportActions } from '../../components/operations/OperationalExportActions'
import { OperationalPagination } from '../../components/operations/OperationalPagination'
import { VoucherImportDialog } from '../../components/operations/VoucherImportDialog'
import { loadBrowserPreviewBusinessTags, loadBrowserPreviewVoucherTagIds } from '../../lib/browserPreviewBusinessTags.js'
import { loadBrowserPreviewOpenPeriod, previewPeriodLabel } from '../../lib/browserPreviewPeriod'
import { copyLocalVoucherAttachmentAssociations } from '../../lib/localFileRegistry'
import { isTauri } from '../../lib/tauri'
import { createVoucherAnnotationPayloads } from '../../lib/voucherAnnotationWorkflow.js'
import { createMergedVoucherDraft } from '../../lib/voucherMergeWorkflow.js'
import { paginateOperationalRows } from '../../lib/operationalPagination'
import { filterVoucherList, sortVoucherList } from '../../lib/voucherListFilters.js'
import { useBusinessTagStore, type BusinessTag } from '../../stores/businessTagStore'
import { useCompanyStore } from '../../stores/companyStore'
import { usePeriodStore } from '../../stores/periodStore'
import { useVoucherStore, type Voucher } from '../../stores/voucherStore'

type VoucherTab = 'all' | 'draft' | 'approved' | 'unbalanced'
type AttachmentFilter = 'all' | 'with' | 'without'
type VoucherSortMode = 'date-desc' | 'date-asc' | 'number-asc' | 'number-desc' | 'amount-desc' | 'amount-asc' | 'created-desc'

const tabs: Array<{ id: VoucherTab; label: string }> = [
  { id: 'all', label: '全部凭证' },
  { id: 'draft', label: '待审核' },
  { id: 'approved', label: '已审核' },
  { id: 'unbalanced', label: '待平衡' },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(value)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value)
}

function isBalanced(voucher: Voucher) {
  return Math.abs(voucher.total_debit - voucher.total_credit) < 0.005
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

function panelClassName() {
  return 'border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]'
}

export function VoucherWorkspace() {
  const navigate = useNavigate()
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId)
  const selectedCompany = useCompanyStore((state) => state.companies.find((company) => company.id === state.selectedCompanyId))
  const periods = usePeriodStore((state) => state.periods)
  const currentPeriodId = usePeriodStore((state) => state.currentPeriodId)
  const companyId = selectedCompanyId || (isTauri ? null : 'browser-preview-company')
  const browserPreviewPeriod = useMemo(() => isTauri ? undefined : loadBrowserPreviewOpenPeriod(companyId), [companyId])
  const period = periods.find((item) => item.id === currentPeriodId) || browserPreviewPeriod
  const periodId = currentPeriodId || browserPreviewPeriod?.id || null
  const periodLabel = previewPeriodLabel(period) || '未选择账期'
  const periodClosed = period?.status === 'closed'

  const queryVouchers = useVoucherStore((state) => state.queryVouchers)
  const storedBusinessTags = useBusinessTagStore((state) => state.businessTags)
  const storedVoucherTagIds = useBusinessTagStore((state) => state.voucherTagIds)
  const fetchBusinessTags = useBusinessTagStore((state) => state.fetchBusinessTags)
  const fetchVoucherTagIds = useBusinessTagStore((state) => state.fetchVoucherTagIds)
  const replaceVoucherTags = useBusinessTagStore((state) => state.replaceVoucherTags)
  const approveVoucher = useVoucherStore((state) => state.approveVoucher)
  const reverseApproveVoucher = useVoucherStore((state) => state.reverseApproveVoucher)
  const reverseVoucher = useVoucherStore((state) => state.reverseVoucher)
  const copyVoucher = useVoucherStore((state) => state.copyVoucher)
  const deleteVoucher = useVoucherStore((state) => state.deleteVoucher)
  const batchApprove = useVoucherStore((state) => state.batchApprove)
  const batchReverseApprove = useVoucherStore((state) => state.batchReverseApprove)
  const reorganizeNumbers = useVoucherStore((state) => state.reorganizeNumbers)
  const addVoucherAnnotation = useVoucherStore((state) => state.addVoucherAnnotation)
  const addVoucher = useVoucherStore((state) => state.addVoucher)

  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [activeTab, setActiveTab] = useState<VoucherTab>('all')
  const [keyword, setKeyword] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [accountKeyword, setAccountKeyword] = useState('')
  const [tagName, setTagName] = useState('')
  const [attachmentFilter, setAttachmentFilter] = useState<AttachmentFilter>('all')
  const [sortMode, setSortMode] = useState<VoucherSortMode>('date-desc')
  const [showOriginalCurrency, setShowOriginalCurrency] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showAnnotationEditor, setShowAnnotationEditor] = useState(false)
  const [annotationDraft, setAnnotationDraft] = useState('')
  const [previewBusinessTags, setPreviewBusinessTags] = useState<BusinessTag[]>([])
  const [previewVoucherTagIds, setPreviewVoucherTagIds] = useState<Record<string, string[]>>({})

  const refresh = useCallback(async () => {
    if (!companyId || !periodId) {
      setVouchers([])
      setSelectedIds([])
      setPreviewBusinessTags([])
      setPreviewVoucherTagIds({})
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const result = await queryVouchers({ company_id: companyId, period_id: periodId, page: 1, page_size: 100 })
      setVouchers(result)
      setSelectedIds([])
      if (isTauri) {
        await Promise.all([
          fetchBusinessTags(companyId),
          ...result.map((voucher) => fetchVoucherTagIds(voucher.id, companyId)),
        ])
      } else {
        setPreviewBusinessTags(loadBrowserPreviewBusinessTags(companyId))
        setPreviewVoucherTagIds(Object.fromEntries(result.map((voucher) => [voucher.id, loadBrowserPreviewVoucherTagIds(voucher.id, companyId)])))
      }
    } catch (error) {
      setNotice(`读取凭证失败：${String(error)}`)
    } finally {
      setLoading(false)
    }
  }, [companyId, fetchBusinessTags, fetchVoucherTagIds, periodId, queryVouchers])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const businessTags = isTauri ? storedBusinessTags : previewBusinessTags
  const voucherTagIds = isTauri ? storedVoucherTagIds : previewVoucherTagIds
  const tagNamesByVoucher = useMemo(() => Object.fromEntries(vouchers.map((voucher) => [
    voucher.id,
    (voucherTagIds[voucher.id] || []).map((tagId) => businessTags.find((tag) => tag.id === tagId)?.name).filter((name): name is string => Boolean(name)),
  ])), [businessTags, voucherTagIds, vouchers])
  const availableTagNames = useMemo(() => Array.from(new Set(Object.values(tagNamesByVoucher).flat())).sort((left, right) => left.localeCompare(right, 'zh-CN')), [tagNamesByVoucher])

  const visibleVouchers = useMemo(() => filterVoucherList(vouchers, {
    tab: activeTab,
    keyword,
    startDate,
    endDate,
    accountKeyword,
    tagName,
    attachmentFilter,
  }, tagNamesByVoucher) as Voucher[], [accountKeyword, activeTab, attachmentFilter, endDate, keyword, startDate, tagName, tagNamesByVoucher, vouchers])
  const sortedVouchers = useMemo(() => sortVoucherList(visibleVouchers, sortMode) as Voucher[], [sortMode, visibleVouchers])
  const pagination = useMemo(() => paginateOperationalRows(sortedVouchers, page, pageSize), [page, pageSize, sortedVouchers])

  const metrics = useMemo(() => ({
    drafts: vouchers.filter((voucher) => voucher.status === 'draft').length,
    approved: vouchers.filter((voucher) => voucher.status === 'approved').length,
    unbalanced: vouchers.filter((voucher) => !isBalanced(voucher)).length,
    total: vouchers.reduce((sum, voucher) => sum + voucher.total_debit, 0),
  }), [vouchers])

  const selectedDraftIds = useMemo(() => selectedIds.filter((id) => vouchers.some((voucher) => voucher.id === id && voucher.status === 'draft')), [selectedIds, vouchers])
  const selectedApprovedIds = useMemo(() => selectedIds.filter((id) => vouchers.some((voucher) => voucher.id === id && voucher.status === 'approved')), [selectedIds, vouchers])
  const canMutate = Boolean(companyId && periodId && !periodClosed)
  const selectAllIds = pagination.rows.filter((voucher) => voucher.status === 'draft' || voucher.status === 'approved').map((voucher) => voucher.id)
  const allVisibleSelected = selectAllIds.length > 0 && selectAllIds.every((id) => selectedIds.includes(id))

  const ensureWriteAccess = () => {
    if (!companyId || !periodId) {
      setNotice('请先选择账套和账期。')
      return false
    }
    if (periodClosed) {
      setNotice('已结账账期不允许反审核；凭证新增、审核、复制、删除、红冲和断号整理均已禁用。')
      return false
    }
    return true
  }

  const runAction = async (id: string, action: () => Promise<unknown>, successMessage: string) => {
    if (!ensureWriteAccess()) return
    setActionId(id)
    try {
      await action()
      setNotice(successMessage)
      await refresh()
    } catch (error) {
      setNotice(`操作失败：${String(error)}`)
    } finally {
      setActionId(null)
    }
  }

  const handleApprove = (voucher: Voucher) => {
    if (!companyId || voucher.status !== 'draft') return
    void runAction(`approve-${voucher.id}`, () => approveVoucher(voucher.id, companyId), `凭证 ${voucher.voucher_number} 已审核。`)
  }

  const handleReverseApprove = (voucher: Voucher) => {
    if (!companyId || voucher.status !== 'approved') return
    if (periodClosed) {
      setNotice('已结账账期不允许反审核。')
      return
    }
    void runAction(`reverse-approve-${voucher.id}`, () => reverseApproveVoucher(voucher.id, companyId), `凭证 ${voucher.voucher_number} 已反审核。`)
  }

  const handleCopy = (voucher: Voucher) => {
    if (!companyId) return
    void runAction(`copy-${voucher.id}`, async () => {
      const copiedVoucher = await copyVoucher(voucher.id, companyId)
      await copyLocalVoucherAttachmentAssociations(
        { companyId, period: periodLabel },
        voucher.id,
        copiedVoucher.id,
      )
      return copiedVoucher
    }, `已从 ${voucher.voucher_number} 复制一张草稿凭证，并保留其电子附件关联。`)
  }

  const handleDelete = (voucher: Voucher) => {
    if (!companyId || voucher.status !== 'draft') return
    if (!window.confirm(`确认删除草稿凭证 ${voucher.voucher_number} 吗？删除后可在凭证回收站恢复。`)) return
    void runAction(`delete-${voucher.id}`, () => deleteVoucher(voucher.id, companyId), `草稿凭证 ${voucher.voucher_number} 已移入回收站。`)
  }

  const handleReverse = (voucher: Voucher) => {
    if (!companyId || voucher.status !== 'approved') return
    if (!window.confirm(`确认红冲凭证 ${voucher.voucher_number} 吗？红冲会创建新的反向凭证并保留留痕。`)) return
    void runAction(`reverse-${voucher.id}`, () => reverseVoucher(voucher.id, companyId), `已为 ${voucher.voucher_number} 创建红冲凭证。`)
  }

  const handleBatchApprove = () => {
    if (!companyId) return
    const selectedIds = selectedDraftIds
    if (selectedIds.length === 0) {
      setNotice('请先勾选待审核凭证。')
      return
    }
    void runAction('batch-approve', () => batchApprove(selectedIds, companyId), `已批量审核 ${selectedIds.length} 张凭证。`)
  }

  const handleBatchReverseApprove = () => {
    if (!companyId) return
    if (periodClosed) {
      setNotice('已结账账期不允许反审核。')
      return
    }
    const approvedIds = selectedApprovedIds
    if (approvedIds.length === 0) {
      setNotice('请先勾选已审核凭证。')
      return
    }
    void runAction('batch-reverse-approve', () => batchReverseApprove(approvedIds, companyId), `已批量反审核 ${approvedIds.length} 张凭证。`)
  }

  const handleBatchDelete = () => {
    if (!companyId || selectedDraftIds.length === 0) {
      setNotice('请先勾选待审核草稿凭证。')
      return
    }
    if (!window.confirm(`确认批量删除 ${selectedDraftIds.length} 张草稿凭证吗？删除后可在凭证回收站恢复。`)) return
    void runAction('batch-delete', () => Promise.all(selectedDraftIds.map((id) => deleteVoucher(id, companyId))), `已将 ${selectedDraftIds.length} 张草稿凭证移入回收站。`)
  }

  const handleMergeDrafts = async () => {
    if (!companyId || !periodId) {
      setNotice('请先选择账套和账期。')
      return
    }
    if (selectedDraftIds.length < 2) {
      setNotice('请至少勾选两张草稿凭证后再合并。')
      return
    }
    setActionId('merge-drafts')
    try {
      const sources = selectedDraftIds
        .map((id) => vouchers.find((voucher) => voucher.id === id))
        .filter((voucher): voucher is Voucher => Boolean(voucher))
      const input = createMergedVoucherDraft(sources, 'admin')
      const merged = await addVoucher(input)
      for (const source of sources) {
        await copyLocalVoucherAttachmentAssociations(
          { companyId, period: periodLabel },
          source.id,
          merged.id,
        )
      }

      const inheritedTagIds = Array.from(
        new Set(sources.flatMap((source) => voucherTagIds[source.id] || [])),
      )
      const sourceNumbers = sources.map((source) => source.voucher_number).join('、')
      const followUpWrites = [
        replaceVoucherTags(merged.id, companyId, inheritedTagIds),
        addVoucherAnnotation({
          voucherId: merged.id,
          companyId,
          content: `由 ${sourceNumbers} 非破坏性合并生成，原凭证保持不变。`,
        }),
        ...sources.map((source) => addVoucherAnnotation({
          voucherId: source.id,
          companyId,
          content: `已合并生成草稿凭证 ${merged.voucher_number}，本凭证未删除。`,
        })),
      ]
      const followUpResults = await Promise.allSettled(followUpWrites)
      const followUpFailures = followUpResults.filter((result) => result.status === 'rejected').length
      await refresh()
      setNotice(followUpFailures
        ? `已生成合并草稿 ${merged.voucher_number}，但有 ${followUpFailures} 项标签或批注留痕写入失败，请进入详情复核。`
        : `已将 ${sources.length} 张草稿非破坏性合并为 ${merged.voucher_number}，原凭证保持不变。`)
    } catch (error) {
      setNotice(`合并凭证失败：${String(error)}`)
    } finally {
      setActionId(null)
    }
  }

  const handleBatchAnnotation = async () => {
    if (!companyId) {
      setNotice('请先选择账套。')
      return
    }
    setActionId('batch-annotation')
    try {
      const payloads = createVoucherAnnotationPayloads({
        voucherIds: selectedIds,
        companyId,
        content: annotationDraft,
      })
      await Promise.all(payloads.map((payload) => addVoucherAnnotation(payload)))
      setAnnotationDraft('')
      setShowAnnotationEditor(false)
      setNotice(`已为 ${payloads.length} 张凭证添加批注。`)
    } catch (error) {
      setNotice(`添加批注失败：${String(error)}`)
    } finally {
      setActionId(null)
    }
  }

  const handleReorganizeNumbers = () => {
    if (!companyId || !periodId) return
    if (!window.confirm(`确认整理 ${periodLabel} 的凭证断号吗？系统会重新编排当前账期凭证字号。`)) return
    void runAction('reorganize', () => reorganizeNumbers(periodId, companyId), '当前账期凭证字号已整理。')
  }

  const toggleVoucher = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  const toggleAll = () => {
    setSelectedIds(allVisibleSelected ? [] : selectAllIds)
  }

  const resetFilters = () => {
    setKeyword('')
    setStartDate('')
    setEndDate('')
    setAccountKeyword('')
    setTagName('')
    setAttachmentFilter('all')
    setPage(1)
  }

  const renderActions = (voucher: Voucher) => <div className="flex flex-wrap justify-end gap-1.5">
    <button type="button" onClick={() => navigate(`/vouchers/detail/${voucher.id}`)} className="inline-flex h-7 items-center gap-1 border border-slate-300 px-2 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800" title="查看凭证"><FileText className="h-3.5 w-3.5" />查看</button>
    {voucher.status === 'draft' && <button type="button" disabled={!canMutate || actionId === `approve-${voucher.id}`} onClick={() => handleApprove(voucher)} className="inline-flex h-7 items-center gap-1 border border-emerald-300 px-2 text-xs text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"><BadgeCheck className="h-3.5 w-3.5" />审核</button>}
    {voucher.status === 'approved' && <button type="button" disabled={!canMutate || actionId === `reverse-approve-${voucher.id}`} onClick={() => handleReverseApprove(voucher)} className="inline-flex h-7 items-center gap-1 border border-amber-300 px-2 text-xs text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/30"><Undo2 className="h-3.5 w-3.5" />反审核</button>}
    <button type="button" disabled={!canMutate || actionId === `copy-${voucher.id}`} onClick={() => handleCopy(voucher)} className="inline-flex h-7 items-center gap-1 border border-slate-300 px-2 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800" title="复制为草稿"><Copy className="h-3.5 w-3.5" />复制</button>
    {voucher.status === 'draft' && <button type="button" disabled={!canMutate || actionId === `delete-${voucher.id}`} onClick={() => handleDelete(voucher)} className="inline-flex h-7 items-center gap-1 border border-rose-300 px-2 text-xs text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/30" title="删除草稿并移入回收站"><Trash2 className="h-3.5 w-3.5" />删除</button>}
    {voucher.status === 'approved' && <button type="button" disabled={!canMutate || actionId === `reverse-${voucher.id}`} onClick={() => handleReverse(voucher)} className="inline-flex h-7 items-center gap-1 border border-rose-300 px-2 text-xs text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/30" title="红冲凭证"><RotateCcw className="h-3.5 w-3.5" />红冲</button>}
  </div>

  return <main className="min-h-full min-w-0 bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
    <section className={panelClassName()} data-operational-export-root>
      <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" /><h1 className="text-base font-semibold">会计凭证</h1></div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">按账套与账期处理凭证草稿、审核、反审核、红冲、复制和断号整理。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <OperationalExportActions title="会计凭证清单" companyName={selectedCompany?.name} periodLabel={periodLabel} exportHeaders={['凭证字号', '日期', '摘要', '来源参考号', '业务标签', '制单人', '审核人', '借方金额', '贷方金额', '附件', '审核状态']} exportRows={sortedVouchers.map((voucher) => [voucher.voucher_number, voucher.voucher_date, voucher.summary || '未填写摘要', voucher.reference_number || '未设置', (tagNamesByVoucher[voucher.id] || []).join(' / ') || '未设置', voucher.created_by || '未记录', voucher.approved_by || '未审核', formatCurrency(voucher.total_debit), formatCurrency(voucher.total_credit), `${voucher.attachment_count || 0} 张`, statusLabel(voucher.status)])} onNotice={setNotice} />
          <button type="button" disabled={!canMutate} onClick={() => setShowImportDialog(true)} className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><FileUp className="h-3.5 w-3.5" />批量导入</button>
          <button type="button" onClick={() => void refresh()} className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><RefreshCw className="h-3.5 w-3.5" />刷新</button>
          <button type="button" disabled={!periodId || periodClosed} onClick={() => navigate('/vouchers/new')} className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-50"><FilePlus2 className="h-3.5 w-3.5" />新增凭证</button>
        </div>
      </header>

      <div className="grid gap-3 border-b border-slate-200 p-3 lg:grid-cols-[minmax(0,1fr)_20rem] dark:border-slate-800">
        <div className="border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-100"><div className="flex items-center gap-1.5 font-medium"><ListChecks className="h-3.5 w-3.5" />处理范围</div><p className="mt-1">当前账套：{selectedCompany?.name || (companyId ? '浏览器预览账套' : '未选择')}；当前账期：{periodLabel}。列表只读取该账期内未删除凭证。</p></div>
        <div className="border border-slate-200 px-3 py-2 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:text-slate-300"><p className="font-medium text-slate-800 dark:text-slate-100">操作边界</p><p className="mt-1">{periodClosed ? '已结账账期不允许反审核。' : '审核、反审核和红冲只更新当前本地账套，并保留操作状态。'}</p></div>
      </div>

      <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
        <Metric icon={FileText} label="本期凭证" value={`${vouchers.length} 张`} />
        <Metric icon={BadgeCheck} label="已审核" value={`${metrics.approved} 张`} tone="text-emerald-600 dark:text-emerald-400" />
        <Metric icon={CircleAlert} label="待审核" value={`${metrics.drafts} 张`} tone="text-amber-600 dark:text-amber-400" />
        <Metric icon={CircleAlert} label="待平衡" value={`${metrics.unbalanced} 张`} tone={metrics.unbalanced ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'} />
      </div>

      <div className="flex flex-col gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1">{tabs.map((tab) => <button key={tab.id} type="button" onClick={() => { setActiveTab(tab.id); setPage(1) }} className={`h-8 border px-3 text-xs ${activeTab === tab.id ? 'border-[#1f65a7] bg-blue-50 text-[#174f82] dark:border-sky-500 dark:bg-sky-950/30 dark:text-sky-300' : 'border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>{tab.label}</button>)}</div>
        <div className="flex w-full min-w-0 flex-wrap gap-2 lg:w-auto"><label className="relative block min-w-52 flex-1 lg:w-72"><Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-400" /><input value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1) }} placeholder="搜索凭证、科目、来源或人员" className="h-8 w-full border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500" /></label><select aria-label="凭证排序" value={sortMode} onChange={(event) => { setSortMode(event.target.value as VoucherSortMode); setPage(1) }} className="h-8 border border-slate-300 bg-white px-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-200"><option value="date-desc">日期从新到旧</option><option value="date-asc">日期从旧到新</option><option value="number-asc">凭证号升序</option><option value="number-desc">凭证号降序</option><option value="amount-desc">金额从高到低</option><option value="amount-asc">金额从低到高</option><option value="created-desc">制单时间从新到旧</option></select><button type="button" aria-pressed={showOriginalCurrency} onClick={() => setShowOriginalCurrency((current) => !current)} className={`inline-flex h-8 shrink-0 items-center border px-3 text-xs ${showOriginalCurrency ? 'border-[#1f65a7] bg-blue-50 text-[#174f82] dark:border-sky-500 dark:bg-sky-950/30 dark:text-sky-300' : 'border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'}`}>{showOriginalCurrency ? '隐藏原币' : '显示原币'}</button><button type="button" aria-expanded={showFilters} onClick={() => setShowFilters((current) => !current)} className={`inline-flex h-8 shrink-0 items-center gap-1 border px-3 text-xs ${showFilters ? 'border-[#1f65a7] bg-blue-50 text-[#174f82] dark:border-sky-500 dark:bg-sky-950/30 dark:text-sky-300' : 'border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'}`}><SlidersHorizontal className="h-3.5 w-3.5" />显示查询条件</button></div>
      </div>

      {showFilters && <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-5 dark:border-slate-800 dark:bg-[#0d1423]">
        <label className="text-xs text-slate-600 dark:text-slate-300">开始日期<input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setPage(1) }} className="mt-1 h-8 w-full border border-slate-300 bg-white px-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100" /></label>
        <label className="text-xs text-slate-600 dark:text-slate-300">结束日期<input type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); setPage(1) }} className="mt-1 h-8 w-full border border-slate-300 bg-white px-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100" /></label>
        <label className="text-xs text-slate-600 dark:text-slate-300">科目<input value={accountKeyword} onChange={(event) => { setAccountKeyword(event.target.value); setPage(1) }} placeholder="科目编码或名称" className="mt-1 h-8 w-full border border-slate-300 bg-white px-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100" /></label>
        <label className="text-xs text-slate-600 dark:text-slate-300">业务标签<select value={tagName} onChange={(event) => { setTagName(event.target.value); setPage(1) }} className="mt-1 h-8 w-full border border-slate-300 bg-white px-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100"><option value="">全部标签</option>{availableTagNames.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
        <div className="flex min-w-0 items-end gap-2"><label className="min-w-0 flex-1 text-xs text-slate-600 dark:text-slate-300">附件状态<select value={attachmentFilter} onChange={(event) => { setAttachmentFilter(event.target.value as AttachmentFilter); setPage(1) }} className="mt-1 h-8 w-full border border-slate-300 bg-white px-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100"><option value="all">全部</option><option value="with">有附件</option><option value="without">无附件</option></select></label><button type="button" onClick={resetFilters} className="h-8 shrink-0 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">重置筛选</button></div>
      </div>}

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-800"><p className="text-xs text-slate-500 dark:text-slate-400">已选 {selectedIds.length} 张。批量操作仅作用于符合状态的当前筛选结果。</p><div className="flex flex-wrap gap-2"><button type="button" disabled={!companyId || selectedIds.length === 0 || actionId !== null} onClick={() => setShowAnnotationEditor((current) => !current)} className="inline-flex h-8 items-center gap-1 border border-sky-300 px-3 text-xs text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"><MessageSquarePlus className="h-3.5 w-3.5" />批量批注</button><button type="button" disabled={!canMutate || selectedDraftIds.length < 2 || actionId !== null} onClick={() => void handleMergeDrafts()} className="inline-flex h-8 items-center gap-1 border border-sky-300 px-3 text-xs text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"><Combine className="h-3.5 w-3.5" />合并为草稿</button><button type="button" disabled={!canMutate || selectedDraftIds.length === 0 || actionId === 'batch-approve'} onClick={handleBatchApprove} className="inline-flex h-8 items-center gap-1 border border-emerald-300 px-3 text-xs text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"><Check className="h-3.5 w-3.5" />批量审核</button><button type="button" disabled={!canMutate || selectedApprovedIds.length === 0 || actionId === 'batch-reverse-approve'} onClick={handleBatchReverseApprove} className="inline-flex h-8 items-center gap-1 border border-amber-300 px-3 text-xs text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/30"><Undo2 className="h-3.5 w-3.5" />批量反审核</button><button type="button" disabled={!canMutate || selectedDraftIds.length === 0 || actionId === 'batch-delete'} onClick={handleBatchDelete} className="inline-flex h-8 items-center gap-1 border border-rose-300 px-3 text-xs text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/30"><Trash2 className="h-3.5 w-3.5" />批量删除</button><button type="button" disabled={!canMutate || actionId === 'reorganize'} onClick={handleReorganizeNumbers} className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><RotateCcw className="h-3.5 w-3.5" />整理断号</button></div></div>
      {showAnnotationEditor && <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-[#0d1423] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end"><label className="min-w-0 text-xs text-slate-600 dark:text-slate-300">批注内容<textarea value={annotationDraft} onChange={(event) => setAnnotationDraft(event.target.value)} maxLength={500} rows={2} placeholder="记录复核意见、待补资料或处理说明" className="mt-1 w-full resize-y border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100 dark:focus:border-sky-500" /></label><div className="flex gap-2"><button type="button" onClick={() => { setShowAnnotationEditor(false); setAnnotationDraft('') }} className="h-8 border border-slate-300 px-3 text-xs text-slate-700 dark:border-slate-700 dark:text-slate-200">取消</button><button type="button" disabled={actionId === 'batch-annotation'} onClick={() => void handleBatchAnnotation()} className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white disabled:opacity-50 dark:bg-sky-600"><MessageSquarePlus className="h-3.5 w-3.5" />{actionId === 'batch-annotation' ? '保存中' : '保存批注'}</button></div></div>}

      {notice && <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200">{notice}</div>}
      {!companyId && <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">请选择账套后查看凭证。</div>}
      {companyId && !periodId && <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">请选择有效账期后查看本期凭证。</div>}
      {companyId && periodId && loading && <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">正在读取当前账期凭证...</div>}
      {companyId && periodId && !loading && <>
        <div className="hidden lg:block"><table className="w-full table-fixed text-left text-xs"><thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400"><tr><th className="w-[4%] px-3 py-3"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} aria-label="选择当前页凭证" /></th><th className="w-[10%] px-3 py-3 font-medium">凭证字号</th><th className="w-[10%] px-3 py-3 font-medium">日期</th><th className="w-[25%] px-3 py-3 font-medium">摘要、科目与业务标签</th><th className="w-[9%] px-3 py-3 text-right font-medium">借方金额</th><th className="w-[9%] px-3 py-3 text-right font-medium">贷方金额</th><th className="w-[8%] px-3 py-3 text-center font-medium">附件</th><th className="w-[9%] px-3 py-3 font-medium">审核状态</th><th className="w-[16%] px-3 py-3 text-right font-medium">操作</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{pagination.rows.map((voucher) => <tr key={voucher.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40"><td className="px-3 py-3"><input type="checkbox" disabled={!['draft', 'approved'].includes(voucher.status)} checked={selectedIds.includes(voucher.id)} onChange={() => toggleVoucher(voucher.id)} aria-label={`选择凭证 ${voucher.voucher_number}`} /></td><td className="truncate px-3 py-3 font-mono" title={voucher.voucher_number}>{voucher.voucher_number}</td><td className="whitespace-nowrap px-3 py-3">{voucher.voucher_date}</td><td className="px-3 py-3"><p className="truncate" title={voucher.summary || ''}>{voucher.summary || '未填写摘要'}</p>{voucher.reference_number && <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400" title={`来源参考号：${voucher.reference_number}`}>来源参考号：{voucher.reference_number}</p>}{(tagNamesByVoucher[voucher.id] || []).length > 0 && <div className="mt-1 flex min-w-0 flex-wrap gap-1">{tagNamesByVoucher[voucher.id].map((name) => <span key={name} className="max-w-full truncate border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[11px] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-300">{name}</span>)}</div>}<VoucherEntryPreview voucher={voucher} showOriginalCurrency={showOriginalCurrency} /><VoucherAuditPreview voucher={voucher} /></td><td className={`px-3 py-3 text-right tabular-nums ${isBalanced(voucher) ? '' : 'text-rose-600 dark:text-rose-300'}`}>{formatCurrency(voucher.total_debit)}</td><td className={`px-3 py-3 text-right tabular-nums ${isBalanced(voucher) ? '' : 'text-rose-600 dark:text-rose-300'}`}>{formatCurrency(voucher.total_credit)}</td><td className="px-3 py-3 text-center tabular-nums">{voucher.attachment_count || 0}</td><td className="px-3 py-3"><span className={`inline-flex border px-2 py-0.5 text-xs ${statusClass(voucher.status)}`}>{statusLabel(voucher.status)}</span></td><td className="px-3 py-3">{renderActions(voucher)}</td></tr>)}</tbody></table></div>
        <div className="space-y-2 p-3 lg:hidden">{pagination.rows.map((voucher) => <article key={voucher.id} className="border border-slate-200 p-3 dark:border-slate-800"><div className="flex items-start gap-3"><input className="mt-1" type="checkbox" disabled={!['draft', 'approved'].includes(voucher.status)} checked={selectedIds.includes(voucher.id)} onChange={() => toggleVoucher(voucher.id)} aria-label={`选择凭证 ${voucher.voucher_number}`} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-mono text-sm font-medium" title={voucher.voucher_number}>{voucher.voucher_number}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{voucher.voucher_date} · 附件 {voucher.attachment_count || 0} 张</p></div><span className={`shrink-0 border px-2 py-0.5 text-xs ${statusClass(voucher.status)}`}>{statusLabel(voucher.status)}</span></div><p className="mt-3 truncate text-xs text-slate-700 dark:text-slate-200" title={voucher.summary || ''}>{voucher.summary || '未填写摘要'}</p>{voucher.reference_number && <p className="mt-1 break-all text-[11px] text-slate-500 dark:text-slate-400">来源参考号：{voucher.reference_number}</p>}{(tagNamesByVoucher[voucher.id] || []).length > 0 && <div className="mt-2 flex min-w-0 flex-wrap gap-1">{tagNamesByVoucher[voucher.id].map((name) => <span key={name} className="max-w-full truncate border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[11px] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-300">{name}</span>)}</div>}<VoucherEntryPreview voucher={voucher} showOriginalCurrency={showOriginalCurrency} /><VoucherAuditPreview voucher={voucher} /><div className="mt-3 grid grid-cols-2 gap-3"><Info label="借方金额" value={formatCurrency(voucher.total_debit)} tone={isBalanced(voucher) ? undefined : 'text-rose-600 dark:text-rose-300'} /><Info label="贷方金额" value={formatCurrency(voucher.total_credit)} tone={isBalanced(voucher) ? undefined : 'text-rose-600 dark:text-rose-300'} /></div><div className="mt-3">{renderActions(voucher)}</div></div></div></article>)}{visibleVouchers.length === 0 && <div className="border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">当前筛选范围没有凭证。</div>}</div>
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400"><span>显示 {visibleVouchers.length} / {vouchers.length} 张，金额单位：元</span><span>本期借方合计 {formatCurrency(metrics.total)}</span></div>
        <OperationalPagination page={pagination} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} />
      </>}
    </section>
    {showImportDialog && companyId && periodId && <VoucherImportDialog companyId={companyId} periodId={periodId} onClose={() => setShowImportDialog(false)} onImported={async (message) => { setNotice(message); await refresh() }} />}
  </main>
}

function Metric({ icon: Icon, label, value, tone = 'text-slate-900 dark:text-slate-100' }: { icon: LucideIcon; label: string; value: string; tone?: string }) {
  return <div className="px-4 py-3"><div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400"><span>{label}</span><Icon className="h-4 w-4" /></div><p className={`mt-1 text-xl font-semibold tabular-nums ${tone}`}>{value}</p></div>
}

function Info({ label, value, tone = 'text-slate-900 dark:text-slate-100' }: { label: string; value: string; tone?: string }) {
  return <div><p className="text-xs text-slate-500 dark:text-slate-400">{label}</p><p className={`mt-1 text-sm font-medium tabular-nums ${tone}`}>{value}</p></div>
}

function VoucherEntryPreview({ voucher, showOriginalCurrency }: { voucher: Voucher; showOriginalCurrency: boolean }) {
  if (!voucher.entries.length) return null
  return <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
    {voucher.entries.slice(0, 2).map((entry) => {
      const hasOriginalCurrency = showOriginalCurrency && entry.currency_id && entry.exchange_rate && entry.exchange_rate > 0 && Math.abs(entry.exchange_rate - 1) > 0.000001
      const originalText = hasOriginalCurrency ? ` · 原币 ${formatNumber(entry.amount / entry.exchange_rate!)} ${entry.currency_id} @ ${formatNumber(entry.exchange_rate!)}` : ''
      return <p key={entry.id || `${entry.line_num}-${entry.account_code}`} className="truncate" title={`${entry.account_code} ${entry.account_name}${originalText}`}><span className="font-mono">{entry.account_code}</span> {entry.account_name} · {entry.direction === 'debit' ? '借' : '贷'} {formatCurrency(entry.amount)}{originalText}</p>
    })}
    {voucher.entries.length > 2 && <p>{voucher.entries.length - 2} 条更多分录</p>}
  </div>
}

function VoucherAuditPreview({ voucher }: { voucher: Voucher }) {
  return <p className="mt-2 truncate text-[11px] text-slate-400 dark:text-slate-500" title={`制单人：${voucher.created_by || '未记录'}；审核人：${voucher.approved_by || '未审核'}`}>
    制单人：{voucher.created_by || '未记录'} · 审核人：{voucher.approved_by || '未审核'}
  </p>
}

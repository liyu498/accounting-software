import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useToast, useSuccessToast, useWarningToast } from '../components/ui/Toast'
import {
  Plus,
  Search,
  Trash2,
  Check,
  Copy,
  RotateCcw,
  Pencil,
  FileText,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Trash,
  Upload,
  FileDown,
  X,
} from 'lucide-react'
import { cn, formatCurrency } from '../lib/utils'
import { TableSkeleton } from '../components/ui/Skeleton'
import { useVoucherStore, Voucher } from '../stores/voucherStore'
import { useCompanyStore } from '../stores/companyStore'
import { usePeriodStore } from '../stores/periodStore'
import { useAuthStore } from '../stores/authStore'
import { VoucherImportModal } from '../components/voucher/VoucherImportModal'

export function VoucherList() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const successToast = useSuccessToast()
  const warningToast = useWarningToast()
  const { user } = useAuthStore()

  const {
    vouchers,
    isLoading,
    queryVouchers,
    deleteVoucher,
    updateVoucher,
    approveVoucher,
    reverseApproveVoucher,
    copyVoucher,
    reverseVoucher,
    reorganizeNumbers,
    batchApprove,
    deleteCompanyVouchers,
    exportVouchersExcel,
  } = useVoucherStore()

  const { selectedCompanyId } = useCompanyStore()
  const { periods, currentPeriodId, setCurrentPeriod } = usePeriodStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [pageSize, setPageSize] = useState<number>(50)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const [showImportModal, setShowImportModal] = useState(false)

  const operator = user?.username || user?.realName || 'admin'

  useEffect(() => {
    if (selectedCompanyId) {
      queryVouchers({
        company_id: selectedCompanyId,
        period_id: currentPeriodId || undefined,
        keyword: searchQuery || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        page: 1,
        page_size: pageSize,
      })
    }
  }, [selectedCompanyId, currentPeriodId, searchQuery, statusFilter, pageSize, queryVouchers])

  const handleDeleteVoucher = async (voucher: Voucher) => {
    if (voucher.status !== 'draft') {
      warningToast('只能删除草稿状态的凭证')
      return
    }
    if (!confirm(`确定要删除凭证 ${voucher.voucher_number} 吗？`)) return
    try {
      await deleteVoucher(voucher.id, selectedCompanyId || '')
      successToast('凭证已删除')
    } catch (error) {
      addToast('删除失败: ' + String(error), 'error')
    }
  }

  const handleApproveVoucher = async (voucher: Voucher) => {
    try {
      await approveVoucher(voucher.id, operator, selectedCompanyId || '')
      successToast(`凭证 ${voucher.voucher_number} 已审核`)
    } catch (error) {
      addToast('审核失败: ' + String(error), 'error')
    }
  }

  const handleReverseApproveVoucher = async (voucher: Voucher) => {
    try {
      await reverseApproveVoucher(voucher.id, selectedCompanyId || '')
      successToast(`凭证 ${voucher.voucher_number} 已反审核`)
    } catch (error) {
      addToast('反审核失败: ' + String(error), 'error')
    }
  }

  const handleCopyVoucher = async (voucher: Voucher) => {
    try {
      await copyVoucher(voucher.id, selectedCompanyId || '')
      successToast(`凭证 ${voucher.voucher_number} 已复制`)
    } catch (error) {
      addToast('复制失败: ' + String(error), 'error')
    }
  }

  const handleInsertVoucher = async (voucher: Voucher) => {
    if (!currentPeriodId) {
      warningToast('请先选择会计期间')
      return
    }
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const newVoucher = await invoke('insert_voucher', {
        periodId: currentPeriodId,
        insertAfterSeq: voucher.sequence_num,
        companyId: selectedCompanyId,
      })
      successToast(`已在凭证 ${voucher.voucher_number} 后插入新凭证`)
      queryVouchers({
        company_id: selectedCompanyId!,
        period_id: currentPeriodId,
        keyword: searchQuery || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        page: 1,
        page_size: pageSize,
      })
      navigate(`/vouchers/edit/${(newVoucher as { id: string }).id}`)
    } catch (error) {
      addToast('插入凭证失败: ' + String(error), 'error')
    }
  }

  const handleReverseVoucher = async (voucher: Voucher) => {
    if (!confirm(`确定要红冲凭证 ${voucher.voucher_number} 吗？`)) return
    try {
      await reverseVoucher(voucher.id, selectedCompanyId || '', operator)
      successToast(`凭证 ${voucher.voucher_number} 已红冲`)
    } catch (error) {
      addToast('红冲失败: ' + String(error), 'error')
    }
  }

  const handleBatchApprove = async () => {
    if (selectedIds.size === 0) {
      warningToast('请先选择凭证')
      return
    }
    try {
      await batchApprove(Array.from(selectedIds), operator, selectedCompanyId || '')
      successToast(`已批量审核 ${selectedIds.size} 张凭证`)
      setSelectedIds(new Set())
    } catch (error) {
      addToast('批量审核失败: ' + String(error), 'error')
    }
  }

  const handleReorganize = async () => {
    if (!currentPeriodId) return
    try {
      await reorganizeNumbers(currentPeriodId, selectedCompanyId || '')
      successToast('凭证号已重新整理')
    } catch (error) {
      addToast('整理失败: ' + String(error), 'error')
    }
  }

  const handleDeleteCompanyVouchers = async () => {
    if (!selectedCompanyId) return
    if (!confirm('确定要删除当前公司所有草稿凭证吗？此操作不可撤销。')) return
    try {
      const count = await deleteCompanyVouchers(selectedCompanyId)
      successToast(`已删除 ${count} 张凭证`)
    } catch (error) {
      addToast('删除失败: ' + String(error), 'error')
    }
  }

  const handleExportExcel = async () => {
    if (!selectedCompanyId) return
    try {
      const path = await exportVouchersExcel(selectedCompanyId, currentPeriodId || undefined)
      successToast(`已导出Excel到临时目录`)
    } catch (error) {
      addToast('导出失败: ' + String(error), 'error')
    }
  }

  const handleExportPdf = () => {
    // Build printable HTML
    const periodLabel = currentPeriodId
      ? periods.find((p) => p.id === currentPeriodId)
      : null
    const title = periodLabel
      ? `凭证列表 - ${periodLabel.period_year}年${String(periodLabel.period_month).padStart(2, '0')}月`
      : '凭证列表'

    const rows = vouchers
      .map(
        (v) =>
          v.entries
            ?.map(
              (e) => `
            <tr>
              <td>${v.voucher_date}</td>
              <td>${v.voucher_number}</td>
              <td>${e.summary || ''}</td>
              <td>${e.account_code} ${e.account_name}</td>
              <td style="text-align:right">${e.direction === 'debit' ? e.amount.toFixed(2) : ''}</td>
              <td style="text-align:right">${e.direction === 'credit' ? e.amount.toFixed(2) : ''}</td>
            </tr>`,
            )
            .join('') || '',
      )
      .join('')

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body { font-family: 'Microsoft YaHei', sans-serif; padding: 20px; }
  h2 { text-align: center; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #ddd; padding: 4px 6px; }
  th { background: #f5f5f5; }
  .total { font-weight: bold; }
</style></head><body>
<h2>${title}</h2>
<table>
<thead><tr>
  <th>日期</th><th>凭证号</th><th>摘要</th><th>科目</th><th>借方</th><th>贷方</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>
<script>window.onload=function(){window.print()}</script>
</body></html>`

    const w = window.open('', '_blank', 'width=900,height=700')
    if (w) {
      w.document.write(html)
      w.document.close()
    }
  }

  const handleDownloadTemplate = async () => {
    if (!selectedCompanyId) return
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const path = await invoke<string>('download_voucher_template', { companyId: selectedCompanyId })
      successToast('模板已下载: ' + path)
    } catch (error) {
      addToast('下载模板失败: ' + String(error), 'error')
    }
  }

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) {
      warningToast('请先选择凭证')
      return
    }
    const draftIds = Array.from(selectedIds).filter((id) => {
      const v = vouchers.find((v) => v.id === id)
      return v?.status === 'draft'
    })
    if (draftIds.length === 0) {
      warningToast('只能删除草稿状态的凭证')
      return
    }
    if (!confirm(`确定要删除选中的 ${draftIds.length} 张草稿凭证吗？`)) return
    try {
      for (const id of draftIds) {
        await deleteVoucher(id, selectedCompanyId || '')
      }
      successToast(`已删除 ${draftIds.length} 张凭证`)
      setSelectedIds(new Set())
    } catch (error) {
      addToast('批量删除失败: ' + String(error), 'error')
    }
  }

  const handleBatchReverseApprove = async () => {
    if (selectedIds.size === 0) {
      warningToast('请先选择凭证')
      return
    }
    const approvedIds = Array.from(selectedIds).filter((id) => {
      const v = vouchers.find((v) => v.id === id)
      return v?.status === 'approved'
    })
    if (approvedIds.length === 0) {
      warningToast('只能反审核已审核状态的凭证')
      return
    }
    if (!confirm(`确定要反审核选中的 ${approvedIds.length} 张凭证吗？`)) return
    try {
      await useVoucherStore.getState().batchReverseApprove(approvedIds, selectedCompanyId || '')
      successToast(`已反审核 ${approvedIds.length} 张凭证`)
      setSelectedIds(new Set())
    } catch (error) {
      addToast('批量反审核失败: ' + String(error), 'error')
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const statusLabels: Record<string, string> = {
    draft: '草稿',
    approved: '已审核',
    reversed: '已冲销',
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-amber-100 text-amber-800',
    approved: 'bg-green-100 text-green-800',
    reversed: 'bg-red-100 text-red-800',
  }

  const allSelected = vouchers.length > 0 && selectedIds.size === vouchers.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">凭证管理</h1>
          <p className="text-gray-500 mt-1">共 {vouchers.length} 张凭证</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.size > 0 && (
            <>
              <Button variant="outline" onClick={handleBatchApprove} >
                <Check className="w-4 h-4 mr-2" />
                批量审核 ({selectedIds.size})
              </Button>
              <Button variant="outline" onClick={handleBatchReverseApprove} >
                <RotateCcw className="w-4 h-4 mr-2" />
                批量反审核
              </Button>
              <Button variant="outline" onClick={handleBatchDelete} className="text-red-500 hover:text-red-700">
                <Trash2 className="w-4 h-4 mr-2" />
                批量删除
              </Button>
            </>
          )}
          <Button variant="outline" onClick={handleReorganize}>
            重新编号
          </Button>
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <FileDown className="w-4 h-4 mr-2" />
            下载模板
          </Button>
          <Button variant="outline" onClick={() => setShowImportModal(true)}>
            <Upload className="w-4 h-4 mr-2" />
            导入凭证
          </Button>
          <Button variant="outline" onClick={handleExportExcel}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            导出Excel
          </Button>
          <Button variant="outline" onClick={handleExportPdf}>
            <Download className="w-4 h-4 mr-2" />
            导出PDF
          </Button>
          <Button variant="outline" onClick={handleDeleteCompanyVouchers} className="text-red-500 hover:text-red-700">
            <Trash className="w-4 h-4 mr-2" />
            删除草稿
          </Button>
          <Button onClick={() => navigate('/vouchers/new')}>
            <Plus className="w-4 h-4 mr-2" />
            新建凭证
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="搜索凭证号/摘要/科目..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm"
              title="状态筛选"
            >
              <option value="all">全部状态</option>
              <option value="draft">草稿</option>
              <option value="approved">已审核</option>
              <option value="reversed">已冲销</option>
            </select>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm"
              title="每页显示"
            >
              <option value={20}>每页 20 条</option>
              <option value={50}>每页 50 条</option>
              <option value={100}>每页 100 条</option>
              <option value={200}>每页 200 条</option>
              <option value={500}>每页 500 条</option>
            </select>
            <select
              value={currentPeriodId || ''}
              onChange={(e) => setCurrentPeriod(e.target.value || null)}
              className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm"
              title="会计期间"
            >
              <option value="">全部期间</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.period_year}年{String(p.period_month).padStart(2, '0')}月
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => {
                  if (allSelected) setSelectedIds(new Set())
                  else setSelectedIds(new Set(vouchers.map((v) => v.id)))
                }}
                className="rounded border-gray-300"
              />
              全选
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Voucher list — entry-level view */}
      {isLoading ? (
        <Card>
          <CardContent>
            <TableSkeleton rows={6} cols={7} />
          </CardContent>
        </Card>
      ) : vouchers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            暂无凭证数据
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {vouchers.map((voucher) => {
            const isSelected = selectedIds.has(voucher.id)
            const isCollapsed = collapsedIds.has(voucher.id)
            const entries = voucher.entries || []

            return (
              <div
                key={voucher.id}
                className={cn(
                  'border rounded-lg overflow-hidden transition-colors',
                  isSelected ? 'border-primary-400 bg-blue-50/50' : 'border-gray-200 bg-white',
                )}
              >
                {/* Voucher header */}
                <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50/80 border-b border-gray-100">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(voucher.id)}
                    className="rounded border-gray-300 flex-shrink-0"
                    title={`选择凭证 ${voucher.voucher_number}`}
                  />
                  <button
                    onClick={() => toggleCollapse(voucher.id)}
                    className="p-0.5 text-gray-400 hover:text-gray-600 flex-shrink-0"
                    title={isCollapsed ? '展开' : '折叠'}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                  {voucher.status === 'draft' ? (
                    <input
                      type="date"
                      value={voucher.voucher_date}
                      onChange={async (e) => {
                        try {
                          await updateVoucher({
                            id: voucher.id,
                            voucher_date: e.target.value,
                            modified_by: operator,
                          }, selectedCompanyId || '')
                          // Refresh the list
                          queryVouchers({
                            company_id: selectedCompanyId!,
                            period_id: currentPeriodId || undefined,
                            keyword: searchQuery || undefined,
                            status: statusFilter !== 'all' ? statusFilter : undefined,
                            page: 1,
                            page_size: pageSize,
                          })
                        } catch (_) {
                          // Revert on error
                        }
                      }}
                      className="text-sm border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      title={`修改 ${voucher.voucher_number} 的日期`}
                    />
                  ) : (
                    <span className="text-sm text-gray-500">{voucher.voucher_date}</span>
                  )}
                  <span
                    className={cn(
                      'text-sm font-semibold cursor-pointer hover:underline',
                      voucher.is_system === 1 && voucher.reversal_of_id ? 'text-red-600' : 'text-primary-700',
                    )}
                    onClick={() => navigate(`/vouchers/detail/${voucher.id}`)}
                  >
                    {voucher.voucher_number}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                      voucher.is_system === 1 && voucher.reversal_of_id ? 'bg-red-100 text-red-800' : (statusColors[voucher.status] || 'bg-gray-100 text-gray-800'),
                    )}
                  >
                    {voucher.is_system === 1 && voucher.reversal_of_id ? '红冲凭证' : statusLabels[voucher.status] || voucher.status}
                  </span>
                  <span className="text-xs text-gray-400">
                    {entries.length} 条分录 · {voucher.attachment_count} 张附件
                  </span>

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* Actions */}
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => navigate(`/vouchers/detail/${voucher.id}`)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-gray-100"
                      title="查看"
                    >
                      <Search className="w-3.5 h-3.5" />
                    </button>
                    {voucher.status === 'draft' && (
                      <>
                        <button
                          onClick={() => navigate(`/vouchers/edit/${voucher.id}`)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 rounded hover:bg-gray-100"
                          title="编辑"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleApproveVoucher(voucher)}
                          className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-gray-100"
                          title="审核"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteVoucher(voucher)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-gray-100"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    {voucher.status === 'approved' && (
                      <>
                        <button
                          onClick={() => handleReverseApproveVoucher(voucher)}
                          className="p-1.5 text-gray-400 hover:text-amber-600 rounded hover:bg-gray-100"
                          title="反审核"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleReverseVoucher(voucher)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-gray-100"
                          title="红冲"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleCopyVoucher(voucher)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-gray-100"
                      title="复制"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleInsertVoucher(voucher)}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 rounded hover:bg-gray-100"
                      title="在此后插入凭证"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Entry table — collapsible */}
                {!isCollapsed && (
                  <table className="w-full table-fixed">
                    <colgroup>
                      <col className="w-10" />   {/* 行号 */}
                      <col className="w-[30%]" /> {/* 摘要 */}
                      <col className="w-[30%]" /> {/* 科目 */}
                      <col className="w-[17%]" /> {/* 借方金额 */}
                      <col className="w-[17%]" /> {/* 贷方金额 */}
                    </colgroup>
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">行号</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">摘要</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">科目</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-400">借方金额</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-400">贷方金额</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {entries.map((entry) => {
                        const isReversed = voucher.status === 'reversed'
                        // Display format: "560302 财务费用_利息收入"
                        const accountDisplay = `${entry.account_code} ${entry.account_name}`
                        return (
                          <tr
                            key={entry.id}
                            className={cn(
                              'hover:bg-gray-50/50 transition-colors cursor-pointer',
                              isReversed && 'text-red-700',
                            )}
                            onClick={() => navigate(`/vouchers/detail/${voucher.id}`)}
                          >
                            <td className="px-3 py-2 text-sm text-gray-400 text-center">{entry.line_num}</td>
                            <td className="px-3 py-2 text-sm break-all leading-snug">
                              {entry.summary || '-'}
                            </td>
                            <td className="px-3 py-2 text-sm">
                              <span className="font-mono text-gray-500 mr-1">{entry.account_code}</span>
                              <span>{entry.account_name}</span>
                            </td>
                            <td className="px-3 py-2 text-sm text-right font-mono">
                              {entry.direction === 'debit'
                                ? (isReversed ? '-' : '') + formatCurrency(entry.amount)
                                : ''}
                            </td>
                            <td className="px-3 py-2 text-sm text-right font-mono">
                              {entry.direction === 'credit'
                                ? (isReversed ? '-' : '') + formatCurrency(entry.amount)
                                : ''}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className={cn(
                        'border-t-2 border-gray-200 bg-gray-50/80 font-medium',
                        voucher.status === 'reversed' && 'text-red-700',
                      )}>
                        <td className="px-3 py-2 text-sm" colSpan={3}>
                          合计
                        </td>
                        <td className="px-3 py-2 text-sm text-right font-mono">
                          {voucher.status === 'reversed' ? '-' : ''}{formatCurrency(voucher.total_debit)}
                        </td>
                        <td className="px-3 py-2 text-sm text-right font-mono">
                          {voucher.status === 'reversed' ? '-' : ''}{formatCurrency(voucher.total_credit)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <VoucherImportModal
          companyId={selectedCompanyId || ''}
          periodId={currentPeriodId}
          onClose={() => setShowImportModal(false)}
          onImported={() => {
            if (selectedCompanyId) {
              queryVouchers({
                company_id: selectedCompanyId,
                period_id: currentPeriodId || undefined,
                keyword: searchQuery || undefined,
                status: statusFilter !== 'all' ? statusFilter : undefined,
                page: 1,
                page_size: pageSize,
              })
            }
          }}
        />
      )}
    </div>
  )
}

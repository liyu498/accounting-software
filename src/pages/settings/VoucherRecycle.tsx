import { useState, useEffect } from 'react'
import { Button } from '../../components/ui/Button'
import { useToast, useSuccessToast, useWarningToast } from '../../components/ui/Toast'
import {
  Trash2,
  RotateCcw,
  FileText,
  AlertTriangle,
  Clock,
  Search,
} from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { useVoucherStore, Voucher } from '../../stores/voucherStore'
import { useCompanyStore } from '../../stores/companyStore'

export function VoucherRecycle() {
  const { addToast } = useToast()
  const successToast = useSuccessToast()
  const warningToast = useWarningToast()
  const { selectedCompanyId } = useCompanyStore()
  const { getDeletedVouchers, restoreVoucher, permanentDeleteVoucher } = useVoucherStore()

  const [deletedVouchers, setDeletedVouchers] = useState<Voucher[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const loadDeleted = async () => {
    if (!selectedCompanyId) return
    setLoading(true)
    const result = await getDeletedVouchers(selectedCompanyId)
    setDeletedVouchers(result)
    setLoading(false)
  }

  useEffect(() => {
    loadDeleted()
  }, [selectedCompanyId])

  const filteredVouchers = deletedVouchers.filter((v) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      v.voucher_number.toLowerCase().includes(q) ||
      (v.summary || '').toLowerCase().includes(q)
    )
  })

  const handleRestore = async (id: string) => {
    if (!selectedCompanyId) return
    try {
      await restoreVoucher(id, selectedCompanyId)
      successToast('凭证已恢复')
      loadDeleted()
    } catch (error) {
      addToast('恢复失败: ' + String(error), 'error')
    }
  }

  const handlePermanentDelete = (id: string) => {
    setPendingDeleteId(id)
    setShowDeleteConfirm(true)
  }

  const confirmPermanentDelete = async () => {
    if (!selectedCompanyId || !pendingDeleteId) return
    try {
      await permanentDeleteVoucher(pendingDeleteId, selectedCompanyId)
      successToast('凭证已永久删除')
      setShowDeleteConfirm(false)
      setPendingDeleteId(null)
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(pendingDeleteId)
        return next
      })
      loadDeleted()
    } catch (error) {
      addToast('删除失败: ' + String(error), 'error')
    }
  }

  const handleBatchRestore = async () => {
    if (!selectedCompanyId || selectedIds.size === 0) return
    try {
      for (const id of selectedIds) {
        await restoreVoucher(id, selectedCompanyId)
      }
      successToast(`已恢复 ${selectedIds.size} 张凭证`)
      setSelectedIds(new Set())
      loadDeleted()
    } catch (error) {
      addToast('批量恢复失败: ' + String(error), 'error')
    }
  }

  const handleBatchPermanentDelete = async () => {
    if (!selectedCompanyId || selectedIds.size === 0) return
    if (!confirm(`确定要永久删除 ${selectedIds.size} 张凭证吗？此操作不可撤销！`)) return
    try {
      for (const id of selectedIds) {
        await permanentDeleteVoucher(id, selectedCompanyId)
      }
      successToast(`已永久删除 ${selectedIds.size} 张凭证`)
      setSelectedIds(new Set())
      loadDeleted()
    } catch (error) {
      addToast('批量删除失败: ' + String(error), 'error')
    }
  }

  const handleEmptyRecycle = async () => {
    if (!selectedCompanyId || deletedVouchers.length === 0) return
    if (!confirm(`确定要清空回收站吗？将永久删除 ${deletedVouchers.length} 张凭证，此操作不可撤销！`)) return
    try {
      for (const v of deletedVouchers) {
        await permanentDeleteVoucher(v.id, selectedCompanyId)
      }
      successToast('回收站已清空')
      setSelectedIds(new Set())
      loadDeleted()
    } catch (error) {
      addToast('清空失败: ' + String(error), 'error')
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

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredVouchers.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredVouchers.map((v) => v.id)))
    }
  }

  const getDaysInRecycle = (dateStr: string | null) => {
    if (!dateStr) return 0
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  const selectedVoucher = deletedVouchers.find((v) => v.id === pendingDeleteId)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">凭证回收站</h2>
          <p className="text-sm text-gray-500">已删除的凭证可以在此处恢复或永久删除</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <span className="text-sm text-gray-500">已选 {selectedIds.size} 项</span>
              <Button variant="outline" size="sm" onClick={handleBatchRestore}>
                <RotateCcw className="w-3 h-3 mr-1" />
                批量恢复
              </Button>
              <Button variant="outline" size="sm" onClick={handleBatchPermanentDelete} className="text-red-600 hover:text-red-700">
                <Trash2 className="w-3 h-3 mr-1" />
                批量永久删除
              </Button>
            </>
          )}
          {deletedVouchers.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleEmptyRecycle} className="text-red-600 hover:text-red-700">
              <Trash2 className="w-3 h-3 mr-1" />
              清空回收站
            </Button>
          )}
        </div>
      </div>

      {/* Warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-amber-800">
          <p className="font-medium">注意</p>
          <p>回收站中的凭证可以恢复到原状态。永久删除后无法恢复，请谨慎操作。</p>
        </div>
      </div>

      {/* Search */}
      {deletedVouchers.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索凭证号或摘要..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-4 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            title="搜索凭证"
          />
        </div>
      )}

      {/* Table */}
      {deletedVouchers.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>回收站为空</p>
          <p className="text-xs mt-1">删除的凭证会出现在这里，可以恢复或永久删除</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-left w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredVouchers.length && filteredVouchers.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                    title="全选"
                  />
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">凭证字号</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">日期</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">摘要</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">借方金额</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">贷方金额</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">删除时间</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredVouchers.map((v) => {
                const daysInRecycle = getDaysInRecycle(v.created_at)
                return (
                  <tr key={v.id} className={cn('hover:bg-gray-50', selectedIds.has(v.id) && 'bg-blue-50')}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(v.id)}
                        onChange={() => toggleSelect(v.id)}
                        className="rounded border-gray-300"
                        title={`选择凭证 ${v.voucher_number}`}
                      />
                    </td>
                    <td className="px-3 py-2 text-sm font-mono font-medium text-red-600">{v.voucher_number}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{v.voucher_date}</td>
                    <td className="px-3 py-2 text-sm text-gray-600 truncate max-w-[200px]">{v.summary || '-'}</td>
                    <td className="px-3 py-2 text-sm text-right font-mono">{formatCurrency(v.total_debit)}</td>
                    <td className="px-3 py-2 text-sm text-right font-mono">{formatCurrency(v.total_credit)}</td>
                    <td className="px-3 py-2 text-xs text-gray-400 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Clock className="w-3 h-3" />
                        {daysInRecycle}天前
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleRestore(v.id)} title="恢复">
                          <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handlePermanentDelete(v.id)} title="永久删除">
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Permanent Delete Confirmation Modal */}
      {showDeleteConfirm && selectedVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">永久删除凭证</h3>
                  <p className="text-sm text-gray-500">
                    确定要永久删除凭证 {selectedVoucher.voucher_number} 吗？此操作无法撤销。
                  </p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">日期:</span>
                  <span className="font-medium">{selectedVoucher.voucher_date}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-500">摘要:</span>
                  <span className="font-medium">{selectedVoucher.summary || '-'}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-500">金额:</span>
                  <span className="font-medium font-mono">{formatCurrency(selectedVoucher.total_debit)}</span>
                </div>
              </div>
              <p className="text-sm text-red-600">
                警告：永久删除后，此凭证将无法恢复！
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>取消</Button>
              <Button onClick={confirmPermanentDelete} className="bg-red-600 hover:bg-red-700 text-white">确认永久删除</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

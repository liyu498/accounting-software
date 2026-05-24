import { useState } from 'react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { useWarningToast, useSuccessToast } from '../../components/ui/Toast'
import {
  Search,
  Trash2,
  FileText,
  AlertTriangle,
  Clock,
} from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'

interface RecycledVoucher {
  id: string
  voucher_number: string
  voucher_date: string
  summary: string
  total_debit: number
  deleted_at: string
}

export function VoucherRecycle() {
  const successToast = useSuccessToast()
  const warningToast = useWarningToast()

  const [recycledVouchers] = useState<RecycledVoucher[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedVoucher, setSelectedVoucher] = useState<RecycledVoucher | null>(null)

  const filteredVouchers = recycledVouchers.filter((voucher) => {
    return (
      voucher.voucher_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      voucher.summary.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  const handleRestore = (voucher: RecycledVoucher) => {
    warningToast('恢复功能开发中，请联系管理员操作')
  }

  const handlePermanentDelete = (voucher: RecycledVoucher) => {
    setSelectedVoucher(voucher)
    setShowDeleteConfirm(true)
  }

  const confirmPermanentDelete = () => {
    if (selectedVoucher) {
      warningToast('永久删除功能开发中')
      setShowDeleteConfirm(false)
      setSelectedVoucher(null)
    }
  }

  const handleEmptyRecycle = () => {
    warningToast('清空回收站功能开发中')
  }

  const getDaysInRecycle = (date: string) => {
    return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">凭证回收箱</h1>
          <p className="text-gray-500 mt-1">已删除的凭证可以在此处恢复或永久删除</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleEmptyRecycle}>
            <Trash2 className="w-4 h-4 mr-2" />
            清空回收站
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">回收站说明</p>
              <p className="text-sm text-gray-500 mt-1">
                已删除的凭证会临时保存在回收箱中，超过90天后将自动永久删除。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索凭证号或摘要..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              title="搜索凭证"
            />
          </div>
        </CardContent>
      </Card>

      {/* Recycled Vouchers Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">凭证号</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">日期</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">摘要</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">金额</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">删除时间</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">剩余天数</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <FileText className="w-12 h-12 text-gray-300 mb-3" />
                      <p>回收箱是空的</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredVouchers.map((voucher) => {
                  const daysInRecycle = getDaysInRecycle(voucher.deleted_at)
                  const remainingDays = 90 - daysInRecycle
                  return (
                    <tr
                      key={voucher.id}
                      className={cn('hover:bg-gray-50 transition-colors', remainingDays <= 7 && 'bg-red-50')}
                    >
                      <td className="px-4 py-3 text-sm font-mono font-medium text-red-600">
                        {voucher.voucher_number}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{voucher.voucher_date}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{voucher.summary || '-'}</td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">
                        {formatCurrency(voucher.total_debit)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Clock className="w-4 h-4" />
                          {daysInRecycle}天前
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn('text-sm font-medium', remainingDays <= 7 ? 'text-red-600' : 'text-gray-600')}>
                          {remainingDays}天
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleRestore(voucher)}>
                            恢复
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handlePermanentDelete(voucher)} className="text-red-600 border-red-600 hover:bg-red-50">
                            永久删除
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Delete Confirmation Modal */}
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
                  <span className="text-gray-500">摘要:</span>
                  <span className="font-medium">{selectedVoucher.summary || '-'}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-500">金额:</span>
                  <span className="font-medium font-mono">{formatCurrency(selectedVoucher.total_debit)}</span>
                </div>
              </div>
              <p className="text-sm text-red-600 mb-4">
                警告：永久删除后，此凭证将无法恢复！
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>取消</Button>
              <Button onClick={confirmPermanentDelete} className="bg-red-600 hover:bg-red-700">确认永久删除</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

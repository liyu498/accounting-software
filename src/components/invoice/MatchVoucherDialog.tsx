import { useState, useEffect } from 'react'
import { X, Search } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { formatCurrency, formatDate } from '../../lib/utils'
import { useVoucherStore } from '../../stores/voucherStore'

interface Props {
  companyId: string
  onSelect: (voucherId: string) => void
  onClose: () => void
}

export function MatchVoucherDialog({ companyId, onSelect, onClose }: Props) {
  const { vouchers, fetchVouchers } = useVoucherStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    fetchVouchers(companyId)
  }, [companyId, fetchVouchers])

  const filtered = vouchers.filter((v) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return v.voucher_number.toLowerCase().includes(q) ||
      (v.summary && v.summary.toLowerCase().includes(q))
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">选择关联凭证</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="搜索凭证号、摘要..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="w-10 px-2 py-2" />
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">凭证号</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">日期</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">摘要</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">金额</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.slice(0, 20).map((v) => (
                  <tr
                    key={v.id}
                    className={`cursor-pointer transition-colors hover:bg-primary-50 ${selectedId === v.id ? 'bg-primary-100' : ''}`}
                    onClick={() => setSelectedId(v.id)}
                  >
                    <td className="px-2 py-2">
                      <input
                        type="radio"
                        name="voucherSelect"
                        checked={selectedId === v.id}
                        onChange={() => setSelectedId(v.id)}
                        className="w-4 h-4 text-primary-600"
                      />
                    </td>
                    <td className="px-3 py-2 text-sm font-mono font-medium">{v.voucher_number}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{v.voucher_date}</td>
                    <td className="px-3 py-2 text-sm text-gray-600 max-w-[200px] truncate">{v.summary || '-'}</td>
                    <td className="px-3 py-2 text-sm text-right font-mono">{formatCurrency(v.total_debit)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">暂无凭证</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button
            variant="primary"
            disabled={!selectedId}
            onClick={() => selectedId && onSelect(selectedId)}
          >
            确认匹配
          </Button>
        </div>
      </div>
    </div>
  )
}

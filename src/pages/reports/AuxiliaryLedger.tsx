import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Search, Download, ArrowUpDown } from 'lucide-react'
import { useAuxiliaryStore, type AuxiliaryItem, type AuxiliaryLedgerRow } from '../../stores/auxiliaryStore'
import { useCompanyStore } from '../../stores/companyStore'
import { usePeriodStore } from '../../stores/periodStore'
import { cn } from '../../lib/utils'

export function AuxiliaryLedger() {
  const { selectedCompanyId } = useCompanyStore()
  const { periods } = usePeriodStore()
  const {
    categories,
    items,
    fetchCategories,
    fetchAllItems,
    fetchAuxiliaryLedger,
  } = useAuxiliaryStore()

  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [selectedItemId, setSelectedItemId] = useState('')
  const [selectedPeriodId, setSelectedPeriodId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [rows, setRows] = useState<AuxiliaryLedgerRow[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (selectedCompanyId) {
      fetchCategories(selectedCompanyId)
      fetchAllItems(selectedCompanyId)
    }
  }, [selectedCompanyId])

  const filteredItems = useMemo(() => {
    if (!selectedCategoryId) return []
    return items.filter((i) => i.category_id === selectedCategoryId && i.is_enabled === 1)
  }, [items, selectedCategoryId])

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId),
    [categories, selectedCategoryId],
  )

  const handleQuery = async () => {
    if (!selectedItemId || !selectedCompanyId) return
    setSearching(true)
    try {
      const result = await fetchAuxiliaryLedger({
        auxiliary_item_id: selectedItemId,
        company_id: selectedCompanyId,
        period_id: selectedPeriodId || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      })
      setRows(result)
    } finally {
      setSearching(false)
    }
  }

  const totalDebit = useMemo(
    () => rows.filter((r) => r.direction === 'debit').reduce((s, r) => s + r.amount, 0),
    [rows],
  )
  const totalCredit = useMemo(
    () => rows.filter((r) => r.direction === 'credit').reduce((s, r) => s + r.amount, 0),
    [rows],
  )

  const openPeriods = useMemo(
    () => periods.filter((p) => p.status === 'open'),
    [periods],
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-48">
              <label className="block text-sm font-medium text-gray-700 mb-1">辅助核算类别</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                value={selectedCategoryId}
                onChange={(e) => {
                  setSelectedCategoryId(e.target.value)
                  setSelectedItemId('')
                }}
              >
                <option value="">选择类别</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-48">
              <label className="block text-sm font-medium text-gray-700 mb-1">核算项目</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
              >
                <option value="">选择项目</option>
                {filteredItems.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.code} {i.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-40">
              <label className="block text-sm font-medium text-gray-700 mb-1">会计期间</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                value={selectedPeriodId}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
              >
                <option value="">全部期间</option>
                {openPeriods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.period_year}-{String(p.period_month).padStart(2, '0')}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-36">
              <label className="block text-sm font-medium text-gray-700 mb-1">起始日期</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="w-36">
              <label className="block text-sm font-medium text-gray-700 mb-1">截止日期</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <Button onClick={handleQuery} disabled={searching || !selectedItemId}>
              <Search className="w-4 h-4 mr-1" />
              查询
            </Button>
          </div>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                辅助核算明细账 {selectedCategory ? `— ${selectedCategory.name}` : ''}
              </h3>
              <Button variant="secondary" size="sm">
                <Download className="w-4 h-4 mr-1" />
                导出
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 font-medium">日期</th>
                    <th className="pb-2 font-medium">凭证号</th>
                    <th className="pb-2 font-medium">摘要</th>
                    <th className="pb-2 font-medium text-right">借方金额</th>
                    <th className="pb-2 font-medium text-right">贷方金额</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2.5">{r.date}</td>
                      <td className="py-2.5">{r.voucher_number}</td>
                      <td className="py-2.5">{r.summary}</td>
                      <td className="py-2.5 text-right font-mono">
                        {r.direction === 'debit' ? r.amount.toFixed(2) : ''}
                      </td>
                      <td className="py-2.5 text-right font-mono">
                        {r.direction === 'credit' ? r.amount.toFixed(2) : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-semibold">
                    <td colSpan={3} className="pt-2.5 text-right">
                      合计：
                    </td>
                    <td className="pt-2.5 text-right font-mono">{totalDebit.toFixed(2)}</td>
                    <td className="pt-2.5 text-right font-mono">{totalCredit.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

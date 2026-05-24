import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Search, Download } from 'lucide-react'
import { useCompanyStore } from '../../stores/companyStore'
import { usePeriodStore } from '../../stores/periodStore'
import { useSuccessToast, useWarningToast } from '../../components/ui/Toast'
import { invoke } from '../../lib/tauri'
import { formatCurrency } from '../../lib/utils'

interface AuxiliaryCategory {
  id: string
  name: string
  code: string
}

interface AuxiliaryBalanceRow {
  item_id: string
  item_code: string
  item_name: string
  category_id: string
  total_debit: number
  total_credit: number
  balance: number
  balance_direction: string
}

export function AuxiliaryBalance() {
  const { selectedCompanyId } = useCompanyStore()
  const { periods } = usePeriodStore()
  const successToast = useSuccessToast()
  const warningToast = useWarningToast()

  const [categories, setCategories] = useState<AuxiliaryCategory[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [selectedPeriodId, setSelectedPeriodId] = useState('')
  const [rows, setRows] = useState<AuxiliaryBalanceRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedCompanyId) return
    invoke<AuxiliaryCategory[]>('get_auxiliary_categories', { companyId: selectedCompanyId })
      .then((result) => setCategories(result))
      .catch(() => setCategories([]))
  }, [selectedCompanyId])

  const openPeriods = useMemo(
    () => periods.filter((p) => p.status === 'open'),
    [periods],
  )

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId),
    [categories, selectedCategoryId],
  )

  const selectedPeriod = useMemo(
    () => periods.find((p) => p.id === selectedPeriodId),
    [periods, selectedPeriodId],
  )

  const handleQuery = useCallback(async () => {
    if (!selectedCategoryId || !selectedPeriodId) {
      warningToast('请选择辅助核算类别和会计期间')
      return
    }
    setLoading(true)
    try {
      const result = await invoke<AuxiliaryBalanceRow[]>('get_auxiliary_balance', {
        auxiliaryCategoryId: selectedCategoryId,
        periodId: selectedPeriodId,
        companyId: selectedCompanyId,
      })
      setRows(result)
    } catch {
      warningToast('查询辅助核算余额表失败')
    } finally {
      setLoading(false)
    }
  }, [selectedCategoryId, selectedPeriodId, warningToast])

  const totalDebit = useMemo(
    () => rows.reduce((sum, r) => sum + r.total_debit, 0),
    [rows],
  )
  const totalCredit = useMemo(
    () => rows.reduce((sum, r) => sum + r.total_credit, 0),
    [rows],
  )
  const totalBalance = useMemo(
    () => rows.reduce((sum, r) => sum + r.balance, 0),
    [rows],
  )

  const handleExport = useCallback(() => {
    if (rows.length === 0) return

    const periodLabel = selectedPeriod
      ? `${selectedPeriod.period_year}-${String(selectedPeriod.period_month).padStart(2, '0')}`
      : 'unknown'
    const categoryLabel = selectedCategory?.name ?? 'unknown'

    const csvContent = [
      ['核算项目编码', '核算项目名称', '借方发生额', '贷方发生额', '余额', '方向'].join(','),
      ...rows.map((r) =>
        [r.item_code, r.item_name, r.total_debit, r.total_credit, r.balance, r.balance_direction].join(','),
      ),
      ['', '合计', totalDebit, totalCredit, totalBalance, ''].join(','),
    ].join('\n')

    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `辅助核算余额表-${categoryLabel}-${periodLabel}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
    successToast('导出成功')
  }, [rows, selectedCategory, selectedPeriod, totalDebit, totalCredit, totalBalance, successToast])

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
                onChange={(e) => setSelectedCategoryId(e.target.value)}
              >
                <option value="">选择类别</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
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
                <option value="">选择期间</option>
                {openPeriods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.period_year}-{String(p.period_month).padStart(2, '0')}
                  </option>
                ))}
              </select>
            </div>

            <Button onClick={handleQuery} disabled={loading || !selectedCategoryId || !selectedPeriodId}>
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
                辅助核算余额表
                {selectedCategory ? ` — ${selectedCategory.name}` : ''}
                {selectedPeriod
                  ? ` (${selectedPeriod.period_year}-${String(selectedPeriod.period_month).padStart(2, '0')})`
                  : ''}
              </h3>
              <Button variant="secondary" size="sm" onClick={handleExport}>
                <Download className="w-4 h-4 mr-1" />
                导出
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 font-medium">核算项目编码</th>
                    <th className="pb-2 font-medium">核算项目名称</th>
                    <th className="pb-2 font-medium text-right">借方发生额</th>
                    <th className="pb-2 font-medium text-right">贷方发生额</th>
                    <th className="pb-2 font-medium text-right">余额</th>
                    <th className="pb-2 font-medium">方向</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.item_id} className="border-b last:border-0">
                      <td className="py-2.5 font-mono">{r.item_code}</td>
                      <td className="py-2.5">{r.item_name}</td>
                      <td className="py-2.5 text-right font-mono">{formatCurrency(r.total_debit)}</td>
                      <td className="py-2.5 text-right font-mono">{formatCurrency(r.total_credit)}</td>
                      <td className="py-2.5 text-right font-mono">{formatCurrency(r.balance)}</td>
                      <td className="py-2.5">{r.balance_direction}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-semibold">
                    <td colSpan={2} className="pt-2.5 text-right">
                      合计：
                    </td>
                    <td className="pt-2.5 text-right font-mono">{formatCurrency(totalDebit)}</td>
                    <td className="pt-2.5 text-right font-mono">{formatCurrency(totalCredit)}</td>
                    <td className="pt-2.5 text-right font-mono">{formatCurrency(totalBalance)}</td>
                    <td className="pt-2.5" />
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

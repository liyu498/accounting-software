import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Printer, Download, FileText, Loader2 } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import { usePeriodStore, type TrialBalanceItem } from '../../stores/periodStore'
import { useCompanyStore } from '../../stores/companyStore'

export function AccountSummary() {
  const { selectedCompanyId } = useCompanyStore()
  const { periods, currentPeriodId, dataVersion, fetchPeriods, setCurrentPeriod, fetchTrialBalance } = usePeriodStore()

  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)
  const [items, setItems] = useState<TrialBalanceItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (selectedCompanyId) fetchPeriods(selectedCompanyId)
  }, [selectedCompanyId, fetchPeriods])

  useEffect(() => {
    if (!selectedPeriodId && currentPeriodId) {
      setSelectedPeriodId(currentPeriodId)
    }
  }, [currentPeriodId, selectedPeriodId])

  const loadData = useCallback(async () => {
    if (!selectedPeriodId) { setItems([]); return }
    setLoading(true)
    try {
      const result = await fetchTrialBalance(selectedPeriodId)
      // Show only detail accounts in summary
      setItems(result.items.filter((i) => i.is_detail))
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [selectedPeriodId, dataVersion, fetchTrialBalance])

  useEffect(() => { loadData() }, [loadData])

  const periodOptions = [...periods].sort((a, b) => (a.period_year * 100 + a.period_month) - (b.period_year * 100 + b.period_month))

  const totals = items.reduce(
    (acc, r) => ({
      period_debit: acc.period_debit + r.period_debit,
      period_credit: acc.period_credit + r.period_credit,
      closing_debit: acc.closing_debit + r.closing_debit,
      closing_credit: acc.closing_credit + r.closing_credit,
    }),
    { period_debit: 0, period_credit: 0, closing_debit: 0, closing_credit: 0 },
  )

  const handleExport = () => {
    const csvContent = [
      ['科目编码', '科目名称', '本期借方', '本期贷方', '期末借方', '期末贷方'].join(','),
      ...items.map((r) =>
        [r.account_code, r.account_name, r.period_debit, r.period_credit, r.closing_debit, r.closing_credit].join(',')
      ),
      ['', '合计', totals.period_debit, totals.period_credit, totals.closing_debit, totals.closing_credit].join(','),
    ].join('\n')
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = '科目汇总表.csv'
    link.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">科目汇总表</h1>
          <p className="text-gray-500 mt-1">汇总各科目本期及期末借贷发生额</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />
            打印
          </Button>
          <Button variant="primary" onClick={handleExport} disabled={items.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            导出
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">会计期间</label>
              <select
                title="选择会计期间"
                className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={selectedPeriodId ?? ''}
                onChange={(e) => {
                  const v = e.target.value || null
                  setSelectedPeriodId(v)
                  if (v) setCurrentPeriod(v)
                }}
              >
                <option value="">请选择期间</option>
                {periodOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.period_year}年{String(p.period_month).padStart(2, '0')}月
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">科目编码</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">科目名称</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">本期借方</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">本期贷方</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">期末借方</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">期末贷方</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    加载中...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    {selectedPeriodId ? '暂无汇总数据' : '请选择会计期间'}
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.account_code} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">{item.account_code}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.account_name}</td>
                    <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">{formatCurrency(item.period_debit)}</td>
                    <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">{formatCurrency(item.period_credit)}</td>
                    <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">{formatCurrency(item.closing_debit)}</td>
                    <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">{formatCurrency(item.closing_credit)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {items.length > 0 && (
              <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-sm font-bold text-gray-900">合计</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">{formatCurrency(totals.period_debit)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">{formatCurrency(totals.period_credit)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">{formatCurrency(totals.closing_debit)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">{formatCurrency(totals.closing_credit)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  )
}

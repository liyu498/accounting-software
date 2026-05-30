import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Printer, Download, Loader2 } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import { usePeriodStore, type TrialBalanceItem } from '../../stores/periodStore'
import { useCompanyStore } from '../../stores/companyStore'

interface EquityRow {
  item: string
  openingBalance: number
  currentIncrease: number
  currentDecrease: number
  closingBalance: number
}

function deriveEquityFromTrialBalance(items: TrialBalanceItem[]): EquityRow[] {
  const equityCodes = ['4001', '4002', '4101', '4103', '4104']
  const rows: EquityRow[] = []

  const findItem = (code: string) => items.find((i) => i.account_code === code)
  const netBalance = (item: TrialBalanceItem | undefined) =>
    item ? item.closing_credit - item.closing_debit : 0
  const openingNet = (item: TrialBalanceItem | undefined) =>
    item ? item.opening_credit - item.opening_debit : 0

  const names: Record<string, string> = {
    '4001': '实收资本',
    '4002': '资本公积',
    '4101': '盈余公积',
    '4103': '本年利润',
    '4104': '利润分配—未分配利润',
  }

  let totalOpening = 0
  let totalIncrease = 0
  let totalDecrease = 0
  let totalClosing = 0

  for (const code of equityCodes) {
    const item = findItem(code)
    const opening = openingNet(item)
    const closing = netBalance(item)
    const change = closing - opening
    const increase = change > 0 ? change : 0
    const decrease = change < 0 ? Math.abs(change) : 0

    rows.push({
      item: names[code] || code,
      openingBalance: opening,
      currentIncrease: increase,
      currentDecrease: decrease,
      closingBalance: closing,
    })

    totalOpening += opening
    totalIncrease += increase
    totalDecrease += decrease
    totalClosing += closing
  }

  rows.push({
    item: '所有者权益合计',
    openingBalance: totalOpening,
    currentIncrease: totalIncrease,
    currentDecrease: totalDecrease,
    closingBalance: totalClosing,
  })

  return rows
}

export function EquityChange() {
  const { selectedCompanyId } = useCompanyStore()
  const { periods, currentPeriodId, dataVersion, fetchPeriods, setCurrentPeriod, fetchTrialBalance } = usePeriodStore()

  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)
  const [rows, setRows] = useState<EquityRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (selectedCompanyId) fetchPeriods(selectedCompanyId)
  }, [selectedCompanyId, fetchPeriods])

  useEffect(() => {
    if (!selectedPeriodId && currentPeriodId) setSelectedPeriodId(currentPeriodId)
  }, [currentPeriodId, selectedPeriodId])

  const loadData = useCallback(async () => {
    if (!selectedPeriodId) { setRows([]); return }
    setLoading(true)
    try {
      const result = await fetchTrialBalance(selectedPeriodId)
      setRows(deriveEquityFromTrialBalance(result.items))
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [selectedPeriodId, dataVersion, fetchTrialBalance])

  useEffect(() => { loadData() }, [loadData])

  const periodOptions = [...periods].sort((a, b) => (a.period_year * 100 + a.period_month) - (b.period_year * 100 + b.period_month))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">所有者权益变动表</h1>
          <p className="text-gray-500 mt-1">反映所有者权益各组成部分的增减变动</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />
            打印
          </Button>
          <Button variant="primary" onClick={() => {
            const csv = ['项目', '期初余额', '本期增加', '本期减少', '期末余额'].join(',') + '\n' +
              rows.map((r) => [r.item, r.openingBalance, r.currentIncrease, r.currentDecrease, r.closingBalance].join(',')).join('\n')
            const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
            const link = document.createElement('a')
            link.href = URL.createObjectURL(blob)
            link.download = '所有者权益变动表.csv'
            link.click()
          }} disabled={rows.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            导出
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
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
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">项目</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">期初余额</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">本期增加</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">本期减少</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">期末余额</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    加载中...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    请选择会计期间以查看所有者权益变动表
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => {
                  const isTotal = idx === rows.length - 1
                  return (
                    <tr key={idx} className={isTotal ? 'bg-gray-100 font-bold' : 'hover:bg-gray-50'}>
                      <td className={`px-4 py-3 text-sm ${isTotal ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
                        {row.item}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">{formatCurrency(row.openingBalance)}</td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-green-600">{row.currentIncrease > 0 ? formatCurrency(row.currentIncrease) : '-'}</td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-red-600">{row.currentDecrease > 0 ? formatCurrency(row.currentDecrease) : '-'}</td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">{formatCurrency(row.closingBalance)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

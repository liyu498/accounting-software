import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Printer, Download, Loader2, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import { usePeriodStore } from '../../stores/periodStore'
import { useCompanyStore } from '../../stores/companyStore'
import { invoke } from '../../lib/tauri'

interface CashFlowItem {
  item_code: string
  item_name: string
  item_level: number
  is_total: number
  current_amount: number
  year_to_date: number
}

interface CashFlowResult {
  period_id: string
  items: CashFlowItem[]
  net_increase: number
  net_increase_year_to_date: number
}

const LEVEL_INDENT: Record<number, string> = { 0: 'pl-2', 1: 'pl-8', 2: 'pl-14' }

export function CashFlowStatement() {
  const { selectedCompanyId } = useCompanyStore()
  const { periods, currentPeriodId, dataVersion, fetchPeriods, setCurrentPeriod } = usePeriodStore()

  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)
  const [data, setData] = useState<CashFlowResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (selectedCompanyId) fetchPeriods(selectedCompanyId)
  }, [selectedCompanyId, fetchPeriods])

  useEffect(() => {
    if (!selectedPeriodId && currentPeriodId) setSelectedPeriodId(currentPeriodId)
  }, [currentPeriodId, selectedPeriodId])

  const loadData = useCallback(async () => {
    if (!selectedPeriodId) { setData(null); return }
    setLoading(true)
    setError(null)
    try {
      const result = await invoke<CashFlowResult>('get_cash_flow_statement', { periodId: selectedPeriodId })
      setData(result)
    } catch (e) {
      setError(String(e))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [selectedPeriodId, dataVersion])

  useEffect(() => { loadData() }, [loadData])

  const periodOptions = [...periods].sort((a, b) => (a.period_year * 100 + a.period_month) - (b.period_year * 100 + b.period_month))
  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId)
  const periodLabel = selectedPeriod
    ? `${selectedPeriod.period_year}年${String(selectedPeriod.period_month).padStart(2, '0')}月`
    : ''

  const handleExport = () => {
    if (!data) return
    const csvContent = [
      ['现金流量表', periodLabel].join(','),
      ['项目', '本期金额', '本年累计'].join(','),
      ...data.items.map((r) => [r.item_name, r.current_amount, r.year_to_date].join(',')),
    ].join('\n')
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `现金流量表-${periodLabel}.csv`
    link.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">现金流量表</h1>
          <p className="text-gray-500 mt-1">反映企业现金及现金等价物的增减变动</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />
            打印
          </Button>
          <Button variant="primary" onClick={handleExport} disabled={!data || data.items.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            导出
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900">数据说明</p>
              <p className="text-sm text-gray-500 mt-1">
                现金流量表项目金额基于科目发生额公式自动计算，采用间接法估算。
                如需精确数据，请在凭证中标记现金流量项目。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
        <div className="p-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">现金流量表</h2>
            <p className="text-sm text-gray-500 mt-1">{periodLabel}</p>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
              <span className="ml-2 text-gray-500">加载中...</span>
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-600">加载失败: {error}</div>
          )}

          {!loading && !error && (!data || data.items.length === 0) && (
            <div className="text-center py-12 text-gray-400">
              {selectedPeriodId ? '暂无现金流量数据' : '请选择会计期间以查看现金流量表'}
            </div>
          )}

          {!loading && !error && data && data.items.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">项目</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-1/4">本期金额</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-1/4">本年累计</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.items.map((row) => (
                      <tr key={row.item_code} className={row.is_total ? 'bg-gray-100 font-bold' : 'hover:bg-gray-50'}>
                        <td className={`px-4 py-3 text-sm ${LEVEL_INDENT[row.item_level] || 'pl-2'} ${row.is_total ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
                          {row.item_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">
                          {formatCurrency(row.current_amount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">
                          {formatCurrency(row.year_to_date)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 bg-primary-50">
                      <td className="px-4 py-3 text-sm font-bold text-gray-900">现金及现金等价物净增加额</td>
                      <td className="px-4 py-3 text-sm text-right font-mono font-bold text-primary-700">
                        {formatCurrency(data.net_increase)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono font-bold text-primary-700">
                        {formatCurrency(data.net_increase_year_to_date)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Printer, Download, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { formatCurrency, cn } from '../../lib/utils'
import { usePeriodStore, type BalanceSheetItem, type BalanceSheetResult } from '../../stores/periodStore'
import { useCompanyStore } from '../../stores/companyStore'
import { useToast } from '../../components/ui/Toast'

interface FlatRow {
  code: string
  name: string
  level: number
  isTotal: boolean
  opening: number
  ending: number
}

function buildTree(flatItems: BalanceSheetItem[]): BalanceSheetItem[] {
  const result: BalanceSheetItem[] = []
  const stack: BalanceSheetItem[] = []

  for (const item of flatItems) {
    const node: BalanceSheetItem = { ...item, children: [] }

    while (stack.length > 0 && stack[stack.length - 1].item_level >= node.item_level) {
      stack.pop()
    }

    if (stack.length === 0) {
      result.push(node)
    } else {
      stack[stack.length - 1].children.push(node)
    }

    stack.push(node)
  }

  return result
}

function flattenItems(items: BalanceSheetItem[], result: FlatRow[] = []): FlatRow[] {
  for (const item of items) {
    result.push({
      code: item.item_code,
      name: item.item_name,
      level: item.item_level,
      isTotal: item.is_total === 1,
      opening: item.opening_balance,
      ending: item.ending_balance,
    })
    if (item.children.length > 0) {
      flattenItems(item.children, result)
    }
  }
  return result
}

export function BalanceSheet() {
  const { addToast } = useToast()
  const { periods, currentPeriodId, dataVersion, fetchPeriods, setCurrentPeriod, getBalanceSheet } = usePeriodStore()
  const { selectedCompanyId } = useCompanyStore()

  const [data, setData] = useState<BalanceSheetResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (selectedCompanyId) {
      fetchPeriods(selectedCompanyId)
    }
  }, [selectedCompanyId, fetchPeriods])

  const loadBalanceSheet = useCallback(async (periodId: string) => {
    setLoading(true)
    setError(null)
    try {
      const result = await getBalanceSheet(periodId)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [getBalanceSheet])

  useEffect(() => {
    if (currentPeriodId) {
      loadBalanceSheet(currentPeriodId)
    }
  }, [currentPeriodId, dataVersion, loadBalanceSheet])

  const handlePeriodChange = (periodId: string) => {
    setCurrentPeriod(periodId)
  }

  const treeItems = data ? buildTree(data.items) : []
  const assetRows = treeItems ? flattenItems(treeItems.filter(i => i.section === 'asset')) : []
  const leRows = treeItems ? flattenItems(treeItems.filter(i => i.section !== 'asset')) : []
  const maxRows = Math.max(assetRows.length, leRows.length)
  const totalLiabilitiesEquity = data ? data.total_liabilities + data.total_equity : 0
  const openingTotalLiabilitiesEquity = data ? data.opening_total_liabilities + data.opening_total_equity : 0

  const handlePrint = () => window.print()

  const handleExport = () => {
    if (!data) return
    const period = periods.find(p => p.id === currentPeriodId)
    const label = period ? `${period.period_year}年${period.period_month}月` : ''
    const csvRows = ['资产负债表', `期间: ${label}`, '', '资产,期初余额,期末余额,负债和所有者权益,期初余额,期末余额']
    for (let i = 0; i < maxRows; i++) {
      const a = assetRows[i]
      const l = leRows[i]
      csvRows.push(`${a ? a.name : ''},${a ? a.opening : ''},${a ? a.ending : ''},${l ? l.name : ''},${l ? l.opening : ''},${l ? l.ending : ''}`)
    }
    const blob = new Blob(['﻿' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `资产负债表-${label}.csv`
    link.click()
  }

  const renderRow = (row: FlatRow | undefined, side: 'left' | 'right') => {
    if (!row) return <td colSpan={3} className="py-2 px-2" />
    const indent = row.level * 16
    return (
      <>
        <td className={cn('py-2 px-2 text-sm', row.isTotal ? 'font-bold text-gray-900' : 'text-gray-700')}
          style={{ paddingLeft: `${Math.max(8, indent)}px` }}>
          {row.name}
        </td>
        <td className={cn(
          'py-2 px-2 text-sm text-right font-mono',
          row.isTotal ? 'font-bold text-gray-900' : 'text-gray-700'
        )}>
          {formatCurrency(row.opening)}
        </td>
        <td className={cn(
          'py-2 px-2 text-sm text-right font-mono',
          row.isTotal ? 'font-bold text-gray-900' : 'text-gray-700'
        )}>
          {formatCurrency(row.ending)}
        </td>
      </>
    )
  }

  const selectedPeriod = periods.find(p => p.id === currentPeriodId)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">资产负债表</h1>
          <p className="text-gray-500 mt-1">反映企业一定日期的财务状况</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />打印
          </Button>
          <Button variant="primary" onClick={handleExport} disabled={!data}>
            <Download className="w-4 h-4 mr-2" />导出Excel
          </Button>
        </div>
      </div>

      {/* Period Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">会计期间</label>
              <select
                title="选择会计期间"
                className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={currentPeriodId || ''}
                onChange={(e) => handlePeriodChange(e.target.value)}
              >
                <option value="">请选择期间</option>
                {[...periods].sort((a, b) => (a.period_year * 100 + a.period_month) - (b.period_year * 100 + b.period_month)).map(p => (
                  <option key={p.id} value={p.id}>
                    {p.period_year}年{String(p.period_month).padStart(2, '0')}月
                    {p.status === 'closed' ? ' (已结账)' : ''}
                  </option>
                ))}
              </select>
            </div>
            {data && (
              <div className="flex items-center gap-2 ml-auto">
                {data.is_balanced ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-green-600">
                      资产=负债+权益 ({formatCurrency(data.total_assets)} = {formatCurrency(totalLiabilitiesEquity)})
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="text-sm font-medium text-red-600">
                      资产负债表不平衡 (资产: {formatCurrency(data.total_assets)}, 负债+权益: {formatCurrency(totalLiabilitiesEquity)})
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading / Error / Table */}
      {loading && (
        <Card>
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            <span className="ml-3 text-gray-500">加载中...</span>
          </div>
        </Card>
      )}
      {error && (
        <Card>
          <div className="flex items-center justify-center py-20 text-red-600">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>加载失败: {error}</span>
          </div>
        </Card>
      )}
      {!loading && !error && data && (
        <Card>
          <div className="p-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">资产负债表</h2>
              <p className="text-sm text-gray-500 mt-1">
                {selectedPeriod
                  ? `${selectedPeriod.period_year}年${String(selectedPeriod.period_month).padStart(2, '0')}月`
                  : ''}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="py-3 text-left text-xs font-medium text-gray-500 w-[24%]">资产</th>
                    <th className="py-3 text-right text-xs font-medium text-gray-500 w-[13%]">期初余额</th>
                    <th className="py-3 text-right text-xs font-medium text-gray-500 w-[13%]">期末余额</th>
                    <th className="py-3 text-left text-xs font-medium text-gray-500 w-[24%]">负债和所有者权益</th>
                    <th className="py-3 text-right text-xs font-medium text-gray-500 w-[13%]">期初余额</th>
                    <th className="py-3 text-right text-xs font-medium text-gray-500 w-[13%]">期末余额</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: maxRows }).map((_, i) => {
                    const a = assetRows[i]
                    const l = leRows[i]
                    const isTotalRow = a?.isTotal || l?.isTotal
                    return (
                      <tr key={i} className={cn(
                        'border-b',
                        isTotalRow ? 'bg-gray-50 border-gray-200' : 'border-gray-100'
                      )}>
                        {renderRow(a, 'left')}
                        {renderRow(l, 'right')}
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-primary-50">
                    <td className="py-3 px-2 text-sm font-bold text-gray-900">资产总计</td>
                    <td className="py-3 px-2 text-sm text-right font-mono font-bold text-primary-700">
                      {formatCurrency(data.opening_total_assets)}
                    </td>
                    <td className="py-3 px-2 text-sm text-right font-mono font-bold text-primary-700">
                      {formatCurrency(data.total_assets)}
                    </td>
                    <td className="py-3 px-2 text-sm font-bold text-gray-900">负债和所有者权益总计</td>
                    <td className="py-3 px-2 text-sm text-right font-mono font-bold text-primary-700">
                      {formatCurrency(openingTotalLiabilitiesEquity)}
                    </td>
                    <td className="py-3 px-2 text-sm text-right font-mono font-bold text-primary-700">
                      {formatCurrency(totalLiabilitiesEquity)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {/* Balance indicator at bottom */}
            <div className={cn(
              'mt-4 p-3 rounded-lg flex items-center gap-2',
              data.is_balanced ? 'bg-green-50' : 'bg-red-50'
            )}>
              {data.is_balanced ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-700">资产负债表已平衡</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <span className="text-sm font-medium text-red-700">
                    资产负债表不平衡，差额: {formatCurrency(Math.abs(data.total_assets - totalLiabilitiesEquity))}
                  </span>
                </>
              )}
            </div>
          </div>
        </Card>
      )}
      {!loading && !error && !data && !currentPeriodId && (
        <Card>
          <div className="flex items-center justify-center py-20 text-gray-400">
            请选择会计期间以查看资产负债表
          </div>
        </Card>
      )}
    </div>
  )
}

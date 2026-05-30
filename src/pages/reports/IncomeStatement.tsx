import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Printer, Download } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import { usePeriodStore, type IncomeStatementItem, type IncomeStatementResult } from '../../stores/periodStore'
import { useCompanyStore } from '../../stores/companyStore'
import { useToast } from '../../components/ui/Toast'

const LEVEL_INDENT: Record<number, string> = {
  0: 'pl-2',
  1: 'pl-8',
  2: 'pl-14',
  3: 'pl-20',
  4: 'pl-26',
}

function levelIndentClass(level: number): string {
  return LEVEL_INDENT[level] ?? `pl-[${Math.min(level * 24 + 8, 200)}px]`
}

function buildTree(flatItems: IncomeStatementItem[]): IncomeStatementItem[] {
  const result: IncomeStatementItem[] = []
  const stack: IncomeStatementItem[] = []

  for (const item of flatItems) {
    const node: IncomeStatementItem = { ...item, children: [] }

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

function renderItems(items: IncomeStatementItem[]): React.ReactNode[] {
  const rows: React.ReactNode[] = []
  for (const item of items) {
    const isTotal = item.is_total === 1
    const indentClass = levelIndentClass(item.item_level)
    rows.push(
      <tr
        key={item.item_code}
        className={isTotal ? 'bg-gray-100 font-bold' : 'hover:bg-gray-50'}
      >
        <td className={`py-2 px-2 text-sm text-gray-900 ${indentClass}`}>
          {item.item_name}
        </td>
        <td className={`py-2 px-2 text-sm text-right font-mono ${isTotal ? 'font-bold text-gray-900' : 'text-gray-900'}`}>
          {formatCurrency(item.current_amount)}
        </td>
        <td className={`py-2 px-2 text-sm text-right font-mono ${isTotal ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
          {formatCurrency(item.year_to_date)}
        </td>
      </tr>
    )
    if (item.children?.length) {
      rows.push(...renderItems(item.children))
    }
  }
  return rows
}

export function IncomeStatement() {
  const { addToast } = useToast()
  const { selectedCompanyId } = useCompanyStore()
  const { periods, currentPeriodId, dataVersion, fetchPeriods, setCurrentPeriod, getIncomeStatement } = usePeriodStore()

  const [data, setData] = useState<IncomeStatementResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (selectedCompanyId) {
      fetchPeriods(selectedCompanyId)
    }
  }, [selectedCompanyId, fetchPeriods])

  const loadData = useCallback(async () => {
    if (!currentPeriodId) return
    setIsLoading(true)
    setError(null)
    try {
      const result = await getIncomeStatement(currentPeriodId)
      setData(result)
    } catch (err) {
      setError(String(err))
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [currentPeriodId, dataVersion, getIncomeStatement])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handlePeriodChange = (periodId: string) => {
    setCurrentPeriod(periodId)
  }

  const handlePrint = () => window.print()

  const treeItems = data ? buildTree(data.items) : []
  const netProfit = data ? data.current_period_total : 0
  const netProfitYtd = data ? data.year_to_date_total : 0

  const handleExportExcel = () => {
    if (!data) return
    const period = periods.find((p) => p.id === currentPeriodId)
    const periodLabel = period ? `${period.period_year}年${period.period_month}月` : ''
    const csvContent = [
      ['利润表'].join(','),
      ['', periodLabel].join(','),
      ['项目', '本期金额', '本年累计金额'].join(','),
      ...flattenForExport(treeItems),
      ['净利润', netProfit, netProfitYtd].join(','),
    ].join('\n')
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `利润表-${periodLabel}.csv`
    link.click()
  }

  const handleExportPDF = () => addToast('PDF导出功能开发中，敬请期待...', 'info')

  const selectedPeriod = periods.find((p) => p.id === currentPeriodId)
  const periodLabel = selectedPeriod
    ? `${selectedPeriod.period_year}年${selectedPeriod.period_month}月`
    : ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">利润表</h1>
          <p className="text-gray-500 mt-1">反映企业一定期间的经营成果</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />打印
          </Button>
          <Button variant="outline" onClick={handleExportPDF}>
            <Download className="w-4 h-4 mr-2" />导出PDF
          </Button>
          <Button variant="primary" onClick={handleExportExcel} disabled={!data}>
            <Download className="w-4 h-4 mr-2" />导出Excel
          </Button>
        </div>
      </div>

      {/* Period Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">会计期间</label>
              <select
                title="会计期间"
                className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={currentPeriodId ?? ''}
                onChange={(e) => handlePeriodChange(e.target.value)}
              >
                <option value="" disabled>请选择期间</option>
                {[...periods].sort((a, b) => (a.period_year * 100 + a.period_month) - (b.period_year * 100 + b.period_month)).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.period_year}年{p.period_month}月
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <div className="p-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">利润表</h2>
            <p className="text-sm text-gray-500 mt-1">{periodLabel}</p>
          </div>

          {isLoading && <p className="text-center text-gray-500 py-8">加载中...</p>}
          {error && <p className="text-center text-red-600 py-8">加载失败: {error}</p>}
          {!isLoading && !error && !data && (
            <p className="text-center text-gray-400 py-8">请选择会计期间</p>
          )}

          {data && (
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">项目</th>
                  <th className="py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">本期金额</th>
                  <th className="py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">本年累计金额</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {renderItems(treeItems)}
                {/* Net Profit */}
                <tr className="bg-green-50 border-t-2 border-gray-300">
                  <td className="py-3 px-2 text-sm font-bold text-gray-900">净利润</td>
                  <td className="py-3 px-2 text-sm text-right font-mono font-bold text-green-700">
                    {formatCurrency(netProfit)}
                  </td>
                  <td className="py-3 px-2 text-sm text-right font-mono font-bold text-green-700">
                    {formatCurrency(netProfitYtd)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  )
}

function flattenForExport(items: IncomeStatementItem[], prefix = ''): string[] {
  const rows: string[] = []
  for (const item of items) {
    const name = prefix + item.item_name
    rows.push([name, item.current_amount, item.year_to_date].join(','))
    if (item.children?.length) {
      rows.push(...flattenForExport(item.children, '  '))
    }
  }
  return rows
}

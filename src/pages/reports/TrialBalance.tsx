import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Printer, Download, CheckCircle, AlertCircle, Loader2, ChevronRight, ChevronDown } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import { usePeriodStore, type TrialBalanceItem } from '../../stores/periodStore'
import { useCompanyStore } from '../../stores/companyStore'

export function TrialBalance() {
  const { selectedCompanyId } = useCompanyStore()
  const {
    periods,
    currentPeriodId,
    trialBalance,
    isLoading,
    error,
    dataVersion,
    fetchPeriods,
    setCurrentPeriod,
    fetchTrialBalance,
  } = usePeriodStore()

  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)
  const [includeUnapproved, setIncludeUnapproved] = useState(false)
  const [hideZeroActivity, setHideZeroActivity] = useState(false)
  const [showDetailOnly, setShowDetailOnly] = useState(false)
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set())
  const [tbLoading, setTbLoading] = useState(false)
  const [tbError, setTbError] = useState<string | null>(null)

  useEffect(() => {
    if (selectedCompanyId) {
      fetchPeriods(selectedCompanyId)
    }
  }, [selectedCompanyId, fetchPeriods])

  useEffect(() => {
    if (!selectedPeriodId && currentPeriodId) {
      setSelectedPeriodId(currentPeriodId)
    }
  }, [currentPeriodId, selectedPeriodId])

  const loadData = useCallback(async (periodId: string) => {
    setTbLoading(true)
    setTbError(null)
    try {
      await fetchTrialBalance(periodId)
    } catch (err) {
      setTbError(String(err))
    } finally {
      setTbLoading(false)
    }
  }, [fetchTrialBalance])

  useEffect(() => {
    if (selectedPeriodId) {
      loadData(selectedPeriodId)
    }
  }, [selectedPeriodId, dataVersion, loadData])

  const handlePeriodChange = (periodId: string) => {
    setSelectedPeriodId(periodId)
    setCurrentPeriod(periodId)
  }

  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId)

  const toggleParent = (code: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev)
      if (next.has(code)) {
        next.delete(code)
      } else {
        next.add(code)
      }
      return next
    })
  }

  // Auto-expand all level-1 parents when data changes
  useEffect(() => {
    if (trialBalance?.items) {
      const level1Parents = trialBalance.items
        .filter((i) => !i.is_detail && i.account_level === 1)
        .map((i) => i.account_code)
      setExpandedParents(new Set(level1Parents))
    }
  }, [trialBalance?.items])

  // Filter items for display
  const filteredItems = trialBalance?.items?.filter((row) => {
    if (hideZeroActivity && row.period_debit === 0 && row.period_credit === 0) return false
    if (showDetailOnly && !row.is_detail) return false
    if (!showDetailOnly) {
      if (row.account_level === 1) return true
      const parentCode = findParentCode(row.account_code, expandedParents)
      if (parentCode && expandedParents.has(parentCode)) return true
      return false
    }
    return true
  }) ?? []

  const findParentCode = (code: string, expanded: Set<string>): string | null => {
    for (let len = code.length - 2; len >= 4; len -= 2) {
      const parentCode = code.substring(0, len)
      if (expanded.has(parentCode)) return parentCode
    }
    for (let len = code.length - 1; len >= 4; len -= 1) {
      const parentCode = code.substring(0, len)
      if (expanded.has(parentCode)) return parentCode
    }
    return null
  }

  const handlePrint = () => window.print()

  const handleExportCSV = () => {
    if (!trialBalance) return

    const csvContent = [
      ['科目编码', '科目名称', '期初借方', '期初贷方', '本期借方', '本期贷方', '累计借方发生额', '累计贷方发生额', '期末借方', '期末贷方'].join(','),
      ...trialBalance.items
        .filter((row) =>
          !hideZeroActivity || row.period_debit !== 0 || row.period_credit !== 0
        )
        .filter((row) => !showDetailOnly || row.is_detail)
        .map((row) =>
        [
          row.account_code,
          row.account_name,
          row.opening_debit,
          row.opening_credit,
          row.period_debit,
          row.period_credit,
          row.cumulative_debit,
          row.cumulative_credit,
          row.closing_debit,
          row.closing_credit,
        ].join(',')
      ),
      [
        '',
        '合计（最末级科目）',
        trialBalance.total_opening_debit,
        trialBalance.total_opening_credit,
        trialBalance.total_period_debit,
        trialBalance.total_period_credit,
        trialBalance.total_cumulative_debit,
        trialBalance.total_cumulative_credit,
        trialBalance.total_closing_debit,
        trialBalance.total_closing_credit,
      ].join(','),
    ].join('\n')

    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    const label = selectedPeriod
      ? `${selectedPeriod.period_year}-${String(selectedPeriod.period_month).padStart(2, '0')}`
      : 'unknown'
    link.download = `科目余额表-${label}.csv`
    link.click()
  }

  const formatAmount = (value: number) => {
    return value > 0 ? formatCurrency(value) : '-'
  }

  const sortedPeriods = [...periods].sort((a, b) => (a.period_year * 100 + a.period_month) - (b.period_year * 100 + b.period_month))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">科目余额表</h1>
          <p className="text-gray-500 mt-1">查看各科目期初、发生额及期末余额（含所有科目层级）</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            打印
          </Button>
          <Button variant="primary" onClick={handleExportCSV} disabled={!trialBalance}>
            <Download className="w-4 h-4 mr-2" />
            导出Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">会计期间</label>
              <select
                title="选择会计期间"
                className="input-base min-w-[200px]"
                value={selectedPeriodId ?? ''}
                onChange={(e) => handlePeriodChange(e.target.value)}
              >
                <option value="" disabled>
                  请选择会计期间
                </option>
                {sortedPeriods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.period_year}年{period.period_month}月
                    {period.status === 'closed' ? ' (已结账)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeUnapproved}
                  onChange={(e) => setIncludeUnapproved(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                包含未记账凭证
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideZeroActivity}
                  onChange={(e) => setHideZeroActivity(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                无发生额不显示
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDetailOnly}
                  onChange={(e) => setShowDetailOnly(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                仅显示最末级科目
              </label>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              {trialBalance ? (
                trialBalance.is_balanced ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-green-600">余额平衡</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="text-sm font-medium text-red-600">余额不平衡</span>
                  </>
                )
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {tbLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          <span className="ml-3 text-gray-600">加载中...</span>
        </div>
      )}

      {tbError && !tbLoading && (
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <p className="text-red-600 font-medium">加载失败</p>
            <p className="text-gray-500 text-sm mt-1">{tbError}</p>
          </CardContent>
        </Card>
      )}

      {!tbLoading && !tbError && !trialBalance && (
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            请选择会计期间以查看科目余额表
          </CardContent>
        </Card>
      )}

      {!tbLoading && !tbError && trialBalance && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    科目编码
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    科目名称
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    期初借方
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    期初贷方
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    本期借方
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    本期贷方
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    累计借方发生额
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    累计贷方发生额
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    期末借方
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    期末贷方
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredItems.map((row) => {
                  const isParent = !row.is_detail
                  const indent = row.account_level
                  const isExpanded = expandedParents.has(row.account_code)

                  return (
                    <tr
                      key={row.account_code}
                      className={`hover:bg-gray-50 transition-colors ${isParent ? 'bg-blue-50/50 font-medium' : ''}`}
                    >
                      <td className="px-4 py-2 text-sm font-mono text-gray-900">
                        <div className="flex items-center" style={{ paddingLeft: `${(indent - 1) * 20}px` }}>
                          {isParent && (
                            <button
                              type="button"
                              onClick={() => toggleParent(row.account_code)}
                              className="mr-1 p-0.5 rounded hover:bg-gray-200 transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                              )}
                            </button>
                          )}
                          {!isParent && <span className="w-5 inline-block" />}
                          {row.account_code}
                        </div>
                      </td>
                      <td className={`px-4 py-2 text-sm text-gray-900 ${isParent ? 'font-semibold' : ''}`}>
                        {row.account_name}
                      </td>
                      <td className="px-4 py-2 text-sm text-right font-mono text-gray-900">
                        {formatAmount(row.opening_debit)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right font-mono text-gray-900">
                        {formatAmount(row.opening_credit)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right font-mono text-gray-900">
                        {formatAmount(row.period_debit)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right font-mono text-gray-900">
                        {formatAmount(row.period_credit)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right font-mono text-gray-900">
                        {formatAmount(row.cumulative_debit)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right font-mono text-gray-900">
                        {formatAmount(row.cumulative_credit)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right font-mono font-medium text-gray-900">
                        {formatAmount(row.closing_debit)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right font-mono font-medium text-gray-900">
                        {formatAmount(row.closing_credit)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-sm font-bold text-gray-900">
                    合计（最末级科目）
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono font-bold text-gray-900">
                    {formatCurrency(trialBalance.total_opening_debit)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono font-bold text-gray-900">
                    {formatCurrency(trialBalance.total_opening_credit)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono font-bold text-gray-900">
                    {formatCurrency(trialBalance.total_period_debit)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono font-bold text-gray-900">
                    {formatCurrency(trialBalance.total_period_credit)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono font-bold text-gray-900">
                    {formatCurrency(trialBalance.total_cumulative_debit)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono font-bold text-gray-900">
                    {formatCurrency(trialBalance.total_cumulative_credit)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono font-bold text-gray-900">
                    {formatCurrency(trialBalance.total_closing_debit)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono font-bold text-gray-900">
                    {formatCurrency(trialBalance.total_closing_credit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

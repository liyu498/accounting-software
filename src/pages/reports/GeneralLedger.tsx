import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Printer, Download, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { formatCurrency, formatDate } from '../../lib/utils'
import { cn } from '../../lib/utils'
import { usePeriodStore, type GeneralLedgerItem } from '../../stores/periodStore'
import { useCompanyStore } from '../../stores/companyStore'
import { useToast } from '../../components/ui/Toast'

const ACCOUNT_TYPE_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'asset', label: '资产' },
  { value: 'liability', label: '负债' },
  { value: 'equity', label: '权益' },
  { value: 'cost', label: '成本' },
  { value: 'profit_loss', label: '损益' },
] as const

export function GeneralLedger() {
  const { addToast } = useToast()
  const { selectedCompanyId } = useCompanyStore()
  const { periods, currentPeriodId, dataVersion, fetchPeriods, setCurrentPeriod, getGeneralLedger } =
    usePeriodStore()

  const [ledgerData, setLedgerData] = useState<GeneralLedgerItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [accountType, setAccountType] = useState('')
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (selectedCompanyId) {
      fetchPeriods(selectedCompanyId)
    }
  }, [selectedCompanyId, fetchPeriods])

  useEffect(() => {
    if (!currentPeriodId) return
    let cancelled = false
    setIsLoading(true)
    getGeneralLedger(currentPeriodId, accountType || undefined)
      .then((data) => {
        if (!cancelled) setLedgerData(data)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [currentPeriodId, accountType, dataVersion, getGeneralLedger])

  const toggleAccount = (code: string) => {
    setExpandedAccounts((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const expandAll = () => {
    setExpandedAccounts(new Set(ledgerData.map((a) => a.account_code)))
  }

  const collapseAll = () => {
    setExpandedAccounts(new Set())
  }

  const totals = useMemo(() => {
    return ledgerData.reduce(
      (acc, item) => ({
        openingDebit: acc.openingDebit + item.opening_debit,
        openingCredit: acc.openingCredit + item.opening_credit,
        periodDebit: acc.periodDebit + item.period_debit,
        periodCredit: acc.periodCredit + item.period_credit,
        closingDebit: acc.closingDebit + item.closing_debit,
        closingCredit: acc.closingCredit + item.closing_credit,
      }),
      { openingDebit: 0, openingCredit: 0, periodDebit: 0, periodCredit: 0, closingDebit: 0, closingCredit: 0 },
    )
  }, [ledgerData])

  const handlePrint = () => window.print()

  const handleExport = () => {
    if (ledgerData.length === 0) return
    const period = periods.find((p) => p.id === currentPeriodId)
    const periodLabel = period ? `${period.period_year}-${String(period.period_month).padStart(2, '0')}` : 'unknown'
    const rows: string[][] = []
    for (const item of ledgerData) {
      rows.push([item.account_code, item.account_name, '', '', '', '', ''])
      for (const e of item.entries) {
        rows.push([
          e.voucher_date, e.voucher_number, e.summary,
          e.direction === 'debit' ? String(e.amount) : '0',
          e.direction === 'credit' ? String(e.amount) : '0',
          String(e.balance), '',
        ])
      }
    }
    const csvContent = [
      ['科目编码', '科目名称', '日期', '凭证号', '摘要', '借方金额', '贷方金额', '余额'].join(','),
      ...rows.map((r) => r.join(',')),
    ].join('\n')
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `总账-${periodLabel}.csv`
    link.click()
  }

  const selectedPeriod = periods.find((p) => p.id === currentPeriodId)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">总账</h1>
          <p className="text-gray-500 mt-1">查看各科目总账明细</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />打印
          </Button>
          <Button variant="primary" onClick={handleExport} disabled={ledgerData.length === 0}>
            <Download className="w-4 h-4 mr-2" />导出Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">会计期间</label>
              <select
                title="会计期间"
                className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[180px]"
                value={currentPeriodId ?? ''}
                onChange={(e) => setCurrentPeriod(e.target.value || null)}
              >
                <option value="">请选择期间</option>
                {[...periods].sort((a, b) => (a.period_year * 100 + a.period_month) - (b.period_year * 100 + b.period_month)).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.period_year}年{p.period_month}月
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">科目类型</label>
              <select
                title="科目类型"
                className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
              >
                {ACCOUNT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            {ledgerData.length > 0 && (
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" size="sm" onClick={expandAll}>全部展开</Button>
                <Button variant="outline" size="sm" onClick={collapseAll}>全部折叠</Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />加载中...
        </div>
      )}

      {/* Ledger Content */}
      {!isLoading && currentPeriodId && ledgerData.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            当前期间暂无总账数据
          </CardContent>
        </Card>
      )}

      {!isLoading && !currentPeriodId && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            请选择会计期间
          </CardContent>
        </Card>
      )}

      {!isLoading && ledgerData.length > 0 && (
        <>
          {/* Grand totals */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-6 gap-4 text-center">
                <div>
                  <span className="text-xs text-gray-500">期初借方合计</span>
                  <p className="text-sm font-mono font-medium text-gray-900">{formatCurrency(totals.openingDebit)}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">期初贷方合计</span>
                  <p className="text-sm font-mono font-medium text-gray-900">{formatCurrency(totals.openingCredit)}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">本期借方合计</span>
                  <p className="text-sm font-mono font-medium text-gray-900">{formatCurrency(totals.periodDebit)}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">本期贷方合计</span>
                  <p className="text-sm font-mono font-medium text-gray-900">{formatCurrency(totals.periodCredit)}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">期末借方合计</span>
                  <p className="text-sm font-mono font-medium text-gray-900">{formatCurrency(totals.closingDebit)}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">期末贷方合计</span>
                  <p className="text-sm font-mono font-medium text-gray-900">{formatCurrency(totals.closingCredit)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account sections */}
          {ledgerData.map((item) => {
            const isExpanded = expandedAccounts.has(item.account_code)
            return (
              <Card key={item.account_code}>
                {/* Account header - clickable */}
                <button
                  type="button"
                  className="w-full text-left p-4 hover:bg-gray-50 transition-colors flex items-center gap-3"
                  onClick={() => toggleAccount(item.account_code)}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}
                  <span className="font-mono font-medium text-gray-900">{item.account_code}</span>
                  <span className="font-medium text-gray-900">{item.account_name}</span>
                  <span className="ml-auto flex gap-6 text-xs text-gray-500">
                    <span>期初: 借{formatCurrency(item.opening_debit)} / 贷{formatCurrency(item.opening_credit)}</span>
                    <span>本期: 借{formatCurrency(item.period_debit)} / 贷{formatCurrency(item.period_credit)}</span>
                    <span>期末: 借{formatCurrency(item.closing_debit)} / 贷{formatCurrency(item.closing_credit)}</span>
                  </span>
                </button>

                {/* Entry rows */}
                {isExpanded && (
                  <div className="overflow-x-auto border-t border-gray-200">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">日期</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">凭证号</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">摘要</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">借方金额</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">贷方金额</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">余额</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {item.entries.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">暂无明细</td>
                          </tr>
                        ) : (
                          item.entries.map((entry, idx) => (
                            <tr key={`${entry.voucher_id}-${idx}`} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-2 text-sm text-gray-600">{formatDate(entry.voucher_date)}</td>
                              <td className="px-4 py-2 text-sm font-mono font-medium text-primary-600">{entry.voucher_number}</td>
                              <td className="px-4 py-2 text-sm text-gray-900">{entry.summary}</td>
                              <td className="px-4 py-2 text-sm text-right font-mono text-gray-900">
                                {entry.direction === 'debit' ? formatCurrency(entry.amount) : '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-right font-mono text-gray-900">
                                {entry.direction === 'credit' ? formatCurrency(entry.amount) : '-'}
                              </td>
                              <td className={cn('px-4 py-2 text-sm text-right font-mono font-medium', entry.balance >= 0 ? 'text-gray-900' : 'text-red-600')}>
                                {formatCurrency(entry.balance)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {item.entries.length > 0 && (
                        <tfoot className="bg-gray-50 border-t border-gray-200">
                          <tr>
                            <td colSpan={3} className="px-4 py-2 text-sm font-medium text-gray-900">合计</td>
                            <td className="px-4 py-2 text-sm text-right font-mono font-medium text-gray-900">{formatCurrency(item.period_debit)}</td>
                            <td className="px-4 py-2 text-sm text-right font-mono font-medium text-gray-900">{formatCurrency(item.period_credit)}</td>
                            <td className="px-4 py-2" />
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )}
              </Card>
            )
          })}
        </>
      )}
    </div>
  )
}

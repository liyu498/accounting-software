import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Printer, Download, Loader2 } from 'lucide-react'
import { usePeriodStore } from '../../stores/periodStore'
import { useCompanyStore } from '../../stores/companyStore'
import { useToast } from '../../components/ui/Toast'
import { invoke } from '../../lib/tauri'
import { formatCurrency, formatDate } from '../../lib/utils'

interface DetailEntry {
  voucher_id: string
  voucher_number: string
  voucher_date: string
  summary: string
  direction: string
  amount: number
  balance: number
  account_code: string
  account_name: string
}

interface AccountCodeOption {
  code: string
  name: string
  parent_code: string | null
  level: number
  account_type: string
}

export function MultiColumnLedger() {
  const { addToast } = useToast()
  const { selectedCompanyId } = useCompanyStore()
  const { periods, currentPeriodId, fetchPeriods, setCurrentPeriod } = usePeriodStore()

  const [accounts, setAccounts] = useState<AccountCodeOption[]>([])
  const [selectedParentCode, setSelectedParentCode] = useState('')
  const [childAccounts, setChildAccounts] = useState<AccountCodeOption[]>([])
  const [entries, setEntries] = useState<DetailEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (selectedCompanyId) fetchPeriods(selectedCompanyId)
  }, [selectedCompanyId, fetchPeriods])

  useEffect(() => {
    if (!selectedCompanyId) return
    invoke<AccountCodeOption[]>('get_account_codes', { companyId: selectedCompanyId })
      .then((list) => {
        // Only parent accounts with children (level 1 typically)
        const parents = list.filter((a) => a.level === 1 && (a.account_type === 'cost' || a.account_type === 'profit_loss'))
        setAccounts(parents)
      })
      .catch(() => setAccounts([]))
  }, [selectedCompanyId])

  useEffect(() => {
    if (!selectedParentCode || !selectedCompanyId) {
      setChildAccounts([])
      setEntries([])
      return
    }
    invoke<AccountCodeOption[]>('get_detail_account_codes', { parentCode: selectedParentCode })
      .then((children) => setChildAccounts(children))
      .catch(() => setChildAccounts([]))
  }, [selectedParentCode, selectedCompanyId])

  const loadData = async () => {
    if (!currentPeriodId || childAccounts.length === 0) return
    setIsLoading(true)
    try {
      // Fetch subsidiary ledger data for each child account
      const allEntries: DetailEntry[] = []
      for (const child of childAccounts) {
        const data = await invoke<DetailEntry[]>('get_subsidiary_ledger', {
          periodId: currentPeriodId,
          accountCode: child.code,
        }).catch(() => [] as DetailEntry[])
        for (const e of data) {
          allEntries.push({ ...e, account_code: child.code, account_name: child.name })
        }
      }
      setEntries(allEntries)
    } catch (e) {
      addToast('查询失败: ' + String(e), 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (currentPeriodId && childAccounts.length > 0) loadData()
  }, [currentPeriodId, childAccounts])

  // Build multi-column table: rows = voucher lines, columns = child accounts
  const rowMap = useMemo(() => {
    const map = new Map<string, {
      voucher_date: string; voucher_number: string; summary: string;
      columns: Record<string, number>
    }>()
    for (const e of entries) {
      const key = `${e.voucher_id}`
      if (!map.has(key)) {
        map.set(key, { voucher_date: e.voucher_date, voucher_number: e.voucher_number, summary: e.summary, columns: {} })
      }
      const row = map.get(key)!
      const current = row.columns[e.account_code] || 0
      row.columns[e.account_code] = current + e.amount
    }
    return Array.from(map.values()).sort((a, b) => a.voucher_date.localeCompare(b.voucher_date))
  }, [entries])

  const totals = useMemo(() => {
    const result: Record<string, number> = {}
    for (const child of childAccounts) {
      result[child.code] = 0
    }
    for (const row of rowMap) {
      for (const [code, amount] of Object.entries(row.columns)) {
        result[code] = (result[code] || 0) + amount
      }
    }
    return result
  }, [rowMap, childAccounts])

  const handleExport = () => {
    if (rowMap.length === 0) return
    const parentName = accounts.find((a) => a.code === selectedParentCode)?.name || selectedParentCode
    const period = periods.find((p) => p.id === currentPeriodId)
    const periodLabel = period ? `${period.period_year}-${String(period.period_month).padStart(2, '0')}` : ''

    const headers = ['日期', '凭证号', '摘要', ...childAccounts.map((c) => `${c.code} ${c.name}`), '合计']
    const csvRows = rowMap.map((row) => {
      const colValues = childAccounts.map((c) => String(row.columns[c.code] || 0))
      const rowTotal = colValues.reduce((s, v) => s + Number(v), 0)
      return [row.voucher_date, row.voucher_number, row.summary, ...colValues, String(rowTotal)].join(',')
    })
    const totalRow = ['合计', '', '', ...childAccounts.map((c) => String(totals[c.code] || 0)), String(Object.values(totals).reduce((s, v) => s + v, 0))].join(',')

    const csvContent = [headers.join(','), ...csvRows, totalRow].join('\n')
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `多栏账-${parentName}-${periodLabel}.csv`
    link.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">多栏明细账</h1>
          <p className="text-gray-500 mt-1">按科目多栏展示费用/收入明细</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />打印
          </Button>
          <Button onClick={handleExport} disabled={rowMap.length === 0}>
            <Download className="w-4 h-4 mr-2" />导出CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">会计期间</label>
              <select
                title="会计期间"
                className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[180px]"
                value={currentPeriodId ?? ''}
                onChange={(e) => setCurrentPeriod(e.target.value || null)}
              >
                <option value="">请选择期间</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>{p.period_year}年{p.period_month}月</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">上级科目</label>
              <select
                title="上级科目"
                className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[240px]"
                value={selectedParentCode}
                onChange={(e) => setSelectedParentCode(e.target.value)}
              >
                <option value="">请选择科目</option>
                {accounts.map((a) => (
                  <option key={a.code} value={a.code}>{a.code} {a.name}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />加载中...
        </div>
      )}

      {!isLoading && selectedParentCode && childAccounts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            该科目下无明细科目
          </CardContent>
        </Card>
      )}

      {!isLoading && !selectedParentCode && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            请选择上级科目
          </CardContent>
        </Card>
      )}

      {!isLoading && childAccounts.length > 0 && rowMap.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 sticky left-0 bg-gray-50 min-w-[80px]">日期</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 min-w-[90px]">凭证号</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 min-w-[100px]">摘要</th>
                    {childAccounts.map((c) => (
                      <th key={c.code} className="px-3 py-2 text-right text-xs font-medium text-gray-500 min-w-[80px]">{c.name}</th>
                    ))}
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 min-w-[80px]">合计</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rowMap.map((row, idx) => {
                    const rowTotal = childAccounts.reduce((s, c) => s + (row.columns[c.code] || 0), 0)
                    return (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm text-gray-600 sticky left-0 bg-white">{formatDate(row.voucher_date)}</td>
                        <td className="px-3 py-2 text-sm font-mono text-primary-600">{row.voucher_number}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{row.summary}</td>
                        {childAccounts.map((c) => (
                          <td key={c.code} className="px-3 py-2 text-sm text-right font-mono text-gray-900">
                            {row.columns[c.code] ? formatCurrency(row.columns[c.code]) : '-'}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-sm text-right font-mono font-medium text-gray-900">{formatCurrency(rowTotal)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td className="px-3 py-2 text-sm font-medium" colSpan={3}>合计</td>
                    {childAccounts.map((c) => (
                      <td key={c.code} className="px-3 py-2 text-sm text-right font-mono font-medium">{formatCurrency(totals[c.code] || 0)}</td>
                    ))}
                    <td className="px-3 py-2 text-sm text-right font-mono font-bold">{formatCurrency(Object.values(totals).reduce((s, v) => s + v, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && childAccounts.length > 0 && rowMap.length === 0 && currentPeriodId && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            当前期间暂无数据
          </CardContent>
        </Card>
      )}
    </div>
  )
}

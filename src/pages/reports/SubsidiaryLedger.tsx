import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Printer, Download, Loader2 } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import { usePeriodStore, type SubsidiaryLedgerItem } from '../../stores/periodStore'
import { useAccountStore } from '../../stores/accountStore'
import { useCompanyStore } from '../../stores/companyStore'

export function SubsidiaryLedger() {
  const { selectedCompanyId } = useCompanyStore()
  const { periods, currentPeriodId, fetchPeriods, setCurrentPeriod, getSubsidiaryLedger } = usePeriodStore()
  const { accounts, fetchAccounts } = useAccountStore()

  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)
  const [selectedAccountCode, setSelectedAccountCode] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [ledgerData, setLedgerData] = useState<SubsidiaryLedgerItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (selectedCompanyId) fetchPeriods(selectedCompanyId)
  }, [selectedCompanyId, fetchPeriods])

  useEffect(() => {
    if (selectedCompanyId) fetchAccounts(selectedCompanyId)
  }, [selectedCompanyId, fetchAccounts])

  useEffect(() => {
    if (!selectedPeriodId && currentPeriodId) {
      setSelectedPeriodId(currentPeriodId)
    }
  }, [currentPeriodId, selectedPeriodId])

  const detailAccounts = accounts.filter((a) => a.is_detail === 1 && a.is_enabled === 1)

  const loadData = useCallback(async () => {
    if (!selectedPeriodId || !selectedAccountCode) {
      setLedgerData([])
      return
    }
    setLoading(true)
    try {
      const result = await getSubsidiaryLedger(selectedPeriodId, selectedAccountCode)
      setLedgerData(result)
    } catch {
      setLedgerData([])
    } finally {
      setLoading(false)
    }
  }, [selectedPeriodId, selectedAccountCode, getSubsidiaryLedger])

  useEffect(() => {
    loadData()
  }, [loadData])

  const currentAccount = accounts.find((a) => a.code === selectedAccountCode)

  const filteredData = ledgerData.filter((entry) => {
    if (startDate && entry.voucher_date < startDate) return false
    if (endDate && entry.voucher_date > endDate) return false
    return true
  })

  const totals = {
    debit: filteredData.reduce((acc, e) => acc + e.debit, 0),
    credit: filteredData.reduce((acc, e) => acc + e.credit, 0),
  }

  const openingBalance = filteredData.length > 0
    ? filteredData[0].balance - filteredData[0].debit + filteredData[0].credit
    : 0

  const closingBalance = filteredData.length > 0
    ? filteredData[filteredData.length - 1].balance
    : 0

  const periodOptions = [...periods].sort((a, b) => (b.period_year * 100 + b.period_month) - (a.period_year * 100 + a.period_month))

  const handleExport = () => {
    if (!filteredData.length) return
    const csvContent = [
      ['日期', '凭证号', '摘要', '对方科目', '借方金额', '贷方金额', '余额方向', '余额'].join(','),
      ...filteredData.map((e) =>
        [e.voucher_date, e.voucher_number, e.summary, e.opposite_account,
          e.debit, e.credit, e.balance_direction === 'debit' ? '借' : '贷', e.balance].join(',')
      ),
      ['', '', '', '合计', totals.debit, totals.credit, '', ''].join(','),
    ].join('\n')
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `明细账-${selectedAccountCode}.csv`
    link.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">明细账</h1>
          <p className="text-gray-500 mt-1">查看各科目明细账及余额变动</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />
            打印
          </Button>
          <Button variant="primary" onClick={handleExport} disabled={!filteredData.length}>
            <Download className="w-4 h-4 mr-2" />
            导出
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
            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-gray-700">科目选择</label>
              <select
                title="选择科目"
                className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={selectedAccountCode}
                onChange={(e) => setSelectedAccountCode(e.target.value)}
              >
                <option value="">请选择科目</option>
                {detailAccounts.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} - {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">开始日期</label>
              <input
                type="date"
                title="开始日期"
                className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">结束日期</label>
              <input
                type="date"
                title="结束日期"
                className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {currentAccount && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-8">
              <div>
                <span className="text-sm text-gray-500">科目编码</span>
                <p className="text-lg font-mono font-medium text-gray-900">{currentAccount.code}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">科目名称</span>
                <p className="text-lg font-medium text-gray-900">{currentAccount.name}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">余额方向</span>
                <p className="text-lg font-medium text-gray-900">
                  {currentAccount.normal_balance === 'debit' ? '借' : '贷'}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">期初余额</span>
                <p className="text-lg font-mono font-medium text-gray-900">{formatCurrency(openingBalance)}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">期末余额</span>
                <p className="text-lg font-mono font-medium text-gray-900">{formatCurrency(closingBalance)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">日期</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">凭证号</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">摘要</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">对方科目</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">借方金额</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">贷方金额</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">余额方向</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">余额</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    加载中...
                  </td>
                </tr>
              ) : !filteredData.length ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    {ledgerData.length > 0 ? '所选日期范围内无数据' : '请选择科目以查看明细账数据'}
                  </td>
                </tr>
              ) : (
                filteredData.map((entry, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-600">{entry.voucher_date}</td>
                    <td className="px-4 py-3 text-sm font-mono font-medium text-primary-600">{entry.voucher_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{entry.summary}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{entry.opposite_account}</td>
                    <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">
                      {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">
                      {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-gray-900">
                      {entry.balance_direction === 'debit' ? '借' : '贷'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono font-medium text-gray-900">
                      {formatCurrency(entry.balance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredData.length > 0 && (
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-sm font-medium text-gray-900">合计</td>
                  <td className="px-4 py-3 text-sm text-right font-mono font-medium text-gray-900">
                    {formatCurrency(totals.debit)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono font-medium text-gray-900">
                    {formatCurrency(totals.credit)}
                  </td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  )
}

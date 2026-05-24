import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { useSuccessToast, useWarningToast } from '../../components/ui/Toast'
import {
  Save,
  Calculator,
  AlertCircle,
  CheckCircle,
  ShieldCheck,
  Lock,
} from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import { usePeriodStore } from '../../stores/periodStore'
import { useAccountStore } from '../../stores/accountStore'
import { useCompanyStore } from '../../stores/companyStore'
import type { AccountCode } from '../../stores/accountStore'

interface BalanceRow {
  code: string
  name: string
  normalBalance: 'debit' | 'credit'
  openingDebit: number
  openingCredit: number
  originalDebit: number
  originalCredit: number
}

function buildRows(accounts: AccountCode[], existing: Map<string, { debit: number; credit: number }>): BalanceRow[] {
  return accounts
    .filter((a) => a.is_detail === 1 && a.is_enabled === 1)
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((a) => {
      const saved = existing.get(a.code)
      const normalBalance = a.normal_balance === 'credit' ? 'credit' : 'debit'
      return {
        code: a.code,
        name: a.name,
        normalBalance,
        openingDebit: saved?.debit ?? 0,
        openingCredit: saved?.credit ?? 0,
        originalDebit: saved?.debit ?? 0,
        originalCredit: saved?.credit ?? 0,
      }
    })
}

export function InitialBalances() {
  const successToast = useSuccessToast()
  const warningToast = useWarningToast()

  const { selectedCompanyId } = useCompanyStore()
  const { periods, currentPeriodId, fetchPeriods, fetchTrialBalance, saveInitialBalance, validateInitialBalances, finalizeInitialBalances } = usePeriodStore()
  const { accounts, fetchAccounts } = useAccountStore()

  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)
  const [rows, setRows] = useState<BalanceRow[]>([])
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [validationResult, setValidationResult] = useState<{ is_balanced: boolean; message: string } | null>(null)

  useEffect(() => {
    if (selectedCompanyId) {
      fetchPeriods(selectedCompanyId)
    }
  }, [selectedCompanyId, fetchPeriods])

  useEffect(() => {
    if (selectedCompanyId) fetchAccounts(selectedCompanyId)
  }, [selectedCompanyId, fetchAccounts])

  useEffect(() => {
    if (!selectedPeriodId && currentPeriodId) {
      setSelectedPeriodId(currentPeriodId)
    }
  }, [currentPeriodId, selectedPeriodId])

  const loadBalances = useCallback(async () => {
    if (!selectedPeriodId) {
      setRows(buildRows(accounts, new Map()))
      return
    }
    try {
      const result = await fetchTrialBalance(selectedPeriodId)
      const existing = new Map<string, { debit: number; credit: number }>()
      for (const item of result.items) {
        existing.set(item.account_code, { debit: item.opening_debit, credit: item.opening_credit })
      }
      setRows(buildRows(accounts, existing))
    } catch {
      setRows(buildRows(accounts, new Map()))
    }
  }, [selectedPeriodId, accounts, fetchTrialBalance])

  useEffect(() => {
    if (accounts.length > 0) {
      loadBalances()
    }
  }, [accounts.length, loadBalances])

  const totals = rows.reduce(
    (acc, r) => ({
      debit: acc.debit + r.openingDebit,
      credit: acc.credit + r.openingCredit,
    }),
    { debit: 0, credit: 0 },
  )

  const isBalanced = Math.abs(totals.debit - totals.credit) < 0.01

  const changedRows = rows.filter(
    (r) => Math.abs(r.openingDebit - r.originalDebit) > 0.001 || Math.abs(r.openingCredit - r.originalCredit) > 0.001,
  )

  const handleUpdate = (code: string, field: 'openingDebit' | 'openingCredit', raw: string) => {
    const value = parseFloat(raw) || 0
    setRows((prev) =>
      prev.map((r) => {
        if (r.code !== code) return r
        if (field === 'openingDebit') {
          return { ...r, openingDebit: value, openingCredit: value > 0 ? 0 : r.openingCredit }
        }
        return { ...r, openingCredit: value, openingDebit: value > 0 ? 0 : r.openingDebit }
      }),
    )
  }

  const handleSave = async () => {
    if (!selectedPeriodId) {
      warningToast('请先选择会计期间')
      return
    }
    if (changedRows.length === 0) {
      warningToast('没有需要保存的变更')
      return
    }
    setSaving(true)
    try {
      for (const r of changedRows) {
        await saveInitialBalance({
          period_id: selectedPeriodId,
          account_code: r.code,
          opening_debit: r.openingDebit,
          opening_credit: r.openingCredit,
        })
      }
      setRows((prev) =>
        prev.map((r) => {
          const changed = changedRows.find((c) => c.code === r.code)
          if (!changed) return r
          return { ...r, originalDebit: r.openingDebit, originalCredit: r.openingCredit }
        }),
      )
      setValidationResult(null)
      successToast('期初余额保存成功')
    } catch (err) {
      warningToast(`保存失败: ${String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const handleValidate = async () => {
    if (!selectedPeriodId) {
      warningToast('请先选择会计期间')
      return
    }
    setValidating(true)
    try {
      const result = await validateInitialBalances(selectedPeriodId)
      setValidationResult(result)
      if (result.is_balanced) {
        successToast(result.message || '验证通过')
      } else {
        warningToast(result.message || '借贷不平衡')
      }
    } catch (err) {
      warningToast(`验证失败: ${String(err)}`)
    } finally {
      setValidating(false)
    }
  }

  const handleFinalize = async () => {
    if (!selectedPeriodId) {
      warningToast('请先选择会计期间')
      return
    }
    const confirmed = window.confirm('确认启用该期间的期初余额？启用后将不可修改。')
    if (!confirmed) return

    setFinalizing(true)
    try {
      await finalizeInitialBalances(selectedPeriodId)
      successToast('期初余额已启用')
    } catch (err) {
      warningToast(`启用失败: ${String(err)}`)
    } finally {
      setFinalizing(false)
    }
  }

  const periodOptions = [...periods]
    .sort((a, b) => {
      const keyA = a.period_year * 100 + a.period_month
      const keyB = b.period_year * 100 + b.period_month
      return keyB - keyA
    })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">期初余额设置</h1>
          <p className="text-gray-500 mt-1">设置各会计科目的期初余额</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleValidate} disabled={validating || !selectedPeriodId}>
            <ShieldCheck className="w-4 h-4 mr-2" />
            {validating ? '验证中...' : '验证'}
          </Button>
          <Button variant="outline" onClick={handleFinalize} disabled={finalizing || !selectedPeriodId}>
            <Lock className="w-4 h-4 mr-2" />
            {finalizing ? '启用中...' : '启用'}
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving || !selectedPeriodId}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Calculator className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">期初余额说明</p>
              <p className="text-sm text-gray-500 mt-1">
                期初余额是指账套启用时各科目的初始余额。资产类科目余额方向为借，负债和权益类科目余额方向为贷。
                保存后请先验证借贷平衡，再启用。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">会计期间</label>
                <select
                  title="选择会计期间"
                  className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={selectedPeriodId ?? ''}
                  onChange={(e) => {
                    setSelectedPeriodId(e.target.value || null)
                    setValidationResult(null)
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
            <div className="flex items-center gap-2">
              {validationResult ? (
                validationResult.is_balanced ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-green-600">{validationResult.message}</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="text-sm font-medium text-red-600">{validationResult.message}</span>
                  </>
                )
              ) : isBalanced ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-600">借贷平衡</span>
                </>
              ) : rows.length > 0 ? (
                <>
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <span className="text-sm font-medium text-red-600">
                    借贷不平衡 (差{formatCurrency(Math.abs(totals.debit - totals.credit))})
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

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
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  余额方向
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  借方期初余额
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  贷方期初余额
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                    {selectedPeriodId ? '暂无明细科目' : '请先选择会计期间'}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.code} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">{row.code}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{row.name}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          row.normalBalance === 'debit'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {row.normalBalance === 'debit' ? '借' : '贷'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        title={`${row.name} 借方期初余额`}
                        value={row.openingDebit || ''}
                        onChange={(e) => handleUpdate(row.code, 'openingDebit', e.target.value)}
                        className="w-full text-right px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        title={`${row.name} 贷方期初余额`}
                        value={row.openingCredit || ''}
                        onChange={(e) => handleUpdate(row.code, 'openingCredit', e.target.value)}
                        className="w-full text-right px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                        placeholder="0.00"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-sm font-bold text-gray-900">
                    合计
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono font-bold text-gray-900">{formatCurrency(totals.debit)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono font-bold text-gray-900">{formatCurrency(totals.credit)}</span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  )
}

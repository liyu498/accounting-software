import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { useWarningToast, useSuccessToast } from '../components/ui/Toast'
import {
  Calendar,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  ArrowRight,
  DollarSign,
} from 'lucide-react'
import { cn, formatCurrency } from '../lib/utils'
import { usePeriodStore } from '../stores/periodStore'
import { useCompanyStore } from '../stores/companyStore'
import { useCurrencyStore, ExchangeAdjustmentItem } from '../stores/currencyStore'
import { invoke } from '../lib/tauri'

interface SettlementEntryResult {
  account_code: string
  account_name: string
  direction: string
  amount: number
}

interface SettlementResult {
  voucher_id: string | null
  voucher_number: string | null
  total_debit: number
  total_credit: number
  entries: SettlementEntryResult[]
  message: string
}

interface ClosingStep {
  step: string
  description: string
  icon: React.ReactNode
  status: 'pending' | 'in_progress' | 'completed' | 'error'
  accounts: { code: string; name: string; direction: string; amount: number }[]
  success: boolean
  message?: string
}

export function PeriodClosing() {
  const warningToast = useWarningToast()
  const successToast = useSuccessToast()

  const { periods, fetchPeriods, closePeriod, reopenPeriod, getIncomeStatement } = usePeriodStore()
  const { selectedCompanyId } = useCompanyStore()

  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)
  const [isClosing, setIsClosing] = useState(false)
  const [closingResults, setClosingResults] = useState<ClosingStep[]>([])
  const [isCompleted, setIsCompleted] = useState(false)
  const [incomeData, setIncomeData] = useState({ totalRevenue: 0, totalExpense: 0, netProfit: 0 })
  const [exchangeAdjustments, setExchangeAdjustments] = useState<ExchangeAdjustmentItem[]>([])
  const [showExchangeAdjust, setShowExchangeAdjust] = useState(false)
  const { calculateExchangeAdjustment } = useCurrencyStore()

  useEffect(() => {
    if (selectedCompanyId) {
      fetchPeriods(selectedCompanyId)
    }
  }, [selectedCompanyId, fetchPeriods])

  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId)
  const isPeriodClosed = selectedPeriod?.status === 'closed'

  useEffect(() => {
    if (selectedPeriodId && selectedPeriod?.status === 'open') {
      getIncomeStatement(selectedPeriodId).then((data) => {
        const revenue = data.items.find((i) => i.item_code === 'revenue_total')
        const expense = data.items.find((i) => i.item_code === 'expense_total')
        setIncomeData({
          totalRevenue: revenue?.current_amount ?? 0,
          totalExpense: expense?.current_amount ?? 0,
          netProfit: data.current_period_total,
        })
      }).catch(() => {
        setIncomeData({ totalRevenue: 0, totalExpense: 0, netProfit: 0 })
      })
      // Load exchange adjustments if company selected
      if (selectedCompanyId) {
        calculateExchangeAdjustment(selectedCompanyId, selectedPeriodId).then((adj) => {
          setExchangeAdjustments(adj)
        }).catch(() => setExchangeAdjustments([]))
      }
    }
  }, [selectedPeriodId, selectedPeriod, getIncomeStatement, selectedCompanyId, calculateExchangeAdjustment])

  const handlePerformClosing = async () => {
    if (!selectedPeriodId || !selectedCompanyId) {
      warningToast('请先选择会计期间')
      return
    }
    if (isPeriodClosed) {
      warningToast('本期已结账，无法重复操作')
      return
    }

    setIsClosing(true)
    setClosingResults([])
    setIsCompleted(false)

    const steps: ClosingStep[] = [
      {
        step: '1',
        description: '期末调汇',
        icon: <DollarSign className="w-5 h-5" />,
        status: 'pending',
        accounts: [],
        success: false,
      },
      {
        step: '2',
        description: '结转损益',
        icon: <TrendingUp className="w-5 h-5" />,
        status: 'pending',
        accounts: [],
        success: false,
      },
      {
        step: '3',
        description: '期末结账',
        icon: <Minus className="w-5 h-5" />,
        status: 'pending',
        accounts: [],
        success: false,
      },
    ]

    setClosingResults([...steps])

    // Step 1: Exchange rate adjustment - load and display
    const updatedSteps1 = [...steps]
    updatedSteps1[0] = { ...updatedSteps1[0], status: 'in_progress' }
    setClosingResults(updatedSteps1)

    try {
      const adj = await calculateExchangeAdjustment(selectedCompanyId, selectedPeriodId)
      updatedSteps1[0] = {
        ...updatedSteps1[0],
        status: 'completed',
        success: true,
        accounts: adj.map((e) => ({
          code: e.account_code,
          name: e.account_name,
          direction: e.direction,
          amount: Math.abs(e.difference),
        })),
        message: adj.length > 0
          ? `发现 ${adj.length} 项外币业务需调汇`
          : '本期无外币业务需调汇',
      }
      setClosingResults([...updatedSteps1])
    } catch (error) {
      updatedSteps1[0] = {
        ...updatedSteps1[0],
        status: 'error',
        success: false,
        message: String(error),
      }
      setClosingResults([...updatedSteps1])
      warningToast(`调汇检查失败: ${error}`)
      setIsClosing(false)
      return
    }

    // Step 2: Generate profit/loss settlement voucher
    const updatedSteps2 = [...updatedSteps1]
    updatedSteps2[1] = { ...updatedSteps2[1], status: 'in_progress' }
    setClosingResults(updatedSteps2)

    try {
      const result: SettlementResult = await invoke('generate_settlement_voucher', {
        companyId: selectedCompanyId,
        periodId: selectedPeriodId,
        ruleType: 'profit_loss',
      })

      updatedSteps2[1] = {
        ...updatedSteps2[1],
        status: 'completed',
        success: true,
        accounts: result.entries.map((e) => ({
          code: e.account_code,
          name: e.account_name,
          direction: e.direction,
          amount: e.amount,
        })),
        message: result.message,
      }
      setClosingResults(updatedSteps2)

      if (result.voucher_id) {
        successToast('结转损益凭证已生成')
      } else {
        successToast(result.message)
      }
    } catch (error) {
      updatedSteps2[1] = {
        ...updatedSteps2[1],
        status: 'error',
        success: false,
        message: String(error),
      }
      setClosingResults(updatedSteps2)
      warningToast(`结转损益失败: ${error}`)
      setIsClosing(false)
      return
    }

    // Step 3: Close the period
    setClosingResults((prev) => {
      const next = [...prev]
      if (next.length >= 3) {
        next[2] = { ...next[2], status: 'in_progress' }
      }
      return next
    })

    try {
      await closePeriod(selectedPeriodId)
      setClosingResults((prev) => {
        const next = [...prev]
        if (next.length >= 3) {
          next[2] = { ...next[2], status: 'completed', success: true }
        }
        return next
      })
      successToast('期末结账完成!')
    } catch (error) {
      setClosingResults((prev) => {
        const next = [...prev]
        if (next.length >= 3) {
          next[2] = { ...next[2], status: 'error', success: false, message: String(error) }
        }
        return next
      })
      warningToast(`结账失败: ${error}`)
    }

    setIsClosing(false)
    setIsCompleted(true)
  }

  const handleReopen = async () => {
    if (!selectedPeriodId) return
    try {
      await reopenPeriod(selectedPeriodId)
      successToast('已反结账，期间重新打开')
      setClosingResults([])
      setIsCompleted(false)
    } catch (error) {
      warningToast(`反结账失败: ${error}`)
    }
  }

  const handleReset = () => {
    setClosingResults([])
    setIsCompleted(false)
  }

  const getStepIcon = (step: ClosingStep) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case 'in_progress':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">期末结转</h1>
          <p className="text-gray-500 mt-1">执行期末结账操作，自动生成结转损益凭证</p>
        </div>
      </div>

      {/* Period Selector */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">选择会计期间:</span>
            </div>
            <select
              title="选择会计期间"
              className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={selectedPeriodId || ''}
              onChange={(e) => {
                setSelectedPeriodId(e.target.value || null)
                handleReset()
              }}
            >
              <option value="">请选择期间</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.period_year}年{String(p.period_month).padStart(2, '0')}月
                  {p.status === 'closed' ? ' (已结账)' : ''}
                </option>
              ))}
            </select>
            {isPeriodClosed && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                已结账
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">本月收入合计</p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {formatCurrency(incomeData.totalRevenue)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">本月成本合计</p>
                <p className="text-2xl font-bold text-red-600 mt-1">
                  {formatCurrency(incomeData.totalExpense)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">本月利润</p>
                <p className={cn('text-2xl font-bold mt-1', incomeData.netProfit >= 0 ? 'text-green-600' : 'text-red-600')}>
                  {formatCurrency(incomeData.netProfit)}
                </p>
              </div>
              <div className={cn('w-12 h-12 rounded-full flex items-center justify-center', incomeData.netProfit >= 0 ? 'bg-green-100' : 'bg-red-100')}>
                {incomeData.netProfit >= 0 ? <TrendingUp className="w-6 h-6 text-green-600" /> : <TrendingDown className="w-6 h-6 text-red-600" />}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Exchange Adjustment Preview */}
      {exchangeAdjustments.length > 0 && (
        <Card>
          <CardHeader className="px-6 py-4 border-b border-gray-100 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-gray-900">期末调汇预览</h2>
              <span className="text-sm text-gray-400">({exchangeAdjustments.length} 项)</span>
            </div>
            <button
              type="button"
              onClick={() => setShowExchangeAdjust(!showExchangeAdjust)}
              className="text-sm text-primary-600 hover:text-primary-800"
            >
              {showExchangeAdjust ? '收起' : '展开'}
            </button>
          </CardHeader>
          {showExchangeAdjust && (
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left font-medium text-gray-600">币别</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">科目</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">汇率</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">原币余额</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">调整后余额</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">汇兑差额</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600">方向</th>
                  </tr>
                </thead>
                <tbody>
                  {exchangeAdjustments.map((adj, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-medium">{adj.currency_code} {adj.currency_name}</td>
                      <td className="px-4 py-3">{adj.account_code} {adj.account_name}</td>
                      <td className="px-4 py-3 text-right font-mono">{adj.exchange_rate.toFixed(4)}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(adj.original_balance)}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(adj.adjusted_balance)}</td>
                      <td className={cn(
                        'px-4 py-3 text-right font-mono font-medium',
                        adj.difference > 0 ? 'text-green-600' : 'text-red-600',
                      )}>
                        {adj.difference > 0 ? '+' : ''}{formatCurrency(adj.difference)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-medium',
                          adj.direction === 'debit' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700',
                        )}>
                          {adj.direction === 'debit' ? '借' : '贷'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          )}
        </Card>
      )}

      {/* Closing Steps */}
      <Card>
        <CardHeader className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">结转步骤</h2>
        </CardHeader>
        <CardContent className="p-6">
          {closingResults.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>选择期间后点击"执行结转"开始期末结账</p>
              <p className="text-sm mt-1">系统将自动生成结转损益凭证并关闭该期间</p>
            </div>
          ) : (
            <div className="space-y-4">
              {closingResults.map((result, idx) => (
                <div
                  key={result.step}
                  className={cn(
                    'flex items-start gap-4 p-4 rounded-lg border-2 transition-all',
                    result.status === 'completed'
                      ? 'border-green-200 bg-green-50'
                      : result.status === 'error'
                      ? 'border-red-200 bg-red-50'
                      : result.status === 'in_progress'
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-gray-200 bg-white',
                  )}
                >
                  <div className="flex-shrink-0 mt-0.5">{getStepIcon(result)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-500">步骤 {result.step}</span>
                      <h3 className="text-base font-semibold text-gray-900">{result.description}</h3>
                    </div>
                    {result.status === 'completed' && result.accounts.length > 0 && (
                      <div className="mt-3 bg-white rounded-lg border border-green-200 p-3">
                        <p className="text-xs font-medium text-green-600 mb-2">生成凭证分录:</p>
                        <div className="space-y-1">
                          {result.accounts.map((acc, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  'text-xs px-1.5 py-0.5 rounded font-mono',
                                  acc.direction === 'debit' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                                )}>
                                  {acc.direction === 'debit' ? '借' : '贷'}
                                </span>
                                <span className="text-gray-600">{acc.code} {acc.name}</span>
                              </div>
                              <span className="font-mono font-medium">{formatCurrency(acc.amount)}</span>
                            </div>
                          ))}
                        </div>
                        {result.message && (
                          <p className="text-xs text-gray-500 mt-2 border-t border-gray-100 pt-2">
                            {result.message}
                          </p>
                        )}
                      </div>
                    )}
                    {result.status === 'completed' && result.accounts.length === 0 && (
                      <p className="text-sm text-gray-500 mt-2">本期无相关数据，无需结转</p>
                    )}
                    {result.status === 'error' && result.message && (
                      <p className="text-sm text-red-600 mt-2">{result.message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              {isCompleted ? (
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-green-600">结转完成</h3>
                    <p className="text-sm text-gray-500">期末结转已成功执行</p>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">执行期末结转</h3>
                  <p className="text-sm text-gray-500">
                    {selectedPeriod
                      ? `确定要执行 ${selectedPeriod.period_year}年${selectedPeriod.period_month}月 的期末结转吗？`
                      : '请先选择会计期间'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    系统将自动计算损益类科目余额，生成结转凭证并关闭该期间
                  </p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {isPeriodClosed && !isCompleted ? (
                <Button variant="outline" onClick={handleReopen}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  反结账
                </Button>
              ) : isCompleted ? (
                <Button variant="outline" onClick={handleReset}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  重新执行
                </Button>
              ) : (
                <Button
                  onClick={handlePerformClosing}
                  disabled={isClosing || !selectedPeriodId || isPeriodClosed}
                >
                  {isClosing ? '执行中...' : '执行结转'}
                  {!isClosing && <ArrowRight className="w-4 h-4 ml-2" />}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

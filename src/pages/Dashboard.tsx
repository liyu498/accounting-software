import { useMemo, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { useAuthStore } from '../stores/authStore'
import { useCompanyStore } from '../stores/companyStore'
import { useVoucherStore } from '../stores/voucherStore'
import { usePeriodStore } from '../stores/periodStore'
import { FileText, Receipt, Bot, Clock, Plus, ArrowRight, Building2, TrendingUp, TrendingDown, DollarSign, PieChart } from 'lucide-react'
import { formatCurrency } from '../lib/utils'
import { taxpayerTypeLabels } from '../lib/constants'
import { CardSkeleton } from '../components/ui/Skeleton'
import { invoke } from '../lib/tauri'
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line, CartesianGrid } from 'recharts'

interface TrialBalanceItem {
  account_code: string
  account_name: string
  account_type: string
  opening_debit: number
  opening_credit: number
  period_debit: number
  period_credit: number
  closing_debit: number
  closing_credit: number
}

interface AccountTypeSummary {
  type: string
  label: string
  amount: number
  color: string
}

export function Dashboard() {
  const { user } = useAuthStore()
  const { selectedCompanyId, getCompanyById } = useCompanyStore()
  const { periods, currentPeriodId, setCurrentPeriod, fetchPeriods } = usePeriodStore()
  const { vouchers, queryVouchers } = useVoucherStore()
  const navigate = useNavigate()
  const currentCompany = selectedCompanyId ? getCompanyById(selectedCompanyId) : null

  const [trialItems, setTrialItems] = useState<TrialBalanceItem[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (selectedCompanyId) {
      queryVouchers({ company_id: selectedCompanyId, page: 1, page_size: 10 })
      fetchPeriods(selectedCompanyId)
    }
  }, [selectedCompanyId, queryVouchers, fetchPeriods])

  useEffect(() => {
    if (currentPeriodId) {
      setDataLoading(true)
      invoke<{ items: TrialBalanceItem[] }>('get_trial_balance', { periodId: currentPeriodId })
        .then((r) => setTrialItems(r.items))
        .catch(() => setTrialItems([]))
        .finally(() => setDataLoading(false))
    } else {
      setDataLoading(false)
    }
  }, [currentPeriodId])

  const recentVouchers = useMemo(() => {
    return [...vouchers]
      .sort((a, b) => b.voucher_date.localeCompare(a.voucher_date) || b.voucher_number.localeCompare(a.voucher_number))
      .slice(0, 5)
      .map(v => ({
        id: v.voucher_number,
        date: v.voucher_date,
        description: v.summary || '无摘要',
        amount: v.total_debit,
        status: v.status === 'approved' ? '已审核' : v.status === 'reversed' ? '已冲销' : '待审核',
      }))
  }, [vouchers])

  const voucherStats = useMemo(() => {
    const total = vouchers.length
    const approved = vouchers.filter(v => v.status === 'approved').length
    const draft = vouchers.filter(v => v.status === 'draft').length
    return { total, approved, draft }
  }, [vouchers])

  // Financial indicators from trial balance
  const financialIndicators = useMemo(() => {
    const totalAssets = trialItems
      .filter(i => i.account_type === 'asset')
      .reduce((s, i) => s + i.closing_debit - i.closing_credit, 0)
    const totalLiabilities = trialItems
      .filter(i => i.account_type === 'liability')
      .reduce((s, i) => s + i.closing_credit - i.closing_debit, 0)
    const totalEquity = trialItems
      .filter(i => i.account_type === 'equity')
      .reduce((s, i) => s + i.closing_credit - i.closing_debit, 0)
    const totalRevenue = trialItems
      .filter(i => i.account_type === 'revenue' || i.account_type === 'profit_loss')
      .reduce((s, i) => s + i.period_credit - i.period_debit, 0)
    const totalExpense = trialItems
      .filter(i => i.account_type === 'cost' || i.account_type === 'profit_loss')
      .reduce((s, i) => s + i.period_debit - i.period_credit, 0)
    const netProfit = totalRevenue - totalExpense
    const debtRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0

    return { totalAssets, totalLiabilities, totalEquity, totalRevenue, totalExpense, netProfit, debtRatio }
  }, [trialItems])

  // Account type composition for chart
  const accountComposition = useMemo((): AccountTypeSummary[] => {
    const types: AccountTypeSummary[] = [
      { type: 'asset', label: '资产', amount: 0, color: 'bg-blue-500' },
      { type: 'liability', label: '负债', amount: 0, color: 'bg-red-500' },
      { type: 'equity', label: '权益', amount: 0, color: 'bg-green-500' },
      { type: 'cost', label: '成本', amount: 0, color: 'bg-amber-500' },
      { type: 'revenue', label: '收入', amount: 0, color: 'bg-purple-500' },
    ]
    for (const item of trialItems) {
      const t = types.find(t => t.type === item.account_type)
      if (t) {
        if (item.account_type === 'asset' || item.account_type === 'cost') {
          t.amount += item.closing_debit - item.closing_credit
        } else {
          t.amount += item.closing_credit - item.closing_debit
        }
      }
    }
    return types.filter(t => t.amount > 0)
  }, [trialItems])

  // Period debit/credit by top accounts for bar chart
  const topAccounts = useMemo(() => {
    return [...trialItems]
      .filter(i => i.period_debit > 0 || i.period_credit > 0)
      .sort((a, b) => (b.period_debit + b.period_credit) - (a.period_debit + a.period_credit))
      .slice(0, 8)
  }, [trialItems])

  const quickActions = [
    { label: '新建凭证', icon: <Plus className="w-5 h-5" />, path: '/vouchers', isNewVoucher: true },
    { label: '销项发票', icon: <Receipt className="w-5 h-5" />, path: '/invoices/output' },
    { label: '进项发票', icon: <FileText className="w-5 h-5" />, path: '/invoices/input' },
    { label: 'AI记账', icon: <Bot className="w-5 h-5" />, path: '/ai' },
  ]

  const handleQuickAction = (action: typeof quickActions[0]) => {
    navigate(action.path)
  }

  const currentPeriod = periods.find(p => p.id === currentPeriodId)
  const openPeriods = periods.filter(p => p.status === 'open')

  const compositionTotal = accountComposition.reduce((s, t) => s + t.amount, 0)

  return (
    <div className="space-y-6">
      {dataLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
      <>
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            欢迎回来, {user?.username || 'Admin'}
            {currentCompany && <span className="text-lg font-normal text-gray-500 ml-2">- {currentCompany.name}</span>}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-gray-500">账套期间：</span>
            <select
              value={currentPeriodId || ''}
              onChange={(e) => setCurrentPeriod(e.target.value || null)}
              className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              title="账套期间"
            >
              <option value="">请选择期间</option>
              {openPeriods.map(p => (
                <option key={p.id} value={p.id}>
                  {p.period_year}年{String(p.period_month).padStart(2, '0')}月
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          <span>{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</span>
        </div>
      </div>

      {/* Financial Indicator Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-elevated transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">总资产</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(financialIndicators.totalAssets)}</p>
              </div>
              <div className="bg-blue-500 p-3 rounded-lg text-white"><Building2 className="w-6 h-6" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-elevated transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">本期收入</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(financialIndicators.totalRevenue)}</p>
              </div>
              <div className="bg-green-500 p-3 rounded-lg text-white"><TrendingUp className="w-6 h-6" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-elevated transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">本期费用</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(financialIndicators.totalExpense)}</p>
              </div>
              <div className="bg-red-500 p-3 rounded-lg text-white"><TrendingDown className="w-6 h-6" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-elevated transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">本期利润</p>
                <p className={`text-2xl font-bold mt-1 ${financialIndicators.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(financialIndicators.netProfit)}
                </p>
              </div>
              <div className={`p-3 rounded-lg text-white ${financialIndicators.netProfit >= 0 ? 'bg-green-500' : 'bg-red-500'}`}>
                <DollarSign className="w-6 h-6" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">资产负债率: {financialIndicators.debtRatio.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">本期凭证</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{voucherStats.total}</p>
                <div className="flex gap-2 text-xs mt-1">
                  <span className="text-green-600">已审核: {voucherStats.approved}</span>
                  <span className="text-amber-600">草稿: {voucherStats.draft}</span>
                </div>
              </div>
              <div className="bg-primary-500 p-3 rounded-lg text-white"><FileText className="w-6 h-6" /></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">会计期间</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {currentPeriod ? `${currentPeriod.period_year}.${String(currentPeriod.period_month).padStart(2, '0')}` : '-'}
                </p>
                <p className={`text-sm font-medium mt-1 ${currentPeriod?.status === 'open' ? 'text-blue-600' : 'text-green-600'}`}>
                  {currentPeriod?.status === 'open' ? '开账中' : currentPeriod?.status === 'closed' ? '已结账' : '未选择'}
                </p>
              </div>
              <div className="bg-amber-500 p-3 rounded-lg text-white"><Receipt className="w-6 h-6" /></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">负债 + 权益</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(financialIndicators.totalLiabilities + financialIndicators.totalEquity)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  负债 {formatCurrency(financialIndicators.totalLiabilities)} / 权益 {formatCurrency(financialIndicators.totalEquity)}
                </p>
              </div>
              <div className="bg-purple-500 p-3 rounded-lg text-white"><PieChart className="w-6 h-6" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Composition — Donut Chart */}
        <Card>
          <CardHeader className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">科目余额构成</h2>
          </CardHeader>
          <CardContent className="p-6">
            {accountComposition.length === 0 ? (
              <div className="text-center py-8 text-gray-400">暂无数据，请选择会计期间</div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="w-48 h-48 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={accountComposition}
                        dataKey="amount"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {accountComposition.map((t) => (
                          <Cell
                            key={t.type}
                            fill={t.color.replace('bg-', '').replace('-500', '')
                              .replace('blue', '#3b82f6')
                              .replace('red', '#ef4444')
                              .replace('green', '#22c55e')
                              .replace('amber', '#f59e0b')
                              .replace('purple', '#a855f7')}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 grid grid-cols-1 gap-2">
                  {accountComposition.map((t) => {
                    const pct = compositionTotal > 0 ? (t.amount / compositionTotal) * 100 : 0
                    return (
                      <div key={t.type} className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-sm ${t.color}`} />
                        <span className="text-sm text-gray-700">{t.label}</span>
                        <span className="text-sm text-gray-400 ml-auto">{pct.toFixed(1)}%</span>
                        <span className="text-sm font-mono text-gray-600 w-24 text-right">{formatCurrency(t.amount)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Period Activity — Horizontal Bar Chart */}
        <Card>
          <CardHeader className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">本期发生额 TOP8</h2>
          </CardHeader>
          <CardContent className="p-6">
            {topAccounts.length === 0 ? (
              <div className="text-center py-8 text-gray-400">暂无数据，请选择会计期间</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={topAccounts.map((a) => ({
                    name: a.account_name.length > 6 ? a.account_name.slice(0, 6) + '…' : a.account_name,
                    借方: a.period_debit,
                    贷方: a.period_credit,
                  }))}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="借方" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="贷方" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Vouchers + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">最近凭证</h2>
              <Link to="/vouchers" className="flex items-center gap-1 text-sm text-gray-600 hover:text-primary-600 transition-colors">
                查看全部 <ArrowRight className="w-4 h-4" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">凭证号</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">日期</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">描述</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">金额</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recentVouchers.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">暂无凭证数据</td></tr>
                    ) : (
                      recentVouchers.map((voucher) => (
                        <tr key={voucher.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-primary-600">{voucher.id}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{voucher.date}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{voucher.description}</td>
                          <td className="px-6 py-4 text-sm text-gray-900 text-right font-mono">{formatCurrency(voucher.amount)}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              voucher.status === '已审核' ? 'bg-green-100 text-green-800'
                                : voucher.status === '已冲销' ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {voucher.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader><h2 className="text-lg font-semibold text-gray-900">快捷操作</h2></CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuickAction(action)}
                    className="flex flex-col items-center justify-center p-4 bg-gray-50 hover:bg-primary-50 rounded-xl transition-colors group"
                  >
                    <div className="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center text-gray-600 group-hover:text-primary-600 mb-2">
                      {action.icon}
                    </div>
                    <span className="text-sm font-medium text-gray-700 group-hover:text-primary-600">{action.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </>
      )}
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Search, Loader2 } from 'lucide-react'
import { formatCurrency } from '../lib/utils'
import { useAccountStore } from '../stores/accountStore'
import { usePeriodStore } from '../stores/periodStore'
import { useCompanyStore } from '../stores/companyStore'

const categoryConfig: Record<string, { label: string; color: string }> = {
  asset: { label: '资产', color: 'bg-blue-100 text-blue-700' },
  liability: { label: '负债', color: 'bg-red-100 text-red-700' },
  equity: { label: '权益', color: 'bg-purple-100 text-purple-700' },
  cost: { label: '成本', color: 'bg-amber-100 text-amber-700' },
  profit: { label: '损益', color: 'bg-green-100 text-green-700' },
}

export function AccountList() {
  const { selectedCompanyId } = useCompanyStore()
  const { accounts, fetchAccounts, searchAccounts } = useAccountStore()
  const { periods, currentPeriodId, fetchPeriods, fetchTrialBalance } = usePeriodStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<typeof accounts | null>(null)
  const [loading, setLoading] = useState(false)
  const [balances, setBalances] = useState<Map<string, number>>(new Map())

  useEffect(() => {
    if (selectedCompanyId) fetchAccounts(selectedCompanyId)
  }, [selectedCompanyId, fetchAccounts])

  useEffect(() => {
    if (selectedCompanyId) fetchPeriods(selectedCompanyId)
  }, [selectedCompanyId, fetchPeriods])

  const loadBalances = useCallback(async () => {
    if (!currentPeriodId) return
    try {
      const result = await fetchTrialBalance(currentPeriodId)
      const map = new Map<string, number>()
      for (const item of result.items) {
        const net = item.closing_debit - item.closing_credit
        map.set(item.account_code, net)
      }
      setBalances(map)
    } catch {
      setBalances(new Map())
    }
  }, [currentPeriodId, fetchTrialBalance])

  useEffect(() => { loadBalances() }, [loadBalances])

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }
    setLoading(true)
    try {
      const results = await searchAccounts(searchQuery, selectedCompanyId!)
      setSearchResults(results)
    } catch {
      setSearchResults([])
    } finally {
      setLoading(false)
    }
  }

  const displayAccounts = searchResults ?? accounts

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">科目余额表</h1>
          <p className="text-gray-500 mt-1">查看各会计科目的期末余额</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                title="搜索科目"
                placeholder="搜索科目编码或名称..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
                className="w-full h-10 pl-10 pr-4 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <Button variant="outline" onClick={handleSearch} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '搜索'}
            </Button>
            {searchResults && (
              <Button variant="ghost" onClick={() => { setSearchResults(null); setSearchQuery('') }}>
                清除搜索
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {Object.entries(categoryConfig).map(([key, config]) => (
          <Card key={key}>
            <CardContent className="p-4 text-center">
              <p className={`text-sm font-medium ${config.color.split(' ')[1]}`}>{config.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {accounts.filter((a) => a.account_type === key).length}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">科目编码</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">科目名称</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">类别</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">余额方向</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">级次</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">期末余额</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayAccounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : '暂无科目数据'}
                  </td>
                </tr>
              ) : (
                displayAccounts
                  .sort((a, b) => a.code.localeCompare(b.code))
                  .map((account) => {
                    const category = categoryConfig[account.account_type]
                    const balance = balances.get(account.code) ?? 0
                    return (
                      <tr key={account.code} className={`hover:bg-gray-50 transition-colors ${account.is_enabled === 0 ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">{account.code}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{account.name}</td>
                        <td className="px-4 py-3 text-center">
                          {category && (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${category.color}`}>
                              {category.label}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-sm font-medium ${account.normal_balance === 'debit' ? 'text-blue-600' : 'text-red-600'}`}>
                            {account.normal_balance === 'debit' ? '借' : '贷'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm text-gray-500">第{account.level}级</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">
                          {account.is_detail === 1 ? formatCurrency(balance) : '-'}
                        </td>
                      </tr>
                    )
                  })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <div className="text-sm text-gray-500">共 {displayAccounts.length} 个科目</div>
        </div>
      </Card>
    </div>
  )
}

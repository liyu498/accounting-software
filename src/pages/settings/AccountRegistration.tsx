import { useState } from 'react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useToast, useSuccessToast } from '../../components/ui/Toast'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
  X,
  Wallet,
  Check,
  Building2,
} from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { useCompanyStore } from '../../stores/companyStore'

interface Account {
  id: string
  code: string
  name: string
  type: 'cash' | 'bank' | 'wechat' | 'alipay' | 'other'
  balance: number
  currency: string
  isActive: boolean
  lastTransactionDate: string
}

const mockAccounts: Account[] = [
  { id: '1', code: '1001', name: '库存现金', type: 'cash', balance: 5000, currency: 'CNY', isActive: true, lastTransactionDate: '2024-01-20' },
  { id: '2', code: '1002-01', name: '工商银行基本户', type: 'bank', balance: 150000, currency: 'CNY', isActive: true, lastTransactionDate: '2024-01-20' },
  { id: '3', code: '1002-02', name: '建设银行一般户', type: 'bank', balance: 80000, currency: 'CNY', isActive: true, lastTransactionDate: '2024-01-18' },
  { id: '4', code: '1003-01', name: '微信支付', type: 'wechat', balance: 12500, currency: 'CNY', isActive: true, lastTransactionDate: '2024-01-19' },
  { id: '5', code: '1003-02', name: '支付宝', type: 'alipay', balance: 23000, currency: 'CNY', isActive: true, lastTransactionDate: '2024-01-20' },
]

const accountTypeLabels = {
  cash: '现金',
  bank: '银行账户',
  wechat: '微信',
  alipay: '支付宝',
  other: '其他',
}

const accountTypeColors = {
  cash: 'bg-blue-100 text-blue-700',
  bank: 'bg-green-100 text-green-700',
  wechat: 'bg-green-100 text-green-700',
  alipay: 'bg-blue-100 text-blue-700',
  other: 'bg-gray-100 text-gray-700',
}

export function AccountRegistration() {
  const { selectedCompanyId } = useCompanyStore()
  const { addToast } = useToast()
  const successToast = useSuccessToast()

  if (!selectedCompanyId) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">请先选择客户账套</p>
        </div>
      </div>
    )
  }

  const [accounts] = useState<Account[]>(mockAccounts)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)

  const pageSize = 10

  const filteredAccounts = accounts.filter((account) => {
    return (
      account.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      account.code.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  const totalPages = Math.ceil(filteredAccounts.length / pageSize)
  const paginatedAccounts = filteredAccounts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0)

  const handleExport = () => {
    const csvContent = [
      ['账户编码', '账户名称', '账户类型', '余额', '币种', '状态'].join(','),
      ...accounts.map((acc) =>
        [
          acc.code,
          acc.name,
          accountTypeLabels[acc.type],
          acc.balance,
          acc.currency,
          acc.isActive ? '启用' : '停用',
        ].join(',')
      ),
    ].join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `账户登记-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    successToast('导出成功')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">账户登记</h1>
          <p className="text-gray-500 mt-1">管理企业银行账户和资金账户</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            导出
          </Button>
          <Button variant="primary" onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            新建账户
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-gray-500">账户数量</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{accounts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-gray-500">账户总余额</p>
            <p className="text-2xl font-bold text-primary-600 mt-1">{formatCurrency(totalBalance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-gray-500">银行账户</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {accounts.filter((a) => a.type === 'bank').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-gray-500">第三方支付</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {accounts.filter((a) => a.type === 'wechat' || a.type === 'alipay').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索账户名称或编码..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full h-10 pl-10 pr-4 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Accounts Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  账户编码
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  账户名称
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  账户类型
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  余额
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedAccounts.map((account) => (
                <tr key={account.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">{account.code}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{account.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium',
                        accountTypeColors[account.type]
                      )}
                    >
                      {accountTypeLabels[account.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono font-medium text-gray-900">
                    {formatCurrency(account.balance)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={cn(
                        'inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium',
                        account.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      )}
                    >
                      {account.isActive ? '启用' : '停用'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="sm" className="text-gray-500 hover:text-primary-600">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-gray-500 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            显示 {(currentPage - 1) * pageSize + 1} 到 {Math.min(currentPage * pageSize, filteredAccounts.length)} 条，共 {filteredAccounts.length} 条记录
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={cn(
                    'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                    currentPage === page
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  {page}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">新建账户</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <Input label="账户编码" placeholder="请输入账户编码" />
              <Input label="账户名称" placeholder="请输入账户名称" />
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">账户类型</label>
                <select className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="bank">银行账户</option>
                  <option value="cash">现金</option>
                  <option value="wechat">微信</option>
                  <option value="alipay">支付宝</option>
                  <option value="other">其他</option>
                </select>
              </div>
              <Input label="初始余额" placeholder="0.00" type="number" />
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">状态</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="status" value="active" defaultChecked className="w-4 h-4 text-primary-600" />
                    <span className="text-sm text-gray-700">启用</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="status" value="inactive" className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-500">停用</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <Button variant="secondary" onClick={() => setShowAddModal(false)}>
                取消
              </Button>
              <Button variant="primary" onClick={() => {
                successToast('账户创建成功')
                setShowAddModal(false)
              }}>
                保存
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

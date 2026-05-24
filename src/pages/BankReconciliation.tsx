import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Check, RefreshCw, ChevronDown, AlertCircle, Upload, FileText, X, File, Building2 } from 'lucide-react'
import { cn } from '../lib/utils'
import { formatCurrency, formatDate } from '../lib/utils'
import { useCompanyStore } from '../stores/companyStore'

interface BankTransaction {
  id: string
  date: string
  description: string
  amount: number
  type: 'debit' | 'credit'
  matched: boolean
  bookEntryId?: string
}

interface BookEntry {
  id: string
  date: string
  description: string
  amount: number
  type: 'debit' | 'credit'
  matched: boolean
  bankTransactionId?: string
}

interface BankAccount {
  id: string
  name: string
  accountNumber: string
}

const mockBankAccounts: BankAccount[] = [
  { id: '1', name: '工商银行基本户', accountNumber: '6222021234567890' },
  { id: '2', name: '建设银行一般户', accountNumber: '6217001234567891' },
  { id: '3', name: '农业银行纳税户', accountNumber: '6228481234567892' },
]

const mockBankTransactions: BankTransaction[] = [
  { id: 'b1', date: '2024-01-15', description: '收到客户A货款', amount: 125000.00, type: 'debit', matched: true, bookEntryId: 'e1' },
  { id: 'b2', date: '2024-01-14', description: '支付供应商B货款', amount: 56800.00, type: 'credit', matched: true, bookEntryId: 'e2' },
  { id: 'b3', date: '2024-01-13', description: '支付办公室租金', amount: 12000.00, type: 'credit', matched: false },
  { id: 'b4', date: '2024-01-12', description: '收到客户C预付款', amount: 50000.00, type: 'debit', matched: false },
  { id: 'b5', date: '2024-01-11', description: '转账手续费', amount: 25.00, type: 'credit', matched: true, bookEntryId: 'e3' },
  { id: 'b6', date: '2024-01-10', description: '支付水电费', amount: 3200.00, type: 'credit', matched: true, bookEntryId: 'e4' },
  { id: 'b7', date: '2024-01-09', description: '收到客户D货款', amount: 89000.00, type: 'debit', matched: false },
  { id: 'b8', date: '2024-01-08', description: '购买办公设备', amount: 15600.00, type: 'credit', matched: false },
]

const mockBookEntries: BookEntry[] = [
  { id: 'e1', date: '2024-01-15', description: '收到客户A货款', amount: 125000.00, type: 'debit', matched: true, bankTransactionId: 'b1' },
  { id: 'e2', date: '2024-01-14', description: '支付供应商B货款', amount: 56800.00, type: 'credit', matched: true, bankTransactionId: 'b2' },
  { id: 'e3', date: '2024-01-11', description: '银行手续费', amount: 25.00, type: 'credit', matched: true, bankTransactionId: 'b5' },
  { id: 'e4', date: '2024-01-10', description: '支付水电费', amount: 3200.00, type: 'credit', matched: true, bankTransactionId: 'b6' },
  { id: 'e5', date: '2024-01-12', description: '提取现金', amount: 10000.00, type: 'credit', matched: false },
  { id: 'e6', date: '2024-01-09', description: '客户D汇款', amount: 89000.00, type: 'debit', matched: false },
  { id: 'e7', date: '2024-01-08', description: '购入打印机', amount: 2800.00, type: 'credit', matched: false },
  { id: 'e8', date: '2024-01-07', description: '利息收入', amount: 156.80, type: 'debit', matched: false },
]

interface BankReconciliationProps {
  onNavigate?: (path: string) => void
}

export function BankReconciliation(_props: BankReconciliationProps) {
  const { selectedCompanyId } = useCompanyStore()
  const [selectedBank, setSelectedBank] = useState<BankAccount>(mockBankAccounts[0]!)
  const [showBankDropdown, setShowBankDropdown] = useState(false)
  const [period, setPeriod] = useState({ month: '01', year: '2024' })
  const [showReconcileConfirm, setShowReconcileConfirm] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showVoucherModal, setShowVoucherModal] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null)
  const [importFormat, setImportFormat] = useState<'pdf' | 'excel'>('excel')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Mock data for reconciliation
  const statementBalance = 2567890.50
  const bookBalance = 2567165.50
  const difference = statementBalance - bookBalance

  const matchedBankCount = mockBankTransactions.filter(t => t.matched).length
  const matchedBookCount = mockBookEntries.filter(e => e.matched).length
  const unmatchedBankCount = mockBankTransactions.filter(t => !t.matched).length
  const unmatchedBookCount = mockBookEntries.filter(e => !e.matched).length

  const handleReconcile = () => {
    setShowReconcileConfirm(true)
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Simulate import
    const toast = document.createElement('div')
    toast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in'
    toast.textContent = `已成功导入银行对账单：${file.name}`
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 3000)
    setShowImportModal(false)
  }

  const handleGenerateVoucher = (transaction: BankTransaction) => {
    setSelectedTransaction(transaction)
    setShowVoucherModal(true)
  }

  const handleConfirmVoucher = () => {
    if (!selectedTransaction) return
    const toast = document.createElement('div')
    toast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in'
    toast.textContent = `已为「${selectedTransaction.description}」生成会计凭证`
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 3000)
    setShowVoucherModal(false)
  }

  if (!selectedCompanyId) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">请先在首页选择客户账套</p>
        </div>
      </div>
    )
  }

  const handleMonthChange = (type: 'prev' | 'next') => {
    const currentMonth = parseInt(period.month)
    const currentYear = parseInt(period.year)
    if (type === 'prev') {
      if (currentMonth === 1) {
        setPeriod({ month: '12', year: (currentYear - 1).toString() })
      } else {
        setPeriod({ month: (currentMonth - 1).toString().padStart(2, '0'), year: currentYear.toString() })
      }
    } else {
      if (currentMonth === 12) {
        setPeriod({ month: '01', year: (currentYear + 1).toString() })
      } else {
        setPeriod({ month: (currentMonth + 1).toString().padStart(2, '0'), year: currentYear.toString() })
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">银行对账</h1>
          <p className="text-gray-500 mt-1">核对银行流水与账面记录</p>
        </div>
      </div>

      {/* Bank Account Selector and Period */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Bank Account Selector */}
              <div className="relative">
                <label className="text-sm font-medium text-gray-500 mb-1.5 block">银行账户</label>
                <button
                  onClick={() => setShowBankDropdown(!showBankDropdown)}
                  className="flex items-center justify-between w-64 h-10 px-3 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors"
                >
                  <div className="text-left">
                    <span className="font-medium text-gray-900">{selectedBank.name}</span>
                    <span className="text-sm text-gray-500 ml-2">{selectedBank.accountNumber}</span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>
                {showBankDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                    {mockBankAccounts.map(bank => (
                      <button
                        key={bank.id}
                        onClick={() => {
                          setSelectedBank(bank)
                          setShowBankDropdown(false)
                        }}
                        className={cn(
                          'w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors',
                          bank.id === selectedBank.id && 'bg-primary-50'
                        )}
                      >
                        <div className="font-medium text-gray-900">{bank.name}</div>
                        <div className="text-sm text-gray-500">{bank.accountNumber}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Period Selector */}
              <div>
                <label className="text-sm font-medium text-gray-500 mb-1.5 block">对账期间</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleMonthChange('prev')}
                    className="w-8 h-8 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 flex items-center justify-center"
                  >
                    <span className="text-gray-600">&lt;</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={period.year}
                      onChange={(e) => setPeriod({ ...period, year: e.target.value })}
                      className="w-16 h-10 text-center rounded-lg border border-gray-300 bg-white"
                      title="年份"
                      aria-label="年份"
                    />
                    <span className="text-gray-600">年</span>
                    <input
                      type="text"
                      value={period.month}
                      onChange={(e) => setPeriod({ ...period, month: e.target.value })}
                      className="w-12 h-10 text-center rounded-lg border border-gray-300 bg-white"
                      title="月份"
                      aria-label="月份"
                    />
                    <span className="text-gray-600">月</span>
                  </div>
                  <button
                    onClick={() => handleMonthChange('next')}
                    className="w-8 h-8 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 flex items-center justify-center"
                  >
                    <span className="text-gray-600">&gt;</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowImportModal(true)}>
                <Upload className="w-4 h-4 mr-2" />
                导入对账单
              </Button>
              <Button variant="primary" onClick={handleReconcile}>
                <Check className="w-4 h-4 mr-2" />
                完成对账
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Balance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">银行对账单余额</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(statementBalance)}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-lg font-bold text-blue-600">银</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">账面余额</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(bookBalance)}</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-lg font-bold text-green-600">账</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={cn(difference !== 0 && 'border-amber-300')}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">差额</p>
                <p className={cn('text-2xl font-bold mt-1', difference === 0 ? 'text-green-600' : 'text-amber-600')}>
                  {formatCurrency(Math.abs(difference))}
                  {difference !== 0 && <span className="text-sm ml-1">(未平)</span>}
                </p>
              </div>
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', difference === 0 ? 'bg-green-100' : 'bg-amber-100')}>
                {difference === 0 ? (
                  <Check className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reconciliation Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bank Transactions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">银行对账单</h2>
              <p className="text-sm text-gray-500 mt-1">
                已匹配 {matchedBankCount} 笔 / 未匹配 {unmatchedBankCount} 笔
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-sm text-green-600">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                已匹配
              </span>
              <span className="flex items-center gap-1 text-sm text-amber-600">
                <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                未匹配
              </span>
            </div>
          </CardHeader>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">日期</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">摘要</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">借方</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">贷方</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mockBankTransactions.map((tx) => (
                  <tr key={tx.id} className={cn('hover:bg-gray-50 transition-colors', !tx.matched && 'bg-amber-50')}>
                    <td className="px-4 py-2 text-sm text-gray-600">{formatDate(tx.date)}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{tx.description}</td>
                    <td className="px-4 py-2 text-sm text-right font-mono text-blue-600">
                      {tx.type === 'debit' ? formatCurrency(tx.amount) : '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-mono text-red-600">
                      {tx.type === 'credit' ? formatCurrency(tx.amount) : '-'}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {tx.matched ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 rounded-full">
                          <Check className="w-4 h-4 text-green-600" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-amber-100 rounded-full">
                          <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {!tx.matched && (
                        <Button variant="ghost" size="sm" onClick={() => handleGenerateVoucher(tx)} title="生成凭证">
                          <FileText className="w-4 h-4 text-green-600" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Book Entries */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">账面记录</h2>
              <p className="text-sm text-gray-500 mt-1">
                已匹配 {matchedBookCount} 笔 / 未匹配 {unmatchedBookCount} 笔
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-sm text-green-600">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                已匹配
              </span>
              <span className="flex items-center gap-1 text-sm text-amber-600">
                <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                未匹配
              </span>
            </div>
          </CardHeader>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">日期</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">摘要</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">借方</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">贷方</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mockBookEntries.map((entry) => (
                  <tr key={entry.id} className={cn('hover:bg-gray-50 transition-colors', !entry.matched && 'bg-amber-50')}>
                    <td className="px-4 py-2 text-sm text-gray-600">{formatDate(entry.date)}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{entry.description}</td>
                    <td className="px-4 py-2 text-sm text-right font-mono text-blue-600">
                      {entry.type === 'debit' ? formatCurrency(entry.amount) : '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-mono text-red-600">
                      {entry.type === 'credit' ? formatCurrency(entry.amount) : '-'}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {entry.matched ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 rounded-full">
                          <Check className="w-4 h-4 text-green-600" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-amber-100 rounded-full">
                          <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Reconcile Confirmation Modal */}
      {showReconcileConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowReconcileConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 animate-fade-in">
            <div className="p-6">
              {difference === 0 ? (
                <>
                  <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 text-center mb-2">对账完成</h2>
                  <p className="text-gray-500 text-center mb-6">
                    银行对账单与账面记录已全部匹配，对账成功！
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-amber-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 text-center mb-2">存在未匹配项</h2>
                  <p className="text-gray-500 text-center mb-6">
                    仍有 {unmatchedBankCount} 笔银行记录和 {unmatchedBookCount} 笔账面记录未匹配。
                    <br />
                    差额：{formatCurrency(Math.abs(difference))}
                  </p>
                </>
              )}
            </div>
            <div className="flex items-center justify-center gap-3 px-6 py-4 border-t border-gray-100">
              <Button variant="secondary" onClick={() => setShowReconcileConfirm(false)}>
                {difference === 0 ? '关闭' : '继续调整'}
              </Button>
              {difference !== 0 && (
                <Button variant="primary" onClick={() => setShowReconcileConfirm(false)}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  强制对账
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Import Statement Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowImportModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">导入银行对账单</h2>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600" title="关闭">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">选择文件格式</label>
                <div className="flex gap-4">
                  <label className={cn('flex items-center gap-2 px-4 py-3 border rounded-lg cursor-pointer transition-colors', importFormat === 'excel' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50')}>
                    <input type="radio" name="format" value="excel" checked={importFormat === 'excel'} onChange={() => setImportFormat('excel')} className="sr-only" />
                    <File className="w-5 h-5 text-green-600" />
                    <span className="font-medium">Excel (.xlsx)</span>
                  </label>
                  <label className={cn('flex items-center gap-2 px-4 py-3 border rounded-lg cursor-pointer transition-colors', importFormat === 'pdf' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50')}>
                    <input type="radio" name="format" value="pdf" checked={importFormat === 'pdf'} onChange={() => setImportFormat('pdf')} className="sr-only" />
                    <FileText className="w-5 h-5 text-red-600" />
                    <span className="font-medium">PDF (.pdf)</span>
                  </label>
                </div>
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <input ref={fileInputRef} type="file" accept={importFormat === 'excel' ? '.xlsx,.xls' : '.pdf'} onChange={handleImportFile} className="hidden" aria-label="选择文件" />
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 mb-2">点击选择文件或拖拽到此处</p>
                <p className="text-sm text-gray-400">支持 {importFormat === 'excel' ? 'Excel (.xlsx, .xls)' : 'PDF (.pdf)'} 格式</p>
                <Button variant="outline" className="mt-4" onClick={() => fileInputRef.current?.click()}>
                  选择文件
                </Button>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  <span className="font-medium">提示：</span>导入后系统将自动识别银行流水并尝试匹配账面记录，生成未匹配项供您核对。
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <Button variant="secondary" onClick={() => setShowImportModal(false)}>取消</Button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Voucher Modal */}
      {showVoucherModal && selectedTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowVoucherModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">生成会计凭证</h2>
              <button onClick={() => setShowVoucherModal(false)} className="text-gray-400 hover:text-gray-600" title="关闭">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500">日期：</span><span className="font-medium text-gray-900">{formatDate(selectedTransaction.date)}</span></div>
                  <div><span className="text-gray-500">类型：</span><span className={selectedTransaction.type === 'debit' ? 'text-green-600' : 'text-red-600'}>{selectedTransaction.type === 'debit' ? '收款' : '付款'}</span></div>
                  <div className="col-span-2"><span className="text-gray-500">摘要：</span><span className="text-gray-900">{selectedTransaction.description}</span></div>
                  <div className="col-span-2"><span className="text-gray-500">金额：</span><span className="font-bold text-gray-900">{formatCurrency(selectedTransaction.amount)}</span></div>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-2 block">生成的会计分录</label>
                <table className="w-full border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">科目</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">借方</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">贷方</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTransaction.type === 'debit' ? (
                      <>
                        <tr className="border-t border-gray-100">
                          <td className="px-4 py-2 text-sm">银行存款</td>
                          <td className="px-4 py-2 text-sm text-right font-mono text-blue-600">{formatCurrency(selectedTransaction.amount)}</td>
                          <td className="px-4 py-2 text-sm text-right font-mono text-red-600">-</td>
                        </tr>
                        <tr className="border-t border-gray-100">
                          <td className="px-4 py-2 text-sm">应收账款/主营业务收入</td>
                          <td className="px-4 py-2 text-sm text-right font-mono text-blue-600">-</td>
                          <td className="px-4 py-2 text-sm text-right font-mono text-red-600">{formatCurrency(selectedTransaction.amount)}</td>
                        </tr>
                      </>
                    ) : (
                      <>
                        <tr className="border-t border-gray-100">
                          <td className="px-4 py-2 text-sm">应付账款/管理费用</td>
                          <td className="px-4 py-2 text-sm text-right font-mono text-blue-600">{formatCurrency(selectedTransaction.amount)}</td>
                          <td className="px-4 py-2 text-sm text-right font-mono text-red-600">-</td>
                        </tr>
                        <tr className="border-t border-gray-100">
                          <td className="px-4 py-2 text-sm">银行存款</td>
                          <td className="px-4 py-2 text-sm text-right font-mono text-blue-600">-</td>
                          <td className="px-4 py-2 text-sm text-right font-mono text-red-600">{formatCurrency(selectedTransaction.amount)}</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <Button variant="secondary" onClick={() => setShowVoucherModal(false)}>取消</Button>
              <Button variant="primary" onClick={handleConfirmVoucher}>
                <FileText className="w-4 h-4 mr-2" />确认生成
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
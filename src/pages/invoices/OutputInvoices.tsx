import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardFooter } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Plus, Search, Eye, ChevronLeft, ChevronRight, X, FileText, Trash2, Edit2, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../../lib/utils'
import { formatCurrency, formatDate } from '../../lib/utils'
import { Link } from 'react-router-dom'
import { useInvoiceStore } from '../../stores/invoiceStore'
import { useVoucherStore } from '../../stores/voucherStore'
import { useCompanyStore } from '../../stores/companyStore'
import { MatchVoucherDialog } from '../../components/invoice/MatchVoucherDialog'

export function OutputInvoices() {
  const { selectedCompanyId } = useCompanyStore()
  const { invoices, isLoading, fetchInvoices, deleteInvoice, matchInvoiceToVoucher } = useInvoiceStore()
  const { getVoucher } = useVoucherStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false)
  const [invoiceStatus, setInvoiceStatus] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<typeof invoices[0] | null>(null)
  const [showMatchDialog, setShowMatchDialog] = useState(false)
  const [linkedVoucherNumber, setLinkedVoucherNumber] = useState<string | null>(null)
  const pageSize = 10

  useEffect(() => {
    if (selectedCompanyId) {
      fetchInvoices({ company_id: selectedCompanyId, invoice_type: 'output' })
    }
  }, [selectedCompanyId, fetchInvoices])

  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matches = invoice.invoice_no.toLowerCase().includes(q) ||
          (invoice.seller_name && invoice.seller_name.toLowerCase().includes(q)) ||
          (invoice.buyer_name && invoice.buyer_name.toLowerCase().includes(q)) ||
          (invoice.remarks && invoice.remarks.toLowerCase().includes(q))
        if (!matches) return false
      }
      if (invoiceStatus !== 'all' && invoice.status !== invoiceStatus) return false
      return true
    })
  }, [invoices, searchQuery, invoiceStatus])

  const totalPages = Math.ceil(filteredInvoices.length / pageSize)
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  const handleView = async (invoice: typeof invoices[0]) => {
    setSelectedInvoice(invoice)
    setShowDetailModal(true)
    setLinkedVoucherNumber(null)
    if (invoice.voucher_id && selectedCompanyId) {
      const v = await getVoucher(invoice.voucher_id, selectedCompanyId)
      if (v) setLinkedVoucherNumber(v.voucher_number)
    }
  }

  const handleMatchVoucher = async (voucherId: string) => {
    if (!selectedCompanyId || !selectedInvoice) return
    await matchInvoiceToVoucher(selectedInvoice.id, voucherId, selectedCompanyId)
    setShowMatchDialog(false)
    setShowDetailModal(false)
    const v = await getVoucher(voucherId, selectedCompanyId)
    if (v) setLinkedVoucherNumber(v.voucher_number)
    setSelectedInvoice({ ...selectedInvoice, voucher_id: voucherId, status: 'matched' })
    setShowDetailModal(true)
  }

  const handleDelete = async (invoice: typeof invoices[0]) => {
    if (!selectedCompanyId) return
    if (window.confirm(`确定要删除发票 "${invoice.invoice_no}" 吗？`)) {
      await deleteInvoice(invoice.id, selectedCompanyId)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700',
      verified: 'bg-green-100 text-green-700',
      matched: 'bg-blue-100 text-blue-700',
      rejected: 'bg-red-100 text-red-700',
    }
    const labels: Record<string, string> = {
      pending: '待认证',
      verified: '已认证',
      matched: '已匹配',
      rejected: '已作废',
    }
    return (
      <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', badges[status] || 'bg-gray-100 text-gray-700')}>
        {labels[status] || status}
      </span>
    )
  }

  const totalAmount = filteredInvoices.reduce((sum, inv) => sum + inv.amount, 0)
  const totalTax = filteredInvoices.reduce((sum, inv) => sum + inv.tax_amount, 0)

  if (!selectedCompanyId) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500">请先选择客户账套</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">销项发票</h1>
          <p className="text-gray-500 mt-1">管理销售发票和开具发票</p>
        </div>
        <Button variant="primary" onClick={() => console.log('Add output invoice')}>
          <Plus className="w-4 h-4 mr-2" />
          开具发票
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium text-gray-500">发票数量</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{filteredInvoices.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium text-gray-500">不含税金额</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium text-gray-500">税额合计</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalTax)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium text-gray-500">价税合计</p>
            <p className="text-2xl font-bold text-primary-600 mt-1">{formatCurrency(totalAmount + totalTax)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="搜索发票号、购方名称、备注..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-10"
              />
            </div>
            <select
              value={invoiceStatus}
              onChange={(e) => {
                setInvoiceStatus(e.target.value)
                setCurrentPage(1)
              }}
              className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label="发票状态"
            >
              <option value="all">全部状态</option>
              <option value="pending">待认证</option>
              <option value="verified">已认证</option>
              <option value="matched">已匹配</option>
              <option value="rejected">已作废</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">发票号</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">开票日期</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">购方名称</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">金额</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">税率</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">税额</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">加载中...</td>
                </tr>
              ) : paginatedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <Search className="w-12 h-12 text-gray-300 mb-3" />
                      <p>没有找到匹配的发票</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono font-medium text-primary-600">{invoice.invoice_no}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(invoice.invoice_date)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-[150px] truncate" title={invoice.buyer_name || ''}>{invoice.buyer_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono">{formatCurrency(invoice.amount)}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">{invoice.tax_rate ?? '-'}{invoice.tax_rate ? '%' : ''}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono">{formatCurrency(invoice.tax_amount)}</td>
                    <td className="px-4 py-3 text-center">{getStatusBadge(invoice.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" onClick={() => handleView(invoice)} className="text-gray-500 hover:text-primary-600">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" onClick={() => handleDelete(invoice)} className="text-gray-500 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <CardFooter className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            显示 {(currentPage - 1) * pageSize + 1} 到 {Math.min(currentPage * pageSize, filteredInvoices.length)} 条，共 {filteredInvoices.length} 条记录
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button key={page} onClick={() => setCurrentPage(page)} className={cn('w-8 h-8 rounded-lg text-sm font-medium transition-colors', currentPage === page ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100')}>{page}</button>
              ))}
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardFooter>
      </Card>

      {showDetailModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowDetailModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">发票详情</h2>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500">发票号码</label>
                  <p className="text-sm font-mono font-medium text-primary-600">{selectedInvoice.invoice_no}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">开票日期</label>
                  <p className="text-sm text-gray-900">{formatDate(selectedInvoice.invoice_date)}</p>
                </div>
              </div>
              {selectedInvoice.buyer_name && (
                <div>
                  <label className="text-xs font-medium text-gray-500">购方名称</label>
                  <p className="text-sm text-gray-900">{selectedInvoice.buyer_name}</p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500">金额</label>
                  <p className="text-sm font-medium text-gray-900">{formatCurrency(selectedInvoice.amount)}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">税率</label>
                  <p className="text-sm text-gray-900">{selectedInvoice.tax_rate ?? '-'}{selectedInvoice.tax_rate ? '%' : ''}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">税额</label>
                  <p className="text-sm text-medium text-gray-900">{formatCurrency(selectedInvoice.tax_amount)}</p>
                </div>
              </div>
              <div className="text-center">{getStatusBadge(selectedInvoice.status)}</div>
              {selectedInvoice.voucher_id && (
                <div>
                  <label className="text-xs font-medium text-gray-500">关联凭证</label>
                  <Link to={`/vouchers/detail/${selectedInvoice.voucher_id}`} className="text-sm text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {linkedVoucherNumber || selectedInvoice.voucher_id}
                  </Link>
                </div>
              )}
              {selectedInvoice.remarks && (
                <div>
                  <label className="text-xs font-medium text-gray-500">备注</label>
                  <p className="text-sm text-gray-900">{selectedInvoice.remarks}</p>
                </div>
              )}
              <div className="border-t border-gray-100 pt-4">
                <label className="text-xs font-medium text-gray-500">价税合计</label>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(selectedInvoice.total_amount)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              {!selectedInvoice.voucher_id && selectedInvoice.status !== 'rejected' && (
                <Button variant="outline" onClick={() => { setShowDetailModal(false); setShowMatchDialog(true) }}>
                  <FileText className="w-4 h-4 mr-2" />
                  匹配凭证
                </Button>
              )}
              <div className="flex-1" />
              <Button variant="secondary" onClick={() => setShowDetailModal(false)}>关闭</Button>
            </div>
          </div>
        </div>
      )}

      {showMatchDialog && selectedInvoice && (
        <MatchVoucherDialog
          companyId={selectedCompanyId || ''}
          onSelect={handleMatchVoucher}
          onClose={() => setShowMatchDialog(false)}
        />
      )}
    </div>
  )
}

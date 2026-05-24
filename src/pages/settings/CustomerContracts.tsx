import { useState } from 'react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useToast, useSuccessToast } from '../../components/ui/Toast'
import {
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  FileText,
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
  X,
  Building2,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  AlertTriangle,
} from 'lucide-react'
import { cn, formatCurrency, formatDate } from '../../lib/utils'
import { useCompanyStore } from '../../stores/companyStore'

interface CustomerContract {
  id: string
  name: string
  contactPerson: string
  contactPhone: string
  contactEmail: string
  address: string
  taxNumber: string
  bankName: string
  bankAccount: string
  contractNo: string
  contractStartDate: string
  contractEndDate: string
  serviceType: string
  serviceFee: number
  paymentStatus: 'paid' | 'unpaid' | 'partial'
  serviceStatus: 'active' | 'expiring' | 'expired'
  daysUntilExpiry: number
  totalReceived: number
  totalUnpaid: number
}

interface PaymentRecord {
  id: string
  date: string
  amount: number
  paymentMethod: string
  invoiceNo: string
  remarks: string
}

// Mock data
const mockCustomers: CustomerContract[] = [
  {
    id: '1',
    name: '北京科技有限公司',
    contactPerson: '张三',
    contactPhone: '13800138000',
    contactEmail: 'zhangsan@company.com',
    address: '北京市朝阳区建国路88号',
    taxNumber: '91110000123456789X',
    bankName: '中国工商银行',
    bankAccount: '6222021234567890123',
    contractNo: 'CT-2024-001',
    contractStartDate: '2024-01-01',
    contractEndDate: '2024-12-31',
    serviceType: '代理记账',
    serviceFee: 24000,
    paymentStatus: 'paid',
    serviceStatus: 'active',
    daysUntilExpiry: 265,
    totalReceived: 24000,
    totalUnpaid: 0,
  },
  {
    id: '2',
    name: '上海贸易有限公司',
    contactPerson: '李四',
    contactPhone: '13900139000',
    contactEmail: 'lisi@company.com',
    address: '上海市浦东新区世纪大道100号',
    taxNumber: '91310000987654321X',
    bankName: '中国建设银行',
    bankAccount: '6222021234567890456',
    contractNo: 'CT-2024-002',
    contractStartDate: '2024-03-01',
    contractEndDate: '2025-02-28',
    serviceType: '代理记账+税务申报',
    serviceFee: 36000,
    paymentStatus: 'partial',
    serviceStatus: 'expiring',
    daysUntilExpiry: 30,
    totalReceived: 15000,
    totalUnpaid: 21000,
  },
  {
    id: '3',
    name: '广州餐饮管理有限公司',
    contactPerson: '王五',
    contactPhone: '13700137000',
    contactEmail: 'wangwu@company.com',
    address: '广州市天河区天河路123号',
    taxNumber: '91440101MA5ABCD123',
    bankName: '中国农业银行',
    bankAccount: '6228481234567890678',
    contractNo: 'CT-2023-003',
    contractStartDate: '2023-06-01',
    contractEndDate: '2024-05-31',
    serviceType: '代理记账',
    serviceFee: 18000,
    paymentStatus: 'unpaid',
    serviceStatus: 'expired',
    daysUntilExpiry: -10,
    totalReceived: 0,
    totalUnpaid: 18000,
  },
]

const mockPaymentRecords: PaymentRecord[] = [
  { id: '1', date: '2024-01-15', amount: 2000, paymentMethod: '银行转账', invoiceNo: 'FP-2024-001', remarks: '2024年1月服务费' },
  { id: '2', date: '2024-02-15', amount: 2000, paymentMethod: '银行转账', invoiceNo: 'FP-2024-002', remarks: '2024年2月服务费' },
]

export function CustomerContracts() {
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

  const [customers] = useState<CustomerContract[]>(mockCustomers)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerContract | null>(null)

  const pageSize = 10

  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch =
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.contactPhone.includes(searchQuery)
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && customer.serviceStatus === 'active') ||
      (statusFilter === 'expiring' && customer.serviceStatus === 'expiring') ||
      (statusFilter === 'expired' && customer.serviceStatus === 'expired')
    return matchesSearch && matchesStatus
  })

  const totalPages = Math.ceil(filteredCustomers.length / pageSize)
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  const getServiceStatusBadge = (status: CustomerContract['serviceStatus']) => {
    const badges = {
      active: 'bg-green-100 text-green-700',
      expiring: 'bg-amber-100 text-amber-700',
      expired: 'bg-red-100 text-red-700',
    }
    const labels = {
      active: '服务中',
      expiring: '即将到期',
      expired: '已到期',
    }
    return (
      <span
        className={cn(
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
          badges[status]
        )}
      >
        {labels[status]}
      </span>
    )
  }

  const getPaymentStatusBadge = (status: CustomerContract['paymentStatus']) => {
    const badges = {
      paid: 'bg-green-100 text-green-700',
      partial: 'bg-amber-100 text-amber-700',
      unpaid: 'bg-red-100 text-red-700',
    }
    const labels = {
      paid: '已付清',
      partial: '部分付款',
      unpaid: '未付款',
    }
    return (
      <span
        className={cn(
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
          badges[status]
        )}
      >
        {labels[status]}
      </span>
    )
  }

  const handleView = (customer: CustomerContract) => {
    setSelectedCustomer(customer)
    setShowDetailModal(true)
  }

  const handleAdd = () => {
    setShowAddModal(true)
  }

  const handleExport = () => {
    const csvContent = [
      ['客户名称', '联系人', '电话', '邮箱', '合同编号', '服务类型', '服务费', '付款状态', '服务状态'].join(','),
      ...filteredCustomers.map((c) =>
        [
          c.name,
          c.contactPerson,
          c.contactPhone,
          c.contactEmail,
          c.contractNo,
          c.serviceType,
          c.serviceFee,
          c.paymentStatus,
          c.serviceStatus,
        ].join(',')
      ),
    ].join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `客户与合同-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    successToast('导出成功')
  }

  const handleExportPDF = () => {
    addToast('PDF导出功能开发中', 'info')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">客户与合同</h1>
          <p className="text-gray-500 mt-1">管理代理记账客户信息和合同</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportPDF}>
            <Download className="w-4 h-4 mr-2" />
            导出PDF
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            导出Excel
          </Button>
          <Button variant="primary" onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            新建客户
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="搜索客户名称、联系人、电话..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-10"
              />
            </div>
            <select
              className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setCurrentPage(1)
              }}
            >
              <option value="all">全部状态</option>
              <option value="active">服务中</option>
              <option value="expiring">即将到期</option>
              <option value="expired">已到期</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Customer Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  客户名称
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  联系人
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  联系电话
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  合同编号
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  服务类型
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  服务费
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  付款状态
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  服务状态
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <Building2 className="w-12 h-12 text-gray-300 mb-3" />
                      <p>没有找到匹配的客户</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {customer.name}
                      {customer.serviceStatus === 'expiring' && (
                        <span className="ml-2 text-amber-500" title="即将到期">
                          <AlertTriangle className="w-4 h-4 inline" />
                        </span>
                      )}
                      {customer.serviceStatus === 'expired' && (
                        <span className="ml-2 text-red-500" title="已到期">
                          <AlertTriangle className="w-4 h-4 inline" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{customer.contactPerson}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{customer.contactPhone}</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-500">{customer.contractNo}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{customer.serviceType}</td>
                    <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">
                      {formatCurrency(customer.serviceFee)}
                    </td>
                    <td className="px-4 py-3 text-center">{getPaymentStatusBadge(customer.paymentStatus)}</td>
                    <td className="px-4 py-3 text-center">{getServiceStatusBadge(customer.serviceStatus)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(customer)}
                          className="text-gray-500 hover:text-primary-600"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-500 hover:text-primary-600"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            显示 {(currentPage - 1) * pageSize + 1} 到 {Math.min(currentPage * pageSize, filteredCustomers.length)} 条，共 {filteredCustomers.length} 条记录
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

      {/* Detail Modal */}
      {showDetailModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowDetailModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">客户详情</h2>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">基本信息</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <Building2 className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{selectedCustomer.name}</p>
                      <p className="text-xs text-gray-500">客户名称</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{selectedCustomer.contactPhone}</p>
                      <p className="text-xs text-gray-500">联系电话</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{selectedCustomer.contactEmail}</p>
                      <p className="text-xs text-gray-500">电子邮箱</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{selectedCustomer.address}</p>
                      <p className="text-xs text-gray-500">公司地址</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contract Info */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">合同信息</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">合同编号</p>
                    <p className="text-sm font-mono font-medium text-gray-900">{selectedCustomer.contractNo}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">服务类型</p>
                    <p className="text-sm font-medium text-gray-900">{selectedCustomer.serviceType}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">合同开始日期</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(selectedCustomer.contractStartDate)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">合同结束日期</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(selectedCustomer.contractEndDate)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">服务费</p>
                    <p className="text-sm font-mono font-bold text-primary-600">{formatCurrency(selectedCustomer.serviceFee)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">服务状态</p>
                    <p className="mt-1">{getServiceStatusBadge(selectedCustomer.serviceStatus)}</p>
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">收款情况</h3>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">已收款</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(selectedCustomer.totalReceived)}</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">未收款</p>
                    <p className="text-lg font-bold text-red-600">{formatCurrency(selectedCustomer.totalUnpaid)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">付款状态</p>
                    <p className="mt-1">{getPaymentStatusBadge(selectedCustomer.paymentStatus)}</p>
                  </div>
                </div>

                {/* Payment Records */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">日期</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">金额</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">付款方式</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">发票号</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">备注</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {mockPaymentRecords.map((record) => (
                        <tr key={record.id}>
                          <td className="px-4 py-2 text-sm text-gray-900">{formatDate(record.date)}</td>
                          <td className="px-4 py-2 text-sm text-right font-mono text-green-600">{formatCurrency(record.amount)}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{record.paymentMethod}</td>
                          <td className="px-4 py-2 text-sm font-mono text-gray-500">{record.invoiceNo}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{record.remarks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
              <Button variant="outline" onClick={() => setShowPaymentModal(true)}>
                <DollarSign className="w-4 h-4 mr-2" />
                添加收款记录
              </Button>
              <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
                关闭
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">新建客户</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="客户名称" placeholder="请输入客户名称" />
                <Input label="联系人" placeholder="请输入联系人姓名" />
                <Input label="联系电话" placeholder="请输入联系电话" />
                <Input label="电子邮箱" placeholder="请输入电子邮箱" type="email" />
                <Input label="税务登记号" placeholder="请输入税务登记号" />
                <Input label="开户银行" placeholder="请输入开户银行" />
                <Input label="银行账号" placeholder="请输入银行账号" />
                <Input label="公司地址" placeholder="请输入公司地址" className="col-span-2" />
              </div>
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">合同信息</h4>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="合同编号" placeholder="请输入合同编号" />
                  <Input label="服务类型" placeholder="请输入服务类型" />
                  <Input label="服务费" placeholder="0.00" type="number" />
                  <Input label="合同开始日期" type="date" />
                  <Input label="合同结束日期" type="date" />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
              <Button variant="secondary" onClick={() => setShowAddModal(false)}>
                取消
              </Button>
              <Button variant="primary" onClick={() => {
                successToast('客户创建成功')
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

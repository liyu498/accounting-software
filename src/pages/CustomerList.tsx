import { useState } from 'react'
import { Card, CardContent, CardFooter } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Plus, Search, Edit2, Trash2, ChevronLeft, ChevronRight, Building2 } from 'lucide-react'
import { cn } from '../lib/utils'
import { useToast } from '../components/ui/Toast'
import { useCompanyStore } from '../stores/companyStore'

interface Customer {
  id: string
  name: string
  contact: string
  phone: string
  email: string
  createdDate: string
}

const mockCustomers: Customer[] = [
  { id: '1', name: '北京科技有限公司', contact: '张经理', phone: '138-0000-1234', email: 'zhang@bjtech.com', createdDate: '2023-06-15' },
  { id: '2', name: '上海贸易集团', contact: '李总监', phone: '139-0000-5678', email: 'li@shtrading.com', createdDate: '2023-08-22' },
  { id: '3', name: '深圳创新企业', contact: '王总', phone: '137-0000-9012', email: 'wang@szinnovation.com', createdDate: '2023-09-10' },
  { id: '4', name: '广州制造实业', contact: '陈经理', phone: '136-0000-3456', email: 'chen@gzmanufacture.com', createdDate: '2023-11-05' },
  { id: '5', name: '杭州互联网科技', contact: '刘总', phone: '135-0000-7890', email: 'liu@hztech.com', createdDate: '2024-01-08' },
  { id: '6', name: '成都服务外包', contact: '赵经理', phone: '134-0000-2345', email: 'zhao@cdoutsourcing.com', createdDate: '2024-02-18' },
  { id: '7', name: '武汉物流运输', contact: '孙总', phone: '133-0000-6789', email: 'sun@whlogistics.com', createdDate: '2024-03-12' },
  { id: '8', name: '南京建设工程', contact: '周经理', phone: '132-0000-0147', email: 'zhou@njconstruction.com', createdDate: '2024-04-20' },
]

export function CustomerList() {
  const { selectedCompanyId } = useCompanyStore()
  const [customers] = useState<Customer[]>(mockCustomers)

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
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 5
  const { addToast } = useToast()

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.contact.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phone.includes(searchQuery) ||
      customer.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalPages = Math.ceil(filteredCustomers.length / pageSize)
  const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleDelete = (customer: Customer) => {
    if (window.confirm(`确定要删除客户 "${customer.name}" 吗？`)) {
      addToast(`客户 "${customer.name}" 已删除`, 'success')
    }
  }

  const handleEdit = (_customer: Customer) => {
    addToast('编辑客户功能开发中', 'info')
  }

  const handleAddCustomer = () => {
    addToast('新建客户功能开发中', 'info')
  }

  const handleExport = () => {
    addToast('导出功能开发中', 'info')
  }

  const handleImport = () => {
    addToast('导入功能开发中', 'info')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">客户管理</h1>
          <p className="text-gray-500 mt-1">管理您的客户信息</p>
        </div>
        <Button variant="primary" onClick={handleAddCustomer}>
          <Plus className="w-4 h-4 mr-2" />
          新建客户
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="搜索客户名称、联系人、电话或邮箱..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleExport}>
                导出
              </Button>
              <Button variant="outline" onClick={handleImport}>
                导入
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  客户名称
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  联系人
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  电话
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  邮箱
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  创建日期
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <Search className="w-12 h-12 text-gray-300 mb-3" />
                      <p>没有找到匹配的客户</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{customer.name}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{customer.contact}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">{customer.phone}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{customer.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{customer.createdDate}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(customer)}
                          className="text-gray-500 hover:text-primary-600"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(customer)}
                          className="text-gray-500 hover:text-red-600"
                        >
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

        {/* Pagination */}
        <CardFooter className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            显示 {(currentPage - 1) * pageSize + 1} 到 {Math.min(currentPage * pageSize, filteredCustomers.length)} 条，
            共 {filteredCustomers.length} 条记录
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
                  type="button"
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={cn(
                    'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                    currentPage === page ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
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
        </CardFooter>
      </Card>
    </div>
  )
}
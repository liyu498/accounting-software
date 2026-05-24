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
  Building2,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { useCompanyStore } from '../../stores/companyStore'

interface Supplier {
  id: string
  code: string
  name: string
  contactPerson: string
  contactPhone: string
  contactEmail: string
  address: string
  taxNumber: string
  bankName: string
  bankAccount: string
  totalPayable: number
  isActive: boolean
}

const mockSuppliers: Supplier[] = [
  {
    id: '1',
    code: 'GYS-001',
    name: '上海物资供应有限公司',
    contactPerson: '张经理',
    contactPhone: '13800138001',
    contactEmail: 'shangwu@supplier.com',
    address: '上海市浦东新区张江路100号',
    taxNumber: '91310000123456789X',
    bankName: '中国工商银行上海分行',
    bankAccount: '6222021234567890123',
    totalPayable: 50000,
    isActive: true,
  },
  {
    id: '2',
    code: 'GYS-002',
    name: '北京建材贸易公司',
    contactPerson: '李经理',
    contactPhone: '13900139002',
    contactEmail: 'jiancai@supplier.com',
    address: '北京市朝阳区建材路88号',
    taxNumber: '91110000987654321X',
    bankName: '中国建设银行北京分行',
    bankAccount: '6222021234567890456',
    totalPayable: 35000,
    isActive: true,
  },
]

export function Suppliers() {
  const { selectedCompanyId } = useCompanyStore()
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

  const [suppliers] = useState<Supplier[]>(mockSuppliers)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)

  const pageSize = 10

  const filteredSuppliers = suppliers.filter((supplier) => {
    return (
      supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.contactPerson.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  const totalPages = Math.ceil(filteredSuppliers.length / pageSize)

  const handleExport = () => {
    successToast('导出成功')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">供应商管理</h1>
          <p className="text-gray-500 mt-1">管理供应商信息和应付账款</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            导出
          </Button>
          <Button variant="primary" onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            新建供应商
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-gray-500">供应商数量</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{suppliers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-gray-500">应付账款总额</p>
            <p className="text-2xl font-bold text-red-600 mt-1">
              {formatCurrency(suppliers.reduce((sum, s) => sum + s.totalPayable, 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-gray-500">活跃供应商</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {suppliers.filter((s) => s.isActive).length}
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
              placeholder="搜索供应商名称、编码或联系人..."
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

      {/* Suppliers Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">供应商编码</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">供应商名称</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">联系人</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">联系电话</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">应付账款</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSuppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">{supplier.code}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{supplier.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{supplier.contactPerson}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{supplier.contactPhone}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-red-600">{formatCurrency(supplier.totalPayable)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                      supplier.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    )}>
                      {supplier.isActive ? '活跃' : '停用'}
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

        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            共 {filteredSuppliers.length} 条记录
          </div>
        </div>
      </Card>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">新建供应商</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600" aria-label="关闭">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="供应商编码" placeholder="请输入供应商编码" />
                <Input label="供应商名称" placeholder="请输入供应商名称" />
                <Input label="联系人" placeholder="请输入联系人" />
                <Input label="联系电话" placeholder="请输入联系电话" />
                <Input label="电子邮箱" placeholder="请输入电子邮箱" type="email" />
                <Input label="税务登记号" placeholder="请输入税务登记号" />
              </div>
              <Input label="公司地址" placeholder="请输入公司地址" />
              <div className="grid grid-cols-2 gap-4">
                <Input label="开户银行" placeholder="请输入开户银行" />
                <Input label="银行账号" placeholder="请输入银行账号" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <Button variant="secondary" onClick={() => setShowAddModal(false)}>取消</Button>
              <Button variant="primary" onClick={() => { successToast('供应商创建成功'); setShowAddModal(false); }}>保存</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

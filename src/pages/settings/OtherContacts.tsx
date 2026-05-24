import { useState } from 'react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useSuccessToast } from '../../components/ui/Toast'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowLeftRight,
  Building2,
} from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { useCompanyStore } from '../../stores/companyStore'

interface OtherContact {
  id: string
  code: string
  name: string
  type: '个人' | '企业'
  contactPerson: string
  contactPhone: string
  contactEmail: string
  address: string
  totalReceivable: number
  totalPayable: number
  isActive: boolean
}

const mockContacts: OtherContact[] = [
  {
    id: '1',
    code: 'QTLX-001',
    name: '李明（个人）',
    type: '个人',
    contactPerson: '李明',
    contactPhone: '13700137001',
    contactEmail: 'liming@email.com',
    address: '北京市朝阳区',
    totalReceivable: 5000,
    totalPayable: 2000,
    isActive: true,
  },
  {
    id: '2',
    code: 'QTLX-002',
    name: '深圳科技有限公司',
    type: '企业',
    contactPerson: '王经理',
    contactPhone: '13800138002',
    contactEmail: 'contact@sztech.com',
    address: '深圳市南山区科技园',
    totalReceivable: 15000,
    totalPayable: 8000,
    isActive: true,
  },
]

export function OtherContacts() {
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

  const [contacts] = useState<OtherContact[]>(mockContacts)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)

  const pageSize = 10

  const filteredContacts = contacts.filter((contact) => {
    return (
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.code.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  const totalPages = Math.ceil(filteredContacts.length / pageSize)

  const handleExport = () => {
    successToast('导出成功')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">其他往来</h1>
          <p className="text-gray-500 mt-1">管理个人和企业往来账务</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            导出
          </Button>
          <Button variant="primary" onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            新建往来
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-gray-500">往来数量</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{contacts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-gray-500">应收总额</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {formatCurrency(contacts.reduce((sum, c) => sum + c.totalReceivable, 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-gray-500">应付总额</p>
            <p className="text-2xl font-bold text-red-600 mt-1">
              {formatCurrency(contacts.reduce((sum, c) => sum + c.totalPayable, 0))}
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
              placeholder="搜索往来名称或编码..."
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

      {/* Contacts Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">编码</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">名称</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">类型</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">联系人</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">电话</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">应收</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">应付</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredContacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">{contact.code}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{contact.name}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                      contact.type === '个人' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    )}>
                      {contact.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{contact.contactPerson}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{contact.contactPhone}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-blue-600">{formatCurrency(contact.totalReceivable)}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-red-600">{formatCurrency(contact.totalPayable)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                      contact.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    )}>
                      {contact.isActive ? '活跃' : '停用'}
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
          <div className="text-sm text-gray-500">共 {filteredContacts.length} 条记录</div>
        </div>
      </Card>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">新建往来</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600" aria-label="关闭">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="编码" placeholder="自动生成" disabled />
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">类型</label>
                  <select
                    title="往来类型"
                    className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900"
                  >
                    <option value="个人">个人</option>
                    <option value="企业">企业</option>
                  </select>
                </div>
              </div>
              <Input label="名称" placeholder="请输入名称" />
              <Input label="联系人" placeholder="请输入联系人" />
              <Input label="联系电话" placeholder="请输入联系电话" />
              <Input label="电子邮箱" placeholder="请输入电子邮箱" type="email" />
              <Input label="地址" placeholder="请输入地址" />
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <Button variant="secondary" onClick={() => setShowAddModal(false)}>取消</Button>
              <Button variant="primary" onClick={() => { successToast('创建成功'); setShowAddModal(false); }}>保存</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

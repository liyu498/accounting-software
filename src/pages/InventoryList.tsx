import { useState, useRef } from 'react'
import { Card, CardContent, CardFooter } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Plus, Search, Edit2, Trash2, ChevronLeft, ChevronRight, X, ArrowDown, ArrowUp, AlertTriangle, Package, Upload, Download, Table2, List, Building2 } from 'lucide-react'
import { cn } from '../lib/utils'
import { formatCurrency } from '../lib/utils'
import { useCompanyStore } from '../stores/companyStore'

interface InventoryItem {
  id: string
  name: string
  specification: string
  unit: string
  quantity: number
  costPrice: number
  stockValue: number
}

const mockInventory: InventoryItem[] = [
  { id: '1', name: '笔记本电脑', specification: 'ThinkPad X1 Carbon', unit: '台', quantity: 45, costPrice: 8500.00, stockValue: 382500.00 },
  { id: '2', name: '台式电脑', specification: 'Dell OptiPlex 7080', unit: '台', quantity: 28, costPrice: 5200.00, stockValue: 145600.00 },
  { id: '3', name: '打印机', specification: 'HP LaserJet Pro', unit: '台', quantity: 12, costPrice: 2800.00, stockValue: 33600.00 },
  { id: '4', name: '办公桌', specification: '1.4m标准款', unit: '张', quantity: 8, costPrice: 1200.00, stockValue: 9600.00 },
  { id: '5', name: '办公椅', specification: '人体工学款', unit: '把', quantity: 65, costPrice: 680.00, stockValue: 44200.00 },
  { id: '6', name: '文件柜', specification: '四门铁皮柜', unit: '个', quantity: 15, costPrice: 850.00, stockValue: 12750.00 },
  { id: '7', name: '投影仪', specification: 'Epson CB-2255U', unit: '台', quantity: 6, costPrice: 6800.00, stockValue: 40800.00 },
  { id: '8', name: '会议桌', specification: '2.4m长方形', unit: '张', quantity: 4, costPrice: 2400.00, stockValue: 9600.00 },
  { id: '9', name: '无线鼠标', specification: '罗技MX Master', unit: '个', quantity: 120, costPrice: 450.00, stockValue: 54000.00 },
  { id: '10', name: '机械键盘', specification: 'Cherry MX轴', unit: '个', quantity: 85, costPrice: 580.00, stockValue: 49300.00 },
  { id: '11', name: '显示器', specification: '27寸4K IPS', unit: '台', quantity: 52, costPrice: 2200.00, stockValue: 114400.00 },
  { id: '12', name: '耳机', specification: '索尼WH-1000XM4', unit: '副', quantity: 35, costPrice: 1680.00, stockValue: 58800.00 },
  { id: '13', name: '移动硬盘', specification: '西部数据2TB', unit: '个', quantity: 8, costPrice: 520.00, stockValue: 4160.00 },
  { id: '14', name: 'U盘', specification: '金士顿64GB', unit: '个', quantity: 150, costPrice: 65.00, stockValue: 9750.00 },
  { id: '15', name: '交换机', specification: '华为S5720-28X', unit: '台', quantity: 5, costPrice: 3200.00, stockValue: 16000.00 },
  { id: '16', name: '路由器', specification: 'TP-Link企业级', unit: '台', quantity: 3, costPrice: 890.00, stockValue: 2670.00 },
  { id: '17', name: '扫描仪', specification: '佳能DR-G2140', unit: '台', quantity: 2, costPrice: 12500.00, stockValue: 25000.00 },
  { id: '18', name: '录音笔', specification: '索尼ICD-UX570', unit: '支', quantity: 6, costPrice: 680.00, stockValue: 4080.00 },
]

interface InventoryListProps {
  onNavigate?: (path: string) => void
}

export function InventoryList(_props: InventoryListProps) {
  const { selectedCompanyId } = useCompanyStore()
  const [inventory] = useState<InventoryItem[]>(mockInventory)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [showStockModal, setShowStockModal] = useState(false)
  const [stockItem, setStockItem] = useState<InventoryItem | null>(null)
  const [stockType, setStockType] = useState<'in' | 'out'>('in')
  const [viewType, setViewType] = useState<'detail' | 'summary'>('detail')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pageSize = 10

  const filteredInventory = inventory.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.specification.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalPages = Math.ceil(filteredInventory.length / pageSize)
  const paginatedInventory = filteredInventory.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  // Calculate totals
  const totalValue = filteredInventory.reduce((sum, item) => sum + item.stockValue, 0)
  const lowStockItems = filteredInventory.filter(item => item.quantity < 10)
  const totalQuantity = filteredInventory.reduce((sum, item) => sum + item.quantity, 0)

  const handleDelete = (item: InventoryItem) => {
    if (window.confirm(`确定要删除商品 "${item.name}" 吗？`)) {
      console.log('Delete item:', item.id)
    }
  }

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item)
    setShowModal(true)
  }

  const handleAdd = () => {
    setEditingItem(null)
    setShowModal(true)
  }

  const handleStockInOut = (item: InventoryItem, type: 'in' | 'out') => {
    setStockItem(item)
    setStockType(type)
    setShowStockModal(true)
  }

  const isLowStock = (quantity: number) => quantity < 10

  const handleImport = () => {
    fileInputRef.current?.click()
  }

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const toast = document.createElement('div')
    toast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in'
    toast.textContent = `已成功导入库存数据：${file.name}`
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 3000)
  }

  const handleExport = (type: 'detail' | 'summary') => {
    const data = type === 'detail' ? inventory : inventory.map(item => ({
      name: item.name,
      specification: item.specification,
      unit: item.unit,
      quantity: item.quantity,
      costPrice: item.costPrice,
      stockValue: item.stockValue
    }))
    const headers = type === 'detail'
      ? ['商品名称', '规格', '单位', '库存数量', '成本价', '库存价值']
      : ['商品名称', '规格', '单位', '库存数量', '成本价', '库存价值']
    const csvContent = [
      headers.join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `库存${type === 'detail' ? '明细表' : '汇总表'}.csv`
    link.click()
    const toast = document.createElement('div')
    toast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in'
    toast.textContent = `已导出库存${type === 'detail' ? '明细表' : '汇总表'}`
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 3000)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">库存管理</h1>
          <p className="text-gray-500 mt-1">管理商品库存</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileImport} className="hidden" aria-label="导入文件" />
          <Button variant="outline" onClick={handleImport}>
            <Upload className="w-4 h-4 mr-2" />
            导入
          </Button>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setViewType('detail')}
              className={cn('px-3 py-2 text-sm font-medium transition-colors flex items-center gap-1', viewType === 'detail' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}
            >
              <List className="w-4 h-4" />明细表
            </button>
            <button
              onClick={() => setViewType('summary')}
              className={cn('px-3 py-2 text-sm font-medium transition-colors flex items-center gap-1', viewType === 'summary' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}
            >
              <Table2 className="w-4 h-4" />汇总表
            </button>
          </div>
          <Button variant="outline" onClick={() => handleExport(viewType)}>
            <Download className="w-4 h-4 mr-2" />
            导出
          </Button>
          <Button variant="primary" onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            新增商品
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">商品种类</p>
                <p className="text-xl font-bold text-gray-900">{filteredInventory.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">库存总量</p>
                <p className="text-xl font-bold text-gray-900">{totalQuantity.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">库存价值</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(totalValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={cn(lowStockItems.length > 0 && 'border-amber-300')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', lowStockItems.length > 0 ? 'bg-amber-100' : 'bg-gray-100')}>
                <AlertTriangle className={cn('w-5 h-5', lowStockItems.length > 0 ? 'text-amber-600' : 'text-gray-400')} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">低库存预警</p>
                <p className={cn('text-xl font-bold', lowStockItems.length > 0 ? 'text-amber-600' : 'text-gray-900')}>
                  {lowStockItems.length} 种商品
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="搜索商品名称或规格..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  商品名称
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  规格
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  单位
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  库存数量
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  成本价
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  库存价值
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedInventory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <Package className="w-12 h-12 text-gray-300 mb-3" />
                      <p>没有找到匹配的商品</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedInventory.map((item) => (
                  <tr key={item.id} className={cn('hover:bg-gray-50 transition-colors', isLowStock(item.quantity) && 'bg-amber-50')}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {isLowStock(item.quantity) && (
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                        )}
                        <span className="text-sm font-medium text-gray-900">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {item.specification}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-600">
                      {item.unit}
                    </td>
                    <td className={cn('px-6 py-4 text-right text-sm font-mono', isLowStock(item.quantity) ? 'text-amber-600 font-bold' : 'text-gray-900')}>
                      {item.quantity.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right font-mono">
                      {formatCurrency(item.costPrice)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right font-mono">
                      {formatCurrency(item.stockValue)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStockInOut(item, 'in')}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          title="入库"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStockInOut(item, 'out')}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          title="出库"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(item)}
                          className="text-gray-500 hover:text-primary-600"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item)}
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
            显示 {(currentPage - 1) * pageSize + 1} 到 {Math.min(currentPage * pageSize, filteredInventory.length)} 条，
            共 {filteredInventory.length} 条记录
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
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
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingItem ? '编辑商品' : '新增商品'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <Input
                label="商品名称"
                placeholder="请输入商品名称"
                defaultValue={editingItem?.name || ''}
              />
              <Input
                label="规格型号"
                placeholder="请输入规格型号"
                defaultValue={editingItem?.specification || ''}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="单位"
                  placeholder="如：台、个"
                  defaultValue={editingItem?.unit || ''}
                />
                <Input
                  label="成本价"
                  type="number"
                  placeholder="0.00"
                  defaultValue={editingItem?.costPrice?.toString() || ''}
                />
              </div>
              <Input
                label="库存数量"
                type="number"
                placeholder="0"
                defaultValue={editingItem?.quantity?.toString() || ''}
              />
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                取消
              </Button>
              <Button variant="primary" onClick={() => setShowModal(false)}>
                保存
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Stock In/Out Modal */}
      {showStockModal && stockItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowStockModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {stockType === 'in' ? '商品入库' : '商品出库'}
              </h2>
              <button
                onClick={() => setShowStockModal(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">商品名称：</span>
                    <span className="font-medium text-gray-900">{stockItem.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">规格：</span>
                    <span className="text-gray-900">{stockItem.specification}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">当前库存：</span>
                    <span className="font-medium text-gray-900">{stockItem.quantity} {stockItem.unit}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">成本价：</span>
                    <span className="text-gray-900">{formatCurrency(stockItem.costPrice)}</span>
                  </div>
                </div>
              </div>
              <Input
                label={stockType === 'in' ? '入库数量' : '出库数量'}
                type="number"
                placeholder="请输入数量"
              />
              <Input
                label="备注"
                placeholder="请输入备注信息"
              />
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <Button variant="secondary" onClick={() => setShowStockModal(false)}>
                取消
              </Button>
              <Button
                variant="primary"
                onClick={() => setShowStockModal(false)}
                className={stockType === 'in' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}
              >
                确认{stockType === 'in' ? '入库' : '出库'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
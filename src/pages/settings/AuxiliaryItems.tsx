import { useState, useMemo } from 'react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useSuccessToast, useWarningToast } from '../../components/ui/Toast'
import { Plus, Edit, Trash2, Search, X, Power, PowerOff } from 'lucide-react'
import { useAuxiliaryStore } from '../../stores/auxiliaryStore'
import { useCompanyStore } from '../../stores/companyStore'

export function AuxiliaryItems() {
  const { selectedCompanyId } = useCompanyStore()
  const { categories, items, isLoading, fetchCategories, fetchAllItems, createItem, updateItem, deleteItem, toggleItem } =
    useAuxiliaryStore()
  const showSuccess = useSuccessToast()
  const showWarning = useWarningToast()

  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCode, setEditCode] = useState('')
  const [editName, setEditName] = useState('')
  const [editRemarks, setEditRemarks] = useState('')

  // New item form
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [newRemarks, setNewRemarks] = useState('')

  useState(() => {
    if (selectedCompanyId) {
      fetchCategories(selectedCompanyId)
      fetchAllItems(selectedCompanyId)
    }
  })

  const filteredItems = useMemo(() => {
    let list = items
    if (selectedCategoryId) list = list.filter((i) => i.category_id === selectedCategoryId)
    if (searchTerm) {
      const kw = searchTerm.toLowerCase()
      list = list.filter((i) => i.code.toLowerCase().includes(kw) || i.name.toLowerCase().includes(kw))
    }
    return list
  }, [items, selectedCategoryId, searchTerm])

  const getCategoryName = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId)?.name || ''
  }

  const handleAdd = async () => {
    if (!selectedCompanyId || !selectedCategoryId) {
      showWarning('请先选择辅助核算类别')
      return
    }
    if (!newCode.trim() || !newName.trim()) {
      showWarning('编码和名称不能为空')
      return
    }
    try {
      await createItem({
        category_id: selectedCategoryId,
        company_id: selectedCompanyId,
        code: newCode.trim(),
        name: newName.trim(),
        remarks: newRemarks.trim() || undefined,
      })
      showSuccess('添加成功')
      setNewCode('')
      setNewName('')
      setNewRemarks('')
    } catch (e) {
      showWarning(String(e))
    }
  }

  const startEdit = (item: { id: string; code: string; name: string; remarks: string | null; category_id: string }) => {
    setEditingId(item.id)
    setEditCode(item.code)
    setEditName(item.name)
    setEditRemarks(item.remarks || '')
  }

  const handleUpdate = async () => {
    if (!editingId || !selectedCompanyId) return
    const item = items.find((i) => i.id === editingId)
    if (!item) return
    try {
      await updateItem(editingId, {
        category_id: item.category_id,
        company_id: selectedCompanyId,
        code: editCode.trim(),
        name: editName.trim(),
        remarks: editRemarks.trim() || undefined,
      })
      showSuccess('修改成功')
      setEditingId(null)
    } catch (e) {
      showWarning(String(e))
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteItem(id)
      showSuccess('删除成功')
    } catch (e) {
      showWarning(String(e))
    }
  }

  const handleToggle = async (id: string) => {
    try {
      await toggleItem(id)
    } catch (e) {
      showWarning(String(e))
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="w-48">
              <label className="block text-sm font-medium text-gray-700 mb-1">辅助核算类别</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
              >
                <option value="">全部类别</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="搜索编码或名称..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {selectedCategoryId && (
            <div className="flex items-end gap-3 pt-3 border-t">
              <div className="w-32">
                <label className="block text-xs text-gray-500 mb-1">编码</label>
                <Input
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="001"
                                 />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">名称</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="项目名称"
                                 />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">备注</label>
                <Input
                  value={newRemarks}
                  onChange={(e) => setNewRemarks(e.target.value)}
                  placeholder="可选"
                                 />
              </div>
              <Button onClick={handleAdd} disabled={isLoading} >
                <Plus className="w-4 h-4 mr-1" />
                添加
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h3 className="text-lg font-semibold mb-4">辅助核算项目列表</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 font-medium w-20">编码</th>
                  <th className="pb-2 font-medium">名称</th>
                  <th className="pb-2 font-medium w-24">所属类别</th>
                  <th className="pb-2 font-medium w-20">状态</th>
                  <th className="pb-2 font-medium">备注</th>
                  <th className="pb-2 font-medium w-28 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    {editingId === item.id ? (
                      <>
                        <td className="py-2">
                          <Input value={editCode} onChange={(e) => setEditCode(e.target.value)}  />
                        </td>
                        <td className="py-2">
                          <Input value={editName} onChange={(e) => setEditName(e.target.value)}  />
                        </td>
                        <td className="py-2 text-gray-500">{getCategoryName(item.category_id)}</td>
                        <td className="py-2">{item.is_enabled ? '启用' : '停用'}</td>
                        <td className="py-2">
                          <Input value={editRemarks} onChange={(e) => setEditRemarks(e.target.value)}  />
                        </td>
                        <td className="py-2 text-right space-x-1">
                          <button onClick={handleUpdate} className="text-blue-600 hover:text-blue-800 p-1 text-xs">
                            保存
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-gray-400 hover:text-gray-600 p-1"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2.5 font-mono text-xs">{item.code}</td>
                        <td className="py-2.5">{item.name}</td>
                        <td className="py-2.5 text-gray-500">{getCategoryName(item.category_id)}</td>
                        <td className="py-2.5">
                          <button
                            onClick={() => handleToggle(item.id)}
                            className={item.is_enabled ? 'text-green-600' : 'text-gray-400'}
                            title={item.is_enabled ? '停用' : '启用'}
                          >
                            {item.is_enabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="py-2.5 text-gray-400 text-xs">{item.remarks || '-'}</td>
                        <td className="py-2.5 text-right space-x-1">
                          <button
                            onClick={() => startEdit(item)}
                            className="text-gray-400 hover:text-blue-600 p-1"
                            title="编辑"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="text-gray-400 hover:text-red-600 p-1"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

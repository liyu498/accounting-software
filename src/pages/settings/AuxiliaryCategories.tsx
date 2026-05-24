import { useState } from 'react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useSuccessToast, useWarningToast } from '../../components/ui/Toast'
import { Plus, Edit, Trash2, Tag, X } from 'lucide-react'
import { useAuxiliaryStore, type AuxiliaryCategory } from '../../stores/auxiliaryStore'
import { useCompanyStore } from '../../stores/companyStore'

export function AuxiliaryCategories() {
  const { selectedCompanyId } = useCompanyStore()
  const { categories, isLoading, fetchCategories, createCategory, updateCategory, deleteCategory } =
    useAuxiliaryStore()
  const showSuccess = useSuccessToast()
  const showWarning = useWarningToast()

  const [editing, setEditing] = useState<AuxiliaryCategory | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  useState(() => {
    if (selectedCompanyId) fetchCategories(selectedCompanyId)
  })

  const resetForm = () => {
    setName('')
    setCode('')
    setEditing(null)
  }

  const handleAdd = async () => {
    if (!selectedCompanyId) return
    if (!name.trim() || !code.trim()) {
      showWarning('名称和编码不能为空')
      return
    }
    try {
      await createCategory({
        company_id: selectedCompanyId,
        name: name.trim(),
        code: code.trim(),
      })
      showSuccess('添加成功')
      resetForm()
    } catch (e) {
      showWarning(String(e))
    }
  }

  const handleEdit = (cat: AuxiliaryCategory) => {
    setEditing(cat)
    setName(cat.name)
    setCode(cat.code)
  }

  const handleUpdate = async () => {
    if (!editing || !selectedCompanyId) return
    if (!name.trim() || !code.trim()) {
      showWarning('名称和编码不能为空')
      return
    }
    try {
      await updateCategory(editing.id, {
        company_id: selectedCompanyId,
        name: name.trim(),
        code: code.trim(),
        sort_order: editing.sort_order,
      })
      showSuccess('修改成功')
      resetForm()
    } catch (e) {
      showWarning(String(e))
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteCategory(id)
      showSuccess('删除成功')
    } catch (e) {
      showWarning(String(e))
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                类别编码
              </label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="例: CUSTOMER"
              />
            </div>
            <div className="flex-[2]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                类别名称
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 客户"
              />
            </div>
            {editing ? (
              <div className="flex gap-2">
                <Button onClick={handleUpdate} disabled={isLoading}>
                  保存
                </Button>
                <Button variant="secondary" onClick={resetForm}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button onClick={handleAdd} disabled={isLoading}>
                <Plus className="w-4 h-4 mr-1" />
                添加
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h3 className="text-lg font-semibold mb-4">辅助核算类别</h3>
          {categories.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              暂无数据，系统已预置常用的辅助核算类别（客户、供应商、职员、项目、部门、存货）
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 font-medium">编码</th>
                  <th className="pb-2 font-medium">名称</th>
                  <th className="pb-2 font-medium">来源</th>
                  <th className="pb-2 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.id} className="border-b last:border-0">
                    <td className="py-2.5">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">
                        <Tag className="w-3 h-3" />
                        {cat.code}
                      </span>
                    </td>
                    <td className="py-2.5">{cat.name}</td>
                    <td className="py-2.5">
                      {cat.is_system ? (
                        <span className="text-xs text-gray-400">系统预置</span>
                      ) : (
                        <span className="text-xs text-blue-500">自定义</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right space-x-1">
                      <button
                        onClick={() => handleEdit(cat)}
                        className="text-gray-400 hover:text-blue-600 p-1"
                        title="编辑"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id)}
                        className="text-gray-400 hover:text-red-600 p-1"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

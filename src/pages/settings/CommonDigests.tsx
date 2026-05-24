import { useState, useEffect } from 'react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useSuccessToast, useWarningToast } from '../../components/ui/Toast'
import { Plus, Edit, Trash2, X, Check } from 'lucide-react'
import { invoke } from '../../lib/tauri'
import { useCompanyStore } from '../../stores/companyStore'

interface DigestItem {
  id: string
  company_id: string
  content: string
}

export function CommonDigests() {
  const { selectedCompanyId } = useCompanyStore()
  const successToast = useSuccessToast()
  const warningToast = useWarningToast()

  const [digests, setDigests] = useState<DigestItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  useEffect(() => {
    if (selectedCompanyId) loadDigests()
  }, [selectedCompanyId])

  const loadDigests = async () => {
    if (!selectedCompanyId) return
    setIsLoading(true)
    try {
      const list = await invoke<DigestItem[]>('get_common_digests', { companyId: selectedCompanyId })
      setDigests(list)
    } catch (e) {
      warningToast(String(e))
    } finally {
      setIsLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!selectedCompanyId) return
    if (!newContent.trim()) {
      warningToast('摘要内容不能为空')
      return
    }
    try {
      await invoke('create_common_digest', {
        input: { company_id: selectedCompanyId, content: newContent.trim() },
      })
      successToast('添加成功')
      setNewContent('')
      loadDigests()
    } catch (e) {
      warningToast(String(e))
    }
  }

  const startEdit = (item: DigestItem) => {
    setEditingId(item.id)
    setEditContent(item.content)
  }

  const handleUpdate = async () => {
    if (!editingId) return
    if (!editContent.trim()) {
      warningToast('摘要内容不能为空')
      return
    }
    try {
      await invoke('update_common_digest', {
        id: editingId,
        input: { company_id: selectedCompanyId!, content: editContent.trim() },
      })
      successToast('修改成功')
      setEditingId(null)
      loadDigests()
    } catch (e) {
      warningToast(String(e))
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await invoke('delete_common_digest', { id })
      successToast('删除成功')
      loadDigests()
    } catch (e) {
      warningToast(String(e))
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <h3 className="text-lg font-semibold mb-4">常用摘要管理</h3>
          <div className="flex items-end gap-3 mb-4 pb-4 border-b">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">新增摘要</label>
              <Input
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="输入常用摘要内容，如：收到客户货款"
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
              />
            </div>
            <Button onClick={handleAdd} disabled={isLoading}>
              <Plus className="w-4 h-4 mr-1" />
              添加
            </Button>
          </div>

          {digests.length === 0 && !isLoading ? (
            <div className="text-center py-8 text-gray-400">
              暂无常用摘要，请添加
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 font-medium w-12">#</th>
                    <th className="pb-2 font-medium">摘要内容</th>
                    <th className="pb-2 font-medium w-24 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {digests.map((item, idx) => (
                    <tr key={item.id} className="border-b last:border-0">
                      {editingId === item.id ? (
                        <>
                          <td className="py-2 text-gray-400">{idx + 1}</td>
                          <td className="py-2">
                            <Input
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleUpdate() }}
                            />
                          </td>
                          <td className="py-2 text-right space-x-1">
                            <button onClick={handleUpdate} className="text-green-600 hover:text-green-800 p-1" title="保存">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600 p-1" title="取消">
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2.5 text-gray-400">{idx + 1}</td>
                          <td className="py-2.5">{item.content}</td>
                          <td className="py-2.5 text-right space-x-1">
                            <button onClick={() => startEdit(item)} className="text-gray-400 hover:text-blue-600 p-1" title="编辑">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(item.id)} className="text-gray-400 hover:text-red-600 p-1" title="删除">
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}

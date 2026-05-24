import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useSuccessToast, useWarningToast } from '../../components/ui/Toast'
import { Plus, Edit, Trash2, X, Check, Star, StarOff } from 'lucide-react'
import { invoke } from '../../lib/tauri'
import { useCompanyStore } from '../../stores/companyStore'

interface Currency {
  id: string
  company_id: string
  code: string
  name: string
  exchange_rate: number
  is_base: number
}

const emptyForm = { code: '', name: '', exchange_rate: 1.0, is_base: false }

export function CurrencyManager() {
  const { selectedCompanyId } = useCompanyStore()
  const successToast = useSuccessToast()
  const warningToast = useWarningToast()

  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newCurrency, setNewCurrency] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)

  useEffect(() => {
    if (selectedCompanyId) loadCurrencies()
  }, [selectedCompanyId])

  const loadCurrencies = async () => {
    if (!selectedCompanyId) return
    setIsLoading(true)
    try {
      const data = await invoke<Currency[]>('get_currencies', { companyId: selectedCompanyId })
      setCurrencies(data)
    } catch (e) {
      warningToast(`加载币别失败: ${e}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!selectedCompanyId) return
    if (!newCurrency.code.trim()) {
      warningToast('请输入币别编码')
      return
    }
    try {
      await invoke('create_currency', {
        input: {
          company_id: selectedCompanyId,
          code: newCurrency.code.trim().toUpperCase(),
          name: newCurrency.name.trim(),
          exchange_rate: newCurrency.exchange_rate,
          is_base: newCurrency.is_base ? 1 : 0,
        },
      })
      successToast('币别已添加')
      setNewCurrency(emptyForm)
      setShowAddForm(false)
      loadCurrencies()
    } catch (e) {
      warningToast(`添加失败: ${e}`)
    }
  }

  const startEdit = (c: Currency) => {
    setEditingId(c.id)
    setEditForm({ code: c.code, name: c.name, exchange_rate: c.exchange_rate, is_base: c.is_base === 1 })
  }

  const handleUpdate = async () => {
    if (!editingId) return
    try {
      await invoke('update_currency', {
        input: {
          id: editingId,
          code: editForm.code.trim().toUpperCase(),
          name: editForm.name.trim(),
          exchange_rate: editForm.exchange_rate,
          is_base: editForm.is_base ? 1 : 0,
        },
      })
      successToast('币别已更新')
      setEditingId(null)
      loadCurrencies()
    } catch (e) {
      warningToast(`更新失败: ${e}`)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await invoke('delete_currency', { id })
      successToast('币别已删除')
      loadCurrencies()
    } catch (e) {
      warningToast(`删除失败: ${e}`)
    }
  }

  const handleSetBase = async (c: Currency) => {
    try {
      await invoke('update_currency', {
        input: { id: c.id, is_base: 1 },
      })
      successToast(`已将 ${c.name} 设为本位币`)
      loadCurrencies()
    } catch (e) {
      warningToast(`设置失败: ${e}`)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">币别管理</h1>
          <p className="text-gray-500 mt-1">管理外币币别和汇率，支持多币别核算</p>
        </div>
        <Button onClick={() => setShowAddForm(true)} disabled={showAddForm}>
          <Plus className="w-4 h-4 mr-2" />
          添加币别
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">币别编码 *</label>
                <Input
                  value={newCurrency.code}
                  onChange={(e) => setNewCurrency({ ...newCurrency, code: e.target.value })}
                  placeholder="如 USD, EUR"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">币别名称 *</label>
                <Input
                  value={newCurrency.name}
                  onChange={(e) => setNewCurrency({ ...newCurrency, name: e.target.value })}
                  placeholder="如 美元, 欧元"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">汇率</label>
                <Input
                  type="number"
                  step="0.0001"
                  value={newCurrency.exchange_rate}
                  onChange={(e) => setNewCurrency({ ...newCurrency, exchange_rate: parseFloat(e.target.value) || 1 })}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer pb-2">
                  <input
                    type="checkbox"
                    checked={newCurrency.is_base}
                    onChange={(e) => setNewCurrency({ ...newCurrency, is_base: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">设为本位币</span>
                </label>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Button onClick={handleAdd}><Check className="w-4 h-4 mr-1" />保存</Button>
              <Button variant="outline" onClick={() => { setShowAddForm(false); setNewCurrency(emptyForm) }}>
                <X className="w-4 h-4 mr-1" />取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">币别列表</h2>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">加载中...</div>
          ) : currencies.length === 0 ? (
            <div className="p-8 text-center text-gray-500">暂无币别数据</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">编码</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">名称</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">汇率</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">本位币</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody>
                {currencies.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                    {editingId === c.id ? (
                      <>
                        <td className="px-4 py-2">
                          <Input value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} className="h-8 text-sm" />
                        </td>
                        <td className="px-4 py-2">
                          <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="h-8 text-sm" />
                        </td>
                        <td className="px-4 py-2">
                          <Input type="number" step="0.0001" value={editForm.exchange_rate} onChange={(e) => setEditForm({ ...editForm, exchange_rate: parseFloat(e.target.value) || 1 })} className="h-8 text-sm text-right" />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <input type="checkbox" checked={editForm.is_base} onChange={(e) => setEditForm({ ...editForm, is_base: e.target.checked })} className="rounded" />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={handleUpdate} className="p-1 text-green-600 hover:bg-green-50 rounded" title="保存"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setEditingId(null)} className="p-1 text-gray-500 hover:bg-gray-100 rounded" title="取消"><X className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-mono font-medium text-gray-900">{c.code}</td>
                        <td className="px-4 py-3 text-gray-700">{c.name}</td>
                        <td className="px-4 py-3 text-right font-mono text-gray-700">{c.exchange_rate.toFixed(4)}</td>
                        <td className="px-4 py-3 text-center">
                          {c.is_base ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                              <Star className="w-3 h-3 mr-1" />本位币
                            </span>
                          ) : (
                            <button onClick={() => handleSetBase(c)} className="text-gray-400 hover:text-amber-500" title="设为本位币">
                              <StarOff className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => startEdit(c)} className="p-1 text-gray-500 hover:text-blue-600 rounded" title="编辑"><Edit className="w-4 h-4" /></button>
                            {!c.is_base && (
                              <button onClick={() => handleDelete(c.id)} className="p-1 text-gray-500 hover:text-red-600 rounded" title="删除"><Trash2 className="w-4 h-4" /></button>
                            )}
                          </div>
                        </td>
                      </>
                    )}
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

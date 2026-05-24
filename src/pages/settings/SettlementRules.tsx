import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useSuccessToast, useWarningToast } from '../../components/ui/Toast'
import { Plus, Edit, Trash2, X, Check, ToggleLeft, ToggleRight } from 'lucide-react'
import { invoke } from '../../lib/tauri'
import { useCompanyStore } from '../../stores/companyStore'

interface SettlementRule {
  id: string
  company_id: string
  name: string
  rule_type: string
  source_formula: string | null
  target_account_code: string | null
  voucher_word_id: string | null
  summary_template: string | null
  priority: number
  is_enabled: number
}

const RULE_TYPES = [
  { value: 'profit_loss', label: '结转损益' },
  { value: 'tax', label: '计提所得税' },
  { value: 'vat', label: '转出未交增值税' },
  { value: 'custom', label: '自定义结转' },
]

const emptyRule = {
  name: '',
  rule_type: 'profit_loss',
  source_formula: '',
  target_account_code: '',
  summary_template: '',
  priority: 0,
}

export function SettlementRules() {
  const { selectedCompanyId } = useCompanyStore()
  const successToast = useSuccessToast()
  const warningToast = useWarningToast()

  const [rules, setRules] = useState<SettlementRule[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newRule, setNewRule] = useState(emptyRule)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRule, setEditRule] = useState(emptyRule)

  useEffect(() => {
    if (selectedCompanyId) loadRules()
  }, [selectedCompanyId])

  const loadRules = async () => {
    if (!selectedCompanyId) return
    setIsLoading(true)
    try {
      const data = await invoke<SettlementRule[]>('get_settlement_rules', { companyId: selectedCompanyId })
      setRules(data)
    } catch (e) {
      warningToast(`加载结转规则失败: ${e}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!selectedCompanyId) return
    if (!newRule.name.trim()) {
      warningToast('请输入规则名称')
      return
    }
    try {
      await invoke('create_settlement_rule', {
        input: {
          company_id: selectedCompanyId,
          name: newRule.name.trim(),
          rule_type: newRule.rule_type,
          source_formula: newRule.source_formula || null,
          target_account_code: newRule.target_account_code || null,
          voucher_word_id: null,
          summary_template: newRule.summary_template || null,
          priority: newRule.priority,
        },
      })
      successToast('结转规则已创建')
      setNewRule(emptyRule)
      setShowAddForm(false)
      loadRules()
    } catch (e) {
      warningToast(`创建失败: ${e}`)
    }
  }

  const handleUpdate = async () => {
    if (!editingId) return
    try {
      await invoke('update_settlement_rule', {
        input: {
          id: editingId,
          name: editRule.name.trim(),
          rule_type: editRule.rule_type,
          source_formula: editRule.source_formula || null,
          target_account_code: editRule.target_account_code || null,
          voucher_word_id: null,
          summary_template: editRule.summary_template || null,
          priority: editRule.priority,
        },
      })
      successToast('结转规则已更新')
      setEditingId(null)
      loadRules()
    } catch (e) {
      warningToast(`更新失败: ${e}`)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await invoke('delete_settlement_rule', { id })
      successToast('结转规则已删除')
      loadRules()
    } catch (e) {
      warningToast(`删除失败: ${e}`)
    }
  }

  const handleToggle = async (rule: SettlementRule) => {
    try {
      await invoke('update_settlement_rule', {
        input: { id: rule.id, is_enabled: rule.is_enabled === 1 ? 0 : 1 },
      })
      loadRules()
    } catch (e) {
      warningToast(`操作失败: ${e}`)
    }
  }

  const startEdit = (rule: SettlementRule) => {
    setEditingId(rule.id)
    setEditRule({
      name: rule.name,
      rule_type: rule.rule_type,
      source_formula: rule.source_formula || '',
      target_account_code: rule.target_account_code || '',
      summary_template: rule.summary_template || '',
      priority: rule.priority,
    })
  }

  const getRuleTypeLabel = (type: string) => RULE_TYPES.find((t) => t.value === type)?.label ?? type

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">结转规则管理</h1>
          <p className="text-gray-500 mt-1">配置期末结转凭证的生成规则</p>
        </div>
        <Button onClick={() => setShowAddForm(true)} disabled={showAddForm}>
          <Plus className="w-4 h-4 mr-2" />
          新增规则
        </Button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">规则名称 *</label>
                <Input
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  placeholder="如: 结转损益"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">结转类型</label>
                <select
                  title="选择结转类型"
                  className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm"
                  value={newRule.rule_type}
                  onChange={(e) => setNewRule({ ...newRule, rule_type: e.target.value })}
                >
                  {RULE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">目标科目编码</label>
                <Input
                  value={newRule.target_account_code}
                  onChange={(e) => setNewRule({ ...newRule, target_account_code: e.target.value })}
                  placeholder="如: 3101 (本年利润)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">取数公式 (JSON)</label>
                <Input
                  value={newRule.source_formula}
                  onChange={(e) => setNewRule({ ...newRule, source_formula: e.target.value })}
                  placeholder="可选，自定义取数规则"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">摘要模板</label>
                <Input
                  value={newRule.summary_template}
                  onChange={(e) => setNewRule({ ...newRule, summary_template: e.target.value })}
                  placeholder="如: 结转损益至本年利润"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">优先级</label>
                <Input
                  type="number"
                  value={newRule.priority}
                  onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Button onClick={handleAdd}>
                <Check className="w-4 h-4 mr-1" />
                保存
              </Button>
              <Button variant="outline" onClick={() => { setShowAddForm(false); setNewRule(emptyRule) }}>
                <X className="w-4 h-4 mr-1" />
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rules table */}
      <Card>
        <CardHeader className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">结转规则列表</h2>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">加载中...</div>
          ) : rules.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              暂无结转规则，点击"新增规则"添加
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left font-medium text-gray-600">名称</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">类型</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">目标科目</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">摘要模板</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600">优先级</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600">状态</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id} className="border-b border-gray-100 hover:bg-gray-50">
                      {editingId === rule.id ? (
                        <>
                          <td className="px-4 py-2">
                            <Input
                              value={editRule.name}
                              onChange={(e) => setEditRule({ ...editRule, name: e.target.value })}
                              className="h-8 text-sm"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <select
                              title="编辑结转类型"
                              className="h-8 px-2 rounded border border-gray-300 text-sm"
                              value={editRule.rule_type}
                              onChange={(e) => setEditRule({ ...editRule, rule_type: e.target.value })}
                            >
                              {RULE_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              value={editRule.target_account_code}
                              onChange={(e) => setEditRule({ ...editRule, target_account_code: e.target.value })}
                              className="h-8 text-sm"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              value={editRule.summary_template}
                              onChange={(e) => setEditRule({ ...editRule, summary_template: e.target.value })}
                              className="h-8 text-sm"
                            />
                          </td>
                          <td className="px-4 py-2 text-center">
                            <Input
                              type="number"
                              value={editRule.priority}
                              onChange={(e) => setEditRule({ ...editRule, priority: parseInt(e.target.value) || 0 })}
                              className="h-8 text-sm w-16 text-center"
                            />
                          </td>
                          <td className="px-4 py-2 text-center">—</td>
                          <td className="px-4 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={handleUpdate} className="p-1 text-green-600 hover:bg-green-50 rounded" title="保存">
                                <Check className="w-4 h-4" />
                              </button>
                              <button onClick={() => setEditingId(null)} className="p-1 text-gray-500 hover:bg-gray-100 rounded" title="取消">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 font-medium text-gray-900">{rule.name}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                              {getRuleTypeLabel(rule.rule_type)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{rule.target_account_code || '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{rule.summary_template || '—'}</td>
                          <td className="px-4 py-3 text-center text-gray-600">{rule.priority}</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => handleToggle(rule)} className="text-gray-500 hover:text-gray-700" title={rule.is_enabled ? '点击禁用' : '点击启用'}>
                              {rule.is_enabled ? (
                                <ToggleRight className="w-6 h-6 text-green-500" />
                              ) : (
                                <ToggleLeft className="w-6 h-6 text-gray-400" />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => startEdit(rule)} className="p-1 text-gray-500 hover:text-blue-600 rounded" title="编辑">
                                <Edit className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDelete(rule.id)} className="p-1 text-gray-500 hover:text-red-600 rounded" title="删除">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
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

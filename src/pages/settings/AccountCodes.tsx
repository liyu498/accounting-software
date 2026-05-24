import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useSuccessToast, useWarningToast } from '../../components/ui/Toast'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Download,
  X,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAccountStore, type AccountCode } from '../../stores/accountStore'
import { useCompanyStore } from '../../stores/companyStore'

interface TreeNode extends AccountCode {
  children: TreeNode[]
}

const categoryConfig = {
  asset: { label: '资产', color: 'bg-blue-100 text-blue-700', textColor: 'text-blue-600' },
  liability: { label: '负债', color: 'bg-red-100 text-red-700', textColor: 'text-red-600' },
  equity: { label: '权益', color: 'bg-purple-100 text-purple-700', textColor: 'text-purple-600' },
  cost: { label: '成本', color: 'bg-amber-100 text-amber-700', textColor: 'text-amber-600' },
  profit: { label: '损益', color: 'bg-green-100 text-green-700', textColor: 'text-green-600' },
}

type AccountType = keyof typeof categoryConfig

function buildTree(accounts: AccountCode[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  for (const a of accounts) {
    map.set(a.code, { ...a, children: [] })
  }

  for (const a of accounts) {
    const node = map.get(a.code)!
    if (a.parent_code && map.has(a.parent_code)) {
      map.get(a.parent_code)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortSiblings = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.code.localeCompare(b.code))
    for (const n of nodes) sortSiblings(n.children)
  }
  sortSiblings(roots)

  return roots
}

function flattenTree(nodes: TreeNode[], expanded: Set<string>, depth = 0): { node: TreeNode; depth: number }[] {
  const rows: { node: TreeNode; depth: number }[] = []
  for (const node of nodes) {
    rows.push({ node, depth })
    if (node.children.length > 0 && expanded.has(node.code)) {
      rows.push(...flattenTree(node.children, expanded, depth + 1))
    }
  }
  return rows
}

interface NewAccountForm {
  code: string
  name: string
  account_type: AccountType
  normal_balance: 'debit' | 'credit'
  parent_code: string
}

const defaultForm: NewAccountForm = {
  code: '',
  name: '',
  account_type: 'asset',
  normal_balance: 'debit',
  parent_code: '',
}

export function AccountCodes() {
  const successToast = useSuccessToast()
  const warningToast = useWarningToast()

  const { accounts, isLoading, fetchAccounts, searchAccounts, createAccount, toggleAccount, deleteAccount } = useAccountStore()
  const { selectedCompanyId } = useCompanyStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set())
  const [form, setForm] = useState<NewAccountForm>({ ...defaultForm })
  const [searchResults, setSearchResults] = useState<AccountCode[] | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (selectedCompanyId) {
      fetchAccounts(selectedCompanyId)
    }
  }, [selectedCompanyId, fetchAccounts])

  const handleSearch = useCallback((keyword: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!keyword.trim()) {
      setSearchResults(null)
      return
    }
    debounceRef.current = setTimeout(async () => {
      if (!selectedCompanyId) return
      const results = await searchAccounts(keyword, selectedCompanyId)
      setSearchResults(results)
    }, 300)
  }, [searchAccounts])

  const sourceAccounts = searchResults ?? accounts

  const filteredAccounts = typeFilter
    ? sourceAccounts.filter((a) => a.account_type === typeFilter)
    : sourceAccounts

  const tree = searchResults === null ? buildTree(filteredAccounts) : []
  const flatRows = searchResults === null
    ? flattenTree(tree, expandedAccounts)
    : filteredAccounts.map((a) => ({ node: a as TreeNode, depth: 0 }))

  const toggleExpand = (code: string) => {
    setExpandedAccounts((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const handleToggleEnabled = async (code: string) => {
    if (!selectedCompanyId) return
    try {
      await toggleAccount(code, selectedCompanyId)
      successToast('科目状态已切换')
    } catch (err) {
      warningToast('操作失败：' + String(err))
    }
  }

  const handleDelete = async (code: string) => {
    if (!selectedCompanyId) return
    if (!window.confirm('确定要删除此科目吗？')) return
    try {
      await deleteAccount(code, selectedCompanyId)
      successToast('科目已删除')
    } catch (err) {
      warningToast('删除失败：' + String(err))
    }
  }

  const handleCreate = async () => {
    if (!selectedCompanyId) return
    if (!form.code.trim() || !form.name.trim()) {
      warningToast('请填写科目编码和名称')
      return
    }
    setIsCreating(true)
    try {
      await createAccount({
        code: form.code.trim(),
        company_id: selectedCompanyId,
        name: form.name.trim(),
        account_type: form.account_type,
        normal_balance: form.normal_balance,
        level: form.parent_code ? 2 : 1,
        parent_code: form.parent_code || undefined,
        is_detail: form.parent_code ? 1 : 0,
      })
      successToast('科目创建成功')
      setShowAddModal(false)
      setForm({ ...defaultForm })
    } catch (err) {
      warningToast('创建失败：' + String(err))
    } finally {
      setIsCreating(false)
    }
  }

  const handleExport = () => {
    successToast('导出成功')
  }

  const parentOptions = accounts.filter((a) => a.is_detail === 0)

  const indentClass = (depth: number) => {
    if (depth === 0) return 'pl-2'
    if (depth === 1) return 'pl-8'
    if (depth === 2) return 'pl-14'
    return 'pl-[80px]'
  }

  const renderRow = ({ node, depth }: { node: TreeNode; depth: number }) => {
    const hasChildren = node.children.length > 0
    const isExpanded = expandedAccounts.has(node.code)
    const typeConf = categoryConfig[node.account_type as AccountType]

    return (
      <tr key={node.code} className={cn('hover:bg-gray-50 transition-colors', node.is_enabled === 0 && 'opacity-50')}>
        <td className="px-4 py-3">
          <div className={cn('flex items-center', indentClass(depth))}>
            {hasChildren ? (
              <button onClick={() => toggleExpand(node.code)} className="p-1 hover:bg-gray-100 rounded">
                {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRightIcon className="w-4 h-4 text-gray-400" />}
              </button>
            ) : (
              <span className="w-6" />
            )}
            <span className="text-sm font-mono font-medium text-gray-900">{node.code}</span>
          </div>
        </td>
        <td className={cn('px-4 py-3 text-sm text-gray-900', indentClass(depth))}>{node.name}</td>
        <td className="px-4 py-3 text-center">
          {typeConf && (
            <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium', typeConf.color)}>
              {typeConf.label}
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-center">
          <span className={cn('text-sm font-medium', node.normal_balance === 'debit' ? 'text-blue-600' : 'text-red-600')}>
            {node.normal_balance === 'debit' ? '借' : '贷'}
          </span>
        </td>
        <td className="px-4 py-3 text-center">
          <span className="text-sm text-gray-500">第{node.level}级</span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-center gap-1">
            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-primary-600" onClick={() => handleToggleEnabled(node.code)} title={node.is_enabled ? '禁用科目' : '启用科目'}>
              <Edit className="w-4 h-4" />
            </Button>
            {node.level === 1 && (
              <Button variant="ghost" size="sm" className="text-gray-500 hover:text-red-600" onClick={() => handleDelete(node.code)} title="删除科目">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">科目设置</h1>
          <p className="text-gray-500 mt-1">管理会计科目编码和名称</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />导出
          </Button>
          <Button variant="primary" onClick={() => { setForm({ ...defaultForm }); setShowAddModal(true) }}>
            <Plus className="w-4 h-4 mr-2" />新建科目
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {Object.entries(categoryConfig).map(([key, config]) => (
          <Card key={key}>
            <CardContent className="p-4 text-center">
              <p className={`text-sm font-medium ${config.textColor}`}>{config.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {accounts.filter((a) => a.account_type === key).length}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                title="搜索科目"
                placeholder="搜索科目编码或名称..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  handleSearch(e.target.value)
                }}
                className="w-full h-10 pl-10 pr-4 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <select
              title="科目类别筛选"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">全部类别</option>
              <option value="asset">资产</option>
              <option value="liability">负债</option>
              <option value="equity">权益</option>
              <option value="cost">成本</option>
              <option value="profit">损益</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">科目编码</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">科目名称</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">类别</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">余额方向</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">级别</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">加载中...</td></tr>
              ) : flatRows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">暂无科目数据</td></tr>
              ) : (
                flatRows.map(renderRow)
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <div className="text-sm text-gray-500">共 {filteredAccounts.length} 个科目</div>
        </div>
      </Card>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">新建科目</h2>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600" aria-label="关闭">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <Input label="科目编码" placeholder="请输入科目编码" value={form.code} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, code: e.target.value }))} />
              <Input label="科目名称" placeholder="请输入科目名称" value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">科目类别</label>
                <select
                  title="新建科目类别"
                  value={form.account_type}
                  onChange={(e) => setForm((f) => ({ ...f, account_type: e.target.value as AccountType }))}
                  className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900"
                >
                  <option value="asset">资产</option>
                  <option value="liability">负债</option>
                  <option value="equity">权益</option>
                  <option value="cost">成本</option>
                  <option value="profit">损益</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">余额方向</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="direction"
                      value="debit"
                      title="借方"
                      checked={form.normal_balance === 'debit'}
                      onChange={() => setForm((f) => ({ ...f, normal_balance: 'debit' }))}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span className="text-sm text-gray-700">借方</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="direction"
                      value="credit"
                      title="贷方"
                      checked={form.normal_balance === 'credit'}
                      onChange={() => setForm((f) => ({ ...f, normal_balance: 'credit' }))}
                      className="w-4 h-4 text-gray-400"
                    />
                    <span className="text-sm text-gray-500">贷方</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">上级科目（可选）</label>
                <select
                  title="上级科目"
                  value={form.parent_code}
                  onChange={(e) => setForm((f) => ({ ...f, parent_code: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900"
                >
                  <option value="">无（一级科目）</option>
                  {parentOptions.map((a) => (
                    <option key={a.code} value={a.code}>{a.code} {a.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)}>取消</Button>
              <Button type="button" variant="primary" onClick={handleCreate} disabled={isCreating}>
                {isCreating ? '创建中...' : '保存'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

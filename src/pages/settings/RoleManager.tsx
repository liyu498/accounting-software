import { useEffect, useState, useCallback } from 'react'
import { invoke } from '../../lib/tauri'
import { useCompanyStore } from '../../stores/companyStore'
import { usePermission } from '../../lib/usePermission'
import { Shield, Plus, Trash2, Users, Edit2, Check, X } from 'lucide-react'

interface Role {
  id: string
  name: string
  code: string
  description: string
  is_system: number
  created_at: string
}

interface RolePermission {
  id: string
  role_id: string
  resource: string
  action: string
}

interface RoleWithPermissions {
  role: Role
  permissions: RolePermission[]
}

interface UserWithRole {
  id: string
  username: string
  real_name: string
  role: string
  role_id: string | null
  role_name: string | null
  company_ids: string[]
}

const RESOURCES = [
  { key: 'vouchers', label: '凭证管理' },
  { key: 'invoices', label: '发票管理' },
  { key: 'reports', label: '财务报表' },
  { key: 'ledger', label: '账簿查询' },
  { key: 'settings', label: '系统设置' },
  { key: 'period', label: '期末结转' },
  { key: 'users', label: '用户管理' },
  { key: 'inventory', label: '库存管理' },
  { key: 'bank', label: '银行对账' },
]

const ACTIONS = [
  { key: 'view', label: '查看' },
  { key: 'create', label: '新增' },
  { key: 'edit', label: '编辑' },
  { key: 'delete', label: '删除' },
  { key: 'approve', label: '审核' },
  { key: 'export', label: '导出' },
  { key: 'print', label: '打印' },
  { key: 'import', label: '导入' },
]

export function RoleManager() {
  const { selectedCompanyId } = useCompanyStore()
  const { canView, canCreate, canEdit, canDelete, isAdmin } = usePermission()
  const [roles, setRoles] = useState<RoleWithPermissions[]>([])
  const [users, setUsers] = useState<UserWithRole[]>([])
  const [activeTab, setActiveTab] = useState<'roles' | 'users'>('roles')
  const [expandedRole, setExpandedRole] = useState<string | null>(null)
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [showNewRole, setShowNewRole] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleCode, setNewRoleCode] = useState('')
  const [newRoleDesc, setNewRoleDesc] = useState('')
  const [editPerms, setEditPerms] = useState<Record<string, Set<string>>>({})
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [rolesData, usersData] = await Promise.all([
        invoke<RoleWithPermissions[]>('get_roles'),
        invoke<UserWithRole[]>('get_users_with_roles', {
          companyId: selectedCompanyId || undefined,
        }),
      ])
      setRoles(rolesData)
      setUsers(usersData)
    } catch (e) {
      console.error('Failed to load roles:', e)
    } finally {
      setLoading(false)
    }
  }, [selectedCompanyId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const startEditRole = (rwp: RoleWithPermissions) => {
    setEditingRole(rwp.role.id)
    setEditName(rwp.role.name)
    setEditDesc(rwp.role.description)
    const perms: Record<string, Set<string>> = {}
    for (const res of RESOURCES) {
      perms[res.key] = new Set<string>()
    }
    for (const p of rwp.permissions) {
      if (perms[p.resource]) {
        perms[p.resource].add(p.action)
      }
    }
    setEditPerms(perms)
  }

  const toggleEditPerm = (resource: string, action: string) => {
    setEditPerms((prev) => {
      const next = { ...prev }
      const set = new Set(next[resource] || [])
      if (set.has(action)) {
        set.delete(action)
      } else {
        set.add(action)
      }
      next[resource] = set
      return next
    })
  }

  const saveRole = async () => {
    if (!editingRole) return
    const permissions: { resource: string; action: string }[] = []
    for (const [resource, actions] of Object.entries(editPerms)) {
      for (const action of actions) {
        permissions.push({ resource, action })
      }
    }
    try {
      await invoke('update_role', {
        input: { id: editingRole, name: editName, description: editDesc, permissions },
      })
      setEditingRole(null)
      setEditPerms({})
      loadData()
    } catch (e) {
      console.error('Failed to save role:', e)
    }
  }

  const createRole = async () => {
    if (!newRoleName.trim() || !newRoleCode.trim()) return
    const permissions: { resource: string; action: string }[] = []
    for (const [resource, actions] of Object.entries(editPerms)) {
      for (const action of actions) {
        permissions.push({ resource, action })
      }
    }
    try {
      await invoke('create_role', {
        input: {
          name: newRoleName,
          code: newRoleCode,
          description: newRoleDesc,
          permissions,
        },
      })
      setShowNewRole(false)
      setNewRoleName('')
      setNewRoleCode('')
      setNewRoleDesc('')
      setEditPerms({})
      loadData()
    } catch (e) {
      console.error('Failed to create role:', e)
    }
  }

  const deleteRole = async (id: string) => {
    if (!confirm('确定删除此角色？已分配此角色的用户将被取消关联。')) return
    try {
      await invoke('delete_role', { id })
      loadData()
    } catch (e) {
      console.error('Failed to delete role:', e)
    }
  }

  const updateUserRole = async (userId: string, roleId: string) => {
    try {
      await invoke('update_user_role', { input: { userId, roleId } })
      loadData()
    } catch (e) {
      console.error('Failed to update user role:', e)
    }
  }

  if (!canView('users')) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">您没有权限查看此页面</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold">权限管理</h2>
        </div>
        {canCreate('users') && (
          <button
            type="button"
            onClick={() => {
              setShowNewRole(true)
              setEditPerms(Object.fromEntries(RESOURCES.map((r) => [r.key, new Set<string>()])))
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" /> 新增角色
          </button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'roles'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Shield className="w-4 h-4 inline mr-1" /> 角色列表
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'users'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-4 h-4 inline mr-1" /> 用户分配
        </button>
      </div>

      {/* Roles tab */}
      {activeTab === 'roles' && (
        <div className="space-y-3">
          {/* New role form */}
          {showNewRole && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-sm">新增角色</h3>
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="角色名称"
                  className="h-9 px-3 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <input
                  type="text"
                  value={newRoleCode}
                  onChange={(e) => setNewRoleCode(e.target.value)}
                  placeholder="角色编码 (如: accountant)"
                  className="h-9 px-3 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <input
                  type="text"
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  placeholder="描述"
                  className="h-9 px-3 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <PermissionGrid
                permissions={editPerms}
                onToggle={toggleEditPerm}
                readOnly={false}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={createRole}
                  className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
                >
                  创建
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNewRole(false); setEditPerms({}) }}
                  className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {/* Existing roles */}
          {roles.map((rwp) => {
            const isEditing = editingRole === rwp.role.id
            const isExpanded = expandedRole === rwp.role.id || isEditing

            return (
              <div
                key={rwp.role.id}
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                <div
                  className="flex items-center justify-between px-4 py-3 bg-white cursor-pointer hover:bg-gray-50"
                  onClick={() => !isEditing && setExpandedRole(isExpanded ? null : rwp.role.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                      <Shield className="w-4 h-4 text-primary-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{rwp.role.name}</span>
                        <span className="text-xs text-gray-400 font-mono">{rwp.role.code}</span>
                        {rwp.role.is_system === 1 && (
                          <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">系统</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{rwp.role.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); saveRole() }}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                          title="保存"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setEditingRole(null); setEditPerms({}) }}
                          className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                          title="取消"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        {canEdit('users') && rwp.role.is_system !== 1 && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); startEditRole(rwp) }}
                            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                            title="编辑"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete('users') && rwp.role.is_system !== 1 && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); deleteRole(rwp.role.id) }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {isExpanded && !isEditing && (
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                    <PermissionGrid
                      permissions={Object.fromEntries(
                        RESOURCES.map((r) => [
                          r.key,
                          new Set(rwp.permissions.filter((p) => p.resource === r.key).map((p) => p.action)),
                        ])
                      )}
                      onToggle={() => {}}
                      readOnly
                    />
                  </div>
                )}

                {isEditing && (
                  <div className="px-4 py-3 bg-blue-50 border-t border-blue-200 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="角色名称"
                        title="角色名称"
                        className="h-9 px-3 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <input
                        type="text"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="描述"
                        className="h-9 px-3 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <PermissionGrid
                      permissions={editPerms}
                      onToggle={toggleEditPerm}
                      readOnly={false}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Users tab */}
      {activeTab === 'users' && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">用户名</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">姓名</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">角色</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm font-mono">{u.username}</td>
                  <td className="px-4 py-2 text-sm">{u.real_name}</td>
                  <td className="px-4 py-2 text-sm">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                      {u.role_name || u.role}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {canEdit('users') && (
                      <select
                        value={u.role_id || ''}
                        onChange={(e) => {
                          if (e.target.value) updateUserRole(u.id, e.target.value)
                        }}
                        title="分配角色"
                        className="h-7 px-2 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                      >
                        <option value="">选择角色...</option>
                        {roles.map((r) => (
                          <option key={r.role.id} value={r.role.id}>
                            {r.role.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Permission grid component
function PermissionGrid({
  permissions,
  onToggle,
  readOnly,
}: {
  permissions: Record<string, Set<string>>
  onToggle: (resource: string, action: string) => void
  readOnly: boolean
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-2 py-1 text-left text-gray-500 w-24">模块</th>
            {ACTIONS.map((a) => (
              <th key={a.key} className="px-2 py-1 text-center text-gray-500">
                {a.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RESOURCES.map((res) => (
            <tr key={res.key} className="border-b border-gray-100">
              <td className="px-2 py-1 text-gray-700 font-medium">{res.label}</td>
              {ACTIONS.map((act) => {
                const checked = permissions[res.key]?.has(act.key) ?? false
                return (
                  <td key={act.key} className="px-2 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => !readOnly && onToggle(res.key, act.key)}
                      disabled={readOnly}
                      title={`${res.label} - ${act.label}`}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

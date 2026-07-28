import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ChevronRight, Edit2, KeyRound, Plus, RefreshCw, Shield, Trash2, Users, X } from 'lucide-react'
import { invoke, isTauri } from '../../lib/tauri'
import { useCompanyStore } from '../../stores/companyStore'
import { usePermission } from '../../lib/usePermission'

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
  { key: 'vouchers', label: '凭证与审核' },
  { key: 'invoices', label: '发票与采集' },
  { key: 'tax', label: '税务申报' },
  { key: 'reports', label: '账簿与报表' },
  { key: 'bank', label: '银行与结算' },
  { key: 'settings', label: '账套与设置' },
  { key: 'users', label: '成员与权限' },
]

const ACTIONS = [
  { key: 'view', label: '查看' },
  { key: 'create', label: '新增' },
  { key: 'edit', label: '编辑' },
  { key: 'approve', label: '审核' },
  { key: 'export', label: '导出' },
  { key: 'delete', label: '删除' },
]

const previewPermission = (roleId: string, resource: string, action: string): RolePermission => ({
  id: `${roleId}-${resource}-${action}`,
  role_id: roleId,
  resource,
  action,
})

const PREVIEW_ROLES: RoleWithPermissions[] = [
  {
    role: { id: 'role-admin', name: '机构管理员', code: 'agency_admin', description: '维护机构资料、成员、授权与高风险操作审批。', is_system: 1, created_at: '2026-05-01' },
    permissions: RESOURCES.flatMap((resource) => ACTIONS.map((action) => previewPermission('role-admin', resource.key, action.key))),
  },
  {
    role: { id: 'role-accountant', name: '主办会计', code: 'accountant', description: '处理账套资料、凭证、报表和申报前复核，不含机构授权。', is_system: 1, created_at: '2026-05-01' },
    permissions: [
      ['vouchers', 'view'], ['vouchers', 'create'], ['vouchers', 'edit'], ['vouchers', 'approve'],
      ['invoices', 'view'], ['invoices', 'create'], ['invoices', 'edit'], ['tax', 'view'], ['tax', 'create'],
      ['reports', 'view'], ['reports', 'export'], ['bank', 'view'], ['bank', 'edit'], ['settings', 'view'],
    ].map(([resource, action]) => previewPermission('role-accountant', resource, action)),
  },
  {
    role: { id: 'role-service', name: '资料专员', code: 'service_assistant', description: '采集资料、维护客户档案并提交待确认事项。', is_system: 0, created_at: '2026-05-08' },
    permissions: [
      ['invoices', 'view'], ['invoices', 'create'], ['bank', 'view'], ['bank', 'create'],
      ['vouchers', 'view'], ['settings', 'view'],
    ].map(([resource, action]) => previewPermission('role-service', resource, action)),
  },
]

const PREVIEW_USERS: UserWithRole[] = [
  { id: 'user-liyu', username: 'admin', real_name: '李喻', role: 'admin', role_id: 'role-admin', role_name: '机构管理员', company_ids: ['all'] },
  { id: 'user-wang', username: 'wang.accountant', real_name: '王会计', role: 'accountant', role_id: 'role-accountant', role_name: '主办会计', company_ids: ['01460', '02018'] },
  { id: 'user-zhao', username: 'zhao.service', real_name: '赵专员', role: 'accountant', role_id: 'role-service', role_name: '资料专员', company_ids: ['03009'] },
]

function createPermissionDraft(permissions: RolePermission[] = []) {
  return Object.fromEntries(RESOURCES.map((resource) => [
    resource.key,
    new Set(permissions.filter((permission) => permission.resource === resource.key).map((permission) => permission.action)),
  ])) as Record<string, Set<string>>
}

function getPermissionCount(role: RoleWithPermissions) {
  return role.permissions.length
}

function clonePreviewRoles() {
  return PREVIEW_ROLES.map((item) => ({
    role: { ...item.role },
    permissions: item.permissions.map((permission) => ({ ...permission })),
  }))
}

export function RoleManager({ scope = 'agency' }: { scope?: 'agency' | 'company' }) {
  const { selectedCompanyId } = useCompanyStore()
  const { canCreate, canDelete, canEdit, canView } = usePermission()
  const [roles, setRoles] = useState<RoleWithPermissions[]>([])
  const [users, setUsers] = useState<UserWithRole[]>([])
  const [activeTab, setActiveTab] = useState<'roles' | 'users'>('roles')
  const [expandedRole, setExpandedRole] = useState<string | null>('role-accountant')
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [roleName, setRoleName] = useState('')
  const [roleCode, setRoleCode] = useState('')
  const [roleDescription, setRoleDescription] = useState('')
  const [permissionDraft, setPermissionDraft] = useState<Record<string, Set<string>>>(createPermissionDraft())
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    if (!isTauri) {
      setRoles(clonePreviewRoles())
      setUsers(PREVIEW_USERS.map((user) => ({ ...user, company_ids: [...user.company_ids] })))
      setLoading(false)
      return
    }

    try {
      const [rolesData, usersData] = await Promise.all([
        invoke<RoleWithPermissions[]>('get_roles'),
        invoke<UserWithRole[]>('get_users_with_roles', {
          companyId: scope === 'company' ? selectedCompanyId || undefined : undefined,
        }),
      ])
      setRoles(rolesData)
      setUsers(usersData)
    } catch (error) {
      console.error('Failed to load roles:', error)
      setNotice('权限数据加载失败，请检查本机数据库与当前登录身份。')
    } finally {
      setLoading(false)
    }
  }, [scope, selectedCompanyId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const selectedRole = useMemo(() => roles.find((item) => item.role.id === editingRoleId) ?? null, [editingRoleId, roles])
  const isEditorOpen = showEditor || Boolean(selectedRole)
  const assignmentCount = users.filter((user) => user.role_id).length

  const openNewRole = () => {
    setEditingRoleId(null)
    setRoleName('')
    setRoleCode('')
    setRoleDescription('')
    setPermissionDraft(createPermissionDraft())
    setShowEditor(true)
  }

  const openEditRole = (role: RoleWithPermissions) => {
    setEditingRoleId(role.role.id)
    setRoleName(role.role.name)
    setRoleCode(role.role.code)
    setRoleDescription(role.role.description)
    setPermissionDraft(createPermissionDraft(role.permissions))
    setShowEditor(false)
  }

  const closeEditor = () => {
    setShowEditor(false)
    setEditingRoleId(null)
    setPermissionDraft(createPermissionDraft())
  }

  const togglePermission = (resource: string, action: string) => {
    setPermissionDraft((previous) => {
      const next = { ...previous }
      const values = new Set(next[resource] || [])
      if (values.has(action)) values.delete(action)
      else values.add(action)
      next[resource] = values
      return next
    })
  }

  const draftPermissions = () => RESOURCES.flatMap((resource) =>
    [...(permissionDraft[resource.key] || [])].map((action) => ({ resource: resource.key, action })),
  )

  const saveRole = async () => {
    const name = roleName.trim()
    const code = roleCode.trim().toLowerCase().replace(/\s+/g, '_')
    if (!name || !code) {
      setNotice('请填写角色名称和角色编码。')
      return
    }
    const permissions = draftPermissions()

    if (!isTauri) {
      if (selectedRole) {
        setRoles((current) => current.map((item) => item.role.id === selectedRole.role.id
          ? { ...item, role: { ...item.role, name, code, description: roleDescription.trim() }, permissions: permissions.map((item) => previewPermission(selectedRole.role.id, item.resource, item.action)) }
          : item))
        setNotice(`已在预览数据中更新“${name}”。`)
      } else {
        const id = `preview-role-${Date.now()}`
        setRoles((current) => [...current, {
          role: { id, name, code, description: roleDescription.trim() || '未填写角色说明。', is_system: 0, created_at: new Date().toISOString() },
          permissions: permissions.map((item) => previewPermission(id, item.resource, item.action)),
        }])
        setNotice(`已在预览数据中新增“${name}”。`)
      }
      closeEditor()
      return
    }

    try {
      if (selectedRole) {
        await invoke('update_role', { input: { id: selectedRole.role.id, name, description: roleDescription.trim(), permissions } })
      } else {
        await invoke('create_role', { input: { name, code, description: roleDescription.trim(), permissions } })
      }
      closeEditor()
      await loadData()
      setNotice(selectedRole ? '角色权限已保存。' : '角色已创建。')
    } catch (error) {
      console.error('Failed to save role:', error)
      setNotice('角色保存失败，请检查角色编码是否重复。')
    }
  }

  const deleteRole = async (role: RoleWithPermissions) => {
    if (role.role.is_system === 1 || !confirm(`确定删除“${role.role.name}”吗？已分配成员将需要重新授权。`)) return
    if (!isTauri) {
      setRoles((current) => current.filter((item) => item.role.id !== role.role.id))
      setUsers((current) => current.map((user) => user.role_id === role.role.id ? { ...user, role_id: null, role_name: null } : user))
      setNotice(`已从预览数据中删除“${role.role.name}”。`)
      return
    }
    try {
      await invoke('delete_role', { id: role.role.id })
      await loadData()
      setNotice('角色已删除。')
    } catch (error) {
      console.error('Failed to delete role:', error)
      setNotice('角色删除失败，该角色可能仍被成员引用。')
    }
  }

  const updateUserRole = async (user: UserWithRole, roleId: string) => {
    const nextRole = roles.find((item) => item.role.id === roleId)
    if (!nextRole) return
    if (!isTauri) {
      setUsers((current) => current.map((item) => item.id === user.id ? {
        ...item,
        role_id: roleId,
        role_name: nextRole.role.name,
        role: nextRole.role.code,
      } : item))
      setNotice(`已在预览数据中更新 ${user.real_name} 的角色。`)
      return
    }
    try {
      await invoke('update_user_role', { input: { userId: user.id, roleId } })
      await loadData()
      setNotice('成员角色已更新。')
    } catch (error) {
      console.error('Failed to update user role:', error)
      setNotice('成员授权失败，请稍后重试。')
    }
  }

  if (!canView('users')) {
    return <div className="flex h-64 items-center justify-center text-sm text-slate-500">您没有权限查看机构成员与角色配置。</div>
  }

  return (
    <div className="min-w-0 space-y-3 px-3 pt-3 text-slate-900 dark:text-slate-100">
      <section className="border border-slate-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-neutral-700">
          <div className="flex min-w-0 items-center gap-2">
            <Shield className="h-4 w-4 shrink-0 text-[#1f65a7] dark:text-blue-300" />
            <div className="min-w-0">
              <h1 className="text-sm font-semibold">机构角色与成员授权</h1>
              <p className="truncate text-xs text-slate-500 dark:text-neutral-400">维护跨客户账套的操作边界；账套内资料权限仍由角色和数据归属共同控制。</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={loadData} className="inline-flex h-8 items-center gap-1 border border-slate-300 px-2 text-xs text-slate-700 hover:border-[#1f65a7] hover:text-[#1f65a7] dark:border-neutral-600 dark:text-neutral-200" title="刷新角色与成员数据">
              <RefreshCw className="h-3.5 w-3.5" /> 刷新
            </button>
            {canCreate('users') && <button type="button" onClick={openNewRole} className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-2.5 text-xs font-medium text-white hover:bg-[#19568e] dark:bg-blue-600 dark:hover:bg-blue-500"><Plus className="h-3.5 w-3.5" /> 新增角色</button>}
          </div>
        </div>

        <div className="grid border-b border-slate-200 sm:grid-cols-3 dark:border-neutral-700">
          {[
            ['角色数量', String(roles.length), Shield],
            ['已授权成员', String(assignmentCount), Users],
            ['高权限角色', String(roles.filter((item) => item.role.is_system === 1).length), KeyRound],
          ].map(([label, value, Icon]) => {
            const StatIcon = Icon as typeof Shield
            return <div key={label as string} className="flex h-16 items-center gap-2 border-b border-slate-200 px-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 dark:border-neutral-700"><StatIcon className="h-4 w-4 text-[#1f65a7] dark:text-blue-300" /><div><p className="text-xs text-slate-500 dark:text-neutral-400">{label as string}</p><p className="mt-0.5 text-lg font-semibold tabular-nums">{value as string}</p></div></div>
          })}
        </div>

        <div className="flex h-9 items-end gap-1 border-b border-slate-200 px-3 dark:border-neutral-700">
          <button type="button" onClick={() => setActiveTab('roles')} className={`h-9 border-b-2 px-2.5 text-xs font-medium ${activeTab === 'roles' ? 'border-[#1f65a7] text-[#1f65a7] dark:border-blue-400 dark:text-blue-300' : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white'}`}>角色与权限矩阵</button>
          <button type="button" onClick={() => setActiveTab('users')} className={`h-9 border-b-2 px-2.5 text-xs font-medium ${activeTab === 'users' ? 'border-[#1f65a7] text-[#1f65a7] dark:border-blue-400 dark:text-blue-300' : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white'}`}>成员授权</button>
        </div>
      </section>

      {notice && <div className="flex items-center justify-between border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-blue-900 dark:bg-neutral-800 dark:text-blue-200"><span>{notice}</span><button type="button" onClick={() => setNotice(null)} title="关闭提示"><X className="h-3.5 w-3.5" /></button></div>}

      {loading ? <div className="flex h-40 items-center justify-center border border-slate-200 bg-white text-sm text-slate-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">正在加载角色与成员授权数据...</div> : activeTab === 'roles' ? (
        <section className="overflow-hidden border border-slate-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex h-9 items-center justify-between border-b border-slate-200 px-3 dark:border-neutral-700"><h2 className="text-sm font-semibold">角色清单</h2><span className="text-xs text-slate-500 dark:text-neutral-400">点击角色查看权限矩阵与生效范围</span></div>
          <div className="overflow-x-auto">
            <table className="min-w-[860px] w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300"><tr><th className="w-9 px-3 py-2"></th><th className="min-w-48 px-3 py-2 font-medium">角色</th><th className="min-w-72 px-3 py-2 font-medium">职责范围</th><th className="px-3 py-2 font-medium">权限项</th><th className="px-3 py-2 font-medium">类型</th><th className="px-3 py-2 text-right font-medium">操作</th></tr></thead>
              <tbody>
                {roles.map((item) => {
                  const expanded = expandedRole === item.role.id
                  return <RoleRow key={item.role.id} role={item} expanded={expanded} canEdit={canEdit('users')} canDelete={canDelete('users')} onToggle={() => setExpandedRole(expanded ? null : item.role.id)} onEdit={() => openEditRole(item)} onDelete={() => deleteRole(item)} />
                })}
              </tbody>
            </table>
          </div>
          {!roles.length && <div className="px-3 py-10 text-center text-sm text-slate-500 dark:text-neutral-400">当前没有可用角色，请先新增角色并配置权限。</div>}
        </section>
      ) : (
        <section className="overflow-hidden border border-slate-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex h-9 items-center justify-between border-b border-slate-200 px-3 dark:border-neutral-700"><h2 className="text-sm font-semibold">成员授权</h2><span className="text-xs text-slate-500 dark:text-neutral-400">角色变更将写入机构操作留痕；高风险权限须由管理员复核。</span></div>
          <div className="overflow-x-auto"><table className="min-w-[760px] w-full text-left text-xs"><thead className="bg-slate-50 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300"><tr><th className="px-3 py-2 font-medium">成员</th><th className="px-3 py-2 font-medium">登录账号</th><th className="px-3 py-2 font-medium">可见账套</th><th className="px-3 py-2 font-medium">当前角色</th><th className="px-3 py-2 text-right font-medium">变更授权</th></tr></thead><tbody>{users.map((user) => <tr key={user.id} className="border-t border-slate-100 hover:bg-slate-50 dark:border-neutral-800 dark:hover:bg-neutral-800"><td className="px-3 py-2.5 font-medium">{user.real_name}</td><td className="px-3 py-2.5 font-mono text-slate-500 dark:text-neutral-400">{user.username}</td><td className="px-3 py-2.5">{user.company_ids.includes('all') ? '全部客户账套' : `${user.company_ids.length} 个账套`}</td><td className="px-3 py-2.5"><span className="inline-flex border border-slate-200 px-1.5 py-0.5 text-slate-700 dark:border-neutral-600 dark:text-neutral-200">{user.role_name || user.role || '未分配'}</span></td><td className="px-3 py-2.5 text-right">{canEdit('users') ? <select value={user.role_id || ''} onChange={(event) => updateUserRole(user, event.target.value)} className="h-7 min-w-28 border border-slate-300 bg-white px-2 text-xs text-slate-700 dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-100" title={`为${user.real_name}分配角色`}><option value="">选择角色</option>{roles.map((role) => <option key={role.role.id} value={role.role.id}>{role.role.name}</option>)}</select> : <span className="text-slate-400">无编辑权限</span>}</td></tr>)}</tbody></table></div>
          {!users.length && <div className="px-3 py-10 text-center text-sm text-slate-500 dark:text-neutral-400">当前没有机构成员记录。</div>}
        </section>
      )}

      {isEditorOpen && <RoleEditor isEditing={Boolean(selectedRole)} name={roleName} code={roleCode} description={roleDescription} permissions={permissionDraft} onName={setRoleName} onCode={setRoleCode} onDescription={setRoleDescription} onToggle={togglePermission} onCancel={closeEditor} onSave={saveRole} />}
    </div>
  )
}

function RoleRow({ role, expanded, canEdit, canDelete, onToggle, onEdit, onDelete }: { role: RoleWithPermissions; expanded: boolean; canEdit: boolean; canDelete: boolean; onToggle: () => void; onEdit: () => void; onDelete: () => void }) {
  return <>
    <tr className="border-t border-slate-100 hover:bg-slate-50 dark:border-neutral-800 dark:hover:bg-neutral-800">
      <td className="px-3 py-2.5"><button type="button" onClick={onToggle} className="inline-flex h-5 w-5 items-center justify-center text-slate-500 hover:text-[#1f65a7] dark:text-neutral-400 dark:hover:text-blue-300" title={expanded ? '收起权限矩阵' : '展开权限矩阵'}><ChevronRight className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`} /></button></td>
      <td className="px-3 py-2.5"><div className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-[#1f65a7] dark:text-blue-300" /><div><p className="font-medium">{role.role.name}</p><p className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-neutral-400">{role.role.code}</p></div></div></td>
      <td className="px-3 py-2.5 text-slate-600 dark:text-neutral-300">{role.role.description || '未填写角色说明。'}</td>
      <td className="px-3 py-2.5 tabular-nums">{getPermissionCount(role)} 项</td>
      <td className="px-3 py-2.5">{role.role.is_system === 1 ? <span className="border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-amber-700 dark:border-amber-800 dark:bg-neutral-800 dark:text-amber-300">系统角色</span> : <span className="border border-slate-200 px-1.5 py-0.5 text-slate-600 dark:border-neutral-600 dark:text-neutral-300">自定义</span>}</td>
      <td className="px-3 py-2.5 text-right">{canEdit && role.role.is_system !== 1 && <button type="button" onClick={onEdit} className="mr-2 inline-flex h-7 items-center gap-1 border border-slate-300 px-2 text-xs text-slate-700 hover:border-[#1f65a7] hover:text-[#1f65a7] dark:border-neutral-600 dark:text-neutral-200"><Edit2 className="h-3.5 w-3.5" /> 编辑</button>}{canDelete && role.role.is_system !== 1 && <button type="button" onClick={onDelete} className="inline-flex h-7 items-center gap-1 border border-red-200 px-2 text-xs text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-neutral-800"><Trash2 className="h-3.5 w-3.5" /> 删除</button>}</td>
    </tr>
    {expanded && <tr className="border-t border-slate-100 bg-slate-50 dark:border-neutral-800 dark:bg-neutral-950"><td colSpan={6} className="p-3"><div className="mb-2 flex items-center gap-2"><KeyRound className="h-3.5 w-3.5 text-[#1f65a7] dark:text-blue-300" /><h3 className="text-xs font-semibold">权限矩阵</h3><span className="text-xs text-slate-500 dark:text-neutral-400">当前角色可执行的业务动作</span></div><PermissionMatrix permissions={createPermissionDraft(role.permissions)} readOnly /></td></tr>}
  </>
}

function PermissionMatrix({ permissions, onToggle, readOnly }: { permissions: Record<string, Set<string>>; onToggle?: (resource: string, action: string) => void; readOnly: boolean }) {
  return (
    <div className="overflow-x-auto border border-slate-200 dark:border-neutral-700">
      <table className="min-w-[680px] w-full text-xs">
        <thead className="bg-white text-slate-500 dark:bg-neutral-900 dark:text-neutral-400">
          <tr>
            <th className="w-36 px-2 py-2 text-left font-medium">业务模块</th>
            {ACTIONS.map((action) => <th key={action.key} className="px-2 py-2 text-center font-medium">{action.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {RESOURCES.map((resource) => (
            <tr key={resource.key} className="border-t border-slate-100 dark:border-neutral-800">
              <td className="px-2 py-2 font-medium text-slate-700 dark:text-neutral-200">{resource.label}</td>
              {ACTIONS.map((action) => {
                const checked = permissions[resource.key]?.has(action.key) ?? false
                return (
                  <td key={action.key} className="px-2 py-2 text-center">
                    {readOnly ? (
                      <span className={`inline-flex h-4 w-4 items-center justify-center border ${checked ? 'border-green-500 bg-green-500 text-white' : 'border-slate-300 dark:border-neutral-600'}`}>
                        {checked && <Check className="h-3 w-3" />}
                      </span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggle?.(resource.key, action.key)}
                        title={`${resource.label} - ${action.label}`}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-[#1f65a7] focus:ring-[#1f65a7] dark:border-neutral-600"
                      />
                    )}
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

function RoleEditor({ isEditing, name, code, description, permissions, onName, onCode, onDescription, onToggle, onCancel, onSave }: { isEditing: boolean; name: string; code: string; description: string; permissions: Record<string, Set<string>>; onName: (value: string) => void; onCode: (value: string) => void; onDescription: (value: string) => void; onToggle: (resource: string, action: string) => void; onCancel: () => void; onSave: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label={isEditing ? '编辑角色权限' : '新增角色'}><section className="max-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-auto border border-slate-300 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900"><div className="flex h-11 items-center justify-between border-b border-slate-200 px-4 dark:border-neutral-700"><div><h2 className="text-sm font-semibold">{isEditing ? '编辑角色权限' : '新增机构角色'}</h2><p className="mt-0.5 text-xs text-slate-500 dark:text-neutral-400">权限变更应经过机构内部审批；涉及申报、删除和账期操作须保留审计记录。</p></div><button type="button" onClick={onCancel} className="text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white" title="关闭"><X className="h-4 w-4" /></button></div><div className="space-y-3 p-4"><div className="grid gap-3 md:grid-cols-[1fr_1fr_2fr]"><label className="grid gap-1 text-xs text-slate-600 dark:text-neutral-300">角色名称 *<input value={name} onChange={(event) => onName(event.target.value)} className="h-8 border border-slate-300 bg-white px-2 text-sm text-slate-900 dark:border-neutral-600 dark:bg-neutral-950 dark:text-white" placeholder="例如：税务复核员" /></label><label className="grid gap-1 text-xs text-slate-600 dark:text-neutral-300">角色编码 *<input value={code} onChange={(event) => onCode(event.target.value)} className="h-8 border border-slate-300 bg-white px-2 font-mono text-sm text-slate-900 dark:border-neutral-600 dark:bg-neutral-950 dark:text-white" placeholder="tax_reviewer" /></label><label className="grid gap-1 text-xs text-slate-600 dark:text-neutral-300">职责说明<input value={description} onChange={(event) => onDescription(event.target.value)} className="h-8 border border-slate-300 bg-white px-2 text-sm text-slate-900 dark:border-neutral-600 dark:bg-neutral-950 dark:text-white" placeholder="描述可操作的客户、模块和职责边界" /></label></div><div><div className="mb-2 flex items-center gap-2"><KeyRound className="h-4 w-4 text-[#1f65a7] dark:text-blue-300" /><h3 className="text-sm font-semibold">权限矩阵</h3><span className="text-xs text-slate-500 dark:text-neutral-400">至少配置查看权限后再分配给成员。</span></div><PermissionMatrix permissions={permissions} onToggle={onToggle} readOnly={false} /></div></div><div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-neutral-700"><button type="button" onClick={onCancel} className="h-8 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800">取消</button><button type="button" onClick={onSave} className="h-8 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#19568e] dark:bg-blue-600 dark:hover:bg-blue-500">保存角色</button></div></section></div>
}

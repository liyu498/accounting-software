import { useAuthStore } from '../stores/authStore'
import { invoke } from './tauri'

export type Resource =
  | 'vouchers'
  | 'invoices'
  | 'reports'
  | 'settings'
  | 'ledger'
  | 'period'
  | 'users'
  | 'inventory'
  | 'bank'

export type Action =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'approve'
  | 'export'
  | 'print'
  | 'import'
  | 'close'

const ROLE_PERMISSIONS: Record<string, Record<string, Action[]>> = {
  admin: {
    vouchers: ['view', 'create', 'edit', 'delete', 'approve', 'export', 'print', 'import'],
    invoices: ['view', 'create', 'edit', 'delete', 'export'],
    reports: ['view', 'export', 'print'],
    settings: ['view', 'edit'],
    ledger: ['view', 'export', 'print'],
    period: ['close'],
    users: ['view', 'create', 'edit', 'delete'],
    inventory: ['view', 'create', 'edit', 'delete'],
    bank: ['view', 'create', 'edit', 'delete'],
  },
  manager: {
    vouchers: ['view', 'create', 'edit', 'approve', 'export', 'print'],
    invoices: ['view', 'create', 'edit', 'delete'],
    reports: ['view', 'export', 'print'],
    settings: ['view', 'edit'],
    ledger: ['view', 'export', 'print'],
    period: ['close'],
    users: ['view'],
    inventory: ['view', 'create', 'edit', 'delete'],
    bank: ['view', 'create', 'edit'],
  },
  accountant: {
    vouchers: ['view', 'create', 'edit', 'export'],
    invoices: ['view', 'create', 'edit'],
    reports: ['view', 'export'],
    settings: ['view'],
    ledger: ['view', 'export'],
    users: [],
    inventory: ['view', 'create', 'edit'],
    bank: ['view'],
  },
  viewer: {
    vouchers: ['view'],
    invoices: ['view'],
    reports: ['view'],
    settings: ['view'],
    ledger: ['view'],
    users: [],
    inventory: ['view'],
    bank: ['view'],
  },
}

export function usePermission() {
  const { user } = useAuthStore()
  const role = user?.role || 'viewer'

  const hasPermission = (resource: Resource, action: Action): boolean => {
    const permissions = ROLE_PERMISSIONS[role]
    if (!permissions) return false
    const actions = permissions[resource]
    return actions ? actions.includes(action) : false
  }

  const canView = (resource: Resource): boolean => hasPermission(resource, 'view')
  const canCreate = (resource: Resource): boolean => hasPermission(resource, 'create')
  const canEdit = (resource: Resource): boolean => hasPermission(resource, 'edit')
  const canDelete = (resource: Resource): boolean => hasPermission(resource, 'delete')
  const canApprove = (resource: Resource): boolean => hasPermission(resource, 'approve')
  const canExport = (resource: Resource): boolean => hasPermission(resource, 'export')
  const canPrint = (resource: Resource): boolean => hasPermission(resource, 'print')
  const canImport = (resource: Resource): boolean => hasPermission(resource, 'import')

  const isAdmin = role === 'admin'

  return {
    role,
    hasPermission,
    canView,
    canCreate,
    canEdit,
    canDelete,
    canApprove,
    canExport,
    canPrint,
    canImport,
    isAdmin,
  }
}

export async function checkPermissionRemote(
  userId: string,
  resource: string,
  action: string,
): Promise<boolean> {
  try {
    return await invoke<boolean>('check_permission', { userId, resource, action })
  } catch {
    return false
  }
}

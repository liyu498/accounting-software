import { useAuthStore } from '../stores/authStore'
import { invoke } from './tauri'

export type Resource =
  | 'vouchers'
  | 'invoices'
  | 'tax'
  | 'reports'
  | 'settings'
  | 'ledger'
  | 'period'
  | 'users'
  | 'inventory'
  | 'payroll'
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
    tax: ['view', 'create', 'edit', 'delete', 'approve', 'export', 'print'],
    reports: ['view', 'export', 'print'],
    settings: ['view', 'edit'],
    ledger: ['view', 'export', 'print'],
    period: ['close'],
    users: ['view', 'create', 'edit', 'delete'],
    inventory: ['view', 'create', 'edit', 'delete'],
    payroll: ['view', 'create', 'edit', 'delete', 'approve', 'export', 'print'],
    bank: ['view', 'create', 'edit', 'delete'],
  },
  manager: {
    vouchers: ['view', 'create', 'edit', 'approve', 'export', 'print'],
    invoices: ['view', 'create', 'edit', 'delete'],
    tax: ['view', 'create', 'edit', 'approve', 'export', 'print'],
    reports: ['view', 'export', 'print'],
    settings: ['view', 'edit'],
    ledger: ['view', 'export', 'print'],
    period: ['close'],
    users: ['view'],
    inventory: ['view', 'create', 'edit', 'delete'],
    payroll: ['view', 'create', 'edit', 'export'],
    bank: ['view', 'create', 'edit'],
  },
  accountant: {
    vouchers: ['view', 'create', 'edit', 'export'],
    invoices: ['view', 'create', 'edit'],
    tax: ['view', 'create', 'edit', 'export'],
    reports: ['view', 'export'],
    settings: ['view'],
    ledger: ['view', 'export'],
    users: [],
    inventory: ['view', 'create', 'edit'],
    payroll: ['view', 'create', 'edit', 'export'],
    bank: ['view'],
  },
  viewer: {
    vouchers: ['view'],
    invoices: ['view'],
    tax: ['view'],
    reports: ['view'],
    settings: ['view'],
    ledger: ['view'],
    users: [],
    inventory: ['view'],
    payroll: ['view'],
    bank: ['view'],
  },
}

export function usePermission() {
  const { user } = useAuthStore()
  const role = user?.role || 'viewer'

  const hasPermission = (resource: Resource, action: Action): boolean => {
    const permissions = ROLE_PERMISSIONS[role]
    if (permissions) {
      const actions = permissions[resource]
      return actions ? actions.includes(action) : false
    }
    return Boolean(user?.permissions.some(
      (permission) => permission.resource === resource && permission.action === action,
    ))
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

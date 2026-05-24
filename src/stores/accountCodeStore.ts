import { create } from 'zustand'
import { invoke } from '../lib/tauri'

export interface AccountCode {
  code: string
  company_id: string
  name: string
  account_type: string
  normal_balance: string
  level: number
  parent_code: string | null
  is_detail: number
  is_enabled: number
  has_quantity: number
  default_unit: string | null
  has_auxiliary: number
}

export type AccountType = 'asset' | 'liability' | 'equity' | 'cost' | 'income' | 'expense'

export const accountTypeLabels: Record<string, string> = {
  asset: '资产类',
  liability: '负债类',
  equity: '权益类',
  cost: '成本类',
  income: '收入类',
  expense: '费用类',
}

export const normalBalanceLabels: Record<string, string> = {
  debit: '借方',
  credit: '贷方',
}

interface AccountCodeState {
  accounts: AccountCode[]
  isLoading: boolean
  error: string | null

  fetchAccounts: (companyId: string) => Promise<void>
  fetchAccountsByType: (type: string, companyId: string) => Promise<AccountCode[]>
  fetchDetailAccounts: (companyId: string, parentCode?: string) => Promise<AccountCode[]>
  createAccount: (input: {
    code: string
    company_id: string
    name: string
    account_type: string
    normal_balance?: string
    level: number
    parent_code?: string
    is_detail?: number
    has_quantity?: number
    default_unit?: string
    has_auxiliary?: number
  }) => Promise<AccountCode>
  updateAccount: (
    code: string,
    companyId: string,
    input: {
      name: string
      account_type: string
      normal_balance?: string
      level: number
      parent_code?: string
      is_detail?: number
      has_quantity?: number
      default_unit?: string
      has_auxiliary?: number
    },
  ) => Promise<AccountCode>
  toggleAccount: (code: string, companyId: string) => Promise<AccountCode>
  deleteAccount: (code: string, companyId: string) => Promise<void>
  searchAccounts: (keyword: string, companyId: string) => Promise<AccountCode[]>
  getAccountByCode: (code: string) => AccountCode | undefined
  getSubAccounts: (parentCode: string) => AccountCode[]
  getAccountsByType: (type: string) => AccountCode[]
  getDetailAccounts: () => AccountCode[]
  buildTree: () => TreeNode[]
}

export interface TreeNode {
  code: string
  name: string
  account_type: string
  normal_balance: string
  level: number
  is_detail: number
  is_enabled: number
  children: TreeNode[]
}

export const useAccountCodeStore = create<AccountCodeState>((set, get) => ({
  accounts: [],
  isLoading: false,
  error: null,

  fetchAccounts: async (companyId) => {
    set({ isLoading: true, error: null })
    try {
      const result = await invoke<AccountCode[]>('get_account_codes', { companyId })
      set({ accounts: result, isLoading: false })
    } catch (error) {
      set({ error: String(error), isLoading: false })
    }
  },

  fetchAccountsByType: async (type, companyId) => {
    try {
      return await invoke<AccountCode[]>('get_account_codes_by_type', { accountType: type, companyId })
    } catch (error) {
      set({ error: String(error) })
      return []
    }
  },

  fetchDetailAccounts: async (companyId, parentCode) => {
    try {
      return await invoke<AccountCode[]>('get_detail_account_codes', {
        companyId,
        parentCode: parentCode || undefined,
      })
    } catch (error) {
      set({ error: String(error) })
      return []
    }
  },

  createAccount: async (input) => {
    set({ isLoading: true, error: null })
    try {
      const result = await invoke<AccountCode>('create_account_code', { input })
      set((state) => ({
        accounts: [...state.accounts, result].sort((a, b) =>
          a.code.localeCompare(b.code),
        ),
        isLoading: false,
      }))
      return result
    } catch (error) {
      set({ error: String(error), isLoading: false })
      throw error
    }
  },

  updateAccount: async (code, companyId, input) => {
    set({ isLoading: true, error: null })
    try {
      const result = await invoke<AccountCode>('update_account_code', {
        code,
        companyId,
        input,
      })
      set((state) => ({
        accounts: state.accounts.map((a) =>
          a.code === code ? result : a,
        ),
        isLoading: false,
      }))
      return result
    } catch (error) {
      set({ error: String(error), isLoading: false })
      throw error
    }
  },

  toggleAccount: async (code, companyId) => {
    try {
      const result = await invoke<AccountCode>('toggle_account_code', { code, companyId })
      set((state) => ({
        accounts: state.accounts.map((a) =>
          a.code === code ? result : a,
        ),
      }))
      return result
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  deleteAccount: async (code, companyId) => {
    try {
      await invoke('delete_account_code', { code, companyId })
      set((state) => ({
        accounts: state.accounts.filter((a) => a.code !== code),
      }))
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  searchAccounts: async (keyword, companyId) => {
    try {
      return await invoke<AccountCode[]>('search_account_codes', { keyword, companyId })
    } catch (error) {
      set({ error: String(error) })
      return []
    }
  },

  getAccountByCode: (code) => {
    return get().accounts.find((a) => a.code === code)
  },

  getSubAccounts: (parentCode) => {
    return get().accounts.filter((a) => a.parent_code === parentCode)
  },

  getAccountsByType: (type) => {
    return get().accounts.filter((a) => a.account_type === type && a.is_enabled === 1)
  },

  getDetailAccounts: () => {
    return get().accounts.filter((a) => a.is_detail === 1 && a.is_enabled === 1)
  },

  buildTree: () => {
    const accounts = get().accounts
    const map = new Map<string, TreeNode>()

    for (const a of accounts) {
      map.set(a.code, {
        code: a.code,
        name: a.name,
        account_type: a.account_type,
        normal_balance: a.normal_balance,
        level: a.level,
        is_detail: a.is_detail,
        is_enabled: a.is_enabled,
        children: [],
      })
    }

    const roots: TreeNode[] = []
    for (const a of accounts) {
      const node = map.get(a.code)!
      if (a.parent_code && map.has(a.parent_code)) {
        map.get(a.parent_code)!.children.push(node)
      } else {
        roots.push(node)
      }
    }

    return roots
  },
}))

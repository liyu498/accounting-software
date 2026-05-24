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

interface AccountCodeState {
  accounts: AccountCode[]
  isLoading: boolean
  error: string | null

  fetchAccounts: (companyId: string) => Promise<void>
  fetchAccountsByType: (accountType: string, companyId: string) => Promise<AccountCode[]>
  fetchDetailAccounts: (companyId: string, parentCode?: string) => Promise<AccountCode[]>
  getAccountByCode: (code: string) => AccountCode | undefined
  getSubAccounts: (parentCode: string) => AccountCode[]
  searchAccounts: (keyword: string, companyId: string) => Promise<AccountCode[]>

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
    },
  ) => Promise<AccountCode>

  toggleAccount: (code: string, companyId: string) => Promise<AccountCode>
  deleteAccount: (code: string, companyId: string) => Promise<void>
}

export const useAccountStore = create<AccountCodeState>((set, get) => ({
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

  fetchAccountsByType: async (accountType, companyId) => {
    try {
      return await invoke<AccountCode[]>('get_account_codes_by_type', {
        accountType,
        companyId,
      })
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

  getAccountByCode: (code) => {
    return get().accounts.find((a) => a.code === code)
  },

  getSubAccounts: (parentCode) => {
    return get().accounts.filter((a) => a.parent_code === parentCode)
  },

  searchAccounts: async (keyword, companyId) => {
    try {
      return await invoke<AccountCode[]>('search_account_codes', { keyword, companyId })
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
}))

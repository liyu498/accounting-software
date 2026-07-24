import { create } from 'zustand'
import { invoke } from '../lib/tauri'

export interface AuxiliaryCategory {
  id: string
  company_id: string
  name: string
  code: string
  is_system: number
  sort_order: number
}

export interface AuxiliaryItem {
  id: string
  category_id: string
  company_id: string
  code: string
  name: string
  is_enabled: number
  remarks: string | null
}

export interface AccountAuxiliaryLink {
  id: string
  account_code: string
  company_id: string
  auxiliary_category_id: string
  is_required: number
}

export interface VoucherEntryAuxiliary {
  id: string
  entry_id: string
  auxiliary_category_id: string
  auxiliary_item_id: string
}

export interface AuxiliaryLedgerRow {
  date: string
  voucher_number: string
  summary: string
  direction: string
  amount: number
}

export interface AuxiliaryBalanceRow {
  auxiliary_item_name: string
  auxiliary_item_code: string
  beginning_debit: number
  beginning_credit: number
  period_debit: number
  period_credit: number
  ending_debit: number
  ending_credit: number
}

export interface AccountAuxiliarySetup {
  account_code: string
  account_name: string
  categories: { link_id: string; category_id: string; category_name: string; category_code: string; is_required: number }[]
}

interface AuxiliaryState {
  categories: AuxiliaryCategory[]
  items: AuxiliaryItem[]
  isLoading: boolean
  error: string | null

  // Categories
  fetchCategories: (companyId: string) => Promise<void>
  createCategory: (input: { company_id: string; name: string; code: string; sort_order?: number }) => Promise<AuxiliaryCategory>
  updateCategory: (id: string, input: { company_id: string; name: string; code: string; sort_order?: number }) => Promise<AuxiliaryCategory>
  deleteCategory: (id: string, companyId: string) => Promise<void>

  // Items
  fetchItems: (categoryId: string, companyId: string) => Promise<void>
  fetchAllItems: (companyId: string) => Promise<void>
  createItem: (input: { category_id: string; company_id: string; code: string; name: string; remarks?: string }) => Promise<AuxiliaryItem>
  updateItem: (id: string, input: { category_id: string; company_id: string; code: string; name: string; remarks?: string }) => Promise<AuxiliaryItem>
  deleteItem: (id: string, companyId: string) => Promise<void>
  toggleItem: (id: string, companyId: string) => Promise<void>

  // Links
  fetchAccountLinks: (accountCode: string, companyId: string) => Promise<AccountAuxiliaryLink[]>
  linkAccount: (input: { account_code: string; company_id: string; auxiliary_category_id: string; is_required?: number }) => Promise<void>
  unlinkAccount: (id: string) => Promise<void>

  // Entry auxiliaries
  fetchEntryAuxiliaries: (entryId: string) => Promise<VoucherEntryAuxiliary[]>

  // Ledger
  fetchAuxiliaryLedger: (params: { auxiliary_item_id: string; company_id: string; period_id?: string; start_date?: string; end_date?: string }) => Promise<AuxiliaryLedgerRow[]>
  fetchAuxiliaryBalance: (auxiliaryCategoryId: string, periodId: string, companyId: string) => Promise<AuxiliaryBalanceRow[]>
  fetchAccountSetup: (accountCode: string, companyId: string) => Promise<AccountAuxiliarySetup | null>
}

export const useAuxiliaryStore = create<AuxiliaryState>((set, get) => ({
  categories: [],
  items: [],
  isLoading: false,
  error: null,

  fetchCategories: async (companyId) => {
    set({ isLoading: true, error: null })
    try {
      const result = await invoke<AuxiliaryCategory[]>('get_auxiliary_categories', { companyId })
      set({ categories: result, isLoading: false })
    } catch (error) {
      set({ error: String(error), isLoading: false })
    }
  },

  createCategory: async (input) => {
    set({ isLoading: true, error: null })
    try {
      const result = await invoke<AuxiliaryCategory>('create_auxiliary_category', { input })
      set((s) => ({ categories: [...s.categories, result], isLoading: false }))
      return result
    } catch (error) {
      set({ error: String(error), isLoading: false })
      throw error
    }
  },

  updateCategory: async (id, input) => {
    set({ isLoading: true, error: null })
    try {
      const result = await invoke<AuxiliaryCategory>('update_auxiliary_category', { id, input })
      set((s) => ({
        categories: s.categories.map((c) => (c.id === id ? result : c)),
        isLoading: false,
      }))
      return result
    } catch (error) {
      set({ error: String(error), isLoading: false })
      throw error
    }
  },

  deleteCategory: async (id, companyId) => {
    try {
      await invoke('delete_auxiliary_category', { id, companyId })
      set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }))
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  fetchItems: async (categoryId, companyId) => {
    set({ isLoading: true, error: null })
    try {
      const result = await invoke<AuxiliaryItem[]>('get_auxiliary_items', { categoryId, companyId })
      set({ items: result, isLoading: false })
    } catch (error) {
      set({ error: String(error), isLoading: false })
    }
  },

  fetchAllItems: async (companyId) => {
    set({ isLoading: true, error: null })
    try {
      const result = await invoke<AuxiliaryItem[]>('get_all_auxiliary_items', { companyId })
      set({ items: result, isLoading: false })
    } catch (error) {
      set({ error: String(error), isLoading: false })
    }
  },

  createItem: async (input) => {
    set({ isLoading: true, error: null })
    try {
      const result = await invoke<AuxiliaryItem>('create_auxiliary_item', { input })
      set((s) => ({ items: [...s.items, result], isLoading: false }))
      return result
    } catch (error) {
      set({ error: String(error), isLoading: false })
      throw error
    }
  },

  updateItem: async (id, input) => {
    set({ isLoading: true, error: null })
    try {
      const result = await invoke<AuxiliaryItem>('update_auxiliary_item', { id, input })
      set((s) => ({
        items: s.items.map((i) => (i.id === id ? result : i)),
        isLoading: false,
      }))
      return result
    } catch (error) {
      set({ error: String(error), isLoading: false })
      throw error
    }
  },

  deleteItem: async (id, companyId) => {
    try {
      await invoke('delete_auxiliary_item', { id, companyId })
      set((s) => ({ items: s.items.filter((i) => i.id !== id) }))
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  toggleItem: async (id, companyId) => {
    try {
      await invoke('toggle_auxiliary_item', { id, companyId })
      set((s) => ({
        items: s.items.map((i) =>
          i.id === id ? { ...i, is_enabled: i.is_enabled === 1 ? 0 : 1 } : i,
        ),
      }))
    } catch (error) {
      set({ error: String(error) })
    }
  },

  fetchAccountLinks: async (accountCode, companyId) => {
    try {
      return await invoke<AccountAuxiliaryLink[]>('get_account_auxiliary_links', { accountCode, companyId })
    } catch (error) {
      set({ error: String(error) })
      return []
    }
  },

  linkAccount: async (input) => {
    try {
      await invoke('link_account_auxiliary', { input })
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  unlinkAccount: async (id) => {
    try {
      await invoke('unlink_account_auxiliary', { id })
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  fetchEntryAuxiliaries: async (entryId) => {
    try {
      return await invoke<VoucherEntryAuxiliary[]>('get_voucher_entry_auxiliaries', { entryId })
    } catch (error) {
      set({ error: String(error) })
      return []
    }
  },

  fetchAuxiliaryLedger: async (params) => {
    try {
      return await invoke<AuxiliaryLedgerRow[]>('get_auxiliary_ledger', params)
    } catch (error) {
      set({ error: String(error) })
      return []
    }
  },

  fetchAuxiliaryBalance: async (auxiliaryCategoryId, periodId, companyId) => {
    try {
      return await invoke<AuxiliaryBalanceRow[]>('get_auxiliary_balance', {
        auxiliaryCategoryId,
        periodId,
        companyId,
      })
    } catch (error) {
      set({ error: String(error) })
      return []
    }
  },

  fetchAccountSetup: async (accountCode, companyId) => {
    try {
      return await invoke<AccountAuxiliarySetup | null>('get_account_auxiliary_setup', { accountCode, companyId })
    } catch (error) {
      set({ error: String(error) })
      return null
    }
  },
}))

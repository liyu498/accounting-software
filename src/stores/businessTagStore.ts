import { create } from 'zustand'
import { invoke } from '../lib/tauri'

export interface BusinessTag {
  id: string
  company_id: string
  name: string
  applicable_modules: string
  color_name: string
  auto_rule: string | null
  usage_count: number
  remarks: string | null
  is_enabled: number
  created_at: string
  updated_at: string
}

export interface BusinessTagInput {
  companyId: string
  name: string
  applicableModules: string
  colorName: string
  autoRule?: string
  remarks?: string
  isEnabled?: boolean
}

interface BusinessTagState {
  businessTags: BusinessTag[]
  invoiceTagIds: Record<string, string[]>
  voucherTagIds: Record<string, string[]>
  bankTransactionTagIds: Record<string, string[]>
  isLoading: boolean
  error: string | null
  fetchBusinessTags: (companyId: string) => Promise<void>
  createBusinessTag: (input: BusinessTagInput) => Promise<BusinessTag>
  updateBusinessTag: (id: string, input: BusinessTagInput) => Promise<BusinessTag>
  deleteBusinessTag: (id: string, companyId: string) => Promise<void>
  fetchInvoiceTagIds: (invoiceId: string, companyId: string) => Promise<string[]>
  replaceInvoiceTags: (invoiceId: string, companyId: string, tagIds: string[]) => Promise<void>
  fetchVoucherTagIds: (voucherId: string, companyId: string) => Promise<string[]>
  replaceVoucherTags: (voucherId: string, companyId: string, tagIds: string[]) => Promise<void>
  fetchBankTransactionTagIds: (bankTransactionId: string, companyId: string) => Promise<string[]>
  replaceBankTransactionTags: (bankTransactionId: string, companyId: string, tagIds: string[]) => Promise<void>
}

const toCommandInput = (input: BusinessTagInput) => ({
  company_id: input.companyId, name: input.name, applicable_modules: input.applicableModules,
  color_name: input.colorName, auto_rule: input.autoRule, remarks: input.remarks,
  is_enabled: input.isEnabled === undefined ? undefined : input.isEnabled ? 1 : 0,
})

export const useBusinessTagStore = create<BusinessTagState>((set) => ({
  businessTags: [], invoiceTagIds: {}, voucherTagIds: {}, bankTransactionTagIds: {}, isLoading: false, error: null,
  fetchBusinessTags: async (companyId) => {
    set({ isLoading: true, error: null })
    try { set({ businessTags: await invoke<BusinessTag[]>('get_business_tags', { companyId }), isLoading: false }) }
    catch (error) { set({ error: String(error), isLoading: false }) }
  },
  createBusinessTag: async (input) => {
    try { const tag = await invoke<BusinessTag>('create_business_tag', { input: toCommandInput(input) }); set((state) => ({ businessTags: [...state.businessTags, tag] })); return tag }
    catch (error) { set({ error: String(error) }); throw error }
  },
  updateBusinessTag: async (id, input) => {
    try { const tag = await invoke<BusinessTag>('update_business_tag', { id, input: toCommandInput(input) }); set((state) => ({ businessTags: state.businessTags.map((item) => item.id === id ? tag : item) })); return tag }
    catch (error) { set({ error: String(error) }); throw error }
  },
  deleteBusinessTag: async (id, companyId) => {
    try { await invoke('delete_business_tag', { id, companyId }); set((state) => ({ businessTags: state.businessTags.filter((item) => item.id !== id) })) }
    catch (error) { set({ error: String(error) }); throw error }
  },
  fetchInvoiceTagIds: async (invoiceId, companyId) => {
    try {
      const tagIds = await invoke<string[]>('get_invoice_tag_ids', { invoiceId, companyId })
      set((state) => ({ invoiceTagIds: { ...state.invoiceTagIds, [invoiceId]: tagIds } }))
      return tagIds
    } catch (error) { set({ error: String(error) }); return [] }
  },
  replaceInvoiceTags: async (invoiceId, companyId, tagIds) => {
    try {
      const savedTagIds = await invoke<string[]>('replace_invoice_tags', { invoiceId, companyId, tagIds })
      set((state) => ({ invoiceTagIds: { ...state.invoiceTagIds, [invoiceId]: savedTagIds } }))
    } catch (error) { set({ error: String(error) }); throw error }
  },
  fetchVoucherTagIds: async (voucherId, companyId) => {
    try {
      const tagIds = await invoke<string[]>('get_voucher_tag_ids', { voucherId, companyId })
      set((state) => ({ voucherTagIds: { ...state.voucherTagIds, [voucherId]: tagIds } }))
      return tagIds
    } catch (error) { set({ error: String(error) }); return [] }
  },
  replaceVoucherTags: async (voucherId, companyId, tagIds) => {
    try {
      const savedTagIds = await invoke<string[]>('replace_voucher_tags', { voucherId, companyId, tagIds })
      set((state) => ({ voucherTagIds: { ...state.voucherTagIds, [voucherId]: savedTagIds } }))
    } catch (error) { set({ error: String(error) }); throw error }
  },
  fetchBankTransactionTagIds: async (bankTransactionId, companyId) => {
    try {
      const tagIds = await invoke<string[]>('get_bank_transaction_tag_ids', { bankTransactionId, companyId })
      set((state) => ({ bankTransactionTagIds: { ...state.bankTransactionTagIds, [bankTransactionId]: tagIds } }))
      return tagIds
    } catch (error) { set({ error: String(error) }); return [] }
  },
  replaceBankTransactionTags: async (bankTransactionId, companyId, tagIds) => {
    try {
      const savedTagIds = await invoke<string[]>('replace_bank_transaction_tags', { bankTransactionId, companyId, tagIds })
      set((state) => ({ bankTransactionTagIds: { ...state.bankTransactionTagIds, [bankTransactionId]: savedTagIds } }))
    } catch (error) { set({ error: String(error) }); throw error }
  },
}))

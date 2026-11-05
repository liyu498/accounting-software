import { create } from 'zustand'
import { invoke } from '../lib/tauri'
import { usePeriodStore } from './periodStore'

export interface Voucher {
  id: string
  company_id: string
  period_id: string
  voucher_word_id: string
  voucher_number: string
  sequence_num: number
  voucher_date: string
  summary: string | null
  reference_number: string | null
  attachment_count: number
  status: string
  total_debit: number
  total_credit: number
  version: number
  created_by: string | null
  created_at: string | null
  modified_by: string | null
  modified_at: string | null
  approved_by: string | null
  approved_at: string | null
  reversed_by: string | null
  reversed_at: string | null
  reversal_of_id: string | null
  is_system: number
  is_settlement: number
  settlement_rule_id: string | null
  is_deleted: number
  deleted_at: string | null
  entries: VoucherEntry[]
}

export interface VoucherEntry {
  id: string
  voucher_id: string
  line_num: number
  account_code: string
  account_name: string
  direction: string
  amount: number
  summary: string | null
  auxiliary_type: string | null
  auxiliary_id: string | null
  auxiliary_items?: {
    auxiliary_category_id: string
    auxiliary_item_id: string
  }[]
  doc_number: string | null
  quantity: number | null
  unit_price: number | null
  unit: string | null
  currency_id: string | null
  exchange_rate: number | null
  created_at: string
}

export interface VoucherLog {
  id: string
  voucher_id: string
  operation_type: string
  before_data: string | null
  after_data: string | null
  operator_id: string | null
  created_at: string
}

interface VoucherListResponse {
  vouchers: {
    id: string
    company_id: string
    period_id: string
    voucher_word_id: string
    voucher_number: string
    sequence_num: number
    voucher_date: string
    summary: string | null
    reference_number: string | null
    attachment_count: number
    status: string
    total_debit: number
    total_credit: number
    version: number
    created_by: string | null
    created_at: string | null
    modified_by: string | null
    modified_at: string | null
    approved_by: string | null
    approved_at: string | null
    reversed_by: string | null
    reversed_at: string | null
    reversal_of_id: string | null
    is_system: number
    is_settlement: number
    settlement_rule_id: string | null
    is_deleted: number
    deleted_at: string | null
    entries: VoucherEntry[]
  }[]
  total: number
}

interface VoucherState {
  vouchers: Voucher[]
  totalVouchers: number
  currentPage: number
  pageSize: number
  isLoading: boolean
  error: string | null

  fetchVouchers: (companyId: string) => Promise<void>
  queryVouchers: (filters: {
    company_id: string
    period_id?: string
    start_date?: string
    end_date?: string
    keyword?: string
    status?: string
    voucher_word_id?: string
    account_code?: string
    page?: number
    page_size?: number
  }) => Promise<Voucher[]>
  getVoucher: (id: string, companyId: string) => Promise<Voucher | null>
  getNextVoucherNumber: (periodId: string, companyId: string) => Promise<string>
  suggestSummaries: (accountCode: string, companyId: string) => Promise<string[]>

  addVoucher: (input: {
    company_id: string
    period_id: string
    voucher_word_id: string
    voucher_date: string
    voucher_number?: string
    summary?: string
    reference_number?: string
    attachment_count?: number
    ai_suggestion_id?: string
    bank_transaction_id?: string
    business_source_kind?: string
    business_source_id?: string
    entries: {
      account_code: string
      account_name: string
      direction: string
      amount: number
      summary?: string
      auxiliary_type?: string
      auxiliary_id?: string
      doc_number?: string
      quantity?: number
      unit_price?: number
      unit?: string
      currency_id?: string
      exchange_rate?: number
      auxiliary_items?: {
        auxiliary_category_id: string
        auxiliary_item_id: string
      }[]
    }[]
  }) => Promise<Voucher>

  updateVoucher: (input: {
    id: string
    voucher_date?: string
    summary?: string
    reference_number?: string
    attachment_count?: number
    version?: number
    entries?: {
      account_code: string
      account_name: string
      direction: string
      amount: number
      summary?: string
      auxiliary_type?: string
      auxiliary_id?: string
      doc_number?: string
      quantity?: number
      unit_price?: number
      unit?: string
      currency_id?: string
      exchange_rate?: number
      auxiliary_items?: {
        auxiliary_category_id: string
        auxiliary_item_id: string
      }[]
    }[]
  }, companyId: string) => Promise<Voucher>

  deleteVoucher: (id: string, companyId: string) => Promise<void>

  approveVoucher: (id: string, companyId: string) => Promise<Voucher>
  reverseApproveVoucher: (id: string, companyId: string) => Promise<Voucher>
  reverseVoucher: (id: string, companyId: string) => Promise<Voucher>
  copyVoucher: (id: string, companyId: string) => Promise<Voucher>

  getVoucherEntries: (voucherId: string) => Promise<VoucherEntry[]>
  getVoucherLogs: (voucherId: string) => Promise<VoucherLog[]>
  addVoucherAnnotation: (input: {
    voucherId: string
    companyId: string
    content: string
  }) => Promise<VoucherLog>

  reorganizeNumbers: (periodId: string, companyId: string) => Promise<void>
  batchApprove: (ids: string[], companyId: string) => Promise<void>
  batchReverseApprove: (ids: string[], companyId: string) => Promise<void>

  deleteCompanyVouchers: (companyId: string) => Promise<number>
  exportVouchersExcel: (companyId: string, periodId?: string) => Promise<string>

  getDeletedVouchers: (companyId: string) => Promise<Voucher[]>
  restoreVoucher: (id: string, companyId: string) => Promise<void>
  permanentDeleteVoucher: (id: string, companyId: string) => Promise<void>
  recalculateBalances: (companyId: string) => Promise<string>

  setPage: (page: number) => void
  setPageSize: (size: number) => void
}

function mapVoucher(raw: VoucherListResponse['vouchers'][0]): Voucher {
  return {
    id: raw.id,
    company_id: raw.company_id,
    period_id: raw.period_id,
    voucher_word_id: raw.voucher_word_id,
    voucher_number: raw.voucher_number,
    sequence_num: raw.sequence_num,
    voucher_date: raw.voucher_date,
    summary: raw.summary,
    reference_number: raw.reference_number ?? null,
    attachment_count: raw.attachment_count,
    status: raw.status,
    total_debit: raw.total_debit,
    total_credit: raw.total_credit,
    version: raw.version,
    created_by: raw.created_by,
    created_at: raw.created_at,
    modified_by: raw.modified_by,
    modified_at: raw.modified_at,
    approved_by: raw.approved_by,
    approved_at: raw.approved_at,
    reversed_by: raw.reversed_by,
    reversed_at: raw.reversed_at,
    reversal_of_id: raw.reversal_of_id,
    is_system: raw.is_system,
    is_settlement: raw.is_settlement ?? 0,
    settlement_rule_id: raw.settlement_rule_id ?? null,
    is_deleted: raw.is_deleted ?? 0,
    deleted_at: raw.deleted_at ?? null,
    entries: raw.entries,
  }
}

export const useVoucherStore = create<VoucherState>((set, get) => ({
  vouchers: [],
  totalVouchers: 0,
  currentPage: 1,
  pageSize: 20,
  isLoading: false,
  error: null,

  fetchVouchers: async (companyId) => {
    set({ isLoading: true, error: null })
    try {
      const result = await invoke<VoucherListResponse>('get_vouchers', {
        companyId,
      })
      set({
        vouchers: result.vouchers.map(mapVoucher),
        totalVouchers: result.total,
        isLoading: false,
      })
    } catch (error) {
      set({ error: String(error), isLoading: false })
    }
  },

  queryVouchers: async (filters) => {
    set({ isLoading: true, error: null })
    try {
      const result = await invoke<VoucherListResponse>('query_vouchers', {
        input: filters,
      })
      const vouchers = result.vouchers.map(mapVoucher)
      set({
        vouchers,
        totalVouchers: result.total,
        currentPage: filters.page || 1,
        pageSize: filters.page_size || 20,
        isLoading: false,
      })
      return vouchers
    } catch (error) {
      set({ error: String(error), isLoading: false })
      return []
    }
  },

  getVoucher: async (id, companyId) => {
    try {
      const result = await invoke<VoucherListResponse['vouchers'][0] | null>(
        'get_voucher',
        { id, companyId },
      )
      return result ? mapVoucher(result) : null
    } catch (error) {
      set({ error: String(error) })
      return null
    }
  },

  getNextVoucherNumber: async (periodId, companyId) => {
    try {
      return await invoke<string>('get_next_voucher_number', { periodId, companyId })
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  suggestSummaries: async (accountCode, companyId) => {
    try {
      return await invoke<string[]>('suggest_summary', { accountCode, companyId })
    } catch (error) {
      set({ error: String(error) })
      return []
    }
  },

  addVoucher: async (input) => {
    set({ isLoading: true, error: null })
    try {
      const result = await invoke<VoucherListResponse['vouchers'][0]>(
        'create_voucher',
        { input },
      )
      const voucher = mapVoucher(result)
      set((state) => ({
        vouchers: [voucher, ...state.vouchers],
        totalVouchers: state.totalVouchers + 1,
        isLoading: false,
      }))
      usePeriodStore.getState().notifyDataChange()
      return voucher
    } catch (error) {
      set({ error: String(error), isLoading: false })
      throw error
    }
  },

  updateVoucher: async (input, companyId) => {
    set({ isLoading: true, error: null })
    try {
      const result = await invoke<VoucherListResponse['vouchers'][0]>(
        'update_voucher',
        { input, companyId },
      )
      const voucher = mapVoucher(result)
      set((state) => ({
        vouchers: state.vouchers.map((v) => (v.id === voucher.id ? voucher : v)),
        isLoading: false,
      }))
      usePeriodStore.getState().notifyDataChange()
      return voucher
    } catch (error) {
      set({ error: String(error), isLoading: false })
      throw error
    }
  },

  deleteVoucher: async (id, companyId) => {
    try {
      await invoke('delete_voucher', { id, companyId })
      set((state) => ({
        vouchers: state.vouchers.filter((v) => v.id !== id),
        totalVouchers: state.totalVouchers - 1,
      }))
      usePeriodStore.getState().notifyDataChange()
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  approveVoucher: async (id, companyId) => {
    try {
      const result = await invoke<Voucher>('approve_voucher', {
        id,
        companyId,
      })
      set((state) => ({
        vouchers: state.vouchers.map((v) => (v.id === id ? { ...v, ...result } : v)),
      }))
      usePeriodStore.getState().notifyDataChange()
      return result
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  reverseApproveVoucher: async (id, companyId) => {
    try {
      const result = await invoke<Voucher>('reverse_approve_voucher', { id, companyId })
      set((state) => ({
        vouchers: state.vouchers.map((v) => (v.id === id ? { ...v, ...result } : v)),
      }))
      usePeriodStore.getState().notifyDataChange()
      return result
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  reverseVoucher: async (id, companyId) => {
    try {
      const result = await invoke<Voucher>('reverse_voucher', {
        id,
        companyId,
      })
      set((state) => ({
        vouchers: [result, ...state.vouchers],
      }))
      usePeriodStore.getState().notifyDataChange()
      return result
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  copyVoucher: async (id, companyId) => {
    try {
      const result = await invoke<VoucherListResponse['vouchers'][0]>(
        'copy_voucher',
        { id, companyId },
      )
      const voucher = mapVoucher(result)
      set((state) => ({
        vouchers: [voucher, ...state.vouchers],
        totalVouchers: state.totalVouchers + 1,
      }))
      return voucher
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  getVoucherEntries: async (voucherId) => {
    try {
      return await invoke<VoucherEntry[]>('get_voucher_entries', { voucherId })
    } catch (error) {
      set({ error: String(error) })
      return []
    }
  },

  getVoucherLogs: async (voucherId) => {
    try {
      return await invoke<VoucherLog[]>('get_voucher_logs', { voucherId })
    } catch (error) {
      set({ error: String(error) })
      return []
    }
  },

  addVoucherAnnotation: async (input) => {
    try {
      return await invoke<VoucherLog>('add_voucher_annotation', {
        voucherId: input.voucherId,
        companyId: input.companyId,
        content: input.content,
      })
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  reorganizeNumbers: async (periodId, companyId) => {
    try {
      await invoke('reorganize_voucher_numbers', { periodId, companyId })
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  batchApprove: async (ids, companyId) => {
    try {
      await invoke('batch_approve_vouchers', { ids, companyId })
      const refreshed = await Promise.all(
        ids.map(async (id) => {
          try {
            const voucher = await invoke<VoucherListResponse['vouchers'][0] | null>(
              'get_voucher',
              { id, companyId },
            )
            return voucher ? mapVoucher(voucher) : null
          } catch {
            return null
          }
        }),
      )
      const refreshedById = new Map(
        refreshed.filter((voucher): voucher is Voucher => voucher !== null).map((voucher) => [voucher.id, voucher]),
      )
      set((state) => ({
        vouchers: state.vouchers.map((v) =>
          ids.includes(v.id) ? refreshedById.get(v.id) ?? { ...v, status: 'approved' } : v,
        ),
      }))
      usePeriodStore.getState().notifyDataChange()
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  batchReverseApprove: async (ids, companyId) => {
    try {
      await invoke('batch_reverse_approve_vouchers', { ids, companyId })
      set((state) => ({
        vouchers: state.vouchers.map((v) =>
          ids.includes(v.id) ? { ...v, status: 'draft', approved_by: null, approved_at: null } : v,
        ),
      }))
      usePeriodStore.getState().notifyDataChange()
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  setPage: (page) => set({ currentPage: page }),
  setPageSize: (size) => set({ pageSize: size, currentPage: 1 }),

  deleteCompanyVouchers: async (companyId) => {
    const count = await invoke<number>('delete_company_vouchers', { companyId })
    set((state) => ({
      vouchers: state.vouchers.filter((v) => v.company_id !== companyId),
      totalVouchers: state.totalVouchers - count,
    }))
    return count
  },

  exportVouchersExcel: async (companyId, periodId) => {
    return await invoke<string>('export_vouchers_excel', { companyId, periodId })
  },

  getDeletedVouchers: async (companyId) => {
    try {
      const result = await invoke<Voucher[]>('get_deleted_vouchers', { companyId })
      return result
    } catch (error) {
      set({ error: String(error) })
      return []
    }
  },

  restoreVoucher: async (id, companyId) => {
    try {
      await invoke('restore_voucher', { id, companyId })
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  permanentDeleteVoucher: async (id, companyId) => {
    try {
      await invoke('permanent_delete_voucher', { id, companyId })
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  recalculateBalances: async (companyId) => {
    try {
      const result = await invoke<string>('recalculate_balances', { companyId })
      return result
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },
}))

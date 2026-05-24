import { create } from 'zustand'
import { invoke } from '../lib/tauri'

export interface Voucher {
  id: string
  company_id: string
  period_id: string
  voucher_word_id: string
  voucher_number: string
  sequence_num: number
  voucher_date: string
  summary: string | null
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
  }) => Promise<void>
  getVoucher: (id: string, companyId: string) => Promise<Voucher | null>

  addVoucher: (input: {
    company_id: string
    period_id: string
    voucher_word_id: string
    voucher_date: string
    voucher_number?: string
    summary?: string
    attachment_count?: number
    created_by?: string
    entries: {
      account_code: string
      account_name: string
      direction: string
      amount: number
      summary?: string
      auxiliary_type?: string
      auxiliary_id?: string
      doc_number?: string
    }[]
  }) => Promise<Voucher>

  updateVoucher: (input: {
    id: string
    voucher_date?: string
    summary?: string
    attachment_count?: number
    modified_by?: string
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
    }[]
  }, companyId: string) => Promise<Voucher>

  deleteVoucher: (id: string, companyId: string) => Promise<void>

  approveVoucher: (id: string, approvedBy: string, companyId: string) => Promise<Voucher>
  reverseApproveVoucher: (id: string, companyId: string) => Promise<Voucher>
  reverseVoucher: (id: string, companyId: string, reversedBy?: string) => Promise<Voucher>
  copyVoucher: (id: string, companyId: string) => Promise<Voucher>

  getVoucherEntries: (voucherId: string) => Promise<VoucherEntry[]>
  getVoucherLogs: (voucherId: string) => Promise<VoucherLog[]>

  reorganizeNumbers: (periodId: string, companyId: string) => Promise<void>
  batchApprove: (ids: string[], approvedBy: string, companyId: string) => Promise<void>
  batchReverseApprove: (ids: string[], companyId: string) => Promise<void>

  deleteCompanyVouchers: (companyId: string) => Promise<number>
  exportVouchersExcel: (companyId: string, periodId?: string) => Promise<string>

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
      set({
        vouchers: result.vouchers.map(mapVoucher),
        totalVouchers: result.total,
        currentPage: filters.page || 1,
        pageSize: filters.page_size || 20,
        isLoading: false,
      })
    } catch (error) {
      set({ error: String(error), isLoading: false })
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
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  approveVoucher: async (id, approvedBy, companyId) => {
    try {
      const result = await invoke<Voucher>('approve_voucher', {
        id,
        approvedBy,
        companyId,
      })
      set((state) => ({
        vouchers: state.vouchers.map((v) => (v.id === id ? { ...v, ...result } : v)),
      }))
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
      return result
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  reverseVoucher: async (id, companyId, reversedBy) => {
    try {
      const result = await invoke<Voucher>('reverse_voucher', {
        id,
        companyId,
        reversedBy: reversedBy || null,
      })
      set((state) => ({
        vouchers: [result, ...state.vouchers],
      }))
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

  reorganizeNumbers: async (periodId, companyId) => {
    try {
      await invoke('reorganize_voucher_numbers', { periodId, companyId })
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  batchApprove: async (ids, approvedBy, companyId) => {
    try {
      await invoke('batch_approve_vouchers', { ids, approvedBy, companyId })
      set((state) => ({
        vouchers: state.vouchers.map((v) =>
          ids.includes(v.id) ? { ...v, status: 'approved', approved_by: approvedBy } : v,
        ),
      }))
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
}))

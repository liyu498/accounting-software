import { create } from 'zustand'
import { invoke } from '../lib/tauri'

export interface Invoice {
  id: string
  company_id: string
  period_id: string | null
  invoice_type: string
  invoice_no: string
  invoice_code: string | null
  invoice_date: string
  amount: number
  tax_amount: number
  total_amount: number
  tax_rate: number | null
  seller_name: string | null
  seller_tax_id: string | null
  buyer_name: string | null
  buyer_tax_id: string | null
  status: string
  voucher_id: string | null
  remarks: string | null
  created_at: string
  updated_at: string
}

interface InvoiceState {
  invoices: Invoice[]
  isLoading: boolean
  error: string | null

  fetchInvoices: (filters: {
    company_id?: string
    period_id?: string
    invoice_type?: string
  }) => Promise<void>
  getInvoice: (id: string, companyId: string) => Promise<Invoice | null>
  createInvoice: (input: {
    company_id: string
    period_id?: string
    invoice_type: string
    invoice_no: string
    invoice_code?: string
    invoice_date: string
    amount: number
    tax_amount: number
    tax_rate?: number
    seller_name?: string
    seller_tax_id?: string
    buyer_name?: string
    buyer_tax_id?: string
    remarks?: string
  }) => Promise<Invoice>
  updateInvoice: (
    id: string,
    input: {
      company_id?: string
      invoice_type?: string
      invoice_no?: string
      invoice_code?: string
      invoice_date?: string
      amount?: number
      tax_amount?: number
      tax_rate?: number
      seller_name?: string
      seller_tax_id?: string
      buyer_name?: string
      buyer_tax_id?: string
      status?: string
      voucher_id?: string
      remarks?: string
    },
  ) => Promise<Invoice>
  deleteInvoice: (id: string, companyId: string) => Promise<void>
  matchInvoiceToVoucher: (invoiceId: string, voucherId: string, companyId: string) => Promise<void>
  getInvoicesByVoucher: (voucherId: string, companyId: string) => Promise<Invoice[]>
}

export const useInvoiceStore = create<InvoiceState>((set) => ({
  invoices: [],
  isLoading: false,
  error: null,

  fetchInvoices: async (filters) => {
    set({ isLoading: true, error: null })
    try {
      const result = await invoke<Invoice[]>('get_invoices', {
        companyId: filters.company_id || null,
        periodId: filters.period_id || null,
        invoiceType: filters.invoice_type || null,
      })
      set({ invoices: result, isLoading: false })
    } catch (error) {
      set({ error: String(error), isLoading: false })
    }
  },

  getInvoice: async (id, companyId) => {
    try {
      return await invoke<Invoice | null>('get_invoice', { id, companyId })
    } catch (error) {
      set({ error: String(error) })
      return null
    }
  },

  createInvoice: async (input) => {
    set({ isLoading: true, error: null })
    try {
      const result = await invoke<Invoice>('create_invoice', { input })
      set((state) => ({
        invoices: [result, ...state.invoices],
        isLoading: false,
      }))
      return result
    } catch (error) {
      set({ error: String(error), isLoading: false })
      throw error
    }
  },

  updateInvoice: async (id, input) => {
    try {
      const result = await invoke<Invoice>('update_invoice', { id, input })
      set((state) => ({
        invoices: state.invoices.map((inv) => (inv.id === id ? result : inv)),
      }))
      return result
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  deleteInvoice: async (id, companyId) => {
    try {
      await invoke('delete_invoice', { id, companyId })
      set((state) => ({
        invoices: state.invoices.filter((inv) => inv.id !== id),
      }))
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  matchInvoiceToVoucher: async (invoiceId, voucherId, companyId) => {
    try {
      await invoke('match_invoice_to_voucher', { invoiceId, voucherId, companyId })
      set((state) => ({
        invoices: state.invoices.map((inv) =>
          inv.id === invoiceId
            ? { ...inv, voucher_id: voucherId, status: 'matched' }
            : inv,
        ),
      }))
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  getInvoicesByVoucher: async (voucherId, companyId) => {
    try {
      return await invoke<Invoice[]>('get_invoices_by_voucher', { voucherId, companyId })
    } catch (error) {
      set({ error: String(error) })
      return []
    }
  },
}))

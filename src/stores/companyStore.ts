import { create } from 'zustand'
import { invoke } from '../lib/tauri'

export interface Company {
  id: string
  code: string
  name: string
  tax_id: string | null
  contact: string | null
  phone: string | null
  email: string | null
  address: string | null
  bank_name: string | null
  bank_account: string | null
  tax_type: string | null
  industry: string | null
  accounting_system: string | null
  province: string | null
  city: string | null
  enable_year: number | null
  enable_month: number | null
  created_at: string
  updated_at: string
}

interface CompanyState {
  companies: Company[]
  selectedCompanyId: string | null
  isLoading: boolean
  error: string | null

  fetchCompanies: () => Promise<void>
  getCompanyById: (id: string) => Company | undefined
  createCompany: (input: {
    code: string
    name: string
    tax_id?: string
    tax_type?: string
    industry?: string
    accounting_system?: string
    province?: string
    city?: string
    enable_year?: number
    enable_month?: number
  }) => Promise<Company>
  updateCompany: (
    id: string,
    input: {
      code: string
      name: string
      tax_id?: string
      tax_type?: string
      industry?: string
      accounting_system?: string
      province?: string
      city?: string
      enable_year?: number
      enable_month?: number
    },
  ) => Promise<Company>
  deleteCompany: (id: string) => Promise<void>
  selectCompany: (companyId: string | null) => void
}

export const useCompanyStore = create<CompanyState>((set, get) => ({
  companies: [],
  selectedCompanyId: null,
  isLoading: false,
  error: null,

  fetchCompanies: async () => {
    set({ isLoading: true, error: null })
    try {
      const result = await invoke<Company[]>('get_companies')
      set({ companies: result, isLoading: false })
    } catch (error) {
      set({ error: String(error), isLoading: false })
    }
  },

  getCompanyById: (id) => {
    return get().companies.find((c) => c.id === id)
  },

  createCompany: async (input) => {
    set({ isLoading: true, error: null })
    try {
      const result = await invoke<Company>('create_company', { input })
      // Re-fetch from backend to ensure consistency
      const allCompanies = await invoke<Company[]>('get_companies')
      set({
        companies: allCompanies,
        selectedCompanyId: result.id,
        isLoading: false,
      })
      return result
    } catch (error) {
      set({ error: String(error), isLoading: false })
      throw error
    }
  },

  updateCompany: async (id, input) => {
    set({ isLoading: true, error: null })
    try {
      const result = await invoke<Company>('update_company', { id, input })
      set((state) => ({
        companies: state.companies.map((c) => (c.id === id ? result : c)),
        isLoading: false,
      }))
      return result
    } catch (error) {
      set({ error: String(error), isLoading: false })
      throw error
    }
  },

  deleteCompany: async (id) => {
    try {
      await invoke('delete_company', { id })
      const allCompanies = await invoke<Company[]>('get_companies')
      set((state) => ({
        companies: allCompanies,
        selectedCompanyId:
          state.selectedCompanyId === id ? null : state.selectedCompanyId,
      }))
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  selectCompany: (companyId) => {
    set({ selectedCompanyId: companyId })
  },
}))

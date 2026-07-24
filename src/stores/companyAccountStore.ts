import { create } from 'zustand'
import { invoke } from '../lib/tauri'

export interface CompanyAccount {
  id: string
  company_id: string
  account_name: string
  account_type: string
  bank_name: string | null
  account_number: string
  subject_code: string
  opening_balance: number
  attachment_note: string | null
  status: '启用' | '停用'
  created_at: string
  updated_at: string
}

export interface CompanyAccountInput {
  companyId: string
  accountName: string
  accountType: string
  bankName?: string
  accountNumber: string
  subjectCode: string
  openingBalance: number
  attachmentNote?: string
  status: '启用' | '停用'
}

interface CompanyAccountState {
  companyAccounts: CompanyAccount[]
  isLoading: boolean
  error: string | null
  fetchCompanyAccounts: (companyId: string) => Promise<void>
  createCompanyAccount: (input: CompanyAccountInput) => Promise<CompanyAccount>
  updateCompanyAccount: (id: string, input: CompanyAccountInput) => Promise<CompanyAccount>
  deleteCompanyAccount: (id: string, companyId: string) => Promise<void>
}

const toCommandInput = (input: CompanyAccountInput) => ({
  company_id: input.companyId, account_name: input.accountName, account_type: input.accountType,
  bank_name: input.bankName, account_number: input.accountNumber, subject_code: input.subjectCode,
  opening_balance: input.openingBalance, attachment_note: input.attachmentNote, status: input.status,
})

export const useCompanyAccountStore = create<CompanyAccountState>((set) => ({
  companyAccounts: [], isLoading: false, error: null,
  fetchCompanyAccounts: async (companyId) => {
    set({ isLoading: true, error: null })
    try { set({ companyAccounts: await invoke<CompanyAccount[]>('get_company_accounts', { companyId }), isLoading: false }) }
    catch (error) { set({ error: String(error), isLoading: false }) }
  },
  createCompanyAccount: async (input) => {
    try { const account = await invoke<CompanyAccount>('create_company_account', { input: toCommandInput(input) }); set((state) => ({ companyAccounts: [...state.companyAccounts, account] })); return account }
    catch (error) { set({ error: String(error) }); throw error }
  },
  updateCompanyAccount: async (id, input) => {
    try { const account = await invoke<CompanyAccount>('update_company_account', { id, input: toCommandInput(input) }); set((state) => ({ companyAccounts: state.companyAccounts.map((item) => item.id === id ? account : item) })); return account }
    catch (error) { set({ error: String(error) }); throw error }
  },
  deleteCompanyAccount: async (id, companyId) => {
    try { await invoke('delete_company_account', { id, companyId }); set((state) => ({ companyAccounts: state.companyAccounts.filter((item) => item.id !== id) })) }
    catch (error) { set({ error: String(error) }); throw error }
  },
}))

import { create } from 'zustand'
import { invoke } from '../lib/tauri'

export interface AccountingPeriod {
  id: string
  company_id: string
  period_year: number
  period_month: number
  start_date: string
  end_date: string
  status: string
  closed_at: string | null
  closed_by: string | null
  created_at: string
  updated_at: string
}

export interface VoucherWord {
  id: string
  company_id: string
  word_code: string
  word_name: string
  is_enabled: number
}

export interface AccountBalance {
  id: string
  period_id: string
  account_code: string
  opening_debit: number
  opening_credit: number
  period_debit: number
  period_credit: number
  closing_debit: number
  closing_credit: number
  updated_at: string
}

export interface TrialBalanceItem {
  account_code: string
  account_name: string
  account_type: string
  account_level: number
  is_detail: boolean
  opening_debit: number
  opening_credit: number
  period_debit: number
  period_credit: number
  cumulative_debit: number
  cumulative_credit: number
  closing_debit: number
  closing_credit: number
}

export interface TrialBalanceResult {
  items: TrialBalanceItem[]
  total_opening_debit: number
  total_opening_credit: number
  total_period_debit: number
  total_period_credit: number
  total_cumulative_debit: number
  total_cumulative_credit: number
  total_closing_debit: number
  total_closing_credit: number
  is_balanced: boolean
}

export interface GeneralLedgerItem {
  account_code: string
  account_name: string
  account_type: string
  entries: {
    voucher_id: string
    voucher_number: string
    voucher_date: string
    summary: string
    direction: string
    amount: number
    balance: number
  }[]
  opening_debit: number
  opening_credit: number
  period_debit: number
  period_credit: number
  closing_debit: number
  closing_credit: number
}

export interface SubsidiaryLedgerItem {
  voucher_id: string
  voucher_date: string
  voucher_number: string
  summary: string
  opposite_account: string
  debit: number
  credit: number
  balance: number
  balance_direction: string
}

export interface BalanceSheetItem {
  item_code: string
  item_name: string
  item_level: number
  is_total: number
  opening_balance: number
  ending_balance: number
  section: string
  children: BalanceSheetItem[]
}

export interface BalanceSheetResult {
  period_id: string
  items: BalanceSheetItem[]
  total_assets: number
  total_liabilities: number
  total_equity: number
  opening_total_assets: number
  opening_total_liabilities: number
  opening_total_equity: number
  is_balanced: boolean
}

export interface IncomeStatementItem {
  item_code: string
  item_name: string
  item_level: number
  is_total: number
  current_amount: number
  year_to_date: number
  children: IncomeStatementItem[]
}

export interface IncomeStatementResult {
  period_id: string
  items: IncomeStatementItem[]
  current_period_total: number
  year_to_date_total: number
}

interface PeriodState {
  periods: AccountingPeriod[]
  voucherWords: VoucherWord[]
  currentPeriodId: string | null
  trialBalance: TrialBalanceResult | null
  accountBalances: AccountBalance[]
  isLoading: boolean
  error: string | null
  dataVersion: number

  fetchPeriods: (companyId: string) => Promise<void>
  ensurePeriods: (companyId: string) => Promise<void>
  fetchOpenPeriods: (companyId: string) => Promise<AccountingPeriod[]>
  createPeriod: (companyId: string, year: number, month: number) => Promise<AccountingPeriod>
  closePeriod: (periodId: string, closedBy?: string) => Promise<void>
  reopenPeriod: (periodId: string) => Promise<void>
  setCurrentPeriod: (periodId: string | null) => void
  notifyDataChange: () => void

  fetchVoucherWords: (companyId: string) => Promise<void>

  fetchTrialBalance: (periodId: string) => Promise<TrialBalanceResult>
  fetchAccountBalances: (periodId: string) => Promise<void>

  getGeneralLedger: (periodId: string, accountType?: string) => Promise<GeneralLedgerItem[]>
  getSubsidiaryLedger: (periodId: string, accountCode: string) => Promise<SubsidiaryLedgerItem[]>

  getBalanceSheet: (periodId: string) => Promise<BalanceSheetResult>
  getIncomeStatement: (periodId: string) => Promise<IncomeStatementResult>

  saveInitialBalance: (input: {
    period_id: string
    account_code: string
    opening_debit: number
    opening_credit: number
    created_by?: string
  }) => Promise<void>
  validateInitialBalances: (periodId: string) => Promise<{ is_balanced: boolean; message: string }>
  finalizeInitialBalances: (periodId: string) => Promise<void>
}

export const usePeriodStore = create<PeriodState>((set, get) => ({
  periods: [],
  voucherWords: [],
  currentPeriodId: null,
  trialBalance: null,
  accountBalances: [],
  isLoading: false,
  error: null,
  dataVersion: 0,

  notifyDataChange: () => {
    set((state) => ({ dataVersion: state.dataVersion + 1, trialBalance: null }))
  },

  fetchPeriods: async (companyId) => {
    set({ isLoading: true, error: null })
    try {
      // Ensure all periods exist first, then fetch
      await invoke<AccountingPeriod[]>('ensure_periods', { companyId })
      const result = await invoke<AccountingPeriod[]>('get_accounting_periods', {
        companyId,
      })
      set({ periods: result, isLoading: false })
    } catch (error) {
      set({ error: String(error), isLoading: false })
    }
  },

  ensurePeriods: async (companyId) => {
    try {
      const result = await invoke<AccountingPeriod[]>('ensure_periods', { companyId })
      set({ periods: result })
    } catch (error) {
      set({ error: String(error) })
    }
  },

  fetchOpenPeriods: async (companyId) => {
    try {
      return await invoke<AccountingPeriod[]>('get_open_periods', { companyId })
    } catch (error) {
      set({ error: String(error) })
      return []
    }
  },

  createPeriod: async (companyId, year, month) => {
    set({ isLoading: true, error: null })
    try {
      const result = await invoke<AccountingPeriod>('create_accounting_period', {
        input: { company_id: companyId, period_year: year, period_month: month },
      })
      set((state) => ({
        periods: [result, ...state.periods],
        isLoading: false,
      }))
      return result
    } catch (error) {
      set({ error: String(error), isLoading: false })
      throw error
    }
  },

  closePeriod: async (periodId, closedBy) => {
    set({ isLoading: true, error: null })
    try {
      await invoke('close_period', {
        input: { period_id: periodId, closed_by: closedBy },
      })
      await get().fetchPeriods(
        get().periods.find((p) => p.id === periodId)?.company_id ?? '',
      )
      set({ isLoading: false })
    } catch (error) {
      set({ error: String(error), isLoading: false })
      throw error
    }
  },

  reopenPeriod: async (periodId) => {
    set({ isLoading: true, error: null })
    try {
      await invoke('reopen_period', { periodId })
      await get().fetchPeriods(
        get().periods.find((p) => p.id === periodId)?.company_id ?? '',
      )
      set({ isLoading: false })
    } catch (error) {
      set({ error: String(error), isLoading: false })
      throw error
    }
  },

  setCurrentPeriod: (periodId) => {
    set({ currentPeriodId: periodId })
  },

  fetchVoucherWords: async (companyId) => {
    try {
      const result = await invoke<VoucherWord[]>('get_voucher_words', {
        companyId,
      })
      set({ voucherWords: result })
    } catch (error) {
      set({ error: String(error) })
    }
  },

  fetchTrialBalance: async (periodId) => {
    try {
      const result = await invoke<TrialBalanceResult>('get_trial_balance', {
        periodId,
      })
      set({ trialBalance: result })
      return result
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  fetchAccountBalances: async (periodId) => {
    try {
      const result = await invoke<AccountBalance[]>('get_account_balances', {
        periodId,
      })
      set({ accountBalances: result })
    } catch (error) {
      set({ error: String(error) })
    }
  },

  getGeneralLedger: async (periodId, accountType) => {
    try {
      return await invoke<GeneralLedgerItem[]>('get_general_ledger', {
        periodId,
        accountType: accountType || null,
      })
    } catch (error) {
      set({ error: String(error) })
      return []
    }
  },

  getSubsidiaryLedger: async (periodId, accountCode) => {
    try {
      return await invoke<SubsidiaryLedgerItem[]>('get_subsidiary_ledger', {
        periodId,
        accountCode,
      })
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  getBalanceSheet: async (periodId) => {
    try {
      return await invoke<BalanceSheetResult>('get_balance_sheet', { periodId })
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  getIncomeStatement: async (periodId) => {
    try {
      return await invoke<IncomeStatementResult>('get_income_statement', {
        periodId,
      })
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  saveInitialBalance: async (input) => {
    try {
      await invoke('save_initial_balance', { input })
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  validateInitialBalances: async (periodId) => {
    try {
      return await invoke<{ is_balanced: boolean; message: string }>(
        'validate_initial_balances',
        { periodId },
      )
    } catch (error) {
      set({ error: String(error) })
      return { is_balanced: false, message: String(error) }
    }
  },

  finalizeInitialBalances: async (periodId) => {
    set({ isLoading: true, error: null })
    try {
      await invoke('finalize_initial_balances', { periodId })
      set({ isLoading: false })
    } catch (error) {
      set({ error: String(error), isLoading: false })
      throw error
    }
  },
}))

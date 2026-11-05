import { create } from 'zustand'
import { invoke } from '../lib/tauri'
import {
  loadWorkspaceSelection,
  saveSelectedPeriodId,
} from '../lib/workspaceSelection.js'
import { findLatestOpenBrowserPreviewPeriod } from '../lib/browserPreviewPeriods.js'

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
  initial_balances_finalized_at: string | null
  initial_balances_finalized_by: string | null
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

export interface AccountingReconciliationCheck {
  code: string
  name: string
  source: string
  target: string
  source_amount: number
  target_amount: number
  difference: number
  status: 'passed' | 'blocked'
  detail: string
}

export interface AccountingReconciliationResult {
  period_id: string
  company_id: string
  accounting_system: string
  checks: AccountingReconciliationCheck[]
  passed_count: number
  blocked_count: number
  is_reconciled: boolean
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
    source_account_code: string
    source_account_name: string
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
  line_number: string | null
  item_level: number
  is_total: number
  opening_balance: number
  ending_balance: number
  section: string
  children: BalanceSheetItem[]
}

export interface BalanceSheetResult {
  period_id: string
  template_name: string
  accounting_system: string
  form_code: string | null
  reporting_frequency: string
  is_statutory: boolean
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
  line_number: string | null
  item_level: number
  is_total: number
  current_amount: number
  year_to_date: number
  comparative_amount: number
  current_unrestricted_amount: number
  current_restricted_amount: number
  ytd_unrestricted_amount: number
  ytd_restricted_amount: number
  children: IncomeStatementItem[]
}

export interface IncomeStatementResult {
  period_id: string
  template_name: string
  accounting_system: string
  form_code: string | null
  reporting_frequency: string
  is_statutory: boolean
  column_basis: 'monthly_ytd' | 'current_comparative' | 'nonprofit_activity_matrix'
  has_comparative_period: boolean
  classification_complete: boolean
  items: IncomeStatementItem[]
  current_period_total: number
  year_to_date_total: number
  comparative_period_total: number
}

export interface EquityChangeItem {
  item_code: string
  item_name: string
  line_number: string | null
  item_level: number
  is_total: number
  opening_balance: number
  current_increase: number
  current_decrease: number
  ending_balance: number
  values: number[]
  comparative_values: number[]
}

export interface EquityChangeColumn {
  column_code: string
  column_name: string
}

export interface EquityChangeResult {
  period_id: string
  template_name: string
  accounting_system: string
  form_code: string | null
  reporting_frequency: string
  is_statutory: boolean
  layout: 'component_rows' | 'statutory_matrix'
  columns: EquityChangeColumn[]
  has_comparative_period: boolean
  classification_complete: boolean
  comparative_classification_complete: boolean
  items: EquityChangeItem[]
}

export interface CashFlowItem {
  item_code: string
  item_name: string
  line_number: string | null
  item_level: number
  is_total: number
  current_amount: number
  year_to_date: number
  comparative_amount: number
}

export interface CashFlowResult {
  period_id: string
  template_name: string
  accounting_system: string
  form_code: string | null
  reporting_frequency: string
  is_statutory: boolean
  column_basis: 'monthly_ytd' | 'current_comparative'
  has_comparative_period: boolean
  items: CashFlowItem[]
  net_increase: number
  net_increase_year_to_date: number
  net_increase_comparative: number
  opening_cash_balance: number
  ending_cash_balance: number
  cash_balance_change: number
  cash_balance_change_year_to_date: number
  reconciliation_difference: number
  reconciliation_difference_year_to_date: number
  is_reconciled: boolean
  classification_mode: 'unconfigured' | 'account_formula' | 'voucher_mapping'
  unmapped_cash_amount: number
  unmapped_cash_amount_year_to_date: number
  unmapped_voucher_count: number
  mapping_conflict_count: number
  is_classification_complete: boolean
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
  closePeriod: (periodId: string) => Promise<void>
  reopenPeriod: (periodId: string) => Promise<void>
  setCurrentPeriod: (periodId: string | null) => void
  notifyDataChange: () => void

  fetchVoucherWords: (companyId: string) => Promise<void>

  fetchTrialBalance: (periodId: string) => Promise<TrialBalanceResult>
  getAccountingReconciliation: (periodId: string) => Promise<AccountingReconciliationResult>
  fetchAccountBalances: (periodId: string) => Promise<void>

  getGeneralLedger: (periodId: string, accountType?: string) => Promise<GeneralLedgerItem[]>
  getSubsidiaryLedger: (periodId: string, accountCode: string) => Promise<SubsidiaryLedgerItem[]>

  getBalanceSheet: (periodId: string) => Promise<BalanceSheetResult>
  getIncomeStatement: (periodId: string) => Promise<IncomeStatementResult>
  getCashFlowStatement: (periodId: string) => Promise<CashFlowResult>
  getEquityChangeStatement: (periodId: string) => Promise<EquityChangeResult>

  saveInitialBalance: (input: {
    period_id: string
    account_code: string
    opening_debit: number
    opening_credit: number
  }) => Promise<void>
  validateInitialBalances: (periodId: string) => Promise<{ is_balanced: boolean; message: string }>
  finalizeInitialBalances: (periodId: string) => Promise<void>
}

export const usePeriodStore = create<PeriodState>((set, get) => ({
  periods: [],
  voucherWords: [],
  currentPeriodId: loadWorkspaceSelection().periodId,
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
      const currentPeriodId = get().currentPeriodId
      const selectedPeriod = result.find((period) => period.id === currentPeriodId)
      const validCurrentPeriodId = selectedPeriod && selectedPeriod.status !== 'closed'
        ? currentPeriodId
        : findLatestOpenBrowserPreviewPeriod(result, companyId)?.id ?? null
      if (validCurrentPeriodId !== currentPeriodId) {
        saveSelectedPeriodId(validCurrentPeriodId)
      }
      set({ periods: result, currentPeriodId: validCurrentPeriodId, isLoading: false })
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

  closePeriod: async (periodId) => {
    set({ isLoading: true, error: null })
    try {
      await invoke('close_period', {
        input: { period_id: periodId },
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
    saveSelectedPeriodId(periodId)
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

  getAccountingReconciliation: async (periodId) => {
    try {
      return await invoke<AccountingReconciliationResult>('get_accounting_reconciliation', {
        periodId,
      })
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

  getCashFlowStatement: async (periodId) => {
    try {
      return await invoke<CashFlowResult>('get_cash_flow_statement', { periodId })
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  getEquityChangeStatement: async (periodId) => {
    try {
      return await invoke<EquityChangeResult>('get_equity_change_statement', { periodId })
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
      const companyId = get().periods.find((period) => period.id === periodId)?.company_id
      if (companyId) await get().fetchPeriods(companyId)
      set({ isLoading: false })
    } catch (error) {
      set({ error: String(error), isLoading: false })
      throw error
    }
  },
}))

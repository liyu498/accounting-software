import { invoke } from '../lib/tauri'

// Reports are fetched directly from the backend.
// This module provides convenience wrappers for report page components.

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
  account_code: string
  account_name: string
  entries: {
    voucher_id: string
    voucher_number: string
    voucher_date: string
    summary: string
    opposite_account: string
    direction: string
    amount: number
    balance: number
    balance_direction: string
  }[]
  opening_balance: number
  closing_balance: number
}

export interface TrialBalanceResult {
  items: {
    account_code: string
    account_name: string
    account_type: string
    opening_debit: number
    opening_credit: number
    period_debit: number
    period_credit: number
    cumulative_debit: number
    cumulative_credit: number
    closing_debit: number
    closing_credit: number
  }[]
  totals: {
    opening_debit: number
    opening_credit: number
    period_debit: number
    period_credit: number
    closing_debit: number
    closing_credit: number
  }
  is_balanced: boolean
}

export interface BalanceSheetResult {
  template_name: string
  items: {
    item_code: string
    item_name: string
    level: number
    is_total: number
    formula: string | null
    amount: number
    children: unknown[]
  }[]
  total_assets: number
  total_liabilities_equity: number
  is_balanced: boolean
}

export interface IncomeStatementResult {
  template_name: string
  items: {
    item_code: string
    item_name: string
    level: number
    is_total: number
    formula: string | null
    current_period_amount: number
    year_to_date_amount: number
    children: unknown[]
  }[]
  net_profit: number
}

export async function fetchGeneralLedger(
  periodId: string,
  accountType?: string,
): Promise<GeneralLedgerItem[]> {
  return invoke<GeneralLedgerItem[]>('get_general_ledger', {
    periodId,
    accountType: accountType || null,
  })
}

export async function fetchSubsidiaryLedger(
  periodId: string,
  accountCode: string,
): Promise<SubsidiaryLedgerItem> {
  return invoke<SubsidiaryLedgerItem>('get_subsidiary_ledger', {
    periodId,
    accountCode,
  })
}

export async function fetchTrialBalance(
  periodId: string,
): Promise<TrialBalanceResult> {
  return invoke<TrialBalanceResult>('get_trial_balance', { periodId })
}

export async function fetchBalanceSheet(
  periodId: string,
): Promise<BalanceSheetResult> {
  return invoke<BalanceSheetResult>('get_balance_sheet', { periodId })
}

export async function fetchIncomeStatement(
  periodId: string,
): Promise<IncomeStatementResult> {
  return invoke<IncomeStatementResult>('get_income_statement', { periodId })
}

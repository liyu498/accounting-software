import { create } from 'zustand'
import { invoke } from '../lib/tauri'

export interface Currency {
  id: string
  company_id: string
  code: string
  name: string
  exchange_rate: number
  is_base: number
}

export interface ExchangeAdjustmentItem {
  currency_code: string
  currency_name: string
  exchange_rate: number
  account_code: string
  account_name: string
  original_balance: number
  adjusted_balance: number
  difference: number
  direction: string
}

interface CurrencyState {
  currencies: Currency[]
  isLoading: boolean
  error: string | null

  fetchCurrencies: (companyId: string) => Promise<void>
  createCurrency: (input: {
    company_id: string
    code: string
    name: string
    exchange_rate: number
    is_base?: number
  }) => Promise<Currency>
  updateCurrency: (input: {
    id: string
    company_id: string
    code?: string
    name?: string
    exchange_rate?: number
    is_base?: number
  }) => Promise<Currency>
  deleteCurrency: (id: string, companyId: string) => Promise<void>
  calculateExchangeAdjustment: (companyId: string, periodId: string) => Promise<ExchangeAdjustmentItem[]>
  getBaseCurrency: () => Currency | undefined
}

export const useCurrencyStore = create<CurrencyState>((set, get) => ({
  currencies: [],
  isLoading: false,
  error: null,

  fetchCurrencies: async (companyId) => {
    set({ isLoading: true, error: null })
    try {
      const data = await invoke<Currency[]>('get_currencies', { companyId })
      set({ currencies: data, isLoading: false })
    } catch (e) {
      set({ error: String(e), isLoading: false })
    }
  },

  createCurrency: async (input) => {
    const result = await invoke<Currency>('create_currency', { input })
    set((state) => ({ currencies: [...state.currencies, result] }))
    return result
  },

  updateCurrency: async (input) => {
    const result = await invoke<Currency>('update_currency', { input })
    set((state) => ({
      currencies: state.currencies.map((c) => (c.id === result.id ? result : c)),
    }))
    return result
  },

  deleteCurrency: async (id, companyId) => {
    await invoke('delete_currency', { id, companyId })
    set((state) => ({ currencies: state.currencies.filter((c) => c.id !== id) }))
  },

  calculateExchangeAdjustment: async (companyId, periodId) => {
    return await invoke<ExchangeAdjustmentItem[]>('calculate_exchange_adjustment', {
      companyId,
      periodId,
    })
  },

  getBaseCurrency: () => {
    return get().currencies.find((c) => c.is_base === 1)
  },
}))

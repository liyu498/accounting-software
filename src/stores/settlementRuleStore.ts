import { create } from 'zustand'
import { invoke } from '../lib/tauri'

export interface SettlementRule {
  id: string
  company_id: string
  name: string
  rule_type: string
  source_formula: string | null
  target_account_code: string | null
  voucher_word_id: string | null
  summary_template: string | null
  priority: number
  is_enabled: number
}

interface SettlementRuleState {
  rules: SettlementRule[]
  isLoading: boolean
  error: string | null
  fetchSettlementRules: (companyId: string) => Promise<void>
}

export const useSettlementRuleStore = create<SettlementRuleState>((set) => ({
  rules: [],
  isLoading: false,
  error: null,

  fetchSettlementRules: async (companyId) => {
    set({ isLoading: true, error: null })
    try {
      const rules = await invoke<SettlementRule[]>('get_settlement_rules', { companyId })
      set({ rules, isLoading: false })
    } catch (error) {
      set({ error: String(error), isLoading: false })
    }
  },
}))

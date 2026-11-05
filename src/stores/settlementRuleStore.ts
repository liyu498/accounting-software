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

export interface SettlementRuleInput {
  companyId: string
  name: string
  ruleType: string
  sourceFormula?: string
  targetAccountCode?: string
  voucherWordId?: string
  summaryTemplate?: string
  priority?: number
  isEnabled?: boolean
}

export interface SettlementRulePreviewEntry {
  accountCode: string
  accountName: string
  direction: 'debit' | 'credit'
  amount: number
  summary: string
}

export interface SettlementRulePreview {
  ruleId: string
  ruleName: string
  periodId: string
  periodLabel: string
  voucherDate: string
  voucherWordId: string
  voucherWordName: string
  targetAccountCode: string
  summary: string
  entries: SettlementRulePreviewEntry[]
  totalDebit: number
  totalCredit: number
  totalAmount: number
}

export interface SettlementVoucherDraft {
  id: string
  voucherNumber: string
  ruleId: string
  totalDebit: number
  totalCredit: number
}

interface SettlementRuleState {
  rules: SettlementRule[]
  isLoading: boolean
  error: string | null
  fetchSettlementRules: (companyId: string) => Promise<SettlementRule[]>
  createSettlementRule: (input: SettlementRuleInput) => Promise<SettlementRule>
  updateSettlementRule: (input: SettlementRuleInput & { id: string }) => Promise<SettlementRule>
  deleteSettlementRule: (id: string, companyId: string) => Promise<void>
  previewSettlementRule: (ruleId: string, companyId: string, periodId: string) => Promise<SettlementRulePreview>
  createSettlementVoucherDraft: (ruleId: string, companyId: string, periodId: string) => Promise<SettlementVoucherDraft>
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
      return rules
    } catch (error) {
      set({ error: String(error), isLoading: false })
      throw error
    }
  },

  createSettlementRule: async (input) => {
    try {
      const rule = await invoke<SettlementRule>('create_settlement_rule', {
        input: {
          company_id: input.companyId,
          name: input.name,
          rule_type: input.ruleType,
          source_formula: input.sourceFormula,
          target_account_code: input.targetAccountCode,
          voucher_word_id: input.voucherWordId,
          summary_template: input.summaryTemplate,
          priority: input.priority,
        },
      })
      set((state) => ({ rules: [...state.rules, rule].sort((left, right) => left.priority - right.priority || left.name.localeCompare(right.name)) }))
      return rule
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  updateSettlementRule: async (input) => {
    try {
      const rule = await invoke<SettlementRule>('update_settlement_rule', {
        input: {
          id: input.id,
          company_id: input.companyId,
          name: input.name,
          rule_type: input.ruleType,
          source_formula: input.sourceFormula,
          target_account_code: input.targetAccountCode,
          voucher_word_id: input.voucherWordId,
          summary_template: input.summaryTemplate,
          priority: input.priority,
          is_enabled: input.isEnabled === undefined ? undefined : input.isEnabled ? 1 : 0,
        },
      })
      set((state) => ({ rules: state.rules.map((item) => item.id === rule.id ? rule : item).sort((left, right) => left.priority - right.priority || left.name.localeCompare(right.name)) }))
      return rule
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  deleteSettlementRule: async (id, companyId) => {
    try {
      await invoke('delete_settlement_rule', { id, companyId })
      set((state) => ({ rules: state.rules.filter((item) => item.id !== id) }))
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  previewSettlementRule: async (ruleId, companyId, periodId) => {
    try {
      return await invoke<SettlementRulePreview>('preview_settlement_rule', { ruleId, companyId, periodId })
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  createSettlementVoucherDraft: async (ruleId, companyId, periodId) => {
    try {
      return await invoke<SettlementVoucherDraft>('create_settlement_voucher_draft', {
        ruleId,
        companyId,
        periodId,
      })
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },
}))

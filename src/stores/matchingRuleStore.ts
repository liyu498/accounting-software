import { create } from 'zustand'
import { invoke } from '../lib/tauri'

export type MatchingRuleScope = 'invoice' | 'bill' | 'cash_flow'

export interface MatchingRule {
  id: string
  company_id: string
  rule_scope: MatchingRuleScope
  name: string
  condition_text: string
  action_text: string
  target_account_code: string | null
  voucher_template_id: string | null
  priority: number
  is_enabled: number
  hit_count: number
  created_at: string
  updated_at: string
}

export interface MatchingRuleInput {
  companyId: string
  ruleScope: MatchingRuleScope
  name: string
  conditionText: string
  actionText: string
  targetAccountCode?: string
  voucherTemplateId?: string
  priority?: number
  isEnabled?: boolean
}

interface MatchingRuleState {
  rules: MatchingRule[]
  isLoading: boolean
  error: string | null
  fetchMatchingRules: (companyId: string, ruleScope: MatchingRuleScope) => Promise<void>
  createMatchingRule: (input: MatchingRuleInput) => Promise<MatchingRule>
  updateMatchingRule: (id: string, input: MatchingRuleInput) => Promise<MatchingRule>
  deleteMatchingRule: (id: string, companyId: string) => Promise<void>
}

const toCommandInput = (input: MatchingRuleInput) => ({
  company_id: input.companyId, rule_scope: input.ruleScope, name: input.name,
  condition_text: input.conditionText, action_text: input.actionText,
  target_account_code: input.targetAccountCode, voucher_template_id: input.voucherTemplateId,
  priority: input.priority, is_enabled: input.isEnabled === undefined ? undefined : input.isEnabled ? 1 : 0,
})

export const useMatchingRuleStore = create<MatchingRuleState>((set) => ({
  rules: [], isLoading: false, error: null,
  fetchMatchingRules: async (companyId, ruleScope) => {
    set({ isLoading: true, error: null })
    try { set({ rules: await invoke<MatchingRule[]>('get_matching_rules', { companyId, ruleScope }), isLoading: false }) }
    catch (error) { set({ error: String(error), isLoading: false }) }
  },
  createMatchingRule: async (input) => {
    try { const rule = await invoke<MatchingRule>('create_matching_rule', { input: toCommandInput(input) }); set((state) => ({ rules: [...state.rules, rule] })); return rule }
    catch (error) { set({ error: String(error) }); throw error }
  },
  updateMatchingRule: async (id, input) => {
    try { const rule = await invoke<MatchingRule>('update_matching_rule', { id, input: toCommandInput(input) }); set((state) => ({ rules: state.rules.map((item) => item.id === id ? rule : item) })); return rule }
    catch (error) { set({ error: String(error) }); throw error }
  },
  deleteMatchingRule: async (id, companyId) => {
    try { await invoke('delete_matching_rule', { id, companyId }); set((state) => ({ rules: state.rules.filter((item) => item.id !== id) })) }
    catch (error) { set({ error: String(error) }); throw error }
  },
}))

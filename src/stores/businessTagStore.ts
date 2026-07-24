import { create } from 'zustand'
import { invoke } from '../lib/tauri'

export interface BusinessTag {
  id: string
  company_id: string
  name: string
  applicable_modules: string
  color_name: string
  auto_rule: string | null
  usage_count: number
  remarks: string | null
  is_enabled: number
  created_at: string
  updated_at: string
}

export interface BusinessTagInput {
  companyId: string
  name: string
  applicableModules: string
  colorName: string
  autoRule?: string
  remarks?: string
  isEnabled?: boolean
}

interface BusinessTagState {
  businessTags: BusinessTag[]
  isLoading: boolean
  error: string | null
  fetchBusinessTags: (companyId: string) => Promise<void>
  createBusinessTag: (input: BusinessTagInput) => Promise<BusinessTag>
  updateBusinessTag: (id: string, input: BusinessTagInput) => Promise<BusinessTag>
  deleteBusinessTag: (id: string, companyId: string) => Promise<void>
}

const toCommandInput = (input: BusinessTagInput) => ({
  company_id: input.companyId, name: input.name, applicable_modules: input.applicableModules,
  color_name: input.colorName, auto_rule: input.autoRule, remarks: input.remarks,
  is_enabled: input.isEnabled === undefined ? undefined : input.isEnabled ? 1 : 0,
})

export const useBusinessTagStore = create<BusinessTagState>((set) => ({
  businessTags: [], isLoading: false, error: null,
  fetchBusinessTags: async (companyId) => {
    set({ isLoading: true, error: null })
    try { set({ businessTags: await invoke<BusinessTag[]>('get_business_tags', { companyId }), isLoading: false }) }
    catch (error) { set({ error: String(error), isLoading: false }) }
  },
  createBusinessTag: async (input) => {
    try { const tag = await invoke<BusinessTag>('create_business_tag', { input: toCommandInput(input) }); set((state) => ({ businessTags: [...state.businessTags, tag] })); return tag }
    catch (error) { set({ error: String(error) }); throw error }
  },
  updateBusinessTag: async (id, input) => {
    try { const tag = await invoke<BusinessTag>('update_business_tag', { id, input: toCommandInput(input) }); set((state) => ({ businessTags: state.businessTags.map((item) => item.id === id ? tag : item) })); return tag }
    catch (error) { set({ error: String(error) }); throw error }
  },
  deleteBusinessTag: async (id, companyId) => {
    try { await invoke('delete_business_tag', { id, companyId }); set((state) => ({ businessTags: state.businessTags.filter((item) => item.id !== id) })) }
    catch (error) { set({ error: String(error) }); throw error }
  },
}))

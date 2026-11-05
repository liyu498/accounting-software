import { create } from 'zustand'
import { invoke } from '../lib/tauri'

export interface CommonDigest {
  id: string
  company_id: string
  content: string
}

export interface VoucherTemplateType {
  id: string
  company_id: string
  name: string
  sort_order: number
}

export interface TemplateEntry {
  account_code: string
  account_name: string
  direction: string
  amount?: number | null
  summary: string
  auxiliary_type: string | null
  auxiliary_id: string | null
  auxiliary_items?: {
    auxiliary_category_id: string
    auxiliary_item_id: string
  }[]
  doc_number?: string | null
  quantity?: number | null
  unit_price?: number | null
  unit?: string | null
  currency_id?: string | null
  exchange_rate?: number | null
}

export interface VoucherTemplateWithEntries {
  template: {
    id: string
    type_id: string
    company_id: string
    name: string
    entries_json: string
  }
  entries: TemplateEntry[]
}

export interface VoucherTemplateInput {
  companyId: string
  typeId: string
  name: string
  entries: TemplateEntry[]
}

interface TemplateState {
  commonDigests: CommonDigest[]
  voucherTemplateTypes: VoucherTemplateType[]
  voucherTemplates: VoucherTemplateWithEntries[]
  isLoading: boolean
  error: string | null
  fetchTemplateWorkspace(companyId: string): Promise<void>
  createVoucherTemplateType(input: { companyId: string; name: string; sortOrder?: number }): Promise<VoucherTemplateType>
  createCommonDigest(input: { companyId: string; content: string }): Promise<CommonDigest>
  updateCommonDigest(input: { id: string; companyId: string; content: string }): Promise<CommonDigest>
  deleteCommonDigest(id: string, companyId: string): Promise<void>
  createVoucherTemplate(input: VoucherTemplateInput): Promise<VoucherTemplateWithEntries>
  updateVoucherTemplate(input: VoucherTemplateInput & { id: string }): Promise<VoucherTemplateWithEntries>
  deleteVoucherTemplate(id: string, companyId: string): Promise<void>
}

export const useTemplateStore = create<TemplateState>((set) => ({
  commonDigests: [],
  voucherTemplateTypes: [],
  voucherTemplates: [],
  isLoading: false,
  error: null,

  fetchTemplateWorkspace: async (companyId) => {
    set({ isLoading: true, error: null })
    try {
      const [commonDigests, voucherTemplateTypes] = await Promise.all([
        invoke<CommonDigest[]>('get_common_digests', { companyId }),
        invoke<VoucherTemplateType[]>('get_voucher_template_types', { companyId }),
      ])
      const groupedTemplates = await Promise.all(
        voucherTemplateTypes.map((templateType) => invoke<VoucherTemplateWithEntries[]>('get_voucher_templates', {
          typeId: templateType.id,
          companyId,
        })),
      )
      set({
        commonDigests,
        voucherTemplateTypes,
        voucherTemplates: groupedTemplates.flat(),
        isLoading: false,
      })
    } catch (error) {
      set({ error: String(error), isLoading: false })
    }
  },

  createVoucherTemplateType: async (input) => {
    const templateType = await invoke<VoucherTemplateType>('create_voucher_template_type', {
      input: { company_id: input.companyId, name: input.name, sort_order: input.sortOrder },
    })
    set((state) => ({ voucherTemplateTypes: [...state.voucherTemplateTypes, templateType].sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name)) }))
    return templateType
  },

  createCommonDigest: async (input) => {
    const digest = await invoke<CommonDigest>('create_common_digest', { input: { company_id: input.companyId, content: input.content } })
    set((state) => ({ commonDigests: [...state.commonDigests, digest].sort((left, right) => left.content.localeCompare(right.content)) }))
    return digest
  },

  updateCommonDigest: async (input) => {
    const digest = await invoke<CommonDigest>('update_common_digest', { id: input.id, input: { company_id: input.companyId, content: input.content } })
    set((state) => ({ commonDigests: state.commonDigests.map((item) => item.id === digest.id ? digest : item).sort((left, right) => left.content.localeCompare(right.content)) }))
    return digest
  },

  deleteCommonDigest: async (id, companyId) => {
    await invoke('delete_common_digest', { id, companyId })
    set((state) => ({ commonDigests: state.commonDigests.filter((item) => item.id !== id) }))
  },

  createVoucherTemplate: async (input) => {
    const template = await invoke<VoucherTemplateWithEntries['template']>('create_voucher_template', {
      input: { type_id: input.typeId, company_id: input.companyId, name: input.name, entries_json: JSON.stringify(input.entries) },
    })
    const result = { template, entries: input.entries }
    set((state) => ({ voucherTemplates: [...state.voucherTemplates, result] }))
    return result
  },

  updateVoucherTemplate: async (input) => {
    const template = await invoke<VoucherTemplateWithEntries['template']>('update_voucher_template', {
      id: input.id,
      input: { type_id: input.typeId, company_id: input.companyId, name: input.name, entries_json: JSON.stringify(input.entries) },
    })
    const result = { template, entries: input.entries }
    set((state) => ({ voucherTemplates: state.voucherTemplates.map((item) => item.template.id === template.id ? result : item) }))
    return result
  },

  deleteVoucherTemplate: async (id, companyId) => {
    await invoke('delete_voucher_template', { id, companyId })
    set((state) => ({ voucherTemplates: state.voucherTemplates.filter((item) => item.template.id !== id) }))
  },
}))

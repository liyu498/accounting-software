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
  summary: string
  auxiliary_type: string | null
  auxiliary_id: string | null
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

interface TemplateState {
  commonDigests: CommonDigest[]
  voucherTemplateTypes: VoucherTemplateType[]
  voucherTemplates: VoucherTemplateWithEntries[]
  isLoading: boolean
  error: string | null
  fetchTemplateWorkspace(companyId: string): Promise<void>
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
}))

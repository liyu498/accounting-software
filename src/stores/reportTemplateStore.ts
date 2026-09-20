import { create } from 'zustand'
import { invoke } from '../lib/tauri'

export interface ReportTemplate {
  id: string
  template_code: string
  template_name: string
  report_type: string
  is_system: number
  created_at: string | null
}

export interface ReportItem {
  id: string
  template_id: string
  item_code: string
  item_name: string
  parent_id: string | null
  item_level: number
  sort_order: number
  is_total: number
  formula: string | null
  is_enabled: number
}

interface ReportTemplateState {
  reportTemplates: ReportTemplate[]
  reportItems: ReportItem[]
  isLoading: boolean
  error: string | null
  fetchReportTemplateWorkspace(companyId: string): Promise<void>
  createReportItem(input: { companyId: string; templateId: string; itemCode: string; itemName: string; itemLevel: number; sortOrder: number; isTotal: number; formula: string }): Promise<ReportItem>
  updateReportItem(input: { id: string; companyId: string; itemName: string; formula: string; sortOrder: number; isTotal: number }): Promise<ReportItem>
}

export const useReportTemplateStore = create<ReportTemplateState>((set) => ({
  reportTemplates: [],
  reportItems: [],
  isLoading: false,
  error: null,

  fetchReportTemplateWorkspace: async (companyId) => {
    set({ isLoading: true, error: null })
    try {
      const reportTemplates = await invoke<ReportTemplate[]>('get_report_templates', { companyId })
      const itemGroups = await Promise.all(
        reportTemplates.map((template) => invoke<ReportItem[]>('get_report_items', {
          templateId: template.id,
          companyId,
        })),
      )
      set({ reportTemplates, reportItems: itemGroups.flat(), isLoading: false })
    } catch (error) {
      set({ error: String(error), isLoading: false })
    }
  },

  createReportItem: async (input) => {
    const item = await invoke<ReportItem>('create_report_item', {
      companyId: input.companyId,
      templateId: input.templateId,
      itemCode: input.itemCode,
      itemName: input.itemName,
      itemLevel: input.itemLevel,
      sortOrder: input.sortOrder,
      isTotal: input.isTotal,
      formula: input.formula,
    })
    set((state) => ({ reportItems: [...state.reportItems, item] }))
    return item
  },

  updateReportItem: async (input) => {
    const item = await invoke<ReportItem>('update_report_item', {
      companyId: input.companyId,
      input: {
        id: input.id,
        item_name: input.itemName,
        formula: input.formula,
        sort_order: input.sortOrder,
        is_total: input.isTotal,
      },
    })
    set((state) => ({ reportItems: state.reportItems.map((current) => current.id === item.id ? item : current) }))
    return item
  },
}))

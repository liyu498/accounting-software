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
}))

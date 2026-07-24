import { create } from 'zustand'
import { invoke } from '../lib/tauri'

export interface AssetCategory {
  id: string
  company_id: string
  code: string
  name: string
  useful_life_months: number
  residual_rate: number
  depreciation_method: string
  asset_account: string
  accumulated_depreciation_account: string
  expense_account: string | null
  is_enabled: number
  created_at: string
  updated_at: string
}

export interface AssetCategoryInput {
  companyId: string
  code: string
  name: string
  usefulLifeMonths: number
  residualRate: number
  depreciationMethod: string
  assetAccount: string
  accumulatedDepreciationAccount: string
  expenseAccount?: string
  isEnabled?: boolean
}

interface AssetCategoryState {
  assetCategories: AssetCategory[]
  isLoading: boolean
  error: string | null
  fetchAssetCategories: (companyId: string) => Promise<void>
  createAssetCategory: (input: AssetCategoryInput) => Promise<AssetCategory>
  updateAssetCategory: (id: string, input: AssetCategoryInput) => Promise<AssetCategory>
  deleteAssetCategory: (id: string, companyId: string) => Promise<void>
  toggleAssetCategory: (id: string, companyId: string) => Promise<AssetCategory>
}

const toCommandInput = (input: AssetCategoryInput) => ({
  company_id: input.companyId, code: input.code, name: input.name,
  useful_life_months: input.usefulLifeMonths, residual_rate: input.residualRate,
  depreciation_method: input.depreciationMethod, asset_account: input.assetAccount,
  accumulated_depreciation_account: input.accumulatedDepreciationAccount,
  expense_account: input.expenseAccount,
  is_enabled: input.isEnabled === undefined ? undefined : input.isEnabled ? 1 : 0,
})

export const useAssetCategoryStore = create<AssetCategoryState>((set) => ({
  assetCategories: [], isLoading: false, error: null,
  fetchAssetCategories: async (companyId) => {
    set({ isLoading: true, error: null })
    try { set({ assetCategories: await invoke<AssetCategory[]>('get_asset_categories', { companyId }), isLoading: false }) }
    catch (error) { set({ error: String(error), isLoading: false }) }
  },
  createAssetCategory: async (input) => {
    try { const category = await invoke<AssetCategory>('create_asset_category', { input: toCommandInput(input) }); set((state) => ({ assetCategories: [...state.assetCategories, category] })); return category }
    catch (error) { set({ error: String(error) }); throw error }
  },
  updateAssetCategory: async (id, input) => {
    try { const category = await invoke<AssetCategory>('update_asset_category', { id, input: toCommandInput(input) }); set((state) => ({ assetCategories: state.assetCategories.map((item) => item.id === id ? category : item) })); return category }
    catch (error) { set({ error: String(error) }); throw error }
  },
  deleteAssetCategory: async (id, companyId) => {
    try { await invoke('delete_asset_category', { id, companyId }); set((state) => ({ assetCategories: state.assetCategories.filter((item) => item.id !== id) })) }
    catch (error) { set({ error: String(error) }); throw error }
  },
  toggleAssetCategory: async (id, companyId) => {
    try { const category = await invoke<AssetCategory>('toggle_asset_category', { id, companyId }); set((state) => ({ assetCategories: state.assetCategories.map((item) => item.id === id ? category : item) })); return category }
    catch (error) { set({ error: String(error) }); throw error }
  },
}))

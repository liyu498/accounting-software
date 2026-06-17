import { create } from 'zustand'
import { accountingApi } from '../services/accountingApi'
import type { AccountingPeriod, Company } from '../services/types'

type CompanyState = {
  companies: Company[]
  selectedCompany: Company | null
  periods: AccountingPeriod[]
  selectedPeriodId: string | null
  loadCompanies: () => Promise<void>
  selectCompany: (companyId: string) => Promise<void>
  selectPeriod: (periodId: string) => void
}

export const useCompanyStore = create<CompanyState>((set) => ({
  companies: [],
  selectedCompany: null,
  periods: [],
  selectedPeriodId: null,
  async loadCompanies() {
    const companies = await accountingApi.listCompanies()
    set((state) => ({
      companies,
      selectedCompany:
        state.selectedCompany ? companies.find((item) => item.id === state.selectedCompany?.id) ?? null : null,
    }))
  },
  async selectCompany(companyId) {
    const selectedCompany = await accountingApi.selectCompany(companyId)
    const periods = await accountingApi.listPeriods(companyId)

    set({
      selectedCompany,
      periods,
      selectedPeriodId: selectedCompany.currentPeriodId,
    })
  },
  selectPeriod(periodId) {
    set({ selectedPeriodId: periodId })
  },
}))

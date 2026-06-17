import { beforeEach, expect, test } from 'vitest'
import { companies, periods } from '../mocks/seed'
import { useCompanyStore } from './companyStore'
import { useSessionStore } from './sessionStore'

beforeEach(() => {
  useSessionStore.setState({ session: null })
  useCompanyStore.setState({
    companies: [],
    selectedCompany: null,
    periods: [],
    selectedPeriodId: null,
  })
})

test('logout clears the selected company and period state', () => {
  useCompanyStore.setState({
    companies,
    selectedCompany: companies[0],
    periods,
    selectedPeriodId: periods[0].id,
  })

  useSessionStore.getState().logout()

  expect(useCompanyStore.getState().selectedCompany).toBeNull()
  expect(useCompanyStore.getState().selectedPeriodId).toBeNull()
})

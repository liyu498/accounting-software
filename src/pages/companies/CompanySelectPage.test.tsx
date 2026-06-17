import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, test } from 'vitest'
import { companies } from '../../mocks/seed'
import { useCompanyStore } from '../../stores/companyStore'
import { CompanySelectPage } from './CompanySelectPage'

beforeEach(() => {
  useCompanyStore.setState({
    companies: [],
    selectedCompany: null,
    periods: [],
    selectedPeriodId: null,
  })
})

test('loads the demo company once after login', async () => {
  render(
    <MemoryRouter>
      <CompanySelectPage />
    </MemoryRouter>,
  )

  expect(await screen.findByText(companies[0].name)).toBeInTheDocument()
})

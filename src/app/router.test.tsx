import { render, screen, waitFor } from '@testing-library/react'
import { RouterProvider } from 'react-router-dom'
import { beforeEach, test } from 'vitest'
import { companies, adminSession, periods } from '../mocks/seed'
import { createAppRouter } from './router'
import { useCompanyStore } from '../stores/companyStore'
import { useSessionStore } from '../stores/sessionStore'

beforeEach(() => {
  useSessionStore.setState({ session: null })
  useCompanyStore.setState({
    companies: [],
    selectedCompany: null,
    periods: [],
    selectedPeriodId: null,
  })
})

test('redirects /companies to /dashboard when session and company are already selected', async () => {
  useSessionStore.setState({ session: adminSession })
  useCompanyStore.setState({
    companies,
    selectedCompany: companies[0],
    periods,
    selectedPeriodId: periods[0].id,
  })

  const router = createAppRouter({
    initialEntries: ['/companies'],
  })

  render(<RouterProvider router={router} />)

  await waitFor(() => {
    expect(router.state.location.pathname).toBe('/dashboard')
  })
  expect(await screen.findByRole('heading', { name: '工作台' })).toBeInTheDocument()
})

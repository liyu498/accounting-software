import { render, within } from '@testing-library/react'
import { App } from './App'

test('renders the local shell title and route menu', () => {
  const { getByRole, getByText } = render(<App />)

  expect(getByText('AI Account')).toBeInTheDocument()
  expect(getByText('Local scaffold')).toBeInTheDocument()
  expect(getByRole('heading', { name: 'Navigation scaffold' })).toBeInTheDocument()
  expect(getByText('Task 1 shell')).toBeInTheDocument()

  const menu = getByRole('menu')
  expect(within(menu).getByText('Dashboard')).toBeInTheDocument()
  expect(within(menu).getByText('Ledger')).toBeInTheDocument()
  expect(within(menu).getByText('Settings')).toBeInTheDocument()
})

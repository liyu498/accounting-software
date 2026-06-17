import { render } from '@testing-library/react'
import { App } from './App'

test('renders the login route when there is no session', () => {
  const { getByRole, getByText } = render(<App />)

  expect(getByText('AI Account')).toBeInTheDocument()
  expect(getByRole('heading', { name: '会计核心流程' })).toBeInTheDocument()
  expect(getByRole('heading', { name: '登录' })).toBeInTheDocument()
  expect(getByRole('button', { name: '登录' })).toBeInTheDocument()
})

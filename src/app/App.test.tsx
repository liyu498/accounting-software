import { render } from '@testing-library/react'
import { App } from './App'

test('renders the app title', () => {
  const { getByText } = render(<App />)

  expect(getByText('AI Account')).toBeInTheDocument()
})

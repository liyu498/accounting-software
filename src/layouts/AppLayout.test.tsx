import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { test } from 'vitest'
import { AppLayout } from './AppLayout'

test('renders core accounting navigation', () => {
  render(
    <MemoryRouter>
      <AppLayout />
    </MemoryRouter>,
  )

  expect(screen.getByText('宸ヤ綔鍙?')).toBeInTheDocument()
  expect(screen.getByText('鍑瘉')).toBeInTheDocument()
  expect(screen.getByText('璐︾翱')).toBeInTheDocument()
  expect(screen.getByText('鎶ヨ〃')).toBeInTheDocument()
})

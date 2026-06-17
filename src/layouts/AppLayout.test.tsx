import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { test } from 'vitest'
import { AppLayout } from './AppLayout'

test('renders core accounting navigation with readable Chinese labels', () => {
  render(
    <MemoryRouter>
      <AppLayout />
    </MemoryRouter>,
  )

  expect(screen.getByText('工作台')).toBeInTheDocument()
  expect(screen.getByText('凭证')).toBeInTheDocument()
  expect(screen.getByText('科目余额表')).toBeInTheDocument()
  expect(screen.getByText('总账')).toBeInTheDocument()
  expect(screen.getByText('明细账')).toBeInTheDocument()
  expect(screen.getByText('资产负债表')).toBeInTheDocument()
  expect(screen.getByText('利润表')).toBeInTheDocument()
})

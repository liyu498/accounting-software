import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VoucherEntryGrid } from './VoucherEntryGrid'

test('shows searchable account labels with code and name', async () => {
  const user = userEvent.setup()

  render(
    <VoucherEntryGrid
      entries={[
        {
          id: 'entry-1',
          summary: '采购办公用品',
          accountCode: '',
          accountName: '',
          debit: 0,
          credit: 0,
        },
        {
          id: 'entry-2',
          summary: '采购办公用品',
          accountCode: '',
          accountName: '',
          debit: 0,
          credit: 0,
        },
      ]}
      onChange={() => {}}
    />,
  )

  const trigger = screen.getAllByRole('combobox')[0]

  if (!trigger) {
    throw new Error('Account selector trigger not found')
  }

  fireEvent.mouseDown(trigger)

  await user.type(trigger, '银行')

  await waitFor(() => {
    expect(screen.getByText('1002 银行存款')).toBeInTheDocument()
  })
})

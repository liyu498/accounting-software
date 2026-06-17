import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExportActions } from './ExportActions'

test('triggers export success callback', async () => {
  const user = userEvent.setup()
  const onExport = vi.fn().mockResolvedValue(undefined)

  render(<ExportActions title="资产负债表" onExport={onExport} />)

  await user.click(screen.getByRole('button', { name: /导出/ }))
  await user.click(screen.getByText('Excel'))

  expect(onExport).toHaveBeenCalledWith('excel')
})

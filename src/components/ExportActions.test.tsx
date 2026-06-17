import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { message } from 'antd'
import { beforeEach, expect, test, vi } from 'vitest'
import { ExportActions } from './ExportActions'

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd')
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
    },
  }
})

beforeEach(() => {
  vi.mocked(message.success).mockReset()
  vi.mocked(message.error).mockReset()
})

test('triggers export success callback', async () => {
  const user = userEvent.setup()
  const onExport = vi.fn().mockResolvedValue(undefined)

  render(<ExportActions title="资产负债表" onExport={onExport} />)

  await user.click(screen.getByRole('button', { name: '导出' }))
  await user.click(screen.getByText('Excel'))

  expect(onExport).toHaveBeenCalledWith('excel')
})

test('shows a readable Chinese error toast when export fails', async () => {
  const user = userEvent.setup()
  const onExport = vi.fn().mockRejectedValue(new Error('导出服务暂时不可用'))

  render(<ExportActions title="资产负债表" onExport={onExport} />)

  await user.click(screen.getByRole('button', { name: '导出' }))
  await user.click(screen.getByText('PDF'))

  await waitFor(() => {
    expect(message.error).toHaveBeenCalledWith('导出服务暂时不可用')
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LoginPage } from './LoginPage'

test('submits mock credentials and shows no validation error', async () => {
  const user = userEvent.setup()

  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  )

  await user.type(screen.getByLabelText('用户名'), 'admin')
  await user.type(screen.getByLabelText('密码'), 'admin123')
  await user.click(screen.getByRole('button', { name: '登录' }))

  expect(await screen.findByText('登录成功')).toBeInTheDocument()
})

import { Alert, Button, Card, Form, Input, message, Typography } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../../stores/sessionStore'

type LoginFormValues = {
  username: string
  password: string
}

export function LoginPage() {
  const navigate = useNavigate()
  const login = useSessionStore((state) => state.login)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleFinish(values: LoginFormValues) {
    setSubmitting(true)
    setErrorMessage(null)

    try {
      await login(values)
      message.success('登录成功')
      navigate('/companies')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '登录失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="auth-card" variant="borderless">
      <Typography.Title level={3}>登录</Typography.Title>
      <Typography.Paragraph type="secondary">使用 mock 账号进入本地演示流程。</Typography.Paragraph>
      {errorMessage ? <Alert closable message={errorMessage} showIcon type="error" /> : null}
      <Form<LoginFormValues>
        layout="vertical"
        autoComplete="off"
        onFinish={handleFinish}
      >
        <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入用户名' }]}>
          <Input id="username" />
        </Form.Item>
        <Form.Item label="密码" name="password" rules={[{ required: true, message: '请输入密码' }]}>
          <Input.Password id="password" />
        </Form.Item>
        <Button aria-label="登录" block htmlType="submit" loading={submitting} type="primary">
          登录
        </Button>
      </Form>
    </Card>
  )
}

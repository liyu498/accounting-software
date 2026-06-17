import { Layout, Typography } from 'antd'
import { Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <Layout className="auth-layout">
      <Layout.Content className="auth-layout__content">
        <div className="auth-layout__hero">
          <Typography.Text className="auth-layout__eyebrow">AI Account</Typography.Text>
          <Typography.Title className="auth-layout__title" level={2}>
            会计核心流程
          </Typography.Title>
          <Typography.Paragraph className="auth-layout__copy">
            先完成登录和账套选择，再进入业务工作台。
          </Typography.Paragraph>
        </div>
        <div className="auth-layout__panel">
          <Outlet />
        </div>
      </Layout.Content>
    </Layout>
  )
}

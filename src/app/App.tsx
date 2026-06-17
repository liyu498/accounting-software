import {
  ApartmentOutlined,
  FileTextOutlined,
  PieChartOutlined,
} from '@ant-design/icons'
import { Layout, Menu, Typography } from 'antd'
import type { ReactNode } from 'react'

type RouteMeta = {
  key: string
  label: string
  path: string
  icon: ReactNode
}

const routeMetadata: RouteMeta[] = [
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: <PieChartOutlined /> },
  { key: 'ledger', label: 'Ledger', path: '/ledger', icon: <FileTextOutlined /> },
  { key: 'settings', label: 'Settings', path: '/settings', icon: <ApartmentOutlined /> },
]

const menuItems = routeMetadata.map(({ key, label, path, icon }) => ({
  key,
  label: (
    <span className="app-menu__item">
      <span>{label}</span>
      <Typography.Text className="app-menu__path" type="secondary">
        {path}
      </Typography.Text>
    </span>
  ),
  icon,
  title: path,
}))

export function App() {
  return (
    <Layout className="app-shell">
      <Layout.Sider className="app-sider" width={240}>
        <div className="app-brand">
          <Typography.Text className="app-brand__eyebrow">AI Account</Typography.Text>
          <Typography.Title className="app-brand__title" level={4}>
            Local scaffold
          </Typography.Title>
        </div>
        <Menu
          className="app-menu"
          mode="inline"
          items={menuItems}
          selectedKeys={[routeMetadata[0].key]}
        />
      </Layout.Sider>
      <Layout className="app-panel">
        <Layout.Header className="app-header">
          <Typography.Text type="secondary">Task 1 shell</Typography.Text>
        </Layout.Header>
        <Layout.Content className="app-content">
          <Typography.Title level={2} className="app-content__title">
            Navigation scaffold
          </Typography.Title>
          <Typography.Paragraph className="app-content__copy">
            The menu is driven by typed route metadata so the local shell can grow
            into the real app structure later.
          </Typography.Paragraph>
          <div className="app-route-list">
            {routeMetadata.map((route) => (
              <div className="app-route-row" key={route.key}>
                <span>{route.label}</span>
                <Typography.Text type="secondary">{route.path}</Typography.Text>
              </div>
            ))}
          </div>
        </Layout.Content>
      </Layout>
    </Layout>
  )
}

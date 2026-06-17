import {
  AppstoreOutlined,
  BookOutlined,
  FileTextOutlined,
  LogoutOutlined,
  SwapOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { Button, Dropdown, Layout, Menu, Space, Tag, Typography } from 'antd'
import { useMemo } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AccountingPeriodPicker } from '../components/AccountingPeriodPicker'
import { useCompanyStore } from '../stores/companyStore'
import { useSessionStore } from '../stores/sessionStore'

const menuItems = [
  { key: '/dashboard', icon: <AppstoreOutlined />, label: '宸ヤ綔鍙?' },
  { key: '/vouchers', icon: <UnorderedListOutlined />, label: '鍑瘉' },
  {
    key: 'ledgers',
    type: 'group' as const,
    label: '璐︾翱',
    children: [
      { key: '/ledgers/trial-balance', icon: <BookOutlined />, label: '绉戠洰浣欓琛?' },
      { key: '/ledgers/general', icon: <BookOutlined />, label: '鎬昏处' },
      { key: '/ledgers/subsidiary', icon: <BookOutlined />, label: '鏄庣粏璐?' },
    ],
  },
  {
    key: 'reports',
    type: 'group' as const,
    label: '鎶ヨ〃',
    children: [
      { key: '/reports/balance-sheet', icon: <FileTextOutlined />, label: '璧勪骇璐熷€鸿〃' },
      { key: '/reports/income-statement', icon: <FileTextOutlined />, label: '鍒╂鼎琛?' },
    ],
  },
]

const protectedPaths = [
  '/dashboard',
  '/vouchers',
  '/ledgers/trial-balance',
  '/ledgers/general',
  '/ledgers/subsidiary',
  '/reports/balance-sheet',
  '/reports/income-statement',
]

export function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const selectedCompany = useCompanyStore((state) => state.selectedCompany)
  const selectedPeriodId = useCompanyStore((state) => state.selectedPeriodId)
  const resetCompany = useCompanyStore((state) => state.reset)
  const logout = useSessionStore((state) => state.logout)

  const selectedKeys = useMemo(() => {
    const matchedPath = protectedPaths.find((path) => location.pathname.startsWith(path))
    return matchedPath ? [matchedPath] : ['/dashboard']
  }, [location.pathname])

  const companyActions = [
    {
      key: 'switch-company',
      icon: <SwapOutlined />,
      label: '鍒囨崲璐﹀',
      onClick: () => {
        resetCompany()
        navigate('/companies')
      },
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '閫€鍑虹櫥褰?',
      onClick: () => {
        logout()
        navigate('/login')
      },
    },
  ]

  return (
    <Layout className="app-shell">
      <Layout.Sider breakpoint="lg" className="app-sider" collapsible width={252}>
        <div className="app-brand">
          <Typography.Text className="app-brand__eyebrow">AI Account</Typography.Text>
          <Typography.Title className="app-brand__title" level={4}>
            {selectedCompany?.name ?? '璐﹀姟宸ヤ綔鍙?'}
          </Typography.Title>
          <Tag color="blue" variant="filled">
            {selectedPeriodId ?? '鏈€夋嫨鏈熼棿'}
          </Tag>
        </div>
        <Menu
          className="app-menu"
          items={menuItems}
          mode="inline"
          selectedKeys={selectedKeys}
          onClick={({ key }) => {
            if (typeof key === 'string' && key.startsWith('/')) {
              navigate(key)
            }
          }}
        />
      </Layout.Sider>
      <Layout className="app-panel">
        <Layout.Header className="app-header">
          <Space size={12}>
            <AccountingPeriodPicker />
            <Dropdown menu={{ items: companyActions }} trigger={['click']}>
              <Button>{selectedCompany?.code ?? 'company'}</Button>
            </Dropdown>
          </Space>
        </Layout.Header>
        <Layout.Content className="app-content">
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  )
}

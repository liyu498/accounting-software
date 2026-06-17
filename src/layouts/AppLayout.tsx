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
  { key: '/dashboard', icon: <AppstoreOutlined />, label: '工作台' },
  { key: '/vouchers', icon: <UnorderedListOutlined />, label: '凭证' },
  {
    key: 'ledgers',
    type: 'group' as const,
    label: '账簿',
    children: [
      { key: '/ledgers/trial-balance', icon: <BookOutlined />, label: '科目余额表' },
      { key: '/ledgers/general', icon: <BookOutlined />, label: '总账' },
      { key: '/ledgers/subsidiary', icon: <BookOutlined />, label: '明细账' },
    ],
  },
  {
    key: 'reports',
    type: 'group' as const,
    label: '报表',
    children: [
      { key: '/reports/balance-sheet', icon: <FileTextOutlined />, label: '资产负债表' },
      { key: '/reports/income-statement', icon: <FileTextOutlined />, label: '利润表' },
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
  const periods = useCompanyStore((state) => state.periods)
  const selectedPeriodId = useCompanyStore((state) => state.selectedPeriodId)
  const resetCompany = useCompanyStore((state) => state.reset)
  const logout = useSessionStore((state) => state.logout)

  const selectedKeys = useMemo(() => {
    const matchedPath = protectedPaths.find((path) => location.pathname.startsWith(path))
    return matchedPath ? [matchedPath] : ['/dashboard']
  }, [location.pathname])

  const selectedPeriodLabel = useMemo(() => {
    const selectedPeriod = periods.find((period) => period.id === selectedPeriodId)
    return selectedPeriod ? `${selectedPeriod.year}-${String(selectedPeriod.month).padStart(2, '0')}` : '未选择'
  }, [periods, selectedPeriodId])

  const companyActions = [
    {
      key: 'switch-company',
      icon: <SwapOutlined />,
      label: '切换账套',
      onClick: () => {
        resetCompany()
        navigate('/companies')
      },
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
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
          <Typography.Text type="secondary">当前账套</Typography.Text>
          <Typography.Title className="app-brand__title" level={4}>
            {selectedCompany?.name ?? '未选择'}
          </Typography.Title>
          <Typography.Text type="secondary">当前期间</Typography.Text>
          <Tag color="blue" variant="filled">
            {selectedPeriodLabel}
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
              <Button>{selectedCompany?.code ?? '未选择'}</Button>
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

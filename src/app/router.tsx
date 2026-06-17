import { Card, Space, Typography } from 'antd'
import { createBrowserRouter, createMemoryRouter, Navigate, Outlet, type RouteObject } from 'react-router-dom'
import { ExportActions } from '../components/ExportActions'
import { AppLayout } from '../layouts/AppLayout'
import { AuthLayout } from '../layouts/AuthLayout'
import { CompanySelectPage } from '../pages/companies/CompanySelectPage'
import { DashboardPage } from '../pages/dashboard/DashboardPage'
import { LoginPage } from '../pages/login/LoginPage'
import { useCompanyStore } from '../stores/companyStore'
import { useSessionStore } from '../stores/sessionStore'

function PlaceholderPage({ title, copy }: { title: string; copy: string }) {
  return (
    <Card>
      <Space className="placeholder-page" direction="vertical" size={16}>
        <div>
          <Typography.Title level={2}>{title}</Typography.Title>
          <Typography.Paragraph type="secondary">{copy}</Typography.Paragraph>
        </div>
        <ExportActions title={title} type="report" />
      </Space>
    </Card>
  )
}

function RootRedirect() {
  const session = useSessionStore((state) => state.session)
  const selectedCompany = useCompanyStore((state) => state.selectedCompany)

  if (!session) {
    return <Navigate replace to="/login" />
  }

  if (!selectedCompany) {
    return <Navigate replace to="/companies" />
  }

  return <Navigate replace to="/dashboard" />
}

function RequireCompany() {
  const session = useSessionStore((state) => state.session)
  const selectedCompany = useCompanyStore((state) => state.selectedCompany)

  if (!session) {
    return <Navigate replace to="/login" />
  }

  if (!selectedCompany) {
    return <Navigate replace to="/companies" />
  }

  return <Outlet />
}

function LoginRoute() {
  const session = useSessionStore((state) => state.session)
  const selectedCompany = useCompanyStore((state) => state.selectedCompany)

  if (session && selectedCompany) {
    return <Navigate replace to="/dashboard" />
  }

  if (session) {
    return <Navigate replace to="/companies" />
  }

  return <LoginPage />
}

function CompanyRoute() {
  const session = useSessionStore((state) => state.session)
  const selectedCompany = useCompanyStore((state) => state.selectedCompany)

  if (!session) {
    return <Navigate replace to="/login" />
  }

  if (selectedCompany) {
    return <Navigate replace to="/dashboard" />
  }

  return <CompanySelectPage />
}

const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <RootRedirect />,
  },
  {
    element: <AuthLayout />,
    children: [
      {
        path: '/login',
        element: <LoginRoute />,
      },
    ],
  },
  {
    path: '/companies',
    element: <CompanyRoute />,
  },
  {
    element: <RequireCompany />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: '/dashboard',
            element: <DashboardPage />,
          },
          {
            path: '/vouchers',
            element: <PlaceholderPage copy="凭证列表与编辑功能将在后续任务中完成。" title="凭证" />,
          },
          {
            path: '/ledgers/trial-balance',
            element: <PlaceholderPage copy="科目余额表将在后续任务中完成。" title="科目余额表" />,
          },
          {
            path: '/ledgers/general',
            element: <PlaceholderPage copy="总账功能将在后续任务中完成。" title="总账" />,
          },
          {
            path: '/ledgers/subsidiary',
            element: <PlaceholderPage copy="明细账功能将在后续任务中完成。" title="明细账" />,
          },
          {
            path: '/reports/balance-sheet',
            element: <PlaceholderPage copy="资产负债表将在后续任务中完成。" title="资产负债表" />,
          },
          {
            path: '/reports/income-statement',
            element: <PlaceholderPage copy="利润表将在后续任务中完成。" title="利润表" />,
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <RootRedirect />,
  },
]

export function createAppRouter(options?: { initialEntries?: string[] }) {
  if (options?.initialEntries) {
    return createMemoryRouter(appRoutes, {
      initialEntries: options.initialEntries,
    })
  }

  return createBrowserRouter(appRoutes)
}

export const appRouter = createAppRouter()

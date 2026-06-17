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
            element: <PlaceholderPage copy="鍑瘉鍒楄〃涓庣紪杈戝姛鑳藉皢鍦ㄥ悗缁换鍔′腑瀹屾垚銆?" title="鍑瘉" />,
          },
          {
            path: '/ledgers/trial-balance',
            element: <PlaceholderPage copy="绉戠洰浣欓琛ㄥ皢鍦ㄥ悗缁换鍔′腑瀹屾垚銆?" title="绉戠洰浣欓琛?" />,
          },
          {
            path: '/ledgers/general',
            element: <PlaceholderPage copy="鎬昏处鍔熻兘鍦ㄥ悗缁换鍔′腑瀹屾垚銆?" title="鎬昏处" />,
          },
          {
            path: '/ledgers/subsidiary',
            element: <PlaceholderPage copy="鏄庣粏璐﹀姛鑳藉皢鍦ㄥ悗缁换鍔′腑瀹屾垚銆?" title="鏄庣粏璐?" />,
          },
          {
            path: '/reports/balance-sheet',
            element: <PlaceholderPage copy="璧勪骇璐熷€鸿〃灏嗗湪鍚庣画浠诲姟涓畬鎴愩€?" title="璧勪骇璐熷€鸿〃" />,
          },
          {
            path: '/reports/income-statement',
            element: <PlaceholderPage copy="鍒╂鼎琛ㄥ皢鍦ㄥ悗缁换鍔′腑瀹屾垚銆?" title="鍒╂鼎琛?" />,
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

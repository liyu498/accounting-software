import { Card, Typography } from 'antd'
import { createBrowserRouter, createMemoryRouter, Navigate, Outlet, type RouteObject } from 'react-router-dom'
import { AuthLayout } from '../layouts/AuthLayout'
import { CompanySelectPage } from '../pages/companies/CompanySelectPage'
import { LoginPage } from '../pages/login/LoginPage'
import { useCompanyStore } from '../stores/companyStore'
import { useSessionStore } from '../stores/sessionStore'

function DashboardPlaceholder() {
  const company = useCompanyStore((state) => state.selectedCompany)
  const selectedPeriodId = useCompanyStore((state) => state.selectedPeriodId)

  return (
    <Card className="dashboard-placeholder">
      <Typography.Title level={2}>Dashboard</Typography.Title>
      <Typography.Paragraph>
        当前账套：{company?.name ?? '未选择'}
      </Typography.Paragraph>
      <Typography.Paragraph type="secondary">
        当前期间：{selectedPeriodId ?? '未选择'}
      </Typography.Paragraph>
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

function RequireSession() {
  const session = useSessionStore((state) => state.session)

  if (!session) {
    return <Navigate replace to="/login" />
  }

  return <Outlet />
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
        path: '/dashboard',
        element: <DashboardPlaceholder />,
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

import { createBrowserRouter, createMemoryRouter, Navigate, Outlet, type RouteObject } from 'react-router-dom'
import { AppLayout } from '../layouts/AppLayout'
import { AuthLayout } from '../layouts/AuthLayout'
import { CompanySelectPage } from '../pages/companies/CompanySelectPage'
import { DashboardPage } from '../pages/dashboard/DashboardPage'
import { GeneralLedgerPage } from '../pages/ledgers/GeneralLedgerPage'
import { SubsidiaryLedgerPage } from '../pages/ledgers/SubsidiaryLedgerPage'
import { TrialBalancePage } from '../pages/ledgers/TrialBalancePage'
import { LoginPage } from '../pages/login/LoginPage'
import { BalanceSheetPage } from '../pages/reports/BalanceSheetPage'
import { IncomeStatementPage } from '../pages/reports/IncomeStatementPage'
import { VoucherDetailPage } from '../pages/vouchers/VoucherDetailPage'
import { VoucherEditorPage } from '../pages/vouchers/VoucherEditorPage'
import { VoucherListPage } from '../pages/vouchers/VoucherListPage'
import { useCompanyStore } from '../stores/companyStore'
import { useSessionStore } from '../stores/sessionStore'

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
            element: <VoucherListPage />,
          },
          {
            path: '/vouchers/new',
            element: <VoucherEditorPage />,
          },
          {
            path: '/vouchers/:id',
            element: <VoucherDetailPage />,
          },
          {
            path: '/vouchers/:id/edit',
            element: <VoucherEditorPage />,
          },
          {
            path: '/ledgers/trial-balance',
            element: <TrialBalancePage />,
          },
          {
            path: '/ledgers/general',
            element: <GeneralLedgerPage />,
          },
          {
            path: '/ledgers/subsidiary',
            element: <SubsidiaryLedgerPage />,
          },
          {
            path: '/reports/balance-sheet',
            element: <BalanceSheetPage />,
          },
          {
            path: '/reports/income-statement',
            element: <IncomeStatementPage />,
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

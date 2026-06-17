import type { AccountingApi, VoucherSummary } from '../../services/types'

export type DashboardData = {
  recentVouchers: VoucherSummary[]
  total: number
  approvedCount: number
  draftCount: number
}

type DashboardQuery = {
  companyId: string
  periodId: string
}

export async function loadDashboardData(
  api: Pick<AccountingApi, 'listVouchers'>,
  query: DashboardQuery,
): Promise<DashboardData> {
  const [recent, approved, draft] = await Promise.all([
    api.listVouchers({
      companyId: query.companyId,
      periodId: query.periodId,
      page: 1,
      pageSize: 20,
    }),
    api.listVouchers({
      companyId: query.companyId,
      periodId: query.periodId,
      status: 'approved',
      page: 1,
      pageSize: 1,
    }),
    api.listVouchers({
      companyId: query.companyId,
      periodId: query.periodId,
      status: 'draft',
      page: 1,
      pageSize: 1,
    }),
  ])

  return {
    recentVouchers: recent.items,
    total: recent.total,
    approvedCount: approved.total,
    draftCount: draft.total,
  }
}

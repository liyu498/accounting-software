import { describe, expect, test, vi } from 'vitest'
import type { AccountingApi, PagedResult, VoucherQuery, VoucherSummary } from '../../services/types'
import { loadDashboardData } from './dashboardData'

function createPagedResult(items: VoucherSummary[], total: number): PagedResult<VoucherSummary> {
  return { items, total }
}

const recentVoucher: VoucherSummary = {
  id: 'voucher-1',
  companyId: 'company-1',
  periodId: 'period-2026-06',
  voucherDate: '2026-06-10',
  voucherNumber: '记-0001',
  summary: '收入确认',
  debitTotal: 500,
  creditTotal: 500,
  status: 'approved',
  createdBy: 'admin',
}

describe('loadDashboardData', () => {
  test('loads recent vouchers separately from accurate status totals', async () => {
    const listVouchers = vi.fn(async (query: VoucherQuery): Promise<PagedResult<VoucherSummary>> => {
      if (query.status === 'approved') {
        return createPagedResult([recentVoucher], 28)
      }

      if (query.status === 'draft') {
        return createPagedResult([], 7)
      }

      return createPagedResult([recentVoucher], 35)
    })

    const api = {
      listVouchers,
    } as Pick<AccountingApi, 'listVouchers'>

    await expect(loadDashboardData(api, { companyId: 'company-1', periodId: 'period-2026-06' })).resolves.toEqual({
      recentVouchers: [recentVoucher],
      total: 35,
      approvedCount: 28,
      draftCount: 7,
    })

    expect(listVouchers).toHaveBeenNthCalledWith(1, {
      companyId: 'company-1',
      periodId: 'period-2026-06',
      page: 1,
      pageSize: 20,
    })
    expect(listVouchers).toHaveBeenNthCalledWith(2, {
      companyId: 'company-1',
      periodId: 'period-2026-06',
      status: 'approved',
      page: 1,
      pageSize: 1,
    })
    expect(listVouchers).toHaveBeenNthCalledWith(3, {
      companyId: 'company-1',
      periodId: 'period-2026-06',
      status: 'draft',
      page: 1,
      pageSize: 1,
    })
  })
})

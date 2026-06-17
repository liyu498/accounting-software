import dayjs from 'dayjs'
import { describe, expect, test } from 'vitest'
import { buildVoucherListQuery } from './voucherListQuery'

describe('voucherListQuery', () => {
  test('builds a paginated API query from the current page, page size, and server-side filters', () => {
    expect(
      buildVoucherListQuery({
        companyId: 'company-1',
        periodId: 'period-2026-06',
        page: 3,
        pageSize: 25,
        filters: {
          keyword: '  service income  ',
          status: 'approved',
          voucherDate: dayjs('2026-06-10'),
        },
      }),
    ).toEqual({
      companyId: 'company-1',
      periodId: 'period-2026-06',
      keyword: 'service income',
      status: 'approved',
      startDate: '2026-06-10',
      endDate: '2026-06-10',
      page: 3,
      pageSize: 25,
    })
  })
})

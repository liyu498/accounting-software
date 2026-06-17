import dayjs from 'dayjs'
import { describe, expect, test } from 'vitest'
import {
  buildVoucherListQuery,
  filterVoucherPageItems,
  getVoucherListFilterMeta,
} from './voucherListQuery'

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
      page: 3,
      pageSize: 25,
    })
  })

  test('documents when client-side date filtering is active so the page can reset safely', () => {
    expect(
      getVoucherListFilterMeta({
        keyword: 'service income',
        status: 'all',
        voucherDate: dayjs('2026-06-10'),
      }),
    ).toMatchObject({
      shouldResetPage: true,
      clientDateFilter: '2026-06-10',
      notice: expect.stringContaining('当前页'),
    })
  })

  test('filters the fetched page by voucher date without reshaping unrelated rows', () => {
    expect(
      filterVoucherPageItems(
        [
          {
            id: 'voucher-1',
            companyId: 'company-1',
            periodId: 'period-2026-06',
            voucherDate: '2026-06-10',
            voucherNumber: '记-0001',
            summary: '服务收入',
            debitTotal: 500,
            creditTotal: 500,
            status: 'approved',
            createdBy: 'admin',
          },
          {
            id: 'voucher-2',
            companyId: 'company-1',
            periodId: 'period-2026-06',
            voucherDate: '2026-06-11',
            voucherNumber: '记-0002',
            summary: '办公用品采购',
            debitTotal: 120,
            creditTotal: 120,
            status: 'draft',
            createdBy: 'admin',
          },
        ],
        {
          keyword: undefined,
          status: 'all',
          voucherDate: dayjs('2026-06-10'),
        },
      ),
    ).toEqual([
      expect.objectContaining({
        id: 'voucher-1',
      }),
    ])
  })
})

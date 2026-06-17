import type { Dayjs } from 'dayjs'
import type { VoucherQuery, VoucherStatus } from '../../services/types'

export type VoucherListFilters = {
  keyword?: string
  status?: VoucherStatus | 'all'
  voucherDate?: Dayjs | null
}

type BuildVoucherListQueryInput = {
  companyId: string
  periodId: string
  page: number
  pageSize: number
  filters: VoucherListFilters
}

export function buildVoucherListQuery(input: BuildVoucherListQueryInput): VoucherQuery {
  const voucherDate = input.filters.voucherDate?.format('YYYY-MM-DD')

  return {
    companyId: input.companyId,
    periodId: input.periodId,
    status: input.filters.status ?? 'all',
    keyword: input.filters.keyword?.trim() || undefined,
    startDate: voucherDate,
    endDate: voucherDate,
    page: input.page,
    pageSize: input.pageSize,
  }
}

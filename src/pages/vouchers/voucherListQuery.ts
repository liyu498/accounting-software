import type { Dayjs } from 'dayjs'
import type { VoucherQuery, VoucherStatus, VoucherSummary } from '../../services/types'

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
  return {
    companyId: input.companyId,
    periodId: input.periodId,
    status: input.filters.status ?? 'all',
    keyword: input.filters.keyword?.trim() || undefined,
    page: input.page,
    pageSize: input.pageSize,
  }
}

export function filterVoucherPageItems(items: VoucherSummary[], filters: VoucherListFilters): VoucherSummary[] {
  const dateFilter = filters.voucherDate?.format('YYYY-MM-DD')

  if (!dateFilter) {
    return items
  }

  return items.filter((item) => item.voucherDate === dateFilter)
}

export function getVoucherListFilterMeta(filters: VoucherListFilters) {
  const clientDateFilter = filters.voucherDate?.format('YYYY-MM-DD') ?? null

  return {
    clientDateFilter,
    shouldResetPage: Boolean(clientDateFilter),
    notice: clientDateFilter
      ? '凭证日期筛选暂按当前页结果过滤，已自动回到第 1 页以避免遗漏服务器分页之外的数据。'
      : null,
  }
}

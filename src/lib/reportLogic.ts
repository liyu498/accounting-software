import type {
  AccountingPeriod,
  CashFlowItem,
  CashFlowResult,
  GeneralLedgerItem,
  IncomeStatementItem,
  IncomeStatementResult,
} from '../stores/periodStore'

type PeriodIdentity = Pick<AccountingPeriod, 'id' | 'company_id' | 'period_year' | 'period_month'>

export function quarterPeriods<T extends PeriodIdentity>(periods: readonly T[], currentPeriodId: string): T[] {
  const current = periods.find((period) => period.id === currentPeriodId)
  if (!current) return []
  const quarterStart = Math.floor((current.period_month - 1) / 3) * 3 + 1
  return periods
    .filter((period) => (
      period.company_id === current.company_id
      && period.period_year === current.period_year
      && period.period_month >= quarterStart
      && period.period_month <= current.period_month
    ))
    .sort((left, right) => left.period_month - right.period_month)
}

function aggregateItems<T extends { item_code: string; item_level: number; current_amount: number; year_to_date: number }>(
  reports: readonly { items: readonly T[] }[],
): T[] {
  const rows = new Map<string, T>()
  for (const report of reports) {
    for (const item of report.items) {
      const key = `${item.item_code}\u0000${item.item_level}`
      const existing = rows.get(key)
      rows.set(key, {
        ...(existing || item),
        ...item,
        current_amount: (existing?.current_amount || 0) + item.current_amount,
        year_to_date: item.year_to_date,
      })
    }
  }
  return [...rows.values()]
}

export function aggregateIncomeQuarter(reports: readonly IncomeStatementResult[]): IncomeStatementResult {
  if (reports.length === 0) throw new Error('季度范围内没有利润表账期')
  const latest = reports[reports.length - 1]
  const latestItems = new Map(latest.items.map((item) => [item.item_code, item]))
  const items = aggregateItems<IncomeStatementItem>(reports).map((item) => {
    const latestItem = latestItems.get(item.item_code)
    return {
      ...item,
      current_unrestricted_amount: reports.reduce(
        (sum, report) => sum + (report.items.find((candidate) => candidate.item_code === item.item_code)?.current_unrestricted_amount || 0),
        0,
      ),
      current_restricted_amount: reports.reduce(
        (sum, report) => sum + (report.items.find((candidate) => candidate.item_code === item.item_code)?.current_restricted_amount || 0),
        0,
      ),
      ytd_unrestricted_amount: latestItem?.ytd_unrestricted_amount || 0,
      ytd_restricted_amount: latestItem?.ytd_restricted_amount || 0,
    }
  })
  return {
    ...latest,
    items,
    current_period_total: reports.reduce((sum, report) => sum + report.current_period_total, 0),
    year_to_date_total: latest.year_to_date_total,
  }
}

export function aggregateCashFlowQuarter(reports: readonly CashFlowResult[]): CashFlowResult {
  if (reports.length === 0) throw new Error('季度范围内没有现金流量表账期')
  const latest = reports[reports.length - 1]
  const latestItems = new Map(latest.items.map((item) => [item.item_code, item]))
  const items = aggregateItems<CashFlowItem>(reports).map((item) => {
    if (item.item_code !== 'CF999') return item
    const latestItem = latestItems.get(item.item_code)
    return latestItem ? { ...item, ...latestItem } : item
  })
  const openingCashBalance = reports[0].opening_cash_balance
  const endingCashBalance = latest.ending_cash_balance
  const netIncrease = reports.reduce((sum, report) => sum + report.net_increase, 0)
  const cashBalanceChange = endingCashBalance - openingCashBalance
  const reconciliationDifference = cashBalanceChange - netIncrease
  const classificationMode = reports.every((report) => report.classification_mode === 'voucher_mapping')
    ? 'voucher_mapping'
    : 'account_formula'
  const unmappedCashAmount = reports.reduce(
    (sum, report) => sum + report.unmapped_cash_amount,
    0,
  )
  const unmappedVoucherCount = reports.reduce(
    (sum, report) => sum + report.unmapped_voucher_count,
    0,
  )
  const mappingConflictCount = reports.reduce(
    (sum, report) => sum + report.mapping_conflict_count,
    0,
  )
  const isClassificationComplete = classificationMode === 'voucher_mapping'
    && reports.every((report) => report.is_classification_complete)
  return {
    ...latest,
    items,
    net_increase: netIncrease,
    net_increase_year_to_date: latest.net_increase_year_to_date,
    opening_cash_balance: openingCashBalance,
    ending_cash_balance: endingCashBalance,
    cash_balance_change: cashBalanceChange,
    reconciliation_difference: reconciliationDifference,
    classification_mode: classificationMode,
    unmapped_cash_amount: unmappedCashAmount,
    unmapped_cash_amount_year_to_date: latest.unmapped_cash_amount_year_to_date,
    unmapped_voucher_count: unmappedVoucherCount,
    mapping_conflict_count: mappingConflictCount,
    is_classification_complete: isClassificationComplete,
    is_reconciled: Math.abs(reconciliationDifference) < 0.01
      && Math.abs(latest.reconciliation_difference_year_to_date) < 0.01
      && (classificationMode !== 'voucher_mapping' || isClassificationComplete),
  }
}

export function ledgerClosingDirection(item: Pick<GeneralLedgerItem, 'closing_debit' | 'closing_credit'>) {
  if (item.closing_debit > 0.005) return '借'
  if (item.closing_credit > 0.005) return '贷'
  return '平'
}

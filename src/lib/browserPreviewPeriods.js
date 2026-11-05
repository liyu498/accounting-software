function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function buildPeriod(companyId, year, month, now) {
  const paddedMonth = String(month).padStart(2, '0')
  const timestamp = now.toISOString()
  return {
    id: `browser-period-${companyId}-${year}-${paddedMonth}`,
    company_id: companyId,
    period_year: year,
    period_month: month,
    start_date: `${year}-${paddedMonth}-01`,
    end_date: `${year}-${paddedMonth}-${daysInMonth(year, month)}`,
    status: 'open',
    closed_at: null,
    closed_by: null,
    created_at: timestamp,
    updated_at: timestamp,
  }
}

export function findLatestOpenBrowserPreviewPeriod(periods, companyId) {
  return periods
    .filter(
      (period) => period.company_id === companyId && period.status !== 'closed',
    )
    .sort(
      (left, right) =>
        right.period_year - left.period_year
        || right.period_month - left.period_month,
    )[0]
}

export function ensureBrowserPreviewPeriods({ company, periods, now = new Date() }) {
  const year = Number.isInteger(company.enable_year) && company.enable_year > 0
    ? company.enable_year
    : now.getFullYear()
  const companyPeriods = periods.filter((period) => period.company_id === company.id)
  const existingMonths = new Set(
    companyPeriods
      .filter((period) => period.period_year === year)
      .map((period) => period.period_month),
  )

  const created = []
  for (let month = 1; month <= 12; month += 1) {
    if (!existingMonths.has(month)) {
      created.push(buildPeriod(company.id, year, month, now))
    }
  }

  const nextCompanyPeriods = [...companyPeriods, ...created].sort(
    (left, right) =>
      left.period_year - right.period_year
      || left.period_month - right.period_month,
  )
  return [
    ...periods.filter((period) => period.company_id !== company.id),
    ...nextCompanyPeriods,
  ]
}

export function createBrowserPreviewPeriod({
  companyId,
  year,
  month,
  periods,
  now = new Date(),
}) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('会计期间的年份或月份无效')
  }
  if (
    periods.some(
      (period) =>
        period.company_id === companyId
        && period.period_year === year
        && period.period_month === month,
    )
  ) {
    throw new Error(`会计期间 ${year}-${month} 已存在`)
  }
  return buildPeriod(companyId, year, month, now)
}

function updateBrowserPreviewPeriod({ periodId, periods, transition }) {
  const period = periods.find((item) => item.id === periodId)
  if (!period) return null

  const updatedPeriod = transition(period)
  return {
    period: updatedPeriod,
    periods: periods.map((item) => item.id === periodId ? updatedPeriod : item),
  }
}

export function closeBrowserPreviewPeriod({
  periodId,
  periods,
  closedBy = 'admin',
  now = new Date(),
}) {
  const result = updateBrowserPreviewPeriod({
    periodId,
    periods,
    transition: (period) => {
      if (period.status === 'closed') {
        throw new Error('该会计期间已经结账')
      }
      const timestamp = now.toISOString()
      return {
        ...period,
        status: 'closed',
        closed_at: timestamp,
        closed_by: closedBy || 'admin',
        updated_at: timestamp,
      }
    },
  })
  if (!result) throw new Error('未找到需要结账的会计期间')
  return result
}

export function reopenBrowserPreviewPeriod({
  periodId,
  periods,
  now = new Date(),
}) {
  const result = updateBrowserPreviewPeriod({
    periodId,
    periods,
    transition: (period) => {
      if (period.status !== 'closed') {
        throw new Error('该会计期间尚未结账')
      }
      return {
        ...period,
        status: 'open',
        closed_at: null,
        closed_by: null,
        updated_at: now.toISOString(),
      }
    },
  })
  if (!result) throw new Error('未找到需要反结账的会计期间')
  return result
}

export function hasDashboardDataScope({ companyId, periodId }) {
  return Boolean(companyId && periodId)
}

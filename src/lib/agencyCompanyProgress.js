const normalizedText = (value) => String(value ?? '').trim().toLowerCase()

const periodLabel = (year, month) => {
  const numericYear = Number(year)
  const numericMonth = Number(month)
  if (!Number.isInteger(numericYear) || !Number.isInteger(numericMonth) || numericMonth < 1 || numericMonth > 12) return ''
  return `${numericYear}-${String(numericMonth).padStart(2, '0')}`
}

const latestValue = (records) => records
  .flatMap((record) => [record.updated_at, record.created_at].filter(Boolean))
  .map(String)
  .sort((left, right) => right.localeCompare(left))[0] || null

function resolveCompanyPeriod(company, periods, requestedPeriod) {
  if (requestedPeriod) return requestedPeriod
  const companyPeriods = periods
    .filter((period) => period.company_id === company.id)
    .sort((left, right) => {
      const statusPriority = Number(normalizedText(right.status) === 'open') - Number(normalizedText(left.status) === 'open')
      if (statusPriority !== 0) return statusPriority
      return periodLabel(right.period_year, right.period_month).localeCompare(periodLabel(left.period_year, left.period_month))
    })
  return companyPeriods.length > 0
    ? periodLabel(companyPeriods[0].period_year, companyPeriods[0].period_month)
    : periodLabel(company.enable_year, company.enable_month)
}

export function buildAgencyCompanyProgressRows({
  companies = [],
  periods = [],
  invoices = [],
  vouchers = [],
  taxTasks = [],
  requestedPeriod = '',
} = {}) {
  return [...companies]
    .sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), 'zh-CN'))
    .map((company) => {
      const period = resolveCompanyPeriod(company, periods, requestedPeriod)
      const periodIds = new Set(periods
        .filter((item) => item.company_id === company.id && periodLabel(item.period_year, item.period_month) === period)
        .map((item) => item.id))
      const periodInvoices = invoices.filter((item) => (
        item.company_id === company.id
        && (periodIds.has(item.period_id) || (!item.period_id && String(item.invoice_date || '').startsWith(period)))
      ))
      const periodVouchers = vouchers.filter((item) => (
        item.company_id === company.id
        && Number(item.is_deleted || 0) !== 1
        && (periodIds.has(item.period_id) || (!item.period_id && String(item.voucher_date || '').startsWith(period)))
      ))
      const periodTaxTasks = taxTasks.filter((item) => item.company_id === company.id && item.period === period)
      const invoicePendingCount = periodInvoices.filter((item) => ![
        'matched', 'approved', 'booked', 'processed', 'completed', 'passed',
      ].includes(normalizedText(item.status))).length
      const approvedVoucherCount = periodVouchers.filter((item) => ['approved', 'reversed'].includes(normalizedText(item.status))).length
      const collectedTaxTaskCount = periodTaxTasks.filter((item) => ![
        '', 'not_collected', 'pending', 'failed', 'blocked',
      ].includes(normalizedText(item.collect_status))).length
      const declaredTaxTaskCount = periodTaxTasks.filter((item) => [
        'confirmed', 'archived', 'filed', 'submitted', 'completed',
      ].includes(normalizedText(item.declaration_status))).length
      const paidTaxTaskCount = periodTaxTasks.filter((item) => [
        'paid', 'confirmed', 'completed',
      ].includes(normalizedText(item.payment_status))).length
      const invoiceRiskCount = periodInvoices.filter((item) => ['abnormal', 'rejected', 'error', 'blocked'].includes(normalizedText(item.status))).length
      const taxRiskCount = periodTaxTasks.reduce((sum, item) => {
        const explicitRiskCount = Math.max(0, Number(item.risk_count) || 0)
        const validationRisk = ['failed', 'error', 'blocked'].includes(normalizedText(item.validation_status)) && explicitRiskCount === 0 ? 1 : 0
        return sum + explicitRiskCount + validationRisk
      }, 0)

      return {
        company_id: company.id,
        period,
        invoice_count: periodInvoices.length,
        invoice_pending_count: invoicePendingCount,
        voucher_count: periodVouchers.length,
        approved_voucher_count: approvedVoucherCount,
        tax_task_count: periodTaxTasks.length,
        collected_tax_task_count: collectedTaxTaskCount,
        declared_tax_task_count: declaredTaxTaskCount,
        paid_tax_task_count: paidTaxTaskCount,
        risk_count: invoiceRiskCount + taxRiskCount,
        latest_activity_at: latestValue([...periodInvoices, ...periodVouchers, ...periodTaxTasks]),
      }
    })
}

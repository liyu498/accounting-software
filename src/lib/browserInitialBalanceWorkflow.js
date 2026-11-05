function finiteAmount(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

export function buildBrowserInitialBalanceFinalization({
  records,
  companyId,
  period,
  finalizedBy = 'admin',
  now = new Date(),
}) {
  if (!companyId || !period) throw new Error('期初余额确认范围不完整')
  const scoped = (Array.isArray(records) ? records : []).filter(
    (record) => record?.companyId === companyId && record?.period === period,
  )
  const totalDebit = scoped.reduce((sum, record) => sum + finiteAmount(record.openingDebit), 0)
  const totalCredit = scoped.reduce((sum, record) => sum + finiteAmount(record.openingCredit), 0)
  if (Math.abs(totalDebit - totalCredit) >= 0.005) {
    throw new Error(`期初余额试算不平衡：借方 ${totalDebit.toFixed(2)}，贷方 ${totalCredit.toFixed(2)}`)
  }
  return {
    companyId,
    period,
    totalDebit,
    totalCredit,
    finalizedBy: String(finalizedBy || 'admin'),
    finalizedAt: now.toISOString(),
  }
}

export function hasBrowserInitialBalanceFinalization(finalizations, companyId, period) {
  return (Array.isArray(finalizations) ? finalizations : []).some(
    (item) => item?.companyId === companyId && item?.period === period && typeof item?.finalizedAt === 'string',
  )
}

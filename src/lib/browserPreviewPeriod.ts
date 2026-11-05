import type { AccountingPeriod } from '../stores/periodStore'
import { findLatestOpenBrowserPreviewPeriod } from './browserPreviewPeriods.js'

const previewPeriodStorageKey = 'accounting-preview-periods-v1'
const legacyPreviewCompanyIds = new Set(['browser-preview-company', 'browser-preview', 'preview-company'])

function isAccountingPeriod(value: unknown): value is AccountingPeriod {
  if (!value || typeof value !== 'object') return false
  const period = value as AccountingPeriod
  return Boolean(
    typeof period.id === 'string'
    && typeof period.company_id === 'string'
    && Number.isInteger(period.period_year)
    && Number.isInteger(period.period_month)
    && typeof period.status === 'string',
  )
}

export function loadBrowserPreviewOpenPeriod(companyId: string | null): AccountingPeriod | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const parsed = JSON.parse(window.localStorage.getItem(previewPeriodStorageKey) || 'null') as unknown
    if (!Array.isArray(parsed)) return undefined
    const periods = parsed.filter(isAccountingPeriod)
    if (companyId) return findLatestOpenBrowserPreviewPeriod(periods, companyId)
    const legacyCompanyId = periods.find((period) => legacyPreviewCompanyIds.has(period.company_id))?.company_id
    return legacyCompanyId
      ? findLatestOpenBrowserPreviewPeriod(periods, legacyCompanyId)
      : undefined
  } catch {
    return undefined
  }
}

export function previewPeriodLabel(period: AccountingPeriod | undefined): string | null {
  return period
    ? `${period.period_year}-${String(period.period_month).padStart(2, '0')}`
    : null
}

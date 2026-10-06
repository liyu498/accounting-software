import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Building2, Check, Plus } from 'lucide-react'
import { cn } from '../../lib/utils'
import { isTauri } from '../../lib/tauri'
import { useCompanyStore } from '../../stores/companyStore'
import { usePeriodStore, type AccountingPeriod } from '../../stores/periodStore'

function loadBrowserPreviewOpenPeriod(companyId: string | null): AccountingPeriod | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const parsed = JSON.parse(window.localStorage.getItem('accounting-preview-periods-v1') || 'null') as unknown
    if (!Array.isArray(parsed)) return undefined
    return parsed.find((period): period is AccountingPeriod => Boolean(
      period
      && typeof period === 'object'
      && typeof (period as AccountingPeriod).id === 'string'
      && typeof (period as AccountingPeriod).company_id === 'string'
      && Number.isInteger((period as AccountingPeriod).period_year)
      && Number.isInteger((period as AccountingPeriod).period_month)
      && (period as AccountingPeriod).status !== 'closed'
      && ((period as AccountingPeriod).company_id === companyId || (!companyId && ['browser-preview-company', 'browser-preview', 'preview-company'].includes((period as AccountingPeriod).company_id))),
    ))
  } catch {
    return undefined
  }
}

export function CompanySelector() {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const { companies, selectedCompanyId, selectCompany, fetchCompanies } =
    useCompanyStore()
  const {
    periods,
    currentPeriodId,
    setCurrentPeriod,
    fetchPeriods,
  } = usePeriodStore()

  useEffect(() => {
    fetchCompanies().catch(() => {})
  }, [fetchCompanies])

  useEffect(() => {
    if (selectedCompanyId) {
      fetchPeriods(selectedCompanyId).then(() => {
        const { periods, currentPeriodId, setCurrentPeriod } = usePeriodStore.getState()
        if (!currentPeriodId || !periods.find(p => p.id === currentPeriodId)) {
          const companyPeriods = periods.filter(p => p.company_id === selectedCompanyId)
          if (companyPeriods.length > 0) {
            setCurrentPeriod(companyPeriods[0].id)
          }
        }
      }).catch(() => {})
    }
  }, [selectedCompanyId, fetchPeriods])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentCompany = companies.find((c) => c.id === selectedCompanyId)
  const currentPeriod = periods.find((p) => p.id === currentPeriodId)
  const browserPreviewPeriod = loadBrowserPreviewOpenPeriod(selectedCompanyId)
  const hasBrowserPreviewPeriod = Boolean(!isTauri && browserPreviewPeriod)
  const companyLabel = currentCompany
    ? `${currentCompany.code} | ${currentCompany.name}`
    : hasBrowserPreviewPeriod
      ? '浏览器预览账套'
      : '未选择账套'
  const periodLabel = currentPeriod
    ? `${currentPeriod.period_year}-${String(currentPeriod.period_month).padStart(2, '0')}`
    : browserPreviewPeriod
      ? `${browserPreviewPeriod.period_year}-${String(browserPreviewPeriod.period_month).padStart(2, '0')}`
      : '未选择账期'

  const companyPeriods = periods.filter(p => p.company_id === selectedCompanyId)
  const periodYears = [...new Set(companyPeriods.map(p => p.period_year))].sort((a, b) => b - a)

  // Current selected year/month for dropdowns
  const selectedYear = currentPeriod?.period_year ?? new Date().getFullYear()
  const selectedMonth = currentPeriod?.period_month ?? (new Date().getMonth() + 1)

  const handleSelectCompany = (companyId: string) => {
    if (companyId !== selectedCompanyId) {
      setCurrentPeriod(null)
    }
    selectCompany(companyId)
    setIsOpen(false)
  }

  const handleYearChange = (year: number) => {
    // Find the period matching the new year + current month
    const target = companyPeriods.find(p => p.period_year === year && p.period_month === selectedMonth)
    if (target) {
      setCurrentPeriod(target.id)
    } else {
      // Fallback: find the first period in that year
      const firstInYear = companyPeriods.find(p => p.period_year === year)
      if (firstInYear) setCurrentPeriod(firstInYear.id)
    }
  }

  const handleMonthChange = (month: number) => {
    const target = companyPeriods.find(p => p.period_year === selectedYear && p.period_month === month)
    if (target) {
      setCurrentPeriod(target.id)
    }
  }

  return (
    <div className="relative flex min-w-0 items-center gap-2" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'inline-flex h-8 w-[92px] shrink-0 items-center justify-between gap-2 rounded border border-slate-300 bg-white px-2 text-sm font-medium text-slate-900 transition-colors sm:w-[96px] sm:px-3',
          isOpen && 'border-white ring-2 ring-white/30',
        )}
      >
        <span>{periodLabel}</span>
        <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform', isOpen && 'rotate-180')} />
      </button>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'inline-flex h-8 min-w-0 flex-1 items-center justify-between gap-2 rounded border border-slate-300 bg-white px-2 text-sm font-medium text-slate-900 transition-colors sm:w-[300px] sm:flex-none sm:px-3',
          isOpen && 'border-white ring-2 ring-white/30',
        )}
      >
        <Building2 className="h-4 w-4 text-[#1f65a7]" />
        <span className="min-w-0 flex-1 truncate text-left">{companyLabel}</span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-slate-400 transition-transform',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-1rem))] rounded-xl border border-gray-200 bg-white py-2 shadow-lg animate-fade-in dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-gray-100 px-3 py-2 dark:border-slate-800">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
              切换公司
            </p>
          </div>

          <div className="max-h-48 overflow-y-auto">
            {companies.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-gray-500 dark:text-slate-400">
                暂无公司
              </div>
            ) : (
              companies.map((company) => (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => handleSelectCompany(company.id)}
                  className={cn(
                    'flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-slate-800',
                    company.id === selectedCompanyId &&
                      'bg-primary-50 hover:bg-primary-50 dark:bg-blue-950/45 dark:hover:bg-blue-950/55',
                  )}
                >
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                      company.id === selectedCompanyId
                        ? 'border-primary-600 bg-primary-600'
                        : 'border-gray-300 dark:border-slate-600',
                    )}
                  >
                    {company.id === selectedCompanyId && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        'text-sm font-medium',
                        company.id === selectedCompanyId
                          ? 'text-primary-700 dark:text-blue-200'
                          : 'text-gray-900 dark:text-slate-100',
                      )}
                    >
                      {company.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{company.code}</p>
                  </div>
                </button>
              ))
            )}
          </div>

          {selectedCompanyId && companyPeriods.length > 0 && (
            <>
              <div className="border-y border-gray-100 px-3 py-2 dark:border-slate-800">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  会计期间
                </p>
              </div>
              <div className="px-3 py-3">
                <div className="flex items-center gap-2">
                  <select
                    value={selectedYear}
                    onChange={(e) => handleYearChange(Number(e.target.value))}
                    className="h-9 flex-1 rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    title="选择年份"
                  >
                    {periodYears.map(year => (
                      <option key={year} value={year}>{year}年</option>
                    ))}
                  </select>
                  <select
                    value={selectedMonth}
                    onChange={(e) => handleMonthChange(Number(e.target.value))}
                    className="h-9 flex-1 rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    title="选择月份"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                      const periodForMonth = companyPeriods.find(p => p.period_year === selectedYear && p.period_month === m)
                      return (
                        <option key={m} value={m} disabled={!periodForMonth}>
                          {String(m).padStart(2, '0')}月{!periodForMonth ? ' (未建)' : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="border-t border-gray-100 px-3 py-2 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                navigate('/')
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-primary-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-200"
            >
              <Plus className="w-4 h-4" />
              <span>新增公司</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

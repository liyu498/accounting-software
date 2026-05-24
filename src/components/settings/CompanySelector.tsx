import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Building2, Check, Plus } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useCompanyStore } from '../../stores/companyStore'
import { usePeriodStore } from '../../stores/periodStore'

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
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
          'hover:bg-gray-50 border-gray-200',
          isOpen && 'bg-gray-50 border-primary-300 ring-2 ring-primary-100',
        )}
      >
        <Building2 className="w-4 h-4 text-primary-600" />
        <div className="text-left">
          <p className="text-sm font-medium text-gray-900">
            {currentCompany ? currentCompany.name : '选择公司'}
          </p>
          {currentPeriod && (
            <p className="text-xs text-gray-500">
              {currentPeriod.period_year}年{String(currentPeriod.period_month).padStart(2, '0')}月
            </p>
          )}
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-gray-400 transition-transform',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50 animate-fade-in">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              切换公司
            </p>
          </div>

          <div className="max-h-48 overflow-y-auto">
            {companies.length === 0 ? (
              <div className="px-3 py-6 text-center text-gray-500 text-sm">
                暂无公司
              </div>
            ) : (
              companies.map((company) => (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => handleSelectCompany(company.id)}
                  className={cn(
                    'flex items-start gap-3 w-full px-3 py-3 text-left transition-colors',
                    'hover:bg-gray-50',
                    company.id === selectedCompanyId &&
                      'bg-primary-50 hover:bg-primary-50',
                  )}
                >
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                      company.id === selectedCompanyId
                        ? 'border-primary-600 bg-primary-600'
                        : 'border-gray-300',
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
                          ? 'text-primary-700'
                          : 'text-gray-900',
                      )}
                    >
                      {company.name}
                    </p>
                    <p className="text-xs text-gray-500">{company.code}</p>
                  </div>
                </button>
              ))
            )}
          </div>

          {selectedCompanyId && companyPeriods.length > 0 && (
            <>
              <div className="px-3 py-2 border-t border-b border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  会计期间
                </p>
              </div>
              <div className="px-3 py-3">
                <div className="flex items-center gap-2">
                  <select
                    value={selectedYear}
                    onChange={(e) => handleYearChange(Number(e.target.value))}
                    className="flex-1 h-9 px-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    title="选择年份"
                  >
                    {periodYears.map(year => (
                      <option key={year} value={year}>{year}年</option>
                    ))}
                  </select>
                  <select
                    value={selectedMonth}
                    onChange={(e) => handleMonthChange(Number(e.target.value))}
                    className="flex-1 h-9 px-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
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

          <div className="px-3 py-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                navigate('/')
              }}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-gray-600 hover:text-primary-600 hover:bg-gray-50 rounded-lg transition-colors"
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

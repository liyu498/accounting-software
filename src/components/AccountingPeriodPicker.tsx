import { Select } from 'antd'
import { useCompanyStore } from '../stores/companyStore'

export function AccountingPeriodPicker() {
  const periods = useCompanyStore((state) => state.periods)
  const selectedPeriodId = useCompanyStore((state) => state.selectedPeriodId)
  const selectPeriod = useCompanyStore((state) => state.selectPeriod)

  return (
    <Select
      aria-label="current-accounting-period"
      className="accounting-period-picker"
      options={periods.map((period) => ({
        label: `${period.year}-${String(period.month).padStart(2, '0')}`,
        value: period.id,
      }))}
      placeholder="閫夋嫨鏈熼棿"
      value={selectedPeriodId ?? undefined}
      onChange={selectPeriod}
    />
  )
}

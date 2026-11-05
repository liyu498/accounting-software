import {
  changeChinaRegionCity,
  changeChinaRegionProvince,
  chinaProvinceOptions,
  getChinaCityOptions,
  getChinaDistrictOptions,
} from '../../lib/companyReferenceData.js'

export interface ChinaRegionValue {
  province: string
  city: string
  district: string
}

interface ChinaRegionSelectProps {
  value: ChinaRegionValue
  onChange: (value: ChinaRegionValue) => void
  required?: boolean
  className?: string
}

const defaultClassName = 'h-9 min-w-0 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500'

function withCurrent(options: string[], currentValue: string) {
  if (!currentValue || options.includes(currentValue)) return options
  return [...options, currentValue]
}

export function ChinaRegionSelect({ value, onChange, required = false, className = defaultClassName }: ChinaRegionSelectProps) {
  const provinceOptions = withCurrent(chinaProvinceOptions, value.province)
  const cityOptions = getChinaCityOptions(value.province, value.city)
  const districtOptions = getChinaDistrictOptions(value.province, value.city, value.district)

  return <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
    <select aria-label="省份" required={required} value={value.province} onChange={(event) => onChange(changeChinaRegionProvince(value, event.target.value))} className={className}>
      <option value="">选择省份</option>
      {provinceOptions.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
    <select aria-label="城市" required={required && cityOptions.length > 0} disabled={!value.province || cityOptions.length === 0} value={value.city} onChange={(event) => onChange(changeChinaRegionCity(value, event.target.value))} className={className}>
      <option value="">选择城市</option>
      {cityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
    <select aria-label="区县" required={required && districtOptions.length > 0} disabled={!value.city || districtOptions.length === 0} value={value.district} onChange={(event) => onChange({ ...value, district: event.target.value })} className={className}>
      <option value="">{districtOptions.length > 0 ? '选择区县' : '暂无区县数据'}</option>
      {districtOptions.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </div>
}

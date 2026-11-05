import regionTree from '@province-city-china/level'

const directRegionLabel = '省直辖县级行政区划'

function provinceNode(provinceName) {
  return regionTree.find((item) => item.name === provinceName)
}

function normalizedCities(provinceName) {
  const province = provinceNode(provinceName)
  if (!province) return []

  const children = Array.isArray(province.children) ? province.children : []
  const cities = children
    .filter((item) => Array.isArray(item.children))
    .map((item) => ({ name: item.name, districts: item.children || [] }))
  const directDistricts = children.filter((item) => !Array.isArray(item.children))

  if (directDistricts.length > 0) {
    cities.push({
      name: cities.length === 0 ? province.name : directRegionLabel,
      districts: directDistricts,
    })
  }

  if (cities.length === 0) cities.push({ name: province.name, districts: [] })
  return cities
}

function preserveCurrent(options, currentValue) {
  const value = String(currentValue ?? '').trim()
  if (!value || options.includes(value)) return options
  return [...options, value]
}

export const chinaProvinceOptions = regionTree.map((item) => item.name)

export function getChinaCityOptions(provinceName, currentCity = '') {
  const options = normalizedCities(provinceName).map((item) => item.name)
  return preserveCurrent(options, currentCity)
}

export function getChinaDistrictOptions(provinceName, cityName, currentDistrict = '') {
  const city = normalizedCities(provinceName).find((item) => item.name === cityName)
  const options = city ? city.districts.map((item) => item.name) : []
  return preserveCurrent(options, currentDistrict)
}

export function isValidChinaRegion({ province, city, district }) {
  const provinceName = String(province ?? '').trim()
  const cityName = String(city ?? '').trim()
  const districtName = String(district ?? '').trim()
  if (!chinaProvinceOptions.includes(provinceName)) return false

  const cities = getChinaCityOptions(provinceName)
  if (!cities.includes(cityName)) return false

  const districts = getChinaDistrictOptions(provinceName, cityName)
  return districts.length === 0 ? districtName === '' : districts.includes(districtName)
}

export function changeChinaRegionProvince(current, province) {
  const city = getChinaCityOptions(province)[0] || ''
  const district = getChinaDistrictOptions(province, city)[0] || ''
  return { ...current, province, city, district }
}

export function changeChinaRegionCity(current, city) {
  const district = getChinaDistrictOptions(current.province, city)[0] || ''
  return { ...current, city, district }
}

export const defaultChinaRegion = changeChinaRegionCity(
  { province: '江苏省', city: '南京市', district: '' },
  '南京市',
)

export const chinaRegionStats = regionTree.reduce(
  (stats, province) => {
    const cities = normalizedCities(province.name)
    stats.cityCount += cities.length
    stats.districtCount += cities.reduce((count, city) => count + city.districts.length, 0)
    return stats
  },
  { provinceCount: regionTree.length, cityCount: 0, districtCount: 0 },
)

export const industryOptions = [
  '农、林、牧、渔业',
  '采矿业',
  '制造业',
  '电力、热力、燃气及水生产和供应业',
  '建筑业',
  '批发和零售业',
  '交通运输、仓储和邮政业',
  '住宿和餐饮业',
  '信息传输、软件和信息技术服务业',
  '金融业',
  '房地产业',
  '租赁和商务服务业',
  '科学研究和技术服务业',
  '水利、环境和公共设施管理业',
  '居民服务、修理和其他服务业',
  '教育',
  '卫生和社会工作',
  '文化、体育和娱乐业',
  '公共管理、社会保障和社会组织',
  '国际组织',
]

// Leaf categories from the 2023 market-subject statistical classification (6/17/23 hierarchy).
export const enterpriseTypeOptions = [
  '国有独资公司',
  '私营有限责任公司',
  '其他有限责任公司',
  '私营股份有限公司',
  '其他股份有限公司',
  '全民所有制企业（国有企业）',
  '集体所有制企业（集体企业）',
  '股份合作企业',
  '联营企业',
  '个人独资企业',
  '合伙企业',
  '其他内资企业',
  '港澳台投资有限责任公司',
  '港澳台投资股份有限公司',
  '港澳台投资合伙企业',
  '其他港澳台投资企业',
  '外商投资有限责任公司',
  '外商投资股份有限公司',
  '外商投资合伙企业',
  '其他外商投资企业',
  '农民专业合作社（联合社）',
  '个体工商户',
  '其他市场主体',
]

export function withCurrentReferenceOption(options, currentValue) {
  return preserveCurrent(options, currentValue)
}

export const minimumEnableYear = 1900

export function isValidEnableYear(value, currentYear = new Date().getFullYear()) {
  const year = Number(value)
  return Number.isInteger(year) && year >= minimumEnableYear && year <= Number(currentYear) + 1
}

export function buildEnableYearOptions(currentYear = new Date().getFullYear(), activeYear = '') {
  const endYear = Math.max(minimumEnableYear, Number(currentYear) + 1)
  const years = Array.from({ length: endYear - minimumEnableYear + 1 }, (_, index) => String(endYear - index))
  const active = String(activeYear ?? '').trim()
  return isValidEnableYear(active, currentYear) && !years.includes(active) ? [...years, active] : years
}

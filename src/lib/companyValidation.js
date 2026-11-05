import { isValidChinaRegion } from './companyReferenceData.js'

export function validateCompanyCreation(draft) {
  if (!String(draft.name ?? '').trim() || !String(draft.taxId ?? '').trim()) {
    return '请填写企业名称和纳税人识别号'
  }

  if (
    !String(draft.province ?? '').trim()
    || !String(draft.city ?? '').trim()
    || (!String(draft.district ?? '').trim() && String(draft.province ?? '').trim() !== '台湾省')
  ) {
    return '请选择完整的省、市、区县'
  }

  if (!isValidChinaRegion(draft)) {
    return '省、市、区县组合不正确，请重新选择'
  }

  if (
    !String(draft.taxLoginPerson ?? '').trim()
    || !String(draft.taxLoginMethod ?? '').trim()
  ) {
    return '请选择税务授权人员和授权方式'
  }

  return null
}

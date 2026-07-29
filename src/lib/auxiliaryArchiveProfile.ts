export type AuxiliaryArchiveKind = 'customerArchive' | 'supplierArchive' | 'otherContactArchive' | 'projectArchive' | 'departmentArchive'

export type AuxiliaryArchiveProfile = {
  taxNo?: string
  bank?: string
  subject?: string
  contract?: string
  alias?: string
  taxRate?: string
  contactType?: string
  idNo?: string
  owner?: string
  start?: string
  budget?: string
  parent?: string
  people?: string
  remark?: string
}

const profilePrefix = '@archive-profile:'

export const auxiliaryArchiveDefinitions: Record<AuxiliaryArchiveKind, { categoryCode: string; categoryName: string; title: string }> = {
  customerArchive: { categoryCode: 'CUST', categoryName: '客户', title: '客户' },
  supplierArchive: { categoryCode: 'SUPP', categoryName: '供应商', title: '供应商' },
  otherContactArchive: { categoryCode: 'EMP', categoryName: '职员', title: '其他往来' },
  projectArchive: { categoryCode: 'PROJ', categoryName: '项目', title: '项目' },
  departmentArchive: { categoryCode: 'DEPT', categoryName: '部门', title: '部门' },
}

export function parseAuxiliaryArchiveProfile(remarks: string | null | undefined): AuxiliaryArchiveProfile {
  if (!remarks?.startsWith(profilePrefix)) return { remark: remarks || '' }
  try {
    const parsed = JSON.parse(remarks.slice(profilePrefix.length))
    return typeof parsed === 'object' && parsed !== null ? parsed as AuxiliaryArchiveProfile : {}
  } catch {
    return { remark: remarks }
  }
}

export function serializeAuxiliaryArchiveProfile(profile: AuxiliaryArchiveProfile) {
  return `${profilePrefix}${JSON.stringify(profile)}`
}

// Shared constants for the accounting app

export type TaxpayerType = 'small' | 'general'
export type CustomerStatus = 'active' | 'inactive' | 'suspended'
export type AccountingSystem = 'small_enterprise' | 'enterprise' | 'non_profit' | 'cooperative'

export const taxpayerTypeLabels: Record<TaxpayerType, string> = {
  small: '小规模纳税人',
  general: '一般纳税人',
}

export const accountingSystemLabels: Record<AccountingSystem, string> = {
  small_enterprise: '小企业会计准则',
  enterprise: '企业会计准则',
  non_profit: '民间非营利组织会计制度',
  cooperative: '农民专业合作社财务会计制度',
}

export const accountingSystemDescriptions: Record<AccountingSystem, string> = {
  small_enterprise: '适用于小型企业，科目简化',
  enterprise: '适用于大中型企业，科目完整',
  non_profit: '适用于民间非营利组织（社会团体、基金会等）',
  cooperative: '适用于农民专业合作社',
}

export const accountingStandardLabels: Record<string, string> = {
  small: '小企业会计准则',
  enterprise: '企业会计准则',
  small_enterprise: '小企业会计准则',
  non_profit: '民间非营利组织会计制度',
  cooperative: '农民专业合作社财务会计制度',
}

export const statusLabels: Record<CustomerStatus, string> = {
  active: '正常',
  inactive: '停用',
  suspended: '暂停',
}

export const accountStatusLabels: Record<string, string> = {
  active: '正常',
  closed: '已关账',
  suspended: '暂停',
}

export const accountTypeLabels: Record<string, string> = {
  asset: '资产类',
  liability: '负债类',
  equity: '所有者权益类',
  cost: '成本类',
  income: '损益类-收入',
  expense: '损益类-费用',
}

export const balanceDirectionLabels: Record<string, string> = {
  debit: '借方',
  credit: '贷方',
}

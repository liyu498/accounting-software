import type { AccountingPeriod, Company, Session, User, VoucherDetail } from '../services/types'

export interface AccountSeed {
  code: string
  name: string
  direction: 'debit' | 'credit'
}

export const adminUser: User = {
  id: 'user-admin',
  username: 'admin',
  realName: '管理员',
  role: 'admin',
}

export const adminSession: Session = {
  token: 'mock-session-token',
  user: adminUser,
}

export const companies: Company[] = [
  {
    id: 'company-1',
    code: 'ACME-001',
    name: '示例商贸有限公司',
    taxId: '91310000123456789X',
    accountingSystem: 'enterprise',
    currentPeriodId: 'period-2026-06',
    status: 'active',
  },
]

export const periods: AccountingPeriod[] = [
  {
    id: 'period-2026-06',
    companyId: 'company-1',
    year: 2026,
    month: 6,
    status: 'open',
  },
]

export const accounts: AccountSeed[] = [
  { code: '1001', name: '库存现金', direction: 'debit' },
  { code: '1002', name: '银行存款', direction: 'debit' },
  { code: '2202', name: '应付账款', direction: 'credit' },
  { code: '6001', name: '主营业务收入', direction: 'credit' },
]

export const seedVouchers: VoucherDetail[] = [
  {
    id: 'voucher-1',
    companyId: 'company-1',
    periodId: 'period-2026-06',
    voucherDate: '2026-06-10',
    voucherNumber: '记-0001',
    voucherWord: '记',
    summary: '服务收入',
    debitTotal: 500,
    creditTotal: 500,
    status: 'approved',
    createdBy: 'admin',
    attachmentCount: 1,
    entries: [
      { id: 'voucher-1-line-1', summary: '服务收入', accountCode: '1002', accountName: '银行存款', debit: 500, credit: 0 },
      { id: 'voucher-1-line-2', summary: '服务收入', accountCode: '6001', accountName: '主营业务收入', debit: 0, credit: 500 },
    ],
  },
  {
    id: 'voucher-2',
    companyId: 'company-1',
    periodId: 'period-2026-06',
    voucherDate: '2026-06-12',
    voucherNumber: '记-0002',
    voucherWord: '记',
    summary: '采购办公用品',
    debitTotal: 300,
    creditTotal: 300,
    status: 'draft',
    createdBy: 'admin',
    attachmentCount: 2,
    entries: [
      { id: 'voucher-2-line-1', summary: '采购办公用品', accountCode: '2202', accountName: '应付账款', debit: 300, credit: 0 },
      { id: 'voucher-2-line-2', summary: '采购办公用品', accountCode: '1001', accountName: '库存现金', debit: 0, credit: 300 },
    ],
  },
]

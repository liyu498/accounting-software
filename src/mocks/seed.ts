import type { AccountingPeriod, Company, Session, User, VoucherDetail } from '../services/types'

export interface AccountSeed {
  code: string
  name: string
  direction: 'debit' | 'credit'
}

export const adminUser: User = {
  id: 'user-admin',
  username: 'admin',
  realName: 'System Admin',
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
    name: 'Acme Trading Co.',
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
  { code: '1001', name: '搴撳瓨鐜伴噾', direction: 'debit' },
  { code: '1002', name: '閾惰瀛樻', direction: 'debit' },
  { code: '2202', name: '搴斾粯璐︽', direction: 'credit' },
  { code: '6001', name: '涓昏惀涓氬姟鏀跺叆', direction: 'credit' },
]

export const seedVouchers: VoucherDetail[] = [
  {
    id: 'voucher-1',
    companyId: 'company-1',
    periodId: 'period-2026-06',
    voucherDate: '2026-06-10',
    voucherNumber: '璁?-0001',
    voucherWord: '璁?',
    summary: '鏈嶅姟鏀跺叆',
    debitTotal: 500,
    creditTotal: 500,
    status: 'approved',
    createdBy: 'admin',
    attachmentCount: 1,
    entries: [
      { id: 'voucher-1-line-1', summary: '鏈嶅姟鏀跺叆', accountCode: '1002', accountName: '閾惰瀛樻', debit: 500, credit: 0 },
      { id: 'voucher-1-line-2', summary: '鏈嶅姟鏀跺叆', accountCode: '6001', accountName: '涓昏惀涓氬姟鏀跺叆', debit: 0, credit: 500 },
    ],
  },
  {
    id: 'voucher-2',
    companyId: 'company-1',
    periodId: 'period-2026-06',
    voucherDate: '2026-06-12',
    voucherNumber: '璁?-0002',
    voucherWord: '璁?',
    summary: '閲囪喘鏀粯',
    debitTotal: 300,
    creditTotal: 300,
    status: 'draft',
    createdBy: 'admin',
    attachmentCount: 2,
    entries: [
      { id: 'voucher-2-line-1', summary: '閲囪喘鏀粯', accountCode: '2202', accountName: '搴斾粯璐︽', debit: 300, credit: 0 },
      { id: 'voucher-2-line-2', summary: '閲囪喘鏀粯', accountCode: '1001', accountName: '搴撳瓨鐜伴噾', debit: 0, credit: 300 },
    ],
  },
]
